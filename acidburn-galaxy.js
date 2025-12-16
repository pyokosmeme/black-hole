/**
 * ACIDBURN GALAXY v2
 * 
 * Tiger stripe aesthetic matching the page design
 * Replaces milkyway.jpg with procedural cyberpunk texture
 * 
 * Add AFTER main.js:
 *   <script src="acidburn-galaxy.js"></script>
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════
  
  const CONFIG = {
    width: 2048,
    height: 1024,
    
    animated: true,
    frameRate: 20,
    
    colors: {
      background: '#030508',
      purple: '#bf00ff',
      cyan: '#00ffff',
      magenta: '#ff00ff',
      pink: '#ff0099',
    },
    
    // Grid - original style, color matched
    grid: {
      enabled: true,
      latLines: 24,
      lonLines: 48,
      lineWidth: 1,
      opacity: 0.5
    },
    
    // Floating nodes
    nodes: {
      enabled: true,
      count: 60,
      maxSize: 2,
      opacity: 0.5,
      speed: 0.2
    },
    
    // Glow regions
    glows: {
      enabled: true,
      count: 40
    },
    
    // Noise particles (stars)
    noise: {
      enabled: true,
      count: 400,
      opacity: 0.5
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════
  
  let canvas, ctx;
  let texture = null;
  let animationId = null;
  let time = 0;
  
  const nodes = [];
  const glows = [];
  
  let seed = 12345;
  function seededRandom() {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  }
  
  function resetSeed() {
    seed = 12345;
  }

  // ═══════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════
  
  function init() {
    canvas = document.createElement('canvas');
    canvas.width = CONFIG.width;
    canvas.height = CONFIG.height;
    ctx = canvas.getContext('2d');
    
    // Initialize nodes
    resetSeed();
    if (CONFIG.nodes.enabled) {
      for (let i = 0; i < CONFIG.nodes.count; i++) {
        nodes.push({
          x: seededRandom() * CONFIG.width,
          y: seededRandom() * CONFIG.height,
          vx: (seededRandom() - 0.5) * CONFIG.nodes.speed,
          vy: (seededRandom() - 0.5) * CONFIG.nodes.speed,
          size: 0.5 + seededRandom() * CONFIG.nodes.maxSize,
          color: seededRandom() > 0.5 ? 'cyan' : 'purple',
          pulse: seededRandom() * Math.PI * 2
        });
      }
    }
    
    // Initialize glow regions
    if (CONFIG.glows.enabled) {
      for (let i = 0; i < CONFIG.glows.count; i++) {
        glows.push({
          x: seededRandom() * CONFIG.width,
          y: seededRandom() * CONFIG.height,
          radius: 100 + seededRandom() * 200,
          color: seededRandom() > 0.5 ? 'purple' : 'cyan',
          phase: seededRandom() * Math.PI * 2
        });
      }
    }
    
    draw();
    
    texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    
    waitForBlackHole();
  }
  
  function waitForBlackHole() {
    if (typeof scene !== 'undefined' && scene.children && scene.children.length > 0) {
      const mesh = scene.children[0];
      if (mesh && mesh.material && mesh.material.uniforms && mesh.material.uniforms.galaxy_texture) {
        mesh.material.uniforms.galaxy_texture.value = texture;
        console.log('[acidburn-galaxy] Texture replaced');
        
        if (CONFIG.animated) {
          startAnimation();
        }
        return;
      }
    }
    setTimeout(waitForBlackHole, 100);
  }

  // ═══════════════════════════════════════════════════════════════
  // DRAWING
  // ═══════════════════════════════════════════════════════════════
  
  function draw() {
    const { width, height } = CONFIG;
    
    // Clear with dark background
    ctx.fillStyle = CONFIG.colors.background;
    ctx.fillRect(0, 0, width, height);
    
    // Base gradient (subtle)
    drawBaseGradient();
    
    // Glow regions
    if (CONFIG.glows.enabled) {
      drawGlows();
    }
    
    // Grid
    if (CONFIG.grid.enabled) {
      drawGrid();
    }
    
    // Noise
    if (CONFIG.noise.enabled) {
      drawNoise();
    }
    
    // Nodes
    if (CONFIG.nodes.enabled) {
      drawNodes();
    }
    
    if (texture) {
      texture.needsUpdate = true;
    }
  }
  
  function drawBaseGradient() {
    const { width, height, colors } = CONFIG;
    
    // Vertical gradient - purple at poles, darker in middle
    const vGrad = ctx.createLinearGradient(0, 0, 0, height);
    vGrad.addColorStop(0, 'rgba(191, 0, 255, 0.08)');
    vGrad.addColorStop(0.3, 'rgba(0, 10, 20, 0.1)');
    vGrad.addColorStop(0.5, 'rgba(0, 255, 255, 0.03)');
    vGrad.addColorStop(0.7, 'rgba(0, 10, 20, 0.1)');
    vGrad.addColorStop(1, 'rgba(191, 0, 255, 0.08)');
    
    ctx.fillStyle = vGrad;
    ctx.fillRect(0, 0, width, height);
  }
  
  function drawGlows() {
    for (const glow of glows) {
      const pulse = Math.sin(time * 0.02 + glow.phase) * 0.3 + 0.7;
      const color = CONFIG.colors[glow.color];
      
      const grad = ctx.createRadialGradient(
        glow.x, glow.y, 0,
        glow.x, glow.y, glow.radius * pulse
      );
      
      // Parse hex color to rgba
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.1)`);
      grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.03)`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
    }
  }
  
  function drawGrid() {
    const { width, height } = CONFIG;
    const { latLines, lonLines, opacity, lineWidth } = CONFIG.grid;
    
    ctx.globalAlpha = opacity;
    ctx.lineWidth = lineWidth || 1;
    
    // Latitude lines (cyan)
    ctx.strokeStyle = CONFIG.colors.cyan;
    for (let i = 0; i <= latLines; i++) {
      const y = (i / latLines) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    // Longitude lines (purple)
    ctx.strokeStyle = CONFIG.colors.purple;
    for (let i = 0; i <= lonLines; i++) {
      const x = (i / lonLines) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    // Accent points at intersections
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = opacity * 0.8;
    for (let i = 0; i <= lonLines; i += 4) {
      for (let j = 0; j <= latLines; j += 4) {
        const x = (i / lonLines) * width;
        const y = (j / latLines) * height;
        ctx.fillRect(x - 1, y - 1, 3, 3);
      }
    }
    
    ctx.globalAlpha = 1;
  }
  
  function drawNoise() {
    resetSeed();
    
    for (let i = 0; i < CONFIG.noise.count; i++) {
      const x = seededRandom() * CONFIG.width;
      const y = seededRandom() * CONFIG.height;
      const size = seededRandom() * 2;
      
      // Vary color
      const colorChoice = seededRandom();
      if (colorChoice > 0.7) {
        ctx.fillStyle = CONFIG.colors.cyan;
      } else if (colorChoice > 0.4) {
        ctx.fillStyle = CONFIG.colors.purple;
      } else {
        ctx.fillStyle = '#ffffff';
      }
      
      ctx.globalAlpha = CONFIG.noise.opacity * (0.3 + seededRandom() * 0.7);
      ctx.fillRect(x, y, size, size);
    }
    
    ctx.globalAlpha = 1;
  }
  
  function drawNodes() {
    for (const node of nodes) {
      // Update position
      if (CONFIG.animated) {
        node.x += node.vx;
        node.y += node.vy;
        node.pulse += 0.05;
        
        // Wrap
        if (node.x < 0) node.x += CONFIG.width;
        if (node.x > CONFIG.width) node.x -= CONFIG.width;
        if (node.y < 0) node.y += CONFIG.height;
        if (node.y > CONFIG.height) node.y -= CONFIG.height;
      }
      
      // Pulse effect
      const pulse = Math.sin(node.pulse) * 0.3 + 0.7;
      const size = node.size * pulse;
      
      ctx.globalAlpha = CONFIG.nodes.opacity * pulse;
      ctx.fillStyle = CONFIG.colors[node.color];
      
      ctx.beginPath();
      ctx.arc(node.x, node.y, size, 0, Math.PI * 2);
      ctx.fill();
      
      // Glow
      ctx.globalAlpha = CONFIG.nodes.opacity * 0.3 * pulse;
      ctx.beginPath();
      ctx.arc(node.x, node.y, size * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.globalAlpha = 1;
  }

  // ═══════════════════════════════════════════════════════════════
  // ANIMATION
  // ═══════════════════════════════════════════════════════════════
  
  function startAnimation() {
    const frameInterval = 1000 / CONFIG.frameRate;
    let lastFrame = 0;
    
    function animate(timestamp) {
      if (timestamp - lastFrame >= frameInterval) {
        time++;
        draw();
        lastFrame = timestamp;
      }
      animationId = requestAnimationFrame(animate);
    }
    
    animationId = requestAnimationFrame(animate);
  }
  
  function stopAnimation() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════
  
  window.acidburnGalaxy = {
    config: CONFIG,
    redraw: draw,
    start: startAnimation,
    stop: stopAnimation,
    getCanvas: () => canvas
  };

  // ═══════════════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════════════
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
})();
