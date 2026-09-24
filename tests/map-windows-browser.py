"""Browser regression checks for the shared map windows; no production CSS mutation.

Every map page uses one layout (css/map-window.css, js/map-window.js): a window
with a title bar, the map filling it, HUD overlays in the viewport corners, and
closable panes for secondary information. This suite checks, on each page:
fonts and the shared-style inheritance probe; six viewports, collapsed and
expanded (no document overflow, reachable 44px window controls, HUD overlays
inside the map and clear of one another, canvas labels clear of the overlays
and of each other); page flows (panes, Escape order, focus return, view
pickers); display modes; reload; return to the hub; and WebGL failure.

Run: C:\\Python314\\python.exe tests/map-windows-browser.py [page ...]
"""
import mimetypes
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse, unquote
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SHOTS = ROOT / 'attached_files' / 'map-windows'
SHOTS.mkdir(parents=True, exist_ok=True)
PAGES = sys.argv[1:] or ['yake', 'exu2374', 'galaxy', 'ship-viewer']
SIZES = [(1366, 768), (1920, 1080), (320, 568), (390, 844), (568, 320), (768, 1024)]
FONT_CACHE = {}

def serve(route):
    url = urlparse(route.request.url)
    if url.hostname in ['fonts.googleapis.com', 'fonts.gstatic.com']:
        # The local headless network returns an empty Google CSS response.
        # Fetch the real font assets through the working host transport.
        if route.request.url not in FONT_CACHE:
            FONT_CACHE[route.request.url] = subprocess.check_output(['curl.exe', '-k', '-sS', '--fail', route.request.url])
        route.fulfill(body=FONT_CACHE[route.request.url], content_type='text/css' if url.hostname == 'fonts.googleapis.com' else 'font/ttf')
        return
    if url.hostname != 'maps.test':
        route.abort()
        return
    path = (ROOT / unquote(url.path).lstrip('/')).resolve()
    if not path.suffix:
        path = path.with_suffix('.html')
    if not path.is_relative_to(ROOT) or not path.is_file():
        route.fulfill(status=404, body='Not found')
        return
    route.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')

def settle(page, ms=650):
    # Two frames for layout, then time for the label tracker to come to rest.
    page.evaluate('() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))')
    page.wait_for_timeout(ms)

GEOMETRY = '''() => {
  const vp = document.querySelector('.map-viewport');
  const R = e => { const b = e.getBoundingClientRect(); return {x:b.left, y:b.top, r:b.right, b:b.bottom, w:b.width, h:b.height}; };
  const shown = e => !!e && !e.closest('[hidden]') && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' && e.getBoundingClientRect().width > 0;
  const hit = e => { const b = e.getBoundingClientRect(); return e.contains(document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)); };
  const name = e => e.getAttribute('aria-label') || e.textContent.trim();
  return {
    w: innerWidth, h: innerHeight,
    sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight,
    panel: R(document.querySelector('[data-map-window]')), view: R(vp),
    actions: [...document.querySelectorAll('.map-window > .window-toolbar .window-actions > :is(a, button)')].map(e => ({name: name(e), hit: hit(e), ...R(e)})),
    huds: [...vp.querySelectorAll(':scope > .map-hud')].filter(shown).map(e => ({name: e.className, ...R(e)})),
    controls: [...vp.querySelectorAll('.map-hud :is(button, select, a)')].filter(shown).map(e => ({name: name(e), hit: hit(e), ...R(e)})),
    panes: [...vp.querySelectorAll('[data-map-pane]')].filter(shown).map(e => ({name: e.id, closeHit: hit(e.querySelector('[data-pane-close]')), ...R(e)})),
    avoid: [...vp.querySelectorAll('[data-label-avoid]')].filter(shown).map(e => ({name: e.id || e.className, ...R(e)})),
    labels: [...vp.querySelectorAll('.map-label')].filter(e => shown(e) && parseFloat(getComputedStyle(e).opacity || '1') > .9).map(e => ({name: e.textContent.trim(), ...R(e)}))
  };
}'''

def overlaps(a, b, pad=0.5):
    return a['x'] < b['r'] - pad and b['x'] < a['r'] - pad and a['y'] < b['b'] - pad and b['y'] < a['b'] - pad

def inside(a, b, pad=1):
    return a['x'] >= b['x'] - pad and a['y'] >= b['y'] - pad and a['r'] <= b['r'] + pad and a['b'] <= b['b'] + pad

