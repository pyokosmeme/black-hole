/**
 * Self-hosted ATProto labeler service for lastnpcalex.agency.
 *
 * The labeler identity is the existing lastnpcalex.agency ATProto account.
 * Its PLC DID document publishes #atproto_label and #atproto_labeler.
 * The private key lives in the SESSIONS KV (generated on first use) and
 * never leaves the worker. Labels are stored under `label:<seq>` and are
 * signed at serve time, exactly as app.bsky consumers expect:
 *
 *   sig = secp256k1.sign(sha256(dagCbor(labelWithoutSig)), signingKey)  (64-byte compact)
 *
 * Endpoints (all public, per the labeler spec):
 *   /xrpc/com.atproto.label.queryLabels
 *   /xrpc/com.atproto.label.subscribeLabels   (websocket, binary DAG-CBOR frames)
 *
 * Writes happen only through the admin API in worker-content.js
 * (/api/admin/labels, gated by ADMIN_DIDS + same-origin).
 */
import { secp256k1 } from '@noble/curves/secp256k1.js';

export const LABELER_DID = 'did:plc:ccxl3ictrlvtrrgh5swvvg47';
const KEY_KV = 'labeler:signing-key';
const SEQ_KV = 'labeler:seq';
const LABEL_PREFIX = 'label:';
const BATCH = 100;
const STREAM_LIFETIME_MS = 600_000;  // long-lived: replay, stream live events, then close so consumers reconnect with their cursor
const STREAM_POLL_MS = 60_000;
const RECORD_CACHE_URL = 'https://lastnpcalex.agency/__labeler-cache/records-v1';
const RECORD_CACHE_SECONDS = 300;

/* ── tiny byte helpers ── */

const hex = bytes => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
const unhex = string => new Uint8Array((string.match(/../g) || []).map(h => parseInt(h, 16)));

export function base58btc(bytes) {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry) { digits.push(carry % 58); carry = (carry / 58) | 0; }
  }
  for (const byte of bytes) { if (!byte) digits.push(0); else break; }
  return digits.reverse().map(d => alphabet[d]).join('');
}

/* ── minimal deterministic dag-cbor encoder (only what a label needs:
      uint, bytes, text strings, booleans; maps sorted canonically) ── */

function cborHead(major, arg) {
  if (arg < 24) return Uint8Array.of((major << 5) | arg);
  if (arg < 256) return Uint8Array.of((major << 5) | 24, arg);
  if (arg < 65536) return Uint8Array.of((major << 5) | 25, arg >> 8, arg & 255);
  return Uint8Array.of((major << 5) | 26, (arg >> 24) & 255, (arg >> 16) & 255, (arg >> 8) & 255, arg & 255);
}

function cborConcat(...chunks) {
  const length = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.length; }
  return out;
}

function cborValue(value) {
  if (typeof value === 'boolean') return Uint8Array.of(value ? 0xf5 : 0xf4);
  if (typeof value === 'number') return Number.isInteger(value) && value >= 0 ? cborHead(0, value) : null;
  if (typeof value === 'string') {
    const encoded = new TextEncoder().encode(value);
    return cborConcat(cborHead(3, encoded.length), encoded);
  }
  if (value instanceof Uint8Array) return cborConcat(cborHead(2, value.length), value);
  return null;
}

export function cborEncodeLabel(label) {
  const entries = Object.entries(label).filter(([, v]) => v !== undefined && v !== null && v !== false);
  // canonical dag-cbor map key order: length first, then bytewise
  entries.sort((a, b) => {
    const ka = new TextEncoder().encode(a[0]);
    const kb = new TextEncoder().encode(b[0]);
    if (ka.length !== kb.length) return ka.length - kb.length;
    for (let i = 0; i < ka.length; i++) { if (ka[i] !== kb[i]) return ka[i] - kb[i]; }
    return 0;
  });
  const pairs = entries.map(([key, value]) => {
    const k = cborValue(key);
    const v = cborValue(value);
    if (!k || !v) throw new Error(`cbor: unsupported label field ${key}`);
    return cborConcat(k, v);
  });
  return cborConcat(cborHead(5, entries.length), ...pairs);
}

/* ── subscribeLabels wire frames (spec: one binary message = two concatenated
 *    dag-cbor objects: {"t": "#labels", "op": 1} + {"seq", "labels": [...]}) ── */

export function cborEncodeFrame(frame) {
  const parts = [];
  const enc = (value) => {
    if (typeof value === 'boolean') return cborValue(value);
    if (typeof value === 'number') return cborValue(value);
    if (typeof value === 'string') return cborValue(value);
    if (value instanceof Uint8Array) return cborValue(value);
    if (Array.isArray(value)) {
      const items = value.map(enc).filter(Boolean);
      return cborConcat(cborHead(4, items.length), ...items);
    }
    if (value && typeof value === 'object') {
      const entries = Object.entries(value).filter(([, v]) => v !== undefined && v !== null && v !== false);
      entries.sort((a, b) => {
        const ka = new TextEncoder().encode(a[0]);
        const kb = new TextEncoder().encode(b[0]);
        if (ka.length !== kb.length) return ka.length - kb.length;
        for (let i = 0; i < ka.length; i++) { if (ka[i] !== kb[i]) return ka[i] - kb[i]; }
        return 0;
      });
      const pairs = entries.map(([key, v]) => {
        const k = cborValue(key);
        const ev = enc(v);
        if (!k || !ev) throw new Error(`cbor: unsupported field ${key}`);
        return cborConcat(k, ev);
      });
      return cborConcat(cborHead(5, pairs.length), ...pairs);
    }
    return null;
  };
  const header = enc({ t: '#' + frame.name, op: 1 });
  const body = enc(frame.body);
  parts.push(header, body);
  return cborConcat(...parts);
}

