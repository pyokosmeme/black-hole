/**
 * SURFACES — Circos ring core
 *
 * The constellation view is now a Circos-style ring: every surface sits on
 * the circumference of a circle, titles spike outward like wheel spokes, and
 * diffuse glow flux chords connect them over a 3D topography background.
 *
 * force + periodic views and the detail drawer are preserved unchanged.
 * The real Latent Glosses comments mount lives in surfaces.html and is not
 * touched here.
 *
 * Loads surfaces/config.json. Three.js + simplex-noise are expected to be
 * loaded on the page (see surfaces.html).
 */

(function () {
  'use strict';

  const CFG_PATH = (window.SURFACES_CONFIG && window.SURFACES_CONFIG.configPath) || 'surfaces/config.json';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const HAS_THREE = typeof window.THREE !== 'undefined';
  const HAS_SIMPLEX = typeof window.SimplexNoise !== 'undefined';

  let CFG = null;
  let SURFACES = [];
  let CURRENT_VIEW = 'constellation';
  let stopAnim = null;

  // ─────────────────────────────────────────────────────────────────
  // 0. THEME PALETTES — cycle via the mode button. colors lerp each
  //    frame and feed both the topography shader and the SVG ring.
  // ─────────────────────────────────────────────────────────────────
  const palettes = [
    {
      name: 'High-Contrast Cools',
      desc: 'Deep Teal & Cyan to make warm eyes pop.',
      base: [10, 25, 47], lines: [100, 255, 218],
      splotches: [[17, 34, 64], [2, 132, 199], [255, 183, 77]],
      text: [205, 255, 242]
    },
    {
      name: 'Tactical Stealth',
      desc: 'Neon green topology over Multicam Black flourishes.',
      base: [8, 8, 9], lines: [57, 255, 20],
      splotches: [[140, 145, 150], [75, 80, 85], [35, 40, 38]],
      text: [180, 255, 170]
    },
    {
      name: 'Acid Burn (Dark)',
      desc: 'Hacker-synthwave extracted from lastnpcalex.agency.',
      base: [13, 14, 21], lines: [0, 255, 240],
      splotches: [[170, 0, 255], [210, 0, 255], [20, 30, 50]],
      text: [185, 255, 250]
    },
    {
      name: 'Acid Burn (Light)',
      desc: 'Daylight overexposure extracted from lastnpcalex.agency.',
      base: [215, 210, 205], lines: [160, 32, 240],
      splotches: [[0, 220, 230], [255, 100, 255], [200, 190, 255]],
      text: [44, 12, 64]
    }
  ];
  let targetPaletteIndex = 0;
  let targetPalette = palettes[0];

  const toColor = (arr) => (HAS_THREE ? new THREE.Color(arr[0] / 255, arr[1] / 255, arr[2] / 255) : null);
  const currentBase = HAS_THREE ? toColor(targetPalette.base) : null;
  const currentLines = HAS_THREE ? toColor(targetPalette.lines) : null;
  const currentSplotches = HAS_THREE ? targetPalette.splotches.map(toColor) : null;

  let three = null; // { scene, camera, renderer, geometry, uniforms, virtualLights, simplex }

  function setupThree(container) {
    if (!HAS_THREE || !HAS_SIMPLEX) return null;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 300);
    camera.position.set(0, 45, 45);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const simplex = new SimplexNoise();
    scene.background = currentBase;
    scene.fog = new THREE.FogExp2(currentBase, 0.018);

    const mapSize = 200;
    const resolution = 300;
    const geometry = new THREE.PlaneGeometry(mapSize, mapSize, resolution, resolution);
    const uniforms = {
      uBaseColor: { value: currentBase },
      uLineColor: { value: currentLines },
      uLightPos: { value: [] },
      uLightColor: { value: [] },
      uTime: { value: 0.0 }
    };
    const terrainMaterial = new THREE.ShaderMaterial({
      uniforms,
      extensions: { derivatives: true },
      vertexShader: `
        varying float vElevation;
        varying vec3 vWorldPos;
        void main(){
          vElevation = position.z;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uBaseColor;
        uniform vec3 uLineColor;
        uniform vec3 uLightPos[6];
        uniform vec3 uLightColor[6];
        varying float vElevation;
        varying vec3 vWorldPos;
        void main(){
          float cd = vElevation * 0.8;
          float cf = fract(cd);
          float dl = min(cf, 1.0 - cf);
          float pd = dl / fwidth(cd);
          float core = 1.0 - clamp(pd - 1.2, 0.0, 1.0);
          float glow = exp(-pd / 8.0) * 0.55;
          float line = clamp(core + glow, 0.0, 1.0);
          float ne = clamp((vElevation + 6.0) / 12.0, 0.0, 1.0);
          vec3 surf = mix(uBaseColor * 0.4, uBaseColor * 1.2, ne);
          vec3 lighting = vec3(0.0);
          for(int i=0;i<6;i++){
            float d = distance(vWorldPos, uLightPos[i]);
            lighting += uLightColor[i] * smoothstep(50.0, 0.0, d);
          }
          vec3 fc = surf + (lighting * 0.8);
          fc = mix(fc, (uLineColor * 1.2) + (lighting * 0.5), line);
          gl_FragColor = vec4(fc, 1.0);
          float depth = gl_FragCoord.z / gl_FragCoord.w;
          float fog = exp2(-0.018 * 0.018 * depth * depth * 1.442695);
          gl_FragColor.rgb = mix(uBaseColor, gl_FragColor.rgb, fog);
        }
      `
    });
    const terrain = new THREE.Mesh(geometry, terrainMaterial);
    terrain.rotation.x = -Math.PI / 2;
    scene.add(terrain);

    const virtualLights = [];
    for (let i = 0; i < 6; i++) {
      virtualLights.push({
        position: new THREE.Vector3((Math.random() - 0.5) * 120, 4 + Math.random() * 8, (Math.random() - 0.5) * 120),
        vx: (Math.random() - 0.5) * 0.05,
        vz: (Math.random() - 0.5) * 0.05,
        colorIndex: i % 3
      });
      uniforms.uLightPos.value.push(new THREE.Vector3());
      uniforms.uLightColor.value.push(new THREE.Color());
    }

    return { scene, camera, renderer, geometry, uniforms, virtualLights, simplex, morphOffset: 0, slideOffset: 0 };
  }

  function stepThree(t, delta) {
    if (!three) return;
    // fixed hybrid motion
    three.morphOffset += delta * 0.008;
    three.slideOffset += delta * 6.0;

    // lerp theme colors
    currentBase.lerp(toColor(targetPalette.base), 0.04);
    currentLines.lerp(toColor(targetPalette.lines), 0.04);
    for (let i = 0; i < 3; i++) currentSplotches[i].lerp(toColor(targetPalette.splotches[i]), 0.04);

    three.scene.background = currentBase;
    three.scene.fog.color = currentBase;
    three.uniforms.uBaseColor.value = currentBase;
    three.uniforms.uLineColor.value = currentLines;
    three.uniforms.uTime.value = t * 0.08;

    const positions = three.geometry.attributes.position;
    const so = three.slideOffset, mo = three.morphOffset;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      positions.setZ(i, three.simplex.noise3D(x * 0.012, (y + so) * 0.012, mo) * 8.5);
    }
    positions.needsUpdate = true;

    for (let i = 0; i < 6; i++) {
      const L = three.virtualLights[i];
      L.position.x += L.vx; L.position.z += L.vz;
      if (L.position.x < -80 || L.position.x > 80) L.vx *= -1;
      if (L.position.z < -80 || L.position.z > 80) L.vz *= -1;
      three.uniforms.uLightPos.value[i].copy(L.position);
      three.uniforms.uLightColor.value[i].copy(currentSplotches[L.colorIndex]);
    }

    three.camera.position.x = Math.sin(t * 0.2) * 10;
    three.camera.lookAt(0, 0, 0);
    three.renderer.render(three.scene, three.camera);
  }

  // current lerped line color as rgb()/rgba() string for the SVG paint
  function lineRGB(a) {
    if (!HAS_THREE) return a === undefined ? 'rgb(100,255,218)' : `rgba(100,255,218,${a})`;
    const c = currentLines;
    const r = Math.round(c.r * 255), g = Math.round(c.g * 255), b = Math.round(c.b * 255);
    return a === undefined ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
  }

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

  // ─────────────────────── fractal-star orb (reused) ───────────────────────
  function buildFractalOrb(slug, size) {
    const rnd = mulberry32(hash32(slug));
    const points = 8 + Math.floor(rnd() * 7);
    const innerR = size * (0.32 + rnd() * 0.10);
    const outerR = size * 0.48;
    const spinOffset = rnd() * Math.PI * 2;
    const cx = size / 2, cy = size / 2;

    const path = [];
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = spinOffset + (i / (points * 2)) * Math.PI * 2;
      path.push((i === 0 ? 'M' : 'L') + (cx + Math.cos(angle) * r).toFixed(2) + ',' + (cy + Math.sin(angle) * r).toFixed(2));
    }
    path.push('Z');

    const lines = [];
    const ringCount = 2 + Math.floor(rnd() * 3);
    for (let r = 1; r <= ringCount; r++) {
      const subR = innerR * (0.4 + r * 0.18);
      const offset = rnd() * Math.PI * 2;
      const subPath = [];
      for (let i = 0; i < points; i++) {
        const angle = offset + (i / points) * Math.PI * 2;
        subPath.push((i === 0 ? 'M' : 'L') + (cx + Math.cos(angle) * subR).toFixed(2) + ',' + (cy + Math.sin(angle) * subR).toFixed(2));
      }
      subPath.push('Z');
      lines.push(subPath.join(' '));
    }

    const id = slug.replace(/[^a-z0-9]/gi, '');
    return { gradId: 'grad-' + id, glowId: 'glow-' + id, starD: path.join(' '), lines, cx, cy, outerR };
  }

  function nodeSVG(surface, size) {
    const orb = buildFractalOrb(surface.slug, size);
    const g = document.createElementNS(SVG_NS, 'g');
    g.classList.add('srf-node-group');
    g.dataset.slug = surface.slug;

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
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>`;
    g.appendChild(defs);

    const star = document.createElementNS(SVG_NS, 'path');
    star.setAttribute('d', orb.starD);
    star.setAttribute('fill', `url(#${orb.gradId})`);
    star.setAttribute('stroke', '#ffd56b');
    star.setAttribute('stroke-width', '0.6');
    star.setAttribute('stroke-opacity', '0.6');
    star.setAttribute('filter', `url(#${orb.glowId})`);
    g.appendChild(star);

    orb.lines.forEach((d, i) => {
      const p = document.createElementNS(SVG_NS, 'path');
      p.setAttribute('d', d);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', i === 0 ? '#ff7eb6' : '#ffd56b');
      p.setAttribute('stroke-width', '0.4');
      p.setAttribute('stroke-opacity', String(0.45 - i * 0.08));
      g.appendChild(p);
    });

    const core = document.createElementNS(SVG_NS, 'circle');
    core.setAttribute('cx', String(orb.cx));
    core.setAttribute('cy', String(orb.cy));
    core.setAttribute('r', String(size * 0.06));
    core.setAttribute('fill', '#fff4d0');
    core.setAttribute('opacity', '0.85');
    g.appendChild(core);

    return g;
  }

  // ─────────────────────── CIRCOS RING (constellation) ───────────────────────
  const HOME_NODE = {
    slug: 'home',
    title: 'lastnpcalex.agency',
    url: 'https://lastnpcalex.agency/',
    tags: [],
    flavor: 'back to the main signal ;; the agency node',
    desc: 'Return to the main site.',
    local: true,
    isHome: true
  };

  function ensureStage() {
    const stage = document.getElementById('srf-stage');
    stage.innerHTML = '';
    return stage;
  }

  function renderRingView() {
    const stage = ensureStage();
    const wrap = document.createElement('div');
    wrap.className = 'srf-canvas srf-circos';
    stage.appendChild(wrap);

    // topography background layer
    const bg = document.createElement('div');
    bg.className = 'srf-topo-bg';
    wrap.appendChild(bg);
    three = setupThree(bg);
    if (!three) bg.classList.add('srf-topo-fallback');

    const w = wrap.clientWidth || 1000;
    const h = wrap.clientHeight || 720;

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    wrap.appendChild(svg);

    const cx = w / 2, cy = h / 2;
    const radius = Math.min(w, h) * 0.34;
    const orbSize = 92;

    const nodes = SURFACES.concat([HOME_NODE]).map((s, i) => {
      const angle = (i / (SURFACES.length + 1)) * Math.PI * 2 - Math.PI / 2;
      return { s, angle, x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
    });

    // flux chords: non-neighbor offsets
    const chordOffsets = [3, 5];
    const chords = [];
    for (let i = 0; i < nodes.length; i++) {
      for (const off of chordOffsets) {
        const j = (i + off) % nodes.length;
        const a = Math.min(i, j), b = Math.max(i, j);
        if (!chords.find(c => c.a === a && c.b === b)) {
          chords.push({ a, b, phase: Math.random(), speed: 0.16 + Math.random() * 0.18 });
        }
      }
    }

    // defs for pulse gradient
    const defs = document.createElementNS(SVG_NS, 'defs');
    const pulseGrad = document.createElementNS(SVG_NS, 'radialGradient');
    pulseGrad.setAttribute('id', 'srf-pulse-grad');
    pulseGrad.innerHTML = `
      <stop offset="0%" stop-color="#fff4d0" stop-opacity="0.95"/>
      <stop offset="45%" stop-color="#fff4d0" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="#fff4d0" stop-opacity="0"/>`;
    defs.appendChild(pulseGrad);
    svg.appendChild(defs);

    // guide circle
    const guide = document.createElementNS(SVG_NS, 'circle');
    guide.setAttribute('class', 'srf-ring-guide');
    guide.setAttribute('cx', String(cx));
    guide.setAttribute('cy', String(cy));
    guide.setAttribute('r', String(radius));
    svg.appendChild(guide);

    // chord layers: halo / mid / core
    const chordLayers = ['srf-flux-halo', 'srf-flux-mid', 'srf-flux-core'].map(cls => {
      const layer = document.createElementNS(SVG_NS, 'g');
      layer.setAttribute('class', 'srf-flux-layer ' + cls);
      svg.appendChild(layer);
      return layer;
    });
    const pulseLayer = document.createElementNS(SVG_NS, 'g');
    pulseLayer.setAttribute('class', 'srf-flux-pulse-layer');
    svg.appendChild(pulseLayer);

    const chordEls = chords.map(c => {
      const lineEls = chordLayers.map(layer => {
        const ln = document.createElementNS(SVG_NS, 'line');
        ln.setAttribute('class', 'srf-flux-line');
        layer.appendChild(ln);
        return ln;
      });
      const pulse = document.createElementNS(SVG_NS, 'circle');
      pulse.setAttribute('class', 'srf-flux-pulse');
      pulse.setAttribute('r', '7');
      pulse.setAttribute('fill', 'url(#srf-pulse-grad)');
      pulseLayer.appendChild(pulse);
      return { ...c, lineEls, pulse };
    });

    // node layer (rotates as a group)
    const ringGroup = document.createElementNS(SVG_NS, 'g');
    ringGroup.setAttribute('class', 'srf-ring-group');
    svg.appendChild(ringGroup);

    const nodeEls = nodes.map((n) => {
      const wrapG = document.createElementNS(SVG_NS, 'g');
      wrapG.classList.add('srf-ring-node');

      if (n.s.isHome) {
        // favicon home node — clickable circle with the site icon
        const ring = document.createElementNS(SVG_NS, 'circle');
        ring.setAttribute('class', 'srf-home-ring');
        ring.setAttribute('cx', String(n.x));
        ring.setAttribute('cy', String(n.y));
        ring.setAttribute('r', String(orbSize * 0.42));
        wrapG.appendChild(ring);

        const img = document.createElementNS(SVG_NS, 'image');
        img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', 'img/favicon-32.png');
        img.setAttribute('href', 'img/favicon-32.png');
        img.setAttribute('x', String(n.x - orbSize * 0.26));
        img.setAttribute('y', String(n.y - orbSize * 0.26));
        img.setAttribute('width', String(orbSize * 0.52));
        img.setAttribute('height', String(orbSize * 0.52));
        wrapG.appendChild(img);

        wrapG.style.cursor = 'pointer';
        wrapG.addEventListener('click', () => { window.location.href = n.s.url; });
      } else {
        const inner = nodeSVG(n.s, orbSize);
        inner.setAttribute('transform', `translate(${(n.x - orbSize / 2).toFixed(2)}, ${(n.y - orbSize / 2).toFixed(2)})`);
        wrapG.appendChild(inner);
        wrapG.style.cursor = 'pointer';
        wrapG.addEventListener('click', () => openDrawer(n.s));
      }

      // spike title — radial, outside the ring, flipped on the left half
      const outward = n.angle;
      const onLeft = Math.cos(outward) < 0;
      const spikeLen = radius + orbSize * 0.7;
      const tx = cx + Math.cos(outward) * spikeLen;
      const ty = cy + Math.sin(outward) * spikeLen;
      const deg = (outward * 180) / Math.PI;
      const rot = onLeft ? deg + 180 : deg;

      const title = document.createElementNS(SVG_NS, 'text');
      title.setAttribute('class', 'srf-spike-title');
      title.setAttribute('x', String(tx));
      title.setAttribute('y', String(ty));
      title.setAttribute('text-anchor', onLeft ? 'end' : 'start');
      title.setAttribute('transform', `rotate(${rot.toFixed(2)}, ${tx.toFixed(2)}, ${ty.toFixed(2)})`);
      title.textContent = n.s.title;
      wrapG.appendChild(title);

      const flav = document.createElementNS(SVG_NS, 'text');
      flav.setAttribute('class', 'srf-spike-flavor');
      flav.setAttribute('x', String(tx));
      flav.setAttribute('y', String(ty + 14));
      flav.setAttribute('text-anchor', onLeft ? 'end' : 'start');
      flav.setAttribute('transform', `rotate(${rot.toFixed(2)}, ${tx.toFixed(2)}, ${ty.toFixed(2)})`);
      flav.textContent = (n.s.flavor || '').length > 42 ? (n.s.flavor.slice(0, 40) + '…') : (n.s.flavor || '');
      wrapG.appendChild(flav);

      ringGroup.appendChild(wrapG);
      return wrapG;
    });

    // tooltip for hover descriptions
    const tooltip = document.createElement('div');
    tooltip.className = 'srf-ring-tooltip';
    stage.appendChild(tooltip);
    nodeEls.forEach((el, idx) => {
      const n = nodes[idx];
      el.addEventListener('mouseenter', () => {
        const rect = wrap.getBoundingClientRect();
        tooltip.innerHTML = `<b>${n.s.title}</b><br><span class="srf-tt-flavor">${n.s.flavor || ''}</span><br><span class="srf-tt-desc">${n.s.desc || ''}</span>`;
        tooltip.style.display = 'block';
        tooltip.style.left = (n.x / w * rect.width + 12) + 'px';
        tooltip.style.top = (n.y / h * rect.height - 10) + 'px';
      });
      el.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
    });

    // animation tick
    const start = performance.now();
    let last = start;
    function tick(now) {
      const t = (now - start) / 1000;
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;

      // background topography (hybrid)
      stepThree(t, delta);

      // slow ring rotation
      const ringRot = (t * 3) % 360;
      ringGroup.setAttribute('transform', `rotate(${ringRot.toFixed(2)} ${cx} ${cy})`);

      // flux chords: endpoints track the rotating nodes; pulse color follows theme
      const stroke = lineRGB();
      chordEls.forEach(c => {
        const a = nodes[c.a], b = nodes[c.b];
        const ra = a.angle + (ringRot * Math.PI) / 180;
        const rb = b.angle + (ringRot * Math.PI) / 180;
        const ax = cx + Math.cos(ra) * radius, ay = cy + Math.sin(ra) * radius;
        const bx = cx + Math.cos(rb) * radius, by = cy + Math.sin(rb) * radius;
        c.lineEls.forEach(ln => {
          ln.setAttribute('x1', ax.toFixed(2));
          ln.setAttribute('y1', ay.toFixed(2));
          ln.setAttribute('x2', bx.toFixed(2));
          ln.setAttribute('y2', by.toFixed(2));
          ln.setAttribute('stroke', stroke);
        });
        const prog = (t * c.speed + c.phase) % 1;
        c.pulse.setAttribute('cx', (ax + (bx - ax) * prog).toFixed(2));
        c.pulse.setAttribute('cy', (ay + (by - ay) * prog).toFixed(2));
        c.pulse.setAttribute('fill', stroke);
      });

      // push theme color to stage CSS var so orb strokes / titles track
      stage.style.setProperty('--ring-flux', lineRGB());

      stopAnim = requestAnimationFrame(tick);
    }
    stopAnim = requestAnimationFrame(tick);
  }

  // ─────────────────────── view: force (preserved, light) ───────────────────────
  function renderForceView() {
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
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.32;
    const nodes = SURFACES.map((s, i) => {
      const rnd = mulberry32(hash32(s.slug + '|pos'));
      const angle = (i / SURFACES.length) * Math.PI * 2 + rnd() * 0.4;
      const radius = r * (0.6 + rnd() * 0.5);
      return { s, x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius, vx: (rnd() - 0.5) * 0.25, vy: (rnd() - 0.5) * 0.25, size: orbSize };
    });
    const edges = [];
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      if ((nodes[i].s.tags || []).some(t => (nodes[j].s.tags || []).includes(t))) edges.push([i, j]);
    }
    const edgeLayer = document.createElementNS(SVG_NS, 'g'); svg.appendChild(edgeLayer);
    const edgeEls = edges.map(([a, b]) => { const ln = document.createElementNS(SVG_NS, 'line'); ln.setAttribute('class', 'srf-edge'); edgeLayer.appendChild(ln); return { a, b, el: ln }; });
    const nodeLayer = document.createElementNS(SVG_NS, 'g'); svg.appendChild(nodeLayer);
    const nodeEls = nodes.map((n) => {
      const wrapG = document.createElementNS(SVG_NS, 'g');
      const inner = nodeSVG(n.s, n.size); wrapG.appendChild(inner);
      const labelY = n.size / 2 + n.size * 0.55;
      const label = document.createElementNS(SVG_NS, 'text'); label.setAttribute('class', 'srf-node-label'); label.setAttribute('x', String(n.size / 2)); label.setAttribute('y', String(labelY)); label.textContent = n.s.title; wrapG.appendChild(label);
      if (n.s.flavor) { const flav = document.createElementNS(SVG_NS, 'text'); flav.setAttribute('class', 'srf-node-flavor'); flav.setAttribute('x', String(n.size / 2)); flav.setAttribute('y', String(labelY + 14)); flav.textContent = n.s.flavor.length > 48 ? n.s.flavor.slice(0, 46) + '…' : n.s.flavor; wrapG.appendChild(flav); }
      wrapG.style.cursor = 'grab'; wrapG.addEventListener('click', () => openDrawer(n.s));
      nodeLayer.appendChild(wrapG); return wrapG;
    });
    let dragging = null;
    nodeEls.forEach((el, idx) => { el.addEventListener('mousedown', (e) => { e.preventDefault(); dragging = idx; el.style.cursor = 'grabbing'; }); });
    window.addEventListener('mouseup', () => { if (dragging !== null) nodeEls[dragging].style.cursor = 'grab'; dragging = null; });
    svg.addEventListener('mousemove', (e) => { if (dragging === null) return; const rect = svg.getBoundingClientRect(); nodes[dragging].x = ((e.clientX - rect.left) / rect.width) * w; nodes[dragging].y = ((e.clientY - rect.top) / rect.height) * h; nodes[dragging].vx = 0; nodes[dragging].vy = 0; });
    function tick() {
      const repel = 2400, center = 0.0008, linkStrength = 0.012, linkRest = orbSize * 2.4;
      for (let i = 0; i < nodes.length; i++) { const a = nodes[i]; if (dragging === i) continue; a.vx += (cx - a.x) * center; a.vy += (cy - a.y) * center; for (let j = 0; j < nodes.length; j++) { if (i === j) continue; const b = nodes[j]; const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy + 1; a.vx += (dx / Math.sqrt(d2)) * (repel / d2) * 0.04; a.vy += (dy / Math.sqrt(d2)) * (repel / d2) * 0.04; } }
      edges.forEach(([i, j]) => { const a = nodes[i], b = nodes[j]; const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) + 0.01; const diff = (d - linkRest) * linkStrength; const fx = (dx / d) * diff, fy = (dy / d) * diff; if (dragging !== i) { a.vx += fx; a.vy += fy; } if (dragging !== j) { b.vx -= fx; b.vy -= fy; } });
      const pad = orbSize * 0.7;
      for (const n of nodes) { n.vx *= 0.94; n.vy *= 0.94; n.x += n.vx; n.y += n.vy; if (n.x < pad) { n.x = pad; n.vx *= -0.5; } if (n.x > w - pad) { n.x = w - pad; n.vx *= -0.5; } if (n.y < pad) { n.y = pad; n.vy *= -0.5; } if (n.y > h - pad) { n.y = h - pad; n.vy *= -0.5; } }
      nodes.forEach((n, idx) => nodeEls[idx].setAttribute('transform', `translate(${(n.x - n.size / 2).toFixed(2)}, ${(n.y - n.size / 2).toFixed(2)})`));
      edgeEls.forEach(({ a, b, el }) => { el.setAttribute('x1', nodes[a].x.toFixed(2)); el.setAttribute('y1', nodes[a].y.toFixed(2)); el.setAttribute('x2', nodes[b].x.toFixed(2)); el.setAttribute('y2', nodes[b].y.toFixed(2)); });
      stopAnim = requestAnimationFrame(tick);
    }
    tick();
  }

  // ─────────────────────── view: periodic (preserved) ───────────────────────
  function renderPeriodic() {
    const stage = ensureStage();
    const grid = document.createElement('div');
    grid.className = 'srf-periodic';
    stage.appendChild(grid);
    const sorted = SURFACES.slice().sort((a, b) => {
      const ta = (a.tags && a.tags[0]) || 'zzz', tb = (b.tags && b.tags[0]) || 'zzz';
      if (ta !== tb) return ta.localeCompare(tb);
      return a.title.localeCompare(b.title);
    });
    sorted.forEach(s => {
      const cell = document.createElement('a');
      cell.className = 'srf-cell'; cell.href = s.url; cell.target = s.url.startsWith('http') ? '_blank' : '_self'; cell.rel = 'noopener';
      const svg = document.createElementNS(SVG_NS, 'svg'); svg.setAttribute('viewBox', '0 0 88 88'); svg.appendChild(nodeSVG(s, 88)); cell.appendChild(svg);
      const title = document.createElement('div'); title.className = 'srf-cell-title'; title.textContent = s.title; cell.appendChild(title);
      const flav = document.createElement('div'); flav.className = 'srf-cell-flavor'; flav.textContent = s.flavor || ''; cell.appendChild(flav);
      const tags = document.createElement('div'); tags.className = 'srf-cell-tags'; (s.tags || []).forEach(t => { const span = document.createElement('span'); span.className = 'srf-tag'; span.textContent = '#' + t; tags.appendChild(span); }); cell.appendChild(tags);
      const open = document.createElement('div'); open.className = 'srf-cell-open'; open.textContent = s.local ? 'ENTER SURFACE ->' : 'OPEN PROJECT ->'; cell.appendChild(open);
      grid.appendChild(cell);
    });
  }

  // ─────────────────────── drawer (preserved) ───────────────────────
  function openDrawer(s) {
    const drawer = document.getElementById('srf-drawer');
    drawer.innerHTML = '';
    const close = document.createElement('button'); close.className = 'srf-drawer-close'; close.textContent = '✕ CLOSE'; close.addEventListener('click', () => drawer.classList.remove('open')); drawer.appendChild(close);
    const svg = document.createElementNS(SVG_NS, 'svg'); svg.setAttribute('viewBox', '0 0 140 140'); svg.appendChild(nodeSVG(s, 140)); drawer.appendChild(svg);
    const title = document.createElement('h2'); title.className = 'srf-drawer-title'; title.textContent = s.title; drawer.appendChild(title);
    if (s.flavor) { const flav = document.createElement('div'); flav.className = 'srf-drawer-flavor'; flav.textContent = s.flavor; drawer.appendChild(flav); }
    if (s.desc) { const desc = document.createElement('p'); desc.className = 'srf-drawer-desc'; desc.textContent = s.desc; drawer.appendChild(desc); }
    if (s.tags && s.tags.length) { const tagWrap = document.createElement('div'); tagWrap.className = 'srf-drawer-tags'; s.tags.forEach(t => { const span = document.createElement('span'); span.className = 'srf-tag'; span.textContent = '#' + t; tagWrap.appendChild(span); }); drawer.appendChild(tagWrap); }
    const actions = document.createElement('div'); actions.className = 'srf-drawer-actions';
    if (s.url) { const a = document.createElement('a'); a.className = 'srf-action primary'; a.href = s.url; a.target = s.url.startsWith('http') ? '_blank' : '_self'; a.rel = 'noopener'; a.textContent = s.local ? 'ENTER SURFACE →' : 'OPEN PROJECT →'; actions.appendChild(a); }
    if (s.repo && s.repo !== s.url) { const a = document.createElement('a'); a.className = 'srf-action'; a.href = s.repo; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'SOURCE ↗'; actions.appendChild(a); }
    drawer.appendChild(actions);
    drawer.classList.add('open');
  }

  // ─────────────────────── view switching ───────────────────────
  function switchView(view) {
    if (stopAnim) { cancelAnimationFrame(stopAnim); stopAnim = null; }
    // tear down three if leaving the ring view
    if (view !== 'constellation' && three) {
      three.renderer.dispose();
      three = null;
    }
    CURRENT_VIEW = view;
    document.querySelectorAll('.srf-view-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    if (view === 'constellation') renderRingView();
    else if (view === 'force') renderForceView();
    else if (view === 'periodic') renderPeriodic();
  }

  function buildControls() {
    const controls = document.getElementById('srf-controls');
    controls.innerHTML = '';
    (CFG.views || ['constellation', 'force', 'periodic']).forEach(v => {
      const b = document.createElement('button');
      b.className = 'srf-view-btn'; b.dataset.view = v; b.textContent = v.toUpperCase();
      b.addEventListener('click', () => switchView(v));
      controls.appendChild(b);
    });
    // theme mode button
    const mode = document.createElement('button');
    mode.className = 'srf-view-btn srf-mode-btn';
    mode.id = 'srf-mode-btn';
    mode.textContent = 'THEME: ' + targetPalette.name.toUpperCase();
    mode.addEventListener('click', () => {
      targetPaletteIndex = (targetPaletteIndex + 1) % palettes.length;
      targetPalette = palettes[targetPaletteIndex];
      mode.textContent = 'THEME: ' + targetPalette.name.toUpperCase();
    });
    controls.appendChild(mode);
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

      const n = CFG.node || {};
      const setText = (id, v) => { const el = document.getElementById(id); if (el && v) el.textContent = v; };
      setText('srf-brand', n.handle || 'SURFACES');
      setText('srf-tagline', n.tagline || '');
      setText('srf-subtitle', n.subtitle || '');
      document.title = (n.handle || 'SURFACES') + ' // lastnpcalex.agency';

      try {
        const mr = await fetch('surfaces/content/intro.md');
        if (mr.ok && typeof marked !== 'undefined') document.getElementById('srf-intro').innerHTML = marked.parse(await mr.text());
      } catch (_) {}

      buildControls();
      switchView(CFG.defaultView || 'constellation');

      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.getElementById('srf-drawer').classList.remove('open'); });
    } catch (e) {
      console.error('[SURFACES]', e);
    }
  }

  // resize the three renderer with the stage
  window.addEventListener('resize', () => {
    if (three) {
      const bg = document.querySelector('.srf-topo-bg');
      if (bg) {
        three.camera.aspect = bg.clientWidth / bg.clientHeight;
        three.camera.updateProjectionMatrix();
        three.renderer.setSize(bg.clientWidth, bg.clientHeight);
      }
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.Surfaces = { getConfig: () => CFG, getSurfaces: () => SURFACES, switchView, openDrawer };
})();
