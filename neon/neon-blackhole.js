/**
 * NEON BLACK HOLE (fork of acidburn-blackhole.js)
 *
 * Same Schwarzschild raytracer and observer physics as the main site.
 * Added: analytic lensed sky grid, lensed synthwave floor, Keplerian disk
 * flow, optional Novikov-Thorne temperature profile and gravitational
 * redshift, plus an HDR bloom + tonemap post chain.
 *
 * URL params (handy for screenshots / testing):
 *   ?shader=orig      render the unmodified ../raytracer.glsl for comparison
 *   ?t=123            start at observer time t
 *   ?freeze           render one frame and stop
 *   ?nogui            hide the control panel
 *   ?scale=0.75       raytrace resolution scale (bloom/composite stay full res)
 */
(function () {
  'use strict';

  var Q = new URLSearchParams(location.search);
  var ORIG = Q.get('shader') === 'orig';
  var SHADER_URL = ORIG ? '../raytracer.glsl' : 'raytracer-neon.glsl';

  if (typeof THREE === 'undefined' || !Detector.webgl) {
    document.body.classList.add('no-webgl');
    return;
  }

  function degToRad(a) { return Math.PI * a / 180.0; }

  // ─────────────────────────────────────────────────────────── observer
  // Unchanged from acidburn-blackhole.js: circular geodesic orbit, local
  // orbital speed v = 1/sqrt(2(r-1)) in r_s = 1 units.
  function Observer() {
    this.position = new THREE.Vector3(10, 0, 0);
    this.velocity = new THREE.Vector3(0, 1, 0);
    this.orientation = new THREE.Matrix3();
    this.time = 0.0;
  }
  Observer.prototype.orbitalFrame = function () {
    var oy = new THREE.Vector3().subVectors(
      this.velocity.clone().normalize().multiplyScalar(4.0), this.position).normalize();
    var oz = new THREE.Vector3().crossVectors(this.position, oy).normalize();
    var ox = new THREE.Vector3().crossVectors(oy, oz);
    return new THREE.Matrix4().makeBasis(ox, oy, oz).linearPart();
  };
  Observer.prototype.move = function (dt) {
    dt *= P.time_scale;
    var r, v = 0;
    if (P.observer.motion) {
      r = P.observer.distance;
      v = 1.0 / Math.sqrt(2.0 * (r - 1.0));
      var angle = this.time * v / r, s = Math.sin(angle), c = Math.cos(angle);
      this.position.set(c * r, s * r, 0);
      this.velocity.set(-s * v, c * v, 0);
      var m = new THREE.Matrix4().makeRotationY(degToRad(P.observer.orbital_inclination));
      this.position.applyMatrix4(m);
      this.velocity.applyMatrix4(m);
    } else {
      r = this.position.length();
    }
    if (P.gravitational_time_dilation) dt = Math.sqrt((dt * dt * (1.0 - v * v)) / (1 - 1.0 / r));
    this.time += dt;
  };

  // ─────────────────────────────────────────────────────────── parameters
  // Booleans are compile-time (mustache sections); numbers in `look` are uniforms.
  var P = {
    n_steps: 100,
    quality: 'medium',
    accretion_disk: true,
    planet: { enabled: false, distance: 7.0, radius: 0.4 },
    lorentz_contraction: true,
    gravitational_time_dilation: true,
    aberration: true,
    beaming: true,
    doppler_shift: true,
    light_travel_time: true,
    time_scale: 0.5,
    observer: { motion: true, distance: 8.0, orbital_inclination: -15 },
    camera: { pitch: 12.0, yaw: -12.0 },   // original: pitch 3, yaw 0 (hole sits ~27 deg off-axis)

    // fork features
    neon_grid: true,
    neon_floor: true,
    disk_flow: true,
    disk_profile: true,
    grav_redshift: true,

    look: {
      grid_strength: 0.4,
      grid_glow: 2.0,
      grid_pulse: 1.0,
      floor_strength: 1.0,
      floor_height: 2.2,
      floor_tilt: 14.0,      // degrees in the UI
      floor_speed: 0.06,
      floor_extent: 14.0,
      disk_temp: 3800.0,
      disk_outer: 9.0,
      galaxy_gain: 0.6,
      vfov: 72.0,            // max vertical FOV (deg); landscape keeps the original 90 deg horizontal
      exposure: 1.4,
      bloom_strength: 0.6,
      bloom_threshold: 0.85,
      bloom_radius: 1.0,
      render_scale: parseFloat(Q.get('scale')) || 1.0
    },

    planetEnabled: function () { return this.planet.enabled && this.quality !== 'fast'; },
    observerMotion: function () { return this.observer.motion; }
  };

  // URL overrides for any numeric look param or boolean feature: ?floor_tilt=20&neon_floor=0
  Object.keys(P.look).forEach(function (k) { if (Q.has(k)) P.look[k] = parseFloat(Q.get(k)); });
  ['neon_grid', 'neon_floor', 'disk_flow', 'disk_profile', 'grav_redshift', 'accretion_disk',
   'beaming', 'doppler_shift', 'aberration'].forEach(function (k) {
    if (Q.has(k)) P[k] = Q.get(k) !== '0';
  });
  ['pitch', 'yaw'].forEach(function (k) { if (Q.has(k)) P.camera[k] = parseFloat(Q.get(k)); });
  if (Q.has('distance')) P.observer.distance = parseFloat(Q.get('distance'));
  if (Q.has('incl')) P.observer.orbital_inclination = parseFloat(Q.get('incl'));

  var template = null, needsCompile = true;
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

  function makeGalaxy() {
    // The original grid lives in this canvas texture: 1 px lines at 25% alpha,
    // scaled by GALAXY_BRIGHTNESS=0.4 in the shader and minified by the
    // sampler, which is why it reads so faintly. In the neon shader the grid
    // is analytic, so the canvas keeps only its nebula/stars/nodes.
    if (typeof AcidburnGalaxy === 'undefined') {
      loadTexture('galaxy', '../img/milkyway.jpg', THREE.NearestFilter);
      return;
    }
    var canvas = AcidburnGalaxy.generate({
      width: 2048, height: 1024,
      grid: { enabled: ORIG, latLines: 24, lonLines: 48, lineWidth: 1, opacity: 0.25 }
    });
    galaxyTexture = new THREE.Texture(canvas);
    galaxyTexture.magFilter = THREE.LinearFilter;
    galaxyTexture.minFilter = THREE.LinearFilter;
    galaxyTexture.needsUpdate = true;
    textures.galaxy = galaxyTexture;
    if (!Q.has('freeze')) AcidburnGalaxy.start(function () { galaxyTexture.needsUpdate = true; });
  }

  // ─────────────────────────────────────────────────────────── renderer
  var renderer, camera, observer = new Observer();
  var rtMain, rtA, rtB, rtC, rtD;
  var mainScene, mainMat, uniforms;
  var post = {};
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

  function buildTargets() {
    var c = renderer.domElement, s = P.look.render_scale;
    var W = c.width, H = c.height;
    [rtMain, rtA, rtB, rtC, rtD].forEach(function (t) { if (t) t.dispose(); });
    rtMain = makeTarget(W * s, H * s, rtType);
    rtA = makeTarget(W / 4, H / 4, rtType);
    rtB = makeTarget(W / 4, H / 4, rtType);
    rtC = makeTarget(W / 8, H / 8, rtType);
    rtD = makeTarget(W / 8, H / 8, rtType);
    uniforms.resolution.value.set(rtMain.width, rtMain.height);
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
        '  // rolloff so the very hottest cores still burn toward white',
        '  float L = max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 1e-4);',
        '  vec3 th = c * (1.0 - exp(-L * exposure)) / L;',
        '  vec3 tc = vec3(1.0) - exp(-c * exposure);',
        '  vec3 t = min(mix(th, tc, 0.3), vec3(1.0));',
        '  c = mix(c, t, tonemap);',
        '  // faint scanlines + vignette',
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

  function ready() {
    if (!template) return;
    var container = document.getElementById('blackhole-container');

    renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: Q.has('freeze') });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    // 8-bit targets clip at 1.0 before bloom; prefer half-float when available
    if (renderer.extensions.get('OES_texture_half_float') &&
        renderer.extensions.get('OES_texture_half_float_linear')) rtType = THREE.HalfFloatType;

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
      star_texture: { type: 't', value: textures.stars },
      accretion_disk_texture: { type: 't', value: textures.accretion_disk },
      galaxy_texture: { type: 't', value: textures.galaxy },
      planet_texture: { type: 't', value: textures.moon },
      spectrum_texture: { type: 't', value: textures.spectra }
    };
    ['grid_strength', 'grid_glow', 'grid_pulse', 'floor_strength', 'floor_height', 'floor_tilt',
     'floor_speed', 'floor_extent', 'disk_temp', 'disk_outer', 'galaxy_gain', 'fov_mult'].forEach(function (k) {
      uniforms[k] = { type: 'f', value: 0 };
    });

    mainMat = new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: 'void main(){ gl_Position = vec4(position, 1.0); }',
      fragmentShader: compile()
    });
    mainMat.derivatives = true;                   // fwidth for the analytic grid (three r73 API)
    mainMat.extensions = { derivatives: true };   // newer three API, harmless here
    mainScene = quad(mainMat);
    needsCompile = false;

    camera = new THREE.PerspectiveCamera(45, 1, 1, 80000);
    initPost();
    resize();
    window.addEventListener('resize', resize);
    if (!Q.has('nogui')) buildGui();

    var loader = document.getElementById('loader');
    if (loader) loader.style.display = 'none';

    if (Q.has('t')) observer.time = parseFloat(Q.get('t'));
    lastT = performance.now();
    requestAnimationFrame(frame);
  }

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    buildTargets();
  }

  function updateCamera() {
    var m = new THREE.Matrix4().makeRotationX(degToRad(-P.camera.pitch));
    m.multiply(new THREE.Matrix4().makeRotationY(degToRad(-P.camera.yaw)));
    var e = m.elements, cm = new THREE.Matrix3();
    cm.set(e[0], e[1], e[2], e[8], e[9], e[10], e[4], e[5], e[6]);
    if (P.observer.motion) {
      observer.orientation = observer.orbitalFrame().multiply(cm);
    } else {
      observer.orientation = cm;
      var d = P.observer.distance;
      observer.position.set(-cm.elements[6] * d, -cm.elements[7] * d, -cm.elements[8] * d);
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
    uniforms.planet_distance.value = P.planet.distance;
    uniforms.planet_radius.value = P.planet.radius;
    uniforms.grid_strength.value = L.grid_strength;
    uniforms.grid_glow.value = L.grid_glow;
    uniforms.grid_pulse.value = L.grid_pulse;
    uniforms.floor_strength.value = L.floor_strength;
    uniforms.floor_height.value = L.floor_height;
    uniforms.floor_tilt.value = degToRad(L.floor_tilt);
    uniforms.floor_speed.value = L.floor_speed;
    uniforms.floor_extent.value = L.floor_extent;
    uniforms.disk_temp.value = L.disk_temp;
    uniforms.disk_outer.value = L.disk_outer;
    uniforms.galaxy_gain.value = L.galaxy_gain;
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

  var lastT = 0, rendered = false;
  function frame(now) {
    if (Q.has('freeze') && rendered) return;
    requestAnimationFrame(frame);
    var dt = Math.min((now - lastT) / 1000, 0.1); lastT = now;

    if (needsCompile) {
      mainMat.fragmentShader = compile();
      mainMat.needsUpdate = true;
      needsCompile = false;
    }
    observer.move(Q.has('freeze') ? 0 : dt);
    updateCamera();
    updateUniforms();

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
    rendered = true;
    window.__neonFrames = (window.__neonFrames || 0) + 1;
  }

  // ─────────────────────────────────────────────────────────── controls
  function buildGui() {
    if (typeof dat === 'undefined') return;
    var gui = new dat.GUI({ width: 300 });
    var recompile = function () { needsCompile = true; };

    var fx = gui.addFolder('Neon features (recompile)');
    ['neon_grid', 'neon_floor', 'disk_flow', 'disk_profile', 'grav_redshift'].forEach(function (k) {
      fx.add(P, k).onChange(recompile);
    });
    fx.open();

    var look = gui.addFolder('Look');
    look.add(P.look, 'grid_strength', 0, 3);
    look.add(P.look, 'grid_glow', 0, 12).name('grid_glow (px)');
    look.add(P.look, 'grid_pulse', 0, 3);
    look.add(P.look, 'floor_strength', 0, 3);
    look.add(P.look, 'floor_height', 0.5, 8);
    look.add(P.look, 'floor_tilt', -10, 40).name('floor_tilt (deg)');
    look.add(P.look, 'floor_speed', -0.5, 0.5);
    look.add(P.look, 'floor_extent', 2, 60);
    look.add(P.look, 'galaxy_gain', 0, 3);
    look.add(P.look, 'vfov', 30, 120).name('max vertical FOV');
    look.open();

    var disk = gui.addFolder('Disk');
    disk.add(P.look, 'disk_temp', 2000, 20000).name('peak T (K)');
    disk.add(P.look, 'disk_outer', 3, 20).name('outer r (r_s)');
    disk.add(P, 'accretion_disk').onChange(recompile);

    var po = gui.addFolder('Post');
    po.add(P.look, 'exposure', 0.2, 4);
    po.add(P.look, 'bloom_strength', 0, 3);
    po.add(P.look, 'bloom_threshold', 0, 1.5);
    po.add(P.look, 'bloom_radius', 0.25, 4);
    po.add(P.look, 'render_scale', 0.25, 1).step(0.05).onFinishChange(buildTargets);

    var phys = gui.addFolder('Physics (original toggles)');
    phys.add(P, 'n_steps', 20, 300).step(10).onFinishChange(recompile);
    ['beaming', 'doppler_shift', 'aberration', 'light_travel_time',
     'gravitational_time_dilation', 'lorentz_contraction'].forEach(function (k) {
      phys.add(P, k).onChange(recompile);
    });
    phys.add(P, 'time_scale', 0, 4);
    phys.add(P.observer, 'motion').onChange(recompile);
    phys.add(P.observer, 'distance', 2.6, 30);
    phys.add(P.observer, 'orbital_inclination', -90, 90);

    var cam = gui.addFolder('Camera');
    cam.add(P.camera, 'pitch', -60, 60);
    cam.add(P.camera, 'yaw', -180, 180);

    if (window.innerWidth < 700) gui.close();
  }

  // ─────────────────────────────────────────────────────────── boot
  makeGalaxy();
  loadTexture('spectra', '../img/spectra.png', THREE.LinearFilter);
  loadTexture('moon', '../img/beach-ball.png', THREE.LinearFilter);
  loadTexture('stars', '../img/stars.png', THREE.LinearFilter);
  loadTexture('accretion_disk', '../img/accretion-disk.png', THREE.LinearFilter);
  pending++;
  fetch(SHADER_URL).then(function (r) { return r.text(); }).then(function (txt) {
    template = txt;
    if (--pending === 0) ready();
  });

  window.NeonBlackhole = { params: P, observer: observer, recompile: function () { needsCompile = true; } };
})();
