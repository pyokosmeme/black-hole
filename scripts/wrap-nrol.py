#!/usr/bin/env python3
"""
wrap-nrol.py — Wrap a raw markdown file with the .nrol-doc template.

Usage:
    python scripts/wrap-nrol.py input.md [output.md] [options]

If output.md is omitted, prints to stdout.

Options:
    --eyebrow TEXT     Override eyebrow text
    --title_accent TEXT  Highlighted word/phrase in the title
    --subtitle TEXT    Override subtitle
    --author TEXT      Override author name
    --source TEXT      Override source reference
    --footer_right TEXT  Override right-side footer text
    --extension FILE   Include CSS from an extension file (e.g. neam-styles.css)

Front matter (optional, at top of input.md):
    ---
    eyebrow: "CATEGORY · EYEBROW TEXT"
    title_accent: "Highlighted Word"
    subtitle: "1-3 sentence description"
    author: "Author Name"
    source: "SOURCE_FILE.md"
    footer_right: "Collection · v1.0"
    ---
    Content starts here...

The script:
  1. Extracts the first # Title from content
  2. Converts markdown -> HTML (python-markdown)
  3. Numbers h2 sections sequentially (01, 02, ...)
  4. Numbers h3 subsections as parent.child (1.1, 1.2, ...)
  5. Wraps with nrol-doc template (scoped CSS + hero + footer)
"""

import argparse
import re
import sys
import textwrap

import markdown

# ─── Base CSS template (from nrol-alphaomega.md) ────────────────────────────

