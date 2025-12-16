/**
 * ACIDBURN GALAXY REPLACEMENT
 * 
 * Drop-in script to replace milkyway.jpg with procedural cyberpunk texture
 * Add this script AFTER main.js in your index.html:
 * 
 *   <script src="main.js"></script>
 *   <script src="acidburn-galaxy.js"></script>
 * 
 * The texture is a spherical panorama (equirectangular projection)
 * that gets gravitationally lensed by the black hole shader.
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════
  
  const CONFIG = {
    // Canvas size (higher = more detail, more GPU work)
    width: 2048,
    height: 1024,
    
    // Animation
    animated: true,         // set false for static texture
    frameRate: 30,          // updates per second (if animated)
    
    // Visual elements (toggle on/off)
    elements: {
      grid: true,           // lat/long grid lines
      binary: true,         // falling binary columns
      nodes: true,          // floating connection nodes
      noise: true,          // subtle background noise
      gradientBase: true,   // base color gradient
    },
    
    // Colors (CSS format)
    colors: {
      background: '#000508',
      gridPrimary: '#bf00ff',    // purple
      gridSecondary: '#00ffff',  // cyan
      binary: '#00ff88',         // green
      nodes: '#ff0099',          // pink
      accent: '#ffffff'
    },
    
    // Grid settings
    grid: {
      latLines: 24,         // horizontal divisions
      lonLines: 48,         // vertical divisions
      lineWidth: 1,
      opacity: 0.3
    },
    
    // Binary rain settings
    binary: {
      columns: 60,
      speed: 2,
      opacity: 0.4,
      fontSize: 14
    },
    
    // Node settings
    nodes: {
      count: 40,
      maxSpeed: 0.5,
      connectionDistance: 150,
      nodeSize: 3,
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
  
  // Binary rain state
  const binaryColumns = [];
  
  // Node state
  const nodes = [];
  
  // Seeded random for reproducibility
  let seed = Date.now();
  function seededRandom() {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  }

  // ═══════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════
  
  function init() {
    // Create offscreen canvas
    canvas = document.createElement('canvas');
    canvas.width = CONFIG.width;
    canvas.height = CONFIG.height;
    ctx = canvas.getContext('2d');
    
    // Initialize binary columns
    if (CONFIG.elements.binary) {
      for (let i = 0; i < CONFIG.binary.columns; i++) {
        binaryColumns.push({
          x: (i / CONFIG.binary.columns) * CONFIG.width,
          y: seededRandom() * CONFIG.height,
          speed: 0.5 + seededRandom() * CONFIG.binary.speed,
          chars: Array(30).fill(0).map(() => seededRandom() > 0.5 ? '1' : '0')
        });
      }
    }
    
    // Initialize nodes
    if (CONFIG.elements.nodes) {
      for (let i = 0; i < CONFIG.nodes.count; i++) {
        nodes.push({
          x: seededRandom() * CONFIG.width,
          y: seededRandom() * CONFIG.height,
          vx: (seededRandom() - 0.5) * CONFIG.nodes.maxSpeed,
          vy: (seededRandom() - 0.5) * CONFIG.nodes.maxSpeed,
          size: 1 + seededRandom() * CONFIG.nodes.nodeSize
        });
      }
    }
    
    // Draw initial frame
    draw();
    
    // Create THREE.js texture
    texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    
    // Wait for black hole to initialize, then replace texture
    waitForBlackHole();
  }
  
  function waitForBlackHole() {
    // Check if the scene and material are ready
    if (typeof scene !== 'undefined' && scene.children && scene.children.length > 0) {
      const mesh = scene.children[0];
      if (mesh && mesh.material && mesh.material.uniforms && mesh.material.uniforms.galaxy_texture) {
        // Replace the galaxy texture
        mesh.material.uniforms.galaxy_texture.value = texture;
        console.log('[acidburn-galaxy] Texture replaced successfully');
        
        // Start animation if enabled
        if (CONFIG.animated) {
          startAnimation();
        }
        return;
      }
    }
    // Retry
    setTimeout(waitForBlackHole, 100);
  }

  // ═══════════════════════════════════════════════════════════════
  // DRAWING FUNCTIONS
  // ═══════════════════════════════════════════════════════════════
  
  function draw() {
    // Clear
    ctx.fillStyle = CONFIG.colors.background;
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
    
    // Base gradient
    if (CONFIG.elements.gradientBase) {
      drawGradientBase();
    }
    
    // Background noise
    if (CONFIG.elements.noise) {
      drawNoise();
    }
    
    // Grid
    if (CONFIG.elements.grid) {
      drawGrid();
    }
    
    // Binary rain
    if (CONFIG.elements.binary) {
      drawBinary();
    }
    
    // Nodes
    if (CONFIG.elements.nodes) {
      drawNodes();
    }
    
    // Update texture
    if (texture) {
      texture.needsUpdate = true;
    }
  }
  
  function drawGradientBase() {
    // Vertical gradient - darker at poles, lighter at equator
    const gradient = ctx.createLinearGradient(0, 0, 0, CONFIG.height);
    gradient.addColorStop(0, 'rgba(191, 0, 255, 0.1)');    // purple at top
    gradient.addColorStop(0.3, 'rgba(0, 20, 40, 0.3)');
    gradient.addColorStop(0.5, 'rgba(0, 255, 255, 0.05)'); // cyan band at equator
    gradient.addColorStop(0.7, 'rgba(0, 20, 40, 0.3)');
    gradient.addColorStop(1, 'rgba(191, 0, 255, 0.1)');    // purple at bottom
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
    
    // Horizontal variation
    const hGradient = ctx.createLinearGradient(0, 0, CONFIG.width, 0);
    hGradient.addColorStop(0, 'rgba(0, 255, 255, 0.05)');
    hGradient.addColorStop(0.5, 'rgba(191, 0, 255, 0.08)');
    hGradient.addColorStop(1, 'rgba(0, 255, 255, 0.05)');
    
    ctx.fillStyle = hGradient;
    ctx.fillRect(0, 0, CONFIG.width, CONFIG.height);
  }
  
  function drawNoise() {
    ctx.fillStyle = CONFIG.colors.accent;
    for (let i = 0; i < 500; i++) {
      const x = seededRandom() * CONFIG.width;
      const y = seededRandom() * CONFIG.height;
      const size = seededRandom() * 1.5;
      const opacity = seededRandom() * 0.3;
      ctx.globalAlpha = opacity;
      ctx.fillRect(x, y, size, size);
    }
    ctx.globalAlpha = 1;
  }
  
  function drawGrid() {
    const { latLines, lonLines, lineWidth, opacity } = CONFIG.grid;
    
    ctx.lineWidth = lineWidth;
    ctx.globalAlpha = opacity;
    
    // Latitude lines (horizontal)
    ctx.strokeStyle = CONFIG.colors.gridPrimary;
    for (let i = 0; i <= latLines; i++) {
      const y = (i / latLines) * CONFIG.height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CONFIG.width, y);
      ctx.stroke();
    }
    
    // Longitude lines (vertical)
    ctx.strokeStyle = CONFIG.colors.gridSecondary;
    for (let i = 0; i <= lonLines; i++) {
      const x = (i / lonLines) * CONFIG.width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CONFIG.height);
      ctx.stroke();
    }
    
    // Accent crosses at intersections
    ctx.fillStyle = CONFIG.colors.accent;
    for (let i = 0; i <= lonLines; i += 4) {
      for (let j = 0; j <= latLines; j += 4) {
        const x = (i / lonLines) * CONFIG.width;
        const y = (j / latLines) * CONFIG.height;
        ctx.fillRect(x - 2, y - 2, 4, 4);
      }
    }
    
    ctx.globalAlpha = 1;
  }
  
  function drawBinary() {
    ctx.font = `${CONFIG.binary.fontSize}px 'Courier New', monospace`;
    ctx.fillStyle = CONFIG.colors.binary;
    ctx.globalAlpha = CONFIG.binary.opacity;
    
    for (const col of binaryColumns) {
      // Draw characters
      for (let i = 0; i < col.chars.length; i++) {
        const charY = col.y + i * CONFIG.binary.fontSize;
        const wrappedY = ((charY % CONFIG.height) + CONFIG.height) % CONFIG.height;
        
        // Fade based on position in column
        const fade = 1 - (i / col.chars.length);
        ctx.globalAlpha = CONFIG.binary.opacity * fade;
        ctx.fillText(col.chars[i], col.x, wrappedY);
      }
      
      // Update position (if animated)
      if (CONFIG.animated) {
        col.y += col.speed;
        if (col.y > CONFIG.height) {
          col.y = -col.chars.length * CONFIG.binary.fontSize;
          // Randomize chars on reset
          col.chars = col.chars.map(() => Math.random() > 0.5 ? '1' : '0');
        }
      }
    }
    
    ctx.globalAlpha = 1;
  }
  
  function drawNodes() {
    ctx.globalAlpha = CONFIG.nodes.opacity;
    
    // Update positions (if animated)
    if (CONFIG.animated) {
      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;
        
        // Wrap around
        if (node.x < 0) node.x += CONFIG.width;
        if (node.x > CONFIG.width) node.x -= CONFIG.width;
        if (node.y < 0) node.y += CONFIG.height;
        if (node.y > CONFIG.height) node.y -= CONFIG.height;
      }
    }
    
    // Draw connections
    ctx.strokeStyle = CONFIG.colors.gridPrimary;
    ctx.lineWidth = 0.5;
    
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        let dx = nodes[j].x - nodes[i].x;
        let dy = nodes[j].y - nodes[i].y;
        
        // Handle wrapping for distance calculation
        if (Math.abs(dx) > CONFIG.width / 2) dx = CONFIG.width - Math.abs(dx);
        if (Math.abs(dy) > CONFIG.height / 2) dy = CONFIG.height - Math.abs(dy);
        
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < CONFIG.nodes.connectionDistance) {
          const opacity = (1 - dist / CONFIG.nodes.connectionDistance) * CONFIG.nodes.opacity;
          ctx.globalAlpha = opacity;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
    }
    
    // Draw nodes
    for (const node of nodes) {
      // Alternate colors
      ctx.fillStyle = Math.random() > 0.5 ? CONFIG.colors.gridSecondary : CONFIG.colors.nodes;
      ctx.globalAlpha = CONFIG.nodes.opacity;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2);
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
    console.log('[acidburn-galaxy] Animation started');
  }
  
  function stopAnimation() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // PUBLIC API (optional)
  // ═══════════════════════════════════════════════════════════════
  
  window.acidburnGalaxy = {
    config: CONFIG,
    redraw: draw,
    start: startAnimation,
    stop: stopAnimation,
    getCanvas: () => canvas,
    getTexture: () => texture
  };

  // ═══════════════════════════════════════════════════════════════
  // INIT ON LOAD
  // ═══════════════════════════════════════════════════════════════
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
})();
