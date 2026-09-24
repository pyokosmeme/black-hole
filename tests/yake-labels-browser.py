"""Check labels against boxes, overlays, sphere hit targets and leaders while orbiting."""
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

def settled(page):
    # The shared label tracker slides a name to a new slot and fades one that
    # has no room, then tidies up 260ms after the camera stops; judge the
    # layout once that has come to rest, not mid-move.
    atlas.rendered(page);page.wait_for_timeout(800)

def check(page):
    result=page.evaluate('''()=>{
      const host=document.querySelector('.atlas-scene').getBoundingClientRect();
      const rect=e=>{const b=e.getBoundingClientRect();return {x:b.x-host.x,y:b.y-host.y,w:b.width,h:b.height}};
      const shown=e=>!e.hidden&&getComputedStyle(e).display!=='none'&&parseFloat(getComputedStyle(e).opacity||'1')>=.99;
      const boxes=[...document.querySelectorAll('.scene-label')].filter(shown).map(e=>({name:e.textContent,...rect(e)}));
      const lines=[...document.querySelectorAll('.scene-leaders line')].filter(e=>e.style.display!=='none'&&parseFloat(e.style.opacity||'1')>=.99).map(e=>({a:{x:+e.getAttribute('x1'),y:+e.getAttribute('y1')},b:{x:+e.getAttribute('x2'),y:+e.getAttribute('y2')}}));
      const avoid=[...document.querySelectorAll('.atlas-scene [data-label-avoid]')].filter(e=>!e.hidden&&e.getBoundingClientRect().width).map(rect);
      const s=__sceneTest;
      const markers=s.bodies.map(b=>{const p=b.position.clone().project(s.camera);return {id:b.id,x:(p.x*.5+.5)*host.width,y:(-p.y*.5+.5)*host.height,z:p.z,r:Math.max(5,b.size*host.height/(2*Math.tan(s.camera.fov*Math.PI/360)*s.camera.position.distanceTo(b.position)))}}).filter(p=>p.z>-1&&p.z<1);
      // Names may hug their own sphere's rim (the layout allows max(3px, 18%
      // of the radius)) but never cover the part you tap. Leaders stay within 70px, plus the tracker's 3px hysteresis (x4)
      // before a label already on screen has to move.
      return {count:boxes.length,bounds:boxes.every(b=>b.x>=-1&&b.y>=-1&&b.x+b.w<=host.width+1&&b.y+b.h<=host.height+1),overlap:boxes.some((b,i)=>boxes.slice(i+1).some(c=>SceneLabelLayout.overlap(b,c,0))),underOverlay:boxes.some(b=>avoid.some(a=>SceneLabelLayout.overlap(b,a,-1))),crossed:lines.some((l,i)=>lines.slice(i+1).some(m=>SceneLabelLayout.intersects(l.a,l.b,m.a,m.b))),blocksSphere:boxes.flatMap(b=>markers.filter(p=>Math.hypot(Math.max(b.x-p.x,0,p.x-b.x-b.w),Math.max(b.y-p.y,0,p.y-b.y-b.h))<p.r-Math.max(4,p.r*.2)).map(p=>b.name+' over '+p.id+' r='+p.r.toFixed(1))),longLeader:lines.some(l=>Math.hypot(l.a.x-l.b.x,l.a.y-l.b.y)>82.01)};
    }''')
    assert result['bounds'] and not result['blocksSphere'] and not any(result[k] for k in ['overlap','underOverlay','crossed','longLeader']),result
    return result['count']

with sync_playwright() as p:
    browser=p.chromium.launch(args=['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(ignore_https_errors=True)
    page.route('**/*',serve)
    page.add_init_script("localStorage.setItem('acidburn-mode','dark');localStorage.setItem('yake-system-notes','closed')")
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto('https://atlas.test/yake.html')
    page.wait_for_function('window.__sceneAPI')
    page.evaluate('document.fonts.ready')
    assert page.locator('.scene-leaders').evaluate("e=>getComputedStyle(e).backgroundColor==='rgba(0, 0, 0, 0)'")
    for w,h in [(1366,768),(320,568),(390,844),(568,320),(768,1024),(1920,1080)]:
        page.set_viewport_size({'width':w,'height':h})
        for view in ['system','jin','shu','xuan','outer','five']:
            page.evaluate('(view)=>__sceneAPI.setView(view)',view)
            settled(page)
            for _ in range(10):
                page.locator('.scene-canvas').focus();page.keyboard.press('ArrowRight');settled(page);check(page)
            page.locator('[data-window-expand]').click();settled(page);check(page)
            page.locator('[data-window-expand]').click();atlas.rendered(page)
        page.evaluate("__sceneAPI.setView('system')");settled(page)
        # The compact landscape overview may omit names; expanding gives them room.
        if h>450:assert check(page)>0,(w,h)
        page.screenshot(path=str(ROOT/'attached_files'/f'yake-labels-{w}x{h}.png'))
    assert not errors,errors
    browser.close()
print('PASS: Ya Ke label bounds, overlays, sphere access and short uncrossed leaders in six viewports and all six views.')
