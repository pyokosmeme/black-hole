"""Viewport fit and shared typography. Use --webfonts to load real Google fonts."""
import importlib.util
import sys
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('checks',Path(__file__).with_name('yake-atlas-browser.py'))
checks = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checks)
webfonts = '--webfonts' in sys.argv

def serve(route):
    if webfonts and urlparse(route.request.url).hostname in ['fonts.googleapis.com','fonts.gstatic.com']:
        route.continue_()
    else:
        checks.serve(route)

with sync_playwright() as p:
    browser = p.chromium.launch(args=['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page = browser.new_page(viewport={'width':1366,'height':768},ignore_https_errors=True)
    page.route('**/*',serve)
    page.add_init_script("localStorage.setItem('acidburn-mode','dark')")
    page.goto('https://atlas.test/yake.html')
    page.wait_for_function('window.__sceneAPI && window.__sceneTest')
    if webfonts:
        page.evaluate('''async()=>{await document.fonts.ready;await document.fonts.load('14px "Share Tech Mono"');await document.fonts.load('14px Orbitron');}''')
        assert page.evaluate('''()=>['Share Tech Mono','Orbitron'].every(name=>[...document.fonts].some(f=>f.family.replaceAll('"','')===name&&f.status==='loaded'))''')
    for width,height in [(1366,768),(1920,1080),(390,844),(320,568),(568,320),(844,390)]:
        page.set_viewport_size({'width':width,'height':height})
        page.evaluate("location.hash='view=system'")
        page.wait_for_timeout(300)
        checks.rendered(page)
        assert page.locator('.atlas-toolbar #atlas-reset').count() == 0
        assert page.locator('.atlas-chart > .map-actions .scene-controls > #atlas-reset').count() == 1
        assert page.locator('#atlas-reset').evaluate('e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight-11&&r.left>=0&&r.right<=innerWidth}'),(width,height,page.evaluate('({scroll:scrollY,reset:document.querySelector("#atlas-reset").getBoundingClientRect().toJSON(),chart:document.querySelector(".atlas-chart").getBoundingClientRect().toJSON()})'))
        assert page.evaluate('''()=>{const c=document.querySelector('.atlas-chart').getBoundingClientRect(),h=document.querySelector('.header-bar').getBoundingClientRect(),s=document.querySelector('.atlas-scene').getBoundingClientRect();return c.top>=h.bottom+8&&c.bottom<=innerHeight-11&&c.left>=8&&c.right<=innerWidth-8&&s.height>=90&&document.documentElement.scrollHeight<=innerHeight+1}'''),(width,height)
        assert page.evaluate('''()=>{const font=e=>getComputedStyle(e).fontFamily,body=font(document.body);return body.includes('Share Tech Mono')&&font(document.querySelector('.scene-label'))===body&&font(document.querySelector('#system-summary .system-description'))===body&&font(document.querySelector('#chart-title')).includes('Orbitron')}''')
        assert page.locator('.scene-hint').evaluate('e=>parseFloat(getComputedStyle(e).fontSize)>=11')
        assert page.locator('.scene-label').first.evaluate('e=>parseFloat(getComputedStyle(e).fontSize)>=12')
        page.screenshot(path=str(checks.SHOTS/f'yake-floating-{width}x{height}-{"fonts" if webfonts else "fallback"}.png'))
        # The star's information remains reachable even in short-screen mode.
        if height<=600:
            assert not page.locator('#system-summary').evaluate('e=>e.open')
            page.locator('#system-summary summary').click()
            assert page.locator('.system-description').is_visible()
            assert page.locator('.atlas-chart').evaluate('e=>e.getBoundingClientRect().bottom<=innerHeight-11')
            page.locator('#system-summary summary').click()
        for world in ['jin','shu','marassa','chawkee','skarda','plomo','gullinkambi','celosia','five','mun','in','sin','island-mu','yong','pani']:
            page.evaluate('(id)=>location.hash=id',world)
            page.wait_for_function('(id)=>document.querySelector("#scene-card h1")?.textContent===YAKE_ATLAS.worlds.find(w=>w.id===id).name',arg=world)
            checks.rendered(page)
            assert page.locator('#scene-card').evaluate('''e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth&&e.scrollHeight<=e.clientHeight+1}'''),('card',world,width,height,page.locator('#scene-card').evaluate('e=>({rect:e.getBoundingClientRect().toJSON(),top:e.style.top,footer:document.querySelector(".map-actions").getBoundingClientRect().toJSON()})'))
            assert page.locator('#scene-card .card-heading #world-actions button').evaluate_all('''es=>es.length>0&&es.every(e=>{const r=e.getBoundingClientRect(),c=document.querySelector('#scene-card').getBoundingClientRect();return r.top>=c.top&&r.bottom<=c.bottom&&r.left>=c.left&&r.right<=c.right&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})'''),('actions',world,width,height)
            assert page.locator('.card-intro').evaluate("e=>getComputedStyle(e).textAlign==='left'")
            assert page.locator('#scene-card .card-stats').evaluate('''e=>{const cells=[...e.children].map(c=>c.getBoundingClientRect());return cells.length<2||Math.abs(cells[0].top-cells[1].top)<1&&cells[0].right<=cells[1].left}'''),('two-column facts',world,width,height)
            assert page.locator('#world-actions button').evaluate_all('''es=>es.every(e=>{const r=e.getBoundingClientRect(),x=document.querySelector('.card-close').getBoundingClientRect();return r.top>=x.bottom||r.bottom<=x.top||r.right<=x.left-8})'''),('close clearance',world,width,height)
            page.screenshot(path=str(checks.SHOTS/f'yake-card-actions-{world}-{width}x{height}.png'))
            radius_before=page.evaluate('__sceneTest.radius')
            page.locator('[data-scene-action=focus]').click()
            checks.rendered(page)
            assert not page.locator('#scene-card').is_visible()
            assert page.evaluate('__sceneTest.radius')<radius_before
            assert page.evaluate('''id=>{const s=__sceneTest,b=s.bodies.find(b=>b.id===id||(b.id==='marassa'&&['buka','chawkee'].includes(id)));return b&&s.target.distanceTo(b.position)<.001}''',world)
            assert page.locator('.scene-label[aria-pressed=true]').count()>0
            assert page.locator('.scene-controls button:visible').evaluate_all('''es=>es.every(e=>{const r=e.getBoundingClientRect(),c=document.querySelector('.atlas-chart').getBoundingClientRect();return r.bottom<=c.bottom-4&&r.left>=c.left&&r.right<=c.right&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})'''),('footer hit targets',world,width,height)
            page.locator('#atlas-reset').click()
            assert not page.locator('#scene-card').is_visible()
        print(f'PASS {width}x{height}: floating window, bottom gap, typography, summary disclosure, cards ({"real webfonts" if webfonts else "fallback"})',flush=True)
    browser.close()
