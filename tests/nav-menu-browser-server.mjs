// Run: node tests/nav-menu-browser-server.mjs
// Open http://127.0.0.1:8801/__navigation and run await navTest.run().
// Uses current page markup and styles with only navigation/mode scripts enabled.
// No application APIs, background renderers, or production writes are involved.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const tracked = new Set(execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).trim().split('\n'));
const ignores = await readFile(new URL('.assetsignore', root), 'utf8');
assert(ignores.indexOf('!/pagelayout.json') > ignores.indexOf('/*.json'), 'Navigation config must be published');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };
createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  const path = url.pathname;
  response.setHeader('Cache-Control', 'no-store');
  if (path === '/__navigation') {
    response.setHeader('Content-Type', 'text/html');
    response.end('<!doctype html><title>Navigation regression</title><script src="/__navigation.js"></script><p>Run await navTest.run() in the browser console.</p>');
    return;
  }
  if (path === '/__navigation.js') {
    response.setHeader('Content-Type', 'text/javascript');
    response.end(await readFile(new URL('./nav-menu-browser.js', import.meta.url)));
    return;
  }
  if (path.startsWith('/__config/')) {
    const scenario = path.split('/').pop();
    if (scenario === 'pending') { request.on('close', () => response.end()); return; }
    if (scenario === '404') { response.writeHead(404).end('Not found'); return; }
    if (scenario === 'html') { response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><h1>SPA fallback</h1>'); return; }
    response.setHeader('Content-Type', 'application/json');
    response.end(scenario === 'empty' ? '{"pages":[]}' : '{}');
    return;
  }
  const file = path === '/' ? 'index.html' : path.slice(1);
  const ext = file.slice(file.lastIndexOf('.'));
  if (!tracked.has(file) || !types[ext] || /^(?:tests\/|attached_files\/|_|wrangler\.|package|worker-|labeler\.|public-index\.|transmission-document\.)/.test(file)) {
    response.writeHead(404).end(); return;
  }
  try {
    let body = await readFile(new URL(file, root));
    if (ext === '.html') {
      body = body.toString();
      if (!url.searchParams.has('full')) body = body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, tag =>
        /src=["'][^"']*(?:nav-menu\.js|acidburn-mode\.js)["']/.test(tag) ? tag : '');
      const scenario = url.searchParams.get('config');
      body = body.replace('<head>', `<head><script>localStorage.setItem('acidburn-mode','dark');${scenario ? `window.NAV_CONFIG_PATH=${JSON.stringify('/__config/' + scenario)};` : ''}</script>`);
    }
    response.setHeader('Content-Type', types[ext] + '; charset=utf-8');
    response.end(body);
  } catch { response.writeHead(404).end(); }
}).listen(8801, '127.0.0.1', () => console.log('Navigation fixture: http://127.0.0.1:8801/__navigation'));
