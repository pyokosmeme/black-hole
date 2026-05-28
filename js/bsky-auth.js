/**
 * bs ky-auth.js — ATproto authentication via Cloudflare Pages Functions.
 *
 * Uses the /api/oauth/* endpoints for PKCE + DPoP login flow.
 * Session is stored as HttpOnly cookie (managed server-side).
 *
 * Usage:
 *   import * as Auth from './js/bsky-auth.js';
 *   await Auth.login('handle.bsky.social');  // redirects to PDS
 *   const session = await Auth.getSession(); // checks cookie
 *   Auth.logout();                           // clears cookie
 */

const API = '/api/oauth';

/**
 * Start the login flow. Redirects to PDS authorization.
 * @param {string} handle - e.g. "alice.bsky.social"
 */
export async function login(handle) {
  const res = await fetch(`${API}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handle }),
  });

  if (res.status === 302) {
    // Follow redirect to PDS
    window.location.assign(res.headers.get('location'));
  }

  const err = await res.json();
  throw new Error(err.error || 'Login failed');
}

/**
 * Check if user is logged in (reads session cookie).
 * @returns {{ did: string, handle: string, pds: string } | null}
 */
export async function getSession() {
  const res = await fetch(`${API}/session`);
  if (!res.ok) return null;
  return res.json();
}

/**
 * Clear session cookie.
 */
export async function logout() {
  await fetch(`${API}/logout`, { method: 'POST' });
}
