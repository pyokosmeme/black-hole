(function () {
  const DEFAULT_CONFIG = {
    enabled: true,
    mode: 'background',
    opacity: 0.25,
    quality: 0.75,
    center: [0.5, 0.42],
    rs: 1.0,
    disk: false,
    animate: true
  };

  const vertexShaderSrc = `
    attribute vec2 position;
    void main() {
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const fragmentShaderSrc = `
    precision highp float;

    uniform vec2 u_resolution;
    uniform float u_time;
    uniform vec2 u_center;
    uniform float u_opacity;
    uniform float u_rs;
    uniform bool u_disk;
    uniform bool u_reducedMotion;

    // hash and noise helpers
    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 345.45));
      p += dot(p, p + 34.345);
      return fract(p.x * p.y);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }

    vec2 rotateVec(vec2 v, float a) {
      float s = sin(a);
      float c = cos(a);
      return vec2(v.x * c - v.y * s, v.x * s + v.y * c);
    }

    vec2 lens(vec2 uv, vec2 center, float rs) {
      vec2 rel = uv - center;
      float r = length(rel);
      float eps = 1e-4;
      r = max(r, eps);

      // Approximate bending angle inspired by Schwarzschild deflection
      float photonSphere = 1.5 * rs;
      float b = r; // impact parameter proxy in screen space
      float bend = (4.0 * rs) / max(b, rs * 0.5);
      float falloff = exp(-pow(b / (rs * 6.0), 2.0));
      bend *= falloff;

      // Stronger twist near photon sphere
      float ringBoost = smoothstep(photonSphere * 1.1, photonSphere * 0.6, b);
      bend += ringBoost * 0.6;

      vec2 dir = rel / r;
      vec2 tangential = vec2(-dir.y, dir.x);
      vec2 deflected = normalize(dir * cos(bend) + tangential * sin(bend));

      float projected = r + bend * rs * 0.3;
      return center + deflected * projected;
    }

    vec3 gridField(vec2 p, float time) {
      // animated neon grid in cyan/purple
      float scale = 6.0;
      vec2 gp = p * scale;
      gp += vec2(time * 0.05, time * 0.03);
      vec2 cell = fract(gp) - 0.5;
      vec2 g = abs(cell);
      float line = min(g.x, g.y);
      float grid = smoothstep(0.15, 0.0, line);

      // pulsing bands
      float stripe = 0.5 + 0.5 * sin(gp.x * 3.1415 + time * 0.4);
      vec3 base = mix(vec3(0.0, 1.0, 1.0), vec3(0.75, 0.0, 1.0), stripe);
      base *= grid;

      // faint diagonals
      float diag = abs(fract((gp.x + gp.y) * 0.5) - 0.5);
      base += vec3(0.1, 0.05, 0.15) * smoothstep(0.48, 0.4, diag);

      return base;
    }

    float starField(vec2 uv, float time) {
      float n = noise(uv * 200.0 + time * 0.5);
      n = pow(n, 12.0);
      return n;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / u_resolution;
      float aspect = u_resolution.x / u_resolution.y;
      vec2 centered = (uv - 0.5) * vec2(aspect, 1.0) + 0.5;

      float t = u_reducedMotion ? 0.0 : u_time;

      // lensing
      vec2 warped = lens(centered, u_center, u_rs);

      // background grid and stars sampled at warped coordinates
      vec3 grid = gridField(warped, t);
      float stars = starField(warped, t);
      vec3 color = grid + stars * vec3(0.5, 0.7, 1.2);

      // shadow + ring
      float r = length(centered - u_center);
      float event = smoothstep(u_rs * 1.2, u_rs * 0.9, r);
      float photonRing = exp(-pow((r - 1.5 * u_rs) / (0.25 * u_rs), 2.0));
      color *= 1.0 - event;
      color += photonRing * vec3(1.2, 0.4, 1.8);

      if (u_disk) {
        float disk = exp(-pow((r - 2.4 * u_rs) / (0.4 * u_rs), 2.0));
        vec3 diskColor = vec3(0.6, 0.0, 1.4) + 0.4 * sin(vec3(1.0, 1.7, 2.4) * (t * 0.5 + r * 8.0));
        color += disk * diskColor;
      }

      // vignette to fade edges
      float vignette = smoothstep(0.95, 0.5, length(uv - 0.5));
      color *= vignette;

      // subtle chromatic aberration near the ring
      float ca = clamp(photonRing * 0.8, 0.0, 1.0);
      color.r += ca * 0.05;
      color.b += ca * 0.07;

      gl_FragColor = vec4(color, u_opacity);
    }
  `;

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile failed', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function createProgram(gl) {
    const vs = createShader(gl, gl.VERTEX_SHADER, vertexShaderSrc);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSrc);
    if (!vs || !fs) return null;

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link failed', gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }
    return program;
  }

  function applyFallback(canvas) {
    canvas.classList.add('blackhole-fallback');
  }

  function mergeConfig(options = {}) {
    const cfg = Object.assign({}, DEFAULT_CONFIG, options || {});
    cfg.center = Array.isArray(options.center) && options.center.length === 2
      ? options.center
      : DEFAULT_CONFIG.center;
    cfg.quality = Math.min(1, Math.max(0.25, Number(cfg.quality) || DEFAULT_CONFIG.quality));
    cfg.opacity = Math.min(1, Math.max(0, Number(cfg.opacity) || DEFAULT_CONFIG.opacity));
    cfg.rs = Math.max(0.5, Number(cfg.rs) || DEFAULT_CONFIG.rs);
    return cfg;
  }

  function initBlackHole(options = {}, meta = {}) {
    const params = new URLSearchParams(window.location.search);
    const bhOverride = params.get('bh');
    let enabled = options.enabled ?? true;
    if (bhOverride === '0') enabled = false;
    if (bhOverride === '1') enabled = true;

    const canvas = document.getElementById('blackhole-canvas');
    if (!canvas || !enabled) {
      if (canvas) canvas.classList.add('blackhole-hidden');
      return;
    }

    const cfg = mergeConfig(options);
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animate = cfg.animate !== false && !reduceMotion;

    canvas.style.opacity = cfg.opacity;
    canvas.classList.toggle('hero-portal', cfg.mode === 'hero');
    canvas.classList.toggle('background-mode', cfg.mode !== 'hero');
    canvas.classList.remove('blackhole-hidden');

    const gl = canvas.getContext('webgl', {
      antialias: false,
      premultipliedAlpha: false,
      alpha: true
    });

    if (!gl) {
      console.warn('WebGL unavailable, using fallback.');
      applyFallback(canvas);
      return;
    }

    const program = createProgram(gl);
    if (!program) {
      applyFallback(canvas);
      return;
    }

    const positionLoc = gl.getAttribLocation(program, 'position');
    const resolutionLoc = gl.getUniformLocation(program, 'u_resolution');
    const timeLoc = gl.getUniformLocation(program, 'u_time');
    const centerLoc = gl.getUniformLocation(program, 'u_center');
    const opacityLoc = gl.getUniformLocation(program, 'u_opacity');
    const rsLoc = gl.getUniformLocation(program, 'u_rs');
    const diskLoc = gl.getUniformLocation(program, 'u_disk');
    const reduceLoc = gl.getUniformLocation(program, 'u_reducedMotion');

    // Full screen triangle
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const vertices = new Float32Array([
      -1, -1,
      3, -1,
      -1, 3
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    gl.useProgram(program);
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    let start = performance.now();
    let frameId = null;

    function resize() {
      const scale = cfg.quality * (window.devicePixelRatio || 1);
      const width = Math.max(1, Math.floor((canvas.clientWidth || window.innerWidth) * scale));
      const height = Math.max(1, Math.floor((canvas.clientHeight || window.innerHeight) * scale));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    function render(now) {
      resize();
      const t = (now - start) * 0.001;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.uniform2f(resolutionLoc, canvas.width, canvas.height);
      gl.uniform1f(timeLoc, t);
      gl.uniform2f(centerLoc, cfg.center[0], cfg.center[1]);
      gl.uniform1f(opacityLoc, cfg.opacity);
      gl.uniform1f(rsLoc, cfg.rs);
      gl.uniform1i(diskLoc, cfg.disk ? 1 : 0);
      gl.uniform1i(reduceLoc, reduceMotion ? 1 : 0);

      gl.drawArrays(gl.TRIANGLES, 0, 3);

      if (animate) {
        frameId = requestAnimationFrame(render);
      }
    }

    if (meta && meta.prompt) {
      console.info('Black hole prompt:', meta.prompt);
    }

    if (!animate) {
      render(performance.now());
    } else {
      frameId = requestAnimationFrame(render);
    }

    window.addEventListener('resize', resize);
    resize();

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
    };
  }

  window.BlackHoleLens = { init: initBlackHole };
  window.initBlackHole = initBlackHole;
})();
