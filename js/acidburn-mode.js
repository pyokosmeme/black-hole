/**
 * ACIDBURN MODE TOGGLE
 * 
 * Manages display modes: FULL, LITE, AUTO
 * - FULL: WebGL black hole, all animations
 * - LITE: Static CSS background, no animations
 * - AUTO: Detects mobile, reduced-motion, battery, WebGL support
 */

(function() {
    'use strict';

    const body = document.body;
    let currentMode = localStorage.getItem('acidburn-mode') || 'auto';
    let webglSupported = true;
    let glitchInterval = null;
    
    // Detection flags
    let isMobile = false;
    let prefersReducedMotion = false;
    let onBattery = false;
    
    // ═══════════════════════════════════════════════════════════════
    // DETECTION
    // ═══════════════════════════════════════════════════════════════
    
    function detectCapabilities() {
        // Check WebGL support
        try {
            const canvas = document.createElement('canvas');
            webglSupported = !!(window.WebGLRenderingContext && 
                (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
        } catch(e) {
            webglSupported = false;
        }
        
        // Check if mobile/tablet
        isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
            || window.innerWidth < 768
            || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
        
        // Check reduced motion preference
        prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        
        // Check battery (if available)
        if ('getBattery' in navigator) {
            navigator.getBattery().then(battery => {
                onBattery = !battery.charging && battery.level < 0.3;
                // Re-evaluate if in auto mode
                if (currentMode === 'auto') {
                    applyMode('auto');
                }
            }).catch(() => {});
        }
        
        console.log('[ACIDBURN Mode] Capabilities:', {
            webgl: webglSupported,
            mobile: isMobile,
            reducedMotion: prefersReducedMotion
        });
    }
    
    function shouldUseLiteMode() {
        return prefersReducedMotion || isMobile || !webglSupported || onBattery;
    }
    
    // ═══════════════════════════════════════════════════════════════
    // MODE APPLICATION
    // ═══════════════════════════════════════════════════════════════
    
    function applyMode(mode) {
        const previousMode = currentMode;
        currentMode = mode;
        localStorage.setItem('acidburn-mode', mode);
        
        // Update button states
        const buttons = document.querySelectorAll('.mode-btn');
        buttons.forEach(btn => {
            const isActive = btn.dataset.mode === mode;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-pressed', isActive);
        });
        
        // If switching TO full mode and WebGL wasn't loaded, reload page
        if (mode === 'full' && previousMode !== 'full' && typeof THREE === 'undefined') {
            console.log('[ACIDBURN Mode] Reloading to enable WebGL...');
            location.reload();
            return;
        }
        
        // Apply mode classes
        body.classList.remove('lite-mode', 'no-webgl');
        
        if (mode === 'lite') {
            body.classList.add('lite-mode');
            stopEffects();
            console.log('[ACIDBURN Mode] LITE mode active');
        } else if (mode === 'full') {
            if (!webglSupported) {
                body.classList.add('no-webgl');
            }
            startEffects();
            console.log('[ACIDBURN Mode] FULL mode active');
        } else {
            // AUTO mode
            if (shouldUseLiteMode()) {
                body.classList.add('lite-mode');
                stopEffects();
                console.log('[ACIDBURN Mode] AUTO → Lite (detected: ' + 
                    (prefersReducedMotion ? 'reduced-motion ' : '') +
                    (isMobile ? 'mobile ' : '') +
                    (!webglSupported ? 'no-webgl ' : '') +
                    (onBattery ? 'low-battery' : '') + ')');
            } else {
                startEffects();
                console.log('[ACIDBURN Mode] AUTO → Full');
            }
        }
        
        // Dispatch event for other scripts
        window.dispatchEvent(new CustomEvent('acidburn-mode-change', { 
            detail: { mode, isLite: body.classList.contains('lite-mode') }
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
        
        // Restart galaxy animation if available
        if (typeof AcidburnGalaxy !== 'undefined' && AcidburnGalaxy.start) {
            AcidburnGalaxy.start();
        }
    }
    
    function stopEffects() {
        if (glitchInterval) {
            clearInterval(glitchInterval);
            glitchInterval = null;
        }
        body.classList.remove('glitch');
        
        // Stop galaxy animation
        if (typeof AcidburnGalaxy !== 'undefined' && AcidburnGalaxy.stop) {
            AcidburnGalaxy.stop();
        }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // UI CREATION
    // ═══════════════════════════════════════════════════════════════
    
    function createToggleUI() {
        // Check if toggle already exists
        if (document.querySelector('.mode-toggle')) return;
        
        const toggle = document.createElement('div');
        toggle.className = 'mode-toggle';
        toggle.setAttribute('role', 'group');
        toggle.setAttribute('aria-label', 'Display mode');
        
        const modes = [
            { id: 'full', label: 'FULL', title: 'Full effects mode (WebGL)' },
            { id: 'lite', label: 'LITE', title: 'Lite mode (reduced motion, saves battery)' },
            { id: 'auto', label: 'AUTO', title: 'Auto-detect best mode' }
        ];
        
        modes.forEach(mode => {
            const btn = document.createElement('button');
            btn.className = 'mode-btn';
            btn.dataset.mode = mode.id;
            btn.textContent = mode.label;
            btn.title = mode.title;
            btn.setAttribute('aria-pressed', mode.id === currentMode);
            if (mode.id === currentMode) btn.classList.add('active');
            
            btn.addEventListener('click', () => applyMode(mode.id));
            toggle.appendChild(btn);
        });
        
        // Insert into header (before stats or at end)
        const header = document.querySelector('.header-bar');
        const stats = document.querySelector('.header-stats');
        if (header) {
            if (stats) {
                header.insertBefore(toggle, stats);
            } else {
                header.appendChild(toggle);
            }
        }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // EVENT LISTENERS
    // ═══════════════════════════════════════════════════════════════
    
    function setupEventListeners() {
        // Listen for system preference changes
        window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
            prefersReducedMotion = e.matches;
            if (currentMode === 'auto') {
                applyMode('auto');
            }
        });
        
        // Listen for resize (orientation change)
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                const wasMobile = isMobile;
                isMobile = window.innerWidth < 768;
                if (currentMode === 'auto' && wasMobile !== isMobile) {
                    applyMode('auto');
                }
            }, 250);
        });
    }
    
    // ═══════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════
    
    function init() {
        detectCapabilities();
        createToggleUI();
        setupEventListeners();
        applyMode(currentMode);
    }
    
    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // ═══════════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════════
    
    window.AcidburnMode = {
        setMode: applyMode,
        getMode: () => currentMode,
        isLite: () => body.classList.contains('lite-mode'),
        isWebGLSupported: () => webglSupported,
        isMobile: () => isMobile
    };
    
})();
