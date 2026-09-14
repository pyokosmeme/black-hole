# Repository instructions

## New pages and Acid Burn UI

When asked how to add a page, to build a new page, or to restyle a page on
lastnpcalex.agency, **read [NEW_PAGE_WORKFLOW.md](NEW_PAGE_WORKFLOW.md) completely
before planning or editing**. Follow its shared-component and browser-verification
gates. For an advice-only request, explain that workflow without changing files.

Acid Burn is an existing implementation, not a mood board. Reuse
`css/acidburn.css`, its actual component classes, shared mode/background scripts,
and `nav-menu.js`. Merely linking the stylesheet while replacing its components
with custom neon CSS does not satisfy the requirement. Page-specific CSS is for
layout and genuinely unique content, not a parallel theme.

The files on disk are authoritative. Read current source and scoped instructions;
do not reconstruct pages from old conversation history or assume every legacy
page is a good template. Preserve unrelated changes and user-authored content.

## Publishing and scope

The current deployment is the Cloudflare Worker configured in `wrangler.json`,
with static assets from the repository. GitHub is source hosting, not the site
deployment step. Verify the live configuration before publishing. A request for
documentation or advice does not authorize deployment, Git push, or a site rewrite.

Keep credentials, local scratch, and agent documentation out of public assets.
Inspect `.assetsignore` and deployment scope; never expose credential contents.
Checkpoint completed implementation in a focused local commit, preserving unrelated
staged/unstaged work. Report what was tested and whether anything was deployed.
