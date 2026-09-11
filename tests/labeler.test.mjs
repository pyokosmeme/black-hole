import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../_worker.js';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { cborEncodeLabel, cborEncodeFrame, getLabelerDidKey, LABELER_DID } from '../labeler.js';

const SITE = 'https://lastnpcalex.agency';

class MemoryKv {
  constructor(seed = {}) { this.values = new Map(Object.entries(seed)); }
  async get(key) { return this.values.get(key) ?? null; }
  async put(key, value) { this.values.set(key, String(value)); }
  async delete(key) { this.values.delete(key); }
  async list({ prefix = '', cursor } = {}) {
    const keys = [...this.values.keys()].filter(key => key.startsWith(prefix)).map(name => ({ name }));
    return { keys, list_complete: true };
  }
}

function makeEnv(seed = {}) {
  return {
    SESSIONS: new MemoryKv(seed),
    ADMIN_DIDS: 'did:plc:owner',
    ASSETS: { async fetch() { return new Response('not found', { status: 404 }); } },
  };
}

async function adminSession() {
  const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const [privateKeyJwk, publicKeyJwk] = await Promise.all([
    crypto.subtle.exportKey('jwk', keyPair.privateKey),
    crypto.subtle.exportKey('jwk', keyPair.publicKey),
  ]);
  return {
    did: 'did:plc:owner', handle: 'lastnpcalex.agency', pds: 'https://pds.example',
    authServer: 'https://auth.example', privateKeyJwk, publicKeyJwk, createdAt: Date.now(),
  };
}

async function labelerSession() {
  return { ...(await adminSession()), did: LABELER_DID };
}

async function labelerEnv() {
  const env = makeEnv({ 'session:admin-session': JSON.stringify(await labelerSession()) });
  env.ADMIN_DIDS = LABELER_DID;
  return env;
}

test('labeler key is stable and encoded as a secp256k1 did:key', async () => {
  const env = makeEnv();
  const first = await getLabelerDidKey(env);
  const second = await getLabelerDidKey(env);
  assert.equal(first, second);
  assert.match(first, /^did:key:zQ3/);
});

test('queryLabels serves signed labels and verifies with the published key', async () => {
  const env = makeEnv({ 'session:admin-session': JSON.stringify(await adminSession()) });
  const created = await worker.fetch(new Request(SITE + '/api/admin/labels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: SITE, Cookie: 'session=admin-session' },
    body: JSON.stringify({ uri: 'did:plc:victim', val: 'player-character' }),
  }), env);
  assert.equal(created.status, 201);
  const createdData = await created.json();
  assert.equal(createdData.label.seq, 1);

  const query = await worker.fetch(new Request(SITE + '/xrpc/com.atproto.label.queryLabels?uriPatterns=did%3Aplc%3Avictim'), env);
  assert.equal(query.status, 200);
  const { labels } = await query.json();
  assert.equal(labels.length, 1);
  const label = labels[0];
  assert.equal(label.ver, 1);
  assert.equal(label.src, LABELER_DID);
  assert.equal(label.uri, 'at://did:plc:victim/app.bsky.actor.profile/self');
  assert.equal(label.val, 'player-character');

  // The same public key is placed in the account PLC DID document by the
  // identity-repair flow; test against its did:key encoding here.
  const pub = decodeBase58((await getLabelerDidKey(env)).slice('did:key:z'.length)).slice(2);
  const sig = Buffer.from(label.sig.$bytes, 'base64');
  assert.equal(sig.length, 64);
  const { sig: _omit, ...labelBody } = label;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', cborEncodeLabel(labelBody)));
  assert.equal(secp256k1.verify(sig, digest, pub), true);

  // other subjects see nothing
  const empty = await worker.fetch(new Request(SITE + '/xrpc/com.atproto.label.queryLabels?uriPatterns=did%3Aplc%3Aother'), env);
  assert.equal((await empty.json()).labels.length, 0);
});

test('queryLabels matches AppView-style at:// uriPatterns against bare-DID subjects', async () => {
  const env = makeEnv({ 'session:admin-session': JSON.stringify(await adminSession()) });
  const res = await worker.fetch(new Request(SITE + '/api/admin/labels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: SITE, Cookie: 'session=admin-session' },
    body: JSON.stringify({ uri: 'did:plc:victim', val: 'non-player-character' }),
  }), env);
  assert.equal(res.status, 201);
  // This is how the Bluesky AppView polls an account label — must not be empty.
  const pattern = encodeURIComponent('at://did:plc:victim/app.bsky.actor.profile/self');
  const query = await (await worker.fetch(new Request(SITE + '/xrpc/com.atproto.label.queryLabels?sources=' + encodeURIComponent(LABELER_DID) + '&uriPatterns=' + pattern), env)).json();
  assert.equal(query.labels.length, 1);
  assert.equal(query.labels[0].uri, 'at://did:plc:victim/app.bsky.actor.profile/self');
  assert.equal(query.labels[0].val, 'non-player-character');
});

