/* Static, responsive orientation charts. No simulated orbital motion. */
(function () {
  'use strict';
  const data = window.YAKE_ATLAS;
  const worlds = new Map(data.worlds.filter(world => !world.hidden).map(world => [world.id, world]));
  const field = document.getElementById('orbital-field');
  const detail = document.getElementById('world-detail');
  const search = document.getElementById('world-search');
  const mobile = window.matchMedia('(max-width: 600px)');
  let view = 'system';
  let selected = 'celosia';
  let presentation = '3d';
  let scene = null;
  let cardOpen = false;
  let fullRecord = false;
  let sceneError = false;
  const esc = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const numeric = value => Number(value).toLocaleString('en-US');
  const distance = world => world.au ? world.au + ' AU' : world.km ? numeric(world.km) + ' km' : world.parent === 'five' ? 'FIVE ISLANDS / 88.3 AU' : 'SCHEMATIC LOCATION';
  const entries = cfg => [...cfg.nodes, ...(cfg.locals || [])];
  const buttons = ids => ids.map(id => `<button class="acidburn-button" type="button" data-world="${id}" aria-pressed="${id === selected}">${esc(worlds.get(id).name)}</button>`).join('');

  function node(id, x, y, label, side) {
    const w = worlds.get(id);
    const offset = side === 'left' ? -24 : 24;
    const anchor = side === 'left' ? 'end' : 'start';
    return `<g class="atlas-node" data-world="${id}" tabindex="0" role="button" aria-label="${esc(w.name + ', ' + label)}" aria-pressed="${selected === id}" style="--body-color:${w.color}" transform="translate(${x},${y})"><title>${esc(w.name + ' · ' + label)}</title><circle class="hit" r="28"/><circle class="node-ring" r="14"/><circle class="node-core" r="7"/><text class="node-name" x="${offset}" y="-3" text-anchor="${anchor}">${esc(w.mapLabel || w.name)}</text><text class="node-meta" x="${offset}" y="15" text-anchor="${anchor}">${esc(label)}</text></g>`;
  }

  function parentNode(id, x, y) {
    return `<g class="atlas-node" data-world="${id}" tabindex="0" role="button" aria-label="${esc(worlds.get(id).name)}" aria-pressed="${selected === id}"><circle class="hit" cx="${x}" cy="${y}" r="30"/><circle class="node-ring" style="--body-color:#edc575" cx="${x}" cy="${y}" r="28"/><circle class="atlas-parent" cx="${x}" cy="${y}" r="19"/><text x="${x}" y="${y+51}" text-anchor="middle">${esc(worlds.get(id).name)}</text></g>`;
  }

  function orbitRadius(value, cfg) {
    const points = [[0,0], ...cfg.nodes.map(([id, radius]) => [worlds.get(id).km, radius]).filter(p => p[0]).sort((a,b) => a[0]-b[0])];
    for (let i=1; i<points.length; i++) {
      if (value <= points[i][0]) {
        const [lo, rlo] = points[i-1], [hi, rhi] = points[i];
        return rlo + (value-lo)/(hi-lo)*(rhi-rlo);
      }
    }
    return points[points.length-1][1];
  }

  function orbitalChart(cfg) {
    if (mobile.matches) {
      const height = 115 + entries(cfg).length * 66;
      let svg = `<svg viewBox="0 0 380 ${height}" role="group" aria-label="${esc(cfg.title)}"><text class="field-label gold" x="28" y="29">${esc(cfg.title.toUpperCase())}</text><path class="orbit" d="M 52 48 V ${height-40}"/>`;
      entries(cfg).forEach(([id], i) => {
        const w = worlds.get(id), y = 74 + i*66;
        if (cfg.ez && w.km > cfg.ez && (i === 0 || worlds.get(entries(cfg)[i-1][0]).km < cfg.ez)) {
          svg += `<path class="orbit ez" d="M 22 ${y-34} H 354"/><text class="field-label gold" x="175" y="${y-39}">EZ BOUNDARY</text>`;
        }
        svg += node(id, 52, y, distance(w), 'right');
      });
      return svg + `<text class="field-label" x="28" y="${height-15}">LOCAL DESTINATIONS · NOT TO SCALE</text></svg>`;
    }
    let svg = `<svg viewBox="0 0 840 700" role="group" aria-label="${esc(cfg.title)}"><defs><pattern id="field-stars" width="117" height="93" patternUnits="userSpaceOnUse"><circle cx="13" cy="28" r=".7" fill="#71869d" opacity=".3"/><circle cx="87" cy="73" r=".5" fill="#71869d" opacity=".3"/></pattern></defs><rect width="840" height="700" fill="url(#field-stars)"/><text class="field-label" x="26" y="32">${esc(cfg.unit === 'AU' ? 'HELIOCENTRIC ORIENTATION' : 'PLANETOCENTRIC ORIENTATION')}</text><path class="orbit" d="M 400 350 H 440 M 420 330 V 370"/>`;
    // Share a ring for bodies at the same plotted orbital radius.
    [...new Set((cfg.cluster ? [] : cfg.nodes).map(n => n[1]))].forEach(radius => {
      const active = cfg.nodes.some(n => n[1] === radius && n[0] === selected);
      svg += `<circle class="orbit${active?' selected':''}" cx="420" cy="350" r="${radius}"/>`;
    });
    if (cfg.ez) {
      const r = orbitRadius(cfg.ez, cfg);
      svg += `<circle class="orbit ez" cx="420" cy="350" r="${r}"/><text class="field-label gold" x="420" y="${350+r+15}" text-anchor="middle">EZ / ${numeric(cfg.ez)} km</text>`;
    }
    if (!cfg.cluster) svg += parentNode(cfg.parent, 420, 350);
    entries(cfg).forEach(([id, radius, angle]) => {
      const a = angle*Math.PI/180, x = 420+radius*Math.cos(a), y = 350+radius*Math.sin(a);
      svg += node(id, x, y, distance(worlds.get(id)), x<390 || x>590?'left':'right');
    });
    return svg + '<text class="field-label" x="26" y="676">ANGULAR POSITIONS ARE SCHEMATIC</text></svg>';
  }

  function renderChart() {
    const cfg = data.views[view];
    document.getElementById('chart-title').textContent = cfg.title;
    document.getElementById('chart-scale').textContent = cfg.caption;
    document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === view));
    document.querySelectorAll('[data-presentation]').forEach(b => b.setAttribute('aria-pressed', b.dataset.presentation === presentation));
    if (presentation === '3d') {
      if (!scene) {
        field.innerHTML = '<div class="atlas-scene"><div class="scene-heading"><span>YA KE / 3D EXPLORER</span><small>COMPRESSED DISTANCES · ILLUSTRATIVE SIZES</small></div><aside id="scene-card" class="author-card scene-card" aria-label="World information" hidden></aside><div class="author-card scene-controls"><button class="acidburn-button" type="button" data-scene-action="home" title="Fit system">⌂<span class="atlas-sr"> Fit system</span></button><button class="acidburn-button" type="button" data-scene-action="in" aria-label="Zoom in">+</button><button class="acidburn-button" type="button" data-scene-action="out" aria-label="Zoom out">−</button><button class="acidburn-button" type="button" data-scene-action="labels" aria-pressed="true">LABELS</button><button class="acidburn-button" type="button" data-scene-action="expand" aria-pressed="false">EXPAND</button></div><p class="scene-hint">DRAG TO ORBIT · SCROLL / PINCH TO ZOOM · RIGHT-DRAG / TWO FINGERS TO PAN</p></div><div id="scene-unplaced"></div>';
        try {
          scene = window.YakeScene.create(field.querySelector('.atlas-scene'), id => {
            if (id) selectWorld(id, false);
            else { cardOpen=false; scene.select(null); renderCard(); }
          }, () => {
            sceneError=true; presentation='2d'; collapseScene(); renderChart(); renderDetail();
          });
        } catch (error) {
          sceneError=true; presentation='2d'; collapseScene(); renderChart(); renderDetail();return;
        }
      }
      scene.setView(view, cardOpen ? selected : null);
      document.getElementById('scene-unplaced').innerHTML = cfg.unplaced ? `<div class="unplaced-worlds"><p class="post-date">${view === 'outer'?'LOCAL & DISPERSED DESTINATIONS':'ORBIT UNSPECIFIED · RECORDS ONLY'}</p><div class="related-worlds">${buttons(cfg.unplaced)}</div></div>` : '';
      document.getElementById('chart-scale').textContent = cfg.caption;
      renderCard();return;
    }
    if (scene) { scene.destroy();scene=null; }
    field.innerHTML = orbitalChart(cfg);
    if(sceneError) field.insertAdjacentHTML('afterbegin','<p class="atlas-note">3D is unavailable in this browser. The schematic and all world records are still available.</p>');
    if (cfg.unplaced) field.insertAdjacentHTML('beforeend', `<div class="unplaced-worlds"><p class="post-date">${view === 'outer'?'LOCAL & DISPERSED DESTINATIONS':'MOONS WITH UNSPECIFIED ORBITS'}</p><div class="related-worlds">${buttons(cfg.unplaced)}</div></div>`);
    field.insertAdjacentHTML('beforeend', `<div class="field-selection"><span>SELECTED / ${esc(worlds.get(selected).name)}</span><button class="acidburn-button" type="button" data-show-detail>VIEW RECORD ↓</button></div>`);
  }

  function renderCard() {
    const card=document.getElementById('scene-card');if(!card)return;
    card.hidden=!cardOpen;if(!cardOpen)return;
    const w=worlds.get(selected);
    card.innerHTML=`<button class="acidburn-button card-close" type="button" data-close-card aria-label="Close world card">×</button><p class="post-date">${esc(w.kind)}</p><div class="author-info"><h1>${esc(w.name)}</h1></div><p class="author-bio card-intro">${esc(w.intro)}</p>`;
    if(w.stats) card.innerHTML+='<dl class="card-stats">'+w.stats.slice(0,4).map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')+'</dl>';
    if(w.id==='celosia')card.innerHTML+='<p class="card-note">Orbit provisional: notes also give 4.55 AU.</p>';
    if(scene && !scene.hasBody(w.id) && !(view==='five' && w.id==='five'))card.innerHTML+='<p class="card-note">Position unspecified. Available as a record.</p>';
    card.innerHTML+='<div class="card-actions">'+(scene && scene.hasBody(selected)?'<button class="acidburn-button" type="button" data-scene-action="focus">FOCUS WORLD</button>':'')+'<button class="acidburn-button" type="button" data-show-detail>FULL RECORD ↗</button></div>';
    if(selected==='celosia')card.innerHTML+='<div class="card-actions" role="group" aria-label="View Celosia continents">'+['fusang','mu','diyu'].map(region=>`<button class="acidburn-button" type="button" data-scene-action="surface-${region}">${region.toUpperCase()}</button>`).join('')+'</div>';
    if(['jin','shu','xuan','five','marassa'].includes(selected))card.innerHTML+=`<button class="acidburn-button card-explore" type="button" data-open-view="${selected==='marassa'?'jin':selected}">EXPLORE ${selected==='five'?'FIVE ISLANDS':'MOON SYSTEM'} ↗</button>`;
  }

  function renderDetail() {
    const w = worlds.get(selected);
    let html = `<div class="detail-top"><div><p class="post-date">${esc(w.kind)}</p><h2 tabindex="-1" id="record-title">${esc(w.name)}</h2></div><span class="post-date">${esc(w.no || 'LOCAL')}</span></div>`;
    html += `<p class="lead">${esc(w.intro)}</p>`;
    if (w.art) html += `<div class="world-art ${w.art}" role="img" aria-label="${esc(w.name)} reference artwork; full sheet below"></div>`;
    if (w.stats) html += '<dl class="world-stats">' + w.stats.map(([k,v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('') + '</dl>';
    (w.paragraphs || []).forEach(p => { html += `<p>${esc(p)}</p>`; });
    if (w.places) html += '<h3>Places & infrastructure</h3><ul class="settlement-list">' + w.places.map(([name,desc]) => `<li>${esc(name)}<span>${esc(desc)}</span></li>`).join('') + '</ul>';
    (w.notes || []).forEach(p => { html += `<p class="atlas-note">${esc(p)}</p>`; });
    if (['jin','shu','xuan','five','marassa'].includes(selected)) html += `<button class="acidburn-button" type="button" data-open-view="${selected === 'marassa'?'jin':selected}">EXPLORE ${selected === 'five'?'FIVE ISLANDS':'MOON SYSTEM'} ↗</button>`;
    if (w.related) html += `<h3>Explore nearby</h3><div class="related-worlds">${buttons(w.related)}</div>`;
    if (w.image) html += `<details class="reference-sheet"><summary>${esc(w.imageLabel)}</summary><img src="img/yake/${w.image}" alt="${esc(w.imageLabel)}" loading="lazy"><a href="img/yake/${w.image}" target="_blank" rel="noopener">OPEN FULL REFERENCE ↗</a></details>`;
    detail.innerHTML = html;
    detail.hidden = presentation === '3d' && !fullRecord;
  }

  function renderDirectory() {
    const query = search.value.trim().toLocaleLowerCase();
    const matches = [...worlds.values()].filter(w => JSON.stringify(w).toLocaleLowerCase().includes(query));
    document.getElementById('destination-list').innerHTML = matches.map(w => `<a class="link-card" href="#${w.id}" data-world="${w.id}" data-directory aria-current="${w.id===selected?'location':'false'}"><div class="link-card-inner"><div class="link-text"><h3>${esc(w.name)}</h3><p>${esc(w.kind)}</p></div></div></a>`).join('');
    document.getElementById('search-status').textContent = matches.length ? `${matches.length} destinations` : 'No destinations match. Try a world, moon, station, or settlement name.';
  }

  function viewFor(w) {
    if (w.id === 'dajinmen') return 'system';
    if (w.parent === 'marassa') return 'jin';
    if (['jin','shu','xuan','five'].includes(w.parent)) return w.parent;
    if (w.id === 'minor') return 'outer';
    return 'system';
  }

  function selectWorld(id, changeView) {
    if (!worlds.has(id)) return;
    selected = id;
    cardOpen = true;
    if (changeView) view = viewFor(worlds.get(id));
    renderChart(); renderDetail(); renderDirectory();
    history.replaceState(null, '', '#' + selected);
    document.getElementById('selection-status').textContent = worlds.get(id).name + (presentation==='3d' ? ' selected. Information card opened in the scene.' : ' selected. Record updated below the chart.');
  }

  function showDetail() {
    fullRecord=true;detail.hidden=false;
    collapseScene();
    document.getElementById('record-title').focus({preventScroll:true});
    detail.scrollIntoView({block:'start',behavior:'auto'});
  }

  function collapseScene() {
    document.querySelector('.atlas-chart').classList.remove('is-expanded');document.body.classList.remove('atlas-expanded');
    const b=field.querySelector('[data-scene-action="expand"]');if(b){b.textContent='EXPAND';b.setAttribute('aria-pressed','false');}
  }

  document.querySelector('.atlas-shell').addEventListener('click', event => {
    const mode=event.target.closest('[data-presentation]');
    if(mode){presentation=mode.dataset.presentation;if(presentation==='2d')collapseScene();renderChart();renderDetail();return;}
    const action=event.target.closest('[data-scene-action]');
    if(action && scene){
      const kind=action.dataset.sceneAction;
      if(kind==='home')scene.home();
      if(kind==='focus')scene.focus();
      if(kind.startsWith('surface-'))scene.surface(kind.slice(8));
      if(kind==='in')scene.zoom(.8);
      if(kind==='out')scene.zoom(1.25);
      if(kind==='labels')action.setAttribute('aria-pressed',scene.toggleLabels());
      if(kind==='expand'){
        const expanded=document.querySelector('.atlas-chart').classList.toggle('is-expanded');
        document.body.classList.toggle('atlas-expanded',expanded);action.setAttribute('aria-pressed',expanded);action.textContent=expanded?'COLLAPSE':'EXPAND';
      }
      return;
    }
    if(event.target.closest('[data-close-card]')){cardOpen=false;scene?.select(null);renderCard();field.querySelector('canvas')?.focus({preventScroll:true});return;}
    const world = event.target.closest('[data-world]');
    if (world) {
      event.preventDefault();
      const fromDirectory = world.hasAttribute('data-directory');
      const fromDetail = !!world.closest('#world-detail');
      const keyboard = event.detail === 0;
      selectWorld(world.dataset.world, fromDirectory || fromDetail);
      if (fromDirectory || fromDetail) {
        if(presentation==='3d'){document.querySelector('.atlas-chart').scrollIntoView({block:'start'});field.querySelector('[data-close-card]')?.focus({preventScroll:true});}
        else showDetail();
      }
      else if (keyboard) field.querySelector(`[data-world="${selected}"]`)?.focus();
      return;
    }
    const tab = event.target.closest('[data-view], [data-open-view]');
    if (tab) {
      view = tab.dataset.view || tab.dataset.openView;
      const cfg = data.views[view];
      const visible = [cfg.parent, ...entries(cfg).map(n => n[0]), ...(cfg.unplaced || [])];
      if (!visible.includes(selected)) selected = cfg.parent;
      selectWorld(selected, false);
      // Enter a region with an unobstructed map; cards open on world picks.
      if (presentation === '3d') { cardOpen=false;scene?.select(null);renderCard(); }
      if (tab.dataset.openView) {
        document.querySelector(`[data-view="${view}"]`).focus();
        document.querySelector('.atlas-chart').scrollIntoView({block:'start'});
      }
    }
    if (event.target.closest('[data-show-detail]')) showDetail();
  });
  field.addEventListener('keydown', event => {
    const target = event.target.closest('g[data-world]');
    if (target && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      selectWorld(target.dataset.world, false);
      field.querySelector(`[data-world="${selected}"]`)?.focus();
    }
  });
  document.getElementById('atlas-reset').addEventListener('click', () => { view='system'; search.value=''; fullRecord=false; selectWorld('celosia',false); scene?.home(); });
  document.addEventListener('keydown', event => {
    if(event.key!=='Escape')return;
    if(cardOpen && presentation==='3d'){cardOpen=false;scene?.select(null);renderCard();field.querySelector('canvas')?.focus({preventScroll:true});}
    else collapseScene();
  });
  search.addEventListener('input', renderDirectory);
  mobile.addEventListener('change', renderChart);
  window.addEventListener('hashchange', () => { const id=location.hash.slice(1); if(worlds.has(id)) selectWorld(id,true); });
  const initial = location.hash.slice(1);
  if(worlds.has(initial)) { selected=initial; view=viewFor(worlds.get(initial)); cardOpen=true; }
  renderChart(); renderDetail(); renderDirectory();
})();
