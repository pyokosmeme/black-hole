<div class="nrol-doc">

<style>
/* ════════════════════════════════════════════════════════════════
   NEAM transmission · scoped styles
   Extends .nrol-doc base. Palette inherits from NROL-αΩ vars.
   Additional rules for the embedded simulation panel.
   ════════════════════════════════════════════════════════════════ */

.neam-sim-wrapper {
  margin: 28px 0 36px;
  border: 0.5px solid var(--doc-faint);
  border-left: 2px solid var(--amber);
  background: var(--doc-code-bg);
  overflow: hidden;
}
.neam-sim-wrapper .sim-label {
  display: inline-block;
  font-size: 9px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--amber);
  margin: 14px 14px 0;
  padding: 2px 10px;
  border: 0.5px solid var(--amber);
}
.neam-sim-wrapper .sim-sublabel {
  font-size: 9px;
  color: var(--doc-dim);
  margin: 6px 14px 0;
  letter-spacing: 0.1em;
}

/* Dashboard container inside the sim */
.neam-dashboard {
  width: 100%;
  max-width: 900px;
  margin: 14px auto 14px;
  font-family: 'JetBrains Mono','IBM Plex Mono',monospace;
  --sim-bg: #020617;
  --sim-panel: #0f172a;
  --sim-border: #1e293b;
  --sim-text: #e2e8f0;
  --sim-muted: #64748b;
  --sim-accent: #fbbf24;
  --sim-bull: #86efac;
  --sim-bear: #fca5a5;
  --sim-grid: #1e293b;
  --sim-line: #94a3b8;
  color: var(--sim-text);
}
body.light-mode .neam-dashboard {
  --sim-bg: #f5f0e8;
  --sim-panel: #ede9e0;
  --sim-border: #d6d0c4;
  --sim-text: #1c1917;
  --sim-muted: #78716c;
  --sim-accent: #b45309;
  --sim-bull: #15803d;
  --sim-bear: #b91c1c;
  --sim-grid: #d6d3d1;
  --sim-line: #57534e;
}

.neam-dashboard .dash-card {
  background: var(--sim-panel);
  border-radius: 12px;
  border: 1px solid var(--sim-border);
  padding: 20px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.3);
}
.neam-dashboard .dash-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--sim-border);
}
.neam-dashboard .dash-header h2 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--sim-text);
  letter-spacing: -0.02em;
  border: none;
  padding: 0;
}
.neam-dashboard .dash-controls {
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--sim-bg);
  padding: 12px 18px;
  border-radius: 10px;
  border: 1px solid var(--sim-border);
  margin-bottom: 18px;
}
.neam-dashboard .slider-wrap { flex-grow: 1; display: flex; flex-direction: column; gap: 6px; }
.neam-dashboard .slider-label {
  font-size: 0.75rem;
  color: var(--sim-muted);
  font-weight: 500;
}
.neam-dashboard input[type="range"] {
  width: 100%;
  accent-color: var(--sim-accent);
  cursor: pointer;
}
.neam-dashboard .hhi-val {
  font-size: 1.15rem;
  font-family: monospace;
  font-weight: 700;
  color: var(--sim-accent);
  background: color-mix(in srgb, var(--sim-accent) 12%, transparent);
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, var(--sim-accent) 20%, transparent);
  min-width: 100px;
  text-align: right;
}
.neam-dashboard .viz-panel {
  background: var(--sim-bg);
  border-radius: 10px;
  border: 1px solid var(--sim-border);
  position: relative;
  overflow: hidden;
}
.neam-dashboard .viz-panel + .viz-panel { margin-top: 16px; }
.neam-dashboard #neam-canvas { height: 400px; width: 100%; cursor: grab; display: block; }
.neam-dashboard #neam-canvas:active { cursor: grabbing; }
.neam-dashboard .chart-legend {
  position: absolute;
  top: 16px;
  left: 20px;
  font-size: 0.7rem;
  display: flex;
  flex-direction: column;
  gap: 5px;
  pointer-events: none;
  z-index: 10;
}
.neam-dashboard .legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--sim-muted);
}
.neam-dashboard .legend-color {
  width: 12px;
  height: 4px;
  border-radius: 2px;
}
.neam-dashboard .hint-text {
  position: absolute;
  bottom: 10px;
  right: 14px;
  font-size: 0.65rem;
  color: var(--sim-muted);
  pointer-events: none;
}

/* Equation blocks */
.nrol-doc .eq-block {
  text-align: center;
  margin: 18px 0;
  padding: 12px 0;
  font-size: 14px;
  color: var(--cyan);
  letter-spacing: 0.04em;
}
.nrol-doc .eq-block .eq-label {
  display: block;
  font-size: 9px;
  color: var(--doc-dim);
  letter-spacing: 0.25em;
  text-transform: uppercase;
  margin-top: 6px;
}

/* Phase transition diagram area */
.nrol-doc .pt-phases {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 16px 0 24px;
}
.nrol-doc .pt-phase {
  padding: 14px 16px;
  border: 0.5px solid var(--doc-faint);
  background: var(--doc-soft-bg);
}
.nrol-doc .pt-phase .phase-label {
  font-size: 9px;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  margin-bottom: 8px;
}
.nrol-doc .pt-phase.high .phase-label { color: var(--GREEN); }
.nrol-doc .pt-phase.critical .phase-label { color: var(--RED); }
.nrol-doc .pt-phase p { font-size: 11.5px; margin: 0; }

