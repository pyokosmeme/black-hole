"""Read-only, multi-resolution interaction audit. Run with Python Playwright.

Uses the same local routing as the regression suite; no production requests.
Prints a JSON report and captures ignored screenshot artifacts.
"""
import importlib.util
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('atlas_checks', Path(__file__).with_name('yake-atlas-browser.py'))
checks = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checks)
SIZES = [(320,568),(390,844),(430,932),(568,320),(640,360),(844,390),(768,1024),(1024,768),(1366,768),(1920,1080),(2560,1440)]
if len(sys.argv)>1:
    SIZES=[tuple(map(int,arg.lower().split('x'))) for arg in sys.argv[1:]]

def bounds(locator):
    return locator.evaluate('''e=>{const r=e.getBoundingClientRect();return {
      top:Math.round(r.top),bottom:Math.round(r.bottom),height:Math.round(r.height),
      inViewport:r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth,
      scrollHeight:e.scrollHeight,clientHeight:e.clientHeight}}''')

def run():
    report=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(args=['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        for width,height in SIZES:
            print(f'Checking {width}x{height}',file=sys.stderr,flush=True)
            page=browser.new_page(viewport={'width':width,'height':height},has_touch=width<=1024)
            errors=[]
            page.on('pageerror',lambda error:errors.append(str(error)))
            page.route('**/*',checks.serve)
            page.add_init_script("localStorage.setItem('acidburn-mode','dark')")
            page.goto('https://atlas.test/yake.html')
            page.wait_for_function('window.__sceneTest && __sceneTest.bodies.length===11')
            page.wait_for_timeout(250)
            row={'viewport':f'{width}x{height}','initialScene':bounds(page.locator('.atlas-scene'))}
            row['horizontalOverflow']=page.evaluate('document.documentElement.scrollWidth>innerWidth')
            assert row['initialScene']['inViewport'],(width,height,row['initialScene'])
            assert page.locator('.atlas-chart').evaluate('e=>{const r=e.getBoundingClientRect();return r.top>=document.querySelector(".header-bar").getBoundingClientRect().bottom+8&&r.bottom<=innerHeight-11&&r.left>=8&&r.right<=innerWidth-8}'),(width,height)
            assert page.evaluate('document.documentElement.scrollHeight<=innerHeight+1'),(width,height)
            page.screenshot(path=str(checks.SHOTS/f'yake-ux-{width}x{height}-overview.png'))
            # Deep-link selection measures visibility without Playwright auto-scrolling.
            before_open=page.evaluate('({scroll:scrollY,top:document.querySelector(".atlas-scene").getBoundingClientRect().top})')
            page.evaluate("location.hash='jin'")
            page.wait_for_selector('#scene-card h1')
            page.wait_for_timeout(200)
            row['cardOnSelection']=bounds(page.locator('#scene-card'))
            row['introVisible']=page.locator('.card-intro').is_visible()
            assert page.evaluate('({scroll:scrollY,top:document.querySelector(".atlas-scene").getBoundingClientRect().top})')==before_open
            row['openingDoesNotShiftMap']=True
            assert page.locator('#scene-card').evaluate("e=>getComputedStyle(e).backgroundColor==='rgba(11, 11, 20, 0.78)'")
            # Continue using real controls, including keyboard activation.
            page.locator('[data-open-view=jin]').click()
            page.wait_for_function("__sceneTest.currentView==='jin'")
            row['moonViewOpened']=True
            page.evaluate("location.hash='marassa'")
            page.wait_for_function("document.querySelector('#scene-card h1')?.textContent==='Horizon’s Edge'")
            page.locator('[data-scene-action=focus]').click()
            page.wait_for_timeout(200)
            row['stationPlacement']=page.evaluate("__sceneTest.bodies.find(b=>b.id==='marassa').mesh.userData.placement")
            page.screenshot(path=str(checks.SHOTS/f'yake-ux-{width}x{height}-horizon.png'))
            assert not page.locator('#scene-card').is_visible()
            page.evaluate("location.hash='marassa'")
            page.wait_for_selector('#scene-card h1')
            page.locator('#scene-card').evaluate('e=>e.scrollTop=e.scrollHeight')
            page.wait_for_timeout(150)
            row['summaryCard']=bounds(page.locator('#scene-card'))
            assert page.locator('#scene-card').evaluate('e=>e.scrollTop===0&&e.scrollHeight<=e.clientHeight+1')
            assert page.locator('#scene-card details').count()==0
            assert page.locator('#scene-card .card-heading [data-scene-action=focus]').count()==1
            row['closeInsideScrolledCard']=page.locator('[data-close-card]').evaluate('''e=>{const r=e.getBoundingClientRect(),c=e.closest('#scene-card').getBoundingClientRect();return r.top>=c.top&&r.bottom<=c.bottom}''')
            camera_before=page.evaluate('JSON.stringify([__sceneTest.camera.position.toArray(),__sceneTest.camera.quaternion.toArray(),__sceneTest.target.toArray(),__sceneTest.radius])')
            page.keyboard.press('Escape')
            checks.rendered(page)
            assert page.evaluate('JSON.stringify([__sceneTest.camera.position.toArray(),__sceneTest.camera.quaternion.toArray(),__sceneTest.target.toArray(),__sceneTest.radius])')==camera_before
            row['closePreservesFocus']=True
            row['escapeClosesCard']=not page.locator('#scene-card').is_visible()
            page.locator('[data-open-view=system]').click()
            page.wait_for_function("__sceneTest.currentView==='system'")
            row['returnedToSystem']=True
            page.locator('[data-scene-action=labels]').click()
            row['labelsToggle']=page.locator('[data-scene-action=labels]').get_attribute('aria-pressed')=='false'
            page.locator('[data-scene-action=labels]').click()
            page.locator('[data-scene-action=expand]').click()
            page.wait_for_timeout(250)
            row['expandedScene']=bounds(page.locator('.atlas-scene'))
            row['expandedControls']=bounds(page.locator('.scene-controls'))
            row['expandedControlsUnobscured']=page.locator('.scene-controls button:visible').evaluate_all('''es=>es.every(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})''')
            assert row['expandedControls']['inViewport'] and row['expandedControlsUnobscured'],(width,height,row['expandedControls'])
            page.screenshot(path=str(checks.SHOTS/f'yake-ux-{width}x{height}-expanded.png'))
            page.keyboard.press('Escape')
            row['escapeCollapses']=page.locator('.is-expanded').count()==0
            # Keyboard selection through a visible nameplate.
            label=page.locator('.scene-label:not([hidden])').first
            label.focus()
            page.keyboard.press('Enter')
            row['keyboardSelection']=page.locator('#scene-card').is_visible()
            row['smallestControl']=page.locator('.scene-controls button:visible').evaluate_all('es=>Math.min(...es.map(e=>Math.min(e.offsetWidth,e.offsetHeight)))')
            row['errors']=errors
            ids=page.evaluate('''()=>{const d=YAKE_ATLAS,ids=new Set();for(const key of ['system','jin','shu','xuan','five']){const v=d.views[key];[v.parent,...v.nodes.map(n=>n[0]),...(v.locals||[]).map(n=>n[0]),...(v.ezLocals||[]).map(n=>n.id)].forEach(id=>ids.add(id));}if(ids.has('marassa'))['buka','chawkee'].forEach(id=>ids.add(id));ids.delete('yake');return [...ids];}''')
            for world in ids:
                page.evaluate('(id)=>location.hash=id',world)
                page.wait_for_function('(id)=>document.querySelector("#scene-card h1")?.textContent===YAKE_ATLAS.worlds.find(w=>w.id===id).name',arg=world)
                checks.rendered(page)
                assert page.evaluate('''id=>{const w=YAKE_ATLAS.worlds.find(w=>w.id===id),c=document.querySelector('#scene-card'),text=c.textContent;return [w.name,w.kind,w.intro,...YAKE_ATLAS.summaryStats(w).flat()].every(s=>text.includes(s))&&!c.querySelector('img,details')&&c.scrollHeight<=c.clientHeight+1&&c.scrollWidth<=c.clientWidth+1;}''',world),(world,width,height)
                assert page.locator('.card-intro').is_visible()
                assert page.locator('#world-actions button').evaluate_all('''es=>es.every(e=>{const r=e.getBoundingClientRect(),c=document.querySelector('#scene-card').getBoundingClientRect();return r.top>=c.top&&r.bottom<=c.bottom&&r.left>=c.left&&r.right<=c.right&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})'''),('actions',world,width,height)
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                assert page.locator('#scene-card').evaluate('''e=>{const c=e.getBoundingClientRect();return getComputedStyle(e).position==='fixed'&&c.top>=0&&c.bottom<=innerHeight-8&&c.left>=0&&c.right<=innerWidth&&Math.abs(c.x+c.width/2-innerWidth/2)<1}'''),(world,width,height)
            # All cards must also fit in expanded mode, including short landscape.
            # Dismiss the centered overlay before changing the underlying map frame.
            page.keyboard.press('Escape')
            page.locator('[data-scene-action=expand]').click()
            for world in ids:
                page.evaluate('(id)=>location.hash=id',world)
                page.wait_for_function('(id)=>document.querySelector("#scene-card h1")?.textContent===YAKE_ATLAS.worlds.find(w=>w.id===id).name',arg=world)
                checks.rendered(page)
                assert page.locator('#scene-card').evaluate('''e=>{const c=e.getBoundingClientRect();return c.top>=0&&c.bottom<=innerHeight-8&&c.left>=0&&c.right<=innerWidth&&e.scrollHeight<=e.clientHeight+1}'''),('expanded',world,width,height)
                assert page.locator('#world-actions button').evaluate_all('''es=>es.every(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})'''),('expanded actions',world,width,height)
            page.keyboard.press('Escape')
            page.keyboard.press('Escape')
            row['completeCardsVerified']=len(ids)
            page.evaluate("location.hash='view=jin'")
            page.wait_for_function("__sceneTest.currentView==='jin'")
            page.wait_for_timeout(250)
            page.screenshot(path=str(checks.SHOTS/'yake-ux-jin-ez-overview.png'))
            report.append(row)
            page.close()
        browser.close()
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=='__main__':
    run()
