# Vaporwave/Synthwave Design System

A comprehensive style guide for creating retro-futuristic, 80s-inspired interfaces. Use this as a reference for Claude or any design system implementation.

---

## 🎨 Color Palette

### Primary Colors
```css
--void-black: #0a0014;        /* Deepest background */
--void-purple: #1a0030;       /* Secondary background */
--void-mid: #0a0020;          /* Tertiary background */
--grid-dark: #301030;         /* Subtle grid lines, borders */
--grid-line: #301050;         /* Dividers, inactive elements */
```

### Accent Colors
```css
--neon-magenta: #ff00ff;      /* Primary accent, hot elements */
--neon-cyan: #00ffff;         /* Secondary accent, cool elements */
--neon-magenta-soft: #ff88ff; /* Softer magenta for text */
--neon-cyan-soft: #88ffff;    /* Softer cyan for text */
```

### State Colors
```css
--success-green: #00ff88;     /* Success, positive states */
--warning-orange: #ff8800;    /* Warning, caution states */
--warning-yellow: #ffff00;    /* Highlight, attention */
```

### Transparency Variants
```css
--magenta-glow: rgba(255, 0, 255, 0.3);
--cyan-glow: rgba(0, 255, 255, 0.3);
--magenta-subtle: rgba(255, 0, 255, 0.1);
--cyan-subtle: rgba(0, 255, 255, 0.1);
--panel-bg: rgba(10, 0, 30, 0.85);
--overlay-bg: rgba(0, 0, 0, 0.5);
```

---

## 🔤 Typography

### Font Stack
```css
font-family: "Courier New", Consolas, Monaco, monospace;
```

Monospace fonts are essential for the retro-computing aesthetic. Avoid sans-serif fonts like Inter, Roboto, or Arial.

### Font Sizes
```css
--text-title: 2rem;           /* Main titles */
--text-heading: 1.5rem;       /* Section headings */
--text-subheading: 1.2rem;    /* Subsection headings */
--text-body: 0.85rem;         /* Body text, controls */
--text-label: 0.75rem;        /* Labels, small text */
--text-micro: 0.7rem;         /* Section headers, tags */
--text-tiny: 0.65rem;         /* Footnotes, metadata */
```

### Text Styling
```css
/* Titles - gradient shimmer effect */
.title {
  text-transform: uppercase;
  letter-spacing: 0.3em;
  font-weight: bold;
  background: linear-gradient(90deg, #ff00ff, #00ffff, #ff00ff);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: shimmer 3s linear infinite;
}

@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

/* Section headers */
.section-header {
  font-size: 0.7rem;
  letter-spacing: 0.2em;
  color: #00ffff; /* or #ff00ff */
  border-bottom: 1px solid #301050;
  padding-bottom: 5px;
  margin-bottom: 10px;
}

/* Use diamond bullets for headers */
/* ◆ SECTION NAME ◆ */
```

---

## 📦 Components

### Panel / Card
```css
.panel {
  background: rgba(10, 0, 30, 0.85);
  border: 1px solid #ff00ff; /* or #00ffff */
  border-radius: 4px;
  padding: 15px;
  box-shadow: 
    0 0 20px rgba(255, 0, 255, 0.3),
    inset 0 0 20px rgba(255, 0, 255, 0.1);
}
```

### Buttons
```css
/* Primary action button */
.button-primary {
  padding: 10px 16px;
  background: linear-gradient(90deg, #ff00ff, #00ffff);
  border: none;
  color: #000;
  font-weight: bold;
  font-family: inherit;
  letter-spacing: 0.1em;
  cursor: pointer;
}

/* Secondary/outline button */
.button-secondary {
  padding: 8px 16px;
  background: transparent;
  border: 1px solid #ff00ff; /* or #00ffff */
  color: #ff00ff; /* match border */
  font-family: inherit;
  letter-spacing: 0.1em;
  cursor: pointer;
}

/* Subtle action button */
.button-subtle {
  padding: 10px;
  background: linear-gradient(90deg, rgba(255,0,255,0.2), rgba(0,255,255,0.2));
  border: 1px solid #00ffff;
  color: #00ffff;
  font-family: inherit;
  letter-spacing: 0.1em;
}
```

