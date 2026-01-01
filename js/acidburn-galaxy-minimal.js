/**
 * ACIDBURN GALAXY PATCH - Minimal Mode for Star Map
 * 
 * Disables the acid-galaxy grid so only the celestial sphere grid shows.
 * The black hole + accretion disk still renders and lenses the background.
 * 
 * Load AFTER acidburn-galaxy.js but BEFORE acidburn-blackhole.js:
 *   <script src="js/acidburn-galaxy.js"></script>
 *   <script src="js/acidburn-galaxy-minimal.js"></script>
 *   <script src="js/acidburn-blackhole.js"></script>
 */

(function() {
    'use strict';
    
    // Override generate to produce a minimal texture (no grid, just dark + subtle stars)
    if (typeof AcidburnGalaxy !== 'undefined') {
        const originalGenerate = AcidburnGalaxy.generate;
        
        AcidburnGalaxy.generate = function(options) {
            // Force minimal settings - no grid, no nodes, just dark background
            const minimalOptions = Object.assign({}, options, {
                grid: { enabled: false },
                nodes: { enabled: false },
                glows: { enabled: false },
                noise: { enabled: true, count: 200, opacity: 0.3 }  // Just some dim stars
            });
            
            return originalGenerate.call(AcidburnGalaxy, minimalOptions);
        };
        
        console.log('[AcidburnGalaxy Minimal] Patched - grid disabled for star map');
    } else {
        console.warn('[AcidburnGalaxy Minimal] AcidburnGalaxy not found');
    }
})();
