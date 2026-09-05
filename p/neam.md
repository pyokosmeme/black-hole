---
title: "NON-EQUILIBRIUM ATTENTION MARKETS"
date: 2026.05.16
tags: econophysics, spin-transformers, neam
canonical: https://lastnpcalex.agency/p/neam
---

# Non-Equilibrium Attention Markets

<a id="article-sec-intro"></a>

## 01 Introduction

If you need evidence of the value of the Ising model, this is not the post for you — you're late to the stage and the world has already been swallowed by statistical mechanics — instead, this post seeks to expand your study from mere statistical mechanics, into the regime of attention transformers. We present this as an argument, not as a peer-reviewed paper. We are gesturing along, what seems to be, a promising vector of inquiry. With that in mind, we will sketch our proposal for the Non-Equilibrium Attention Market framework.

To those ends, we have two bridging questions to answer:

1. **What happens if we make the fundamental states of the Ising model continuous?**
2. **What happens if these interactions are not symmetric?**

We will see that we recover Bal's spin transformers ([Bal, 2021](https://mcbal.github.io/)). Which raises a new question: **If we use the tools of econophysics and apply it to Bal's spin transformers, what are the consequences?**

Our goal today is to slouch towards a stochastic differential equation governing attention markets, where the market created by agents is a large dimensional vector space, and the interactions are asymmetric, forcing the system into non-equilibrium.

Before we begin, it is worth noting this is not the Ising explainer, which I will never write, but the way forward is dangerous, so take this sampling of literature on the application of Ising models in economics:

