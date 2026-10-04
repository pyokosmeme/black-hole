# Neon black hole (fork)

Standalone fork of the site's Schwarzschild raytracer. Open `neon/index.html` from the repo root (it loads `../js-libs`, `../img`, `../js/acidburn-galaxy.js`).

The geodesic integrator, observer orbit, Doppler/beaming/aberration/light-travel-time are untouched. Everything new is an emitter placed in Schwarzschild space and sampled along the same null geodesics, so it is lensed for real.

## What changed vs `raytracer.glsl`

- **Sky grid is analytic.** Old: 1 px lines at 25% alpha drawn into a 2048x1024 canvas, then x0.4 in the shader and minified by the sampler, which is why it was faint. New: grid evaluated on the escape direction, anti-aliased with `fwidth` of the unit vector (seam-free), screen-space glow, fades to its mean where lensing packs lines below pixel scale. Packets run along meridians; a latitude band sweeps the sky and becomes arcs through the lens.
- **Synthwave floor.** Plane rigidly attached to the observer frame (stylization: not boosted with the orbit), tilted so the horizon sits below the hole. Tested on every geodesic segment *and* on the final asymptote (the loop never tests the last segment to infinity; skipping that gave a sawtooth horizon). Footprint-based AA, distance haze, images wrapping > ~pi faded out.
- **Disk.** Keplerian differential rotation (Omega = v/r) on retarded time, two-layer flow-map so it shears without winding up. Optional Novikov-Thorne profile T ~ r^-3/4 (1 - sqrt(3/r))^1/4 with bolometric T^4 brightness, and gravitational redshift sqrt(g_tt(r)/g_tt(r_cam)), which the original omits.
- **Post.** Half-float bloom (two blur levels), hue-preserving tonemap, faint scanlines/vignette.
- **FOV.** Vertical FOV capped (default 72 deg); the original's fixed 90 deg horizontal makes portrait ~120 deg tall.

## URL params

`?shader=orig` (original shader in the same harness), `?t=40&freeze` (single frame), `?nogui`, `?scale=0.6` (raytrace resolution), plus any look param or feature flag, e.g. `?neon_floor=0&grid_strength=0.6&vfov=90&pitch=3&yaw=0`.

## Porting to the main site

`js/acidburn-blackhole.js` needs: load `neon/raytracer-neon.glsl`, add the extra uniforms (see `updateUniforms` here), set `material.derivatives = true` (three r73), and add the five feature flags to `Shader.parameters`. Bloom is optional. For a subtle site version: `neon_floor=false`, `vfov` large enough to keep 90 deg horizontal, `pitch=3, yaw=0`.