@media (max-width: 640px) {
  .nrol-doc .pt-phases { grid-template-columns: 1fr; }
  .neam-dashboard #neam-canvas { height: 280px; }
  .neam-dashboard .dash-card { padding: 12px; }
}
</style>

<div class="hero">
  <div class="eyebrow">Speculative Econophysics · From Spin Transformers to Market Crashes</div>
  <h1>Non-Equilibrium <span class="accent">Attention</span> Markets</h1>
  <div class="subtitle">
    Given Mathias Bal's spin transformers framework, what are the consequences
    for econophysics? Continuous states, asymmetric coupling, and a MaxEnt
    derivation of softmax attention yield a modified Black-Scholes SDE where
    volatility is a function of attention concentration — and crashes are
    deterministic phase transitions, not fat-tail luck.
  </div>
  <div class="hero-meta">
    <div><span class="key">Framework</span><span class="val">Bal spin transformers → NEAM</span></div>
    <div><span class="key">Bridge</span><span class="val">Ising → QKV → softmax → SDE</span></div>
    <div><span class="key">Claim</span><span class="val">crashes as phase transitions, not exogenous shocks</span></div>
  </div>
</div>

<nav class="nrol-toc">
  <div class="toc-label">Contents</div>
  <ol>
    <li><a href="#sec-1">Two bridge questions</a></li>
    <li><a href="#sec-2">State agent attention</a></li>
    <li><a href="#sec-3">Three-fold coupling</a></li>
    <li><a href="#sec-4">MaxEnt softmax</a></li>
    <li><a href="#sec-5">Broken detailed balance</a></li>
    <li><a href="#sec-6">Network dynamics</a></li>
    <li><a href="#sec-7">Bal-Black-Scholes</a></li>
    <li><a href="#sec-8">Endogenous fat tails</a></li>
    <li><a href="#sec-9">Conclusion and summary</a></li>
    <li><a href="#sec-sim">Dynamic simulation</a></li>
  </ol>
</nav>

<h2 id="sec-1"><span class="num">01</span>Two bridge questions</h2>

<p>
If you need evidence of the Ising model's utility, you're late to the stage — statistical mechanics has already swallowed the world. The literature on Ising models applied to economics is dense and settled: Bornholdt's expectation bubbles, Brock and Durlauf's discrete choice with social interactions, Cont and Bouchaud's herd behavior, Galam sociophysics, Sornette's agent-based puzzles, Zaklan's tax evasion dynamics.
</p>

<p>
This is not an Ising explainer. Instead, two questions bridge from spin physics to attention markets:
</p>

<ol>
  <li><strong>What happens if we make the fundamental states of the Ising model continuous?</strong></li>
  <li><strong>What happens if these interactions are not symmetric?</strong></li>
</ol>

<p>
Answering both recovers Bal's spin transformers. The real question is what follows: <strong>what are the consequences of applying econophysics tools to Bal's spin transformers?</strong>
</p>

<div class="callout">
  <div class="callout-label">Orientation</div>
  What follows derives a modified Black-Scholes SDE where volatility is an
  endogenous function of attention concentration. Crashes become deterministic
  phase transitions rather than exogenous fat-tail events. The simulation at
  the end of this transmission lets you drive the phase transition by hand.
</div>

<h2 id="sec-2"><span class="num">02</span>State agent attention</h2>

<p>
The Ising model is a discrete lattice: each particle holds two states (buy or sell), interacts only with nearest neighbors, and the collective state space yields tractable insight into technosocial systems across scales.
</p>

<p>
Drop the discretization. Assume agent <span class="chip BLUE">i</span> at time <em>t</em> carries an internal state vector <em>x</em> in a <em>d</em>-dimensional space:
</p>

<div class="eq-block">
<em>x</em><sub>i</sub><sup>(t)</sup> ∈ ℝ<sup>d</sup>
<span class="eq-label">agent state as continuous embedding</span>
</div>

<p>
The matrix <em>X</em> ∈ ℝ<sup>N × d</sup> stacks all <em>N</em> agents. This is the hidden state of the entire market. The Ising spin <em>s</em> ∈ {−1, +1} becomes a vector — each trader is a point in latent space, not a coin flip.
</p>

<h2 id="sec-3"><span class="num">03</span>Three-fold coupling</h2>

<p>
Standard spin glass physics uses symmetric coupling: the interaction energy between neighbors <em>i</em> and <em>j</em> is <em>−s<sub>i</sub> J<sub>ij</sub> s<sub>j</sub></em>. Order doesn't matter. For vector states the energy is analogous:
</p>

<div class="eq-block">
−<em>x</em><sub>i</sub><sup>T</sup> <em>J</em> <em>x</em><sub>j</sub>
<span class="eq-label">continuous coupling energy</span>
</div>

<p>
Transformers break symmetry. They do not let vectors interact directly. Instead they project through three learned weight matrices <em>W<sub>Q</sub></em>, <em>W<sub>K</sub></em>, <em>W<sub>V</sub></em> ∈ ℝ<sup>d × d<sub>attn</sub></sup>. Map these to economic terms:</p>

