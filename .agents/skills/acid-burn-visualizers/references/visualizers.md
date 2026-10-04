# Editing visualizers

Use `maps/config.json` and `pagelayout.json` to locate the current tools. Follow
each HTML page's imports to find its implementation; filenames and script
versions can change. Read data sources as well as rendering code before editing.

| Tool | Start here |
| --- | --- |
| Neon black hole | `neon-black-hole.html`, `neon/viewer.js`, `neon/settings.js`, `neon/js-libs/neon-blackhole.js`, `neon/raytracer-neon.glsl` |
| Portable Neon export | `neon/index.html`, `neon/zip.js`, export builder in `neon/viewer.js` |
| Ya Ke system atlas | `yake.html` and its imported atlas scripts/data |
| Galactic star map | `galaxy.html` and its imported scene/route scripts/data |
| Transit map | `exu2374.html` and its imported map scripts/data |
| Spacecraft viewer | `ship-viewer.html`, `js/ship-viewer.js`, `js/ship-renderer.js`, `js/ship-catalog.js` |
| Vehicle viewer | `vehicle-viewer.html` and its imported renderer/model scripts |

## Scene ownership

The shared BH background and a visualizer's scene are different renderers. Keep
exactly one canvas per intended scene. A viewer can disable the shared background
with the existing `data-disable-bh-background` body attribute without changing
the user's stored mode or disabling its own scene. Inspect `js/acidburn-mode.js`
and `js/acidburn-blackhole.js` for current lifecycle behavior.

Preserve bundled renderer versions and dependency order. Reuse current resize,
pause, visibility, pointer-capture and cleanup paths. Controls and 3D labels
must remain readable on phones and in expanded windows. Use real mobile device
signals where input behavior needs them; ARM architecture alone is not a phone.
World-space placement, camera look, orbit, and screen-space overlays are separate
concerns; confirm coordinates and units rather than swapping axes by intuition.

## Neon black hole invariants

- `js/acidburn-blackhole.js` sets site-background overrides; factory defaults
  and viewer settings are separate. A background-only request belongs in that
  wrapper. Preserve the actual Legacy renderer and mode preference behavior.
- `neon/settings.js` owns validation and generated accessible controls. Add
  settings to both the schema and factory defaults; older JSON should load by
  merging defaults. Validate atomically before mutating the scene.
- Viewer settings are isolated from site mode and background parameters. Camera
  height applies in stationary mode; free offsets and look controls are separate.
  Floor placement uses its own basis. Preserve disk tilt and planet mapping.
- `viewer.js` exports code, shaders, textures, styles, chosen defaults and JSON.
  A new setting must survive import, reset to exported defaults, and ZIP
  round-tripping. Include any new runtime asset in the explicit export manifest.
  Keep hosting-injected analytics out of portable exports.
- Sky motion and FXAA are enabled as capabilities by the viewer's factory
  options; the site background does not use those passes. Analytic grid coverage
  in the shader and optional post-process antialiasing are separate.

## Tests to adapt

Inspect `tests/neon-browser.py` for actual fonts, shared-style inheritance,
settings validation, responsive panes and standalone export. Renderer checks
include `neon-camera-browser.py`, `neon-planet-browser.py`,
`neon-grid-browser.py`, `neon-sky-browser.py`, `neon-aa-browser.py`,
`neon-background-browser.py` and `neon-optimization-browser.py`.
Use the applicable checks, not every test indiscriminately. Disable unrelated
animation and freeze camera/time when comparing rendered frames.

For other maps, start with `tests/map-windows-browser.py` and relevant
`tests/yake-*.py` or target-viewer tests. Run from the repository root with a
Python interpreter that has Playwright and the required browser installed.
Inspect a test's network fixture before interpreting missing external assets.
Tests should observe behavior and pixels; checking that source contains a class
or label is insufficient. Report any unavailable tooling or verification limit.
