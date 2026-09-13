import * as Auth from './bsky-auth.js';
import { markProseBrackets } from './prose-brackets.js';

const state = { transmissions: [], active: null, isNew: true, dirty: false, busy: false, revision: 0, sections: new Set(), pending: new Map() };
const authPanel = document.getElementById('auth-panel');
const workspace = document.getElementById('workspace');
const loginButton = document.getElementById('login-button');
const ownerHandle = document.getElementById('owner-handle');
const logoutButton = document.getElementById('logout-button');
const authStatus = document.getElementById('auth-status');
const form = document.getElementById('transmission-form');
const list = document.getElementById('transmission-list');
const rendered = document.getElementById('editor-rendered');
const markdownEditor = document.getElementById('markdown-editor');
const editorStatus = document.getElementById('editor-status');
const sourceNote = document.getElementById('source-note');
const shareLink = document.getElementById('share-link');
const deleteButton = document.getElementById('delete-button');
const imageInput = document.getElementById('image-input');
const viewRendered = document.getElementById('view-rendered');
const viewMarkdown = document.getElementById('view-markdown');
const sectionFilter = document.getElementById('section-filter');
const listStatus = document.getElementById('list-status');
const refreshButton = document.getElementById('refresh-transmissions');

/* ── WYSIWYG editor state: rendered (default) ↔ raw markdown ── */
let editorMode = 'rendered';
let renderedChanged = false;

const turndownService = window.TurndownService
  ? new window.TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', hr: '---', bulletListMarker: '-' })
  : null;

async function api(path, options = {}) {
  const { headers = {}, ...requestOptions } = options;
  const response = await fetch(path, {
    cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(30_000),
    ...requestOptions, headers: { Accept: 'application/json', ...headers },
  });
  const contentType = response.headers.get('Content-Type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : { error: await response.text() };
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function setStatus(element, message, type = '') {
  element.textContent = message || '';
  element.className = `status${type ? ` ${type}` : ''}`;
}

function today() {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('.');
}

function slugify(value) {
  return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s-]/g, '').trim().replace(/[\s-]+/g, '-');
}

function renderRendered() {
  if (richEditorAvailable()) rendered.innerHTML = sanitizeEditorHtml(window.marked.parse(markdownEditor.value || ''));
  else rendered.textContent = markdownEditor.value;
  markProseBrackets(rendered);
  renderedChanged = false;
}

function syncRenderedToMarkdown() {
  if (editorMode !== 'rendered' || !renderedChanged) return;
  if (turndownService) markdownEditor.value = turndownService.turndown(rendered.innerHTML).trimEnd();
  renderedChanged = false;
}

function richEditorAvailable() {
  return !!(window.marked && window.DOMPurify?.isSupported && turndownService);
}

function sanitizeEditorHtml(html) {
  return window.DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true }, SANITIZE_NAMED_PROPS: true,
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'textarea', 'select'],
    FORBID_ATTR: ['style'],
  });
}

function markDirty() { state.dirty = true; }

async function canDiscard() {
  return !state.busy && (!state.dirty || await acidConfirm('Discard your unsaved changes?'));
}

function lockEditor() {
  state.busy = true;
  const controls = [...form.querySelectorAll('input, select, textarea, button'),
    ...list.querySelectorAll('button'), document.getElementById('new-button')];
  const disabled = controls.map(control => control.disabled);
  controls.forEach(control => { control.disabled = true; });
  rendered.contentEditable = 'false';
  return () => {
    controls.forEach((control, i) => { control.disabled = disabled[i]; });
    rendered.contentEditable = 'true';
    state.busy = false;
  };
}

function setEditorMode(mode) {
  if (state.busy || (mode === 'rendered' && !richEditorAvailable())) return;
  if (mode === editorMode) return;
  if (mode === 'markdown') syncRenderedToMarkdown();
  editorMode = mode;
  rendered.hidden = mode !== 'rendered';
  document.querySelector('.markdown-mode').hidden = mode !== 'markdown';
  viewRendered.classList.toggle('active', mode === 'rendered');
  viewRendered.setAttribute('aria-pressed', String(mode === 'rendered'));
  viewMarkdown.classList.toggle('active', mode === 'markdown');
  viewMarkdown.setAttribute('aria-pressed', String(mode === 'markdown'));
  if (mode === 'rendered') renderRendered();
  else markdownEditor.focus();
}

