/**
 * ACIDBURN BLACK HOLE RENDERER
 * 
 * Schwarzschild black hole raytracer
 * Based on oseiskar/black-hole
 * 
 * This script should be loaded AFTER:
 * - Three.js and dependencies
 * - acidburn-mode.js
 * - acidburn-galaxy.js (optional, for procedural background)
 */

(function() {
    'use strict';
    
    // Don't initialize if in lite mode
    if (document.body.classList.contains('lite-mode')) {
        console.log('[ACIDBURN Blackhole] Skipping init (lite mode)');
        return;
    }
    
    // Check dependencies
    if (typeof THREE === 'undefined') {
        console.error('[ACIDBURN Blackhole] THREE.js not loaded');
        document.body.classList.add('no-webgl');
        return;
    }
    
    if (!Detector.webgl) {
        console.error('[ACIDBURN Blackhole] WebGL not supported');
        document.body.classList.add('no-webgl');
        return;
    }

    // ═══════════════════════════════════════════════════════════════
    // OBSERVER CLASS
    // ═══════════════════════════════════════════════════════════════

    function Observer() {
        this.position = new THREE.Vector3(10, 0, 0);
        this.velocity = new THREE.Vector3(0, 1, 0);
        this.orientation = new THREE.Matrix3();
        this.time = 0.0;
    }

    Observer.prototype.orbitalFrame = function() {
        var orbital_y = new THREE.Vector3()
            .subVectors(
                this.velocity.clone().normalize().multiplyScalar(4.0),
                this.position
            )
            .normalize();
        var orbital_z = new THREE.Vector3()
            .crossVectors(this.position, orbital_y)
            .normalize();
        var orbital_x = new THREE.Vector3().crossVectors(orbital_y, orbital_z);
        return new THREE.Matrix4()
            .makeBasis(orbital_x, orbital_y, orbital_z)
            .linearPart();
    };

    Observer.prototype.move = function(dt) {
        dt *= shader.parameters.time_scale;
        var r, v = 0;

        if (shader.parameters.observer.motion) {
            r = shader.parameters.observer.distance;
            v = 1.0 / Math.sqrt(2.0 * (r - 1.0));
            var ang_vel = v / r;
            var angle = this.time * ang_vel;
            var s = Math.sin(angle), c = Math.cos(angle);

            this.position.set(c * r, s * r, 0);
            this.velocity.set(-s * v, c * v, 0);

            var alpha = degToRad(shader.parameters.observer.orbital_inclination);
            var orbit_coords = new THREE.Matrix4().makeRotationY(alpha);
            this.position.applyMatrix4(orbit_coords);
            this.velocity.applyMatrix4(orbit_coords);
        } else {
            r = this.position.length();
        }

        if (shader.parameters.gravitational_time_dilation) {
            dt = Math.sqrt((dt * dt * (1.0 - v * v)) / (1 - 1.0 / r));
        }
        this.time += dt;
    };

    // ═══════════════════════════════════════════════════════════════
    // SHADER CLASS
    // ═══════════════════════════════════════════════════════════════

    var container, camera, scene, renderer, shader = null;
    var observer = new Observer();

    function Shader(mustacheTemplate) {
        this.parameters = {
            n_steps: 100,
            quality: "medium",
            accretion_disk: true,
            planet: { enabled: false, distance: 7.0, radius: 0.4 },
            lorentz_contraction: true,
            gravitational_time_dilation: true,
            aberration: true,
            beaming: true,
            doppler_shift: true,
            light_travel_time: true,
            time_scale: 0.5,
            observer: { 
                motion: true, 
                distance: 8.0, 
                orbital_inclination: -15 
            },
            planetEnabled: function() {
                return this.planet.enabled && this.quality !== "fast";
            },
            observerMotion: function() {
                return this.observer.motion;
            },
        };
        var that = this;
        this.needsUpdate = false;
        this.hasMovingParts = function() {
            return this.parameters.planet.enabled || this.parameters.observer.motion;
        };
        this.compile = function() {
            return Mustache.render(mustacheTemplate, that.parameters);
        };
    }

    function degToRad(a) {
        return (Math.PI * a) / 180.0;
    }

    // ═══════════════════════════════════════════════════════════════
    // TEXTURE LOADING
    // ═══════════════════════════════════════════════════════════════

    var textures = {};
    var galaxyTexture = null;

    function whenLoaded() {
        init(textures);
        var loader = document.getElementById('loader');
        if (loader) loader.style.display = 'none';
        animate();
    }

    function checkLoaded() {
        if (shader === null) return;
        for (var key in textures) if (textures[key] === null) return;
        whenLoaded();
    }

    function loadShaders() {
        SHADER_LOADER.load(function(shaders) {
            shader = new Shader(shaders.raytracer.fragment);
            checkLoaded();
        });
    }

    var texLoader = new THREE.TextureLoader();
    
    function loadTexture(symbol, filename, interpolation) {
        textures[symbol] = null;
        texLoader.load(filename, function(tex) {
            tex.magFilter = interpolation;
            tex.minFilter = interpolation;
            textures[symbol] = tex;
            checkLoaded();
        }, undefined, function(err) {
            console.warn('[ACIDBURN Blackhole] Failed to load texture:', filename);
            // Create placeholder texture
            var canvas = document.createElement('canvas');
            canvas.width = canvas.height = 64;
            var ctx = canvas.getContext('2d');
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, 64, 64);
            textures[symbol] = new THREE.CanvasTexture(canvas);
            checkLoaded();
        });
    }

    function loadAcidburnGalaxy() {
        textures["galaxy"] = null;
        
        if (typeof AcidburnGalaxy !== 'undefined') {
            console.log('[ACIDBURN Blackhole] Generating procedural galaxy texture...');
            var galaxyCanvas = AcidburnGalaxy.generate({
                width: 2048,
                height: 1024,
                animated: true
            });
            
            galaxyTexture = new THREE.CanvasTexture(galaxyCanvas);
            galaxyTexture.magFilter = THREE.LinearFilter;
            galaxyTexture.minFilter = THREE.LinearFilter;
            galaxyTexture.wrapS = THREE.RepeatWrapping;
            galaxyTexture.wrapT = THREE.RepeatWrapping;
            textures["galaxy"] = galaxyTexture;
            
            // Start animation with texture update callback
            AcidburnGalaxy.start(function() {
                if (galaxyTexture) {
                    galaxyTexture.needsUpdate = true;
                }
            });
            
            console.log('[ACIDBURN Blackhole] Procedural galaxy texture ready (animated)');
            checkLoaded();
        } else {
            // Fallback to milkyway.jpg
            console.log('[ACIDBURN Blackhole] Falling back to milkyway.jpg');
            loadTexture("galaxy", "img/milkyway.jpg", THREE.NearestFilter);
        }
    }

    function loadAllTextures() {
        loadAcidburnGalaxy();
        loadTexture("spectra", "img/spectra.png", THREE.LinearFilter);
        loadTexture("moon", "img/beach-ball.png", THREE.LinearFilter);
        loadTexture("stars", "img/stars.png", THREE.LinearFilter);
        loadTexture("accretion_disk", "img/accretion-disk.png", THREE.LinearFilter);
    }

    // ═══════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════

    var updateUniforms;

    function init(textures) {
        container = document.getElementById("blackhole-container");
        if (!container) {
            console.error('[ACIDBURN Blackhole] Container not found');
            return;
        }

        scene = new THREE.Scene();
        var geometry = new THREE.PlaneBufferGeometry(2, 2);

        var uniforms = {
            time: { type: "f", value: 0 },
            resolution: { type: "v2", value: new THREE.Vector2() },
            cam_pos: { type: "v3", value: new THREE.Vector3() },
            cam_x: { type: "v3", value: new THREE.Vector3() },
            cam_y: { type: "v3", value: new THREE.Vector3() },
            cam_z: { type: "v3", value: new THREE.Vector3() },
            cam_vel: { type: "v3", value: new THREE.Vector3() },
            planet_distance: { type: "f" },
            planet_radius: { type: "f" },
            star_texture: { type: "t", value: textures.stars },
            accretion_disk_texture: { type: "t", value: textures.accretion_disk },
            galaxy_texture: { type: "t", value: textures.galaxy },
            planet_texture: { type: "t", value: textures.moon },
            spectrum_texture: { type: "t", value: textures.spectra },
        };

        updateUniforms = function() {
            uniforms.planet_distance.value = shader.parameters.planet.distance;
            uniforms.planet_radius.value = shader.parameters.planet.radius;
            uniforms.resolution.value.x = renderer.domElement.width;
            uniforms.resolution.value.y = renderer.domElement.height;
            uniforms.time.value = observer.time;
            uniforms.cam_pos.value = observer.position;

            var e = observer.orientation.elements;
            uniforms.cam_x.value.set(e[0], e[1], e[2]);
            uniforms.cam_y.value.set(e[3], e[4], e[5]);
            uniforms.cam_z.value.set(e[6], e[7], e[8]);

            function setVec(target, value) {
                uniforms[target].value.set(value.x, value.y, value.z);
            }
            setVec("cam_pos", observer.position);
            setVec("cam_vel", observer.velocity);
        };

        var vertexShader = document.getElementById("vertex-shader");
        var material = new THREE.ShaderMaterial({
            uniforms: uniforms,
            vertexShader: vertexShader ? vertexShader.textContent : 'void main() { gl_Position = vec4(position, 1.0); }',
        });

        scene.updateShader = function() {
            material.fragmentShader = shader.compile();
            material.needsUpdate = true;
            shader.needsUpdate = true;
        };
        scene.updateShader();

        var mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        renderer = new THREE.WebGLRenderer();
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);

        camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 80000);
        initializeCamera(camera);

        updateCamera();
        onWindowResize();
        window.addEventListener("resize", onWindowResize, false);
        
        console.log('[ACIDBURN Blackhole] Renderer initialized');
    }

    function onWindowResize() {
        if (renderer) {
            renderer.setSize(window.innerWidth, window.innerHeight);
            if (updateUniforms) updateUniforms();
        }
    }

    function initializeCamera(camera) {
        var pitchAngle = 3.0, yawAngle = 0.0;
        camera.matrixWorldInverse.makeRotationX(degToRad(-pitchAngle));
        camera.matrixWorldInverse.multiply(new THREE.Matrix4().makeRotationY(degToRad(-yawAngle)));
        var m = camera.matrixWorldInverse.elements;
        camera.position.set(m[2], m[6], m[10]);
    }

    function updateCamera() {
        var m = camera.matrixWorldInverse.elements;
        var camera_matrix;

        if (shader.parameters.observer.motion) {
            camera_matrix = new THREE.Matrix3();
        } else {
            camera_matrix = observer.orientation;
        }

        camera_matrix.set(m[0], m[1], m[2], m[8], m[9], m[10], m[4], m[5], m[6]);

        if (shader.parameters.observer.motion) {
            observer.orientation = observer.orbitalFrame().multiply(camera_matrix);
        } else {
            var p = new THREE.Vector3(
                camera_matrix.elements[6],
                camera_matrix.elements[7],
                camera_matrix.elements[8]
            );
            var dist = shader.parameters.observer.distance;
            observer.position.set(-p.x * dist, -p.y * dist, -p.z * dist);
            observer.velocity.set(0, 0, 0);
        }
    }

    function frobeniusDistance(matrix1, matrix2) {
        var sum = 0.0;
        for (var i in matrix1.elements) {
            var diff = matrix1.elements[i] - matrix2.elements[i];
            sum += diff * diff;
        }
        return Math.sqrt(sum);
    }

    // ═══════════════════════════════════════════════════════════════
    // ANIMATION LOOP
    // ═══════════════════════════════════════════════════════════════

    var lastCameraMat = new THREE.Matrix4().identity();
    var animating = true;

    function animate() {
        if (!animating) return;
        requestAnimationFrame(animate);
        
        // Stop rendering if switched to lite mode
        if (document.body.classList.contains('lite-mode')) {
            return;
        }
        
        camera.updateMatrixWorld();
        camera.matrixWorldInverse.getInverse(camera.matrixWorld);

        if (shader.needsUpdate || shader.hasMovingParts() ||
            frobeniusDistance(camera.matrixWorldInverse, lastCameraMat) > 1e-10) {
            shader.needsUpdate = false;
            render();
            lastCameraMat = camera.matrixWorldInverse.clone();
        }
    }

    var getFrameDuration = (function() {
        var lastTimestamp = new Date().getTime();
        return function() {
            var timestamp = new Date().getTime();
            var diff = (timestamp - lastTimestamp) / 1000.0;
            lastTimestamp = timestamp;
            return diff;
        };
    })();

    function render() {
        observer.move(getFrameDuration());
        if (shader.parameters.observer.motion) updateCamera();
        updateUniforms();
        renderer.render(scene, camera);
    }

    // ═══════════════════════════════════════════════════════════════
    // MODE CHANGE LISTENER
    // ═══════════════════════════════════════════════════════════════
    
    window.addEventListener('acidburn-mode-change', function(e) {
        if (e.detail.isLite) {
            animating = false;
        } else {
            animating = true;
            animate();
        }
    });

    // ═══════════════════════════════════════════════════════════════
    // START
    // ═══════════════════════════════════════════════════════════════

    loadShaders();
    loadAllTextures();

    // Public API
    window.AcidburnBlackhole = {
        getShader: function() { return shader; },
        getObserver: function() { return observer; },
        setDistance: function(d) { 
            if (shader) {
                shader.parameters.observer.distance = d;
                shader.needsUpdate = true;
            }
        },
        setTimeScale: function(t) {
            if (shader) {
                shader.parameters.time_scale = t;
            }
        }
    };

})();