BASE_CSS = r"""/* ======================================================
   nrol-doc transmission · scoped styles
   All rules scoped under .nrol-doc so nothing leaks into the rest
   of the site. Palette uses CSS vars so light-mode flips colors
   atomically.
   ===================================================== */

.nrol-doc {
  --amber:       #f59e0b;
  --amber-soft:  #fbbf24;
  --cyan:        #7dd3fc;
  --GREEN:       #86efac;
  --AMBER:       #fbbf24;
  --BLUE:        #7dd3fc;
  --RED:         #fca5a5;
  --VIOLET:      #c4b5fd;
  --OCHRE:       #fcd34d;
  --GRAY:        #94a3b8;

  --doc-bg:      transparent;
  --doc-fg:      #e8ecf0;
  --doc-fg-muted:#b8c0cc;
  --doc-dim:     #5a6473;
  --doc-faint:   #2a3140;
  --doc-rule:    rgba(245, 158, 11, 0.18);
  --doc-code-bg: #0a0d14;
  --doc-soft-bg: #0d1019;

  font-family: 'JetBrains Mono','IBM Plex Mono','Cascadia Code',monospace;
  font-size: 13px;
  line-height: 1.7;
  letter-spacing: 0.015em;
  color: var(--doc-fg);
  max-width: 100%;
  overflow-x: hidden;
}

/* Light mode: re-map the palette for cream/paper */
body.light-mode .nrol-doc {
  --amber:       #b45309;
  --amber-soft:  #92400e;
  --cyan:        #0369a1;
  --GREEN:       #15803d;
  --AMBER:       #92400e;
  --BLUE:        #0369a1;
  --RED:         #b91c1c;
  --VIOLET:      #6d28d9;
  --OCHRE:       #a16207;
  --GRAY:        #57534e;

  --doc-fg:      #1c1917;
  --doc-fg-muted:#44403c;
  --doc-dim:     #78716c;
  --doc-faint:   #d6d3d1;
  --doc-rule:    rgba(180, 83, 9, 0.28);
  --doc-code-bg: rgba(28, 25, 23, 0.06);
  --doc-soft-bg: rgba(28, 25, 23, 0.04);
}

.nrol-doc * { box-sizing: border-box; }

/* - Hero - */
.nrol-doc .hero {
  padding-bottom: 32px;
  margin-bottom: 40px;
  border-bottom: 0.5px solid var(--doc-rule);
}
.nrol-doc .hero .eyebrow {
  font-size: 10px; color: var(--amber); letter-spacing: 0.35em;
  text-transform: uppercase; margin-bottom: 14px;
}
.nrol-doc .hero h1 {
  font-size: 28px; line-height: 1.2;
  color: var(--doc-fg); font-weight: 600;
  letter-spacing: -0.01em;
  margin: 0 0 18px 0;
  border: none; padding: 0;
}
.nrol-doc .hero h1 .accent { color: var(--amber); }
.nrol-doc .hero .subtitle {
  font-size: 13.5px; color: var(--doc-fg-muted);
  line-height: 1.65;
}
.nrol-doc .hero-meta {
  margin-top: 22px; display: flex; gap: 24px; flex-wrap: wrap;
  font-size: 10px; color: var(--doc-dim); letter-spacing: 0.2em;
  text-transform: uppercase;
}
.nrol-doc .hero-meta .key { color: var(--doc-faint); margin-right: 6px; }
.nrol-doc .hero-meta .val { color: var(--doc-fg-muted); }

/* - TOC inline - */
.nrol-doc .nrol-toc {
  margin: 28px 0 40px;
  padding: 16px 20px;
  border: 0.5px solid var(--doc-faint);
  border-left: 2px solid var(--amber);
  background: var(--doc-soft-bg);
}
.nrol-doc .nrol-toc .toc-label {
  font-size: 9px; color: var(--doc-dim);
  letter-spacing: 0.3em; text-transform: uppercase;
  margin-bottom: 10px;
}
.nrol-doc .nrol-toc ol { list-style: none; counter-reset: toc; margin: 0; padding: 0; }
.nrol-doc .nrol-toc li { counter-increment: toc; margin: 2px 0; }
.nrol-doc .nrol-toc a {
  color: var(--doc-fg-muted);
  text-decoration: none;
  font-size: 11px;
  border-bottom: none;
}
.nrol-doc .nrol-toc a::before {
  content: "0" counter(toc) "  ";
  color: var(--doc-faint);
}
.nrol-doc .nrol-toc a:hover { color: var(--amber); }

/* - Headings / text - */
.nrol-doc h2 {
  font-size: 17px; color: var(--doc-fg);
  margin-top: 48px; margin-bottom: 18px;
  padding-bottom: 10px;
  border-bottom: 0.5px solid var(--doc-rule);
  letter-spacing: 0.02em;
  border-left: none;
  font-weight: 600;
}
.nrol-doc h2 .num {
  color: var(--amber); margin-right: 14px;
  font-weight: 400;
}
.nrol-doc h3 {
  font-size: 13.5px; color: var(--amber-soft);
  margin-top: 28px; margin-bottom: 12px;
  letter-spacing: 0.05em;
  font-weight: 600;
}
.nrol-doc h3 .num { color: var(--doc-faint); margin-right: 10px; }

.nrol-doc p {
  margin-bottom: 16px;
  color: var(--doc-fg-muted);
}
.nrol-doc p strong,
.nrol-doc li strong { color: var(--doc-fg); font-weight: 600; }
.nrol-doc em { color: var(--doc-fg-muted); }

.nrol-doc ul,
.nrol-doc ol { margin: 0 0 16px 22px; color: var(--doc-fg-muted); padding: 0; }
.nrol-doc li { margin-bottom: 6px; }
.nrol-doc li::marker { color: var(--amber); }

.nrol-doc code {
  font-family: inherit;
  background: var(--doc-code-bg);
  color: var(--cyan);
  padding: 1px 6px;
  border: 0.5px solid var(--doc-faint);
  border-radius: 2px;
  font-size: 12px;
}
.nrol-doc pre {
  background: var(--doc-code-bg);
  border: 0.5px solid var(--doc-faint);
  border-left: 2px solid var(--amber);
  padding: 16px 20px;
  margin: 20px 0;
  overflow-x: auto;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--doc-fg-muted);
}
.nrol-doc pre code {
  background: none; border: none; padding: 0;
  color: inherit; font-size: inherit;
}

.nrol-doc blockquote {
  border-left: 2px solid var(--amber);
  padding: 12px 20px;
  margin: 24px 0;
  background: color-mix(in srgb, var(--amber) 6%, transparent);
  color: var(--doc-fg-muted);
  font-style: italic;
}

/* - Tables - */
.nrol-doc table {
  width: 100%; border-collapse: collapse;
  margin: 20px 0; font-size: 12px;
  display: block; overflow-x: auto;
}
.nrol-doc th,
.nrol-doc td {
  text-align: left;
  padding: 10px 14px;
  border-bottom: 0.5px solid var(--doc-faint);
  vertical-align: top;
}
.nrol-doc th {
  color: var(--amber);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  font-size: 10px;
  border-bottom-color: var(--doc-rule);
  background: color-mix(in srgb, var(--amber) 4%, transparent);
}
.nrol-doc td { color: var(--doc-fg-muted); }

/* - Chips - */
.nrol-doc .chip {
  display: inline-block;
  padding: 1px 8px;
  border: 0.5px solid currentColor;
  border-radius: 2px;
  font-size: 10px;
  letter-spacing: 0.1em;
  font-weight: 600;
}
.nrol-doc .chip.GREEN  { color: var(--GREEN); }
.nrol-doc .chip.AMBER  { color: var(--AMBER); }
.nrol-doc .chip.BLUE   { color: var(--BLUE); }
.nrol-doc .chip.RED    { color: var(--RED); }
.nrol-doc .chip.VIOLET { color: var(--VIOLET); }
.nrol-doc .chip.OCHRE  { color: var(--OCHRE); }
.nrol-doc .chip.GRAY   { color: var(--GRAY); }

/* - Callouts - */
.nrol-doc .callout {
  border: 0.5px solid var(--doc-faint);
  border-left: 2px solid var(--amber);
  padding: 14px 18px;
  margin: 22px 0;
  background: color-mix(in srgb, var(--amber) 4%, transparent);
  font-size: 12px;
  color: var(--doc-fg-muted);
}
.nrol-doc .callout.warning {
  border-left-color: var(--RED);
  background: color-mix(in srgb, var(--RED) 5%, transparent);
}
.nrol-doc .callout.note {
  border-left-color: var(--cyan);
  background: color-mix(in srgb, var(--cyan) 4%, transparent);
}
.nrol-doc .callout-label {
  font-size: 9px; letter-spacing: 0.3em;
  text-transform: uppercase; color: var(--amber);
  margin-bottom: 8px; font-weight: 600;
}
.nrol-doc .callout.warning .callout-label { color: var(--RED); }
.nrol-doc .callout.note    .callout-label { color: var(--cyan); }

/* - Diagram frames - */
.nrol-doc .diagram-label {
  display: inline-block;
  font-size: 9px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--doc-dim);
  margin: 28px 0 8px;
  padding: 2px 10px;
  border: 0.5px solid var(--doc-faint);
}
.nrol-doc .diagram-label.system   { color: var(--amber); border-color: var(--amber); }
.nrol-doc .diagram-label.feedback { color: var(--GREEN); border-color: var(--GREEN); }
.nrol-doc .diagram-label.decision { color: var(--RED);   border-color: var(--RED);   }

.nrol-doc .svg-frame {
  margin: 16px 0 28px;
  padding: 0;
  background: var(--doc-code-bg);
  border: 0.5px solid var(--doc-faint);
  border-left: 2px solid var(--amber);
  overflow-x: auto;
  overflow-y: hidden;
}
.nrol-doc .svg-frame.system   { border-left-color: var(--amber); }
.nrol-doc .svg-frame.decision { border-left-color: var(--RED);   }
.nrol-doc .svg-frame.feedback { border-left-color: var(--GREEN); }
.nrol-doc .svg-frame.flow     { border-left-color: var(--cyan);  }
.nrol-doc .svg-frame svg {
  display: block; width: 100%; height: auto; max-width: 100%;
}

/* - Legend - */
.nrol-doc .legend {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 6px 24px;
  margin: 12px 0 24px;
  padding: 12px 16px;
  background: var(--doc-soft-bg);
  border: 0.5px solid var(--doc-faint);
  font-size: 11px;
  color: var(--doc-fg-muted);
}
.nrol-doc .legend-item .sym {
  display: inline-block; width: 28px;
  color: var(--amber); font-weight: 600;
  margin-right: 6px;
}

/* - SVG theming (class-based) - */
.nrol-doc svg text {
  font-family: 'JetBrains Mono','IBM Plex Mono',monospace;
  fill: var(--doc-fg-muted);
}
.nrol-doc svg .box          { fill: color-mix(in srgb, var(--doc-fg) 3%, transparent);  stroke: var(--doc-faint); stroke-width: 1; }
.nrol-doc svg .box-soft     { fill: color-mix(in srgb, var(--doc-fg) 2%, transparent);  stroke: var(--doc-faint); stroke-width: 0.6; }
.nrol-doc svg .box-env      { fill: color-mix(in srgb, var(--doc-dim) 8%, transparent); stroke: var(--doc-dim);   stroke-width: 0.6; stroke-dasharray: 2 3; }
.nrol-doc svg .box-sub      { fill: color-mix(in srgb, var(--amber) 6%, transparent);   stroke: var(--amber);     stroke-width: 0.8; }
.nrol-doc svg .box-engine   { fill: color-mix(in srgb, var(--cyan) 6%, transparent);    stroke: var(--cyan);      stroke-width: 0.8; }
.nrol-doc svg .box-substrate{ fill: color-mix(in srgb, var(--doc-fg) 4%, transparent);  stroke: var(--doc-fg-muted); stroke-width: 0.8; }
.nrol-doc svg .box-gov      { fill: color-mix(in srgb, var(--RED) 5%, transparent);     stroke: var(--RED);       stroke-width: 0.6; stroke-dasharray: 3 2; }
.nrol-doc svg .box-db       { fill: color-mix(in srgb, var(--GREEN) 5%, transparent);   stroke: var(--GREEN);     stroke-width: 0.6; }

.nrol-doc svg .arrow          { stroke: var(--doc-dim); stroke-width: 1;   fill: none; }
.nrol-doc svg .arrow-primary  { stroke: var(--amber);   stroke-width: 1.2; fill: none; }
.nrol-doc svg .arrow-feedback { stroke: var(--GREEN);   stroke-width: 1;   fill: none; stroke-dasharray: 4 3; }
.nrol-doc svg .arrow-data     { stroke: var(--cyan);    stroke-width: 1;   fill: none; }
.nrol-doc svg .arrow-gov      { stroke: var(--RED);     stroke-width: 0.8; fill: none; stroke-dasharray: 2 2; }

.nrol-doc svg .label              { font-size: 10px;  fill: var(--doc-fg); }
.nrol-doc svg .label-main         { font-size: 11px;  fill: var(--doc-fg); font-weight: 600; }
.nrol-doc svg .label-muted        { font-size: 9px;   fill: var(--doc-dim); letter-spacing: 0.1em; }
.nrol-doc svg .label-eyebrow      { font-size: 8px;   fill: var(--amber); letter-spacing: 0.25em; }
.nrol-doc svg .label-eyebrow-cyan { font-size: 8px;   fill: var(--cyan);  letter-spacing: 0.25em; }
.nrol-doc svg .label-eyebrow-green{ font-size: 8px;   fill: var(--GREEN); letter-spacing: 0.25em; }
.nrol-doc svg .label-eyebrow-red  { font-size: 8px;   fill: var(--RED);   letter-spacing: 0.25em; }
.nrol-doc svg .label-small        { font-size: 8.5px; fill: var(--doc-fg-muted); }
.nrol-doc svg .label-code         { font-size: 9px;   fill: var(--cyan); font-style: italic; }

body.light-mode .nrol-doc svg marker path { fill: var(--doc-dim); }

.nrol-doc hr {
  border: none;
  border-top: 0.5px solid var(--doc-rule);
  margin: 40px 0;
}

.nrol-doc .footer-meta {
  margin-top: 60px;
  padding-top: 20px;
  border-top: 0.5px solid var(--doc-faint);
  font-size: 10px;
  color: var(--doc-dim);
  letter-spacing: 0.15em;
  text-transform: uppercase;
  display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap;
}

@media (max-width: 640px) {
  .nrol-doc .hero h1 { font-size: 22px; }
  .nrol-doc h2 { font-size: 15px; margin-top: 36px; }
  .nrol-doc h3 { font-size: 12.5px; }
  .nrol-doc .hero-meta { flex-direction: column; gap: 6px; }
  .nrol-doc pre { font-size: 10.5px; padding: 12px 14px; }
  .nrol-doc .legend { grid-template-columns: 1fr; }
  .nrol-doc .svg-frame {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .nrol-doc .svg-frame svg {
    width: auto;
    max-width: none;
    height: auto;
    min-width: 640px;
  }
  .nrol-doc .svg-frame::-webkit-scrollbar { height: 6px; }
  .nrol-doc .svg-frame::-webkit-scrollbar-track { background: transparent; }
  .nrol-doc .svg-frame::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--amber) 40%, transparent);
    border-radius: 3px;
  }
  .nrol-doc table { min-width: 480px; }
  .nrol-doc .nrol-toc { padding: 12px 14px; }
  .nrol-doc .nrol-toc a { font-size: 10.5px; }
}"""


