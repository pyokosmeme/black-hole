// Read-only representations shared by the Worker and the static generator.
import { Marked } from 'marked';
import { fromHtml } from 'hast-util-from-html';
import { sanitize, defaultSchema } from 'hast-util-sanitize';
import { toHtml } from 'hast-util-to-html';
import { toMdast, defaultHandlers } from 'hast-util-to-mdast';
import { toMarkdown } from 'mdast-util-to-markdown';
import { gfmToMarkdown } from 'mdast-util-gfm';
import { toText } from 'hast-util-to-text';

function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Preserve TeX that Markdown would otherwise treat as escaped punctuation.
// Code blocks and inline code remain literal examples.
const mathPattern = /\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$\$[\s\S]*?\$\$|\$(?!\s)(?:[^$\n]|\\\$)+?\$/g;
const marked = new Marked({
  extensions: [{
    name: 'transmissionMath',
    level: 'inline',
    start(source) { return source.search(mathPattern); },
    tokenizer(source) {
      const match = new RegExp(`^(?:${mathPattern.source})`).exec(source);
      if (match) return { type: 'transmissionMath', raw: match[0] };
    },
    renderer(token) {
      return `<span class="math-inline">${escapeHtml(token.raw)}</span>`;
    },
  }],
});

const schema = {
  ...defaultSchema,
  // Prefix IDs and matching fragment links ourselves, consistently in HTML/MD.
  clobber: [],
  strip: [...(defaultSchema.strip || []), 'style', 'script', 'iframe', 'object', 'embed', 'svg', 'template'],
  attributes: {
    ...defaultSchema.attributes,
    '*': ['id', 'title', 'lang'],
    img: ['src', 'alt', 'title'],
    ol: ['start'],
    input: ['checked', ['disabled', true], ['type', 'checkbox']],
    th: ['align', 'colSpan', 'rowSpan'],
    td: ['align', 'colSpan', 'rowSpan'],
    span: [['className', 'math-inline']],
    div: [],
    code: [['className', /^language-/]],
  },
};

function isMath(node) {
  return node.type === 'element' && node.properties?.className?.includes('math-inline');
}

function diagramDescriptions(node) {
  if (!node.children) return;
  node.children = node.children.map(child => {
    if (child.type === 'element' && child.tagName === 'svg') {
      // SVG diagrams are article content too. Preserve their authored labels
      // as text, without exposing executable SVG or presentation attributes.
      const labels = [];
      function collect(element) {
        if (element.type === 'element' && ['text', 'title', 'desc'].includes(element.tagName)) {
          const label = toText(element).trim();
          if (label) labels.push(label);
        } else if (!['script', 'style'].includes(element.tagName)) {
          element.children?.forEach(collect);
        }
      }
      collect(child);
      const title = child.properties?.ariaLabel || 'Diagram';
      return { type: 'element', tagName: 'blockquote', properties: {}, children: [
        { type: 'element', tagName: 'p', properties: {}, children: [{ type: 'text', value: `${title} (diagram labels)` }] },
        ...labels.map(value => ({ type: 'element', tagName: 'p', properties: {}, children: [{ type: 'text', value }] })),
      ] };
    }
    diagramDescriptions(child);
    return child;
  });
}

function collectIds(node, ids = new Set()) {
  if (node.properties?.id) ids.add(String(node.properties.id));
  node.children?.forEach(child => collectIds(child, ids));
  return ids;
}

function proseText(value) {
  return { type: 'text', value: value.replace(/[ \t]+(?=\r?\n)/g, '') };
}

function prepareTree(node, baseUrl, ids, inLiteral = false) {
  if (node.type === 'element') {
    if (isMath(node)) node.data = { math: node.children.map(child => child.value || '').join('') };
    if (node.properties.id) node.properties.id = `article-${node.properties.id}`;
    for (const key of ['href', 'src']) {
      const value = node.properties[key];
      if (typeof value !== 'string' || !value) continue;
      if (key === 'href' && value.startsWith('#') && ids.has(value.slice(1))) {
        node.properties[key] = `#article-${value.slice(1)}`;
      } else {
        try { node.properties[key] = new URL(value, baseUrl).href; } catch { delete node.properties[key]; }
      }
    }
    inLiteral ||= ['pre', 'code'].includes(node.tagName) || isMath(node);
  }
  if (!node.children) return;
  node.children = node.children.flatMap(child => {
    if (child.type === 'comment') return [];
    if (child.type !== 'text' || inLiteral) {
      prepareTree(child, baseUrl, ids, inLiteral);
      return [child];
    }
    const parts = [];
    let end = 0;
    for (const match of child.value.matchAll(mathPattern)) {
      if (match.index > end) parts.push(proseText(child.value.slice(end, match.index)));
      parts.push({ type: 'element', tagName: 'span', properties: { className: ['math-inline'] }, data: { math: match[0] }, children: [{ type: 'text', value: match[0] }] });
      end = match.index + match[0].length;
    }
    if (end < child.value.length) parts.push(proseText(child.value.slice(end)));
    return parts;
  });
}

function markdownTree(tree) {
  // Markdown has no portable syntax for arbitrary equation/reference IDs.
  // Retain small HTML anchors; convert the surrounding content to Markdown.
  const handlers = {};
  for (const [tag, handler] of Object.entries(defaultHandlers)) {
    handlers[tag] = (state, node, parent) => {
      const result = isMath(node)
        ? { type: 'html', value: node.data.math }
        : ['sub', 'sup'].includes(tag)
          ? { type: 'html', value: toHtml(node) }
          : handler(state, node, parent);
      if (!node.properties?.id) return result;
      const anchor = { type: 'html', value: `<a id="${String(node.properties.id).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}"></a>` };
      return [anchor, ...(Array.isArray(result) ? result : result ? [result] : [])];
    };
  }
  return toMdast(tree, { handlers });
}

export function renderDocument(source, baseUrl = 'https://lastnpcalex.agency/') {
  const parsed = fromHtml(marked.parse(String(source || '')), { fragment: true });
  diagramDescriptions(parsed);
  const tree = sanitize(parsed, schema);
  prepareTree(tree, baseUrl, collectIds(tree));
  return {
    html: toHtml(tree),
    markdown: toMarkdown(markdownTree(tree), { extensions: [gfmToMarkdown()], fences: true, bullet: '-' }),
    text: toText(tree),
  };
}
