# TRANSMISSIONS — Content System Guide

How to add posts ("transmissions") to your acidburn-styled pages.

---

## File Structure

Each page pulls content from a dedicated folder:

```
your-site/
├── index.html              ← uses author/
├── ams.html                ← uses ams/
├── maps.html               ← uses maps/
│
├── author/                 ← content folder
│   ├── config.json         ← main configuration
│   ├── bio.md              ← author bio (markdown)
│   ├── posts.md            ← index of all transmissions
│   ├── avatar.png          ← optional avatar image
│   └── posts/              ← individual post files
│       ├── first-post.md
│       ├── second-post.md
│       └── ...
```

---

## 1. config.json

The main configuration file. Controls author info, links, and points to content files.

```json
{
  "author": {
    "name": "Your Display Name",
    "handle": "your.handle",
    "tagline": "a short tagline or description",
    "avatar": "◬",
    "avatar_image": "avatar.png",
    "bio_file": "bio.md"
  },
  "posts_index": "posts.md",
  "links": [
    {
      "icon": "△",
      "label": "LINK NAME",
      "desc": "short description",
      "url": "https://example.com"
    }
  ]
}
```

### Author Fields

| field | description |
|-------|-------------|
| `name` | Display name shown in author card |
| `handle` | Shown in header bar and as @handle |
| `tagline` | Short description under handle |
| `avatar` | Unicode character fallback (if no image) |
| `avatar_image` | Path to image file (relative to content folder) |
| `bio_file` | Path to bio markdown file |

### Links Array

Each link appears as a card in the "// NODES" section:

| field | description |
|-------|-------------|
| `icon` | Unicode character or emoji |
| `label` | Card title (uppercase recommended) |
| `desc` | Short description |
| `url` | Link destination |

---

## 2. bio.md

Your author bio in markdown. Displayed in the author card.

```markdown
author of *A Mote in Shadow*. currently deep in the sequel's architecture

physics as constraint. humanity as nodes pulsing in the dark.
```

Keep it short — 2-4 lines works best.

---

## 3. posts.md — The Transmission Index

This file defines all your posts. Each post is a section starting with `## slug`.

### Format

```markdown
## slug-name
- title: Post Title Here
- date: 2025.01.15
- tags: tag1, tag2, tag3
- file: posts/slug-name.md

This is the excerpt text that appears on the index page.
It can span multiple lines. Keep it to 2-3 sentences.

## another-post
- title: Another Post Title
- date: 2025.01.20
- tags: topic, category
- file: posts/another-post.md

Another excerpt here. This text previews the content
and entices readers to click through.
```

### Metadata Fields

| field | required | description |
|-------|----------|-------------|
| `title` | **yes** | Display title on cards and post view |
| `date` | no | Date string (any format, shown as-is) |
| `tags` | no | Comma-separated list, displayed as #hashtags |
| `file` | **yes** | Path to the full post markdown file |

### Rules

- The `## slug` becomes the URL hash: `yoursite.com/page.html#post/slug`
- Metadata lines must start with `- ` and use `key: value` format
- Everything after the metadata lines becomes the excerpt
- Posts appear in the order listed (put newest at top)
- Slugs should be URL-safe: lowercase, hyphens, no spaces

---

## 4. Individual Post Files

Create markdown files in the `posts/` folder.

### Example: posts/first-transmission.md

```markdown
# The Signal Begins

Welcome to the network. This node is now active.

## Why This Exists

I needed a place to transmit. The old platforms 
failed their users. So I built this.

## What You'll Find Here

- Hard SF worldbuilding notes
- Technical breakdowns  
- Maps from fictional places
- Scattered thoughts on craft

---

The signal continues. Stay tuned.

*— transmitted 2025.01.15*
```

### Supported Markdown

| element | syntax |
|---------|--------|
| Heading 1 | `# Title` |
| Heading 2 | `## Section` |
| Heading 3 | `### Subsection` |
| Bold | `**text**` |
| Italic | `*text*` |
| Code (inline) | `` `code` `` |
| Code block | ` ```code``` ` |
| Blockquote | `> quote` |
| Link | `[text](url)` |
| Unordered list | `- item` |
| Ordered list | `1. item` |
| Horizontal rule | `---` |

---

## Adding a New Transmission

### Step 1: Create the post file

Create `posts/your-post-slug.md` with your content:

```markdown
# Your Post Title

Your content here...
```

### Step 2: Add to posts.md

Add a new section at the **top** of `posts.md` (for newest-first ordering):

```markdown
## your-post-slug
- title: Your Post Title
- date: 2025.03.15
- tags: relevant, tags
- file: posts/your-post-slug.md

A compelling excerpt that makes people want to read more.
```

### Step 3: Refresh

Refresh the page. Your new transmission appears automatically.

---

## Styling Notes

The template automatically styles your markdown:

