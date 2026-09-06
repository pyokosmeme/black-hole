# Ya Ke atlas UX audit — 2026-09-06

## Scope and method

Local Chromium/Playwright rendering of the real HTML, CSS, data and renderer;
SwiftShader WebGL, external network requests blocked. These are viewport tests,
not physical-device or Safari/Firefox certification. External web fonts were not
loaded, so font-specific wrapping remains a limitation.

Repeatable workflow: `C:\Python314\python.exe tests/yake-ux-workflow.py`.
Regression suite: `C:\Python314\python.exe tests/yake-atlas-browser.py`.
Inventory exporter: `node scripts/yake-info-export.mjs`.
Screenshots: `attached_files/yake-ux-*.png` (not deployed).

## Resolution results

| Viewport | Initial scene fits vertically | Selected Jin card fits without scrolling | Intro shown | Expanded scene fits |
|---|---|---|---|---|
| 320 × 568 | No | No | No | Yes |
| 390 × 844 | Yes | Yes | No | Yes |
| 430 × 932 | Yes | Yes | No | Yes |
| 844 × 390 | No | No | Yes | No |
| 768 × 1024 | Yes | Yes | Yes | Yes |
| 1024 × 768 | No (5px overflow) | Yes | Yes | Yes |
| 1366 × 768 | No (5px overflow) | Yes | Yes | Yes |
| 1920 × 1080 | Yes | Yes | Yes | Yes |
| 2560 × 1440 | Yes | Yes | Yes | Yes |

All nine: no document horizontal overflow or JavaScript errors. Moon-view entry,
return to system, keyboard selection, label toggling, Escape-to-close and
Escape-to-collapse succeed. These functional passes do not mean every control
is conveniently visible: Playwright scrolls targets into view when necessary.

## Findings, in priority order

1. **Short-screen layout and expanded landscape clipping.** A fixed 640px phone
   scene or 600px desktop scene can push selected cards below the viewport.
   At 844 × 390, a long card is taller than the viewport. In expanded landscape,
   the scene's 300px minimum height exceeds its available flex space; the lower
   controls are clipped by the scrolling field/caption. A screenshot confirms
   clipping even though the controls' bounding boxes lie inside the viewport.
   Recommendation: viewport-aware scene/card sizing and an unclipped control row.
2. **Close action disappears while reading.** Scrolling Horizon's Edge details
   to the end scrolls the close button out of the card at all nine sizes.
   Escape works, but touch users must scroll back. Recommendation: keep close
   outside the scrolling content or in a sticky card header.
3. **Phone-only information omission.** At widths <=600px, `.card-intro` is
   `display:none` and not repeated in World Details. This is not equivalent
   content between phone and desktop. Recommendation: retain it in the expanded
   details if a compact collapsed card is desired.
4. **Small controls and nested scrolling.** Zoom/home controls can be only 28px
   wide; nameplates use a 30px minimum height. The map captures touch gestures,
   while cards scroll separately. Recommendation: larger touch targets and a
   clear way to scroll the page without manipulating the map.
5. **Information hierarchy.** Dense records such as Skarda mix physical stats,
   settlement lists and author-facing uncertainty/source notes in one long panel.
   Some concise facts are below World Details simply because they are after the
   first four rows. Recommendation: do the user's planned editorial pruning as
   a separate pass, with deliberate overview/physical/settlement groupings.

No general layout redesign or information pruning was performed in this audit.

## Placement correction and regression checks

Horizon's Edge is positioned just outside Jin's 1,171,000 km EZ using the same
compressed radial conversion as the moons and EZ ring. Clearance includes the
whole illustrative station model; it does not claim a new physical orbital
radius. The former Skarda–Jin L5 annotation and offset-uncertainty loop were
removed. The exact orbital radius and angular phase remain unspecified.

The full regression suite passes at 1100px, 390px and 320px widths, including
coaxial toruses/bearings, station/EZ geometry, system and three moon views,
reference-image-free cards, bookmarks, return/reset, shared CSS, black-hole
initial/delayed startup and pause/resume, and WebGL-unavailable fallback.

## Inventory

`yake-info-inventory.md` contains all 27 reachable cards, including introductions,
main stats, expanded stats, narrative paragraphs, places and notes. Reference
images and non-rendered source-only records are excluded. No lore reconciliation
or content pruning was applied beyond the requested Horizon's Edge correction.
