/**
 * ATproto DPoP proxy — signs requests with the user's ECDSA key pair.
 *
 * Routes:
 *   POST /api/bsky/createRecord  — write a record to user's PDS
 *   POST /api/bsky/deleteRecord  — delete a record from user's PDS
 *
 * Auth: Reads session cookie, retrieves tokens from KV, signs DPoP proof.
 */

/**
 * Import a key pair from JWK.
 */
async function importKeyPair(privateKeyJwk, publicKeyJwk) {
  return {
    privateKey: await crypto.subtle.importKey('jwk', privateKeyJwk, { name: 'ECDSA', hash: 'SHA-256' }, true, ['sign']),
    publicKey: await crypto.subtle.importKey('jwk', publicKeyJwk, { name: 'ECDSA', hash: 'SHA-256' }, true, ['verify']),
  };
}

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
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
    exp: Math.floor(Date.now() / 1000) + 60,
    aud: new URL(url).origin,
    httptype: method,
    url,
  };

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
 * Get session from cookie.
 */
async function getSession(context) {
  const cookie = context.request.headers.get('Cookie') || '';
  const match = cookie.match(/session=([^;]+)/);
  if (!match) return null;

  const raw = await context.env.SESSIONS.get(`session:${match[1]}`);
  if (!raw) return null;

  return JSON.parse(raw);
}

// ── Routes ──────────────────────────────────────────────────────

/**
 * POST /api/bsky/createRecord
 * Body: { collection, record, rkey? }
 * Proxies to PDS with DPoP signing.
 */
async function handleCreateRecord(context) {
  const session = await getSession(context);
  if (!session) return json({ error: 'Not authenticated' }, 401);

  const { privateKey, publicKey } = await importKeyPair(session.privateKeyJwk, session.publicKeyJwk);
  const body = await context.request.json();

  const pds = session.pds;
  const url = `${pds}/xrpc/com.atproto.repo.createRecord`;
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
    return json({ error: err }, res.status);
  }

  return json(await res.json());
}

/**
 * POST /api/bsky/deleteRecord
 * Body: { uri: "at://did:plc:xyz/collection/rkey" }
 * Parses URI and proxies to PDS.
 */
async function handleDeleteRecord(context) {
  const session = await getSession(context);
  if (!session) return json({ error: 'Not authenticated' }, 401);

  const { privateKey, publicKey } = await importKeyPair(session.privateKeyJwk, session.publicKeyJwk);
  const body = await context.request.json();

  // Parse URI: at://repo/collection/rkey
  const [, repo, collection, rkey] = body.uri.replace('at://', '').split('/');

  const pds = session.pds;
  const url = `${pds}/xrpc/com.atproto.repo.deleteRecord`;
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
    return json({ error: err }, res.status);
  }

  return json({ deleted: true });
}

// ── Router ──────────────────────────────────────────────────────

export async function onRequest(context) {
  const path = context.params.path || '';
  const method = context.request.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  let response;

  if (path === 'createRecord' && method === 'POST') {
    response = await handleCreateRecord(context);
  } else if (path === 'deleteRecord' && method === 'POST') {
    response = await handleDeleteRecord(context);
  } else {
    response = json({ error: 'Not found' }, 404);
  }

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
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': 'https://lastnpcalex.agency',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Cookie',
    'Access-Control-Allow-Credentials': 'true',
  };
}
