(function () {
  const DEFAULT_CONFIG = {
    enabled: true,
    mode: 'background',
    opacity: 0.25,
    quality: 0.75,
    center: [0.5, 0.3],
    rs: 1.0,
    animate: true,
    disk: false,
    debug: false
  };

  const vertexShaderSrc = `
    attribute vec2 position;
    void main() {
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const debugFragmentShaderSrc = `
    precision highp float;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform vec2 u_center;
    uniform float u_opacity;

    void main() {
      vec2 uv = gl_FragCoord.xy / u_resolution;
      float aspect = u_resolution.x / u_resolution.y;
      vec2 warped = (uv - 0.5) * vec2(aspect, 1.0) + 0.5;
      vec2 rel = warped - u_center;
      float r = length(rel);

      vec2 gridUv = warped * 10.0;
      vec2 g = abs(fract(gridUv) - 0.5);
      float gridLine = smoothstep(0.02, 0.0, min(g.x, g.y));
      vec3 grid = vec3(0.2, 1.0, 1.2) * gridLine;

      float diag = smoothstep(0.49, 0.46, abs(fract((gridUv.x + gridUv.y) * 0.5) - 0.5));
      grid += vec3(1.0, 0.1, 0.8) * diag * 0.6;

      vec2 pulse = sin((gridUv + u_time * 0.5) * 3.14159);
      grid += vec3(0.1, 0.0, 0.2) * max(pulse.x, pulse.y);

      float marker = smoothstep(0.0, 0.04, length(uv - vec2(0.05, 0.05)));
      vec3 color = grid + vec3(2.5, 0.15, 1.8) * (1.0 - marker);

      float disk = smoothstep(0.12, 0.18, r);
      color *= 1.0 - disk;

      float ring = smoothstep(0.18, 0.22, r) - smoothstep(0.22, 0.36, r);
      color += ring * vec3(0.6, 0.1, 1.1);

      gl_FragColor = vec4(color, u_opacity);
    }
  `;

  const lensFragmentShaderSrc = `
    precision highp float;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform vec2 u_center;
    uniform float u_opacity;
    uniform float u_rs;
    uniform bool u_reducedMotion;
    uniform bool u_disk;

    float hash(vec2 p) {
      p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
      return fract(sin(p.x + p.y) * 43758.5453123);
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

    vec2 deflect(vec2 uv, vec2 center, float rs, float aspect) {
      vec2 rel = vec2((uv.x - center.x) * aspect, uv.y - center.y);
      float r = max(length(rel), 1e-4);
      float invR = 1.0 / r;

      float bend = (4.0 * rs) * invR;
      float ringBoost = smoothstep(rs * 1.4, rs * 0.9, r);
      bend += ringBoost * 1.6;
      bend *= exp(-r / (rs * 6.0));

      vec2 dir = rel * invR;
      vec2 tangential = vec2(-dir.y, dir.x);
      vec2 warped = rel + tangential * bend + dir * (bend * 0.35);

      return center + vec2(warped.x / aspect, warped.y);
    }

    vec3 grid(vec2 p, float t) {
      vec2 g = abs(fract(p) - 0.5);
      float line = smoothstep(0.02, 0.0, min(g.x, g.y));
      float stripe = step(0.5, fract(p.x * 0.5 + t * 0.05));
      vec3 a = vec3(0.0, 0.9, 1.3);
      vec3 b = vec3(0.9, 0.0, 1.2);
      return mix(a, b, stripe) * line;
    }

    float stars(vec2 p) {
      float n = noise(p * 500.0);
      return pow(n, 36.0);
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / u_resolution;
      float aspect = u_resolution.x / u_resolution.y;
      vec2 lensSpace = (uv - 0.5) * vec2(aspect, 1.0) + 0.5;

      float t = u_reducedMotion ? 0.0 : u_time;
      vec2 sampleUv = deflect(lensSpace, u_center, u_rs, aspect);

      vec2 gridCoord = sampleUv * 8.0 + vec2(t * 0.08, t * 0.05);
      vec3 color = grid(gridCoord, t);
      color += stars(sampleUv + t * 0.02) * vec3(0.6, 0.8, 1.4);

      float r = length(vec2((lensSpace.x - u_center.x) * aspect, lensSpace.y - u_center.y));
      float visibility = smoothstep(u_rs * 0.7, u_rs * 1.0, r);
      color *= visibility;

      if (u_disk) {
        float disk = exp(-pow((r - u_rs * 2.4) / (u_rs * 0.45), 2.0));
        vec3 diskColor = vec3(0.6, 0.0, 1.4) + 0.3 * sin(vec3(1.0, 1.7, 2.4) * (t * 0.5 + r * 8.0));
        color += disk * diskColor;
      }

      float ring = exp(-pow((r - u_rs * 1.5) / (u_rs * 0.22), 2.0));
      color += ring * vec3(1.1, 0.5, 1.4);

      gl_FragColor = vec4(color, u_opacity);
    }
  `;

  function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('[blackhole] Shader compile failed', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  function createProgram(gl, fragmentSource) {
    const vs = createShader(gl, gl.VERTEX_SHADER, vertexShaderSrc);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    if (!vs || !fs) return null;
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('[blackhole] Program link failed', gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }
    return program;
  }

  function parseConfig(CONFIG) {
    const params = new URLSearchParams(window.location.search);
    const bhParam = params.get('bh');
    const debugParam = params.get('bhdebug');
    const scope = (CONFIG && CONFIG.effects && CONFIG.effects.blackhole) || (CONFIG && CONFIG.blackhole) || {};
    const cfg = Object.assign({}, DEFAULT_CONFIG, scope);

    cfg.enabled = cfg.enabled !== false;
    if (bhParam === '0') cfg.enabled = false;
    if (bhParam === '1') cfg.enabled = true;
    cfg.debug = cfg.debug === true || debugParam === '1';

    cfg.quality = Math.min(1, Math.max(0.25, Number(cfg.quality) || DEFAULT_CONFIG.quality));
    cfg.opacity = Math.min(1, Math.max(0, Number(cfg.opacity) || DEFAULT_CONFIG.opacity));
    cfg.center = Array.isArray(cfg.center) && cfg.center.length === 2 ? cfg.center.slice(0, 2) : DEFAULT_CONFIG.center;
    cfg.rs = Math.max(0.5, Number(cfg.rs) || DEFAULT_CONFIG.rs);
    cfg.animate = cfg.animate !== false;
    cfg.disk = cfg.disk === true;

    return cfg;
  }

  function applyFallback(canvas, opacity) {
    canvas.style.background = 'radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 0.9) 0%, rgba(5, 5, 10, 0.7) 30%, transparent 60%), radial-gradient(circle at 50% 50%, rgba(0, 255, 255, 0.15) 0%, rgba(191, 0, 255, 0.12) 45%, transparent 65%)';
    canvas.style.opacity = opacity;
  }

  function initBlackHoleEffect(CONFIG) {
    const canvas = document.getElementById('blackhole-canvas');
    if (!canvas) return;

    const cfg = parseConfig(CONFIG || {});
    if (!cfg.enabled) {
      canvas.style.display = 'none';
      return;
    }

    canvas.style.display = 'block';
    canvas.style.opacity = 1;

    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: false }) ||
      canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false });

    const computedZIndex = window.getComputedStyle(canvas).zIndex;
    const visibleWidth = canvas.clientWidth || window.innerWidth;
    const visibleHeight = canvas.clientHeight || window.innerHeight;

    if (!gl) {
      console.log('[blackhole] canvas visible, gl=', gl ? 'ok' : 'fail', 'size=', visibleWidth, visibleHeight, 'z=', computedZIndex);
      applyFallback(canvas, cfg.opacity);
      return;
    }

    const fragmentSource = cfg.debug ? debugFragmentShaderSrc : lensFragmentShaderSrc;
    const program = createProgram(gl, fragmentSource);
    if (!program) {
      applyFallback(canvas, cfg.opacity);
      return;
    }

    const positionLoc = gl.getAttribLocation(program, 'position');
    const resolutionLoc = gl.getUniformLocation(program, 'u_resolution');
    const timeLoc = gl.getUniformLocation(program, 'u_time');
    const centerLoc = gl.getUniformLocation(program, 'u_center');
    const opacityLoc = gl.getUniformLocation(program, 'u_opacity');
    const rsLoc = gl.getUniformLocation(program, 'u_rs');
    const reducedLoc = gl.getUniformLocation(program, 'u_reducedMotion');
    const diskLoc = gl.getUniformLocation(program, 'u_disk');

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
      3, -1,
      -1, 3
    ]), gl.STATIC_DRAW);

    gl.useProgram(program);
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    let start = performance.now();
    let frameId = null;
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animate = cfg.animate && !reduceMotion;

    function resize() {
      const viewW = canvas.clientWidth || window.innerWidth;
      const viewH = canvas.clientHeight || window.innerHeight;
      const minDim = Math.max(1, Math.min(viewW, viewH));
      const scale = cfg.quality * (window.devicePixelRatio || 1);
      const target = Math.max(1, Math.floor(minDim * scale));
      const width = Math.max(1, Math.floor(target * viewW / minDim));
      const height = Math.max(1, Math.floor(target * viewH / minDim));
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
      if (rsLoc) gl.uniform1f(rsLoc, cfg.rs);
      if (reducedLoc) gl.uniform1i(reducedLoc, reduceMotion ? 1 : 0);
      if (diskLoc) gl.uniform1i(diskLoc, cfg.disk ? 1 : 0);

      gl.drawArrays(gl.TRIANGLES, 0, 3);

      if (animate) {
        frameId = requestAnimationFrame(render);
      }
    }

    if (!animate) {
      render(performance.now());
    } else {
      frameId = requestAnimationFrame(render);
    }

    window.addEventListener('resize', resize);
    resize();

    console.log('[blackhole] canvas visible, gl=', gl ? 'ok' : 'fail', 'size=', canvas.width, canvas.height, 'z=', computedZIndex);

    return () => {
      if (frameId) cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
    };
  }

  window.initBlackHoleEffect = initBlackHoleEffect;
})();
