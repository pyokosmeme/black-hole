<div class="nrol-doc">

<style>
/* ════════════════════════════════════════════════════════════════
   NEAM transmission · scoped styles
   Extends .nrol-doc base. Palette inherits from NROL-αΩ vars.
   ════════════════════════════════════════════════════════════════ */
/* Equation blocks — Unified global color rules override to fix whatever qwen did to the style sheet */
.nrol-doc .eq-block,
.nrol-doc .eq-block em,
.nrol-doc .eq-block sub,
.nrol-doc .eq-block sup {
  color: var(--cyan) !important;
}

/* Light mode overrides — Forces all math sub-elements to shift together */
body.light-mode .nrol-doc .eq-block,
body.light-mode .nrol-doc .eq-block em,
body.light-mode .nrol-doc .eq-block sub,
body.light-mode .nrol-doc .eq-block sup,
body.light-reading .nrol-doc .eq-block,
body.light-reading .nrol-doc .eq-block em,
body.light-reading .nrol-doc .eq-block sub,
body.light-reading .nrol-doc .eq-block sup {
  color: #bf00ff !important; /* High-contrast color for light backgrounds */
}

.nrol-doc .eq-block {
  text-align: center;
  margin: 18px 0;
  padding: 12px 0;
  font-size: 14px;
  letter-spacing: 0.04em;
}

.nrol-doc .eq-block {
  text-align: center;
  margin: 18px 0;
  padding: 12px 0;
  font-size: 14px;
  letter-spacing: 0.04em;
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
}
</style>

<h1>Non-Equilibrium Attention Markets</h1>

<h2 id="sec-intro"><span class="num">01</span> Introduction</h2>

<p>
If you need evidence of the value of the Ising model, this is not the post for you — you're late to the stage and the world has already been swallowed by statistical mechanics — instead, this post seeks to expand your study from mere statistical mechanics, into the regime of attention transformers. From that point, we propose Non-Equilibrium Attention Markets. To that end, we have two bridge questions:
</p>

<ol>
  <li><strong>What happens if we make the fundamental states of the Ising model continuous?</strong></li>
  <li><strong>What happens if these interactions are not symmetric?</strong></li>
</ol>

<p>
We will see that we recover Bal's spin transformers (<a href="https://mcbal.github.io">Bal, 2021</a>). Which raises a new question: <strong>What are the consequences if we use the tools of econophysics and apply it to Bal's spin transformers?</strong>
</p>

<p>
Our goal today is to slouch towards a stochastic differential equation governing attention markets, where the market created by agents is a large dimensional vector space, and the interactions are asymmetric, forcing the system into non-equilibrium.
</p>

<p>
Before we begin, it is worth nothing this is not the Ising explainer, which I will never write, but the way forward is dangerous, so take this sampling of literature on the application of Ising models in economics:
</p>

<ul>
  <li>Bornholdt, S. (2001). <a href="https://doi.org/10.1142/S0129183101001845">"Expectation bubbles in a spin model of markets: Intermittency from frustration across scales."</a> International Journal of Modern Physics C, 12(5), 667-674.</li>
  <li>Brock, W. A., &amp; Durlauf, S. N. (2001). <a href="https://doi.org/10.1111/1467-937x.00168">"Discrete choice with social interactions."</a> The Review of Economic Studies, 68(2), 235-260.</li>
  <li>Cont, R., &amp; Bouchaud, J.-P. (1998). <a href="https://doi.org/10.2139/ssrn.58468">"Herd behavior and aggregate fluctuations in financial markets."</a> Macroeconomic Dynamics, 4(2), 170-196.</li>
  <li>Galam, S. (2008). <a href="https://doi.org/10.1142/s0129183108012297">"Sociophysics: A review of Galam models."</a> International Journal of Modern Physics C, 19(3), 409-440.</li>
  <li>Sornette, D. (2014). <a href="https://doi.org/10.1088/0034-4885/77/6/062001">"Physics and financial economics (1776-2014): Puzzles, Ising and agent-based models."</a> Reports on Progress in Physics, 77(6), 062001.</li>
  <li>Zaklan, G., Westerhoff, F., &amp; Stauffer, D. (2009). <a href="https://doi.org/10.1007/s11403-008-0043-5">"Analysing tax evasion dynamics via the Ising model."</a> Journal of Economic Interaction and Coordination, 4(1), 1-14.</li>
