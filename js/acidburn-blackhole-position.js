/**
 * ACIDBURN BLACKHOLE POSITION PATCH - Erebus Tracking
 * 
 * Positions the black hole shader at the Erebus terminus (RX J1856)
 * Uses CSS transform to position the container based on 3D projection.
 * 
 * Load AFTER acidburn-blackhole.js
 */

(function() {
    'use strict';
    
    // Get the blackhole container
    const container = document.getElementById('blackhole-container');
    if (!container) {
        console.warn('[Blackhole Position] Container not found');
        return;
    }
    
    // Ensure container can be positioned
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.pointerEvents = 'none';
    container.style.transformOrigin = 'center center';
    
    // Store current position
    let currentX = 0.5;  // Screen UV (0.5 = center)
    let currentY = 0.5;
    let isHidden = false;
    
    // Add setPosition method to AcidburnBlackhole if it exists
    if (typeof AcidburnBlackhole !== 'undefined') {
        AcidburnBlackhole.setPosition = function(screenX, screenY, isBehind) {
            currentX = screenX;
            currentY = screenY;
            isHidden = isBehind;
            
            if (isBehind) {
                container.style.opacity = '0';
            } else {
                container.style.opacity = '1';
                
                // Convert UV (0-1) to pixel offset from center
                const offsetX = (screenX - 0.5) * window.innerWidth;
                const offsetY = -(screenY - 0.5) * window.innerHeight;  // Flip Y
                
                container.style.transform = 'translate(' + offsetX + 'px, ' + offsetY + 'px)';
            }
            
            // Also try to update shader uniform if available
            const uniforms = window.uniforms || (AcidburnBlackhole && AcidburnBlackhole.uniforms);
            if (uniforms && uniforms.bhCenter && uniforms.bhCenter.value) {
                if (isBehind) {
                    uniforms.bhCenter.value.set(-10, -10);
                } else {
                    uniforms.bhCenter.value.set(
                        (screenX - 0.5) * 2,
                        (screenY - 0.5) * 2
                    );
                }
            }
        };
        
        console.log('[Blackhole Position] setPosition method added');
    }
    
    console.log('[Blackhole Position] Patch loaded - tracks Erebus position via CSS transform');
})();
