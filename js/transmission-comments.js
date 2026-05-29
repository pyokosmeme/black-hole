/**
 * transmission-comments.js — collapsed comments widget for transmissions.
 */

import * as Auth from './bsky-auth.js';
import * as Comment from './bsky-comment.js';

const MAX_CHARS = 500;

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
  const subjectUri = Comment.transmissionUri(authorDid, slug);

  // Summary line
  const summary = el('summary', { class: 'tx-comments-summary' },
    el('span', { class: 'tx-comments-label' }, '[ TRANSMIT RESPONSE ]'),
    el('span', { class: 'tx-comments-count', 'data-count': '' }, '')
  );

  // Body sections
  const authBar = el('div', { class: 'tx-comments-auth' });
  const list = el('div', { class: 'tx-comments-list', id: 'tx-list' }, 'loading...');
  const form = el('div', { class: 'tx-comments-form' });

  // Body wrapper
  const body = el('div', { class: 'tx-comments-body' },
    el('div', { class: 'tx-comments-inner' }, authBar, list, form)
  );

  const block = el('details', { class: 'tx-comments-block' }, summary, body);
  container.appendChild(block);

  let session = null;
  let hides = new Map();
  let replyToUri = null;  // for threading

  async function refresh() {
    list.innerHTML = '';
    list.textContent = 'loading...';
    try {
      const [comments, hideMap] = await Promise.all([
        Comment.loadComments(subjectUri),
        Comment.loadHides(authorDid),
      ]);
      hides = hideMap;
      renderComments(comments);
    } catch (e) {
      list.textContent = 'error: ' + e.message;
    }
  }

  function renderComments(comments) {
    // Deduplicate by URI
    const seen = new Set();
    const unique = comments.filter(c => {
      if (seen.has(c.uri)) return false;
      seen.add(c.uri);
      return true;
    });

    const isAdmin = session?.did === authorDid;
    const visible = unique.filter(c => isAdmin || !hides.has(c.uri));
    summary.querySelector('.tx-comments-count').textContent = ' ' + visible.length;

    list.innerHTML = '';
    if (!visible.length) {
      list.appendChild(el('div', { class: 'tx-comments-empty' }, 'no signal received yet'));
      return;
    }

    // Build a map for quick parent lookup
    const byUri = new Map(unique.map(c => [c.uri, c]));

    // Separate roots from replies
    const roots = unique.filter(c => !c.replyTo || !byUri.has(c.replyTo));
    const replies = unique.filter(c => c.replyTo && byUri.has(c.replyTo));

    for (const c of unique) {
      if (!isAdmin && hides.has(c.uri)) continue;
      if (c.replyTo && byUri.has(c.replyTo)) {
        // Rendered as child of parent — skip here, handle below
        continue;
      }
      const card = renderCard(c, isAdmin, byUri);
      list.appendChild(card);

      // Render direct replies under this comment
      const children = replies.filter(r => r.replyTo === c.uri);
      for (const child of children) {
        list.appendChild(renderReply(child, isAdmin));
      }
    }
  }

  function renderCard(c, isAdmin, byUri) {
    const hidden = hides.has(c.uri);
    const cls = 'tx-comment' + (hidden ? ' tx-comment-hidden' : '');
    const card = el('article', { class: cls });
    const author = c.authorHandle || c.author.slice(0, 24);

    card.appendChild(el('header', { class: 'tx-comment-head' },
      el('a', {
        class: 'tx-comment-author',
        href: `https://bsky.app/profile/${c.authorHandle || c.author}`,
        target: '_blank', rel: 'noopener',
      }, '@' + author),
      el('time', { class: 'tx-comment-time' }, fmtTime(c.createdAt)),
      hidden ? el('span', { class: 'tx-comment-hidden-tag' }, '[HIDDEN]') : null,
    ));

    card.appendChild(el('div', { class: 'tx-comment-body' }, c.message));

    // Actions
    const actions = el('footer', { class: 'tx-comment-actions' });
    const replyBtn = el('button', { class: 'tx-reply-btn' }, '[ reply ]');
    replyBtn.__replyToUri = c.uri;
    replyBtn.onclick = (e) => {
      e.stopPropagation();
      replyToUri = c.uri;
      setReplyIndicator('@' + author);
      focusTextarea();
    };
    actions.appendChild(replyBtn);

    if (isAdmin) {
      const modBtn = el('button', { class: 'tx-mod-btn' });
      modBtn.textContent = hidden ? '[ UNHIDE ]' : '[ HIDE ]';
      modBtn.onclick = async () => {
        modBtn.disabled = true;
        try {
          if (hidden) {
            const hideUri = hides.get(c.uri);
            if (hideUri) {
              await Comment.unhide(hideUri);
              hides.delete(c.uri);
            }
          } else {
            const r = await Comment.hide(c.uri);
            if (r?.uri) {
              hides.set(c.uri, r.uri);
            }
          }
          refresh();
        } catch (e) {
          modBtn.disabled = false;
          modBtn.textContent = 'err: ' + e.message;
        }
      };
      actions.appendChild(modBtn);
    }

    card.appendChild(actions);
    return card;
  }

  function renderReply(c, isAdmin) {
    const hidden = hides.has(c.uri);
    const cls = 'tx-comment tx-comment--reply' + (hidden ? ' tx-comment-hidden' : '');
    const card = el('article', { class: cls });
    const author = c.authorHandle || c.author.slice(0, 24);

    // Reply-to indicator
    card.appendChild(el('span', { class: 'tx-comment-reply-to' },
      're: @' + (c.authorHandle || c.author.slice(0, 24))
    ));

    card.appendChild(el('header', { class: 'tx-comment-head' },
      el('a', {
        class: 'tx-comment-author',
        href: `https://bsky.app/profile/${c.authorHandle || c.author}`,
        target: '_blank', rel: 'noopener',
      }, '@' + author),
      el('time', { class: 'tx-comment-time' }, fmtTime(c.createdAt)),
      hidden ? el('span', { class: 'tx-comment-hidden-tag' }, '[HIDDEN]') : null,
    ));

    card.appendChild(el('div', { class: 'tx-comment-body' }, c.message));

    if (isAdmin) {
      const actions = el('footer', { class: 'tx-comment-actions' });
      const modBtn = el('button', { class: 'tx-mod-btn' });
      modBtn.textContent = hidden ? '[ UNHIDE ]' : '[ HIDE ]';
      modBtn.onclick = async () => {
        modBtn.disabled = true;
        try {
          if (hidden) {
            const hideUri = hides.get(c.uri);
            if (hideUri) await Comment.unhide(hideUri);
            hides.delete(c.uri);
          } else {
            const r = await Comment.hide(c.uri);
            if (r?.uri) hides.set(c.uri, r.uri);
          }
          refresh();
        } catch (e) {
          modBtn.disabled = false;
          modBtn.textContent = 'err: ' + e.message;
        }
      };
      actions.appendChild(modBtn);
      card.appendChild(actions);
    }

    return card;
  }

  function setReplyIndicator(author) {
    let indicator = form.querySelector('.tx-reply-indicator');
    if (!indicator) {
      indicator = el('span', { class: 'tx-reply-indicator' });
      form.insertBefore(indicator, form.firstChild);
    }
    indicator.textContent = 'replying to ' + author + ' ...';
  }

  function clearReplyIndicator() {
    const indicator = form.querySelector('.tx-reply-indicator');
    if (indicator) indicator.remove();
    replyToUri = null;
  }

  function focusTextarea() {
    const ta = form.querySelector('.tx-form-text');
    if (ta) ta.focus();
  }

  function addOptimisticComment(message, replyTo, result) {
    // If replying, find the parent card and insert under it
    if (replyTo) {
      const existing = list.querySelectorAll('.tx-comment');
      for (const card of existing) {
        // Match by checking if this card has a reply button for the target
        const btn = card.querySelector('.tx-reply-btn');
        if (btn && btn.__replyToUri === replyTo) {
          // Insert after any existing replies
          let sibling = card.nextElementSibling;
          while (sibling && sibling.classList.contains('tx-comment--reply')) {
            sibling = sibling.nextElementSibling;
          }
          list.insertBefore(renderCard({
            uri: result.uri,
            author: session.did,
            authorHandle: session.handle,
            message,
            createdAt: new Date().toISOString(),
            replyTo: replyToUri,
          }, true), sibling || null);
          return;
        }
      }
    }

    // Root comment — prepend
    const card = renderCard({
      uri: result.uri,
      author: session.did,
      authorHandle: session.handle,
      message,
      createdAt: new Date().toISOString(),
      replyTo: null,
    }, true);
    list.insertBefore(card, list.firstChild);

    // Update count
    const countEl = summary.querySelector('.tx-comments-count');
    countEl.textContent = ' ' + (parseInt(countEl.textContent.trim()) + 1);
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
      class: 'tx-form-text',
      placeholder: replyToUri ? 'replying...' : 'transmit your response...',
      rows: '3',
    });
    const counter = el('span', { class: 'tx-form-counter' }, '0/' + MAX_CHARS);
    const submit = el('button', {
      class: 'tx-form-submit',
      onclick: async () => {
        const msg = textarea.value.trim();
        if (!msg || msg.length > MAX_CHARS) return;
        submit.disabled = true;
        submit.textContent = 'transmitting...';
        try {
          const result = await Comment.post(msg, subjectUri, replyToUri || undefined);
          // Optimistic update — add comment directly, don't full refresh
          addOptimisticComment(msg, replyToUri, result);
          textarea.value = '';
          counter.textContent = '0/' + MAX_CHARS;
          counter.classList.remove('tx-form-counter-warn');
          clearReplyIndicator();
          submit.disabled = false;
          submit.textContent = 'transmit';
          // Delayed background refresh to sync with server
          setTimeout(refresh, 5000);
        } catch (e) {
          submit.disabled = false;
          submit.textContent = 'transmit';
          form.appendChild(el('div', { class: 'tx-form-err' }, e.message));
        }
      },
    }, 'transmit');

    // Textarea input handler
    textarea.addEventListener('input', () => {
      const len = textarea.value.length;
      const remaining = MAX_CHARS - len;
      counter.textContent = len + '/' + MAX_CHARS;
      if (remaining <= 50) counter.classList.add('tx-form-counter-warn');
      else counter.classList.remove('tx-form-counter-warn');
      if (len > MAX_CHARS) {
        textarea.value = textarea.value.slice(0, MAX_CHARS);
        counter.textContent = MAX_CHARS + '/' + MAX_CHARS;
      }
    });

    // Show reply indicator if replying
    if (replyToUri) {
      // Will be set by the reply button click
    }

    const formRow = el('div', { class: 'tx-form-row' }, submit, counter);
    form.appendChild(textarea);
    form.appendChild(formRow);
  }

  // Init
  session = await Auth.getSession();
  renderAuth();
  renderForm();
  await refresh();
}
