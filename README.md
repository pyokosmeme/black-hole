# ACIDBURN TEMPLATE

90s hacker aesthetic meets astrophysics. A static site template with a ray-traced black hole background.

---

## Features

- **Schwarzschild black hole** — Physically accurate WebGL raytracer as animated background
- **Procedural galaxy** — Tiger-stripe patterned background texture (acidburn-galaxy.js)
- **Mode toggle** — FULL (WebGL), LITE (static CSS), AUTO (detects device capabilities)
- **Content system** — Markdown-driven posts with JSON configuration
- **Accessibility** — Reduced motion support, skip links, ARIA labels
- **Responsive** — Mobile-friendly with fluid typography

---

## Quick Start

```
your-site/
├── index.html              ← main page
├── css/
│   └── acidburn.css        ← all styles
├── js/
│   ├── acidburn-mode.js    ← FULL/LITE/AUTO toggle
│   ├── acidburn-blackhole.js
│   ├── acidburn-author.js  ← content system
│   └── acidburn-galaxy.js  ← procedural background
├── js-libs/                ← Three.js dependencies
├── img/                    ← textures (milkyway.jpg, stars.png, etc.)
├── author/                 ← content folder
│   ├── config.json
│   ├── bio.md
│   ├── posts.md
│   └── posts/
├── raytracer.glsl
├── pagelayout.json         ← navigation menu config
└── nav-menu.js
```

---

## Page Configuration

Each page can load different content by setting `PAGE_CONFIG` before the scripts:

```html
<script>
  window.PAGE_CONFIG = {
    configPath: 'author/config.json',  // path to config file
    contentDir: 'author/',              // base path for content
    titleSuffix: 'transmissions'        // page title suffix
  };
</script>
```

### Multiple Pages Example

```javascript
// index.html
window.PAGE_CONFIG = {
  configPath: 'author/config.json',
  contentDir: 'author/',
  titleSuffix: 'transmissions'
};

// maps.html  
window.PAGE_CONFIG = {
  configPath: 'maps/config.json',
  contentDir: 'maps/',
  titleSuffix: 'SPECULATIVE MAPS'
};
```

---

## Content System

See **[TRANSMISSIONS.md](TRANSMISSIONS.md)** for the full content guide.

### Quick Reference

**config.json** — Author info, links, file paths
```json
{
  "author": {
    "name": "Display Name",
    "handle": "your.handle",
    "tagline": "short description",
    "avatar": "◬",
    "bio_file": "bio.md"
  },
  "posts_index": "posts.md",
  "links": [
    { "icon": "△", "label": "LINK", "desc": "description", "url": "https://..." }
  ]
}
```

**posts.md** — Post index with metadata
```markdown
## post-slug
- title: Post Title
- date: 2025.01.15
- tags: tag1, tag2
- file: posts/post-slug.md

Excerpt text shown on index page.
```

**posts/post-slug.md** — Full post content in markdown

---

## Navigation Menu

Configure site navigation in `pagelayout.json`:

```json
{
  "siteName": "SITE NAME",
  "menuIcon": "≡",
  "pages": [
    { "label": "HOME", "url": "/", "icon": ">" },
    { "label": "ABOUT", "url": "/about/", "icon": "@" },
    {
      "label": "DROPDOWN",
      "icon": "*",
      "children": [
        { "label": "Sub Item", "url": "/sub/", "icon": "-" }
      ]
    }
  ]
}
```

---

## Display Modes

| Mode | Description |
|------|-------------|
| **FULL** | WebGL black hole, all animations, glitch effects |
| **LITE** | Static CSS background, no animations, saves battery |
| **AUTO** | Detects mobile, reduced-motion preference, WebGL support |

Mode persists in localStorage. AUTO mode checks:
- Mobile device / small screen
- `prefers-reduced-motion` system setting
- WebGL availability
- Low battery (if API available)

---

## Customization

### Colors (in acidburn.css)

```css
:root {
  --cyan: #00ffff;
  --purple: #bf00ff;
  --magenta: #ff00ff;
  --green: #00ff88;
  --pink: #ff0099;
  --dark: #000000;
  --panel: rgba(5, 5, 15, 0.85);
}
```

### Black Hole Parameters (in acidburn-blackhole.js)

```javascript
shader.parameters = {
  observer: { 
    distance: 8.0,           // camera distance (5=huge, 50=tiny)
    orbital_inclination: -15  // viewing angle
  },
  time_scale: 0.5,           // orbit speed
  accretion_disk: true       // show/hide disk
};
```

---

## Black Hole Simulation

The background uses a Schwarzschild black hole raytracer. Light paths are computed by integrating geodesic ODEs in GLSL on the GPU.

### Physics

- Gravitational lensing (light bending)
- Doppler shift (color changes from motion)
- Relativistic beaming (brightness changes)
- Gravitational time dilation
- Light travel time effects

Units are normalized: Schwarzschild radius = 1, speed of light = 1 unit/second.

See **[physics documentation](https://oseiskar.github.io/black-hole/docs/physics.html)** for details.

### System Requirements

Needs decent GPU and modern browser (Chrome/Firefox) for smooth performance. Reduce quality or window size if needed. LITE mode works everywhere.

### Textures

| File | Purpose |
|------|---------|
| `milkyway.jpg` | Spherical panorama background (or use acidburn-galaxy.js) |
| `stars.png` | Star field overlay |
| `accretion-disk.png` | Glowing ring texture |
| `spectra.png` | Temperature→color mapping |
| `beach-ball.png` | Planet texture (disabled by default) |

---

## Known Artifacts

- Accretion disk texture is artistic, not physically accurate
- Doppler-shifted background colors are approximate
- Planet lighting uses simplified model
- Texture sampling may cause star blinking
- ODE solver approximations cause slight extra light bending

---

## Credits

**Black hole raytracer** by [oseiskar](https://github.com/oseiskar/black-hole)

**Acidburn aesthetic** — 90s hacker movie interfaces + astrophysics

**Dependencies:**
- [Three.js](https://threejs.org)
- [Marked.js](https://marked.js.org)
- [Google Fonts](https://fonts.google.com) (Orbitron, Share Tech Mono, Space Mono, VT323)

---

## License

See **[COPYRIGHT.md](COPYRIGHT.md)** for license and copyright info.

---

*the signal continues*