### Form Inputs
```css
/* Select dropdown */
select {
  width: 100%;
  padding: 8px;
  background: #1a0030;
  border: 1px solid #ff00ff;
  color: #fff;
  font-family: inherit;
  cursor: pointer;
}

/* Text input */
input[type="text"],
input[type="number"] {
  padding: 4px 8px;
  background: #1a0030;
  border: 1px solid #ff00ff; /* or #00ffff */
  color: #fff;
  font-family: monospace;
}

/* Range slider */
input[type="range"] {
  width: 100%;
  accent-color: #ff00ff; /* or #00ffff */
}

/* Checkbox */
input[type="checkbox"] {
  accent-color: #ff00ff;
}
```

### Slider with Label
```jsx
<div style={{ marginBottom: '12px' }}>
  <div style={{ 
    display: 'flex', 
    justifyContent: 'space-between',
    fontSize: '0.75rem',
    marginBottom: '4px',
  }}>
    <span style={{ color: '#ff88ff' }}>Label</span>
    <span style={{ color: '#00ffff' }}>0.00</span>
  </div>
  <input type="range" style={{ width: '100%', accentColor: '#ff00ff' }} />
</div>
```

### Status Indicator
```css
/* Success state */
.status-success {
  padding: 6px;
  background: rgba(0, 255, 136, 0.15);
  border: 1px solid #00ff88;
  color: #00ff88;
  text-align: center;
  font-weight: bold;
  letter-spacing: 0.1em;
}

/* Warning state */
.status-warning {
  padding: 6px;
  background: rgba(255, 136, 0, 0.15);
  border: 1px solid #ff8800;
  color: #ff8800;
}
```

---

## 🖼️ Backgrounds & Effects

### Gradient Backgrounds
```css
/* Full page background */
.page-bg {
  background: linear-gradient(
    180deg, 
    #0a0014 0%, 
    #1a0030 50%, 
    #0a0020 100%
  );
}

/* Simpler two-tone */
.panel-bg {
  background: linear-gradient(180deg, #0a0014 0%, #1a0030 100%);
}

/* Horizontal accent gradient */
.accent-gradient {
  background: linear-gradient(90deg, rgba(255,0,255,0.2), rgba(0,255,255,0.2));
}
```

### CRT Scanline Effect
```css
.scanlines {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.1) 0px,
    rgba(0, 0, 0, 0.1) 1px,
    transparent 1px,
    transparent 2px
  );
  pointer-events: none;
  z-index: 100;
}
```

### Glow Effects
```css
/* Text glow */
.text-glow-magenta {
  text-shadow: 0 0 10px #ff00ff;
}

.text-glow-cyan {
  text-shadow: 0 0 10px #00ffff;
}

/* Box glow */
.box-glow-magenta {
  box-shadow: 
    0 0 20px rgba(255, 0, 255, 0.3),
    inset 0 0 20px rgba(255, 0, 255, 0.1);
}

.box-glow-cyan {
  box-shadow: 
    0 0 20px rgba(0, 255, 255, 0.3),
    inset 0 0 20px rgba(0, 255, 255, 0.1);
}

/* SVG filter glow */
<filter id="glow">
  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
  <feMerge>
    <feMergeNode in="coloredBlur"/>
    <feMergeNode in="SourceGraphic"/>
  </feMerge>
</filter>
```

### SVG Gradient for Curves
```jsx
<defs>
  <linearGradient id="neonGradient" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%" stopColor="#ff00ff" />
    <stop offset="50%" stopColor="#00ffff" />
    <stop offset="100%" stopColor="#ff00ff" />
  </linearGradient>
</defs>

<path stroke="url(#neonGradient)" strokeWidth={3} filter="url(#glow)" />
```

---

## 🌐 Three.js Specific

