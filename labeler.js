/**
 * Self-hosted ATProto labeler service for lastnpcalex.agency.
 *
 * The labeler identity is did:web:lastnpcalex.agency — served as
 * /.well-known/did.json with a #atproto_label Multikey (secp256k1).
 * The private key lives in the SESSIONS KV (generated on first use) and
 * never leaves the worker. Labels are stored under `label:<seq>` and are
 * signed at serve time, exactly as app.bsky consumers expect:
 *
 *   sig = secp256k1.sign(sha256(dagCbor(labelWithoutSig)), signingKey)  (64-byte compact)
 *
 * Endpoints (all public, per the labeler spec):
 *   /.well-known/did.json
 *   /xrpc/com.atproto.label.queryLabels
 *   /xrpc/com.atproto.label.subscribeLabels   (websocket, JSON frames)
 *
 * Writes happen only through the admin API in worker-content.js
 * (/api/admin/labels, gated by ADMIN_DIDS + same-origin).
 */
import { secp256k1 } from '@noble/curves/secp256k1.js';

export const LABELER_DID = 'did:web:lastnpcalex.agency';
const LABELER_ENDPOINT = 'https://lastnpcalex.agency';
const KEY_KV = 'labeler:signing-key';
const SEQ_KV = 'labeler:seq';
const LABEL_PREFIX = 'label:';
const BATCH = 100;
const STREAM_LIFETIME_MS = 55_000;   // replay everything, then close; consumers reconnect with their cursor

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

async function signLabel(label, key) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', cborEncodeLabel(label)));
  // @noble/curves >= 2 returns the 64-byte compact signature directly;
  // older 1.x returned a Signature object needing .toBytes('compact')
  const sig = secp256k1.sign(digest, key.priv);
  return sig instanceof Uint8Array ? sig : sig.toBytes('compact');
}

function bytesToB64(bytes) {
  let string = '';
  for (const b of bytes) string += String.fromCharCode(b);
  return btoa(string);
}

/* ── label JSON (lexicon bytes → {"$bytes": base64}) ── */

async function labelJson(record, key) {
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
  const sig = await signLabel(label, key);
  return { ...label, sig: { $bytes: bytesToB64(sig) } };
}

async function listLabelRecords(env) {
  const records = [];
  let cursor;
  do {
    const page = await env.SESSIONS.list({ prefix: LABEL_PREFIX, limit: 1000, ...(cursor ? { cursor } : {}) });
    const values = await Promise.all(page.keys.map(item => env.SESSIONS.get(item.name)));
    for (const raw of values) {
      if (!raw) continue;
      try {
        const record = JSON.parse(raw);
        if (record && typeof record.val === 'string') records.push(record);
      } catch { /* skip malformed */ }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  records.sort((a, b) => (a.seq || 0) - (b.seq || 0));
  return records;
}

/* ── uriPatterns matching (spec: `*` wildcard globbing) ── */

function matchPattern(pattern, uri) {
  const escaped = String(pattern || '').split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  if (new RegExp('^' + escaped + '$').test(uri)) return true;
  // "did:plc:x" patterns also cover all of that DID's AT-URIs
  if (pattern.startsWith('did:')) return uri.startsWith('at://' + pattern.split('*')[0]);
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
  let records = await listLabelRecords(env);
  if (cursor) records = records.filter(r => (r.seq || 0) > cursor);
  if (sources.length && !sources.includes(LABELER_DID)) records = [];
  else records = records.filter(r => patterns.some(pattern => matchPattern(pattern, r.uri)));
  const page = records.slice(0, limit);
  const key = await ensureLabelerKey(env);
  const labels = await Promise.all(page.map(record => labelJson(record, key)));
  const body = { labels };
  if (records.length > limit && page.length) body.cursor = String(page[page.length - 1].seq);
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
  });
}

function streamMessage(frame) {
  return JSON.stringify({ $type: 'com.atproto.label.subscribeLabels#' + frame.name, ...frame.body });
}

async function handleSubscribeLabels(request, env) {
  if (request.headers.get('Upgrade') !== 'websocket') {
    return new Response('websocket upgrade required', { status: 426 });
  }
  const cursor = parseInt(new URL(request.url).searchParams.get('cursor'), 10) || 0;
  const records = (await listLabelRecords(env)).filter(r => (r.seq || 0) > cursor);
  const key = await ensureLabelerKey(env);

  const pair = new WebSocketPair();
  const server = pair[1];
  server.accept();

  (async () => {
    try {
      for (let i = 0; i < records.length; i += BATCH) {
        const slice = records.slice(i, i + BATCH);
        const labels = await Promise.all(slice.map(record => labelJson(record, key)));
        server.send(streamMessage({ name: 'labels', body: { seq: slice[slice.length - 1].seq, labels } }));
      }
      const timer = setTimeout(() => { try { server.close(1001, 'reconnect with cursor'); } catch { /* already closed */ } }, STREAM_LIFETIME_MS);
      server.addEventListener('close', () => clearTimeout(timer));
      server.addEventListener('message', event => {
        if (event.data === 'ping') { try { server.send('pong'); } catch { /* closed */ } }
      });
    } catch { /* socket died mid-replay */ }
  })();

  return new Response(null, { status: 101, webSocket: pair[0] });
}

async function handleDidDoc(request, env) {
  const key = await ensureLabelerKey(env);
  const doc = {
    '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/multikey/v1'],
    id: LABELER_DID,
    verificationMethod: [{
      id: LABELER_DID + '#atproto_label',
      type: 'Multikey',
      controller: LABELER_DID,
      publicKeyMultibase: 'z' + base58btc(key.pub),
    }],
    service: [{
      id: '#atproto_labeler',
      type: 'AtprotoLabeler',
      serviceEndpoint: LABELER_ENDPOINT,
    }],
  };
  return new Response(JSON.stringify(doc, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
  });
}

export async function handleLabelerRequest(request, env) {
  const path = new URL(request.url).pathname;
  if (path === '/.well-known/did.json') return handleDidDoc(request, env);
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
