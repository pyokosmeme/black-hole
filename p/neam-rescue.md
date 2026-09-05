---
title: "NON-EQUILIBRIUM ATTENTION MARKETS II: THE RESCUE THEOREM"
date: 2026.06.17
tags: econophysics, spin-transformers, neam
canonical: https://lastnpcalex.agency/p/neam-rescue
---

# Non-Equilibrium Attention Markets II: The Rescue Theorem

<a id="article-sec-intro"></a>

## 01 Introduction

In the prior post on Non-Equilibrium Attention Markets, we did a few things:

- Starting with an asymmetric, *d*-dimensional, classical Ising model, SoftMax could be derived, with some dictionary help:

<a id="article-eq-spin-transformer-j"></a>

\[
J(x)=\operatorname{softmax}\!\left(\frac{xW_QW_K^Tx^T}{\sqrt D}\right).
\]

(1)

Note: in Part 1 we mostly looked at the pre-softmax bilinear score generator. From here onward, the \(J_{ij}\) appearing in the kinetic Ising mean-field equations is the spin-transformer coupling \(J(x)\) above, following Bal's notation ([Bal, 2023](#article-ref-bal-spin-model)).

- An argument was made about entropy and the states of non-equilibrium attention markets.
- A sketch was made of the potential consequences.

However, an astute reader may have noticed that detailed balance was incorrectly used to justify a correct statement about entropy production, but the entropy production was also just a Markov-chain model. None of that is particularly econophysics flavored.

Fortunately, Matthias Bal has paved the way for a correction, and the consequences yield tractable insights, or at the very least, a legible map for how to explore the implications. This post will develop the so-called **Rescue Theorem** to rescue the NEAM framework, and will sketch out what we will call the **parasocial collapse** model.

<a id="article-sec-flesh-wound"></a>

## 02 Tis Only a Flesh Wound

Let us more clearly articulate what we should have said about detailed balance in the first post, with an example from physics.

Imagine a system with \(n\) atoms. Each atom has two energy states, 1 or 2, and thus some number of atoms, \(n_1\), are in state 1, and some number, \(n_2\), are in state 2. The proportional rate that \(n_1\) goes to \(n_2\) is \(k_{12}\), and the proportional rate that \(n_2\) becomes \(n_1\) is \(k_{21}\). At any time, the rate of change of \(n_1\) is

<a id="article-eq-two-state-rate"></a>

\[
\frac{dn_1}{dt}=-k_{12}n_1+k_{21}n_2.
\]

(2)

The second term is positive because it represents the proportional speed with which \(n_2\) becomes \(n_1\), and the first term is negative because it represents the opposite quantity. Thermal equilibrium occurs when \(dn_1/dt=0\), thus

<a id="article-eq-two-state-balance"></a>

\[
k_{12}n_1=k_{21}n_2.
\]

(3)

This is detailed balance. But look at the rates and the numbers: it is just their proportion that is constant. The rates do not have to be symmetric.

And that is where the last post made an error:

<a id="article-eq-db-markov"></a>

\[
\pi_i p_{ij}=\pi_j p_{ji}
\]

(4)