/* ── signing key (secp256k1, stored in KV) ── */

async function ensureLabelerKey(env) {
  const raw = await env.SESSIONS.get(KEY_KV);
  if (raw) {
    const priv = unhex(raw);
    return { priv, pub: secp256k1.getPublicKey(priv, true) };
  }
  const priv = secp256k1.utils.randomSecretKey();
  await env.SESSIONS.put(KEY_KV, hex(priv));
  return { priv, pub: secp256k1.getPublicKey(priv, true) };
}

// `verificationMethods` in a PLC operation uses did:key multibase values.
// secp256k1-pub uses multicodec 0xe7 0x01 before the 33-byte compressed key.
export async function getLabelerDidKey(env) {
  const key = await ensureLabelerKey(env);
  const prefixed = new Uint8Array(2 + key.pub.length);
  prefixed.set([0xe7, 0x01]);
  prefixed.set(key.pub, 2);
  return `did:key:z${base58btc(prefixed)}`;
}

async function signLabel(label, key) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', cborEncodeLabel(label)));
  // AT Protocol signs SHA-256(CBOR) exactly once. Noble v2 hashes its input
  // by default, so disable prehashing when passing this already-hashed digest.
  const sig = secp256k1.sign(digest, key.priv, { prehash: false, lowS: true });
  return sig instanceof Uint8Array ? sig : sig.toBytes('compact');
}

function bytesToB64(bytes) {
  let string = '';
  for (const b of bytes) string += String.fromCharCode(b);
  return btoa(string);
}

/* ── label JSON (lexicon bytes → {"$bytes": base64}) ── */

async function signedLabel(record, key) {
  const label = {
    ver: 1,
    src: LABELER_DID,
    uri: record.uri,
    val: record.val,
    cts: record.cts,
  };
  if (record.cid) label.cid = record.cid;
  if (record.neg) label.neg = true;
  if (record.exp) label.exp = record.exp;
  label.uri = subjectUri(record);
  return { ...label, sig: await signLabel(label, key) };
}

async function labelJson(record, key) {
  const label = await signedLabel(record, key);
  return { ...label, sig: { $bytes: bytesToB64(label.sig) } };
}