- Bornholdt, S. (2001). ["Expectation bubbles in a spin model of markets: Intermittency from frustration across scales."](https://doi.org/10.1142/S0129183101001845) International Journal of Modern Physics C, 12(5), 667-674.
- Brock, W. A., & Durlauf, S. N. (2001). ["Discrete choice with social interactions."](https://doi.org/10.1111/1467-937x.00168) The Review of Economic Studies, 68(2), 235-260.
- Cont, R., & Bouchaud, J.-P. (1998). ["Herd behavior and aggregate fluctuations in financial markets."](https://doi.org/10.2139/ssrn.58468) Macroeconomic Dynamics, 4(2), 170-196.
- Galam, S. (2008). ["Sociophysics: A review of Galam models."](https://doi.org/10.1142/s0129183108012297) International Journal of Modern Physics C, 19(3), 409-440.
- Sornette, D. (2014). ["Physics and financial economics (1776-2014): Puzzles, Ising and agent-based models."](https://doi.org/10.1088/0034-4885/77/6/062001) Reports on Progress in Physics, 77(6), 062001.
- Zaklan, G., Westerhoff, F., & Stauffer, D. (2009). ["Analysing tax evasion dynamics via the Ising model."](https://doi.org/10.1007/s11403-008-0043-5) Journal of Economic Interaction and Coordination, 4(1), 1-14.

<a id="article-sec-state"></a>

## 02 State Agent Attention

Let's drop the *cut* as they may say someday, and drop ourselves right to the heart of it: the Ising model is a discrete lattice of particles, each particle has two states (buy or sell), particles only interact with their nearest neighbors, the state space of that system yields surprising results if we have infinitely many particles on our lattice. Combined this model yields tractable insight into technosocial systems. Across scales and fussy physical details, it just works.

Instead of limiting ourselves to the binary, let's instead assume that our trader, our agent, labeled with index *i* has an internal state represented by a vector *x* at time *t*. This vector lives in a *d*-dimensional vector space:

*x*

<sub>i</sub>

<sup>(t)</sup>

∈ ℝ

<sup>d</sup>

What is this vector space? It is defined as the embeddings of all states for all agents, such that the matrix *X* ∈ ℝ<sup>N × d</sup> and is identified as the "hidden state" of all *N* agents.

**TL;DR** Agents have continuous internal states *d*, and if we have *N* agents, the totality of the market is represented by an *N × d* matrix *X*.

<a id="article-sec-path"></a>

## 03 Three-fold Path

In standard spin glass physics — the Ising model — each nearest neighbor interacts with a symmetric coupling (think of it as a scalar weight describing how two neighborly agents *s<sub>i</sub>* and *s<sub>j</sub>* interact, but it doesn't matter the order of the interaction, hence symmetric). The energy of this interaction would be *−s<sub>i</sub> J<sub>ij</sub> s<sub>j</sub>*. Our agents, our states of spin, are given by *d*-dimensional vectors, though the energy is directly analogous:

−*x*

<sub>i</sub>

<sup>T</sup>

*J* *x*

<sub>j</sub>

But we have a problem! Transformers do not let vectors (spins/agents) interact directly. Rather, they project states through three distinct learned weights: *W<sub>Q</sub>*, *W<sub>K</sub>*, *W<sub>V</sub>* ∈ ℝ<sup>d<sub>attn</sub> × d</sup>. These *d<sub>attn</sub> × d* matrices, the Query, Key, and Value, are projections that we will assign to economic terms (for interpretation's sake), alongside their mathematical values:

- **The Query (*q<sub>i</sub> = W<sub>Q</sub> x<sub>i</sub>*):** Agent *i*'s active demand for information or signals (their market lens).
- **The Key (*k<sub>j</sub> = W<sub>K</sub> x<sub>j</sub>*):** Agent *j*'s observable market signal (public supply/posture).
- **The Value (*v<sub>j</sub> = W<sub>V</sub> x<sub>j</sub>*):** Agent *j*'s actual capital intent or underlying action (the payload).

Now, when agent *i* interacts with agent *j*, we find their alignment via the dot product:

*q*

<sub>i</sub>

· *k*

<sub>j</sub>

\= (*W*

<sub>Q</sub>

*x*

<sub>i</sub>

)

<sup>T</sup>

(*W*

<sub>K</sub>

*x*

<sub>j</sub>

) = *x*

<sub>i</sub>

<sup>T</sup>

(*W*

<sub>Q</sub>

<sup>T</sup>

*W*

<sub>K</sub>

) *x*

<sub>j</sub>

This matrix multiplication yields our spin coupling matrix, *J = W<sub>Q</sub><sup>T</sup> W<sub>K</sub>*, and we can label our energy as *E<sub>ij</sub> = −q<sub>i</sub> · k<sub>j</sub>*.

Ok so what? We have some slightly more complex agentic model, we have an asymmetric coupling, we have an equation for an "energy." At this point, nothing seems like transformers except via fiat, via assumption. **And this is where Jaynes enters ([Jaynes, 1957](https://doi.org/10.1103/physrev.106.620)).**

<a id="article-sec-jaynes"></a>

## 04 Enter Jaynes, Suddenly Boltzmann Appears

Let *p<sub>j</sub>* be the probability that Agent *i* pays attention to Agent *j*. By "paid attention" we mean whatever is exchanged via the Q, K, V interactions; all we really care about is that the state of agent *i* changes via interactions with agent *j*, and *j* likewise changes but perhaps not in equal measure. If we find the optimal attention distribution *P* = {*p*<sub>1</sub>, *p*<sub>2</sub>, …, *p*<sub>N</sub>} then we have the probability of how a market change of state occurs.

How do we calculate this? Well, let's just use Jaynes' Principle of Maximum Entropy (MaxEnt). There are many ways to think of MaxEnt. Jaynes might say a bounded agent should assume nothing beyond what is strictly known, and that the agent seeks a distribution that maximizes Shannon Entropy. Another way to think about it, is, I believe more intuitive, namely diffusion is a tendency of systems, unless otherwise constrained, and it is simply a better prior to assume diffusion under constraint, thus MaxEnt. Either way, we have the well-travelled path: **we must maximize Shannon entropy**.

Shannon entropy is given by:

*H* = −∑

<sub>j=1</sub>

<sup>N</sup>

*p<sub>j</sub>* ln *p<sub>j</sub>*

with two constraints:

1. **All probabilities sum to 1:** ∑
   <sub>j=1</sub>
   <sup>N</sup>
   *p<sub>j</sub>* = 1
2. **We know the value for the average energy:** ∑
   <sub>j=1</sub>
   <sup>N</sup>
   *p<sub>j</sub>**E<sub>j</sub>* = ⟨*E*⟩

To maximize Shannon entropy for a probability *p<sub>j</sub>* under the constraints of the system, we simply use Lagrange multipliers:

ℒ = −∑

<sub>j=1</sub>

<sup>N</sup>

*p<sub>j</sub>* ln *p<sub>j</sub>* − *α*(∑

<sub>j=1</sub>

<sup>N</sup>

*p<sub>j</sub>* − 1) − *β*(∑

<sub>j=1</sub>

<sup>N</sup>

*p<sub>j</sub>**E<sub>j</sub>* − ⟨*E*⟩)

We can do the motions here, but the result is the result:

*p*

<sub>ij</sub>

\= exp(*β*(*q*

<sub>i</sub>

· *k*

<sub>j</sub>

)) / ∑

<sub>m=1</sub>

<sup>N</sup>

exp(*β*(*q*

<sub>i</sub>

· *k*

<sub>m</sub>

))

Ok so this is familiar to physicists, some of which might not be in the audience, but this is just softmax!

*p*

<sub>ij</sub>

\= Softmax(*β x<sub>i</sub>*

<sup>T</sup>

(*W*

<sub>Q</sub>

<sup>T</sup>

*W*

<sub>K</sub>

) *x<sub>j</sub>*)

*β* is the Lagrange multiplier representing the agent's computational bound. In statistical mechanics, this is *1/k<sub>B</sub>T*, but as the dimension size of the vectors *d<sub>k</sub>* grows, the dot products grow as well, pushing the Softmax function into flat regions with zero gradients. To prevent this, they added a scaling factor. So we identify this constraint with our Lagrange multiplier and identify *β = 1/√d<sub>k</sub>*.

Once Agent *i* establishes their attention distribution across the market, they update their internal state by taking the expected value of the *actual intent* (*V*) of the agents they are watching:

*x*

<sub>i</sub>

<sup>(t+1)</sup>

\= ∑

<sub>j=1</sub>

<sup>N</sup>

*p<sub>ij</sub>* *v<sub>j</sub>* = *p<sub>i</sub>**V* = Softmax(*q<sub>i</sub>K<sup>T</sup> / √d<sub>k</sub>*) *V*

where *p<sub>i</sub>* = Softmax(*β x<sub>i</sub>*<sup>T</sup>(*W*<sub>Q</sub><sup>T</sup>*W*<sub>K</sub>)*X*<sup>T</sup>).

If we update across *all* states (the market) then this is just attention:

Attention(*Q,K,V*) = Softmax(*QK*

<sup>T</sup>

/ √*d<sub>k</sub>*) *V*

<a id="article-sec-baleq"></a>

## 05 No Equilibrium

In a classical physical spin system (Ising model) and in classical Efficient Market Hypothesis (EMH), systems are assumed to eventually reach Thermodynamic Equilibrium.

For a system to be in true equilibrium, it must satisfy a strict mathematical condition called Detailed Balance. This means that at the microscopic level, the flow of probability from state *i* to state *j* is perfectly balanced by the flow from *j* back to *i*:

P(*i→j*)P(*i*) = P(*j→i*)P(*j*)

We can rotate all this nuance down to a pithy statement: an efficient market is a MaxEnt market. A MaxEnt dataset is one in which we can't tell what the next bit is; it is Brownian motion, it is a random coin flip. It is up or down, buy or sell, randomly, forever. This is precisely why Black-Scholes uses a random walk (Geometric Brownian Motion) to model the price ([Black & Scholes, 1973](https://doi.org/10.1086/260062)).

But Bal's physical translation of the Spin Transformer, the one we illustrated to you in the prior sections, is explicitly asymmetric. *It cannot satisfy Detailed Balance, and thus cannot reach the standard equilibrium.*

In non-equilibrium statistical mechanics, when detailed balance is broken, the system experiences a continuous dissipation of heat as agents update their states against non-reciprocal gradients of their peers (as an aside, this is why cults formed around Dissipative Adaptation are, at least conceptually, incredibly interesting, though like many in this AI space the intellectual lineages they gestured toward were squandered for grift and graft and clout).

**As we are not mere alchemists, we need a way to calculate this dissipation.** Let's start by defining a Markovian random walk on the *attention graph*. Imagine a marginal "packet of influence" traversing the network. If this influence is currently localized at Agent *i*, it transitions to Agent *j* with probability *p<sub>ij</sub>*. The agents themselves form the discrete state space of the system.

Because the attention matrix *p* is row-stochastic (∑<sub>j</sub> *p<sub>ij</sub>* = 1) but strictly non-symmetric and not doubly stochastic, this Markov chain will converge to a unique stationary distribution *π* over the agents, where:

*π*

<sup>T</sup>

*p* = *π*

<sup>T</sup>

As an aside, softmax attention with finite *β* gives *p<sub>ij</sub> > 0* everywhere, which guarantees ergodicity, and thus secures the unique stationary distribution. The vector *π* represents the steady-state systemic influence of each agent.

To calculate this, we look at the attention weights, *p<sub>ij</sub>*, that is how Agent *i* shifts to match Agent *j* through their interaction. The probability flux from agent *i* to agent *j* (*J<sub>ij</sub> = π<sub>i</sub>p<sub>ij</sub>*) is not equal to the reverse flux (*J<sub>ji</sub> = π<sub>j</sub>p<sub>ji</sub>*).

This persistent imbalance means the market acts as a driven non-equilibrium system. We can quantify the resulting "thermodynamic friction" using the **Schnakenberg formula for entropy production rate (*Π*)** in a Markov jump process ([Schnakenberg, 1976](https://doi.org/10.1103/RevModPhys.48.571)):

*Π* = ½ ∑

<sub>i,j</sub>

(*J<sub>ij</sub>* − *J<sub>ji</sub>*) ln(*J<sub>ij</sub>* / *J<sub>ji</sub>*) = ½ ∑

<sub>i,j</sub>

(*π<sub>i</sub>**p<sub>ij</sub>* − *π<sub>j</sub>**p<sub>ji</sub>*) ln(*π<sub>i</sub>**p<sub>ij</sub>* / *π<sub>j</sub>**p<sub>ji</sub>*)

Because *π<sub>i</sub>p<sub>ij</sub> ≠ π<sub>j</sub>p<sub>ji</sub>*, the logarithmic term is non-zero, yielding a strictly positive entropy production rate (*Π > 0*).

Thus, an asymmetric attention market is constantly dissipating thermodynamic heat. It is precisely this persistent, microscopic entropy production—driven by the fact that agents have asymmetric attention—that prevents the market from ever settling into a thermal equilibrium. The system is continuously forced to search for stability, driving the violent reconfigurations of the attention distribution (*P<sub>t</sub>*). Macroscopically, this should be observable as volatility spikes.

<a id="article-sec-network"></a>

## 06 Network Dynamics In Your Lightcone

To understand what happens next, we must let the clock run (ergo add time, ergo we're in the lightcones now). The market does not just update its internal states (*x<sub>i</sub>*); the agents are adaptive. They actively update their Query and Key projections (*W<sub>Q</sub>*, *W<sub>K</sub>*) to minimize their local free energy.

This adaptation creates a dangerous feedback loop fueled by the Entropy Production Rate (*Π*).

### 6.1 Gradient Descent

Agents adjust their projections based on historical success. If Alice loses money to Bob, Alice updates her Query vector to pay *closer* attention to Bob's Key vector in the next time step.

Meanwhile, Bob updates his Key vector to become more deceptive, or updates his Query vector to exploit other inefficiencies, deliberately ignoring Alice.

Mathematically, the agents are performing stochastic gradient descent on their weight matrices. Because the agents have different objective functions and computational bounds, the asymmetry of the coupling matrix *J = W<sub>Q</sub><sup>T</sup> W<sub>K</sub>* **amplifies over time**. For an understanding of how non-symmetric game dynamics amplify over time, see the mechanics of *n*-player differentiable games ([Balduzzi et al., 2018](https://doi.org/10.48550/arxiv.1802.05642)).

### 6.2 The Accumulation of Thermodynamic Friction

As the non-reciprocity amplifies, the system is driven further and further away from detailed balance.

We formally invoke the **adiabatic approximation**, and assume a separation of timescales: the microscopic attention dynamics relax to their non-equilibrium steady state instantaneously relative to the much slower timescale of macro-weight updates via gradient learning. This allows us to compute a well-defined instantaneous entropy production rate *Π<sub>t</sub>* at any given market cross-section via the Schnakenberg formula for the stationary distribution *π*:

*Π*

<sub>t</sub>

\= ½ ∑

<sub>i,j</sub>

(*π<sub>i</sub>**p<sub>ij</sub>* − *π<sub>j</sub>**p<sub>ji</sub>*) ln(*π<sub>i</sub>**p<sub>ij</sub>* / *π<sub>j</sub>**p<sub>ji</sub>*)

As the institutional agents (or predatory algorithms) successfully extract capital, they become systemic attractors. Because the stationary distribution *π* satisfies *π<sup>T</sup>p = π<sup>T</sup>*, as the columns of *p* associated with dominant agents grow larger (representing more agents attending to them), the Perron-Frobenius eigenvector *π* naturally concentrates its mass on those dominant nodes. Simultaneously, the asymmetry between *p<sub>ij</sub>* (Retail watching Institutions) and *p<sub>ji</sub>* (Institutions ignoring Retail) grows extreme.

Therefore, the Entropy Production Rate *Π<sub>t</sub>* climbs steadily. This represents the "thermodynamic friction" of the market: the continuous, violent transfer of wealth and information required to sustain the non-equilibrium steady state.

Claim: *the market cannot sustain infinite entropy production.* As *Π<sub>t</sub>* increases, the system becomes structurally fragile:

1. **Self-organized criticality.** If you continuously drive a system away from equilibrium by injecting a constant flux of either energy or material, the system eventually reaches a state of Self-Organized Criticality ([Bak, Tang, & Wiesenfeld, 1987](https://doi.org/10.1103/PhysRevLett.59.381)). Imagine you are a sandpile. Dropping a single grain of sand at a time, you are never in equilibrium. The pile gets steeper and steeper. The continuous entropy production rate *Π<sub>t</sub>* measures the constant injection of sand, steadily driving the market to a critical slope, where even a tiny perturbation causes the system to avalanche.
2. **Geometric explosion and Phase Transitions** Suppose an asymmetry between Retail agents represented by Alice, and Institutional agents represented by Bob. Alice is bleeding capital to Bob, but Alice isn't an idiot and won't just bleed out. In the terms of an attention agent: gradient descent trains weight matrices to adjust, to change, until Alice's Query matrices better align to the attention of Bob's with winning Key vectors. But look at softmax again with the physics lens:

   *p<sub>ij</sub>* = exp(*β E<sub>ij</sub>*) / ∑
   <sub>k</sub>
   exp(*β E<sub>ik</sub>*)

   An arithmetic increase in alignment between Alice and Bob creates a geometric explosion in probability weight, because of that exponential. As the local field generated by the dominant agents (*q<sub>i</sub> · k<sub>j</sub>*) grows larger relative to the noise, the exponential function in softmax abruptly dominates the denominator. The diverse, high-entropy attention distribution spontaneously collapses.

In either scenario, the attention of the entire network "snaps" onto a single signal or a small cluster of agents, or into a phase change that is tracked (not caused) by *Π<sub>t</sub>*. In statistical mechanics, this is a **Phase Transition** via spontaneous symmetry breaking. In finance, this is a **Herd**.

In this case, the Brownian motion of an efficient market is replaced with strong correlation, making this a strongly justified, though not rigorously demonstrated, claim!

So, we argue: the market cannot sustain infinite entropy production. As *Π<sub>t</sub>* increases, the system becomes structurally fragile, setting the stage for a mechanical crash.

The moment the attention distribution collapses, we can quantify this using a standard economic tool, the systemic Herfindahl-Hirschman Index (HHI), which we calculate for the distribution *π* and see it violently spikes from its diversified baseline (*≈ 1/N*) toward its maximum (*1.0*).

HHI

<sub>t</sub>

\= ∑

<sub>j=1</sub>

<sup>N</sup>

*π<sub>j</sub>*

<sup>2</sup>

→ 1.0

The agents are no longer acting as independent random variables; they are acting as a single monolithic block, perfectly correlated by their collapsed attention.

High-entropy regime

Attention diversified. *HHI ≈ 1/N*. Agents act as independent variables. Shocks absorbed via Brownian diffusion. Near-efficient.

Critical collapse

Attention concentrated. *HHI → 1.0*. Agents perfectly correlated. Every shock amplified by *O(N)* factor. Flash crash.

<a id="article-sec-bbs"></a>

## 07 Non-Equilibrium Attention Markets

Ok, so we have established our justifications for the overall dynamics regarding entropy and attention markets, but markets are about prices. Where are our prices? We will proceed by following the econophysics elephant path. If buy and sell (spin up or spin down) is our model, then the magnetization of the spin glass becomes aggregate excess demand. In physics, we call this the order parameter. Once we have demand, or an order parameter, we then identify the price clearing mechanism with the core assumption that the percentage change in price is strictly proportional to the excess demand:

Δ*S<sub>t</sub>* / *S<sub>t</sub>* = *λ* · *M<sub>t</sub>*

Now the order parameter and the price-clearing mechanism established, and our next step is to determine how the microscopic randomness of the agents scales up to macroscopic market volatility. In statistical mechanics, passing from discrete microscopic jump probabilities to a continuous Stochastic Differential Equation is achieved via the Kramers-Moyal expansion—calculating the first (drift) and second (diffusion) moments of the macroscopic system. Here, however, we will use the tools of econophysics to identify the first and second moments directly.

### 7.1 Magnetization

In a standard Ising model, magnetization is the average of all the discrete spins, representing the net polarity of the system. In our Non-Equilibrium Attention Market framework, the agents possess continuous states. Therefore, the Magnetization (*M<sub>t</sub>*) is the continuous mean field of all agent state vectors:

*M<sub>t</sub>* = (1/N) ∑

<sub>i=1</sub>

<sup>N</sup>

*x<sub>i</sub>*

<sup>(t)</sup>

This vector *M<sub>t</sub>* ∈ ℝ<sup>d</sup> represents the aggregate momentum and risk-posture of the entire market. To apply the standard econophysics machinery, we must translate this high-dimensional latent state into a scalar expectation (the excess demand).

In a standard Large Language Model, this is the exact function of the **Unembedding Matrix**, which projects the final latent vector back into the vocabulary space to generate discrete logits. In our framework, we use an unembedding vector *w* to project the market's latent state into the continuous "vocabulary" of price drift. Thus, our scalar magnetization is *w<sup>T</sup> M<sub>t</sub>*.

<a id="article-sec-drift"></a>

### 7.2 Attention Price Clearing

We now have our order parameter (excess demand). The next step in the econophysics playbook is identifying the price clearing mechanism. Using the standard Kyle (1985) market impact model, the percentage change in price is strictly proportional to the excess demand crossed with a market depth parameter *λ*:

Δ*S<sub>t</sub>* / *S<sub>t</sub>* = *λ* · (*w<sup>T</sup> M<sub>t</sub>*)

This provides the deterministic drift rate (*μ<sub>t</sub>*) of our asset price. Unlike classical finance where drift is a static constant, here it is dynamically driven by the network's structural memory. If the network aligns into a bullish subspace, the drift organically updates to reflect that momentum.

<a id="article-sec-vol"></a>

### 7.3 Concentration

With the drift established, we must determine how the microscopic randomness of the agents scales up to macroscopic market volatility. The aggregate order flow is a weighted sum of the agents' intents, where the weights are the stationary attention probabilities *π<sub>j</sub>*.

To evaluate this rigorously, we expand the explicit variance of this weighted sum into individual variance components and cross-agent covariance terms:

Var(∑

<sub>j=1</sub>

<sup>N</sup>

*π<sub>j</sub> v<sub>j</sub>*) = ∑

<sub>j=1</sub>

<sup>N</sup>

*π<sub>j</sub>*

<sup>2</sup>

Var(*v<sub>j</sub>*) + ∑

<sub>j≠k</sub>

*π<sub>j</sub> π<sub>k</sub>* Cov(*v<sub>j</sub>, v<sub>k</sub>*)

Because market impact is driven by the total extensive order flow (*N* · ∑ *π<sub>j</sub> v<sub>j</sub>*) rather than its sample average, the variance scales extensively with *N*<sup>2</sup>, yielding the *O(N<sup>2</sup> HHI<sub>t</sub>)* structural floor and a diffusion coefficient of *σ<sub>v</sub> N √HHI<sub>t</sub>*.

By evaluating this complete expansion, we can look directly at the exact asymptotic limits of the system to see precisely where the Herfindahl-Hirschman Index (HHI) governs the dynamics:

- **The Independent Phase (High Entropy):** When the market is fragmented, agents act on private, idiosyncratic information. Their strategies are completely uncorrelated, meaning Cov(*v<sub>j</sub>, v<sub>k</sub>*) = 0 for all *j ≠ k*. The covariance block vanishes, leaving the aggregate extensive variance to simplify cleanly to *σ*
  <sup>2</sup>
  *N*
  <sup>2</sup>
  HHI
  <sub>t</sub>
  . If attention is uniform (*π<sub>j</sub> = 1/N*), the HHI is *1/N*, and the total variance becomes *σ*
  <sup>2</sup>
  *N*—the correct physical limit for a cumulative random walk of independent buyers and sellers.
- **The Monopolistic Phase (Localized Concentration):** If a single dominant agent or systemic algorithm captures near-total attention, the distribution approaches *π<sub>1</sub> → 1* and *π<sub>j>1</sub> → 0*. The weight products for the cross-terms drop to zero because the marginal agents carry no weight. Here, the HHI approaches 1.0, and the total variance cleanly matches the HHI baseline again, capping out at *σ*
  <sup>2</sup>
  *N*
  <sup>2</sup>
  due to geometric concentration alone.
- **The Correlated Herd Phase (The Covariance Explosion):** The bound breaks away from the pure HHI line when attention remains distributed across multiple nodes, but those nodes begin actively imitating one another, forcing Cov(*v<sub>j</sub>, v<sub>k</sub>*) → *σ*
  <sup>2</sup>
  . Because the remaining weight products sum to *1 - HHI*, the variance surges to its global extensive ceiling of *σ*
  <sup>2</sup>
  *N*
  <sup>2</sup>
  .

This proves that the *O(N<sup>2</sup> HHI<sub>t</sub>)* scaling coefficient derived from the first term acts as the fundamental **structural floor** of market volatility. The HHI explicitly dictates the minimum level of macroeconomic diffusion guaranteed by the network geometry, while the latent covariance cross-terms dictate the explosive ceiling when herd coordination ignites.

<a id="article-sec-sde"></a>

### 7.4 The NEAM Stochastic Differential Equation

With the drift and the variance floor of the localized attention probabilities established, we can synthesize the complete macroscopic picture. In statistical mechanics, passing from continuous microscopic updates to a macroscopic observable is rigorously formalized via the **Langevin equation**. For a macroscopic state variable *X*, the classical Langevin architecture takes the explicit form:

d*X* = *F*

<sub>sys</sub>

(*X*) dt + *Γ*

<sub>fluc</sub>

d*W<sub>t</sub>*

Where *F*<sub>sys</sub> represents the deterministic, systemic forces acting on the particle, and *Γ*<sub>fluc</sub> represents the coupling to a stochastic thermal bath. To map this architecture to our asset price *S<sub>t</sub>*, we must define how these physical forces translate to extensive market structures.

First, we formalize the systemic force *F*<sub>sys</sub> by transitioning from intensive network coordinates to extensive market volume. We define the extensive **Aggregate Excess Demand Vector** (D<sub>t</sub>) as the total sum of all individual agent action vectors, scaling directly with population size *N* and the mean-field magnetization:

D

<sub>t</sub>

\= ∑

<sub>i=1</sub>

<sup>N</sup>

*x<sub>i</sub>*

<sup>(t)</sup>

\= *N M<sub>t</sub>*

Because market impact is driven by this total extensive order flow crossed with Kyle's depth parameter *λ*, the deterministic systemic force driving price drift is governed precisely by the scalar projection *λ (w<sup>T</sup> D<sub>t</sub>)*.

Second, we define the thermal bath coupling *Γ*<sub>fluc</sub>. The background fluctuations—the residual variance of independent private shocks—are bounded by our extensive variance floor from Section 7.3. This forces the stochastic noise to couple directly to the network geometry, scaling as *σ<sub>v</sub> N √HHI<sub>t</sub>*, where *σ<sub>v</sub>* acts as the ambient market temperature.

By substituting these explicit physical forces directly into the Langevin template, the final Non-Equilibrium Attention Market (NEAM) Stochastic Differential Equation appears:

d*S<sub>t</sub>* = \[ *λ* (*w<sup>T</sup> D<sub>t</sub>*) ] *S<sub>t</sub>* dt + \[ *σ<sub>v</sub> N √HHI<sub>t</sub>* ] *S<sub>t</sub>* d*W<sub>t</sub>*

By expressing the entire system through this explicit Langevin decomposition, the SDE elegantly encapsulates two distinct thermodynamic states:

1. **The High-Entropy Baseline:** When attention is highly diversified, *HHI<sub>t</sub> ≈ 1/N*. The covariance cross-terms within the aggregate demand vector are negligible, and the diffusion coefficient simplifies cleanly to *σ<sub>v</sub> √N*. The price undergoes standard, tranquil Brownian motion—the physical equivalent of a heavy particle buffeted by a stable, uncoordinated fluid.
2. **The Critical Phase Transition:** As thermodynamic friction forces the attention network to collapse, the *HHI<sub>t</sub>* spikes toward 1.0. Simultaneously, endogenous imitation causes agent correlations to ignite, meaning the true macroscopic variance breaks past the *O(N<sup>2</sup> HHI<sub>t</sub>)* floor and explodes toward its global extensive ceiling of *O(N<sup>2</sup>)*, causing the diffusion coefficient to scale linearly with *N*.

At this critical juncture, the market is structurally compromised. The next exogenous macroeconomic shock (d*W<sub>t</sub>*)—even if minor—is multiplied by a massive, highly correlated *O(N)* network factor. The market maker's liquidity is instantly overwhelmed, and the scalar price *S<sub>t</sub>* gaps violently downward to clear the one-sided demand.

It is worth noting an internal consistency choice regarding the explicit population parameter *N* in our diffusion coefficient. While we explicitly preserve *N* to ground the SDE in the extensive volume of the total aggregate demand vector *D<sub>t</sub>*, this normalization remains a modeling specification; in a strictly intensive asset pricing framework, *N* can be entirely absorbed into the baseline noise parameter *σ<sub>v</sub>*. Ultimately, the system's absolute population scale is secondary to the geometric scaling of the *HHI<sub>t</sub>*, which serves as the true structural governor of the non-equilibrium volatility dynamics.

<a id="article-sec-tails"></a>

## 08 Endogenous Fat Tails for Sale, Never Used

In traditional quantitative finance, fat tails (leptokurtosis) and volatility clustering are treated as exogenous mysteries that are patched manually. In the NEAM SDE framework, heavy tails observed in empirical asset returns are the direct macroscopic artifacts of bounded agents constantly shifting their attention structure.

The mathematical engine for this phenomenon lives directly within the phase boundaries derived in Section 7.3. Real market dynamics are defined by a meta-deliberation process: the system moves through intermittent periods of calm where agent updates are largely uncoordinated (The Independent Phase), anchoring the price to its minimum *O(N √HHI<sub>t</sub>)* volatility floor. However, because gradient updates on the query-key weights (*W<sub>Q</sub>, W<sub>K</sub>*) operate on a slower, continuous timescale, the attention matrix slowly drifts toward alignment.

When the network crosses the critical threshold into the Correlated Herd Phase, the variance breaks free from its structural floor and surges toward the *O(N)* global covariance ceiling. Because the system lingers in these non-equilibrium steady states before thermodynamic friction forces a clearing collapse, volatility naturally clusters in time.

The switching dynamics between these two geometric phases transform what would be a standard Gaussian random walk into a heavy-tailed distribution. Black Swan events, extreme pricing events that classical finance deems 1-in-a-billion-year anomalies, are direct consequences of network learning and non-equilibrium attention market dynamics.

<a id="article-sec-concl"></a>

## 09 Conclusion and Summary

**Non-Reciprocity** generates a strictly positive **Entropy Production Rate (*Π<sub>t</sub>*)**. Agents adapting to this non-equilibrium environment causes the **stationary distribution (*π*) to concentrate**. The concentrated signals trigger a **Phase Transition** in the bounded MaxEnt Softmax algorithm, causing **Attention Collapse**. The HHI spike multiplies the covariance of the aggregate order flow, exploding the diffusion term in the **NEAM SDE**, resulting in a **Flash Crash**.

And thus, to answer our questions that started this endeavor:

1. What happens if we make the fundamental states of the Ising model continuous?

   *By applying Jaynes' Principle of Maximum Entropy to continuous spin states, the canonical Boltzmann distribution naturally emerges as the standard Softmax attention mechanism.*

2. What happens if these interactions are not symmetric?

   *The system breaks detailed balance and enters a non-equilibrium steady state. The resulting non-reciprocal updates generate a strictly positive entropy production rate (Π), driving the network toward structural fragility and spontaneous attention collapse.*

3. What are the consequences if we use the tools of econophysics and apply it to Bal's spin transformers?

   **We directly find the drift (via continuous magnetization and an unembedding vector) and the diffusion (via the Herfindahl-Hirschman Index), deriving a testable Non-Equilibrium Attention Market (NEAM) SDE.**

<a id="article-sec-refs"></a>

## 10 References

### Foundational Texts

*Note: The following foundational texts were published independently on Mathias Bal's academic blog and form the basis of the spin transformer explorations recreated in this work.*

- Bal, M. C. (2021). *Transformers Are Secretly Collectives of Spin Systems*. [mcbal.github.io](https://mcbal.github.io/post/transformers-are-secretly-collectives-of-spin-systems/)
- Bal, M. C. (2021). *Transformers from Spin Models: Approximate Free Energy Minimization*. [mcbal.github.io](https://mcbal.github.io/post/transformers-from-spin-models-approximate-free-energy-minimization/)
- Bal, M. C. (2023). *Spin-Model Transformers*. [mcbal.github.io](https://mcbal.github.io/post/spin-model-transformers/)
- Bal, M. C. (2026). *Entropy Production in Non-Equilibrium Neural Networks*. [mcbal.github.io](https://mcbal.github.io/post/entropy-production-in-non-equilibrium-neural-networks/)

### Academic References

- Bak, P., Tang, C., & Wiesenfeld, K. (1987). Self-organized criticality: An explanation of the 1/f noise. *Physical Review Letters*, 59(4), 381–384. [doi](https://doi.org/10.1103/PhysRevLett.59.381)
- Balduzzi, D., Racaniere, S., Martens, J., Foerster, J., Tuyls, K., & Graepel, T. (2018). The Mechanics of n-Player Differentiable Games. *PMLR*, 80. [doi](https://doi.org/10.48550/arxiv.1802.05642)
- Black, F., & Scholes, M. (1973). The Pricing of Options and Corporate Liabilities. *Journal of Political Economy*, 81(3), 637–654. [doi](https://doi.org/10.1086/260062)
- Bornholdt, S. (2001). Expectation bubbles in a spin model of markets: Intermittency from frustration across scales. *Int. J. Mod. Phys. C*, 12(5), 667–674. [doi](https://doi.org/10.1142/S0129183101001845)
- Bouchaud, J.-P., Mezard, M., & Potters, M. (2002). Statistical properties of stock order books: Empirical results and models. *Quantitative Finance*, 2(4), 251–256. [doi](https://doi.org/10.1088/1469-7688/2/4/302)
- Brock, W. A., & Durlauf, S. N. (2001). Discrete Choice with Social Interactions. *The Review of Economic Studies*, 68(2), 235–260. [doi](https://doi.org/10.1111/1467-937x.00168)
- Cont, R., & Bouchaud, J.-P. (1998). Herd Behavior and Aggregate Fluctuations in Financial Markets. *SSRN Electronic Journal*. [doi](https://doi.org/10.2139/ssrn.58468)
- Galam, S. (2008). Sociophysics: A Review of Galam Models. *International Journal of Modern Physics C*, 19(3), 409–440. [doi](https://doi.org/10.1142/s0129183108012297)
- Gardiner, C. W. (1985). *Handbook of Stochastic Methods for Physics, Chemistry and the Natural Sciences*. Springer-Verlag. [doi](https://doi.org/10.1007/978-3-662-02452-2)
- Jaynes, E. T. (1957). Information Theory and Statistical Mechanics. *Physical Review*, 106(4), 620–630. [doi](https://doi.org/10.1103/physrev.106.620)
- Kyle, A. S. (1985). Continuous Auctions and Insider Trading. *Econometrica*, 53(6), 1315. [doi](https://doi.org/10.2307/1913210)
- Risken, H. (1989). *The Fokker-Planck Equation: Methods of Solution and Applications*. Springer-Verlag. [doi](https://doi.org/10.1007/978-3-642-61544-3)
- Schnakenberg, J. (1976). Network theory of microscopic and macroscopic behavior of master equation systems. *Reviews of Modern Physics*, 48(4), 571–585. [doi](https://doi.org/10.1103/RevModPhys.48.571)
- Shannon, C. E. (1948). A Mathematical Theory of Communication. *Bell System Technical Journal*, 27(3), 379–423. [doi](https://doi.org/10.1002/j.1538-7305.1948.tb01338.x)
- Sornette, D. (2014). Physics and Financial Economics (1776-2014): Puzzles, Ising and Agent-Based models. *Rep. Prog. Phys.*, 77(6), 062001. [doi](https://doi.org/10.1088/0034-4885/77/6/062001)
- Vaswani, A., Shazeer, N., Parmar, N., Uszkoreit, J., Jones, L., Gomez, A. N., Kaiser, Ł., & Polosukhin, I. (2017). Attention is All You Need. *Advances in Neural Information Processing Systems*, 30. [arxiv](https://arxiv.org/abs/1706.03762)
- Zaklan, G., Westerhoff, F., & Stauffer, D. (2009). Analysing tax evasion dynamics via the Ising model. *Journal of Economic Interaction and Coordination*, 4(1), 1–14. [doi](https://doi.org/10.1007/s11403-008-0043-5)
