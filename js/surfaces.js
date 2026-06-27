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
  const HAS_SIMPLEX = typeof window.SimplexNoise !== 'undefined';

  let CFG = null;
  let SURFACES = [];
  let stopAnim = null;

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
    if (!HAS_THREE || !HAS_SIMPLEX) return null;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 300);
    camera.position.set(0, 45, 45);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const simplex = new SimplexNoise();
    scene.background = curBase;
    scene.fog = new THREE.FogExp2(curBase, 0.018);

    const geometry = new THREE.PlaneGeometry(200, 200, 300, 300);
    const uniforms = {
      uBaseColor: { value: curBase }, uLineColor: { value: curLines },
      uLightPos: { value: [] }, uLightColor: { value: [] }, uTime: { value: 0.0 }
    };
    const mat = new THREE.ShaderMaterial({
      uniforms, extensions: { derivatives: true },
      vertexShader: `
        varying float vE; varying vec3 vW;
        void main(){ vE = position.z; vec4 wp = modelMatrix * vec4(position,1.0); vW = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }
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
    return { scene, camera, renderer, geometry, uniforms, vlights, simplex, mo: 0, so: 0 };
  }

  function stepThree(t, dt) {
    if (!three) return;
    three.mo += dt * 0.008; three.so += dt * 6.0;
    curBase.lerp(toColor(target.base), 0.04);
    curLines.lerp(toColor(target.lines), 0.04);
    for (let i = 0; i < 3; i++) curSplotch[i].lerp(toColor(target.splotches[i]), 0.04);
    three.scene.background = curBase; three.scene.fog.color = curBase;
    three.uniforms.uBaseColor.value = curBase; three.uniforms.uLineColor.value = curLines; three.uniforms.uTime.value = t * 0.08;
    const p = three.geometry.attributes.position, so = three.so, mo = three.mo;
    for (let i = 0; i < p.count; i++) p.setZ(i, three.simplex.noise3D(p.getX(i) * 0.012, (p.getY(i) + so) * 0.012, mo) * 8.5);
    p.needsUpdate = true;
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

    const W = 1000, H = 1000;
    const svg = document.createElementNS(SVG_NS,'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('preserveAspectRatio','xMidYMid meet');
    wrap.appendChild(svg);

    const cx = W/2, cy = H/2;
    const radius = 360;          // icons pinned here
    const innerR = radius - 6;   // inner edge of arc segments
    const outerR = radius + 26;  // outer edge of arc segments (title band)
    const orbSize = 76;

    const items = SURFACES.concat([HOME]);
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

      // spike title — radiates outward off the arc
      const onLeft = Math.cos(n.a) < 0;
      const tlen = radius + 44;
      const tx = cx + Math.cos(n.a) * tlen, ty = cy + Math.sin(n.a) * tlen;
      const deg = (n.a * 180) / Math.PI, rot = onLeft ? deg + 180 : deg;
      const title = document.createElementNS(SVG_NS,'text');
      title.setAttribute('class','srf-spike-title'); title.setAttribute('x',String(tx)); title.setAttribute('y',String(ty));
      title.setAttribute('text-anchor', onLeft ? 'end' : 'start');
      title.setAttribute('transform',`rotate(${rot.toFixed(2)},${tx.toFixed(2)},${ty.toFixed(2)})`);
      title.textContent = n.s.title; g.appendChild(title);

      const flav = document.createElementNS(SVG_NS,'text');
      flav.setAttribute('class','srf-spike-flavor'); flav.setAttribute('x',String(tx)); flav.setAttribute('y',String(ty+13));
      flav.setAttribute('text-anchor', onLeft ? 'end' : 'start');
      flav.setAttribute('transform',`rotate(${rot.toFixed(2)},${tx.toFixed(2)},${ty.toFixed(2)})`);
      flav.textContent = (n.s.flavor||'').slice(0,40) + ((n.s.flavor||'').length>40?'…':'');
      g.appendChild(flav);

      // hover tooltip
      g.addEventListener('mouseenter', ()=>{
        tooltip.innerHTML = `<b>${n.s.title}</b><br><span class="srf-tt-flavor">${n.s.flavor||''}</span><br><span class="srf-tt-desc">${n.s.desc||''}</span>`;
        tooltip.style.display='block';
        const r = wrap.getBoundingClientRect();
        tooltip.style.left = (n.x/W*r.width + 14) + 'px';
        tooltip.style.top = (n.y/H*r.height - 12) + 'px';
      });
      g.addEventListener('mouseleave', ()=>{ tooltip.style.display='none'; });

      nodeLayer.appendChild(g);
      return g;
    });

    // ─── stochastic flux ribbons ──────────────────────────────────
    // each ribbon: two nodes connected by a quadratic Bezier whose control
    // point is pulled toward the ring center (chord-diagram arc). spawned
    // randomly, fade in, hold, fade out.
    const ribbons = [];
    const MAX_RIBBONS = 9;
    function spawnRibbon(){
      if (ribbons.length >= MAX_RIBBONS) return;
      let i = Math.floor(Math.random()*N), j = Math.floor(Math.random()*N);
      if (j === i) j = (j+1)%N;
      const a = nodes[i], b = nodes[j];
      const bow = 0.45 + Math.random()*0.30; // how far control points pull toward center
      const aMid = a.a, bMid = b.a;
      // control points on a smaller radius → ribbons arc inward
      const ctrlR = radius * (1 - bow);
      const cax = cx + Math.cos(aMid)*ctrlR, cay = cy + Math.sin(aMid)*ctrlR;
      const cbx = cx + Math.cos(bMid)*ctrlR, cby = cy + Math.sin(bMid)*ctrlR;
      const d = `M ${a.x} ${a.y} Q ${cax} ${cay} ${(a.x+b.x)/2} ${(a.y+b.y)/2} Q ${cbx} ${cby} ${b.x} ${b.y}`;
      // 3 stacked paths: halo, mid, core
      const make = (cls)=>{ const p=document.createElementNS(SVG_NS,'path'); p.setAttribute('d',d); p.setAttribute('class','srf-ribbon '+cls); fluxLayer.appendChild(p); return p; };
      const halo = make('srf-rib-halo'), mid = make('srf-rib-mid'), core = make('srf-rib-core');
      const pulse = document.createElementNS(SVG_NS,'circle');
      pulse.setAttribute('r','5'); pulse.setAttribute('class','srf-rib-pulse');
      fluxLayer.appendChild(pulse);
      ribbons.push({ a, b, cax, cay, cbx, cby, halo, mid, core, pulse, age:0, life: 2.4 + Math.random()*2.6 });
    }

    // animation
    const t0 = performance.now(); let last = t0, spawnTimer = 0;
    function tick(now){
      const t = (now - t0)/1000;
      const dt = Math.min(0.05, (now-last)/1000); last = now;

      stepThree(t, dt);

      // spawn cadence — stochastic
      spawnTimer += dt;
      if (spawnTimer > 0.35 + Math.random()*0.5){ spawnTimer = 0; spawnRibbon(); }

      const col = lineCSS();
      const colA = (al)=> lineCSS(al);

      // update ribbons
      for (let i = ribbons.length-1; i >= 0; i--){
        const r = ribbons[i];
        r.age += dt;
        const k = r.age / r.life;          // 0→1
        let op;
        if (k < 0.2) op = k/0.2;            // fade in
        else if (k > 0.8) op = (1-k)/0.2;  // fade out
        else op = 1;                         // hold
        if (k >= 1){
          r.halo.remove(); r.mid.remove(); r.core.remove(); r.pulse.remove();
          ribbons.splice(i,1); continue;
        }
        r.halo.setAttribute('stroke', colA(0.10*op));
        r.mid.setAttribute('stroke',  colA(0.32*op));
        r.core.setAttribute('stroke', colA(0.85*op));
        // traveling pulse along the ribbon (param along the Bezier-ish path)
        const pp = (Math.sin(t*1.3 + i)*0.5+0.5);
        const px = r.a.x + (r.b.x - r.a.x)*pp;
        const py = r.a.y + (r.b.y - r.a.y)*pp;
        r.pulse.setAttribute('cx', px.toFixed(2));
        r.pulse.setAttribute('cy', py.toFixed(2));
        r.pulse.setAttribute('fill', colA(0.9*op));
      }

      // theme color → arc strokes + titles via a stage var
      stage.style.setProperty('--ring-flux', col);

      stopAnim = requestAnimationFrame(tick);
    }
    stopAnim = requestAnimationFrame(tick);
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
    const count = document.createElement('span'); count.className='srf-count'; count.textContent = SURFACES.length + ' surface' + (SURFACES.length===1?'':'s'); c.appendChild(count);
  }

  // ─── boot ────────────────────────────────────────────────────────
  async function init(){
    try {
      const r = await fetch(CFG_PATH); if (!r.ok) throw new Error('cfg');
      CFG = await r.json(); SURFACES = CFG.surfaces || [];
      const n = CFG.node || {};
      const setT = (id,v)=>{ const e=document.getElementById(id); if(e&&v) e.textContent=v; };
      setT('srf-brand', n.handle||'SURFACES'); setT('srf-tagline', n.tagline||''); setT('srf-subtitle', n.subtitle||'');
      document.title = (n.handle||'SURFACES') + ' // lastnpcalex.agency';
      try { const mr = await fetch('surfaces/content/intro.md'); if (mr.ok && typeof marked!=='undefined') document.getElementById('srf-intro').innerHTML = marked.parse(await mr.text()); } catch(_){}
      buildControls();
      renderRing();
      document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') document.getElementById('srf-drawer').classList.remove('open'); });
    } catch(e){ console.error('[SURFACES]', e); }
  }

  window.addEventListener('resize', ()=>{
    if (three){
      three.camera.aspect = window.innerWidth / window.innerHeight;
      three.camera.updateProjectionMatrix();
      three.renderer.setSize(window.innerWidth, window.innerHeight);
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.Surfaces = { getConfig: ()=>CFG, getSurfaces: ()=>SURFACES, openDrawer };
})();
