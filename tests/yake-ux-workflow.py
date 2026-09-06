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
SIZES = [(320,568),(390,844),(430,932),(844,390),(768,1024),(1024,768),(1366,768),(1920,1080),(2560,1440)]

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
            page.screenshot(path=str(checks.SHOTS/f'yake-ux-{width}x{height}-overview.png'))
            # Deep-link selection measures visibility without Playwright auto-scrolling.
            page.evaluate("location.hash='jin'")
            page.wait_for_selector('#scene-card h1')
            page.wait_for_timeout(200)
            row['cardOnSelection']=bounds(page.locator('#scene-card'))
            row['introVisible']=page.locator('.card-intro').is_visible()
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
            page.locator('.card-record summary').click()
            page.locator('#scene-card').evaluate('e=>e.scrollTop=e.scrollHeight')
            page.wait_for_timeout(150)
            row['longCard']=bounds(page.locator('#scene-card'))
            row['closeInsideScrolledCard']=page.locator('[data-close-card]').evaluate('''e=>{const r=e.getBoundingClientRect(),c=e.closest('#scene-card').getBoundingClientRect();return r.top>=c.top&&r.bottom<=c.bottom}''')
            page.keyboard.press('Escape')
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
            row['expandedControlsUnobscured']=page.locator('.scene-controls button').evaluate_all('''es=>es.every(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})''')
            page.screenshot(path=str(checks.SHOTS/f'yake-ux-{width}x{height}-expanded.png'))
            page.keyboard.press('Escape')
            row['escapeCollapses']=page.locator('.is-expanded').count()==0
            # Keyboard selection through a visible nameplate.
            label=page.locator('.scene-label:not([hidden])').first
            label.focus()
            page.keyboard.press('Enter')
            row['keyboardSelection']=page.locator('#scene-card').is_visible()
            row['smallestControl']=page.locator('.scene-controls button').evaluate_all('es=>Math.min(...es.map(e=>Math.min(e.offsetWidth,e.offsetHeight)))')
            row['errors']=errors
            if width==1920:
                ids=page.evaluate('''()=>{const d=YAKE_ATLAS,ids=new Set();for(const key of ['system','jin','shu','xuan']){const v=d.views[key];[v.parent,...v.nodes.map(n=>n[0]),...(v.locals||[]).map(n=>n[0]),...(v.ezLocals||[]).map(n=>n.id)].forEach(id=>ids.add(id));}if(ids.has('marassa'))['buka','chawkee'].forEach(id=>ids.add(id));return [...ids];}''')
                for world in ids:
                    page.evaluate('(id)=>location.hash=id',world)
                    page.wait_for_function('(id)=>document.querySelector("#scene-card h1")?.textContent===YAKE_ATLAS.worlds.find(w=>w.id===id).name',arg=world)
                    assert page.evaluate('''id=>{const w=YAKE_ATLAS.worlds.find(w=>w.id===id),c=document.querySelector('#scene-card'),text=c.textContent;return [w.name,w.kind,w.intro,...(w.stats||[]).flat(),...(w.paragraphs||[]),...(w.places||[]).flat(),...(w.notes||[])].every(s=>text.includes(s))&&!c.querySelector('img');}''',world),world
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
