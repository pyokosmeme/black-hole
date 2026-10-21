import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../_worker.js';
import { oauthUrl, oauthFetch, oauthText } from '../oauth-security.js';

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
    tokenEndpoint: 'https://auth.example/oauth/token',
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
    return new Response(JSON.stringify({ access_token: 'access-secret', refresh_token: 'refresh-secret', sub: state.did, scope: 'atproto transition:generic', token_type: 'DPoP' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  try {
    const response = await worker.fetch(
      new Request('https://lastnpcalex.agency/api/oauth/callback?code=single-use-code&state=test-state&iss=https://auth.example'),
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

test('putRecord writes the player opt-in lexicon and nothing else', async () => {
  const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
  const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const env = makeEnv({
    'session:player-session': JSON.stringify({
      authVersion: 2,
      did: 'did:plc:player', handle: 'player.bsky.social', pds: 'https://pds.example',
      authServer: 'https://auth.example', privateKeyJwk, publicKeyJwk, createdAt: Date.now(),
    }),
  });
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u === 'https://pds.example/xrpc/com.atproto.repo.putRecord') {
      captured = { body: JSON.parse(init.body) };
      return Response.json({ uri: 'at://did:plc:player/agency.lastnpcalex.player/self', cid: 'bafy-test' });
    }
    throw new Error(`Unexpected fetch: ${u}`);
  };
  try {
    const good = await worker.fetch(new Request('https://join.lastnpcalex.agency/api/bsky/putRecord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'session=player-session' },
      body: JSON.stringify({
        collection: 'agency.lastnpcalex.player',
        rkey: 'self',
        record: { $type: 'agency.lastnpcalex.player', playerCharacter: 1, createdAt: '2026-09-09T22:00:00.000Z' },
      }),
    }), env);
    assert.equal(good.status, 200);
    const goodData = await good.json();
    assert.equal(goodData.uri, 'at://did:plc:player/agency.lastnpcalex.player/self');
    assert.equal(captured.body.repo, 'did:plc:player');
    assert.equal(captured.body.collection, 'agency.lastnpcalex.player');
    assert.equal(captured.body.rkey, 'self');
    assert.equal(captured.body.record.playerCharacter, 1);

    // Off-lexicon collection is refused
    const badCollection = await worker.fetch(new Request('https://join.lastnpcalex.agency/api/bsky/putRecord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'session=player-session' },
      body: JSON.stringify({
        collection: 'agency.lastnpcalex.comment',
        rkey: 'self',
        record: { message: 'nope' },
      }),
    }), env);
    assert.equal(badCollection.status, 400);

    // Off-domain value is refused
    const badValue = await worker.fetch(new Request('https://join.lastnpcalex.agency/api/bsky/putRecord', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'session=player-session' },
      body: JSON.stringify({
        collection: 'agency.lastnpcalex.player',
        rkey: 'self',
        record: { $type: 'agency.lastnpcalex.player', playerCharacter: 2, createdAt: '2026-09-09T22:00:00.000Z' },
      }),
    }), env);
    assert.equal(badValue.status, 400);
  } finally {
    globalThis.fetch = originalFetch;
  }
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
      return Response.json({ id: 'did:plc:owner', alsoKnownAs: ['at://lastnpcalex.agency'], service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://pds.example' }] });
    }
    if (url.hostname === 'pds.example') {
      return Response.json({ resource: 'https://pds.example', authorization_servers: ['https://auth.example'] });
    }
    if (url.href === 'https://auth.example/.well-known/oauth-authorization-server') {
      return Response.json({ issuer: 'https://auth.example', scopes_supported: ['atproto'], authorization_endpoint: 'https://auth.example/authorize', token_endpoint: 'https://auth.example/oauth/token', pushed_authorization_request_endpoint: 'https://auth.example/oauth/par' });
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

const tokenReply = (overrides = {}) => ({
  access_token: 'access-secret', refresh_token: 'refresh-secret', token_type: 'DPoP',
  sub: 'did:plc:owner', scope: 'atproto transition:generic', ...overrides,
});

for (const [name, reply] of [
  ['another account', { sub: 'did:plc:attacker' }],
  ['missing account', { sub: undefined }],
  ['missing scopes', { scope: undefined }],
  ['missing atproto', { scope: 'transition:generic' }],
  ['unsolicited identity grant', { scope: 'atproto transition:generic identity:*' }],
  ['bearer token', { token_type: 'Bearer' }],
  ['missing access token', { access_token: undefined }],
]) {
  test(`OAuth callback rejects ${name} without creating any session`, async () => {
    const env = makeEnv({ 'state:test': JSON.stringify(await oauthState()) });
    const original = globalThis.fetch;
    globalThis.fetch = async () => Response.json(tokenReply(reply));
    try {
      const response = await worker.fetch(new Request('https://lastnpcalex.agency/api/oauth/callback?state=test&code=code&iss=https://auth.example'), env);
      assert.equal(response.status, 500);
      assert.equal(response.headers.get('set-cookie'), null);
      assert.equal((await env.SESSIONS.list({ prefix: 'session:' })).keys.length, 0);
      assert.equal(await env.SESSIONS.get('state:test'), null);
    } finally { globalThis.fetch = original; }
  });
}

for (const issuer of ['', '&iss=https://attacker.example']) {
  test(`OAuth callback rejects ${issuer ? 'wrong' : 'missing'} issuer before exchanging credentials`, async () => {
    const env = makeEnv({ 'state:test': JSON.stringify(await oauthState()) });
    const original = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error('Must not contact token endpoint'); };
    try {
      const response = await worker.fetch(new Request(`https://lastnpcalex.agency/api/oauth/callback?state=test&code=code${issuer}`), env);
      assert.equal(response.status, 400);
      assert.equal((await env.SESSIONS.list({ prefix: 'session:' })).keys.length, 0);
    } finally { globalThis.fetch = original; }
  });
}

test('partial authorization stores granted permissions and cannot enable identity repair', async () => {
  const env = makeEnv({ 'state:test': JSON.stringify(await oauthState({ scope: 'atproto transition:generic identity:*', identityUpgrade: true })) });
  const original = globalThis.fetch;
  globalThis.fetch = async () => Response.json(tokenReply());
  try {
    const response = await worker.fetch(new Request('https://lastnpcalex.agency/api/oauth/callback?state=test&code=code&iss=https://auth.example'), env);
    assert.equal(response.status, 302);
    const keys = await env.SESSIONS.list({ prefix: 'session:' });
    const session = JSON.parse(await env.SESSIONS.get(keys.keys[0].name));
    assert.equal(session.scope, 'atproto transition:generic');
    assert.equal(session.identityUpgrade, false);
    assert.equal(session.authVersion, 2);
  } finally { globalThis.fetch = original; }
});

test('old sessions are rejected by both the OAuth API and content administration', async () => {
  const env = makeEnv({ 'session:old': JSON.stringify({ did: 'did:plc:owner' }) });
  env.ADMIN_DIDS = 'did:plc:owner';
  for (const path of ['/api/oauth/session', '/api/admin/transmissions']) {
    const response = await worker.fetch(new Request(`https://lastnpcalex.agency${path}`, { headers: { Cookie: 'session=old' } }), env);
    assert.equal(response.status, 401, path);
  }
});

test('delete proxy permits only the signed-in account and site collections', async () => {
  const state = await oauthState();
  const env = makeEnv({ 'session:test': JSON.stringify({ ...state, authVersion: 2, accessToken: 'access' }) });
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json({});
  };
  const send = uri => worker.fetch(new Request('https://lastnpcalex.agency/api/bsky/deleteRecord', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'session=test' }, body: JSON.stringify({ uri }),
  }), env);
  try {
    for (const uri of ['at://did:plc:owner/app.bsky.feed.post/abc', 'at://did:plc:other/agency.lastnpcalex.comment/abc', 'at://did:plc:owner/agency.lastnpcalex.comment/..', 'nonsense', null]) {
      assert.ok((await send(uri)).status >= 400);
    }
    assert.equal(calls.length, 0);
    assert.equal((await send('at://did:plc:owner/agency.lastnpcalex.comment/abc')).status, 200);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].init.redirect, 'error');
    assert.deepEqual(JSON.parse(calls[0].init.body), { repo: state.did, collection: 'agency.lastnpcalex.comment', rkey: 'abc' });
  } finally { globalThis.fetch = original; }
});

