"""Ya Ke browser regression checks. Requires Python Playwright + Chromium.

Run: python tests/yake-atlas-browser.py
Static assets are fulfilled locally; no server or production writes required.
Screenshots are review artifacts, not deployed assets.
"""
from pathlib import Path
from urllib.parse import urlparse, unquote
import mimetypes
import json
import re
import sys
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SHOTS = ROOT / 'attached_files'


def serve(route):
    url = urlparse(route.request.url)
    if url.hostname != 'atlas.test':
        route.abort()
        return
    path = (ROOT / unquote(url.path).lstrip('/')).resolve()
    if not path.is_relative_to(ROOT) or not path.is_file():
        route.fulfill(status=404, body='Not found')
        return
    body = path.read_bytes()
    if path.name == 'yake-3d.js':
        body = body.replace(b'renderer.render(scene,camera);', b'window.__sceneTest={scene,camera,bodies,tracks,currentView,radius,target,renderer};renderer.render(scene,camera);')
        body = body.replace(b'return {\n      setView', b'return window.__sceneAPI = {\n      setView').replace(b'return {\r\n      setView', b'return window.__sceneAPI = {\r\n      setView')
    if path.name == 'acidburn-blackhole.js':
        body = body.replace(b'renderer.render(scene, camera);', b'renderer.render(scene, camera); window.__bhFrames=(window.__bhFrames||0)+1; window.__bhRenderer=renderer;')
    route.fulfill(body=body, content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')


def rendered(page):
    page.evaluate('() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))')


def run():
    config = json.loads((ROOT / 'maps/config.json').read_text(encoding='utf-8'))
    atlas = next(link for link in config['links'] if link['id'] == 'yake')
    assert atlas['label'] == 'Ya Ke System Atlas'
    assert atlas['desc'] == 'Explore Celosia, the inhabited moons of its gas giants, and the outer habitats.'
    menu = json.loads((ROOT / 'pagelayout.json').read_text(encoding='utf-8'))
    assert any(child['url'] == '/yake.html' for item in menu['pages'] if item['label'] == 'MAPS' for child in item['children'])
    for filename in ['yake.html','js/yake-map.js','js/yake-3d.js','js/yake-data.js','maps/config.json','pagelayout.json','css/yake-map.css']:
        source = (ROOT / filename).read_text(encoding='utf-8')
        assert not re.search('�|Ã|Â|â€|EXU Transmit|back to interstellar transit', source, re.I), filename
    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        for width in ([int(arg) for arg in sys.argv[1:]] or [1100, 390, 320]):
            page = browser.new_page(viewport={'width': width, 'height': 950}, has_touch=width < 600)
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.route('**/*', serve)
            page.add_init_script("localStorage.setItem('acidburn-mode','dark')")
            page.goto('https://atlas.test/yake.html')
            page.wait_for_function('window.__sceneTest && __sceneTest.bodies.length===11')
            assert page.evaluate('__sceneTest.renderer.getContextAttributes().alpha && __sceneTest.renderer.getClearAlpha()===0')
            page.wait_for_selector('#nav-menu a[href="/yake.html"]', state='attached')
            assert page.locator('main > section').count() == 1
            assert page.locator('[data-view],[data-presentation],#world-detail,#destination-list,.atlas-breadcrumb,.footer').count() == 0
            assert page.locator('.atlas-shell button:not(.acidburn-button):not(.scene-label)').count() == 0
            assert page.locator('#blackhole-container canvas').count() == 0
            # Existing shared component styles own the page chrome.
            assert page.evaluate("""async () => {
                const sheet=[...document.styleSheets].find(s=>s.href?.endsWith('/css/acidburn.css'));
                const start=sheet.cssRules.length;
                sheet.insertRule('.section-header h2 {color:rgb(12,34,56)}',sheet.cssRules.length);
                await new Promise(resolve=>setTimeout(resolve,150));
                const result=getComputedStyle(document.querySelector('#chart-title')).color==='rgb(12, 34, 56)';
                while(sheet.cssRules.length>start)sheet.deleteRule(start);
                return result;
            }""")
            page.evaluate("AcidburnMode.setMode('light')")
            page.wait_for_function("getComputedStyle(document.querySelector('.atlas-chart')).backgroundColor==='rgb(253, 250, 245)'")
            page.evaluate("AcidburnMode.setMode('dark')")
            page.wait_for_function("getComputedStyle(document.querySelector('.atlas-chart')).backgroundColor==='rgb(18, 18, 26)'")
            for world in ['jin', 'shu', 'celosia', 'gullinkambi', 'five']:
                label = page.locator(f'[data-pick={world}]')
                if not label.is_visible():
                    # Collision suppression hides some labels at phone scale;
                    # a bookmarked selection brings that label to the front.
                    page.evaluate('(id)=>location.hash=id', world)
                    page.wait_for_function('(id)=>document.querySelector(`[data-pick="${id}"]`)?.hidden===false', arg=world)
                label.focus()
                page.keyboard.press('Enter')
                rendered(page)
                assert page.locator('#scene-card h1').text_content() == page.evaluate(f"YAKE_ATLAS.worlds.find(w=>w.id==='{world}').name")
                style = label.evaluate('(e)=>{const s=getComputedStyle(e);return [s.borderLeftWidth,s.outlineStyle,s.backgroundColor]}')
                assert style == ['0px', 'none', 'rgba(11, 11, 20, 0.72)'], style
                assert page.locator('[data-open-view],[data-show-detail]').count() == 0
                assert page.evaluate('__sceneTest.currentView') == 'system'
                if world == 'celosia':
                    page.locator('.card-record summary').click()
                    assert page.locator('.card-record').get_attribute('open') is not None
                    for region in ['fusang','mu','diyu']:
                        page.locator(f'[data-scene-action=surface-{region}]').click()
                        rendered(page)
                    page.locator('[data-scene-action=home]').click()
                    rendered(page)
                page.locator('[data-close-card]').click()
            canvas = page.locator('.scene-canvas')
            canvas.scroll_into_view_if_needed()
            rendered(page)
            box = canvas.bounding_box()
            x, y = box['x']+box['width']*.45, box['y']+box['height']*.4
            before = page.evaluate('__sceneTest.camera.position.toArray()')
            page.mouse.move(x,y)
            page.mouse.down()
            page.mouse.move(x+40,y+30,steps=5)
            page.mouse.up()
            rendered(page)
            assert page.evaluate('__sceneTest.camera.position.toArray()') != before
            assert not page.locator('#scene-card').is_visible()
            if width < 600:
                canvas.scroll_into_view_if_needed()
                rendered(page)
                box = canvas.bounding_box()
                x, y = box['x']+box['width']*.45, box['y']+box['height']*.4
                old_radius = page.evaluate('__sceneTest.radius')
                cdp = page.context.new_cdp_session(page)
                cdp.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':1},{'x':x+50,'y':y,'id':2}]})
                cdp.send('Input.dispatchTouchEvent', {'type':'touchMove','touchPoints':[{'x':x-15,'y':y,'id':1},{'x':x+70,'y':y,'id':2}]})
                cdp.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
                rendered(page)
                assert page.evaluate('__sceneTest.radius') < old_radius
            page.locator('[data-scene-action=home]').click()
            rendered(page)
            # Pick the actual sphere, not only its HTML label.
            pos = page.evaluate("""() => {const s=__sceneTest,p=s.bodies.find(b=>b.id==='celosia').position.clone().project(s.camera),r=document.querySelector('canvas.scene-canvas').getBoundingClientRect();return [r.x+(p.x*.5+.5)*r.width,r.y+(-p.y*.5+.5)*r.height]}""")
            page.mouse.click(*pos)
            assert page.locator('#scene-card h1').text_content() == 'Celosia'
            page.screenshot(path=str(SHOTS / f'yake-overview-card-{width}.png'))
            page.locator('#atlas-reset').click()
            assert not page.locator('#scene-card').is_visible()
            page.locator('[data-scene-action=expand]').click()
            page.wait_for_function("!!document.elementFromPoint(innerWidth/2,20)?.closest('.atlas-chart')")
            page.keyboard.press('Escape')
            assert page.locator('.is-expanded').count() == 0
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), width
            assert not errors, errors
            page.wait_for_timeout(200)
            rendered(page)
            page.screenshot(path=str(SHOTS / f'yake-overview-{width}.png'))
            print(f'PASS {width}px: overview only, shared CSS, cards, translucent labels, orbit/pinch, geometry picks, expand, overflow', flush=True)
            page.close()

        # Exercise the retained moon engine independently; the production page
        # stays overview-only until local drill-down navigation is requested.
        page = browser.new_page(viewport={'width':1100,'height':950})
        page.route('**/*', serve)
        page.add_init_script("localStorage.setItem('acidburn-mode','dark')")
        page.goto('https://atlas.test/yake.html')
        page.wait_for_function('window.__sceneAPI && window.__sceneTest')
        page.evaluate("__sceneAPI.setView('jin','marassa')")
        rendered(page)
        assert page.evaluate('''() => {
            const s=__sceneTest, m=s.bodies.find(b=>b.id==='marassa').mesh;
            const wheels=m.children.filter(c=>c.name==='rotating-wheel');
            const spine=m.children.find(c=>c.name==='stationary-axial-spine');
            const axis=new THREE.Vector3(0,1,0).applyQuaternion(spine.quaternion);
            return wheels.length===2 && wheels.every(w=>Math.abs(new THREE.Vector3(0,0,1).applyQuaternion(w.quaternion).dot(axis))>.9999 && w.children.some(c=>c.name==='hub-bearing')) && wheels[0].userData.spinDirection===-wheels[1].userData.spinDirection;
        }''')
        assert page.evaluate('''() => {
            const s=__sceneTest, p=s.bodies.find(b=>b.id==='marassa').position;
            const r=300+180000/(2836675-1413613)*90;
            const ez=145+(1171000-1052112)/(1413613-1052112)*65;
            return Math.abs(p.length()-r)<1e-7 && Math.abs(Math.atan2(p.z,p.x)*180/Math.PI+125)<1e-7 && s.tracks.filter(t=>t.ez).length===1 && Math.abs(s.tracks.find(t=>t.ez).line.geometry.vertices[0].length()-ez)<1e-7;
        }''')
        page.screenshot(path=str(SHOTS / 'yake-corrected-jin-placement.png'))
        page.evaluate('__sceneAPI.focus()')
        rendered(page)
        page.screenshot(path=str(SHOTS / 'yake-corrected-horizons-edge.png'))
        page.evaluate("__sceneAPI.setView('system','celosia')")
        rendered(page)
        for world in ['celosia','gullinkambi']:
            assert page.evaluate('''id => {
                const m=__sceneTest.bodies.find(b=>b.id===id).mesh.material;
                return m.map.image.width===1024 && !!m.bumpMap && !!m.specularMap;
            }''', world)
            page.evaluate('(id)=>{__sceneAPI.select(id);__sceneAPI.focus()}', world)
            rendered(page)
            if world=='celosia':
                for region in ['fusang','mu','diyu']:
                    page.evaluate('(region)=>__sceneAPI.surface(region)', region)
                    rendered(page)
                    page.screenshot(path=str(SHOTS / f'yake-coast-{region}.png'))
            else:
                page.screenshot(path=str(SHOTS / 'yake-golden-comb-detail.png'))
        print('PASS coaxial toruses, hub bearings, L5 placement, Jin EZ, surface maps, link copy, menu and typo scan', flush=True)
        page.close()

        # Real shared shader renderer: delayed BH entry, pause/resume, no duplicate
        # canvases, and initial saved-BH load alongside the independent map renderer.
        page = browser.new_page(viewport={'width':1100,'height':800})
        page.set_default_timeout(60000)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.route('**/*', serve)
        page.add_init_script("if(!localStorage.getItem('acidburn-mode'))localStorage.setItem('acidburn-mode','dark')")
        page.goto('https://atlas.test/yake.html')
        for attempt in range(2):
            page.evaluate("AcidburnMode.setMode('bh')")
            page.wait_for_function('window.__bhFrames > 0 && AcidburnBlackhole.isReady')
            assert page.locator('#blackhole-container canvas').count() == 1
            assert page.locator('.scene-canvas').count() == 1
            page.wait_for_function("getComputedStyle(document.querySelector('.atlas-chart')).backgroundColor==='rgba(5, 5, 15, 0.72)'")
            assert page.evaluate('__bhRenderer.info.programs.every(p=>!p.diagnostics || p.diagnostics.runnable)')
            if attempt == 0:
                page.screenshot(path=str(SHOTS / 'yake-overview-blackhole.png'))
            page.evaluate("AcidburnMode.setMode('dark')")
            count = page.evaluate('__bhFrames')
            page.wait_for_timeout(250)
            assert page.evaluate('__bhFrames') == count
        page.evaluate("localStorage.setItem('acidburn-mode','bh')")
        page.reload()
        page.wait_for_function('window.__bhFrames > 0 && AcidburnBlackhole.isReady')
        assert page.locator('#blackhole-container canvas').count() == 1
        assert not errors, errors
        print('PASS shared black-hole shader: initial BH, delayed BH, pause/resume, one background + one map canvas', flush=True)
        page.close()

        page = browser.new_page()
        page.route('**/*', serve)
        page.add_init_script("const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return /webgl/i.test(kind)?null:original.call(this,kind,...args)}")
        page.goto('https://atlas.test/yake.html')
        assert page.locator('#orbital-field svg').count() == 1
        page.locator('[data-world=celosia]').focus()
        page.keyboard.press('Enter')
        assert page.locator('#scene-card h1').text_content() == 'Celosia'
        assert page.locator('#scene-card').is_visible()
        assert page.locator('main > section').count() == 1
        print('PASS WebGL-unavailable system chart and world-card fallback', flush=True)
        browser.close()


if __name__ == '__main__':
    run()