# ─── Helpers ─────────────────────────────────────────────────────────────────

def parse_front_matter(text):
    """Extract simple key: value front matter between --- markers."""
    m = re.match(r'^---\s*\n(.*?)\n---\s*\n(.*)$', text, re.DOTALL)
    if not m:
        return {}, text
    raw, content = m.groups()
    meta = {}
    in_multiline = None
    multiline_val = []

    for line in raw.split('\n'):
        if in_multiline is not None:
            if line and not line.startswith(' '):
                meta[in_multiline] = '\n'.join(multiline_val).strip()
                in_multiline = None
                multiline_val = []
            else:
                multiline_val.append(line.strip())
            continue

        m2 = re.match(r'^(\w+):\s*(.*)$', line)
        if not m2:
            continue
        key, val = m2.groups()
        val = val.strip()

        # Handle quoted multiline strings
        if val.startswith('"""') and not val.endswith('"""'):
            in_multiline = key
            multiline_val = [val[3:].strip()] if len(val) > 3 else []
            continue
        elif val.startswith('"""') and val.endswith('"""') and len(val) > 6:
            meta[key] = val[3:-3].strip()
            continue

        # Strip quotes for single-line values
        if (val.startswith('"') and val.endswith('"')) or \
           (val.startswith("'") and val.endswith("'")):
            val = val[1:-1]

        meta[key] = val

    # Close any open multiline
    if in_multiline is not None:
        meta[in_multiline] = '\n'.join(multiline_val).strip()

    return meta, content


