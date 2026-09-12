import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as nextTurn } from 'node:timers/promises';
import worker from '../_worker.js';
import { handleLabelerRequest } from '../labeler.js';

const SITE = 'https://lastnpcalex.agency';
const QUERY = `${SITE}/xrpc/com.atproto.label.queryLabels?uriPatterns=*`;
const STREAM = `${SITE}/xrpc/com.atproto.label.subscribeLabels`;
const record = seq => ({ seq, uri: `did:plc:person${seq}`, val: 'player-character', cts: '2026-09-12T00:00:00Z' });

function makeEnv(count = 3) {
  const values = new Map([
    ['labeler:signing-key', '1'.padStart(64, '0')],
    ['labeler:seq', String(count)],
    ['session:admin', JSON.stringify({ did: 'did:plc:owner' })],
    ...Array.from({ length: count }, (_, i) => [`label:${i + 1}`, JSON.stringify(record(i + 1))]),
  ]);
  const calls = { gets: [], puts: [], lists: 0 };
  return {
    values, calls, ADMIN_DIDS: 'did:plc:owner',
    SESSIONS: {
      async get(key) { calls.gets.push(key); return values.get(key) ?? null; },
      async put(key, value) { calls.puts.push(key); values.set(key, String(value)); },
      async delete(key) { values.delete(key); },
      async list({ prefix }) {
        calls.lists++;
        return { keys: [...values.keys()].filter(key => key.startsWith(prefix)).map(name => ({ name })), list_complete: true };
      },
    },
  };
}

function installCache(t) {
  const previous = globalThis.caches;
  const entries = new Map();
  let now = 0;
  globalThis.caches = { default: {
    async match(key) {
      const entry = entries.get(key);
      return entry && entry.expires > now ? entry.response.clone() : undefined;
    },
    async put(key, response) {
      const seconds = Number(response.headers.get('Cache-Control').match(/max-age=(\d+)/)[1]);
      entries.set(key, { response: response.clone(), expires: now + seconds * 1000 });
    },
    async delete(key) { return entries.delete(key); },
  } };
  t.after(() => { if (previous === undefined) delete globalThis.caches; else globalThis.caches = previous; });
  return { entries, advance(ms) { now += ms; } };
}

function installStreamRuntime(t) {
  const NativeResponse = globalThis.Response;
  const previousPair = globalThis.WebSocketPair;
  const sockets = [];
  const timers = new Map();
  let now = 0;
  let nextId = 1;
  class Socket extends EventTarget {
    frames = [];
    accept() {}
    send(frame) { this.frames.push(frame); }
    close(code) { this.closeCode = code; this.dispatchEvent(new Event('close')); }
  }
  globalThis.WebSocketPair = class {
    constructor() { this[0] = new Socket(); this[1] = new Socket(); sockets.push(this[1]); }
  };
  globalThis.Response = class extends NativeResponse {
    constructor(body, init) {
      if (init?.status !== 101) { super(body, init); return; }
      super(null);
      Object.defineProperty(this, 'status', { value: 101 });
      this.webSocket = init.webSocket;
    }
  };
  t.mock.method(globalThis, 'setTimeout', (callback, delay) => {
    const id = nextId++;
    timers.set(id, { at: now + delay, callback });
    return id;
  });
  t.mock.method(globalThis, 'clearTimeout', id => timers.delete(id));
  t.after(() => {
    globalThis.Response = NativeResponse;
    if (previousPair === undefined) delete globalThis.WebSocketPair;
    else globalThis.WebSocketPair = previousPair;
  });
  return {
    sockets, timers,
    async advance(ms) {
      const end = now + ms;
      while (true) {
        const due = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        now = due[1].at;
        timers.delete(due[0]);
        await due[1].callback();
      }
      now = end;
    },
  };
}

async function settle() { for (let i = 0; i < 10; i++) await nextTurn(); }
const subscribe = (env, cursor) => handleLabelerRequest(new Request(`${STREAM}?cursor=${cursor}`, { headers: { Upgrade: 'websocket' } }), env);
const query = async env => (await handleLabelerRequest(new Request(QUERY), env)).json();
const mutate = (env, method, body) => worker.fetch(new Request(`${SITE}/api/admin/labels`, {
  method, headers: { Cookie: 'session=admin', Origin: SITE, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
}), env);

test('repeated label queries reuse the public cache and never write diagnostic keys', async t => {
  const cache = installCache(t);
  const env = makeEnv(100);
  env.values.set('label:1', JSON.stringify({ ...record(1), comment: 'private admin note' }));
  for (let i = 0; i < 20; i++) assert.equal((await query(env)).labels.length, 50);
  assert.equal(env.calls.lists, 1);
  assert.equal(env.calls.gets.filter(key => key.startsWith('label:')).length, 100);
  assert.deepEqual(env.calls.puts, []);
  const cached = await [...cache.entries.values()][0].response.clone().text();
  assert.doesNotMatch(cached, /private admin note|signing-key|session:|comment/);
  cache.advance(300_001);
  await query(env);
  assert.equal(env.calls.lists, 2, 'a different location picks up changes after bounded cache expiry');
});

test('admin creation and deletion invalidate cached labels', async t => {
  installCache(t);
  const env = makeEnv(1);
  assert.equal((await query(env)).labels.length, 1);
  assert.equal((await mutate(env, 'POST', { uri: 'did:plc:newperson', val: 'player-character' })).status, 201);
  assert.equal((await query(env)).labels.length, 2);
  assert.equal((await mutate(env, 'DELETE', { seq: 1 })).status, 200);
  assert.equal((await query(env)).labels.length, 1);
});

test('scheduled label additions invalidate cached labels', async t => {
  installCache(t);
  const env = makeEnv(1);
  await query(env);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ likes: [{ actor: { did: 'did:plc:liker' } }] }));
  await worker.scheduled({}, env, { waitUntil() {} });
  assert.equal((await query(env)).labels.length, 2);
});