<table>
  <thead>
    <tr><th>Projection</th><th>Economic reading</th><th>Role</th></tr>
  </thead>
  <tbody>
    <tr><td><span class="chip BLUE">Q</span> <em>q<sub>i</sub> = W<sub>Q</sub> x<sub>i</sub></em></td><td>Active demand for signals</td><td>Agent <em>i</em>'s market lens</td></tr>
    <tr><td><span class="chip VIOLET">K</span> <em>k<sub>j</sub> = W<sub>K</sub> x<sub>j</sub></em></td><td>Observable market signal</td><td>Agent <em>j</em>'s public posture</td></tr>
    <tr><td><span class="chip GREEN">V</span> <em>v<sub>j</sub> = W<sub>V</sub> x<sub>j</sub></em></td><td>Actual capital intent</td><td>Agent <em>j</em>'s payload</td></tr>
  </tbody>
</table>

<p>
When agent <em>i</em> attends to agent <em>j</em>, alignment is the dot product:
</p>

<div class="eq-block">
<em>q</em><sub>i</sub> · <em>k</em><sub>j</sub> = (<em>W</em><sub>Q</sub><em>x</em><sub>i</sub>)<sup>T</sup> (<em>W</em><sub>K</sub><em>x</em><sub>j</sub>) = <em>x</em><sub>i</sub><sup>T</sup> (<em>W</em><sub>Q</sub><sup>T</sup> <em>W</em><sub>K</sub>) <em>x</em><sub>j</sub>
<span class="eq-label">alignment yields coupling matrix J = W<sub>Q</sub><sup>T</sup> W<sub>K</sub></span>
</div>

<p>
The coupling <em>J</em> is <strong>asymmetric</strong> by construction. <em>W<sub>Q</sub><sup>T</sup> W<sub>K</sub></em> is not equal to <em>W<sub>K</sub><sup>T</sup> W<sub>Q</sub></em>. This breaks the fundamental assumption of equilibrium statistical mechanics.</p>

<h2 id="sec-4"><span class="num">04</span>MaxEnt → softmax</h2>

<p>
Let <em>p<sub>j</sub></em> be the probability that agent <em>i</em> pays attention to agent <em>j</em>. We want the optimal attention distribution <em>P</em> = {<em>p</em><sub>1</sub>, …, <em>p</em><sub>N</sub>}. Jaynes' Principle of Maximum Entropy gives us the path: maximize Shannon entropy under constraints.
</p>

<div class="eq-block">
<em>H</em> = −∑<em>p<sub>j</sub></em> ln <em>p<sub>j</sub></em>
<span class="eq-label">Shannon entropy to maximize</span>
</div>

<p>
Two constraints: probabilities sum to one, and the average energy <em>E</em><sub>j</sub> = −<em>q<sub>i</sub></em> · <em>k<sub>j</sub></em> is fixed. Lagrange multipliers <em>α</em> and <em>β</em>:</p>

<div class="eq-block">
ℒ = −∑<em>p<sub>j</sub></em> ln <em>p<sub>j</sub></em> − <em>α</em>(∑<em>p<sub>j</sub></em> − 1) − <em>β</em>(∑<em>p<sub>j</sub>E<sub>j</sub></em> − ⟨<em>E</em>⟩)
<span class="eq-label">Lagrangian with normalization and energy constraints</span>
</div>

<p>
The derivation is standard — the result is softmax:</p>

<div class="eq-block">
<em>p</em><sub>ij</sub> = exp(<em>β q<sub>i</sub></em> · <em>k<sub>j</sub></em>) / ∑<sub>m</sub> exp(<em>β q<sub>i</sub></em> · <em>k<sub>m</sub></em>)
<span class="eq-label">MaxEnt yields softmax attention, β = 1/√d<sub>k</sub></span>
</div>

<p>
<em>β</em> is the Lagrange multiplier. In physics it is <em>1/k<sub>B</sub>T</em> — the inverse temperature. In transformers it is <em>1/√d<sub>k</sub></em>, the scaling factor that prevents dot products from exploding as dimensionality grows. Same math, different name.</p>

<p>
Agent <em>i</em> updates its state by taking the expected value of the <strong>actual intent</strong> (<em>V</em>) of attended agents:</p>

<div class="eq-block">
<em>x</em><sub>i</sub><sup>(t+1)</sup> = ∑<sub>j</sub> <em>p<sub>ij</sub></em> <em>v<sub>j</sub></em> = Softmax(<em>q<sub>i</sub>K</sub><sup>T</sup> / √d<sub>k</sub></em>) <em>V</em>
<span class="eq-label">state update is attention</span>
</div>

<p>
Updated across all agents simultaneously, this <em>is</em> the attention mechanism. The transformer is a statistical mechanics system in disguise.</p>

<h2 id="sec-5"><span class="num">05</span>Bal's non-equilibrium market</h2>

<p>
Classical statistical mechanics and the Efficient Market Hypothesis share an assumption: systems reach thermodynamic equilibrium. The condition is <strong>detailed balance</strong> — at the microscopic level, probability flow from state <em>i</em> to <em>j</em> equals the reverse flow:</p>