</ul>

<h2 id="sec-state"><span class="num">02</span> State agent attention</h2>

<p>
Let's drop the <em>cut</em> as they may say someday, and drop ourselves right to the heart of it: the Ising model is a discrete lattice of particles, each particle has two states (buy or sell), particles only interact with their nearest neighbors, the state space of that system yields surprising results if we have infinitely many particles on our lattice. Combined this model yields tractable insight into technosocial systems. Across scales and fussy physical details, it just works.
</p>

<p>
Instead of limiting ourselves to the binary, let's instead assume that our trader, our agent, labeled with index <em>i</em> has an internal state represented by a vector <em>x</em> at time <em>t</em>. This vector lives in a <em>d</em>-dimensional vector space:
</p>

<div class="eq-block">
<em>x</em><sub>i</sub><sup>(t)</sup> ∈ ℝ<sup>d</sup>
</div>

<p>
What is this vector space? It is defined as the embeddings of all states for all agents, such that the matrix <em>X</em> ∈ ℝ<sup>N × d</sup> and is identified as the "hidden state" of all <em>N</em> agents.
</p>

<p>
<strong>TL;DR</strong> Agents have continuous internal states <em>d</em>, and if we have <em>N</em> agents, the totality of the market is represented by an <em>N × d</em> matrix <em>X</em>.
</p>

<h2 id="sec-path"><span class="num">03</span> Three-fold path</h2>

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

<h2 id="sec-jaynes"><span class="num">04</span> Enter Jaynes, suddenly Boltzmann appears</h2>

<p>
Let <em>p<sub>j</sub></em> be the probability that Agent <em>i</em> pays attention to Agent <em>j</em>. By "paid attention" we mean whatever is exchanged via the Q, K, V interactions; all we really care about is that the state of agent <em>i</em> changes via interactions with agent <em>j</em>, and <em>j</em> likewise changes but perhaps not in equal measure. If we find the optimal attention distribution <em>P</em> = {<em>p</em><sub>1</sub>, <em>p</em><sub>2</sub>, …, <em>p</em><sub>N</sub>} then we have the probability of how a market change of state occurs.
</p>

<p>
How do we calculate this? Well, let's just use Jaynes' Principle of Maximum Entropy (MaxEnt). There are many ways to think of MaxEnt. Jaynes might say a bounded agent should assume nothing beyond what is strictly known, and that the agent seeks a distribution that maximizes Shannon Entropy. Another way to think about it, is, I believe more intuitive, namely diffusion is a tendency of systems, unless otherwise constrained, and it is simply a better prior to assume diffusion under constraint, thus MaxEnt. Either way, we have the well-travelled path: <strong>we must maximize Shannon entropy</strong>.
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

<h2 id="sec-baleq"><span class="num">05</span> Bal's non-equilibrium attention market</h2>

<p>
In a classical physical spin system (Ising model) and in classical Efficient Market Hypothesis (EMH), systems are assumed to eventually reach Thermodynamic Equilibrium.
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
<strong>As we are not mere alchemists, we need a way to calculate this dissipation.</strong> Let's start by defining a Markovian random walk on the <em>attention graph</em>. Imagine a marginal "packet of influence" traversing the network. If this influence is currently localized at Agent <em>i</em>, it transitions to Agent <em>j</em> with probability <em>p<sub>ij</sub></em>. The agents themselves form the discrete state space of the system.
</p>

<p>
Because the attention matrix <em>A</em> is row-stochastic (∑<sub>j</sub> <em>p<sub>ij</sub></em> = 1) but strictly non-symmetric and not doubly stochastic, this Markov chain will converge to a unique stationary distribution <em>π</em> over the agents, where:
</p>

<div class="eq-block">
<em>π</em><sup>T</sup> <em>p</em> = <em>π</em><sup>T</sup>
</div>

