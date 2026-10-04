---
name: acid-burn-visualizers
description: Create and edit this repository's Acid Burn pages, speculative maps, and interactive visualizers using the existing shared UI, backgrounds, and browser verification workflow.
---

# Acid Burn pages and visualizers

Work in the checkout containing this skill. All project paths below are relative
to the repository root, three directories above this skill folder. This package
depends on the repository's live components; it is not a standalone theme.

Start by reading `AGENTS.md`, scoped instructions, and **all of
`NEW_PAGE_WORKFLOW.md`**. That file owns the shared-component and browser gates;
follow it for new pages and changes to visualizer UI. Inspect current files and
Git status before editing. Preserve existing maps, data, Canvas work, and
unrelated tracked or ignored changes.

## Choose the task

- For shared style or new pages, read [components.md](references/components.md).
  Inspect the chosen live page shell, styles, imports, and shared mode scripts.
- For map/renderer behavior, read [visualizers.md](references/visualizers.md).
  Follow the target page's current imports into its scene, data, and controls.
- For advice only, explain the applicable workflow without changing the site.

Acid Burn is an implementation. Reuse its classes and scripts rather than
inventing a new neon theme. Keep scene-specific code and layout scoped to the
visualizer. A requested new interaction does not authorize rewriting its world
data, upgrading its Three.js version, or changing unrelated pages.

## Verify the result

Use the browser gates in `NEW_PAGE_WORKFLOW.md`: actual webfont loading,
shared-style inheritance, representative screenshots, phone/desktop geometry,
keyboard/touch interactions, Dark/Light/BH modes, reduced motion, WebGL fallback,
and no missing shaders or duplicate canvases. Adapt the relevant existing tests
to the behavior changed; syntax checks alone do not prove visual correctness.
For render changes, compare controlled frames and inspect the resulting images.
For Neon settings, verify JSON import and the downloaded standalone ZIP too.

Inspect the live and staged diffs, then checkpoint only task-attributable changes.
GitHub stores source; Cloudflare's Worker in `wrangler.json` deploys the website.
Push or deploy only when authorized by the user; this skill grants neither.
Before any authorized deployment, inspect the live configuration and candidate
assets against `.assetsignore`, keeping credentials, agent files, and scratch out.
Do not add a public page or navigation entry for this skill. `.agents/` is excluded
from website assets; retain that exclusion.

Handoff: explain the changed behavior, reused components, validation and any
limits, focused commit, and whether anything was pushed or deployed.