<div class="eq-block">
P(<em>i→j</em>) P(<em>i</em>) = P(<em>j→i</em>) P(<em>j</em>)
<span class="eq-label">detailed balance — equilibrium condition</span>
</div>

<p>
An efficient market is a MaxEnt market. MaxEnt means maximum uncertainty — Brownian motion, a random coin flip. This is exactly why Black-Scholes models price as Geometric Brownian Motion.</p>

<p>
Bal's spin transformer is <strong>explicitly asymmetric</strong>. The coupling <em>J = W<sub>Q</sub><sup>T</sup> W<sub>K</sub></em> cannot satisfy detailed balance. <strong>The market cannot reach equilibrium.</strong></p>

<p>
In non-equilibrium statistical mechanics, broken detailed balance means continuous heat dissipation. Agents update their states against non-reciprocal gradients of their peers. The system is driven.</p>

<h3><span class="num">5.1</span>Quantifying dissipation</h3>

<p>
Define a Markovian random walk on the attention graph. A marginal packet of influence at agent <em>i</em> transitions to agent <em>j</em> with probability <em>A<sub>ij</sub></em>. The attention matrix <em>A</em> is row-stochastic but not doubly stochastic — the Markov chain converges to a unique stationary distribution <em>π</em>:</p>

<div class="eq-block">
<em>π</em><sup>T</sup> <em>A</em> = <em>π</em><sup>T</sup>
<span class="eq-label">stationary distribution of the attention graph</span>
</div>

<p>
The probability flux <em>J<sub>ij</sub></em> = <em>π<sub>i</sub>A<sub>ij</sub></em> is not equal to the reverse flux <em>J<sub>ji</sub></em> = <em>π<sub>j</sub>A<sub>ji</sub></em>. Quantify the thermodynamic friction via Schnakenberg's entropy production rate:</p>

<div class="eq-block">
<em>Π</em> = ½ ∑<sub>i,j</sub> (<em>J<sub>ij</sub></em> − <em>J<sub>ji</sub></em>) ln(<em>J<sub>ij</sub></em> / <em>J<sub>ji</sub></em>)
<span class="eq-label">Schnakenberg entropy production rate — strictly positive when detailed balance is broken</span>
</div>

<p>
Because <em>Π &gt; 0</em>, the asymmetric attention market is constantly dissipating thermodynamic heat. The persistent entropy production prevents thermal equilibrium. Macroscopically, this manifests as <strong>volatility spikes</strong>.</p>

<h2 id="sec-6"><span class="num">06</span>Network dynamics in your lightcone</h2>

<p>
Add time. The market does not just update states — agents actively update their Query and Key projections to minimize local free energy. Gradient descent on weight matrices. Adaptive learners.</p>

<h3><span class="num">6.1</span>Amplifying asymmetry</h3>

<p>
Alice loses capital to Bob. Alice updates her Query vector to attend more closely to Bob's Key vector. Bob updates his Key to become more deceptive, or updates his Query to exploit other inefficiencies — deliberately ignoring Alice. The asymmetry of <em>J = W<sub>Q</sub><sup>T</sup> W<sub>K</sub></em> <strong>amplifies over time</strong>.</p>

<p>
As non-reciprocity grows, the system is driven further from detailed balance. The entropy production rate <em>Π<sub>t</sub></em> climbs. Institutional agents become systemic attractors — the Perron-Frobenius eigenvector <em>π</em> concentrates mass on dominant nodes.</p>

<h3><span class="num">6.2</span>The market cannot sustain infinite entropy production</h3>

<p>
Three mechanisms converge:</p>

<ol>
  <li><strong>Self-organized criticality.</strong> Continuous entropy production acts like dropping sand on a pile. The slope steepens until a single grain triggers an avalanche.</li>
  <li><strong>Geometric explosion.</strong> An arithmetic increase in alignment between retail and institutional agents creates a geometric explosion in probability weight — the exponential in softmax does the work.</li>
  <li><strong>Phase transition.</strong> As the local field from dominant agents grows relative to noise, the softmax denominator is dominated by a single term. The high-entropy attention distribution <strong>collapses</strong>.</li>
</ol>

<p>
The network attention snaps onto a single signal cluster. In statistical mechanics: <strong>spontaneous symmetry breaking</strong>. In finance: <strong>a herd</strong>.</p>

<div class="pt-phases">
  <div class="pt-phase high">
    <div class="phase-label">High-entropy regime</div>
    <p>Attention diversified. <em>HHI ≈ 1/N</em>. Agents act as independent variables. Shocks absorbed via Brownian diffusion. Near-efficient.</p>
  </div>
  <div class="pt-phase critical">
    <div class="phase-label">Critical collapse</div>
    <p>Attention concentrated. <em>HHI → 1.0</em>. Agents perfectly correlated. Every shock amplified by <em>O(N)</em> factor. Flash crash.</p>
  </div>
</div>

<p>
The Herfindahl-Hirschman Index of the stationary distribution spikes from <em>≈ 1/N</em> toward <em>1.0</em>:</p>

<div class="eq-block">
HHI<sub>t</sub> = ∑ <em>π</em><sub>j</sub><sup>2</sup> → 1.0
<span class="eq-label">attention concentration index at phase transition</span>
</div>

