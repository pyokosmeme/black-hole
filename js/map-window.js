/* Expand the application panel without changing browser fullscreen or navigation. */
(function () {
  'use strict';
  const panel = document.querySelector('[data-map-window]');
  if (!panel) return;
  const button = panel.querySelector('[data-window-expand]');
  function setExpanded(expanded) {
    panel.classList.toggle('is-expanded', expanded);
    document.body.classList.toggle('map-window-expanded', expanded);
    button.setAttribute('aria-pressed', String(expanded));
    button.title = expanded ? 'Collapse window' : 'Expand window';
    button.setAttribute('aria-label', button.title);
    // Existing SVG and WebGL viewers already respond to resize.
    window.dispatchEvent(new Event('resize'));
  }
  button.addEventListener('click', () => setExpanded(!panel.classList.contains('is-expanded')));
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.defaultPrevented || !panel.classList.contains('is-expanded')) return;
    setExpanded(false);
    button.focus({preventScroll:true});
  });
  window.MapWindow = {collapse: () => setExpanded(false)};
  setExpanded(false);
})();