def check(page, where):
    g = page.evaluate(GEOMETRY)
    ctx = (where, g['w'], g['h'])
    assert g['sw'] <= g['w'] + 1 and g['sh'] <= g['h'] + 1, (ctx, 'document overflow', g['sw'], g['sh'])
    p = g['panel']
    assert p['x'] >= 8 and p['r'] <= g['w'] - 8 and p['b'] <= g['h'] - 8, (ctx, 'window outside viewport', p)
    for a in g['actions']:
        assert a['hit'] and a['w'] >= 44 and a['h'] >= 44, (ctx, 'window control', a)
    for hud in g['huds']:
        assert inside(hud, g['view']), (ctx, 'HUD outside map', hud)
    for i, a in enumerate(g['huds']):
        for b in g['huds'][i + 1:]:
            assert not overlaps(a, b), (ctx, 'HUD overlays collide', a['name'], b['name'])
    for c in g['controls']:
        assert c['hit'] and c['w'] >= 40 and c['h'] >= 40, (ctx, 'map control', c)
    for pane in g['panes']:
        assert inside(pane, g['view']) and pane['closeHit'], (ctx, 'pane', pane)
        for c in g['controls']:
            assert not overlaps(pane, c), (ctx, 'pane covers control', pane['name'], c['name'])
    for i, label in enumerate(g['labels']):
        for zone in g['avoid']:
            assert not overlaps(label, zone, 1), (ctx, 'label under overlay', label['name'], zone['name'])
        for other in g['labels'][i + 1:]:
            assert not overlaps(label, other, 1), (ctx, 'labels overlap', label['name'], other['name'])
    return g

def expand_cycle(page, tag):
    button = page.locator('[data-window-expand]')
    button.click()
    settle(page)
    assert button.get_attribute('aria-label') == 'Collapse window'
    assert page.evaluate('document.fullscreenElement === null')
    check(page, tag + ' expanded')
    page.screenshot(path=str(SHOTS / f'{tag}-expanded.png'))
    # Escape closes panes first; close any, then collapse.
    for _ in range(4):
        if button.get_attribute('aria-pressed') == 'false':
            break
        page.keyboard.press('Escape')
        settle(page, 150)
    assert button.get_attribute('aria-pressed') == 'false', tag

def page_flow(page, name):
    if name == 'exu2374':
        page.select_option('#map-view-select', 'classic')
        settle(page)
        page.locator('.station-group').first.focus()
        page.keyboard.press('Enter')
        assert len(page.evaluate('TransitMap.getPlannedRoute()')) == 1
        assert page.locator('#route-pane').is_visible(), 'picking a station opens the planner'
        page.evaluate('''() => { const r = TransitMap.getRoutes()[0]; TransitMap.clearRoute(); TransitMap.addStation(r.from); TransitMap.addStation(r.to); }''')
        before = page.evaluate('TransitMap.getPlannedRoute()')
        for view in ['subway', '3d', 'classic']:
            page.select_option('#map-view-select', view)
            if view == '3d':
                page.wait_for_selector('#map-container.mode-3d')
            settle(page)
            check(page, 'transit ' + view)
            assert page.evaluate('TransitMap.getPlannedRoute()') == before
            page.screenshot(path=str(SHOTS / f'transit-{view}.png'))
        page.locator('#route-clear').click()
        assert not page.evaluate('TransitMap.getPlannedRoute()')
        page.keyboard.press('Escape')
        assert not page.locator('#route-pane').is_visible()
    if name == 'galaxy':
        page.locator('.t3d-label:visible').first.click()
        page.wait_for_selector('#route-pane:not([hidden])')
        assert len(page.evaluate('TransitMap.getPlannedRoute()')) == 1
        assert page.locator('.route-button-label').inner_text().endswith('1')
        settle(page)
        check(page, 'galaxy route pane')
        page.keyboard.press('Escape')
        assert not page.locator('#route-pane').is_visible()
    if name == 'yake':
        page.locator('[data-window-expand]').click()
        page.evaluate("location.hash='celosia'")
        page.wait_for_selector('#world-pane:not([hidden])')
        settle(page)
        check(page, 'yake world card')
        page.keyboard.press('Escape')
        assert not page.locator('#world-pane').is_visible()
        assert page.locator('[data-window-expand]').get_attribute('aria-pressed') == 'true'
        page.evaluate("location.hash='view=jin'")
        page.wait_for_selector('.moon-close:visible')
        settle(page)
        check(page, 'yake moon window')
        page.keyboard.press('Escape')
        page.wait_for_selector('.moon-close', state='hidden')
        assert page.locator('#view-title').inner_text().lower() == 'system overview'
        page.keyboard.press('Escape')
        assert page.locator('[data-window-expand]').get_attribute('aria-pressed') == 'false'
    if name == 'ship-viewer':
        specs = page.locator('[data-pane-toggle="specs-pane"]')
        specs.click()
        assert page.locator('#specs-pane').is_visible()
        assert page.evaluate("document.activeElement.matches('#specs-pane [data-pane-close]')")
        settle(page)
        check(page, 'ship specs pane')
        page.keyboard.press('Escape')
        assert not page.locator('#specs-pane').is_visible()
        assert specs.evaluate('e => document.activeElement === e'), 'focus returns to the opener'
        page.locator('#compare-ships').click()
        page.wait_for_selector('.comparison-label:visible')
        assert page.locator('#compare-ships').get_attribute('aria-pressed') == 'true'
        settle(page)
        check(page, 'ship comparison')
        page.locator('#compare-ships').click()
        page.wait_for_selector('.lab:visible')