viewRendered.addEventListener('click', () => setEditorMode('rendered'));
viewMarkdown.addEventListener('click', () => setEditorMode('markdown'));

function exec(command, value) {
  if (state.busy) return;
  rendered.focus();
  document.execCommand(command, false, value || null);
  markProseBrackets(rendered);
  renderedChanged = true;
  markDirty();
}

function wrapSelection(before, after, placeholder) {
  const start = markdownEditor.selectionStart || 0;
  const end = markdownEditor.selectionEnd || start;
  const selected = markdownEditor.value.slice(start, end) || placeholder;
  const insertion = before + selected + after;
  markdownEditor.value = markdownEditor.value.slice(0, start) + insertion + markdownEditor.value.slice(end);
  markdownEditor.setSelectionRange(start + before.length, start + before.length + selected.length);
  markdownEditor.focus();
}

function prefixLines(prefix) {
  const start = markdownEditor.value.lastIndexOf('\n', (markdownEditor.selectionStart || 0) - 1) + 1;
  markdownEditor.value = markdownEditor.value.slice(0, start) + prefix + markdownEditor.value.slice(start);
  markdownEditor.setSelectionRange(start + prefix.length, start + prefix.length);
  markdownEditor.focus();
}

function insertTextAtCursor(text) {
  if (editorMode === 'rendered') { exec('insertText', text); return; }
  const pos = markdownEditor.selectionStart || markdownEditor.value.length;
  markdownEditor.value = markdownEditor.value.slice(0, pos) + text + markdownEditor.value.slice(pos);
  markdownEditor.setSelectionRange(pos + text.length, pos + text.length);
  markdownEditor.focus();
}

const toolbarActions = {
  bold: () => editorMode === 'rendered' ? exec('bold') : wrapSelection('**', '**', 'bold text'),
  italic: () => editorMode === 'rendered' ? exec('italic') : wrapSelection('*', '*', 'italic text'),
  strike: () => editorMode === 'rendered' ? exec('strikeThrough') : wrapSelection('~~', '~~', 'struck text'),
  code: () => {
    if (editorMode === 'markdown') return wrapSelection('`', '`', 'code');
    const code = document.createElement('code');
    code.textContent = window.getSelection()?.toString() || 'code';
    exec('insertHTML', code.outerHTML);
  },
  codeblock: () => insertTextAtCursor('```\ncode\n```\n'),
  h2: () => editorMode === 'rendered' ? exec('formatBlock', 'h2') : prefixLines('## '),
  h3: () => editorMode === 'rendered' ? exec('formatBlock', 'h3') : prefixLines('### '),
  ul: () => editorMode === 'rendered' ? exec('insertUnorderedList') : prefixLines('- '),
  ol: () => editorMode === 'rendered' ? exec('insertOrderedList') : prefixLines('1. '),
  quote: () => editorMode === 'rendered' ? exec('formatBlock', 'blockquote') : prefixLines('> '),
  hr: () => editorMode === 'rendered' ? exec('insertHorizontalRule') : insertTextAtCursor('\n---\n'),
  link: () => {
    const url = prompt('Link URL:');
    if (!url) return;
    if (!/^(https?:\/\/|mailto:|\/|#)/i.test(url)) { setStatus(editorStatus, 'Use an HTTPS, HTTP, mailto, or relative link.', 'error'); return; }
    if (editorMode === 'rendered') exec('createLink', url);
    else wrapSelection('[', `](${url})`, 'link text');
  },
  image: () => imageInput.click(),
  equation: () => insertTextAtCursor('$$\nE = mc^2\n$$\n'),
};

document.querySelector('.editor-toolbar').addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (!button || state.busy) return;
  (toolbarActions[button.dataset.action] || (() => {}))();
  if (button.dataset.action !== 'image') markDirty();
});

function resetEditor() {
  state.active = null;
  state.isNew = true;
  form.reset();
  form.elements.section.value = document.getElementById('section-filter').value || 'author';
  form.elements.date.value = today();
  sourceNote.textContent = 'New managed transmission.';
  shareLink.hidden = true;
  deleteButton.hidden = true;
  document.getElementById('archive-button').hidden = true;
  setStatus(editorStatus, '');
  renderTransmissionList();
  renderRendered();
  state.dirty = false;
  form.elements.title.focus();
}

