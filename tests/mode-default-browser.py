"""Fresh visits start in Dark; valid saved choices win on every device. --live supported."""
from pathlib import Path
import importlib.util
import sys
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('cards',ROOT/'scripts/map-social-cards.py')
cards=importlib.util.module_from_spec(spec)
spec.loader.exec_module(cards)
live='--live' in sys.argv
origin='https://lastnpcalex.agency' if live else 'https://cards.test'
with sync_playwright() as p:
    browser=p.chromium.launch(args=['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    for width in [390,1366]:
        for saved in [None,'obsolete','dark','light','bh']:
            context=browser.new_context(viewport={'width':width,'height':844})
            if not live:
                context.route('**/*',cards.serve)
            if saved is not None:
                context.add_init_script("localStorage.setItem('acidburn-mode',"+repr(saved)+")")
            page=context.new_page()
            page.goto(origin+'/index.html')
            expected=saved if saved in ['dark','light','bh'] else 'dark'
            page.wait_for_function('window.AcidburnMode !== undefined')
            assert page.evaluate('AcidburnMode.getMode()')==expected,(width,saved)
            assert page.locator('body').evaluate('(e,mode)=>e.classList.contains(mode+"-mode")',expected)
            assert page.evaluate("localStorage.getItem('acidburn-mode')")==expected
            if expected!='bh':
                assert page.locator('#blackhole-container canvas').count()==0
            page.reload()
            page.wait_for_function('window.AcidburnMode !== undefined')
            assert page.evaluate('AcidburnMode.getMode()')==expected
            print('PASS', 'live' if live else 'local', width, saved, '->',expected,flush=True)
            context.close()
    browser.close()
