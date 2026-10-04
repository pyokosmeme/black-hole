# Component sources

Read the current files; this index locates implementations, not frozen copies.
The complete page-building sequence remains in `NEW_PAGE_WORKFLOW.md` at the
repository root.

| Responsibility | Implementation to inspect |
| --- | --- |
| Palette, spacing, typography, modes, panels, buttons | `css/acidburn.css` |
| Ordinary site/content hub shell | `maps.html`, `index.html` |
| Interactive map shell | `yake.html`, the specific target visualizer HTML |
| Window geometry and panes | `css/map-window.css`, `js/map-window.js` |
| Scene labels and collision handling | `js/scene-label-layout.js` |
| Mode state and toggles | `js/acidburn-mode.js` |
| Shared BH background lifecycle | `js/acidburn-blackhole.js` |
| Shared navigation | `nav-menu.js`, `pagelayout.json` |
| Speculative map links | `maps/config.json` |

Body and controls inherit Share Tech Mono; shared headings use Orbitron. Reuse
the live font declaration and tokens such as `--cyan`, `--purple`, `--space-*`
and `--text-*`. Colors alone do not reproduce the theme. Preserve the shared
striped borders, heading treatment, mode colors, focus states, and panel framing
by using `.author-card`, `.section-header`, `.section-line`, `.acidburn-button`,
and `.acidburn-field` as appropriate. Page CSS handles scene layout and genuinely
unique content, not global replacements of these components.

The shared shell includes the skip link, `.static-bg`, `#blackhole-container`,
`.header-bar`, `#nav-menu`, `.header-content-wrapper`, `.header-brand`, and
`main.main-content`. Keep the current shared width/header clearance; do not
rebuild a visually similar header or mode switch. Resolve imports relative to
the actual page route, including nested shader, image, and navigation paths.

Map windows use `.author-card.map-window[data-map-window]`, a
`.section-header.window-toolbar`, `.window-actions`, `[data-window-expand]`,
and `.map-viewport`. HUD overlays use `.map-hud` and existing corner classes.
Panes use `.author-card.map-pane[data-map-pane]`, `[data-pane-toggle="pane-id"]`,
and `[data-pane-close]`. Reuse `js/map-window.js` for expansion, Escape, focus
return and pane fitting. Inspect its current data attributes before wiring a
new pane. Do not duplicate that behavior in a separate modal framework.

Shared-style proof: inject a distinctive rule into the shared stylesheet in a
browser routing fixture and assert the target component inherits it. Do not
leave the probe in the real CSS. Check actual loaded fonts and inspect phone
and desktop screenshots; matching class names alone do not prove inheritance.