test('queryLabels matches at:// subjects with did patterns and globs', async () => {
  const env = makeEnv({ 'session:admin-session': JSON.stringify(await adminSession()) });
  const post = 'at://did:plc:victim/app.bsky.feed.post/3kx';
  for (const [uri, val] of [[post, 'spam'], ['did:plc:victim', 'profile-flag']]) {
    const res = await worker.fetch(new Request(SITE + '/api/admin/labels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: SITE, Cookie: 'session=admin-session' },
      body: JSON.stringify({ uri, val }),
    }), env);
    assert.equal(res.status, 201);
  }
  const byDid = await (await worker.fetch(new Request(SITE + '/xrpc/com.atproto.label.queryLabels?uriPatterns=did%3Aplc%3Avictim'), env)).json();
  assert.equal(byDid.labels.length, 2);   // did pattern covers the account's AT-URIs too
  const byGlob = await (await worker.fetch(new Request(SITE + '/xrpc/com.atproto.label.queryLabels?uriPatterns=' + encodeURIComponent(post)), env)).json();
  assert.equal(byGlob.labels.length, 1);
  assert.equal(byGlob.labels[0].val, 'spam');
  const unknown = await (await worker.fetch(new Request(SITE + '/xrpc/com.atproto.label.queryLabels?uriPatterns=at%3A%2F%2Fdid%3Aplc%3Aother%2F%2A'), env)).json();
  assert.equal(unknown.labels.length, 0);
});

test('label creation is admin-only and schema-checked', async () => {
  const env = makeEnv({ 'session:admin-session': JSON.stringify(await adminSession()) });

  const anon = await worker.fetch(new Request(SITE + '/api/admin/labels', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uri: 'did:plc:victim', val: 'x' }),
  }), env);
  assert.equal(anon.status, 401);

  const outsider = await adminSession();
  outsider.did = 'did:plc:nobody';
  await env.SESSIONS.put('session:other', JSON.stringify(outsider));
  const forbidden = await worker.fetch(new Request(SITE + '/api/admin/labels', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'session=other' },
    body: JSON.stringify({ uri: 'did:plc:victim', val: 'x' }),
  }), env);
  assert.equal(forbidden.status, 403);

  const badValue = await worker.fetch(new Request(SITE + '/api/admin/labels', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: SITE, Cookie: 'session=admin-session' },
    body: JSON.stringify({ uri: 'did:plc:victim', val: 'NOT-VALID' }),
  }), env);
  assert.equal(badValue.status, 400);

  const badSubject = await worker.fetch(new Request(SITE + '/api/admin/labels', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: SITE, Cookie: 'session=admin-session' },
    body: JSON.stringify({ uri: 'https://example.com/nope', val: 'x' }),
  }), env);
  assert.equal(badSubject.status, 400);
});

test('negations carry neg: true and verify independently', async () => {
  const env = makeEnv({ 'session:admin-session': JSON.stringify(await adminSession()) });
  const res = await worker.fetch(new Request(SITE + '/api/admin/labels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: SITE, Cookie: 'session=admin-session' },
    body: JSON.stringify({ uri: 'did:plc:victim', val: 'player-character', neg: true }),
  }), env);
  assert.equal(res.status, 201);
  const { labels } = await (await worker.fetch(new Request(SITE + '/xrpc/com.atproto.label.queryLabels?uriPatterns=did%3Aplc%3Avictim'), env)).json();
  assert.equal(labels[0].neg, true);
  const { sig: _omit, ...body } = labels[0];
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', cborEncodeLabel(body)));
  const pub = decodeBase58((await getLabelerDidKey(env)).slice('did:key:z'.length)).slice(2);
  assert.equal(secp256k1.verify(Buffer.from(labels[0].sig.$bytes, 'base64'), digest, pub), true);
});

