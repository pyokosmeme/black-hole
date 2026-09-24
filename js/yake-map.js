/* System overview and local moon views, all inside one map window.
 * Secondary information opens in panes over the map (see map-window.js):
 * the system notes (ⓘ) and a world card for the selected destination.
 * Moon systems open as a framed window-in-window with their own close. */
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
  let selected = null, scene = null, region = null;
  const win = () => window.MapWindow;
  const esc = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const prose = value => esc(value).replace(/\bcelariums?\b/gi, '<em>$&</em>');
  const stats = rows => '<dl class="card-stats">' + rows.map(([k,v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('') + '</dl>';
  const icon = d => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
  const closeIcon = icon('m6 6 12 12M6 18 18 6');
  const paneHead = (id, title, label) => `<div class="section-header window-toolbar"><h2 id="${id}">${title}</h2><div class="section-line"></div><div class="window-actions"><button class="acidburn-button" type="button" data-pane-close aria-label="${label}" title="${label}">${closeIcon}</button></div></div>`;
  const star = worlds.get('yake');
  const SYSTEM_NOTE = 'Compressed distances · illustrative sizes';
  const NOTES_KEY = 'yake-system-notes';

  field.innerHTML = `<div class="atlas-scene map-viewport">
    <div class="map-hud map-hud-tl" data-label-avoid>
      <div class="view-title-row"><p class="map-view-title" id="view-title">System overview</p><button class="acidburn-button icon moon-close" type="button" data-close-view hidden>${closeIcon}</button></div>
      <p class="map-view-note" id="view-note">${SYSTEM_NOTE}</p>
    </div>
    <div class="map-hud map-hud-bl"><p class="map-hint">DRAG: ORBIT · SCROLL / PINCH: ZOOM · TAP: SELECT · DOUBLE-TAP: FOCUS</p></div>
    <div class="map-hud map-hud-br" data-label-avoid>
      <div class="map-controls" role="group" aria-label="Map controls">
        <button class="acidburn-button icon" type="button" data-pane-toggle="system-pane" aria-controls="system-pane" aria-expanded="false" aria-label="About the Ya Ke system" title="About the Ya Ke system"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v6M12 7.5v.5"/></svg></button>
        <button class="acidburn-button icon" type="button" data-scene-action="home" aria-label="Reset view" title="Reset view"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/><circle cx="12" cy="12" r="2.5"/></svg></button>
        <button class="acidburn-button icon" type="button" data-scene-action="in" aria-label="Zoom in" title="Zoom in">${icon('M12 5v14M5 12h14')}</button>
        <button class="acidburn-button icon" type="button" data-scene-action="out" aria-label="Zoom out" title="Zoom out">${icon('M5 12h14')}</button>
        <button class="acidburn-button" type="button" data-scene-action="labels" aria-pressed="true">labels</button>
      </div>
    </div>
    <aside class="author-card map-pane" id="system-pane" data-map-pane data-label-avoid hidden aria-labelledby="system-pane-title">
      ${paneHead('system-pane-title', 'YA KE', 'Close system notes')}
      <div class="map-pane-body"><p class="post-date">Star &amp; star system · K-type giant</p><p class="card-intro">${esc(star.intro)}</p>${stats(data.summaryStats(star).filter(([key]) => key !== 'Catalog identity'))}</div>
    </aside>
    <aside class="author-card map-pane" id="world-pane" data-map-pane data-label-avoid hidden aria-labelledby="world-pane-title">
      ${paneHead('world-pane-title', '', 'Close world card')}
      <div class="map-pane-body" id="world-pane-body"></div>
    </aside>
  </div>`;
  const sceneHost = field.querySelector('.atlas-scene');
  window.MapWindow?.refresh();
  const worldPane = document.getElementById('world-pane');
  const systemPane = document.getElementById('system-pane');
  const status = text => { document.getElementById('selection-status').textContent = text; };

  function writeLocation() {
    history.replaceState(null, '', location.pathname + location.search + (selected ? '#' + selected : view === 'system' ? '' : '#view=' + view));
  }

  function setView(name) {
    if (name !== 'system' && !moonViews.includes(name)) return;
    view = name; cfg = data.views[view]; plotted = members(cfg); selected = null; region = null;
    if (scene) scene.setView(view, null);
    else fallback();
    sceneHost.classList.toggle('moon-window', view !== 'system');
    document.getElementById('view-title').textContent = view === 'system' ? 'System overview' : cfg.title;
    document.getElementById('view-note').textContent = view === 'system' ? SYSTEM_NOTE : cfg.caption;
    const close = sceneHost.querySelector('.moon-close');
    close.hidden = view === 'system';
    close.setAttribute('aria-label', 'Close ' + cfg.title + ' and return to the system map');
    close.title = close.getAttribute('aria-label');
    renderCard(); writeLocation();
    status(cfg.title + ' opened. Select a destination.');
  }

  function renderCard() {
    const body = document.getElementById('world-pane-body');
    if (!selected) { if (win()) win().closePane(worldPane, {silent:true}); return; }
    const w = worlds.get(selected);
    const continent = selected === 'celosia' && region ? data.continents[region] : null;
    const detail = continent ? continent.detail : data.cardDetails[w.id];
    document.getElementById('world-pane-title').textContent = continent ? continent.name : w.name;
    let actions = '';
    if (scene?.hasBody(selected)) actions += '<button class="acidburn-button" type="button" data-scene-action="focus">focus world</button>';
    if (selected === 'marassa' || w.parent === 'marassa') actions += ['buka','chawkee'].map(id => `<button class="acidburn-button" type="button" data-select-world="${id}" aria-pressed="${selected === id}">${id}</button>`).join('');
    if (moonViews.includes(selected) && view !== selected) actions += `<button class="acidburn-button" type="button" data-open-view="${selected}">${selected === 'five' ? 'explore islands' : 'explore moons'}</button>`;
    // Map actions sit at the top so a short pane never scrolls them away.
    body.innerHTML = `<p class="post-date">${esc(continent ? 'Celosia · continent' : w.kind)}</p>`
      + (actions ? `<div class="world-actions" role="group" aria-label="${esc(w.name)} map actions">${actions}</div>` : '')
      + `<p class="card-intro">${prose(continent ? continent.intro : w.intro)}</p>`
      + (detail ? `<p class="card-detail">${prose(detail)}</p>` : '')
      + (!continent && w.stats ? stats(data.summaryStats(w)) : '');
    body.scrollTop = 0;
    if (win()) win().openPane(worldPane);
  }

  function selectWorld(id) {
    region = null;
    if (id === 'yake') { if (win()) win().openPane(systemPane); return; }
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
    status(worlds.get(id).name + ' selected. World card opened.');
  }

  // The card's close button (or Escape) dismisses the information, not the
  // visual selection or camera focus.
  worldPane.addEventListener('pane:close', () => {
    if (!selected) return;
    selected = null; region = null;
    writeLocation();
    status('World card closed.');
  });
  systemPane.addEventListener('pane:close', () => { try { localStorage.setItem(NOTES_KEY, 'closed'); } catch (e) {} });

  function resetView() {
    if (win()) win().closePane(worldPane, {silent:true});
    selected = null; region = null;
    scene?.select(null); scene?.home();
    field.querySelectorAll('[data-world]').forEach(el => el.setAttribute('aria-pressed','false'));
    writeLocation();
  }

  function fallback() {
    scene?.destroy();
    scene = null;
    win()?.collapse();
    // The same local navigation remains available without WebGL, inside the
    // same window: a scrollable chart replaces the canvas.
    // Reset still clears the selection; camera-only controls go away.
    sceneHost.querySelectorAll('[data-scene-action]').forEach(button => { if (!['focus','home'].includes(button.dataset.sceneAction)) button.hidden = true; });
    sceneHost.querySelector('.map-hud-bl').hidden = true;
    sceneHost.querySelector('.fallback-chart')?.remove();
    const ids = [...plotted].filter(id => id !== 'yake');
    sceneHost.insertAdjacentHTML('afterbegin', '<div class="fallback-chart"><p class="fallback-notice">3D is unavailable in this browser. Select a destination on the chart.</p>' +
      `<svg viewBox="0 0 380 ${ids.length * 64 + 48}" role="group" aria-label="${esc(cfg.title)}"><path class="orbit" d="M 35 32 V ${ids.length * 64}"/>` +
      ids.map((id,i) => {
        const w = worlds.get(id);
        const location = w.au ? w.au + ' AU' : w.km ? w.km.toLocaleString('en-US') + ' km' : w.kind;
        return `<g class="atlas-node" data-world="${id}" role="button" tabindex="0" aria-label="${esc(w.name)}" aria-pressed="${selected === id}" transform="translate(35,${i*64+40})" style="--body-color:${w.color}"><circle class="hit" r="28"/><circle class="node-ring" r="14"/><circle class="node-core" r="7"/><text class="node-name" x="26" y="-2">${esc(w.mapLabel || w.name)}</text><text class="node-meta" x="26" y="17">${esc(location)}</text></g>`;
      }).join('') + '</svg></div>');
    renderCard();
  }

  function init() {
    const spinner = document.createElement('div');
    spinner.className = 'scene-loading';
    sceneHost.appendChild(spinner);
    // Yield a frame so the spinner paints before the (synchronous) scene
    // build hogs the main thread, then swap it out once the first view is set.
    requestAnimationFrame(() => setTimeout(() => {
      try {
        scene = window.YakeScene.create(sceneHost, id => id ? selectWorld(id) : (win() && win().closePane(worldPane)), fallback, id => { selectWorld(id); scene.select(id); scene.focus(); });
        scene.setView('system', null);
      } catch (error) { console.error('[yake] scene create failed:', error && error.stack || error); fallback(); }
      spinner.remove();
      readLocation();
      // First look at the atlas on a roomy screen opens the system notes;
      // once closed they stay closed.
      let notes = null;
      try { notes = localStorage.getItem(NOTES_KEY); } catch (e) {}
      if (!selected && view === 'system' && notes !== 'closed' && matchMedia('(min-width: 900px) and (min-height: 700px)').matches && win()) win().openPane(systemPane);
    }, 40));
  }

  document.addEventListener('click', event => {
    if (!event.target.closest('.atlas-shell')) return;
    const ring = event.target.closest('[data-select-world]');
    if (ring) { selectWorld(ring.dataset.selectWorld); return; }
    const destinationView = event.target.closest('[data-open-view]');
    if (destinationView) {
      setView(destinationView.dataset.openView);
      field.querySelector('canvas, g[data-world]')?.focus({preventScroll:true});
      return;
    }
    if (event.target.closest('[data-close-view]')) {
      setView('system');
      field.querySelector('canvas, g[data-world]')?.focus({preventScroll:true});
      return;
    }
    const world = event.target.closest('[data-world]');
    if (world) { selectWorld(world.dataset.world); return; }
    const action = event.target.closest('[data-scene-action]');
    if (!action) return;
    const kind = action.dataset.sceneAction;
    if (kind === 'home') { resetView(); return; }
    if (!scene) return;
    if (kind === 'focus') { if (win()) win().closePane(worldPane, {returnFocus:false}); scene.focus(true); field.querySelector('canvas')?.focus({preventScroll:true}); }
    if (kind.startsWith('surface-')) { region = kind.slice(8); scene.surface(region); renderCard(); }
    if (kind === 'in') scene.zoom(.8);
    if (kind === 'out') scene.zoom(1.25);
    if (kind === 'labels') action.setAttribute('aria-pressed',scene.toggleLabels());
  });
  field.addEventListener('keydown', event => {
    const target = event.target.closest('g[data-world]');
    if (target && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); selectWorld(target.dataset.world); }
  });
  // Escape: open panes close first (map-window.js), then a moon window
  // returns to the system map, then an expanded window collapses.
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.defaultPrevented || win()?.hasOpenPane()) return;
    if (view !== 'system') { event.preventDefault(); setView('system'); field.querySelector('canvas, g[data-world]')?.focus({preventScroll:true}); }
  });
  function readLocation() {
    const id = location.hash.slice(1);
    if (id.startsWith('view=') && moonViews.includes(id.slice(5))) setView(id.slice(5));
    else if (worlds.has(id)) selectWorld(id);
    else setView('system');
  }
  window.addEventListener('hashchange', readLocation);
  // Panes opening or closing move the areas labels must avoid.
  document.addEventListener('mapwindow:layout', () => scene?.redraw());
  init();
})();