<p>
As an aside, softmax attention with finite <em>β</em> gives <em>p<sub>ij</sub> &gt; 0</em> everywhere, which guarantees ergodicity, and thus secures the unique stationary distribution. The vector <em>π</em> represents the steady-state systemic influence of each agent.
</p>

<p>
To calculate this, we look at the attention weights, <em>p<sub>ij</sub></em>, that is how Agent <em>i</em> shifts to match Agent <em>j</em> through their interaction. The probability flux from agent <em>i</em> to agent <em>j</em> (<em>J<sub>ij</sub> = π<sub>i</sub>A<sub>ij</sub></em>) is not equal to the reverse flux (<em>J<sub>ji</sub> = π<sub>j</sub>p<sub>ji</sub></em>).
</p>

<p>
This persistent imbalance means the market acts as a driven non-equilibrium system. We can quantify the resulting "thermodynamic friction" using the <strong>Schnakenberg formula for entropy production rate (<em>Π</em>)</strong> in a Markov jump process (<a href="https://doi.org/10.1103/RevModPhys.48.571">Schnakenberg, 1976</a>):
</p>

<div class="eq-block">
<em>Π</em> = ½ ∑<sub>i,j</sub> (<em>J<sub>ij</sub></em> − <em>J<sub>ji</sub></em>) ln(<em>J<sub>ij</sub></em> / <em>J<sub>ji</sub></em>) = ½ ∑<sub>i,j</sub> (<em>π<sub>i</sub></em><em>p<sub>ij</sub></em> − <em>π<sub>j</sub></em><em>p<sub>ji</sub></em>) ln(<em>π<sub>i</sub></em><em>A<sub>ij</sub></em> / <em>π<sub>j</sub></em><em>p<sub>ji</sub></em>)
</div>

<p>
Because <em>π<sub>i</sub>p<sub>ij</sub> ≠ π<sub>j</sub>p<sub>ji</sub></em>, the logarithmic term is non-zero, yielding a strictly positive entropy production rate (<em>Π &gt; 0</em>).
</p>

<p>
Thus, an asymmetric attention market is constantly dissipating thermodynamic heat. It is precisely this persistent, microscopic entropy production—driven by the fact that agents have asymmetric attention—that prevents the market from ever settling into a thermal equilibrium. The system is continuously forced to search for stability, driving the violent reconfigurations of the attention distribution (<em>P<sub>t</sub></em>). Macroscopically, this should be observable as volatility spikes.
</p>

<h2 id="sec-network"><span class="num">06</span> Network dynamics in your lightcone</h2>

