import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../_worker.js';

class MemoryKv {
  constructor(seed = {}) { this.values = new Map(Object.entries(seed)); }
  async get(key) { return this.values.get(key) ?? null; }
  async put(key, value) { this.values.set(key, String(value)); }
  async delete(key) { this.values.delete(key); }
  async list({ prefix = '' } = {}) {
    return {
      keys: [...this.values.keys()].filter(key => key.startsWith(prefix)).map(name => ({ name })),
      list_complete: true,
    };
  }
}

function makeEnv(seed = {}) {
  return {
    SESSIONS: new MemoryKv(seed),
    ASSETS: {
      async fetch() { return new Response('not found', { status: 404 }); },
    },
  };
}

async function oauthState(overrides = {}) {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  );
  const [privateKeyJwk, publicKeyJwk] = await Promise.all([
    crypto.subtle.exportKey('jwk', keyPair.privateKey),
    crypto.subtle.exportKey('jwk', keyPair.publicKey),
  ]);
  return {
    codeVerifier: 'test-verifier',
    privateKeyJwk,
    publicKeyJwk,
    authServer: 'https://auth.example',
    redirectUri: 'https://lastnpcalex.agency/api/oauth/callback',
    handle: 'lastnpcalex.agency',
    did: 'did:plc:owner',
    pds: 'https://pds.example',
    createdAt: Date.now(),
    returnTo: 'https://lastnpcalex.agency/admin.html',
    ...overrides,
  };
}

test('successful OAuth callback keeps the session ID out of the redirect URL', async () => {
  const state = await oauthState();
  const env = makeEnv({ 'state:test-state': JSON.stringify(state) });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    assert.equal(String(url), 'https://auth.example/oauth/token');
    return new Response(JSON.stringify({ access_token: 'access-secret', refresh_token: 'refresh-secret' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const response = await worker.fetch(
      new Request('https://lastnpcalex.agency/api/oauth/callback?code=single-use-code&state=test-state'),
      env,
    );
    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), 'https://lastnpcalex.agency/admin.html');
    assert.doesNotMatch(response.headers.get('location'), /(?:sid|logged_in|access-secret|single-use-code)/);
    assert.match(response.headers.get('set-cookie'), /^session=[^;]+; HttpOnly; Secure; SameSite=Strict;/);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(await env.SESSIONS.get('state:test-state'), null);
    assert.equal((await env.SESSIONS.list({ prefix: 'session:' })).keys.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('OAuth state is consumed when authorization is denied', async () => {
  const env = makeEnv({ 'state:denied-state': JSON.stringify(await oauthState()) });
  const response = await worker.fetch(
    new Request('https://lastnpcalex.agency/api/oauth/callback?error=access_denied&error_description=private-details&state=denied-state'),
    env,
  );
  assert.equal(response.status, 302);
  assert.match(response.headers.get('location'), /auth_error=access_denied/);
  assert.doesNotMatch(response.headers.get('location'), /(?:sid=|private-details)/);
  assert.equal(await env.SESSIONS.get('state:denied-state'), null);
});

test('logout invalidates server state and expires the browser cookie', async () => {
  const env = makeEnv({ 'session:active-session': JSON.stringify({ did: 'did:plc:owner' }) });
  const response = await worker.fetch(new Request('https://lastnpcalex.agency/api/oauth/logout', {
    method: 'POST',
    headers: { Cookie: 'session=active-session' },
  }), env);
  assert.equal(response.status, 200);
  assert.equal(await env.SESSIONS.get('session:active-session'), null);
  assert.equal(
    response.headers.get('set-cookie'),
    'session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0',
  );

  const getResponse = await worker.fetch(
    new Request('https://lastnpcalex.agency/api/oauth/logout', { headers: { Cookie: 'session=active-session' } }),
    env,
  );
  assert.equal(getResponse.status, 405);
});

test('the URL-based session-cookie bridge is no longer an API route', async () => {
  const env = makeEnv({ 'session:leaked-session': JSON.stringify({ did: 'did:plc:owner' }) });
  const response = await worker.fetch(
    new Request('https://lastnpcalex.agency/api/oauth/setCookie?sid=leaked-session'),
    env,
  );
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('set-cookie'), null);
});

test('login refuses cross-origin return targets instead of bridging a session', async () => {
  const env = makeEnv();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async input => {
    const url = new URL(String(input));
    if (url.hostname === 'public.api.bsky.app') {
      return Response.json({ did: 'did:plc:owner' });
    }
    if (url.hostname === 'plc.directory') {
      return Response.json({ service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://pds.example' }] });
    }
    if (url.hostname === 'pds.example') {
      return Response.json({ issuer: 'https://auth.example' });
    }
    if (url.href === 'https://auth.example/oauth/par') {
      return Response.json({ request_uri: 'urn:ietf:params:oauth:request_uri:test' });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    const response = await worker.fetch(new Request('https://black-hole.ex-astris-umbra.workers.dev/api/oauth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        handle: 'lastnpcalex.agency',
        returnTo: 'https://lastnpcalex.agency/admin.html',
      }),
    }), env);
    assert.equal(response.status, 200);
    const states = await env.SESSIONS.list({ prefix: 'state:' });
    assert.equal(states.keys.length, 1);
    const savedState = JSON.parse(await env.SESSIONS.get(states.keys[0].name));
    assert.equal(savedState.redirectUri, 'https://black-hole.ex-astris-umbra.workers.dev/api/oauth/callback');
    assert.equal(savedState.returnTo, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
