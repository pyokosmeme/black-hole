"""Ya Ke browser regression checks. Requires Python Playwright + Chromium.

Run: python tests/yake-atlas-browser.py
Static assets are fulfilled locally; no server or production writes required.
Screenshots are review artifacts, not deployed assets.
"""
from pathlib import Path
from urllib.parse import urlparse, unquote
import mimetypes
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
        body = body.replace(b'renderer.render(scene,camera);', b'window.__sceneTest={scene,camera,bodies,tracks,currentView,radius,target};renderer.render(scene,camera);')
    route.fulfill(body=body, content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')


def rendered(page):
    page.evaluate('() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))')


def run():
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
            assert page.locator('main.main-content').count() == 1
            assert page.locator('.author-header .author-info h1').count() == 1
            assert page.locator('#destination-list .link-card').count() > 20
            assert page.locator('.atlas-shell button:not(.acidburn-button):not(.scene-label)').count() == 0
            # Prove the shared stylesheet owns the chrome: a change to its
            # existing component rules must propagate without atlas overrides.
            assert page.evaluate("""async () => {
                const sheet=[...document.styleSheets].find(s=>s.href?.endsWith('/css/acidburn.css'));
                const start=sheet.cssRules.length;
                sheet.insertRule('.author-info h1 {color:rgb(12,34,56)}',sheet.cssRules.length);
                sheet.insertRule('.main-content {padding-top:77px}',sheet.cssRules.length);
                await new Promise(resolve=>setTimeout(resolve,150));
                const result=getComputedStyle(document.querySelector('#atlas-title')).color==='rgb(12, 34, 56)' && getComputedStyle(document.querySelector('main')).paddingTop==='77px';
                while(sheet.cssRules.length>start)sheet.deleteRule(start);
                return result;
            }""")
            page.evaluate("AcidburnMode.setMode('light')")
            page.wait_for_function("getComputedStyle(document.querySelector('.author-card')).backgroundColor==='rgb(253, 250, 245)'")
            page.evaluate("AcidburnMode.setMode('dark')")
            page.wait_for_function("getComputedStyle(document.querySelector('.author-card')).backgroundColor==='rgb(18, 18, 26)'")
            if width in [1100,390]:
                page.screenshot(path=str(SHOTS / f'yake-shared-css-{width}.png'))
            assert page.locator('[data-view=habitats]').count() == 0
            assert page.locator('.atlas-source-notes').count() == 0
            assert page.locator('[data-directory][data-world=dto]').count() == 0
            for view, count in [('jin', 10), ('shu', 5), ('xuan', 2), ('outer', 6), ('five', 5)]:
                page.locator(f'[data-view={view}]').click()
                rendered(page)
                assert page.evaluate('__sceneTest.bodies.length') == count, (width, view)
                assert page.locator('canvas.scene-canvas').count() == 1
                if view == 'five':
                    assert page.evaluate('__sceneTest.tracks.length') == 0
                    assert not page.locator('#scene-card').is_visible()
                    assert set(page.evaluate('__sceneTest.bodies.map(b=>b.id)')) == {'mun', 'in', 'sin', 'island-mu', 'yong'}
                    page.locator('.atlas-chart').screenshot(path=str(SHOTS / f'yake-review-{width}-five.png'))
                if view == 'xuan':
                    assert page.evaluate('__sceneTest.tracks.every(t=>t.line.geometry.vertices.every(v=>Number.isFinite(v.x)))')
                if view == 'jin':
                    assert set(page.evaluate('__sceneTest.bodies.map(b=>b.id)')) >= {'plomo', 'peng', 'suseong', 'marassa'}
                    assert page.evaluate("__sceneTest.bodies.find(b=>b.id==='marassa').mesh.children.filter(c=>c.type==='Group').length") == 2
            for world in ['plomo', 'suseong', 'peng', 'kaau', 'marassa', 'buka', 'chawkee', 'mun', 'island-mu', 'celosia', 'jin', 'shu']:
                page.locator(f'[data-directory][data-world={world}]').click()
                rendered(page)
                assert page.locator('#scene-card').is_visible()
                assert page.locator('[data-scene-action=focus]').count() == 1, (width, world)
                assert page.locator('#scene-card h1').text_content() == page.evaluate(f"YAKE_ATLAS.worlds.find(w=>w.id==='{world}').name")
                page.locator('[data-scene-action=focus]').click()
                rendered(page)
                if world in ['celosia', 'jin', 'shu', 'marassa'] and width in [1100, 390]:
                    page.locator('.atlas-chart').screenshot(path=str(SHOTS / f'yake-review-{width}-{world}.png'))
                if world == 'celosia':
                    for region in ['fusang', 'mu', 'diyu']:
                        page.locator(f'[data-scene-action=surface-{region}]').click()
                        rendered(page)
                        assert page.locator('#scene-card h1').text_content() == 'Celosia'
            # Opaque borderless nameplates preserve non-box keyboard focus.
            page.locator('[data-view=jin]').click()
            label = page.locator('[data-pick=plomo]')
            label.focus()
            page.keyboard.press('Enter')
            rendered(page)
            style = label.evaluate('(e)=>{const s=getComputedStyle(e);return [s.borderLeftWidth,s.outlineStyle,s.backgroundColor,s.textDecorationLine]}')
            assert style == ['0px', 'none', 'rgb(11, 11, 20)', 'underline'], style
            page.locator('[data-close-card]').click()
            canvas = page.locator('.scene-canvas')
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
                # Keyboard focus and Playwright's click scrolling can change the
                # viewport; CDP touch points require fresh viewport coordinates.
                canvas.scroll_into_view_if_needed()
                rendered(page)
                box = canvas.bounding_box()
                x, y = box['x']+box['width']*.45, box['y']+box['height']*.4
                assert page.evaluate(f"!!document.elementFromPoint({x},{y})?.closest('.atlas-scene')")
                old_radius = page.evaluate('__sceneTest.radius')
                cdp = page.context.new_cdp_session(page)
                cdp.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':x,'y':y,'id':1},{'x':x+50,'y':y,'id':2}]})
                cdp.send('Input.dispatchTouchEvent', {'type':'touchMove','touchPoints':[{'x':x-15,'y':y,'id':1},{'x':x+70,'y':y,'id':2}]})
                cdp.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
                rendered(page)
                new_radius = page.evaluate('__sceneTest.radius')
                if new_radius >= old_radius:
                    page.screenshot(path=str(SHOTS / f'yake-pinch-failure-{width}.png'))
                assert new_radius < old_radius, (width, old_radius, new_radius, box, x, y, page.evaluate(f'document.elementFromPoint({x},{y})?.outerHTML'))
                page.locator('[data-scene-action=home]').click()
                rendered(page)
            # Raycast actual geometry (including the bridge in the compound habitat).
            for world in ['marassa', 'plomo']:
                pos = page.evaluate(f"""() => {{const s=__sceneTest,p=s.bodies.find(b=>b.id==='{world}').position.clone().project(s.camera),r=document.querySelector('canvas.scene-canvas').getBoundingClientRect();return [r.x+(p.x*.5+.5)*r.width,r.y+(-p.y*.5+.5)*r.height]}}""")
                page.mouse.click(*pos)
                assert page.locator('#scene-card').is_visible(), (width, world, 'raycast')
                assert page.locator('#scene-card h1').text_content() == page.evaluate(f"YAKE_ATLAS.worlds.find(w=>w.id==='{world}').name")
                page.locator('[data-close-card]').click()
            # Both schematic and WebGL show the new worlds; rebuilding cleans up.
            page.locator('[data-scene-action=expand]').click()
            page.wait_for_function("!!document.elementFromPoint(innerWidth/2,20)?.closest('.atlas-chart')")
            page.locator('[data-presentation="2d"]').click()
            assert page.locator('.is-expanded').count() == 0
            page.locator('[data-presentation="3d"]').click()
            for view in ['jin', 'xuan', 'five']:
                page.locator(f'[data-view={view}]').click()
                page.locator('[data-presentation="2d"]').click()
                assert page.locator('#orbital-field svg').count() == 1
                assert page.locator('.scene-canvas').count() == 0
                if view == 'jin':
                    for world in ['plomo','suseong','peng','marassa']:
                        assert page.locator(f'#orbital-field [data-world={world}]').count() == 1
                page.locator('[data-presentation="3d"]').click()
                rendered(page)
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), width
            assert not errors, errors
            print(f'PASS {width}px: six regions, cards, labels, focus, drag, geometry picks, schematic, overflow', flush=True)
            page.close()
        page = browser.new_page()
        page.route('**/*', serve)
        page.add_init_script("const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){return /webgl/i.test(kind)?null:original.call(this,kind,...args)}")
        page.goto('https://atlas.test/yake.html')
        assert page.locator('#orbital-field svg').count() == 1
        assert page.locator('#world-detail').is_visible()
        print('PASS WebGL-unavailable schematic fallback', flush=True)
        browser.close()


if __name__ == '__main__':
    run()
