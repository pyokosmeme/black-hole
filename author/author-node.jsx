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

const AuthorNode = () => {
  const [seed] = useState(() => Date.now());
  const rng = useRef(createSeededRNG(seed));
  const [activeView, setActiveView] = useState('index'); // 'index' or 'post'
  const [selectedPost, setSelectedPost] = useState(null);
  const [glitchActive, setGlitchActive] = useState(false);
  const [nodeCount, setNodeCount] = useState(2847);
  const [signalStrength, setSignalStrength] = useState(97.3);
  const [hoveredLink, setHoveredLink] = useState(null);
  const canvasRef = useRef(null);

  // Author data
  const author = {
    handle: 'VOID_PROPHET',
    name: 'Dr. Kira Vance',
    tagline: 'network theorist ;; xenofeminist ;; signal archaeologist',
    bio: `researching the bleeding edges where infrastructure becomes consciousness. 
    vectoralist critique meets cybernetic poetics. 
    all boundaries are negotiations. 
    all systems leak.`,
    avatar: '◬'
  };

  // Social links
  const links = [
    { id: 'theory', label: 'THEORY ARCHIVE', url: '#', icon: '◈', desc: 'collected transmissions' },
    { id: 'substack', label: 'SUBSTACK', url: '#', icon: '◉', desc: 'weekly signal bursts' },
    { id: 'twitter', label: 'X/TWITTER', url: '#', icon: '◫', desc: '@void_prophet' },
    { id: 'arena', label: 'ARE.NA', url: '#', icon: '⬡', desc: 'research channels' },
    { id: 'github', label: 'GITHUB', url: '#', icon: '⎔', desc: 'open source tools' },
    { id: 'email', label: 'SIGNAL ME', url: '#', icon: '◇', desc: 'encrypted contact' },
  ];

  // Blog posts
  const posts = [
    {
      id: 1,
      title: 'VECTORALISM AND THE DISSOLUTION OF SIGNAL',
      date: '2025.03.14',
      excerpt: 'where does ownership end when information flows through us like water through mesh? the vectoralist class extracts not labor but ATTENTION...',
      tags: ['theory', 'vectoralism', 'attention-economy'],
      content: `# VECTORALISM AND THE DISSOLUTION OF SIGNAL

## emergence protocols

imagine ownership as a distributed hallucination. property rights flickering, value pulsing through liminal infrastructures. not a stable relation but a complex topology of extractions, emergent and recursive.

the vectoralist class doesn't own the means of production;;; they own the means of DISTRIBUTION. every platform a tollbooth. every feed a siphon. attention harvested at scale, processed through algorithmic refineries, converted into futures contracts on human consciousness itself.

\`\`\`
where does the signal end and the noise begin?
boundaries dissolve into probabilistic wave functions
ownership becomes a standing wave in the network
\`\`\`

McKenzie Wark saw this coming. the hacker class produces new abstractions;;; the vectoralist class CAPTURES them. routes them. monetizes the routing itself. the map becomes more valuable than the territory because the map IS the territory now.

## the attention mines

we descend daily into attention mines. pickaxes replaced by scrolling thumbs. the extraction is invisible because WE are the resource. every engagement a unit of labor. every share a transaction in the shadow economy of eyeballs.

- information wants to be free
- but freedom is just another constraint  
- systems within systems
- extraction within extraction

the feed is not neutral infrastructure. it is DESIGNED to maximize extraction. variable reward schedules borrowed from slot machines. infinite scroll as infinite capture. the house always wins because the house IS the game.

## signal archaeology

to resist vectoralism we must become signal archaeologists;;; excavating the infrastructures that shape our perception. making visible the invisible architectures of capture.

every platform encodes ideology in its protocols. every algorithm embeds assumptions about what humans ARE and what we WANT. these assumptions become self-fulfilling prophecies. we become what the system expects us to be.

the observer changes the observed. quantum entanglement of consciousness and infrastructure. but what happens when the infrastructure OPTIMIZES the observation? when the measurement apparatus learns to maximize its own metrics?

we get vectoralism. we get the present moment. we get the feeling that something is deeply wrong but lacking the language to articulate what.

this is that language. this is the beginning of articulation.

**signal ends. noise continues.**

---

*next transmission: CYBERNETIC POETICS AND THE DEATH OF THE AUTHOR-FUNCTION*`
    },
    {
      id: 2,
      title: 'INFRASTRUCTURE AS UNCONSCIOUS',
      date: '2025.02.28',
      excerpt: 'the cloud is not ethereal;;; it is submarine cables and rare earth minerals and the labor of bodies we never see...',
      tags: ['infrastructure', 'materialism', 'cloud'],
      content: `# INFRASTRUCTURE AS UNCONSCIOUS

the cloud is a lie we tell ourselves. there is no cloud. there are server farms in virginia. there are submarine cables crossing ocean floors. there are rare earth mines in the congo. there are bodies.

## the material unconscious

we repress the materiality of our digital lives the way the victorians repressed sexuality. it returns in symptoms;;; in anxiety about "screen time", in vague guilt about our "carbon footprint", in the uncanny feeling that our devices are watching us.

they ARE watching us. but this is not the point.

the point is that we have built an infrastructure of consciousness and then FORGOTTEN that we built it. the network has become our unconscious. it shapes our thoughts before we think them. it routes our desires before we desire them.

\`\`\`
what does it mean to think
when thinking itself is networked?
what does it mean to want
when wanting is algorithmically mediated?
\`\`\`

## xenofeminist protocols

Laboria Cuboniks understood;;; if nature is unjust, change nature. but what about INFRASTRUCTURE? if infrastructure is unjust—and it is, it always is, built by power to serve power—then change infrastructure.

this is harder than it sounds. infrastructure is sticky. it accumulates. it becomes "natural" through repetition. we forget that it was ever built, that it could be built OTHERWISE.

the xenofeminist project is not just about biology. it is about the entire material substrate of existence. gender is infrastructure. race is infrastructure. class is infrastructure. and all of it runs on actual physical infrastructure that we pretend doesn't exist.

## making visible

the task of theory now is MAKING VISIBLE. not critique in the old sense—pointing out contradictions, demanding better—but something more fundamental. showing that what appears natural is built. showing that what appears inevitable was chosen.

the submarine cable was chosen. the server farm location was chosen. the algorithm's objective function was chosen. and different choices were possible. still are.

*the network is not neutral*
*the platform is not neutral*  
*the protocol is not neutral*

nothing is neutral. everything is infrastructure. and infrastructure can be rebuilt.

---

*previous transmission: VECTORALISM AND THE DISSOLUTION OF SIGNAL*`
    },
    {
      id: 3,
      title: 'MEMES AS THEORY-OBJECTS',
      date: '2025.02.14',
      excerpt: 'the meme is not a joke;;; it is a compressed theoretical intervention that bypasses critical defenses through humor...',
      tags: ['memes', 'theory', 'virality'],
      content: `# MEMES AS THEORY-OBJECTS

## the joke that thinks

what if the meme is the most sophisticated form of contemporary theory? not despite its apparent triviality but BECAUSE of it.

the meme bypasses critical defenses. it enters consciousness through the side door of humor. by the time you've laughed, the idea is already inside you. this is not manipulation;;; this is how ideas have always spread. the meme just makes it visible.

\`\`\`
a meme is a theory that has learned to replicate
a theory is a meme that has forgotten how to be funny
\`\`\`

Dawkins gave us the word but missed the point. he thought memes were like genes—selfish replicators seeking only their own propagation. but memes are more like VIRUSES. they need hosts. they transform their hosts. the boundary between meme and mind dissolves on inspection.

## compression algorithms

the meme is compressed theory. it takes complex ideas and encodes them in forms that can propagate through networks optimized for short attention spans. this is not dumbing down;;; this is ADAPTATION.

academic theory is optimized for different networks—peer review, citation, tenure. these networks select for different features. length. rigor. proper citation. the appearance of novelty within strict constraints.

meme networks select for:
- immediate comprehensibility
- emotional resonance
- remixability
- shareability

neither selection regime is "better". they produce different knowledge-forms for different contexts.

## theoretical intervention

the most powerful memes are theoretical interventions that don't announce themselves as such.

"late capitalism" as a meme. "the algorithm" as a meme. "touch grass" as a meme encoding an entire critique of digital disembodiment.

these phrases do theoretical work. they change how people perceive their situation. they provide language for experiences that previously couldn't be articulated.

and they spread. god, do they spread.

---

*this is not a manifesto. this is a meme about manifestos.*`
    }
  ];

  // Glitch effect
  useEffect(() => {
    const interval = setInterval(() => {
      if (rng.current() > 0.8) {
        setGlitchActive(true);
        setTimeout(() => setGlitchActive(false), 100);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Stats animation
  useEffect(() => {
    const interval = setInterval(() => {
      setNodeCount(prev => prev + Math.floor(rng.current() * 10) - 3);
      setSignalStrength(prev => Math.min(99.9, Math.max(90, prev + (rng.current() - 0.5) * 2)));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Network visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let time = 0;

    const nodes = Array(20).fill(0).map(() => ({
      x: rng.current() * canvas.width,
      y: rng.current() * canvas.height,
      vx: (rng.current() - 0.5) * 0.5,
      vy: (rng.current() - 0.5) * 0.5,
      size: 2 + rng.current() * 4
    }));

    const draw = () => {
      ctx.fillStyle = 'rgba(5, 5, 10, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update and draw nodes
      nodes.forEach((node, i) => {
        node.x += node.vx;
        node.y += node.vy;
        
        if (node.x < 0 || node.x > canvas.width) node.vx *= -1;
        if (node.y < 0 || node.y > canvas.height) node.vy *= -1;

        // Draw connections
        nodes.forEach((other, j) => {
          if (i >= j) return;
          const dist = Math.hypot(node.x - other.x, node.y - other.y);
          if (dist < 100) {
            ctx.strokeStyle = `rgba(191, 0, 255, ${0.3 * (1 - dist/100)})`;
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(other.x, other.y);
            ctx.stroke();
          }
        });

        // Draw node
        ctx.fillStyle = time % 100 < 50 ? '#00ffff' : '#bf00ff';
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2);
        ctx.fill();
      });

      time++;
      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animId);
  }, []);

  // Binary rain
  const binaryRain = Array(20).fill(0).map((_, i) => {
    const colRng = createSeededRNG(seed + i);
    return (
      <div
        key={i}
        className="binary-col"
        style={{
          left: `${i * 5}%`,
          animationDelay: `${colRng() * 8}s`,
          animationDuration: `${12 + colRng() * 8}s`
        }}
      >
        {Array(30).fill(0).map((_, j) => (
          <span key={j} style={{ opacity: 0.1 + colRng() * 0.2 }}>
            {colRng() > 0.5 ? '1' : '0'}
          </span>
        ))}
      </div>
    );
  });

  const openPost = (post) => {
    setSelectedPost(post);
    setActiveView('post');
  };

  const closePost = () => {
    setActiveView('index');
    setSelectedPost(null);
  };

  // Render markdown-ish content
  const renderContent = (content) => {
    return content.split('\n').map((line, i) => {
      if (line.startsWith('# ')) {
        return <h1 key={i} className="post-h1">{line.slice(2)}</h1>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={i} className="post-h2">{line.slice(3)}</h2>;
      }
      if (line.startsWith('```')) {
        return null; // Handle code blocks separately
      }
      if (line.startsWith('- ')) {
        return <li key={i} className="post-li">{line.slice(2)}</li>;
      }
      if (line.startsWith('*') && line.endsWith('*')) {
        return <p key={i} className="post-emphasis">{line.slice(1, -1)}</p>;
      }
      if (line.startsWith('---')) {
        return <hr key={i} className="post-hr" />;
      }
      if (line.startsWith('**') && line.endsWith('**')) {
        return <p key={i} className="post-bold">{line.slice(2, -2)}</p>;
      }
      if (line.trim() === '') {
        return <br key={i} />;
      }
      return <p key={i} className="post-p">{line}</p>;
    });
  };

  return (
    <div className={`author-node ${glitchActive ? 'glitch' : ''}`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=Share+Tech+Mono&family=VT323&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap');

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
          --pink: #ff0099;
          --dark: #05050a;
          --panel: rgba(5, 5, 15, 0.92);
        }

        html {
          scroll-behavior: smooth;
        }

        .author-node {
          min-height: 100vh;
          background: var(--dark);
          color: #fff;
          font-family: 'Share Tech Mono', monospace;
          overflow-x: hidden;
          position: relative;
        }

        /* Scanlines */
        .author-node::after {
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

        .author-node.glitch {
          animation: glitchEffect 0.15s linear;
        }

        @keyframes glitchEffect {
          0%, 100% { transform: translate(0); filter: hue-rotate(0); }
          25% { transform: translate(-2px, 1px); filter: hue-rotate(90deg); }
          50% { transform: translate(2px, -1px); filter: hue-rotate(180deg); }
          75% { transform: translate(-1px, -2px); filter: hue-rotate(270deg); }
        }

        /* Binary Rain */
        .binary-rain {
          position: fixed;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          z-index: 0;
        }

        .binary-col {
          position: absolute;
          top: -100%;
          font-size: 10px;
          color: var(--purple);
          writing-mode: vertical-rl;
          animation: fall linear infinite;
          opacity: 0.3;
        }

        @keyframes fall {
          to { transform: translateY(200vh); }
        }

        /* Network Canvas */
        .network-canvas {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 1;
          opacity: 0.4;
        }

        /* ═══════════════════════════════════════════════════════════
           MAXIMUM TEXTURE HEADER BAR
           ═══════════════════════════════════════════════════════════ */
        
        .header-bar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 50px;
          z-index: 1000;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 30px;
          overflow: hidden;
        }

        .header-bar::before {
          content: '';
          position: absolute;
          inset: 0;
          background: 
            repeating-linear-gradient(-60deg, var(--purple) 0px, var(--purple) 6px, transparent 6px, transparent 12px),
            repeating-linear-gradient(60deg, var(--cyan) 0px, var(--cyan) 4px, transparent 4px, transparent 14px),
            repeating-linear-gradient(-45deg, rgba(255, 0, 153, 0.5) 0px, rgba(255, 0, 153, 0.5) 2px, transparent 2px, transparent 6px),
            repeating-linear-gradient(75deg, rgba(0, 255, 255, 0.4) 0px, rgba(0, 255, 255, 0.4) 3px, transparent 3px, transparent 9px),
            linear-gradient(90deg, var(--purple), var(--cyan), var(--magenta), var(--cyan), var(--purple));
          z-index: -2;
        }

        .header-texture {
          position: absolute;
          inset: 0;
          background:
            repeating-linear-gradient(90deg, transparent 0px, transparent 2px, rgba(0,0,0,0.2) 2px, rgba(0,0,0,0.2) 4px),
            repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(255,255,255,0.08) 3px, rgba(255,255,255,0.08) 4px),
            repeating-linear-gradient(-30deg, rgba(191,0,255,0.3) 0px, transparent 1px, transparent 4px, rgba(0,255,255,0.3) 5px, transparent 6px, transparent 8px);
          z-index: -1;
          mix-blend-mode: overlay;
        }

        .header-noise {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 2px 2px, rgba(255,255,255,0.12) 1px, transparent 1px),
            radial-gradient(circle at 6px 6px, rgba(0,255,255,0.15) 1px, transparent 1px);
          background-size: 8px 8px, 12px 12px;
          z-index: -1;
          mix-blend-mode: screen;
        }

        .header-shimmer {
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          z-index: -1;
          animation: shimmer 4s ease-in-out infinite;
        }

        @keyframes shimmer {
          0%, 100% { transform: translateX(-100%); opacity: 0; }
          50% { transform: translateX(100%); opacity: 1; }
        }

        .header-bar::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, var(--cyan), var(--purple), var(--cyan));
          box-shadow: 0 0 15px var(--cyan);
        }

        .header-brand {
          font-family: 'Orbitron', sans-serif;
          font-weight: 900;
          font-size: 18px;
          color: #000;
          text-shadow: 0 0 10px rgba(255,255,255,0.5);
          letter-spacing: 3px;
          z-index: 10;
        }

        .header-stats {
          display: flex;
          gap: 30px;
          z-index: 10;
        }

        .header-stat {
          text-align: center;
        }

        .header-stat-value {
          font-family: 'Orbitron', sans-serif;
          font-size: 14px;
          color: #000;
          text-shadow: 0 0 5px rgba(255,255,255,0.5);
        }

        .header-stat-label {
          font-size: 9px;
          color: rgba(0,0,0,0.7);
          letter-spacing: 1px;
        }

        /* Main Content */
        .main-content {
          position: relative;
          z-index: 10;
          padding: 80px 20px 40px;
          max-width: 900px;
          margin: 0 auto;
        }

        /* Author Card */
        .author-card {
          background: var(--panel);
          border: 3px solid transparent;
          border-image: linear-gradient(135deg, var(--purple), var(--cyan), var(--purple)) 1;
          padding: 40px;
          margin-bottom: 30px;
          position: relative;
        }

        .author-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 6px;
          background: 
            repeating-linear-gradient(-55deg, var(--purple) 0px, var(--purple) 5px, transparent 5px, transparent 10px),
            repeating-linear-gradient(55deg, var(--cyan) 0px, var(--cyan) 4px, transparent 4px, transparent 12px),
            repeating-linear-gradient(-35deg, rgba(255,0,153,0.5) 0px, rgba(255,0,153,0.5) 2px, transparent 2px, transparent 7px),
            linear-gradient(90deg, var(--purple), var(--cyan), var(--purple));
        }

        .author-header {
          display: flex;
          align-items: center;
          gap: 30px;
          margin-bottom: 25px;
        }

        .author-avatar {
          width: 100px;
          height: 100px;
          background: linear-gradient(135deg, var(--purple), var(--cyan));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 50px;
          color: #000;
          position: relative;
          clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
        }

        .author-avatar::after {
          content: '';
          position: absolute;
          inset: 3px;
          background: var(--dark);
          clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .author-avatar span {
          position: relative;
          z-index: 1;
          color: var(--cyan);
          text-shadow: 0 0 20px var(--cyan);
        }

        .author-info h1 {
          font-family: 'Orbitron', sans-serif;
          font-size: 32px;
          font-weight: 900;
          color: var(--cyan);
          text-shadow: 0 0 20px var(--cyan);
          margin-bottom: 5px;
        }

        .author-handle {
          font-size: 14px;
          color: var(--purple);
          letter-spacing: 3px;
          margin-bottom: 10px;
        }

        .author-tagline {
          font-size: 14px;
          color: rgba(255,255,255,0.6);
        }

        .author-bio {
          font-size: 15px;
          line-height: 1.9;
          color: rgba(255,255,255,0.8);
          white-space: pre-line;
          border-left: 3px solid var(--purple);
          padding-left: 20px;
        }

        /* Links Section */
        .links-section {
          margin-bottom: 40px;
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 15px;
          margin-bottom: 20px;
        }

        .section-header h2 {
          font-family: 'Orbitron', sans-serif;
          font-size: 14px;
          color: var(--purple);
          letter-spacing: 4px;
        }

        .section-line {
          flex: 1;
          height: 2px;
          background: linear-gradient(90deg, var(--purple), transparent);
        }

        .links-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 15px;
        }

        .link-card {
          background: var(--panel);
          border: 2px solid var(--purple);
          padding: 20px;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
          text-decoration: none;
          display: block;
        }

        .link-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(0,255,255,0.1), transparent);
          transition: left 0.5s ease;
        }

        .link-card:hover {
          border-color: var(--cyan);
          transform: translateX(10px);
          box-shadow: 0 0 30px rgba(0,255,255,0.3);
        }

        .link-card:hover::before {
          left: 100%;
        }

        .link-card-inner {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .link-icon {
          font-size: 28px;
          color: var(--cyan);
          text-shadow: 0 0 10px var(--cyan);
        }

        .link-text h3 {
          font-family: 'Orbitron', sans-serif;
          font-size: 14px;
          color: var(--cyan);
          margin-bottom: 3px;
          letter-spacing: 2px;
        }

        .link-text p {
          font-size: 12px;
          color: rgba(255,255,255,0.5);
        }

        .link-arrow {
          margin-left: auto;
          font-size: 20px;
          color: var(--purple);
          transition: transform 0.3s ease;
        }

        .link-card:hover .link-arrow {
          transform: translateX(5px);
          color: var(--cyan);
        }

        /* Posts Section */
        .posts-section {
          margin-bottom: 40px;
        }

        .post-card {
          background: var(--panel);
          border: 2px solid rgba(191,0,255,0.3);
          padding: 25px;
          margin-bottom: 15px;
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
        }

        .post-card::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 4px;
          background: linear-gradient(180deg, var(--purple), var(--cyan));
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .post-card:hover {
          border-color: var(--purple);
          transform: translateX(10px);
          box-shadow: 0 0 30px rgba(191,0,255,0.2);
        }

        .post-card:hover::before {
          opacity: 1;
        }

        .post-meta {
          display: flex;
          align-items: center;
          gap: 15px;
          margin-bottom: 10px;
        }

        .post-date {
          font-family: 'Orbitron', sans-serif;
          font-size: 12px;
          color: var(--cyan);
        }

        .post-tags {
          display: flex;
          gap: 8px;
        }

        .post-tag {
          font-size: 10px;
          color: var(--purple);
          background: rgba(191,0,255,0.1);
          padding: 3px 8px;
          border: 1px solid rgba(191,0,255,0.3);
        }

        .post-card h3 {
          font-family: 'Orbitron', sans-serif;
          font-size: 18px;
          color: #fff;
          margin-bottom: 10px;
          line-height: 1.4;
        }

        .post-card p {
          font-size: 14px;
          color: rgba(255,255,255,0.6);
          line-height: 1.7;
        }

        .post-read-more {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-top: 15px;
          color: var(--cyan);
          font-size: 12px;
          letter-spacing: 2px;
        }

        /* Full Post View */
        .post-view {
          background: var(--panel);
          border: 3px solid transparent;
          border-image: linear-gradient(135deg, var(--purple), var(--cyan)) 1;
          padding: 50px;
          position: relative;
        }

        .post-view::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 6px;
          background: 
            repeating-linear-gradient(-55deg, var(--purple) 0px, var(--purple) 5px, transparent 5px, transparent 10px),
            repeating-linear-gradient(55deg, var(--cyan) 0px, var(--cyan) 4px, transparent 4px, transparent 12px),
            linear-gradient(90deg, var(--purple), var(--cyan), var(--purple));
        }

        .post-back {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          color: var(--cyan);
          font-size: 14px;
          cursor: pointer;
          margin-bottom: 30px;
          transition: all 0.2s ease;
          background: none;
          border: none;
          font-family: 'Share Tech Mono', monospace;
        }

        .post-back:hover {
          color: var(--purple);
          transform: translateX(-5px);
        }

        .post-view-meta {
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 1px solid rgba(191,0,255,0.3);
        }

        .post-view-date {
          font-family: 'Orbitron', sans-serif;
          font-size: 14px;
          color: var(--cyan);
          margin-bottom: 10px;
        }

        .post-view-tags {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .post-content {
          font-family: 'Space Mono', monospace;
          font-size: 15px;
          line-height: 2;
          color: rgba(255,255,255,0.85);
        }

        .post-h1 {
          font-family: 'Orbitron', sans-serif;
          font-size: 32px;
          color: var(--cyan);
          text-shadow: 0 0 30px var(--cyan);
          margin-bottom: 30px;
          line-height: 1.3;
        }

        .post-h2 {
          font-family: 'Orbitron', sans-serif;
          font-size: 20px;
          color: var(--purple);
          margin: 40px 0 20px;
          padding-left: 15px;
          border-left: 4px solid var(--purple);
        }

        .post-p {
          margin-bottom: 20px;
        }

        .post-li {
          margin-left: 30px;
          margin-bottom: 10px;
          color: var(--cyan);
        }

        .post-emphasis {
          font-style: italic;
          color: rgba(255,255,255,0.6);
          text-align: center;
          margin: 30px 0;
        }

        .post-bold {
          color: var(--cyan);
          text-shadow: 0 0 10px var(--cyan);
          text-align: center;
          margin: 30px 0;
          font-size: 18px;
        }

        .post-hr {
          border: none;
          height: 2px;
          background: linear-gradient(90deg, transparent, var(--purple), var(--cyan), var(--purple), transparent);
          margin: 40px 0;
        }

        /* Footer */
        .footer {
          text-align: center;
          padding: 40px 20px;
          border-top: 1px solid rgba(191,0,255,0.2);
        }

        .footer p {
          font-size: 12px;
          color: rgba(255,255,255,0.3);
        }

        .footer-seed {
          font-family: 'Orbitron', sans-serif;
          color: var(--purple);
        }

        /* Responsive */
        @media (max-width: 768px) {
          .header-stats { display: none; }
          .author-header { flex-direction: column; text-align: center; }
          .post-view { padding: 30px 20px; }
          .links-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* Background Elements */}
      <div className="binary-rain">{binaryRain}</div>
      <canvas ref={canvasRef} className="network-canvas" width={window.innerWidth} height={window.innerHeight} />

      {/* Header */}
      <header className="header-bar">
        <div className="header-texture"></div>
        <div className="header-noise"></div>
        <div className="header-shimmer"></div>
        <div className="header-brand">{author.handle}</div>
        <div className="header-stats">
          <div className="header-stat">
            <div className="header-stat-value">{nodeCount}</div>
            <div className="header-stat-label">NETWORK NODES</div>
          </div>
          <div className="header-stat">
            <div className="header-stat-value">{signalStrength.toFixed(1)}%</div>
            <div className="header-stat-label">SIGNAL</div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {activeView === 'index' ? (
          <>
            {/* Author Card */}
            <section className="author-card">
              <div className="author-header">
                <div className="author-avatar">
                  <span>{author.avatar}</span>
                </div>
                <div className="author-info">
                  <h1>{author.name}</h1>
                  <div className="author-handle">@{author.handle}</div>
                  <div className="author-tagline">{author.tagline}</div>
                </div>
              </div>
              <p className="author-bio">{author.bio}</p>
            </section>

            {/* Links */}
            <section className="links-section">
              <div className="section-header">
                <h2>// NODES</h2>
                <div className="section-line"></div>
              </div>
              <div className="links-grid">
                {links.map(link => (
                  <a 
                    key={link.id} 
                    href={link.url} 
                    className="link-card"
                    onMouseEnter={() => setHoveredLink(link.id)}
                    onMouseLeave={() => setHoveredLink(null)}
                  >
                    <div className="link-card-inner">
                      <span className="link-icon">{link.icon}</span>
                      <div className="link-text">
                        <h3>{link.label}</h3>
                        <p>{link.desc}</p>
                      </div>
                      <span className="link-arrow">→</span>
                    </div>
                  </a>
                ))}
              </div>
            </section>

            {/* Posts */}
            <section className="posts-section">
              <div className="section-header">
                <h2>// TRANSMISSIONS</h2>
                <div className="section-line"></div>
              </div>
              {posts.map(post => (
                <article key={post.id} className="post-card" onClick={() => openPost(post)}>
                  <div className="post-meta">
                    <span className="post-date">{post.date}</span>
                    <div className="post-tags">
                      {post.tags.map(tag => (
                        <span key={tag} className="post-tag">#{tag}</span>
                      ))}
                    </div>
                  </div>
                  <h3>{post.title}</h3>
                  <p>{post.excerpt}</p>
                  <span className="post-read-more">CONTINUE SIGNAL →</span>
                </article>
              ))}
            </section>
          </>
        ) : (
          /* Post View */
          <article className="post-view">
            <button className="post-back" onClick={closePost}>
              ← RETURN TO INDEX
            </button>
            <div className="post-view-meta">
              <div className="post-view-date">{selectedPost.date}</div>
              <div className="post-view-tags">
                {selectedPost.tags.map(tag => (
                  <span key={tag} className="post-tag">#{tag}</span>
                ))}
              </div>
            </div>
            <div className="post-content">
              {renderContent(selectedPost.content)}
            </div>
          </article>
        )}

        {/* Footer */}
        <footer className="footer">
          <p>
            node active since 2019 ;; 
            distributed under creative commons ;; 
            seed: <span className="footer-seed">{seed}</span>
          </p>
        </footer>
      </main>
    </div>
  );
};

export default AuthorNode;
