// ── Shared helpers ──

const CLIENT_ID = 'https://black-hole.ex-astris-umbra.workers.dev/client-metadata.json';
const SCOPE = 'atproto';
const BSKY_PUBLIC = 'https://public.api.bsky.app';
const SESSION_MAX_AGE = 30 * 24 * 60 * 60;
const STATE_TTL = 15 * 60 * 1000;
const DEFAULT_ORIGIN = 'https://lastnpcalex.agency';

function corsHeaders(request) {
  const origin = (request.headers.get('Origin') || DEFAULT_ORIGIN);
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Cookie',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Expose-Headers': 'Location',
  };
}

function base64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function getSession(env, request) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/session=([^;]+)/);
  if (!match) return null;
  const raw = await env.SESSIONS.get(`session:${match[1]}`);
  if (!raw) return null;
  return JSON.parse(raw);
}

async function importKeyPair(privateKeyJwk, publicKeyJwk) {
  return {
    privateKey: await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', alg: 'ES256', ...privateKeyJwk }, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']),
    publicKey: await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', alg: 'ES256', ...publicKeyJwk }, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']),
  };
}

async function createDpopProof(privateKey, publicKey, method, url, accessToken) {
  const jwk = await crypto.subtle.exportKey('jwk', publicKey);
  const header = { alg: 'ES256', typ: 'dpop+jwt', jwk };
  const payload = {
    jti: crypto.randomUUID(),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60,
    aud: new URL(url).origin,
    htm: method,
    url,
  };
  if (accessToken) {
    const ath = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(accessToken));
    payload.ath = base64url(new Uint8Array(ath));
  }
  const h = base64url(new TextEncoder().encode(JSON.stringify(header)));
  const p = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(h + '.' + p)
  );
  return h + '.' + p + '.' + base64url(new Uint8Array(sig));
}

async function jwkThumbprint(publicKey) {
  const jwk = await crypto.subtle.exportKey('jwk', publicKey);
  delete jwk.d;
  const canon = JSON.stringify(jwk, Object.keys(jwk).sort());
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canon));
  return base64url(new Uint8Array(hash));
}

async function generatePkce() {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = base64url(new Uint8Array(hash));
  return { verifier, challenge };
}

async function resolveHandle(handle) {
  const res = await fetch(`${BSKY_PUBLIC}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`);
  if (!res.ok) throw new Error(`Handle resolution failed: ${res.status}`);
  const data = await res.json();
  const services = data.didDoc?.services || [];
  const atp = services.find(s => s.type === 'AtprotoPersistentHandle');
  return { did: data.did, pds: atp?.serviceEndpoint || 'https://bsky.social' };
}

async function discoverAuthServer(pds) {
  try {
    const res = await fetch(`${pds}/.well-known/oauth-authorization-server`);
    if (!res.ok) return 'https://bsky.social';
    return (await res.json()).issuer;
  } catch {
    return 'https://bsky.social';
  }
}

function jsonResponse(data, status, request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: Object.assign({}, corsHeaders(request || { headers: { get: () => DEFAULT_ORIGIN } }), {
      'Content-Type': 'application/json',
    }),
  });
}

// ── Route handlers ──