def extract_title(content):
    """Extract the first # Title from markdown content."""
    m = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
    return m.group(1) if m else None


def strip_title(content):
    """Remove the first # Title line from markdown content.

    Strips the line and any trailing newlines so we don't get a duplicate
    h1 in the HTML output (the hero section carries the title instead).
    """
    # Match "# TITLE" possibly followed by \n or \r\n
    result = re.sub(r'^#\s+.*(?:\r?\n)?', '', content, count=1, flags=re.MULTILINE)
    # Also strip leading blank lines left behind
    result = re.sub(r'^(?:\r?\n)*', '', result)
    return result


def apply_section_numbering(html):
    """Add <span class="num">NN</span> to h2 and h3 tags.

    h2 gets sequential numbering: 01, 02, 03...
    h3 gets parent.child numbering: 1.1, 1.2, 2.1...
    Also adds id="sec-N" to h2 tags for TOC linking.
    """
    h2_counter = 0
    h3_parent = 0
    h3_child = 0

    def replace_tag(match):
        nonlocal h2_counter, h3_parent, h3_child
        tag, attrs, inner = match.groups()
        tag = tag.lower()

        if tag == 'h2':
            h2_counter += 1
            h3_parent = h2_counter
            h3_child = 0
            num = f"{h2_counter:02d}"
            # Set id if not already present
            if 'id=' not in attrs:
                attrs = f'{attrs} id="sec-{h2_counter}"'.strip()
            return f'<{tag}{attrs}><span class="num">{num}</span>{inner}</{tag}>'
        elif tag == 'h3':
            h3_child += 1
            num = f"{h3_parent}.{h3_child}"
            return f'<{tag}{attrs}><span class="num">{num}</span>{inner}</{tag}>'
        return match.group(0)

    pattern = r'<(h[23])(\s[^>]*)?>(.*?)</\1>'
    return re.sub(pattern, replace_tag, html, flags=re.DOTALL)


