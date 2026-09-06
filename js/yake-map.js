/* System overview and local moon views; information stays inside one map. */
(function () {
  'use strict';
  const data = window.YAKE_ATLAS;
  const worlds = new Map(data.worlds.filter(w => !w.hidden).map(w => [w.id, w]));
  const moonViews = ['jin','shu','xuan'];
  const members = cfg => {
    const ids = [cfg.parent, ...cfg.nodes.map(n => n[0]), ...(cfg.locals || []).map(n => n[0]), ...(cfg.ezLocals || []).map(n => n.id)];
    if (ids.includes('marassa')) ids.push('buka','chawkee');
    return new Set(ids);
  };
  let view = 'system', cfg = data.views.system, plotted = members(cfg);
  const field = document.getElementById('orbital-field');
  let selected = null, scene = null;
  const esc = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const stats = rows => '<dl class="card-stats">' + rows.map(([k,v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('') + '</dl>';
  document.querySelector('.atlas-toolbar').insertAdjacentHTML('beforeend','<button class="acidburn-button" id="atlas-system-back" type="button" data-open-view="system" hidden>← SYSTEM OVERVIEW</button>');

  function writeLocation() {
    history.replaceState(null, '', location.pathname + location.search + (selected ? '#' + selected : view === 'system' ? '' : '#view=' + view));
  }

  function setView(name) {
    if (name !== 'system' && !moonViews.includes(name)) return;
    view = name; cfg = data.views[view]; plotted = members(cfg); selected = null;
    if (scene) scene.setView(view, null);
    else fallback();
    document.getElementById('chart-title').textContent = view === 'system' ? 'YA KE / 野雞' : cfg.title;
    document.getElementById('chart-scale').textContent = cfg.caption;
    document.getElementById('atlas-system-back').hidden = view === 'system';
    const heading = field.querySelector('.scene-heading span');
    if (heading) heading.textContent = cfg.title.toUpperCase();
    renderCard(); writeLocation();
    document.getElementById('selection-status').textContent = cfg.title + ' opened. Select a destination.';
  }

  function renderCard() {
    const card = document.getElementById('scene-card');
    card.hidden = !selected;
    if (!selected) return;
    const w = worlds.get(selected);
    let html = `<button class="acidburn-button card-close" type="button" data-close-card aria-label="Close world card">×</button><p class="post-date">${esc(w.kind)}</p><div class="author-info"><h1>${esc(w.name)}</h1></div><p class="author-bio card-intro">${esc(w.intro)}</p>`;
    if (w.stats) html += stats(w.stats.slice(0,4));
    if (scene?.hasBody(selected)) html += '<div class="card-actions"><button class="acidburn-button" type="button" data-scene-action="focus">FOCUS WORLD</button></div>';
    if (moonViews.includes(selected) && view !== selected) html += `<div class="card-actions"><button class="acidburn-button" type="button" data-open-view="${selected}">EXPLORE MOONS</button></div>`;
    if (scene && selected === 'celosia') html += '<div class="card-actions" role="group" aria-label="View Celosia continents">' + ['fusang','mu','diyu'].map(region => `<button class="acidburn-button" type="button" data-scene-action="surface-${region}">${region.toUpperCase()}</button>`).join('') + '</div>';
    // Reference sheets guide the design; they are not reader-facing card content.
    let record = w.stats?.length > 4 ? stats(w.stats.slice(4)) : '';
    (w.paragraphs || []).forEach(p => { record += `<p>${esc(p)}</p>`; });
    if (w.places) record += '<h3>Places & infrastructure</h3><ul class="settlement-list">' + w.places.map(([name,desc]) => `<li>${esc(name)}<span>${esc(desc)}</span></li>`).join('') + '</ul>';
    (w.notes || []).forEach(p => { record += `<p>${esc(p)}</p>`; });
    if (record) html += `<details class="card-record"><summary>WORLD DETAILS</summary>${record}</details>`;
    card.innerHTML = html;
    card.scrollTop = 0;
  }

  function selectWorld(id) {
    if (!plotted.has(id)) {
      const destinationView = ['system', ...moonViews].find(name => members(data.views[name]).has(id));
      if (destinationView) setView(destinationView);
    }
    if (!plotted.has(id)) return;
    selected = id;
    scene?.select(id);
    field.querySelectorAll('[data-world]').forEach(el => el.setAttribute('aria-pressed', el.dataset.world === id));
    renderCard();
    writeLocation();
    document.getElementById('selection-status').textContent = worlds.get(id).name + ' selected. Information card opened.';
  }

  function closeCard() {
    selected = null;
    scene?.select(null);
    field.querySelectorAll('[data-world]').forEach(el => el.setAttribute('aria-pressed','false'));
    renderCard();
    writeLocation();
    document.getElementById('selection-status').textContent = 'World card closed.';
  }

  function collapseScene() {
    document.querySelector('.atlas-chart').classList.remove('is-expanded');
    document.body.classList.remove('atlas-expanded');
    const button = field.querySelector('[data-scene-action="expand"]');
    if (button) { button.textContent = 'EXPAND'; button.setAttribute('aria-pressed','false'); }
  }

  function fallback() {
    scene?.destroy();
    scene = null;
    collapseScene();
    // The same local navigation remains available without WebGL.
    const ids = [...plotted];
    field.innerHTML = '<p class="fallback-notice">3D is unavailable in this browser. Select a destination on the chart.</p>' +
      `<svg viewBox="0 0 380 ${ids.length * 64 + 48}" role="group" aria-label="${esc(cfg.title)}"><path class="orbit" d="M 35 32 V ${ids.length * 64}"/>` +
      ids.map((id,i) => {
        const w = worlds.get(id);
        const location = w.au ? w.au + ' AU' : w.km ? w.km.toLocaleString('en-US') + ' km' : w.kind;
        return `<g class="atlas-node" data-world="${id}" role="button" tabindex="0" aria-label="${esc(w.name)}" aria-pressed="${selected === id}" transform="translate(35,${i*64+40})" style="--body-color:${w.color}"><circle class="hit" r="28"/><circle class="node-ring" r="14"/><circle class="node-core" r="7"/><text class="node-name" x="26" y="-2">${esc(w.mapLabel || w.name)}</text><text class="node-meta" x="26" y="17">${esc(location)}</text></g>`;
      }).join('') + '</svg><aside id="scene-card" class="author-card scene-card fallback-card" aria-label="World information" hidden></aside>';
    renderCard();
  }

  function init() {
    field.innerHTML = '<div class="atlas-scene"><div class="scene-heading"><span>SYSTEM OVERVIEW</span><small>COMPRESSED DISTANCES · ILLUSTRATIVE SIZES</small></div><aside id="scene-card" class="author-card scene-card" aria-label="World information" hidden></aside><div class="author-card scene-controls"><button class="acidburn-button" type="button" data-scene-action="home" title="Fit system">⌂<span class="atlas-sr"> Fit system</span></button><button class="acidburn-button" type="button" data-scene-action="in" aria-label="Zoom in">+</button><button class="acidburn-button" type="button" data-scene-action="out" aria-label="Zoom out">−</button><button class="acidburn-button" type="button" data-scene-action="labels" aria-pressed="true">LABELS</button><button class="acidburn-button" type="button" data-scene-action="expand" aria-pressed="false">EXPAND</button></div><p class="scene-hint">DRAG TO ORBIT · SCROLL / PINCH TO ZOOM · RIGHT-DRAG / TWO FINGERS TO PAN</p></div>';
    try {
      scene = window.YakeScene.create(field.querySelector('.atlas-scene'), id => id ? selectWorld(id) : closeCard(), fallback);
      scene.setView('system', null);
    } catch (error) { fallback(); }
    readLocation();
  }

  document.querySelector('.atlas-shell').addEventListener('click', event => {
    const destinationView = event.target.closest('[data-open-view]');
    if (destinationView) {
      setView(destinationView.dataset.openView);
      field.querySelector('canvas, g[data-world]')?.focus({preventScroll:true});
      return;
    }
    if (event.target.closest('[data-close-card]')) {
      closeCard();
      field.querySelector('canvas, g[data-world]')?.focus({preventScroll:true});
      return;
    }
    const world = event.target.closest('[data-world]');
    if (world) { selectWorld(world.dataset.world); return; }
    const action = event.target.closest('[data-scene-action]');
    if (!action || !scene) return;
    const kind = action.dataset.sceneAction;
    if (kind === 'home') scene.home();
    if (kind === 'focus') scene.focus();
    if (kind.startsWith('surface-')) scene.surface(kind.slice(8));
    if (kind === 'in') scene.zoom(.8);
    if (kind === 'out') scene.zoom(1.25);
    if (kind === 'labels') action.setAttribute('aria-pressed',scene.toggleLabels());
    if (kind === 'expand') {
      const expanded = document.querySelector('.atlas-chart').classList.toggle('is-expanded');
      document.body.classList.toggle('atlas-expanded',expanded);
      action.setAttribute('aria-pressed',expanded);
      action.textContent = expanded ? 'COLLAPSE' : 'EXPAND';
    }
  });
  field.addEventListener('keydown', event => {
    const target = event.target.closest('g[data-world]');
    if (target && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); selectWorld(target.dataset.world); }
  });
  document.getElementById('atlas-reset').addEventListener('click', () => { closeCard(); scene?.home(); });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (selected) { closeCard(); field.querySelector('canvas, g[data-world]')?.focus({preventScroll:true}); }
    else collapseScene();
  });
  function readLocation() {
    const id = location.hash.slice(1);
    if (id.startsWith('view=') && moonViews.includes(id.slice(5))) setView(id.slice(5));
    else if (worlds.has(id)) selectWorld(id);
    else setView('system');
  }
  window.addEventListener('hashchange', readLocation);
  init();
})();
