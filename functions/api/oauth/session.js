/**
 * GET /api/oauth/session
 * Returns session info if logged in, 401 otherwise.
 */

export async function onRequest(context) {
  const cookie = context.request.headers.get('Cookie') || '';
  const match = cookie.match(/session=([^;]+)/);

  if (!match) {
    return jsonResponse({ error: 'Not authenticated' }, 401);
  }

  const raw = await context.env.SESSIONS.get(`session:${match[1]}`);
  if (!raw) return jsonResponse({ error: 'Session not found' }, 401);

  const session = JSON.parse(raw);

  return jsonResponse({
    did: session.did,
    handle: session.handle,
    pds: session.pds,
    loggedInAt: session.createdAt,
  });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': 'https://lastnpcalex.agency',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Cookie',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}