test('labeler-record endpoint is admin-only and writes the service DID', async () => {
  const env = await labelerEnv();
  const forbidden = await worker.fetch(new Request(SITE + '/api/admin/labeler-record', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ labelValues: ['x'] }),
  }), env);
  assert.equal(forbidden.status, 401);

  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).includes('/xrpc/com.atproto.repo.putRecord')) {
      captured = { body: JSON.parse(init.body) };
      return Response.json({ uri: 'at://did:plc:owner/app.bsky.labeler.service/self' });
    }
    throw new Error('Unexpected fetch: ' + url);
  };
  try {
    const res = await worker.fetch(new Request(SITE + '/api/admin/labeler-record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'session=admin-session' },
      body: JSON.stringify({ labelValues: ['player-character', 'spam'] }),
    }), env);
    assert.equal(res.status, 200);
    assert.equal(captured.body.repo, LABELER_DID);
    assert.equal(captured.body.collection, 'app.bsky.labeler.service');
    assert.equal(captured.body.rkey, 'self');
    assert.equal(captured.body.record.did, undefined);
    assert.deepEqual(captured.body.record.policies.labelValues, ['player-character', 'spam']);
    // shipped definitions ride along with admin-supplied values
    const identifiers = captured.body.record.policies.labelValueDefinitions.map(d => d.identifier);
    assert.ok(identifiers.includes('non-player-character'));
    assert.ok(identifiers.includes('player-character'));
    const npc = captured.body.record.policies.labelValueDefinitions.find(d => d.identifier === 'non-player-character');
    assert.equal(npc.severity, 'inform');
    assert.equal(npc.locales[0].name, 'Non-Player Character');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('labeler-record defaults to the two shipped values and does not write a non-standard DID field', async () => {
  const env = await labelerEnv();
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).includes('/xrpc/com.atproto.repo.putRecord')) {
      captured = { body: JSON.parse(init.body) };
      return Response.json({ uri: 'at://did:plc:owner/app.bsky.labeler.service/self' });
    }
    throw new Error('Unexpected fetch: ' + url);
  };
  try {
    const res = await worker.fetch(new Request(SITE + '/api/admin/labeler-record', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: 'session=admin-session' }, body: JSON.stringify({}),
    }), env);
    assert.equal(res.status, 200);
    assert.deepEqual(captured.body.record.policies.labelValues, ['non-player-character', 'player-character']);
    assert.equal(captured.body.record.did, undefined);
    assert.deepEqual(captured.body.record.subjectTypes, ['account', 'record']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('identity repair preserves PDS credentials, adds the labeler entries, then publishes the declaration', async () => {
  const session = await labelerSession();
  session.scope = 'atproto transition:generic identity:*';
  const env = makeEnv({ 'session:admin-session': JSON.stringify(session) });
  env.ADMIN_DIDS = LABELER_DID;
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const target = String(url);
    calls.push({ target, body: init.body ? JSON.parse(init.body) : null });
    if (target.endsWith('/xrpc/com.atproto.identity.requestPlcOperationSignature')) return new Response('', { status: 200 });
    if (target.endsWith('/xrpc/com.atproto.identity.getRecommendedDidCredentials')) {
      return Response.json({ verificationMethods: { atproto: 'did:key:zExisting' }, services: { atproto_pds: { type: 'AtprotoPersonalDataServer', endpoint: 'https://pds.example' } } });
    }
    if (target.endsWith('/xrpc/com.atproto.identity.signPlcOperation')) return Response.json({ operation: { type: 'plc_operation', sig: 'test' } });
    if (target.endsWith('/xrpc/com.atproto.identity.submitPlcOperation')) return new Response('', { status: 200 });
    if (target.endsWith('/xrpc/com.atproto.repo.putRecord')) return Response.json({ uri: 'at://did:plc:owner/app.bsky.labeler.service/self' });
    throw new Error('Unexpected fetch: ' + target);
  };
  try {
    const requestCode = await worker.fetch(new Request(SITE + '/api/admin/labeler/identity/request-code', {
      method: 'POST', headers: { Cookie: 'session=admin-session' },
    }), env);
    assert.equal(requestCode.status, 200);
    const confirm = await worker.fetch(new Request(SITE + '/api/admin/labeler/identity/confirm', {
      method: 'POST', headers: { Cookie: 'session=admin-session', 'Content-Type': 'application/json' }, body: JSON.stringify({ token: '123456' }),
    }), env);
    assert.equal(confirm.status, 200);
    const sign = calls.find(call => call.target.endsWith('/xrpc/com.atproto.identity.signPlcOperation'));
    assert.equal(sign.body.verificationMethods.atproto, 'did:key:zExisting');
    assert.match(sign.body.verificationMethods.atproto_label, /^did:key:zQ3/);
    assert.deepEqual(sign.body.services.atproto_pds, { type: 'AtprotoPersonalDataServer', endpoint: 'https://pds.example' });
    assert.deepEqual(sign.body.services.atproto_labeler, { type: 'AtprotoLabeler', endpoint: SITE });
    const declaration = calls.find(call => call.target.endsWith('/xrpc/com.atproto.repo.putRecord'));
    assert.equal(declaration.body.record.did, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('subscribeLabels wire frames are binary DAG-CBOR', () => {
  const frame = cborEncodeFrame({ name: 'labels', body: { seq: 3, labels: [] } });
  assert.ok(frame instanceof Uint8Array);
  // First map is the subscription header: {op: 1, t: '#labels'}.
  assert.ok(frame.includes(new TextEncoder().encode('#labels')[0]));
});

function decodeBase58(string) {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const bytes = [0];
  for (const char of string) {
    const value = alphabet.indexOf(char);
    if (value < 0) throw new Error('bad base58 char ' + char);
    let carry = value;
    for (let i = 0; i < bytes.length; i++) { carry += bytes[i] * 58; bytes[i] = carry & 255; carry >>= 8; }
    while (carry) { bytes.push(carry & 255); carry >>= 8; }
  }
  return new Uint8Array(bytes.reverse());
}