<p>
To understand what happens next, we must let the clock run (ergo add time, ergo we're in the lightcones now). The market does not just update its internal states (<em>x<sub>i</sub></em>); the agents are adaptive. They actively update their Query and Key projections (<em>W<sub>Q</sub></em>, <em>W<sub>K</sub></em>) to minimize their local free energy.
</p>

<p>
This adaptation creates a dangerous feedback loop fueled by the Entropy Production Rate (<em>Π</em>).
</p>

<h3><span class="num">6.1</span> Gradient descent</h3>

<p>
Agents adjust their projections based on historical success. If Alice loses money to Bob, Alice updates her Query vector to pay <em>closer</em> attention to Bob's Key vector in the next time step.
</p>

<p>
Meanwhile, Bob updates his Key vector to become more deceptive, or updates his Query vector to exploit other inefficiencies, deliberately ignoring Alice.
</p>

<p>
Mathematically, the agents are performing stochastic gradient descent on their weight matrices. Because the agents have different objective functions and computational bounds, the asymmetry of the coupling matrix <em>J = W<sub>Q</sub><sup>T</sup> W<sub>K</sub></em> <strong>amplifies over time</strong>. For an understanding of how non-symmetric game dynamics amplify over time, see the mechanics of <em>n</em>-player differentiable games (<a href="https://doi.org/10.48550/arxiv.1802.05642">Balduzzi et al., 2018</a>).
</p>

<h3><span class="num">6.2</span> The accumulation of thermodynamic friction</h3>

<p>
As the non-reciprocity amplifies, the system is driven further and further away from detailed balance.
</p>

<p>
We formally invoke the <strong>adiabatic approximation</strong>, and assume a separation of timescales: the microscopic attention dynamics relax to their non-equilibrium steady state instantaneously relative to the much slower timescale of macro-weight updates via gradient learning. This allows us to compute a well-defined instantaneous entropy production rate <em>Π<sub>t</sub></em> at any given market cross-section via the Schnakenberg formula for the stationary distribution <em>π</em>:
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
  <li><strong>Self-organized criticality.</strong> If you continuously drive a system away from equilibrium by injecting a constant flux of either energy or material, the system eventually reaches a state of Self-Organized Criticality (<a href="https://doi.org/10.1103/PhysRevLett.59.381">Bak, Tang, &amp; Wiesenfeld, 1987</a>). Imagine you are a sandpile. Dropping a single grain of sand at a time, you are never in equilibrium. The pile gets steeper and steeper. The continuous entropy production rate <em>Π<sub>t</sub></em> measures the constant injection of sand, steadily driving the market to a critical slope, where even a tiny perturbation causes the system to avalanche.</li>
  <li><strong>Geometric explosion and Phase Transitions</strong> Suppose an asymmetry between Retail agents represented by Alice, and Institutional agents represented by Bob. Alice is bleeding capital to Bob, but Alice isn't an idiot and won't just bleed out. In the terms of an attention agent: gradient descent trains weight matrices to adjust, to change, until Alice's Query matrices better align to the attention of Bob's with winning Key vectors. But look at softmax again with the physics lens:
    <div class="eq-block">
    <em>p<sub>ij</sub></em> = exp(<em>β E<sub>ij</sub></em>) / ∑<sub>k</sub> exp(<em>β E<sub>ik</sub></em>)
    </div>
    An arithmetic increase in alignment between Alice and Bob creates a geometric explosion in probability weight, because of that exponential. As the local field generated by the dominant agents (<em>q<sub>i</sub> · k<sub>j</sub></em>) grows larger relative to the noise, the exponential function in softmax abruptly dominates the denominator. The diverse, high-entropy attention distribution spontaneously collapses.</li>
</ol>

<p>
In either scenario, the attention of the entire network "snaps" onto a single signal or a small cluster of agents, or into a phasechange that is tracked (not caused) by <em>Π<sub>t</sub></em>. In statistical mechanics, this is a <strong>Phase Transition</strong> via spontaneous symmetry breaking. In finance, this is a <strong>Herd</strong>.
</p>

<p>
In this case, the Brownian motion of an efficient market is replaced with strong correlation, making this a strongly justified, though not rigorously demonstrated, claim!
</p>

<p>
So, we argue: the market cannot sustain infinite entropy production. As <em>Π<sub>t</sub></em> increases, the system becomes structurally fragile, setting the stage for a mechanical crash.
</p>

<p>
The moment the attention distribution collapses, we can quantify this using a standard economic tool: the systemic Herfindahl-Hirschman Index (HHI). The HHI the stationary distribution <em>π</em> violently spikes from its diversified baseline (<em>≈ 1/N</em>) toward its maximum (<em>1.0</em>).
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

<h2 id="sec-bbs"><span class="num">07</span> Attention Econophysics</h2>

<p>
Ok, so we have established our justifications for the overall dynamics regarding entropy and attention markets, but markets are about prices. Where are our prices? We will proceed by following the econophysics elephant path. If buy and sell (spin up or spin down) is our model, then the magnetization of the spin glass becomes aggregate excess demand. In physics, we call this the order parameter. Once we have demand, or an order parameter, we then identify the price clearing mechanism with the core assumption that the percentage change in price is strictly proportional to the excess demand:
</p>


<div class="eq-block">
Δ<em>S<sub>t</sub></em> / <em>S<sub>t</sub></em> = <em>λ</em> · <em>M<sub>t</sub></em>
</div>


<p>
Now the order parameter and the price-clearing mechanism established, and our next step is to determine how the microscopic randomness of the agents scales up to macroscopic market volatility. In statistical mechanics, passing from discrete microscopic jump probabilities to a continuous Stochastic Differential Equation is achieved via the Kramers-Moyal expansion—calculating the first (drift) and second (diffusion) moments of the macroscopic system. Here, however, we will use the tools of econophysics to identify the first and second moments directly.
</p>

<h3><span class="num">7.1</span> Magnetization</h3>

<p>
In a standard Ising model, magnetization is the average of all the discrete spins, representing the net polarity of the system. In our Non-Equilibrium Attention Market framework, the agents possess continuous states. Therefore, the Magnetization (<em>M<sub>t</sub></em>) is the continuous mean field of all agent state vectors:
</p>

<div class="eq-block">
<em>M<sub>t</sub></em> = (1/N) ∑<sub>i=1</sub><sup>N</sup> <em>x<sub>i</sub></em><sup>(t)</sup>
</div>

<p>
This vector <em>M<sub>t</sub></em> ∈ ℝ<sup>d</sup> represents the aggregate momentum and risk-posture of the entire market. To apply the standard econophysics machinery, we must translate this high-dimensional latent state into a scalar expectation (the excess demand). 
</p>

<p>
In a standard Large Language Model, this is the exact function of the <strong>Unembedding Matrix</strong>, which projects the final latent vector back into the vocabulary space to generate discrete logits. In our framework, we use an unembedding vector <em>w</em> to project the market's latent state into the continuous "vocabulary" of price drift. Thus, our scalar magnetization is <em>w<sup>T</sup> M<sub>t</sub></em>.
</p>

<p>
Following the established price-clearing relationship, the deterministic drift rate (<em>μ<sub>t</sub></em>) of the asset price is simply this scalar magnetization scaled by the market depth parameter <em>λ</em>:
</p>

<h3 id="sec-drift"><span class="num">7.2</span> Attention Price Clearing</h3>

<p>
We now have our order parameter (excess demand). The next step in the econophysics playbook is identifying the price clearing mechanism. Using the standard Kyle (1985) market impact model, the percentage change in price is strictly proportional to the excess demand crossed with a market depth parameter <em>λ</em>:
</p>

<div class="eq-block">
Δ<em>S<sub>t</sub></em> / <em>S<sub>t</sub></em> = <em>λ</em> · (<em>w<sup>T</sup> M<sub>t</sub></em>)
</div>

<p>
This provides the deterministic drift rate (<em>μ<sub>t</sub></em>) of our asset price. Unlike classical finance where drift is a static constant, here it is dynamically driven by the network's structural memory. If the network aligns into a bullish subspace, the drift organically updates to reflect that momentum.
</p>



<h3 id="sec-vol"><span class="num">7.3</span> Concentration</h3>

<p>
With the drift established, we must determine how the microscopic randomness of the agents scales up to macroscopic market volatility. The aggregate order flow is a weighted sum of the agents' intents, where the weights are the stationary attention probabilities <em>π<sub>j</sub></em>. 
</p>

<p>
To evaluate this rigorously, we expand the explicit variance of this weighted sum into individual variance components and cross-agent covariance terms:
</p>

<div class="eq-block">
Var(∑<sub>j=1</sub><sup>N</sup> <em>π<sub>j</sub> v<sub>j</sub></em>) = ∑<sub>j=1</sub><sup>N</sup> <em>π<sub>j</sub></em><sup>2</sup> Var(<em>v<sub>j</sub></em>) + ∑<sub>j≠k</sub> <em>π<sub>j</sub> π<sub>k</sub></em> Cov(<em>v<sub>j</sub>, v<sub>k</sub></em>)
</div>

<p>
Because market impact is driven by the total extensive order flow (<em>N</em> · ∑ <em>π<sub>j</sub> v<sub>j</sub></em>) rather than its sample average, the variance scales extensively with <em>N</em><sup>2</sup>, yielding the <em>O(N<sup>2</sup> HHI<sub>t</sub>)</em> structural floor and a diffusion coefficient of <em>σ<sub>v</sub> N √HHI<sub>t</sub></em>.
</p>

<p>
By evaluating this complete expansion, we can look directly at the exact asymptotic limits of the system to see precisely where the Herfindahl-Hirschman Index (HHI) governs the dynamics:
</p>

<ul>
  <li><strong>The Independent Phase (High Entropy):</strong> When the market is fragmented, agents act on private, idiosyncratic information. Their strategies are completely uncorrelated, meaning Cov(<em>v<sub>j</sub>, v<sub>k</sub></em>) = 0 for all <em>j ≠ k</em>. The covariance block vanishes, leaving the aggregate extensive variance to simplify cleanly to <em>σ</em><sup>2</sup> <em>N</em><sup>2</sup> HHI<sub>t</sub>. If attention is uniform (<em>π<sub>j</sub> = 1/N</em>), the HHI is <em>1/N</em>, and the total variance becomes <em>σ</em><sup>2</sup> <em>N</em>—the correct physical limit for a cumulative random walk of independent buyers and sellers.</li>
  <li><strong>The Monopolistic Phase (Localized Concentration):</strong> If a single dominant agent or systemic algorithm captures near-total attention, the distribution approaches <em>π<sub>1</sub> → 1</em> and <em>π<sub>j&gt;1</sub> → 0</em>. The weight products for the cross-terms drop to zero because the marginal agents carry no weight. Here, the HHI approaches 1.0, and the total variance cleanly matches the HHI baseline again, capping out at <em>σ</em><sup>2</sup> <em>N</em><sup>2</sup> due to geometric concentration alone.</li>
  <li><strong>The Correlated Herd Phase (The Covariance Explosion):</strong> The bound breaks away from the pure HHI line when attention remains distributed across multiple nodes, but those nodes begin actively imitating one another, forcing Cov(<em>v<sub>j</sub>, v<sub>k</sub></em>) → <em>σ</em><sup>2</sup>. Because the remaining weight products sum to <em>1 - HHI</em>, the variance surges to its global extensive ceiling of <em>σ</em><sup>2</sup> <em>N</em><sup>2</sup>.
  </li>
</ul>

<p>
This proves that the <em>O(N<sup>2</sup> HHI<sub>t</sub>)</em> scaling coefficient derived from the first term acts as the fundamental <strong>structural floor</strong> of market volatility. The HHI explicitly dictates the minimum level of macroeconomic diffusion guaranteed by the network geometry, while the latent covariance cross-terms dictate the explosive ceiling when herd coordination ignites.
</p>

<h3 id="sec-sde"><span class="num">7.4</span>The Non-Equilibrium Attention Market Equation</h3>

<p>
With both the first moment (drift) and second moment (diffusion) pulled from the physics of the attention network, using a standard econophysics playbook, we can finally synthesize the complete Stochastic Differential Equation. 
</p>

<p>
Because the diffusion coefficient of an SDE is the standard deviation (the square root of the variance), we take the square root of our HHI scaling factor. We add a variance parameter (<em>σ<sub>v</sub></em>) to represent ambient market noise, the spiritual equivalent of adding an ambient thermal noise term a la Langevin separation of noise. Thus, we arrive at the final Non-Equilibrium Attention Market (NEAM) equation:
</p>

<div class="eq-block">
d<em>S<sub>t</sub></em> = [ <em>λ</em> (<em>w<sup>T</sup> M<sub>t</sub></em>) ] <em>S<sub>t</sub></em> dt + [ <em>σ<sub>v</sub> N √HHI<sub>t</sub></em> ] <em>S<sub>t</sub></em> d<em>W<sub>t</sub></em>
</div>

<p>
Whatever we call it, this equation bridges Bal's Spin Transformers with observable market phenomena. It formally dictates two distinct market regimes:
</p>

<ol>
  <li><strong>The High-Entropy Regime (Stable Market):</strong> When attention is highly diversified, <em>HHI<sub>t</sub> ≈ 1/N</em>. The diffusion coefficient simplifies to <em>σ<sub>v</sub> √N</em>. The system acts as a standard random walk, absorbing exogenous macroeconomic shocks (d<em>W<sub>t</sub></em>) smoothly. </li>
  <li><strong>The Critical Phase Transition (Flash Crash):</strong> When thermodynamic friction forces the Softmax attention to collapse, the HHI violently spikes toward 1.0. The diffusion coefficient instantly scales up to <em>O(N)</em>, meaning <strong>the variance explodes by a massive factor of <em>N</em></strong>. </li>
</ol>

<p>
At that critical moment, the market is structurally compromised. The next exogenous macroeconomic shock (d<em>W<sub>t</sub></em>), no matter how mathematically trivial, is multiplied by a massive, perfectly correlated <em>O(N)</em> factor. The market maker's liquidity is instantly overwhelmed, and the scalar price <em>S<sub>t</sub></em> violently gaps to clear the one-sided demand. 
</p>


<p>
Consequently, the diffusion coefficient (the standard deviation) for our price equation must scale as <em>O(N √HHI<sub>t</sub>)</em>.
</p>

<h2 id="sec-fat"><span class="num">08</span> Endogenous fat tails for sale, never used</h2>

<p>
In traditional quantitative finance, fat tails (leptokurtosis) and volatility clustering are treated as exogenous mysteries that need to be patched over. The NEAM SDE requires no such ad-hoc adjustments. The heavy tails observed in empirical asset returns are revealed to be the direct macroscopic artifacts of bounded agents constantly shifting their attention structure.
</p>

<p>
The mathematical engine for this phenomenon lives directly within the phase boundaries shown in Section 7.3. Real market dynamics are defined by a meta-deliberation process: the system moves through intermittent periods of calm where agent updates are largely uncoordinated (The Independent Phase), anchoring the price to its minimum <em>O(N √HHI<sub>t</sub>)</em> volatility floor. However, because gradient updates on the query-key weights (<em>W<sub>Q</sub>, W<sub>K</sub></em>) operate on a slower, continuous timescale, the attention matrix slowly drifts toward alignment. 
</p>

<p>
When the network crosses the critical threshold into the Correlated Herd Phase, the variance breaks free from its structural floor and surges toward the <em>O(N)</em> global covariance ceiling. Because the system lingers in these non-equilibrium steady states before thermodynamic friction forces a clearing collapse, volatility naturally clusters in time. 
</p>

<p>
The switching dynamics between these two geometric phases transform what would be a standard Gaussian random walk into a heavy-tailed distribution. The extreme price gaps, so-called "Black Swan" events that classical finance deems 1-in-a-billion-year anomalies, are deterministic pile-ups of network learning in the NEAM framework.
</p>

<h2 id="sec-concl"><span class="num">09</span> Conclusion and summary</h2>

<p>
<strong>Non-Reciprocity</strong> generates a strictly positive <strong>Entropy Production Rate (<em>Π<sub>t</sub></em>)</strong>. Agents adapting to this non-equilibrium environment causes the <strong>stationary distribution (<em>π</em>) to concentrate</strong>. The concentrated signals trigger a <strong>Phase Transition</strong> in the bounded MaxEnt Softmax algorithm, causing <strong>Attention Collapse</strong>. The HHI spike multiplies the covariance of the aggregate order flow, exploding the diffusion term in the <strong>NEAM SDE</strong>, resulting in a <strong>Flash Crash</strong>.
</p>

<p>
And thus, to answer our questions that started this endeavor:
</p>

<ol>
  <li>What happens if we make the fundamental states of the Ising model continuous?
    <p><em>By applying Jaynes' Principle of Maximum Entropy to continuous spin states, the canonical Boltzmann distribution naturally emerges as the standard Softmax attention mechanism.</em></p>
  </li>
  <li>What happens if these interactions are not symmetric?
    <p><em>The system breaks detailed balance and enters a non-equilibrium steady state. The resulting non-reciprocal updates generate a strictly positive entropy production rate (Π), driving the network toward structural fragility and spontaneous attention collapse.</em></p>
  </li>
  <li>What are the consequences if we use the tools of econophysics and apply it to Bal's spin transformers?
    <p><strong>We directly find the drift (via continuous magnetization and an unembedding vector) and the diffusion (via the Herfindahl-Hirschman Index), deriving a testable Non-Equilibrium Attention Market (NEAM) SDE.</strong></p>
  </li>
</ol>

<h2 id="sec-refs"><span class="num">11</span> References</h2>

<h3>Foundational texts</h3>
<p><em>Note: The following foundational texts were published independently on Mathias Bal's academic blog and form the basis of the spin transformer explorations recreated in this work.</em></p>

<ul>
  <li>Bal, M. C. (2021). <em>Transformers Are Secretly Collectives of Spin Systems</em>. <a href="https://mcbal.github.io/post/transformers-are-secretly-collectives-of-spin-systems/">mcbal.github.io</a></li>
  <li>Bal, M. C. (2021). <em>Transformers from Spin Models: Approximate Free Energy Minimization</em>. <a href="https://mcbal.github.io/post/transformers-from-spin-models-approximate-free-energy-minimization/">mcbal.github.io</a></li>
  <li>Bal, M. C. (2023). <em>Spin-Model Transformers</em>. <a href="https://mcbal.github.io/post/spin-model-transformers/">mcbal.github.io</a></li>
  <li>Bal, M. C. (2026). <em>Entropy Production in Non-Equilibrium Neural Networks</em>. <a href="https://mcbal.github.io/tag/statistical-physics/">mcbal.github.io</a></li>
</ul>

<h3>Academic references</h3>

<ul>
  <li>Bak, P., Tang, C., &amp; Wiesenfeld, K. (1987). Self-organized criticality: An explanation of the 1/f noise. <em>Physical Review Letters</em>, 59(4), 381–384. <a href="https://doi.org/10.1103/PhysRevLett.59.381">doi</a></li>
  <li>Balduzzi, D., Racaniere, S., Martens, J., Foerster, J., Tuyls, K., &amp; Graepel, T. (2018). The Mechanics of n-Player Differentiable Games. <em>PMLR</em>, 80. <a href="https://doi.org/10.48550/arxiv.1802.05642">doi</a></li>
  <li>Black, F., &amp; Scholes, M. (1973). The Pricing of Options and Corporate Liabilities. <em>Journal of Political Economy</em>, 81(3), 637–654. <a href="https://doi.org/10.1086/260062">doi</a></li>
  <li>Bornholdt, S. (2001). Expectation bubbles in a spin model of markets: Intermittency from frustration across scales. <em>Int. J. Mod. Phys. C</em>, 12(5), 667–674. <a href="https://doi.org/10.1142/S0129183101001845">doi</a></li>
  <li>Bouchaud, J.-P., Mezard, M., &amp; Potters, M. (2002). Statistical properties of stock order books: Empirical results and models. <em>Quantitative Finance</em>, 2(4), 251–256. <a href="https://doi.org/10.1088/1469-7688/2/4/302">doi</a></li>
  <li>Brock, W. A., &amp; Durlauf, S. N. (2001). Discrete Choice with Social Interactions. <em>The Review of Economic Studies</em>, 68(2), 235–260. <a href="https://doi.org/10.1111/1467-937x.00168">doi</a></li>
  <li>Cont, R., &amp; Bouchaud, J.-P. (1998). Herd Behavior and Aggregate Fluctuations in Financial Markets. <em>SSRN Electronic Journal</em>. <a href="https://doi.org/10.2139/ssrn.58468">doi</a></li>
  <li>Galam, S. (2008). Sociophysics: A Review of Galam Models. <em>International Journal of Modern Physics C</em>, 19(3), 409–440. <a href="https://doi.org/10.1142/s0129183108012297">doi</a></li>
  <li>Gardiner, C. W. (1985). <em>Handbook of Stochastic Methods for Physics, Chemistry and the Natural Sciences</em>. Springer-Verlag. <a href="https://doi.org/10.1007/978-3-662-02452-2">doi</a></li>
  <li>Jaynes, E. T. (1957). Information Theory and Statistical Mechanics. <em>Physical Review</em>, 106(4), 620–630. <a href="https://doi.org/10.1103/physrev.106.620">doi</a></li>
  <li>Kyle, A. S. (1985). Continuous Auctions and Insider Trading. <em>Econometrica</em>, 53(6), 1315. <a href="https://doi.org/10.2307/1913210">doi</a></li>
  <li>Risken, H. (1989). <em>The Fokker-Planck Equation: Methods of Solution and Applications</em>. Springer-Verlag. <a href="https://doi.org/10.1007/978-3-642-61544-3">doi</a></li>
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
