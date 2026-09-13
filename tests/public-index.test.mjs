import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../_worker.js';
import { handleContentRequest } from '../worker-content.js';
import { PUBLIC_PREFIXES, INDEX_PAGE_SIZE, indexKey, readPublicIndex, refreshPublicIndex } from '../public-index.js';

const SITE = 'https://lastnpcalex.agency';
const post = (slug, status = 'published') => ({ section: 'author', slug, status, title: slug, date: '2026.09.12', markdown: 'BODY MUST NOT ENTER INDEX', excerpt: 'Excerpt', tags: [] });

function environment(seed = {}) {
  const values = new Map(Object.entries(seed));
  const calls = { get: [], put: [], list: [], delete: [] };
  const env = {
    values, calls, ADMIN_DIDS: 'did:plc:owner',
    SESSIONS: {
      async get(key) { calls.get.push(key); return values.get(key) ?? null; },
      async put(key, raw) { calls.put.push(key); values.set(key, String(raw)); },
      async delete(key) { calls.delete.push(key); values.delete(key); },
      async list({ prefix, limit, cursor }) {
        calls.list.push({ prefix, limit, cursor });
        const keys = [...values.keys()].filter(key => key.startsWith(prefix)).sort();
        const start = Number(cursor || 0);
        const end = start + limit;
        return { keys: keys.slice(start, end).map(name => ({ name })), list_complete: end >= keys.length, cursor: end < keys.length ? String(end) : undefined };
      },
    },
    ASSETS: { async fetch() { return new Response('', { status: 404 }); } },
  };
  return env;
}

test('public listings spend zero lists even without edge caches or with the list quota blocked', async () => {
  const env = environment({
    ...Object.fromEntries(PUBLIC_PREFIXES.map(prefix => [indexKey(prefix), '[]'])),
    [indexKey('transmission:author:')]: JSON.stringify([post('published'), { slug: 'hidden', status: 'archived' }]),
  });
  env.SESSIONS.list = () => { throw new Error('daily list quota exhausted'); };
  for (let i = 0; i < 100; i++) {
    const response = await worker.fetch(new Request(SITE + '/api/transmissions'), env);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.deepEqual(data.posts.map(item => item.slug), ['published']);
    assert.deepEqual(data.archived, ['hidden']);
    assert.equal((await worker.fetch(new Request(SITE + '/llms.txt'), env)).status, 200);
    assert.equal((await worker.fetch(new Request(SITE + '/xrpc/com.atproto.label.queryLabels?uriPatterns=*'), env)).status, 200);
  }
  assert.equal(env.calls.list.length, 0);
  assert.equal(env.calls.put.length, 0);
});

test('missing indexes fail explicitly without public scans or publishing a false empty list', async () => {
  const env = environment();
  for (const path of ['/api/transmissions', '/llms.txt', '/xrpc/com.atproto.label.queryLabels?uriPatterns=*']) {
    const response = await worker.fetch(new Request(SITE + path), env);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('retry-after'), '60');
  }
  assert.equal(env.calls.list.length, 0);
  assert.equal(env.calls.put.length, 0);
});

test('index migration paginates and never exposes a partial rebuild or private fields', async () => {
  const env = environment({
    [indexKey('transmission:author:')]: JSON.stringify([{ slug: 'previous', status: 'published' }]),
    'session:secret': 'PRIVATE SESSION',
    'subscriber:private': JSON.stringify({ email: 'private@example.com' }),
    'transmission:author:private': JSON.stringify(post('private', 'draft')),
    'transmission:author:removed': JSON.stringify(post('removed', 'archived')),
    ...Object.fromEntries(Array.from({ length: 52 }, (_, i) => [`transmission:author:p${i}`, JSON.stringify(post(`p${i}`))])),
  });
  assert.equal((await refreshPublicIndex(env, 'transmission:author:')).complete, false);
  assert.equal(JSON.parse(env.values.get(indexKey('transmission:author:')))[0].slug, 'previous');
  assert.equal(env.calls.list.length, 1);
  assert.equal(env.calls.get.filter(key => key.startsWith('transmission:')).length, INDEX_PAGE_SIZE);
  assert.equal((await refreshPublicIndex(env, 'transmission:author:')).complete, true);
  const raw = env.values.get(indexKey('transmission:author:'));
  assert.equal(JSON.parse(raw).length, 53);
  assert.doesNotMatch(raw, /BODY MUST|private|PRIVATE|markdown|email/);
  assert.deepEqual(JSON.parse(raw).find(item => item.slug === 'removed'), { slug: 'removed', status: 'archived' });
  assert.equal(env.calls.get.includes('session:secret'), false);
  assert.equal(env.calls.get.includes('subscriber:private'), false);
});

