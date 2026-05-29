/**
 * transmission-comments.js — collapsed comments widget for transmissions.
 */

import * as Auth from './bsky-auth.js';
import * as Comment from './bsky-comment.js';

const MAX_CHARS = 500;

function tip(text) {
  let tooltip = null;
  const s = document.createElement('span');
  s.className = 'tx-tip';
  s.textContent = '?';
  s.addEventListener('mouseenter', (e) => {
    tooltip = document.createElement('div');
    tooltip.className = 'tx-tip-popup';
    tooltip.textContent = text;
    document.body.appendChild(tooltip);
    const rect = s.getBoundingClientRect();
    tooltip.style.left = Math.min(rect.left, window.innerWidth - 320) + 'px';
    tooltip.style.top = (rect.top - tooltip.offsetHeight - 8) + 'px';
  });
  s.addEventListener('mouseleave', () => {
    if (tooltip) { tooltip.remove(); tooltip = null; }
  });
  return s;
}

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
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return node;
}

function fmtTime(iso) {
  return new Date(iso).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function svgHeart() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z');
  svg.appendChild(path);
  return svg;
}

export async function mount(container, { slug, authorDid }) {
  const subjectUri = Comment.transmissionUri(authorDid, slug);

 const summary = el('summary', { class: 'tx-comments-summary' },
    el('span', { class: 'tx-comments-label' }, '[ TRANSMIT RESPONSE ]'),
    el('span', { class: 'tx-comments-count' }, '')
  );
 const authBar = el('div', { class: 'tx-comments-auth' });
  const list = el('div', { class: 'tx-comments-list' }, 'loading...');
  const form = el('div', { class: 'tx-comments-form' });
  const formToggle = el('div', { class: 'tx-form-toggle' },
    el('button', { class: 'tx-toggle-btn' }, 'collapse')
  );
  formToggle.querySelector('.tx-toggle-btn').onclick = () => {
    const isOpen = form.style.display !== 'none';
    form.style.display = isOpen ? 'none' : '';
    formToggle.querySelector('.tx-toggle-btn').textContent = isOpen ? 'collapse' : 'expand';
  };
  // Append toggle button inside the form header
  form.appendChild(formToggle);
  const body = el('div', { class: 'tx-comments-body' },
    el('div', { class: 'tx-comments-inner' }, authBar, form, list)
  );
  const block = el('details', { class: 'tx-comments-block' }, summary, body);
  container.appendChild(block);

  let session = null;
  let hides = new Map();
  let deletedUris = new Set();
  let likeCounts = new Map();
  let userLikes = new Map();
  let replyToUri = null;
  let allComments = [];

  async function refresh() {
    list.innerHTML = '';
    list.textContent = 'loading...';
    try {
      const [comments, hideMap] = await Promise.all([
        Comment.loadComments(subjectUri),
        Comment.loadHides(authorDid),
      ]);
      hides = hideMap;
      // Deduplicate
      const seen = new Set();
      allComments = comments.filter(c => {
        if (seen.has(c.uri)) return false;
        seen.add(c.uri);
        return true;
      });

      renderComments();
    } catch (e) {
      list.textContent = 'error: ' + e.message;
      return;
    }

    // Load likes (non-critical — doesn't block comment display)
    try {
      const uris = allComments.map(c => c.uri);
      likeCounts = (await Comment.loadLikes(uris, authorDid)).counts;
      // Load current user's likes for any logged-in session — not just admin
      if (session) {
        userLikes = await Comment.loadAllLikes(session.did);
      }
    } catch {
      // Silently ignore — likes just won't show
    }
  }

  function confirmDelete(message) {
    return new Promise((resolve) => {
      function dismiss(val) { overlay.remove(); document.removeEventListener('keydown', onKey); resolve(val); }
      function onKey(e) { if (e.key === 'Escape') dismiss(false); }
      const overlay = el('div', { class: 'tx-confirm-overlay', onclick: (e) => { if (e.target === overlay) dismiss(false); } });
      const dialog = el('div', { class: 'tx-confirm-dialog' },
        el('div', { class: 'tx-confirm-header' },
          el('span', { class: 'tx-confirm-header-text' }, '[ DELETE TRANSMISSION ]')
        ),
        el('div', { class: 'tx-confirm-body' },
          el('p', { class: 'tx-confirm-msg' }, message),
          el('div', { class: 'tx-confirm-row' },
            el('button', { class: 'tx-confirm-btn', onclick: () => dismiss(false) }, 'cancel'),
            el('button', { class: 'tx-confirm-btn tx-confirm-btn--danger', onclick: () => dismiss(true) }, 'delete')
          )
        )
      );
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
      document.addEventListener('keydown', onKey);
      overlay.querySelector('.tx-confirm-btn--danger').focus();
    });
  }

  function renderComments() {
    const isAdmin = session?.did === authorDid;
    const visible = allComments.filter(c => isAdmin || !hides.has(c.uri));
    summary.querySelector('.tx-comments-count').textContent = ' ' + visible.length;

    list.innerHTML = '';
    if (!visible.length) {
      list.appendChild(el('div', { class: 'tx-comments-empty' }, 'no signal received yet'));
      return;
    }

    const byUri = new Map(visible.map(c => [c.uri, c]));
    const roots = visible.filter(c => !c.replyTo || !byUri.has(c.replyTo));

    for (const c of roots) {
      list.appendChild(renderThread(c, isAdmin, byUri));
    }
  }

  function renderThread(c, isAdmin, byUri) {
    const fragment = document.createDocumentFragment();

    // Main comment
    const main = renderComment(c, isAdmin, false);
    if (main) fragment.appendChild(main);

    // Direct replies
    const replies = allComments.filter(r => r.replyTo === c.uri && (isAdmin || !hides.has(r.uri)));
    for (const reply of replies) {
      const rep = renderComment(reply, isAdmin, true);
      if (rep) fragment.appendChild(rep);
      // Nested replies (depth 2)
      const nested = allComments.filter(n => n.replyTo === reply.uri && (isAdmin || !hides.has(n.uri)));
      for (const nest of nested) {
        const nestEl = renderComment(nest, isAdmin, true);
        if (nestEl) fragment.appendChild(nestEl);
      }
    }

    return fragment;
  }

 function renderComment(c, isAdmin, isReply) {
    const hidden = hides.has(c.uri);
    const deleted = deletedUris.has(c.uri);
    const isOwner = session?.did === c.author;

    // Deleted: show "[ deleted ]" for the author, hide completely for others
    if (deleted && !isOwner) return null;

    const cls = ['tx-comment'];
    if (hidden) cls.push('tx-comment-hidden');
    if (isReply) cls.push('tx-comment--reply');
    if (deleted) cls.push('tx-comment-deleted');

    const card = el('article', { class: cls.join(' ') });
    const author = c.authorHandle || c.author.slice(0, 24);

    // If deleted, show placeholder for the author
    if (deleted) {
      card.appendChild(el('div', { class: 'tx-comment-deleted-msg' }, '[ deleted ]'));
      return card;
    }

    // Reply indicator
    if (isReply && c.replyTo) {
      const parent = allComments.find(p => p.uri === c.replyTo);
      const parentAuthor = parent
        ? (parent.authorHandle || parent.author.slice(0, 24))
        : author;
      card.appendChild(el('span', { class: 'tx-comment-reply-to' },
        're: @' + parentAuthor
      ));
    }

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

    // Like button — SVG heart, fills with --cyan on active
    let isLiked = userLikes.has(c.uri);
    const likeCount = likeCounts.get(c.uri) || 0;
    const likeBtn = el('button', { class: 'tx-like-btn' + (isLiked ? ' tx-like-btn--active' : '') },
      svgHeart(),
      el('span', { class: 'tx-like-count' }, likeCount)
    );
    likeBtn.onclick = async (e) => {
      e.stopPropagation();
      if (!session) return;
      likeBtn.disabled = true;
      try {
        if (isLiked) {
          const likeUri = userLikes.get(c.uri);
          if (likeUri) await Comment.unlike(likeUri);
          userLikes.delete(c.uri);
        } else {
          const r = await Comment.like(c.uri, authorDid);
          if (r?.uri) {
            userLikes.set(c.uri, r.uri);
          } else {
            // Already liked (409 conflict) — UI is already correct
            likeBtn.disabled = false;
            return;
          }
        }
        isLiked = !isLiked;
        const newCount = (likeCounts.get(c.uri) || 0) + (isLiked ? 1 : -1);
        likeCounts.set(c.uri, Math.max(0, newCount));
        const countSpan = likeBtn.querySelector('.tx-like-count');
        likeBtn.className = 'tx-like-btn' + (isLiked ? ' tx-like-btn--active' : '');
        if (countSpan) countSpan.textContent = Math.max(0, newCount);
        likeBtn.disabled = false;
      } catch (err) {
        likeBtn.disabled = false;
        const countSpan = likeBtn.querySelector('.tx-like-count');
        if (err.message?.includes('invalid_token')) {
          await Auth.logout(); location.reload();
          return;
        }
        if (countSpan) countSpan.textContent = '!';
      }
    };
    actions.appendChild(likeBtn);

    // Reply — opens inline transmit box below this comment
    if (!isReply) {
      const replyBtn = el('button', { class: 'tx-reply-btn' }, 'reply');
      replyBtn.onclick = (e) => {
        e.stopPropagation();
        toggleInlineReply(card, c.uri, '@' + author);
      };
      actions.appendChild(replyBtn);
    }

    if (isAdmin) {
      const modBtn = el('button', { class: 'tx-mod-btn' });
      modBtn.textContent = hidden ? 'unhide' : 'hide';
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
          renderComments();
        } catch (e) {
          modBtn.disabled = false;
          modBtn.textContent = 'err: ' + e.message;
        }
      };
      actions.appendChild(modBtn);
    }

   // Delete — poster can delete their own, admin can delete any
    if (isOwner || isAdmin) {
      const delBtn = el('button', { class: 'tx-del-btn' }, 'delete');
      delBtn.onclick = async () => {
        if (!await confirmDelete('Are you sure? This permanently deletes the signal and cannot be undone.')) return;
        delBtn.disabled = true;
        delBtn.textContent = 'deleting...';
        try {
          await Comment.remove(c.uri);
          deletedUris.add(c.uri);
          renderComments();
        } catch (e) {
          delBtn.disabled = false;
          delBtn.textContent = 'delete';
        }
      };
      actions.appendChild(delBtn);
    }

    if (actions.children.length) card.appendChild(actions);
    return card;
  }

  // Inline reply — creates a transmit box below the parent comment
  let activeInlineReply = null; // { uri, card, form }

  function toggleInlineReply(card, targetUri, targetAuthor) {
    // Close any existing inline reply
    if (activeInlineReply) {
      activeInlineReply.form.remove();
      activeInlineReply = null;
    }
    replyToUri = targetUri;
    const inlineForm = buildInlineReplyForm(targetUri, targetAuthor);
    card.appendChild(inlineForm);
    activeInlineReply = { card, form: inlineForm };
    inlineForm.querySelector('.tx-inline-text').focus();
  }

  function buildInlineReplyForm(targetUri, targetAuthor) {
    const form = el('div', { class: 'tx-inline-reply' },
      el('div', { class: 'tx-inline-reply-header' },
        el('span', { class: 'tx-inline-reply-to' }, 're: ' + targetAuthor),
        el('button', { class: 'tx-inline-cancel', onclick: () => { form.remove(); activeInlineReply = null; } }, 'close')
      ),
      el('textarea', { class: 'tx-inline-text', placeholder: 'transmit...', rows: '2' }),
      el('div', { class: 'tx-inline-row' },
        el('button', { class: 'tx-form-submit' }, 'transmit'),
        el('span', { class: 'tx-form-counter' }, '0/' + MAX_CHARS)
      )
    );
    const textarea = form.querySelector('.tx-inline-text');
    const counter = form.querySelector('.tx-form-counter');
    const submit = form.querySelector('.tx-form-submit');
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
    submit.onclick = async () => {
      const msg = textarea.value.trim();
      if (!msg || msg.length > MAX_CHARS) return;
      submit.disabled = true;
      submit.textContent = 'transmitting...';
      try {
        const result = await Comment.post(msg, subjectUri, targetUri);
        addOptimisticComment(msg, targetUri, result);
        form.remove();
        activeInlineReply = null;
      } catch (e) {
        submit.disabled = false;
        submit.textContent = 'transmit';
        form.appendChild(el('div', { class: 'tx-form-err' }, e.message));
      }
    };
    return form;
  }

  function addOptimisticComment(message, replyTo, result) {
    const newComment = {
      uri: result.uri,
      author: session.did,
      authorHandle: session.handle,
      message,
      createdAt: new Date().toISOString(),
      replyTo: replyTo || null,
    };
    allComments.unshift(newComment);
    renderComments();
  }

  function renderAuth() {
    authBar.innerHTML = '';
    if (session) {
      authBar.appendChild(el('span', { class: 'tx-auth-status' },
        '@' + session.handle,
        session.did === authorDid ? el('span', { class: 'tx-admin-badge' }, ' [admin]') : null,
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
            await Auth.login(handle, location.href);
          } catch (e) {
            btn.disabled = false;
            btn.textContent = 'sign in';
            authBar.appendChild(el('span', { class: 'tx-auth-err' }, e.message));
          }
        },
      }, 'sign in');
      authBar.appendChild(input);
      authBar.appendChild(btn);
      authBar.appendChild(tip('Your comment appears on this site, not posted publicly, but tied to your account via AT Protocol.'));
    }
  }

  function renderForm() {
    form.innerHTML = '';
    if (!session) return;

    const textarea = el('textarea', {
      class: 'tx-form-text',
      placeholder: 'transmit...',
      rows: '2',
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
          const result = await Comment.post(msg, subjectUri);
          addOptimisticComment(msg, null, result);
          textarea.value = '';
          counter.textContent = '0/' + MAX_CHARS;
          counter.classList.remove('tx-form-counter-warn');
          submit.disabled = false;
          submit.textContent = 'transmit';
        } catch (e) {
          submit.disabled = false;
          submit.textContent = 'transmit';
          form.appendChild(el('div', { class: 'tx-form-err' }, e.message));
        }
      },
    }, 'transmit');

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

    const formRow = el('div', { class: 'tx-form-row' }, submit, counter);
    form.appendChild(textarea);
    form.appendChild(formRow);
  }

  session = await Auth.getSession();
  renderAuth();
  renderForm();
  await refresh();
}
