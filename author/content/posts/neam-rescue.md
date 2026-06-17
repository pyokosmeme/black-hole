<div class="nrol-doc neam-rescue">

<style>
/* NEAM II · scoped equation styling */
.nrol-doc .eq-block {
  text-align: center;
  margin: 18px 0;
  padding: 12px 0;
  font-size: 14px;
  color: var(--cyan);
  letter-spacing: 0.04em;
  overflow-x: auto;
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
.nrol-doc .note-block {
  border-left: 3px solid var(--purple);
  padding-left: 16px;
  margin: 22px 0;
  color: rgba(255,255,255,0.72);
}
body.light-mode .nrol-doc .note-block,
body.light-reading .nrol-doc .note-block {
  color: rgba(0,0,0,0.72);
}
.nrol-doc .refs li { margin-bottom: 10px; }
</style>

<h1>Non-Equilibrium Attention Markets II: The Rescue Theorem</h1>

<h2 id="sec-intro"><span class="num">01</span> Introduction</h2>

<p>
In the prior post on Non-Equilibrium Attention Markets, we did a few things:
</p>

<ul>
  <li>Starting with an asymmetric, <em>d</em>-dimensional, classical Ising model, SoftMax could be derived, with some dictionary help:</li>
</ul>

<div class="eq-block" id="eq-spin-transformer-j">
\[
J(x)=\operatorname{softmax}\!\left(\frac{xW_QW_K^Tx^T}{\sqrt D}\right).
\]
<span class="eq-label">(1)</span>
</div>

<div class="note-block">
<p>
Note: in Part 1 we mostly looked at the pre-softmax bilinear score generator. From here onward, the \(J_{ij}\) appearing in the kinetic Ising mean-field equations is the spin-transformer coupling \(J(x)\) above, following Bal's notation (<a href="#ref-bal-spin-model">Bal, 2023</a>).
</p>
</div>

<ul>
  <li>An argument was made about entropy and the states of non-equilibrium attention markets.</li>
  <li>A sketch was made of the potential consequences.</li>
</ul>

<p>
However, an astute reader may have noticed that detailed balance was incorrectly used to justify a correct statement about entropy production, but the entropy production was also just a Markov-chain model. None of that is particularly econophysics flavored.
</p>

<p>
Fortunately, Matthias Bal has paved the way for a correction, and the consequences yield tractable insights, or at the very least, a legible map for how to explore the implications. This post will develop the so-called <strong>Rescue Theorem</strong> to rescue the NEAM framework, and will sketch out what we will call the <strong>parasocial collapse</strong> model.
</p>

<h2 id="sec-flesh-wound"><span class="num">02</span> Tis Only a Flesh Wound</h2>

<p>
Let us more clearly articulate what we should have said about detailed balance in the first post, with an example from physics.
</p>

<p>
Imagine a system with \(n\) atoms. Each atom has two energy states, 1 or 2, and thus some number of atoms, \(n_1\), are in state 1, and some number, \(n_2\), are in state 2. The proportional rate that \(n_1\) goes to \(n_2\) is \(k_{12}\), and the proportional rate that \(n_2\) becomes \(n_1\) is \(k_{21}\). At any time, the rate of change of \(n_1\) is
</p>

<div class="eq-block" id="eq-two-state-rate">
\[
\frac{dn_1}{dt}=-k_{12}n_1+k_{21}n_2.
\]
<span class="eq-label">(2)</span>
</div>

<p>
The second term is positive because it represents the proportional speed with which \(n_2\) becomes \(n_1\), and the first term is negative because it represents the opposite quantity. Thermal equilibrium occurs when \(dn_1/dt=0\), thus
</p>

<div class="eq-block" id="eq-two-state-balance">
\[
k_{12}n_1=k_{21}n_2.
\]
<span class="eq-label">(3)</span>
</div>

<p>
This is detailed balance. But look at the rates and the numbers: it is just their proportion that is constant. The rates do not have to be symmetric.
</p>

<p>
And that is where the last post made an error:
</p>

<div class="eq-block" id="eq-db-markov">
\[
\pi_i p_{ij}=\pi_j p_{ji}
\]
<span class="eq-label">(4)</span>
</div>

<p>
does not require \(p_{ij}=p_{ji}\). It can satisfy detailed balance and yet produce zero entropy production in the Schnakenberg expression (<a href="#ref-schnakenberg-1976">Schnakenberg, 1976</a>).
</p>

<p>
But we were correct to state that asymmetry of a sort violates detailed balance and produces net entropy. The relevant asymmetry is not merely that a forward transition probability differs from a backward transition probability. It is the system's walk across many states, back to some original state, such that \(A\to B\to C\to A\) forms a loop with a nonzero circulation. It is an asymmetry in flux that violates detailed balance. The flow out of \(A\) and the flow back into \(A\) are not the same.
</p>

<p>
This confusion in the original occurred, in part, because \(J_{ij}\) in the Schnakenberg formula is a flux, not the coupling constant. And so, we see we are in need of rescue: if the entropy production rate were zero whenever the flux is symmetric, then the rest of the explorations in the first NEAM post would be moot.
</p>

<p>
A few critical notes summarizing the prior work of Matthias Bal:
</p>

<ul>
  <li>We can use mean-field theory to approximate the probability of each state of the spin transformer.</li>
  <li>We can introduce an ansatz to approximate the true probability.</li>
  <li>We can use the Plefka expansion to get relatively simple closed-form approximations to properties of the mean-field theory (<a href="#ref-aguilera-2020">Aguilera, Moosavi, &amp; Shimazaki, 2020</a>; <a href="#ref-bal-entropy-2026">Bal, 2026</a>).</li>
</ul>

<p>
We will not run through the full derivation, in part because it gets thorny with Bessel functions, but mostly because we would rather come at this from the perspective of: we have a reasonable mean-field description of an asymmetric vector spin transformer, so what next?
</p>

<p>
What comes next is that we can write, if not explicitly calculate, the magnetization, and we can write the estimated probabilities describing transitions between snapshots of the whole system. At this point, you may wonder why. Well. The goal is this: econophysics provides a useful map from Ising-like systems to real markets. That is, we do not need to reinvent the wheel here, and can instead use existing econophysics models, with real though possibly modest or contested empirical success, to jump from magnetization, entropy production, susceptibility, and so forth, back into the non-equilibrium attention market frame.
</p>

<p>
The NEAM, then, is a bootstrap program. From spin transformer, to applied modeling, with One Weird Trick. Anyway...onward. The immediate problem is that our discussion of both detailed balance and entropy production was sorely wanting. Let us patch it up and develop the Rescue Theorem.
</p>

<h2 id="sec-rescue"><span class="num">03</span> Rescue Me</h2>

<p>
Imagine you are a physicist. Detailed balance requires a potential function: a conservative force, a round trip that causes no net change, and a gradient of a scalar function. We can have an asymmetry in the number of states on top of the hill and the number of states in the valley, but any object going from the valley to the hill and back to the valley cannot have a difference. This is the criterion we care about for our spin transformers: if there is a potential function, then they can reach equilibrium. If there is not, they stay out of equilibrium. Crude, but clear.
</p>

<p>
We need to shift our mental model a little. Instead of looking at the individual hidden states \(x_i\), we will do as Bal does, with the state \(s\), which is a snapshot of every spin vector in the system:
</p>

<div class="eq-block" id="eq-state-snapshot">
\[
s=(x_1,x_2,\ldots,x_N).
\]
<span class="eq-label">(5)</span>
</div>

<p>
What we investigate is the Markov chain as this state \(s\) transitions from \(t\) to \(t'\). Since we are in the context of mean-field theory, this transition probability has a Boltzmann-shaped kernel:
</p>

<div class="eq-block" id="eq-transition-kernel">
\[
T(s'\mid s)=\prod_i\frac{\exp\!\left[\beta\,s_i'\cdot h_i(s)\right]}{Z_i(s)},
\qquad
h_i(s)=x_i+\sum_jJ_{ij}s_j.
\]
<span class="eq-label">(6)</span>
</div>

<p>
Here \(T\) is the transition probability from \(s\) to \(s'\). If we reverse the order, that is the transition from \(s'\) to \(s\). The field \(h_i\) describes the interactions between the system at \(s'\) and the system at \(s\); the construction is derived explicitly by Bal and will not be recreated here (<a href="#ref-bal-entropy-2026">Bal, 2026</a>).
</p>

<p>
For a conservative force, the log-ratio of the two transition probabilities should yield gradient terms. Let us check by taking the logarithm of the ratio:
</p>

<div class="eq-block" id="eq-log-ratio">
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
<span class="eq-label">(7)</span>
</div>

<p>
The first two terms are gradient-like. The first is proportional to \(\Delta s\). The second is less obvious, but it is still a difference of normalization terms. At this stage, we could still write a potential for the system and thus retain detailed balance. As a reminder: in the last post, we said detailed balance is violated, so we have not rescued anything yet.
</p>

<p>
Let us take a look at the third term. Relabeling dummy indices \(i\leftrightarrow j\), we get
</p>

<div class="eq-block" id="eq-skew-term">
\[
\sum_{ij}\left(s_i'J_{ij}s_j-s_jJ_{ji}s_i'\right)
=
\sum_{ij}(J_{ij}-J_{ji})s_i's_j
=
s'^T(J-J^T)s.
\]
<span class="eq-label">(8)</span>
</div>

<p>
Note: to check, recall that \(s'\) and \(s\) are state-snapshot vectors, and \(J_{ij}\) is the coupling matrix we get from softmax attention.
</p>

<p>
This is a skew bilinear term, which is not a term we instinctively recalled from linear algebra but had some external advice about. To check whether it can be a gradient contribution, we use the curl test. We are not in the familiar three dimensions, so we take a mixed second derivative with respect to our states \(s_i'\) and \(s_j\):
</p>

<div class="eq-block" id="eq-curl-test-zero">
\[
\frac{\partial^2}{\partial s_i'\partial s_j}\left[g(s')-g(s)\right]=0
\]
<span class="eq-label">(9)</span>
</div>

<p>
for any scalar potential difference. But for the skew bilinear term,
</p>

<div class="eq-block" id="eq-curl-test-j">
\[
\frac{\partial^2}{\partial s_i'\partial s_j}
\left[s'^T(J-J^T)s\right]
=
J-J^T.
\]
<span class="eq-label">(10)</span>
</div>

<p>
And \(J\), as you may recall, is
</p>

<div class="eq-block" id="eq-j-recall">
\[
J(x)=\operatorname{softmax}\!\left(\frac{xW_QW_K^Tx^T}{\sqrt D}\right),
\]
<span class="eq-label">(11)</span>
</div>

<p>
which is asymmetric, so this term, across the full space of the vectors \(x\), generally does not vanish. We fail the curl test. Detailed balance requires \(J=J^T\) exactly, which is false for the spin transformer and false for ordinary transformer attention as well. An interesting aside, pointed out to us rather than known off-hand, is that we get the Peretto-Little measure for parallel updates out of this work for free if we just look at the terms that do not depend on \(J\) in our transition probabilities:
</p>

<div class="eq-block" id="eq-peretto-little">
\[
P_{\rm eq}(s)\propto
\exp\!\left[\beta\,x\cdot s+\sum_i\log Z_i(s)\right].
\]
<span class="eq-label">(12)</span>
</div>

<p>
We are, therefore, rescued: detailed balance is, indeed, violated, but now we can prove it.
</p>

<h2 id="sec-entropy"><span class="num">04</span> A Mean Entropy</h2>

<p>
Detailed balance cannot hold, and thus one of the two problems with the first NEAM post is fixed. What about entropy, however?
</p>

<p>
A Markov-chain walk is fine and all, but if we bite the bullet and learn to love mean-field theory tooling, then we get an alternative measure of entropy production:
</p>

<div class="eq-block" id="eq-entropy-production">
\[
\sigma_t=\sum_{ij}(J_{ij}-J_{ji})D_{ij,t}.
\]
<span class="eq-label">(13)</span>
</div>

<p>
Here \(D_{ij,t}\) is the time-delayed correlation: the two-point correlation between states at adjacent times, after subtracting the magnetization contribution (<a href="#ref-aguilera-2020">Aguilera, Moosavi, &amp; Shimazaki, 2020</a>; <a href="#ref-bal-entropy-2026">Bal, 2026</a>):
</p>

<div class="eq-block" id="eq-delayed-correlation">
\[
D_{ij,t}
=
\int ds_t\int ds_{t-1}\,
\bigl(s_{i,t}-m_{i,t}\bigr)\cdot
\bigl(s_{j,t-1}-m_{j,t-1}\bigr)
P(s_t,s_{t-1}).
\]
<span class="eq-label">(14)</span>
</div>

<p>
The magnetization is
</p>

<div class="eq-block" id="eq-magnetization">
\[
m_{i,t}
=
\frac{\beta\left(x_{i,t}+\sum_jJ_{ij}m_{j,t-1}\right)}
{1+\sqrt{1+\beta^2\left\|x_{i,t}+\sum_jJ_{ij}m_{j,t-1}\right\|^2/R^2}},
\qquad
R=\sqrt{D/2-1}.
\]
<span class="eq-label">(15)</span>
</div>

<p>
Here \(P(s_t,s_{t-1})\) is the probability for the state at \(t-1\) to evolve in one time-step to the state at \(t\). Spiritually, it looks like the Schnakenberg formula if we squint a lot: entropy production is still tracking irreversible circulation, but now through the mean-field structure of the spin-transformer dynamics.
</p>

<p>
Using the ansatz and the Plefka expansion, Bal gives the full closed-form expression for \(D_{ij,t}\). The full expression is not especially illuminating for our purposes here, so we keep the useful approximation: when the local-field norm is \(O(R)\), the time-delayed correlation becomes
</p>

<div class="eq-block" id="eq-d-approx">
\[
D_{ij,t}\approx J_{ij}\cos^2\alpha_{(i,t),(j,t-1)},
\]
<span class="eq-label">(16)</span>
</div>

<p>
where \(\alpha_{(i,t),(j,t-1)}\) is the angle between the magnetization vectors for \(i\) at time \(t\) and \(j\) at time \(t-1\).
</p>

<p>
Thus entropy production becomes
</p>

<div class="eq-block" id="eq-sigma-approx">
\[
\sigma_t
\sim
\sum_{ij}\left(J_{ij}^2-J_{ij}J_{ji}\right)
\cos^2\alpha_{(i,t),(j,t-1)}.
\]
<span class="eq-label">(17)</span>
</div>

<p>
We already Rescued the detailed balance claim from earlier work, and now you may notice the entropy production rate in the equation immediately above has a \(J-J^T\) term, which is non-zero by asymmetry of \(J\), thus entropy production is non-zero...as long as \(\cos^2\alpha_{(i,t),(j,t-1)}\) does not identically vanish for all \(i\) and \(j\) across the time-step from \(t-1\) to \(t\).
</p>

<h2 id="sec-parasocial"><span class="num">05</span> Parasocial Collapse: Example Sketch</h2>

<p>
Our key insight: detailed balance is, indeed, violated for the spin transformer as contended in the original NEAM post, and the entropy production rate in such a system is generically non-zero for asymmetric couplings with non-orthogonal delayed alignment of the state vectors.
</p>

<p>
Now, let us work an example and illustrate the utility of the NEAM framework, now that it is thoroughly rescued.
</p>

<p>
Let us simplify our world into two states, essentially:
</p>

<ul>
  <li>State 1: the celebrity.</li>
  <li>State 2: everyone else.</li>
  <li>We ignore all other interactions, because everyone else is an NPC. This is a jokey way of saying we ignore \(J_{ij}\) between the masses.</li>
</ul>

<p>
The celebrity causes updates to everyone else, but it is maximally asymmetric. State 1 impacts state 2; state 1 does not care what state 2 does. Ever.
</p>

<p>
In math, using the notation to track how the impacted state is affected by the impactor state, we have
</p>

<div class="eq-block" id="eq-parasocial-j">
\[
J_{21}=c,
\qquad
J_{12}=0,
\qquad
c>0.
\]
<span class="eq-label">(18)</span>
</div>

<p>
If we plug this into the Plefka mean-field approximation for \(D_{ij,t}\), we see
</p>

<div class="eq-block" id="eq-parasocial-d">
\[
D_{12}=0,
\qquad
D_{21}\propto c\cos^2\alpha_{(2,t),(1,t-1)}.
\]
<span class="eq-label">(19)</span>
</div>

<p>
The entropy production immediately becomes
</p>

<div class="eq-block" id="eq-parasocial-sigma">
\[
\sigma_t
=
(J_{12}-J_{21})D_{12}
+
(J_{21}-J_{12})D_{21}
\approx
c^2\cos^2\alpha_{(2,t),(1,t-1)}.
\]
<span class="eq-label">(20)</span>
</div>

<p>
This is a dissipative system, as it continuously produces entropy. The key takeaway is that entropy production is a property of state space and dynamics, not of the attention matrix itself.
</p>

<h2 id="sec-next"><span class="num">06</span> What Next?</h2>

<p>
We have made a much more rigorous argument about detailed balance, replaced key machinery with mean-field theory, and illustrated an example where the entropy production is strictly greater than zero. The NEAM is thus rescued. We are on much more solid ground, our thoughts more organized, the path forward clearer.
</p>

<p>
But what does this mean? Why does this matter?
</p>

<p>
The trajectory so far has been:
</p>

<ul>
  <li>See how SoftMax is secretly a collection of vector spins.</li>
  <li>Use mean-field theory to describe state space and dynamics.</li>
  <li>From state space and dynamics, see the structure of dissipation and entropy production.</li>
  <li>Create the bones of an example we can use to further explore the problem space.</li>
</ul>

<p>
It is not nothing. Though, essentially, we are still at the beginning of exploration. Many of the consequences, and the "and therefore," have been left as idle implications, gaps in the text, liminal space for the exercise of the readers. None of that is satisfactory. Yet, it was all necessary. We have a solid, defensible, well-considered scaffolding, and we can now begin proper exploration, simulation, and demonstration...in a future post.
</p>

<h2 id="sec-refs"><span class="num">07</span> References</h2>

<h3>Foundational Texts</h3>

<ul class="refs">
  <li id="ref-bal-spin-systems">Bal, M. C. (2021). <em>Transformers Are Secretly Collectives of Spin Systems</em>. <a href="https://mcbal.github.io/post/transformers-are-secretly-collectives-of-spin-systems/">mcbal.github.io</a></li>
  <li id="ref-bal-free-energy">Bal, M. C. (2021). <em>Transformers from Spin Models: Approximate Free Energy Minimization</em>. <a href="https://mcbal.github.io/post/transformers-from-spin-models-approximate-free-energy-minimization/">mcbal.github.io</a></li>
  <li id="ref-bal-spin-model">Bal, M. C. (2023). <em>Spin-Model Transformers</em>. <a href="https://mcbal.github.io/post/spin-model-transformers/">mcbal.github.io</a></li>
  <li id="ref-bal-entropy-2026">Bal, M. C. (2026). <em>Entropy Production in Non-Equilibrium Neural Networks</em>. <a href="https://mcbal.github.io/post/entropy-production-in-non-equilibrium-neural-networks/">mcbal.github.io</a></li>
</ul>

<h3>Academic References</h3>

<ul class="refs">
  <li id="ref-aguilera-2020">Aguilera, M., Moosavi, S. A., &amp; Shimazaki, H. (2020). <em>A unifying framework for mean-field theories of asymmetric kinetic Ising systems</em>. arXiv:2002.04309. <a href="https://arxiv.org/abs/2002.04309">arxiv</a></li>
  <li id="ref-schnakenberg-1976">Schnakenberg, J. (1976). Network theory of microscopic and macroscopic behavior of master equation systems. <em>Reviews of Modern Physics</em>, 48(4), 571–585. <a href="https://doi.org/10.1103/RevModPhys.48.571">doi</a></li>
  <li id="ref-cocconi-2020">Cocconi, L., Garcia-Millan, R., Zhen, Z., Buturca, B., &amp; Pruessner, G. (2020). <em>Entropy production in exactly solvable systems</em>. arXiv:2010.04231. <a href="https://arxiv.org/abs/2010.04231">arxiv</a></li>
</ul>

</div>
