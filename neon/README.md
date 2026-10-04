# Neon black hole (fork)

Standalone fork of the site's Schwarzschild raytracer. Open `neon/index.html` from the repo root. URL params from round 1 were replaced by the control panel; `#orig` starts on the original shader (it loads `../js-libs`, `../img`, `../js/acidburn-galaxy.js`).

The geodesic integrator, observer orbit, Doppler/beaming/aberration/light-travel-time are untouched. Everything new is an emitter placed in Schwarzschild space and sampled along the same null geodesics, so it is lensed for real.

## What changed vs `raytracer.glsl`

- **Sky grid is analytic.** Old: 1 px lines at 25% alpha drawn into a 2048x1024 canvas, then x0.4 in the shader and minified by the sampler, which is why it was faint. New: grid evaluated on the escape direction, anti-aliased with `fwidth` of the unit vector (seam-free), screen-space glow, fades to its mean where lensing packs lines below pixel scale. Packets run along meridians; a latitude band sweeps the sky and becomes arcs through the lens.
- **Synthwave floor.** Plane rigidly attached to the observer frame (stylization: not boosted with the orbit), tilted so the horizon sits below the hole. Tested on every geodesic segment *and* on the final asymptote (the loop never tests the last segment to infinity; skipping that gave a sawtooth horizon). Footprint-based AA, distance haze, images wrapping > ~pi faded out.
- **Disk.** Keplerian differential rotation (Omega = v/r) on retarded time, two-layer flow-map so it shears without winding up. Optional Novikov-Thorne profile T ~ r^-3/4 (1 - sqrt(3/r))^1/4 with bolometric T^4 brightness, and gravitational redshift sqrt(g_tt(r)/g_tt(r_cam)), which the original omits.
- **Post.** Half-float bloom (two blur levels), hue-preserving tonemap, faint scanlines/vignette.
- **FOV.** Vertical FOV capped (default 72 deg); the original's fixed 90 deg horizontal makes portrait ~120 deg tall.

## Changes, round 2

- **Disk flow that moves.** `img/accretion-disk.png` is concentric rings (its brightness varies ~40x more with r than with phi), so rotating it is invisible. Gas is now procedural 3D value noise advected at coordinate Omega = sqrt(1/(2 r^3)) in retarded time, two epochs crossfaded with a variance-preserving blend, plus three Keplerian hot spots that go through the beaming/Doppler path. `disk_speed` (default 1 = Keplerian) is a stylized multiplier.
- **Eccentric geodesic camera.** Binet equation d2u/dphi2 = -u + 1/(2L^2) + 3u^2/2 (r_s = 1) stepped in proper time, E and L solved from periapsis/apoapsis (default 4.1 / 22.6 r_s: L = 2.152, E = 0.9821, 0.465c at periapsis, 120.6 deg precession per orbit). Invalid pairs fall back to a circular r = 8 orbit with a warning.
- **Site palette.** Floor: `--purple` minor lines, `--cyan` major lines every 4 cells.
- **Sky.** Procedural nebula + galactic band baked once to a 2048x1024 target on the GPU (no per-frame canvas upload). `neon_sky` applies Doppler as a tint instead of the blackbody refit that turned neon into beige.
- **Performance.** Adaptive raytrace resolution (target fps, max scale), 60 steps default, renders only on change when paused. Not benchmarked on real GPUs.

## URL params

`?shader=orig` (original shader in the same harness), `?t=40&freeze` (single frame), `?nogui`, `?scale=0.6` (raytrace resolution), plus any look param or feature flag, e.g. `?neon_floor=0&grid_strength=0.6&vfov=90&pitch=3&yaw=0`.

## Porting to the main site

`js/acidburn-blackhole.js` needs: load `neon/raytracer-neon.glsl`, add the extra uniforms (see `updateUniforms` here), set `material.derivatives = true` (three r73), and add the five feature flags to `Shader.parameters`. Bloom is optional. For a subtle site version: `neon_floor=false`, `vfov` large enough to keep 90 deg horizontal, `pitch=3, yaw=0`.
