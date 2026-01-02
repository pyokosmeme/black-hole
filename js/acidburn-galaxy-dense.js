/**
 * ACIDBURN GALAXY PATCH - Animated Celestial Grid for Star Map
 * 
 * Creates a rotating celestial sphere effect that the black hole shader lenses.
 * The grid slowly scrolls horizontally, simulating sphere rotation.
 * This creates dynamic gravitational lensing and accretion disk rotation effect.
 * 
 * Load AFTER acidburn-galaxy.js but BEFORE acidburn-blackhole.js
 */

(function() {
    'use strict';
    
    if (typeof AcidburnGalaxy === 'undefined') {
        console.warn('[AcidburnGalaxy Dense] AcidburnGalaxy not found');
        return;
    }
    
    let animationTime = 0;
    let gridCanvas = null;
    let gridCtx = null;
    let animationId = null;
    let textureCallback = null;
    
    // Grid configuration
    const CONFIG = {
        latLines: 36,
        lonLines: 72,
        gridOpacity: 0.22,
        diagSpacing: 64,
        scrollSpeed: 0.5  // pixels per frame - horizontal scroll for rotation effect
    };
    
    function drawGrid(ctx, width, height, scrollOffset) {
        // Clear to dark
        ctx.fillStyle = '#020306';
        ctx.fillRect(0, 0, width, height);
        
        // Subtle gradient
        const vGrad = ctx.createLinearGradient(0, 0, 0, height);
        vGrad.addColorStop(0, 'rgba(191, 0, 255, 0.04)');
        vGrad.addColorStop(0.5, 'rgba(0, 255, 255, 0.015)');
        vGrad.addColorStop(1, 'rgba(191, 0, 255, 0.04)');
        ctx.fillStyle = vGrad;
        ctx.fillRect(0, 0, width, height);
        
        ctx.lineWidth = 1;
        
        // Latitude lines (horizontal - cyan) - fixed
        ctx.strokeStyle = 'rgba(0, 255, 255, ' + CONFIG.gridOpacity + ')';
        for (let i = 0; i <= CONFIG.latLines; i++) {
            const y = (i / CONFIG.latLines) * height;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // Longitude lines (vertical - purple) - scroll for rotation
        ctx.strokeStyle = 'rgba(191, 0, 255, ' + CONFIG.gridOpacity + ')';
        const lonSpacing = width / CONFIG.lonLines;
        for (let i = 0; i <= CONFIG.lonLines + 1; i++) {
            const x = ((i * lonSpacing) + scrollOffset) % width;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        
        // Diagonal lines - scroll at different rate for depth
        const diagOffset = scrollOffset * 0.6;
        ctx.strokeStyle = 'rgba(0, 255, 255, ' + (CONFIG.gridOpacity * 0.35) + ')';
        for (let i = -height; i < width + height; i += CONFIG.diagSpacing) {
            const x = ((i + diagOffset) % (width + CONFIG.diagSpacing)) - CONFIG.diagSpacing;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x + height, height);
            ctx.stroke();
        }
        
        ctx.strokeStyle = 'rgba(191, 0, 255, ' + (CONFIG.gridOpacity * 0.35) + ')';
        for (let i = -height; i < width + height; i += CONFIG.diagSpacing) {
            const x = ((i - diagOffset * 0.8 + width * 2) % (width + CONFIG.diagSpacing));
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x - height, height);
            ctx.stroke();
        }
        
        // Intersection points - scroll with longitude
        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        for (let i = 0; i <= CONFIG.lonLines; i += 6) {
            for (let j = 0; j <= CONFIG.latLines; j += 6) {
                const x = ((i * lonSpacing) + scrollOffset) % width;
                const y = (j / CONFIG.latLines) * height;
                ctx.fillRect(x - 1, y - 1, 2, 2);
            }
        }
        
        // Fixed background stars
        ctx.globalAlpha = 0.35;
        let seed = 54321;
        for (let i = 0; i < 150; i++) {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            const sx = (seed / 0x7fffffff) * width;
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            const sy = (seed / 0x7fffffff) * height;
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            const size = (seed / 0x7fffffff) * 1.5 + 0.5;
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            const c = seed / 0x7fffffff;
            
            ctx.fillStyle = c > 0.7 ? '#00ffff' : c > 0.4 ? '#bf00ff' : '#ffffff';
            ctx.fillRect(sx, sy, size, size);
        }
        ctx.globalAlpha = 1;
    }
    
    // Override generate
    AcidburnGalaxy.generate = function(options) {
        const width = options.width || 2048;
        const height = options.height || 1024;
        
        gridCanvas = document.createElement('canvas');
        gridCanvas.width = width;
        gridCanvas.height = height;
        gridCtx = gridCanvas.getContext('2d');
        
        // Draw initial frame
        drawGrid(gridCtx, width, height, 0);
        
        console.log('[AcidburnGalaxy Dense] Animated celestial grid ready (' + width + 'x' + height + ')');
        return gridCanvas;
    };
    
    // Override start to animate
    AcidburnGalaxy.start = function(updateCallback) {
        if (!gridCanvas || !gridCtx) {
            console.warn('[AcidburnGalaxy Dense] Call generate() first');
            return;
        }
        
        textureCallback = updateCallback;
        animationTime = 0;
        
        function animateGrid() {
            animationTime += CONFIG.scrollSpeed;
            
            // Redraw with new scroll offset
            drawGrid(gridCtx, gridCanvas.width, gridCanvas.height, animationTime);
            
            // Notify shader to update texture
            if (textureCallback) {
                textureCallback(gridCanvas);
            }
            
            animationId = requestAnimationFrame(animateGrid);
        }
        
        animationId = requestAnimationFrame(animateGrid);
        console.log('[AcidburnGalaxy Dense] Animation started - celestial sphere rotating');
    };
    
    // Override stop
    AcidburnGalaxy.stop = function() {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
            console.log('[AcidburnGalaxy Dense] Animation stopped');
        }
    };
    
    // Override getCanvas
    AcidburnGalaxy.getCanvas = function() {
        return gridCanvas;
    };
    
    console.log('[AcidburnGalaxy Dense] Patched with animated celestial grid');
})();
