/**
 * NEON BLACK HOLE (fork of acidburn-blackhole.js)
 *
 * Same Schwarzschild raytracer as the main site (r_s = 1, c = 1).
 * Fork additions: lensed synthwave floor, optional analytic sky grid,
 * procedural Keplerian disk turbulence + orbiting hot spots, Novikov-Thorne
 * profile, gravitational redshift, a baked procedural nebula sky, an
 * eccentric geodesic camera orbit, adaptive resolution, bloom + tonemap.
 *
 * Asset base: set window.NEON_BASE before loading ('../' inside the repo's
 * neon/ folder, '' when everything sits next to the page).
 * Location hash '#orig' starts on the original shader.
 */
(function () {
  'use strict';

  var BASE = window.NEON_BASE || '';
  var ORIG = location.hash === '#orig';

  if (typeof THREE === 'undefined' || !Detector.webgl) {
    document.body.classList.add('no-webgl');
    return;
  }

  function degToRad(a) { return Math.PI * a / 180.0; }

  // ─────────────────────────────────────────────────────────── parameters
  // Booleans are compile-time (mustache sections); numbers in `look` are uniforms.
  var P = {
    n_steps: 60,
    quality: 'medium',
    accretion_disk: true,
    planet: { enabled: false, distance: 7.0, radius: 0.4 },
    lorentz_contraction: true,
    gravitational_time_dilation: true,
    aberration: true,
    beaming: true,
    doppler_shift: true,
    light_travel_time: true,
    time_scale: 3.18,
    observer: {
      motion: true,
      orbit: 'eccentric',          // 'eccentric' (geodesic between periapsis/apoapsis) or 'circular'
      periapsis: 3.2,
      apoapsis: 22.6,
      distance: 8.0,               // circular orbit radius
      orbital_inclination: 4.27
    },
    camera: {
      pitch: 9.35, yaw: -10.96,
      // quasi-periodic wobble (two incommensurate tones per axis), degrees
      wobble_pitch: 4.0, wobble_yaw: 7.0, wobble_period: 89.5   // period in seconds at time_scale 1
    },

    // fork features
    neon_grid: true,
    neon_floor: false,
    neon_sky: true,
    photon_eq_fix: true,         // u'' = -u + 3/2 u^2 (original has u^3)
    disk_flow: true,
    disk_profile: true,
    grav_redshift: true,

    look: {
      grid_strength: 0.05,
      grid_glow: 0.0,
      grid_pulse: 0.0,
      floor_strength: 0.975,
      floor_height: 5.9,
      floor_tilt: -3.0,            // degrees in the UI
      floor_cell: 2.5,             // grid cell (r_s); major cyan lines every 4 cells
      floor_speed: 0.25,           // forward drift (r_s per second at time_scale 1)
      floor_sway: 6.0,             // side-to-side drift amplitude (r_s)
      floor_sway_period: 34.0,     // seconds at time_scale 1
      floor_extent: 14.0,
      disk_temp: 8075.0,
      disk_outer: 13.0,
      disk_speed: 4.06,            // 1 = Keplerian; >1 is a stylized speed-up of the gas only
      spot_strength: 4.0,
      galaxy_gain: 3.36,
      vfov: 72.0,                  // max vertical FOV (deg); landscape keeps the original 90 deg horizontal
      exposure: 1.381,
      bloom_strength: 0.693,
      bloom_threshold: 0.52,
      bloom_radius: 1.982,
      render_scale: 0.85,          // max raytrace scale; auto_res lowers it to hold the frame rate
      auto_res: true,
      target_fps: 50
    },

    planetEnabled: function () { return this.planet.enabled && this.quality !== 'fast'; },
    observerMotion: function () { return this.observer.motion; }
  };

  // ─────────────────────────────────────────────────────────── observer
  // Timelike geodesic in the plane of its own orbit, integrated in Binet
  // form d2u/dphi2 = -u + 1/(2L^2) + 3u^2/2 (u = 1/r, r_s = 1), stepped in
  // proper time: dphi/dtau = L u^2, dt/dtau = E/(1-u). Velocity is reported
  // in the local static frame, which is what the shader's aberration and
  // Doppler code expects (same convention as the original circular orbit).
  function Observer() {
    this.position = new THREE.Vector3(10, 0, 0);
    this.velocity = new THREE.Vector3(0, 1, 0);
    this.orientation = new THREE.Matrix3();
    this.lookT = new THREE.Vector3(0, 1, 0);
    this.time = 0.0;        // coordinate time (the shader's `time`)
    this.tau = 0.0;         // proper time
    this.clock = 0.0;       // wall seconds x time_scale, drives wobble and floor drift
    this.floorOffset = new THREE.Vector2();
    this.phi = 0.0;
    this.r = 8.0;
    this.speed = 0.0;
    this.orbitKey = '';
  }

  // Energy and angular momentum per unit mass for turning points rp, ra.
  // Returns null if the pair is not a bound orbit clear of the plunge region.
  function orbitConstants(rp, ra) {
    if (!(rp > 1.0 && ra >= rp)) return null;
    var u1 = 1 / rp, u2 = 1 / ra, B;
    if (ra - rp < 1e-6) {
      if (rp <= 1.5) return null;
      B = (2 * rp - 3) / (rp * rp);           // circular: L^2 = r^2 / (2r - 3)
    } else {
      B = ((1 - u2) * u2 * u2 - (1 - u1) * u1 * u1) / (u2 - u1);
    }
    var A = (1 - u1) * (B + u1 * u1);
    var u3 = 1 - u1 - u2;                       // third root of the cubic
    if (!(B > 0) || !(u3 >= u1 - 1e-9)) return null;
    var L = 1 / Math.sqrt(B), E = Math.sqrt(A) * L;
    return { L: L, E: E, B: B, u1: u1, u2: u2 };
  }

  Observer.prototype.resetOrbit = function () {
    var o = P.observer;
    var C = o.orbit === 'eccentric' ? orbitConstants(o.periapsis, o.apoapsis)
                                    : orbitConstants(o.distance, o.distance);
    this.invalid = !C;
    if (!C) C = orbitConstants(8, 8);
    this.C = C;
    this.u = C.u1; this.w = 0;                  // start at periapsis
    this.orbitKey = o.orbit + o.periapsis + ',' + o.apoapsis + ',' + o.distance;
  };

  Observer.prototype.advance = function (dtau) {
    var C = this.C, L = C.L, halfB = C.B / 2;
    var f = function (uu, ww) { return [ww, -uu + halfB + 1.5 * uu * uu]; };
    var remaining = dtau;
    while (remaining > 1e-9) {
      var u = this.u;
      var h = Math.min(remaining, 0.004 / Math.max(L * u * u, 1e-6));   // dphi <= 0.004 rad
      var dphi = L * u * u * h;
      var k1 = f(u, this.w);
      var k2 = f(u + dphi / 2 * k1[0], this.w + dphi / 2 * k1[1]);
      var k3 = f(u + dphi / 2 * k2[0], this.w + dphi / 2 * k2[1]);
      var k4 = f(u + dphi * k3[0], this.w + dphi * k3[1]);
      this.u += dphi / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
      this.w += dphi / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
      // clamp drift at the turning points
      if (this.u > C.u1) this.u = C.u1;
      if (this.u < C.u2) this.u = C.u2;
      this.phi += dphi;
      this.time += (P.gravitational_time_dilation ? C.E / (1 - u) : 1) * h;
      this.tau += h;
      remaining -= h;
    }
  };

  Observer.prototype.update = function (wallDt) {
    var o = P.observer;
    var key = o.orbit + o.periapsis + ',' + o.apoapsis + ',' + o.distance;
    if (key !== this.orbitKey) this.resetOrbit();
    if (o.motion) this.advance(wallDt * P.time_scale);
    else this.time += wallDt * P.time_scale;

    // drift across the floor: steady forward motion plus a side-to-side sway
    var dc = wallDt * P.time_scale, Lk = P.look;
    this.clock += dc;
    var ws = 2 * Math.PI / Math.max(Lk.floor_sway_period, 1);
    var lateral = Lk.floor_sway * ws * Math.cos(ws * this.clock);
    this.floorOffset.x += lateral * dc;
    this.floorOffset.y += Lk.floor_speed * dc;

    var C = this.C, u = this.u, r = 1 / u, f = 1 - u;
    var c = Math.cos(this.phi), s = Math.sin(this.phi);
    var rhat = new THREE.Vector3(c, s, 0), that = new THREE.Vector3(-s, c, 0);
    var gamma = C.E / Math.sqrt(f);
    var rdot = -this.w * C.L;                               // dr/dtau
    var vr = rdot / Math.sqrt(f) / gamma, vt = (C.L * u) / gamma;

    var m = new THREE.Matrix4().makeRotationY(degToRad(o.orbital_inclination));
    if (o.motion) {
      this.position.copy(rhat).multiplyScalar(r).applyMatrix4(m);
      this.velocity.copy(rhat).multiplyScalar(vr).add(that.clone().multiplyScalar(vt)).applyMatrix4(m);
    }
    this.lookT = that.applyMatrix4(m);
    this.r = o.motion ? r : this.position.length();
    this.speed = this.velocity.length();
  };

  // Camera frame: look between the hole and the direction of travel at a
  // fixed 26.6 deg (the original's framing at r = 8), independent of the
  // radial velocity, so the hole holds its place on screen through the dive.
  Observer.prototype.orbitalFrame = function () {
    var rhat = this.position.clone().normalize();
    var oy = this.lookT.clone().multiplyScalar(0.5).sub(rhat).normalize();
    var oz = new THREE.Vector3().crossVectors(this.position, oy).normalize();
    var ox = new THREE.Vector3().crossVectors(oy, oz);
    return new THREE.Matrix4().makeBasis(ox, oy, oz).linearPart();
  };

  var observer = new Observer();

  var templates = {}, template = null, needsCompile = true, dirty = true;
  function compile() { return Mustache.render(template, P); }

  // ─────────────────────────────────────────────────────────── textures
  var textures = {}, pending = 0, galaxyTexture = null;
  var texLoader = new THREE.TextureLoader();

  function loadTexture(key, url, filter) {
    pending++;
    texLoader.load(url, function (tex) {
      tex.magFilter = filter; tex.minFilter = filter;
      textures[key] = tex; if (--pending === 0) ready();
    }, undefined, function () {
      console.warn('[neon] failed to load', url);
      var c = document.createElement('canvas'); c.width = c.height = 4;
      textures[key] = new THREE.Texture(c); textures[key].needsUpdate = true;
      if (--pending === 0) ready();
    });
  }

  // Original-mode sky: the site's canvas texture with its grid. Static here
  // (the site animates it at 20 fps, re-uploading an 8 MB texture each tick).
  function makeOrigGalaxy() {
    if (typeof AcidburnGalaxy === 'undefined') return null;
    var canvas = AcidburnGalaxy.generate({
      width: 2048, height: 1024,
      grid: { enabled: true, latLines: 24, lonLines: 48, lineWidth: 1, opacity: 0.25 }
    });
    var t = new THREE.Texture(canvas);
    t.magFilter = t.minFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
  }

  // Procedural nebula baked once into an equirectangular render target on
  // the GPU. Noise is evaluated on the unit sphere, so there is no seam or
  // pole pinch, and it costs nothing per frame. Colors: site palette.
  var SKY_FS = [
    'varying vec2 vUv;',
    'const float PI = 3.141592653589793;',
    'const vec3 CYAN = vec3(0.0, 1.0, 1.0);',
    'const vec3 PURPLE = vec3(0.749, 0.0, 1.0);',
    'const vec3 DEEP = vec3(0.290, 0.094, 0.408);',
    'const vec3 PINK = vec3(1.0, 0.0, 0.6);',
    'float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }',
    'float noise(vec3 x) {',
    '  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),',
    '             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);',
    '}',
    'float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++) { s += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }',
    'void main() {',
    '  float lon = (vUv.x - 0.5) * 2.0 * PI, lat = (vUv.y - 0.5) * PI;',
    '  vec3 d = vec3(sin(lon) * cos(lat), cos(lon) * cos(lat), sin(lat));',
    '  vec3 q = d * 2.0;',
    '  vec3 w = vec3(fbm(q + 1.7), fbm(q + 9.2), fbm(q + 4.4));',
    '  float n = fbm(q + 2.2 * w);',
    '  float neb = smoothstep(0.42, 0.8, n);',
    '  vec3 col = mix(DEEP * 0.6, PURPLE, smoothstep(0.55, 0.85, n)) * neb * 0.22;',
    '  float wisp = pow(smoothstep(0.5, 0.9, fbm(q * 3.1 + 1.6 * w)), 3.0);',
    '  col += CYAN * wisp * neb * 0.16;',
    '  col += PINK * pow(smoothstep(0.62, 0.9, fbm(d * 7.0 + 3.0 * w)), 4.0) * 0.12;',
    '  vec3 nb = normalize(vec3(0.35, -0.55, 0.76));',      // galactic band: tilted great circle
    '  float bl = dot(d, nb);',
    '  float band = exp(-bl * bl / 0.018) + 0.35 * exp(-bl * bl / 0.12);',
    '  float dust = smoothstep(0.45, 0.7, fbm(d * 7.0 + 2.0 * w));',
    '  float glow = (0.45 + 0.55 * fbm(d * 18.0)) * band * (1.0 - 0.85 * dust * exp(-bl * bl / 0.01));',
    '  col += mix(vec3(0.55, 0.45, 0.85), vec3(0.9, 0.75, 1.0), fbm(d * 5.0)) * glow * 0.16;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function bakeSky() {
    var target = new THREE.WebGLRenderTarget(2048, 1024, {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat, type: THREE.UnsignedByteType,
      depthBuffer: false, stencilBuffer: false
    });
    var mat = new THREE.ShaderMaterial({ vertexShader: QUAD_VS, fragmentShader: SKY_FS });
    renderer.render(quad(mat), camera, target, true);
    return target;
  }

  // ─────────────────────────────────────────────────────────── renderer
  var renderer, camera;
  var rtMain, rtA, rtB, rtC, rtD;
  var mainScene, mainMat, uniforms;
  var post = {};
  var origGalaxy = null;
  var QUAD_VS = 'varying vec2 vUv; void main(){ vUv = position.xy*0.5+0.5; gl_Position = vec4(position.xy,0.0,1.0); }';

  function quad(material) {
    var s = new THREE.Scene();
    s.add(new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), material));
    return s;
  }

  function makeTarget(w, h, type) {
    return new THREE.WebGLRenderTarget(Math.max(1, w | 0), Math.max(1, h | 0), {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat, type: type, depthBuffer: false, stencilBuffer: false
    });
  }

  var rtType = THREE.UnsignedByteType;
  var curScale = 0;

  function buildTargets(scale) {
    var c = renderer.domElement;
    var W = c.width, H = c.height;
    curScale = scale;
    if (rtMain) rtMain.dispose();
    rtMain = makeTarget(W * scale, H * scale, rtType);
    uniforms.resolution.value.set(rtMain.width, rtMain.height);
    var qw = Math.max(1, (W / 4) | 0), qh = Math.max(1, (H / 4) | 0);
    if (!rtA || rtA.width !== qw || rtA.height !== qh) {
      [rtA, rtB, rtC, rtD].forEach(function (t) { if (t) t.dispose(); });
      rtA = makeTarget(W / 4, H / 4, rtType);
      rtB = makeTarget(W / 4, H / 4, rtType);
      rtC = makeTarget(W / 8, H / 8, rtType);
      rtD = makeTarget(W / 8, H / 8, rtType);
    }
    dirty = true;
  }

  function initPost() {
    post.bright = new THREE.ShaderMaterial({
      uniforms: { src: { type: 't', value: null }, texel: { type: 'v2', value: new THREE.Vector2() },
                  threshold: { type: 'f', value: 0.6 } },
      vertexShader: QUAD_VS,
      fragmentShader: [
        'uniform sampler2D src; uniform vec2 texel; uniform float threshold; varying vec2 vUv;',
        'void main(){',
        '  vec3 c = vec3(0.0);',
        '  c += texture2D(src, vUv + texel*vec2(-1.0,-1.0)).rgb;',
        '  c += texture2D(src, vUv + texel*vec2( 1.0,-1.0)).rgb;',
        '  c += texture2D(src, vUv + texel*vec2(-1.0, 1.0)).rgb;',
        '  c += texture2D(src, vUv + texel*vec2( 1.0, 1.0)).rgb;',
        '  c *= 0.25;',
        '  float l = max(c.r, max(c.g, c.b));',
        '  float k = smoothstep(threshold, threshold + 0.35, l);',
        '  gl_FragColor = vec4(c * k, 1.0);',
        '}'].join('\n')
    });
    post.blur = new THREE.ShaderMaterial({
      uniforms: { src: { type: 't', value: null }, dir: { type: 'v2', value: new THREE.Vector2() } },
      vertexShader: QUAD_VS,
      fragmentShader: [
        'uniform sampler2D src; uniform vec2 dir; varying vec2 vUv;',
        'void main(){',
        '  vec3 c = texture2D(src, vUv).rgb * 0.2270270;',
        '  c += texture2D(src, vUv + dir*1.3846154).rgb * 0.3162162;',
        '  c += texture2D(src, vUv - dir*1.3846154).rgb * 0.3162162;',
        '  c += texture2D(src, vUv + dir*3.2307692).rgb * 0.0702703;',
        '  c += texture2D(src, vUv - dir*3.2307692).rgb * 0.0702703;',
        '  gl_FragColor = vec4(c, 1.0);',
        '}'].join('\n')
    });
    post.copy = new THREE.ShaderMaterial({
      uniforms: { src: { type: 't', value: null } },
      vertexShader: QUAD_VS,
      fragmentShader: 'uniform sampler2D src; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(src, vUv).rgb, 1.0); }'
    });
    post.composite = new THREE.ShaderMaterial({
      uniforms: {
        scene: { type: 't', value: null }, bloom1: { type: 't', value: null }, bloom2: { type: 't', value: null },
        strength: { type: 'f', value: 1.0 }, exposure: { type: 'f', value: 1.0 }, tonemap: { type: 'f', value: 1.0 }
      },
      vertexShader: QUAD_VS,
      fragmentShader: [
        'uniform sampler2D scene, bloom1, bloom2; uniform float strength, exposure, tonemap;',
        'varying vec2 vUv;',
        'void main(){',
        '  vec3 c = texture2D(scene, vUv).rgb;',
        '  vec3 b = texture2D(bloom1, vUv).rgb * 0.7 + texture2D(bloom2, vUv).rgb * 0.45;',
        '  c += b * strength;',
        '  // shoulder on luminance (hue-preserving) blended with a little per-channel',
        '  // rolloff so the hottest cores still burn toward white',
        '  float L = max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 1e-4);',
        '  vec3 th = c * (1.0 - exp(-L * exposure)) / L;',
        '  vec3 tc = vec3(1.0) - exp(-c * exposure);',
        '  // per-channel rolloff (burn to white) only for genuinely hot pixels, and',
        '  // normalise by the max channel instead of clamping each one, so a',
        '  // saturated #bf00ff or #00ffff keeps its hue instead of skewing',
        '  vec3 t = mix(th, tc, 0.3 * smoothstep(1.5, 4.0, L));',
        '  t /= max(1.0, max(t.r, max(t.g, t.b)));',
        '  c = mix(c, t, tonemap);',
        '  float scan = 0.97 + 0.03 * sin(gl_FragCoord.y * 3.14159);',
        '  vec2 q = vUv - 0.5; float vig = 1.0 - 0.35 * dot(q, q) * 2.0;',
        '  c *= mix(1.0, scan * vig, tonemap);',
        '  gl_FragColor = vec4(c, 1.0);',
        '}'].join('\n')
    });
    post.sBright = quad(post.bright);
    post.sBlur = quad(post.blur);
    post.sCopy = quad(post.copy);
    post.sComp = quad(post.composite);
  }

  var UNIFORM_LOOK = ['grid_strength', 'grid_glow', 'grid_pulse', 'floor_strength', 'floor_height',
    'floor_tilt', 'floor_cell', 'floor_extent', 'disk_temp', 'disk_outer', 'disk_speed',
    'spot_strength', 'galaxy_gain'];

  function ready() {
    if (!templates.neon) return;
    template = ORIG ? templates.orig : templates.neon;
    var container = document.getElementById('blackhole-container');

    renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: !!window.NEON_TEST });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    // 8-bit targets clip at 1.0 before bloom; prefer half-float when available
    if (renderer.extensions.get('OES_texture_half_float') &&
        renderer.extensions.get('OES_texture_half_float_linear')) rtType = THREE.HalfFloatType;
    camera = new THREE.PerspectiveCamera(45, 1, 1, 80000);

    galaxyTexture = bakeSky();
    origGalaxy = makeOrigGalaxy();

    uniforms = {
      time: { type: 'f', value: 0 },
      resolution: { type: 'v2', value: new THREE.Vector2() },
      cam_pos: { type: 'v3', value: new THREE.Vector3() },
      cam_x: { type: 'v3', value: new THREE.Vector3() },
      cam_y: { type: 'v3', value: new THREE.Vector3() },
      cam_z: { type: 'v3', value: new THREE.Vector3() },
      cam_vel: { type: 'v3', value: new THREE.Vector3() },
      planet_distance: { type: 'f', value: 7 },
      planet_radius: { type: 'f', value: 0.4 },
      fov_mult: { type: 'f', value: 1 },
      floor_offset: { type: 'v2', value: new THREE.Vector2() },
      floor_bx: { type: 'v3', value: new THREE.Vector3() },
      floor_by: { type: 'v3', value: new THREE.Vector3() },
      floor_bz: { type: 'v3', value: new THREE.Vector3() },
      star_texture: { type: 't', value: textures.stars },
      accretion_disk_texture: { type: 't', value: textures.accretion_disk },
      galaxy_texture: { type: 't', value: ORIG && origGalaxy ? origGalaxy : galaxyTexture },
      planet_texture: { type: 't', value: textures.moon },
      spectrum_texture: { type: 't', value: textures.spectra }
    };
    UNIFORM_LOOK.forEach(function (k) { uniforms[k] = { type: 'f', value: 0 }; });

    mainMat = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: 'void main(){ gl_Position = vec4(position, 1.0); }',
      fragmentShader: compile()
    });
    mainMat.derivatives = true;                   // fwidth for the analytic grid (three r73 API)
    mainMat.extensions = { derivatives: true };   // newer three API, harmless here
    mainScene = quad(mainMat);
    needsCompile = false;

    initPost();
    resize();
    window.addEventListener('resize', resize);
    if (!window.NEON_NOGUI) buildGui();

    var loader = document.getElementById('loader');
    if (loader) loader.style.display = 'none';

    observer.resetOrbit();
    lastT = performance.now();
    requestAnimationFrame(frame);
  }

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    buildTargets(P.look.render_scale);
  }

  function viewMatrix(pitch, yaw) {
    var m = new THREE.Matrix4().makeRotationX(degToRad(-pitch));
    m.multiply(new THREE.Matrix4().makeRotationY(degToRad(-yaw)));
    var e = m.elements, cm = new THREE.Matrix3();
    cm.set(e[0], e[1], e[2], e[8], e[9], e[10], e[4], e[5], e[6]);
    return cm;
  }

  var floorBasis = new THREE.Matrix3();
  function updateCamera() {
    var c = P.camera, k = 2 * Math.PI / Math.max(c.wobble_period, 1), tt = observer.clock;
    var wp = c.wobble_pitch * (0.75 * Math.sin(k * tt) + 0.25 * Math.sin(k * 2.618 * tt + 1.3));
    var wy = c.wobble_yaw * (0.7 * Math.sin(k * 0.73 * tt + 0.5) + 0.3 * Math.sin(k * 1.91 * tt + 2.1));
    var cm = viewMatrix(c.pitch + wp, c.yaw + wy);
    var cmLevel = viewMatrix(c.pitch, c.yaw);
    if (P.observer.motion) {
      var frame = observer.orbitalFrame();
      floorBasis = frame.clone().multiply(cmLevel);
      observer.orientation = frame.multiply(cm);
    } else {
      floorBasis = cmLevel;
      observer.orientation = cm;
      var d = P.observer.orbit === 'eccentric' ? 1 / observer.u : P.observer.distance;
      observer.position.set(-cmLevel.elements[6] * d, -cmLevel.elements[7] * d, -cmLevel.elements[8] * d);
      observer.velocity.set(0, 0, 0);
    }
  }

  function updateUniforms() {
    var L = P.look;
    uniforms.time.value = observer.time;
    uniforms.cam_pos.value.copy(observer.position);
    uniforms.cam_vel.value.copy(observer.velocity);
    var e = observer.orientation.elements;
    uniforms.cam_x.value.set(e[0], e[1], e[2]);
    uniforms.cam_y.value.set(e[3], e[4], e[5]);
    uniforms.cam_z.value.set(e[6], e[7], e[8]);
    var f = floorBasis.elements;
    uniforms.floor_bx.value.set(f[0], f[1], f[2]);
    uniforms.floor_by.value.set(f[3], f[4], f[5]);
    uniforms.floor_bz.value.set(f[6], f[7], f[8]);
    uniforms.floor_offset.value.copy(observer.floorOffset);
    uniforms.planet_distance.value = P.planet.distance;
    uniforms.planet_radius.value = P.planet.radius;
    UNIFORM_LOOK.forEach(function (k) { uniforms[k].value = L[k]; });
    uniforms.floor_tilt.value = degToRad(L.floor_tilt);
    // p.x spans [-1,1] horizontally in the shader; pick the horizontal FOV so
    // the vertical one never exceeds L.vfov (original: fixed 90 deg horizontal)
    var aspect = rtMain.width / rtMain.height;
    var hfov = Math.min(Math.PI / 2, 2 * Math.atan(Math.tan(degToRad(L.vfov) / 2) * aspect));
    uniforms.fov_mult.value = 1 / Math.tan(hfov / 2);
  }

  function pass(scene, target) { renderer.render(scene, camera, target, true); }

  function blurPair(src, tmp, radius) {
    post.blur.uniforms.src.value = src;
    post.blur.uniforms.dir.value.set(radius / src.width, 0);
    pass(post.sBlur, tmp);
    post.blur.uniforms.src.value = tmp;
    post.blur.uniforms.dir.value.set(0, radius / src.height);
    pass(post.sBlur, src);
  }

  // Adaptive resolution: the frame interval tracks GPU time when GPU-bound.
  // Steps down fast, back up slowly, rebuilds the target at most twice a second.
  var ema = 16.7, lastRescale = 0;
  function adaptResolution(frameMs, now) {
    var L = P.look;
    if (!L.auto_res) {
      if (Math.abs(curScale - L.render_scale) > 1e-3) buildTargets(L.render_scale);
      return;
    }
    ema = ema * 0.9 + Math.min(frameMs, 100) * 0.1;
    if (now - lastRescale < 500) return;
    var target = 1000 / L.target_fps, s = curScale, next = s;
    if (ema > target * 1.15) next = Math.max(0.35, s * 0.88);
    else if (ema < target * 0.8) next = s * 1.05;
    next = Math.min(next, L.render_scale);
    if (Math.abs(next - s) / s > 0.03) { buildTargets(next); lastRescale = now; }
  }

  var lastT = 0, paused = false, lastPausedRender = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    var frameMs = now - lastT;
    var dt = Math.min(frameMs / 1000, 0.1); lastT = now;

    if (paused && !dirty && !needsCompile && now - lastPausedRender < 250) return;
    if (!paused) adaptResolution(frameMs, now);

    if (needsCompile) {
      mainMat.fragmentShader = compile();
      mainMat.needsUpdate = true;
      needsCompile = false;
    }
    observer.update(paused ? 0 : dt);
    updateCamera();
    updateUniforms();
    renderOnce();
    dirty = false;
    if (paused) lastPausedRender = now;
  }

  function renderOnce() {
    var L = P.look;
    pass(mainScene, rtMain);

    post.bright.uniforms.src.value = rtMain;
    post.bright.uniforms.texel.value.set(1 / rtMain.width, 1 / rtMain.height);
    post.bright.uniforms.threshold.value = L.bloom_threshold;
    pass(post.sBright, rtA);
    blurPair(rtA, rtB, L.bloom_radius);
    blurPair(rtA, rtB, L.bloom_radius * 2.0);

    post.copy.uniforms.src.value = rtA;
    pass(post.sCopy, rtC);
    blurPair(rtC, rtD, L.bloom_radius * 1.5);
    blurPair(rtC, rtD, L.bloom_radius * 3.0);

    var C = post.composite.uniforms;
    C.scene.value = rtMain; C.bloom1.value = rtA; C.bloom2.value = rtC;
    C.strength.value = ORIG ? 0.0 : L.bloom_strength;
    C.exposure.value = L.exposure;
    C.tonemap.value = ORIG ? 0.0 : 1.0;
    renderer.render(post.sComp, camera);
    window.__neonFrames = (window.__neonFrames || 0) + 1;
  }

  // ─────────────────────────────────────────────────────────── controls
  function buildGui() {
    if (typeof dat === 'undefined') return;
    var gui = new dat.GUI({ width: 300 });
    var recompile = function () { needsCompile = true; };
    var mark = function () { dirty = true; };
    function add(folder, obj, key, a, b) {
      var c = a === undefined ? folder.add(obj, key) : folder.add(obj, key, a, b);
      c.onChange(mark);
      return c;
    }

    var fx = gui.addFolder('Neon features (recompile)');
    ['photon_eq_fix', 'neon_floor', 'neon_sky', 'neon_grid', 'disk_flow', 'disk_profile', 'grav_redshift'].forEach(function (k) {
      add(fx, P, k).onChange(recompile);
    });
    fx.open();

    var orbit = gui.addFolder('Camera orbit');
    add(orbit, P.observer, 'orbit', ['eccentric', 'circular']);
    add(orbit, P.observer, 'periapsis', 3.2, 30).name('periapsis (r_s)');
    add(orbit, P.observer, 'apoapsis', 3.2, 60).name('apoapsis (r_s)');
    add(orbit, P.observer, 'distance', 2.6, 30).name('circular r (r_s)');
    add(orbit, P.observer, 'orbital_inclination', -90, 90);
    add(orbit, P, 'time_scale', 0, 8);
    add(orbit, P.camera, 'pitch', -60, 60);
    add(orbit, P.camera, 'yaw', -180, 180);
    add(orbit, P.camera, 'wobble_pitch', 0, 20).name('wobble pitch (deg)');
    add(orbit, P.camera, 'wobble_yaw', 0, 30).name('wobble yaw (deg)');
    add(orbit, P.camera, 'wobble_period', 4, 120).name('wobble period (s)');

    var floor = gui.addFolder('Floor');
    add(floor, P.look, 'floor_strength', 0, 3);
    add(floor, P.look, 'floor_height', 0.5, 12);
    add(floor, P.look, 'floor_tilt', -20, 40).name('floor_tilt (deg)');
    add(floor, P.look, 'floor_cell', 0.5, 8).name('cell size (r_s)');
    add(floor, P.look, 'floor_speed', -2, 2).name('forward drift');
    add(floor, P.look, 'floor_sway', 0, 20).name('sideways sway (r_s)');
    add(floor, P.look, 'floor_sway_period', 4, 120).name('sway period (s)');
    add(floor, P.look, 'floor_extent', 2, 60);

    var disk = gui.addFolder('Disk');
    add(disk, P.look, 'disk_temp', 2000, 20000).name('peak T (K)');
    add(disk, P.look, 'disk_outer', 3, 30).name('outer r (r_s)');
    add(disk, P.look, 'disk_speed', 0, 10).name('gas speed (1 = Kepler)');
    add(disk, P.look, 'spot_strength', 0, 4).name('hot spots');
    add(disk, P, 'accretion_disk').onChange(recompile);

    var sky = gui.addFolder('Sky');
    add(sky, P.look, 'galaxy_gain', 0, 6);
    add(sky, P.look, 'grid_strength', 0, 3);
    add(sky, P.look, 'grid_glow', 0, 12).name('grid_glow (px)');
    add(sky, P.look, 'grid_pulse', 0, 3);
    add(sky, P.look, 'vfov', 30, 120).name('max vertical FOV');

    var po = gui.addFolder('Post + performance');
    add(po, P.look, 'exposure', 0.2, 4);
    add(po, P.look, 'bloom_strength', 0, 3);
    add(po, P.look, 'bloom_threshold', 0, 1.5);
    add(po, P.look, 'bloom_radius', 0.25, 4);
    add(po, P.look, 'render_scale', 0.25, 1).step(0.05).name('max render scale');
    add(po, P.look, 'auto_res').name('auto resolution');
    add(po, P.look, 'target_fps', 24, 120).step(1);
    add(po, P, 'n_steps', 20, 300).step(10).onFinishChange(recompile);

    var phys = gui.addFolder('Physics (original toggles)');
    ['beaming', 'doppler_shift', 'aberration', 'light_travel_time',
     'gravitational_time_dilation', 'lorentz_contraction'].forEach(function (k) {
      add(phys, P, k).onChange(recompile);
    });
    add(phys, P.observer, 'motion').onChange(recompile);

    if (window.innerWidth < 700) gui.close();
  }

  // ─────────────────────────────────────────────────────────── boot
  loadTexture('spectra', BASE + 'img/spectra.png', THREE.LinearFilter);
  loadTexture('moon', BASE + 'img/beach-ball.png', THREE.LinearFilter);
  loadTexture('stars', BASE + 'img/stars.png', THREE.LinearFilter);
  loadTexture('accretion_disk', BASE + 'img/accretion-disk.png', THREE.LinearFilter);
  pending++;
  Promise.all([window.NEON_SHADER_NEON || 'raytracer-neon.glsl', window.NEON_SHADER_ORIG || 'raytracer-orig.glsl']
    .map(function (u) { return fetch(u).then(function (r) { return r.text(); }); }))
    .then(function (t) {
      templates.neon = t[0]; templates.orig = t[1];
      if (--pending === 0) ready();
    });

  function setOriginal(on) {
    ORIG = !!on;
    if (!templates.neon || !uniforms) return;
    template = ORIG ? templates.orig : templates.neon;
    uniforms.galaxy_texture.value = ORIG && origGalaxy ? origGalaxy : galaxyTexture;
    needsCompile = true;
  }

  function settings() {
    var out = {
      renderer: ORIG ? 'original' : 'neon',
      t: +observer.time.toFixed(1), r: +observer.r.toFixed(2), v: +observer.speed.toFixed(3),
      render_scale_now: +curScale.toFixed(2),
      camera: P.camera, observer: P.observer, look: {}
    };
    ['photon_eq_fix', 'neon_floor', 'neon_sky', 'neon_grid', 'disk_flow', 'disk_profile', 'grav_redshift', 'accretion_disk',
     'beaming', 'doppler_shift', 'aberration', 'light_travel_time',
     'gravitational_time_dilation', 'lorentz_contraction', 'n_steps', 'time_scale'].forEach(function (k) { out[k] = P[k]; });
    Object.keys(P.look).forEach(function (k) {
      var v = P.look[k]; out.look[k] = typeof v === 'number' ? +v.toFixed(3) : v;
    });
    return out;
  }

  window.NeonBlackhole = {
    params: P, observer: observer,
    recompile: function () { needsCompile = true; },
    setOriginal: setOriginal, isOriginal: function () { return ORIG; },
    settings: settings,
    setPaused: function (p) { paused = !!p; dirty = true; }, isPaused: function () { return paused; },
    getScale: function () { return curScale; },
    isOrbitValid: function () { return !observer.invalid; }
  };
})();
