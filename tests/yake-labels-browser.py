"""Check labels against boxes, sphere hit targets and leaders while orbiting."""
import importlib.util
import subprocess
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('atlas',ROOT/'tests/yake-atlas-browser.py')
atlas=importlib.util.module_from_spec(spec);spec.loader.exec_module(atlas)
fonts={}
def serve(route):
    host=urlparse(route.request.url).hostname
    if host in ['fonts.googleapis.com','fonts.gstatic.com']:
        if route.request.url not in fonts:
            fonts[route.request.url]=subprocess.check_output(['curl.exe','-k','-sS','--fail',route.request.url])
        route.fulfill(body=fonts[route.request.url],content_type='text/css' if host=='fonts.googleapis.com' else 'font/ttf')
    else:atlas.serve(route)

def check(page):
    result=page.evaluate('''()=>{
      const host=document.querySelector('.atlas-scene').getBoundingClientRect();
      const rect=e=>{const b=e.getBoundingClientRect();return {x:b.x-host.x,y:b.y-host.y,w:b.width,h:b.height}};
      const boxes=[...document.querySelectorAll('.scene-label:not([hidden])')].map(rect);
      const lines=[...document.querySelectorAll('.scene-leaders line')].map(e=>({id:e.dataset.world,a:{x:+e.getAttribute('x1'),y:+e.getAttribute('y1')},b:{x:+e.getAttribute('x2'),y:+e.getAttribute('y2')}}));
      const s=__sceneTest;
      const markers=s.bodies.map(b=>{const p=b.position.clone().project(s.camera);return {id:b.id,x:(p.x*.5+.5)*host.width,y:(-p.y*.5+.5)*host.height,z:p.z,r:Math.max(5,b.size*host.height/(2*Math.tan(s.camera.fov*Math.PI/360)*s.camera.position.distanceTo(b.position)))}}).filter(p=>p.z>-1&&p.z<1);
      return {count:boxes.length,bounds:boxes.every(b=>b.x>=-1&&b.y>=-1&&b.x+b.w<=host.width+1&&b.y+b.h<=host.height+1),overlap:boxes.some((b,i)=>boxes.slice(i+1).some(c=>SceneLabelLayout.overlap(b,c,0))),crossed:lines.some((l,i)=>lines.slice(i+1).some(m=>SceneLabelLayout.intersects(l.a,l.b,m.a,m.b))),blocksSphere:boxes.some(b=>markers.some(p=>Math.hypot(Math.max(b.x-p.x,0,p.x-b.x-b.w),Math.max(b.y-p.y,0,p.y-b.y-b.h))<p.r)),longLeader:lines.some(l=>Math.hypot(l.a.x-l.b.x,l.a.y-l.b.y)>70.01)};
    }''')
    assert result['bounds'] and not any(result[k] for k in ['overlap','crossed','blocksSphere','longLeader']),result
    return result['count']

with sync_playwright() as p:
    browser=p.chromium.launch(args=['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(ignore_https_errors=True)
    page.route('**/*',serve)
    page.add_init_script("localStorage.setItem('acidburn-mode','dark')")
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('https://atlas.test/yake.html')
    page.wait_for_function('window.__sceneAPI')
    page.evaluate('document.fonts.ready')
    assert page.locator('.scene-leaders').evaluate("e=>getComputedStyle(e).backgroundColor==='rgba(0, 0, 0, 0)'")
    for w,h in [(1366,768),(320,568),(390,844),(568,320),(768,1024),(1920,1080)]:
        page.set_viewport_size({'width':w,'height':h})
        page.locator('#system-summary').evaluate('e=>e.open=innerHeight>600')
        for view in ['system','jin','shu','xuan','outer','five']:
            page.evaluate('(view)=>__sceneAPI.setView(view)',view)
            atlas.rendered(page)
            for _ in range(10):
                page.locator('.scene-canvas').focus();page.keyboard.press('ArrowRight');atlas.rendered(page);check(page)
            page.locator('[data-window-expand]').click();atlas.rendered(page);check(page)
            page.locator('[data-window-expand]').click();atlas.rendered(page)
        page.evaluate("__sceneAPI.setView('system')");atlas.rendered(page)
        # The compact landscape overview may omit names; expanding gives them room.
        if h>450:assert check(page)>0,(w,h)
        page.screenshot(path=str(ROOT/'attached_files'/f'yake-labels-{w}x{h}.png'))
    assert not errors,errors
    browser.close()
print('PASS: Ya Ke label bounds, sphere access and short uncrossed leaders in six viewports and all six views.')
