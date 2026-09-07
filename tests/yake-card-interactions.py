"""Centered summaries, double-click/tap focus, and individual torus selection."""
import importlib.util
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('checks', Path(__file__).with_name('yake-atlas-browser.py'))
checks = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checks)

with sync_playwright() as p:
    browser = p.chromium.launch(args=['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    for width, height in [(1100,950),(390,844),(320,568),(568,320)]:
        page = browser.new_page(viewport={'width':width,'height':height}, has_touch=True)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.route('**/*', checks.serve)
        page.add_init_script("localStorage.setItem('acidburn-mode','dark')")
        page.goto('https://atlas.test/yake.html')
        page.wait_for_function('window.__sceneTest && window.__sceneAPI')
        assert page.locator('[data-pick=yake]').count() == 0
        summary = page.locator('#system-summary').text_content()
        assert 'STAR & STAR SYSTEM' in summary and 'K-TYPE GIANT' in summary
        assert 'Spanning Worlds Independence' in summary
        assert 'Canis' not in summary and 'Catalog' not in summary
        page.evaluate("location.hash='five'")
        page.wait_for_selector('.card-detail')
        assert all(name in page.locator('#scene-card').inner_text() for name in ['Mun','In','Sin','Mu','Yong'])
        page.keyboard.press('Escape')
        page.locator('.scene-canvas').scroll_into_view_if_needed()
        if not page.locator('[data-pick=jin]').is_visible():
            page.evaluate("location.hash='jin'")
            page.wait_for_selector('[data-pick=jin]')
            page.keyboard.press('Escape')
        # Real mouse double click: the first click must not open an intercepting card.
        page.locator('[data-pick=jin]').dblclick(delay=90)
        page.wait_for_function("__sceneTest.radius<200 && document.querySelector('#scene-card h1')?.textContent==='Jin / 金'")
        page.keyboard.press('Escape')
        camera = page.evaluate('__sceneTest.radius')
        page.wait_for_timeout(400)
        assert not page.locator('#scene-card').is_visible()
        assert page.evaluate('__sceneTest.radius') == camera
        # Two physical touch taps use the same focus action.
        page.locator('[data-scene-action=home]').click()
        page.locator('.scene-canvas').scroll_into_view_if_needed()
        checks.rendered(page)
        label = page.locator('[data-pick=jin]').bounding_box()
        for _ in range(2):
            page.touchscreen.tap(label['x']+label['width']/2,label['y']+label['height']/2)
            page.wait_for_timeout(60)
        page.wait_for_function("__sceneTest.radius<200 && document.querySelector('#scene-card h1')?.textContent==='Jin / 金'")
        page.keyboard.press('Escape')
        page.evaluate("location.hash='marassa'")
        page.wait_for_function("__sceneTest.currentView==='jin'")
        page.locator('[data-scene-action=focus]').click()
        for ring in ['buka','chawkee']:
            page.locator(f'[data-select-world={ring}]').click()
            checks.rendered(page)
            assert page.evaluate('''id=>__sceneTest.bodies.find(b=>b.id==='marassa').mesh.children.filter(c=>c.name==='rotating-wheel').every(c=>c.getObjectByName('ring-selection').visible===(c.userData.world===id))''',ring)
            page.screenshot(path=str(checks.SHOTS/f'yake-{ring}-card-{width}.png'))
        page.keyboard.press('Escape')
        assert page.evaluate("__sceneTest.bodies.find(b=>b.id==='marassa').mesh.children.some(c=>c.userData.world==='chawkee'&&c.getObjectByName('ring-selection').visible)")
        page.screenshot(path=str(checks.SHOTS/f'yake-ring-highlight-{width}.png'))
        page.evaluate("location.hash='skarda'")
        page.wait_for_selector('#scene-card em')
        assert page.locator('#scene-card em').first.inner_text() == 'celariums'
        page.keyboard.press('Escape')
        page.evaluate("location.hash='celosia'")
        page.wait_for_function("__sceneTest.currentView==='system'")
        for region in ['fusang','mu','diyu']:
            page.locator(f'[data-scene-action=surface-{region}]').click()
            assert page.locator('#scene-card h1').inner_text().lower() == region
            assert page.locator('#scene-card').evaluate('''e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=document.querySelector('.map-actions').getBoundingClientRect().top-7&&r.left>=0&&r.right<=innerWidth&&e.scrollHeight<=e.clientHeight+1}'''),(width,height,region)
            page.screenshot(path=str(checks.SHOTS/f'yake-{region}-card-{width}.png'))
        page.keyboard.press('Escape')
        for region in ['fusang','mu','diyu']:
            page.evaluate('(region)=>{__sceneAPI.select("celosia");__sceneAPI.surface(region)}',region)
            checks.rendered(page)
            page.screenshot(path=str(checks.SHOTS/f'yake-{region}-coast-{width}.png'))
        assert not errors, errors
        print(f'PASS {width}x{height}: header, names, double-click/tap, independent rings, italics, continent cards',flush=True)
        page.close()
    browser.close()
