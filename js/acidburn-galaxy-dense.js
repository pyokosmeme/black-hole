/**
 * ACIDBURN GALAXY PATCH - Dense Mode
 * 
 * Enhances the galaxy texture for 3D star map with:
 * - Denser grid (36x72 vs 24x48)
 * - Diagonal tiger stripe lines
 * - More stars and glow regions
 * 
 * Load AFTER acidburn-galaxy.js and acidburn-blackhole.js:
 *   <script src="js/acidburn-galaxy.js"></script>
 *   <script src="js/acidburn-blackhole.js"></script>
 *   <script src="js/acidburn-galaxy-dense.js"></script>
 */

(function() {
    'use strict';
    
    function applyDensePatch() {
        if (typeof AcidburnGalaxy === 'undefined') {
            setTimeout(applyDensePatch, 100);
            return;
        }
        
        const config = AcidburnGalaxy.getConfig();
        if (!config) {
            // Galaxy not generated yet, wait for it
            setTimeout(applyDensePatch, 200);
            return;
        }
        
        const canvas = AcidburnGalaxy.getCanvas();
        if (!canvas) {
            setTimeout(applyDensePatch, 200);
            return;
        }
        
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        // Enhanced settings
        const denseGrid = {
            latLines: 36,
            lonLines: 72,
            opacity: 0.2,
            diagSpacing: width / 24
        };
        
        // Draw additional diagonal lines over existing texture
        ctx.lineWidth = 1;
        ctx.globalAlpha = denseGrid.opacity * 0.5;
        
        // Diagonal lines going one direction (cyan)
        ctx.strokeStyle = config.colors ? config.colors.cyan : '#00ffff';
        for (let i = -height; i < width + height; i += denseGrid.diagSpacing) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i + height, height);
            ctx.stroke();
        }
        
        // Diagonal lines going other direction (purple)
        ctx.strokeStyle = config.colors ? config.colors.purple : '#bf00ff';
        for (let i = -height; i < width + height; i += denseGrid.diagSpacing) {
            ctx.beginPath();
            ctx.moveTo(i + height, 0);
            ctx.lineTo(i, height);
            ctx.stroke();
        }
        
        // Add more grid lines to fill gaps
        ctx.globalAlpha = denseGrid.opacity * 0.4;
        
        // Extra latitude lines (cyan)
        ctx.strokeStyle = config.colors ? config.colors.cyan : '#00ffff';
        for (let i = 0; i <= denseGrid.latLines; i++) {
            const y = (i / denseGrid.latLines) * height;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // Extra longitude lines (purple)
        ctx.strokeStyle = config.colors ? config.colors.purple : '#bf00ff';
        for (let i = 0; i <= denseGrid.lonLines; i++) {
            const x = (i / denseGrid.lonLines) * width;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        
        // Add more noise particles
        ctx.globalAlpha = 0.4;
        for (let i = 0; i < 400; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const size = Math.random() * 2;
            
            const colorChoice = Math.random();
            if (colorChoice > 0.7) {
                ctx.fillStyle = '#00ffff';
            } else if (colorChoice > 0.4) {
                ctx.fillStyle = '#bf00ff';
            } else {
                ctx.fillStyle = '#ffffff';
            }
            
            ctx.fillRect(x, y, size, size);
        }
        
        // Add extra glow regions
        ctx.globalAlpha = 1;
        for (let i = 0; i < 4; i++) {
            const gx = Math.random() * width;
            const gy = Math.random() * height;
            const radius = 150 + Math.random() * 200;
            const color = Math.random() > 0.5 ? [191, 0, 255] : [0, 255, 255];
            
            const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, radius);
            grad.addColorStop(0, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.08)`);
            grad.addColorStop(0.5, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.03)`);
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, width, height);
        }
        
        ctx.globalAlpha = 1;
        
        // Mark texture as needing update for Three.js
        canvas.needsUpdate = true;
        
        console.log('[AcidburnGalaxy Dense] Patch applied - denser grid + diagonals');
    }
    
    // Start checking after DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(applyDensePatch, 500);
        });
    } else {
        setTimeout(applyDensePatch, 500);
    }
    
})();
