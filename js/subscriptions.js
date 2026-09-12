(function () {
  'use strict';

  const TOPICS = [
    { value: 'books', label: 'A Mote in Shadow', detail: 'books + EXU updates' },
    { value: 'blog', label: 'Main transmissions', detail: 'essays + research notes' },
    { value: 'fiction', label: 'Speculative futures', detail: 'speculative fiction' },
  ];

  const SUCCESS_AUTO_CLOSE_MS = 2200;

  function currentTopic() {
    return window.PAGE_CONFIG && window.PAGE_CONFIG.subscriptionTopic;
  }

  function topicsMarkup(preChecked) {
    return TOPICS.map(topic => `
      <label class="subscribe-topic link-card">
        <span class="link-card-inner">
          <input type="checkbox" name="topics" value="${topic.value}" ${topic.value === preChecked ? 'checked' : ''}>
          <span class="link-text"><h3>${topic.label}</h3><p>${topic.detail}</p></span>
        </span>
      </label>
    `).join('');
  }

  // The guts of the subscribe form, shared by the in-page panel and the
  // post-view popup. `emailId` keeps duplicate DOM ids apart.
  function formFieldsMarkup(emailId) {
    return `
      <div class="subscribe-email-row">
        <label class="sr-only" for="${emailId}">Email address</label>
        <input id="${emailId}" name="email" type="email" inputmode="email" autocomplete="email" placeholder="you@somewhere.net" required>
        <button class="subscribe-submit link-card" type="submit">SUBSCRIBE TO UPDATES</button>
      </div>
      <div class="subscribe-topics" role="group" aria-label="Choose update types">
        ${topicsMarkup(currentTopic())}
      </div>
      <label class="subscribe-trap" aria-hidden="true">Website<input name="website" type="text" tabindex="-1" autocomplete="off"></label>
      <p class="subscribe-note">No tracking pixels. Unsubscribe from any update email.</p>
      <p class="subscribe-status" role="status" aria-live="polite"></p>
    `;
  }

  function wireSubscribeForm(form, { onSuccess } = {}) {
    const status = form.querySelector('.subscribe-status');
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
        if (onSuccess) onSuccess();
      } catch (error) {
        status.textContent = error.message || 'The signal did not connect. Try again.';
        status.classList.add('error');
      } finally {
        button.disabled = false;
        button.textContent = 'SUBSCRIBE TO UPDATES';
      }
    });
  }

  /* ------------------------------------------------------------------
     Post-view subscribe popup (index.html only — mounts if the
     #post-subscribe-btn chrome button exists)
     ------------------------------------------------------------------ */
  let modalEl = null;
  let lastFocused = null;
  let autoCloseTimer = null;

  function ensureModal() {
    if (modalEl) return modalEl;

    modalEl = document.createElement('div');
    modalEl.id = 'subscribe-modal';
    modalEl.className = 'subscribe-modal';
    modalEl.hidden = true;
    modalEl.innerHTML = `
      <div class="subscribe-modal-backdrop" data-subscribe-close></div>
      <div class="subscribe-modal-panel" role="dialog" aria-modal="true" aria-labelledby="subscribe-modal-title">
        <div class="subscribe-modal-head">
          <h2 id="subscribe-modal-title">// RECEIVE TRANSMISSIONS</h2>
          <button class="subscribe-modal-close" type="button" data-subscribe-close title="Close subscription panel">✕ CLOSE</button>
        </div>
        <form class="subscribe-form" novalidate>
          ${formFieldsMarkup('subscribe-modal-email')}
        </form>
      </div>
    `;
    document.body.appendChild(modalEl);

    wireSubscribeForm(modalEl.querySelector('form'), {
      onSuccess() {
        clearTimeout(autoCloseTimer);
        autoCloseTimer = setTimeout(closeModal, SUCCESS_AUTO_CLOSE_MS);
      },
    });

    // Backdrop + ✕ CLOSE
    modalEl.addEventListener('click', e => {
      if (e.target.closest('[data-subscribe-close]')) closeModal();
    });

    // Escape closes; Tab stays inside the dialog
    modalEl.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeModal();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusables = modalEl.querySelectorAll(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });

    return modalEl;
  }

  function openModal() {
    const modal = ensureModal();

    // Reset to the page's default topic every time it opens
    modal.querySelectorAll('input[name="topics"]').forEach(cb => {
      cb.checked = cb.value === currentTopic();
    });
    const status = modal.querySelector('.subscribe-status');
    status.className = 'subscribe-status';
    status.textContent = '';
    clearTimeout(autoCloseTimer);

    lastFocused = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('subscribe-modal-open');
    modal.querySelector('input[name="email"]').focus();
  }

  function closeModal() {
    if (!modalEl || modalEl.hidden) return;
    clearTimeout(autoCloseTimer);
    modalEl.hidden = true;
    document.body.classList.remove('subscribe-modal-open');
    if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
    lastFocused = null;
  }

  function mount() {
    const postsSection = document.querySelector('.posts-section');
    if (postsSection && !document.getElementById('transmission-subscribe')) {
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
          ${formFieldsMarkup('subscribe-email')}
        </form>
      `;
      postsSection.insertAdjacentElement('afterend', section);
      wireSubscribeForm(section.querySelector('form'));
    }

    const postBtn = document.getElementById('post-subscribe-btn');
    if (postBtn && !postBtn._subscribeWired) {
      postBtn._subscribeWired = true;
      postBtn.addEventListener('click', e => {
        e.preventDefault();
        openModal();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();