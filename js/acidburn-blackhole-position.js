/**
 * ACIDBURN BLACK HOLE POSITION PATCH
 * 
 * Adds setPosition() capability to AcidburnBlackhole
 * Uses CSS transforms to position the black hole at a screen location
 * Includes parallax motion for depth effect
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
    
    // Parallax state - tracks cumulative rotation for background drift
    let parallaxOffset = { x: 0, y: 0 };
    let lastPosition = { x: 0.5, y: 0.5 };
    const PARALLAX_FACTOR = 0.15;  // How much the background "lags" behind (0 = no parallax, 1 = full)
    
    /**
     * Update the CSS transform to position the black hole
     * Position is in UV coordinates (0-1), where (0.5, 0.5) is center
     */
    function updateTransform() {
        if (!container) {
            container = document.getElementById('blackhole-container');
        }
        if (!container) return;
        
        // Calculate base offset from center in viewport units
        const offsetX = (currentPosition.x - 0.5) * 100; // vw
        const offsetY = (0.5 - currentPosition.y) * 100; // vh (flip Y)
        
        if (isVisible) {
            // Apply position with parallax offset for depth effect
            const finalX = offsetX + parallaxOffset.x;
            const finalY = offsetY + parallaxOffset.y;
            
            container.style.transform = `translate(${finalX}vw, ${finalY}vh)`;
            container.style.opacity = '1';
            container.style.visibility = 'visible';
        } else {
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
        
        // Add setPosition method with parallax tracking
        window.AcidburnBlackhole.setPosition = function(x, y, isBehindCamera) {
            // Calculate movement delta for parallax
            const deltaX = (x - lastPosition.x) * 100;
            const deltaY = (lastPosition.y - y) * 100;  // Flip Y
            
            // Accumulate parallax offset (background lags behind movement)
            parallaxOffset.x += deltaX * PARALLAX_FACTOR;
            parallaxOffset.y += deltaY * PARALLAX_FACTOR;
            
            // Decay parallax offset back toward zero (spring effect)
            parallaxOffset.x *= 0.95;
            parallaxOffset.y *= 0.95;
            
            // Clamp parallax to prevent extreme drift
            const maxParallax = 15; // vw/vh units
            parallaxOffset.x = Math.max(-maxParallax, Math.min(maxParallax, parallaxOffset.x));
            parallaxOffset.y = Math.max(-maxParallax, Math.min(maxParallax, parallaxOffset.y));
            
            lastPosition.x = x;
            lastPosition.y = y;
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
                visible: isVisible,
                parallax: { ...parallaxOffset }
            };
        };
        
        // Add method to reset parallax (e.g., on centering animation)
        window.AcidburnBlackhole.resetParallax = function() {
            parallaxOffset.x = 0;
            parallaxOffset.y = 0;
        };
        
        console.log('[ACIDBURN Blackhole Position] API patched with setPosition() + parallax');
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
        
        container.style.pointerEvents = 'none';
        console.log('[ACIDBURN Blackhole Position] Initialized with parallax');
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
    
    window.addEventListener('resize', updateTransform);
    
})();
