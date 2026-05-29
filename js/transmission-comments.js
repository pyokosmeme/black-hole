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

export async function mount(container, { slug, authorDid }) {
  const subjectUri = Comment.transmissionUri(authorDid, slug);

  const summary = el('summary', { class: 'tx-comments-summary' },
    el('span', { class: 'tx-comments-label' }, '[ TRANSMIT RESPONSE ]'),
    el('span', { class: 'tx-comments-count' }, '')
  );
  const authBar = el('div', { class: 'tx-comments-auth' });
  const list = el('div', { class: 'tx-comments-list' }, 'loading...');
  const form = el('div', { class: 'tx-comments-form' });
  const body = el('div', { class: 'tx-comments-body' },
    el('div', { class: 'tx-comments-inner' }, authBar, list, form)
  );
  const block = el('details', { class: 'tx-comments-block' }, summary, body);
  container.appendChild(block);

  let session = null;
  let hides = new Map();
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
      if (session?.did === authorDid) {
        userLikes = await Comment.loadAllLikes(authorDid);
      }
    } catch {
      // Silently ignore — likes just won't show
    }
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
    const hidden = hides.has(c.uri);

    // Main comment
    fragment.appendChild(renderComment(c, isAdmin, false));

    // Direct replies
    const replies = allComments.filter(r => r.replyTo === c.uri && (isAdmin || !hides.has(r.uri)));
    for (const reply of replies) {
      fragment.appendChild(renderComment(reply, isAdmin, true));
      // Nested replies (depth 2)
      const nested = allComments.filter(n => n.replyTo === reply.uri && (isAdmin || !hides.has(n.uri)));
      for (const nest of nested) {
        fragment.appendChild(renderComment(nest, isAdmin, true));
      }
    }

    return fragment;
  }

  function renderComment(c, isAdmin, isReply) {
    const hidden = hides.has(c.uri);
    const cls = ['tx-comment'];
    if (hidden) cls.push('tx-comment-hidden');
    if (isReply) cls.push('tx-comment--reply');

    const card = el('article', { class: cls.join(' ') });
    const author = c.authorHandle || c.author.slice(0, 24);

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

    // Like button
    const likedByMe = userLikes.has(c.uri);
    const likeCount = likeCounts.get(c.uri) || 0;
    const likeBtn = el('button', { class: 'tx-like-btn' + (likedByMe ? ' tx-like-btn--active' : '') },
      likedByMe ? '♥' : '♡',
      el('span', { class: 'tx-like-count' }, likeCount)
    );
    likeBtn.onclick = async (e) => {
      e.stopPropagation();
      if (!session) return;
      likeBtn.disabled = true;
      try {
        if (likedByMe) {
          const likeUri = userLikes.get(c.uri);
          if (likeUri) await Comment.unlike(likeUri);
          userLikes.delete(c.uri);
        } else {
          const r = await Comment.like(c.uri, authorDid);
          if (r?.uri) userLikes.set(c.uri, r.uri);
        }
        const newCount = (likeCounts.get(c.uri) || 0) + (likedByMe ? -1 : 1);
        likeCounts.set(c.uri, Math.max(0, newCount));
        const countSpan = likeBtn.querySelector('.tx-like-count');
        likeBtn.className = 'tx-like-btn' + (!likedByMe ? ' tx-like-btn--active' : '');
        likeBtn.childNodes[0].textContent = !likedByMe ? '♥' : '♡';
        if (countSpan) countSpan.textContent = Math.max(0, newCount);
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

    if (!isReply) {
      const replyBtn = el('button', { class: 'tx-reply-btn' }, 'reply');
      replyBtn.onclick = (e) => {
        e.stopPropagation();
        replyToUri = c.uri;
        setReplyIndicator('@' + author);
        focusTextarea();
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

    if (actions.children.length) card.appendChild(actions);
    return card;
  }

  function setReplyIndicator(author) {
    let indicator = form.querySelector('.tx-reply-indicator');
    if (!indicator) {
      indicator = el('span', { class: 'tx-reply-indicator' });
      form.insertBefore(indicator, form.firstChild);
    }
    indicator.textContent = '→ ' + author;
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
            await Auth.login(handle);
          } catch (e) {
            btn.disabled = false;
            btn.textContent = 'sign in';
            authBar.appendChild(el('span', { class: 'tx-auth-err' }, e.message));
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
          const result = await Comment.post(msg, subjectUri, replyToUri || undefined);
          addOptimisticComment(msg, replyToUri, result);
          textarea.value = '';
          counter.textContent = '0/' + MAX_CHARS;
          counter.classList.remove('tx-form-counter-warn');
          clearReplyIndicator();
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