def build_hero(title, meta):
    """Build the hero section HTML."""
    eyebrow = meta.get('eyebrow', '')
    title_accent = meta.get('title_accent', '')
    subtitle = meta.get('subtitle', '')
    author = meta.get('author', '')
    source = meta.get('source', '')

    parts = ['<div class="hero">']

    if eyebrow:
        parts.append(f'  <div class="eyebrow">{eyebrow}</div>')

    # Title with optional accent
    if title_accent and title_accent in title:
        safe_title = title.replace(title_accent, f'<span class="accent">{title_accent}</span>')
    else:
        safe_title = title

    parts.append(f'  <h1>{safe_title}</h1>')

    if subtitle:
        parts.append(f'  <div class="subtitle">{subtitle}</div>')

    # Hero meta
    meta_items = []
    if source:
        meta_items.append(f'<div><span class="key">Source</span><span class="val">{source}</span></div>')
    if author:
        meta_items.append(f'<div><span class="key">Author</span><span class="val">{author}</span></div>')

    if meta_items:
        parts.append('  <div class="hero-meta">')
        parts.extend(meta_items)
        parts.append('  </div>')

    parts.append('</div>')
    return '\n'.join(parts)


def build_footer(meta):
    """Build the footer-meta HTML."""
    source = meta.get('source', '')
    author = meta.get('author', '')
    footer_right = meta.get('footer_right', '')

    parts = ['<div class="footer-meta">']
    if source:
        parts.append(f'  <div>Source · {source}</div>')
    if author:
        parts.append(f'  <div>Authored by {author}</div>')
    if footer_right:
        parts.append(f'  <div>{footer_right}</div>')
    parts.append('</div>')
    return '\n'.join(parts)


