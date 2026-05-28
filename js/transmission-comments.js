/**
 * transmission-comments.js — collapsed comments widget for transmissions.
 *
 * Usage:
 *   import { mount } from './js/transmission-comments.js';
 *   mount(document.querySelector('.nrol-doc'), {
 *     slug: 'neam',
 *     authorDid: 'did:plc:ccxl3ictrlvtrrgh5swvvg47',
 *   });
 */

import * as Auth from './bsky-auth.js';
import * as Comment from './bsky-comment.js';

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, '');
    else if (v != null && v !== false) node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

function fmtTime(iso) {
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export async function mount(container, { slug, authorDid }) {
  console.log('[tx-mount] called with slug:', slug, 'did:', authorDid);
  const subjectUri = Comment.transmissionUri(authorDid, slug);
  console.log('[tx-mount] subjectUri:', subjectUri);

  const summary = el('summary', { class: 'tx-comments-summary' },
    el('span', { class: 'tx-comments-label' }, '[ TRANSMIT RESPONSE ]'),
    el('span', { class: 'tx-comments-count', 'data-count': '' }, '')
  );

  const authBar = el('div', { class: 'tx-comments-auth' });
  const list = el('div', { class: 'tx-comments-list' }, 'loading...');
  const form = el('div', { class: 'tx-comments-form' });

  const block = el('details', { class: 'tx-comments-block' },
    summary,
    el('div', { class: 'tx-comments-body' }, authBar, list, form)
  );
  container.appendChild(block);

  let session = null;
  let hides = new Map();

  async function refresh() {
    list.innerHTML = '';
    list.textContent = 'loading...';
    console.log('[tx-refresh] loading comments for:', subjectUri);
    try {
      const [comments, hideMap] = await Promise.all([
        Comment.loadComments(subjectUri),
        Comment.loadHides(authorDid),
      ]);
      console.log('[tx-refresh] got', comments.length, 'comments,', hideMap.size, 'hides');
      hides = hideMap;
      renderComments(comments);
    } catch (e) {
      console.error('[tx-refresh] error:', e);
      list.textContent = 'error: ' + e.message;
    }
  }

  function renderComments(comments) {
    const isAdmin = session?.did === authorDid;
    const visible = comments.filter(c => isAdmin || !hides.has(c.uri));
    summary.querySelector('.tx-comments-count').textContent = ` ${visible.length}`;

    list.innerHTML = '';
    if (!visible.length) {
      list.appendChild(el('div', { class: 'tx-comments-empty' }, 'no signal received yet'));
      return;
    }
    for (const c of comments) {
      if (!isAdmin && hides.has(c.uri)) continue;
      list.appendChild(renderCard(c, isAdmin));
    }
  }

  function renderCard(c, isAdmin) {
    const hidden = hides.has(c.uri);
    const card = el('article', { class: 'tx-comment' + (hidden ? ' tx-comment-hidden' : '') });
    const author = c.authorHandle || c.author.slice(0, 24);

    card.appendChild(el('header', { class: 'tx-comment-head' },
      el('a', {
        class: 'tx-comment-author',
        href: `https://bsky.app/profile/${c.authorHandle || c.author}`,
        target: '_blank',
        rel: 'noopener',
      }, '@' + author),
      el('time', { class: 'tx-comment-time' }, fmtTime(c.createdAt)),
      hidden ? el('span', { class: 'tx-comment-hidden-tag' }, '[HIDDEN]') : null,
    ));

    card.appendChild(el('div', { class: 'tx-comment-body' }, c.message));

    if (isAdmin) {
      const btn = el('button', {
        class: 'tx-mod-btn',
        onclick: async () => {
          btn.disabled = true;
          try {
            if (hidden) {
              await Comment.unhide(hides.get(c.uri));
              hides.delete(c.uri);
            } else {
              const r = await Comment.hide(c.uri);
              hides.set(c.uri, r.uri);
            }
            refresh();
          } catch (e) {
            btn.disabled = false;
            btn.textContent = 'err: ' + e.message;
          }
        },
      }, hidden ? '[ UNHIDE ]' : '[ HIDE ]');
      card.appendChild(el('footer', { class: 'tx-comment-actions' }, btn));
    }

    return card;
  }

  function renderAuth() {
    authBar.innerHTML = '';
    if (session) {
      authBar.appendChild(el('span', { class: 'tx-auth-status' },
        'signed in as @' + session.handle,
        session.did === authorDid ? el('span', { class: 'tx-admin-badge' }, ' [ADMIN]') : null,
      ));
      authBar.appendChild(el('button', {
        class: 'tx-auth-btn',
        onclick: async () => { await Auth.logout(); location.reload(); },
      }, 'sign out'));
    } else {
      const input = el('input', {
        type: 'text', placeholder: 'your.handle', class: 'tx-auth-input',
      });
      const btn = el('button', {
        class: 'tx-auth-btn',
        onclick: async () => {
          const handle = input.value.trim();
          if (!handle) return;
          btn.disabled = true;
          btn.textContent = 'connecting...';
          try {
            await Auth.login(handle);
          } catch (e) {
            btn.disabled = false;
            btn.textContent = 'sign in';
            authBar.appendChild(el('span', { class: 'tx-auth-err' }, ' ' + e.message));
          }
        },
      }, 'sign in');
      authBar.appendChild(input);
      authBar.appendChild(btn);
    }
  }

  function renderForm() {
    form.innerHTML = '';
    if (!session) return;
    const textarea = el('textarea', {
      class: 'tx-form-text', placeholder: 'transmit your response...', rows: '3',
    });
    const submit = el('button', {
      class: 'tx-form-submit',
      onclick: async () => {
        const msg = textarea.value.trim();
        if (!msg) return;
        submit.disabled = true;
        submit.textContent = 'transmitting...';
        try {
          await Comment.post(msg, subjectUri);
          textarea.value = '';
          submit.disabled = false;
          submit.textContent = 'transmit';
          refresh();
        } catch (e) {
          submit.disabled = false;
          submit.textContent = 'transmit';
          form.appendChild(el('div', { class: 'tx-form-err' }, e.message));
        }
      },
    }, 'transmit');
    form.appendChild(textarea);
    form.appendChild(submit);
  }

  // Init
  session = await Auth.getSession();
  renderAuth();
  renderForm();
  await refresh();
}
