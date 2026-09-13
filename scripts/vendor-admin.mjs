// Refresh the pinned, locally served editor dependencies; no runtime CDN access.
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const target = new URL('../js/vendor/', import.meta.url);
const files = {
  'marked-18.0.11.js': 'https://cdn.jsdelivr.net/npm/marked@18.0.11/lib/marked.umd.js',
  'marked-LICENSE': 'https://cdn.jsdelivr.net/npm/marked@18.0.11/LICENSE',
  'purify-3.4.15.js': 'https://cdn.jsdelivr.net/npm/dompurify@3.4.15/dist/purify.min.js',
  'purify-LICENSE': 'https://cdn.jsdelivr.net/npm/dompurify@3.4.15/LICENSE',
  'turndown-7.2.0.js': 'https://cdn.jsdelivr.net/npm/turndown@7.2.0/dist/turndown.js',
  'turndown-LICENSE': 'https://cdn.jsdelivr.net/npm/turndown@7.2.0/LICENSE',
};
await mkdir(target, { recursive: true });
const manifest = {};
for (const [name, url] of Object.entries(files)) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(new URL(name, target), bytes);
  manifest[name] = { url, sha256: createHash('sha256').update(bytes).digest('hex') };
}
await writeFile(new URL('sources.json', target), JSON.stringify(manifest, null, 2) + '\n');
console.log('Vendored editor dependencies and licenses.');
