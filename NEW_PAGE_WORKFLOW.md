# Add a page using the real Acid Burn system

An agent workflow for lastnpcalex.agency. Applies to new pages, new tools/maps,
page redesigns, and questions about how to add a page. Read this entire document
before beginning. Follow applicable repository and environment instructions too.

**Outcome:** a page built from the site's existing components, with working
navigation, typography, backgrounds, and display modes from the first preview.
Content and novel interactions come afterward. Do not approximate the aesthetic.

## 1. Inspect and choose the page type

1. Read `AGENTS.md`, any instructions in the target directory, and `git status
   --short`. Preserve existing changes; do not use a reset/checkout to get a clean
   starting point.
2. Distinguish a transmission (Markdown content), a content hub, and a standalone
   application. Do not build a new HTML application when the existing content
   system already handles the request.
3. Read the relevant current sources below. Record which page supplies the shell
   and which existing classes will supply the new page's UI.

| Responsibility | Source to inspect and reuse |
| --- | --- |
| Fonts, tokens, panels, buttons, header, responsive width | `css/acidburn.css` |
| Standalone interactive page shell | `yake.html` |
| Content-hub markup and `PAGE_CONFIG` | `maps.html`, `index.html`, `js/acidburn-author.js` |
| Shared display modes and toggle | `js/acidburn-mode.js` |
| Real black-hole background and dependencies | `js/acidburn-blackhole.js`, `js/acidburn-galaxy.js`, `yake.html` |
| Dropdown navigation | `nav-menu.js`, `pagelayout.json` |
| Transmission workflow | `TRANSMISSIONS.md`, relevant section's config and Markdown index |
| Routing, assets, publication | `wrangler.json`, `_worker.js`, `.assetsignore` |

These are references, not permission to clone whole applications. In particular,
do not copy Ya Ke's world data, camera controls, or full-viewport layout into an
ordinary reading page. Legacy files and device-detection comments can be stale:
the current mode implementation uses `bh`, `dark`, and `light`, not the older
FULL/LITE/AUTO UI described in historical material.

Before implementation, briefly state: page type, reused shell/components, and
what requires new page-specific CSS. Ask only about choices that materially affect
the result; do not make the user reconfirm that they want the real shared theme.

## 2. Build the shared shell first

- Load `css/acidburn.css` before the page-specific sheet.
- Reuse the current Google Fonts declaration from the reference page. Body and
  ordinary controls inherit Share Tech Mono; shared heading classes use Orbitron.
  Special reading/code styles have their own shared assignments. Do not globally
  replace these with a vaguely similar monospace or sci-fi font.
- Include the accessible skip link and its target, `.static-bg`,
  `#blackhole-container`, `.header-bar`, `#nav-menu`, `.header-content-wrapper`,
  `.header-brand`, and `main.main-content` with real page-specific metadata.
- Let `.main-content` own normal width, centering, and header clearance. Its
  current 900px maximum includes padding: do not invent a wider near-match.
- Use existing `.author-card`, `.section-header`, `.section-line`,
  `.author-info`, `.author-bio`, `.post-date`, `.link-card`, and `.acidburn-button`
  where appropriate. Preserve semantic HTML: real buttons for actions, links for
  navigation, meaningful headings and accessible names.
- Load `nav-menu.js` and the shared mode scripts, rather than drawing replacement
  menu or theme controls. Do not hard-code a permanent `bh-mode`/`dark-mode` body.
- For a content hub, keep `PAGE_CONFIG` before the content engine and preserve
  the engine's required element IDs. For transmissions, use the existing Markdown
  workflow rather than manually recreating cards or post HTML.

**Gate:** render the shell with a small amount of real content before adding
complex interactions. Check it next to an existing page. The shared fonts, header,
panel framing, mode toggle, and content edges must already match.

## 3. Wire the real background, not a substitute

The black hole is a renderer, not a CSS gradient or an empty container. Follow the
current dependency ordering in `yake.html`: bundled Three.js and its supporting
libraries, `three-js-monkey-patch.js`, galaxy script, shared mode script, then
black-hole script. Keep the `vertex-shader` block and the `data-name="raytracer"`
fragment-shader declaration referencing `raytracer.glsl`. Inspect the source when
choosing dependencies; do not upgrade or duplicate Three.js incidentally.

- The renderer must be able to initialize when the page first opens in BH mode
  **and** when the user switches from Dark/Light to BH later.
- Do not copy an old conditional loader that permanently skips dependencies on
  mobile or static-mode startup and leaves the BH toggle nonfunctional.
- Keep the static fallback and useful content when WebGL is unavailable.
- If the page has its own 3D scene, keep its renderer separate from the background
  renderer. Each should have exactly one canvas; disabling the background must
  not disable the page's actual functionality.
