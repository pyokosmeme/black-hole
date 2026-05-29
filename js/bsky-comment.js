/**
 * bs ky-comment.js — Comment operations via Constellation backlinks.
 *
 * Record types:
 *   agency.lastnpcalex.comment — comment on a transmission
 *   agency.lastnpcalex.like   — like on a comment
 *
 * Read operations (no auth):
 *   — Constellation backlinks (public API)
 *   — PDS record fetching (CORS-enabled)
 *   — Handle resolution (Bluesky AppView)
 *
 * Write operations (authenticated):
 *   — /api/bsky/createRecord (DPoP-signed via Pages Function)
 *   — /api/bsky/deleteRecord (DPoP-signed via Pages Function)
 *
 * @module bs ky-comment
 */

const CONSTELLATION = 'https://constellation.microcosm.blue';
const BSKY_PUBLIC = 'https://public.api.bsky.app';
const BSKY_SOCIAL = 'https://bsky.social';
const API = '/api/bsky';

const COMMENT_TYPE = 'agency.lastnpcalex.comment';
const LIKE_TYPE = 'agency.lastnpcalex.like';
const HIDE_TYPE = 'agency.lastnpcalex.hide';
const TRANSMISSION_TYPE = 'agency.lastnpcalex.transmission';

/**
 * Mint a synthetic AT-URI for a transmission, anchored to the author's DID.
 * No actual record is published — Constellation indexes the URI as a subject.
 */
export function transmissionUri(authorDid, slug) {
  return `at://${authorDid}/${TRANSMISSION_TYPE}/${slug}`;
}

// PDS endpoint cache — avoids repeated DNS lookups
const pdsCache = new Map();

/**
 * Discover a DID's PDS endpoint from the PLC directory.
 * @param {string} did
 * @returns {string} PDS URL
 */
async function discoverPds(did) {
  if (pdsCache.has(did)) return pdsCache.get(did);

  try {
    let doc = null;

    if (did.startsWith('did:plc:')) {
      const res = await fetch(`https://plc.directory/${did.replace('did:plc:', '')}`);
      if (res.ok) doc = await res.json();
    } else if (did.startsWith('did:web:')) {
      const host = did.replace('did:web:', '');
      const res = await fetch(`https://${host}/.well-known/did.json`);
      if (res.ok) doc = await res.json();
    }

    if (doc) {
      const atp = (doc.service || []).find(
        s => s.id === '#atproto_pds' || s.type === 'AtprotoPersistentHandle'
      );
      if (atp?.serviceEndpoint) {
        pdsCache.set(did, atp.serviceEndpoint);
        return atp.serviceEndpoint;
      }
    }

    const pds = 'https://bsky.social';
    pdsCache.set(did, pds);
    return pds;
  } catch {
    const pds = 'https://bsky.social';
    pdsCache.set(did, pds);
    return pds;
  }
}

/**
 * Query the appview for all records in a collection for a given repo.
 * Paginates through all cursors.
 */
async function listRecords(repo, collection, limit = 100) {
  const results = [];
  let cursor = undefined;
  do {
    const url = new URL(`${BSKY_PUBLIC}/xrpc/com.atproto.repo.listRecords`);
    url.searchParams.set('repo', repo);
    url.searchParams.set('collection', collection);
    url.searchParams.set('limit', String(limit));
    if (cursor) url.searchParams.set('cursor', cursor);
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`listRecords failed: ${res.status}`);
    const data = await res.json();
    results.push(...(data.records || []));
    cursor = data.cursor;
  } while (cursor);
  return results;
}

/**
 * Post a comment via the DPoP proxy.
 * @param {string} message
 * @param {string} subjectUri - synthetic transmission AT-URI
 * @param {string} [replyTo] - AT-URI of parent comment (for threading)
 * @returns {{ uri: string, cid: string }}
 */
export async function post(message, subjectUri, replyTo) {
  const rec = {
    $type: COMMENT_TYPE,
    subject: subjectUri,
    message,
    createdAt: new Date().toISOString(),
  };
  if (replyTo) rec.replyTo = replyTo;
  const res = await fetch(`${API}/createRecord`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collection: COMMENT_TYPE, record: rec }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Post failed');
  }
  return res.json();
}

export async function hide(commentUri) {
  const rec = {
    $type: HIDE_TYPE,
    target: commentUri,
    createdAt: new Date().toISOString(),
  };
  const res = await fetch(`${API}/createRecord`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collection: HIDE_TYPE, record: rec }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Hide failed');
  return res.json();
}

