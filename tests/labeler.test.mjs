import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../_worker.js';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { cborEncodeLabel, LABELER_DID } from '../labeler.js';

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

test('did.json serves a stable secp256k1 labeler key', async () => {
  const env = makeEnv();
  const first = await worker.fetch(new Request(SITE + '/.well-known/did.json'), env);
  assert.equal(first.status, 200);
  const doc = await first.json();
  assert.equal(doc.id, LABELER_DID);
  assert.equal(doc.verificationMethod[0].id, LABELER_DID + '#atproto_label');
  assert.equal(doc.verificationMethod[0].type, 'Multikey');
  const service = doc.service.find(s => s.type === 'AtprotoLabeler');
  assert.equal(service.serviceEndpoint, SITE);
  const pub = decodeBase58(doc.verificationMethod[0].publicKeyMultibase.slice(1));
  assert.equal(pub.length, 33);
  assert.ok(pub[0] === 2 || pub[0] === 3);
  // second fetch resolves the same key from KV (stable identity)
  const second = await worker.fetch(new Request(SITE + '/.well-known/did.json'), env);
  const doc2 = await second.json();
  assert.equal(doc2.verificationMethod[0].publicKeyMultibase, doc.verificationMethod[0].publicKeyMultibase);
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
  assert.equal(label.uri, 'did:plc:victim');
  assert.equal(label.val, 'player-character');

  // verify the signature against the key published in did.json
  const doc = await (await worker.fetch(new Request(SITE + '/.well-known/did.json'), env)).json();
  const pub = decodeBase58(doc.verificationMethod[0].publicKeyMultibase.slice(1));
  const sig = Buffer.from(label.sig.$bytes, 'base64');
  assert.equal(sig.length, 64);
  const { sig: _omit, ...labelBody } = label;
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', cborEncodeLabel(labelBody)));
  assert.equal(secp256k1.verify(sig, digest, pub), true);

  // other subjects see nothing
  const empty = await worker.fetch(new Request(SITE + '/xrpc/com.atproto.label.queryLabels?uriPatterns=did%3Aplc%3Aother'), env);
  assert.equal((await empty.json()).labels.length, 0);
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
  const doc = await (await worker.fetch(new Request(SITE + '/.well-known/did.json'), env)).json();
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', cborEncodeLabel(body)));
  assert.equal(secp256k1.verify(Buffer.from(labels[0].sig.$bytes, 'base64'), digest, decodeBase58(doc.verificationMethod[0].publicKeyMultibase.slice(1))), true);
});

test('labeler-record endpoint is admin-only and writes the service DID', async () => {
  const env = makeEnv({ 'session:admin-session': JSON.stringify(await adminSession()) });
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
    assert.equal(captured.body.repo, 'did:plc:owner');
    assert.equal(captured.body.collection, 'app.bsky.labeler.service');
    assert.equal(captured.body.rkey, 'self');
    assert.equal(captured.body.record.did, LABELER_DID);
    assert.deepEqual(captured.body.record.policies.labelValues, ['player-character', 'spam']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

/* base58btc decode (btc alphabet, leading zero bytes preserved as 0x00) */
function decodeBase58(string) {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const bytes = [0];
  for (const char of string) {
    const value = alphabet.indexOf(char);
    if (value < 0) throw new Error('bad base58 char ' + char);
    let carry = value;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 255;
      carry >>= 8;
    }
    while (carry) { bytes.push(carry & 255); carry >>= 8; }
  }
  let zeros = 0;
  for (const char of string) { if (char === '1') zeros++; else break; }
  return new Uint8Array([...new Array(zeros).fill(0), ...bytes.reverse()]);
}
