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

  const CONFIG_PATH = window.NAV_CONFIG_PATH || 'pagelayout.json';

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

    /* Menu Toggle Button */
    .nav-toggle {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 16px;
      background: rgba(0, 0, 0, 0.5);
      border: 2px solid #bf00ff;
      color: #00ffff;
      font-family: 'Orbitron', 'Share Tech Mono', sans-serif;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 2px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .nav-toggle:hover {
      background: rgba(191, 0, 255, 0.2);
      border-color: #00ffff;
      box-shadow: 0 0 15px rgba(0, 255, 255, 0.3);
    }

    .nav-toggle-icon {
      font-size: 16px;
      transition: transform 0.3s ease;
    }

    .nav-menu.open .nav-toggle-icon {
      transform: rotate(90deg);
    }

    .nav-toggle-arrow {
      font-size: 10px;
      transition: transform 0.3s ease;
    }

    .nav-menu.open .nav-toggle-arrow {
      transform: rotate(180deg);
    }

    /* Dropdown Panel */
    .nav-dropdown {
      position: fixed;
      top: 60px;
      left: 20px;
      min-width: 220px;
      background: rgba(5, 5, 15, 0.95);
      border: 2px solid #bf00ff;
      backdrop-filter: blur(10px);
      opacity: 0;
      visibility: hidden;
      transform: translateY(-10px);
      transition: all 0.2s ease;
      z-index: 9999;
    }

    .nav-menu.open .nav-dropdown {
      opacity: 1;
      visibility: visible;
      transform: translateY(0);
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

    .nav-link:hover {
      background: rgba(0, 255, 255, 0.1);
      color: #00ffff;
      padding-left: 25px;
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
      padding-left: 55px;
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

    /* Mobile adjustments */
    @media (max-width: 768px) {
      .nav-dropdown {
        left: 10px;
        right: 10px;
        min-width: auto;
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
    let config;
    
    try {
      const response = await fetch(CONFIG_PATH);
      if (!response.ok) throw new Error('Failed to load pagelayout.json');
      config = await response.json();
    } catch (error) {
      console.error('[nav-menu] Error loading config:', error);
      // Fallback config
      config = {
        siteName: "MENU",
        menuIcon: "☰",
        pages: []
      };
    }

    const container = document.getElementById('nav-menu');
    if (!container) {
      console.warn('[nav-menu] No #nav-menu container found');
      return;
    }

    container.innerHTML = buildMenu(config);
    container.classList.add('nav-menu');
    
    attachEventListeners(container);
    markActivePage(container);
  }

  function buildMenu(config) {
    const pagesHtml = config.pages.map(page => buildMenuItem(page)).join('');

    return `
      <button class="nav-toggle" aria-expanded="false" aria-controls="nav-dropdown">
        <span class="nav-toggle-icon">${config.menuIcon || '☰'}</span>
        <span class="nav-toggle-label">${config.siteName || 'MENU'}</span>
        <span class="nav-toggle-arrow">▼</span>
      </button>
      <nav class="nav-dropdown" id="nav-dropdown">
        ${pagesHtml}
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
          <div class="nav-link" data-has-children="true">
            <span class="nav-link-icon">${icon}</span>
            <span class="nav-link-label">${item.label}</span>
            <span class="nav-link-arrow">▶</span>
          </div>
          <div class="nav-submenu">
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
    const dropdown = container.querySelector('.nav-dropdown');
    
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      container.classList.toggle('open');
      toggle.setAttribute('aria-expanded', container.classList.contains('open'));
      
      // Position dropdown below toggle button
      if (container.classList.contains('open')) {
        const rect = toggle.getBoundingClientRect();
        dropdown.style.top = (rect.bottom + 8) + 'px';
        dropdown.style.left = rect.left + 'px';
      }
    });

    // Toggle submenus
    const parentLinks = container.querySelectorAll('.nav-link[data-has-children]');
    parentLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const item = link.closest('.nav-item');
        item.classList.toggle('open');
      });
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
      if (e.key === 'Escape') {
        container.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
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
