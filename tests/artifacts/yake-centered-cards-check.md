# Ya Ke centered cards and world exploration — 2026-09-06

Changes: centered translucent cards, short curated details, a screen-bottom action
dock outside the cards, star/system summary beneath the heading (no catalogue
identity or floating star nameplate), double-click/tap focus, individual Buka and
Chawkee torus highlights, italicized celariums, and corrected SWI naming.

Celosia has smaller Mu/Diyu land silhouettes and three colored coastline outlines.
Continent actions present the author's climate/city notes. No city coordinates or
unspecified moon orbital radii were invented. Five Islands names all five members.

Verified with local Playwright Chromium and software WebGL:

- 25 world cards in normal and expanded mode at 320×568, 390×844, 430×932,
  568×320, 640×360, 844×390, 768×1024, 1024×768, 1366×768, 1920×1080,
  and 2560×1440. No internal card scrolling, clipped text, or horizontal overflow.
- Cards center on the viewport without shifting the map on selection. World
  actions do not overlap cards. Expanded general controls remain visible.
- Mouse double-click and emulated double-tap at four resolutions; cards do not
  intercept the second tap. Closing retains focus and selection; reset clears it.
- Separate ring highlights and Buka/Chawkee controls; continent cards and italics.
- Existing three moon views, keyboard navigation, bookmarks, shared Acid Burn
  styling, black-hole renderer lifecycle, and no-WebGL fallback.
- JavaScript syntax and summary-population formatting tests.

Commands: `tests/yake-atlas-browser.py`, `tests/yake-ux-workflow.py`,
`tests/yake-card-interactions.py` (Python Playwright), and
`node tests/yake-summary-data.mjs`.

Expanded mode condenses the star summary on short screens. Close the overlay
before using underlying general map controls. Surface geometry is illustrative.
External fonts are blocked in the local harness; physical mobile devices and
Safari/Firefox have not been tested. Screenshots are ignored local review artifacts.
