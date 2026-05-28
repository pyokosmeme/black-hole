import * as login from '../functions/api/oauth/login.js';
import * as callback from '../functions/api/oauth/callback.js';
import * as logout from '../functions/api/oauth/logout.js';
import * as session from '../functions/api/oauth/session.js';
import * as createRecord from '../functions/api/bsky/createRecord.js';
import * as deleteRecord from '../functions/api/bsky/deleteRecord.js';

function ctx(request, env) {
  return { request, env };
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    const c = ctx(request, env);

    if (path === '/api/oauth/login') return login.onRequest(c);
    if (path === '/api/oauth/callback') return callback.onRequest(c);
    if (path === '/api/oauth/logout') return logout.onRequest(c);
    if (path === '/api/oauth/session') return session.onRequest(c);
    if (path === '/api/bsky/createRecord') return createRecord.onRequest(c);
    if (path === '/api/bsky/deleteRecord') return deleteRecord.onRequest(c);

    return env.ASSETS.fetch(request);
  }
};