does not require \(p_{ij}=p_{ji}\). It can satisfy detailed balance and yield zero entropy production in the Schnakenberg expression ([Schnakenberg, 1976](#article-ref-schnakenberg-1976)).

But we were correct to state that asymmetry of a sort violates detailed balance and produces net entropy. The relevant asymmetry is not merely that a forward transition probability differs from a backward transition probability. It is the system's walk across many states, back to some original state, such that \(A\to B\to C\to A\) forms a loop with a nonzero circulation. It is an asymmetry in flux that violates detailed balance. The flow out of \(A\) and the flow back into \(A\) are not the same.

This confusion in the original occurred, in part, because \(J_{ij}\) in the Schnakenberg formula is a flux, not the coupling constant. And so, we see we are in need of rescue: if the entropy production rate were zero whenever the flux is symmetric, then the rest of the explorations in the first NEAM post would be moot.

A few critical notes summarizing the prior work of Matthias Bal:

- We can use mean-field theory to approximate the probability of each state of the spin transformer.
- We can introduce an ansatz to approximate the true probability.
- We can use the Plefka expansion to get relatively simple closed-form approximations to properties of the mean-field theory ([Aguilera, Moosavi, & Shimazaki, 2020](#article-ref-aguilera-2020); [Bal, 2026](#article-ref-bal-entropy-2026)).

We will not run through the full derivation, in part because it gets thorny with Bessel functions, but mostly because we would rather come at this from the perspective of: we have a reasonable mean-field description of an asymmetric vector spin transformer, so what next?

What comes next is that we can write, if not explicitly calculate, the magnetization, and we can write the estimated probabilities describing transitions between snapshots of the whole system. At this point, you may wonder why. Well. The goal is this: econophysics provides a useful map from Ising-like systems to real markets. That is, we do not need to reinvent the wheel here, and can instead use existing econophysics models, with real though possibly modest or contested empirical success, to jump from magnetization, entropy production, susceptibility, and so forth, back into the non-equilibrium attention market frame.

The NEAM, then, is a bootstrap program. From spin transformer, to applied modeling, with One Weird Trick. Anyway...onward. The immediate problem is that our discussion of both detailed balance and entropy production was sorely wanting. Let us patch it up and develop the Rescue Theorem.

<a id="article-sec-rescue"></a>

## 03 Rescue Me

Imagine you are a physicist. Detailed balance requires a potential function: a conservative force, a round trip that causes no net change, and a gradient of a scalar function. We can have an asymmetry in the number of states on top of the hill and the number of states in the valley, but any object going from the valley to the hill and back to the valley cannot have a difference. This is the criterion we care about for our spin transformers: if there is a potential function, then they can reach equilibrium. If there is not, they stay out of equilibrium. Crude, but clear.

We need to shift our mental model a little. Instead of looking at the individual hidden states \(x_i\), we will do as Bal does, with the state \(s\), which is a snapshot of every spin vector in the system:

<a id="article-eq-state-snapshot"></a>

\[
s=(x_1,x_2,\ldots,x_N).
\]

(5)

What we investigate is the Markov chain as this state \(s\) transitions from \(t\) to \(t'\). Since we are in the context of mean-field theory, this transition probability has a Boltzmann-shaped kernel:

<a id="article-eq-transition-kernel"></a>

\[
T(s'\mid s)=\prod_i\frac{\exp\!\left[\beta\,s_i'\cdot h_i(s)\right]}{Z_i(s)},
\qquad
h_i(s)=x_i+\sum_jJ_{ij}s_j.
\]

(6)

Here \(T\) is the transition probability from \(s\) to \(s'\). If we reverse the order, that is the transition from \(s'\) to \(s\). The field \(h_i\) describes the interactions between the system at \(s'\) and the system at \(s\); the construction is derived explicitly by Bal and will not be recreated here ([Bal, 2026](#article-ref-bal-entropy-2026)).

For a conservative force, the log-ratio of the two transition probabilities should yield gradient terms. Let us check by taking the logarithm of the ratio:

<a id="article-eq-log-ratio"></a>

\[
\log\frac{T(s'\mid s)}{T(s\mid s')}
=
\beta\,x\cdot(s'-s)
+
\sum_i\log Z_i(s')-
\sum_i\log Z_i(s)
+
\beta\sum_{ij}\left(s_i'J_{ij}s_j-s_iJ_{ij}s_j'\right).
\]

(7)

The first two terms are gradient-like. The first is proportional to \(\Delta s\). The second is less obvious, but it is still a difference of normalization terms. At this stage, we could still write a potential for the system and thus retain detailed balance. As a reminder: in the last post, we said detailed balance is violated, so we have not rescued anything yet.

Let us take a look at the third term. Relabeling dummy indices \(i\leftrightarrow j\), we get

<a id="article-eq-skew-term"></a>

\[
\sum_{ij}\left(s_i'J_{ij}s_j-s_jJ_{ji}s_i'\right)
=
\sum_{ij}(J_{ij}-J_{ji})s_i's_j
=
s'^T(J-J^T)s.
\]

(8)

Note: to check, recall that \(s'\) and \(s\) are state-snapshot vectors, and \(J_{ij}\) is the coupling matrix we get from softmax attention.

This is a skew bilinear term, which is not a term we instinctively recalled from linear algebra but had some external advice about. To check whether it can be a gradient contribution, we use the curl test. We are not in the familiar three dimensions, so we take a mixed second derivative with respect to our states \(s_i'\) and \(s_j\):

<a id="article-eq-curl-test-zero"></a>

\[
\frac{\partial^2}{\partial s_i'\partial s_j}\left[g(s')-g(s)\right]=0
\]

(9)

for any scalar potential difference. But for the skew bilinear term,

<a id="article-eq-curl-test-j"></a>

\[
\frac{\partial^2}{\partial s_i'\partial s_j}
\left[s'^T(J-J^T)s\right]
=
J-J^T.
\]

(10)

And \(J\), as you may recall, is

<a id="article-eq-j-recall"></a>

\[
J(x)=\operatorname{softmax}\!\left(\frac{xW_QW_K^Tx^T}{\sqrt D}\right),
\]

(11)

which is asymmetric, so this term, across the full space of the vectors \(x\), generally does not vanish. We fail the curl test. Detailed balance requires \(J=J^T\) exactly, which is false for the spin transformer and false for ordinary transformer attention as well. An interesting aside, pointed out to us rather than known off-hand, is that we get the Peretto-Little measure for parallel updates out of this work for free if we just look at the terms that do not depend on \(J\) in our transition probabilities:

<a id="article-eq-peretto-little"></a>

\[
P_{\rm eq}(s)\propto
\exp\!\left[\beta\,x\cdot s+\sum_i\log Z_i(s)\right].
\]

(12)

We are, therefore, rescued: detailed balance is, indeed, violated, but now we can prove it.

<a id="article-sec-entropy"></a>

## 04 A Mean Entropy

Detailed balance cannot hold, and thus one of the two problems with the first NEAM post is fixed. What about entropy, however?

A Markov-chain walk is fine and all, but if we bite the bullet and learn to love mean-field theory tooling, then we get an alternative measure of entropy production:

<a id="article-eq-entropy-production"></a>

\[
\sigma_t=\sum_{ij}(J_{ij}-J_{ji})D_{ij,t}.
\]

(13)

Here \(D_{ij,t}\) is the time-delayed correlation: the two-point correlation between states at adjacent times, after subtracting the magnetization contribution ([Aguilera, Moosavi, & Shimazaki, 2020](#article-ref-aguilera-2020); [Bal, 2026](#article-ref-bal-entropy-2026)):

<a id="article-eq-delayed-correlation"></a>

\[
D_{ij,t}
=
\int ds_t\int ds_{t-1}\,
\bigl(s_{i,t}-m_{i,t}\bigr)\cdot
\bigl(s_{j,t-1}-m_{j,t-1}\bigr)
P(s_t,s_{t-1}).
\]

(14)

The magnetization is

<a id="article-eq-magnetization"></a>

\[
m_{i,t}
=
\frac{\beta\left(x_{i,t}+\sum_jJ_{ij}m_{j,t-1}\right)}
{1+\sqrt{1+\beta^2\left\|x_{i,t}+\sum_jJ_{ij}m_{j,t-1}\right\|^2/R^2}},
\qquad
R=\sqrt{D/2-1}.
\]

(15)

Here \(P(s_t,s_{t-1})\) is the probability for the state at \(t-1\) to evolve in one time-step to the state at \(t\). Spiritually, it looks like the Schnakenberg formula if we squint a lot: entropy production is still tracking irreversible circulation, but now through the mean-field structure of the spin-transformer dynamics.

Using the ansatz and the Plefka expansion, Bal gives the full closed-form expression for \(D_{ij,t}\). The full expression is not especially illuminating for our purposes here, so we keep the useful approximation: when the local-field norm is \(O(R)\), the time-delayed correlation becomes

<a id="article-eq-d-approx"></a>

\[
D_{ij,t}\approx J_{ij}\cos^2\alpha_{(i,t),(j,t-1)},
\]

(16)

where \(\alpha_{(i,t),(j,t-1)}\) is the angle between the magnetization vectors for \(i\) at time \(t\) and \(j\) at time \(t-1\).

Thus entropy production becomes

<a id="article-eq-sigma-approx"></a>

\[
\sigma_t
\sim
\sum_{ij}\left(J_{ij}^2-J_{ij}J_{ji}\right)
\cos^2\alpha_{(i,t),(j,t-1)}.
\]

(17)

We already Rescued the detailed balance claim from earlier work, and now you may notice the entropy production rate in the equation immediately above has a \(J-J^T\) term, which is non-zero by asymmetry of \(J\), thus entropy production is non-zero...as long as \(\cos^2\alpha_{(i,t),(j,t-1)}\) does not identically vanish for all \(i\) and \(j\) across the time-step from \(t-1\) to \(t\).

<a id="article-sec-parasocial"></a>

## 05 Parasocial Collapse: Example Sketch

Our key insight: detailed balance is, indeed, violated for the spin transformer as contended in the original NEAM post, and the entropy production rate in such a system is generically non-zero for asymmetric couplings with non-orthogonal delayed alignment of the state vectors.

Now, let us work an example and illustrate the utility of the NEAM framework, now that it is thoroughly rescued.

Let us simplify our world into two states, essentially:

- State 1: the celebrity.
- State 2: everyone else.
- We ignore all other interactions, because everyone else is an NPC. This is a jokey way of saying we ignore
  \(J_{ij}\)
  between the masses.

The celebrity causes updates to everyone else, but it is maximally asymmetric. State 1 impacts state 2; state 1 does not care what state 2 does. Ever.

In math, using the notation to track how the impacted state is affected by the impactor state, we have

<a id="article-eq-parasocial-j"></a>

\[
J_{21}=c,
\qquad
J_{12}=0,
\qquad
c>0.
\]

(18)

If we plug this into the Plefka mean-field approximation for \(D_{ij,t}\), we see

<a id="article-eq-parasocial-d"></a>

\[
D_{12}=0,
\qquad
D_{21}\propto c\cos^2\alpha_{(2,t),(1,t-1)}.
\]

(19)

The entropy production immediately becomes

<a id="article-eq-parasocial-sigma"></a>

\[
\sigma_t
=
(J_{12}-J_{21})D_{12}
+
(J_{21}-J_{12})D_{21}
\approx
c^2\cos^2\alpha_{(2,t),(1,t-1)}.
\]

(20)

This is a dissipative system, as it continuously produces entropy. The key takeaway is that entropy production is a property of state space and dynamics, not of the attention matrix itself.

<a id="article-sec-next"></a>

## 06 What Next?

We have made a much more rigorous argument about detailed balance, replaced key machinery with mean-field theory, and illustrated an example where the entropy production is strictly greater than zero. The NEAM is thus rescued. We are on much more solid ground, our thoughts more organized, the path forward clearer.

But what does this mean? Why does this matter?

The trajectory so far has been:

- See how SoftMax is secretly a collection of vector spins.
- Use mean-field theory to describe state space and dynamics.
- From state space and dynamics, see the structure of dissipation and entropy production.
- Create the bones of an example we can use to further explore the problem space.

It is not nothing. Though, essentially, we are still at the beginning of exploration. Many of the consequences, and the "and therefore," have been left as idle implications, gaps in the text, liminal space for the exercise of the readers. None of that is satisfactory. Yet, it was all necessary. We have a solid, defensible, well-considered scaffolding, and we can now begin proper exploration, simulation, and demonstration...in a future post.

<a id="article-sec-refs"></a>

## 07 References

### Foundational Texts

- <a id="article-ref-bal-spin-systems"></a>
  Bal, M. C. (2021). *Transformers Are Secretly Collectives of Spin Systems*. [mcbal.github.io](https://mcbal.github.io/post/transformers-are-secretly-collectives-of-spin-systems/)
- <a id="article-ref-bal-free-energy"></a>
  Bal, M. C. (2021). *Transformers from Spin Models: Approximate Free Energy Minimization*. [mcbal.github.io](https://mcbal.github.io/post/transformers-from-spin-models-approximate-free-energy-minimization/)
- <a id="article-ref-bal-spin-model"></a>
  Bal, M. C. (2023). *Spin-Model Transformers*. [mcbal.github.io](https://mcbal.github.io/post/spin-model-transformers/)
- <a id="article-ref-bal-entropy-2026"></a>
  Bal, M. C. (2026). *Entropy Production in Non-Equilibrium Neural Networks*. [mcbal.github.io](https://mcbal.github.io/post/entropy-production-in-non-equilibrium-neural-networks/)

### Academic References

- <a id="article-ref-aguilera-2020"></a>
  Aguilera, M., Moosavi, S. A., & Shimazaki, H. (2020). *A unifying framework for mean-field theories of asymmetric kinetic Ising systems*. arXiv:2002.04309. [arxiv](https://arxiv.org/abs/2002.04309)
- <a id="article-ref-schnakenberg-1976"></a>
  Schnakenberg, J. (1976). Network theory of microscopic and macroscopic behavior of master equation systems. *Reviews of Modern Physics*, 48(4), 571–585. [doi](https://doi.org/10.1103/RevModPhys.48.571)
- <a id="article-ref-cocconi-2020"></a>
  Cocconi, L., Garcia-Millan, R., Zhen, Z., Buturca, B., & Pruessner, G. (2020). *Entropy production in exactly solvable systems*. arXiv:2010.04231. [arxiv](https://arxiv.org/abs/2010.04231)
