# Ya Ke translucent overlay verification

This supersedes the below-map layout in `yake-summary-ui-check.md`.

- All 3D summary cards overlay the map at every tested size. Short landscape
  uses a wide card with the introduction spanning both columns.
- Card backgrounds are translucent (78% opacity in dark/BH, 82% in light);
  text remains opaque and the existing Acid Burn component styling is retained.
- No card-internal scrolling or clipped summary content. Focus World / Explore
  Moons remain in the external action bar. No world data or geometry changes.
- Opening does not scroll the page or move the map. Closing with X or Escape
  preserves camera position, orientation, target, and zoom.
- The non-WebGL fallback retains its existing readable chart/card flow.

## Checks

`C:\Python314\python.exe tests/yake-ux-workflow.py` passes all 26 cards in normal
and expanded modes at 320x568, 390x844, 430x932, 568x320, 640x360, 844x390,
768x1024, 1024x768, 1366x768, 1920x1080, and 2560x1440. The audit asserts card
containment within the map, complete text, no internal overflow, background
alpha, unchanged map placement on opening, and retained camera focus on closing.
No JavaScript errors occurred. Some short screens still require scrolling the
overall page/expanded atlas to reach external controls; the card itself does not
scroll or extend below the map.

`C:\Python314\python.exe tests/yake-atlas-browser.py` also passes desktop/mobile
navigation, X-button camera preservation, geometry, shared CSS, black-hole
lifecycle, and the non-WebGL fallback. `node --check js/yake-map.js` passes.

Chromium/Playwright + SwiftShader; representative screenshots visually reviewed.
External web fonts are blocked by the local fixture. Physical devices and
Safari/Firefox are not certified by these checks.
