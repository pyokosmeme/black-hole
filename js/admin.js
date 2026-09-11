import * as Auth from './bsky-auth.js';
import { markProseBrackets } from './prose-brackets.js';

const state = { transmissions: [], active: null, isNew: true };
const authPanel = document.getElementById('auth-panel');
const workspace = document.getElementById('workspace');
const loginButton = document.getElementById('login-button');
const ownerHandle = document.getElementById('owner-handle');
const logoutButton = document.getElementById('logout-button');
const authStatus = document.getElementById('auth-status');
const form = document.getElementById('transmission-form');
const list = document.getElementById('transmission-list');
const preview = document.getElementById('markdown-preview');
const editorStatus = document.getElementById('editor-status');
const sourceNote = document.getElementById('source-note');
const shareLink = document.getElementById('share-link');
const deleteButton = document.getElementById('delete-button');

async function api(path, options = {}) {
  const { headers = {}, ...requestOptions } = options;
  const response = await fetch(path, { ...requestOptions, headers: { Accept: 'application/json', ...headers } });
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

function updatePreview() {
  const markdown = form.elements.markdown.value;
  if (window.marked) preview.innerHTML = window.marked.parse(markdown || '*Preview waiting for signal.*');
  else preview.textContent = markdown;
  markProseBrackets(preview);
}

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
  updatePreview();
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
  updatePreview();
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
    button.addEventListener('click', () => selectTransmission(record));
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

async function loadWorkspace() {
  const [transmissions, subscribers, players, labels] = await Promise.all([
    api('/api/admin/transmissions'),
    api('/api/admin/subscribers'),
    api('/api/admin/players').catch(() => ({ players: [] })),
    api('/api/admin/labels').catch(() => ({ labels: [] })),
  ]);
  state.transmissions = transmissions.transmissions || [];
  renderTransmissionList();
  renderSubscribers(subscribers.subscribers || []);
  renderPlayers(players.players || []);
  renderLabels(labels.labels || []);
  resetEditor();
}

async function save(status) {
  if (!form.reportValidity()) return;
  const buttons = [document.getElementById('draft-button'), document.getElementById('publish-button')];
  buttons.forEach(button => { button.disabled = true; });
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
    setStatus(editorStatus, status === 'draft' ? 'Draft saved.' : 'Transmission published.', 'success');
    shareLink.href = payload.shareUrl;
    shareLink.textContent = payload.shareUrl;
    shareLink.hidden = status !== 'published';
    await loadWorkspace();
    const saved = state.transmissions.find(item => item.section === payload.transmission.section && item.slug === payload.transmission.slug);
    if (saved) selectTransmission(saved);
    setStatus(editorStatus, status === 'draft' ? 'Draft saved.' : 'Transmission published.', 'success');
  } catch (error) {
    setStatus(editorStatus, error.message, 'error');
  } finally {
    buttons.forEach(button => { button.disabled = false; });
  }
}

async function removeManagedCopy() {
  if (!state.active || state.active.source !== 'admin') return;
  if (!(await acidConfirm(`Delete the managed copy of “${state.active.title}”? A repository version with the same slug will reappear if one exists.`))) return;
  try {
    await api('/api/admin/transmissions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section: state.active.section, slug: state.active.slug }),
    });
    await loadWorkspace();
  } catch (error) {
    setStatus(editorStatus, error.message, 'error');
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
    await loadWorkspace();
    await refreshIdentityStatus();
  } catch (error) {
    authPanel.hidden = false;
    workspace.hidden = true;
    logoutButton.hidden = true;
    if (error.status === 403) setStatus(authStatus, error.message, 'error');
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
logoutButton.addEventListener('click', async () => { await Auth.logout(); location.reload(); });
document.getElementById('new-button').addEventListener('click', resetEditor);
document.getElementById('section-filter').addEventListener('change', renderTransmissionList);
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

// typographer: em/en dashes outside horizontal rules
const markdownEditor = document.getElementById('markdown-editor');
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
  if (!file) return;
  if (file.size > 4 * 1024 * 1024) { setStatus(editorStatus, 'Image too large (max 4MB).', 'error'); return; }
  setStatus(editorStatus, 'Uploading image…');
  const data = await new Promise(resolve => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1] || ''); r.readAsDataURL(file); });
  try {
    const res = await api('/api/admin/images', { method: 'POST', body: JSON.stringify({ type: file.type, data }) });
    const pos = markdownEditor.selectionStart || markdownEditor.value.length;
    const embed = `![${file.name.replace(/\.[a-z0-9]+$/i, '')}](${res.url})\n`;
    markdownEditor.value = markdownEditor.value.slice(0, pos) + embed + markdownEditor.value.slice(pos);
    markdownEditor.dispatchEvent(new Event('input', { bubbles: true }));
    setStatus(editorStatus, 'Image attached: ' + res.url, 'success');
  } catch (error) { setStatus(editorStatus, 'Image upload failed: ' + error.message, 'error'); }
});
deleteButton.addEventListener('click', removeManagedCopy);
form.elements.title.addEventListener('input', () => { if (state.isNew) form.elements.slug.value = slugify(form.elements.title.value); });
form.elements.markdown.addEventListener('input', updatePreview);

boot();
