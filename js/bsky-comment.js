/**
 * bs ky-comment.js — Comment operations via Constellation backlinks.
 *
 * Record types:
 *   agency.lastnpcalex.comment — comment on a transmission
 *   agency.lastnpcalex.like   — like on a comment
 *
 * Indexing: constellation.microcosm.blue (backlink index)
 * Fetching: user's own PDS (discovered via DID document)
 *
 * @module bs ky-comment
 */

import { xrpc } from './bsky-auth.js';

const CONSTELLATION = 'https://constellation.microcosm.blue';
const BSKY_PUBLIC = 'https://public.api.bsky.app';

// PDS endpoint cache — avoids repeated DNS lookups
const pdsCache = new Map();

/**
 * Discover a DID's PDS endpoint from the Bluesky AppView.
 * @param {string} did
 * @returns {string} PDS URL
 */
async function discoverPds(did) {
  if (pdsCache.has(did)) return pdsCache.get(did);

  // Fetch DID document to find PDS endpoint
  try {
    let doc = null;

    // did:plc → PLC directory
    if (did.startsWith('did:plc:')) {
      const res = await fetch(`https://plc.directory/${did.replace('did:plc:', '')}`);
      if (res.ok) doc = await res.json();
    }
    // did:web → fetch .well-known/did.json
    else if (did.startsWith('did:web:')) {
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

    // Fallback: most users are on bsky.social
    const pds = 'https://bsky.social';
    pdsCache.set(did, pds);
    return pds;
  } catch {
    const pds = 'https://bsky.social';
    pdsCache.set(did, pds);
    return pds;
  }
}

const COMMENT_TYPE = 'agency.lastnpcalex.comment';
const LIKE_TYPE = 'agency.lastnpcalex.like';

/**
 * Post a comment to the user's PDS.
 * @param {string} authToken - JWT from Auth.login()
 * @param {string} pds - User's PDS endpoint
 * @param {string} did - User's DID
 * @param {string} message - Comment text
 * @param {string} post - Post slug
 * @param {string} subjectDid - Site owner DID
 * @returns {{ uri: string, cid: string }}
 */
export async function post(authToken, pds, did, message, post, subjectDid) {
  const rec = {
    $type: COMMENT_TYPE,
    subject: subjectDid,
    post,
    message,
    createdAt: new Date().toISOString(),
  };

  const resp = await xrpc('com.atproto.repo.createRecord', {
    repo: did,
    collection: COMMENT_TYPE,
    record: rec,
  }, authToken, pds);

  return { uri: resp.uri, cid: resp.cid };
}

/**
 * Delete a comment.
 * @param {string} authToken
 * @param {string} pds
 * @param {string} uri - AT-URI of the comment
 */
export async function remove(authToken, pds, uri) {
  const [, repo, collection, rkey] = uri.replace('at://', '').split('/');
  await xrpc('com.atproto.repo.deleteRecord', {
    repo, collection, rkey,
  }, authToken, pds);
}

/**
 * Like a comment.
 * @param {string} authToken
 * @param {string} pds
 * @param {string} did - User's DID
 * @param {string} targetUri - AT-URI of the comment
 * @param {string} subjectDid - Site owner DID
 */
export async function like(authToken, pds, did, targetUri, subjectDid) {
  const rec = {
    $type: LIKE_TYPE,
    subject: subjectDid,
    targetUri,
    createdAt: new Date().toISOString(),
  };

  await xrpc('com.atproto.repo.createRecord', {
    repo: did,
    collection: LIKE_TYPE,
    record: rec,
  }, authToken, pds);
}

/**
 * Unlike a comment (delete like record).
 * @param {string} authToken
 * @param {string} pds
 * @param {string} likeUri - AT-URI of the like record
 */
export async function unlike(authToken, pds, likeUri) {
  const [, repo, collection, rkey] = likeUri.replace('at://', '').split('/');
  await xrpc('com.atproto.repo.deleteRecord', {
    repo, collection, rkey,
  }, authToken, pds);
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
 * Discovers PDS endpoint from the DID's document.
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
 * Fetches backlinks from Constellation, records from Slingshot, handles from AppView.
 * @param {string} post - Post slug (e.g. "neam")
 * @param {string} subjectDid - Site owner DID
 */
export async function loadComments(post, subjectDid) {
  const backlinks = await getBacklinks(subjectDid);

  // Fetch all records in parallel
  const results = await Promise.all(
    backlinks.map(bl => fetchRecord(bl.did, bl.collection, bl.rkey))
  );

  // Filter to matching post + valid structure
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

  // Sort by date descending
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

  // Count likes per target URI, also track which user liked what
  const counts = new Map();
  const byUser = new Map(); // did -> Set<targetUri>

  for (const rec of results) {
    if (!rec || rec.value?.$type !== LIKE_TYPE) continue;
    const target = rec.value.targetUri;
    if (!commentUris.includes(target)) continue;

    // Extract user DID from record URI
    const userDid = rec.uri.replace('at://', '').split('/')[0];
    counts.set(target, (counts.get(target) || 0) + 1);

    if (!byUser.has(userDid)) byUser.set(userDid, new Set());
    byUser.get(userDid).add(target);
  }

  return { counts, byUser };
}