async function listLabelRecords(env) {
  // Cache API operations do not consume KV's read/list allowance. The cache
  // is shared by queries at this location and contains public label fields only.
  const cache = globalThis.caches?.default;
  try {
    const cached = await cache?.match(RECORD_CACHE_URL);
    if (cached) return await cached.json();
  } catch { /* a cache failure must not prevent reading labels */ }
  const records = [];
  let cursor;
  do {
    const page = await env.SESSIONS.list({ prefix: LABEL_PREFIX, limit: 1000, ...(cursor ? { cursor } : {}) });
    const values = await Promise.all(page.keys.map(item => env.SESSIONS.get(item.name)));
    for (const raw of values) {
      if (!raw) continue;
      try {
        const record = JSON.parse(raw);
        if (record && typeof record.val === 'string') {
          const { seq, uri, val, neg, cts, cid, exp } = record;
          records.push({ seq, uri, val, neg, cts, cid, exp });
        }
      } catch { /* skip malformed */ }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  records.sort((a, b) => (a.seq || 0) - (b.seq || 0));
  try {
    await cache?.put(RECORD_CACHE_URL, new Response(JSON.stringify(records), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${RECORD_CACHE_SECONDS}` },
    }));
  } catch { /* serve the result even when the cache cannot store it */ }
  return records;
}

export async function invalidateLabelCache() {
  // Other locations expire within five minutes; mutations refresh this one.
  try { await globalThis.caches?.default.delete(RECORD_CACHE_URL); } catch { /* best effort */ }
}

/* ── subject handling ──
 * A bare DID is the protocol subject for an account-level label. Do not
 * rewrite it to the profile record: that changes the label's meaning and
 * prevents consumers from treating it as an account label.
 */
function subjectUri(record) {
  return String(record.uri || '');
}

/* ── uriPatterns matching (spec: `*` wildcard globbing) ── */

function matchPattern(pattern, uri) {
  const escaped = String(pattern || '').split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  if (new RegExp('^' + escaped + '$').test(uri)) return true;
  // "did:plc:x" patterns also cover all of that DID's AT-URIs
  if (pattern.startsWith('did:')) return uri.startsWith('at://' + pattern.split('*')[0]);
  // Some consumers query a profile AT-URI while looking for account labels.
  // Keep that lookup ergonomic, but return/sign the real bare-DID subject.
  if (/^did:[a-zA-Z0-9:.]+$/.test(uri)) {
    return pattern === `at://${uri}/app.bsky.actor.profile/self`;
  }
  return false;
}

/* ── public endpoints ── */

async function handleQueryLabels(request, env) {
  const url = new URL(request.url);
  const patterns = url.searchParams.getAll('uriPatterns').filter(Boolean);
  const sources = url.searchParams.getAll('sources').filter(Boolean);
  const limit = Math.min(250, parseInt(url.searchParams.get('limit'), 10) || 50);
  const cursor = parseInt(url.searchParams.get('cursor'), 10) || 0;
  if (!patterns.length) {
    return new Response(JSON.stringify({ error: 'InvalidRequest', message: 'uriPatterns required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
    });
  }
  let records = sources.length && !sources.includes(LABELER_DID) ? [] : await listLabelRecords(env);
  if (cursor) records = records.filter(r => (r.seq || 0) > cursor);
  if (sources.length && !sources.includes(LABELER_DID)) records = [];
  else records = records.filter(r => patterns.some(pattern => matchPattern(pattern, subjectUri(r))));
  const page = records.slice(0, limit);
  const key = page.length ? await ensureLabelerKey(env) : null;
  const labels = await Promise.all(page.map(record => labelJson(record, key)));
  const body = { labels };
  if (records.length > limit && page.length) body.cursor = String(page[page.length - 1].seq);
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
  });
}

/**
 * Spec-correct subscribeLabels: replay from cursor as dag-cbor binary frames,
 * then stream new label events live by polling the seq counter in KV.
 * Long-lived socket; closes with 1001 so the consumer reconnects with its cursor.
 */
async function handleSubscribeLabels(request, env) {
  if (request.headers.get('Upgrade') !== 'websocket') {
    return new Response('websocket upgrade required', { status: 426 });
  }
  const cursorValue = new URL(request.url).searchParams.get('cursor');
  const cursor = cursorValue === null ? 0 : Number(cursorValue);
  if (!Number.isSafeInteger(cursor) || cursor < 0) {
    return new Response('cursor must be a non-negative integer', { status: 400 });
  }
  const key = await ensureLabelerKey(env);

  const pair = new WebSocketPair();
  const server = pair[1];
  server.accept();
  let closed = false;
  let poller;
  let lifetime;
  let lastSeq = cursor;
  const cleanup = () => {
    closed = true;
    clearTimeout(poller);
    clearTimeout(lifetime);
  };
  const close = (code, reason) => {
    cleanup();
    try { server.close(code, reason); } catch { /* already closed */ }
  };
  // Register before any replay I/O, including for clients that disconnect
  // while a KV read is pending. Never leave a poller running on a dead socket.
  server.addEventListener('close', cleanup);
  server.addEventListener('error', cleanup);
  lifetime = setTimeout(() => close(1001, 'reconnect with cursor'), STREAM_LIFETIME_MS);
  lifetime.unref?.();

  const poll = async () => {
    try {
      if (closed) return;
      const head = parseInt(await env.SESSIONS.get(SEQ_KV), 10) || 0;
      // Sequential keys let a reconnect replay only its missing range, with
      // no KV.list or reads of labels at/before the consumer's cursor.
      for (let start = lastSeq + 1; start <= head && !closed; start += BATCH) {
        const end = Math.min(head, start + BATCH - 1);
        const values = await Promise.all(Array.from({ length: end - start + 1 }, (_, i) => env.SESSIONS.get(`${LABEL_PREFIX}${start + i}`)));
        if (closed) return;
        const records = values.flatMap(raw => {
          try {
            const record = JSON.parse(raw);
            return record && typeof record.val === 'string' ? [record] : [];
          } catch { return []; }
        });
        if (!records.length) continue;
        const labels = await Promise.all(records.map(record => signedLabel(record, key)));
        if (closed) return;
        const seq = records[records.length - 1].seq;
        server.send(cborEncodeFrame({ name: 'labels', body: { seq, labels } }));
        lastSeq = seq;
      }
    } catch {
      // KV errors (including exhausted quotas) must not trigger a tight retry
      // loop. The next poll retries after the normal interval.
    } finally {
      if (!closed) {
        poller = setTimeout(poll, STREAM_POLL_MS);
        poller.unref?.();
      }
    }
  };
  void poll();

  return new Response(null, { status: 101, webSocket: pair[0] });
}

export async function handleLabelerRequest(request, env) {
  const path = new URL(request.url).pathname;
  // Worker observability already records requests; diagnostics must not spend
  // the same KV budget needed for sessions, publications, and subscriptions.
  if (path === '/xrpc/com.atproto.label.queryLabels') return handleQueryLabels(request, env);
  if (path === '/xrpc/com.atproto.label.subscribeLabels') return handleSubscribeLabels(request, env);
  if (path.startsWith('/xrpc/')) {
    return new Response(JSON.stringify({ error: 'XRPCNotSupported', message: 'unknown XRPC method' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
    });
  }
  return null;
}
