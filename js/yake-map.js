/* Static, responsive orientation charts. No simulated orbital motion. */
(function () {
  'use strict';
  const data = window.YAKE_ATLAS;
  const worlds = new Map(data.worlds.map(world => [world.id, world]));
  const field = document.getElementById('orbital-field');
  const detail = document.getElementById('world-detail');
  const search = document.getElementById('world-search');
  const mobile = window.matchMedia('(max-width: 600px)');
  let view = 'system';
  let selected = 'celosia';
  const esc = value => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const numeric = value => Number(value).toLocaleString('en-US');
  const distance = world => world.au ? world.au + ' AU' : world.km ? numeric(world.km) + ' km' : 'ORBIT UNSPECIFIED';
  const buttons = ids => ids.map(id => `<button type="button" data-world="${id}" aria-pressed="${id === selected}">${esc(worlds.get(id).name)}</button>`).join('');

  function node(id, x, y, label, side) {
    const w = worlds.get(id);
    const offset = side === 'left' ? -24 : 24;
    const anchor = side === 'left' ? 'end' : 'start';
    return `<g class="atlas-node" data-world="${id}" tabindex="0" role="button" aria-label="${esc(w.name + ', ' + label)}" aria-pressed="${selected === id}" style="--body-color:${w.color}" transform="translate(${x},${y})"><title>${esc(w.name + ' · ' + label)}</title><circle class="hit" r="28"/><circle class="node-ring" r="14"/><circle class="node-core" r="7"/><text class="node-name" x="${offset}" y="-3" text-anchor="${anchor}">${esc(w.name)}</text><text class="node-meta" x="${offset}" y="15" text-anchor="${anchor}">${esc(label)}</text></g>`;
  }

  function parentNode(id, x, y) {
    return `<g class="atlas-node" data-world="${id}" tabindex="0" role="button" aria-label="${esc(worlds.get(id).name)}" aria-pressed="${selected === id}"><circle class="hit" cx="${x}" cy="${y}" r="30"/><circle class="node-ring" style="--body-color:#edc575" cx="${x}" cy="${y}" r="28"/><circle class="atlas-parent" cx="${x}" cy="${y}" r="19"/><text x="${x}" y="${y+51}" text-anchor="middle">${esc(worlds.get(id).name)}</text></g>`;
  }

  function orbitRadius(value, cfg) {
    const points = cfg.nodes.map(([id, radius]) => [worlds.get(id).km, radius]);
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
      const height = 115 + cfg.nodes.length * 66;
      let svg = `<svg viewBox="0 0 380 ${height}" role="group" aria-label="${esc(cfg.title)}"><text class="field-label gold" x="28" y="29">OUTWARD FROM ${esc(worlds.get(cfg.parent).name.toUpperCase())}</text><path class="orbit" d="M 52 48 V ${height-40}"/>`;
      cfg.nodes.forEach(([id], i) => {
        const w = worlds.get(id), y = 74 + i*66;
        if (cfg.ez && w.km > cfg.ez && (i === 0 || worlds.get(cfg.nodes[i-1][0]).km < cfg.ez)) {
          svg += `<path class="orbit ez" d="M 22 ${y-34} H 354"/><text class="field-label gold" x="175" y="${y-39}">EZ BOUNDARY</text>`;
        }
        svg += node(id, 52, y, distance(w), 'right');
      });
      return svg + `<text class="field-label" x="28" y="${height-15}">ORDERED ORBITAL STRIP · NOT TO SCALE</text></svg>`;
    }
    let svg = `<svg viewBox="0 0 840 700" role="group" aria-label="${esc(cfg.title)}"><defs><pattern id="field-stars" width="117" height="93" patternUnits="userSpaceOnUse"><circle cx="13" cy="28" r=".7" fill="#71869d" opacity=".3"/><circle cx="87" cy="73" r=".5" fill="#71869d" opacity=".3"/></pattern></defs><rect width="840" height="700" fill="url(#field-stars)"/><text class="field-label" x="26" y="32">${esc(cfg.unit === 'AU' ? 'HELIOCENTRIC ORIENTATION' : 'PLANETOCENTRIC ORIENTATION')}</text><path class="orbit" d="M 400 350 H 440 M 420 330 V 370"/>`;
    // Share a ring for bodies at the same plotted orbital radius.
    [...new Set(cfg.nodes.map(n => n[1]))].forEach(radius => {
      const active = cfg.nodes.some(n => n[1] === radius && n[0] === selected);
      svg += `<circle class="orbit${active?' selected':''}" cx="420" cy="350" r="${radius}"/>`;
    });
    if (cfg.ez) {
      const r = orbitRadius(cfg.ez, cfg);
      svg += `<circle class="orbit ez" cx="420" cy="350" r="${r}"/><text class="field-label gold" x="420" y="${350+r+15}" text-anchor="middle">EZ / ${numeric(cfg.ez)} km</text>`;
    }
    svg += parentNode(cfg.parent, 420, 350);
    cfg.nodes.forEach(([id, radius, angle]) => {
      const a = angle*Math.PI/180, x = 420+radius*Math.cos(a), y = 350+radius*Math.sin(a);
      svg += node(id, x, y, distance(worlds.get(id)), x<390?'left':'right');
    });
    return svg + '<text class="field-label" x="26" y="676">ANGULAR POSITIONS ARE SCHEMATIC</text></svg>';
  }

  function habitatChart() {
    if (mobile.matches) {
      let svg = '<svg viewBox="0 0 380 560" role="group" aria-label="Habitat location directory"><text class="field-label gold" x="26" y="28">STATIONS & THEIR NEIGHBORHOODS</text>';
      data.views.habitats.members.forEach((id,i) => {
        const w = worlds.get(id);
        svg += node(id, 38, 75+i*65, worlds.get(w.parent).name, 'right');
      });
      return svg+'</svg>';
    }
    let svg = '<svg viewBox="0 0 840 540" role="group" aria-label="Habitat location hierarchy">';
    const columns = [{x:95,name:'JIN',ids:['dajinmen','fengsheng','marassa']},{x:405,name:'SHU',ids:['dto']},{x:640,name:'CELOSIA',ids:['celosia-hubs']}];
    columns.forEach(col => {
      svg += `<text class="field-label gold" x="${col.x}" y="48">${col.name}</text><path class="orbit" d="M ${col.x} 63 V ${97+col.ids.length*86}"/>`;
      col.ids.forEach((id,i) => { svg += node(id,col.x,110+i*86,worlds.get(id).kind.split(' · ')[0],'right'); });
    });
    svg += '<path class="orbit" d="M 95 297 V 360 H 460 M 130 360 V 390 M 460 360 V 390"/>';
    svg += node('buka',130,415,'AGRICULTURE','right') + node('chawkee',460,415,'INDUSTRY & CULTURE','right');
    return svg+'<text class="field-label" x="26" y="514">BRANCHES INDICATE LOCATION, NOT FLIGHT ROUTES</text></svg>';
  }

  function renderChart() {
    const cfg = data.views[view];
    document.getElementById('chart-title').textContent = cfg.title;
    document.getElementById('chart-scale').textContent = cfg.caption;
    document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === view));
    field.innerHTML = view === 'habitats' ? habitatChart() : orbitalChart(cfg);
    if (cfg.unplaced) field.insertAdjacentHTML('beforeend', `<div class="unplaced-worlds"><p class="eyebrow">${view === 'outer'?'LOCAL & DISPERSED DESTINATIONS':'MOONS WITH UNSPECIFIED ORBITS'}</p><div class="related-worlds">${buttons(cfg.unplaced)}</div></div>`);
    field.insertAdjacentHTML('beforeend', `<div class="field-selection"><span>SELECTED / ${esc(worlds.get(selected).name)}</span><button type="button" data-show-detail>VIEW RECORD ↓</button></div>`);
  }

  function renderDetail() {
    const w = worlds.get(selected);
    let html = `<div class="detail-top"><div><p class="eyebrow">${esc(w.kind)}</p><h2 tabindex="-1" id="record-title">${esc(w.name)}</h2></div><span class="world-number">${esc(w.no || 'LOCAL')}</span></div>`;
    html += `<p class="lead">${esc(w.intro)}</p>`;
    if (w.art) html += `<div class="world-art ${w.art}" role="img" aria-label="${esc(w.name)} reference artwork; full sheet below"></div>`;
    if (w.stats) html += '<dl class="world-stats">' + w.stats.map(([k,v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('') + '</dl>';
    (w.paragraphs || []).forEach(p => { html += `<p>${esc(p)}</p>`; });
    if (w.places) html += '<h3>Places & infrastructure</h3><ul class="settlement-list">' + w.places.map(([name,desc]) => `<li>${esc(name)}<span>${esc(desc)}</span></li>`).join('') + '</ul>';
    (w.notes || []).forEach(p => { html += `<p class="atlas-note">${esc(p)}</p>`; });
    if (['jin','shu','marassa'].includes(selected)) html += `<button type="button" data-open-view="${selected === 'marassa'?'habitats':selected}">EXPLORE ${selected === 'marassa'?'HABITATS':'MOON SYSTEM'} ↗</button>`;
    if (w.related) html += `<h3>Explore nearby</h3><div class="related-worlds">${buttons(w.related)}</div>`;
    if (w.image) html += `<details class="reference-sheet"><summary>${esc(w.imageLabel)}</summary><img src="img/yake/${w.image}" alt="${esc(w.imageLabel)}" loading="lazy"><a href="img/yake/${w.image}" target="_blank" rel="noopener">OPEN FULL REFERENCE ↗</a></details>`;
    detail.innerHTML = html;
  }

  function renderDirectory() {
    const query = search.value.trim().toLocaleLowerCase();
    const matches = data.worlds.filter(w => JSON.stringify(w).toLocaleLowerCase().includes(query));
    document.getElementById('destination-list').innerHTML = matches.map(w => `<button type="button" data-world="${w.id}" data-directory aria-pressed="${w.id===selected}"><strong>${esc(w.name)}</strong><small>${esc(w.kind)}</small></button>`).join('');
    document.getElementById('search-status').textContent = matches.length ? `${matches.length} destinations` : 'No destinations match. Try a world, moon, station, or settlement name.';
  }

  function viewFor(w) {
    if (data.views.habitats.members.includes(w.id)) return 'habitats';
    if (w.parent === 'jin' || w.parent === 'shu') return w.parent;
    if (w.parent === 'xuan' || w.id === 'minor') return 'outer';
    return 'system';
  }

  function selectWorld(id, changeView) {
    if (!worlds.has(id)) return;
    selected = id;
    if (changeView) view = viewFor(worlds.get(id));
    renderChart(); renderDetail(); renderDirectory();
    history.replaceState(null, '', '#' + selected);
    document.getElementById('selection-status').textContent = worlds.get(id).name + ' selected. Record updated below the chart.';
  }

  function showDetail() {
    document.getElementById('record-title').focus({preventScroll:true});
    detail.scrollIntoView({block:'start',behavior:'auto'});
  }

  document.querySelector('.atlas-shell').addEventListener('click', event => {
    const world = event.target.closest('[data-world]');
    if (world) {
      const fromDirectory = world.hasAttribute('data-directory');
      const fromDetail = !!world.closest('#world-detail');
      const keyboard = event.detail === 0;
      selectWorld(world.dataset.world, fromDirectory || fromDetail);
      if (fromDirectory || fromDetail) showDetail();
      else if (keyboard) field.querySelector(`[data-world="${selected}"]`)?.focus();
      return;
    }
    const tab = event.target.closest('[data-view], [data-open-view]');
    if (tab) {
      view = tab.dataset.view || tab.dataset.openView;
      const cfg = data.views[view];
      const visible = [cfg.parent, ...cfg.nodes.map(n => n[0]), ...(cfg.unplaced || []), ...(cfg.members || [])];
      if (!visible.includes(selected)) selected = view === 'habitats' ? 'marassa' : cfg.parent;
      selectWorld(selected, false);
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
  document.getElementById('atlas-reset').addEventListener('click', () => { view='system'; search.value=''; selectWorld('celosia',false); });
  search.addEventListener('input', renderDirectory);
  mobile.addEventListener('change', renderChart);
  window.addEventListener('hashchange', () => { const id=location.hash.slice(1); if(worlds.has(id)) selectWorld(id,true); });
  const initial = location.hash.slice(1);
  if(worlds.has(initial)) { selected=initial; view=viewFor(worlds.get(initial)); }
  renderChart(); renderDetail(); renderDirectory();
})();
