import test from 'node:test';
import assert from 'node:assert/strict';
import { handleContentRequest } from '../worker-content.js';

class MemoryKv {
  constructor(seed = {}) { this.values = new Map(Object.entries(seed)); }
  async get(key) { return this.values.get(key) ?? null; }
  async put(key, value) { this.values.set(key, String(value)); }
  async delete(key) { this.values.delete(key); }
  async list({ prefix = '' }) {
    return {
      keys: [...this.values.keys()].filter(key => key.startsWith(prefix)).map(name => ({ name })),
      list_complete: true,
    };
  }
}

function makeEnv() {
  const assets = new Map([
    ['/author/content/posts.md', `# TRANSMISSIONS INDEX

## test-signal
- title: TEST SIGNAL
- date: 2026.09.01
- tags: test, agent-readable
- file: content/posts/test-signal.md

The complete test excerpt.
`],
    ['/author/content/posts/test-signal.md', '# TEST SIGNAL\n\nFull article context lives here.'],
  ]);
  return {
    ADMIN_DIDS: 'did:plc:owner, did:plc:co-owner',
    SESSIONS: new MemoryKv({
      'session:owner-session': JSON.stringify({ did: 'did:plc:owner', handle: 'lastnpcalex.agency' }),
      'session:co-owner-session': JSON.stringify({ did: 'did:plc:co-owner', handle: 'spin.pyokosmeme.group' }),
      'session:reader-session': JSON.stringify({ did: 'did:plc:reader', handle: 'reader.test' }),
    }),
    ASSETS: {
      async fetch(request) {
        const value = assets.get(new URL(request.url).pathname);
        return value == null ? new Response('not found', { status: 404 }) : new Response(value);
      },
    },
  };
}

function jsonRequest(path, body, cookie) {
  return new Request(`https://lastnpcalex.agency${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'https://lastnpcalex.agency',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

test('share URL contains the complete source and a Markdown alternate', async () => {
  const env = makeEnv();
  const response = await handleContentRequest(new Request('https://lastnpcalex.agency/p/test-signal'), env);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html/);
  const html = await response.text();
  assert.match(html, /Full article context lives here/);
  assert.match(html, /<p>Full article context lives here\.<\/p>/);
  assert.doesNotMatch(html, /<pre class="markdown-source">/);
  assert.match(html, /rel="alternate" type="text\/markdown"/);
  assert.doesNotMatch(html, /http-equiv="refresh"/i);
});

test('share URL negotiates Markdown', async () => {
  const env = makeEnv();
  const response = await handleContentRequest(new Request('https://lastnpcalex.agency/p/test-signal', {
    headers: { Accept: 'text/markdown' },
  }), env);
  assert.match(response.headers.get('content-type'), /text\/markdown/);
  assert.match(await response.text(), /canonical: https:\/\/lastnpcalex\.agency\/p\/test-signal/);
});

test('subscription stores and updates selected topics without exposing the address', async () => {
  const env = makeEnv();
  let response = await handleContentRequest(jsonRequest('/api/subscriptions', {
    email: 'Reader@Example.com', topics: ['blog', 'fiction'], source: '/',
  }), env);
  assert.equal(response.status, 201);
  assert.doesNotMatch(await response.text(), /reader@example\.com/i);

  response = await handleContentRequest(jsonRequest('/api/subscriptions', {
    email: 'reader@example.com', topics: ['books'], source: '/ams.html',
  }), env);
  assert.equal(response.status, 200);
  const records = await env.SESSIONS.list({ prefix: 'subscriber:' });
  assert.equal(records.keys.length, 1);
  const subscriber = JSON.parse(await env.SESSIONS.get(records.keys[0].name));
  assert.deepEqual(subscriber.topics, ['books']);
});

test('unsubscribe GET asks for confirmation and POST changes subscriber state', async () => {
  const env = makeEnv();
  await handleContentRequest(jsonRequest('/api/subscriptions', {
    email: 'reader@example.com', topics: ['blog'], source: '/',
  }), env);
  const subscriberKey = (await env.SESSIONS.list({ prefix: 'subscriber:' })).keys[0].name;
  const subscriber = JSON.parse(await env.SESSIONS.get(subscriberKey));
  const path = `/api/subscriptions/unsubscribe?token=${subscriber.unsubscribeToken}`;

  const confirmation = await handleContentRequest(new Request(`https://lastnpcalex.agency${path}`), env);
  assert.match(await confirmation.text(), /Close this signal/);
  assert.equal(JSON.parse(await env.SESSIONS.get(subscriberKey)).status, 'active');

  const completed = await handleContentRequest(new Request(`https://lastnpcalex.agency${path}`, { method: 'POST' }), env);
  assert.equal(completed.status, 200);
  assert.equal(JSON.parse(await env.SESSIONS.get(subscriberKey)).status, 'unsubscribed');
});

