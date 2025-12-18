/**
 * ACIDBURN LINK CARDS
 * 
 * Drop-in link card component for acidburn-styled pages
 * 
 * USAGE:
 * 1. Add <script src="link-cards.js"></script> to your page
 * 2. Add cards with this HTML structure:
 * 
 *    <div class="link-cards">
 *      <a href="/page1" class="link-card" data-icon="◈">
 *        <span class="link-card-title">Page Title</span>
 *        <span class="link-card-desc">Short description here</span>
 *      </a>
 *      <a href="/page2" class="link-card" data-icon="⬡">
 *        <span class="link-card-title">Another Page</span>
 *        <span class="link-card-desc">Another description</span>
 *      </a>
 *    </div>
 * 
 * OPTIONS:
 *   data-icon="◈"     Custom icon (default: →)
 *   data-color="cyan" Card accent color: cyan, purple, pink, green (default: cyan)
 *   data-size="large" Card size: small, medium, large (default: medium)
 */

(function() {
  'use strict';

  const styles = `
    /* ═══════════════════════════════════════════════════════════════
       LINK CARDS CONTAINER
       ═══════════════════════════════════════════════════════════════ */
    
    .link-cards {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 20px;
      padding: 20px 0;
    }

    .link-cards.single-column {
      grid-template-columns: 1fr;
      max-width: 500px;
    }

    .link-cards.two-column {
      grid-template-columns: repeat(2, 1fr);
    }

    @media (max-width: 600px) {
      .link-cards, .link-cards.two-column {
        grid-template-columns: 1fr;
      }
    }

    /* ═══════════════════════════════════════════════════════════════
       LINK CARD
       ═══════════════════════════════════════════════════════════════ */
    
    .link-card {
      position: relative;
      display: flex;
      flex-direction: column;
      padding: 25px;
      background: rgba(5, 5, 15, 0.85);
      border: 2px solid #00ffff;
      text-decoration: none;
      overflow: hidden;
      transition: all 0.25s ease;
      backdrop-filter: blur(10px);
    }

    /* Tiger stripe top accent */
    .link-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: 
        repeating-linear-gradient(-55deg, #bf00ff 0px, #bf00ff 4px, transparent 4px, transparent 8px),
        repeating-linear-gradient(55deg, #00ffff 0px, #00ffff 3px, transparent 3px, transparent 9px),
        linear-gradient(90deg, #bf00ff, #00ffff, #bf00ff);
      opacity: 0.8;
      transition: opacity 0.25s ease;
    }

    /* Arrow indicator */
    .link-card::after {
      content: '→';
      position: absolute;
      top: 20px;
      right: 20px;
      font-size: 20px;
      color: #00ffff;
      opacity: 0.5;
      transition: all 0.25s ease;
      font-family: 'Share Tech Mono', monospace;
    }

    /* Icon from data attribute */
    .link-card[data-icon]::after {
      content: attr(data-icon);
    }

    /* Hover state */
    .link-card:hover {
      border-color: #bf00ff;
      transform: translateY(-3px);
      box-shadow: 
        0 5px 30px rgba(191, 0, 255, 0.3),
        0 0 20px rgba(0, 255, 255, 0.2),
        inset 0 0 30px rgba(191, 0, 255, 0.05);
    }

    .link-card:hover::before {
      opacity: 1;
    }

    .link-card:hover::after {
      opacity: 1;
      transform: translateX(5px);
      text-shadow: 0 0 15px #00ffff;
    }

    /* Active state */
    .link-card:active {
      transform: translateY(-1px);
    }

    /* ═══════════════════════════════════════════════════════════════
       CARD CONTENT
       ═══════════════════════════════════════════════════════════════ */
    
    .link-card-icon {
      font-size: 28px;
      margin-bottom: 15px;
      color: #bf00ff;
      text-shadow: 0 0 15px rgba(191, 0, 255, 0.5);
    }

    .link-card-title {
      font-family: 'Orbitron', 'Share Tech Mono', sans-serif;
      font-size: 16px;
      font-weight: 700;
      color: #00ffff;
      letter-spacing: 1px;
      margin-bottom: 8px;
      text-shadow: 0 0 10px rgba(0, 255, 255, 0.3);
      transition: all 0.25s ease;
    }

    .link-card:hover .link-card-title {
      text-shadow: 0 0 15px rgba(0, 255, 255, 0.6);
    }

    .link-card-desc {
      font-family: 'Share Tech Mono', monospace;
      font-size: 13px;
      color: rgba(255, 255, 255, 0.6);
      line-height: 1.5;
      transition: color 0.25s ease;
    }

    .link-card:hover .link-card-desc {
      color: rgba(255, 255, 255, 0.8);
    }

    .link-card-meta {
      font-family: 'VT323', monospace;
      font-size: 12px;
      color: #bf00ff;
      margin-top: 12px;
      opacity: 0.7;
    }

    /* ═══════════════════════════════════════════════════════════════
       COLOR VARIANTS
       ═══════════════════════════════════════════════════════════════ */
    
    /* Purple accent */
    .link-card[data-color="purple"] {
      border-color: #bf00ff;
    }
    .link-card[data-color="purple"] .link-card-title {
      color: #bf00ff;
      text-shadow: 0 0 10px rgba(191, 0, 255, 0.3);
    }
    .link-card[data-color="purple"]::after {
      color: #bf00ff;
    }
    .link-card[data-color="purple"]:hover {
      border-color: #00ffff;
      box-shadow: 
        0 5px 30px rgba(0, 255, 255, 0.3),
        0 0 20px rgba(191, 0, 255, 0.2);
    }

    /* Pink accent */
    .link-card[data-color="pink"] {
      border-color: #ff0099;
    }
    .link-card[data-color="pink"] .link-card-title {
      color: #ff0099;
      text-shadow: 0 0 10px rgba(255, 0, 153, 0.3);
    }
    .link-card[data-color="pink"]::after {
      color: #ff0099;
    }
    .link-card[data-color="pink"]:hover {
      border-color: #00ffff;
    }

    /* Green accent */
    .link-card[data-color="green"] {
      border-color: #00ff88;
    }
    .link-card[data-color="green"] .link-card-title {
      color: #00ff88;
      text-shadow: 0 0 10px rgba(0, 255, 136, 0.3);
    }
    .link-card[data-color="green"]::after {
      color: #00ff88;
    }
    .link-card[data-color="green"]:hover {
      border-color: #bf00ff;
    }

    /* ═══════════════════════════════════════════════════════════════
       SIZE VARIANTS
       ═══════════════════════════════════════════════════════════════ */
    
    .link-card[data-size="small"] {
      padding: 15px 20px;
    }
    .link-card[data-size="small"] .link-card-title {
      font-size: 14px;
      margin-bottom: 4px;
    }
    .link-card[data-size="small"] .link-card-desc {
      font-size: 12px;
    }
    .link-card[data-size="small"]::after {
      top: 15px;
      right: 15px;
      font-size: 16px;
    }

    .link-card[data-size="large"] {
      padding: 35px;
    }
    .link-card[data-size="large"] .link-card-title {
      font-size: 20px;
      margin-bottom: 12px;
    }
    .link-card[data-size="large"] .link-card-desc {
      font-size: 14px;
    }
    .link-card[data-size="large"]::after {
      font-size: 24px;
    }

    /* ═══════════════════════════════════════════════════════════════
       FEATURED CARD (full width with image)
       ═══════════════════════════════════════════════════════════════ */
    
    .link-card.featured {
      grid-column: 1 / -1;
      flex-direction: row;
      align-items: center;
      gap: 30px;
      padding: 30px 35px;
    }

    .link-card.featured .link-card-image {
      width: 120px;
      height: 120px;
      border-radius: 8px;
      object-fit: cover;
      border: 2px solid #bf00ff;
      flex-shrink: 0;
    }

    .link-card.featured .link-card-content {
      flex: 1;
    }

    .link-card.featured .link-card-title {
      font-size: 22px;
    }

    @media (max-width: 600px) {
      .link-card.featured {
        flex-direction: column;
        align-items: flex-start;
      }
      .link-card.featured .link-card-image {
        width: 100%;
        height: 150px;
      }
    }

    /* ═══════════════════════════════════════════════════════════════
       DISABLED STATE
       ═══════════════════════════════════════════════════════════════ */
    
    .link-card.disabled {
      opacity: 0.4;
      pointer-events: none;
      filter: grayscale(0.5);
    }

    /* ═══════════════════════════════════════════════════════════════
       SECTION HEADER (optional)
       ═══════════════════════════════════════════════════════════════ */
    
    .link-cards-header {
      display: flex;
      align-items: center;
      gap: 15px;
      margin-bottom: 20px;
      font-family: 'Orbitron', sans-serif;
      font-size: 14px;
      color: #bf00ff;
      letter-spacing: 3px;
    }

    .link-cards-header::before {
      content: '//';
      color: #00ffff;
    }

    .link-cards-header::after {
      content: '';
      flex: 1;
      height: 1px;
      background: linear-gradient(90deg, #bf00ff, transparent);
    }
  `;

  // Inject styles
  const styleEl = document.createElement('style');
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);

})();
