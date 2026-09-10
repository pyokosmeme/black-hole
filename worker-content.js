import { renderDocument } from './transmission-document.js';

const DEFAULT_ADMIN_DIDS = 'did:plc:ccxl3ictrlvtrrgh5swvvg47,did:plc:drrstoxu4to57dhv453ziznq';
const SITE_ORIGIN = 'https://lastnpcalex.agency';
const ALLOWED_TOPICS = new Set(['blog', 'books', 'fiction']);
const ALLOWED_STATUSES = new Set(['draft', 'published']);

const SECTIONS = {
  author: {
    label: 'Main page transmissions',
    indexPath: '/author/content/posts.md',
    contentBase: '/author/',
    landingPage: '/',
    stubBase: '/p',
    topic: 'blog',
  },
  ams: {
    label: 'A Mote in Shadow transmissions',
    indexPath: '/ams/content/posts.md',
    contentBase: '/ams/',
    landingPage: '/ams.html',
    stubBase: '/p/ams',
    topic: 'books',
  },
  futures: {
    label: 'Speculative futures transmissions',
    indexPath: '/futures/content/posts.md',
    contentBase: '/futures/',
    landingPage: '/futures.html',
    stubBase: '/p/futures',
    topic: 'fiction',
  },
  maps: {
    label: 'Possible territories transmissions',
    indexPath: '/maps/content/posts.md',
    contentBase: '/maps/',
    landingPage: '/maps.html',
    stubBase: '/p/maps',
    topic: null,
  },
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

function text(body, status = 200, contentType = 'text/plain; charset=utf-8', extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function isJsonRequest(request) {
  return (request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json');
}

function sameOriginRequest(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  const requestOrigin = new URL(request.url).origin;
  return origin === requestOrigin || origin === SITE_ORIGIN;
}

async function readJson(request, maxBytes = 600_000) {
  if (!isJsonRequest(request)) throw new HttpError(415, 'Content-Type must be application/json');
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > maxBytes) throw new HttpError(413, 'Request is too large');
  const raw = await request.text();
  if (raw.length > maxBytes) throw new HttpError(413, 'Request is too large');
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, 'Malformed JSON');
  }
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function sessionIdFromRequest(request) {
  const match = (request.headers.get('Cookie') || '').match(/(?:^|;\s*)session=([^;]+)/);
  return match ? match[1] : null;
}

async function getSession(request, env) {
  const sessionId = sessionIdFromRequest(request);
  if (!sessionId) return null;
  const raw = await env.SESSIONS.get(`session:${sessionId}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function configuredAdminDids(env) {
  return new Set(
    String(env.ADMIN_DIDS || DEFAULT_ADMIN_DIDS)
      .split(',')
      .map(value => value.trim())
      .filter(Boolean)
  );
}

async function getAdmin(request, env) {
  const session = await getSession(request, env);
  if (!session) throw new HttpError(401, 'Sign in required');
  if (!configuredAdminDids(env).has(session.did)) {
    throw new HttpError(403, 'This ATProto account is not an administrator');
  }
  return session;
}

async function listKvValues(namespace, prefix) {
  const values = [];
  let cursor;
  do {
    const page = await namespace.list({ prefix, limit: 1000, ...(cursor ? { cursor } : {}) });
    const records = await Promise.all(page.keys.map(item => namespace.get(item.name)));
    records.forEach(raw => {
      if (!raw) return;
      try {
        values.push(JSON.parse(raw));
      } catch {
        // Ignore malformed records instead of breaking the public site.
      }
    });
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return values;
}

function parsePostsMarkdown(markdown) {
  const normalized = String(markdown || '')
    .replace(/\r\n/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '');
  return normalized.split(/^## /m).slice(1).map(section => {
    const lines = section.trim().split('\n');
    const post = { slug: lines[0].trim(), tags: [] };
    const excerpt = [];
    let inMeta = true;
    for (const line of lines.slice(1)) {
      const match = inMeta && line.match(/^\s*-\s*(\w+):\s*(.+)$/);
      if (match) {
        if (match[1] === 'tags') {
          post.tags = match[2].split(',').map(tag => tag.trim()).filter(Boolean);
        } else {
          post[match[1]] = match[2].trim();
        }
      } else if (line.trim()) {
        inMeta = false;
        excerpt.push(line.trim());
      }
    }
    post.excerpt = excerpt.join(' ');
    return post;
  }).filter(post => post.slug);
}

async function assetText(request, env, pathname) {
  const url = new URL(request.url);
  url.pathname = pathname;
  url.search = '';
  const response = await env.ASSETS.fetch(new Request(url.toString(), { method: 'GET' }));
  if (!response.ok) return null;
  return response.text();
}

async function repositoryPosts(request, env, section) {
  const config = SECTIONS[section];
  if (!config) return [];
  const index = await assetText(request, env, config.indexPath);
  if (!index) return [];
  return parsePostsMarkdown(index).map(post => ({
    ...post,
    section,
    status: 'published',
    source: 'repository',
    bodyPath: post.file
      ? `${config.contentBase}${post.file}`.replace(/\/{2,}/g, '/')
      : null,
  }));
}

async function repositoryPostWithBody(request, env, section, slug) {
  const post = (await repositoryPosts(request, env, section)).find(item => item.slug === slug);
  if (!post || !post.bodyPath) return null;
  const markdown = await assetText(request, env, post.bodyPath);
  return markdown == null ? null : { ...post, markdown };
}

function publicMetadata(record) {
  return {
    section: record.section,
    slug: record.slug,
    title: record.title,
    date: record.date,
    tags: record.tags || [],
    excerpt: record.excerpt || '',
    file: `/api/transmissions/${record.section}/${record.slug}`,
    source: 'admin',
  };
}

async function managedPosts(env, section, includeDrafts = false) {
  const records = await listKvValues(env.SESSIONS, `transmission:${section}:`);
  return records
    .filter(record => includeDrafts || record.status === 'published')
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

async function resolvedPost(request, env, section, slug, includeDrafts = false) {
  const managedRaw = await env.SESSIONS.get(`transmission:${section}:${slug}`);
  if (managedRaw) {
    try {
      const managed = JSON.parse(managedRaw);
      if (includeDrafts || managed.status === 'published') return { ...managed, source: 'admin' };
    } catch {
      // Fall through to the repository version.
    }
  }
  return repositoryPostWithBody(request, env, section, slug);
}

function normalizeTransmission(input, previous) {
  const section = String(input.section || '').trim();
  const slug = String(input.slug || '').trim().toLowerCase();
  const title = String(input.title || '').trim();
  const date = String(input.date || '').trim();
  const excerpt = String(input.excerpt || '').trim();
  const markdown = String(input.markdown || '').trim();
  const status = String(input.status || 'draft').trim();
  const tags = Array.isArray(input.tags)
    ? input.tags.map(tag => String(tag).trim().toLowerCase()).filter(Boolean)
    : String(input.tags || '').split(',').map(tag => tag.trim().toLowerCase()).filter(Boolean);

  if (!SECTIONS[section]) throw new HttpError(400, 'Unknown transmission section');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new HttpError(400, 'Slug must contain lowercase letters, numbers, and single hyphens');
  }
  if (!title || title.length > 240) throw new HttpError(400, 'Title is required and must be under 240 characters');
  if (!/^\d{4}\.\d{2}\.\d{2}$/.test(date)) throw new HttpError(400, 'Date must use YYYY.MM.DD');
  if (!markdown || markdown.length > 500_000) throw new HttpError(400, 'Markdown is required and must be under 500 KB');
  if (excerpt.length > 1_000) throw new HttpError(400, 'Excerpt must be under 1,000 characters');
  if (!ALLOWED_STATUSES.has(status)) throw new HttpError(400, 'Status must be draft or published');
  if (tags.length > 20 || tags.some(tag => tag.length > 60)) throw new HttpError(400, 'Too many tags or tag is too long');

  const now = new Date().toISOString();
  return {
    section,
    slug,
    title,
    date,
    tags: [...new Set(tags)],
    excerpt,
    markdown,
    status,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
    publishedAt: status === 'published' ? (previous?.publishedAt || now) : null,
  };
}

function parseSharePath(pathname) {
  const match = pathname.match(/^\/p(?:\/(ams|futures|maps))?\/([a-z0-9]+(?:-[a-z0-9]+)*)(\.md)?$/);
  if (!match) return null;
  return { section: match[1] || 'author', slug: match[2], markdown: Boolean(match[3]) };
}

function markdownDocument(post) {
  const config = SECTIONS[post.section];
  const canonical = `${SITE_ORIGIN}${config.stubBase}/${post.slug}`;
  const metadata = [
    '---',
    `title: ${JSON.stringify(post.title || post.slug)}`,
    `date: ${post.date || ''}`,
    `tags: ${(post.tags || []).join(', ')}`,
    `canonical: ${canonical}`,
    '---',
    '',
  ].join('\n');
  return metadata + '\n' + renderDocument(post.markdown, `${SITE_ORIGIN}${config.landingPage}`).markdown;
}

function shareHtml(post) {
  const config = SECTIONS[post.section];
  const canonical = `${SITE_ORIGIN}${config.stubBase}/${post.slug}`;
  const markdownUrl = `${canonical}.md`;
  const interactive = `${config.landingPage}#post/${post.slug}`;
  const title = post.title || post.slug;
  const description = post.excerpt || '';
  const document = renderDocument(post.markdown, `${SITE_ORIGIN}${config.landingPage}`);
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: title,
    datePublished: String(post.date || '').replace(/\./g, '-'),
    keywords: post.tags || [],
    description,
    url: canonical,
    author: { '@type': 'Person', name: 'A.N. Alex', url: SITE_ORIGIN },
    articleBody: document.text,
  }).replace(/<\//g, '<\\/');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} // lastnpcalex.agency</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="index,follow">
<meta property="og:type" content="article">
<meta property="og:site_name" content="lastnpcalex.agency">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${SITE_ORIGIN}/img/banner.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${canonical}">
<link rel="alternate" type="text/markdown" href="${markdownUrl}" title="Markdown source">
<script type="application/ld+json">${jsonLd}</script>
<script>window.location.replace(${JSON.stringify(interactive)});</script>
<style>body{max-width:78ch;margin:3rem auto;padding:0 1.25rem;background:#0a0a1a;color:#d9faff;font:16px/1.65 ui-monospace,SFMono-Regular,Consolas,monospace}h1,a{color:#66ffff}.meta{color:#c78aff}.excerpt{border-left:3px solid #bf00ff;padding-left:1rem}.article-body pre,.math-inline{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}.article-body img{max-width:100%}</style>
</head>
<body>
<article id="transmission-document">
<header><h1>${escapeHtml(title)}</h1><p class="meta">${escapeHtml(post.date || '')} ;; ${(post.tags || []).map(tag => `#${escapeHtml(tag)}`).join(' ')}</p></header>
${description ? `<p class="excerpt">${escapeHtml(description)}</p>` : ''}
<div class="article-body">${document.html}</div>
<p><a href="${interactive}">Open the interactive transmission</a> · <a href="${markdownUrl}">Markdown source</a></p>
</article>
</body>
</html>`;
}

async function handleShare(request, env, match) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return text('Method not allowed', 405);
  const post = await resolvedPost(request, env, match.section, match.slug);
  if (!post) return text('Transmission not found', 404);
  const wantsMarkdown = match.markdown || (request.headers.get('Accept') || '').includes('text/markdown');
  if (wantsMarkdown) {
    return text(request.method === 'HEAD' ? null : markdownDocument(post), 200, 'text/markdown; charset=utf-8', {
      Link: `<${SITE_ORIGIN}${SECTIONS[post.section].stubBase}/${post.slug}>; rel="canonical"`,
    });
  }
  return text(request.method === 'HEAD' ? null : shareHtml(post), 200, 'text/html; charset=utf-8', {
    Link: `<${SITE_ORIGIN}${SECTIONS[post.section].stubBase}/${post.slug}.md>; rel="alternate"; type="text/markdown"`,
  });
}

async function handleLlmsTxt(request, env) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return text('Method not allowed', 405);
  const blocks = ['# lastnpcalex.agency', '', '> Hard SF, speculative fiction, book updates, and maps by A.N. Alex.', '', 'Every transmission link below returns a complete semantic HTML document. Append `.md` or request `Accept: text/markdown` for Markdown.', ''];
  for (const [section, config] of Object.entries(SECTIONS)) {
    const repository = await repositoryPosts(request, env, section);
    const managed = await managedPosts(env, section);
    const merged = new Map(repository.map(post => [post.slug, post]));
    managed.forEach(post => merged.set(post.slug, post));
    const posts = [...merged.values()].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    if (!posts.length) continue;
    blocks.push(`## ${config.label}`, '');
    posts.forEach(post => {
      const href = `${SITE_ORIGIN}${config.stubBase}/${post.slug}`;
      blocks.push(`- [${post.title || post.slug}](${href}) — ${post.excerpt || ''} ([Markdown](${href}.md))`);
    });
    blocks.push('');
  }
  const body = blocks.join('\n').trim() + '\n';
  return text(request.method === 'HEAD' ? null : body, 200, 'text/plain; charset=utf-8');
}

async function handlePublicTransmissions(request, env, pathname) {
  if (pathname === '/api/transmissions' && request.method === 'GET') {
    const section = new URL(request.url).searchParams.get('section') || 'author';
    if (!SECTIONS[section]) return json({ error: 'Unknown transmission section' }, 400);
    const posts = (await managedPosts(env, section)).map(publicMetadata);
    return json({ posts });
  }

  const match = pathname.match(/^\/api\/transmissions\/(author|ams|futures|maps)\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
  if (match && request.method === 'GET') {
    const post = await resolvedPost(request, env, match[1], match[2]);
    if (!post) return text('Transmission not found', 404);
    return text(post.markdown, 200, 'text/markdown; charset=utf-8');
  }
  return null;
}

function validEmail(value) {
  if (typeof value !== 'string' || value.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function handleSubscribe(request, env) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, { Allow: 'POST' });
  if (!sameOriginRequest(request)) return json({ error: 'Origin not allowed' }, 403);
  const input = await readJson(request, 20_000);
  if (input.website) return json({ ok: true, message: 'Subscription preferences saved.' });

  const email = String(input.email || '').trim().toLowerCase();
  const topics = Array.isArray(input.topics)
    ? [...new Set(input.topics.map(value => String(value).trim()).filter(value => ALLOWED_TOPICS.has(value)))]
    : [];
  if (!validEmail(email)) throw new HttpError(400, 'Enter a valid email address');
  if (!topics.length) throw new HttpError(400, 'Choose at least one update type');

  const id = await sha256(email);
  const key = `subscriber:${id}`;
  const existingRaw = await env.SESSIONS.get(key);
  let existing = null;
  try { existing = existingRaw ? JSON.parse(existingRaw) : null; } catch { existing = null; }

  if (existing?.status === 'active') {
    existing.topics = topics;
    existing.source = String(input.source || existing.source || '').slice(0, 100);
    existing.updatedAt = new Date().toISOString();
    await env.SESSIONS.put(key, JSON.stringify(existing));
    return json({ ok: true, message: 'Subscription preferences saved.' });
  }

  const now = new Date().toISOString();
  const unsubscribeToken = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');
  const subscriber = {
    id,
    email,
    topics,
    status: 'active',
    source: String(input.source || '').slice(0, 100),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    unsubscribeToken,
  };
  await Promise.all([
    env.SESSIONS.put(key, JSON.stringify(subscriber)),
    env.SESSIONS.put(`unsubscribe:${unsubscribeToken}`, id),
  ]);
  return json({ ok: true, message: 'You are on the transmission list.' }, 201);
}

async function handleUnsubscribe(request, env) {
  if (request.method !== 'GET' && request.method !== 'POST') return text('Method not allowed', 405);
  const token = new URL(request.url).searchParams.get('token') || '';
  if (!/^[0-9a-f-]{60,80}$/i.test(token)) return text('Invalid unsubscribe link.', 400);
  const id = await env.SESSIONS.get(`unsubscribe:${token}`);
  if (!id) return text('This unsubscribe link is invalid or has already been used.', 404);

  if (request.method === 'GET') {
    return text(`<!doctype html><meta charset="utf-8"><title>Close signal</title><style>body{background:#090914;color:#bff;font:18px/1.6 monospace;max-width:42rem;margin:5rem auto;padding:1rem}button,a{color:#0ff}button{padding:.7rem 1rem;border:1px solid #bf00ff;background:#15051f;font:inherit;cursor:pointer}</style><h1>Close this signal?</h1><p>This will remove the address attached to this private link from transmission emails.</p><form method="post" action="/api/subscriptions/unsubscribe?token=${encodeURIComponent(token)}"><button type="submit">UNSUBSCRIBE</button></form><p><a href="/">Keep subscription and return</a></p>`, 200, 'text/html; charset=utf-8');
  }

  const raw = await env.SESSIONS.get(`subscriber:${id}`);
  if (raw) {
    const subscriber = JSON.parse(raw);
    subscriber.status = 'unsubscribed';
    subscriber.updatedAt = new Date().toISOString();
    await env.SESSIONS.put(`subscriber:${id}`, JSON.stringify(subscriber));
  }
  await env.SESSIONS.delete(`unsubscribe:${token}`);
  return text('<!doctype html><meta charset="utf-8"><title>Unsubscribed</title><style>body{background:#090914;color:#bff;font:18px/1.6 monospace;max-width:42rem;margin:5rem auto;padding:1rem}a{color:#0ff}</style><h1>Signal closed.</h1><p>You have been removed from transmission emails.</p><p><a href="/">Return to lastnpcalex.agency</a></p>', 200, 'text/html; charset=utf-8');
}

async function listAllTransmissionsForAdmin(request, env) {
  const output = [];
  for (const section of Object.keys(SECTIONS)) {
    const repository = await repositoryPosts(request, env, section);
    const managed = await managedPosts(env, section, true);
    const merged = new Map();
    for (const post of repository) {
      const markdown = post.bodyPath ? await assetText(request, env, post.bodyPath) : '';
      merged.set(post.slug, { ...post, markdown: markdown || '' });
    }
    managed.forEach(post => merged.set(post.slug, { ...post, source: 'admin' }));
    output.push(...merged.values());
  }
  return output.sort((a, b) => String(b.updatedAt || b.date || '').localeCompare(String(a.updatedAt || a.date || '')));
}

function subscriberForAdmin(record) {
  return {
    email: record.email,
    topics: record.topics || [],
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function csvCell(value) {
  const string = Array.isArray(value) ? value.join('|') : String(value ?? '');
  return `"${string.replace(/"/g, '""')}"`;
}

async function handleAdmin(request, env, pathname) {
  const admin = await getAdmin(request, env);
  if (pathname === '/api/admin/session' && request.method === 'GET') {
    return json({ authorized: true, did: admin.did, handle: admin.handle });
  }

  if (pathname === '/api/admin/transmissions' && request.method === 'GET') {
    return json({ transmissions: await listAllTransmissionsForAdmin(request, env), sections: SECTIONS });
  }

  if (pathname === '/api/admin/transmissions' && request.method === 'POST') {
    if (!sameOriginRequest(request)) return json({ error: 'Origin not allowed' }, 403);
    const input = await readJson(request);
    const key = `transmission:${input.section}:${String(input.slug || '').trim().toLowerCase()}`;
    const previousRaw = await env.SESSIONS.get(key);
    let previous;
    try { previous = previousRaw ? JSON.parse(previousRaw) : null; } catch { previous = null; }
    const record = normalizeTransmission(input, previous);
    await env.SESSIONS.put(`transmission:${record.section}:${record.slug}`, JSON.stringify(record));
    return json({ ok: true, transmission: record, shareUrl: `${SITE_ORIGIN}${SECTIONS[record.section].stubBase}/${record.slug}` }, previous ? 200 : 201);
  }

  if (pathname === '/api/admin/transmissions' && request.method === 'DELETE') {
    if (!sameOriginRequest(request)) return json({ error: 'Origin not allowed' }, 403);
    const input = await readJson(request, 20_000);
    const section = String(input.section || '');
    const slug = String(input.slug || '');
    if (!SECTIONS[section] || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new HttpError(400, 'Invalid section or slug');
    const key = `transmission:${section}:${slug}`;
    const existing = await env.SESSIONS.get(key);
    if (!existing) return json({ error: 'Managed transmission not found' }, 404);
    await env.SESSIONS.delete(key);
    return json({ ok: true });
  }

  if (pathname === '/api/admin/subscribers' && request.method === 'GET') {
    const subscribers = (await listKvValues(env.SESSIONS, 'subscriber:')).map(subscriberForAdmin);
    subscribers.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return json({ subscribers });
  }

  if (pathname === '/api/admin/subscribers.csv' && request.method === 'GET') {
    const subscribers = (await listKvValues(env.SESSIONS, 'subscriber:')).map(subscriberForAdmin);
    const rows = [['email', 'topics', 'status', 'created_at', 'updated_at'], ...subscribers.map(item => [item.email, item.topics, item.status, item.createdAt, item.updatedAt])];
    return text(rows.map(row => row.map(csvCell).join(',')).join('\n') + '\n', 200, 'text/csv; charset=utf-8', {
      'Content-Disposition': 'attachment; filename="lastnpcalex-subscribers.csv"',
    });
  }

  if (pathname === '/api/admin/players' && request.method === 'GET') {
    const players = (await listKvValues(env.SESSIONS, 'player:'))
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    return json({ players });
  }

  return json({ error: 'Admin endpoint not found' }, 404);
}

export async function handleContentRequest(request, env) {
  const url = new URL(request.url);
  const { pathname } = url;
  try {
    const share = parseSharePath(pathname);
    if (share) return await handleShare(request, env, share);
    if (pathname === '/llms.txt' || pathname === '/.well-known/llms.txt') return await handleLlmsTxt(request, env);
    if (pathname === '/api/subscriptions') return await handleSubscribe(request, env);
    if (pathname === '/api/subscriptions/unsubscribe') return await handleUnsubscribe(request, env);
    if (pathname.startsWith('/api/admin/')) return await handleAdmin(request, env, pathname);
    if (pathname.startsWith('/api/transmissions')) return await handlePublicTransmissions(request, env, pathname);
    return null;
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    console.error('[content]', error);
    return json({ error: 'Internal server error' }, 500);
  }
}

export const __test = { parsePostsMarkdown, parseSharePath, normalizeTransmission, markdownDocument, shareHtml };