function selectTransmission(record) {
  state.active = record;
  state.isNew = false;
  form.elements.section.value = record.section;
  form.elements.date.value = record.date || today();
  form.elements.title.value = record.title || '';
  form.elements.slug.value = record.slug || '';
  form.elements.tags.value = (record.tags || []).join(', ');
  form.elements.excerpt.value = record.excerpt || '';
  form.elements.markdown.value = record.markdown || '';
  sourceNote.textContent = record.source === 'repository'
    ? 'Repository source. Saving creates a managed override; the original file remains untouched.'
    : `Managed ${record.status || 'draft'}; last updated ${new Date(record.updatedAt).toLocaleString()}.`;
  deleteButton.hidden = record.source !== 'admin';
  document.getElementById('archive-button').hidden = record.status !== 'published';
  const sectionBase = record.section === 'author' ? '/p' : `/p/${record.section}`;
  shareLink.href = `${sectionBase}/${record.slug}`;
  shareLink.textContent = `${location.origin}${sectionBase}/${record.slug}`;
  shareLink.hidden = record.status !== 'published';
  setStatus(editorStatus, '');
  renderTransmissionList();
  renderRendered();
  state.dirty = false;
}

function renderTransmissionList() {
  const filter = document.getElementById('section-filter').value;
  const records = state.transmissions.filter(record => !filter || record.section === filter);
  list.replaceChildren(...records.map(record => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `transmission-item${state.active && state.active.section === record.section && state.active.slug === record.slug ? ' active' : ''}`;
    const title = document.createElement('strong');
    title.textContent = record.title || record.slug;
    const meta = document.createElement('small');
    const left = document.createElement('span');
    left.textContent = `${record.section} · ${record.date || 'undated'}`;
    const source = document.createElement('span');
    source.className = 'source-badge';
    source.textContent = record.source === 'admin' ? record.status : 'repo';
    meta.append(left, source);
    button.append(title, meta);
    button.disabled = state.busy;
    button.addEventListener('click', async () => {
      if (await canDiscard()) selectTransmission(record);
    });
    return button;
  }));
  if (!records.length) {
    const empty = document.createElement('p');
    empty.className = 'source-note';
    empty.textContent = 'No transmissions in this section.';
    list.append(empty);
  }
}

function renderSubscribers(subscribers) {
  document.getElementById('subscriber-count').textContent = subscribers.filter(item => item.status === 'active').length;
  const body = document.getElementById('subscriber-list');
  body.replaceChildren(...subscribers.map(subscriber => {
    const row = document.createElement('tr');
    [subscriber.email, (subscriber.topics || []).join(', '), subscriber.status, subscriber.createdAt ? new Date(subscriber.createdAt).toLocaleDateString() : ''].forEach(value => {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    });
    return row;
  }));
  if (!subscribers.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.textContent = 'No subscribers yet.';
    row.append(cell);
    body.append(row);
  }
}

function renderPlayers(players) {
  document.getElementById('player-count').textContent = players.filter(item => item.playerCharacter === 1).length;
  const body = document.getElementById('player-list');
  body.replaceChildren(...players.map(player => {
    const row = document.createElement('tr');
    [player.handle || '', player.did, String(player.playerCharacter), player.updatedAt ? new Date(player.updatedAt).toLocaleString() : ''].forEach(value => {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    });
    return row;
  }));
  if (!players.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.textContent = 'No opt-ins recorded yet.';
    row.append(cell);
    body.append(row);
  }
}

/* ── labeler ── */

const labelForm = document.getElementById('label-form');
const labelStatus = document.getElementById('label-status');
const labelerRecordButton = document.getElementById('labeler-record-submit');
const identityStatus = document.getElementById('labeler-identity-status');
const identityAuthorizeButton = document.getElementById('labeler-identity-authorize');
const identityRequestButton = document.getElementById('labeler-identity-request');
const identityCodeInput = document.getElementById('labeler-identity-code');
const identityConfirmButton = document.getElementById('labeler-identity-confirm');
let adminSession = null;

