"""Viewport fit, shared typography, and world panes. Use --webfonts to load real Google fonts."""
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

INSIDE = '''(e,sel)=>{const r=e.getBoundingClientRect(),c=document.querySelector(sel).getBoundingClientRect();return r.top>=c.top-1&&r.bottom<=c.bottom+1&&r.left>=c.left-1&&r.right<=c.right+1}'''
HIT = '''es=>es.length>0&&es.every(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})'''

with sync_playwright() as p:
    browser = p.chromium.launch(args=['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page = browser.new_page(viewport={'width':1366,'height':768},ignore_https_errors=True)
    page.route('**/*',serve)
    page.add_init_script("localStorage.setItem('acidburn-mode','dark');localStorage.setItem('yake-system-notes','closed')")
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
        # One reset, in the map's own controls; no second copy in the title bar.
        assert page.locator('.atlas-toolbar [data-scene-action]').count() == 0
        assert page.locator('.atlas-scene > .map-hud .map-controls [data-scene-action=home]').count() == 1
        assert page.locator('[data-scene-action=home]').evaluate('e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight-11&&r.left>=0&&r.right<=innerWidth}'),(width,height)
        assert page.evaluate('''()=>{const c=document.querySelector('.atlas-chart').getBoundingClientRect(),h=document.querySelector('.header-bar').getBoundingClientRect(),s=document.querySelector('.atlas-scene').getBoundingClientRect();return c.top>=h.bottom+8&&c.bottom<=innerHeight-8&&c.left>=8&&c.right<=innerWidth-8&&s.height>=90&&document.documentElement.scrollHeight<=innerHeight+1}'''),(width,height)
        assert page.evaluate('''()=>{const font=e=>getComputedStyle(e).fontFamily;return font(document.body).includes('Share Tech Mono')&&font(document.querySelector('.scene-label')).includes('Share Tech Mono')&&font(document.querySelector('#system-pane .map-pane-body')).includes('Share Tech Mono')&&font(document.querySelector('#chart-title')).includes('Orbitron')}''')
        assert page.locator('.map-hint').evaluate('e=>parseFloat(getComputedStyle(e).fontSize)>=11')
        assert page.locator('.scene-label').first.evaluate('e=>parseFloat(getComputedStyle(e).fontSize)>=11')
        page.screenshot(path=str(checks.SHOTS/f'yake-floating-{width}x{height}-{"fonts" if webfonts else "fallback"}.png'))
        # The star's information stays one tap away at every size.
        page.locator('[data-pane-toggle=system-pane]').click()
        assert page.locator('#system-pane').is_visible()
        assert page.locator('#system-pane').evaluate(INSIDE,'.atlas-scene'),(width,height)
        assert page.locator('#system-pane [data-pane-close]').evaluate_all(HIT)
        page.keyboard.press('Escape')
        assert not page.locator('#system-pane').is_visible()
        for world in ['jin','shu','marassa','chawkee','skarda','plomo','gullinkambi','celosia','five','mun','in','sin','island-mu','yong','pani']:
            page.evaluate('(id)=>location.hash=id',world)
            page.wait_for_function('(id)=>!document.querySelector("#world-pane").hidden&&document.querySelector("#world-pane-title").textContent===YAKE_ATLAS.worlds.find(w=>w.id===id).name',arg=world)
            checks.rendered(page)
            pane = page.locator('#world-pane')
            assert pane.evaluate(INSIDE,'.atlas-scene') and pane.evaluate('e=>e.scrollHeight<=e.clientHeight+1&&e.scrollWidth<=e.clientWidth+1'),('pane',world,width,height,pane.evaluate('e=>e.getBoundingClientRect().toJSON()'))
            # Map actions lead the pane, so a short pane never scrolls them away.
            assert page.locator('#world-pane .world-actions button').evaluate_all(HIT),('actions',world,width,height)
            assert page.locator('#world-pane [data-pane-close]').evaluate('e=>{const r=e.getBoundingClientRect();return r.width>=40&&r.height>=40&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}'),('close',world,width,height)
            assert page.locator('#world-pane .card-intro').evaluate("e=>getComputedStyle(e).textAlign==='left'")
            assert page.locator('#world-pane .card-stats').evaluate('''e=>{const cells=[...e.children].map(c=>c.getBoundingClientRect());return cells.length<2||Math.abs(cells[0].top-cells[1].top)<1&&cells[0].right<=cells[1].left}'''),('two-column facts',world,width,height)
            # The pane never covers the map controls.
            assert page.locator('.map-controls button:visible').evaluate_all(HIT),('controls',world,width,height)
            page.screenshot(path=str(checks.SHOTS/f'yake-card-actions-{world}-{width}x{height}.png'))
            radius_before=page.evaluate('__sceneTest.radius')
            page.locator('#world-pane [data-scene-action=focus]').click()
            checks.rendered(page)
            assert not pane.is_visible()
            page.wait_for_function('!__sceneTest.focusing')
            assert page.evaluate('__sceneTest.radius')<radius_before
            assert page.evaluate('''id=>{const s=__sceneTest,b=s.bodies.find(b=>b.id===id||(b.id==='marassa'&&['buka','chawkee'].includes(id)));return b&&s.target.distanceTo(b.position)<.001}''',world)
            assert page.locator('.scene-label[aria-pressed=true]').count()>0
            assert page.locator('.map-controls button:visible').evaluate_all('''es=>es.every(e=>{const r=e.getBoundingClientRect(),c=document.querySelector('.atlas-scene').getBoundingClientRect();return r.top>=c.top&&r.bottom<=c.bottom&&r.left>=c.left&&r.right<=c.right&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})'''),('control hit targets',world,width,height)
            page.locator('[data-scene-action=home]').click()
            assert not pane.is_visible()
        print(f'PASS {width}x{height}: window fit, typography, system notes, world panes and controls ({"real webfonts" if webfonts else "fallback"})',flush=True)
    browser.close()
