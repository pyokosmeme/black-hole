"""Unified ship switching, exact comparison scale, callout geometry and fallbacks."""
import mimetypes
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse,unquote
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
SHOTS=ROOT/'attached_files'/'ship-viewer'
SHOTS.mkdir(parents=True,exist_ok=True)
fonts={}
shell='--shell' in sys.argv
def serve(route):
    u=urlparse(route.request.url)
    if u.hostname in ['fonts.googleapis.com','fonts.gstatic.com']:
        if route.request.url not in fonts:
            fonts[route.request.url]=subprocess.check_output(['curl.exe','-k','-sS','--fail',route.request.url])
        route.fulfill(body=fonts[route.request.url],content_type='text/css' if u.hostname=='fonts.googleapis.com' else 'font/ttf');return
    if u.hostname!='maps.test':route.abort();return
    p=(ROOT/unquote(u.path).lstrip('/')).resolve()
    if not p.suffix:p=p.with_suffix('.html')
    if not p.is_relative_to(ROOT) or not p.is_file():route.fulfill(status=404,body='Not found');return
    body=p.read_bytes()
    if p.name=='ship-viewer.js':
        body=b'' if shell else body.replace(b'function drawLabels() {',b'function drawLabels() {window.__ship={state,id,models,renderer};')
    route.fulfill(body=body,content_type=(mimetypes.guess_type(p)[0] or 'application/octet-stream'))