function renderIdentityStatus(identity) {
  if (!identityStatus) return;
  if (identity.configured) {
    identityStatus.textContent = `Connected: ${identity.did} → ${identity.labelService}`;
    identityAuthorizeButton.hidden = true;
    identityRequestButton.hidden = true;
    identityCodeInput.hidden = true;
    identityConfirmButton.hidden = true;
    return;
  }
  if (identity.elevated) {
    identityStatus.textContent = 'Identity authorization granted. Send the email confirmation code to finish the repair.';
    identityAuthorizeButton.hidden = true;
    identityRequestButton.hidden = false;
  } else {
    identityStatus.textContent = 'Not connected yet. Authorize this site to update the labeler identity.';
    identityAuthorizeButton.hidden = false;
    identityRequestButton.hidden = true;
  }
}

async function refreshIdentityStatus() {
  try { renderIdentityStatus(await api('/api/admin/labeler/identity')); }
  catch (error) { if (identityStatus) identityStatus.textContent = 'Identity status unavailable: ' + error.message; }
}

async function beginIdentityUpgrade() {
  if (!adminSession?.handle) return;
  identityAuthorizeButton.disabled = true;
  identityStatus.textContent = 'Opening elevated ATProto authorization…';
  try {
    const response = await fetch('/api/oauth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: adminSession.handle, identityUpgrade: true, returnTo: `${location.origin}/admin.html?labelerRepair=1` }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Identity authorization failed');
    location.assign(body.redirect_url);
  } catch (error) {
    identityStatus.textContent = 'Failed: ' + error.message;
    identityAuthorizeButton.disabled = false;
  }
}

async function requestIdentityCode() {
  identityRequestButton.disabled = true;
  identityStatus.textContent = 'Sending confirmation code…';
  try {
    const result = await api('/api/admin/labeler/identity/request-code', { method: 'POST' });
    identityStatus.textContent = result.message || 'Check the account email for the confirmation code.';
    identityCodeInput.hidden = false;
    identityConfirmButton.hidden = false;
    identityCodeInput.focus();
  } catch (error) {
    identityStatus.textContent = 'Failed: ' + error.message;
    identityRequestButton.disabled = false;
  }
}

async function confirmIdentityRepair() {
  const token = identityCodeInput.value.trim();
  if (!token) { identityStatus.textContent = 'Enter the code from the account email.'; identityCodeInput.focus(); return; }
  identityConfirmButton.disabled = true;
  identityStatus.textContent = 'Updating DID and publishing the labeler declaration…';
  try {
    await api('/api/admin/labeler/identity/confirm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
    });
    identityCodeInput.value = '';
    identityStatus.textContent = 'Identity repaired. The labeler is now discoverable through this account DID.';
    await refreshIdentityStatus();
  } catch (error) {
    identityStatus.textContent = 'Failed: ' + error.message;
    identityConfirmButton.disabled = false;
  }
}

function setLabelStatus(text) {
  if (labelStatus) labelStatus.textContent = text;
}

function renderLabels(labels) {
  if (!document.getElementById('label-list')) return;
  document.getElementById('label-count').textContent = String(labels.length);
  const body = document.getElementById('label-list');
  body.replaceChildren(...labels.map(label => {
    const row = document.createElement('tr');
    [String(label.seq), label.val, label.neg ? 'YES' : '', label.uri,
      label.cts ? new Date(label.cts).toLocaleString() : ''].forEach(value => {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    });
    const actions = document.createElement('td');
    const negate = document.createElement('button');
    negate.type = 'button';
    negate.textContent = 'Negate';
    negate.dataset.uri = label.uri;
    negate.dataset.val = label.val;
    const purge = document.createElement('button');
    purge.type = 'button';
    purge.textContent = 'Purge';
    purge.dataset.seq = String(label.seq);
    actions.append(negate, ' ', purge);
    row.append(actions);
    return row;
  }));
  if (!labels.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 6;
    cell.textContent = 'No labels signed yet.';
    row.append(cell);
    body.append(row);
  }
}

async function refreshLabels() {
  try {
    const payload = await api('/api/admin/labels');
    renderLabels(payload.labels || []);
  } catch {
    renderLabels([]);
  }
}