test('invalid requests and queries for other sources do not touch KV', async () => {
  const env = makeEnv();
  assert.equal((await handleLabelerRequest(new Request(STREAM), env)).status, 426);
  assert.equal((await subscribe(env, -1)).status, 400);
  assert.equal((await subscribe(env, 'NaN')).status, 400);
  assert.equal((await handleLabelerRequest(new Request(`${SITE}/xrpc/com.atproto.label.queryLabels`), env)).status, 400);
  const response = await handleLabelerRequest(new Request(`${QUERY}&sources=did:plc:another`), env);
  assert.deepEqual(await response.json(), { labels: [] });
  assert.deepEqual(env.calls, { gets: [], puts: [], lists: 0 });
});

test('an up-to-date stream does one head read per ten minutes and no list scans', async t => {
  const runtime = installStreamRuntime(t);
  const env = makeEnv(100);
  assert.equal((await subscribe(env, 100)).status, 101);
  await settle();
  assert.deepEqual(env.calls.gets, ['labeler:signing-key', 'labeler:seq']);
  await runtime.advance(599_999);
  assert.equal(env.calls.gets.length, 2);
  await runtime.advance(1);
  assert.equal(env.calls.gets.length, 3);
  env.values.set('label:101', JSON.stringify(record(101)));
  env.values.set('labeler:seq', '101');
  await runtime.advance(600_000);
  assert.equal(runtime.sockets[0].frames.length, 1);
  assert.deepEqual(env.calls.gets.filter(key => key.startsWith('label:')), ['label:101']);
  assert.equal(env.calls.lists, 0);
  runtime.sockets[0].close(1000);
  const reads = env.calls.gets.length;
  await runtime.advance(3_600_000);
  assert.equal(env.calls.gets.length, reads);
  assert.equal(runtime.timers.size, 0);
});

test('stream replay fetches only keys after its cursor and tolerates purged records', async t => {
  const runtime = installStreamRuntime(t);
  const env = makeEnv(5);
  env.values.delete('label:4');
  await subscribe(env, 2);
  await settle();
  assert.deepEqual(env.calls.gets.filter(key => key.startsWith('label:')), ['label:3', 'label:4', 'label:5']);
  assert.equal(runtime.sockets[0].frames.length, 1);
  assert.equal(env.calls.lists, 0);
  await runtime.advance(3_600_000);
  assert.equal(runtime.sockets[0].closeCode, 1001);
  assert.equal(runtime.timers.size, 0);
});

test('disconnect during replay cannot leave an orphaned KV poller', async t => {
  const runtime = installStreamRuntime(t);
  const env = makeEnv(1);
  const originalGet = env.SESSIONS.get;
  let release;
  env.SESSIONS.get = async key => {
    if (key === 'label:1') await new Promise(resolve => { release = resolve; });
    return originalGet(key);
  };
  await subscribe(env, 0);
  await settle();
  assert.equal(typeof release, 'function');
  runtime.sockets[0].close(1000);
  release();
  await settle();
  assert.equal(runtime.sockets[0].frames.length, 0);
  assert.equal(runtime.timers.size, 0);
});

test('slow or failing KV reads never cause overlapping polls or rapid retries', async t => {
  const runtime = installStreamRuntime(t);
  const env = makeEnv(1);
  const originalGet = env.SESSIONS.get;
  let headReads = 0;
  let release;
  env.SESSIONS.get = async key => {
    if (key === 'labeler:seq') {
      headReads++;
      if (headReads === 1) await new Promise(resolve => { release = resolve; });
      throw new Error('KV quota exhausted');
    }
    return originalGet(key);
  };
  await subscribe(env, 1);
  await settle();
  await runtime.advance(1_200_000);
  assert.equal(headReads, 1);
  release();
  await settle();
  await runtime.advance(599_999);
  assert.equal(headReads, 1);
  await runtime.advance(1);
  assert.equal(headReads, 2);
  runtime.sockets[0].dispatchEvent(new Event('error'));
  assert.equal(runtime.timers.size, 0);
});
