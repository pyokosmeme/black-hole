# TODO — LATENT GLOSSES FORUM

## Vision

A dedicated public page where every latent gloss lives. Each transmission becomes a thread rooted on the article itself — the article is the first post, the replies are the glosses, nested underneath. One browsable, login-gated ATProto conversation space spanning the whole site.

Ambitious and useless, on purpose. A forum for a personal author site is commercially irrational. That's the point.

## What we already have (do not rebuild)

The infrastructure is ~85% live. "Latent glosses" is the site's existing ATProto comment system, already mounted on every transmission.

- **Auth** — full PKCE + DPoP OAuth flow via Cloudflare Worker. `_worker.js` exposes `/api/oauth/{login,callback,session,logout}` and `/api/bsky/{createRecord,deleteRecord}`. Sessions in KV namespace `SESSIONS` (30-day TTL), HttpOnly cookie. Client: `js/bsky-auth.js` (`login`, `getSession`, `logout`).
- **Data layer** — `js/bsky-comment.js`. Custom record types in the `agency.lastnpcalex.*` namespace: `comment`, `like`, `hide`, `sentiment`, `transmission` (synthetic subject). Reads via Constellation backlinks (`constellation.microcosm.blue`) + PDS record fetches. Writes are DPoP-signed through the worker.
- **Widget** — `js/transmission-comments.js` exports `mount(container, {slug, authorDid})`. Already does threaded replies, likes, admin hide/unhide, owner delete, sort (recent / top / oldest), 500-char limit, optimistic post. Empty state: "no signal received yet."
- **Subject anchoring** — synthetic URI `at://<authorDid>/agency.lastnpcalex.transmission/<slug>`. No actual record published; the URI is the anchor Constellation indexes. `authorDid` = `did:plc:ccxl3ictrlvtrrgh5swvvg47` (`COMMENTS_AUTHOR_DID` in `js/acidburn-author.js`).
- **Section namespacing** — `getCommentsSlug(slug)` in `acidburn-author.js` prefixes per section (bare for `author/`, `<section>--<slug>` for `ams/`, `maps/`, etc.). Each section's posts get distinct threads already.
- **Page shell + nav** — Archetype-A HTML shell (copy `futures.html`). `pagelayout.json` + `nav-menu.js` for the nav entry. Per-section `config.json` pattern. Build scripts `scripts/gen-post-stubs.py` + `scripts/gen-feed.py` (both with hardcoded section lists — a new section needs both lists updated).

## Scope

**MVP**
- New top-level page at `/forum` (6th nav entry: HOME / A MOTE IN SHADOW / SPECULATIVE FUTURES / SURFACES / MAPS / FORUM).
- Index view: list of all transmissions that have glosses, with reply count + last-activity timestamp. Sort by recent activity.
- Thread view: `#thread/<section>--<slug>` deep-link. Article rendered as the thread root (reuse `loadPost()` rendering), `transmission-comments.js` mounted underneath.
- Login bar in forum header (reuse `bsky-auth.js`). Read-public, write-gated — same as the existing per-post widget. No login to read; login to post.

**Stretch**
- Sort by most glosses / oldest.
- Filter by section (transmissions / futures / ams / maps) and by tag.
- Denormalized thread-summary cache (KV) to avoid N+1 reads on the index.
- Members-only threads (gate reads on specific threads).
- Cross-link from each transmission's footer to its forum thread (`view this in the forum →`).

## Open decisions

- **Index strategy.** Enumerate every known transmission slug (from each section's `posts.md`) and batch-query Constellation for backlink counts — simple, fresh, but N+1 read cost on every index load. vs. Maintain a denormalized index in KV updated on each comment write — fast reads, eventual consistency, write-path complexity. Default: start with enumerate, move to cache only if index load is slow.
- **Article-as-root presentation.** Today comments mount *below* the article body. The forum view composes them into a thread layout (article = root node, replies nested). Decide: render the full article markdown as the root, or a title + excerpt + "read full" link? Default: full article as root — that's what makes it a forum, not a comment page.
- **Categorization.** By section (transmissions / futures / ams / maps) is free. By tag requires threading tags through. Default: section filter only for MVP.
- **OAuth scope.** Current scope is `atproto transition:generic`. Confirm this covers forum posting (it covers the existing comment writes, so likely yes — but verify before assuming).

## Phased steps

1. **Scaffold** — copy `futures.html` to `forum.html`, set `PAGE_CONFIG` (new section or reuse `author/` content). Add `FORUM` entry to `pagelayout.json`. Get a blank page live in nav.
2. **Index query** — enumerate slugs from all sections' `posts.md`, batch-query Constellation for backlink counts per synthetic URI. Render as a list of thread cards.
3. **Thread view** — `#thread/<slug>` route. Render article as root (reuse `loadPost()`), mount `transmission-comments.js` below. Verify reply nesting looks like a forum thread, not a comment footer.
4. **Login bar** — forum header with `bsky-auth.js` session state. Sign-in to post; read without.
5. **Sort + filter** — recent / top / oldest dropdown; section filter.
6. **Preview + push** — surface live URL for author review. Push to `master` on approval.

## Risks

- **Constellation uptime/limits** — the index path depends on a third-party backlink service. If it's down or rate-limits, the forum goes blank. Cache the last good result.
- **N+1 read cost** — a forum listing many threads amplifies the per-record PDS fetch pattern. The cache (stretch scope) is not really stretch if the index gets big.
- **Moderation across a cross-post view** — `hide`/`delete` today is per-post in the widget. A forum view surfaces all threads at once; the admin UX needs to scale to that.
- **OAuth scope adequacy** — verify `atproto transition:generic` covers forum posting before assuming the write path just works.
- **Stale slugs** — transmissions removed from `posts.md` still have glosses on the network. Decide: hide from index, or show as "archived thread."

## Non-goals

- Replacing the per-post latent-glosses widget. The forum is an *additional* view; the widget stays where it is.
- A separate auth system. Reuse `bsky-auth.js` + the existing worker.
- A new backend. Everything runs through the existing Cloudflare Worker + ATProto.