async function publishLabel(payload) {
  try {
    setLabelStatus('Signing…');
    await api('/api/admin/labels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setLabelStatus('Signed & published.');
    if (labelForm) labelForm.reset();
    await refreshLabels();
  } catch (error) {
    setLabelStatus('Failed: ' + (error.message || 'unknown error'));
  }
}

if (labelForm) {
  labelForm.addEventListener('submit', event => {
    event.preventDefault();
    publishLabel({
      uri: labelForm.querySelector('#label-uri').value.trim(),
      val: labelForm.querySelector('#label-val').value.trim(),
      neg: labelForm.querySelector('#label-neg').checked,
    });
  });
  document.getElementById('label-list').addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.textContent === 'Negate') {
      await publishLabel({ uri: button.dataset.uri, val: button.dataset.val, neg: true });
      return;
    }
    if (button.textContent === 'Purge') {
      if (!(await acidConfirm(`Purge label ${button.dataset.seq} locally? Subscribed clients keep it until you publish a negation.`))) return;
      try {
        await api('/api/admin/labels', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seq: Number(button.dataset.seq) }),
        });
        await refreshLabels();
      } catch (error) {
        setLabelStatus('Failed: ' + (error.message || 'unknown error'));
      }
    }
  });
  labelerRecordButton.addEventListener('click', async () => {
    const values = document.getElementById('label-values').value
      .split(',').map(v => v.trim()).filter(Boolean);
    try {
      setLabelStatus('Writing labeler record…');
      await api('/api/admin/labeler-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labelValues: values }),
      });
      setLabelStatus('Labeler record written to your repo.');
    } catch (error) {
      setLabelStatus('Failed: ' + (error.message || 'unknown error'));
    }
  });
  identityAuthorizeButton?.addEventListener('click', beginIdentityUpgrade);
  identityRequestButton?.addEventListener('click', requestIdentityCode);
  identityConfirmButton?.addEventListener('click', confirmIdentityRepair);
}

async function loadWorkspace(force = false) {
  const section = sectionFilter.value;
  if (!force && state.sections.has(section)) {
    refreshButton.disabled = false;
    renderTransmissionList();
    setStatus(listStatus, 'Loaded this visit. Refresh to check for changes.');
    return;
  }
  refreshButton.disabled = true;
  setStatus(listStatus, 'Loading section…');
  if (!state.pending.has(section)) {
    const revision = state.revision;
    const request = api(`/api/admin/transmissions?section=${encodeURIComponent(section)}`)
      .then(payload => {
        // A list started before a save must not overwrite the confirmed result.
        if (revision !== state.revision) { state.sections.delete(section); return; }
        state.transmissions = state.transmissions.filter(record => record.section !== section)
          .concat(payload.transmissions || []);
        state.sections.add(section);
      }).finally(() => state.pending.delete(section));
    state.pending.set(section, request);
  }
  try {
    await state.pending.get(section);
    if (sectionFilter.value === section) {
      renderTransmissionList();
      setStatus(listStatus, 'Loaded this visit. Refresh to check for changes.');
    }
  } catch (error) {
    if (sectionFilter.value === section) {
      renderTransmissionList();
      setStatus(listStatus, `Could not load posts: ${error.message}. Your editor is unchanged. Use Refresh section to retry.`, 'error');
    }
  } finally {
    refreshButton.disabled = state.pending.has(sectionFilter.value);
  }
}

async function save(status) {
  if (state.busy) return;
  syncRenderedToMarkdown();
  if (!form.reportValidity()) return;
  if (!markdownEditor.value.trim()) { setStatus(editorStatus, 'Transmission body is empty.', 'error'); markdownEditor.focus(); return; }
  const unlock = lockEditor();
  setStatus(editorStatus, status === 'draft' ? 'Saving draft…' : 'Publishing…');
  try {
    const payload = await api('/api/admin/transmissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section: form.elements.section.value,
        date: form.elements.date.value,
        title: form.elements.title.value,
        slug: form.elements.slug.value,
        tags: form.elements.tags.value,
        excerpt: form.elements.excerpt.value,
        markdown: form.elements.markdown.value,
        status,
      }),
    });
    const saved = { ...payload.transmission, source: 'admin' };
    state.revision++;
    state.transmissions = state.transmissions.filter(item => item.section !== saved.section || item.slug !== saved.slug).concat(saved);
    selectTransmission(saved);
    setStatus(editorStatus, status === 'draft' ? 'Draft saved.' : status === 'archived' ? 'Transmission archived.' : 'Transmission published.', 'success');
  } catch (error) {
    setStatus(editorStatus, `Save could not be confirmed: ${error.message}. Your edits are still here.`, 'error');
  } finally {
    unlock();
    renderTransmissionList();
  }
}