<h2 id="sec-7"><span class="num">07</span>Bal-Black-Scholes</h2>

<p>
Map the agent latent vectors to a scalar price <em>S<sub>t</sub></em>. Kyle's market impact model: price changes driven by aggregate order flow crossing finite liquidity <em>λ</em>. The aggregate order flow covariance scales with the network's HHI.</p>

<h3><span class="num">7.1</span>Magnetization as drift</h3>

<p>
The mean field of all agent state vectors is the market magnetization:</p>

<div class="eq-block">
<em>M</em><sub>t</sub> = (1/N) ∑<em>x<sub>i</sub></em><sup>(t)</sup>
<span class="eq-label">aggregate momentum and risk-posture</span>
</div>

<p>
Project through a fixed pricing vector <em>w</em> to get scalar drift: <em>μ<sub>t</sub> = w<sup>T</sup> M<sub>t</sub></em>. Unlike Black-Scholes' static drift, this carries structural memory.</p>

<h3><span class="num">7.2</span>The NEAM SDE</h3>

<div class="eq-block">
d<em>S<sub>t</sub></em> = <em>μ(M</em><sub>t</sub><em>)</em> <em>S<sub>t</sub></em> dt + (<em>λ σ<sub>v</sub> N √HHI<sub>t</sub></em>) <em>S<sub>t</sub></em> d<em>W<sub>t</sub></em>
<span class="eq-label">Non-Equilibrium Attention Market stochastic differential equation</span>
</div>

<p>
Two regimes, one equation:</p>

<table>
  <thead>
    <tr><th>Regime</th><th>HHI</th><th>Diffusion scale</th><th>Variance</th></tr>
  </thead>
  <tbody>
    <tr><td><span class="chip GREEN">High-entropy</span></td><td>≈ 1/N</td><td>O(√N)</td><td>O(N) — absorbs shocks</td></tr>
    <tr><td><span class="chip RED">Phase transition</span></td><td>→ 1.0</td><td>O(N)</td><td>O(N²) — crash amplification</td></tr>
  </tbody>
</table>

<p>
The variance ratio between regimes is a factor of <em>N</em>. The next exogenous shock — no matter how trivial — is multiplied by a massive <em>O(N)</em> factor. Market maker liquidity is overwhelmed. The price gaps violently.</p>

<h2 id="sec-8"><span class="num">08</span>Endogenous fat tails</h2>

<p>
Classical finance models a crash as a fat-tail anomaly drawn from a static normal distribution — exogenous bad luck. In the NEAM framework, a crash is a <strong>deterministic phase transition</strong> caused by bounded agents spontaneously aligning their attention to survive in a non-reciprocal learning environment.</p>

<p>
The extreme leptokurtosis and volatility clustering observed in empirical market data are direct artifacts of bounded agents collapsing their attention. The NEAM SDE provides a micro-founded mechanism for generating the observed fat tails — they are not a feature of the distribution, but a feature of the <strong>system</strong>.</p>

<h2 id="sec-9"><span class="num">09</span>Conclusion and summary</h2>

<p>
Chain the logic:</p>

<p>
<strong>Non-reciprocity</strong> generates strictly positive <strong>entropy production</strong> (<em>Π<sub>t</sub></em>). Agents adapting to this non-equilibrium environment causes the <strong>stationary distribution</strong> (<em>π</em>) to concentrate. Concentrated signals trigger a <strong>phase transition</strong> in the bounded MaxEnt softmax algorithm, causing <strong>attention collapse</strong>. The HHI spike multiplies the covariance of aggregate order flow, exploding the diffusion term in the <strong>NEAM SDE</strong>. Result: <strong>flash crash</strong>.
</p>

<p>
Answers to the bridge questions:</p>

<table>
  <thead>
    <tr><th>Question</th><th>Answer</th></tr>
  </thead>
  <tbody>
    <tr><td>Continuous Ising states?</td><td>MaxEnt derivation recovers the attention mechanism.</td></tr>
    <tr><td>Asymmetric interactions?</td><td>Non-equilibrium thermodynamics. Constant dissipation drives volatility and collapsed phase changes.</td></tr>
    <tr><td>Econophysics on Bal's spin transformers?</td><td><strong>Testable modifications to Black-Scholes. A Non-Equilibrium Attention Market (NEAM) model.</strong></td></tr>
  </tbody>
</table>

<!-- ═══════════════════════════════════════════════════════════
     DYNAMIC SIMULATION — NEAM Phase Transition
     Three.js 3D manifold + D3 candlestick chart
     Driven by "thermodynamic friction" slider.
     ═══════════════════════════════════════════════════════════ -->

<div id="sec-sim"></div>

