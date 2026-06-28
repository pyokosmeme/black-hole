/**
 * SURFACES — Circos core
 *
 * Full redesign:
 *  - 3D topography (from the reference HTML) fills the whole viewport as a
 *    fixed background behind everything.
 *  - A true Circos/chord diagram: the circle is divided into fixed arc
 *    segments, one per surface (+ the lastnpcalex favicon "home" node).
 *    Icons are pinned to the circumference; they do not float.
 *    Titles spike outward like wheel spokes.
 *  - Flux is stochastic: quadratic-Bezier ribbons bowing toward the center,
 *    randomly spawned and fading in/out, colored to match the active theme
 *    (which also drives the topography shader).
 *  - One obvious style button cycles the four themes.
 *
 * Latent Glosses comments (transmission-comments.js) live in surfaces.html
 * and are not touched here.
 */

(function () {
  'use strict';

  const CFG_PATH = (window.SURFACES_CONFIG && window.SURFACES_CONFIG.configPath) || 'surfaces/config.json';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const HAS_THREE = typeof window.THREE !== 'undefined';

  let CFG = null;
  let SURFACES = [];
  let stopAnim = null;
  const PER_PAGE = 10;
  let page = 0; // current surfaces page (home node always present, not counted)

  // ─── themes ───────────────────────────────────────────────────────
  const palettes = [
    { name: 'High-Contrast Cools', base: [10, 25, 47], lines: [100, 255, 218], splotches: [[17, 34, 64], [2, 132, 199], [255, 183, 77]] },
    { name: 'Tactical Stealth',    base: [8, 8, 9],    lines: [57, 255, 20],  splotches: [[140, 145, 150], [75, 80, 85], [35, 40, 38]] },
    { name: 'Acid Burn (Dark)',    base: [13, 14, 21], lines: [0, 255, 240],  splotches: [[170, 0, 255], [210, 0, 255], [20, 30, 50]] },
    { name: 'Acid Burn (Light)',   base: [215, 210, 205], lines: [160, 32, 240], splotches: [[0, 220, 230], [255, 100, 255], [200, 190, 255]] }
  ];
  let themeIdx = 0;
  let target = palettes[0];

  const toColor = (a) => (HAS_THREE ? new THREE.Color(a[0] / 255, a[1] / 255, a[2] / 255) : null);
  const curBase = HAS_THREE ? toColor(target.base) : null;
  const curLines = HAS_THREE ? toColor(target.lines) : null;
  const curSplotch = HAS_THREE ? target.splotches.map(toColor) : null;

  // ─── three.js topography, fixed full-viewport ─────────────────────
  let three = null;
  function setupThree(mount) {
    if (!HAS_THREE) return null;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 300);
    camera.position.set(0, 45, 45);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 720 ? 1.5 : 2));
    mount.appendChild(renderer.domElement);

    scene.background = curBase;
    scene.fog = new THREE.FogExp2(curBase, 0.018);

    // resolution: 300 for crisp near-camera detail.
    // Terrain displacement now runs entirely in the GPU vertex shader (a hash-based
    // value-noise approximation of the original simplex), so there is NO per-frame
    // CPU vertex loop and NO vertex-buffer re-upload — geometry is static. This
    // keeps the morph fully animated while eliminating the 90k-vertex CPU cost.
    const gridRes = 300;
    const geometry = new THREE.PlaneGeometry(200, 200, gridRes, gridRes);
    const uniforms = {
      uBaseColor: { value: curBase }, uLineColor: { value: curLines },
      uLightPos: { value: [] }, uLightColor: { value: [] }, uTime: { value: 0.0 }
    };
    const mat = new THREE.ShaderMaterial({
      uniforms, extensions: { derivatives: true },
      vertexShader: `
        uniform float uTime;
        varying float vE; varying vec3 vW;
        // hash + value noise (GPU-friendly simplex substitute), fbm-summed for
        // the ridged detail simplex had.
        float hash(vec3 p){ p = fract(p*0.3183099+0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
        float vnoise(vec3 p){
          vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),
                        mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                    mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                        mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
        }
        // 3-octave fbm: recovers the high-frequency ridges single-octave value
        // noise lacked, so the topography isn't flattened.
        float fbm(vec3 p){
          float a = 0.5, s = 0.0, f = 1.0;
          for(int i=0;i<3;i++){ s += a * vnoise(p*f); f *= 2.0; a *= 0.5; }
          return s;
        }
        void main(){
          // uTime is raw seconds. scroll = so (6/sec, fast vertical slide),
          // morph = mo (0.008/sec, slow shape change) — matches the original
          // CPU simplex call: noise3D(x*0.012, (y+so)*0.012, mo) * 8.5
          vec3 p = position.xyz;
          float scroll = uTime * 6.0;
          float morph  = uTime * 0.008;
          float n = fbm(vec3(p.x*0.012, (p.y+scroll)*0.012, morph));
          float h = (n*2.0-1.0) * 8.5;            // center on 0, ±8.5 amplitude
          vec3 disp = vec3(p.x, p.y, h);
          vE = h;
          vec4 wp = modelMatrix * vec4(disp,1.0);
          vW = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uBaseColor, uLineColor, uLightPos[6], uLightColor[6];
        varying float vE; varying vec3 vW;
        void main(){
          float cd = vE * 0.8, cf = fract(cd), dl = min(cf, 1.0 - cf), pd = dl / fwidth(cd);
          float line = clamp((1.0 - clamp(pd - 1.2, 0.0, 1.0)) + exp(-pd / 8.0) * 0.55, 0.0, 1.0);
          float ne = clamp((vE + 6.0) / 12.0, 0.0, 1.0);
          vec3 surf = mix(uBaseColor * 0.4, uBaseColor * 1.2, ne);
          vec3 lighting = vec3(0.0);
          for(int i=0;i<6;i++){ lighting += uLightColor[i] * smoothstep(50.0, 0.0, distance(vW, uLightPos[i])); }
          vec3 fc = surf + (lighting * 0.8);
          fc = mix(fc, (uLineColor * 1.2) + (lighting * 0.5), line);
          gl_FragColor = vec4(fc, 1.0);
          float depth = gl_FragCoord.z / gl_FragCoord.w;
          gl_FragColor.rgb = mix(uBaseColor, gl_FragColor.rgb, exp2(-0.018 * 0.018 * depth * depth * 1.442695));
        }
      `
    });
    const terrain = new THREE.Mesh(geometry, mat);
    terrain.rotation.x = -Math.PI / 2;
    scene.add(terrain);

    const vlights = [];
    for (let i = 0; i < 6; i++) {
      vlights.push({ position: new THREE.Vector3((Math.random() - 0.5) * 120, 4 + Math.random() * 8, (Math.random() - 0.5) * 120), vx: (Math.random() - 0.5) * 0.05, vz: (Math.random() - 0.5) * 0.05, ci: i % 3 });
      uniforms.uLightPos.value.push(new THREE.Vector3());
      uniforms.uLightColor.value.push(new THREE.Color());
    }
    return { scene, camera, renderer, geometry, uniforms, vlights, mo: 0, so: 0 };
  }

  function stepThree(t, dt) {
    if (!three) return;
    // colors + lights still lerp on CPU (cheap: 6 lights + a few colors)
    curBase.lerp(toColor(target.base), 0.04);
    curLines.lerp(toColor(target.lines), 0.04);
    for (let i = 0; i < 3; i++) curSplotch[i].lerp(toColor(target.splotches[i]), 0.04);
    three.scene.background = curBase; three.scene.fog.color = curBase;
    three.uniforms.uBaseColor.value = curBase; three.uniforms.uLineColor.value = curLines;
    three.uniforms.uTime.value = t;  // raw seconds — shader derives scroll (×6) + morph (×0.008)
    for (let i = 0; i < 6; i++) {
      const L = three.vlights[i]; L.position.x += L.vx; L.position.z += L.vz;
      if (L.position.x < -80 || L.position.x > 80) L.vx *= -1;
      if (L.position.z < -80 || L.position.z > 80) L.vz *= -1;
      three.uniforms.uLightPos.value[i].copy(L.position);
      three.uniforms.uLightColor.value[i].copy(curSplotch[L.ci]);
    }
    three.camera.position.x = Math.sin(t * 0.2) * 10; three.camera.lookAt(0, 0, 0);
    three.renderer.render(three.scene, three.camera);
  }

  // current lerped line color as css color
  function lineCSS(a) {
    if (!HAS_THREE) return a == null ? 'rgb(100,255,218)' : `rgba(100,255,218,${a})`;
    const c = curLines, r = Math.round(c.r * 255), g = Math.round(c.g * 255), b = Math.round(c.b * 255);
    return a == null ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
  }

  // ─── orb visual (reused fractal star) ─────────────────────────────
  function hash32(s){ let h=2166136261>>>0; for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;} return h>>>0; }
  function mulberry32(seed){ let s=seed>>>0; return function(){ s=(s+0x6D2B79F5)>>>0; let t=s; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }

  function buildOrb(slug, size){
    const rnd = mulberry32(hash32(slug));
    const pts = 8 + Math.floor(rnd()*7);
    const innerR = size*(0.32+rnd()*0.10), outerR = size*0.48, spin = rnd()*Math.PI*2;
    const cx=size/2, cy=size/2, path=[];
    for(let i=0;i<pts*2;i++){ const r=i%2===0?outerR:innerR; const a=spin+(i/(pts*2))*Math.PI*2; path.push((i===0?'M':'L')+(cx+Math.cos(a)*r).toFixed(2)+','+(cy+Math.sin(a)*r).toFixed(2)); }
    path.push('Z');
    const lines=[]; const rc=2+Math.floor(rnd()*3);
    for(let r=1;r<=rc;r++){ const sR=innerR*(0.4+r*0.18), off=rnd()*Math.PI*2, sp=[]; for(let i=0;i<pts;i++){ const a=off+(i/pts)*Math.PI*2; sp.push((i===0?'M':'L')+(cx+Math.cos(a)*sR).toFixed(2)+','+(cy+Math.sin(a)*sR).toFixed(2)); } sp.push('Z'); lines.push(sp.join(' ')); }
    const id = slug.replace(/[^a-z0-9]/gi,'');
    return { gradId:'grad-'+id, glowId:'glow-'+id, starD:path.join(' '), lines, cx, cy, outerR };
  }

  function nodeSVG(surface, size){
    const o = buildOrb(surface.slug, size);
    const g = document.createElementNS(SVG_NS,'g');
    g.classList.add('srf-node-group'); g.dataset.slug = surface.slug;
    const defs = document.createElementNS(SVG_NS,'defs');
    defs.innerHTML = `
      <radialGradient id="${o.gradId}" cx="50%" cy="45%" r="55%">
        <stop offset="0%" stop-color="#fff4d0" stop-opacity="0.95"/>
        <stop offset="35%" stop-color="#ffd56b" stop-opacity="0.80"/>
        <stop offset="65%" stop-color="#ffb347" stop-opacity="0.55"/>
        <stop offset="100%" stop-color="#e08a2c" stop-opacity="0.20"/>
      </radialGradient>
      <filter id="${o.glowId}" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="${(size*0.04).toFixed(2)}" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>`;
    g.appendChild(defs);
    const star = document.createElementNS(SVG_NS,'path');
    star.setAttribute('d', o.starD); star.setAttribute('fill',`url(#${o.gradId})`);
    star.setAttribute('stroke','#ffd56b'); star.setAttribute('stroke-width','0.6'); star.setAttribute('stroke-opacity','0.6'); star.setAttribute('filter',`url(#${o.glowId})`);
    g.appendChild(star);
    o.lines.forEach((d,i)=>{ const p=document.createElementNS(SVG_NS,'path'); p.setAttribute('d',d); p.setAttribute('fill','none'); p.setAttribute('stroke',i===0?'#ff7eb6':'#ffd56b'); p.setAttribute('stroke-width','0.4'); p.setAttribute('stroke-opacity',String(0.45-i*0.08)); g.appendChild(p); });
    const core=document.createElementNS(SVG_NS,'circle'); core.setAttribute('cx',String(o.cx)); core.setAttribute('cy',String(o.cy)); core.setAttribute('r',String(size*0.06)); core.setAttribute('fill','#fff4d0'); core.setAttribute('opacity','0.85'); g.appendChild(core);
    return g;
  }

  // ─── Circos ring ─────────────────────────────────────────────────
  const HOME = { slug:'home', title:'lastnpcalex.agency', url:'https://lastnpcalex.agency/', tags:[], flavor:'back to the main signal ;; the agency node', desc:'Return to the main site.', local:true, isHome:true };

  function ensureStage(){ const s=document.getElementById('srf-stage'); s.innerHTML=''; return s; }

  function renderRing(){
    const stage = ensureStage();

    // mount the global topography background (full viewport, fixed)
    const topoMount = document.getElementById('srf-topo-bg');
    if (!topoMount.querySelector('canvas')) {
      three = setupThree(topoMount);
      if (!three) topoMount.classList.add('srf-topo-fallback');
    }

    const wrap = document.createElement('div');
    wrap.className = 'srf-circos-wrap';
    stage.appendChild(wrap);

    // size the SVG to the viewport so the circle dynamically fits the screen
    let W = window.innerWidth, H = window.innerHeight;
    const svg = document.createElementNS(SVG_NS,'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio','xMidYMid meet');
    wrap.appendChild(svg);

    // center the ring in the vertical space BELOW the top frame and ABOVE the
    // bottom, so top/bottom labels clear the style bar and the bottom edge.
    const topFrame = 80, bottomFrame = 40;
    let cx = W/2;
    const usableH = H - topFrame - bottomFrame;
    let cy = topFrame + usableH/2;
    const mobile = W < 720;
    // On mobile the screen is narrow, so reserve a WIDE gutter on each side and
    // let the ring shrink — side labels fan radially into the diagonal space,
    // never colliding with the ring or icons. On desktop keep a small gutter
    // since the screen is wide enough for fixed side columns.
    const gutter = mobile ? Math.min(W * 0.30, 130) : Math.min(W * 0.18, 160);
    let radius = Math.min(W/2 - gutter, usableH * 0.34, Math.min(W, H) * (mobile ? 0.30 : 0.40));
    radius = Math.max(mobile ? 80 : 90, radius);
    let innerR = radius - 6;   // inner edge of arc segments
    let outerR = radius + 26;  // outer edge of arc segments (title band)
    let orbSize = Math.max(mobile ? 44 : 54, Math.min(W, H) * (mobile ? 0.055 : 0.07));
    // per-side label x (desktop only — mobile uses radial placement):
    // clear the OUTER arc edge + leader gap, clamped to viewport.
    const sideGap = 30;
    const leftTextX  = Math.max(12, cx - outerR - sideGap);
    const rightTextX = Math.min(W - 12, cx + outerR + sideGap);
    // mobile: truncate titles harder so they fit the narrow gutter
    const titleMax = mobile ? 14 : 32;
    const flavMax  = mobile ? 0 : 32;
    // the label layer sits above flux, below nodes' hover glow
    const labelLayer = document.createElementNS(SVG_NS,'g');
    labelLayer.setAttribute('class','srf-label-layer');
    svg.appendChild(labelLayer);

    // paginate surfaces: ≤10 per page, home node always appended
    const totalPages = Math.max(1, Math.ceil(SURFACES.length / PER_PAGE));
    page = ((page % totalPages) + totalPages) % totalPages;
    const slice = SURFACES.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
    const items = slice.concat([HOME]);
    const N = items.length;
    const seg = (Math.PI * 2) / N;
    const startAngle = -Math.PI / 2; // first node at top

    // node positions pinned to the circle (icons do NOT move)
    const nodes = items.map((s, i) => {
      const a = startAngle + i * seg;
      return { s, a, x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius };
    });

    // arc-segment bands around the circle (Circos signature)
    const arcLayer = document.createElementNS(SVG_NS,'g');
    arcLayer.setAttribute('class','srf-circos-arcs');
    svg.appendChild(arcLayer);
    const arcEls = nodes.map((n, i) => {
      const a0 = n.a - seg/2, a1 = n.a + seg/2;
      const path = arcPath(cx, cy, innerR, outerR, a0, a1);
      const p = document.createElementNS(SVG_NS,'path');
      p.setAttribute('d', path); p.setAttribute('class','srf-circos-arc');
      arcLayer.appendChild(p);
      return p;
    });

    // flux ribbon layer (above arcs, below nodes)
    const fluxLayer = document.createElementNS(SVG_NS,'g');
    fluxLayer.setAttribute('class','srf-flux-layer');
    svg.appendChild(fluxLayer);

    // node layer — icons pinned to the circumference
    const nodeLayer = document.createElementNS(SVG_NS,'g');
    nodeLayer.setAttribute('class','srf-ring-group');
    svg.appendChild(nodeLayer);

    const tooltip = document.createElement('div');
    tooltip.className = 'srf-ring-tooltip';
    wrap.appendChild(tooltip);

    const nodeEls = nodes.map((n) => {
      const g = document.createElementNS(SVG_NS,'g');
      g.classList.add('srf-ring-node');

      if (n.s.isHome){
        const ring = document.createElementNS(SVG_NS,'circle');
        ring.setAttribute('class','srf-home-ring'); ring.setAttribute('cx',String(n.x)); ring.setAttribute('cy',String(n.y)); ring.setAttribute('r',String(orbSize*0.46));
        g.appendChild(ring);
        const img = document.createElementNS(SVG_NS,'image');
        img.setAttributeNS('http://www.w3.org/1999/xlink','xlink:href','img/favicon-32.png');
        img.setAttribute('href','img/favicon-32.png');
        img.setAttribute('x',String(n.x-orbSize*0.28)); img.setAttribute('y',String(n.y-orbSize*0.28));
        img.setAttribute('width',String(orbSize*0.56)); img.setAttribute('height',String(orbSize*0.56));
        g.appendChild(img);
        g.style.cursor='pointer';
        g.addEventListener('click', ()=>{ window.location.href = n.s.url; });
      } else {
        const inner = nodeSVG(n.s, orbSize);
        inner.setAttribute('transform', `translate(${(n.x-orbSize/2).toFixed(2)},${(n.y-orbSize/2).toFixed(2)})`);
        g.appendChild(inner);
        g.style.cursor='pointer';
        g.addEventListener('click', ()=> openDrawer(n.s));
      }

      // hover tooltip + flux targeting
      g.addEventListener('mouseenter', ()=>{
        hoveredNode = n;
        tooltip.innerHTML = `<b>${n.s.title}</b><br><span class="srf-tt-flavor">${n.s.flavor||''}</span><br><span class="srf-tt-desc">${n.s.desc||''}</span>`;
        tooltip.style.display='block';
        const r = wrap.getBoundingClientRect();
        tooltip.style.left = Math.min(r.width-240, n.x/W*r.width + 14) + 'px';
        tooltip.style.top = Math.max(8, n.y/H*r.height - 12) + 'px';
      });
      g.addEventListener('mouseleave', ()=>{ tooltip.style.display='none'; hoveredNode = null; });

      nodeLayer.appendChild(g);
      return { g, n };
    });

    // ─── leader labels (unit-circle radial placement) ───────────────
    // Each label sits radially just outside its node, along the node's angle,
    // text horizontal. This keeps every label clear of the circle itself and
    // of the top/bottom frames, instead of stacking at center where they collide.
    const rowH = 18;
    const labelR = radius + 10;          // leader bend point, just outside the ring
    const pad = mobile ? 8 : 14;
    // vertical keep-out zones for the style bar (top) and bottom area
    const topZone = topFrame + 6, bottomZone = bottomFrame + 6;

    function drawLabel(textX, y, anchor, leaderPath, bx, by, titleText, flavText){
      const line = document.createElementNS(SVG_NS,'path');
      line.setAttribute('class','srf-leader');
      line.setAttribute('d', leaderPath);
      labelLayer.appendChild(line);
      const dot = document.createElementNS(SVG_NS,'circle');
      dot.setAttribute('class','srf-leader-dot'); dot.setAttribute('cx',bx.toFixed(1)); dot.setAttribute('cy',by.toFixed(1)); dot.setAttribute('r','2');
      labelLayer.appendChild(dot);

      const title = document.createElementNS(SVG_NS,'text');
      title.setAttribute('class','srf-leader-title');
      title.setAttribute('y',(y-2).toFixed(1));
      title.setAttribute('text-anchor', anchor);
      title.textContent = titleText;
      labelLayer.appendChild(title);
      // measure + clamp so text never runs off the viewport edges
      try {
        const bb = title.getBBox();
        let x = textX;
        if (anchor === 'start') x = Math.min(x, W - pad - bb.width);
        else if (anchor === 'end') x = Math.max(x, pad + bb.width);
        else x = Math.min(Math.max(x, pad + bb.width/2), W - pad - bb.width/2);
        title.setAttribute('x', x.toFixed(1));
      } catch(_){ title.setAttribute('x', textX.toFixed(1)); }

      const flav = document.createElementNS(SVG_NS,'text');
      flav.setAttribute('class','srf-leader-flavor');
      flav.setAttribute('x', title.getAttribute('x'));
      flav.setAttribute('y',(y+12).toFixed(1));
      flav.setAttribute('text-anchor', anchor);
      flav.textContent = flavText;
      labelLayer.appendChild(flav);
    }

    // place every node's label radially outward along its angle.
    // near-vertical nodes stack their labels straight up/down (clearing
    // the top/bottom keep-out zones); side nodes place horizontal labels
    // stacked along the side, anchored away from the ring.
    const placed = { left: [], right: [], top: [], bottom: [] };
    function claimY(list, want, minGap){
      let y = want;
      while (list.some(p => Math.abs(p - y) < minGap)) y += minGap;
      list.push(y);
      return y;
    }

    nodeEls.forEach(({n})=>{
      const bx = cx + Math.cos(n.a) * labelR;
      const by = cy + Math.sin(n.a) * labelR;
      const flv = flavMax ? ((n.s.flavor||'').slice(0,flavMax) + ((n.s.flavor||'').length>flavMax?'…':'')) : '';
      const ttl = (n.s.title||'').slice(0,titleMax) + ((n.s.title||'').length>titleMax?'…':'');
      const cos = Math.cos(n.a), sin = Math.sin(n.a);
      const nearVert = Math.abs(cos) < 0.35;

      if (nearVert){
        // stack straight up (top half) or down (bottom half), clearing the
        // OUTER arc edge + the top/bottom frame keep-out zones.
        const isTop = sin < 0;
        const list = isTop ? placed.top : placed.bottom;
        const clear = outerR + 16; // distance from ring center the label must clear
        let y = isTop ? (cy - clear) : (cy + clear + rowH);
        y = claimY(list, y, rowH);
        if (isTop) y = Math.max(y, topZone + rowH);
        else      y = Math.min(y, H - bottomZone - rowH);
        const d = `M ${n.x.toFixed(1)} ${n.y.toFixed(1)} L ${bx.toFixed(1)} ${by.toFixed(1)} L ${cx.toFixed(1)} ${y.toFixed(1)}`;
        drawLabel(cx, y, 'middle', d, bx, by, ttl, flv);
      } else if (mobile){
        // mobile: tall + narrow screen. Place each side label OUTWARD from its
        // node — upper-half nodes label ABOVE, lower-half label BELOW — so labels
        // spread away from each other and away from neighboring nodes. Anchored
        // toward the nearer viewport edge so text reads inward→outward.
        const isLeft = cos < 0;
        const isTop = sin < 0;
        const list = isTop ? placed.top : placed.bottom;
        const offset = orbSize * 0.7 + (isTop ? rowH : 0);
        let y = claimY(list, isTop ? (n.y - offset) : (n.y + offset), rowH);
        if (isTop) y = Math.max(y, topZone + rowH);
        else       y = Math.min(y, H - bottomZone - rowH);
        const textX = isLeft ? pad + 2 : W - pad - 2;
        const elbowX = isLeft ? Math.min(bx, n.x) : Math.max(bx, n.x);
        const d = `M ${n.x.toFixed(1)} ${n.y.toFixed(1)} L ${bx.toFixed(1)} ${by.toFixed(1)} L ${elbowX.toFixed(1)} ${y.toFixed(1)} L ${textX.toFixed(1)} ${y.toFixed(1)}`;
        drawLabel(textX, y, isLeft ? 'start' : 'end', d, bx, by, ttl, flv);
      } else {
        const isLeft = cos < 0;
        const list = isLeft ? placed.left : placed.right;
        let y = claimY(list, n.y, rowH);
        const textX = isLeft ? leftTextX : rightTextX;
        const elbowX = isLeft ? cx - labelR : cx + labelR;
        const d = `M ${n.x.toFixed(1)} ${n.y.toFixed(1)} L ${bx.toFixed(1)} ${by.toFixed(1)} L ${elbowX.toFixed(1)} ${y.toFixed(1)} L ${textX.toFixed(1)} ${y.toFixed(1)}`;
        drawLabel(textX, y, isLeft?'end':'start', d, bx, by, ttl, flv);
      }
    });

    // ─── stochastic tracer flux ─────────────────────────────────────
    // each tracer sweeps OUT from one node and reaches across to connect
    // another (chord-diagram arc, control pulled toward center). dynamic
    // ink thickness: the head is thick, the tail tapers thin — animated
    // via a dashoffset reveal so the stroke "draws itself" outward. a
    // linear gradient + frosted-glass blur stack gives the glassy glow.
    const ribbons = [];
    const MAX_RIBBONS = 8;
    let hoveredNode = null;

    function spawnTracer(){
      if (ribbons.length >= MAX_RIBBONS) return;
      // when a node is hovered, bias tracers to point AT it (it's the bright head).
      // otherwise pick two random nodes.
      let a, b;
      if (hoveredNode && Math.random() < 0.75){
        b = hoveredNode;
        let i = Math.floor(Math.random()*N);
        if (nodes[i] === b) i = (i+1)%N;
        a = nodes[i];
      } else {
        let i = Math.floor(Math.random()*N), j = Math.floor(Math.random()*N);
        if (j === i) j = (j+1)%N;
        a = nodes[i]; b = nodes[j];
      }
      const bow = 0.40 + Math.random()*0.30;
      const ctrlR = radius * (1 - bow);
      const cax = cx + Math.cos(a.a)*ctrlR, cay = cy + Math.sin(a.a)*ctrlR;
      const cbx = cx + Math.cos(b.a)*ctrlR, cby = cy + Math.sin(b.a)*ctrlR;
      // a single smooth quadratic-Bezier arc from a → b (control near center)
      const d = `M ${a.x} ${a.y} Q ${(cax+cbx)/2} ${(cay+cby)/2} ${b.x} ${b.y}`;

      // unique gradient id, themed — fades from translucent (tail) to bright (head).
      // stops are re-colored each frame in tick() so flux follows the theme.
      const gid = 'rg' + Math.random().toString(36).slice(2,9);
      const grad = document.createElementNS(SVG_NS,'linearGradient');
      grad.setAttribute('id', gid);
      grad.setAttribute('gradientUnits','userSpaceOnUse');
      grad.setAttribute('x1', a.x); grad.setAttribute('y1', a.y);
      grad.setAttribute('x2', b.x); grad.setAttribute('y2', b.y);
      const s0 = document.createElementNS(SVG_NS,'stop'); s0.setAttribute('offset','0%');
      const s1 = document.createElementNS(SVG_NS,'stop'); s1.setAttribute('offset','45%');
      const s2 = document.createElementNS(SVG_NS,'stop'); s2.setAttribute('offset','100%');
      grad.appendChild(s0); grad.appendChild(s1); grad.appendChild(s2);
      fluxLayer.appendChild(grad);

      // frosted-glass stack: blurred halo + soft mid + crisp core
      const make = (cls)=>{ const p=document.createElementNS(SVG_NS,'path'); p.setAttribute('d',d); p.setAttribute('class','srf-tracer '+cls); p.setAttribute('stroke', `url(#${gid})`); fluxLayer.appendChild(p); return p; };
      const halo = make('srf-tr-halo'), mid = make('srf-tr-mid'), core = make('srf-tr-core');

      ribbons.push({
        a, b, d, halo, mid, core, gid, stops: [s0, s1, s2],
        len: approxPathLen(a.x, a.y, (cax+cbx)/2, (cay+cby)/2, b.x, b.y),
        age: 0, life: 1.6 + Math.random()*1.4,   // sweep + linger
        drawDur: 0.7 + Math.random()*0.4          // portion spent sweeping out
      });
    }

    // animation
    const t0 = performance.now(); let last = t0, spawnTimer = 0;
    function tick(now){
      const t = (now - t0)/1000;
      const dt = Math.min(0.05, (now-last)/1000); last = now;

      stepThree(t, dt);

      // stochastic spawn cadence
      spawnTimer += dt;
      if (spawnTimer > 0.4 + Math.random()*0.6){ spawnTimer = 0; spawnTracer(); }

      const col = lineCSS();
      const colA = (al)=> lineCSS(al);

      for (let i = ribbons.length-1; i >= 0; i--){
        const r = ribbons[i];
        r.age += dt;
        const k = r.age / r.life;          // 0→1 overall
        if (k >= 1){
          r.halo.remove(); r.mid.remove(); r.core.remove();
          const g = fluxLayer.querySelector('#'+r.gid); if (g) g.remove();
          ribbons.splice(i,1); continue;
        }

        // sweep progress: how far the tracer has drawn itself (0→1)
        const sweep = Math.min(1, k / (r.drawDur/r.life));
        const drawn = r.len * sweep;

        // dash: a "head" segment of length headLen reveals as it sweeps;
        // the visible drawn portion grows from 0 → full length.
        const headLen = r.len * 0.55;       // thick leading head
        const gap = r.len * 4;              // big gap so only the head shows while sweeping
        // while sweeping: show a moving head; after sweep done: full line visible
        let dash, off;
        if (sweep < 1){
          // moving tapered head — animates outward from a
          dash = headLen + ' ' + gap;
          off = -(drawn - headLen);
        } else {
          // fully drawn; linger then fade
          dash = r.len + ' 0'; off = 0;
        }

        // overall opacity: fade in during sweep, hold, fade out near end
        let op;
        if (k < 0.12) op = k/0.12;
        else if (k > 0.78) op = (1-k)/0.22;
        else op = 1;

        // dynamic ink thickness — thicker mid-life, thinner at the very ends
        const thick = 0.6 + Math.sin(Math.min(1, k/0.5) * Math.PI) * 1.0; // 0.6 → 1.6 → 0.6
        [r.halo, r.mid, r.core].forEach((el)=>{
          el.setAttribute('stroke-dasharray', dash);
          el.setAttribute('stroke-dashoffset', off.toFixed(2));
          el.setAttribute('opacity', op.toFixed(3));
        });
        r.halo.setAttribute('stroke-width', (thick * 9).toFixed(2));
        r.mid.setAttribute('stroke-width',  (thick * 3.2).toFixed(2));
        r.core.setAttribute('stroke-width',(thick * 1.1).toFixed(2));

        // recolor gradient stops to follow the lerped theme color
        r.stops[0].setAttribute('stop-color', col);
        r.stops[0].setAttribute('stop-opacity', (0.05 * op).toFixed(3));
        r.stops[1].setAttribute('stop-color', col);
        r.stops[1].setAttribute('stop-opacity', (0.55 * op).toFixed(3));
        r.stops[2].setAttribute('stop-color', col);
        r.stops[2].setAttribute('stop-opacity', (0.95 * op).toFixed(3));
      }

      // theme color → arc strokes + titles via a stage var
      stage.style.setProperty('--ring-flux', col);

      stopAnim = requestAnimationFrame(tick);
    }
    stopAnim = requestAnimationFrame(tick);

    // pager (only rendered when more than one page of surfaces exists)
    renderPager();
  }

  function renderPager(){
    const host = document.getElementById('srf-pager');
    if (!host) return;
    host.innerHTML = '';
    const totalPages = Math.max(1, Math.ceil(SURFACES.length / PER_PAGE));
    if (totalPages <= 1) return; // no pager when ≤10 surfaces

    const mk = (dir, label) => {
      const b = document.createElement('button');
      b.className = 'srf-page-arrow srf-page-' + dir;
      b.setAttribute('aria-label', label);
      b.innerHTML = dir === 'prev'
        ? '<svg viewBox="0 0 24 24"><path d="M16 5 L8 12 L16 19 Z"/></svg>'
        : '<svg viewBox="0 0 24 24"><path d="M8 5 L16 12 L8 19 Z"/></svg>';
      b.addEventListener('click', () => { page = (page + (dir === 'next' ? 1 : -1) + totalPages) % totalPages; renderRing(); });
      return b;
    };
    const counter = document.createElement('div');
    counter.className = 'srf-page-count';
    counter.textContent = (page + 1) + ' / ' + totalPages;

    host.appendChild(mk('prev', 'previous surfaces'));
    host.appendChild(counter);
    host.appendChild(mk('next', 'next surfaces'));
  }

  // crude quadratic-Bezier length estimate (good enough for dash math)
  function approxPathLen(x0,y0, cx,cy, x1,y1){
    const d1 = Math.hypot(cx-x0, cy-y0), d2 = Math.hypot(x1-cx, y1-cy);
    return d1 + d2;
  }

  // annular sector path between two radii and two angles
  function arcPath(cx, cy, r1, r2, a0, a1){
    const x0o = cx + Math.cos(a0)*r2, y0o = cy + Math.sin(a0)*r2;
    const x1o = cx + Math.cos(a1)*r2, y1o = cy + Math.sin(a1)*r2;
    const x1i = cx + Math.cos(a1)*r1, y1i = cy + Math.sin(a1)*r1;
    const x0i = cx + Math.cos(a0)*r1, y0i = cy + Math.sin(a0)*r1;
    const large = (a1 - a0) > Math.PI ? 1 : 0;
    return `M ${x0o} ${y0o} A ${r2} ${r2} 0 ${large} 1 ${x1o} ${y1o} L ${x1i} ${y1i} A ${r1} ${r1} 0 ${large} 0 ${x0i} ${y0i} Z`;
  }

  // ─── drawer (preserved) ──────────────────────────────────────────
  function openDrawer(s){
    const drawer = document.getElementById('srf-drawer'); drawer.innerHTML = '';
    const close = document.createElement('button'); close.className='srf-drawer-close'; close.textContent='✕ CLOSE'; close.addEventListener('click',()=>drawer.classList.remove('open')); drawer.appendChild(close);
    const svg = document.createElementNS(SVG_NS,'svg'); svg.setAttribute('viewBox','0 0 140 140'); svg.appendChild(nodeSVG(s,140)); drawer.appendChild(svg);
    const title = document.createElement('h2'); title.className='srf-drawer-title'; title.textContent=s.title; drawer.appendChild(title);
    if (s.flavor){ const f=document.createElement('div'); f.className='srf-drawer-flavor'; f.textContent=s.flavor; drawer.appendChild(f); }
    if (s.desc){ const d=document.createElement('p'); d.className='srf-drawer-desc'; d.textContent=s.desc; drawer.appendChild(d); }
    if (s.tags&&s.tags.length){ const t=document.createElement('div'); t.className='srf-drawer-tags'; s.tags.forEach(x=>{ const sp=document.createElement('span'); sp.className='srf-tag'; sp.textContent='#'+x; t.appendChild(sp); }); drawer.appendChild(t); }
    const actions = document.createElement('div'); actions.className='srf-drawer-actions';
    if (s.url){ const a=document.createElement('a'); a.className='srf-action primary'; a.href=s.url; a.target=s.url.startsWith('http')?'_blank':'_self'; a.rel='noopener'; a.textContent=s.local?'ENTER SURFACE →':'OPEN PROJECT →'; actions.appendChild(a); }
    if (s.repo&&s.repo!==s.url){ const a=document.createElement('a'); a.className='srf-action'; a.href=s.repo; a.target='_blank'; a.rel='noopener'; a.textContent='SOURCE ↗'; actions.appendChild(a); }
    drawer.appendChild(actions); drawer.classList.add('open');
  }

  // ─── controls: ONE obvious style button ──────────────────────────
  function buildControls(){
    const c = document.getElementById('srf-controls'); c.innerHTML = '';
    const mode = document.createElement('button');
    mode.className = 'srf-style-btn'; mode.id = 'srf-style-btn';
    mode.innerHTML = `<span class="srf-style-kicker">STYLE</span><span class="srf-style-name" id="srf-style-name">${target.name.toUpperCase()}</span>`;
    mode.addEventListener('click', ()=>{
      themeIdx = (themeIdx + 1) % palettes.length;
      target = palettes[themeIdx];
      document.getElementById('srf-style-name').textContent = target.name.toUpperCase();
    });
    c.appendChild(mode);

    // latent glosses trigger — rendered here so it survives innerHTML clears,
    // and sits inside the top frame next to STYLE + the count.
    const gloss = document.createElement('button');
    gloss.className = 'srf-glosses-trigger'; gloss.id = 'srf-glosses-btn';
    gloss.setAttribute('aria-expanded','false'); gloss.textContent = 'LATENT GLOSSES ▾';
    gloss.addEventListener('click', ()=>{
      const panel = document.getElementById('surfaces-comments-host');
      if (!panel) return;
      const open = !panel.hidden;
      panel.hidden = open;
      panel.querySelectorAll('details').forEach(d => { d.open = !open; });
      gloss.setAttribute('aria-expanded', String(!open));
      gloss.textContent = open ? 'LATENT GLOSSES ▾' : 'LATENT GLOSSES ▴';
    });
    c.appendChild(gloss);
  }

  // ─── boot ────────────────────────────────────────────────────────
  async function init(){
    try {
      const r = await fetch(CFG_PATH); if (!r.ok) throw new Error('cfg');
      CFG = await r.json(); SURFACES = CFG.surfaces || [];
      const n = CFG.node || {};
      document.title = (n.handle || 'SURFACES') + ' // lastnpcalex.agency';
      buildControls();
      renderRing();
      document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') document.getElementById('srf-drawer').classList.remove('open'); });
    } catch(e){ console.error('[SURFACES]', e); }
  }

  let resizeT = null;
  window.addEventListener('resize', ()=>{
    if (three){
      three.camera.aspect = window.innerWidth / window.innerHeight;
      three.camera.updateProjectionMatrix();
      three.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    // re-render the ring so the circle refits the new viewport
    clearTimeout(resizeT);
    resizeT = setTimeout(()=>{ if (SURFACES.length) renderRing(); }, 150);
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.Surfaces = { getConfig: ()=>CFG, getSurfaces: ()=>SURFACES, openDrawer };
})();
