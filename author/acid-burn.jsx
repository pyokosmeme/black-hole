import React, { useState, useEffect, useRef, useCallback } from 'react';

// Seeded PRNG - Mulberry32
const createSeededRNG = (seed) => {
  let state = seed;
  return () => {
    state |= 0;
    state = state + 0x6D2B79F5 | 0;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
};

const AcidBurnInterface = () => {
  const [seed] = useState(() => Date.now());
  const rng = useRef(createSeededRNG(seed));
  
  const [time, setTime] = useState(new Date());
  const [terminalLines, setTerminalLines] = useState([]);
  const [glitchActive, setGlitchActive] = useState(false);
  const [audioLevel, setAudioLevel] = useState(Array(32).fill(0));
  const [serverMessages, setServerMessages] = useState([]);
  const canvasRef = useRef(null);
  
  const [windows, setWindows] = useState({
    terminal: { minimized: false, maximized: false },
    globe: { minimized: false, maximized: false },
    profile: { minimized: false, maximized: false },
    status: { minimized: false, maximized: false },
    winamp: { minimized: false, maximized: false },
    server: { minimized: false, maximized: false }
  });
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [trackTime, setTrackTime] = useState(3625);
  const [currentTrack, setCurrentTrack] = useState(0);
  const tracks = [
    'CYBER_CORE.mp3 - THE PRODIGY - VOODOO PEOPLE',
    'HACK_THEME.mp3 - ORBITAL - HALCYON',
    'GIBSON.mp3 - MASSIVE ATTACK - ANGEL',
    'ACID_RAIN.mp3 - UNDERWORLD - BORN SLIPPY',
    'ZERO_COOL.mp3 - CHEMICAL BROTHERS - BLOCK ROCKIN'
  ];
  
  const [packetCount, setPacketCount] = useState(0);
  const [connectionCount, setConnectionCount] = useState(0);
  const [systemsOwned, setSystemsOwned] = useState(0);
  const [frameCount, setFrameCount] = useState(0);

  const terminalPool = [
    'SYN_FLOOD initiated on target...',
    'Cracking Gibson mainframe...',
    'COOKIE: monster.com/session_hijack',
    'STATUS: root access GRANTED',
    'Downloading garbage file...',
    'TRACE ROUTE: 127.0.0.1 > VOID',
    'kernel panic - not syncing: ACID',
    'Buffer overflow detected in sector 7G',
    'Injecting polymorphic code...',
    'MESS WITH THE BEST, DIE LIKE THE REST',
    'Connection established: THE_PLAGUE',
    'Decrypting RSA-4096... DONE',
    'rm -rf /gibson/security/*',
    'cat /etc/shadow > lulz.txt',
    'HACK THE PLANET',
    'Worm propagation: 67% complete',
    'Spoofing MAC address...',
    'Zero-day exploit loaded',
    'Firewall? What firewall?',
    'ACCESS LEVEL: GOD MODE'
  ];

  const serverPool = [
    'FAKE SERVER STATUS....',
    'FAKE SERVER ACID_BURN...',
    'FAKE SERVER OUTBOUND....',
    'FAKE SERVER CONVICTION....',
    'FAKE SERVER SYSTEM_CRASH',
    'FAKE SERVER OVERRIDE....',
    'FAKE SERVER PENETRATED',
    'FAKE SERVER COMPROMISED..'
  ];

  const seededChoice = useCallback((arr) => {
    return arr[Math.floor(rng.current() * arr.length)];
  }, []);

  const seededRange = useCallback((min, max) => {
    return min + rng.current() * (max - min);
  }, []);

  const toggleMinimize = (windowName) => {
    setWindows(prev => ({
      ...prev,
      [windowName]: { ...prev[windowName], minimized: !prev[windowName].minimized }
    }));
  };

  const toggleMaximize = (windowName) => {
    setWindows(prev => ({
      ...prev,
      [windowName]: { ...prev[windowName], maximized: !prev[windowName].maximized }
    }));
  };

  const togglePlay = () => setIsPlaying(!isPlaying);
  const nextTrack = () => {
    setCurrentTrack((prev) => (prev + 1) % tracks.length);
    setTrackTime(0);
  };
  const prevTrack = () => {
    setCurrentTrack((prev) => (prev - 1 + tracks.length) % tracks.length);
    setTrackTime(0);
  };
  const stopTrack = () => {
    setIsPlaying(false);
    setTrackTime(0);
  };

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setTrackTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isPlaying]);

  useEffect(() => {
    const interval = setInterval(() => {
      const newLine = seededChoice(terminalPool);
      setTerminalLines(prev => {
        const updated = [...prev, `[${new Date().toLocaleTimeString()}] ${newLine}`];
        return updated.slice(-15);
      });
    }, 800);
    return () => clearInterval(interval);
  }, [seededChoice]);

  useEffect(() => {
    const interval = setInterval(() => {
      const newMsg = seededChoice(serverPool);
      setServerMessages(prev => {
        const updated = [...prev, newMsg];
        return updated.slice(-10);
      });
    }, 600);
    return () => clearInterval(interval);
  }, [seededChoice]);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrameCount(f => f + 1);
      setPacketCount(prev => {
        const growth = Math.floor(seededRange(50, 500));
        return prev + growth;
      });
      setConnectionCount(prev => {
        const delta = Math.floor(seededRange(-5, 15));
        return Math.max(0, Math.min(255, prev + delta));
      });
      setSystemsOwned(prev => {
        if (rng.current() > 0.9) return prev + 1;
        return prev;
      });
    }, 200);
    return () => clearInterval(interval);
  }, [seededRange]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isPlaying) {
        setAudioLevel(Array(32).fill(0));
        return;
      }
      setAudioLevel(prev => prev.map((_, i) => {
        const base = 30 + Math.sin(frameCount * 0.1 + i * 0.3) * 20;
        const noise = seededRange(-20, 40);
        return Math.max(5, Math.min(100, base + noise));
      }));
    }, 80);
    return () => clearInterval(interval);
  }, [isPlaying, frameCount, seededRange]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (rng.current() > 0.7) {
        setGlitchActive(true);
        setTimeout(() => setGlitchActive(false), 150);
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let rotation = 0;
    let animationId;
    
    const drawGlobe = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 1.5;
      
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const r = Math.min(cx, cy) - 15;
      
      for (let i = 0; i < 16; i++) {
        ctx.beginPath();
        const angle = (i / 16) * Math.PI + rotation;
        for (let j = 0; j <= 40; j++) {
          const lat = (j / 40) * Math.PI;
          const x = cx + Math.cos(angle) * Math.sin(lat) * r;
          const y = cy - Math.cos(lat) * r;
          if (j === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      
      for (let i = 1; i < 10; i++) {
        ctx.beginPath();
        const lat = (i / 10) * Math.PI;
        const latR = Math.sin(lat) * r;
        const y = cy - Math.cos(lat) * r;
        ctx.ellipse(cx, y, latR, latR * 0.3, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      ctx.fillStyle = '#ff00ff';
      for (let i = 0; i < 8; i++) {
        const angle = rotation + (i / 8) * Math.PI * 2;
        const lat = 0.3 + Math.sin(i * 1.5) * 0.4;
        const x = cx + Math.cos(angle) * Math.sin(lat * Math.PI) * r;
        const y = cy - Math.cos(lat * Math.PI) * r;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      
      rotation += 0.015;
      animationId = requestAnimationFrame(drawGlobe);
    };
    
    drawGlobe();
    return () => cancelAnimationFrame(animationId);
  }, []);

  const binaryRain = Array(25).fill(0).map((_, i) => {
    const localRng = createSeededRNG(seed + i);
    return (
      <div 
        key={i} 
        className="binary-column"
        style={{
          left: `${i * 4}%`,
          animationDelay: `${localRng() * 5}s`,
          animationDuration: `${8 + localRng() * 7}s`
        }}
      >
        {Array(35).fill(0).map((_, j) => (
          <span key={j} style={{ opacity: 0.2 + localRng() * 0.5 }}>
            {localRng() > 0.5 ? '1' : '0'}
          </span>
        ))}
      </div>
    );
  });

  const formatTime = (d) => {
    return d.toLocaleTimeString('en-US', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
  };

  const formatTrackTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const hexDisplay = Array(10).fill(0).map((_, i) => {
    const lineRng = createSeededRNG(seed + i + frameCount);
    return (
      <div key={i}>
        {Array(24).fill(0).map(() => 
          Math.floor(lineRng() * 16).toString(16).toUpperCase()
        ).join('')}
      </div>
    );
  });

  const WindowChrome = ({ title, windowKey, children, style }) => {
    const isMinimized = windows[windowKey]?.minimized;
    const isMaximized = windows[windowKey]?.maximized;
    
    return (
      <div 
        className={`window ${isMaximized ? 'maximized' : ''}`} 
        style={{
          ...style,
          height: isMinimized ? '38px' : style?.height || 'auto',
          overflow: 'hidden'
        }}
      >
        <div className="window-header">
          <div className="window-header-texture"></div>
          <div className="window-header-noise"></div>
          <div className="window-header-shimmer"></div>
          <span className="window-title">{title}</span>
          <div className="window-controls">
            <button className="window-btn" onClick={() => toggleMinimize(windowKey)}>_</button>
            <button className="window-btn" onClick={() => toggleMaximize(windowKey)}>□</button>
            <button className="window-btn close" onClick={() => toggleMinimize(windowKey)}>×</button>
          </div>
        </div>
        {!isMinimized && <div className="window-content">{children}</div>}
      </div>
    );
  };

  return (
    <div className={`acid-container ${glitchActive ? 'glitch-active' : ''}`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=VT323&family=Share+Tech+Mono&family=Orbitron:wght@400;700;900&display=swap');
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        :root {
          --neon-green: #00ff88;
          --neon-cyan: #00ffff;
          --neon-purple: #bf00ff;
          --neon-magenta: #ff00ff;
          --hot-pink: #ff0099;
          --electric-blue: #00aaff;
          --dark-bg: #0a0a0a;
          --panel-bg: rgba(0, 15, 10, 0.92);
        }
        
        .acid-container {
          min-height: 100vh;
          background: var(--dark-bg);
          background-image: 
            repeating-linear-gradient(
              0deg,
              transparent,
              transparent 2px,
              rgba(0, 255, 136, 0.02) 2px,
              rgba(0, 255, 136, 0.02) 4px
            );
          font-family: 'VT323', monospace;
          color: var(--neon-green);
          overflow: hidden;
          position: relative;
        }
        
        .acid-container::before {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: 
            radial-gradient(ellipse at 20% 20%, rgba(191, 0, 255, 0.15) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, rgba(0, 255, 255, 0.15) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 50%, rgba(0, 255, 136, 0.08) 0%, transparent 60%);
          pointer-events: none;
          z-index: 1;
        }
        
        .acid-container::after {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: repeating-linear-gradient(
            0deg,
            rgba(0, 0, 0, 0.15) 0px,
            rgba(0, 0, 0, 0.15) 1px,
            transparent 1px,
            transparent 3px
          );
          pointer-events: none;
          z-index: 1000;
          animation: scanlines 0.08s linear infinite;
        }
        
        @keyframes scanlines {
          0% { transform: translateY(0); }
          100% { transform: translateY(6px); }
        }
        
        .glitch-active {
          animation: glitch 0.15s linear;
        }
        
        @keyframes glitch {
          0% { transform: translate(0); filter: hue-rotate(0deg); }
          20% { transform: translate(-5px, 3px); filter: hue-rotate(90deg); }
          40% { transform: translate(5px, -3px); filter: hue-rotate(180deg); }
          60% { transform: translate(-3px, 5px); filter: hue-rotate(270deg); }
          80% { transform: translate(3px, -5px); filter: hue-rotate(360deg); }
          100% { transform: translate(0); filter: hue-rotate(0deg); }
        }
        
        .binary-rain {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          overflow: hidden;
          pointer-events: none;
          z-index: 0;
        }
        
        .binary-column {
          position: absolute;
          top: -100%;
          font-size: 12px;
          color: rgba(0, 255, 136, 0.4);
          writing-mode: vertical-rl;
          animation: rain linear infinite;
          text-shadow: 0 0 5px var(--neon-green);
        }
        
        .binary-column span {
          display: block;
          line-height: 1.1;
        }
        
        @keyframes rain {
          0% { transform: translateY(0); }
          100% { transform: translateY(200vh); }
        }
        
        .main-grid {
          display: grid;
          grid-template-columns: 280px 1fr 280px;
          grid-template-rows: auto 1fr auto;
          gap: 12px;
          padding: 12px;
          min-height: 100vh;
          position: relative;
          z-index: 10;
        }
        
        .window {
          background: var(--panel-bg);
          border: 3px solid transparent;
          border-image: linear-gradient(
            135deg,
            var(--neon-purple) 0%,
            var(--neon-cyan) 25%,
            var(--neon-purple) 50%,
            var(--neon-cyan) 75%,
            var(--neon-purple) 100%
          ) 1;
          box-shadow: 
            0 0 15px rgba(191, 0, 255, 0.3),
            0 0 30px rgba(0, 255, 255, 0.2),
            inset 0 0 40px rgba(0, 255, 136, 0.03);
          position: relative;
          transition: all 0.3s ease;
        }
        
        .window.maximized {
          position: fixed;
          top: 50px;
          left: 50px;
          right: 50px;
          bottom: 50px;
          z-index: 500;
        }
        
        /* ═══════════════════════════════════════════════════════════════
           MAXIMUM TEXTURE WINDOW HEADER - LAYERED CHAOS PROTOCOL
           ═══════════════════════════════════════════════════════════════ */
        
        .window-header {
          height: 38px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 12px;
          position: relative;
          overflow: hidden;
          background: #000;
        }
        
        /* BASE LAYER - Primary tiger stripes */
        .window-header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: 
            /* Diagonal stripes - PURPLE dominant */
            repeating-linear-gradient(
              -60deg,
              var(--neon-purple) 0px,
              var(--neon-purple) 6px,
              transparent 6px,
              transparent 12px
            ),
            /* Counter stripes - CYAN accent */
            repeating-linear-gradient(
              60deg,
              var(--neon-cyan) 0px,
              var(--neon-cyan) 4px,
              transparent 4px,
              transparent 14px
            ),
            /* Micro stripes - tight frequency */
            repeating-linear-gradient(
              -45deg,
              rgba(255, 0, 153, 0.6) 0px,
              rgba(255, 0, 153, 0.6) 2px,
              transparent 2px,
              transparent 6px
            ),
            /* Interference pattern */
            repeating-linear-gradient(
              75deg,
              rgba(0, 255, 255, 0.5) 0px,
              rgba(0, 255, 255, 0.5) 3px,
              transparent 3px,
              transparent 9px
            ),
            /* Base gradient */
            linear-gradient(
              90deg,
              var(--neon-purple) 0%,
              var(--neon-cyan) 25%,
              var(--neon-magenta) 50%,
              var(--neon-cyan) 75%,
              var(--neon-purple) 100%
            );
          z-index: 1;
        }
        
        /* TEXTURE LAYER - Additional complexity */
        .window-header-texture {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background:
            /* Vertical micro-lines */
            repeating-linear-gradient(
              90deg,
              transparent 0px,
              transparent 2px,
              rgba(0, 0, 0, 0.3) 2px,
              rgba(0, 0, 0, 0.3) 4px
            ),
            /* Horizontal scan lines */
            repeating-linear-gradient(
              0deg,
              transparent 0px,
              transparent 3px,
              rgba(255, 255, 255, 0.1) 3px,
              rgba(255, 255, 255, 0.1) 4px
            ),
            /* Diagonal noise - opposite angle */
            repeating-linear-gradient(
              -30deg,
              rgba(191, 0, 255, 0.4) 0px,
              transparent 1px,
              transparent 4px,
              rgba(0, 255, 255, 0.4) 5px,
              transparent 6px,
              transparent 8px
            ),
            /* Dense interference */
            repeating-linear-gradient(
              50deg,
              rgba(255, 0, 255, 0.3) 0px,
              rgba(255, 0, 255, 0.3) 1px,
              transparent 1px,
              transparent 5px
            );
          z-index: 2;
          mix-blend-mode: overlay;
        }
        
        /* NOISE LAYER - Pixel dissolution */
        .window-header-noise {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background:
            /* Dot matrix pattern */
            radial-gradient(
              circle at 2px 2px,
              rgba(255, 255, 255, 0.15) 1px,
              transparent 1px
            ),
            /* Secondary dots offset */
            radial-gradient(
              circle at 6px 6px,
              rgba(0, 255, 255, 0.2) 1px,
              transparent 1px
            ),
            /* Tertiary dots */
            radial-gradient(
              circle at 4px 8px,
              rgba(191, 0, 255, 0.2) 1px,
              transparent 1px
            );
          background-size: 8px 8px, 12px 12px, 10px 10px;
          z-index: 3;
          mix-blend-mode: screen;
          opacity: 0.7;
        }
        
        /* SHIMMER LAYER - Animated highlight */
        .window-header-shimmer {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.1) 25%,
            rgba(255, 255, 255, 0.3) 50%,
            rgba(255, 255, 255, 0.1) 75%,
            transparent 100%
          );
          z-index: 4;
          animation: headerShimmer 3s ease-in-out infinite;
          mix-blend-mode: overlay;
        }
        
        @keyframes headerShimmer {
          0%, 100% { transform: translateX(-100%); opacity: 0; }
          50% { transform: translateX(100%); opacity: 1; }
        }
        
        /* Top edge highlight */
        .window-header::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(
            90deg,
            var(--neon-cyan),
            var(--neon-magenta),
            var(--neon-cyan),
            var(--neon-purple),
            var(--neon-cyan)
          );
          z-index: 5;
          box-shadow: 0 0 10px var(--neon-cyan);
        }
        
        .window-title {
          color: #000;
          font-size: 14px;
          font-weight: bold;
          font-family: 'Orbitron', sans-serif;
          text-shadow: 
            0 0 5px rgba(255, 255, 255, 0.8),
            1px 1px 0 rgba(0, 255, 255, 0.5),
            -1px -1px 0 rgba(191, 0, 255, 0.5);
          position: relative;
          z-index: 10;
          letter-spacing: 2px;
        }
        
        .window-controls {
          display: flex;
          gap: 5px;
          position: relative;
          z-index: 10;
        }
        
        .window-btn {
          width: 22px;
          height: 22px;
          background: #000;
          border: 2px solid var(--neon-cyan);
          color: var(--neon-cyan);
          font-size: 12px;
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
          font-family: 'VT323', monospace;
          box-shadow: 
            inset 0 0 5px rgba(0, 255, 255, 0.3),
            0 0 5px rgba(0, 255, 255, 0.3);
        }
        
        .window-btn:hover {
          background: var(--neon-cyan);
          color: #000;
          box-shadow: 0 0 15px var(--neon-cyan);
          transform: scale(1.1);
        }
        
        .window-btn.close {
          border-color: var(--hot-pink);
          color: var(--hot-pink);
          box-shadow: 
            inset 0 0 5px rgba(255, 0, 153, 0.3),
            0 0 5px rgba(255, 0, 153, 0.3);
        }
        
        .window-btn.close:hover {
          background: var(--hot-pink);
          color: #000;
          box-shadow: 0 0 15px var(--hot-pink);
        }
        
        .window-content {
          padding: 12px;
          height: calc(100% - 38px);
        }
        
        .header-bar {
          grid-column: 1 / -1;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 20px;
          background: var(--panel-bg);
          border: 3px solid transparent;
          border-image: linear-gradient(90deg, var(--neon-purple), var(--neon-cyan), var(--neon-purple)) 1;
          position: relative;
        }
        
        .header-bar::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: repeating-linear-gradient(
            90deg,
            var(--neon-purple) 0px,
            var(--neon-purple) 20px,
            var(--neon-cyan) 20px,
            var(--neon-cyan) 40px
          );
        }
        
        .url-bar {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
          max-width: 500px;
          margin: 0 30px;
        }
        
        .url-bar input {
          background: #000;
          border: 2px solid var(--neon-cyan);
          color: var(--neon-cyan);
          padding: 6px 15px;
          font-family: 'Share Tech Mono', monospace;
          width: 100%;
          font-size: 14px;
        }
        
        .timer {
          font-family: 'Orbitron', sans-serif;
          font-size: 20px;
          color: var(--neon-cyan);
          text-shadow: 0 0 15px var(--neon-cyan);
        }
        
        .center-column {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }
        
        .acid-title {
          font-family: 'Orbitron', sans-serif;
          font-size: 90px;
          font-weight: 900;
          text-align: center;
          position: relative;
          animation: title-pulse 2s ease-in-out infinite;
          padding: 20px 0;
        }
        
        .acid-title .acid {
          color: var(--neon-cyan);
          text-shadow: 
            0 0 20px var(--neon-cyan),
            0 0 40px var(--neon-cyan),
            0 0 80px var(--neon-cyan),
            4px 4px 0 var(--neon-purple);
          letter-spacing: -5px;
        }
        
        .acid-title .burn {
          color: var(--neon-purple);
          text-shadow: 
            0 0 20px var(--neon-purple),
            0 0 40px var(--neon-purple),
            0 0 80px var(--neon-magenta),
            4px 4px 0 var(--neon-cyan);
          margin-left: 25px;
        }
        
        @keyframes title-pulse {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.4); }
        }
        
        .portrait-container {
          position: relative;
          width: 100%;
          height: 350px;
          border: 4px solid var(--neon-purple);
          overflow: hidden;
          background: 
            repeating-linear-gradient(
              0deg,
              rgba(191, 0, 255, 0.1) 0px,
              transparent 2px,
              transparent 4px
            ),
            linear-gradient(180deg, #000a05 0%, #001a0f 100%);
        }
        
        .portrait-frame {
          position: absolute;
          inset: 0;
          border: 25px solid transparent;
          border-image: repeating-linear-gradient(
            45deg,
            var(--neon-purple) 0px,
            var(--neon-purple) 8px,
            var(--neon-cyan) 8px,
            var(--neon-cyan) 16px
          ) 25;
        }
        
        .portrait-glitch {
          position: absolute;
          inset: 25px;
          background: 
            linear-gradient(180deg, 
              transparent 0%, 
              rgba(191, 0, 255, 0.15) 50%, 
              transparent 100%);
          animation: portrait-scan 2.5s linear infinite;
        }
        
        @keyframes portrait-scan {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(100%); }
        }
        
        .portrait-icon {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 150px;
          color: var(--neon-purple);
          text-shadow: 
            0 0 30px var(--neon-purple),
            0 0 60px var(--neon-magenta);
          animation: icon-flicker 3s ease-in-out infinite;
        }
        
        @keyframes icon-flicker {
          0%, 90%, 100% { opacity: 1; }
          92%, 94%, 96% { opacity: 0.7; }
          93%, 95% { opacity: 0.3; }
        }
        
        .portrait-text {
          position: absolute;
          bottom: 35px;
          left: 50%;
          transform: translateX(-50%);
          font-family: 'Orbitron', sans-serif;
          font-size: 22px;
          color: var(--neon-cyan);
          text-shadow: 0 0 20px var(--neon-cyan);
          white-space: nowrap;
          letter-spacing: 3px;
        }
        
        .terminal {
          font-size: 13px;
          line-height: 1.5;
          overflow: hidden;
          height: 100%;
        }
        
        .terminal-line {
          opacity: 0;
          animation: terminal-fade 0.3s forwards;
        }
        
        .terminal-line:nth-child(odd) {
          color: var(--neon-cyan);
        }
        
        .terminal-line:nth-child(even) {
          color: var(--neon-purple);
        }
        
        @keyframes terminal-fade {
          to { opacity: 1; }
        }
        
        .cursor-blink {
          animation: blink 1s step-end infinite;
        }
        
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        
        .status-panel {
          font-size: 13px;
          line-height: 2;
        }
        
        .status-line {
          display: flex;
          justify-content: space-between;
          border-bottom: 1px solid rgba(0, 255, 255, 0.1);
        }
        
        .status-ok { color: var(--neon-green); text-shadow: 0 0 5px var(--neon-green); }
        .status-warn { color: #ffaa00; text-shadow: 0 0 5px #ffaa00; }
        .status-error { color: #ff4466; text-shadow: 0 0 5px #ff4466; }
        
        .globe-container {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100%;
        }
        
        .globe-canvas {
          filter: drop-shadow(0 0 15px rgba(0, 255, 136, 0.6));
        }
        
        .winamp {
          background: linear-gradient(180deg, #0d0d1a 0%, #050510 100%);
        }
        
        .winamp-display {
          background: #000;
          border: 3px inset #222;
          padding: 12px;
          margin-bottom: 10px;
        }
        
        .winamp-time {
          font-family: 'Orbitron', sans-serif;
          font-size: 32px;
          color: var(--neon-green);
          text-shadow: 0 0 15px var(--neon-green);
        }
        
        .winamp-track {
          font-size: 13px;
          color: var(--neon-cyan);
          margin-top: 8px;
          overflow: hidden;
          white-space: nowrap;
        }
        
        .winamp-track-inner {
          display: inline-block;
          animation: marquee 12s linear infinite;
        }
        
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        
        .visualizer {
          display: flex;
          align-items: flex-end;
          gap: 2px;
          height: 70px;
          background: #000;
          padding: 6px;
          border: 3px inset #222;
        }
        
        .viz-bar {
          flex: 1;
          background: linear-gradient(180deg, var(--neon-magenta) 0%, var(--neon-purple) 40%, var(--neon-cyan) 100%);
          transition: height 0.08s ease;
          box-shadow: 0 0 5px var(--neon-purple);
        }
        
        .winamp-controls {
          display: flex;
          gap: 6px;
          margin-top: 12px;
        }
        
        .winamp-btn {
          flex: 1;
          padding: 10px;
          background: #001515;
          border: 2px solid var(--neon-cyan);
          color: var(--neon-cyan);
          font-family: 'VT323', monospace;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        
        .winamp-btn:hover {
          background: var(--neon-cyan);
          color: #000;
          box-shadow: 0 0 15px var(--neon-cyan);
        }
        
        .winamp-btn:active {
          transform: scale(0.95);
        }
        
        .winamp-btn.active {
          background: var(--neon-purple);
          border-color: var(--neon-purple);
          color: #fff;
        }
        
        .hack-buttons {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 15px;
        }
        
        .hack-btn {
          padding: 18px 30px;
          background: rgba(191, 0, 255, 0.1);
          border: 3px solid var(--neon-purple);
          color: var(--neon-cyan);
          font-family: 'Orbitron', sans-serif;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          text-transform: uppercase;
          letter-spacing: 2px;
          clip-path: polygon(
            0 0, 
            calc(100% - 18px) 0, 
            100% 18px, 
            100% 100%, 
            18px 100%, 
            0 calc(100% - 18px)
          );
          transition: all 0.2s ease;
        }
        
        .hack-btn::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(0, 255, 255, 0.4), transparent);
          animation: btn-shine 2.5s infinite;
        }
        
        @keyframes btn-shine {
          0% { left: -100%; }
          50%, 100% { left: 100%; }
        }
        
        .hack-btn:hover {
          background: rgba(0, 255, 255, 0.2);
          border-color: var(--neon-cyan);
          box-shadow: 
            0 0 25px rgba(0, 255, 255, 0.5),
            inset 0 0 25px rgba(191, 0, 255, 0.2);
          transform: translateX(5px);
        }
        
        .hack-btn.primary {
          background: linear-gradient(135deg, rgba(191, 0, 255, 0.3) 0%, rgba(0, 255, 255, 0.3) 100%);
          font-size: 20px;
          padding: 22px 30px;
        }
        
        .server-output {
          font-size: 12px;
          font-family: 'Share Tech Mono', monospace;
          height: 100%;
          overflow: hidden;
        }
        
        .server-line {
          padding: 3px 0;
          border-bottom: 1px solid rgba(191, 0, 255, 0.15);
          color: var(--neon-purple);
        }
        
        .server-line:nth-child(odd) {
          color: var(--neon-cyan);
        }
        
        .hex-display {
          position: fixed;
          top: 60px;
          left: 15px;
          font-size: 10px;
          color: rgba(191, 0, 255, 0.4);
          font-family: 'Share Tech Mono', monospace;
          line-height: 1.3;
          z-index: 5;
          pointer-events: none;
        }
        
        .footer-bar {
          grid-column: 1 / -1;
          display: flex;
          justify-content: center;
          gap: 50px;
          padding: 15px 20px;
          background: var(--panel-bg);
          border: 3px solid transparent;
          border-image: linear-gradient(90deg, var(--neon-cyan), var(--neon-purple), var(--neon-cyan)) 1;
        }
        
        .footer-stat {
          text-align: center;
        }
        
        .footer-label {
          font-size: 11px;
          color: rgba(0, 255, 255, 0.6);
          text-transform: uppercase;
          letter-spacing: 2px;
        }
        
        .footer-value {
          font-family: 'Orbitron', sans-serif;
          font-size: 22px;
          color: var(--neon-cyan);
          text-shadow: 0 0 15px var(--neon-cyan);
        }
        
        .footer-value.danger {
          color: var(--neon-magenta);
          text-shadow: 0 0 15px var(--neon-magenta);
          animation: danger-pulse 1s ease-in-out infinite;
        }
        
        @keyframes danger-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        
        .corner-decor {
          position: fixed;
          width: 80px;
          height: 80px;
          pointer-events: none;
          z-index: 100;
        }
        
        .corner-decor::before,
        .corner-decor::after {
          content: '';
          position: absolute;
          background: linear-gradient(90deg, var(--neon-purple), var(--neon-cyan));
        }
        
        .corner-decor.tl { top: 8px; left: 8px; }
        .corner-decor.tl::before { width: 100%; height: 3px; top: 0; left: 0; }
        .corner-decor.tl::after { width: 3px; height: 100%; top: 0; left: 0; }
        
        .corner-decor.tr { top: 8px; right: 8px; }
        .corner-decor.tr::before { width: 100%; height: 3px; top: 0; right: 0; }
        .corner-decor.tr::after { width: 3px; height: 100%; top: 0; right: 0; }
        
        .corner-decor.bl { bottom: 8px; left: 8px; }
        .corner-decor.bl::before { width: 100%; height: 3px; bottom: 0; left: 0; }
        .corner-decor.bl::after { width: 3px; height: 100%; bottom: 0; left: 0; }
        
        .corner-decor.br { bottom: 8px; right: 8px; }
        .corner-decor.br::before { width: 100%; height: 3px; bottom: 0; right: 0; }
        .corner-decor.br::after { width: 3px; height: 100%; bottom: 0; right: 0; }
        
        .seed-display {
          position: fixed;
          bottom: 10px;
          left: 10px;
          font-size: 10px;
          color: rgba(191, 0, 255, 0.5);
          font-family: 'Share Tech Mono', monospace;
          z-index: 1001;
        }
      `}</style>

      <div className="binary-rain">{binaryRain}</div>

      <div className="corner-decor tl" />
      <div className="corner-decor tr" />
      <div className="corner-decor bl" />
      <div className="corner-decor br" />

      <div className="hex-display">{hexDisplay}</div>

      <div className="seed-display">SEED: {seed}</div>

      <div className="main-grid">
        <div className="header-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px', color: 'var(--neon-purple)', textShadow: '0 0 10px var(--neon-purple)' }}>☠</span>
            <span style={{ fontFamily: 'Orbitron', fontWeight: 'bold', fontSize: '18px', color: 'var(--neon-cyan)' }}>ACID BURN</span>
          </div>
          <div className="url-bar">
            <input type="text" value="http://www.hacktheplanet.net" readOnly />
          </div>
          <div className="timer">{formatTime(time)}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <WindowChrome title="TERMINAL" windowKey="terminal" style={{ flex: 1 }}>
            <div className="terminal">
              {terminalLines.map((line, i) => (
                <div key={i} className="terminal-line">{line}</div>
              ))}
              <span className="cursor-blink">█</span>
            </div>
          </WindowChrome>

          <WindowChrome title="GLOBE_TRACE" windowKey="globe" style={{ height: '220px' }}>
            <div className="globe-container">
              <canvas ref={canvasRef} width={180} height={180} className="globe-canvas" />
            </div>
          </WindowChrome>
        </div>

        <div className="center-column">
          <div className="acid-title">
            <span className="acid">ACID</span>
            <span className="burn">BURN</span>
          </div>

          <WindowChrome title="USER_PROFILE" windowKey="profile" style={{ flex: 1 }}>
            <div className="portrait-container">
              <div className="portrait-frame" />
              <div className="portrait-glitch" />
              <div className="portrait-icon">☠</div>
              <div className="portrait-text">:: ELITE HACKER ::</div>
            </div>
          </WindowChrome>

          <div className="hack-buttons">
            <button className="hack-btn">⟨ SYSTEM BREACH ⟩</button>
            <button className="hack-btn">⟨ DATA FLOW ⟩</button>
            <button className="hack-btn">⟨ USER: ACID_BURN ⟩</button>
            <button className="hack-btn primary">HACK THE PLANET</button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <WindowChrome title="STATUS" windowKey="status">
            <div className="status-panel">
              <div className="status-line">
                <span>Server status</span>
                <span className="status-ok">ONLINE</span>
              </div>
              <div className="status-line">
                <span>Gibson link</span>
                <span className="status-ok">ACTIVE</span>
              </div>
              <div className="status-line">
                <span>Trace evasion</span>
                <span className="status-warn">RUNNING</span>
              </div>
              <div className="status-line">
                <span>Security</span>
                <span className="status-error">BREACHED</span>
              </div>
              <div className="status-line">
                <span>Cookie theft</span>
                <span className="status-ok">ENABLED</span>
              </div>
            </div>
          </WindowChrome>

          <WindowChrome title="WINAMP" windowKey="winamp">
            <div className="winamp-display">
              <div className="winamp-time">{formatTrackTime(trackTime)}</div>
              <div className="winamp-track">
                <span className="winamp-track-inner">{tracks[currentTrack]}</span>
              </div>
            </div>
            <div className="visualizer">
              {audioLevel.map((level, i) => (
                <div 
                  key={i} 
                  className="viz-bar" 
                  style={{ height: `${level}%` }}
                />
              ))}
            </div>
            <div className="winamp-controls">
              <button className="winamp-btn" onClick={prevTrack}>⏮</button>
              <button className={`winamp-btn ${isPlaying ? 'active' : ''}`} onClick={togglePlay}>
                {isPlaying ? '⏸' : '▶'}
              </button>
              <button className="winamp-btn" onClick={stopTrack}>⏹</button>
              <button className="winamp-btn" onClick={nextTrack}>⏭</button>
            </div>
          </WindowChrome>

          <WindowChrome title="SERVER_LOG" windowKey="server" style={{ flex: 1 }}>
            <div className="server-output">
              {serverMessages.map((msg, i) => (
                <div key={i} className="server-line">{msg}</div>
              ))}
            </div>
          </WindowChrome>
        </div>

        <div className="footer-bar">
          <div className="footer-stat">
            <div className="footer-label">PACKETS SENT</div>
            <div className="footer-value">{packetCount.toLocaleString()}</div>
          </div>
          <div className="footer-stat">
            <div className="footer-label">CONNECTIONS</div>
            <div className="footer-value">{connectionCount}</div>
          </div>
          <div className="footer-stat">
            <div className="footer-label">SYSTEMS OWNED</div>
            <div className="footer-value">{systemsOwned}</div>
          </div>
          <div className="footer-stat">
            <div className="footer-label">THREAT LEVEL</div>
            <div className="footer-value danger">MAXIMUM</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AcidBurnInterface;
