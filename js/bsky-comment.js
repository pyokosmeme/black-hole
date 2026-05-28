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
const API = '/api/bsky';

const COMMENT_TYPE = 'agency.lastnpcalex.comment';
const LIKE_TYPE = 'agency.lastnpcalex.like';

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
 * Post a comment via the DPoP proxy.
 * @param {string} message - Comment text
 * @param {string} post - Post slug
 * @param {string} subjectDid - Site owner DID
 * @returns {{ uri: string, cid: string }}
 */
export async function post(message, post, subjectDid) {
  const rec = {
    $type: COMMENT_TYPE,
    subject: subjectDid,
    post,
    message,
    createdAt: new Date().toISOString(),
  };

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
  const rec = {
    $type: LIKE_TYPE,
    subject: subjectDid,
    targetUri,
    createdAt: new Date().toISOString(),
  };

  const res = await fetch(`${API}/createRecord`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collection: LIKE_TYPE, record: rec }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Like failed');
  }

  return res.json();
}

/**
 * Unlike a comment (delete like record).
 * @param {string} likeUri - AT-URI of the like record
 */
export async function unlike(likeUri) {
  // We don't store like URIs easily. For now, skip.
  // TODO: Track like URIs in localStorage or session.
  throw new Error('Unlike not yet implemented');
}

/**
 * Get comment backlinks from Constellation for a given subject DID.
 * Returns raw backlinks (did, collection, rkey).
 * @param {string} subjectDid - Site owner DID
 * @param {number} limit
 */
export async function getBacklinks(subjectDid, limit = 100) {
  const url = new URL('/xrpc/blue.microcosm.links.getBacklinks', CONSTELLATION);
  url.searchParams.set('subject', subjectDid);
  url.searchParams.set('source', `${COMMENT_TYPE}:subject`);
  url.searchParams.set('limit', String(limit));

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Constellation error: ${res.status}`);
  return (await res.json()).records || [];
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
 * Fetch a record directly from the user's PDS (supports CORS).
 * @param {string} did
 * @param {string} collection
 * @param {string} rkey
 */
export async function fetchRecord(did, collection, rkey) {
  const pds = await discoverPds(did);
  const url = `${pds}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(did)}&collection=${encodeURIComponent(collection)}&rkey=${encodeURIComponent(rkey)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
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
export async function loadComments(post, subjectDid) {
  const backlinks = await getBacklinks(subjectDid);

  const results = await Promise.all(
    backlinks.map(bl => fetchRecord(bl.did, bl.collection, bl.rkey))
  );

  const entries = [];
  for (let i = 0; i < results.length; i++) {
    const rec = results[i];
    if (!rec || rec.value?.$type !== COMMENT_TYPE) continue;
    if (rec.value.post !== post) continue;
    if (typeof rec.value.message !== 'string') continue;
    entries.push({
      author: backlinks[i].did,
      message: rec.value.message,
      createdAt: rec.value.createdAt,
      uri: rec.uri,
    });
  }

  // Fetch handles (parallel, deduplicated)
  const dids = [...new Set(entries.map(e => e.author))];
  const handles = await Promise.all(dids.map(resolveHandle));
  const map = Object.fromEntries(dids.map((d, i) => [d, handles[i]]));

  for (const e of entries) {
    e.authorHandle = map[e.author];
  }

  entries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return entries;
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
