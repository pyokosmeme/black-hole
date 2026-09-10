# agency.lastnpcalex.* — site lexicons

Custom ATProto lexicon namespace for lastnpcalex.agency. All records live in
each user's own repo (PDS); the site only proxies DPoP-signed writes and reads
via Constellation / the public appview.

| nsid | rkey | purpose |
|------|------|---------|
| `agency.lastnpcalex.transmission` | `<slug>` | synthetic subject URI (never published) anchoring comment threads |
| `agency.lastnpcalex.comment` | tid | latent gloss on a transmission (subject = transmission URI, optional replyTo) |
| `agency.lastnpcalex.like` | target-derived | like on a comment |
| `agency.lastnpcalex.hide` | tid | admin hides a comment |
| `agency.lastnpcalex.sentiment` | `up/down`-derived | ±1 alignment vote on a comment |
| `agency.lastnpcalex.player` | `self` (literal) | game opt-in — see below |

## agency.lastnpcalex.player (new)

Schema: [`agency.lastnpcalex.player.json`](./agency.lastnpcalex.player.json)

One record per account, always at rkey `self`:

```json
{
  "$type": "agency.lastnpcalex.player",
  "playerCharacter": 1,
  "createdAt": "2026-09-09T22:00:00.000Z"
}
```

- `playerCharacter: 1` — opted in, account is a player character in the game
- `playerCharacter: 0` — explicitly opted out
- no record — never asked

Upsert semantics: records are rewritten with
`com.atproto.repo.putRecord` via the Worker's `/api/bsky/putRecord`
(DPoP-signed, restricted server-side to this collection + rkey, and to
`playerCharacter` ∈ {0, 1}; the record body is built server-side). No delete
endpoint is exposed for it, so the choice can be flipped but never silently
erased.

Note: there is currently no public opt-in front end — the
`join.lastnpcalex.agency` page was removed. The endpoint and admin readout
remain but are dormant.
