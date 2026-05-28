/**
 * POST /api/bsky/createRecord
 * Body: { collection, record, rkey? }
 * Proxies to PDS with DPoP signing.
 */

export async function onRequest(context) {
  const session = await getSession(context);
  if (!session) return jsonResponse({ error: 'Not authenticated' }, 401);

  const { privateKey, publicKey } = await importKeyPair(session.privateKeyJwk, session.publicKeyJwk);
  const body = await context.request.json();

  const url = `${session.pds}/xrpc/com.atproto.repo.createRecord`;
  const dpopProof = await createDpopProof(privateKey, publicKey, 'POST', url, session.accessToken);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `DPoP ${session.accessToken}`,
      'DPoP': dpopProof,
    },
    body: JSON.stringify({
      repo: session.did,
      collection: body.collection,
      rkey: body.rkey,
      record: body.record,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return jsonResponse({ error: err }, res.status);
  }

  return jsonResponse(await res.json());
}

// ── Helpers ──

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function getSession(context) {
  const cookie = context.request.headers.get('Cookie') || '';
  const match = cookie.match(/session=([^;]+)/);
  if (!match) return null;
  const raw = await context.env.SESSIONS.get(`session:${match[1]}`);
  if (!raw) return null;
  return JSON.parse(raw);
}

async function importKeyPair(privateKeyJwk, publicKeyJwk) {
  return {
    privateKey: await crypto.subtle.importKey('jwk', privateKeyJwk, { name: 'ECDSA', hash: 'SHA-256' }, true, ['sign']),
    publicKey: await crypto.subtle.importKey('jwk', publicKeyJwk, { name: 'ECDSA', hash: 'SHA-256' }, true, ['verify']),
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Cookie',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}