async function handleLogin(request, env) {
  const body = await request.json();
  const handle = body?.handle;
  if (!handle) return jsonResponse({ error: 'Handle required' }, 400, request);
  try {
    const { did, pds } = await resolveHandle(handle);
    const authServer = await discoverAuthServer(pds);
    const { verifier, challenge } = await generatePkce();
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']
    );
    const [privateKeyJwk, publicKeyJwk] = await Promise.all([
      crypto.subtle.exportKey('jwk', keyPair.privateKey),
      crypto.subtle.exportKey('jwk', keyPair.publicKey),
    ]);
    // Ensure JWKs have all required fields for re-import
    privateKeyJwk.kty = 'EC';
    privateKeyJwk.crv = 'P-256';
    privateKeyJwk.alg = 'ES256';
    publicKeyJwk.kty = 'EC';
    publicKeyJwk.crv = 'P-256';
    publicKeyJwk.alg = 'ES256';
    const thumbprint = await jwkThumbprint(keyPair.publicKey);
    const state = crypto.randomUUID();
    const redirectOrigin = request.headers.get('origin') || DEFAULT_ORIGIN;
    const stateData = {
      codeVerifier: verifier, privateKeyJwk, publicKeyJwk, authServer,
      redirectUri: `${redirectOrigin}/api/oauth/callback`,
      handle, did, pds, createdAt: Date.now(),
    };
    await env.SESSIONS.put(`state:${state}`, JSON.stringify(stateData), { expirationTtl: 900 });

    // Pushed Authorization Request (PAR) — bsky.social requires it
    const parUrl = `${authServer}/oauth/par`;
    const parDpop = await createDpopProof(keyPair.privateKey, keyPair.publicKey, 'POST', parUrl, null);
    const parBody = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: stateData.redirectUri,
      response_type: 'code',
      scope: SCOPE,
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      dpop_jkt: thumbprint,
    });
    const parRes = await fetch(parUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `DPoP ${parDpop}`,
      },
      body: parBody.toString(),
    });
    if (!parRes.ok) {
      const err = await parRes.text();
      throw new Error(`PAR failed (${parRes.status}): ${err.slice(0, 200)}`);
    }
    const parData = await parRes.json();
    const authorizeUrl = new URL('/oauth/authorize', authServer);
    authorizeUrl.searchParams.set('client_id', CLIENT_ID);
    authorizeUrl.searchParams.set('request_uri', parData.request_uri);
    authorizeUrl.searchParams.set('iss', new URL(CLIENT_ID).origin);
    return jsonResponse({ redirect_url: authorizeUrl.toString() }, 200, request);
  } catch (e) {
    return jsonResponse({ error: e.message }, 500, request);
  }
}

async function handleCallback(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');
  if (error) {
    console.log('[callback] auth error:', error, errorDescription);
    return new Response(null, {
      status: 302,
      headers: { Location: `${url.origin}/test-bsky.html?auth_error=${encodeURIComponent(errorDescription || error)}` },
    });
  }
  if (!code || !state) return jsonResponse({ error: 'Missing code or state' }, 400, request);
  try {
    console.log('[callback] state:', state, 'code:', code?.slice(0, 20) + '...');
    const stateRaw = await env.SESSIONS.get(`state:${state}`);
    if (!stateRaw) {
      console.log('[callback] state not found in KV');
      return jsonResponse({ error: 'Invalid state' }, 400, request);
    }
    const stateData = JSON.parse(stateRaw);
    if (Date.now() - stateData.createdAt > STATE_TTL) {
      await env.SESSIONS.delete(`state:${state}`);
      return jsonResponse({ error: 'State expired' }, 400, request);
    }
    const { privateKey, publicKey } = await importKeyPair(stateData.privateKeyJwk, stateData.publicKeyJwk);
    const tokenUrl = `${stateData.authServer}/oauth/token`;
    const dpopProof = await createDpopProof(privateKey, publicKey, 'POST', tokenUrl, null);
    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code', code, redirect_uri: stateData.redirectUri,
      client_id: CLIENT_ID, code_verifier: stateData.codeVerifier,
      dpop_jkt: await jwkThumbprint(publicKey),
    });
    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'DPoP': dpopProof,
      },
      body: tokenBody.toString(),
    });
    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      return jsonResponse({ error: `Token exchange failed: ${err}` }, 500, request);
    }
    const tokenData = await tokenRes.json();
    await env.SESSIONS.delete(`state:${state}`);
    const sessionId = crypto.randomUUID();
    const sessionData = {
      accessToken: tokenData.access_token, refreshToken: tokenData.refresh_token,
      did: stateData.did, handle: stateData.handle, pds: stateData.pds,
      authServer: stateData.authServer,
      privateKeyJwk: stateData.privateKeyJwk, publicKeyJwk: stateData.publicKeyJwk,
      createdAt: Date.now(),
    };
    await env.SESSIONS.put(`session:${sessionId}`, JSON.stringify(sessionData), { expirationTtl: SESSION_MAX_AGE });
    const cookie = `session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE}`;
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `${url.origin}/test-bsky.html?logged_in=1&sid=${sessionId}`,
        'Set-Cookie': cookie,
      },
    });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500, request);
  }
}