test('empty non-final KV pages are continued, and read failures preserve the old index', async () => {
  const env = environment({ [indexKey('label:')]: '[]', 'label:1': JSON.stringify({ seq: 1, uri: 'did:plc:p', val: 'test', comment: 'private note' }) });
  const list = env.SESSIONS.list;
  let first = true;
  env.SESSIONS.list = options => {
    if (first) { first = false; return { keys: [], list_complete: false, cursor: '0' }; }
    return list(options);
  };
  assert.equal((await refreshPublicIndex(env, 'label:')).complete, false);
  const get = env.SESSIONS.get;
  env.SESSIONS.get = key => { if (key === 'label:1') throw new Error('read unavailable'); return get(key); };
  await assert.rejects(refreshPublicIndex(env, 'label:'), /read unavailable/);
  assert.equal(env.values.get(indexKey('label:')), '[]');
  env.SESSIONS.get = get;
  await refreshPublicIndex(env, 'label:');
  assert.doesNotMatch(env.values.get(indexKey('label:')), /comment|private note/);
  assert.equal((await readPublicIndex(env, 'label:')).length, 1);
});

test('an admin mutation overrides a lagging KV list and get result', async () => {
  const old = post('edited');
  const env = environment({ 'transmission:author:edited': JSON.stringify(old) });
  const updated = { ...old, title: 'New title' };
  await refreshPublicIndex(env, 'transmission:author:', { id: 'edited', record: updated });
  assert.equal((await readPublicIndex(env, 'transmission:author:'))[0].title, 'New title');
  await refreshPublicIndex(env, 'transmission:author:', { id: 'edited', record: { ...updated, status: 'draft' } });
  assert.deepEqual(await readPublicIndex(env, 'transmission:author:'), []);
});

test('24 hours of idle maintenance costs 144 lists, five initial writes, and no deletes', async t => {
  const env = environment();
  let fetches = 0;
  t.mock.method(globalThis, 'fetch', async () => { fetches++; return Response.json({ likes: [] }); });
  for (let slot = 0; slot < 144; slot++) await worker.scheduled({ scheduledTime: slot * 600_000 }, env);
  assert.equal(env.calls.list.length, 144);
  assert.equal(env.calls.put.length, 5);
  assert.equal(env.calls.delete.length, 0);
  assert.equal(fetches, 48);
  assert.ok(env.calls.get.length < 400);
});

test('large collections and a continuous liker backlog stay inside the background daily budget', async t => {
  const env = environment(Object.fromEntries(Array.from({ length: 500 }, (_, i) => [`transmission:author:p${i}`, JSON.stringify(post(`p${i}`))])));
  let fetches = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    fetches++;
    return Response.json({ likes: Array.from({ length: 50 }, (_, i) => ({ actor: { did: `did:plc:person${fetches}x${i}` } })), cursor: 'next' });
  });
  for (let slot = 0; slot < 144; slot++) await worker.scheduled({ scheduledTime: slot * 600_000 }, env);
  assert.equal(env.calls.list.length, 144);
  assert.equal(fetches, 48);
  assert.equal([...env.values.keys()].filter(key => key.startsWith('label:')).length, 48);
  assert.ok(env.calls.put.length < 300, `writes: ${env.calls.put.length}`);
  assert.ok(env.calls.get.length < 10_500, `reads: ${env.calls.get.length}`);
  assert.ok(env.calls.delete.length < 144);
});

test('manual initialization is authenticated, validates prefixes, and advances only one page', async () => {
  const env = environment({ 'session:owner': JSON.stringify({ did: 'did:plc:owner' }) });
  const request = (prefix, cookie, origin = SITE) => new Request(SITE + '/api/admin/public-indexes', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify({ prefix }),
  });
  assert.equal((await worker.fetch(request('label:'), env)).status, 401);
  assert.equal((await worker.fetch(request('session:', 'session=owner'), env)).status, 400);
  assert.equal((await worker.fetch(request('label:', 'session=owner', 'https://other.example'), env)).status, 403);
  assert.equal(env.calls.list.length, 0);
  assert.equal((await worker.fetch(request('label:', 'session=owner'), env)).status, 200);
  assert.equal(env.calls.list.length, 1);
});

test('identical subscription preferences do not spend another KV write', async () => {
  const env = environment();
  const request = () => new Request(SITE + '/api/subscriptions', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: SITE }, body: JSON.stringify({ email: 'reader@example.com', topics: ['blog'], source: '/' }) });
  assert.equal((await handleContentRequest(request(), env)).status, 201);
  const writes = env.calls.put.length;
  for (let i = 0; i < 5; i++) assert.equal((await handleContentRequest(request(), env)).status, 200);
  assert.equal(env.calls.put.length, writes);
});
