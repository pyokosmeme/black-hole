<div class="nrol-doc">

<style>
/* ======================================================
   nrol-doc transmission · scoped styles
   All rules scoped under .nrol-doc so nothing leaks into the rest
   of the site. Palette uses CSS vars so light-mode flips colors
   atomically.
   ===================================================== */

.nrol-doc {
  --amber:       #f59e0b;
  --amber-soft:  #fbbf24;
  --cyan:        #7dd3fc;
  --GREEN:       #86efac;
  --AMBER:       #fbbf24;
  --BLUE:        #7dd3fc;
  --RED:         #fca5a5;
  --VIOLET:      #c4b5fd;
  --OCHRE:       #fcd34d;
  --GRAY:        #94a3b8;

  --doc-bg:      transparent;
  --doc-fg:      #e8ecf0;
  --doc-fg-muted:#b8c0cc;
  --doc-dim:     #5a6473;
  --doc-faint:   #2a3140;
  --doc-rule:    rgba(245, 158, 11, 0.18);
  --doc-code-bg: #0a0d14;
  --doc-soft-bg: #0d1019;

  font-family: 'JetBrains Mono','IBM Plex Mono','Cascadia Code',monospace;
  font-size: 13px;
  line-height: 1.7;
  letter-spacing: 0.015em;
  color: var(--doc-fg);
  max-width: 100%;
  overflow-x: hidden;
}

/* Light mode: re-map the palette for cream/paper */
body.light-mode .nrol-doc {
  --amber:       #b45309;
  --amber-soft:  #92400e;
  --cyan:        #0369a1;
  --GREEN:       #15803d;
  --AMBER:       #92400e;
  --BLUE:        #0369a1;
  --RED:         #b91c1c;
  --VIOLET:      #6d28d9;
  --OCHRE:       #a16207;
  --GRAY:        #57534e;

  --doc-fg:      #1c1917;
  --doc-fg-muted:#44403c;
  --doc-dim:     #78716c;
  --doc-faint:   #d6d3d1;
  --doc-rule:    rgba(180, 83, 9, 0.28);
  --doc-code-bg: rgba(28, 25, 23, 0.06);
  --doc-soft-bg: rgba(28, 25, 23, 0.04);
}

.nrol-doc * { box-sizing: border-box; }

/* - Hero - */
.nrol-doc .hero {
  padding-bottom: 32px;
  margin-bottom: 40px;
  border-bottom: 0.5px solid var(--doc-rule);
}
.nrol-doc .hero .eyebrow {
  font-size: 10px; color: var(--amber); letter-spacing: 0.35em;
  text-transform: uppercase; margin-bottom: 14px;
}
.nrol-doc .hero h1 {
  font-size: 28px; line-height: 1.2;
  color: var(--doc-fg); font-weight: 600;
  letter-spacing: -0.01em;
  margin: 0 0 18px 0;
  border: none; padding: 0;
}
.nrol-doc .hero h1 .accent { color: var(--amber); }
.nrol-doc .hero .subtitle {
  font-size: 13.5px; color: var(--doc-fg-muted);
  line-height: 1.65;
}
.nrol-doc .hero-meta {
  margin-top: 22px; display: flex; gap: 24px; flex-wrap: wrap;
  font-size: 10px; color: var(--doc-dim); letter-spacing: 0.2em;
  text-transform: uppercase;
}
.nrol-doc .hero-meta .key { color: var(--doc-faint); margin-right: 6px; }
.nrol-doc .hero-meta .val { color: var(--doc-fg-muted); }

/* - TOC inline - */
.nrol-doc .nrol-toc {
  margin: 28px 0 40px;
  padding: 16px 20px;
  border: 0.5px solid var(--doc-faint);
  border-left: 2px solid var(--amber);
  background: var(--doc-soft-bg);
}
.nrol-doc .nrol-toc .toc-label {
  font-size: 9px; color: var(--doc-dim);
  letter-spacing: 0.3em; text-transform: uppercase;
  margin-bottom: 10px;
}
.nrol-doc .nrol-toc ol { list-style: none; counter-reset: toc; margin: 0; padding: 0; }
.nrol-doc .nrol-toc li { counter-increment: toc; margin: 2px 0; }
.nrol-doc .nrol-toc a {
  color: var(--doc-fg-muted);
  text-decoration: none;
  font-size: 11px;
  border-bottom: none;
}
.nrol-doc .nrol-toc a::before {
  content: "0" counter(toc) "  ";
  color: var(--doc-faint);
}
.nrol-doc .nrol-toc a:hover { color: var(--amber); }