async function removeManagedCopy() {
  if (state.busy || !state.active || state.active.source !== 'admin') return;
  if (!(await acidConfirm(`Delete the managed copy of “${state.active.title}”? A repository version with the same slug will reappear if one exists.`))) return;
  const unlock = lockEditor();
  try {
    await api('/api/admin/transmissions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section: state.active.section, slug: state.active.slug }),
    });
    const removed = state.active;
    state.revision++;
    state.transmissions = state.transmissions.filter(item => item.section !== removed.section || item.slug !== removed.slug);
    state.sections.delete(removed.section);
    resetEditor();
    await loadWorkspace(true);
  } catch (error) {
    setStatus(editorStatus, error.message, 'error');
  } finally {
    unlock();
    renderTransmissionList();
  }
}

async function boot() {
  const url = new URL(location.href);
  if (url.searchParams.has('sid') || url.searchParams.has('logged_in')) {
    url.searchParams.delete('sid');
    url.searchParams.delete('logged_in');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }

  try {
    const session = await api('/api/admin/session');
    authPanel.hidden = true;
    workspace.hidden = false;
    logoutButton.hidden = false;
    adminSession = session;
    document.getElementById('admin-identity').textContent = `Authenticated: @${session.handle}`;
    resetEditor();
    await loadWorkspace();
  } catch (error) {
    authPanel.hidden = false;
    workspace.hidden = true;
    logoutButton.hidden = true;
    if (error.status !== 401) setStatus(authStatus, `Could not verify access: ${error.message}. Reload to retry.`, 'error');
  }
}

loginButton.addEventListener('click', async () => {
  loginButton.disabled = true;
  setStatus(authStatus, 'Opening ATProto authentication…');
  try {
    await Auth.login(ownerHandle.value, `${location.origin}/admin.html`);
  } catch (error) {
    setStatus(authStatus, error.message, 'error');
    loginButton.disabled = false;
  }
});
logoutButton.addEventListener('click', async () => {
  if (!(await canDiscard())) return;
  try { await Auth.logout(); state.dirty = false; location.reload(); }
  catch (error) { setStatus(editorStatus, `Could not log out: ${error.message}`, 'error'); }
});
document.getElementById('new-button').addEventListener('click', async () => { if (await canDiscard()) resetEditor(); });
sectionFilter.addEventListener('change', () => { renderTransmissionList(); loadWorkspace(); });
refreshButton.addEventListener('click', () => loadWorkspace(true));
document.getElementById('load-maintenance').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  const status = document.getElementById('maintenance-status');
  setStatus(status, 'Loading maintenance data…');
  const jobs = [
    ['Subscribers', '/api/admin/subscribers', payload => renderSubscribers(payload.subscribers || [])],
    ['Players', '/api/admin/players', payload => renderPlayers(payload.players || [])],
    ['Labels', '/api/admin/labels', payload => renderLabels(payload.labels || [])],
    ['Identity', '/api/admin/labeler/identity', renderIdentityStatus],
  ];
  const results = await Promise.allSettled(jobs.map(async ([, path, render]) => render(await api(path))));
  const failures = results.flatMap((result, i) => result.status === 'rejected' ? [`${jobs[i][0]}: ${result.reason.message}`] : []);
  setStatus(status, failures.length ? failures.join('; ') : 'Maintenance data loaded.', failures.length ? 'error' : 'success');
  button.disabled = false;
  button.textContent = 'Refresh maintenance data';
});
document.getElementById('draft-button').addEventListener('click', () => save('draft'));
document.getElementById('publish-button').addEventListener('click', () => save('published'));
// acid-styled in-page confirm (replaces system confirm popups)
function acidConfirm(message) {
  return new Promise(resolve => {
    const overlay = document.getElementById('acid-confirm');
    const msg = document.getElementById('acid-confirm-msg');
    const ok = document.getElementById('acid-confirm-ok');
    const cancel = document.getElementById('acid-confirm-cancel');
    msg.textContent = message;
    overlay.hidden = false;
    ok.focus();
    const done = answer => { overlay.hidden = true; ok.removeEventListener('click', onOk); cancel.removeEventListener('click', onCancel); overlay.removeEventListener('click', onOverlay); document.removeEventListener('keydown', onKey); resolve(answer); };
    const onOk = () => done(true);
    const onCancel = () => done(false);
    const onOverlay = e => { if (e.target === overlay) done(false); };
    const onKey = e => { if (e.key === 'Escape') done(false); if (e.key === 'Enter') done(true); };
    ok.addEventListener('click', onOk);
    cancel.addEventListener('click', onCancel);
    overlay.addEventListener('click', onOverlay);
    document.addEventListener('keydown', onKey);
  });
}

