// Isolated browser fixture: node tests/admin-browser-server.mjs
// Open http://127.0.0.1:8799/admin.html, then run adminTest.run() in the console.
// Serves only editor assets. All API calls are mocked; no live KV access.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const allowed = new Set([
  '/admin.html', '/css/admin.css', '/css/acidburn.css', '/js/admin.js',
  '/js/bsky-auth.js', '/js/prose-brackets.js',
  '/js/vendor/marked-18.0.11.js', '/js/vendor/purify-3.4.15.js', '/js/vendor/turndown-7.2.0.js',
]);
const fixture = await readFile(new URL('./admin-browser-fixture.js', import.meta.url), 'utf8');
createServer(async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  if (!allowed.has(path)) { response.writeHead(404).end(); return; }
  try {
    let body = await readFile(new URL(path.slice(1), root), 'utf8');
    if (path === '/admin.html') {
      if (new URL(request.url, 'http://localhost').searchParams.has('noSanitizer')) body = body.replace(/<script src="\/js\/vendor\/purify[^>]*><\/script>/, '');
      body = body.replace('<head>', `<head><script>${fixture}</script>`);
      body = body.replace(/<link[^>]*https:\/\/fonts\.[^>]*>/g, '');
    }
    const type = path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : 'text/html';
    response.writeHead(200, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-store' }).end(body);
  } catch { response.writeHead(500).end(); }
}).listen(8799, '127.0.0.1', () => console.log('Admin fixture: http://127.0.0.1:8799/admin.html'));