- `# H1` — Large cyan title with glow
- `## H2` — Purple with left border
- `### H3` — Cyan, smaller
- `**bold**` — Cyan with glow
- `*italic*` — Dimmed text
- `` `code` `` — Green monospace on dark background
- `> blockquote` — Purple left border, italic
- `---` — Gradient horizontal rule
- Links — Cyan with purple underline

---

## Multiple Pages

If you have multiple pages (main site, book page, maps page), each has its own content folder:

```
author/config.json     ← index.html
ams/config.json        ← ams.html  
maps/config.json       ← maps.html
```

Set which folder each page uses via `PAGE_CONFIG` in the HTML:

```html
<script>
  window.PAGE_CONFIG = {
    configPath: 'maps/config.json',
    contentDir: 'maps/',
    titleSuffix: 'SPECULATIVE MAPS'
  };
</script>
```

---

## Agent-readable share URLs

Install the renderer dependencies once with `npm ci` (Node.js 22 or newer).
Run the share-page generator after changing either a post index or an article:

```powershell
python scripts/gen-post-stubs.py
```

For each transmission it creates three discovery surfaces:

- `/p/<slug>` (or `/p/<section>/<slug>`) is the normal share URL. A browser redirects to the interactive page, while the response itself contains the complete article, Article JSON-LD, and social metadata.
- Append `.md` to a share URL for a direct Markdown representation. Agents may also request the normal URL with `Accept: text/markdown` when it is served by the Cloudflare Worker.
- `/llms.txt` lists every transmission and its Markdown alternate. The Worker also serves the same index at `/.well-known/llms.txt` and includes admin-published transmissions dynamically.

Do not add a meta-refresh redirect to the generated share page. JavaScript provides the human redirect; omitting meta refresh lets non-browser readers retain the document context.

The Worker and static generator share `transmission-document.js`. It renders
Markdown and embedded HTML into sanitized article HTML, removes presentation
CSS and scripts, and derives clean Markdown and plain-text Article metadata.
TeX equations remain readable without a math runtime. Reference and equation
anchors use an `article-` prefix consistently in both representations; Markdown
retains small HTML anchors and subscript/superscript tags where needed. SVG
diagrams expose their authored labels as text. Relative links and images resolve from
the interactive page's location.

These are read-only representations of the published source. The SPA and public
body API still receive the original article; admin storage, drafts, editing,
publishing, and subscriptions use the same workflow. Run `npm test` to check
the renderer and Worker behavior. The static generator also requires Node.js.

---

## Browser publishing workspace

The owner workspace is at `/admin.html`. It uses the existing ATProto OAuth flow and only authorizes DIDs in the Worker's `ADMIN_DIDS` setting.

Posts created there are stored as `transmission:<section>:<slug>` records in the existing `SESSIONS` KV namespace. Published records overlay file-backed posts with the same section and slug; deleting the managed record reveals the repository version again. Drafts are visible only in the workspace.

The supported section keys are:

| key | page | subscription topic |
|-----|------|--------------------|
| `author` | `/` | blog / main transmissions |
| `ams` | `/ams.html` | A Mote in Shadow / book updates |
| `futures` | `/futures.html` | speculative fiction |
| `maps` | `/maps.html` | none |

The form at the bottom of the three subscribed sections writes preference records to KV. The admin workspace can inspect the list and export CSV. Each subscriber has an unsubscribe token; a confirmation screen prevents automated link scanners from unsubscribing readers.

### Email delivery

Collection, preference management, unsubscribe handling, and CSV export work with the existing bindings. Outbound newsletter delivery is deliberately not wired to Cloudflare Email Service: Cloudflare currently documents that service as transactional-only, while these subscription updates are marketing/bulk mail.

Use the CSV export with a newsletter provider for now. A direct integration will require choosing that provider, configuring its sender-domain DNS and API secret, then adding an adapter that synchronizes topic preferences and includes the existing unsubscribe URL. The Cloudflare deployment token does not supply those newsletter credentials.

Publishing a transmission does not currently send email automatically.

---

## Troubleshooting

### Post not appearing

- Check the slug in `posts.md` matches `## slug` format
- Verify `file:` path is correct and file exists
- Check browser console for fetch errors

### Styling looks wrong

- Ensure markdown has proper spacing (blank lines between elements)
- H1 (`#`) should only be used once at the top
- Use `##` for main sections

### Images in posts

Reference images relative to site root:

```markdown
![alt text](images/my-image.png)
```

Or relative to content folder:

```markdown
![alt text](author/images/my-image.png)
```

---

## Quick Reference

```
config.json          → author info, links, file paths
bio.md               → short author bio
posts.md             → index with metadata + excerpts
posts/*.md           → full post content

New post:
1. Create posts/slug.md
2. Add ## slug section to posts.md
3. Refresh
```

---

*transmission complete*