document.getElementById('archive-button').addEventListener('click', async () => {
  if (!state.active || state.active.status !== 'published') return;
  if (!(await acidConfirm(`Archive “${state.active.title}”? It will be pulled offline (hidden even if a repository copy exists).`))) return;
  await save('archived');
});

// typographer: em/en dashes outside horizontal rules (raw markdown view only)
markdownEditor.addEventListener('input', () => {
  const value = markdownEditor.value;
  const fixed = value.split('\n').map(line => /^\s*-{3,}\s*$/.test(line) ? line : line.replace(/(^|\s)---(\s|$)/g, '$1—$2').replace(/(^|\s)--(\s|$)/g, '$1–$2')).join('\n');
  if (fixed !== value) {
    const pos = markdownEditor.selectionStart + (fixed.length - value.length);
    markdownEditor.value = fixed;
    markdownEditor.setSelectionRange(pos, pos);
  }
});

// image attach → KV → markdown embed at cursor
document.getElementById('image-input').addEventListener('change', async event => {
  const file = event.target.files && event.target.files[0];
  event.target.value = '';
  if (!file || state.busy) return;
  if (file.size > 4 * 1024 * 1024) { setStatus(editorStatus, 'Image too large (max 4MB).', 'error'); return; }
  setStatus(editorStatus, 'Uploading image…');
  const unlock = lockEditor();
  try {
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(new Error('Could not read the image file'));
      reader.readAsDataURL(file);
    });
    const res = await api('/api/admin/images', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: file.type, data }) });
    const alt = file.name.replace(/\.[a-z0-9]+$/i, '');
    unlock();
    if (editorMode === 'rendered') {
      const image = document.createElement('img');
      image.src = res.url;
      image.alt = alt;
      exec('insertHTML', sanitizeEditorHtml(image.outerHTML));
    } else {
      const pos = markdownEditor.selectionStart || markdownEditor.value.length;
      const embed = `![${alt}](${res.url})\n`;
      markdownEditor.value = markdownEditor.value.slice(0, pos) + embed + markdownEditor.value.slice(pos);
      markdownEditor.setSelectionRange(pos + embed.length, pos + embed.length);
    }
    markDirty();
    setStatus(editorStatus, 'Image attached: ' + res.url, 'success');
  } catch (error) { setStatus(editorStatus, 'Image upload failed: ' + error.message, 'error'); }
  finally { unlock(); renderTransmissionList(); }
});
deleteButton.addEventListener('click', removeManagedCopy);
form.elements.title.addEventListener('input', () => { if (state.isNew) form.elements.slug.value = slugify(form.elements.title.value); });
markdownEditor.addEventListener('input', renderRendered);

form.addEventListener('input', markDirty);
form.addEventListener('submit', event => { event.preventDefault(); save('draft'); });
rendered.addEventListener('input', () => { renderedChanged = true; markDirty(); });
rendered.addEventListener('click', event => { if (event.target.closest('a')) event.preventDefault(); });
for (const type of ['paste', 'drop']) {
  rendered.addEventListener(type, event => {
    event.preventDefault();
    if (state.busy || !richEditorAvailable()) return;
    const transfer = event.clipboardData || event.dataTransfer;
    const html = transfer?.getData('text/html');
    if (html) exec('insertHTML', sanitizeEditorHtml(html));
    else exec('insertText', transfer?.getData('text/plain') || '');
  });
}
window.addEventListener('beforeunload', event => {
  if (state.dirty) { event.preventDefault(); event.returnValue = ''; }
});
if (!richEditorAvailable()) {
  setEditorMode('markdown');
  viewRendered.disabled = true;
  viewRendered.title = 'Rendered editing is unavailable. Markdown editing and saving still work.';
}

boot();
