(() => {
  const originalFetch = window.fetch.bind(window);
  const query = new URLSearchParams(location.search);
  const test = window.adminTest = { calls: [], failures: new Set(), holdSave: false };
  const source = '# Original\n\n**Keep this source unchanged.**\n\n<img src="/missing" onerror="window.adminXss=true"><a href="javascript:alert(1)">unsafe</a>';
  const records = [{ section: 'author', slug: 'original', title: 'Original', date: '2026.09.12',
    markdown: source, tags: [], excerpt: '', source: 'repository', status: 'published' }];
  if (query.has('failInitial')) test.failures.add('/api/admin/transmissions?section=author');
  window.fetch = async (path, options = {}) => {
    const url = String(path);
    if (!url.startsWith('/api/')) return originalFetch(path, options);
    const method = options.method || 'GET';
    test.calls.push({ url, method });
    const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (test.failures.has(url)) return reply({ error: 'Simulated KV outage' }, 500);
    if (url === '/api/admin/session') return reply({ authorized: true, did: 'did:plc:test', handle: 'test.invalid' });
    if (url.startsWith('/api/admin/transmissions?')) {
      const section = new URL(url, location.origin).searchParams.get('section');
      return reply({ transmissions: records.filter(record => record.section === section) });
    }
    if (url === '/api/admin/transmissions' && method === 'POST') {
      if (test.holdSave) await new Promise(resolve => { test.releaseSave = resolve; });
      const transmission = { ...JSON.parse(options.body), source: 'admin', updatedAt: new Date().toISOString() };
      transmission.tags = String(transmission.tags).split(',').filter(Boolean);
      records.push(transmission);
      return reply({ transmission, shareUrl: '/p/' + transmission.slug });
    }
    if (url === '/api/admin/subscribers') return reply({ subscribers: [] });
    if (url === '/api/admin/players') return reply({ players: [] });
    if (url === '/api/admin/labels') return reply({ labels: [] });
    if (url === '/api/admin/labeler/identity') return reply({ configured: true, did: 'did:plc:test', labelService: 'https://test.invalid' });
    return reply({ error: 'Unexpected fixture request: ' + url }, 400);
  };
  const pause = () => new Promise(resolve => setTimeout(resolve, 30));
  const until = async predicate => {
    for (let i = 0; i < 100; i++) { if (predicate()) return; await pause(); }
    throw new Error('Timed out waiting for UI');
  };
  const assert = (value, message) => { if (!value) throw new Error(message); };
  test.run = async () => {
    const passed = [];
    const byId = id => document.getElementById(id);
    const form = byId('transmission-form');
    const field = (name, value) => { form.elements[name].value = value; form.elements[name].dispatchEvent(new Event('input', { bubbles: true })); };
    await until(() => !byId('workspace').hidden && !byId('refresh-transmissions').disabled);
    assert(test.calls.length === 2, 'Boot must request only session and one post section');
    passed.push('two boot requests, no maintenance requests');
    if (query.has('failInitial')) {
      assert(byId('list-status').textContent.includes('Could not load'), 'List error must remain visible in workspace');
      field('title', 'Survives retry');
      test.failures.clear();
      byId('refresh-transmissions').click();
      await until(() => !byId('refresh-transmissions').disabled);
      assert(form.elements.title.value === 'Survives retry', 'Retry must retain edits');
      passed.push('initial KV failure keeps workspace open; retry retains edits');
      return passed;
    }
    const filter = byId('section-filter');
    filter.value = 'futures'; filter.dispatchEvent(new Event('change'));
    await until(() => !byId('refresh-transmissions').disabled);
    filter.value = 'author'; filter.dispatchEvent(new Event('change'));
    await pause();
    assert(test.calls.length === 3, 'Returning to a loaded section must use memory');
    passed.push('section switching reuses cached data');
    document.querySelector('.transmission-item').click(); await pause();
    const editor = byId('editor-rendered');
    if (query.has('noSanitizer')) {
      assert(editor.hidden && byId('view-rendered').disabled, 'Missing dependency must use Markdown mode');
      assert(getComputedStyle(editor).display === 'none', 'Fallback must hide the rendered surface');
      assert(byId('markdown-editor').value === source, 'Fallback must preserve original source');
      passed.push('missing sanitizer falls back to editable Markdown');
      return passed;
    }
    assert(!editor.querySelector('[onerror],a[href^="javascript:"]') && !window.adminXss, 'Rendered HTML must be sanitized');
    assert(getComputedStyle(document.querySelector('.markdown-mode')).display === 'none', 'Rendered mode must hide the Markdown pane');
    byId('view-markdown').click();
    assert(getComputedStyle(editor).display === 'none', 'Markdown mode must hide the rendered pane');
    assert(byId('markdown-editor').value === source, 'Viewing must not rewrite source');
    byId('view-rendered').click();
    passed.push('unsafe HTML stripped; untouched Markdown round-trips exactly');
    byId('new-button').click(); await pause();
    field('title', 'Draft survives');
    field('markdown', 'Body survives');
    byId('new-button').click(); await pause();
    assert(!byId('acid-confirm').hidden, 'New must warn about unsaved edits');
    byId('acid-confirm-cancel').click(); await pause();
    assert(form.elements.title.value === 'Draft survives', 'Cancel must keep draft');
    passed.push('unsaved-edit confirmation preserves draft');
    test.failures.add('/api/admin/transmissions');
    byId('draft-button').click();
    await until(() => !byId('draft-button').disabled);
    assert(byId('editor-status').textContent.includes('could not be confirmed'), 'Save failure must be shown');
    assert(form.elements.markdown.value === 'Body survives', 'Failed save must retain body');
    test.failures.clear();
    test.holdSave = true;
    const count = test.calls.length;
    byId('draft-button').click(); byId('publish-button').click();
    await until(() => !!test.releaseSave);
    assert(form.elements.title.disabled && editor.contentEditable === 'false', 'Saving must lock the editor');
    test.releaseSave();
    await until(() => !byId('draft-button').disabled);
    assert(test.calls.length === count + 1, 'Save must issue one POST and no reloads');
    assert(byId('editor-status').textContent === 'Draft saved.', 'Save success must be shown');
    passed.push('failed save retains draft; successful save prevents duplicates and performs no rereads');
    const transfer = new DataTransfer();
    transfer.setData('text/html', '<b>Pasted</b><img src="/missing" onerror="window.adminXss=true">');
    editor.focus();
    editor.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true }));
    assert(!editor.querySelector('[onerror]'), 'Pasted HTML must be sanitized');
    passed.push('pasted HTML sanitized');
    const beforeMaintenance = test.calls.length;
    byId('maintenance-tools').open = true; await pause();
    assert(test.calls.length === beforeMaintenance, 'Opening maintenance must not fetch automatically');
    test.failures.add('/api/admin/subscribers');
    byId('load-maintenance').click();
    await until(() => !byId('load-maintenance').disabled);
    assert(test.calls.length === beforeMaintenance + 4, 'Maintenance button loads four services explicitly');
    assert(!byId('workspace').hidden && byId('maintenance-status').textContent.includes('Subscribers'), 'Maintenance failure must stay isolated');
    passed.push('maintenance loads only explicitly; failures stay isolated');
    await new Promise(resolve => setTimeout(resolve, 1100));
    assert(test.calls.length === beforeMaintenance + 4, 'Idle admin must not poll');
    passed.push('idle page sends no additional requests');
    return passed;
  };
})();
