/**
 * POST /api/oauth/logout
 * Clears session cookie and KV entry.
 */

export async function onRequest(context) {
  const cookie = context.request.headers.get('Cookie') || '';
  const match = cookie.match(/session=([^;]+)/);

  if (match) {
    await context.env.SESSIONS.delete(`session:${match[1]}`);
  }

  const clear = 'session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0';

  return new Response(JSON.stringify({ logged_out: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': clear,
      'Access-Control-Allow-Origin': 'https://lastnpcalex.agency',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Cookie',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}
