# NROL-αΩ

## a Bayesian engine with a vibe-coded skin

i built a forecasting system. call it NROL-αΩ. every topic is a Bayesian object;;; named hypotheses, design priors, per-indicator likelihood ratios, a posterior the engine updates mechanically whenever an indicator fires. this part is math. `bayesian_update()` does what the name says. `_eliminate_expired_hypotheses()` falsifies time-bound claims as deadlines pass. governor-gated. auditable. mechanical.

then i bolted on something stranger.

## the extrapolate skill

the engine answers ONE question: which hypothesis is likely, right now? it does not answer the second question — conditional on each hypothesis being true, what observable events should follow? that's the FORECAST NET. a web of auxiliary predictions, each keyed to a conditioning hypothesis, each with a deadline and a resolution criterion.

the engine can't generate that net. the engine is Bayes. Bayes does not imagine.

so i use LMs. six ideator lenses — GREEN, AMBER, BLUE, VIOLET, OCHRE, GRAY — each with a different temperamental bias. pick two per run. each proposes conditional predictions. a Sonnet parent vets each candidate on five sub-checks;;; falsifiable, not duplicate, deadline realistic, CPT-aligned, in scope. survivors fan out to five Opus critics running concurrently. verdicts in {APPROVE, MODIFY, DROP, NEUTRAL}. a deterministic consensus rule: if two or more critics DROP, discard. else write.

```
generator → sonnet vet → 5-critic fan-out → consensus → write
                                          ↓
                                    resolve → Brier → calibration
```

## what is epistemic, what is vibe

this is the part that matters. the **engine** is epistemic. it has a formal update rule. every posterior shift is traceable to a likelihood ratio with a stated range and a governor check. if the math is wrong you can find the line.

the **skill** is not epistemic. it is a VIBECODED APPARATUS for generating hypotheses-conditional forecasts. there is no proof that a pick-2 rotation of LM lenses, vetted by a sixth LM, critiqued by five more, and filtered by an n_drop threshold, produces a well-calibrated forecast portfolio. there is no theorem. there is a workflow. the workflow has a shape that feels right — red-team pressure, diverse priors, hard gates at the boundaries. but "feels right" is the diagnosis.

the move is: let the vibe generate. let the math resolve. the forecasts earn their keep at resolution or not at all. Brier scores feed back into source trust and lens calibration on the slow loop, weeks-to-months. the system only BECOMES epistemic when outcomes land and the generator layer is scored against them.

until then it is a very elaborate guess.

## three timescales

- **L1 · FAST.** hours to days. indicator fires → LR computed → posterior shifts. mechanical Bayes. the tight loop.
- **L2 · SLOW.** weeks to months. extrapolate writes forecasts → deadlines pass → `sweep_conditional_predictions()` scores them → calibration updates propagate back to sources and lenses.
- **L3 · GOVERNOR.** cross-cutting, continuous. variety attenuator. can veto any write from S1 or S2. surfaces drift, freshness, health. the part of the system that notices when the other parts are lying.

## what i learned building it

1. **keep the math and the vibe in separate files.** the engine is boring Python. the skill is prompts and orchestration. when they live apart you can tell which part failed.
2. **information is lost by design.** consensus by n_drop throws away the APPROVE/MODIFY ratio and ignores MODIFY content. this is a CHOICE. the alternative is letting LM verbosity drive the write policy, which is how you end up believing your own hallucinations.
3. **the substrate is the substrate.** topic JSON. everything writes to it, everything reads from it, the governor watches all writes. pick a shared object early. all three subsystems become legible through it.
4. **forecasts are not evidence.** this is the whole discipline. the skill can propose "10Y falls to 3.6% by Dec if H2" but this does not move P(H2). only indicators move posteriors. only outcomes score forecasts. if you blur this you get feedback without grounding — a belief system that updates on its own dreams.

## the honest framing

NROL-αΩ is a Bayesian core wearing a language-model coat. the coat does useful work — generates conditional structure the core cannot. but the coat is held on with staples and i want to be precise about which staples.

epistemology, infrastructure, vibe. three layers. do not confuse them.

---

*the map is not the territory;;; but the forecast portfolio is a bet on which map will survive the next deadline.*
