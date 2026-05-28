/**
 * OAuth endpoints for ATproto login (PKCE + DPoP).
 *
 * Routes:
 *   POST /api/oauth/login       — resolve handle, redirect to PDS
 *   GET  /api/oauth/callback    — exchange code, set session cookie
 *   POST /api/oauth/logout      — clear session
 *   GET  /api/oauth/session     — check if logged in
 *
 * Security:
 *   PKCE (S256) — prevents auth code interception
 *   DPoP (ES256) — binds tokens to ECDSA P-256 key pair
 *   HttpOnly cookie — session ID never exposed to JS
 *   State parameter — prevents CSRF
 *   15-minute state expiry — prevents stale auth requests
 */

const CLIENT_ID = 'https://lastnpcalex.agency/client-metadata.json';
const SCOPE = 'atproto';
const STATE_TTL = 15 * 60 * 1000; // 15 minutes
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days
const PLC_DIR = 'https://plc.directory';
const BSKY_PUBLIC = 'https://public.api.bsky.app';

// ── Helpers ────────────────────────────────────────────────────

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generatePkce() {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = base64url(new Uint8Array(hash));
  return { verifier, challenge };
}

async function generateKeyPair() {
  return crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );
}

/**
 * Compute JWK thumbprint per RFC 7638.
 * Canonical JWK = sorted keys, no whitespace, public key only.
 */
async function jwkThumbprint(publicKey) {
  const jwk = await crypto.subtle.exportKey('jwk', publicKey);
  // Remove 'd' if present (shouldn't be for public key, but be safe)
  delete jwk.d;
  const canon = JSON.stringify(jwk, Object.keys(jwk).sort());
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canon));
  return base64url(new Uint8Array(hash));
}

/**
 * Create a DPoP proof JWT.
 */
async function createDpopProof(privateKey, publicKey, method, url, accessToken) {
  const jwk = await crypto.subtle.exportKey('jwk', publicKey);

  const header = {
    alg: 'ES256',
    typ: 'dpop+jwt',
    jwk: jwk,
  };

  const payload = {
    jti: crypto.randomUUID(),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60, // 60s validity
    aud: new URL(url).origin,
    httptype: method,
    url,
  };

  // Include access token hash if we have one
  if (accessToken) {
    const ath = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(accessToken));
    payload.ath = base64url(new Uint8Array(ath));
  }

  const headerB64 = base64url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64url(new TextEncoder().encode(JSON.stringify(payload)));

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(headerB64 + '.' + payloadB64)
  );

  return headerB64 + '.' + payloadB64 + '.' + base64url(new Uint8Array(sig));
}

/**
 * Resolve a handle to DID + PDS endpoint.
 */
async function resolveHandle(handle) {
  const res = await fetch(`${BSKY_PUBLIC}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`);
  if (!res.ok) throw new Error(`Handle resolution failed: ${res.status}`);
  const data = await res.json();

  // Get PDS from DID document
  const services = data.didDoc?.services || [];
  const atp = services.find(s => s.type === 'AtprotoPersistentHandle');
  const pds = atp?.serviceEndpoint || 'https://bsky.social';

  return { did: data.did, pds };
}

/**
 * Discover the OAuth authorization server from PDS metadata.
 */
async function discoverAuthServer(pds) {
  try {
    const res = await fetch(`${pds}/.well-known/oauth-authorization-server`);
    if (!res.ok) return 'https://bsky.social';
    const data = await res.json();
    return data.issuer;
  } catch {
    return 'https://bsky.social';
  }
}

/**
 * Import a key pair from stored JWK.
 */
async function importKeyPair(privateKeyJwk, publicKeyJwk) {
  const [privateKey, publicKey] = await Promise.all([
    crypto.subtle.importKey('jwk', privateKeyJwk, { name: 'ECDSA', hash: 'SHA-256' }, true, ['sign']),
    crypto.subtle.importKey('jwk', publicKeyJwk, { name: 'ECDSA', hash: 'SHA-256' }, true, ['verify']),
  ]);
  return { privateKey, publicKey };
}

// ── Routes ──────────────────────────────────────────────────────

/**
 * POST /api/oauth/login
 * Body: { handle: "user.bsky.social" }
 * Response: 302 redirect to PDS authorization endpoint
 */
