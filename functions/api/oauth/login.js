/**
 * POST /api/oauth/login
 * Body: { handle: "user.bsky.social" }
 * Response: 302 redirect to PDS authorization endpoint
 */

export async function onRequestPost(context) {
  const body = await context.request.json();
  const handle = body?.handle;

  if (!handle) {
    return jsonResponse({ error: 'Handle required' }, 400);
  }

  try {
    const { did, pds } = await resolveHandle(handle);
    const authServer = await discoverAuthServer(pds);
    const { verifier, challenge } = await generatePkce();
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify']
    );

    const [privateKeyJwk, publicKeyJwk] = await Promise.all([
      crypto.subtle.exportKey('jwk', keyPair.privateKey),
      crypto.subtle.exportKey('jwk', keyPair.publicKey),
    ]);

    const thumbprint = await jwkThumbprint(keyPair.publicKey);
    const state = crypto.randomUUID();

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
      expirationTtl: 900,
    });

    const url = new URL('/oauth/authorize', authServer);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', CLIENT_ID);
    url.searchParams.set('redirect_uri', stateData.redirectUri);
    url.searchParams.set('scope', SCOPE);
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('dpop_jkt', thumbprint);

    return new Response(null, { status: 302, headers: { Location: url.toString() } });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

export { onRequestPost as onRequest };

// ── Helpers ──

const CLIENT_ID = 'https://lastnpcalex.agency/client-metadata.json';
const SCOPE = 'atproto';
const BSKY_PUBLIC = 'https://public.api.bsky.app';

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

async function jwkThumbprint(publicKey) {
  const jwk = await crypto.subtle.exportKey('jwk', publicKey);
  delete jwk.d;
  const canon = JSON.stringify(jwk, Object.keys(jwk).sort());
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canon));
  return base64url(new Uint8Array(hash));
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
