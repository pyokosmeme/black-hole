/**
 * SURFACES — whiskey-translucent fractal nodes
 *
 * Self-contained renderer. Loads surfaces/config.json, draws each surface
 * as a procedural fractal-star orb seeded by its slug. Three view modes:
 * constellation (slow drift), force (draggable), periodic (grid).
 */

(function () {
  'use strict';

  const CFG_PATH = (window.SURFACES_CONFIG && window.SURFACES_CONFIG.configPath) || 'surfaces/config.json';
  const SVG_NS = 'http://www.w3.org/2000/svg';

  let CFG = null;
  let SURFACES = [];
  let CURRENT_VIEW = 'constellation';
  let stopAnim = null;

  // ─────────────────────── slug-seeded RNG ───────────────────────
  function hash32(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }
  function mulberry32(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ─────────────────────── fractal-star path ───────────────────────
  // procedural translucent whiskey-glass star — seeded by slug,
  // amber radial fill, magenta inner caustic. evokes the fractal
  // in the Whiskey Translucent Fractal transmission.
  function buildFractalOrb(slug, size, opts = {}) {
    const rnd = mulberry32(hash32(slug));
    const points = 8 + Math.floor(rnd() * 7);          // 8..14 spikes
    const innerR = size * (0.32 + rnd() * 0.10);
    const outerR = size * 0.48;
    const spinOffset = rnd() * Math.PI * 2;

    const cx = size / 2;
    const cy = size / 2;

    // outer star polygon
    const path = [];
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = spinOffset + (i / (points * 2)) * Math.PI * 2;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      path.push((i === 0 ? 'M' : 'L') + x.toFixed(2) + ',' + y.toFixed(2));
    }
    path.push('Z');
    const starD = path.join(' ');

    // inner caustic lines (the "sloshing" of the whiskey)
    const lines = [];
    const ringCount = 2 + Math.floor(rnd() * 3);
    for (let r = 1; r <= ringCount; r++) {
      const subPts = points;
      const subR = innerR * (0.4 + r * 0.18);
      const offset = rnd() * Math.PI * 2;
      const subPath = [];
      for (let i = 0; i < subPts; i++) {
        const angle = offset + (i / subPts) * Math.PI * 2;
        const x = cx + Math.cos(angle) * subR;
        const y = cy + Math.sin(angle) * subR;
        subPath.push((i === 0 ? 'M' : 'L') + x.toFixed(2) + ',' + y.toFixed(2));
      }
      subPath.push('Z');
      lines.push(subPath.join(' '));
    }

    const gradId = 'grad-' + slug.replace(/[^a-z0-9]/gi, '');
    const glowId = 'glow-' + slug.replace(/[^a-z0-9]/gi, '');

    return {
      gradId,
      glowId,
      starD,
      lines,
      cx, cy,
      outerR
    };
  }

  function nodeSVG(surface, size) {
    const orb = buildFractalOrb(surface.slug, size);
    const g = document.createElementNS(SVG_NS, 'g');
    g.classList.add('srf-node-group');
    g.dataset.slug = surface.slug;

    // defs (gradient + glow)
    const defs = document.createElementNS(SVG_NS, 'defs');
    defs.innerHTML = `
      <radialGradient id="${orb.gradId}" cx="50%" cy="45%" r="55%">
        <stop offset="0%"   stop-color="#fff4d0" stop-opacity="0.95"/>
        <stop offset="35%"  stop-color="#ffd56b" stop-opacity="0.80"/>
        <stop offset="65%"  stop-color="#ffb347" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="#e08a2c" stop-opacity="0.20"/>
      </radialGradient>
      <filter id="${orb.glowId}" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="${(size * 0.04).toFixed(2)}" result="blur"/>
        <feMerge>
          <feMergeNode in="blur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    `;
    g.appendChild(defs);

    // outer star — the glass vessel
    const star = document.createElementNS(SVG_NS, 'path');
    star.setAttribute('d', orb.starD);
    star.setAttribute('fill', `url(#${orb.gradId})`);
    star.setAttribute('stroke', '#ffd56b');
    star.setAttribute('stroke-width', '0.6');
    star.setAttribute('stroke-opacity', '0.6');
    star.setAttribute('filter', `url(#${orb.glowId})`);
    g.appendChild(star);

    // inner caustics — the sloshing whiskey
    orb.lines.forEach((d, i) => {
      const p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('d', d);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', i === 0 ? '#ff7eb6' : '#ffd56b');
      p.setAttribute('stroke-width', '0.4');
      p.setAttribute('stroke-opacity', String(0.45 - i * 0.08));
      g.appendChild(p);
    });

    // bright core
    const core = document.createElementNS(SVG_NS, 'circle');
    core.setAttribute('cx', String(orb.cx));
    core.setAttribute('cy', String(orb.cy));
    core.setAttribute('r', String(size * 0.06));
    core.setAttribute('fill', '#fff4d0');
    core.setAttribute('opacity', '0.85');
    g.appendChild(core);

    return g;
  }

  // ─────────────────────── view: constellation + force ───────────────────────
  function ensureStage() {
    const stage = document.getElementById('srf-stage');
    stage.innerHTML = '';
    return stage;
  }

  function renderCanvasView(mode) {
    const stage = ensureStage();
    const wrap = document.createElement('div');
    wrap.className = 'srf-canvas';
    stage.appendChild(wrap);

    const w = wrap.clientWidth || 1000;
    const h = wrap.clientHeight || 720;

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    wrap.appendChild(svg);

    const orbSize = 110;

    // seed initial positions on a loose circle
    const cx = w / 2, cy = h / 2;
    const r = Math.min(w, h) * 0.32;
    const nodes = SURFACES.map((s, i) => {
      const rnd = mulberry32(hash32(s.slug + '|pos'));
      const angle = (i / SURFACES.length) * Math.PI * 2 + rnd() * 0.4;
      const radius = r * (0.6 + rnd() * 0.5);
      return {
        s,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
        vx: (rnd() - 0.5) * 0.25,
        vy: (rnd() - 0.5) * 0.25,
        size: orbSize
      };
    });

    // edges: connect nodes sharing a tag
    const edges = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const sharedTag = (nodes[i].s.tags || []).some(t => (nodes[j].s.tags || []).includes(t));
        if (sharedTag) edges.push([i, j]);
      }
    }

    // edge layer
    const edgeLayer = document.createElementNS(SVG_NS, 'g');
    svg.appendChild(edgeLayer);
    const edgeEls = edges.map(([a, b]) => {
      const ln = document.createElementNS(SVG_NS, 'line');
      ln.setAttribute('class', 'srf-edge');
      edgeLayer.appendChild(ln);
      return { a, b, el: ln };
    });

    // node layer
    const nodeLayer = document.createElementNS(SVG_NS, 'g');
    svg.appendChild(nodeLayer);

    const nodeEls = nodes.map((n) => {
      const wrapG = document.createElementNS(SVG_NS, 'g');
      const inner = nodeSVG(n.s, n.size);
      wrapG.appendChild(inner);

      const labelY = n.size / 2 + n.size * 0.55;
      const label = document.createElementNS(SVG_NS, 'text');
      label.setAttribute('class', 'srf-node-label');
      label.setAttribute('x', String(n.size / 2));
      label.setAttribute('y', String(labelY));
      label.textContent = n.s.title;
      wrapG.appendChild(label);

      if (n.s.flavor) {
        const flav = document.createElementNS(SVG_NS, 'text');
        flav.setAttribute('class', 'srf-node-flavor');
        flav.setAttribute('x', String(n.size / 2));
        flav.setAttribute('y', String(labelY + 14));
        flav.textContent = n.s.flavor.length > 48 ? n.s.flavor.slice(0, 46) + '…' : n.s.flavor;
        wrapG.appendChild(flav);
      }

      wrapG.style.cursor = 'pointer';
      wrapG.addEventListener('click', () => openDrawer(n.s));

      nodeLayer.appendChild(wrapG);
      return wrapG;
    });

    // drag (force mode only)
    let dragging = null;
    if (mode === 'force') {
      nodeEls.forEach((el, idx) => {
        el.style.cursor = 'grab';
        el.addEventListener('mousedown', (e) => {
          e.preventDefault();
          dragging = idx;
          el.style.cursor = 'grabbing';
        });
      });
      window.addEventListener('mouseup', () => {
        if (dragging !== null) nodeEls[dragging].style.cursor = 'grab';
        dragging = null;
      });
      svg.addEventListener('mousemove', (e) => {
        if (dragging === null) return;
        const rect = svg.getBoundingClientRect();
        const mx = ((e.clientX - rect.left) / rect.width) * w;
        const my = ((e.clientY - rect.top) / rect.height) * h;
        nodes[dragging].x = mx;
        nodes[dragging].y = my;
        nodes[dragging].vx = 0;
        nodes[dragging].vy = 0;
      });
    }

    // simulation tick
    function tick() {
      const damping = 0.94;
      const repel = mode === 'force' ? 2400 : 600;
      const center = mode === 'force' ? 0.0008 : 0.0006;
      const linkStrength = mode === 'force' ? 0.012 : 0.004;
      const linkRest = orbSize * 2.4;

      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        if (dragging === i) continue;

        // gentle drift toward center
        a.vx += (cx - a.x) * center;
        a.vy += (cy - a.y) * center;

        // node-node repulsion
        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue;
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy + 1;
          const f = repel / d2;
          a.vx += (dx / Math.sqrt(d2)) * f * 0.04;
          a.vy += (dy / Math.sqrt(d2)) * f * 0.04;
        }

        // tiny brownian shimmer in constellation mode
        if (mode === 'constellation') {
          a.vx += (Math.random() - 0.5) * 0.04;
          a.vy += (Math.random() - 0.5) * 0.04;
        }
      }

      // edge spring (force only)
      if (mode === 'force') {
        edges.forEach(([i, j]) => {
          const a = nodes[i], b = nodes[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.sqrt(dx * dx + dy * dy) + 0.01;
          const diff = (d - linkRest) * linkStrength;
          const fx = (dx / d) * diff;
          const fy = (dy / d) * diff;
          if (dragging !== i) { a.vx += fx; a.vy += fy; }
          if (dragging !== j) { b.vx -= fx; b.vy -= fy; }
        });
      }

      // integrate
      const pad = orbSize * 0.7;
      for (const n of nodes) {
        n.vx *= damping;
        n.vy *= damping;
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < pad) { n.x = pad; n.vx *= -0.5; }
        if (n.x > w - pad) { n.x = w - pad; n.vx *= -0.5; }
        if (n.y < pad) { n.y = pad; n.vy *= -0.5; }
        if (n.y > h - pad) { n.y = h - pad; n.vy *= -0.5; }
      }

      // paint
      nodes.forEach((n, idx) => {
        nodeEls[idx].setAttribute('transform', `translate(${(n.x - n.size / 2).toFixed(2)}, ${(n.y - n.size / 2).toFixed(2)})`);
      });
      edgeEls.forEach(({ a, b, el }) => {
        el.setAttribute('x1', nodes[a].x.toFixed(2));
        el.setAttribute('y1', nodes[a].y.toFixed(2));
        el.setAttribute('x2', nodes[b].x.toFixed(2));
        el.setAttribute('y2', nodes[b].y.toFixed(2));
      });

      stopAnim = requestAnimationFrame(tick);
    }
    tick();
  }

  // ─────────────────────── view: periodic ───────────────────────
  function renderPeriodic() {
    const stage = ensureStage();
    const grid = document.createElement('div');
    grid.className = 'srf-periodic';
    stage.appendChild(grid);

    // sort by first tag, then title
    const sorted = SURFACES.slice().sort((a, b) => {
      const ta = (a.tags && a.tags[0]) || 'zzz';
      const tb = (b.tags && b.tags[0]) || 'zzz';
      if (ta !== tb) return ta.localeCompare(tb);
      return a.title.localeCompare(b.title);
    });

    sorted.forEach(s => {
      const cell = document.createElement('a');
      cell.className = 'srf-cell';
      cell.href = s.url;
      cell.target = s.url.startsWith('http') ? '_blank' : '_self';
      cell.rel = 'noopener';
      cell.addEventListener('click', (e) => {
        e.preventDefault();
        openDrawer(s);
      });

      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('viewBox', '0 0 88 88');
      const orb = nodeSVG(s, 88);
      svg.appendChild(orb);
      cell.appendChild(svg);

      const title = document.createElement('div');
      title.className = 'srf-cell-title';
      title.textContent = s.title;
      cell.appendChild(title);

      const flav = document.createElement('div');
      flav.className = 'srf-cell-flavor';
      flav.textContent = s.flavor || '';
      cell.appendChild(flav);

      const tags = document.createElement('div');
      tags.className = 'srf-cell-tags';
      (s.tags || []).forEach(t => {
        const span = document.createElement('span');
        span.className = 'srf-tag';
        span.textContent = '#' + t;
        tags.appendChild(span);
      });
      cell.appendChild(tags);

      grid.appendChild(cell);
    });
  }

  // ─────────────────────── drawer ───────────────────────
  function openDrawer(s) {
    const drawer = document.getElementById('srf-drawer');
    drawer.innerHTML = '';

    const close = document.createElement('button');
    close.className = 'srf-drawer-close';
    close.textContent = '✕ CLOSE';
    close.addEventListener('click', () => drawer.classList.remove('open'));
    drawer.appendChild(close);

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 140 140');
    svg.appendChild(nodeSVG(s, 140));
    drawer.appendChild(svg);

    const title = document.createElement('h2');
    title.className = 'srf-drawer-title';
    title.textContent = s.title;
    drawer.appendChild(title);

    if (s.flavor) {
      const flav = document.createElement('div');
      flav.className = 'srf-drawer-flavor';
      flav.textContent = s.flavor;
      drawer.appendChild(flav);
    }

    if (s.desc) {
      const desc = document.createElement('p');
      desc.className = 'srf-drawer-desc';
      desc.textContent = s.desc;
      drawer.appendChild(desc);
    }

    if (s.tags && s.tags.length) {
      const tagWrap = document.createElement('div');
      tagWrap.className = 'srf-drawer-tags';
      s.tags.forEach(t => {
        const span = document.createElement('span');
        span.className = 'srf-tag';
        span.textContent = '#' + t;
        tagWrap.appendChild(span);
      });
      drawer.appendChild(tagWrap);
    }

    const actions = document.createElement('div');
    actions.className = 'srf-drawer-actions';

    if (s.url) {
      const a = document.createElement('a');
      a.className = 'srf-action primary';
      a.href = s.url;
      a.target = s.url.startsWith('http') ? '_blank' : '_self';
      a.rel = 'noopener';
      a.textContent = s.local ? 'ENTER SURFACE →' : 'OPEN PROJECT →';
      actions.appendChild(a);
    }
    if (s.repo && s.repo !== s.url) {
      const a = document.createElement('a');
      a.className = 'srf-action';
      a.href = s.repo;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = 'SOURCE ↗';
      actions.appendChild(a);
    }
    drawer.appendChild(actions);

    drawer.classList.add('open');
  }

  // ─────────────────────── view switching ───────────────────────
  function switchView(view) {
    if (stopAnim) {
      cancelAnimationFrame(stopAnim);
      stopAnim = null;
    }
    CURRENT_VIEW = view;
    document.querySelectorAll('.srf-view-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.view === view);
    });
    if (view === 'constellation' || view === 'force') {
      renderCanvasView(view);
    } else if (view === 'periodic') {
      renderPeriodic();
    }
  }

  function buildControls() {
    const controls = document.getElementById('srf-controls');
    controls.innerHTML = '';
    (CFG.views || ['constellation', 'force', 'periodic']).forEach(v => {
      const b = document.createElement('button');
      b.className = 'srf-view-btn';
      b.dataset.view = v;
      b.textContent = v.toUpperCase();
      b.addEventListener('click', () => switchView(v));
      controls.appendChild(b);
    });
    const count = document.createElement('span');
    count.className = 'srf-count';
    count.textContent = SURFACES.length + ' surface' + (SURFACES.length === 1 ? '' : 's');
    controls.appendChild(count);
  }

  // ─────────────────────── boot ───────────────────────
  async function init() {
    try {
      const r = await fetch(CFG_PATH);
      if (!r.ok) throw new Error('failed to load ' + CFG_PATH);
      CFG = await r.json();
      SURFACES = CFG.surfaces || [];

      // header bits
      const n = CFG.node || {};
      const setText = (id, v) => { const el = document.getElementById(id); if (el && v) el.textContent = v; };
      setText('srf-brand', n.handle || 'SURFACES');
      setText('srf-tagline', n.tagline || '');
      setText('srf-subtitle', n.subtitle || '');

      document.title = (n.handle || 'SURFACES') + ' // lastnpcalex.agency';

      // intro markdown
      try {
        const mr = await fetch('surfaces/content/intro.md');
        if (mr.ok && typeof marked !== 'undefined') {
          document.getElementById('srf-intro').innerHTML = marked.parse(await mr.text());
        }
      } catch (_) {}

      buildControls();
      switchView(CFG.defaultView || 'constellation');

      // drawer close on outside
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') document.getElementById('srf-drawer').classList.remove('open');
      });
    } catch (e) {
      console.error('[SURFACES]', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.Surfaces = {
    getConfig: () => CFG,
    getSurfaces: () => SURFACES,
    switchView,
    openDrawer
  };
})();