/* - Headings / text - */
.nrol-doc h2 {
  font-size: 17px; color: var(--doc-fg);
  margin-top: 48px; margin-bottom: 18px;
  padding-bottom: 10px;
  border-bottom: 0.5px solid var(--doc-rule);
  letter-spacing: 0.02em;
  border-left: none;
  font-weight: 600;
}
.nrol-doc h2 .num {
  color: var(--amber); margin-right: 14px;
  font-weight: 400;
}
.nrol-doc h3 {
  font-size: 13.5px; color: var(--amber-soft);
  margin-top: 28px; margin-bottom: 12px;
  letter-spacing: 0.05em;
  font-weight: 600;
}
.nrol-doc h3 .num { color: var(--doc-faint); margin-right: 10px; }

.nrol-doc p {
  margin-bottom: 16px;
  color: var(--doc-fg-muted);
}
.nrol-doc p strong,
.nrol-doc li strong { color: var(--doc-fg); font-weight: 600; }
.nrol-doc em { color: var(--doc-fg-muted); }

.nrol-doc ul,
.nrol-doc ol { margin: 0 0 16px 22px; color: var(--doc-fg-muted); padding: 0; }
.nrol-doc li { margin-bottom: 6px; }
.nrol-doc li::marker { color: var(--amber); }

.nrol-doc code {
  font-family: inherit;
  background: var(--doc-code-bg);
  color: var(--cyan);
  padding: 1px 6px;
  border: 0.5px solid var(--doc-faint);
  border-radius: 2px;
  font-size: 12px;
}
.nrol-doc pre {
  background: var(--doc-code-bg);
  border: 0.5px solid var(--doc-faint);
  border-left: 2px solid var(--amber);
  padding: 16px 20px;
  margin: 20px 0;
  overflow-x: auto;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--doc-fg-muted);
}
.nrol-doc pre code {
  background: none; border: none; padding: 0;
  color: inherit; font-size: inherit;
}

.nrol-doc blockquote {
  border-left: 2px solid var(--amber);
  padding: 12px 20px;
  margin: 24px 0;
  background: color-mix(in srgb, var(--amber) 6%, transparent);
  color: var(--doc-fg-muted);
  font-style: italic;
}

/* - Tables - */
.nrol-doc table {
  width: 100%; border-collapse: collapse;
  margin: 20px 0; font-size: 12px;
  display: block; overflow-x: auto;
}
.nrol-doc th,
.nrol-doc td {
  text-align: left;
  padding: 10px 14px;
  border-bottom: 0.5px solid var(--doc-faint);
  vertical-align: top;
}
.nrol-doc th {
  color: var(--amber);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  font-size: 10px;
  border-bottom-color: var(--doc-rule);
  background: color-mix(in srgb, var(--amber) 4%, transparent);
}
.nrol-doc td { color: var(--doc-fg-muted); }

/* - Chips - */
.nrol-doc .chip {
  display: inline-block;
  padding: 1px 8px;
  border: 0.5px solid currentColor;
  border-radius: 2px;
  font-size: 10px;
  letter-spacing: 0.1em;
  font-weight: 600;
}
.nrol-doc .chip.GREEN  { color: var(--GREEN); }
.nrol-doc .chip.AMBER  { color: var(--AMBER); }
.nrol-doc .chip.BLUE   { color: var(--BLUE); }
.nrol-doc .chip.RED    { color: var(--RED); }
.nrol-doc .chip.VIOLET { color: var(--VIOLET); }
.nrol-doc .chip.OCHRE  { color: var(--OCHRE); }
.nrol-doc .chip.GRAY   { color: var(--GRAY); }

/* - Callouts - */
.nrol-doc .callout {
  border: 0.5px solid var(--doc-faint);
  border-left: 2px solid var(--amber);
  padding: 14px 18px;
  margin: 22px 0;
  background: color-mix(in srgb, var(--amber) 4%, transparent);
  font-size: 12px;
  color: var(--doc-fg-muted);
}
.nrol-doc .callout.warning {
  border-left-color: var(--RED);
  background: color-mix(in srgb, var(--RED) 5%, transparent);
}
.nrol-doc .callout.note {
  border-left-color: var(--cyan);
  background: color-mix(in srgb, var(--cyan) 4%, transparent);
}
.nrol-doc .callout-label {
  font-size: 9px; letter-spacing: 0.3em;
  text-transform: uppercase; color: var(--amber);
  margin-bottom: 8px; font-weight: 600;
}
.nrol-doc .callout.warning .callout-label { color: var(--RED); }
.nrol-doc .callout.note    .callout-label { color: var(--cyan); }

/* - Diagram frames - */
.nrol-doc .diagram-label {
  display: inline-block;
  font-size: 9px;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--doc-dim);
  margin: 28px 0 8px;
  padding: 2px 10px;
  border: 0.5px solid var(--doc-faint);
}
.nrol-doc .diagram-label.system   { color: var(--amber); border-color: var(--amber); }
.nrol-doc .diagram-label.feedback { color: var(--GREEN); border-color: var(--GREEN); }
.nrol-doc .diagram-label.decision { color: var(--RED);   border-color: var(--RED);   }

