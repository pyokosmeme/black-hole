"""Focus dismisses the card, animates continuously, and yields to manual controls."""
import importlib.util
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('checks',Path(__file__).with_name('yake-atlas-browser.py'))
checks=importlib.util.module_from_spec(spec);spec.loader.exec_module(checks)

with sync_playwright() as p:
    browser=p.chromium.launch(args=['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    for width,height in [(1366,768),(390,844),(568,320)]:
        page=browser.new_page(viewport={'width':width,'height':height},reduced_motion='no-preference')
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.route('**/*',checks.serve)
        page.goto('https://atlas.test/yake.html#jin')
        page.wait_for_function('window.__sceneTest && window.__sceneAPI')
        checks.rendered(page)
        def start(world):
            page.evaluate('(id)=>location.hash=id',world)
            page.wait_for_selector('[data-scene-action=focus]')
            checks.rendered(page)
            # Sample immediately in the same event task, before any animation frame.
            result=page.evaluate('''()=>{const s=__sceneTest,before=[...s.camera.position.toArray(),s.radius];document.querySelector('[data-scene-action=focus]').click();return {closed:document.querySelector('#scene-card').hidden,unchanged:JSON.stringify(before)===JSON.stringify([...s.camera.position.toArray(),s.radius])}}''')
            assert result=={'closed':True,'unchanged':True},result
            page.wait_for_function('__sceneTest.focusing')
        for world in ['jin','gullinkambi','marassa','mun','pani']:
            start(world)
            page.wait_for_timeout(200)
            assert page.evaluate('__sceneTest.focusing')
            mid=page.evaluate('__sceneTest.camera.position.toArray()')
            page.wait_for_function('!__sceneTest.focusing')
            assert page.evaluate('__sceneTest.camera.position.toArray()')!=mid
            assert page.evaluate('''id=>{const s=__sceneTest,b=s.bodies.find(b=>b.id===id);return s.target.distanceTo(b.position)<.001&&Math.abs(s.radius-Math.max(b.size*(s.renderer.domElement.clientWidth<600?11:9),75))<.001}''',world)
            pose=page.evaluate('JSON.stringify([__sceneTest.camera.position.toArray(),__sceneTest.radius])')
            page.wait_for_timeout(100)
            assert page.evaluate('JSON.stringify([__sceneTest.camera.position.toArray(),__sceneTest.radius])')==pose
            page.locator('#atlas-reset').click()
        for action in ['wheel','drag','keyboard','reset','view']:
            start('jin')
            page.wait_for_timeout(150)
            canvas=page.locator('.scene-canvas');box=canvas.bounding_box()
            if action=='wheel':
                page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2)
                page.mouse.wheel(0,80)
            elif action=='drag':
                page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2)
                page.mouse.down();page.mouse.move(box['x']+box['width']/2+35,box['y']+box['height']/2+15);page.mouse.up()
            elif action=='keyboard':
                canvas.focus();page.keyboard.press('ArrowRight')
            elif action=='reset':page.locator('#atlas-reset').click()
            else:page.evaluate("location.hash='view=shu'")
            checks.rendered(page)
            assert not page.evaluate('__sceneTest.focusing')
            pose=page.evaluate('JSON.stringify([__sceneTest.camera.position.toArray(),__sceneTest.radius])')
            page.wait_for_timeout(1100)
            assert page.evaluate('JSON.stringify([__sceneTest.camera.position.toArray(),__sceneTest.radius])')==pose,action
        page.emulate_media(reduced_motion='reduce')
        page.evaluate("location.hash='pani'")
        page.wait_for_selector('[data-scene-action=focus]')
        page.locator('[data-scene-action=focus]').click();checks.rendered(page)
        assert not page.locator('#scene-card').is_visible()
        assert not page.evaluate('__sceneTest.focusing')
        assert page.evaluate("__sceneTest.target.distanceTo(__sceneTest.bodies.find(b=>b.id==='pani').position)<.001")
        assert not errors,errors
        print(f'PASS {width}x{height}: close-before-motion, intermediate frames, endpoints, cancellation, reduced motion',flush=True)
        page.close()
    browser.close()
