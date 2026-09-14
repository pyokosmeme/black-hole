/* Browser regression fixture; served only by nav-menu-browser-server.mjs. */
window.navTest = {
  async run() {
    const pages = ['index.html', 'ams.html', 'futures.html', 'maps.html', 'yake.html', 'exu2374.html', 'exu2370.html', 'exu3d2385.html', 'index2.html', 'black-hole.html'];
    const sizes = [[320, 568], [390, 844], [568, 320], [768, 1024], [1366, 768]];
    const frame = document.createElement('iframe');
    frame.style.border = '0';
    document.body.append(frame);
    const assert = (ok, message) => { if (!ok) throw new Error(message); };
    const pause = () => new Promise(resolve => setTimeout(resolve, 350));
    const load = async path => {
      await new Promise(resolve => { frame.onload = resolve; frame.src = '/' + path; });
      await pause();
      return frame.contentWindow;
    };
    let checks = 0;
    for (const page of pages) {
      const win = await load(page);
      const doc = win.document;
      const home = doc.querySelector('.nav-home');
      const toggle = doc.querySelector('.nav-toggle');
      assert(home?.getAttribute('href') === '/', page + ' Home target');
      assert(doc.querySelectorAll('.nav-dropdown a').length === 6, page + ' links');
      assert(!doc.querySelector('.nav-toggle-arrow'), page + ' no redundant triangle');
      // The title text is normally populated by the content engine.
      const title = doc.querySelector('.header-brand');
      if (title?.textContent.trim() === 'LOADING') title.textContent = 'SPECULATIVE FUTURES';
      for (const [width, height] of sizes) {
        frame.width = width; frame.height = height;
        for (const mode of ['dark', 'light', 'bh']) {
          if (win.AcidburnMode) win.AcidburnMode.setMode(mode);
          else { doc.body.classList.remove('dark-mode', 'light-mode', 'bh-mode'); doc.body.classList.add(mode + '-mode'); }
          if (toggle.getAttribute('aria-expanded') !== 'true') toggle.click();
          const maps = doc.querySelector('[data-has-children]');
          if (maps.getAttribute('aria-expanded') !== 'true') maps.click();
          await pause();
          const context = `${page} ${width}x${height} ${mode}`;
          const dropdown = doc.querySelector('.nav-dropdown');
          const r = dropdown.getBoundingClientRect();
          assert(win.getComputedStyle(dropdown).visibility === 'visible', context + ' visible');
          assert(r.left >= 0 && r.right <= width + 1 && r.top >= 0 && r.bottom <= height + 1, context + ' dropdown fits ' + JSON.stringify(r));
          for (const control of [home, toggle]) {
            const b = control.getBoundingClientRect();
            assert(b.width >= 44 && b.height >= 44, context + ' touch target');
            assert(control.contains(doc.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)), context + ' control covered');
          }
          if (win.AcidburnMode) {
            const header = doc.querySelector('.header-bar').getBoundingClientRect();
            assert(home.getBoundingClientRect().left < header.left + 20, context + ' Home at left edge');
            assert(toggle.getBoundingClientRect().right > header.right - 20, context + ' Menu at right edge');
            if (width > 768) assert(Math.abs(r.right - header.right) <= 1, context + ' dropdown anchored right');
            const picker = doc.querySelector('.nav-dropdown .mode-picker');
            assert(picker && doc.querySelectorAll('[data-display-mode]').length === 3 && !doc.querySelector('#main-mode-toggle'), context + ' direct mode choices');
            assert(doc.querySelector('[data-display-mode][aria-pressed=true]').dataset.displayMode === mode, context + ' selected mode');
            assert(picker.getBoundingClientRect().top >= doc.querySelector('.nav-pages').getBoundingClientRect().bottom - 1, context + ' display below navigation');
            picker.scrollIntoView({ block: 'nearest' });
            for (const button of picker.querySelectorAll('button')) {
              const b = button.getBoundingClientRect();
              assert(b.width >= 44 && b.height >= 44 && b.left >= r.left && b.right <= r.right, context + ' mode target fits');
              assert(button.contains(doc.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)), context + ' mode reachable');
              assert(win.getComputedStyle(button).fontFamily === win.getComputedStyle(doc.querySelector('.nav-link')).fontFamily, context + ' shared menu font');
            }
            const next = { dark: 'light', light: 'bh', bh: 'dark' }[mode];
            const choice = picker.querySelector(`[data-display-mode=${next}]`);
            choice.click();
            choice.click();
            assert(win.AcidburnMode.getMode() === next && win.localStorage.getItem('acidburn-mode') === next, context + ' direct choice persists without cycling');
            assert(picker.querySelectorAll('[aria-pressed=true]').length === 1 && choice.getAttribute('aria-pressed') === 'true', context + ' exclusive selection');
            assert(toggle.getAttribute('aria-expanded') === 'true', context + ' menu stays open after selection');
          }
          assert(doc.documentElement.scrollWidth <= width, context + ' document overflow');
          checks++;
        }
      }
      doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      assert(toggle.getAttribute('aria-expanded') === 'false' && doc.activeElement === toggle, page + ' Escape focus');
      toggle.click();
      doc.body.click();
      assert(toggle.getAttribute('aria-expanded') === 'false', page + ' outside click');
      // Prove layout still inherits the shared stylesheet in the browser only.
      const sheet = [...doc.styleSheets].find(s => s.href?.includes('/css/acidburn.css'));
      if (sheet) {
        const index = sheet.cssRules.length;
        sheet.insertRule('#nav-menu { gap: 13px; }', index);
        assert(win.getComputedStyle(doc.querySelector('#nav-menu')).gap === '13px', page + ' shared inheritance');
        sheet.deleteRule(index);
      }
    }
    for (const scenario of ['html', '404', 'empty', 'invalid', 'pending']) {
      const win = await load('maps.html?config=' + scenario);
      assert(win.document.querySelectorAll('.nav-dropdown a').length === 6, scenario + ' fallback links');
      assert(win.document.querySelector('.nav-home').getAttribute('href') === '/', scenario + ' fallback Home');
      assert(win.document.querySelectorAll('.nav-dropdown [data-display-mode]').length === 3, scenario + ' modes survive config failure');
    }
    for (const query of ['config=delayed', 'navFirst']) {
      const win = await load('maps.html?' + query);
      await new Promise(resolve => setTimeout(resolve, 700));
      assert(win.document.querySelectorAll('.nav-dropdown [data-display-mode]').length === 3, query + ' modes survive script ordering/config refresh');
      win.document.querySelector('[data-display-mode=light]').click();
      assert(win.AcidburnMode.getMode() === 'light', query + ' preserved mode listener');
    }
    const reading = await load('index.html');
    reading.AcidburnMode.setMode('bh');
    reading.document.querySelector('#post-view').classList.add('active');
    await pause();
    assert(reading.document.querySelector('[data-display-mode=bh]').disabled, 'BH paused in reading view');
    reading.document.querySelector('[data-display-mode=light]').click();
    assert(reading.AcidburnMode.getMode() === 'bh' && reading.document.body.classList.contains('light-reading'), 'reading choice preserves background preference');
    reading.document.querySelector('#post-view').classList.remove('active');
    await pause();
    assert(!reading.document.querySelector('[data-display-mode=bh]').disabled && reading.document.querySelector('[data-display-mode=bh]').getAttribute('aria-pressed') === 'true', 'BH restored after reading');
    frame.remove();
    return { passed: checks, pages: pages.length, sizes, modes: ['dark', 'light', 'bh'], fallbackScenarios: 5 };
  }
};
