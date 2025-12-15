import React, { useState, useEffect, useRef } from 'react';

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

const CyberLanding = () => {
  const [seed] = useState(() => Date.now());
  const rng = useRef(createSeededRNG(seed));
  const [scrollY, setScrollY] = useState(0);
  const [glitchActive, setGlitchActive] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [stats, setStats] = useState({ users: 47892, uptime: 99.97, threats: 2847291 });
  const globeRef = useRef(null);
  const [navOpen, setNavOpen] = useState(false);

  // Scroll tracking
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Glitch effect
  useEffect(() => {
    const interval = setInterval(() => {
      if (rng.current() > 0.75) {
        setGlitchActive(true);
        setTimeout(() => setGlitchActive(false), 100 + rng.current() * 150);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Stats counter animation
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        users: prev.users + Math.floor(rng.current() * 5),
        uptime: 99.97 + rng.current() * 0.02,
        threats: prev.threats + Math.floor(rng.current() * 100)
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Feature rotation
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature(prev => (prev + 1) % 4);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Globe animation
  useEffect(() => {
    const canvas = globeRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let rotation = 0;
    let animId;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const r = Math.min(cx, cy) - 20;

      // Glow
      const gradient = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 1.2);
      gradient.addColorStop(0, 'rgba(191, 0, 255, 0.1)');
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 1;

      // Longitude
      for (let i = 0; i < 18; i++) {
        ctx.beginPath();
        const angle = (i / 18) * Math.PI + rotation;
        for (let j = 0; j <= 50; j++) {
          const lat = (j / 50) * Math.PI;
          const x = cx + Math.cos(angle) * Math.sin(lat) * r;
          const y = cy - Math.cos(lat) * r;
          j === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Latitude
      for (let i = 1; i < 12; i++) {
        ctx.beginPath();
        const lat = (i / 12) * Math.PI;
        const latR = Math.sin(lat) * r;
        const y = cy - Math.cos(lat) * r;
        ctx.ellipse(cx, y, latR, latR * 0.3, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Data nodes
      ctx.fillStyle = '#bf00ff';
      for (let i = 0; i < 12; i++) {
        const nodeAngle = rotation * 1.5 + (i / 12) * Math.PI * 2;
        const nodeLat = 0.2 + Math.sin(i * 2.1) * 0.6;
        const x = cx + Math.cos(nodeAngle) * Math.sin(nodeLat * Math.PI) * r;
        const y = cy - Math.cos(nodeLat * Math.PI) * r;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Connection lines
        if (i > 0) {
          const prevAngle = rotation * 1.5 + ((i-1) / 12) * Math.PI * 2;
          const prevLat = 0.2 + Math.sin((i-1) * 2.1) * 0.6;
          const px = cx + Math.cos(prevAngle) * Math.sin(prevLat * Math.PI) * r;
          const py = cy - Math.cos(prevLat * Math.PI) * r;
          ctx.strokeStyle = 'rgba(191, 0, 255, 0.4)';
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(px, py);
          ctx.stroke();
          ctx.strokeStyle = '#00ffff';
        }
      }

      rotation += 0.008;
      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animId);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (email) {
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
      setEmail('');
    }
  };

  const features = [
    { icon: '◈', title: 'NEURAL DEFENSE', desc: 'AI-powered threat detection operating at machine speed. Zero-day vulnerabilities neutralized before propagation.' },
    { icon: '⬡', title: 'MESH NETWORK', desc: 'Distributed architecture with no single point of failure. Your data exists everywhere and nowhere.' },
    { icon: '◉', title: 'QUANTUM READY', desc: 'Post-quantum cryptographic protocols. Future-proof security against computational paradigm shifts.' },
    { icon: '⎔', title: 'ZERO TRUST', desc: 'Every request authenticated. Every connection verified. Trust nothing, verify everything.' }
  ];

  const testimonials = [
    { name: 'ZERO_COOL', role: 'CTO @ Gibson Corp', text: 'They said our firewall was impenetrable. NEXUS proved them wrong—then fixed it.' },
    { name: 'ACID_BURN', role: 'Security Lead', text: 'The only system I trust with my infrastructure. Mess with the best, protected by the best.' },
    { name: 'THE_PLAGUE', role: 'Ex-Blackhat', text: 'I used to break systems like this for a living. Now I can\'t. Respect.' }
  ];

  // Binary rain generation
  const binaryRain = Array(30).fill(0).map((_, i) => {
    const colRng = createSeededRNG(seed + i);
    return (
      <div
        key={i}
        className="binary-col"
        style={{
          left: `${i * 3.33}%`,
          animationDelay: `${colRng() * 8}s`,
          animationDuration: `${10 + colRng() * 10}s`
        }}
      >
        {Array(40).fill(0).map((_, j) => (
          <span key={j} style={{ opacity: 0.1 + colRng() * 0.3 }}>
            {colRng() > 0.5 ? '1' : '0'}
          </span>
        ))}
      </div>
    );
  });

  return (
    <div className={`cyber-landing ${glitchActive ? 'glitch' : ''}`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=Share+Tech+Mono&family=VT323&display=swap');

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        :root {
          --cyan: #00ffff;
          --purple: #bf00ff;
          --magenta: #ff00ff;
          --green: #00ff88;
          --dark: #050508;
          --panel: rgba(5, 5, 15, 0.95);
        }

        html {
          scroll-behavior: smooth;
        }

        .cyber-landing {
          min-height: 100vh;
          background: var(--dark);
          color: #fff;
          font-family: 'Share Tech Mono', monospace;
          overflow-x: hidden;
          position: relative;
        }

        .cyber-landing::before {
          content: '';
          position: fixed;
          inset: 0;
          background:
            radial-gradient(ellipse at 30% 20%, rgba(191, 0, 255, 0.12) 0%, transparent 50%),
            radial-gradient(ellipse at 70% 80%, rgba(0, 255, 255, 0.12) 0%, transparent 50%);
          pointer-events: none;
          z-index: 0;
        }

        .cyber-landing::after {
          content: '';
          position: fixed;
          inset: 0;
          background: repeating-linear-gradient(
            0deg,
            rgba(0, 0, 0, 0.1) 0px,
            rgba(0, 0, 0, 0.1) 1px,
            transparent 1px,
            transparent 3px
          );
          pointer-events: none;
          z-index: 10000;
          animation: scan 0.1s linear infinite;
        }

        @keyframes scan {
          to { transform: translateY(6px); }
        }

        .cyber-landing.glitch {
          animation: glitchEffect 0.15s linear;
        }

        @keyframes glitchEffect {
          0%, 100% { transform: translate(0); filter: hue-rotate(0); }
          25% { transform: translate(-3px, 2px); filter: hue-rotate(90deg); }
          50% { transform: translate(3px, -2px); filter: hue-rotate(180deg); }
          75% { transform: translate(-2px, -3px); filter: hue-rotate(270deg); }
        }

        /* BINARY RAIN */
        .binary-rain {
          position: fixed;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          z-index: 1;
        }

        .binary-col {
          position: absolute;
          top: -100%;
          font-size: 11px;
          color: var(--cyan);
          writing-mode: vertical-rl;
          animation: fall linear infinite;
        }

        @keyframes fall {
          to { transform: translateY(200vh); }
        }

        /* TIGER STRIPE */
        .tiger-stripe {
          background:
            repeating-linear-gradient(-55deg, var(--purple) 0px, var(--purple) 5px, transparent 5px, transparent 10px),
            repeating-linear-gradient(55deg, var(--cyan) 0px, var(--cyan) 4px, transparent 4px, transparent 12px),
            repeating-linear-gradient(-35deg, rgba(0, 255, 255, 0.4) 0px, rgba(0, 255, 255, 0.4) 2px, transparent 2px, transparent 7px),
            linear-gradient(90deg, var(--purple), var(--cyan), var(--purple));
        }

        .tiger-border {
          border: 3px solid transparent;
          border-image: linear-gradient(135deg, var(--purple), var(--cyan), var(--purple), var(--cyan)) 1;
        }

        /* NAV */
        .nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1000;
          padding: 15px 40px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: ${scrollY > 50 ? 'var(--panel)' : 'transparent'};
          backdrop-filter: ${scrollY > 50 ? 'blur(10px)' : 'none'};
          transition: all 0.3s ease;
          border-bottom: ${scrollY > 50 ? '2px solid var(--purple)' : 'none'};
        }

        .logo {
          font-family: 'Orbitron', sans-serif;
          font-size: 28px;
          font-weight: 900;
          background: linear-gradient(90deg, var(--cyan), var(--purple));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-shadow: 0 0 30px rgba(0, 255, 255, 0.5);
        }

        .nav-links {
          display: flex;
          gap: 40px;
          list-style: none;
        }

        .nav-links a {
          color: var(--cyan);
          text-decoration: none;
          font-size: 14px;
          letter-spacing: 2px;
          transition: all 0.2s;
          position: relative;
        }

        .nav-links a::after {
          content: '';
          position: absolute;
          bottom: -5px;
          left: 0;
          width: 0;
          height: 2px;
          background: var(--purple);
          transition: width 0.3s;
        }

        .nav-links a:hover {
          color: var(--purple);
          text-shadow: 0 0 10px var(--purple);
        }

        .nav-links a:hover::after {
          width: 100%;
        }

        .nav-cta {
          padding: 12px 28px;
          background: transparent;
          border: 2px solid var(--cyan);
          color: var(--cyan);
          font-family: 'Orbitron', sans-serif;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 2px;
          cursor: pointer;
          transition: all 0.3s;
          clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));
        }

        .nav-cta:hover {
          background: var(--cyan);
          color: var(--dark);
          box-shadow: 0 0 30px var(--cyan);
        }

        /* HERO */
        .hero {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          padding: 120px 40px 80px;
          z-index: 10;
        }

        .hero-content {
          max-width: 900px;
          text-align: center;
        }

        .hero-badge {
          display: inline-block;
          padding: 8px 20px;
          font-size: 12px;
          letter-spacing: 3px;
          margin-bottom: 30px;
          position: relative;
        }

        .hero-badge::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            repeating-linear-gradient(-55deg, var(--purple) 0px, var(--purple) 3px, transparent 3px, transparent 8px),
            repeating-linear-gradient(55deg, var(--cyan) 0px, var(--cyan) 2px, transparent 2px, transparent 10px),
            linear-gradient(90deg, var(--purple), var(--cyan));
          opacity: 0.8;
          z-index: -1;
        }

        .hero-badge span {
          color: #000;
          font-weight: bold;
        }

        .hero h1 {
          font-family: 'Orbitron', sans-serif;
          font-size: clamp(48px, 10vw, 100px);
          font-weight: 900;
          line-height: 1;
          margin-bottom: 30px;
        }

        .hero h1 .line1 {
          display: block;
          color: var(--cyan);
          text-shadow: 0 0 40px var(--cyan), 0 0 80px var(--cyan);
        }

        .hero h1 .line2 {
          display: block;
          color: var(--purple);
          text-shadow: 0 0 40px var(--purple), 0 0 80px var(--magenta);
        }

        .hero-sub {
          font-size: 18px;
          color: rgba(255, 255, 255, 0.7);
          max-width: 600px;
          margin: 0 auto 50px;
          line-height: 1.8;
        }

        .hero-buttons {
          display: flex;
          gap: 20px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .btn-primary {
          padding: 18px 45px;
          background: linear-gradient(135deg, var(--purple), var(--cyan));
          border: none;
          color: #000;
          font-family: 'Orbitron', sans-serif;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 2px;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          clip-path: polygon(0 0, calc(100% - 15px) 0, 100% 15px, 100% 100%, 15px 100%, 0 calc(100% - 15px));
          transition: all 0.3s;
        }

        .btn-primary::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
          animation: shine 3s infinite;
        }

        @keyframes shine {
          50%, 100% { left: 100%; }
        }

        .btn-primary:hover {
          transform: scale(1.05);
          box-shadow: 0 0 40px var(--purple);
        }

        .btn-secondary {
          padding: 18px 45px;
          background: transparent;
          border: 2px solid var(--cyan);
          color: var(--cyan);
          font-family: 'Orbitron', sans-serif;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 2px;
          cursor: pointer;
          clip-path: polygon(0 0, calc(100% - 15px) 0, 100% 15px, 100% 100%, 15px 100%, 0 calc(100% - 15px));
          transition: all 0.3s;
        }

        .btn-secondary:hover {
          background: rgba(0, 255, 255, 0.1);
          box-shadow: 0 0 30px rgba(0, 255, 255, 0.3);
        }

        /* STATS BAR */
        .stats-bar {
          display: flex;
          justify-content: center;
          gap: 80px;
          padding: 40px;
          background: var(--panel);
          position: relative;
          z-index: 10;
        }

        .stats-bar::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background:
            repeating-linear-gradient(90deg, var(--purple) 0px, var(--purple) 20px, var(--cyan) 20px, var(--cyan) 40px);
        }

        .stat {
          text-align: center;
        }

        .stat-value {
          font-family: 'Orbitron', sans-serif;
          font-size: 36px;
          font-weight: 700;
          color: var(--cyan);
          text-shadow: 0 0 20px var(--cyan);
        }

        .stat-label {
          font-size: 12px;
          letter-spacing: 3px;
          color: rgba(255, 255, 255, 0.5);
          margin-top: 5px;
        }

        /* FEATURES */
        .features {
          padding: 120px 40px;
          position: relative;
          z-index: 10;
        }

        .section-header {
          text-align: center;
          margin-bottom: 80px;
        }

        .section-tag {
          font-size: 12px;
          letter-spacing: 4px;
          color: var(--purple);
          margin-bottom: 15px;
        }

        .section-title {
          font-family: 'Orbitron', sans-serif;
          font-size: 48px;
          font-weight: 700;
        }

        .section-title span {
          background: linear-gradient(90deg, var(--cyan), var(--purple));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 30px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .feature-card {
          background: var(--panel);
          padding: 40px 30px;
          position: relative;
          transition: all 0.4s;
          overflow: hidden;
        }

        .feature-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background:
            repeating-linear-gradient(-55deg, var(--purple) 0px, var(--purple) 4px, transparent 4px, transparent 8px),
            repeating-linear-gradient(55deg, var(--cyan) 0px, var(--cyan) 3px, transparent 3px, transparent 10px),
            linear-gradient(90deg, var(--purple), var(--cyan));
        }

        .feature-card::after {
          content: '';
          position: absolute;
          inset: 0;
          border: 2px solid transparent;
          border-image: linear-gradient(180deg, var(--purple), transparent) 1;
          pointer-events: none;
        }

        .feature-card:hover {
          transform: translateY(-10px);
          box-shadow: 0 20px 60px rgba(191, 0, 255, 0.2);
        }

        .feature-card.active {
          border: 2px solid var(--cyan);
          box-shadow: 0 0 40px rgba(0, 255, 255, 0.3);
        }

        .feature-icon {
          font-size: 48px;
          color: var(--cyan);
          margin-bottom: 20px;
          text-shadow: 0 0 20px var(--cyan);
        }

        .feature-title {
          font-family: 'Orbitron', sans-serif;
          font-size: 18px;
          font-weight: 700;
          color: var(--purple);
          margin-bottom: 15px;
          letter-spacing: 2px;
        }

        .feature-desc {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.6);
          line-height: 1.8;
        }

        /* GLOBE SECTION */
        .globe-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 80px;
          padding: 120px 80px;
          align-items: center;
          max-width: 1400px;
          margin: 0 auto;
          position: relative;
          z-index: 10;
        }

        .globe-text h2 {
          font-family: 'Orbitron', sans-serif;
          font-size: 42px;
          font-weight: 700;
          margin-bottom: 30px;
          line-height: 1.2;
        }

        .globe-text h2 span {
          color: var(--purple);
          text-shadow: 0 0 20px var(--purple);
        }

        .globe-text p {
          font-size: 16px;
          color: rgba(255, 255, 255, 0.7);
          line-height: 1.9;
          margin-bottom: 40px;
        }

        .globe-features {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .globe-feature {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .globe-feature-icon {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(191, 0, 255, 0.2);
          border: 1px solid var(--purple);
          color: var(--cyan);
          font-size: 18px;
        }

        .globe-feature span {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.8);
        }

        .globe-visual {
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .globe-canvas {
          filter: drop-shadow(0 0 30px rgba(0, 255, 255, 0.4));
        }

        /* TESTIMONIALS */
        .testimonials {
          padding: 120px 40px;
          background: var(--panel);
          position: relative;
          z-index: 10;
        }

        .testimonials::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 6px;
          background:
            repeating-linear-gradient(90deg, var(--cyan) 0px, var(--cyan) 30px, transparent 30px, transparent 60px),
            repeating-linear-gradient(90deg, var(--purple) 15px, var(--purple) 45px, transparent 45px, transparent 75px),
            var(--dark);
        }

        .testimonials-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 30px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .testimonial-card {
          padding: 40px;
          background: rgba(0, 0, 0, 0.4);
          border-left: 4px solid var(--purple);
          position: relative;
        }

        .testimonial-card::before {
          content: '"';
          position: absolute;
          top: 20px;
          right: 30px;
          font-size: 80px;
          color: rgba(0, 255, 255, 0.1);
          font-family: Georgia, serif;
        }

        .testimonial-text {
          font-size: 16px;
          color: rgba(255, 255, 255, 0.8);
          line-height: 1.8;
          margin-bottom: 30px;
          font-style: italic;
        }

        .testimonial-author {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .testimonial-avatar {
          width: 50px;
          height: 50px;
          background: linear-gradient(135deg, var(--purple), var(--cyan));
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Orbitron', sans-serif;
          font-weight: 700;
          color: #000;
        }

        .testimonial-name {
          font-family: 'Orbitron', sans-serif;
          font-size: 14px;
          color: var(--cyan);
        }

        .testimonial-role {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
        }

        /* CTA */
        .cta {
          padding: 120px 40px;
          text-align: center;
          position: relative;
          z-index: 10;
        }

        .cta-box {
          max-width: 700px;
          margin: 0 auto;
          padding: 60px;
          background: var(--panel);
          position: relative;
        }

        .cta-box::before {
          content: '';
          position: absolute;
          inset: 0;
          padding: 3px;
          background: linear-gradient(135deg, var(--purple), var(--cyan), var(--purple));
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
        }

        .cta h2 {
          font-family: 'Orbitron', sans-serif;
          font-size: 36px;
          font-weight: 700;
          margin-bottom: 20px;
        }

        .cta h2 span {
          color: var(--cyan);
          text-shadow: 0 0 20px var(--cyan);
        }

        .cta p {
          color: rgba(255, 255, 255, 0.6);
          margin-bottom: 40px;
        }

        .cta-form {
          display: flex;
          gap: 15px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .cta-input {
          padding: 16px 24px;
          width: 300px;
          background: #000;
          border: 2px solid var(--cyan);
          color: var(--cyan);
          font-family: 'Share Tech Mono', monospace;
          font-size: 14px;
          outline: none;
          transition: all 0.3s;
        }

        .cta-input:focus {
          box-shadow: 0 0 20px rgba(0, 255, 255, 0.3);
        }

        .cta-input::placeholder {
          color: rgba(0, 255, 255, 0.4);
        }

        .cta-submit {
          padding: 16px 40px;
          background: var(--purple);
          border: none;
          color: #fff;
          font-family: 'Orbitron', sans-serif;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 2px;
          cursor: pointer;
          transition: all 0.3s;
        }

        .cta-submit:hover {
          background: var(--cyan);
          color: #000;
          box-shadow: 0 0 30px var(--cyan);
        }

        .cta-submit.success {
          background: var(--green);
        }

        /* FOOTER */
        .footer {
          padding: 60px 40px 30px;
          background: #000;
          position: relative;
          z-index: 10;
        }

        .footer::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background:
            repeating-linear-gradient(-55deg, var(--purple) 0px, var(--purple) 5px, transparent 5px, transparent 10px),
            repeating-linear-gradient(55deg, var(--cyan) 0px, var(--cyan) 4px, transparent 4px, transparent 12px),
            linear-gradient(90deg, var(--purple), var(--cyan), var(--purple));
        }

        .footer-grid {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr;
          gap: 60px;
          max-width: 1200px;
          margin: 0 auto 60px;
        }

        .footer-brand .logo {
          margin-bottom: 20px;
        }

        .footer-brand p {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.5);
          line-height: 1.8;
        }

        .footer-col h4 {
          font-family: 'Orbitron', sans-serif;
          font-size: 14px;
          color: var(--cyan);
          margin-bottom: 20px;
          letter-spacing: 2px;
        }

        .footer-col ul {
          list-style: none;
        }

        .footer-col li {
          margin-bottom: 12px;
        }

        .footer-col a {
          color: rgba(255, 255, 255, 0.5);
          text-decoration: none;
          font-size: 14px;
          transition: color 0.2s;
        }

        .footer-col a:hover {
          color: var(--purple);
        }

        .footer-bottom {
          text-align: center;
          padding-top: 30px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .footer-bottom p {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.3);
        }

        /* MOBILE */
        @media (max-width: 768px) {
          .nav-links { display: none; }
          .globe-section { grid-template-columns: 1fr; padding: 60px 20px; }
          .footer-grid { grid-template-columns: 1fr; gap: 40px; }
          .stats-bar { flex-wrap: wrap; gap: 40px; }
        }
      `}</style>

      {/* Binary Rain */}
      <div className="binary-rain">{binaryRain}</div>

      {/* Nav */}
      <nav className="nav">
        <div className="logo">NEXUS</div>
        <ul className="nav-links">
          <li><a href="#features">FEATURES</a></li>
          <li><a href="#network">NETWORK</a></li>
          <li><a href="#testimonials">OPERATORS</a></li>
          <li><a href="#contact">CONTACT</a></li>
        </ul>
        <button className="nav-cta">ACCESS SYSTEM</button>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge"><span>◈ SECURITY PROTOCOL v4.7.2 ◈</span></div>
          <h1>
            <span className="line1">BREACH</span>
            <span className="line2">NOTHING</span>
          </h1>
          <p className="hero-sub">
            Next-generation cybersecurity infrastructure. Neural threat detection. 
            Quantum-resistant encryption. Your fortress in the digital void.
          </p>
          <div className="hero-buttons">
            <button className="btn-primary">INITIALIZE DEFENSE</button>
            <button className="btn-secondary">VIEW DOCUMENTATION</button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <div className="stats-bar">
        <div className="stat">
          <div className="stat-value">{stats.users.toLocaleString()}</div>
          <div className="stat-label">ACTIVE OPERATORS</div>
        </div>
        <div className="stat">
          <div className="stat-value">{stats.uptime.toFixed(2)}%</div>
          <div className="stat-label">SYSTEM UPTIME</div>
        </div>
        <div className="stat">
          <div className="stat-value">{stats.threats.toLocaleString()}</div>
          <div className="stat-label">THREATS NEUTRALIZED</div>
        </div>
      </div>

      {/* Features */}
      <section className="features" id="features">
        <div className="section-header">
          <div className="section-tag">// CAPABILITIES</div>
          <h2 className="section-title">DEFENSE <span>ARCHITECTURE</span></h2>
        </div>
        <div className="features-grid">
          {features.map((f, i) => (
            <div 
              key={i} 
              className={`feature-card ${activeFeature === i ? 'active' : ''}`}
              onMouseEnter={() => setActiveFeature(i)}
            >
              <div className="feature-icon">{f.icon}</div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Globe Section */}
      <section className="globe-section" id="network">
        <div className="globe-text">
          <h2>GLOBAL <span>MESH</span> NETWORK</h2>
          <p>
            Distributed nodes spanning 47 countries. Real-time threat intelligence 
            shared across the network. When one node learns, every node evolves.
            Your security is collective. Your defense is planetary.
          </p>
          <div className="globe-features">
            <div className="globe-feature">
              <div className="globe-feature-icon">◈</div>
              <span>Sub-10ms threat propagation alerts</span>
            </div>
            <div className="globe-feature">
              <div className="globe-feature-icon">⬡</div>
              <span>Decentralized command infrastructure</span>
            </div>
            <div className="globe-feature">
              <div className="globe-feature-icon">◉</div>
              <span>Geographic redundancy protocols</span>
            </div>
          </div>
        </div>
        <div className="globe-visual">
          <canvas ref={globeRef} width={400} height={400} className="globe-canvas" />
        </div>
      </section>

      {/* Testimonials */}
      <section className="testimonials" id="testimonials">
        <div className="section-header">
          <div className="section-tag">// TRANSMISSIONS</div>
          <h2 className="section-title">OPERATOR <span>REPORTS</span></h2>
        </div>
        <div className="testimonials-grid">
          {testimonials.map((t, i) => (
            <div key={i} className="testimonial-card">
              <p className="testimonial-text">"{t.text}"</p>
              <div className="testimonial-author">
                <div className="testimonial-avatar">{t.name[0]}</div>
                <div>
                  <div className="testimonial-name">{t.name}</div>
                  <div className="testimonial-role">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="cta" id="contact">
        <div className="cta-box">
          <h2>JOIN THE <span>NETWORK</span></h2>
          <p>Initialize your security protocol. Enter the mesh. Become unbreachable.</p>
          <form className="cta-form" onSubmit={handleSubmit}>
            <input 
              type="email" 
              className="cta-input" 
              placeholder="ENTER_EMAIL_ADDRESS"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit" className={`cta-submit ${submitted ? 'success' : ''}`}>
              {submitted ? '◈ LINKED ◈' : 'CONNECT'}
            </button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-grid">
          <div className="footer-brand">
            <div className="logo">NEXUS</div>
            <p>
              Next-generation security infrastructure for those who refuse to be compromised.
              Built by hackers. Defended by machines.
            </p>
          </div>
          <div className="footer-col">
            <h4>PROTOCOL</h4>
            <ul>
              <li><a href="#">Documentation</a></li>
              <li><a href="#">API Reference</a></li>
              <li><a href="#">Changelog</a></li>
              <li><a href="#">Status</a></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>NETWORK</h4>
            <ul>
              <li><a href="#">About</a></li>
              <li><a href="#">Operators</a></li>
              <li><a href="#">Careers</a></li>
              <li><a href="#">Contact</a></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>LEGAL</h4>
            <ul>
              <li><a href="#">Privacy</a></li>
              <li><a href="#">Terms</a></li>
              <li><a href="#">Security</a></li>
              <li><a href="#">Compliance</a></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© 2025 NEXUS SECURITY PROTOCOL // ALL SYSTEMS NOMINAL // SEED: {seed}</p>
        </div>
      </footer>
    </div>
  );
};

export default CyberLanding;