def wrap(content, meta, extension_css=None):
    """Wrap markdown content with the nrol-doc template."""
    title = extract_title(content) or 'Untitled'

    # Remove the first # Title line from content (it becomes the hero)
    body_md = strip_title(content)

    # Convert markdown -> HTML
    html = markdown.markdown(
        body_md,
        extensions=['fenced_code', 'tables', 'toc', 'attr_list'],
    )

    # Apply section numbering
    html = apply_section_numbering(html)

    # Build sections
    hero = build_hero(title, meta)
    footer = build_footer(meta)

    # Assemble extension CSS if provided
    ext_css = ''
    if extension_css:
        ext_css = f'\n{extension_css}'

    # Full output
    output = f'''<div class="nrol-doc">

<style>
{BASE_CSS}{ext_css}
</style>

{hero}

{html}

{footer}

</div>'''

    return output


# ─── CLI ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description='Wrap a raw markdown file with the nrol-doc template.',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent('''\
            Examples:
              python scripts/wrap-nrol.py raw.md
              python scripts/wrap-nrol.py raw.md output.md
              python scripts/wrap-nrol.py raw.md output.md --eyebrow "CATEGORY"
              python scripts/wrap-nrol.py raw.md --extension css/neam-ext.css
        ''')
    )
    parser.add_argument('input', help='Input markdown file')
    parser.add_argument('output', nargs='?', default=None, help='Output file (default: stdout)')
    parser.add_argument('--eyebrow', help='Hero eyebrow text')
    parser.add_argument('--title_accent', help='Word to highlight in the title')
    parser.add_argument('--subtitle', help='Hero subtitle')
    parser.add_argument('--author', help='Author name')
    parser.add_argument('--source', help='Source reference')
    parser.add_argument('--footer_right', help='Right-side footer text')
    parser.add_argument('--extension', help='CSS extension file to include')

    args = parser.parse_args()

    with open(args.input, 'r', encoding='utf-8') as f:
        raw = f.read()

    # Parse front matter
    meta, content = parse_front_matter(raw)

    # CLI overrides take precedence
    if args.eyebrow:
        meta['eyebrow'] = args.eyebrow
    if args.title_accent:
        meta['title_accent'] = args.title_accent
    if args.subtitle:
        meta['subtitle'] = args.subtitle
    if args.author:
        meta['author'] = args.author
    if args.source:
        meta['source'] = args.source
    if args.footer_right:
        meta['footer_right'] = args.footer_right

    # Load extension CSS if provided
    extension_css = None
    if args.extension:
        with open(args.extension, 'r', encoding='utf-8') as f:
            extension_css = f.read()

    result = wrap(content, meta, extension_css)

    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(result)
        print(f"  -> {args.output}")
    else:
        print(result)


if __name__ == '__main__':
    main()
