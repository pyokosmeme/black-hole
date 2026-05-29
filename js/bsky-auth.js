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
 * @param {string} [returnTo] - full URL (with hash) to return to after auth
 */
export async function login(handle, returnTo) {
  const res = await fetch(`${API}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handle, returnTo }),
  });

  const data = await res.json();
  console.log('[bsky-auth] login response:', res.status, data);
  if (!res.ok) throw new Error(data.error || `Login failed (${res.status})`);
  console.log('[bsky-auth] redirecting to:', data.redirect_url);
  window.location.assign(data.redirect_url);
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
