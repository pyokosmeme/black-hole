/* Map window behaviour shared by every map page:
 *  - expand/collapse the application panel (no browser fullscreen);
 *  - panes: secondary windows over the map ([data-map-pane]) with a close
 *    button ([data-pane-close]) and optional openers ([data-pane-toggle=id]);
 *  - Escape closes the most recently opened pane first, then collapses. */
(function () {
  'use strict';
  const panel = document.querySelector('[data-map-window]');
  if (!panel) return;
  const button = panel.querySelector('[data-window-expand]');
  const open = [];
  const notify = () => document.dispatchEvent(new CustomEvent('mapwindow:layout'));
  function setExpanded(expanded) {
    panel.classList.toggle('is-expanded', expanded);
    document.body.classList.toggle('map-window-expanded', expanded);
    button.setAttribute('aria-pressed', String(expanded));
    button.title = expanded ? 'Collapse window' : 'Expand window';
    button.setAttribute('aria-label', button.title);
    // Existing SVG and WebGL viewers already respond to resize.
    window.dispatchEvent(new Event('resize'));
    notify();
  }
  const paneOf = target => typeof target === 'string' ? document.getElementById(target) : target;
  // A content-sized pane only displaces the bottom-corner controls when it
  // actually reaches down to them.
  function fitPanes() {
    document.querySelectorAll('.map-viewport').forEach(view => {
      const shown = [...view.querySelectorAll('[data-map-pane]')].filter(p => !p.hidden);
      const bottom = view.getBoundingClientRect().bottom;
      view.classList.toggle('has-pane', shown.length > 0);
      view.classList.toggle('pane-reaches-bottom', shown.some(p => p.getBoundingClientRect().bottom > bottom - 64));
    });
  }
  // Phones pin the controls to the top right, beside the view title and
  // pickers. Reserve the controls' measured width for them, and move them to a
  // second row when the title/picker row cannot fit beside them.
  const phone = window.matchMedia('(max-width: 600px) and (min-height: 501px)');
  function fitHud() {
    document.querySelectorAll('.map-viewport').forEach(view => {
      const tl = view.querySelector(':scope > .map-hud-tl'), br = view.querySelector(':scope > .map-hud-br');
      if (!tl || !br) return;
      // Pages may build their HUD after this script runs; watch it once seen.
      [tl, br].forEach(el => { if (hudSizes && !el.dataset.observed) { hudSizes.observe(el); el.dataset.observed = '1'; } });
      // The hint (bottom left) and phone title row both leave room for it.
      const controls = br.getBoundingClientRect().width;
      view.style.setProperty('--hud-controls-w', (controls + 8) + 'px');
      if (!phone.matches) { view.classList.remove('hud-stack'); return; }
      const inset = parseFloat(getComputedStyle(view).getPropertyValue('--hud-inset')) || 6;
      view.classList.add('hud-measure');
      const natural = tl.getBoundingClientRect().width;
      view.classList.remove('hud-measure');
      const stack = natural > view.clientWidth - 2 * inset - controls - 8;
      view.classList.toggle('hud-stack', stack);
      view.style.setProperty('--hud-tl-h', tl.getBoundingClientRect().height + 'px');
    });
  }
  const hudSizes = window.ResizeObserver ? new ResizeObserver(fitHud) : null;
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { fitHud(); notify(); });
  const paneSizes = window.ResizeObserver ? new ResizeObserver(() => { fitPanes(); notify(); }) : null;
  window.addEventListener('resize', () => { fitHud(); fitPanes(); });
  function syncPanes() {
    document.querySelectorAll('[data-map-pane]').forEach(pane => {
      if (paneSizes && !pane.dataset.observed) { paneSizes.observe(pane); pane.dataset.observed = '1'; }
    });
    fitPanes();
    document.querySelectorAll('[data-pane-toggle]').forEach(opener => {
      const pane = document.getElementById(opener.dataset.paneToggle);
      if (pane) opener.setAttribute('aria-expanded', String(!pane.hidden));
    });
    notify();
  }
  // A tap can open a pane under the finger: map pages select a world or add a
  // station on pointerup, and on phones the pane is a bottom sheet. The
  // browser then delivers that same tap's click to whatever now sits there
  // (a double-tap on a world name pressed "explore moons"). Swallow that one
  // click when it lands in a pane; panes opened by a click or key are unaffected.
  let lastUp = null, ghostUntil = 0;
  document.addEventListener('pointerup', () => { lastUp = {t: performance.now(), pending: true}; }, true);
  document.addEventListener('click', event => {
    const guarded = performance.now() < ghostUntil;
    ghostUntil = 0;
    if (lastUp) lastUp.pending = false;
    if (guarded && event.target.closest && event.target.closest('[data-map-pane]')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  function openPane(target, options = {}) {
    const pane = paneOf(target);
    if (!pane) return;
    if (lastUp && lastUp.pending && performance.now() - lastUp.t < 100) ghostUntil = performance.now() + 700;
    // One pane per viewport: a new window replaces the one it would cover.
    const view = pane.closest('.map-viewport');
    if (view) view.querySelectorAll('[data-map-pane]').forEach(other => { if (other !== pane && !other.hidden) closePane(other, {silent:true}); });
    pane.hidden = false;
    const at = open.indexOf(pane);
    if (at >= 0) open.splice(at, 1);
    open.push(pane);
    if (options.opener) pane.opener = options.opener;
    syncPanes();
    if (options.focus) (pane.querySelector('[data-pane-close]') || pane).focus({preventScroll:true});
    pane.dispatchEvent(new CustomEvent('pane:open'));
  }
  function closePane(target, options = {}) {
    const pane = paneOf(target);
    if (!pane || pane.hidden) return;
    pane.hidden = true;
    const at = open.indexOf(pane);
    if (at >= 0) open.splice(at, 1);
    syncPanes();
    pane.dispatchEvent(new CustomEvent('pane:close'));
    if (!options.silent && options.returnFocus !== false && pane.opener && document.contains(pane.opener)) pane.opener.focus({preventScroll:true});
  }
  document.addEventListener('click', event => {
    const close = event.target.closest('[data-pane-close]');
    if (close) { closePane(close.closest('[data-map-pane]')); return; }
    const toggle = event.target.closest('[data-pane-toggle]');
    if (!toggle) return;
    const pane = document.getElementById(toggle.dataset.paneToggle);
    if (!pane) return;
    if (pane.hidden) openPane(pane, {opener:toggle, focus:true}); else closePane(pane);
  });
  button.addEventListener('click', () => setExpanded(!panel.classList.contains('is-expanded')));
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    const top = open[open.length - 1];
    if (top) { event.preventDefault(); closePane(top); return; }
    if (!panel.classList.contains('is-expanded')) return;
    event.preventDefault();
    setExpanded(false);
    button.focus({preventScroll:true});
  });
  window.MapWindow = {
    collapse: () => setExpanded(false),
    openPane, closePane,
    isOpen: target => { const pane = paneOf(target); return !!pane && !pane.hidden; },
    hasOpenPane: () => open.length > 0,
    // For pages that build their viewport overlays and panes in script.
    refresh: () => { fitHud(); syncPanes(); }
  };
  document.querySelectorAll('[data-map-pane]').forEach(pane => { if (!pane.hidden) open.push(pane); });
  fitHud();
  setExpanded(false);
  syncPanes();
})();
