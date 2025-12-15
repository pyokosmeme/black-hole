# AUTHOR-NODE v2 // Dynamic Content Template

distributed consciousness interface;;; now with EXTERNAL content loading...

```
edit markdown files → site updates
no touching HTML required
all boundaries are negotiations
```

---

## FILE STRUCTURE

```
author-node/
├── index.html              # template (don't edit for content)
├── config.json             # ← EDIT: author info, links
├── content/
│   ├── bio.md              # ← EDIT: author bio (markdown)
│   └── posts.md            # ← EDIT: posts index/registry
├── posts/
│   ├── your-post.md        # ← EDIT: blog content
│   └── another-post.md
└── README.md
```

---

## QUICK START

### 1. Edit `config.json`

```json
{
  "author": {
    "handle": "YOUR_HANDLE",
    "name": "Your Name",
    "tagline": "your ;; tagline ;; here",
    "avatar": "◬",
    "bio_file": "content/bio.md"
  },
  
  "links": [
    {
      "id": "twitter",
      "label": "TWITTER",
      "url": "https://twitter.com/you",
      "icon": "◫",
      "desc": "@yourhandle"
    }
  ],

  "posts_index": "content/posts.md",

  "blackhole": {
    "prompt": "a short instruction for the LLM / artist",
    "particleCount": 900,
    "baseSpeed": 0.006,
    "swirlStrength": 0.14,
    "accretionColor": "#ff00ff",
    "horizonColor": "#00ffff",
    "backgroundFade": 0.1,
    "sparkChance": 0.004
  }
}
```

### 2. Edit `content/bio.md`

Write your bio in markdown:

```markdown
your bio text here.

supports **bold**, *italic*, and [links](url).

line breaks preserved.
```

### 3. Edit `content/posts.md`

Register posts with this format:

```markdown
## post-slug
- title: YOUR POST TITLE
- date: 2025.03.14
- tags: tag1, tag2, tag3
- file: posts/your-post.md

Your excerpt text goes here as a regular paragraph.

## another-post
- title: ANOTHER POST
- date: 2025.03.01
- tags: theory
- file: posts/another-post.md

Another excerpt...
```

### 4. Create posts in `posts/`

Write full post content as standard markdown:

```markdown
# Post Title

## Section Header

Your content here...
```

### 5. Deploy

Push to GitHub → enable Pages → done.

---

## EDITING GUIDE

### ;;; AUTHOR INFO (`config.json`)

| Field | Description |
|-------|-------------|
| `handle` | Display name in header (caps recommended) |
| `name` | Full name below avatar |
| `tagline` | One-liner under name |
| `avatar` | Single character: `◬ ◈ ☠ ⬡` or emoji |
| `bio_file` | Path to bio markdown file |

### ;;; LINKS (`config.json`)

```json
{
  "id": "unique-id",
  "label": "DISPLAY TEXT",
  "url": "https://...",
  "icon": "◈",
  "desc": "small description"
}
```

**Icon suggestions:** `◈ ◉ ◫ ⬡ ⎔ ◇ ◆ ▣ ⬢ ◐`

### ;;; BIO (`content/bio.md`)

Standard markdown. Rendered inside the author card.

```markdown
line one

line two

*italics for asides*

**bold for emphasis**
```

### ;;; POSTS INDEX (`content/posts.md`)

Each post needs:

```markdown
## slug-for-url
- title: DISPLAY TITLE
- date: YYYY.MM.DD
- tags: comma, separated, tags
- file: posts/filename.md

Excerpt paragraph shown on index.
```

**Important:**
- `## slug` becomes the URL: `yoursite.com/#post/slug`
- `file:` path is relative to root
- Excerpt is everything after metadata until next `##`

### ;;; BLACKHOLE SIMULATION (`config.json`)

The `blackhole` block tunes the neon background. Keep values modest for performance:

- `prompt` → guiding text for the LLM/artist producing the effect
- `particleCount` → total swirling particles in the disk
- `baseSpeed` → core orbital speed (lower = slower swirl)
- `swirlStrength` → how tightly the disk coils toward the horizon
- `accretionColor` / `horizonColor` → primary neon hues
- `backgroundFade` → trail persistence (higher = more motion blur)
- `sparkChance` → frequency of streaking sparks

### ;;; POST CONTENT (`posts/*.md`)

Full markdown support:

- `# H1` → cyan glow header
- `## H2` → purple with left border
- `**bold**` → cyan glow
- `*italic*` → dimmed
- `` `code` `` → green monospace
- `> blockquote` → purple border
- `---` → gradient divider
- `[link](url)` → cyan with purple underline

---

## WORKFLOW

```
1. edit config.json      → author + links
2. edit content/bio.md   → bio text
3. edit content/posts.md → add post entry
4. create posts/new.md   → write content
5. git push              → site updates
```

**That's it.** No build step. No npm. No webpack.

---

## LOCAL TESTING

Need a local server (fetch requires it):

```bash
# Python
python -m http.server 8000

# Node
npx serve

# PHP
php -S localhost:8000
```

Open `http://localhost:8000`

---

## CUSTOMIZATION

### Colors

Edit CSS variables in `index.html`:

```css
:root {
  --cyan: #00ffff;
  --purple: #bf00ff;
  --magenta: #ff00ff;
  --green: #00ff88;
  --dark: #05050a;
}
```

### Disable Effects

Comment out in `index.html` JavaScript:

```javascript
// initBinaryRain();
// initNetworkCanvas();
// initGlitchEffect();
// initStatsAnimation();
```

---

## URL ROUTING

Hash-based, no server config needed:

- `yoursite.com/` → index
- `yoursite.com/#post/slug` → post view

Direct links work and are shareable.

---

## DEPENDENCIES

CDN-loaded (no install):

- [Marked.js](https://marked.js.org/) - markdown parsing
- [Google Fonts](https://fonts.google.com/) - typography

---

## TROUBLESHOOTING

**Content not loading?**
- Check file paths in config.json
- Ensure you're running a local server (not file://)
- Check browser console for errors

**Posts not showing?**
- Verify posts.md format (## slug on its own line)
- Check that `file:` paths are correct

**Styling broken?**
- Clear browser cache
- Check for CSS syntax errors if you edited styles

---

```
signal ends
your transmissions begin
```

*template v2 // all content externalized // 2025*