- Use shared mode behavior and respect reduced-motion needs in new animations.
  Do not add moving dots, decorative particles, or other unsolicited effects.
- For nested URLs, inspect all relative paths, including shader/texture requests
  and the mode-icon paths. `nav-menu.js` supports `window.NAV_CONFIG_PATH`; set an
  appropriate path before loading it. Changing HTML stylesheet paths alone is
  not sufficient. Test both direct loading and refresh at the actual route.

## 4. Add only the unique page behavior

Page CSS may arrange grids, spacing, responsive controls, canvas labels, and
genuinely custom visualization elements. Use the existing `--space-*`, `--text-*`,
and color/effect variables. Scope new selectors to the page or its components.

Do not copy the shared gradient borders, striped pseudo-elements, heading fonts,
mode colors, button states, or header styling into a second implementation. Avoid
global `body`, `h1`, `button`, `:root`, or `.author-card` overrides in a feature
sheet. Loading Acid Burn and then overriding all of it is still a fake integration.

A small, justified local adjustment (e.g. a translucent map card) is acceptable;
keep the shared component class and test Dark, Light, and BH. A truly missing
reusable component may be added to the shared system when the task warrants it,
but that is a shared change and requires checks on existing consumers. Do not
change site-wide styling just to make one page look right.

Do not invent or rewrite worldbuilding to fill a layout. Preserve supplied content
and label genuine estimates. Reference images guide the design; they do not
automatically belong in the page's information cards.

## 5. Verify actual inheritance and interaction

Source inspection and `node --check` alone are not visual verification.

- Verify the shared stylesheet loaded successfully, the intended DOM classes are
  present, and actual webfonts loaded. Inspect computed styles to identify their
  source; screenshots with fallback fonts do not prove typography matches.
- Perform a shared-style inheritance probe in a local browser fixture. Temporarily
  append a distinctive rule to the **shared stylesheet**, e.g.
  `.section-header h2 { color: rgb(12, 34, 56); }`, and assert it changes the new
  page's heading. Remove the test rule afterward. If page CSS masks it, inspect
  the override instead of weakening the test. Test other reused components where
  useful. This probe must not modify or deploy the real shared stylesheet.
- Check at least 320×568, 390×844, 568×320, 768×1024, and 1366×768; include a wider
  desktop when relevant. Inspect representative screenshots, not only dimensions.
- Check no unintended document overflow, consistent header/content edges, readable
  text, visible close/actions, no collisions, and usable touch targets. Long copy
  and the longest button labels must be exercised, not just the easiest card.
- Check keyboard access, visible focus, menu navigation, direct links, refresh,
  reduced motion, and any focus/zoom/close/return flows the page implements.
- Check first-load BH, first-load Dark/Light followed by BH, mode persistence,
  WebGL failure, no duplicate background canvas, and no console errors or missing
  fonts/shaders/textures. Never claim BH works merely because the toggle exists.

Existing Playwright examples: `tests/yake-atlas-browser.py` (shared-style probe,
local asset routing, mode and fallback checks), `tests/yake-floating-window.py`
(`--webfonts`, responsive bounds), and `tests/yake-ux-workflow.py` (interaction
flow). Adapt tests to the new page; passing Ya Ke's tests does not test a new page.
Use available test tooling; do not install dependencies without appropriate
permission. If a browser check is blocked, report that limitation explicitly.

## 6. Integrate and hand off

- Add a menu entry to `pagelayout.json` and a relevant hub link (e.g.
  `maps/config.json`) when that integration is part of the requested page. Preserve
  unrelated entries; verify links and user-facing labels in the browser.
- Follow `TRANSMISSIONS.md` for post indexes, share stubs, and feeds when adding
  actual transmissions. Do not regenerate unrelated feeds for an app-only change.
- Review the live diff, stage only this task's files/hunks, inspect the staged
  diff, and create a focused local commit. Never absorb unrelated workspace edits.
- Deploy only with the appropriate user authorization. The current site is the
  Cloudflare Worker in `wrangler.json`; a Git push is not its deployment step.
  Recheck current config rather than trusting this document indefinitely.
- Before deploying root-directory assets, inspect `.assetsignore` and the actual
  candidate files. A dirty root may contain credentials, scratch, or unrelated
  deployable work. Do not publish those accidentally or assume an incremental
  upload automatically limits publication to your feature.
- Keep secrets out of output and public assets. Root Markdown instruction files
  are currently excluded by `/*.md`; recheck this if moving docs or changing
  deployment layout. No deployment is needed for this workflow's documentation.
- If deployed, verify the live assets and URL. Otherwise explicitly say local-only.

Final handoff: summarize the page, shared components reused, scoped exceptions,
browser sizes/modes checked, any limitation, commit, and deployment status. Never
substitute “looks Acid Burn” for evidence that it uses the actual system.
