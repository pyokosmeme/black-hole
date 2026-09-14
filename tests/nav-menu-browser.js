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
          assert(home.getBoundingClientRect().right <= toggle.getBoundingClientRect().left + 1, context + ' Home beside menu');
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
    }
    frame.remove();
    return { passed: checks, pages: pages.length, sizes, modes: ['dark', 'light', 'bh'], fallbackScenarios: 5 };
  }
};