with sync_playwright() as p:
    browser = p.chromium.launch(args=['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    for name in PAGES:
        context = browser.new_context(viewport={'width': 1366, 'height': 768}, ignore_https_errors=True)
        context.route('**/*', serve)
        page = context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.add_init_script("if(!localStorage.getItem('acidburn-mode'))localStorage.setItem('acidburn-mode','dark')")
        page.goto(f'https://maps.test/{name}')
        page.wait_for_function('window.MapWindow && window.AcidburnMode')
        page.evaluate('''async()=>{await document.fonts.ready;await document.fonts.load('14px "Share Tech Mono"');await document.fonts.load('14px Orbitron');}''')
        assert page.evaluate('''()=>['Share Tech Mono','Orbitron'].every(name=>[...document.fonts].some(f=>f.family.replaceAll('"','')===name&&f.status==='loaded'))'''), page.evaluate('''()=>({fonts:[...document.fonts].map(f=>[f.family,f.status]),sheets:[...document.styleSheets].map(s=>s.href)})''')
        assert page.evaluate('''async()=>{const s=[...document.styleSheets].find(s=>s.href&&new URL(s.href).pathname==='/css/acidburn.css');const i=s.cssRules.length;s.insertRule('.section-header h2 {color:rgb(12,34,56)}',i);let ok=false;for(let t=0;t<30&&!ok;t++){await new Promise(r=>setTimeout(r,100));ok=getComputedStyle(document.querySelector('#chart-title')).color==='rgb(12, 34, 56)';}s.deleteRule(i);return ok}''')
        settle(page, 1500)
        for width, height in SIZES:
            page.set_viewport_size({'width': width, 'height': height})
            settle(page)
            check(page, f'{name} {width}x{height}')
            page.screenshot(path=str(SHOTS / f'{name}-{width}x{height}.png'))
            expand_cycle(page, f'{name}-{width}x{height}')
        page.set_viewport_size({'width': 1366, 'height': 768})
        settle(page)
        page_flow(page, name)
        for mode in ['light', 'bh', 'dark', 'bh']:
            page.evaluate('(m)=>AcidburnMode.setMode(m)', mode)
            if mode == 'bh':
                page.wait_for_function('window.AcidburnBlackhole?.isReady', timeout=30000)
                assert page.locator('#blackhole-container canvas').count() == 1
            settle(page)
            check(page, f'{name} {mode} mode')
            page.screenshot(path=str(SHOTS / f'{name}-{mode}.png'))
        page.reload()
        page.wait_for_function('window.AcidburnBlackhole?.isReady', timeout=30000)
        assert page.locator('#blackhole-container canvas').count() == 1
        page.locator('.map-window > .window-toolbar a').click()
        page.wait_for_url('**/maps')
        page.wait_for_selector('#links-grid a[href="ship-viewer.html"]')
        assert not errors, (name, errors)
        print(name + ': sizes, expansion, overlays, labels, panes, keyboard, fonts, inheritance, modes, reload and hub return passed', flush=True)
        context.close()
    # A clean context exercises graceful WebGL failure without breaking window controls.
    for name in PAGES:
        context = browser.new_context(viewport={'width': 390, 'height': 844})
        context.route('**/*', serve)
        page = context.new_page()
        page.add_init_script('''localStorage.setItem('acidburn-mode','bh');const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return /webgl/.test(t)?null:get.call(this,t,...a)}''')
        page.goto(f'https://maps.test/{name}')
        page.wait_for_function('window.MapWindow')
        settle(page, 800)
        if name == 'yake':
            assert page.locator('.fallback-notice').is_visible()
            page.locator('.atlas-node').first.click()
            page.wait_for_selector('#world-pane:not([hidden])')
            page.keyboard.press('Escape')
        if name == 'ship-viewer':
            assert page.locator('#err').is_visible()
        check(page, name + ' without WebGL')
        page.locator('[data-window-expand]').click()
        check(page, name + ' without WebGL expanded')
        page.locator('.map-window > .window-toolbar a').click()
        page.wait_for_url('**/maps')
        context.close()
    browser.close()
print('All map window browser checks passed.', flush=True)
