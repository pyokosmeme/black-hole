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
      if (!confirm(`Purge label ${button.dataset.seq} locally? Subscribed clients keep it until you publish a negation.`)) return;
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
  if (!window.confirm(`Delete the managed copy of “${state.active.title}”? A repository version with the same slug will reappear if one exists.`)) return;
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
    document.getElementById('admin-identity').textContent = `Authenticated: @${session.handle}`;
    await loadWorkspace();
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
deleteButton.addEventListener('click', removeManagedCopy);
form.elements.title.addEventListener('input', () => { if (state.isNew) form.elements.slug.value = slugify(form.elements.title.value); });
form.elements.markdown.addEventListener('input', updatePreview);

boot();
