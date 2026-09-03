(function () {
  'use strict';

  const TOPICS = [
    { value: 'books', label: 'A Mote in Shadow', detail: 'books + EXU updates' },
    { value: 'blog', label: 'Main transmissions', detail: 'essays + research notes' },
    { value: 'fiction', label: 'Speculative futures', detail: 'speculative fiction' },
  ];

  function mount() {
    const postsSection = document.querySelector('.posts-section');
    if (!postsSection || document.getElementById('transmission-subscribe')) return;

    const currentTopic = window.PAGE_CONFIG && window.PAGE_CONFIG.subscriptionTopic;
    const section = document.createElement('section');
    section.id = 'transmission-subscribe';
    section.className = 'subscribe-panel author-card';
    section.setAttribute('aria-labelledby', 'subscribe-title');
    section.innerHTML = `
      <div class="section-header subscribe-heading">
        <h2 id="subscribe-title">// RECEIVE TRANSMISSIONS</h2>
        <div class="section-line"></div>
      </div>
      <p class="subscribe-intro">Choose which signals reach you.</p>
      <form class="subscribe-form" novalidate>
        <div class="subscribe-email-row">
          <label class="sr-only" for="subscribe-email">Email address</label>
          <input id="subscribe-email" name="email" type="email" inputmode="email" autocomplete="email" placeholder="you@somewhere.net" required>
          <button class="subscribe-submit link-card" type="submit">SUBSCRIBE TO UPDATES</button>
        </div>
        <div class="subscribe-topics" role="group" aria-label="Choose update types">
          ${TOPICS.map(topic => `
            <label class="subscribe-topic link-card">
              <span class="link-card-inner">
                <input type="checkbox" name="topics" value="${topic.value}" ${topic.value === currentTopic ? 'checked' : ''}>
                <span class="link-text"><h3>${topic.label}</h3><p>${topic.detail}</p></span>
              </span>
            </label>
          `).join('')}
        </div>
        <label class="subscribe-trap" aria-hidden="true">Website<input name="website" type="text" tabindex="-1" autocomplete="off"></label>
        <p class="subscribe-note">No tracking pixels. Unsubscribe from any update email.</p>
        <p class="subscribe-status" role="status" aria-live="polite"></p>
      </form>
    `;
    postsSection.insertAdjacentElement('afterend', section);

    const form = section.querySelector('form');
    const status = section.querySelector('.subscribe-status');
    const button = form.querySelector('button[type="submit"]');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const data = new FormData(form);
      const email = String(data.get('email') || '').trim();
      const topics = data.getAll('topics');
      status.className = 'subscribe-status';

      if (!email || !form.elements.email.validity.valid) {
        status.textContent = 'Enter a valid email address.';
        status.classList.add('error');
        form.elements.email.focus();
        return;
      }
      if (!topics.length) {
        status.textContent = 'Choose at least one kind of update.';
        status.classList.add('error');
        return;
      }

      button.disabled = true;
      button.textContent = 'TUNING…';
      try {
        const response = await fetch('/api/subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            email,
            topics,
            website: data.get('website') || '',
            source: window.location.pathname,
          }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'The signal did not connect.');
        status.textContent = payload.message || 'You are on the transmission list.';
        status.classList.add('success');
        form.elements.email.value = '';
      } catch (error) {
        status.textContent = error.message || 'The signal did not connect. Try again.';
        status.classList.add('error');
      } finally {
        button.disabled = false;
        button.textContent = 'SUBSCRIBE TO UPDATES';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
