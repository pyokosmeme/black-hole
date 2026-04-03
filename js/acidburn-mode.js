/**
 * ACIDBURN MODE TOGGLE
 * 
 * Manages display modes in a single cyclic button: BH (Black Hole), DARK, LIGHT
 */

(function() {
    'use strict';

    const body = document.body;
    // Default to 'bh' (Black Hole)
    let currentMode = localStorage.getItem('acidburn-mode') || 'bh';
    let lastStaticMode = localStorage.getItem('acidburn-static-mode') || 'dark';
    let webglSupported = true;
    let glitchInterval = null;
    
    // Icons configuration
    const MODE_INFO = {
        'bh': { icon: 'img/Black-Hole.svg', title: 'Black Hole Mode', next: 'dark' },
        'dark': { icon: 'img/Dark-Mode.svg', title: 'Dark Mode', next: 'light' },
        'light': { icon: 'img/Light-Mode.svg', title: 'Light Mode', next: 'bh' }
    };
    
    // ═══════════════════════════════════════════════════════════════
    // DETECTION
    // ═══════════════════════════════════════════════════════════════
    
    function detectCapabilities() {
        try {
            const canvas = document.createElement('canvas');
            webglSupported = !!(window.WebGLRenderingContext && 
                (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
        } catch(e) {
            webglSupported = false;
        }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // MODE APPLICATION
    // ═══════════════════════════════════════════════════════════════
    
    function cycleMode() {
        const postView = document.getElementById('post-view');
        const isReading = !!(postView && postView.classList.contains('active'));
        
        if (isReading) {
            // If reading, we only toggle between static modes
            const nextStatic = (lastStaticMode === 'dark') ? 'light' : 'dark';
            
            // If current global mode is BH, keep it BH but update the last static preference
            // If current was already a static mode, update it to the new one
            const newGlobal = (currentMode === 'bh') ? 'bh' : nextStatic;
            
            lastStaticMode = nextStatic;
            localStorage.setItem('acidburn-static-mode', nextStatic);
            applyMode(newGlobal);
        } else {
            // Normal cycling on main pages
            let nextMode = MODE_INFO[currentMode].next;
            applyMode(nextMode);
        }
    }

    function applyMode(mode) {
        currentMode = mode;
        localStorage.setItem('acidburn-mode', mode);
        
        if (mode === 'dark' || mode === 'light') {
            lastStaticMode = mode;
            localStorage.setItem('acidburn-static-mode', mode);
        }

        // Clean slate
        body.classList.remove('bh-mode', 'dark-mode', 'light-mode', 'lite-mode', 'light-reading');
        
        // Context: Are we reading a post?
        const postView = document.getElementById('post-view');
        const isReading = !!(postView && postView.classList.contains('active'));

        let effectiveMode = mode;
        if (isReading && mode === 'bh') {
            effectiveMode = lastStaticMode;
        }

        // Apply effective mode class
        body.classList.add(effectiveMode + '-mode');
        
        if (effectiveMode === 'bh') {
            startEffects();
        } else {
            stopEffects();
            body.classList.add('lite-mode');
            if (effectiveMode === 'light') {
                body.classList.add('light-reading');
            }
        }

        updateToggleUI();
        
        window.dispatchEvent(new CustomEvent('acidburn-mode-change', { 
            detail: { mode: effectiveMode, requestedMode: mode }
        }));
    }
    
    // ═══════════════════════════════════════════════════════════════
    // EFFECTS
    // ═══════════════════════════════════════════════════════════════
    
    function startEffects() {
        if (glitchInterval) return;
        glitchInterval = setInterval(() => {
            if (Math.random() > 0.85) {
                body.classList.add('glitch');
                setTimeout(() => body.classList.remove('glitch'), 100);
            }
        }, 3000);
        if (typeof AcidburnGalaxy !== 'undefined' && AcidburnGalaxy.start) AcidburnGalaxy.start();
    }
    
    function stopEffects() {
        if (glitchInterval) {
            clearInterval(glitchInterval);
            glitchInterval = null;
        }
        body.classList.remove('glitch');
        if (typeof AcidburnGalaxy !== 'undefined' && AcidburnGalaxy.stop) AcidburnGalaxy.stop();
    }
    
    // ═══════════════════════════════════════════════════════════════
    // UI CREATION
    // ═══════════════════════════════════════════════════════════════
    
    function createToggleUI() {
        if (document.querySelector('.mode-toggle')) return;
        
        const header = document.querySelector('.header-bar');
        if (!header) return;

        // Create opening bookend if it doesn't exist
        if (!document.querySelector('.header-bookend-open')) {
            const start = document.createElement('span');
            start.className = 'header-bookend header-bookend-open';
            start.textContent = '[';
            // Insert at the very beginning of the header content
            header.insertBefore(start, header.firstChild);
        }

        const toggle = document.createElement('div');
        toggle.className = 'mode-toggle';
        
        const btn = document.createElement('button');
        btn.className = 'mode-btn-icon cyclic-mode-btn';
        btn.id = 'main-mode-toggle';
        btn.addEventListener('click', cycleMode);
        
        toggle.appendChild(btn);
        header.appendChild(toggle);

        // Create closing bookend if it doesn't exist
        if (!document.querySelector('.header-bookend-close')) {
            const end = document.createElement('span');
            end.className = 'header-bookend header-bookend-close';
            end.textContent = ']';
            header.appendChild(end);
        }

        updateToggleUI();
    }
    function updateToggleUI() {
        const btn = document.getElementById('main-mode-toggle');
        if (!btn) return;

        const postView = document.getElementById('post-view');
        const isReading = !!(postView && postView.classList.contains('active'));
        
        let displayMode = currentMode;
        if (isReading && currentMode === 'bh') {
            displayMode = lastStaticMode;
        }

        const info = MODE_INFO[displayMode];
        btn.title = info.title + ' (Click to Cycle)';
        
        // Determine relative path based on current directory depth
        const path = window.location.pathname;
        const isSubfolder = path.includes('/author/') || path.includes('/maps/');
        const iconUrl = (isSubfolder ? '../' : '') + info.icon;

        btn.innerHTML = `<img src="${iconUrl}" alt="${info.title}" width="24" height="24" style="width:100%; height:100%; display:block; object-fit:contain;">`;
        
        // Glow effect based on mode
        btn.className = 'mode-btn-icon cyclic-mode-btn glow-' + displayMode;
    }
    
    // ═══════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════
    
    function init() {
        detectCapabilities();
        createToggleUI();
        
        // Listen for context changes (reading mode)
        const postView = document.getElementById('post-view');
        if (postView) {
            const observer = new MutationObserver(() => {
                // Re-apply current mode when reading state changes
                // This ensures BH skips correctly and classes are updated
                applyMode(currentMode);
            });
            observer.observe(postView, { attributes: true, attributeFilter: ['class'] });
        }

        applyMode(currentMode);
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    window.AcidburnMode = {
        setMode: applyMode,
        getMode: () => currentMode,
        cycle: cycleMode
    };
})();