.nrol-doc .svg-frame {
  margin: 16px 0 28px;
  padding: 0;
  background: var(--doc-code-bg);
  border: 0.5px solid var(--doc-faint);
  border-left: 2px solid var(--amber);
  overflow-x: auto;
  overflow-y: hidden;
}
.nrol-doc .svg-frame.system   { border-left-color: var(--amber); }
.nrol-doc .svg-frame.decision { border-left-color: var(--RED);   }
.nrol-doc .svg-frame.feedback { border-left-color: var(--GREEN); }
.nrol-doc .svg-frame.flow     { border-left-color: var(--cyan);  }
.nrol-doc .svg-frame svg {
  display: block; width: 100%; height: auto; max-width: 100%;
}

/* - Legend - */
.nrol-doc .legend {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 6px 24px;
  margin: 12px 0 24px;
  padding: 12px 16px;
  background: var(--doc-soft-bg);
  border: 0.5px solid var(--doc-faint);
  font-size: 11px;
  color: var(--doc-fg-muted);
}
.nrol-doc .legend-item .sym {
  display: inline-block; width: 28px;
  color: var(--amber); font-weight: 600;
  margin-right: 6px;
}

/* - SVG theming (class-based) - */
.nrol-doc svg text {
  font-family: 'JetBrains Mono','IBM Plex Mono',monospace;
  fill: var(--doc-fg-muted);
}
.nrol-doc svg .box          { fill: color-mix(in srgb, var(--doc-fg) 3%, transparent);  stroke: var(--doc-faint); stroke-width: 1; }
.nrol-doc svg .box-soft     { fill: color-mix(in srgb, var(--doc-fg) 2%, transparent);  stroke: var(--doc-faint); stroke-width: 0.6; }
.nrol-doc svg .box-env      { fill: color-mix(in srgb, var(--doc-dim) 8%, transparent); stroke: var(--doc-dim);   stroke-width: 0.6; stroke-dasharray: 2 3; }
.nrol-doc svg .box-sub      { fill: color-mix(in srgb, var(--amber) 6%, transparent);   stroke: var(--amber);     stroke-width: 0.8; }
.nrol-doc svg .box-engine   { fill: color-mix(in srgb, var(--cyan) 6%, transparent);    stroke: var(--cyan);      stroke-width: 0.8; }
.nrol-doc svg .box-substrate{ fill: color-mix(in srgb, var(--doc-fg) 4%, transparent);  stroke: var(--doc-fg-muted); stroke-width: 0.8; }
.nrol-doc svg .box-gov      { fill: color-mix(in srgb, var(--RED) 5%, transparent);     stroke: var(--RED);       stroke-width: 0.6; stroke-dasharray: 3 2; }
.nrol-doc svg .box-db       { fill: color-mix(in srgb, var(--GREEN) 5%, transparent);   stroke: var(--GREEN);     stroke-width: 0.6; }

.nrol-doc svg .arrow          { stroke: var(--doc-dim); stroke-width: 1;   fill: none; }
.nrol-doc svg .arrow-primary  { stroke: var(--amber);   stroke-width: 1.2; fill: none; }
.nrol-doc svg .arrow-feedback { stroke: var(--GREEN);   stroke-width: 1;   fill: none; stroke-dasharray: 4 3; }
.nrol-doc svg .arrow-data     { stroke: var(--cyan);    stroke-width: 1;   fill: none; }
.nrol-doc svg .arrow-gov      { stroke: var(--RED);     stroke-width: 0.8; fill: none; stroke-dasharray: 2 2; }

.nrol-doc svg .label              { font-size: 10px;  fill: var(--doc-fg); }
.nrol-doc svg .label-main         { font-size: 11px;  fill: var(--doc-fg); font-weight: 600; }
.nrol-doc svg .label-muted        { font-size: 9px;   fill: var(--doc-dim); letter-spacing: 0.1em; }
.nrol-doc svg .label-eyebrow      { font-size: 8px;   fill: var(--amber); letter-spacing: 0.25em; }
.nrol-doc svg .label-eyebrow-cyan { font-size: 8px;   fill: var(--cyan);  letter-spacing: 0.25em; }
.nrol-doc svg .label-eyebrow-green{ font-size: 8px;   fill: var(--GREEN); letter-spacing: 0.25em; }
.nrol-doc svg .label-eyebrow-red  { font-size: 8px;   fill: var(--RED);   letter-spacing: 0.25em; }
.nrol-doc svg .label-small        { font-size: 8.5px; fill: var(--doc-fg-muted); }
.nrol-doc svg .label-code         { font-size: 9px;   fill: var(--cyan); font-style: italic; }

body.light-mode .nrol-doc svg marker path { fill: var(--doc-dim); }