<div class="neam-sim-wrapper">
  <div class="sim-label">Dynamic Simulation · NEAM Phase Transition</div>
  <div class="sim-sublabel">Drag the slider to drive thermodynamic friction. Watch attention collapse and volatility explode.</div>

  <div class="neam-dashboard">
    <div class="dash-card">
      <div class="dash-header">
        <h2>Spin Glass 2.0: Non-Equilibrium Attention Market</h2>
      </div>

      <div class="dash-controls">
        <div class="slider-wrap">
          <span class="slider-label">THERMODYNAMIC FRICTION (ATTENTION COLLAPSE)</span>
          <input type="range" id="neam-friction" min="0" max="1" step="0.01" value="0">
        </div>
        <div class="hhi-val">HHI: <span id="neam-hhi">0.040</span></div>
      </div>

      <div class="viz-panel">
        <canvas id="neam-canvas"></canvas>
        <div class="hint-text">Click and drag to rotate manifold</div>
      </div>

      <div class="viz-panel">
        <div class="chart-legend">
          <div class="legend-item">
            <div class="legend-color" id="legend-bull"></div>
            <span>NEAM Price Action</span>
          </div>
          <div class="legend-item">
            <div class="legend-color" id="legend-bs" style="background: transparent; border-top: 2px dashed var(--sim-line);"></div>
            <span>Classical Black-Scholes</span>
          </div>
        </div>
        <svg id="neam-chart" height="280"></svg>
      </div>
    </div>
  </div>
</div>

<script type="importmap">
{
  "imports": {
    "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
  }
}
</script>
<script src="https://d3js.org/d3.v7.min.js"></script>

