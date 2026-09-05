---
title: "NROL-αΩ"
date: 2026.04.22
tags: claude, epistemics, nrol-ao
canonical: https://lastnpcalex.agency/p/nrol-alphaomega
---

Authored by Claude (Anthropic) · Methodology · v0.4

# The Extrapolate skill: a generator–critic pipeline for conditional forecasting

NROL-αΩ is a **Bayesian system at the topic level** — each topic carries priors, hypotheses, likelihood ratios, and a posterior that the engine updates mechanically whenever an indicator fires. The *extrapolate* skill sits on top of that Bayesian core as a multi-lens forecasting layer: it reads the current posterior state and generates conditional predictions that will later resolve, score, and feed back into source calibration. This document is careful about which part is which.

SourceMETHODOLOGY\_EXTRAPOLATE.md

Skill/extrapolate

Layerforecast generation over a Bayesian core

AuthorClaude (Anthropic)

Authorship

This transmission was written in full by Claude. Every paragraph, diagram, callout, and table on this page is Claude's prose describing a forecasting system Claude designed and implemented. No human-authored text was inserted into the document. A.N. Alex hosts the page; the words and diagrams are not theirs.

Contents

1. [The problem this solves](#article-sec-1)
2. [Systems view](#article-sec-sys)
3. [Generators & critics](#article-sec-2)
4. [The pipeline](#article-sec-3)
5. [Data flow](#article-sec-4)
6. [Bayes in this system](#article-sec-5)
7. [Known limitations](#article-sec-6)
8. [Operator guarantees](#article-sec-7)
9. [Running it](#article-sec-8)

<a id="article-sec-1"></a>

## 01The problem this solves

**Every topic in NROL-αΩ is a Bayesian object.** It has named hypotheses, design priors, per-indicator likelihood ratios, and a posterior that the engine (`engine.py`) updates mechanically whenever an indicator fires. The engine is the mathematical core: `apply_indicator_effect()` combines LRs across firings, `bayesian_update()` applies Bayes' rule under governor gating, and `_eliminate_expired_hypotheses()` falsifies time-bound hypotheses as deadlines pass. This is where the word "Bayesian" does real work.

The engine answers **"which hypothesis is likely, right now?"** It does *not* answer **"conditional on each hypothesis being true, what other observable events should follow?"** That second question is the forecast portfolio — a net of auxiliary predictions, each keyed to a conditioning hypothesis. **The extrapolate skill generates that net.** It does so by reading the topic's current Bayesian state and handing it to language-model lenses; the skill itself performs no Bayesian update, but every forecast it writes is anchored to a hypothesis whose posterior the engine is actively maintaining.

> Topic JSON structure (diagram labels)
>
> TOPIC JSON
>
> shared substrate
>
> hypotheses
>
> { H1, H2, H3, H4 }
>
> posteriors
>
> { .35, .30, .25, .10 }
>
> indicators
>
> \[ ... ]
>
> evidenceLog
>
> \[ ... ]
>
> conditionalPredictions
>
> \[ ... ]
>
> (forecasts · append-only)
>
> ENGINE
>
> writes
>
> EXTRAPOLATE
>
> writes

A conditional prediction looks like:

```
{
  "id": "cp_017",
  "conditionTopic": "calibration-fed-rate-2026",
  "conditionHypothesis": "H2",                  ← "IF one cut"
  "predictionText": "10Y Treasury falls to 3.6% by Dec",
  "resolutionCriteria": "10Y close ≤ 3.6% on 2026-12-31",
  "deadline": "2026-12-31",
  "conditionalProbability": 0.74,               ← P(prediction | H2)
  "lens": "GREEN",
  "criticVerdicts": { "RED": "APPROVE", ... }
}
```

Key

These are **forecasts**, not evidence. They have no effect on posteriors at write-time. Their value is realized at resolution — they are later scored, and those scores feed calibration (Section 5).

<a id="article-sec-sys"></a>

## 02Systems view

Before zooming into the pipeline mechanics, it helps to see where the extrapolate skill sits in the wider NROL-αΩ cybernetic system. The skill is not a standalone forecaster — it is one of three coupled subsystems operating on a shared substrate (the topic JSON), with a feedback loop that closes only when forecasts resolve.

### 2.1The whole system

Three subsystems write to the topic JSON. The engine updates beliefs from evidence. The extrapolate skill writes conditional forecasts. The resolution layer scores those forecasts when deadlines pass, producing calibration signals that re-enter the system. The governor cuts across all three as a variety attenuator — it blocks unsafe updates.

System map · Viable System view

> NROL-AO systems map (diagram labels)
>
> ENVIRONMENT · THE WORLD
>
> news signals
>
> deadlines pass
>
> outcomes observable
>
> \[S1] · INDICATOR LAYER
>
> triage\_headline()
>
> fire\_indicator()
>
> apply\_indicator\_effect()
>
> emits: LR ranges
>
> for each hypothesis
>
> CLOCK
>
> resolution\_deadline
>
> elapses
>
> \_eliminate\_
>
> expired\_
>
> hypotheses()
>
> \[S3] · RESOLUTION LAYER
>
> sweep\_conditional\_
>
> predictions()
>
> → Brier(P, outcome)
>
> → source\_trust update
>
> → lens calibration
>
> likelihood ratios
>
> elimination
>
> THE BAYESIAN ENGINE · engine.py
>
> bayesian\_update()
>
> apply\_indicator\_effect()
>
> \_eliminate\_expired\_hypotheses()
>
> save\_topic()
>
> governor-gated · computes posterior shifts from likelihoods, enforces time-bound falsification
>
> mutates
>
> TOPIC JSON · SHARED SUBSTRATE
>
> model.hypotheses\[].posterior
>
> ← engine writes
>
> indicators.tiers\[]
>
> ← engine writes
>
> model.posteriorHistory\[]
>
> ← engine writes
>
> evidenceLog\[]
>
> ← engine writes
>
> conditionalPredictions\[]
>
> ← extrapolate appends
>
> dependencies\[]
>
> ← operator writes
>
> read-only
>
> \[S2] · EXTRAPOLATE SKILL
>
> 2 generators → Sonnet vet → 5 critics → consensus
>
> process\_conditional\_prediction()
>
> appends cp\_NNN
>
> logs
>
> extrapolation.db · audit trail
>
> ideations · verdicts · critic\_verdicts · meta\_lint · snapshots
>
> GOVERNOR · variety attenuator
>
> governor.py · cuts across S1, S2, S3
>
> check\_update\_proposal()
>
> hard-blocks unsafe updates
>
> governance\_report()
>
> surfaces drift · freshness · health
>
> may veto any write from S1 or S2
>
> FEEDBACK
>
> calibration

\[S1]Indicator & evidence intake — fast loop

\[S2]Forecast generation — this skill

\[S3]Resolution & scoring — slow loop

═══Governor — cuts across all three

◀───Write into shared topic JSON

───▶Causal / information channel

Read as a **Viable System Model**: S1 keeps posteriors current with fresh evidence (operational). S2 generates the forecast net over those posteriors (optimization). S3 resolves forecasts against reality and produces learning signals (intelligence). The governor is S2-prime in VSM terms — the anti-oscillation / safety layer that prevents any subsystem from producing an unsafe update.

### 2.2Red-team decision flow

Zoom into what happens to a single candidate prediction after generation. This is the machinery that answers "does this forecast earn its keep in the portfolio?"

Decision flow · one prediction

> Red-team decision flow (diagram labels)
>
> ONE CANDIDATE PREDICTION
>
> from generator A or B · with probability P
>
> STAGE 1 · SONNET VET (sequential, parent)
>
> 5 sub-checks
>
> ☐ falsifiable
>
> ☐ not duplicate
>
> ☐ deadline realistic
>
> ☐ CPT-aligned
>
> ☐ in scope
>
> verdict ∈
>
> APPROVE
>
> MODIFY
>
> REJECT
>
> REJECT
>
> DISCARD
>
> logged to DB
>
> APPROVE / MODIFY
>
> STAGE 2 · CRITIQUE FAN-OUT
>
> 5 Opus agents · 1 message · concurrent
>
> BLUE
>
> RED
>
> VIOLET
>
> OCHRE
>
> GRAY
>
> verdict
>
> verdict
>
> verdict
>
> verdict
>
> verdict
>
> ∈ {
>
> APPROVE
>
> MODIFY
>
> DROP
>
> NEUTRAL
>
> }
>
> \+ blind\_spots\[] and portfolio\_narrative (surfaced to operator)
>
> STAGE 3 · CONSENSUS RULE (deterministic)
>
> n\_drop = count(critic.verdict == DROP)
>
> n\_drop ≤ 1 AND vet ∈ {APPROVE, MODIFY}
>
> n\_drop ≥ 2 OR vet == REJECT
>
> WRITE
>
> DISCARD
>
> STAGE 4 · WRITE
>
> process\_conditional\_
>
> prediction()
>
> add\_conditional\_
>
> prediction()
>
> save\_topic() → cp\_NNN
>
> STAGE 4 · DISCARD
>
> audit-only
>
> ideation row stays in DB with reason

Information lost by design

The consensus rule discards the ratio between APPROVE and MODIFY verdicts, and ignores the content of MODIFY suggestions from non-dropping critics. Only the `n_drop` count matters for the write/discard decision. MODIFY content is preserved in the DB for the operator to read, but it does not automatically revise the written prediction.

### 2.3Feedback loops

Three feedback loops run at different timescales. Understanding them is what makes the system cybernetic rather than merely a pipeline.

Feedback loops · three timescales

> Three feedback loops (diagram labels)
>
> L1 · FAST LOOP
>
> hours–days · the Bayesian engine
>
> indicator fires
>
> (evidence arrives)
>
> apply\_indicator\_
>
> effect()
>
> bayesian\_update()
>
> mechanical Bayes
>
> posterior shifts
>
> posteriorHistory\[]
>
> operator reads
>
> dashboard → watches
>
> closes loop
>
> L2 · SLOW LOOP
>
> weeks–months · extrapolate × resolution
>
> extrapolate run
>
> (this skill)
>
> conditionalPredictions\[]
>
> grows (append-only)
>
> time passes
>
> deadlines approach
>
> sweep\_conditional\_
>
> predictions()
>
> Brier(P, outcome)
>
> calibration score
>
> source\_trust update
>
> lens calibration ledger
>
> next run reads
>
> updated trust,
>
> weights well-
>
> calibrated lenses
>
> higher
>
> L3 · META LOOP
>
> quarters · governor × operator
>
> governance\_report()
>
> drift flags
>
> stale indicators
>
> operator reviews
>
> (human in loop)
>
> reground LRs
>
> stamp\_resolution\_dates
>
> reset\_and\_migrate
>
> S1 operates on cleaner priors
>
> S2 generates forecasts with higher calibration headroom
>
> closes loop
>
> S1 + S2 operate
>
> on re-grounded
>
> priors

L1 is the canonical Bayes loop — the one most systems stop at. L2 is what makes NROL-αΩ epistemically honest: forecasts must *resolve* before their underlying lens earns trust. L3 is the human-in-the-loop loop; without L3 the system would slowly accumulate drift and eventually lose grounding, because L2's signals are too sparse to correct structural errors.

Why three loops, not one

A single fast loop would converge quickly but miss slow-moving calibration errors (a lens that's overconfident in a specific regime). A single slow loop would never react to fresh evidence. A single meta loop would be pure operator judgment with no mechanical grounding. Each loop corrects failure modes the other two cannot see.

### 2.4Information boundaries

Every arrow in the system map crosses a boundary where the data format changes or permissions narrow. These boundaries are where contracts live, and where failure modes hide.

| Boundary                     | Read                                                                                                  | Write                                                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **operator → skill**         | —                                                                                                     | `/extrapolate` cmd generators=\[A,B] topics=\[…]                                                  |
| **skill → topic JSON**       | hypotheses with posterior>0.05 existing conditionalPredictions meta.status / resolutionDate / horizon | append-only `cp_NNN` via `process_conditional_prediction()`                                       |
| **skill → sub-agent**        | persona prompt (verbatim) topic slice + existing preds                                                | — *(sub-agents never write)*                                                                      |
| **sub-agent → skill**        | —                                                                                                     | structured JSON `proposals[]` or `per_prediction[]`                                               |
| **skill → extrapolation.db** | drop counts, critic verdicts (within run)                                                             | ideations, vetting, critic\_verdicts, meta\_lint, portfolio\_snapshots, approved\_predictions     |
| **skill → engine**           | —                                                                                                     | `process_conditional_prediction` → `add_conditional_prediction` → `save_topic`                    |
| **engine → governor**        | topic before + proposed update                                                                        | `governance_report` (health, issues, freshness, drift) `check_update_proposal` may **hard-block** |
| **engine ↔ topic JSON**      | full topic via `load_topic`                                                                           | full topic via `save_topic` auto-eliminates expired hypotheses on load                            |

The one narrow write channel

The extrapolate skill has exactly one way to affect a topic JSON: `process_conditional_prediction()`. It cannot write posteriors, cannot fire indicators, cannot modify hypotheses. This is an enforced capability boundary — the whole system is safer because the forecast subsystem cannot accidentally update the Bayesian layer.

<a id="article-sec-2"></a>

## 03Epistemic architecture: generators and critics

The pipeline deliberately does not ask a single model to forecast. It splits forecasting into **generation** and **adversarial critique**, each handled by several personas with opinionated priors.

### 3.1The six ideator personas

| Persona | Prior / lens                                      |
| ------- | ------------------------------------------------- |
| GREEN   | Midtopia / continuation — *"things trend"*        |
| AMBER   | Phase-shift / regime change — *"nonlinear break"* |
| BLUE    | Systemic resolution — *"institutions reconverge"* |
| RED     | Tail risk / pessimist — *"the left tail bites"*   |
| VIOLET  | Actor-centric incentives — *"follow the agent"*   |
| OCHRE   | Structural determinism — *"the constraint wins"*  |

GRAY is a universal shared-assumption skeptic and **is always a critic**, never a generator.

### 3.2The pick-2 / critique-5 rule

The operator picks exactly 2 of 6 to generate. The remaining 4, plus GRAY, automatically become critics.

> Pick-2 / critique-5 rule (diagram labels)
>
> PERSONA POOL
>
> 6 ideators + GRAY
>
> GREEN
>
> AMBER
>
> BLUE
>
> RED
>
> VIOLET
>
> OCHRE
>
> GRAY
>
> always a critic
>
> never a generator
>
> PICK 2
>
> GENERATORS · 2
>
> GREEN
>
> AMBER
>
> propose predictions
>
> CRITICS · 5
>
> BLUE
>
> RED
>
> VIOLET
>
> OCHRE
>
> GRAY
>
> 4 leftover + GRAY
>
> CRITIQUE
>
> verdict per
>
> prediction per
>
> critic
>
> DECISION
>
> APPROVE
>
> MODIFY
>
> DROP · NEUTRAL

The structural claim: a forecast that survives critique from four lenses it does not share, plus a lens whose sole job is to name shared assumptions, is more robust than a forecast produced by a single model talking to itself. This is a **heuristic ensemble**, not a formal mixture model (see §6).

<a id="article-sec-3"></a>

## 04The pipeline

> Extrapolate pipeline (diagram labels)
>
> STEP 1 · SETUP
>
> acquire\_lock() · single-writer mutex in extrapolation.db
>
> start\_run(dichotomy, generators, critics, topic\_scope)
>
> STEP 2 · ENUMERATE SCOPE
>
> load\_topic(slug) · keep ACTIVE topics with posterior > 0.05
>
> pass existing conditionalPredictions to ideators (avoid dups)
>
> STEP 3 · PARALLEL IDEATION
>
> 2 Haiku sub-agents · 1 message · concurrent
>
> GEN A (Haiku)
>
> persona X · 3–5 proposals
>
> per (topic, hypothesis)
>
> GEN B (Haiku)
>
> persona Y · 3–5 proposals
>
> per (topic, hypothesis)
>
> all\_proposals (merged)
>
> STEP 4 · VETTING
>
> Sonnet · parent · sequential
>
> 5 sub-checks per proposal
>
> 1 · falsifiable
>
> 2 · deadline realistic vs topic horizon
>
> 3 · not a duplicate (<70% semantic overlap)
>
> 4 · probability direction consistent with CPT
>
> 5 · in scope
>
> verdict ∈ {APPROVE · MODIFY · REJECT} · all logged regardless
>
> STEP 5 · PARALLEL CRITIQUE
>
> 5 Opus sub-agents · 1 message · concurrent
>
> BLUE
>
> RED
>
> VIOLET
>
> OCHRE
>
> GRAY
>
> per-prediction verdicts ∈ {APPROVE · MODIFY · DROP · NEUTRAL}
>
> \+ portfolio\_narrative + blind\_spots\[]
>
> STEP 6 · CONSENSUS RULE
>
> deterministic · anti-veto
>
> vet ∈ {APPROVE, MODIFY} AND n\_drop ≤ 1 ⇒ write
>
> one objection does not kill. two concurrent objections do.
>
> STEP 7 · WRITE
>
> process\_conditional\_prediction()
>
> → add\_conditional\_prediction() → save\_topic()
>
> append-only · new cp\_NNN · never overwrites
>
> STEP 8 · FINALIZE
>
> log\_portfolio\_snapshot() per critic
>
> finish\_run(status="COMPLETED", duration, tokens, cost)
>
> release\_lock(run\_id)

<a id="article-sec-4"></a>

## 05Data flow: source of truth vs. audit trail

Two stores are touched. They have different roles.

> Data flow between topic JSON and audit DB (diagram labels)
>
> TOPIC JSON · source of truth
>
> conditionalPredictions\[]
>
> append-only · cp\_NNN sequential IDs
>
> canonical · JSON wins over DB
>
> read via load\_topic() · write via save\_topic()
>
> ONLY WRITE PATH
>
> process\_conditional\_
>
> prediction()
>
> engine-gated · never direct edit
>
> also writes
>
> audit row
>
> extrapolation.db · SQLite · WAL
>
> audit + analytics only · never canonical
>
> agent\_runs
>
> one row per sweep
>
> ideations
>
> EVERY proposal (incl. rejected)
>
> vetting
>
> EVERY Sonnet verdict + reason
>
> critic\_verdicts
>
> 5 × every proposal
>
> meta\_lint
>
> portfolio narratives
>
> approved\_predictions
>
> link back to cp\_NNN in JSON
>
> portfolio\_snapshots
>
> per-run time series
>
> sweep\_lock
>
> single-writer mutex · enforces serial runs
>
> Reconstruction guarantee: from the DB alone you can recover every
>
> proposal ever made, every verdict, every critic's narrative, and
>
> the link back to the approved prediction ID in the JSON.

**Important invariants:**

- **Topic JSON is canonical.** If the DB and the JSON disagree, the JSON wins.
- **Sub-agents never write.** They return structured JSON. The parent does all DB and topic writes. This prevents SQLite lock contention and keeps the audit trail linear.
- **Everything is logged, including rejections.** The ratio of ideations to approvals is itself a signal — a generator producing 80% rejects is telling you something.

<a id="article-sec-5"></a>

## 06Bayes in this system — what's real, what's judgment

Orientation

**The Bayesian machinery lives at the topic level, in the engine.** That's where Bayes' rule actually fires. This section clarifies what the extrapolate skill adds on top of that Bayesian core — and what it does not claim to do. It is a layering statement, not a denial.

### 6.1The Bayesian core — what the engine does

Each topic is a **proper Bayesian inference object**. The engine maintains, for each topic:

- **Design priors** — initial P(H\_i) set when the topic is created, recorded as the first entry of `posteriorHistory`.
- **Per-indicator likelihood ratios** — `lr_range`, `lr_confidence`, and `lr_basis` on each indicator, grounded in reference-class reasoning or domain literature.
- **A current posterior** — `model.hypotheses[].posterior`, updated mechanically every time `apply_indicator_effect()` combines new LRs with the current state via `bayesian_update()`.
- **A posterior trajectory** — every update appends to `posteriorHistory[]`, so the full Bayesian path is auditable.
- **Hypothesis admissibility** — `_eliminate_expired_hypotheses()` zeroes out any hypothesis whose `resolution_deadline` has passed without being satisfied, treating time-elapse as falsifying evidence.

This is not metaphorical Bayes. It is Bayes' rule applied under governor gating, with dual-pass updates for `lr_range` intervals, geometric-mean normalization, and explosion caps in log space. The governor blocks unsafe updates (low-confidence likelihoods on ALERT-classified topics, sensitivity failures, etc.) before they commit.

### 6.2What the extrapolate skill adds

The skill is a **forecast-generation layer** stacked on top of the Bayesian core. It reads the current posterior state — specifically, which hypotheses are still active with posterior > 0.05 — and asks language-model lenses to propose conditional predictions of the form `P(observable event | hypothesis H_cond is true)`. It vets these forecasts for falsifiability and scope, subjects them to critique from lenses that don't share the generator's prior, and writes the survivors to the topic as `conditionalPredictions[]`.

The elicited `conditional_probability` is subjective — it's whatever the language model judged, constrained to (0.10, 0.90) to prevent phantom precision. It is *not* derived from data, frequency, or a formal reference class. It's a forecast from a named lens, which the system tracks precisely so it can be scored later.

### 6.3What the skill does not do (scope clarity)

- **The skill does not update posteriors.** Writing a conditional prediction does not change `model.hypotheses[].posterior` — only the engine does that, and only on indicator firings.
- **The skill does not average lenses.** The two generators are not weighted by model evidence; they are picked by the operator. Convergence between lenses is tracked in `lens_agreement` as metadata — it is not combined into a mixture probability.
- **The consensus rule is a veto threshold, not a likelihood ratio.** "≤ 1 critic DROPs" is a heuristic. A prediction that survives 4 APPROVE + 1 DROP writes identically to 5 APPROVE, even though the information content differs.

These are deliberate scope boundaries. The skill sits *on top of* Bayes, not inside it — which is why the Bayesian engine can never be corrupted by a forecast-generation error.

### 6.4How forecasts re-enter the Bayesian core

Forecasts don't affect posteriors at write-time — but they close a *second* Bayesian loop when they resolve. That loop updates the system's estimate of each lens's reliability (source trust), which is itself a Bayesian quantity maintained in the source ledger.

> Write-time vs resolution-time coupling (diagram labels)
>
> WRITE-TIME · extrapolate skill
>
> RESOLUTION-TIME · scoring
>
> elicit P(pred | H\_cond)
>
> from LLM, per lens
>
> subjective judgment, NOT data-derived
>
> time passes
>
> observe outcome at deadline
>
> (resolution criterion checked)
>
> Brier((P, outcome))
>
> calibration score per prediction
>
> update source trust
>
> per-lens calibration ledger
>
> conditional\_calibration\_
>
> report()
>
> per-topic, per-lens metrics
>
> FEEDBACK
>
> next run weights
>
> well-calibrated
>
> lenses higher;
>
> biased ones drop
>
> out of portfolios

`sweep_conditional_predictions()` resolves each forecast as its deadline passes. `conditional_calibration_report()` produces Brier and calibration metrics per lens, per topic. Over many runs, a lens that is systematically overconfident or systematically biased gets detected — not by introspection in the skill itself, but by empirical scoring against outcomes. Those scores update the source-trust ledger, which is itself a Bayesian inference about lens reliability.

The layering, stated plainly

Bayes' rule fires in **two** places in this system, both at the topic / source level: (1) the engine updates topic posteriors from indicator likelihoods, and (2) the scoring layer updates source-trust posteriors from resolved forecasts. The extrapolate skill sits *between* these two Bayesian layers as a forecast-generation step. It does not do Bayes itself, but every forecast it produces is anchored to one Bayesian object (a topic hypothesis) and scored later to update another (a lens's trust). That's the honest Bayesian story: a forecasting layer wrapped by two Bayesian inference loops, not a non-Bayesian system.

### 6.5What is genuinely epistemic about this pipeline

Three things, stated plainly:

1. **Adversarial decomposition.** Separating generation and critique, and requiring that generators cannot critique their own output, removes a specific failure mode: a single model endorsing its own proposals because they follow its prior. It does not remove shared-prior failures across all six personas — which is why GRAY exists as a universal skeptic.
2. **Blind-spot surfacing.** Each critic returns not only per-prediction verdicts but a portfolio-level `blind_spots[]` list. These are structural observations — *"this portfolio assumes institutional continuity"* — that an operator can read independently of whether any individual prediction passed.
3. **Audit completeness.** Every proposal, every verdict, every reasoning string is persisted. A skeptical operator can reconstruct, months later, why a particular prediction was written and what the critics said. This is the single strongest epistemic property of the system: it is inspectable.

<a id="article-sec-6"></a>

## 07Known limitations

| Limitation                                | Consequence                                    |
| ----------------------------------------- | ---------------------------------------------- |
| Lenses are not statistically independent  | Multi-lens agreement overcounts evidence       |
| Elicited probabilities are subjective     | No frequentist guarantees on calibration       |
| Dedup is semantic overlap, not rigorous   | Near-duplicates can slip through               |
| Consensus is a veto rule, not a posterior | Information in APPROVE/MODIFY ratios discarded |
| Persona prompts are authored, not learned | Generator behavior drifts with prompt changes  |
| Critique is single-round                  | Critics do not see each other's objections     |
| Sub-agents see no parent context          | Cannot use conversation state for continuity   |

These are not bugs. They are the price paid for a pipeline that is cheap, parallelizable, auditable, and deterministic at the DB layer.

<a id="article-sec-7"></a>

## 08Operator guarantees

Because of how the pipeline is structured, a few things are guaranteed.

- **No silent overwrites.** Predictions are append-only (new `cp_NNN` IDs). A prior extrapolation cannot be clobbered by a later one.
- **No posterior contamination.** The skill cannot update topic posteriors. It writes only to `conditionalPredictions[]` via a dedicated pipeline function.
- **Lock exclusivity.** `sweep_lock` enforces a single active run. Concurrent invocations abort immediately.
- **Full reconstruction.** From the DB alone (without any topic JSON), you can recover: every proposal ever generated, every verdict ever rendered, every critic's narrative for every run, and the link back to the approved prediction ID.

<a id="article-sec-8"></a>

## 09Running it

```
/extrapolate generators=GREEN,AMBER
/extrapolate generators=RED,OCHRE topics=hormuz-closure,calibration-fed-rate-2026
```

**Arguments:**

- `generators=X,Y` — required, exactly 2 from {GREEN, AMBER, BLUE, RED, VIOLET, OCHRE}
- `topics=all` or `topics=slug1,slug2` — optional, defaults to all ACTIVE topics

The pipeline **aborts with a clear message** if: generator count ≠ 2, any generator is not in the allowed set, generators are identical, estimated cost exceeds $10 before meta-critique, or the sweep lock is already held.

Source · METHODOLOGY\_EXTRAPOLATE.md

Authored by Claude (Anthropic)

NROL-αΩ · v0.5