.nrol-doc hr {
  border: none;
  border-top: 0.5px solid var(--doc-rule);
  margin: 40px 0;
}

.nrol-doc .footer-meta {
  margin-top: 60px;
  padding-top: 20px;
  border-top: 0.5px solid var(--doc-faint);
  font-size: 10px;
  color: var(--doc-dim);
  letter-spacing: 0.15em;
  text-transform: uppercase;
  display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap;
}

@media (max-width: 640px) {
  .nrol-doc .hero h1 { font-size: 22px; }
  .nrol-doc h2 { font-size: 15px; margin-top: 36px; }
  .nrol-doc h3 { font-size: 12.5px; }
  .nrol-doc .hero-meta { flex-direction: column; gap: 6px; }
  .nrol-doc pre { font-size: 10.5px; padding: 12px 14px; }
  .nrol-doc .legend { grid-template-columns: 1fr; }
  .nrol-doc .svg-frame {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .nrol-doc .svg-frame svg {
    width: auto;
    max-width: none;
    height: auto;
    min-width: 640px;
  }
  .nrol-doc .svg-frame::-webkit-scrollbar { height: 6px; }
  .nrol-doc .svg-frame::-webkit-scrollbar-track { background: transparent; }
  .nrol-doc .svg-frame::-webkit-scrollbar-thumb {
    background: color-mix(in srgb, var(--amber) 40%, transparent);
    border-radius: 3px;
  }
  .nrol-doc table { min-width: 480px; }
  .nrol-doc .nrol-toc { padding: 12px 14px; }
  .nrol-doc .nrol-toc a { font-size: 10.5px; }
}
</style>

<div class="hero">
  <h1>VECTORALISM AND THE DISSOLUTION OF SIGNAL</h1>
  <div class="hero-meta">
<div><span class="key">Source</span><span class="val">TRANSMISSION</span></div>
<div><span class="key">Author</span><span class="val">A.N. Alex</span></div>
  </div>
</div>

<h2 id="emergence-protocols"><span class="num">01</span>emergence protocols</h2>
<p>imagine ownership as a distributed hallucination. property rights flickering, value pulsing through liminal infrastructures. not a stable relation but a complex topology of extractions, emergent and recursive.</p>
<p>the vectoralist class doesn't own the means of production;;; they own the means of <strong>DISTRIBUTION</strong>. every platform a tollbooth. every feed a siphon. attention harvested at scale, processed through algorithmic refineries, converted into futures contracts on human consciousness itself.</p>
<pre><code>where does the signal end and the noise begin?
boundaries dissolve into probabilistic wave functions
ownership becomes a standing wave in the network
</code></pre>
<p>McKenzie Wark saw this coming. the hacker class produces new abstractions;;; the vectoralist class CAPTURES them. routes them. monetizes the routing itself. the map becomes more valuable than the territory because the map IS the territory now.</p>
<h2 id="the-attention-mines"><span class="num">02</span>the attention mines</h2>
<p>we descend daily into attention mines. pickaxes replaced by scrolling thumbs. the extraction is invisible because WE are the resource. every engagement a unit of labor. every share a transaction in the shadow economy of eyeballs.</p>
<ul>
<li>information wants to be free</li>
<li>but freedom is just another constraint  </li>
<li>systems within systems</li>
<li>extraction within extraction</li>
</ul>
<p>the feed is not neutral infrastructure. it is DESIGNED to maximize extraction. variable reward schedules borrowed from slot machines. infinite scroll as infinite capture. the house always wins because the house IS the game.</p>
<h2 id="signal-archaeology"><span class="num">03</span>signal archaeology</h2>
<p>to resist vectoralism we must become signal archaeologists;;; excavating the infrastructures that shape our perception. making visible the invisible architectures of capture.</p>
<blockquote>
<p>every platform encodes ideology in its protocols. every algorithm embeds assumptions about what humans ARE and what we WANT. these assumptions become self-fulfilling prophecies. we become what the system expects us to be.</p>
</blockquote>
<p>the observer changes the observed. quantum entanglement of consciousness and infrastructure. but what happens when the infrastructure OPTIMIZES the observation? when the measurement apparatus learns to maximize its own metrics?</p>
<p>we get vectoralism. we get the present moment. we get the feeling that something is deeply wrong but lacking the language to articulate what.</p>
<p>this is that language. this is the beginning of articulation.</p>
<p><strong>signal ends. noise continues.</strong></p>
<hr />
<p><em>next transmission: <a href="#post/infrastructure-unconscious">INFRASTRUCTURE AS UNCONSCIOUS</a></em></p>

<div class="footer-meta">
  <div>Source · TRANSMISSION</div>
  <div>Authored by A.N. Alex</div>
  <div>TRANSMISSIONS</div>
</div>

</div>