async function handleLogin(context) {
  try {
    const body = await context.request.json();
    const handle = body?.handle;

    if (!handle) {
      return json({ error: 'Handle required' }, 400);
    }

    // Resolve handle → DID + PDS
    const { did, pds } = await resolveHandle(handle);

    // Discover auth server
    const authServer = await discoverAuthServer(pds);

    // Generate PKCE
    const { verifier, challenge } = await generatePkce();

    // Generate DPoP key pair
    const keyPair = await generateKeyPair();

    // Compute thumbprint
    const thumbprint = await jwkThumbprint(keyPair.publicKey);

    // Export keys for storage
    const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
    const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);

    // Generate state
    const state = crypto.randomUUID();

    // Store state data in KV
    const stateData = {
      codeVerifier: verifier,
      privateKeyJwk,
      publicKeyJwk,
      authServer,
      redirectUri: `${context.request.headers.get('origin') || 'https://lastnpcalex.agency'}/api/oauth/callback`,
      handle,
      did,
      pds,
      createdAt: Date.now(),
    };

    await context.env.SESSIONS.put(`state:${state}`, JSON.stringify(stateData), {
      expirationTtl: 900, // 15 minutes
    });

    // Build authorization URL
    const url = new URL('/oauth/authorize', authServer);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', CLIENT_ID);
    url.searchParams.set('redirect_uri', stateData.redirectUri);
    url.searchParams.set('scope', SCOPE);
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('dpop_jkt', thumbprint);

    // Redirect to authorization
    return new Response(null, {
      status: 302,
      headers: { Location: url.toString() },
    });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

/**
 * GET /api/oauth/callback
 * Query: code, state, error, error_description
 * Exchanges code for tokens, stores in KV, sets session cookie.
 */
async function handleCallback(context) {
  const url = new URL(context.request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  if (error) {
    const redirect = `${new URL(context.request.url).origin}/test-bsky.html?auth_error=${encodeURIComponent(errorDescription || error)}`;
    return new Response(null, { status: 302, headers: { Location: redirect } });
  }

  if (!code || !state) {
    return json({ error: 'Missing code or state' }, 400);
  }

  try {
    // Retrieve state data from KV
    const stateRaw = await context.env.SESSIONS.get(`state:${state}`);
    if (!stateRaw) {
      return json({ error: 'Invalid state' }, 400);
    }

    const stateData = JSON.parse(stateRaw);

    // Check state expiry
    if (Date.now() - stateData.createdAt > STATE_TTL) {
      await context.env.SESSIONS.delete(`state:${state}`);
      return json({ error: 'State expired' }, 400);
    }

    // Import key pair
    const { privateKey, publicKey } = await importKeyPair(stateData.privateKeyJwk, stateData.publicKeyJwk);

    // Create DPoP proof for token endpoint
    const tokenUrl = `${stateData.authServer}/oauth/token`;
    const dpopProof = await createDpopProof(privateKey, publicKey, 'POST', tokenUrl, null);

    // Exchange code for tokens
    const tokenBody = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: stateData.redirectUri,
      client_id: CLIENT_ID,
      code_verifier: stateData.codeVerifier,
      dpop_jkt: await jwkThumbprint(publicKey),
    });

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `DPoP ${dpopProof}`,
      },
      body: tokenBody.toString(),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      return json({ error: `Token exchange failed: ${err}` }, 500);
    }

    const tokenData = await tokenRes.json();

    // Clean up state
    await context.env.SESSIONS.delete(`state:${state}`);

    // Store session in KV
    const sessionId = crypto.randomUUID();
    const sessionData = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      did: stateData.did,
      handle: stateData.handle,
      pds: stateData.pds,
      authServer: stateData.authServer,
      privateKeyJwk: stateData.privateKeyJwk,
      publicKeyJwk: stateData.publicKeyJwk,
      createdAt: Date.now(),
    };

    await context.env.SESSIONS.put(`session:${sessionId}`, JSON.stringify(sessionData), {
      expirationTtl: SESSION_MAX_AGE,
    });

    // Set HttpOnly cookie
    const cookie = `session=${sessionId}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_MAX_AGE}`;

    // Redirect to test page
    const redirect = `${new URL(context.request.url).origin}/test-bsky.html?logged_in=1`;
    return new Response(null, {
      status: 302,
      headers: {
        Location: redirect,
        'Set-Cookie': cookie,
      },
    });
  } catch (e) {
    console.error('Callback error:', e);
    return json({ error: e.message }, 500);
  }
}

/**
 * POST /api/oauth/logout
 * Clears session cookie and KV entry.
 */
async function handleLogout(context) {
  const cookie = context.request.headers.get('Cookie') || '';
  const match = cookie.match(/session=([^;]+)/);

  if (match) {
    await context.env.SESSIONS.delete(`session:${match[1]}`);
  }

  const clear = 'session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0';

  return json({ logged_out: true }, 200, { 'Set-Cookie': clear });
}

/**
 * GET /api/oauth/session
 * Returns session info if logged in, 401 otherwise.
 */
async function handleSession(context) {
  const cookie = context.request.headers.get('Cookie') || '';
  const match = cookie.match(/session=([^;]+)/);

  if (!match) {
    return json({ error: 'Not authenticated' }, 401);
  }

  const sessionRaw = await context.env.SESSIONS.get(`session:${match[1]}`);
  if (!sessionRaw) {
    return json({ error: 'Session not found' }, 401);
  }

  const session = JSON.parse(sessionRaw);

  return json({
    did: session.did,
    handle: session.handle,
    pds: session.pds,
    loggedInAt: session.createdAt,
  });
}

// ── Router ──────────────────────────────────────────────────────

export async function onRequest(context) {
  const path = context.params.path || '';
  const method = context.request.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  let response;

  if (path === 'login' && method === 'POST') {
    response = await handleLogin(context);
  } else if (path === 'callback' && method === 'GET') {
    response = await handleCallback(context);
  } else if (path === 'logout' && method === 'POST') {
    response = await handleLogout(context);
  } else if (path === 'session' && method === 'GET') {
    response = await handleSession(context);
  } else {
    response = json({ error: 'Not found' }, 404);
  }

  // Add CORS headers to all responses
  response.headers = new Headers(response.headers);
  Object.entries(corsHeaders()).forEach(([k, v]) => {
    if (!response.headers.has(k)) response.headers.set(k, v);
  });

  return response;
}

// ── Utilities ───────────────────────────────────────────────────

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

function corsHeaders() {
  const origin = 'https://lastnpcalex.agency';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Cookie',
    'Access-Control-Allow-Credentials': 'true',
  };
}
