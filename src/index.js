/**
 * black-hole — Cloudflare Worker entry point.
 *
 * Serves static assets (SPA + OG stubs) with:
 *   - SPA routing: unknown paths → index.html (with mode=lite for crawlers)
 *   - OG stub pages: /p/<slug> → static stub (for link previews)
 *   - ATproto OAuth metadata: /client-metadata.json
 *   - Custom cache headers per content type
 */

const HTML_EXTENSIONS = new Set(['.html']);
const JSON_CONTENT_TYPES = new Set(['.json']);
const SPA_HTML_FILES = ['index.html', 'ams.html', 'futures.html', 'maps.html', 'test-bsky.html'];

// Cache TTLs (seconds)
const CACHE = {
  html: 0,            // No-cache for HTML (SPA routing)
  stub: 3600,         // OG stubs: 1 hour (mostly crawled, rarely visited directly)
  js: 86400,          // JS: 24 hours (immutable filenames would be ideal)
  css: 86400,         // CSS: 24 hours
  json: 3600,         // JSON: 1 hour
  images: 2592000,    // Images: 30 days
  font: 2592000,      // Fonts: 30 days
};

function getContentType(path) {
  const ext = path.split('.').pop().toLowerCase();

  if (path.endsWith('.html') || path.endsWith('.htm')) return 'text/html; charset=utf-8';
  if (path.endsWith('.css')) return 'text/css; charset=utf-8';
  if (path.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (path.endsWith('.json')) return 'application/json; charset=utf-8';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  if (path.endsWith('.gif')) return 'image/gif';
  if (path.endsWith('.svg')) return 'image/svg+xml; charset=utf-8';
  if (path.endsWith('.webp')) return 'image/webp';
  if (path.endsWith('.woff')) return 'font/woff';
  if (path.endsWith('.woff2')) return 'font/woff2';
  if (path.endsWith('.ttf')) return 'font/ttf';
  if (path.endsWith('.md')) return 'text/markdown; charset=utf-8';

  // Default
  return 'application/octet-stream';
}

function getCacheTTL(path) {
  if (path.startsWith('/p/') && path.endsWith('.html')) return CACHE.stub;
  if (path.endsWith('.js')) return CACHE.js;
  if (path.endsWith('.css')) return CACHE.css;
  if (path.endsWith('.json')) return CACHE.json;
  if (path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.svg') || path.endsWith('.webp')) return CACHE.images;
  if (path.endsWith('.woff') || path.endsWith('.woff2') || path.endsWith('.ttf')) CACHE.font;
  return CACHE.html;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    let pathname = url.pathname;

    // Normalize: strip trailing slash (except root)
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }

    // Handle root redirect
    if (pathname === '/' || pathname === '') {
      pathname = '/index.html';
    }

    // Check if this is a known HTML page — serve directly
    const isKnownPage = SPA_HTML_FILES.includes(pathname.slice(1));

    // Check if this is an OG stub path (/p/slug)
    const isStub = pathname.startsWith('/p/');

    // Try to fetch the asset
    const response = await env.ASSETS.fetch(new Request(
      new URL('https://placeholder' + pathname),
      { headers: { 'Accept-Encoding': 'identity' } }
    ));

    if (response.ok) {
      // Asset exists — serve with proper headers
      const headers = new Headers(response.headers);

      // Set content type if missing
      if (!headers.get('content-type')) {
        headers.set('content-type', getContentType(pathname));
      }

      // Cache control
      const ttl = getCacheTTL(pathname);
      if (ttl > 0) {
        headers.set('cache-control', `public, max-age=${ttl}`);
      } else {
        headers.set('cache-control', 'no-cache, no-store, must-revalidate');
      }

      // Security headers
      headers.set('x-content-type-options', 'nosniff');
      headers.set('x-frame-options', 'DENY');
      headers.set('referrer-policy', 'strict-origin-when-cross-origin');

      // CSP: allow inline scripts (SPA needs them), same-origin resources, CDN fonts
      headers.set('content-security-policy', [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: blob:",
        "connect-src 'self' https://cdn.jsdelivr.net https://public.api.bsky.app https://constellation.microcosm.blue https://slingshot.wisp.place",
        "frame-ancestors 'none'",
      ].join('; '));

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    // Asset not found — SPA fallback for non-api paths
    // But NOT for OG stub paths (those should 404 if the stub doesn't exist)
    if (isStub) {
      return new Response('Stub not found', { status: 404 });
    }

    // SPA fallback: serve index.html
    const spaResponse = await env.ASSETS.fetch(new Request(
      new URL('https://placeholder/index.html'),
      { headers: { 'Accept-Encoding': 'identity' } }
    ));

    if (!spaResponse.ok) {
      return new Response('Site not found', { status: 500 });
    }

    const headers = new Headers(spaResponse.headers);
    headers.set('content-type', 'text/html; charset=utf-8');
    headers.set('cache-control', 'no-cache, no-store, must-revalidate');
    headers.set('x-content-type-options', 'nosniff');
    headers.set('referrer-policy', 'strict-origin-when-cross-origin');

    return new Response(spaResponse.body, {
      status: 200,
      headers,
    });
  },
};
