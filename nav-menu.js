/**
 * NAV-MENU.JS
 * 
 * Drop-in navigation menu for acidburn-styled pages
 * Loads configuration from pagelayout.json
 * 
 * USAGE:
 * 1. Add to your page: <script src="nav-menu.js"></script>
 * 2. Add container in header: <div id="nav-menu"></div>
 * 3. Create pagelayout.json in root (or specify path)
 * 
 * OPTIONS (set before loading script):
 *   window.NAV_CONFIG_PATH = '/custom/path/pagelayout.json';
 */

(function() {
  'use strict';

  const CONFIG_PATH = window.NAV_CONFIG_PATH || '/pagelayout.json';
  // Navigation must remain usable while configuration loads or is unavailable.
  const FALLBACK_CONFIG = {
    pages: [
      { label: 'HOME', url: '/', icon: '⌂' },
      { label: 'A MOTE IN SHADOW', url: '/ams.html', icon: '◬' },
      { label: 'SPECULATIVE FUTURES', url: '/futures.html', icon: '⌥' },
      { label: 'MAPS', icon: '⬡', children: [
        { label: 'Maps Hub', url: '/maps.html', icon: '✦' },
        { label: 'Ya Ke System Atlas', url: '/yake.html', icon: '◈' },
        { label: 'Transit Network', url: '/exu2374.html', icon: '→' }
      ] }
    ]
  };

  // ═══════════════════════════════════════════════════════════════
  // INJECT STYLES
  // ═══════════════════════════════════════════════════════════════

  const styles = `
    /* Nav Menu Container */
    .nav-menu {
      position: relative;
      z-index: 100;
      font-family: 'Share Tech Mono', 'Courier New', monospace;
    }

    /* Container Positioning */
    .nav-menu {
      position: relative;
      display: inline-flex;
      align-items: center;
      flex-shrink: 0;
    }

    /* Menu Toggle Button */
    .nav-control {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: 44px;
      min-height: 44px;
      box-sizing: border-box;
      text-decoration: none;
      gap: 10px;
      padding: 6px 10px;
      background: transparent;
      border: none;
      color: #00ffff;
      font-family: 'Orbitron', 'Share Tech Mono', sans-serif;
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 2px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .nav-control:hover {
      color: #fff;
      text-shadow: 0 0 10px rgba(0, 255, 255, 0.5);
    }

    /* Light Mode Overrides */
    .nav-control:focus-visible,
    .nav-link:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: -3px;
    }

    .nav-home svg {
      width: 20px;
      height: 20px;
    }

    body.light-reading .nav-control,
    body.light-mode .nav-control {
      background: transparent;
      border: none;
      color: #bf00ff;
    }

    body.light-reading .nav-control:hover,
    body.light-mode .nav-control:hover {
      color: #6a3a72;
      text-shadow: 0 0 10px rgba(191, 0, 255, 0.3);
    }

    /* Light Mode Dropdown */
    body.light-reading .nav-dropdown,
    body.light-mode .nav-dropdown {
      background: rgba(253, 250, 245, 0.98);
      border-color: #bf00ff;
      color: #2e2a26;
    }

    body.light-reading .nav-link,
    body.light-mode .nav-link {
      color: #2e2a26;
      border-bottom-color: rgba(191, 0, 255, 0.1);
    }

    body.light-reading .nav-link:hover,
    body.light-mode .nav-link:hover {
      background: rgba(191, 0, 255, 0.05);
      color: #bf00ff;
    }

    /* Active page indicator in light mode */
    body.light-reading .nav-link.active,
    body.light-mode .nav-link.active {
      background: rgba(191, 0, 255, 0.1);
      border-left-color: #bf00ff;
    }

    body.light-reading .nav-link.active .nav-link-label,
    body.light-mode .nav-link.active .nav-link-label {
      color: #bf00ff;
    }

    body.light-reading .nav-submenu,
    body.light-mode .nav-submenu {
      background: rgba(0, 0, 0, 0.03);
    }

    .nav-toggle-icon {
      font-size: 16px;
      transition: transform 0.3s ease;
      -webkit-text-stroke: 0;
      text-shadow: none;
    }

    .nav-menu.open .nav-toggle-icon {
      transform: rotate(90deg);
    }

    /* Dropdown Panel */
    .nav-dropdown {
      position: absolute;
      top: calc(100% + 10px);
      left: 50%;
      transform: translateX(-50%) translateY(-10px);
      min-width: 220px;
      max-height: calc(100vh - 70px);
      max-height: calc(100dvh - 70px);
      overflow-y: auto;
      background: rgba(2, 2, 8, 0.95);
      color: #fff;
      border: 2px solid #bf00ff;
      backdrop-filter: blur(15px);
      opacity: 0;
      visibility: hidden;
      transition: all 0.2s ease;
      z-index: 9999;
    }

    .nav-menu.open .nav-dropdown {
      opacity: 1;
      visibility: visible;
      transform: translateX(-50%) translateY(0);
    }

    /* Tiger stripe top border */
    .nav-dropdown::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: 
        repeating-linear-gradient(-55deg, #bf00ff 0px, #bf00ff 4px, transparent 4px, transparent 8px),
        repeating-linear-gradient(55deg, #00ffff 0px, #00ffff 3px, transparent 3px, transparent 10px),
        linear-gradient(90deg, #bf00ff, #00ffff, #bf00ff);
    }

    /* Menu Items */
    .nav-item {
      position: relative;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 20px;
      color: #fff;
      text-decoration: none;
      font-size: 13px;
      letter-spacing: 1px;
      border-bottom: 1px solid rgba(191, 0, 255, 0.2);
      transition: all 0.15s ease;
      cursor: pointer;
    }

    button.nav-link {
      width: 100%;
      background: transparent;
      border: 0;
      border-bottom: 1px solid rgba(191, 0, 255, 0.2);
      font-family: inherit;
      text-align: left;
    }

    .nav-link:hover {
      background: rgba(0, 255, 255, 0.1);
      color: #00ffff;
    }

    .nav-link-icon {
      color: #bf00ff;
      font-size: 14px;
      width: 20px;
      text-align: center;
    }

    .nav-link:hover .nav-link-icon {
      color: #00ffff;
      text-shadow: 0 0 10px #00ffff;
    }

    .nav-link-label {
      flex: 1;
    }

    .nav-link-arrow {
      font-size: 10px;
      color: #bf00ff;
      transition: transform 0.2s ease;
    }

    .nav-item.open > .nav-link .nav-link-arrow {
      transform: rotate(90deg);
    }

    /* Active page indicator */
    .nav-link.active {
      background: rgba(191, 0, 255, 0.15);
      border-left: 3px solid #00ffff;
    }

    .nav-link.active .nav-link-label {
      color: #00ffff;
    }

    /* Submenu */
    .nav-submenu {
      max-height: 0;
      overflow: hidden;
      background: rgba(0, 0, 0, 0.3);
      transition: max-height 0.3s ease;
    }

    .nav-item.open > .nav-submenu {
      max-height: 500px;
    }

    .nav-submenu .nav-link {
      padding-left: 50px;
      font-size: 12px;
      border-bottom-color: rgba(0, 255, 255, 0.1);
    }

    .nav-submenu .nav-link:hover {
      /* color/bg inherited from .nav-link:hover */
    }

    .nav-submenu .nav-link-icon {
      font-size: 12px;
      color: #00ffff;
      opacity: 0.7;
    }

    /* Last item no border */
    .nav-item:last-child > .nav-link {
      border-bottom: none;
    }

    @media (prefers-reduced-motion: reduce) {
      .nav-menu * { transition: none; }
    }

    /* Mobile adjustments */
    @media (max-width: 768px) {
      .nav-control {
        padding: 4px 6px;
        font-size: 11px;
      }

      .nav-dropdown {
        position: fixed;
        top: 56px;
        left: 10px;
        right: 10px;
        transform: translateY(-10px);
        min-width: auto;
        width: auto;
      }

      .nav-menu.open .nav-dropdown {
        transform: translateY(0);
      }

      .nav-toggle-label {
        display: none;
      }
    }
  `;

  // Inject styles
  const styleEl = document.createElement('style');
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);

  // ═══════════════════════════════════════════════════════════════
  // LOAD CONFIG AND BUILD MENU
  // ═══════════════════════════════════════════════════════════════

  async function init() {
    const container = document.getElementById('nav-menu');
    if (!container) {
      console.warn('[nav-menu] No #nav-menu container found');
      return;
    }

    container.innerHTML = buildMenu(FALLBACK_CONFIG);
    container.classList.add('nav-menu');
    const header = container.closest('.header-bar');
    if (header && document.querySelector('script[src*="acidburn-mode.js"]')) {
      header.prepend(container.querySelector('.nav-home'));
      header.appendChild(container);
    }
    attachEventListeners(container);
    markActivePage(container);
    window.dispatchEvent(new CustomEvent('acidburn-nav-ready'));

    try {
      const response = await fetch(CONFIG_PATH);
      if (!response.ok) throw new Error('Failed to load pagelayout.json');
      const config = await response.json();
      if (!Array.isArray(config.pages) || !config.pages.length) {
        throw new Error('Navigation configuration has no pages');
      }
      // Keep the visible controls and open state intact during loading.
      const dropdown = container.querySelector('.nav-dropdown');
      if (dropdown.contains(document.activeElement)) return;
      dropdown.querySelector('.nav-pages').innerHTML = config.pages.map(page => buildMenuItem(page)).join('');
      container.querySelector('.nav-toggle-icon').textContent = config.menuIcon || '☰';
      markActivePage(container);
    } catch (error) {
      console.warn('[nav-menu] Using fallback navigation:', error);
    }
  }

  function buildMenu(config) {
    const pagesHtml = config.pages.map(page => buildMenuItem(page)).join('');

    return `
      <button type="button" class="nav-control nav-toggle" aria-label="Menu" aria-expanded="false" aria-controls="nav-dropdown">
        <span class="nav-toggle-icon" aria-hidden="true">${config.menuIcon || '☰'}</span>
      </button>
      <a class="nav-control nav-home" href="/" aria-label="Home" title="Home">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10 12 3l9 7M5 9v12h5v-7h4v7h5V9"/></svg>
      </a>
      <nav class="nav-dropdown" id="nav-dropdown" aria-label="Site navigation">
        <div class="nav-pages">${pagesHtml}</div>
        <div class="nav-mode-slot"></div>
      </nav>
    `;
  }

  function buildMenuItem(item) {
    const hasChildren = item.children && item.children.length > 0;
    const icon = item.icon || '◇';
    
    if (hasChildren) {
      const childrenHtml = item.children.map(child => buildMenuItem(child)).join('');
      return `
        <div class="nav-item">
          <button type="button" class="nav-link" data-has-children="true" aria-expanded="false">
            <span class="nav-link-icon">${icon}</span>
            <span class="nav-link-label">${item.label}</span>
            <span class="nav-link-arrow">▶</span>
          </button>
          <div class="nav-submenu" inert>
            ${childrenHtml}
          </div>
        </div>
      `;
    } else {
      return `
        <div class="nav-item">
          <a class="nav-link" href="${item.url || '#'}">
            <span class="nav-link-icon">${icon}</span>
            <span class="nav-link-label">${item.label}</span>
          </a>
        </div>
      `;
    }
  }

  function attachEventListeners(container) {
    // Toggle main menu
    const toggle = container.querySelector('.nav-toggle');
    
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      container.classList.toggle('open');
      toggle.setAttribute('aria-expanded', container.classList.contains('open'));
    });

    // Toggle submenus
    container.addEventListener('click', (e) => {
      const link = e.target.closest('.nav-link[data-has-children]');
      if (link) {
        e.preventDefault();
        e.stopPropagation();
        const item = link.closest('.nav-item');
        item.classList.toggle('open');
        const open = item.classList.contains('open');
        link.setAttribute('aria-expanded', open);
        item.querySelector('.nav-submenu').inert = !open;
      }
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) {
        container.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });

    // Close on escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && container.classList.contains('open')) {
        container.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
  }

  function markActivePage(container) {
    const currentPath = window.location.pathname;
    const links = container.querySelectorAll('.nav-link[href]');
    
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (href === currentPath || 
          (href !== '/' && currentPath.startsWith(href))) {
        link.classList.add('active');
        
        // Open parent submenu if in one
        const parentItem = link.closest('.nav-submenu')?.closest('.nav-item');
        if (parentItem) {
          parentItem.classList.add('open');
          parentItem.querySelector('[data-has-children]').setAttribute('aria-expanded', 'true');
          parentItem.querySelector('.nav-submenu').inert = false;
        }
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // INIT ON LOAD
  // ═══════════════════════════════════════════════════════════════

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
