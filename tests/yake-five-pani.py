"""Five Islands hierarchy and Pani atmosphere, using the actual rendered scene."""
import importlib.util
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('checks',Path(__file__).with_name('yake-atlas-browser.py'))
checks=importlib.util.module_from_spec(spec);spec.loader.exec_module(checks)
with sync_playwright() as p:
    browser=p.chromium.launch(args=['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    for width,height in [(1100,950),(390,844),(320,568),(568,320)]:
        page=browser.new_page(viewport={'width':width,'height':height})
        errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
        page.route('**/*',checks.serve)
        page.goto('https://atlas.test/yake.html#five')
        page.wait_for_function('window.__sceneAPI && window.__sceneTest')
        assert page.evaluate("__sceneTest.bodies.find(b=>b.id==='five').mesh.children.length===5")
        page.get_by_role('button',name='EXPLORE ISLANDS').click()
        page.wait_for_function("__sceneTest.currentView==='five'")
        checks.rendered(page)
        assert page.evaluate('''()=>{
          const s=__sceneTest,pos=id=>s.bodies.find(b=>b.id===id).position;
          return pos('mun').length()===0&&YAKE_ATLAS.views.five.hierarchy.pairs.every(pair=>{
            const a=pos(pair.members[0]),b=pos(pair.members[1]),center=a.clone().add(b).multiplyScalar(.5);
            return Math.abs(center.x-pair.center[0])<.001&&Math.abs(center.z-pair.center[1])<.001&&a.distanceTo(b)<center.length();
          })&&s.tracks.filter(t=>t.line.name==='tight-binary-orbit').length===2&&s.tracks.filter(t=>t.line.name==='binary-barycenter-orbit').length===2;
        }''')
        page.screenshot(path=str(checks.SHOTS/f'yake-quintuple-{width}.png'))
        page.evaluate("location.hash='sin'");page.wait_for_selector('#scene-card h1')
        checks.rendered(page)
        assert page.evaluate("__sceneTest.tracks.filter(t=>t.line.userData.members?.includes('sin')).every(t=>t.line.material.opacity===.9)")
        page.locator('#atlas-system-back').click()
        page.evaluate("location.hash='pani'")
        page.wait_for_function("__sceneTest.currentView==='shu' && document.querySelector('#scene-card h1')?.textContent==='Pani'")
        assert '95 kPa' in page.locator('#scene-card').inner_text()
        page.locator('[data-scene-action=focus]').click()
        assert not page.locator('#scene-card').is_visible()
        checks.rendered(page)
        assert page.evaluate('''()=>{const m=__sceneTest.bodies.find(b=>b.id==='pani').mesh;return m.getObjectByName('pani-atmosphere').material.type==='ShaderMaterial'&&m.getObjectByName('pani-clouds').material.map.image.width===512&&m.material.specularMap!=null}''')
        page.screenshot(path=str(checks.SHOTS/f'yake-pani-atmosphere-{width}.png'))
        assert not errors,errors
        print(f'PASS {width}x{height}: central Mun, two tight binaries, member selection, Pani atmosphere and clouds',flush=True)
        page.close()
    browser.close()