test('owner can publish a managed transmission and readers can fetch it', async () => {
  const env = makeEnv();
  const payload = {
    section: 'futures', slug: 'new-vector', title: 'NEW VECTOR', date: '2026.09.03',
    tags: ['fiction'], excerpt: 'A new edge appears.', markdown: '# NEW VECTOR\n\nThe edge speaks.',
    status: 'published', notify: false,
  };
  const published = await handleContentRequest(jsonRequest('/api/admin/transmissions', payload, 'session=owner-session'), env);
  assert.equal(published.status, 201);

  const listResponse = await handleContentRequest(new Request('https://lastnpcalex.agency/api/transmissions?section=futures'), env);
  const list = await listResponse.json();
  assert.equal(list.posts[0].slug, 'new-vector');

  const bodyResponse = await handleContentRequest(new Request('https://lastnpcalex.agency/api/transmissions/futures/new-vector'), env);
  assert.equal(await bodyResponse.text(), payload.markdown);

  const share = await handleContentRequest(new Request('https://lastnpcalex.agency/p/futures/new-vector'), env);
  assert.match(await share.text(), /<p>The edge speaks\.<\/p>/);
  const alternate = await handleContentRequest(new Request('https://lastnpcalex.agency/p/futures/new-vector.md'), env);
  assert.match(await alternate.text(), /# NEW VECTOR\n\nThe edge speaks\./);
});

test('published overlays update both share formats while drafts stay private and API source stays original', async () => {
  const env = makeEnv();
  const path = 'https://lastnpcalex.agency/p/test-signal';
  const record = { section: 'author', slug: 'test-signal', title: 'Updated', date: '2026.09.05',
    status: 'draft', markdown: '<style>.private{color:red}</style><h2>Private revision</h2>' };
  await env.SESSIONS.put('transmission:author:test-signal', JSON.stringify(record));
  for (const suffix of ['', '.md']) {
    const response = await handleContentRequest(new Request(path + suffix), env);
    const body = await response.text();
    assert.match(body, /Full article context lives here/);
    assert.doesNotMatch(body, /Private revision/);
  }
  record.status = 'published';
  await env.SESSIONS.put('transmission:author:test-signal', JSON.stringify(record));
  for (const suffix of ['', '.md']) {
    const response = await handleContentRequest(new Request(path + suffix), env);
    const body = await response.text();
    assert.match(body, /Private revision/);
    assert.doesNotMatch(body, /Full article context lives here|\.private/);
  }
  const original = await handleContentRequest(new Request('https://lastnpcalex.agency/api/transmissions/author/test-signal'), env);
  assert.equal(await original.text(), record.markdown);
  const head = await handleContentRequest(new Request(path, { method: 'HEAD' }), env);
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  const missing = await handleContentRequest(new Request('https://lastnpcalex.agency/p/missing'), env);
  assert.equal(missing.status, 404);
});

test('non-owner session cannot access admin data', async () => {
  const env = makeEnv();
  const response = await handleContentRequest(new Request('https://lastnpcalex.agency/api/admin/transmissions', {
    headers: { Cookie: 'session=reader-session' },
  }), env);
  assert.equal(response.status, 403);
});

test('a second configured DID can access admin data', async () => {
  const env = makeEnv();
  const response = await handleContentRequest(new Request('https://lastnpcalex.agency/api/admin/transmissions', {
    headers: { Cookie: 'session=co-owner-session' },
  }), env);
  assert.equal(response.status, 200);
});

test('llms.txt indexes repository transmissions and Markdown URLs', async () => {
  const env = makeEnv();
  const response = await handleContentRequest(new Request('https://lastnpcalex.agency/llms.txt'), env);
  const body = await response.text();
  assert.match(body, /TEST SIGNAL/);
  assert.match(body, /https:\/\/lastnpcalex\.agency\/p\/test-signal\.md/);
});
