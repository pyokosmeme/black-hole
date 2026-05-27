/**
 * bs ky-auth.js — ATproto identity for the comment system.
 *
 * Two auth modes:
 *   1. App Password (simpler, works now) — user enters handle + app password
 *   2. OAuth (full flow) — TODO: waiting on stable DPoP support
 *
 * For the comment system, we need to:
 *   a) Read comments (public, no auth) — fetches from Constellation + Slingshot
 *   b) Write comments (authenticated) — writes records to user's PDS
 *
 * Architecture:
 *   - Records: agency.lastnpcalex.comment, agency.lastnpcalex.like
 *   - Index:  constellation.microcosm.blue (backlinks)
 *   - Cache:  slingshot.wisp.place (record fetching)
 *   - IDP:    public.api.bsky.app (handle resolution)
 *
 * @module bs ky-auth
 */

const BSKY_PUBLIC = 'https://public.api.bsky.app';
const SESSION_KEY = 'bsky_auth_session';

/**
 * Resolve an ATproto handle to DID + PDS endpoint.
 * @param {string} handle - e.g. "alice.bsky.social"
 * @returns {{ did: string, pds: string }}
 */
export async function resolveHandle(handle) {
  const url = `${BSKY_PUBLIC}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Handle resolution failed: ${res.status}`);
  const data = await res.json();

  // Get PDS from DID document
  const services = data.didDoc?.services || [];
  const atproto = services.find(s => s.type === 'AtprotoPersistentHandle');
  const pds = atproto?.serviceEndpoint || 'https://bsky.social';

  return { did: data.did, pds };
}

/**
 * Authenticate via app password (simpler than OAuth DPoP).
 * Bluesky app passwords are created in settings > security > app passwords.
 * @param {string} handle
 * @param {string} appPassword
 * @returns {{ did: string, pds: string, auth: string }}
 */
export async function login(handle, appPassword) {
  const { did, pds } = await resolveHandle(handle);

  // Login via PDS
  const url = `${pds}/xrpc/com.atproto.server.createSession`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      identifier: handle,
      password: appPassword,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Login failed: ${err}`);
  }

  const session = await res.json();

  // Store minimal info
  const info = {
    did: session.did,
    handle: session.handle,
    pds: session.pds || pds,
    loggedInAt: new Date().toISOString(),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(info));

  return {
    info,
    authToken: session.accessJwt,
    pds: session.pds || pds,
  };
}

/**
 * Get stored session info.
 * @returns {Object|null}
 */
export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Clear stored session.
 */
export function logout() {
  localStorage.removeItem(SESSION_KEY);
}

/**
 * Make an authenticated XRPC call to the user's PDS.
 * @param {string} method - e.g. 'com.atproto.repo.createRecord'
 * @param {Object} params - Request body
 * @param {string} authToken - JWT from login()
 * @param {string} pds - PDS endpoint
 * @returns {Promise<Object>}
 */
export async function xrpc(method, params, authToken, pds) {
  const res = await fetch(`${pds}/xrpc/${method}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`XRPC ${method} failed (${res.status}): ${err}`);
  }

  return res.json();
}
