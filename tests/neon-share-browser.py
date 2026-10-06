"""Exact stationary preset and share-link restore, validation and portability."""
from pathlib import Path
from urllib.parse import urlparse, unquote
import base64, gzip, json, mimetypes
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'attached_files/neon-share-checks'
OUT.mkdir(parents=True,exist_ok=True)
def serve(route):
    path=(ROOT/unquote(urlparse(route.request.url).path).lstrip('/')).resolve()
    if path.is_dir():path=path/'index.html'
    if path.is_relative_to(ROOT) and path.is_file():route.fulfill(body=path.read_bytes(),content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
    else:route.abort()
def ready(page,url):
    page.goto(url);page.wait_for_function('window.NeonViewer && NeonViewer.frames>0',timeout=60000)
def loaded(page):page.wait_for_function("document.querySelector('#neon-status').textContent==='Shared scene loaded.'",timeout=60000)
def payload(value):return '1j.'+base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip('=')

with sync_playwright() as p:
    browser=p.chromium.launch(args=['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    context=browser.new_context(viewport={'width':1100,'height':900},reduced_motion='reduce')
    context.route('**/*',serve)
    context.add_init_script("Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>{window.copiedScene=text}}})")
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    ready(page,'https://share.test/neon-black-hole.html')
    original=page.evaluate('NeonViewer.settings()');assert original['observer']['motion']
    page.evaluate("()=>{const s=NeonViewer.settings();s.caption.text='old';s.camera.navigation='free';s.look.exposure=3;NeonViewer.applySettings(s)}")
    page.locator('#neon-warm').click()
    preset=page.evaluate('NEON_WARM_CHROME');assert page.evaluate('NeonViewer.settings()')==preset
    assert preset['caption']['size']==11 and preset['look']['nebula_scale']==8
    assert preset['time_scale']==3.18 and preset['look']['galaxy_gain']==3.36 and preset['look']['disk_speed']==4.06
    assert not preset['observer']['motion'] and preset['look']['sky_motion']
    assert page.locator('#neon-stationary').get_attribute('aria-pressed')=='true'
    assert page.locator('#neon-camera-controls').is_visible()
    page.locator('#neon-link').click();page.wait_for_function('window.copiedScene')
    warm_link=page.evaluate('copiedScene');assert len(warm_link)<5000
    reopened=context.new_page();ready(reopened,warm_link);loaded(reopened)
    assert reopened.evaluate('NeonViewer.settings()')==preset
    reopened.close()
    # Capture the current edits, including Unicode, camera movement and a map.
    changed=json.loads(json.dumps(preset));changed['caption']['text']='BEYOND|HUMAN ✨'
    changed['camera'].update(height=-4.5,yaw=8,offset_x=1.25)
    changed['planet']['texture']='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII='
    page.evaluate('(s)=>NeonViewer.applySettings(s)',changed)
    page.evaluate('copiedScene=null');page.locator('#neon-link').click();page.wait_for_function('window.copiedScene')
    edited_link=page.evaluate('copiedScene');ready(page,edited_link);loaded(page)
    assert page.evaluate('NeonViewer.settings()')==changed
    page.reload();loaded(page);assert page.evaluate('NeonViewer.settings()')==changed
    # The non-compressed format remains readable without CompressionStream.
    page.evaluate('window.CompressionStream=undefined;copiedScene=null')
    page.locator('#neon-link').click();page.wait_for_function('window.copiedScene')
    plain=page.evaluate('copiedScene');assert '#scene=1j.' in plain
    ready(page,plain);loaded(page);assert page.evaluate('NeonViewer.settings()')==changed
    # Hash navigation keeps the current scene; invalid links must not mutate it.
    for bad in ['1g.NOTVALID',payload({'observer':{'motion':'no'}}),'1g.'+base64.urlsafe_b64encode(gzip.compress(b' '*6400010)).decode().rstrip('=')]:
        before=page.evaluate('NeonViewer.settings()')
        ready(page,'https://share.test/neon-black-hole.html#scene='+bad)
        page.wait_for_function("document.querySelector('#neon-status').textContent.startsWith('Could not open scene link:')")
        actual=page.evaluate('NeonViewer.settings()')
        assert actual==before,[(k,before[k],actual[k]) for k in before if before[k]!=actual[k]]
    page.locator('#neon-warm').click()
    page.evaluate("()=>{navigator.clipboard.writeText=async()=>{throw new Error('denied')}}")
    page.locator('#neon-link').click();page.locator('#neon-link-url').wait_for(state='visible')
    assert page.locator('#neon-link-url').input_value().startswith('https://share.test/neon-black-hole.html#scene=')
    assert page.locator('#neon-link-url').evaluate('e=>document.activeElement===e&&e.selectionEnd===e.value.length')
    page.keyboard.press('Escape')
    for width,height in [(320,568),(390,844),(568,320),(768,1024),(1366,768)]:
        page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(100)
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(width,height)
        for name in ['neon-warm','neon-link']:
            box=page.locator('#'+name).bounding_box();assert box and box['width']>=40 and box['height']>=40
        if width==390:page.screenshot(path=str(OUT/'warm-phone.png'))
    assert not errors,errors
    print('PASS exact full warm preset, stationary controls, compressed/plain scene links, Unicode/map/camera restore, refresh, malformed/bounded links, clipboard fallback and five screen sizes.')
    browser.close()
