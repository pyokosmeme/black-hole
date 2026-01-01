/**
 * ACIDBURN GALAXY PATCH - Dense Grid for Star Map
 * 
 * Generates a dense grid texture that the black hole shader will raytrace.
 * This grid WILL be distorted by gravitational lensing.
 * 
 * Load AFTER acidburn-galaxy.js but BEFORE acidburn-blackhole.js
 */

(function() {
    'use strict';
    
    if (typeof AcidburnGalaxy !== 'undefined') {
        const originalGenerate = AcidburnGalaxy.generate;
        
        AcidburnGalaxy.generate = function(options) {
            // Call original to set up canvas
            const canvas = originalGenerate.call(AcidburnGalaxy, {
                width: options.width || 2048,
                height: options.height || 1024,
                animated: options.animated || false,
                grid: { enabled: false },
                nodes: { enabled: false },
                glows: { enabled: false },
                noise: { enabled: false }
            });
            
            // Now draw our own dense grid on top
            const ctx = canvas.getContext('2d');
            const width = canvas.width;
            const height = canvas.height;
            
            // Dark background
            ctx.fillStyle = '#030508';
            ctx.fillRect(0, 0, width, height);
            
            // Subtle gradient
            const vGrad = ctx.createLinearGradient(0, 0, 0, height);
            vGrad.addColorStop(0, 'rgba(191, 0, 255, 0.06)');
            vGrad.addColorStop(0.5, 'rgba(0, 255, 255, 0.02)');
            vGrad.addColorStop(1, 'rgba(191, 0, 255, 0.06)');
            ctx.fillStyle = vGrad;
            ctx.fillRect(0, 0, width, height);
            
            // Grid settings - dense for good lensing visibility
            const latLines = 48;
            const lonLines = 96;
            const gridOpacity = 0.3;
            
            ctx.lineWidth = 1;
            
            // Latitude lines (horizontal - cyan)
            ctx.strokeStyle = 'rgba(0, 255, 255, ' + gridOpacity + ')';
            for (let i = 0; i <= latLines; i++) {
                const y = (i / latLines) * height;
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(width, y);
                ctx.stroke();
            }
            
            // Longitude lines (vertical - purple)
            ctx.strokeStyle = 'rgba(191, 0, 255, ' + gridOpacity + ')';
            for (let i = 0; i <= lonLines; i++) {
                const x = (i / lonLines) * width;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, height);
                ctx.stroke();
            }
            
            // Diagonal tiger stripes
            const diagOpacity = gridOpacity * 0.4;
            const diagSpacing = width / 32;
            
            ctx.strokeStyle = 'rgba(0, 255, 255, ' + diagOpacity + ')';
            for (let i = -height; i < width + height; i += diagSpacing) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i + height, height);
                ctx.stroke();
            }
            
            ctx.strokeStyle = 'rgba(191, 0, 255, ' + diagOpacity + ')';
            for (let i = -height; i < width + height; i += diagSpacing) {
                ctx.beginPath();
                ctx.moveTo(i + height, 0);
                ctx.lineTo(i, height);
                ctx.stroke();
            }
            
            // Intersection accent points
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            for (let i = 0; i <= lonLines; i += 8) {
                for (let j = 0; j <= latLines; j += 8) {
                    const x = (i / lonLines) * width;
                    const y = (j / latLines) * height;
                    ctx.fillRect(x - 1, y - 1, 3, 3);
                }
            }
            
            // Some dim stars
            for (let i = 0; i < 300; i++) {
                const x = Math.random() * width;
                const y = Math.random() * height;
                const size = Math.random() * 2;
                const c = Math.random();
                ctx.fillStyle = c > 0.7 ? 'rgba(0, 255, 255, 0.4)' : 
                               c > 0.4 ? 'rgba(191, 0, 255, 0.4)' : 
                                         'rgba(255, 255, 255, 0.5)';
                ctx.fillRect(x, y, size, size);
            }
            
            console.log('[AcidburnGalaxy Dense] Grid texture ready for raytracing');
            return canvas;
        };
        
        console.log('[AcidburnGalaxy Dense] Patched with dense grid');
    }
})();
