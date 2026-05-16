<div class="nrol-doc">

<style>
/* ════════════════════════════════════════════════════════════════
   NEAM transmission · scoped styles
   Extends .nrol-doc base. Palette inherits from NROL-αΩ vars.
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

/* Equation blocks — var(--cyan) for dark mode, overridden for light */
.nrol-doc .eq-block {
  text-align: center;
  margin: 18px 0;
  padding: 12px 0;
  font-size: 14px;
  color: var(--cyan);
  letter-spacing: 0.04em;
}
body.light-mode .nrol-doc .eq-block,
body.light-reading .nrol-doc .eq-block {
  color: #bf00ff;
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

<h1>Non-Equilibrium Attention Markets</h1>

<h2 id="sec-intro"><span class="num">01</span>Introduction</h2>

<p>
If you need evidence of the value of the Ising model, this is not the post for you — you're late to the stage and the world has already been swallowed by statistical mechanics — instead, this post seeks to expand your study from mere statistical mechanics, into the regime of attention transformers, and from that point, propose a Non-Equilibrium Attention Market. To that end, we have two bridge questions:
</p>

<ol>
  <li><strong>What happens if we make the fundamental states of the Ising model continuous?</strong></li>
  <li><strong>What happens if these interactions are not symmetric?</strong></li>
</ol>

<p>
We will see that we recover Bal's spin transformers (<a href="https://mcbal.github.io">Bal, 2020</a>). Which raises a new question: <strong>What are the consequences if we use the tools of econophysics and apply it to Bal's spin transformers?</strong>
</p>

<p>
Our goal today is to gesture towards a possible solution toward that question.
</p>

<p>
While this is not the Ising explainer, which I will never write, here is a sampling of the robust literature on the application of Ising models as applied to economics:
</p>

<ul>
  <li>Bornholdt, S. (2001). <a href="https://doi.org/10.1142/S0129183101001845">"Expectation bubbles in a spin model of markets: Intermittency from frustration across scales."</a> International Journal of Modern Physics C, 12(5), 667-674.</li>
  <li>Brock, W. A., &amp; Durlauf, S. N. (2001). <a href="https://doi.org/10.1111/1467-937x.00168">"Discrete choice with social interactions."</a> The Review of Economic Studies, 68(2), 235-260.</li>
  <li>Cont, R., &amp; Bouchaud, J.-P. (1998). <a href="https://doi.org/10.2139/ssrn.58468">"Herd behavior and aggregate fluctuations in financial markets."</a> Macroeconomic Dynamics, 4(2), 170-196.</li>
  <li>Galam, S. (2008). <a href="https://doi.org/10.1142/s0129183108012297">"Sociophysics: A review of Galam models."</a> International Journal of Modern Physics C, 19(3), 409-440.</li>
  <li>Sornette, D. (2014). <a href="https://doi.org/10.1088/0034-4885/77/6/062001">"Physics and financial economics (1776-2014): Puzzles, Ising and agent-based models."</a> Reports on Progress in Physics, 77(6), 062001.</li>
  <li>Zaklan, G., Westerhoff, F., &amp; Stauffer, D. (2009). <a href="https://doi.org/10.1007/s11403-008-0043-5">"Analysing tax evasion dynamics via the Ising model."</a> Journal of Economic Interaction and Coordination, 4(1), 1-14.</li>
</ul>

<h2 id="sec-state"><span class="num">02</span>State agent attention</h2>

<p>
Let's drop the <em>cut</em> as they may say someday, and drop ourselves right to the heart of it: the Ising model is a discrete lattice of particles, each particle has two states (buy or sell), particles only interact with their nearest neighbors, the state space of that system yields surprising results if we have infinitely many particles on our lattice, and combined this model yields tractable insight to technosocial systems across scales and fussy physical details.
</p>

<p>
Instead, let's assume that our trader, our agent, labeled with index <em>i</em> has an internal state represented by a vector <em>x</em> at time <em>t</em>, and this vector lives in a <em>d</em>-dimensional vector space, thus:
</p>

<div class="eq-block">
<em>x</em><sub>i</sub><sup>(t)</sup> ∈ ℝ<sup>d</sup>
</div>

<p>
What is this vector space? It is defined as the embeddings of all states for all agents, such that the matrix <em>X</em> ∈ ℝ<sup>N × d</sup>, which is the "hidden state" of all <em>N</em> agents.
</p>

<p>
<strong>TL;DR</strong> Agents have continuous internal states <em>d</em>, and if we have <em>N</em> agents, the totality of the market is represented by an <em>N × d</em> matrix <em>X</em>.
</p>

<h2 id="sec-path"><span class="num">03</span>Three-fold path</h2>

<p>
In standard spin glass physics — the Ising model — each nearest neighbor interacts with a symmetric coupling (think of it as a scalar weight describing how two neighborly agents <em>s<sub>i</sub></em> and <em>s<sub>j</sub></em> interact, but it doesn't matter the order of the interaction, hence symmetric). The energy of this interaction would be <em>−s<sub>i</sub> J<sub>ij</sub> s<sub>j</sub></em>. Our agents, our states of spin, are given by <em>d</em>-dimensional vectors, though the energy is directly analogous:
</p>

<div class="eq-block">
−<em>x</em><sub>i</sub><sup>T</sup> <em>J</em> <em>x</em><sub>j</sub>
</div>

<p>
But we have a problem! Transformers do not let vectors (spins/agents) interact directly. Rather, they project states through three distinct learned weights: <em>W<sub>Q</sub></em>, <em>W<sub>K</sub></em>, <em>W<sub>V</sub></em> ∈ ℝ<sup>d × d<sub>attn</sub></sup>. These <em>d<sub>attn</sub> × d</em> matrices, the Query, Key, and Value, are projections that we will assign to economic terms (for interpretation's sake), alongside their mathematical values:
</p>

<ul>
  <li><strong>The Query (<em>q<sub>i</sub> = W<sub>Q</sub> x<sub>i</sub></em>):</strong> Agent <em>i</em>'s active demand for information or signals (their market lens).</li>
  <li><strong>The Key (<em>k<sub>j</sub> = W<sub>K</sub> x<sub>j</sub></em>):</strong> Agent <em>j</em>'s observable market signal (public supply/posture).</li>
  <li><strong>The Value (<em>v<sub>j</sub> = W<sub>V</sub> x<sub>j</sub></em>):</strong> Agent <em>j</em>'s actual capital intent or underlying action (the payload).</li>
</ul>

<p>
Now, when agent <em>i</em> interacts with agent <em>j</em>, we find their alignment via the dot product:
</p>

<div class="eq-block">
<em>q</em><sub>i</sub> · <em>k</em><sub>j</sub> = (<em>W</em><sub>Q</sub><em>x</em><sub>i</sub>)<sup>T</sup> (<em>W</em><sub>K</sub><em>x</em><sub>j</sub>) = <em>x</em><sub>i</sub><sup>T</sup> (<em>W</em><sub>Q</sub><sup>T</sup> <em>W</em><sub>K</sub>) <em>x</em><sub>j</sub>
</div>

<p>
This matrix multiplication yields our spin coupling matrix, <em>J = W<sub>Q</sub><sup>T</sup> W<sub>K</sub></em>, and we can label our energy as <em>E<sub>ij</sub> = −q<sub>i</sub> · k<sub>j</sub></em>.
</p>

<p>
Ok so what? We have some slightly more complex agentic model, we have an asymmetric coupling, we have an equation for an "energy." At this point, nothing seems like transformers except via fiat, via assumption. <strong>And this is where Jaynes enters (<a href="https://doi.org/10.1103/physrev.106.620">Jaynes, 1957</a>).</strong>
</p>

<h2 id="sec-jaynes"><span class="num">04</span>Enter Jaynes, suddenly Boltzmann appears</h2>

<p>
Let <em>p<sub>j</sub></em> be the probability that Agent <em>i</em> pays attention to Agent <em>j</em>. By "paid attention" we mean whatever is exchanged via the Q, K, V interactions; all we really care about is that the state of agent <em>i</em> changes via interactions with agent <em>j</em>, and <em>j</em> likewise changes but perhaps not in equal measure. If we find the optimal attention distribution <em>P</em> = {<em>p</em><sub>1</sub>, <em>p</em><sub>2</sub>, …, <em>p</em><sub>N</sub>} then we have the probability of how a market change of state occurs.
</p>

<p>
How do we calculate this? Well, let's just use Jaynes' Principle of Maximum Entropy (MaxEnt). There are many ways to think of MaxEnt. Jaynes might say a bounded agent should assume nothing beyond what is strictly known, and that the agent seeks a distribution that maximizes Shannon Entropy. Another way to think about it, is, I believe more intuitive: diffusion is a tendency of systems, unless otherwise constrained, and it is simply a better prior to assume diffusion under constraint, thus MaxEnt. Either way, we have the well-travelled path: <strong>we must maximize Shannon entropy</strong>.
</p>

<p>
Shannon entropy is given by:
</p>

<div class="eq-block">
<em>H</em> = −∑<sub>j=1</sub><sup>N</sup> <em>p<sub>j</sub></em> ln <em>p<sub>j</sub></em>
</div>

<p>
with two constraints:
</p>

<ol>
  <li><strong>All probabilities sum to 1:</strong> ∑<sub>j=1</sub><sup>N</sup> <em>p<sub>j</sub></em> = 1</li>
  <li><strong>We know the value for the average energy:</strong> ∑<sub>j=1</sub><sup>N</sup> <em>p<sub>j</sub></em><em>E<sub>j</sub></em> = ⟨<em>E</em>⟩</li>
</ol>

<p>
To maximize Shannon entropy for a probability <em>p<sub>j</sub></em> under the constraints of the system, we simply use Lagrange multipliers:
</p>

<div class="eq-block">
ℒ = −∑<sub>j=1</sub><sup>N</sup> <em>p<sub>j</sub></em> ln <em>p<sub>j</sub></em> − <em>α</em>(∑<sub>j=1</sub><sup>N</sup> <em>p<sub>j</sub></em> − 1) − <em>β</em>(∑<sub>j=1</sub><sup>N</sup> <em>p<sub>j</sub></em><em>E<sub>j</sub></em> − ⟨<em>E</em>⟩)
</div>

<p>
We can do the motions here, but the result is the result:
</p>

<div class="eq-block">
<em>p</em><sub>ij</sub> = exp(<em>β</em>(<em>q</em><sub>i</sub> · <em>k</em><sub>j</sub>)) / ∑<sub>m=1</sub><sup>N</sup> exp(<em>β</em>(<em>q</em><sub>i</sub> · <em>k</em><sub>m</sub>))
</div>

<p>
Ok so this is familiar to physicists, some of which might not be in the audience, but this is just softmax!
</p>

<div class="eq-block">
<em>p</em><sub>ij</sub> = Softmax(<em>β x<sub>i</sub></em><sup>T</sup> (<em>W</em><sub>Q</sub><sup>T</sup> <em>W</em><sub>K</sub>) <em>x<sub>j</sub></em>)
</div>

<p>
<em>β</em> is the Lagrange multiplier representing the agent's computational bound. In statistical mechanics, this is <em>1/k<sub>B</sub>T</em>, but as the dimension size of the vectors <em>d<sub>k</sub></em> grows, the dot products grow as well, pushing the Softmax function into flat regions with zero gradients. To prevent this, they added a scaling factor. So we identify this constraint with our Lagrange multiplier and identify <em>β = 1/√d<sub>k</sub></em>.
</p>

<p>
Once Agent <em>i</em> establishes their attention distribution across the market, they update their internal state by taking the expected value of the <em>actual intent</em> (<em>V</em>) of the agents they are watching:
</p>

<div class="eq-block">
<em>x</em><sub>i</sub><sup>(t+1)</sup> = ∑<sub>j=1</sub><sup>N</sup> <em>p<sub>ij</sub></em> <em>v<sub>j</sub></em> = <em>p<sub>i</sub></em><em>V</em> = Softmax(<em>q<sub>i</sub>K</sub><sup>T</sup> / √d<sub>k</sub></em>) <em>V</em>
</div>

<p>
where <em>p<sub>i</sub></em> = Softmax(<em>β x<sub>i</sub></em><sup>T</sup>(<em>W</em><sub>Q</sub><sup>T</sup><em>W</em><sub>K</sub>)<em>X</em><sup>T</sup>).
</p>

<p>
If we update across <em>all</em> states (the market) then this is just attention:
</p>

<div class="eq-block">
Attention(<em>Q,K,V</em>) = Softmax(<em>QK</em><sup>T</sup> / √<em>d<sub>k</sub></em>) <em>V</em>
</div>

<h2 id="sec-baleq"><span class="num">05</span>Bal's non-equilibrium attention market</h2>

<p>
In a classical physical spin system (like an Ising model) and in classical Efficient Market Hypothesis (EMH), systems are assumed to eventually reach Thermodynamic Equilibrium.
</p>

<p>
For a system to be in true equilibrium, it must satisfy a strict mathematical condition called Detailed Balance. This means that at the microscopic level, the flow of probability from state <em>i</em> to state <em>j</em> is perfectly balanced by the flow from <em>j</em> back to <em>i</em>:
</p>

<div class="eq-block">
P(<em>i→j</em>)P(<em>i</em>) = P(<em>j→i</em>)P(<em>j</em>)
</div>

<p>
We can rotate all this nuance down to a pithy statement: an efficient market is a MaxEnt market. A MaxEnt dataset is one in which we can't tell what the next bit is; it is Brownian motion, it is a random coin flip. It is up or down, buy or sell, randomly, forever. This is precisely why Black-Scholes uses a random walk (Geometric Brownian Motion) to model the price (<a href="https://doi.org/10.1086/260062">Black &amp; Scholes, 1973</a>).
</p>

<p>
But Bal's physical translation of the Spin Transformer, the one we illustrated to you in the prior sections, is explicitly asymmetric. <em>It cannot satisfy Detailed Balance, and thus cannot reach the standard equilibrium.</em>
</p>

<p>
In non-equilibrium statistical mechanics, when detailed balance is broken, the system experiences a continuous dissipation of heat as agents update their states against non-reciprocal gradients of their peers (as an aside, this is why cults formed around Dissipative Adaptation are, at least conceptually, incredibly interesting, though like many in this AI space the intellectual lineages they gestured toward were squandered for grift and graft and clout).
</p>

<p>
<strong>As we are not mere alchemists, we need a way to calculate this dissipation.</strong> Let's start by defining a Markovian random walk on the <em>attention graph</em>. Imagine a marginal "packet of influence" traversing the network. If this influence is currently localized at Agent <em>i</em>, it transitions to Agent <em>j</em> with probability <em>A<sub>ij</sub></em>. The agents themselves form the discrete state space of the system.
</p>

<p>
Because the attention matrix <em>A</em> is row-stochastic (∑<sub>j</sub> <em>A<sub>ij</sub></em> = 1) but strictly non-symmetric and not doubly stochastic, this Markov chain will converge to a unique stationary distribution <em>π</em> over the agents, where:
</p>

<div class="eq-block">
<em>π</em><sup>T</sup> <em>A</em> = <em>π</em><sup>T</sup>
</div>

<p>
As an aside, softmax attention with finite <em>β</em> gives <em>A<sub>ij</sub> &gt; 0</em> everywhere, which guarantees ergodicity, and thus secures the unique stationary distribution. The vector <em>π</em> represents the steady-state systemic influence of each agent.
</p>

<p>
To calculate this, we look at the attention weights, <em>A<sub>ij</sub></em>, that is how Agent <em>i</em> shifts to match Agent <em>j</em> through their interaction. The probability flux from agent <em>i</em> to agent <em>j</em> (<em>J<sub>ij</sub> = π<sub>i</sub>A<sub>ij</sub></em>) is not equal to the reverse flux (<em>J<sub>ji</sub> = π<sub>j</sub>A<sub>ji</sub></em>).
</p>

<p>
This persistent imbalance means the market acts as a driven non-equilibrium system. We can quantify the resulting "thermodynamic friction" using the <strong>Schnakenberg formula for entropy production rate (<em>Π</em>)</strong> in a Markov jump process (<a href="https://doi.org/10.1103/RevModPhys.48.571">Schnakenberg, 1976</a>):
</p>

<div class="eq-block">
<em>Π</em> = ½ ∑<sub>i,j</sub> (<em>J<sub>ij</sub></em> − <em>J<sub>ji</sub></em>) ln(<em>J<sub>ij</sub></em> / <em>J<sub>ji</sub></em>) = ½ ∑<sub>i,j</sub> (<em>π<sub>i</sub></em><em>A<sub>ij</sub></em> − <em>π<sub>j</sub></em><em>A<sub>ji</sub></em>) ln(<em>π<sub>i</sub></em><em>A<sub>ij</sub></em> / <em>π<sub>j</sub></em><em>A<sub>ji</sub></em>)
</div>

<p>
Because <em>π<sub>i</sub>A<sub>ij</sub> ≠ π<sub>j</sub>A<sub>ji</sub></em>, the logarithmic term is non-zero, yielding a strictly positive entropy production rate (<em>Π &gt; 0</em>).
</p>

<p>
Thus, an asymmetric attention market is constantly dissipating thermodynamic heat. It is precisely this persistent, microscopic entropy production—driven by the fact that agents have asymmetric attention—that prevents the market from ever settling into a thermal equilibrium. The system is continuously forced to search for stability, driving the violent reconfigurations of the attention distribution (<em>P<sub>t</sub></em>). Macroscopically, this should be observable as volatility spikes.
</p>

<h2 id="sec-network"><span class="num">06</span>Network dynamics in your lightcone</h2>

<p>
To understand what happens next, we must let the clock run (ergo add time, ergo we're in the lightcones now). The market does not just update its internal states (<em>x<sub>i</sub></em>); the agents are adaptive. They actively update their Query and Key projections (<em>W<sub>Q</sub></em>, <em>W<sub>K</sub></em>) to minimize their local free energy.
</p>

<p>
This adaptation creates a dangerous feedback loop fueled by the Entropy Production Rate (<em>Π</em>).
</p>

<h3><span class="num">6.1</span>Gradient descent</h3>

<p>
Agents adjust their projections based on historical success. If Alice loses money to Bob, Alice updates her Query vector to pay <em>closer</em> attention to Bob's Key vector in the next time step.
</p>

<p>
Meanwhile, Bob updates his Key vector to become more deceptive, or updates his Query vector to exploit other inefficiencies, deliberately ignoring Alice.
</p>

<p>
Mathematically, the agents are performing stochastic gradient descent on their weight matrices. Because the agents have different objective functions and computational bounds, the asymmetry of the coupling matrix <em>J = W<sub>Q</sub><sup>T</sup> W<sub>K</sub></em> <strong>amplifies over time</strong>. For an understanding of how non-symmetric game dynamics amplify over time, see the mechanics of <em>n</em>-player differentiable games (<a href="https://doi.org/10.48550/arxiv.1802.05642">Balduzzi et al., 2018</a>).
</p>

<h3><span class="num">6.2</span>The accumulation of thermodynamic friction</h3>

<p>
As the non-reciprocity amplifies, the system is driven further and further away from detailed balance.
</p>

<p>
Recall the Schnakenberg entropy production rate for the stationary distribution <em>π</em>:
</p>

<div class="eq-block">
<em>Π</em><sub>t</sub> = ½ ∑<sub>i,j</sub> (<em>π<sub>i</sub></em><em>A<sub>ij</sub></em> − <em>π<sub>j</sub></em><em>A<sub>ji</sub></em>) ln(<em>π<sub>i</sub></em><em>A<sub>ij</sub></em> / <em>π<sub>j</sub></em><em>A<sub>ji</sub></em>)
</div>

<p>
As the institutional agents (or predatory algorithms) successfully extract capital, they become systemic attractors. Because the stationary distribution <em>π</em> satisfies <em>π<sup>T</sup>A = π<sup>T</sup></em>, as the columns of <em>A</em> associated with dominant agents grow larger (representing more agents attending to them), the Perron-Frobenius eigenvector <em>π</em> naturally concentrates its mass on those dominant nodes. Simultaneously, the asymmetry between <em>A<sub>ij</sub></em> (Retail watching Institutions) and <em>A<sub>ji</sub></em> (Institutions ignoring Retail) grows extreme.
</p>

<p>
Therefore, the Entropy Production Rate <em>Π<sub>t</sub></em> climbs steadily. This represents the "thermodynamic friction" of the market: the continuous, violent transfer of wealth and information required to sustain the non-equilibrium steady state.
</p>

<p>
Claim: <em>the market cannot sustain infinite entropy production.</em> As <em>Π<sub>t</sub></em> increases, the system becomes structurally fragile:
</p>

<ol>
  <li><strong>Self-organized criticality.</strong> If you continuously drive a system away from equilibrium by injecting a constant flux of either energy or material, the system eventually reaches a state of Self-Organized Criticality (<a href="https://doi.org/10.1103/PhysRevLett.59.381">Bak, Tang, &amp; Wiesenfeld, 1987</a>). Imagine you are a sandpile. Dropping a single grain of sand at a time, you are never in equilibrium. The pile gets steeper and steeper. The continuous entropy production rate <em>Π<sub>t</sub></em> acts precisely like the constant injection of sand, steadily driving the market to a critical slope where even a tiny perturbation causes the system to avalanche.</li>
  <li><strong>Geometric explosion.</strong> Suppose an asymmetry between Retail agents represented by Alice, and Institutional agents represented by Bob. Alice is bleeding capital to Bob, but Alice isn't an idiot and won't just bleed out. In the terms of an attention agent: gradient descent trains weight matrices to adjust, to change, until Alice's Query matrices better align to the attention of Bob's with winning Key vectors. But look at softmax again with the physics lens:
    <div class="eq-block">
    <em>p<sub>j</sub></em> = exp(<em>β E<sub>ij</sub></em>) / ∑<sub>k</sub> exp(<em>β E<sub>ik</sub></em>)
    </div>
    An arithmetic increase in alignment between Alice and Bob creates a geometric explosion in probability weight, because of that exponential.</li>
  <li><strong>Phase transition.</strong> As the local field generated by the dominant agents (<em>q<sub>i</sub> · k<sub>j</sub></em>) grows larger relative to the noise, the exponential function in softmax abruptly dominates the denominator. The diverse, high-entropy attention distribution spontaneously collapses.</li>
</ol>

<p>
The attention of the entire network "snaps" onto a single signal or a small cluster of agents. In statistical mechanics, this is a <strong>Phase Transition</strong> via spontaneous symmetry breaking. In finance, this is a <strong>Herd</strong>.
</p>

<p>
When attention is uniform, agents act as independent random variables, and we can see that market shocks are smoothed out in a usual Brownian motion argument. An efficient market, nearly. But, after softmax phase transitions, agents are perfectly correlated, so exogenous noise causes every single agent to react in the exact same direction simultaneously.
</p>

<p>
So, a justified claim!
</p>

<p>
And so we can argue, the market cannot sustain infinite entropy production. As <em>Π<sub>t</sub></em> increases, the system becomes structurally fragile, setting the stage for a mechanical crash.
</p>

<p>
The moment the attention distribution collapses, the systemic Herfindahl-Hirschman Index (HHI) of the stationary distribution <em>π</em> violently spikes from its diversified baseline (<em>≈ 1/N</em>) toward its maximum (<em>1.0</em>).
</p>

<div class="eq-block">
HHI<sub>t</sub> = ∑<sub>j=1</sub><sup>N</sup> <em>π<sub>j</sub></em><sup>2</sup> → 1.0
</div>

<p>
The agents are no longer acting as independent random variables; they are acting as a single monolithic block, perfectly correlated by their collapsed attention.
</p>

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

<h2 id="sec-bbs"><span class="num">07</span>Bal-Black-Scholes</h2>

<p>
Ok, but this is supposed to be a prediction about economics right? To quote a friend, "value plus discounted," that is to say: we would like to determine a value, or an asset price. I'm not an economist, however, so what I mean is: there's some variable in the system, some expected value, and it is an observable and we would like to know its value. In a market, like the stock market, I know about two things: what is the price I paid, what is the price I hope to get? That is, I would love to predict the price on the market, and the continuous evolutions of that price.
</p>

<p>
Call that the macroscopic price <em>S<sub>t</sub></em>. In standard quantitative finance, the classical Black-Scholes framework allows us to find this price. It relies on Geometric Brownian Motion (GBM):
</p>

<div class="eq-block">
d<em>S<sub>t</sub></em> = <em>μ S<sub>t</sub></em> dt + <em>σ S<sub>t</sub></em> d<em>W<sub>t</sub></em>
</div>

<p>
Black-Scholes assumes homoskedasticity, or that volatility (<em>σ</em>) is an exogenous constant, and the market is a passive vessel reacting to the random macroeconomic effects of Current Thing (d<em>W<sub>t</sub></em>).
</p>

<p>
The Non-Equilibrium Attention Market (NEAM) completely rewrites the diffusion term. To bridge the gap between our agents' latent vectors and the scalar price <em>S<sub>t</sub></em>, we map the aggregate intent of the network to market microstructure. Using the standard <a href="https://doi.org/10.2307/1913210">Kyle (1985)</a> Market Impact Model, price changes are driven by aggregate order flow crossing a market maker's finite liquidity (<em>λ</em>).
</p>

<p>
Because the aggregate order flow is determined by the covariance of the agents' intents, macroscopic volatility is explicitly scaled by the network's market-wide concentration, captured by the Herfindahl-Hirschman Index of the stationary distribution <em>π</em>. We assume that agents' orders are linear functions of their attended signals, meaning the correlation structure of their orders directly follows the market-wide HHI of the attention stationary distribution (HHI(<em>π</em>)). Concretely: in the uniform case, they watch the market average and their orders are independent; in the collapsed case, every agent watches the same dominant signal, making them perfectly correlated. Specifically, the aggregate variance of <em>N</em> perfectly correlated agents scales with <em>N<sup>2</sup> HHI<sub>t</sub></em>. Because volatility represents the standard deviation (the diffusion coefficient), taking the square root yields the <em>O(N √HHI<sub>t</sub>)</em> scaling factor.
</p>

<h3><span class="num">7.1</span>Magnetization and market memory (the drift term)</h3>

<p>
Before we write the final equation, we must address the most canonical observable in any spin system: <strong>Magnetization</strong>.
</p>

<p>
In a standard Ising model, magnetization is the average of all the discrete spins, representing the net polarity of the material. In our Non-Equilibrium Attention Market framework, the Bal transformers, the Magnetization (<em>M<sub>t</sub></em>) is the mean field of all agent state vectors:
</p>

<div class="eq-block">
<em>M</em><sub>t</sub> = (1/N) ∑<sub>i=1</sub><sup>N</sup> <em>x<sub>i</sub></em><sup>(t)</sup>
</div>

<p>
This vector <em>M<sub>t</sub></em> ∈ ℝ<sup>d</sup> represents the aggregate momentum and risk-posture of the entire market. To translate this into a scalar drift for our price equation, we apply a fixed pricing projection vector <em>w</em>:
</p>

<div class="eq-block">
<em>μ</em><sub>t</sub> = <em>w</em><sup>T</sup> <em>M</em><sub>t</sub>
</div>

<p>
We must explicitly acknowledge that <em>w</em> serves as an ad hoc model closure; it simply parameterizes that "some linear combination of the mean field matters" and requires empirical identification to be properly calibrated.
</p>

<p>
In classical Black-Scholes, the drift (<em>μ</em>) is a static constant (usually the risk-free rate). The market has no memory; it is a Markov process. But in the NEAM framework, the drift <em>μ<sub>t</sub></em> is a dynamic, state-dependent variable. Because agents update their internal states (<em>x<sub>i</sub></em>) based on historical learning and attention, the Magnetization retains structural memory. If the network aligns into a bullish subspace, the drift organically updates to reflect that momentum.
</p>

<p>
Therefore, our model extracts the two defining features of a market directly from the microscopic spin states:
</p>

<ol>
  <li><strong>The Trend (<em>μ<sub>t</sub></em>):</strong> Derived from the macroscopic <em>Magnetization</em> of the state vectors.</li>
  <li><strong>The Volatility (<em>σ<sub>t</sub></em>):</strong> Derived from the <em>Herfindahl-Hirschman Index</em> (HHI) of the attention matrix.</li>
</ol>

<h3><span class="num">7.2</span>The NEAM stochastic differential equation</h3>

<p>
With both the drift and diffusion terms micro-founded, we can formulate the complete Stochastic Differential Equation.
</p>

<p>
Because the aggregate order flow is determined by the covariance of the agents' intents, macroscopic volatility is explicitly scaled by the network's Herfindahl-Hirschman Index, and the drift is driven by Magnetization.
</p>

<p>
The NEAM Stochastic Differential Equation becomes:
</p>

<div class="eq-block">
d<em>S<sub>t</sub></em> = <em>μ(M</em><sub>t</sub><em>)</em> <em>S<sub>t</sub></em> dt + (<em>λ σ<sub>v</sub> N √HHI<sub>t</sub></em>) <em>S<sub>t</sub></em> d<em>W<sub>t</sub></em>
</div>

<p>
(Where <em>λ</em> is Kyle's inverse liquidity parameter, <em>σ<sub>v</sub></em> is baseline idiosyncratic intent variance, and <em>N</em> is the total number of agents).
</p>

<p>
And thus:
</p>

<ol>
  <li><strong>The High-Entropy Regime:</strong> When attention is diversified and HHI<sub>t</sub> ≈ 1/N, the diffusion multiplier simplifies. The system acts as a standard random walk, absorbing exogenous macroeconomic shocks (d<em>W<sub>t</sub></em>) smoothly. Because the diffusion coefficient scales as O(√N), the variance per unit time scales as O(N).</li>
  <li><strong>The Critical Phase Transition:</strong> When the thermodynamic friction (<em>Π<sub>t</sub></em>) forces the Softmax attention to collapse, the HHI violently spikes toward 1.0. The diffusion multiplier instantly scales up from O(√N) to O(N), meaning the variance jumps dramatically from O(N) to O(N<sup>2</sup>). The ratio of variance between regimes is a factor of N, generating a severe crash amplification.</li>
</ol>

<p>
At that precise moment, the market is critically susceptible. The next exogenous macroeconomic shock (d<em>W<sub>t</sub></em>), no matter how mathematically trivial, is multiplied by a massive, perfectly correlated O(N) factor. The market maker's liquidity is instantly overwhelmed, and the scalar price <em>S<sub>t</sub></em> violently gaps to clear the one-sided demand.
</p>

<h2 id="sec-fat"><span class="num">08</span>Endogenous fat tails for sale, never used</h2>

<p>
In classical finance, a crash is modeled as an extreme, "fat tail" anomaly drawn from a static normal distribution. It is a purely exogenous stroke of bad luck. In the Bal-Black-Scholes, or NEAM, framework a crash is not a random variable, but a deterministic phase transition caused by the network's bounded agents spontaneously aligning their attention to survive in a non-reciprocal learning environment. The extreme leptokurtosis (fat tails) and volatility clustering observed in empirical market data are the direct, measurable artifacts of bounded agents collapsing their attention, thus this proposed SDE provides a micro-founded mechanism capable of generating the observed leptokurtosis.
</p>

<h2 id="sec-concl"><span class="num">09</span>Conclusion and summary</h2>

<p>
<strong>Non-Reciprocity</strong> generates a strictly positive <strong>Entropy Production Rate (<em>Π<sub>t</sub></em>)</strong>. Agents adapting to this non-equilibrium environment causes the <strong>stationary distribution (<em>π</em>) to concentrate</strong>. The concentrated signals trigger a <strong>Phase Transition</strong> in the bounded MaxEnt Softmax algorithm, causing <strong>Attention Collapse</strong>. The HHI spike multiplies the covariance of the aggregate order flow, exploding the diffusion term in the <strong>NEAM SDE</strong>, resulting in a <strong>Flash Crash</strong>.
</p>

<p>
And thus, to answer our questions that started this endeavor:
</p>

<ol>
  <li>What happens if we make the fundamental states of the Ising model continuous?
    <p><em>With a few assumptions, we are able to derive, from MaxEnt, the attention mechanism.</em></p>
  </li>
  <li>What happens if these interactions are not symmetric?
    <p><em>We get non-equilibrium thermodynamics, and constant dissipation causes volatility, and collapsed phase changes.</em></p>
  </li>
  <li>What are the consequences if we use the tools of econophysics and apply it to Bal's spin transformers?
    <p><strong>We can strongly justify, if not outright derive, modifications to Black-Scholes equation, yielding a testable Non-Equilibrium Attention Market (NEAM).</strong></p>
  </li>
</ol>

<h2 id="sec-sim"><span class="num">10</span>Dynamic simulation</h2>

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
  import * as THREE from 'three';
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

  const N = 25;
  let friction = 0;
  let priceBS = 100, priceNEAM = 100;
  const mu = 0.0001, sigma_v = 0.003, lambda = 0.12;
  const maxCandles = 60, ticksPerCandle = 8;
  let currentTick = 0, candleData = [];
  let currentCandle = { open: 100, high: 100, low: 100, close: 100, bs: 100 };

  function simVar(name) {
    return getComputedStyle(document.querySelector('.neam-dashboard'))
      .getPropertyValue(name).trim();
  }

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

  const manifoldGeo = new THREE.TorusKnotGeometry(7, 2.5, 180, 40, 3, 5);
  const originalPos = manifoldGeo.attributes.position.clone();
  const manifoldMat = new THREE.MeshPhysicalMaterial({
    color: 0x1e293b, emissive: 0x1e293b, emissiveIntensity: 0.8,
    wireframe: true, transparent: true, opacity: 0.35, roughness: 0.2
  });
  const manifold = new THREE.Mesh(manifoldGeo, manifoldMat);
  scene.add(manifold);

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

  document.getElementById('neam-friction').addEventListener('input', function(e) {
    friction = parseFloat(e.target.value);
  });

  function animate() {
    requestAnimationFrame(animate);
    const time = Date.now() * 0.0015;

    const cBull = simVar('--sim-bull') || '#86efac';
    const cBear = simVar('--sim-bear') || '#fca5a5';
    const cGrid = simVar('--sim-grid') || '#1e293b';
    const cMuted = simVar('--sim-muted') || '#64748b';
    const cLine = simVar('--sim-line') || '#94a3b8';

    document.getElementById('legend-bull').style.background = cBull;

    const minHHI = 1 / N;
    const curHHI = minHHI + friction * (1 - minHHI);
    document.getElementById('neam-hhi').innerText = curHHI.toFixed(3);

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

    const vs = 1.0 - (friction * 0.75);
    manifold.scale.set(vs, vs, vs);
    manifold.rotation.x += 0.002;
    manifold.rotation.y += 0.003;

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

  window.addEventListener('resize', () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
})();
</script>

<h2 id="sec-refs"><span class="num">11</span>References</h2>

<h3>Foundational texts</h3>
<p><em>Note: The following foundational texts were published independently on Mathias Bal's academic blog and form the basis of the Spin-Transformer physical translation presented in this work.</em></p>

<ul>
  <li>Bal, M. C. (2020). <em>Transformers are secretly collectives of spin systems</em>. <a href="https://mcbal.github.io">mcbal.github.io</a></li>
  <li>Bal, M. C. (2020). <em>Entropy production in non-equilibrium neural networks</em>. <a href="https://mcbal.github.io">mcbal.github.io</a></li>
  <li>Bal, M. C. (2020). <em>Transformers from Spin Models: Approximate Free Energy Minimization</em>. <a href="https://mcbal.github.io">mcbal.github.io</a></li>
  <li>Bal, M. C. (2020). <em>Spin Model Transformers</em>. <a href="https://mcbal.github.io">mcbal.github.io</a></li>
</ul>

<h3>Academic references</h3>

<ul>
  <li>Bak, P., Tang, C., &amp; Wiesenfeld, K. (1987). Self-organized criticality: An explanation of the 1/f noise. <em>Physical Review Letters</em>, 59(4), 381–384. <a href="https://doi.org/10.1103/PhysRevLett.59.381">doi</a></li>
  <li>Balduzzi, D., Racaniere, S., Martens, J., Foerster, J., Tuyls, K., &amp; Graepel, T. (2018). The Mechanics of n-Player Differentiable Games. <em>PMLR</em>, 80. <a href="https://doi.org/10.48550/arxiv.1802.05642">doi</a></li>
  <li>Black, F., &amp; Scholes, M. (1973). The Pricing of Options and Corporate Liabilities. <em>Journal of Political Economy</em>, 81(3), 637–654. <a href="https://doi.org/10.1086/260062">doi</a></li>
  <li>Bornholdt, S. (2001). Expectation bubbles in a spin model of markets: Intermittency from frustration across scales. <em>Int. J. Mod. Phys. C</em>, 12(5), 667–674. <a href="https://doi.org/10.1142/S0129183101001845">doi</a></li>
  <li>Brock, W. A., &amp; Durlauf, S. N. (2001). Discrete Choice with Social Interactions. <em>The Review of Economic Studies</em>, 68(2), 235–260. <a href="https://doi.org/10.1111/1467-937x.00168">doi</a></li>
  <li>Cont, R., &amp; Bouchaud, J.-P. (1998). Herd Behavior and Aggregate Fluctuations in Financial Markets. <em>SSRN Electronic Journal</em>. <a href="https://doi.org/10.2139/ssrn.58468">doi</a></li>
  <li>Galam, S. (2008). Sociophysics: A Review of Galam Models. <em>International Journal of Modern Physics C</em>, 19(3), 409–440. <a href="https://doi.org/10.1142/s0129183108012297">doi</a></li>
  <li>Jaynes, E. T. (1957). Information Theory and Statistical Mechanics. <em>Physical Review</em>, 106(4), 620–630. <a href="https://doi.org/10.1103/physrev.106.620">doi</a></li>
  <li>Kyle, A. S. (1985). Continuous Auctions and Insider Trading. <em>Econometrica</em>, 53(6), 1315. <a href="https://doi.org/10.2307/1913210">doi</a></li>
  <li>Schnakenberg, J. (1976). Network theory of microscopic and macroscopic behavior of master equation systems. <em>Reviews of Modern Physics</em>, 48(4), 571–585. <a href="https://doi.org/10.1103/RevModPhys.48.571">doi</a></li>
  <li>Shannon, C. E. (1948). A Mathematical Theory of Communication. <em>Bell System Technical Journal</em>, 27(3), 379–423. <a href="https://doi.org/10.1002/j.1538-7305.1948.tb01338.x">doi</a></li>
  <li>Sornette, D. (2014). Physics and Financial Economics (1776-2014): Puzzles, Ising and Agent-Based models. <em>Rep. Prog. Phys.</em>, 77(6), 062001. <a href="https://doi.org/10.1088/0034-4885/77/6/062001">doi</a></li>
  <li>Vaswani, A., Shazeer, N., Parmar, N., Uszkoreit, J., Jones, L., Gomez, A. N., Kaiser, Ł., &amp; Polosukhin, I. (2017). Attention is All You Need. <em>Advances in Neural Information Processing Systems</em>, 30. <a href="https://arxiv.org/abs/1706.03762">arxiv</a></li>
  <li>Zaklan, G., Westerhoff, F., &amp; Stauffer, D. (2009). Analysing tax evasion dynamics via the Ising model. <em>Journal of Economic Interaction and Coordination</em>, 4(1), 1–14. <a href="https://doi.org/10.1007/s11403-008-0043-5">doi</a></li>
</ul>

<div class="footer-meta">
  <div>Source · Non-Equilibrium Attention Markets</div>
  <div>Framework · Bal spin transformers → NEAM</div>
  <div>Econophysics · 2026</div>
</div>

</div>