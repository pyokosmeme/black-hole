/**
 * GET /api/oauth/callback
 * Exchanges code for tokens, stores in KV, sets session cookie.
 */

const CLIENT_ID = 'https://lastnpcalex.agency/client-metadata.json';
const SESSION_MAX_AGE = 30 * 24 * 60 * 60;
const STATE_TTL = 15 * 60 * 1000;

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  if (error) {
    const origin = new URL(context.request.url).origin;
    return new Response(null, {
      status: 302,
      headers: { Location: `${origin}/?auth_error=${encodeURIComponent(errorDescription || error)}` },
    });
  }

  if (!code || !state) {
    return jsonResponse({ error: 'Missing code or state' }, 400);
  }

  try {
    const stateRaw = await context.env.SESSIONS.get(`state:${state}`);
    if (!stateRaw) return jsonResponse({ error: 'Invalid state' }, 400);

    const stateData = JSON.parse(stateRaw);
    if (Date.now() - stateData.createdAt > STATE_TTL) {
      await context.env.SESSIONS.delete(`state:${state}`);
      return jsonResponse({ error: 'State expired' }, 400);
    }

    const { privateKey, publicKey } = await importKeyPair(stateData.privateKeyJwk, stateData.publicKeyJwk);

    const tokenUrl = `${stateData.authServer}/oauth/token`;
    const dpopProof = await createDpopProof(privateKey, publicKey, 'POST', tokenUrl, null);

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
      return jsonResponse({ error: `Token exchange failed: ${err}` }, 500);
    }

    const tokenData = await tokenRes.json();

    // Clean up state
    await context.env.SESSIONS.delete(`state:${state}`);

    // Store session
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

    const returnTo = stateData.returnTo || 'https://lastnpcalex.agency/';
    const cookie = `session=${sessionId}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_MAX_AGE}`;

    return new Response(null, {
      status: 302,
      headers: {
        Location: returnTo,
        'Set-Cookie': cookie,
      },
    });
  } catch (e) {
    console.error('Callback error:', e);
    return jsonResponse({ error: e.message }, 500);
  }
}

// ── Helpers ──

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function importKeyPair(privateKeyJwk, publicKeyJwk) {
  return {
    privateKey: await crypto.subtle.importKey('jwk', privateKeyJwk, { name: 'ECDSA', hash: 'SHA-256' }, true, ['sign']),
    publicKey: await crypto.subtle.importKey('jwk', publicKeyJwk, { name: 'ECDSA', hash: 'SHA-256' }, true, ['verify']),
  };
}

async function jwkThumbprint(publicKey) {
  const jwk = await crypto.subtle.exportKey('jwk', publicKey);
  delete jwk.d;
  const canon = JSON.stringify(jwk, Object.keys(jwk).sort());
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canon));
  return base64url(new Uint8Array(hash));
}

async function createDpopProof(privateKey, publicKey, method, url, accessToken) {
  const jwk = await crypto.subtle.exportKey('jwk', publicKey);

  const header = { alg: 'ES256', typ: 'dpop+jwt', jwk };
  const payload = {
    jti: crypto.randomUUID(),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60,
    aud: new URL(url).origin,
    httptype: method,
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

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': 'https://lastnpcalex.agency',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Cookie',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}