export async function unhide(hideUri) {
  const res = await fetch(`${API}/deleteRecord`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uri: hideUri }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Unhide failed');
  return res.json();
}

/**
 * Delete a comment via the DPoP proxy.
 * @param {string} uri - AT-URI of the comment
 */
export async function remove(uri) {
  const res = await fetch(`${API}/deleteRecord`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uri }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Delete failed');
  }

  return res.json();
}

/**
 * Like a comment via the DPoP proxy.
 * @param {string} targetUri - AT-URI of the comment
 * @param {string} subjectDid - Site owner DID
 * @returns {{ uri: string, cid: string }}
 */
export async function like(targetUri, subjectDid) {
  const rkey = targetUri.split('/').pop() || targetUri.slice(-16);
  const rec = {
    $type: LIKE_TYPE,
    subject: subjectDid,
    targetUri,
    createdAt: new Date().toISOString(),
  };

  const res = await fetch(`${API}/createRecord`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collection: LIKE_TYPE, rkey, record: rec }),
  });

  if (!res.ok) {
    const err = await res.json();
    // Duplicate like is a no-op — treat as already liked
    if (res.status === 400 && (err.error?.includes('conflict') || err.error?.includes('already'))) {
      return { uri: '' };
    }
    throw new Error(err.error || 'Like failed');
  }

  return res.json();
}

/**
 * Unlike a comment (delete like record).
 * @param {string} likeUri - AT-URI of the like record
 */
export async function unlike(likeUri) {
  const res = await fetch(`${API}/deleteRecord`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uri: likeUri }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Unlike failed');
  return res.json();
}

/**
 * Load all like records for the admin. Returns Map<targetUri, likeUri>.
 */
export async function loadAllLikes(did) {
  const allRecords = [];
  let cursor = undefined;
  do {
    const url = new URL(`${BSKY_SOCIAL}/xrpc/com.atproto.repo.listRecords`);
    url.searchParams.set('repo', did);
    url.searchParams.set('collection', LIKE_TYPE);
    url.searchParams.set('limit', '100');
    if (cursor) url.searchParams.set('cursor', cursor);
    const res = await fetch(url.toString());
    if (!res.ok) break;
    const data = await res.json();
    const records = data.records || [];
    allRecords.push(...records);
    cursor = data.cursor;
  } while (cursor);
  const map = new Map();
  for (const r of allRecords) {
    if (r.value?.targetUri) map.set(r.value.targetUri, r.uri);
  }
  return map;
}

/**
 * Get comment backlinks from Constellation for a given subject DID.
 * Returns raw backlinks (did, collection, rkey).
 * @param {string} subjectDid - Site owner DID
 * @param {number} limit
 */
export async function getBacklinks(subjectUri, limit = 100) {
  const allRecords = [];
  let cursor = undefined;
  do {
    const url = new URL('/xrpc/blue.microcosm.links.getBacklinks', CONSTELLATION);
    url.searchParams.set('subject', subjectUri);
    url.searchParams.set('source', `${COMMENT_TYPE}:subject`);
    url.searchParams.set('limit', String(limit));
    if (cursor) url.searchParams.set('cursor', cursor);

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Constellation error: ${res.status}`);
    const data = await res.json();
    const records = data.records || [];
    allRecords.push(...records);
    cursor = data.cursor;
  } while (cursor);
  return allRecords;
}

/**
 * Get like backlinks from Constellation.
 * @param {string} subjectDid
 * @param {number} limit
 */
export async function getLikeBacklinks(subjectDid, limit = 500) {
  const url = new URL('/xrpc/blue.microcosm.links.getBacklinks', CONSTELLATION);
  url.searchParams.set('subject', subjectDid);
  url.searchParams.set('source', `${LIKE_TYPE}:subject`);
  url.searchParams.set('limit', String(limit));

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Constellation error: ${res.status}`);
  return (await res.json()).records || [];
}

/**
 * Fetch a single record via the appview (no PLC directory needed).
 * Uses bsky.social listRecords with rkey filter.
 * @param {string} did
 * @param {string} collection
 * @param {string} rkey
 */
