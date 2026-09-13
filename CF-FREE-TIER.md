# Cloudflare free-tier operation budget

Public transmission lists, `llms.txt`, and label queries now read stored public
indexes. They perform **zero KV list calls**, including on cold edge caches.
Admin inspection still scans canonical records on demand. Each admin edit also
advances at most one index page. These manual operations add to the background
budget below; it is not an account-wide rate limiter.

## Background budget

One cron runs every ten minutes, advancing one 50-key page of one of five public
indexes. Larger collections continue on later runs without increasing calls per
day. Only complete rebuilds replace the serving index. Unchanged complete indexes
are not rewritten. Partial builds expire after a day without progress.

| Operation | Scheduled upper bound per day | Free allowance per day |
| --- | ---: | ---: |
| KV lists | 144 | 1,000 |
| KV reads | 10,272 | 100,000 |
| KV writes | 384 | 1,000 |
| KV deletes | 144 | 1,000 |
| Worker cron invocations | 144 | — |

Conservative bounds assume every index page contains 50 records and every
half-hour liker pass needs 50 marker reads. Index maintenance uses at most 52
reads and one write per run; a liker pass uses at most 58 reads and five writes
(the five-write estimate includes mutually exclusive checkpoint/addition work).
This excludes public/authenticated requests, admin edits, deployment migration,
Cloudflare dashboard operations, other Workers, and duplicate cron delivery.

An idle day with empty collections uses 144 lists, 336 reads, five initial
writes, and no deletes. Subsequent unchanged days need no index writes. The test
suite also simulates 500 managed posts and 48 new likers over a day.

The liker reconciler examines one AppView page every 30 minutes, creates at most
one label, and resumes the same page until its likers have markers. This permits
48 new opt-ins per day; a backlog takes longer. Pages eventually cycle back to
the beginning so older likes are not permanently skipped.

[Cloudflare KV pricing and allowances](https://developers.cloudflare.com/kv/platform/pricing/)
also specifies 1 GB total KV storage and midnight UTC quota resets. Deployment
does not restore an already exhausted quota.

## Public reads, freshness, and other limits

- Each public index has a five-minute edge cache. A cache miss reads one KV key,
  never a key listing or all individual records. Draft text, subscriber details,
  private label comments, and OAuth secrets are excluded. Indexes are capped at
  2 MB each; partition them before exceeding that size.
- Admin edits refresh the affected index and overlay the edited record to
  tolerate KV propagation lag. If a refresh fails, the canonical edit remains
  saved and cron repairs the view. A one-page index is revisited every 50 minutes;
  multi-page rebuilds take correspondingly longer. Other edge locations can
  additionally retain their cached copy for five minutes. KV remains eventually
  consistent: overlapping edits/rebuilds can briefly show an older view.
- Label queries return at most ten labels and a continuation cursor, limiting
  cold signing work. Signing keys stay in isolate memory for five minutes;
  up to 512 signatures are memoized per cached key. They are never placed in a
  public cache with private keys.
- Label streams retain the ten-minute poll interval and one-hour connection
  lifetime. Each poll replays at most 100 sequence positions. Large histories
  therefore catch up gradually instead of reading thousands of keys in one
  invocation. Idle connections still cost approximately 144 head reads/day each,
  plus connection setup; many independent consumers can exhaust read quotas.
- Identical subscription submissions do not rewrite preferences. Authentication
  remains uncached so revocation semantics are preserved.
- The homepage now takes the static asset path directly. The previous `/`
  `run_worker_first` entry invoked a Worker solely to return the static page.
  [Static asset requests are free and unlimited](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/).

The Workers Free plan still imposes 100,000 requests/day, 10 ms CPU per invocation,
128 MB memory, 50 external subrequests and 1,000 internal subrequests per
invocation. These changes bound background I/O and reduce repeated signing;
they do **not** prove every cold cryptographic operation, large document render,
admin export, or large WebSocket replay fits 10 ms. Measure CPU and invocation
failures after rollout. Large admin collections still need pagination before
their existing full-list endpoints approach internal subrequest limits.
[Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/).

## First deployment and recovery

No new Cloudflare service, paid plan, or binding is required. Canonical keys are
preserved. The additional keys use `public-index:v1:` and
`public-index-build:v1:` prefixes.

After deploying this version, initialize all five indexes through the protected
maintenance endpoint below. Do this with the site's existing admin session,
after the KV allowance resets if necessary. Each request handles one page; a
`complete: false` response means repeat the same prefix. Space calls for the
same prefix by at least 60 seconds to allow KV propagation. A missing index
returns HTTP 503 with `Retry-After: 60`; public requests never trigger migration.
Cron can also complete initialization unattended, taking about 50 minutes for
all five one-page collections once the trigger is active.

```http
POST /api/admin/public-indexes
Content-Type: application/json
Cookie: session=<existing administrator session>

{"prefix":"transmission:author:"}
```

The allowed prefixes are `transmission:author:`, `transmission:ams:`,
`transmission:futures:`, `transmission:maps:`, and `label:`. Never seed empty arrays
as a shortcut when existing data has not been inspected. Refreshing this endpoint
also repairs an index after direct KV edits outside the application.

Verify all four `/api/transmissions?section=...` endpoints, `/llms.txt`, and
`/xrpc/com.atproto.label.queryLabels?uriPatterns=*` return their expected data.
Keep the ten-minute cron configured; removing it disables migration/repair and
like reconciliation. Then compare the next complete UTC day's KV totals and
Worker CPU errors. Production deployment and initialization were not performed
as part of the local code change.

## Local verification

All 59 tests pass with `node --test tests/*.test.mjs`, covering operation budgets, missing and partial
indexes, failed reads, KV propagation lag on edits, privacy filtering,
authentication, label pagination/signatures, bounded replay, and idempotent
subscription updates. `npx.cmd --no-install wrangler deploy --dry-run --outdir
.wrangler/public-index-check` also passed: 10,620 assets and a 190.39 KiB gzipped
Worker bundle. Local operation counts do not measure Cloudflare CPU.
