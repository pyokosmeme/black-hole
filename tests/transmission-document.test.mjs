import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderDocument } from '../transmission-document.js';

test('renders Markdown structure, code, tables, images and nested lists', () => {
  const source = '# Signal\n\nA **bold** claim with [context](notes.html).\n\n'
    + '3. Third\n   - Nested\n\n![Map](img/map.png)\n\n'
    + '| State | Value |\n| --- | --- |\n| A | 2 |\n\n'
    + '```html\n<script>example()</script>\n```\n\n- [x] Done\n';
  const document = renderDocument(source, 'https://lastnpcalex.agency/futures.html');
  assert.match(document.html, /<h1>Signal<\/h1>/);
  assert.match(document.html, /<strong>bold<\/strong>/);
  assert.match(document.html, /<ol start="3">/);
  assert.match(document.html, /<table>/);
  assert.match(document.html, /alt="Map"/);
  assert.match(document.html, /https:\/\/lastnpcalex.agency\/img\/map.png/);
  assert.match(document.markdown, /\[context\]\(https:\/\/lastnpcalex.agency\/notes.html\)/);
  assert.match(document.markdown, /3\. Third/);
  assert.match(document.markdown, /- Nested/);
  assert.match(document.markdown, /\| State/);
  assert.match(document.markdown, /```html\n<script>example\(\)<\/script>\n```/);
  assert.match(document.markdown, /- \[x\] Done/);
});

test('removes executable/presentation HTML while preserving links and references', () => {
  const document = renderDocument('<div class="theme" style="color:red" onclick="bad()">'
    + '<style>.theme{display:none}</style><script>bad()</script>'
    + '<h2 id="refs">References</h2><p>Read <a href="#refs">these</a> &amp; '
    + '<a href="javascript:bad()">this</a>.</p><iframe src="https://example.com">hidden</iframe>'
    + '<img src="x.png" alt="Example" onerror="bad()">'
    + '<a href="#post/other">Another transmission</a></div>');
  assert.doesNotMatch(document.html, /<script|<style|onclick|onerror|javascript:|<iframe|class="theme"/);
  assert.doesNotMatch(document.markdown, /bad\(\)|display:none|<div|<h2|<p>/);
  assert.match(document.html, /id="article-refs"/);
  assert.match(document.html, /href="#article-refs"/);
  assert.match(document.markdown, /<a id="article-refs"><\/a>/);
  assert.match(document.markdown, /\[these\]\(#article-refs\)/);
  assert.match(document.markdown, /https:\/\/lastnpcalex.agency\/#post\/other/);
  assert.match(document.markdown, /Read .* & /);
});

test('preserves TeX delimiters, backslashes and multiline expressions in HTML and Markdown sources', () => {
  const equation = String.raw`\[
\begin{aligned}
x_i &= \frac{a}{b} \\
y &= x_i^2
\end{aligned}
\]`;
  for (const source of [equation, `<div id="eq">${equation}</div>`]) {
    const document = renderDocument(source + String.raw`\(J_{ij}\) and $x_i$ and $$y^2$$`);
    assert.ok(document.markdown.includes(equation), document.markdown);
    assert.ok(document.markdown.includes(String.raw`\(J_{ij}\)`));
    assert.ok(document.markdown.includes('$x_i$'));
    assert.ok(document.markdown.includes('$$y^2$$'));
    assert.match(document.html, /math-inline/);
  }
  const literal = renderDocument('```tex\n' + equation + '\n```');
  assert.ok(literal.markdown.includes(equation));
  assert.doesNotMatch(literal.html, /math-inline/);
});

test('preserves subscripts, superscripts, and authored SVG diagram labels', () => {
  const document = renderDocument('<p>x<sub>i</sub><sup>2</sup></p>'
    + '<svg aria-label="Feedback loop"><text>Observe</text><text>Update</text>'
    + '<script>bad()</script><path d="M0 0"/></svg>');
  assert.match(document.markdown, /x<sub>i<\/sub><sup>2<\/sup>/);
  assert.match(document.markdown, /Feedback loop \(diagram labels\)/);
  assert.match(document.markdown, /Observe/);
  assert.match(document.markdown, /Update/);
  assert.doesNotMatch(document.html, /<svg|<path|bad\(\)/);
});

const articles = [
  ['author', 'neam-rescue', '/'],
  ['author', 'neam', '/'],
  ['author', 'nrol-alphaomega', '/'],
  ['futures', 'whiskey-fractal', '/futures.html'],
  ['futures', 'outsideness-network-engine', '/futures.html'],
  ['ams', 'delisting-from-draft2digital', '/ams.html'],
];
for (const [section, slug, page] of articles) {
  test(`${slug}: generated share artifacts use the shared renderer and retain equations/references`, () => {
    const source = readFileSync(new URL(`../${section}/content/posts/${slug}.md`, import.meta.url), 'utf8');
    const document = renderDocument(source, `https://lastnpcalex.agency${page}`);
    const base = `../p/${section === 'author' ? '' : section + '/'}${slug}`;
    const html = readFileSync(new URL(`${base}.html`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    const markdown = readFileSync(new URL(`${base}.md`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    assert.ok(html.includes(document.html.replace(/\r\n/g, '\n')));
    assert.ok(markdown.endsWith(document.markdown.replace(/\r\n/g, '\n')));
    assert.match(html, /window.location.replace\(/);
    assert.doesNotMatch(html, /http-equiv="refresh"|<pre class="markdown-source">/);
    for (const equation of source.matchAll(/\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)/g)) {
      assert.ok(markdown.includes(equation[0].replace(/\r\n/g, '\n')), `Lost equation: ${equation[0]}`);
    }
    for (const reference of source.matchAll(/href="#([^" ]+)"/g)) {
      assert.ok(markdown.includes(`#article-${reference[1]}`), `Lost reference: ${reference[1]}`);
      assert.ok(markdown.includes(`id="article-${reference[1]}"`), `Lost anchor: ${reference[1]}`);
    }
  });
}