export async function fetchRecord(did, collection, rkey) {
  const url = new URL(`${BSKY_SOCIAL}/xrpc/com.atproto.repo.listRecords`);
  url.searchParams.set('repo', did);
  url.searchParams.set('collection', collection);
  const res = await fetch(url.toString());
  if (!res.ok) return null;
  const data = await res.json();
  const records = data.records || [];
  const found = records.find(r => r.uri.endsWith(rkey));
  return found || null;
}

/**
 * Resolve DID to handle.
 * @param {string} did
 */
export async function resolveHandle(did) {
  try {
    const res = await fetch(`${BSKY_PUBLIC}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`);
    if (!res.ok) return undefined;
    return (await res.json()).handle;
  } catch {
    return undefined;
  }
}

/**
 * Load all comments for a post.
 * @param {string} post - Post slug (e.g. "neam")
 * @param {string} subjectDid - Site owner DID
 */
export async function loadComments(subjectUri) {
  console.log('[comments] loadComments subjectUri:', subjectUri);
  const backlinks = await getBacklinks(subjectUri);
  console.log('[comments] got', backlinks.length, 'backlinks');

  // Fetch all records per DID once, then match to backlinks
  const dids = [...new Set(backlinks.map(b => b.did))];
  const allRecords = await Promise.all(
    dids.map(did => {
      const url = new URL(`${BSKY_SOCIAL}/xrpc/com.atproto.repo.listRecords`);
      url.searchParams.set('repo', did);
      url.searchParams.set('collection', COMMENT_TYPE);
      return fetch(url).then(async r => {
        if (!r.ok) return [];
        const data = await r.json();
        return data.records || [];
      });
    })
  );

  // Build a flat lookup: rkey -> record
  const byRkey = new Map();
  for (const records of allRecords) {
    for (const rec of records) {
      byRkey.set(rec.rkey || rec.uri.split('/').pop(), rec);
    }
  }

  console.log('[comments] fetched', byRkey.size, 'total records');

  const entries = [];
  for (let i = 0; i < backlinks.length; i++) {
    const bl = backlinks[i];
    const rec = byRkey.get(bl.rkey);
    if (!rec) {
      console.log('[comments] no record for rkey', bl.rkey);
      continue;
    }
    if (rec.value?.$type !== COMMENT_TYPE) continue;
    if (rec.value.subject !== subjectUri) continue;
    if (typeof rec.value.message !== 'string') continue;
    entries.push({
      author: bl.did,
      message: rec.value.message,
      createdAt: rec.value.createdAt,
      uri: rec.uri,
      replyTo: rec.value.replyTo || null,
    });
  }

  const handleDids = [...new Set(entries.map(e => e.author))];
  const handles = await Promise.all(handleDids.map(resolveHandle));
  const map = Object.fromEntries(handleDids.map((d, i) => [d, handles[i]]));

  for (const e of entries) {
    e.authorHandle = map[e.author];
  }

  entries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  console.log('[comments] returning', entries.length, 'entries');
  return entries;
}

/**
 * Fetch all hide records. Returns Map<commentUri, hideUri>.
 * Uses appview listRecords — no PLC directory needed.
 */
export async function loadHides(adminDid) {
  const url = new URL(`${BSKY_SOCIAL}/xrpc/com.atproto.repo.listRecords`);
  url.searchParams.set('repo', adminDid);
  url.searchParams.set('collection', HIDE_TYPE);
  url.searchParams.set('limit', '100');
  const res = await fetch(url.toString());
  if (!res.ok) return new Map();
  const { records = [] } = await res.json();
  const map = new Map();
  for (const r of records) {
    if (r.value?.target) map.set(r.value.target, r.uri);
  }
  return map;
}

/**
 * Load like counts for a list of comment URIs.
 * @param {string[]} commentUris
 * @param {string} subjectDid
 */
export async function loadLikes(commentUris, subjectDid) {
  const likeBacklinks = await getLikeBacklinks(subjectDid);

  const results = await Promise.all(
    likeBacklinks.map(bl => fetchRecord(bl.did, bl.collection, bl.rkey))
  );

  const counts = new Map();
  const byUser = new Map();

  for (const rec of results) {
    if (!rec || rec.value?.$type !== LIKE_TYPE) continue;
    const target = rec.value.targetUri;
    if (!commentUris.includes(target)) continue;

    const userDid = rec.uri.replace('at://', '').split('/')[0];
    counts.set(target, (counts.get(target) || 0) + 1);

    if (!byUser.has(userDid)) byUser.set(userDid, new Set());
    byUser.get(userDid).add(target);
  }

  return { counts, byUser };
}
