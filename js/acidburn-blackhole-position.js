/**
 * ACIDBURN BLACK HOLE POSITION PATCH
 * 
 * Adds setPosition() capability to AcidburnBlackhole
 * Uses CSS transforms to position the black hole at a screen location
 * 
 * The shader renders the black hole at canvas center.
 * By translating the canvas, we move where the black hole appears on screen.
 * 
 * Load this AFTER acidburn-blackhole.js:
 *   <script src="js/acidburn-blackhole.js"></script>
 *   <script src="js/acidburn-blackhole-position.js"></script>
 */

(function() {
    'use strict';
    
    // State
    let container = null;
    let currentPosition = { x: 0.5, y: 0.5 };
    let isVisible = true;
    
    /**
     * Update the CSS transform to position the black hole
     * Position is in UV coordinates (0-1), where (0.5, 0.5) is center
     */
    function updateTransform() {
        if (!container) {
            container = document.getElementById('blackhole-container');
        }
        if (!container) return;
        
        // Calculate offset from center in viewport units
        // x=0.5, y=0.5 means center (no offset)
        // x=0 means left edge, x=1 means right edge
        // y=0 means bottom, y=1 means top (shader UV convention)
        
        const offsetX = (currentPosition.x - 0.5) * 100; // vw
        const offsetY = (0.5 - currentPosition.y) * 100; // vh (flip Y: UV y=1 is top, CSS y increases downward)
        
        if (isVisible) {
            container.style.transform = `translate(${offsetX}vw, ${offsetY}vh)`;
            container.style.opacity = '1';
            container.style.visibility = 'visible';
        } else {
            // Behind camera - hide completely
            container.style.opacity = '0';
            container.style.visibility = 'hidden';
        }
    }
    
    /**
     * Wait for AcidburnBlackhole to be defined, then patch it
     */
    function patchAPI() {
        if (typeof window.AcidburnBlackhole === 'undefined') {
            setTimeout(patchAPI, 50);
            return;
        }
        
        // Add setPosition method
        window.AcidburnBlackhole.setPosition = function(x, y, isBehindCamera) {
            currentPosition.x = x;
            currentPosition.y = y;
            isVisible = !isBehindCamera;
            updateTransform();
        };
        
        // Add getPosition method  
        window.AcidburnBlackhole.getPosition = function() {
            return { 
                x: currentPosition.x, 
                y: currentPosition.y, 
                visible: isVisible 
            };
        };
        
        console.log('[ACIDBURN Blackhole Position] API patched with setPosition()');
    }
    
    /**
     * Initialize - ensure container is set up for transforms
     */
    function init() {
        container = document.getElementById('blackhole-container');
        if (!container) {
            setTimeout(init, 100);
            return;
        }
        
        // Ensure container can be transformed
        // It should already have position:fixed from acidburn.css
        // Just make sure pointer-events pass through
        container.style.pointerEvents = 'none';
        
        console.log('[ACIDBURN Blackhole Position] Initialized');
    }
    
    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            init();
            patchAPI();
        });
    } else {
        init();
        patchAPI();
    }
    
    // Handle resize
    window.addEventListener('resize', updateTransform);
    
})();
