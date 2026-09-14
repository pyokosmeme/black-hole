"""Browser regression checks for shared map windows; no production CSS mutation."""
import json
import mimetypes
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse, unquote
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SHOTS = ROOT / 'attached_files' / 'map-windows'
SHOTS.mkdir(parents=True, exist_ok=True)
# Ship rendering, switching and legacy links have their own browser suite.
PAGES = sys.argv[1:] or ['yake', 'exu2374']
FONT_CACHE = {}

def serve(route):
    url = urlparse(route.request.url)
    if url.hostname in ['fonts.googleapis.com', 'fonts.gstatic.com']:
        # The local headless network returns an empty Google CSS response.
        # Fetch the real font assets through the working host transport.
        if route.request.url not in FONT_CACHE:
            FONT_CACHE[route.request.url] = subprocess.check_output(['curl.exe','-k','-sS','--fail',route.request.url])
        route.fulfill(body=FONT_CACHE[route.request.url],content_type='text/css' if url.hostname=='fonts.googleapis.com' else 'font/ttf')
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
    body = path.read_bytes()
    route.fulfill(body=body, content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')

def settle(page):
    page.evaluate('() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))')

def bounds(page):
    result = page.evaluate('''() => {
      const panel=document.querySelector('[data-map-window]').getBoundingClientRect();
      const actions=[...document.querySelectorAll('.window-actions a,.window-actions button')].map(e=>{const r=e.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {rect:r.toJSON(),hit:e.contains(hit),over:hit?.outerHTML.slice(0,200)}});
      return {panel:panel.toJSON(),width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,actions};
    }''')
    assert result['scrollWidth'] <= result['width']+1, result
    assert result['scrollHeight'] <= result['height']+1, result
    p = result['panel']
    assert p['left'] >= 8 and p['right'] <= result['width']-8 and p['bottom'] <= result['height']-8, result
    for a in result['actions']:
        assert a['hit'] and a['rect']['width'] >= 44 and a['rect']['height'] >= 44, result

with sync_playwright() as p:
    browser = p.chromium.launch(args=['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    for name in PAGES:
        context = browser.new_context(viewport={'width':1366,'height':768},ignore_https_errors=True)
        context.route('**/*',serve)
        page = context.new_page()
        errors=[]
        page.on('pageerror',lambda error: errors.append(str(error)))
        page.add_init_script("if(!localStorage.getItem('acidburn-mode'))localStorage.setItem('acidburn-mode','dark')")
        page.goto(f'https://maps.test/{name}')
        page.wait_for_function('window.MapWindow && window.AcidburnMode')
        page.evaluate('''async()=>{await document.fonts.ready;await document.fonts.load('14px "Share Tech Mono"');await document.fonts.load('14px Orbitron');}''')
        assert page.evaluate('''()=>['Share Tech Mono','Orbitron'].every(name=>[...document.fonts].some(f=>f.family.replaceAll('"','')===name&&f.status==='loaded'))'''), page.evaluate('''()=>({fonts:[...document.fonts].map(f=>[f.family,f.status]),sheets:[...document.styleSheets].map(s=>s.href)})''')
        assert page.evaluate('''async()=>{const s=[...document.styleSheets].find(s=>s.href?.endsWith('/css/acidburn.css'));const i=s.cssRules.length;s.insertRule('.section-header h2 {color:rgb(12,34,56)}',i);await new Promise(r=>setTimeout(r,400));const ok=getComputedStyle(document.querySelector('#chart-title')).color==='rgb(12, 34, 56)';s.deleteRule(i);return ok}''')
        for width,height in [(1366,768),(1920,1080),(320,568),(390,844),(568,320),(768,1024)]:
            page.set_viewport_size({'width':width,'height':height})
            settle(page)
            bounds(page)
            page.screenshot(path=str(SHOTS/f'{name}-{width}x{height}.png'))
            button=page.locator('[data-window-expand]')
            button.click()
            settle(page)
            assert button.get_attribute('aria-label')=='Collapse window'
            assert page.evaluate('document.fullscreenElement===null')
            bounds(page)
            page.screenshot(path=str(SHOTS/f'{name}-{width}x{height}-expanded.png'))
            page.keyboard.press('Escape')
            assert button.get_attribute('aria-pressed')=='false'
            assert button.evaluate('e=>document.activeElement===e')
        page.set_viewport_size({'width':1366,'height':768})
        if name=='exu2374':
            page.locator('#btn-2d').click()
            page.locator('.station-group').first.focus()
            page.keyboard.press('Enter')
            assert len(page.evaluate('TransitMap.getPlannedRoute()'))==1
            page.evaluate('''()=>{const r=TransitMap.getRoutes()[0];TransitMap.clearRoute();TransitMap.addStation(r.from);TransitMap.addStation(r.to)}''')
            route_before=page.evaluate('TransitMap.getPlannedRoute()')
            for selector in ['#btn-sub','#btn-3d','#btn-2d']:
                page.locator(selector).click()
                if selector=='#btn-3d':
                    page.wait_for_selector('#map-container.mode-3d')
                page.locator('[data-window-expand]').click()
                settle(page)
                assert page.evaluate('TransitMap.getPlannedRoute()')==route_before
                page.screenshot(path=str(SHOTS/f'transit-{selector[1:]}-expanded.png'))
                page.locator('[data-window-expand]').click()
            page.locator('.clear-btn').click()
            assert not page.evaluate('TransitMap.getPlannedRoute()')
        if name=='yake':
            page.locator('[data-window-expand]').click()
            page.evaluate("location.hash='celosia'")
            page.wait_for_selector('#scene-card:not([hidden])')
            page.keyboard.press('Escape')
            assert page.locator('[data-window-expand]').get_attribute('aria-pressed')=='true'
            assert not page.locator('#scene-card').is_visible()
            page.keyboard.press('Escape')
            assert page.locator('[data-window-expand]').get_attribute('aria-pressed')=='false'
        for mode in ['light','bh','dark','bh']:
            page.evaluate('(m)=>AcidburnMode.setMode(m)',mode)
            if mode=='bh':
                page.wait_for_function('window.AcidburnBlackhole?.isReady',timeout=30000)
                assert page.locator('#blackhole-container canvas').count()==1
            settle(page)
            page.screenshot(path=str(SHOTS/f'{name}-{mode}.png'))
        page.reload()
        page.wait_for_function('window.AcidburnBlackhole?.isReady',timeout=30000)
        assert page.locator('#blackhole-container canvas').count()==1
        page.locator('.window-actions a').click()
        page.wait_for_url('**/maps')
        page.wait_for_selector('#links-grid a[href="ship-viewer.html"]')
        assert not errors, (name,errors)
        print(name+': sizes, expansion, keyboard, fonts, inheritance, modes, reload and hub return passed',flush=True)
        context.close()
    # A clean context exercises graceful WebGL failure without breaking window controls.
    for name in PAGES:
        context=browser.new_context(viewport={'width':390,'height':844})
        context.route('**/*',serve)
        page=context.new_page()
        page.add_init_script('''localStorage.setItem('acidburn-mode','bh');const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return /webgl/.test(t)?null:get.call(this,t,...a)}''')
        page.goto(f'https://maps.test/{name}')
        page.wait_for_function('window.MapWindow')
        if name=='yake':
            assert page.locator('.fallback-notice').is_visible()
        page.locator('[data-window-expand]').click()
        bounds(page)
        page.locator('.window-actions a').click()
        page.wait_for_url('**/maps')
        context.close()
    browser.close()
print('All map window browser checks passed.',flush=True)
