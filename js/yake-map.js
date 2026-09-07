/* System overview and local moon views; information stays inside one map. */
(function () {
  'use strict';
  const data = window.YAKE_ATLAS;
  const worlds = new Map(data.worlds.filter(w => !w.hidden).map(w => [w.id, w]));
  const moonViews = ['jin','shu','xuan','five'];
  const members = cfg => {
    const ids = [cfg.parent, ...cfg.nodes.map(n => n[0]), ...(cfg.locals || []).map(n => n[0]), ...(cfg.ezLocals || []).map(n => n.id)];
    if (ids.includes('marassa')) ids.push('buka','chawkee');
    return new Set(ids);
  };
  let view = 'system', cfg = data.views.system, plotted = members(cfg);
  const field = document.getElementById('orbital-field');
  const resetButton = document.getElementById('atlas-reset');
  let selected = null, scene = null, region = null;
  let mapActions, viewControls;
  const esc = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const prose = value => esc(value).replace(/\bcelariums?\b/gi, '<em>$&</em>');
  const stats = rows => '<dl class="card-stats">' + rows.map(([k,v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('') + '</dl>';
  document.querySelector('.atlas-toolbar').insertAdjacentHTML('beforeend','<button class="acidburn-button" id="atlas-system-back" type="button" data-open-view="system" hidden>← SYSTEM OVERVIEW</button>');
  const star = worlds.get('yake');
  document.querySelector('.atlas-toolbar').insertAdjacentHTML('afterend', `<details id="system-summary"><summary class="post-date">STAR &amp; STAR SYSTEM · K-TYPE GIANT</summary><div class="system-description"><p>${esc(star.intro)}</p>${stats(data.summaryStats(star).filter(([key]) => key !== 'Catalog identity'))}</div></details>`);
  const shortScreen = matchMedia('(max-height:600px)');
  const fitSummary = () => { document.getElementById('system-summary').open = !shortScreen.matches; };
  shortScreen.addEventListener('change',fitSummary); fitSummary();
  // Portal the card out of the chart's backdrop-filter containing block, so it
  // is centered on the actual screen, including when the map is expanded.
  const popup = document.createElement('aside');
  popup.id = 'scene-card'; popup.className = 'author-card scene-card';
  popup.setAttribute('aria-label','World information'); popup.hidden = true;
  document.body.appendChild(popup);
  const actionDock = document.createElement('div');
  actionDock.id = 'world-actions'; actionDock.className = 'world-actions';
  actionDock.setAttribute('role','group'); actionDock.hidden = true;

  // World actions belong to the card; the map footer stays unchanged.
  function fitCard() {
    if (!mapActions || popup.hidden) return;
    const bottom = innerHeight - 8;
    const half = popup.getBoundingClientRect().height / 2;
    popup.style.top = Math.max(half + 4, Math.min(innerHeight / 2, bottom - half)) + 'px';
  }

  function writeLocation() {
    history.replaceState(null, '', location.pathname + location.search + (selected ? '#' + selected : view === 'system' ? '' : '#view=' + view));
  }

  function setView(name) {
    if (name !== 'system' && !moonViews.includes(name)) return;
    view = name; cfg = data.views[view]; plotted = members(cfg); selected = null; region = null;
    if (scene) scene.setView(view, null);
    else fallback();
    document.getElementById('chart-title').textContent = view === 'system' ? 'YA KE / 野雞' : cfg.title;
    document.getElementById('atlas-system-back').hidden = view === 'system';
    document.getElementById('system-summary').hidden = view !== 'system';
    const heading = field.querySelector('.scene-heading span');
    if (heading) heading.textContent = cfg.title.toUpperCase();
    renderCard(); writeLocation();
    document.getElementById('selection-status').textContent = cfg.title + ' opened. Select a destination.';
  }

  function renderCard() {
    const card = document.getElementById('scene-card');
    const actions = actionDock;
    card.hidden = !selected;
    actions.hidden = !selected;
    actions.innerHTML = '';
    card.innerHTML = '';
    viewControls.hidden = !scene;
    if (!selected) return;
    const w = worlds.get(selected);
    const continent = selected === 'celosia' && region ? data.continents[region] : null;
    const detail = continent ? continent.detail : data.cardDetails[w.id];
    card.innerHTML = `<button class="acidburn-button card-close" type="button" data-close-card aria-label="Close world card">×</button><div class="card-heading"><div class="card-title"><div class="author-info"><h1>${esc(continent ? continent.name : w.name)}</h1></div><p class="post-date">${esc(continent ? 'Celosia · continent' : w.kind)}</p></div></div><div class="card-body"><div class="card-copy"><p class="author-bio card-intro">${prose(continent ? continent.intro : w.intro)}</p>${detail ? `<p class="card-detail">${prose(detail)}</p>` : ''}</div>${!continent && w.stats ? stats(data.summaryStats(w)) : ''}</div>`;
    card.querySelector('.card-heading').appendChild(actions);
    let controls = '';
    if (scene?.hasBody(selected)) controls += '<button class="acidburn-button" type="button" data-scene-action="focus">FOCUS WORLD</button>';
    if (selected === 'marassa' || w.parent === 'marassa') controls += ['buka','chawkee'].map(id => `<button class="acidburn-button" type="button" data-select-world="${id}" aria-pressed="${selected === id}">${id.toUpperCase()}</button>`).join('');
    if (moonViews.includes(selected) && view !== selected) controls += `<button class="acidburn-button" type="button" data-open-view="${selected}">${selected === 'five' ? 'EXPLORE ISLANDS' : 'EXPLORE MOONS'}</button>`;
    if (scene && selected === 'celosia') controls += ['fusang','mu','diyu'].map(region => `<button class="acidburn-button" type="button" data-scene-action="surface-${region}">${region.toUpperCase()}</button>`).join('');
    actions.innerHTML = controls;
    actions.hidden = !controls;
    actions.setAttribute('aria-label', w.name + ' map actions');
    fitCard();
  }

  function selectWorld(id) {
    region = null;
    if (id === 'yake') { closeCard(); return; }
    if (!plotted.has(id)) {
      const destinationView = ['system', ...moonViews].find(name => members(data.views[name]).has(id));
      if (destinationView) setView(destinationView);
    }
    if (!plotted.has(id)) return;
    selected = id;
    scene?.select(id);
    field.querySelectorAll('[data-world]').forEach(el => el.setAttribute('aria-pressed', el.dataset.world === id));
    renderCard();
    // The fixed card overlays the viewport without scrolling or moving the map.
    writeLocation();
    document.getElementById('selection-status').textContent = worlds.get(id).name + ' selected. Information card opened.';
  }

  function closeCard() {
    selected = null; region = null;
    // Dismiss the information, not the visual selection or camera focus.
    renderCard();
    writeLocation();
    document.getElementById('selection-status').textContent = 'World card closed.';
  }

  function collapseScene() {
    document.querySelector('.atlas-chart').classList.remove('is-expanded');
    document.body.classList.remove('atlas-expanded');
    const button = mapActions.querySelector('[data-scene-action="expand"]');
    if (button) { button.textContent = 'EXPAND'; button.setAttribute('aria-pressed','false'); }
  }

  function fallback() {
    scene?.destroy();
    scene = null;
    popup.classList.add('fallback-card');
    collapseScene();
    // The same local navigation remains available without WebGL.
    const ids = [...plotted].filter(id => id !== 'yake');
    field.innerHTML = '<p class="fallback-notice">3D is unavailable in this browser. Select a destination on the chart.</p>' +
      `<svg viewBox="0 0 380 ${ids.length * 64 + 48}" role="group" aria-label="${esc(cfg.title)}"><path class="orbit" d="M 35 32 V ${ids.length * 64}"/>` +
      ids.map((id,i) => {
        const w = worlds.get(id);
        const location = w.au ? w.au + ' AU' : w.km ? w.km.toLocaleString('en-US') + ' km' : w.kind;
        return `<g class="atlas-node" data-world="${id}" role="button" tabindex="0" aria-label="${esc(w.name)}" aria-pressed="${selected === id}" transform="translate(35,${i*64+40})" style="--body-color:${w.color}"><circle class="hit" r="28"/><circle class="node-ring" r="14"/><circle class="node-core" r="7"/><text class="node-name" x="26" y="-2">${esc(w.mapLabel || w.name)}</text><text class="node-meta" x="26" y="17">${esc(location)}</text></g>`;
      }).join('') + '</svg>';
    renderCard();
  }

  function init() {
    field.innerHTML = '<div class="atlas-scene"><div class="scene-heading"><span>SYSTEM OVERVIEW</span><small>COMPRESSED DISTANCES · ILLUSTRATIVE SIZES</small></div><p class="scene-hint">DRAG: ORBIT · SCROLL / PINCH: ZOOM · DOUBLE-CLICK / TAP: FOCUS</p></div><div class="map-actions"><div class="scene-controls" role="group" aria-label="Map controls"><button class="acidburn-button" type="button" data-scene-action="home" title="Fit map">⌂<span class="atlas-sr"> Fit map</span></button><button class="acidburn-button" type="button" data-scene-action="in" aria-label="Zoom in">+</button><button class="acidburn-button" type="button" data-scene-action="out" aria-label="Zoom out">−</button><button class="acidburn-button" type="button" data-scene-action="labels" aria-pressed="true">LABELS</button><button class="acidburn-button" type="button" data-scene-action="expand" aria-pressed="false">EXPAND</button></div><div class="world-actions-slot" aria-hidden="true"></div></div>';
    mapActions = field.querySelector('.map-actions');
    field.after(mapActions);
    const group = mapActions.querySelector('.scene-controls');
    viewControls = document.createElement('div');
    viewControls.className = 'view-controls';
    while (group.firstChild) viewControls.appendChild(group.firstChild);
    group.append(viewControls, document.getElementById('atlas-system-back'), resetButton);
    const cardLayout = new ResizeObserver(fitCard);
    cardLayout.observe(mapActions); cardLayout.observe(popup);
    window.addEventListener('resize',fitCard);
    try {
      scene = window.YakeScene.create(field.querySelector('.atlas-scene'), id => id ? selectWorld(id) : closeCard(), fallback, id => { selectWorld(id); scene.select(id); scene.focus(); });
      scene.setView('system', null);
    } catch (error) { fallback(); }
    readLocation();
  }

  document.addEventListener('click', event => {
    if (!event.target.closest('.atlas-shell,#scene-card,#world-actions')) return;
    const ring = event.target.closest('[data-select-world]');
    if (ring) { selectWorld(ring.dataset.selectWorld); return; }
    const destinationView = event.target.closest('[data-open-view]');
    if (destinationView) {
      setView(destinationView.dataset.openView);
      field.querySelector('canvas, g[data-world]')?.focus({preventScroll:true});
      field.querySelector('.atlas-scene, svg')?.scrollIntoView({block:'nearest'});
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
    if (kind === 'focus') { closeCard(); scene.focus(true); field.querySelector('canvas')?.focus({preventScroll:true}); }
    if (kind.startsWith('surface-')) { region = kind.slice(8); scene.surface(region); renderCard(); }
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
  resetButton.addEventListener('click', () => { closeCard(); scene?.select(null); scene?.home(); field.querySelectorAll('[data-world]').forEach(el => el.setAttribute('aria-pressed','false')); });
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