def settle(page,ms=0):
    page.evaluate('() => new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
    # The shared label tracker slides callouts to new slots and fades those
    # without room; layout checks wait for it to come to rest.
    if ms:page.wait_for_timeout(ms)

def ready(page):
    page.wait_for_function("getComputedStyle(document.querySelector('#err')).display==='none'&&window.__ship?.models.length>0")
    settle(page)

def labels_clear(page):
    result=page.evaluate('''()=>{
      const stage=document.querySelector('#stage').getBoundingClientRect();
      const boxes=[...document.querySelectorAll('.lab:not([hidden])')].filter(e=>parseFloat(getComputedStyle(e).opacity||'1')>=.99).map(e=>{const r=e.getBoundingClientRect();return {x:r.x-stage.x,y:r.y-stage.y,w:r.width,h:r.height}});
      const lines=[...document.querySelectorAll('#leaders line')].filter(e=>getComputedStyle(e).display!=='none'&&parseFloat(e.style.opacity||'1')>=.5).map(e=>({a:{x:+e.getAttribute('x1'),y:+e.getAttribute('y1')},b:{x:+e.getAttribute('x2'),y:+e.getAttribute('y2')}}));
      return {count:boxes.length,bounds:boxes.every(b=>b.x>=0&&b.y>=0&&b.x+b.w<=stage.width+1&&b.y+b.h<=stage.height+1),overlap:boxes.some((b,i)=>boxes.slice(i+1).some(c=>SceneLabelLayout.overlap(b,c,0))),crossed:lines.some((l,i)=>lines.slice(i+1).some(m=>SceneLabelLayout.intersects(l.a,l.b,m.a,m.b)))};
    }''')
    assert result['bounds'] and not result['overlap'] and not result['crossed'],result
    return result['count']

def bounds(page):
    assert page.evaluate('''()=>{const r=document.querySelector('[data-map-window]').getBoundingClientRect();return document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1&&r.bottom<=innerHeight-8&&r.left>=8}''')
    assert page.locator('.map-window > .window-toolbar .window-actions > :is(a,button)').evaluate_all('''es=>es.every(e=>{const r=e.getBoundingClientRect();return r.width>=44&&r.height>=44&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})''')

def comparison_clear(page):
    assert page.evaluate('''()=>{
      const stage=document.querySelector('#stage').getBoundingClientRect();
      const boxes=[...document.querySelectorAll('.comparison-label:not([hidden])')].map(e=>e.getBoundingClientRect());
      const caption=document.querySelector('#view-caption').getBoundingClientRect();
      return boxes.length===2&&boxes.every(b=>b.x>=stage.x&&b.right<=stage.right&&b.y>=stage.y&&b.bottom<=stage.bottom&&(!caption.height||b.bottom<caption.top))&&boxes[0].bottom<boxes[1].top;
    }''')

with sync_playwright() as p:
    browser=p.chromium.launch(args=['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    context=browser.new_context(viewport={'width':1366,'height':768},ignore_https_errors=True)
    context.route('**/*',serve)
    page=context.new_page();errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.add_init_script("localStorage.setItem('acidburn-mode','dark')")
    page.goto('https://maps.test/ship-viewer')
    page.evaluate('''async()=>{await document.fonts.ready;await document.fonts.load('14px "Share Tech Mono"');await document.fonts.load('14px Orbitron')}''')
    assert page.evaluate('''()=>['Share Tech Mono','Orbitron'].every(n=>[...document.fonts].some(f=>f.family.replaceAll('"','')===n&&f.status==='loaded'))''')
    assert page.evaluate('''async()=>{const s=[...document.styleSheets].find(s=>s.href?.endsWith('/css/acidburn.css'));const i=s.cssRules.length;s.insertRule('.section-header h2 {color:rgb(12,34,56)}',i);let ok=false;for(let t=0;t<30&&!ok;t++){await new Promise(r=>setTimeout(r,100));ok=getComputedStyle(document.querySelector('#chart-title')).color==='rgb(12, 34, 56)';}s.deleteRule(i);return ok}''')
    if shell:
        page.screenshot(path=str(SHOTS/'shell.png'));print('Shared shell, fonts and inheritance verified.');browser.close();sys.exit()
    ready(page)
    for width,height in [(1366,768),(1920,1080),(320,568),(390,844),(568,320),(768,1024)]:
        page.set_viewport_size({'width':width,'height':height})
        for ship in ['el-cajon','hackett']:
            page.select_option('#ship-select',ship);ready(page);settle(page,800);bounds(page)
            assert labels_clear(page)>=1,(ship,width,height)
            page.screenshot(path=str(SHOTS/f'{ship}-{width}x{height}.png'))
            page.locator('#scene').focus()
            for _ in range(8):page.keyboard.press('ArrowRight');settle(page,800);labels_clear(page)
            page.locator('[data-window-expand]').click();settle(page,800);bounds(page);labels_clear(page)
            page.keyboard.press('Escape');settle(page)
        page.locator('#compare-ships').click();ready(page);bounds(page)
        comparison_clear(page)
        assert page.evaluate('''()=>{const s=__ship,a=s.renderer.project([0,0,15]),b=s.renderer.project([62.9,0,15]),c=s.renderer.project([0,0,-58]),d=s.renderer.project([194.1,0,-58]);return Math.abs((d.x-c.x)/(b.x-a.x)-194.1/62.9)<.000001}''')
        page.screenshot(path=str(SHOTS/f'compare-{width}x{height}.png'))
        page.locator('[data-window-expand]').click();settle(page);bounds(page)
        comparison_clear(page)
        page.screenshot(path=str(SHOTS/f'compare-{width}x{height}-expanded.png'))
        page.keyboard.press('Escape');page.locator('#compare-ships').click();ready(page)
    page.set_viewport_size({'width':1366,'height':768})
    page.select_option('#ship-select','hackett');ready(page)
    page.locator('[data-pane-toggle=options-pane]').click()
    assert page.locator('#options-pane').is_visible()
    for b,key in [('bCut','cut'),('bWire','wire'),('bEva','eva'),('bSpin','spin')]:
        before=page.evaluate(f'__ship.state.{key}');page.locator('#'+b).click();settle(page);assert page.evaluate(f'__ship.state.{key}')!=before
    page.emulate_media(reduced_motion='reduce');page.wait_for_function('!__ship.state.spin')
    page.locator('#bReset').click();settle(page)
    # Rapid changes cannot let a stale fetch replace the selected ship.
    page.select_option('#ship-select','el-cajon');page.select_option('#ship-select','hackett');ready(page)
    assert page.evaluate("__ship.id==='hackett'&&__ship.models[0].cfg.id==='hackett'")
    for mode in ['light','bh','dark','bh']:
        page.evaluate('(m)=>AcidburnMode.setMode(m)',mode)
        if mode=='bh':page.wait_for_function('window.AcidburnBlackhole?.isReady',timeout=30000)
        settle(page);page.screenshot(path=str(SHOTS/f'mode-{mode}.png'))
        assert page.locator('#stage canvas').count()==2 and page.locator('#stage canvas#scene').count()==1
        assert page.locator('#blackhole-container canvas').count()<=1
    page.locator('#compare-ships').click();ready(page);page.reload();ready(page)
    assert page.locator('#compare-ships').get_attribute('aria-pressed')=='true'
    page.locator('.map-window > .window-toolbar a').click();page.wait_for_url('**/maps')
    assert not errors,errors
    print('PASS: six viewports, both ships, noncrossing callouts, metre-scale comparison, controls, modes and reload.',flush=True)
    context.close()
    for route,expected in [('ergo-viewer','el-cajon'),('hackett-viewer','hackett')]:
        context=browser.new_context(ignore_https_errors=True);context.route('**/*',serve);page=context.new_page()
        page.goto('https://maps.test/'+route);page.wait_for_url('**/ship-viewer?ship='+expected);ready(page)
        assert page.locator('#ship-select').input_value()==expected
        context.close()
    for failure in ['webgl','mesh']:
        context=browser.new_context(ignore_https_errors=True);context.route('**/*',serve);page=context.new_page()
        if failure=='webgl':page.add_init_script('''const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,...a){return /webgl/.test(t)?null:get.call(this,t,...a)}''')
        else:page.route('**/maps/ships/*.obj',lambda route:route.fulfill(status=503,body='Unavailable'))
        page.goto('https://maps.test/ship-viewer?compare=1')
        page.wait_for_function("!document.querySelector('#err').textContent.includes('Loading')")
        page.locator('[data-pane-toggle=specs-pane]').click();assert page.locator('.ship-comparison').is_visible()
        page.locator('[data-window-expand]').click();page.locator('.map-window > .window-toolbar a').click();page.wait_for_url('**/maps');context.close()
    browser.close()
print('PASS: legacy links and WebGL/asset failure fallbacks.')