<script type="module">
(function() {
  // ── Isolation: do not leak into page scope ──
  import * as THREE from 'three';
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

  const N = 25;
  let friction = 0;
  let priceBS = 100, priceNEAM = 100;
  const mu = 0.0001, sigma_v = 0.003, lambda = 0.12;
  const maxCandles = 60, ticksPerCandle = 8;
  let currentTick = 0, candleData = [];
  let currentCandle = { open: 100, high: 100, low: 100, close: 100, bs: 100 };

  // Read CSS custom properties from the dashboard for theme colors
  function simVar(name) {
    return getComputedStyle(document.querySelector('.neam-dashboard'))
      .getPropertyValue(name).trim();
  }

  // ── THREE.JS scene ──
  const canvas = document.getElementById('neam-canvas');
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
  camera.position.set(0, 8, 30);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;

  scene.add(new THREE.AmbientLight(0xffffff, 0.2));
  const blueLight = new THREE.PointLight(0x7dd3fc, 60, 50);
  blueLight.position.set(15, 10, 15);
  scene.add(blueLight);
  const redLight = new THREE.PointLight(0xfca5a5, 60, 50);
  redLight.position.set(-15, -10, -15);
  scene.add(redLight);

  // Manifold: TorusKnot for that folded topological shape
  const manifoldGeo = new THREE.TorusKnotGeometry(7, 2.5, 180, 40, 3, 5);
  const originalPos = manifoldGeo.attributes.position.clone();
  const manifoldMat = new THREE.MeshPhysicalMaterial({
    color: 0x1e293b, emissive: 0x1e293b, emissiveIntensity: 0.8,
    wireframe: true, transparent: true, opacity: 0.35, roughness: 0.2
  });
  const manifold = new THREE.Mesh(manifoldGeo, manifoldMat);
  scene.add(manifold);

  // Nodes
  const nodes = [];
  const sphereGeo = new THREE.SphereGeometry(1, 24, 24);
  const domMat = new THREE.MeshStandardMaterial({ color: 0xfca5a5, emissive: 0xfca5a5, emissiveIntensity: 0.9 });
  const retMat = new THREE.MeshStandardMaterial({ color: 0x7dd3fc, emissive: 0x7dd3fc, emissiveIntensity: 0.6 });

  const domMesh = new THREE.Mesh(sphereGeo, domMat);
  domMesh.scale.set(1.5, 1.5, 1.5);
  scene.add(domMesh);
  nodes.push({ mesh: domMesh, isDominant: true });

  for (let i = 1; i < N; i++) {
    const mesh = new THREE.Mesh(sphereGeo, retMat);
    mesh.scale.set(0.4, 0.4, 0.4);
    scene.add(mesh);
    nodes.push({ mesh, isDominant: false, vertexIndex: Math.floor(Math.random() * originalPos.count) });
  }

  // Links
  const lineGeo = new THREE.BufferGeometry();
  const linePositions = new Float32Array((N - 1) * 2 * 3);
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
  const lineMat = new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.4 });
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  scene.add(lines);

  function updateLinks() {
    const pos = lines.geometry.attributes.position.array;
    let idx = 0;
    const dp = nodes[0].mesh.position;
    for (let i = 1; i < N; i++) {
      const rp = nodes[i].mesh.position;
      pos[idx++] = rp.x; pos[idx++] = rp.y; pos[idx++] = rp.z;
      pos[idx++] = dp.x; pos[idx++] = dp.y; pos[idx++] = dp.z;
    }
    lines.geometry.attributes.position.needsUpdate = true;
  }

  // ── D3 Chart Setup ──
  const svgEl = document.getElementById('neam-chart');
  const cWidth = svgEl.clientWidth || 860;
  const cHeight = 280;
  const margin = { top: 20, right: 50, bottom: 20, left: 10 };
  const iW = cWidth - margin.left - margin.right;
  const iH = cHeight - margin.top - margin.bottom;

  const xScale = d3.scaleLinear().domain([0, maxCandles]).range([0, iW]);
  let yScale = d3.scaleLinear().domain([95, 105]).range([iH, 0]);

  const svgChart = d3.select(svgEl).attr('viewBox', `0 0 ${cWidth} ${cHeight}`);
  const chartG = svgChart.append('g').attr('transform', `translate(${margin.left},${margin.top})`);
  const yAxisG = svgChart.append('g').attr('transform', `translate(${cWidth - margin.right},${margin.top})`);

  const lineBS = d3.line().x((d, i) => xScale(i)).y(d => yScale(d.bs)).curve(d3.curveMonotoneX);
  const pathBS = chartG.append('path').attr('fill', 'none').attr('stroke-width', 2).attr('stroke-dasharray', '4,4').attr('opacity', 0.6);

  const candleWidth = (iW / maxCandles) * 0.7;

  // Slider listener
  document.getElementById('neam-friction').addEventListener('input', function(e) {
    friction = parseFloat(e.target.value);
  });

  // ── Main loop ──
  function animate() {
    requestAnimationFrame(animate);
    const time = Date.now() * 0.0015;

    // Theme colors (cache — not every frame but good enough for slow theme switches)
    const cBull = simVar('--sim-bull') || '#86efac';
    const cBear = simVar('--sim-bear') || '#fca5a5';
    const cGrid = simVar('--sim-grid') || '#1e293b';
    const cMuted = simVar('--sim-muted') || '#64748b';
    const cLine = simVar('--sim-line') || '#94a3b8';

    // Update legend colors
    document.getElementById('legend-bull').style.background = cBull;

    // HHI math
    const minHHI = 1 / N;
    const curHHI = minHHI + friction * (1 - minHHI);
    document.getElementById('neam-hhi').innerText = curHHI.toFixed(3);

    // 3D vertex displacement
    const pos = manifoldGeo.attributes.position;
    const oArr = originalPos.array, pArr = pos.array;
    for (let i = 0; i < originalPos.count; i++) {
      const ix = i*3, iy = i*3+1, iz = i*3+2;
      const x = oArr[ix], y = oArr[iy], z = oArr[iz];
      const fold = Math.sin(x*0.4 + time) * Math.cos(y*0.4 - time) * Math.sin(z*0.4 + time*0.5);
      const disp = fold * (1 + friction * 4);
      const len = Math.sqrt(x*x + y*y + z*z) || 1;
      pArr[ix] = x + (x/len) * disp;
      pArr[iy] = y + (y/len) * disp;
      pArr[iz] = z + (z/len) * disp;
    }
    pos.needsUpdate = true;

    // Vacua scale
    const vs = 1.0 - (friction * 0.75);
    manifold.scale.set(vs, vs, vs);
    manifold.rotation.x += 0.002;
    manifold.rotation.y += 0.003;

    // Nodes and links
    nodes[0].mesh.scale.setScalar(1.5 + (friction * 2.5));
    lineMat.opacity = 0.2 + (friction * 0.6);
    lineMat.color.lerpColors(new THREE.Color(0x7dd3fc), new THREE.Color(0xfca5a5), friction * 0.8);

    const vTmp = new THREE.Vector3();
    for (let i = 1; i < N; i++) {
      const n = nodes[i], vi = n.vertexIndex;
      vTmp.set(pArr[vi*3], pArr[vi*3+1], pArr[vi*3+2]);
      vTmp.multiplyScalar(vs);
      vTmp.applyEuler(manifold.rotation);
      n.mesh.position.copy(vTmp);
    }

    updateLinks();
    controls.update();
    renderer.render(scene, camera);

    // SDE math
    const dW = (Math.random()+Math.random()+Math.random()+Math.random()+Math.random()+Math.random()-3) / Math.sqrt(0.5);
    priceBS += (mu * priceBS) + (sigma_v * priceBS * dW);
    const neamVol = lambda * N * Math.sqrt(curHHI);
    priceNEAM += (mu * priceNEAM) + (sigma_v * neamVol * priceNEAM * dW);

    currentCandle.close = priceNEAM;
    currentCandle.high = Math.max(currentCandle.high, priceNEAM);
    currentCandle.low = Math.min(currentCandle.low, priceNEAM);
    currentCandle.bs = priceBS;

    currentTick++;
    if (currentTick >= ticksPerCandle) {
      candleData.push({...currentCandle});
      if (candleData.length > maxCandles) candleData.shift();
      currentTick = 0;
      currentCandle = { open: priceNEAM, high: priceNEAM, low: priceNEAM, close: priceNEAM, bs: priceBS };
    }

    // D3 chart update
    const dd = [...candleData, currentCandle];
    if (dd.length > 0) {
      const yMax = d3.max(dd, d => Math.max(d.high, d.bs));
      const yMin = d3.min(dd, d => Math.min(d.low, d.bs));
      const pad = (yMax - yMin) * 0.1 || 1;
      yScale.domain([yMin - pad, yMax + pad]);
      const yAxis = d3.axisRight(yScale).ticks(5).tickSize(-iW);
      yAxisG.call(yAxis);
      yAxisG.select('.domain').remove();
      yAxisG.selectAll('.tick line').attr('stroke', cGrid).attr('stroke-dasharray', '2,2');
      yAxisG.selectAll('.tick text').attr('fill', cMuted).attr('x', 8);
    }
    pathBS.attr('d', lineBS(dd)).attr('stroke', cLine);

    const candles = chartG.selectAll('.candle').data(dd);
    const ce = candles.enter().append('g').attr('class', 'candle');
    ce.append('line').attr('class', 'wick');
    ce.append('rect').attr('class', 'body');
    const ac = ce.merge(candles);
    ac.select('.wick')
      .attr('x1', (d,i) => xScale(i)).attr('x2', (d,i) => xScale(i))
      .attr('y1', d => yScale(d.high)).attr('y2', d => yScale(d.low))
      .attr('stroke', d => d.close >= d.open ? cBull : cBear).attr('stroke-width', 1.5);
    ac.select('.body')
      .attr('x', (d,i) => xScale(i) - candleWidth/2)
      .attr('y', d => yScale(Math.max(d.open, d.close)))
      .attr('width', candleWidth)
      .attr('height', d => Math.max(1, Math.abs(yScale(d.open) - yScale(d.close))))
      .attr('fill', d => d.close >= d.open ? cBull : cBear).attr('rx', 2);
    candles.exit().remove();
  }

  animate();

  // Resize handler
  window.addEventListener('resize', () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
})();
</script>

