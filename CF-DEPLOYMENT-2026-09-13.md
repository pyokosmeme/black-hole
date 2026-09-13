# Deployment and live Cloudflare audit

Deployed commit `8782f2d` at **2026-09-13 04:33:40 UTC** (September 12,
9:33 PM Pacific). Cloudflare version `cf4bacc0-639c-4234-981f-730321f0ebd6`
receives 100% of traffic. Deployment ID:
`029f2215-695c-4383-8993-a52296a7084b`.

The deployment used a Git archive of that commit, preserving unrelated local
package/feed edits and excluding scratch files. All 59 tests passed in that
isolated directory. Wrangler reported no changed static assets to upload and a
190.47 KiB gzipped Worker bundle.

## Verified live inventory

- One Worker: `black-hole`.
- One KV namespace: `SESSIONS`, binding ID `149e36b52d1c43518ce7f2d91c22528c`.
- One zone route: `lastnpcalex.agency/*` points to `black-hole`.
- No additional Worker custom domains or Pages projects returned by the account APIs.
- Live cron changed from `*/5 * * * *` to `*/10 * * * *`.

This inventory covers the Cloudflare account used by this project. Metrics below
are account-wide, not filtered to a single namespace or Worker. Worker request
totals can include the workers.dev endpoint as well as the custom domain.

## Index initialization and route checks

Before deployment, the authenticated KV REST API enumerated only the five
public-data prefixes. It read four managed transmission records and 25 labels,
projected only public fields, and wrote five complete indexes. It did not inspect
session/subscriber values or change canonical records. Cost: **5 lists, 29 reads,
5 writes**. The other three transmission sections had no managed KV records;
their repository content remains available.

Production checks confirmed:

- Homepage: HTTP 200, static asset cache hit.
- All four transmission indexes: HTTP 200; author has three published posts and
  one archived slug, the remaining managed indexes are empty.
- `llms.txt`: HTTP 200.
- Anonymous admin session request: HTTP 401.
- Label queries: HTTP 200, pages of 10 / 10 / 5 labels with working cursors.
- Label WebSocket: successful upgrade and binary replay; verification consumers
  were closed afterward.
- Worker source is excluded from assets; `/public-index.js` returns the site's
  HTML fallback, not JavaScript source. Scratch deployment paths return 404.

## Observed account usage

Cloudflare GraphQL snapshot at **2026-09-13 04:39:46 UTC**, covering September 13
UTC so far. Analytics are sampled/aggregated and can lag ingestion; absence of a
delete row is reported as zero. These are observed totals, not a full-day forecast.

| Resource | Used so far | Free daily allowance | Used |
| --- | ---: | ---: | ---: |
| KV reads | 1,961 | 100,000 | 1.96% |
| KV lists | 24 | 1,000 | 2.4% |
| KV writes | 8 | 1,000 | 0.8% |
| KV deletes | 0 | 1,000 | 0% |
| Worker requests | 443 | 100,000 | 0.44% |

Latest available storage sample (September 12): 177,343 bytes and 96 keys, well
below 1 GB. This predates the five small indexes. Highest reported memory P99
across today's status groups was about 9.6 MB, below the 128 MB Worker limit.

Yesterday's totals were 101,770 reads, 1,194 lists, 283 writes, and 3 deletes.
Both read and list limits were exceeded before these changes. Current usage is
low, but the next complete UTC day is needed to measure a full day of the new
code. Visitor volume, admin activity, other API clients, and stream consumers
remain variable. The scheduled budget stays at 144 lists/day under normal cron
delivery, plus manual index rebuilds and authenticated admin scans.

## CPU and errors: not an unconditional all-clear

The first post-deployment GraphQL sample included successful-request CPU P99 of
59.63 ms, above the nominal 10 ms free-tier CPU allowance. The API schema confirms
its CPU quantiles are in microseconds. The cause of that initial spike was not
isolated; it must not be described as a proven cold-start issue or ignored.

A subsequent targeted trace showed warmed transmission queries at 1 ms,
`llms.txt` at 3 ms, and label pages at 0–1 ms. WebSocket replay succeeded, but the
test connection produced a `Network connection lost.` exception when it closed
(6 ms CPU). That is a connection error, not evidence of KV quota exhaustion.

The September 13 aggregate at the snapshot includes 10 script exceptions and
19 load-shedding outcomes, mostly from before deployment, plus 287 client
disconnects. A sample from 04:36:30 onward had five successful requests with
CPU P99 3.667 ms, two client disconnects, and the one traced connection exception.
This small sample is not proof that every request stays below CPU limits.

The new ten-minute cron was observed executing at approximately 04:40 UTC:
outcome `ok`, **4 ms CPU**, 443 ms wall time, no exceptions, and no scheduled
error logs. This confirms the actual deployed maintenance path ran successfully.

Temporary Cloudflare diagnostic tails were removed after observation. No plan
upgrade, new service/binding, or unrelated deployment was performed.

## Evidence and follow-up

Local diagnostic artifacts (ignored by Git and excluded from deployment):
`.wrangler/cf-audit-before.json`, `.wrangler/cf-audit-after.json`,
`.wrangler/cf-audit-final.json`, `.wrangler/cf-index-initialization.json`,
`.wrangler/cf-smoke.json`, `.wrangler/cf-tail-check.json`, and
`.wrangler/cf-tail-cron.json`.

Compare the next complete UTC day's account-wide KV totals and Worker outcomes.
Pay particular attention to CPU spikes, `loadShed`/resource-limit outcomes, and
whether connection exceptions occur without deliberate verification disconnects.
No ongoing monitor or scheduled reporting job was installed.

Sources: [KV analytics](https://developers.cloudflare.com/kv/observability/metrics-analytics/),
[KV free allowances](https://developers.cloudflare.com/kv/platform/pricing/),
[Worker metrics](https://developers.cloudflare.com/analytics/graphql-api/tutorials/querying-workers-metrics/),
[Worker limits](https://developers.cloudflare.com/workers/platform/limits/).
