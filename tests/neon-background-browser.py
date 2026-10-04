"""Shared neon/legacy lifecycle across site pages; no live site writes."""
from pathlib import Path
from urllib.parse import urlparse,unquote
import mimetypes
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
SHOTS=ROOT/'attached_files/neon-checks'
SHOTS.mkdir(parents=True,exist_ok=True)
missing=[]
def serve(route):
    url=urlparse(route.request.url)
    if url.hostname!='background.test':
        if 'marked' in url.path:
            path=ROOT/'js/vendor/marked.min.js'
            if path.exists():
                route.fulfill(body=path.read_bytes(),content_type='text/javascript')
                return
        route.abort()
        return
    if url.path.startswith('/api/'):
        # The local fixture serves assets; deployed Worker APIs are out of scope.
        route.fulfill(status=503,body='{"error":"Offline browser fixture"}',content_type='application/json')
        return
    path=(ROOT/unquote(url.path).lstrip('/')).resolve()
    if path.is_dir():path=path/'index.html'
    if not path.is_relative_to(ROOT) or not path.is_file():
        missing.append(url.path)
        route.fulfill(status=404,body='Missing asset')
        return
    route.fulfill(body=path.read_bytes(),content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')

with sync_playwright() as p:
    browser=p.chromium.launch(args=['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    context=browser.new_context(viewport={'width':800,'height':600})
    context.route('**/*',serve)
    errors=[]
    page=context.new_page()
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda m:errors.append(m.text) if m.type=='error' and 'THREE.WebGL' in m.text else None)
    # Dark/Light startup, then BH. Mobile startup on index used to omit dependencies.
    for mode,url,width in [('dark','index.html',390),('light','maps.html',800),('dark','futures.html',800),('bh','ams.html',800),('bh','yake.html',800),('bh','ship-viewer.html',800),('bh','galaxy.html',800),('bh','vehicle-viewer.html',800)]:
        page.set_viewport_size({'width':width,'height':600})
        page.goto('https://background.test/'+url)
        page.evaluate('(mode)=>{localStorage.setItem("acidburn-bh-legacy","false");AcidburnMode.setMode(mode);}',mode)
        if mode!='bh':
            assert page.locator('#blackhole-container canvas').count()==0
            page.evaluate("AcidburnMode.setMode('bh')")
        page.wait_for_function('AcidburnBlackhole.frames>0',timeout=60000)
        assert page.evaluate('AcidburnBlackhole.renderer')=='neon'
        assert page.locator('#blackhole-container canvas').count()==1,url
        assert page.evaluate('AcidburnBlackhole.getShader().parameters.time_scale')==3.18
        page.evaluate("AcidburnMode.setMode('dark')")
        count=page.evaluate('AcidburnBlackhole.frames')
        page.wait_for_timeout(300)
        assert page.evaluate('AcidburnBlackhole.frames')==count
        assert page.locator('#blackhole-container canvas').count()==0
        print('PASS shared background:',url,mode,width,flush=True)
    # UI checkbox switches the actual previous renderer, persists across reloads.
    page.goto('https://background.test/neon-black-hole.html')
    page.evaluate("AcidburnMode.setMode('bh')")
    page.wait_for_function('AcidburnBlackhole.frames>0',timeout=60000)
    page.locator('.nav-toggle').click()
    page.locator('#bh-legacy').check()
    page.wait_for_function("AcidburnBlackhole.renderer==='legacy' && AcidburnBlackhole.frames>0",timeout=60000)
    assert page.locator('#blackhole-container canvas').count()==1
    assert page.evaluate('AcidburnBlackhole.getShader().parameters.time_scale')==.5
    page.screenshot(path=str(SHOTS/'legacy-checkbox.png'))
    page.reload()
    page.wait_for_function("AcidburnBlackhole.renderer==='legacy' && AcidburnBlackhole.frames>0",timeout=60000)
    assert page.locator('#bh-legacy').is_checked()
    page.locator('.nav-toggle').click()
    page.locator('#bh-legacy').uncheck()
    page.wait_for_function("AcidburnBlackhole.renderer==='neon' && AcidburnBlackhole.frames>0",timeout=60000)
    for _ in range(3):
        page.locator('#bh-legacy').check()
        page.wait_for_function("AcidburnBlackhole.renderer==='legacy' && AcidburnBlackhole.frames>0")
        assert page.locator('#blackhole-container canvas').count()==1
        page.locator('#bh-legacy').uncheck()
        page.wait_for_function("AcidburnBlackhole.renderer==='neon' && AcidburnBlackhole.frames>0")
        assert page.locator('#blackhole-container canvas').count()==1
    page.evaluate("AcidburnMode.setMode('dark')")
    page.evaluate("AcidburnMode.setMode('bh')")
    page.wait_for_function('AcidburnBlackhole.frames>0')
    assert not errors,errors
    print('PASS checkbox, actual legacy defaults, preference persistence, repeated swaps, one background canvas.',flush=True)
    # Reduced motion freezes both rendering paths and the independent viewer.
    page.emulate_media(reduced_motion='reduce')
    page.wait_for_timeout(400)
    page.wait_for_function('NeonViewer.isPaused()')
    count=page.evaluate('AcidburnBlackhole.frames')
    page.wait_for_timeout(500)
    assert page.evaluate('AcidburnBlackhole.frames')==count
    page.locator('#bh-legacy').check()
    page.wait_for_timeout(500)
    count=page.evaluate('AcidburnBlackhole.frames')
    page.wait_for_timeout(500)
    assert page.evaluate('AcidburnBlackhole.frames')==count
    print('PASS reduced motion for neon, legacy and viewer.',flush=True)
    # WebGL failure: shared static fallback, actionable viewer message and navigation.
    fallback=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce')
    fallback.route('**/*',serve)
    fallback.add_init_script('''const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.includes('webgl')?null:original.call(this,type,...args);};localStorage.setItem('acidburn-mode','bh');''')
    failed=fallback.new_page()
    failed.goto('https://background.test/neon-black-hole.html')
    failed.wait_for_function("document.body.classList.contains('no-webgl')")
    assert failed.locator('#blackhole-container canvas,#neon-scene canvas').count()==0
    assert 'WebGL is unavailable' in failed.locator('#neon-status').inner_text()
    assert failed.locator('#neon-zip').is_disabled()
    failed.locator('.nav-toggle').click()
    assert failed.locator('[data-display-mode=dark]').is_visible()
    failed.screenshot(path=str(SHOTS/'no-webgl.png'))
    assert not missing,missing
    print('PASS WebGL failure fallback and navigation; no missing local assets.',flush=True)
    browser.close()
