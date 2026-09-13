// Public traffic never enumerates KV. A cron advances one page of one index
// every ten minutes; an incomplete rebuild never replaces a complete index.
export const PUBLIC_PREFIXES = ['transmission:author:', 'transmission:ams:', 'transmission:futures:', 'transmission:maps:', 'label:'];
export const INDEX_PAGE_SIZE = 50;
export const indexKey = prefix => `public-index:v1:${prefix}`;
const stageKey = prefix => `public-index-build:v1:${prefix}`;
const cacheKey = prefix => `https://lastnpcalex.agency/__public-index/v1/${encodeURIComponent(prefix)}`;
const MAX_INDEX_BYTES = 2_000_000;

export class IndexUnavailable extends Error {
  constructor() { super('Public index is being prepared; please retry shortly.'); this.status = 503; }
}

export function publicRecord(prefix, record) {
  if (!record || typeof record !== 'object') return null;
  if (prefix === 'label:') {
    if (!Number.isSafeInteger(record.seq) || record.seq < 1 || typeof record.val !== 'string') return null;
    const { seq, uri, val, neg, cts, cid, exp } = record;
    return { seq, uri, val, neg, cts, cid, exp };
  }
  if (!PUBLIC_PREFIXES.includes(prefix) || !record.slug) return null;
  if (record.status === 'archived') return { slug: record.slug, status: 'archived' };
  if (record.status !== 'published') return null;
  const { section, slug, title, date, tags, excerpt, status } = record;
  return { section, slug, title, date, tags, excerpt, status };
}

export async function invalidatePublicIndex(prefix) {
  try { await globalThis.caches?.default.delete(cacheKey(prefix)); } catch { /* optional cache */ }
}

export async function readPublicIndex(env, prefix) {
  if (!PUBLIC_PREFIXES.includes(prefix)) throw new Error('Unknown public index');
  const cache = globalThis.caches?.default;
  try {
    const cached = await cache?.match(cacheKey(prefix));
    if (cached) return await cached.json();
  } catch { /* KV remains authoritative */ }
  const raw = await env.SESSIONS.get(indexKey(prefix));
  if (raw === null) throw new IndexUnavailable();
  const records = JSON.parse(raw);
  if (!Array.isArray(records)) throw new IndexUnavailable();
  try {
    await cache?.put(cacheKey(prefix), new Response(raw, {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
    }));
  } catch { /* serve without caching */ }
  return records;
}

function serialize(records) {
  const raw = JSON.stringify(records.sort((a, b) => a.seq != null ? a.seq - b.seq : a.slug.localeCompare(b.slug)));
  if (new TextEncoder().encode(raw).length > MAX_INDEX_BYTES) throw new Error('Public index exceeds 2 MB; partition the collection before growing it further');
  return raw;
}

async function publish(env, prefix, records) {
  const raw = serialize(records);
  // Idle maintenance must not spend the much smaller daily write allowance.
  if (await env.SESSIONS.get(indexKey(prefix)) !== raw) {
    await env.SESSIONS.put(indexKey(prefix), raw);
    await invalidatePublicIndex(prefix);
  }
}

export async function patchPublicIndex(env, prefix, id, record) {
  const raw = await env.SESSIONS.get(indexKey(prefix));
  if (raw === null) return; // never mistake a partial collection for a full one
  const records = JSON.parse(raw).filter(item => String(prefix === 'label:' ? item.seq : item.slug) !== String(id));
  const projected = publicRecord(prefix, record);
  if (projected) records.push(projected);
  await publish(env, prefix, records);
}

// Only cron and authenticated maintenance/edit handlers call this function.
// Per call: ONE list, <=50 record reads, <=2 writes, <=1 delete.
export async function refreshPublicIndex(env, prefix, mutation) {
  if (!PUBLIC_PREFIXES.includes(prefix)) throw new Error('Unknown public index');
  const pending = await env.SESSIONS.get(stageKey(prefix));
  const stage = pending && !mutation ? JSON.parse(pending) : { records: [] };
  const page = await env.SESSIONS.list({ prefix, limit: INDEX_PAGE_SIZE, ...(stage.cursor ? { cursor: stage.cursor } : {}) });
  const records = new Map(stage.records.map(record => [prefix === 'label:' ? String(record.seq) : record.slug, record]));
  // Small batches bound memory even when stored transmission bodies are large.
  for (let offset = 0; offset < page.keys.length; offset += 5) {
    const values = await Promise.all(page.keys.slice(offset, offset + 5).map(key => env.SESSIONS.get(key.name)));
    for (const raw of values) {
      let record;
      try { record = publicRecord(prefix, JSON.parse(raw)); } catch { continue; }
      if (record) records.set(prefix === 'label:' ? String(record.seq) : record.slug, record);
    }
  }
  const overlay = target => {
    if (!mutation) return;
    target.delete(mutation.id);
    const record = publicRecord(prefix, mutation.record);
    if (record) target.set(mutation.id, record);
  };
  overlay(records); // KV.list/get may lag a just-completed edit.
  if (page.list_complete) {
    await publish(env, prefix, [...records.values()]);
    if (pending) await env.SESSIONS.delete(stageKey(prefix));
    return { prefix, complete: true };
  }
  if (!page.cursor || page.cursor === stage.cursor) throw new Error('KV list did not advance');
  const nextRecords = [...records.values()];
  serialize(nextRecords); // apply the same memory/storage bound to partial builds
  await env.SESSIONS.put(stageKey(prefix), JSON.stringify({ cursor: page.cursor, records: nextRecords }), { expirationTtl: 86400 });
  if (mutation) {
    const current = await env.SESSIONS.get(indexKey(prefix));
    if (current !== null) {
      const patched = new Map(JSON.parse(current).map(record => [prefix === 'label:' ? String(record.seq) : record.slug, record]));
      overlay(patched);
      await publish(env, prefix, [...patched.values()]);
    }
  }
  return { prefix, complete: false };
}

// Record writes remain successful if a spent quota delays index maintenance.
// The next scheduled rebuild repairs the view from the canonical records.
export async function refreshAfterMutation(env, prefix, id, record) {
  try { await refreshPublicIndex(env, prefix, { id: String(id), record }); }
  catch (error) { console.error('[public index refresh]', prefix, error.message); }
}