test('OAuth endpoints reject unsafe URLs before any network request', async () => {
  const original = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => { called = true; return Response.json({}); };
  try {
    for (const url of ['http://auth.example/token', 'https://127.0.0.1/token', 'https://2130706433/token', 'https://[::1]/', 'https://localhost/', 'https://metadata.google.internal/', 'https://user:pass@auth.example/', 'https://auth.example:8443/', 'https://auth.example/#secret']) {
      await assert.rejects(oauthFetch(url));
    }
    assert.equal(called, false);
    assert.equal(oauthUrl('https://auth.example', { originOnly: true }), 'https://auth.example');
  } finally { globalThis.fetch = original; }
});

test('OAuth fetch refuses redirects and bounds untrusted discovery response sizes', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    assert.equal(init.redirect, 'error');
    return new Response('', { status: 302, headers: { Location: 'http://localhost/' } });
  };
  try {
    await assert.rejects(oauthFetch('https://auth.example/token'), /redirect/);
    await assert.rejects(oauthText(new Response('x'.repeat(128_001))), /too large/);
  } finally { globalThis.fetch = original; }
});

function discoveryReply(url, overrides = {}) {
  if (url.hostname === 'public.api.bsky.app') return Response.json({ did: 'did:plc:owner' });
  if (url.hostname === 'plc.directory') return Response.json({ id: 'did:plc:owner', alsoKnownAs: ['at://lastnpcalex.agency'], service: [{ type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://pds.example' }], ...overrides.did });
  if (url.hostname === 'pds.example') return Response.json({ resource: 'https://pds.example', authorization_servers: ['https://auth.example'], ...overrides.resource });
  if (url.pathname === '/.well-known/oauth-authorization-server') return Response.json({ issuer: 'https://auth.example', scopes_supported: ['atproto'], authorization_endpoint: 'https://auth.example/authorize', token_endpoint: 'https://auth.example/token', pushed_authorization_request_endpoint: 'https://auth.example/par', ...overrides.metadata });
  throw new Error(`Unexpected discovery URL: ${url}`);
}

for (const [name, overrides] of [
  ['DID mismatch', { did: { id: 'did:plc:attacker' } }],
  ['unconfirmed handle', { did: { alsoKnownAs: [] } }],
  ['unsafe PDS', { did: { service: [{ type: 'AtprotoPersonalDataServer', serviceEndpoint: 'http://pds.example' }] } }],
  ['resource mismatch', { resource: { resource: 'https://different.example' } }],
  ['issuer mismatch', { metadata: { issuer: 'https://different.example' } }],
  ['unsafe token endpoint', { metadata: { token_endpoint: 'http://auth.example/token' } }],
  ['missing issuer', { resource: { authorization_servers: [] } }],
]) {
  test(`login fails closed for ${name}`, async () => {
    const env = makeEnv();
    const original = globalThis.fetch;
    globalThis.fetch = async input => discoveryReply(new URL(String(input)), overrides);
    try {
      const response = await worker.fetch(new Request('https://lastnpcalex.agency/api/oauth/login', { method: 'POST', body: JSON.stringify({ handle: 'lastnpcalex.agency' }) }), env);
      assert.equal(response.status, 500);
      assert.equal((await env.SESSIONS.list({ prefix: 'state:' })).keys.length, 0);
    } finally { globalThis.fetch = original; }
  });
}

test('PAR uses the discovered endpoint, login hint and a fresh DPoP proof for nonce retry', async () => {
  const env = makeEnv();
  const original = globalThis.fetch;
  const proofs = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname !== '/par') return discoveryReply(url);
    assert.equal(url.href, 'https://auth.example/par');
    assert.equal(init.redirect, 'error');
    assert.equal(new URLSearchParams(init.body).get('login_hint'), 'lastnpcalex.agency');
    const proof = JSON.parse(Buffer.from(init.headers.DPoP.split('.')[1], 'base64url'));
    proofs.push(proof);
    if (proofs.length === 1) return Response.json({ error: 'use_dpop_nonce' }, { status: 400, headers: { 'DPoP-Nonce': 'server-nonce' } });
    return Response.json({ request_uri: 'urn:ietf:params:oauth:request_uri:success' });
  };
  try {
    const response = await worker.fetch(new Request('https://lastnpcalex.agency/api/oauth/login', { method: 'POST', body: JSON.stringify({ handle: 'lastnpcalex.agency' }) }), env);
    assert.equal(response.status, 200);
    const redirect = new URL((await response.json()).redirect_url);
    assert.equal(redirect.pathname, '/authorize');
    assert.equal(redirect.searchParams.has('iss'), false);
    assert.equal(proofs.length, 2);
    assert.equal(proofs[1].nonce, 'server-nonce');
    assert.notEqual(proofs[0].jti, proofs[1].jti);
    const state = JSON.parse(await env.SESSIONS.get((await env.SESSIONS.list({ prefix: 'state:' })).keys[0].name));
    assert.equal(state.tokenEndpoint, 'https://auth.example/token');
  } finally { globalThis.fetch = original; }
});

for (const valid of [true, false]) {
  test(`token refresh ${valid ? 'rotates a valid grant' : 'rejects an identity change without saving it'}`, async () => {
    const env = makeEnv({ 'session:test': JSON.stringify({ ...(await oauthState()), authVersion: 2, scope: 'atproto transition:generic', accessToken: 'old-access', refreshToken: 'old-refresh' }) });
    const original = globalThis.fetch;
    let pdsCalls = 0;
    globalThis.fetch = async (input, init) => {
      assert.equal(init.redirect, 'error');
      if (String(input) === 'https://auth.example/oauth/token') return Response.json(tokenReply({ access_token: 'new-access', refresh_token: 'new-refresh', sub: valid ? 'did:plc:owner' : 'did:plc:attacker' }));
      pdsCalls++;
      if (pdsCalls === 1) return Response.json({ error: 'invalid_token' }, { status: 401 });
      assert.equal(init.headers.Authorization, 'DPoP new-access');
      return Response.json({ uri: 'at://did:plc:owner/agency.lastnpcalex.comment/abc' });
    };
    try {
      const response = await worker.fetch(new Request('https://lastnpcalex.agency/api/bsky/deleteRecord', { method: 'POST', headers: { Cookie: 'session=test' }, body: JSON.stringify({ uri: 'at://did:plc:owner/agency.lastnpcalex.comment/abc' }) }), env);
      assert.equal(response.status, valid ? 200 : 401);
      assert.equal(pdsCalls, valid ? 2 : 1);
      const session = JSON.parse(await env.SESSIONS.get('session:test'));
      assert.equal(session.accessToken, valid ? 'new-access' : 'old-access');
      assert.equal(session.did, 'did:plc:owner');
    } finally { globalThis.fetch = original; }
  });
}