async function handleLogout(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/session=([^;]+)/);
  if (match) await env.SESSIONS.delete(`session:${match[1]}`);
  return jsonResponse({ logged_out: true }, 200, request);
}

async function handleSession(request, env) {
  const session = await getSession(env, request);
  if (!session) return jsonResponse({ error: 'Not authenticated' }, 401, request);
  return jsonResponse({
    did: session.did, handle: session.handle,
    pds: session.pds, loggedInAt: session.createdAt,
  }, 200, request);
}

async function handleSetCookie(request, env) {
  const url = new URL(request.url);
  const sid = url.searchParams.get('sid');
  if (!sid) return jsonResponse({ error: 'Missing sid' }, 400, request);
  const raw = await env.SESSIONS.get(`session:${sid}`);
  if (!raw) return jsonResponse({ error: 'Invalid session' }, 404, request);
  const cookie = `session=${sid}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE}`;
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: Object.assign({}, corsHeaders(request), {
      'Content-Type': 'application/json',
      'Set-Cookie': cookie,
    }),
  });
}

async function handleCreateRecord(request, env) {
  const session = await getSession(env, request);
  if (!session) return jsonResponse({ error: 'Not authenticated' }, 401, request);
  const { privateKey, publicKey } = await importKeyPair(session.privateKeyJwk, session.publicKeyJwk);
  const body = await request.json();
  const url = `${session.pds}/xrpc/com.atproto.repo.createRecord`;
  const dpopProof = await createDpopProof(privateKey, publicKey, 'POST', url, session.accessToken);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `DPoP ${session.accessToken}`,
      'DPoP': dpopProof,
    },
    body: JSON.stringify({ repo: session.did, collection: body.collection, rkey: body.rkey, record: body.record }),
  });
  if (!res.ok) {
    const err = await res.text();
    return jsonResponse({ error: err }, res.status, request);
  }
  return jsonResponse(await res.json(), 200, request);
}

async function handleDeleteRecord(request, env) {
  const session = await getSession(env, request);
  if (!session) return jsonResponse({ error: 'Not authenticated' }, 401, request);
  const { privateKey, publicKey } = await importKeyPair(session.privateKeyJwk, session.publicKeyJwk);
  const body = await request.json();
  const [, repo, collection, rkey] = body.uri.replace('at://', '').split('/');
  const url = `${session.pds}/xrpc/com.atproto.repo.deleteRecord`;
  const dpopProof = await createDpopProof(privateKey, publicKey, 'POST', url, session.accessToken);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `DPoP ${session.accessToken}`,
      'DPoP': dpopProof,
    },
    body: JSON.stringify({ repo, collection, rkey }),
  });
  if (!res.ok) {
    const err = await res.text();
    return jsonResponse({ error: err }, res.status, request);
  }
  return jsonResponse({ deleted: true }, 200, request);
}

// ── Worker entry point ──

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;

    if (request.method === 'OPTIONS' && path.startsWith('/api/')) {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    if (path === '/api/oauth/login') return handleLogin(request, env);
    if (path === '/api/oauth/callback') return handleCallback(request, env);
    if (path === '/api/oauth/logout') return handleLogout(request, env);
    if (path === '/api/oauth/session') return handleSession(request, env);
    if (path === '/api/oauth/setCookie') return handleSetCookie(request, env);
    if (path === '/api/bsky/createRecord') return handleCreateRecord(request, env);
    if (path === '/api/bsky/deleteRecord') return handleDeleteRecord(request, env);

    return env.ASSETS.fetch(request);
  },
};
