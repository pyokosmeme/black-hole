/**
 * NEON BLACK HOLE (fork of acidburn-blackhole.js)
 *
 * Same Schwarzschild raytracer as the main site (r_s = 1, c = 1).
 * Fork additions: lensed synthwave floor, optional analytic sky grid,
 * procedural Keplerian disk turbulence + orbiting hot spots, Novikov-Thorne
 * profile, gravitational redshift, a baked procedural nebula sky, an
 * eccentric geodesic camera orbit, adaptive resolution, bloom + tonemap.
 *
 * createNeonBlackhole({container, base, settings, active}) creates an independent
 * renderer. Await its ready promise; setActive detaches/stops inactive canvases.
 * Defaults are the supplied Neon Black Hole ZIP's defaults, without rounding.
 */
window.createNeonBlackhole = function (options) {
  'use strict';

  options = options || {};
  var BASE = options.base || '';
  var ORIG = false;
  var container = options.container || document.getElementById('blackhole-container');
  var active = options.active !== false, animationFrame = null, frameCount = 0;
  var readyResolve, readyReject;
  var readyPromise = new Promise(function (resolve,reject) { readyResolve=resolve; readyReject=reject; });

  if (typeof THREE === 'undefined' || !Detector.webgl) {
    throw new Error('WebGL is unavailable. Try a browser with hardware acceleration enabled.');
  }

  function degToRad(a) { return Math.PI * a / 180.0; }

  // ─────────────────────────────────────────────────────────── parameters
  // Booleans are compile-time (mustache sections); numbers in `look` are uniforms.
  var P = {
    n_steps: 60,
    quality: 'medium',
    accretion_disk: true,
    caption:{enabled:false,text:'',style:'chrome',font:'block',size:12,x:50,y:78,width:90,uppercase:false,bevel:1,grid:.65,stretch:1,line_gap:1.13,angular:false,metal:0,glow:0,fuzz:0},
    planet: { enabled:false, distance:7.0, radius:0.4, eccentricity:0, inclination:0, node:0, periapsis:0, phase:0, speed:1, spin:15, axial_tilt:30, texture_offset:0, texture:'' },
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
      orbital_inclination: 4.27,
      azimuth: -90, elevation: 0, rotation_speed: 0
    },
    camera: {
      navigation:'orbit', sensitivity:.18, move_speed:1,
      offset_x:0, offset_y:0, offset_z:0,
      height:0,
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
      sky_motion: false, sky_speed: 1.0, sky_axis_tilt: 0,
      floor_strength: 0.975,
      floor_height: 5.9,
      floor_follow_camera:true, floor_x:0, floor_y:0, floor_yaw:0,
      floor_lensing:true,
      floor_tilt: -3.0,            // degrees in the UI
      floor_cell: 2.5,             // grid cell (r_s); major cyan lines every 4 cells
      floor_speed: 0.25,           // forward drift (r_s per second at time_scale 1)
      floor_sway: 6.0,             // side-to-side drift amplitude (r_s)
      floor_sway_period: 34.0,     // seconds at time_scale 1
      floor_extent: 14.0,
      floor_concentration:18, floor_reflection:0, floor_roughness:.15, floor_opaque:false,
      floor_palette:false, floor_color:'#bf00ff', floor_major_color:'#00ffff',
      nebula_amount:0, nebula_scale:3, nebula_color:'#df81ed',
      nebula_resolution:'standard',
      gas_tint:0, gas_color:'#ffbb88', gas_texture:'',
      disk_temp: 8075.0,
      disk_tilt: 0, disk_yaw: 0,
      floor_infinite: false,
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
      antialiasing: false,
      target_fps: 50
    },

    planetEnabled: function () { return this.planet.enabled && this.quality !== 'fast'; },
    observerMotion: function () { return this.observer.motion; },
    diskTilt: function () { return this.look.disk_tilt !== 0 || this.look.disk_yaw !== 0; },
    gridPulse: function () { return this.look.grid_pulse !== 0; },
    gasTint: function () { return this.look.gas_tint !== 0; },
    floorTint: function () { return this.look.floor_palette; },
    viewerSky: function () { return !!options.skyMotion; }
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
    this.rotation = 0;
    this.skyAngle = 0;
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
    if (options.skyMotion && Lk.sky_motion) this.skyAngle = (this.skyAngle + wallDt * Lk.sky_speed) % 360;
    if (!o.motion) this.rotation += wallDt * o.rotation_speed;
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
  var defaults = settings();

  var templates = {}, template = null, needsCompile = true, dirty = true;
  var compiledTemplate, compiledKey, compiledSource, compileFields;
  function compile() {
    if (compiledTemplate !== template) {
      compiledTemplate = template; compiledKey = null;
      // Derive dependencies from the live template, so adding a shader feature
      // cannot silently leave a manually maintained cache key out of date.
      compileFields = Array.from(new Set((template.match(/\{\{[#^]?[\w.]+\}\}/g) || []).map(function (tag) {
        return tag.replace(/[{}#^]/g, '');
      })));
    }
    var key = JSON.stringify(compileFields.map(function (path) {
      var value = path.split('.').reduce(function (obj, k) { return obj && obj[k]; }, P);
      return typeof value === 'function' ? value.call(P) : value;
    }));
    if (key !== compiledKey) {
      compiledSource = Mustache.render(template, P); compiledKey = key;
    }
    return compiledSource;
  }

  // ─────────────────────────────────────────────────────────── textures
  var textures = {}, pending = 0, galaxyTexture = null;
  var textureKey='', customPlanetTexture=null, textureRequest=0, texturePromise=Promise.resolve();
  function syncPlanetTexture() {
    if (!uniforms || textureKey===P.planet.texture) return;
    textureKey=P.planet.texture;
    var request=++textureRequest, src=textureKey;
    if (!src) {
      uniforms.planet_texture.value=textures.moon;
      if(customPlanetTexture)customPlanetTexture.dispose();customPlanetTexture=null;
      dirty=true;texturePromise=Promise.resolve();return;
    }
    texturePromise=new Promise(function(resolve,reject){
      var img=new Image();
      img.onload=function(){
        if(request!==textureRequest){resolve();return;}
        if(img.width>2048||img.height>2048){reject(new Error('Embedded planet maps must be at most 2048 pixels per side.'));return;}
        var tex=new THREE.Texture(img);tex.minFilter=tex.magFilter=THREE.LinearFilter;tex.generateMipmaps=false;tex.needsUpdate=true;
        if(customPlanetTexture)customPlanetTexture.dispose();customPlanetTexture=tex;
        uniforms.planet_texture.value=tex;dirty=true;resolve();
      };
      img.onerror=function(){reject(new Error('Could not decode the planet texture.'));};img.src=src;
    });
    texturePromise.catch(function(){});
  }
  var texLoader = new THREE.TextureLoader();
  var gasKey='',gasTexture=null,gasRequest=0,gasPromise=Promise.resolve();
  function syncGasTexture(){
    if(!uniforms||gasKey===P.look.gas_texture)return;
    gasKey=P.look.gas_texture;var request=++gasRequest;
    if(!gasKey){uniforms.accretion_disk_texture.value=textures.accretion_disk;if(gasTexture)gasTexture.dispose();gasTexture=null;dirty=true;gasPromise=Promise.resolve();return;}
    gasPromise=new Promise(function(resolve,reject){var img=new Image();
      img.onload=function(){if(request!==gasRequest){resolve();return;}if(img.width>2048||img.height>2048){reject(new Error('Gas maps must be at most 2048 pixels per side.'));return;}
        var tex=new THREE.Texture(img);tex.minFilter=tex.magFilter=THREE.LinearFilter;tex.generateMipmaps=false;tex.needsUpdate=true;
        if(gasTexture)gasTexture.dispose();gasTexture=tex;uniforms.accretion_disk_texture.value=tex;dirty=true;resolve();};
      img.onerror=function(){reject(new Error('Could not decode the gas texture.'));};img.src=gasKey;
    });gasPromise.catch(function(){});
  }

  function loadTexture(key, url, filter) {
    pending++;
    texLoader.load(url, function (tex) {
      tex.magFilter = filter; tex.minFilter = filter;
      textures[key] = tex; if (--pending === 0) ready();
    }, undefined, function () {
      readyReject(new Error('Could not load texture '+url));
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
    'uniform float cloud_amount, cloud_scale; uniform vec3 cloud_color;',
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
    '  if(cloud_amount>0.0){',
    '    vec3 cq=d*cloud_scale+2.6*w;',
    '    float body=smoothstep(0.32,0.7,fbm(cq));',
    '    float filaments=pow(1.0-abs(2.0*fbm(cq*3.7+2.0*w)-1.0),5.0);',
    '    float dustLane=smoothstep(0.38,0.68,fbm(cq*1.9+7.3));',
    '    col+=cloud_color*cloud_amount*body*(0.045+0.13*filaments)*(1.0-0.65*dustLane);',
    '    col+=mix(cloud_color,vec3(0.72,0.86,1.0),0.6)*cloud_amount*pow(filaments,3.0)*body*0.035;',
    '  }',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  function bakeSky() {
    var skySize=P.look.nebula_resolution==='high'?4096:2048;
    skySize=Math.min(skySize,renderer.getContext().getParameter(renderer.getContext().MAX_TEXTURE_SIZE));
    var target = new THREE.WebGLRenderTarget(skySize, skySize/2, {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat, type: P.look.nebula_resolution==='high'?rtType:THREE.UnsignedByteType,
      depthBuffer: false, stencilBuffer: false
    });
    var mat = new THREE.ShaderMaterial({ vertexShader: QUAD_VS, fragmentShader: SKY_FS,uniforms:{cloud_amount:{type:'f',value:P.look.nebula_amount},cloud_scale:{type:'f',value:P.look.nebula_scale},cloud_color:{type:'v3',value:hexVector(P.look.nebula_color)}} });
    var skyScene=quad(mat);renderer.render(skyScene, camera, target, true);
    mat.dispose();skyScene.children[0].geometry.dispose();
    return target;
  }
  function setHexVector(vector,color){var rgb=parseInt(color.slice(1),16);return vector.set(((rgb>>16)&255)/255,((rgb>>8)&255)/255,(rgb&255)/255);}
  function hexVector(color){return setHexVector(new THREE.Vector3(),color);}
  var skyKey='';
  function syncSky(){
    if(!renderer||!uniforms)return;
    var key=JSON.stringify([P.look.nebula_amount,P.look.nebula_scale,P.look.nebula_color,P.look.nebula_resolution]);
    if(key===skyKey)return;skyKey=key;
    var old=galaxyTexture;galaxyTexture=bakeSky();if(old)old.dispose();
    uniforms.galaxy_texture.value=ORIG&&origGalaxy?origGalaxy:galaxyTexture;dirty=true;
  }

  // ─────────────────────────────────────────────────────────── renderer
  var renderer, camera;
  var rtMain, rtA, rtB, rtC, rtD;
  var rtAA;
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
    var mw = Math.max(1, (W * scale) | 0), mh = Math.max(1, (H * scale) | 0);
    if (!rtMain || rtMain.width !== mw || rtMain.height !== mh) {
      if (rtMain) rtMain.dispose();
      rtMain = makeTarget(mw, mh, rtType);
    }
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
    if (options.antialiasing) {
      // Edge-directed FXAA after tone mapping: no scene blur on low-contrast
      // pixels, and no change to the ray tracer or analytic grid coverage.
      post.aa = new THREE.ShaderMaterial({
        uniforms:{src:{type:'t',value:null},texel:{type:'v2',value:new THREE.Vector2()}},
        vertexShader:QUAD_VS,
        fragmentShader:[
          'uniform sampler2D src; uniform vec2 texel; varying vec2 vUv;',
          'void main(){',
          'vec3 c=texture2D(src,vUv).rgb;',
          'vec3 nw=texture2D(src,vUv+vec2(-1.0,-1.0)*texel).rgb;',
          'vec3 ne=texture2D(src,vUv+vec2(1.0,-1.0)*texel).rgb;',
          'vec3 sw=texture2D(src,vUv+vec2(-1.0,1.0)*texel).rgb;',
          'vec3 se=texture2D(src,vUv+vec2(1.0,1.0)*texel).rgb;',
          'vec3 luma=vec3(0.299,0.587,0.114);',
          'float m=dot(c,luma),a=dot(nw,luma),b=dot(ne,luma),d=dot(sw,luma),e=dot(se,luma);',
          'float lo=min(m,min(min(a,b),min(d,e))),hi=max(m,max(max(a,b),max(d,e)));',
          'if(hi-lo<max(0.0312,hi*0.125)){gl_FragColor=vec4(c,1.0);return;}',
          'vec2 dir=vec2(-((a+b)-(d+e)),(a+d)-(b+e));',
          'float reduce=max((a+b+d+e)*0.03125,0.0078125);',
          'dir=clamp(dir/(min(abs(dir.x),abs(dir.y))+reduce),vec2(-8.0),vec2(8.0))*texel;',
          'vec3 p=0.5*(texture2D(src,vUv-dir/6.0).rgb+texture2D(src,vUv+dir/6.0).rgb);',
          'vec3 q=p*0.5+0.25*(texture2D(src,vUv-dir*0.5).rgb+texture2D(src,vUv+dir*0.5).rgb);',
          'float l=dot(q,luma);gl_FragColor=vec4(l<lo||l>hi?p:q,1.0);',
          '}'
        ].join('\n')
      });
      post.sAA=quad(post.aa);
    }
  }

  var UNIFORM_LOOK = ['grid_strength', 'grid_glow', 'grid_pulse', 'floor_strength', 'floor_height',
    'floor_tilt', 'floor_cell', 'floor_extent', 'disk_temp', 'disk_outer', 'disk_speed',
    'spot_strength', 'galaxy_gain','floor_concentration','floor_reflection','floor_roughness','gas_tint'];
  var rtReflection=null;

  function ready() {
    if (!templates.neon || renderer) return;
    try { initialize(); } catch(error) { readyReject(error); }
  }
  function initialize() {
    template = ORIG ? templates.orig : templates.neon;
    renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: !!options.test, depth:false, stencil:false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    // 8-bit targets clip at 1.0 before bloom; prefer half-float when available
    if (renderer.extensions.get('OES_texture_half_float') &&
        renderer.extensions.get('OES_texture_half_float_linear')) rtType = THREE.HalfFloatType;
    camera = new THREE.PerspectiveCamera(45, 1, 1, 80000);

    galaxyTexture = bakeSky();
    skyKey=JSON.stringify([P.look.nebula_amount,P.look.nebula_scale,P.look.nebula_color,P.look.nebula_resolution]);
    if (ORIG) origGalaxy = makeOrigGalaxy();

    uniforms = {
      time: { type: 'f', value: 0 },
      sky_rotation: { type: 'm3', value: new THREE.Matrix3() },
      resolution: { type: 'v2', value: new THREE.Vector2() },
      cam_pos: { type: 'v3', value: new THREE.Vector3() },
      cam_x: { type: 'v3', value: new THREE.Vector3() },
      cam_y: { type: 'v3', value: new THREE.Vector3() },
      cam_z: { type: 'v3', value: new THREE.Vector3() },
      cam_vel: { type: 'v3', value: new THREE.Vector3() },
      disk_n: { type:'v3', value:new THREE.Vector3(0,0,1) },
      disk_bx: { type:'v3', value:new THREE.Vector3(1,0,0) },
      disk_by: { type:'v3', value:new THREE.Vector3(0,1,0) },
      planet_distance: { type: 'f', value: 7 },
      planet_radius: { type: 'f', value: 0.4 },
      planet_eccentricity: {type:'f',value:0}, planet_phase:{type:'f',value:0}, planet_speed:{type:'f',value:1},
      planet_spin:{type:'f',value:0}, planet_texture_offset:{type:'f',value:0},
      planet_bx:{type:'v3',value:new THREE.Vector3(1,0,0)}, planet_by:{type:'v3',value:new THREE.Vector3(0,1,0)},
      planet_tx:{type:'v3',value:new THREE.Vector3(1,0,0)}, planet_ty:{type:'v3',value:new THREE.Vector3(0,1,0)}, planet_tz:{type:'v3',value:new THREE.Vector3(0,0,1)},
      floor_x:{type:'f',value:0}, floor_y:{type:'f',value:0},
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
    uniforms.gas_color={type:'v3',value:new THREE.Vector3()};
    uniforms.floor_color={type:'v3',value:new THREE.Vector3()};
    uniforms.floor_major_color={type:'v3',value:new THREE.Vector3()};
    uniforms.reflection_pass={type:'f',value:0};
    uniforms.reflection_tex={type:'t',value:textures.moon};
    ['pos','x','y','z'].forEach(function(k){uniforms['reflect_'+k]={type:'v3',value:new THREE.Vector3()};});

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
    if (window.ResizeObserver) new ResizeObserver(function () { resize(); }).observe(container);

    observer.resetOrbit();
    syncPlanetTexture();
    syncGasTexture();
    lastT = performance.now();
    readyResolve(api);
    setActive(active);
  }

  function resize() {
    if (!renderer) return;
    var w=Math.max(1,container.clientWidth), h=Math.max(1,container.clientHeight);
    if (rtMain && renderer.domElement.width===Math.floor(w*renderer.getPixelRatio()) && renderer.domElement.height===Math.floor(h*renderer.getPixelRatio())) return;
    renderer.setSize(w, h);
    buildTargets(curScale || P.look.render_scale);
  }

  var viewRotation = new THREE.Matrix4(), viewYaw = new THREE.Matrix4();
  var cameraView = new THREE.Matrix3(), cameraLevel = new THREE.Matrix3();
  var worldFloor = new THREE.Matrix3(), worldFloorYaw;
  function viewMatrix(pitch, yaw, cm) {
    viewRotation.makeRotationX(degToRad(-pitch));
    viewRotation.multiply(viewYaw.makeRotationY(degToRad(-yaw)));
    var e = viewRotation.elements;
    cm.set(e[0], e[1], e[2], e[8], e[9], e[10], e[4], e[5], e[6]);
    return cm;
  }

  var floorBasis = new THREE.Matrix3();
  function updateCamera() {
    var c = P.camera, k = 2 * Math.PI / Math.max(c.wobble_period, 1), tt = observer.clock;
    var wp = c.wobble_pitch * (0.75 * Math.sin(k * tt) + 0.25 * Math.sin(k * 2.618 * tt + 1.3));
    var wy = c.wobble_yaw * (0.7 * Math.sin(k * 0.73 * tt + 0.5) + 0.3 * Math.sin(k * 1.91 * tt + 2.1));
    if (!P.observer.motion) { wp = 0; wy = 0; }
    var cm = viewMatrix(c.pitch + wp, c.yaw + wy, cameraView);
    var cmLevel = viewMatrix(c.pitch, c.yaw, cameraLevel);
    if (worldFloorYaw !== P.look.floor_yaw) {
      viewMatrix(0, P.look.floor_yaw, worldFloor);
      worldFloorYaw = P.look.floor_yaw;
    }
    if (P.observer.motion) {
      var frame = observer.orbitalFrame();
      floorBasis.copy(frame).multiply(cmLevel);
      observer.orientation = frame.multiply(cm);
    } else {
      floorBasis.copy(worldFloor);
      var az=degToRad(P.observer.azimuth+observer.rotation), el=degToRad(P.observer.elevation);
      observer.position.set(Math.cos(az)*Math.cos(el),Math.sin(az)*Math.cos(el),Math.sin(el)).multiplyScalar(P.observer.distance);
      // Stationary height changes the viewpoint before aiming at the hole.
      // Free-movement offsets remain separate, preserving manual navigation.
      observer.position.z += c.height;
      var forward=observer.position.clone().normalize().negate();
      var right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,0,1)).normalize();
      var up=new THREE.Vector3().crossVectors(right,forward);
      var basis=new THREE.Matrix3().set(right.x,forward.x,up.x,right.y,forward.y,up.y,right.z,forward.z,up.z);
      observer.orientation = basis.multiply(cm);
      observer.position.add(new THREE.Vector3(c.offset_x,c.offset_y,c.offset_z));
      if(observer.position.length()<1.5){if(observer.position.length()>0)observer.position.normalize().multiplyScalar(1.5);else observer.position.set(0,-1.5,0);}
      observer.velocity.set(0, 0, 0);
    }
  }

  var diskBasisKey = '';
  var skyMatrix = new THREE.Matrix4(), skyAxis = new THREE.Vector3();
  function updateUniforms() {
    var L = P.look;
    uniforms.time.value = observer.time;
    if (options.skyMotion) {
      var tilt=degToRad(L.sky_axis_tilt);
      skyAxis.set(Math.sin(tilt),0,Math.cos(tilt));
      skyMatrix.makeRotationAxis(skyAxis,degToRad(-observer.skyAngle));
      var sk=skyMatrix.elements;
      uniforms.sky_rotation.value.set(sk[0],sk[4],sk[8],sk[1],sk[5],sk[9],sk[2],sk[6],sk[10]);
    }
    uniforms.cam_pos.value.copy(observer.position);
    uniforms.cam_vel.value.copy(observer.velocity);
    var key=L.disk_tilt+','+L.disk_yaw;
    if (key !== diskBasisKey) {
      var disk=new THREE.Matrix4().makeRotationZ(degToRad(L.disk_yaw)).multiply(new THREE.Matrix4().makeRotationX(degToRad(L.disk_tilt))).elements;
      uniforms.disk_bx.value.set(disk[0],disk[1],disk[2]);
      uniforms.disk_by.value.set(disk[4],disk[5],disk[6]);
      uniforms.disk_n.value.set(disk[8],disk[9],disk[10]);
      diskBasisKey=key;
    }
    var e = observer.orientation.elements;
    uniforms.cam_x.value.set(e[0], e[1], e[2]);
    uniforms.cam_y.value.set(e[3], e[4], e[5]);
    uniforms.cam_z.value.set(e[6], e[7], e[8]);
    if (!L.floor_follow_camera) floorBasis.copy(worldFloor);
    var f = floorBasis.elements;
    uniforms.floor_bx.value.set(f[0], f[1], f[2]);
    uniforms.floor_by.value.set(f[3], f[4], f[5]);
    uniforms.floor_bz.value.set(f[6], f[7], f[8]);
    uniforms.floor_offset.value.copy(observer.floorOffset);
    uniforms.planet_distance.value = P.planet.distance;
    uniforms.planet_radius.value = P.planet.radius;
    if (P.planet.enabled) {
    var pp=P.planet;
    var orbitBasis=new THREE.Matrix4().makeRotationZ(degToRad(pp.node)).multiply(new THREE.Matrix4().makeRotationX(degToRad(pp.inclination))).multiply(new THREE.Matrix4().makeRotationZ(degToRad(pp.periapsis)));
    var pe=orbitBasis.elements;
    uniforms.planet_bx.value.set(pe[0],pe[1],pe[2]);uniforms.planet_by.value.set(pe[4],pe[5],pe[6]);
    var te=orbitBasis.multiply(new THREE.Matrix4().makeRotationY(degToRad(pp.axial_tilt))).elements;
    uniforms.planet_tx.value.set(te[0],te[1],te[2]);uniforms.planet_ty.value.set(te[4],te[5],te[6]);uniforms.planet_tz.value.set(te[8],te[9],te[10]);
    uniforms.planet_eccentricity.value=pp.eccentricity;uniforms.planet_phase.value=degToRad(pp.phase);uniforms.planet_speed.value=pp.speed;
    uniforms.planet_spin.value=degToRad(pp.spin);uniforms.planet_texture_offset.value=pp.texture_offset;
    }
    uniforms.floor_x.value=L.floor_x;uniforms.floor_y.value=L.floor_y;
    UNIFORM_LOOK.forEach(function (k) { uniforms[k].value = L[k]; });
    uniforms.floor_tilt.value = degToRad(L.floor_tilt);
    var rgb=parseInt(L.gas_color.slice(1),16);
    uniforms.gas_color.value.set(((rgb>>16)&255)/255,((rgb>>8)&255)/255,(rgb&255)/255);
    if(L.floor_palette){setHexVector(uniforms.floor_color.value,L.floor_color);setHexVector(uniforms.floor_major_color.value,L.floor_major_color);}
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
    animationFrame = null;
    if (!active || document.hidden) return;
    animationFrame = requestAnimationFrame(frame);
    var frameMs = now - lastT;
    var dt = Math.min(frameMs / 1000, 0.1); lastT = now;

    if (paused && !dirty && !needsCompile) return;
    if (!paused) adaptResolution(frameMs, now);

    if (needsCompile) {
      var source = compile();
      if (mainMat.fragmentShader !== source) {
        mainMat.fragmentShader = source;
        mainMat.needsUpdate = true;
      }
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
    if(!ORIG && P.neon_floor && L.floor_reflection>0){
      // Trace the scene from the camera mirrored in the actual floor plane.
      if(!rtReflection||rtReflection.width!==rtMain.width||rtReflection.height!==rtMain.height){if(rtReflection)rtReflection.dispose();rtReflection=makeTarget(rtMain.width,rtMain.height,rtType);}
      var normal=uniforms.floor_by.value.clone().multiplyScalar(Math.cos(uniforms.floor_tilt.value)).add(uniforms.floor_bz.value.clone().multiplyScalar(Math.sin(uniforms.floor_tilt.value))).normalize();
      var planeD=L.floor_follow_camera?uniforms.cam_pos.value.dot(normal)-L.floor_height:-L.floor_height;
      var saved={};['pos','x','y','z','vel'].forEach(function(k){var v=uniforms['cam_'+k].value;saved[k]=v.clone();v.add(normal.clone().multiplyScalar(-2*(v.dot(normal)-(k==='pos'?planeD:0))));if(k!=='vel')uniforms['reflect_'+k].value.copy(v);});
      uniforms.reflection_pass.value=1;uniforms.reflection_tex.value=textures.moon;
      pass(mainScene,rtReflection);
      ['pos','x','y','z','vel'].forEach(function(k){uniforms['cam_'+k].value.copy(saved[k]);});
      uniforms.reflection_pass.value=0;uniforms.reflection_tex.value=rtReflection;
    }else if(rtReflection){rtReflection.dispose();rtReflection=null;uniforms.reflection_tex.value=textures.moon;}
    pass(mainScene, rtMain);

    var bloom = !ORIG && L.bloom_strength !== 0;
    if (bloom) {
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
    }

    var C = post.composite.uniforms;
    C.scene.value = rtMain;
    // Bind a valid target even when bloom is unused; multiplying it by zero
    // leaves the compositor's output identical without ten extra GPU passes.
    C.bloom1.value = bloom ? rtA : rtMain; C.bloom2.value = bloom ? rtC : rtMain;
    C.strength.value = ORIG ? 0.0 : L.bloom_strength;
    C.exposure.value = L.exposure;
    C.tonemap.value = ORIG ? 0.0 : 1.0;
    if (options.antialiasing && L.antialiasing) {
      var canvas=renderer.domElement;
      if (!rtAA || rtAA.width!==canvas.width || rtAA.height!==canvas.height) {
        if(rtAA)rtAA.dispose();
        rtAA=makeTarget(canvas.width,canvas.height,THREE.UnsignedByteType);
      }
      pass(post.sComp,rtAA);
      post.aa.uniforms.src.value=rtAA;
      post.aa.uniforms.texel.value.set(1/rtAA.width,1/rtAA.height);
      renderer.render(post.sAA,camera);
    } else {
      if(rtAA){rtAA.dispose();rtAA=null;}
      renderer.render(post.sComp, camera);
    }
    frameCount++;
  }

  // ─────────────────────────────────────────────────────────── controls
  function setOriginal(on) {
    ORIG = !!on;
    if (!templates.neon || !uniforms) return;
    template = ORIG ? templates.orig : templates.neon;
    if (ORIG && !origGalaxy) origGalaxy = makeOrigGalaxy();
    uniforms.galaxy_texture.value = ORIG && origGalaxy ? origGalaxy : galaxyTexture;
    needsCompile = true;
  }

  function settings() {
    var out = JSON.parse(JSON.stringify(P));
    out.version=1;
    out.renderer=ORIG ? 'original' : 'neon';
    return out;
  }

  function applySettings(input, preserveTime) {
    var next=NeonSettings.validate(input,defaults);
    Object.keys(P).forEach(function (k) {
      if (typeof P[k]==='function') return;
      if (P[k] && typeof P[k]==='object') Object.assign(P[k],next[k]);
      else P[k]=next[k];
    });
    if (!preserveTime) {
      Object.assign(observer,new Observer());
      observer.resetOrbit();
    }
    setOriginal(next.renderer==='original');
    needsCompile=true; dirty=true;
    if (renderer) buildTargets(P.look.auto_res && curScale ? Math.min(curScale,P.look.render_scale) : P.look.render_scale);
    syncPlanetTexture();
    syncGasTexture();
    syncSky();
    return settings();
  }
  function setActive(on) {
    active=!!on;
    if (animationFrame!==null) cancelAnimationFrame(animationFrame);
    animationFrame=null;
    if (renderer && active && !document.hidden) {
      if (!renderer.domElement.parentNode) container.appendChild(renderer.domElement);
      lastT=performance.now(); dirty=true;
      animationFrame=requestAnimationFrame(frame);
    } else if (renderer && !active) renderer.domElement.remove();
  }
  document.addEventListener('visibilitychange',function () { setActive(active); });
  var api = {
    params: P, observer: observer,
    ready:readyPromise,
    get isReady() { return !!renderer; },
    get frames() { return frameCount; },
    get active() { return active; },
    get textureReady() { return Promise.all([texturePromise,gasPromise]); },
    capture:function(){if(!renderer)throw new Error('Wait for the viewer to finish loading.');if(needsCompile){var source=compile();if(mainMat.fragmentShader!==source){mainMat.fragmentShader=source;mainMat.needsUpdate=true;}needsCompile=false;}updateCamera();updateUniforms();renderOnce();return renderer.domElement;},
    setActive:setActive, applySettings:applySettings,
    defaults:function () { return JSON.parse(JSON.stringify(defaults)); },
    recompile: function () { needsCompile = true; },
    setOriginal: setOriginal, isOriginal: function () { return ORIG; },
    settings: settings,
    // Camera input updates uniforms without restarting the orbit or reallocating targets.
    moveCamera: function (yaw, pitch, zoom) {
      if (P.observer.motion || ![yaw,pitch,zoom].every(Number.isFinite)) return;
      P.camera.yaw = ((P.camera.yaw + yaw + 180) % 360 + 360) % 360 - 180;
      P.camera.pitch = Math.max(-60, Math.min(60, P.camera.pitch + pitch));
      P.observer.distance = Math.max(3.01, Math.min(30, P.observer.distance * Math.exp(zoom)));
      dirty = true;
    },
    orbitCamera: function (azimuth, elevation) {
      if (P.observer.motion || ![azimuth,elevation].every(Number.isFinite)) return;
      P.observer.azimuth = ((P.observer.azimuth + observer.rotation + azimuth + 180) % 360 + 360) % 360 - 180;
      observer.rotation = 0;
      P.observer.elevation = Math.max(-85, Math.min(85, P.observer.elevation + elevation));
      dirty = true;
    },
    translateCamera: function (x,y,z) {
      if (P.observer.motion || ![x,y,z].every(Number.isFinite)) return;
      var e=observer.orientation.elements, c=P.camera;
      var delta=new THREE.Vector3(e[0]*x+e[3]*y+e[6]*z,e[1]*x+e[4]*y+e[7]*z,e[2]*x+e[5]*y+e[8]*z);
      if(observer.position.clone().add(delta).length()<1.5)return;
      c.offset_x=Math.max(-100,Math.min(100,c.offset_x+delta.x));c.offset_y=Math.max(-100,Math.min(100,c.offset_y+delta.y));c.offset_z=Math.max(-100,Math.min(100,c.offset_z+delta.z));
      dirty=true;
    },
    setPaused: function (p) { paused = !!p; dirty = true; }, isPaused: function () { return paused; },
    getScale: function () { return curScale; },
    isOrbitValid: function () { return !observer.invalid; }
  };
  if (options.settings) applySettings(options.settings);
  loadTexture('spectra',BASE+'img/spectra.png',THREE.LinearFilter);
  loadTexture('moon',BASE+'img/beach-ball.png',THREE.LinearFilter);
  loadTexture('stars',BASE+'img/stars.png',THREE.LinearFilter);
  loadTexture('accretion_disk',BASE+'img/accretion-disk.png',THREE.LinearFilter);
  pending++;
  Promise.all(['raytracer-neon.glsl','raytracer-orig.glsl'].map(function (u) {
    return fetch(BASE+u).then(function (r) { if (!r.ok) throw new Error('Could not load '+u); return r.text(); });
  })).then(function (t) {
    templates.neon=t[0]; templates.orig=t[1];
    if (--pending===0) ready();
  }).catch(readyReject);
  return api;
};