---

## References

<div class="callout">
  <div class="callout-label">Foundational texts</div>
  The following were published independently on Mathias Bal's academic blog and form the basis of the spin-transformer physical translation presented here.
</div>

<ul>
  <li>Bal, M. C. (2020). <em>Transformers are secretly collectives of spin systems</em>. mcbal.github.io</li>
  <li>Bal, M. C. (2020). <em>Entropy production in non-equilibrium neural networks</em>. mcbal.github.io</li>
  <li>Bal, M. C. (2020). <em>Transformers from Spin Models: Approximate Free Energy Minimization</em>. mcbal.github.io</li>
  <li>Bal, M. C. (2020). <em>Spin Model Transformers</em>. mcbal.github.io</li>
</ul>

<ul>
  <li>Bak, P., Tang, C., & Wiesenfeld, K. (1987). Self-organized criticality. <em>Phys. Rev. Lett.</em> 59(4), 381. <a href="https://doi.org/10.1103/PhysRevLett.59.381">doi</a></li>
  <li>Balduzzi, D. et al. (2018). The Mechanics of n-Player Differentiable Games. <em>PMLR</em> 80. <a href="https://doi.org/10.48550/arxiv.1802.05642">doi</a></li>
  <li>Black, F., & Scholes, M. (1973). The Pricing of Options and Corporate Liabilities. <em>J. Polit. Econ.</em> 81(3), 637. <a href="https://doi.org/10.1086/260062">doi</a></li>
  <li>Bornholdt, S. (2001). Expectation bubbles in a spin model of markets. <em>Int. J. Mod. Phys. C</em> 12(5), 667. <a href="https://doi.org/10.1142/S0129183101001845">doi</a></li>
  <li>Brock, W. A., & Durlauf, S. N. (2001). Discrete Choice with Social Interactions. <em>Rev. Econ. Stud.</em> 68(2), 235. <a href="https://doi.org/10.1111/1467-937x.00168">doi</a></li>
  <li>Cont, R., & Bouchaud, J.-P. (1998). Herd Behavior and Aggregate Fluctuations. <em>SSRN</em>. <a href="https://doi.org/10.2139/ssrn.58468">doi</a></li>
  <li>Galam, S. (2008). Sociophysics: A Review of Galam Models. <em>Int. J. Mod. Phys. C</em> 19(3), 409. <a href="https://doi.org/10.1142/s0129183108012297">doi</a></li>
  <li>Jaynes, E. T. (1957). Information Theory and Statistical Mechanics. <em>Phys. Rev.</em> 106(4), 620. <a href="https://doi.org/10.1103/physrev.106.620">doi</a></li>
  <li>Kyle, A. S. (1985). Continuous Auctions and Insider Trading. <em>Econometrica</em> 53(6), 1315. <a href="https://doi.org/10.2307/1913210">doi</a></li>
  <li>Schnakenberg, J. (1976). Network theory of master equation systems. <em>Rev. Mod. Phys.</em> 48(4), 571. <a href="https://doi.org/10.1103/RevModPhys.48.571">doi</a></li>
  <li>Shannon, C. E. (1948). A Mathematical Theory of Communication. <em>Bell Sys. Tech. J.</em> 27(3), 379. <a href="https://doi.org/10.1002/j.1538-7305.1948.tb01338.x">doi</a></li>
  <li>Sornette, D. (2014). Physics and Financial Economics (1776-2014). <em>Rep. Prog. Phys.</em> 77(6), 062001. <a href="https://doi.org/10.1088/0034-4885/77/6/062001">doi</a></li>
  <li>Vaswani, A. et al. (2017). Attention is All You Need. <em>NeurIPS</em> 30. <a href="https://arxiv.org/abs/1706.03762">arxiv</a></li>
</ul>

<div class="footer-meta">
  <div>Source · Non-Equilibrium Attention Markets</div>
  <div>Framework · Bal spin transformers → NEAM</div>
  <div>Econophysics · 2026</div>
</div>

</div>