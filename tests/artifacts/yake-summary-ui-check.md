# Ya Ke summary-card verification

## Implemented

- World Details and all expanded narrative/places/source-note content are no
  longer rendered. The data retains the source material, but the public cards
  show only name, type, intro, and the first four stats.
- Focus World, Explore Moons, and Celosia's continent controls are in an external
  map action bar. The non-WebGL fallback retains external Explore Moons controls.
- Cards have no internal scrolling or height clipping. On narrow/short screens
  they sit below the map in normal flow. Selecting brings the card into view;
  Focus World brings the map back into view. Spacious desktop screens retain
  overlay cards, with tests ensuring they stay above the action bar.
- Introductory text is visible at all widths. General map controls are at least
  44px in both dimensions. Short-screen expanded controls are no longer clipped.
- Jin's EZ is 1,560,000 km. Vas at 1,413,613 km is inside; Horizon's Edge uses the
  same radial scale and remains just outside. Its exact orbital radius is not
  invented. Fengsheng remains unplotted.
- Population display below one million is in thousands rounded to the nearest
  500 (Xuan: 774.5 thousand; Pani: ~780 thousand). Source counts and non-population
  quantities are unchanged.

## Verification

- `node tests/yake-summary-data.mjs`: rounding/unit boundaries, resident counts,
  unchanged physical quantities and source records, four-stat limit, revised EZ.
- `node --check` for the edited JavaScript.
- `C:\Python314\python.exe tests/yake-atlas-browser.py`: desktop and phone
  navigation, all three moon views, geometry, card/actions separation, shared CSS,
  black-hole lifecycle, and non-WebGL fallback. All pass.
- `C:\Python314\python.exe tests/yake-ux-workflow.py`: all 26 cards at each of
  320x568, 390x844, 430x932, 844x390, 768x1024, 1024x768, 1366x768, 1920x1080,
  and 2560x1440. No card-internal overflow, missing intros, horizontal document
  overflow, or script errors. External actions, keyboard selection, navigation,
  label toggle, Escape, and unobscured expanded controls pass.

Normal page scrolling (or the overall expanded atlas's scrolling) is still
necessary when a small screen cannot fit the map, controls, and complete card
simultaneously. Focus intentionally brings the map, rather than the card, into
view. This is not an internally scrolling card.

Testing uses local Chromium/Playwright and SwiftShader. Screenshots were visually
reviewed. External web fonts are blocked by the test fixture; these checks do
not replace physical-device or Safari/Firefox testing.

The current summary-only content inventory is `yake-info-inventory.md`.
The earlier `yake-ux-audit.md` is a historical pre-change baseline.