### Scene Setup
```javascript
// Background color
scene.background = new THREE.Color(0x0a0014);

// Fog for depth
scene.fog = new THREE.Fog(0x0a0014, 8, 20);
```

### Lighting
```javascript
// Ambient - subtle purple
const ambientLight = new THREE.AmbientLight(0x301050, 0.5);

// Point light - magenta
const pointLight1 = new THREE.PointLight(0xff00ff, 1, 20);
pointLight1.position.set(5, 5, 5);

// Point light - cyan
const pointLight2 = new THREE.PointLight(0x00ffff, 1, 20);
pointLight2.position.set(-5, 5, -5);
```

### Grid Floor
```javascript
const gridHelper = new THREE.GridHelper(
  20,       // size
  40,       // divisions
  0xff00ff, // center line color
  0x301030  // grid color
);
gridHelper.position.y = -0.5;
```

### Materials
```javascript
// Main surface material
const material = new THREE.MeshPhongMaterial({
  vertexColors: true,
  side: THREE.DoubleSide,
  shininess: 100,
  transparent: true,
  opacity: 0.9,
});

// Wireframe overlay
const wireframeMaterial = new THREE.MeshBasicMaterial({
  color: 0x00ffff,
  wireframe: true,
  transparent: true,
  opacity: 0.15,
});
```

### Vertex Color Gradient (Purple → Magenta → Cyan → White)
```javascript
const t = normalizedHeight; // 0 to 1

let r, g, b;
if (t < 0.25) {
  const s = t / 0.25;
  r = 0.1 + s * 0.6;
  g = 0.0 + s * 0.1;
  b = 0.3 + s * 0.4;
} else if (t < 0.5) {
  const s = (t - 0.25) / 0.25;
  r = 0.7 + s * 0.3;
  g = 0.1 + s * 0.1;
  b = 0.7 - s * 0.2;
} else if (t < 0.75) {
  const s = (t - 0.5) / 0.25;
  r = 1.0 - s * 0.7;
  g = 0.2 + s * 0.7;
  b = 0.5 + s * 0.5;
} else {
  const s = (t - 0.75) / 0.25;
  r = 0.3 + s * 0.7;
  g = 0.9 + s * 0.1;
  b = 1.0;
}
```

---

## 📐 Layout Patterns

### Split Panel Layout
```jsx
<div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
  <div style={{ flex: 1, minWidth: '280px' }}>
    {/* Left panel - magenta border */}
  </div>
  <div style={{ flex: 1, minWidth: '280px' }}>
    {/* Right panel - cyan border */}
  </div>
</div>
```

### Floating Control Panels
```jsx
/* Left panel */
position: absolute;
top: 100px;
left: 20px;

/* Right panel */
position: absolute;
top: 100px;
right: 20px;
```

### Full-screen Overlay Mode
```jsx
position: absolute;
top: 0;
left: 0;
right: 0;
bottom: 0;
z-index: 200;
```

---

## ✅ Do's and Don'ts

### ✅ Do
- Use monospace fonts exclusively
- Keep backgrounds dark (near-black with purple tint)
- Use magenta and cyan as complementary accents
- Add subtle glow effects to important elements
- Include scanline overlay for CRT effect
- Use uppercase with letter-spacing for headers
- Use diamond (◆) or triangle (▲) symbols for decoration
- Make interactive elements obviously clickable with borders/glows

### ❌ Don't
- Use light/white backgrounds
- Use sans-serif fonts (Inter, Roboto, Arial)
- Overuse gradients on every element
- Mix warm colors (orange, red) except for warnings
- Use rounded corners larger than 4px
- Forget the scanline overlay
- Use default browser form styling

---

## 🎯 Quick Reference

```
Backgrounds:  #0a0014, #1a0030, #0a0020
Accents:      #ff00ff (hot), #00ffff (cool)
Soft text:    #ff88ff, #88ffff
Borders:      #301030, #301050
Success:      #00ff88
Warning:      #ff8800
Font:         "Courier New", monospace
Spacing:      letter-spacing: 0.1em - 0.3em
```

---

*"The future is now, and it glows in neon."* ✨
