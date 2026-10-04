"""Neon viewer and shared-background browser checks; serves live files via Playwright."""
from pathlib import Path
from urllib.parse import urlparse, unquote
import mimetypes
import sys
import json
import zipfile
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SHOTS = ROOT / 'attached_files' / 'neon-checks'
SHOTS.mkdir(parents=True, exist_ok=True)

def serve(route):
    url = urlparse(route.request.url)
    if url.hostname in ('fonts.googleapis.com', 'fonts.gstatic.com'):
        route.continue_()
        return
    if url.hostname != 'neon.test':
        route.abort()
        return
    path = (ROOT / unquote(url.path).lstrip('/')).resolve()
    if path.is_dir():
        path = path / 'index.html'
    if not path.is_relative_to(ROOT) or not path.is_file():
        route.fulfill(status=404, body='Missing local asset')
        return
    content=path.read_bytes()
    if path==ROOT/'neon/index.html':
        content=content.replace(b'</body>',b'<script src="https://static.cloudflareinsights.com/beacon.min.js"></script></body>')
    route.fulfill(body=content, content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')

with sync_playwright() as p:
    browser = p.chromium.launch(args=['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    page = browser.new_page(viewport={'width':1366,'height':768}, ignore_https_errors=True)
    errors = []
    failed = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('requestfailed', lambda r: failed.append((r.url,r.failure)))
    page.route('**/*', serve)
    page.add_init_script("localStorage.setItem('acidburn-mode','dark')")
    page.goto('https://neon.test/neon-black-hole.html')
    page.wait_for_selector('.mode-options', state='attached')
    page.evaluate('''async()=>{await document.fonts.ready;await document.fonts.load('14px "Share Tech Mono"');await document.fonts.load('14px Orbitron');}''')
    assert page.evaluate('''()=>['Share Tech Mono','Orbitron'].every(name=>[...document.fonts].some(f=>f.family.replaceAll('"','')===name&&f.status==='loaded'))'''), 'Actual webfonts did not load'
    assert page.evaluate('''async()=>{const s=[...document.styleSheets].find(s=>s.href?.endsWith('/css/acidburn.css'));const i=s.cssRules.length;s.insertRule('.section-header h2 { color:rgb(12,34,56) }',i);await new Promise(r=>setTimeout(r,350));const ok=getComputedStyle(document.querySelector('#viewer-title')).color==='rgb(12, 34, 56)';s.deleteRule(i);return ok;}''')
    page.wait_for_function('window.NeonViewer && NeonViewer.frames>1', timeout=60000)
    page.locator('#neon-pause').click()
    page.wait_for_timeout(350)
    page.screenshot(path=str(SHOTS/'shell.png'))
    assert not errors, errors
    print('Shared shell: actual fonts, inherited heading style, navigation, no JS errors.')

    # Full settings round-trip, including fields absent from the original ZIP's exporter.
    initial=page.evaluate('NeonViewer.settings()')
    assert initial['observer']['periapsis']==3.2 and initial['time_scale']==3.18
    changed=json.loads(json.dumps(initial))
    changed['look']['exposure']=2.17
    changed['camera']['pitch']=12.5
    changed['observer']['motion']=False
    changed['camera']['yaw']=24
    changed['planet']['enabled']=True
    changed['renderer']='original'
    page.locator('[data-pane-toggle=neon-share]').click()
    page.locator('#neon-json').fill(json.dumps(changed))
    page.locator('#neon-load').click()
    assert page.evaluate('NeonViewer.settings()')==changed
    for invalid in [{'look':{'render_scale':0}}, {'n_steps':500000}, {'camera':None}, {'version':2}, {'observer':{'periapsis':20,'apoapsis':3.2}}, {'__proto__':{'polluted':True}}, {'neon_floor':'false'}, {'quality':'bogus'}]:
        page.locator('#neon-json').fill(json.dumps(invalid))
        page.locator('#neon-load').click()
        assert 'Could not load' in page.locator('#neon-share .neon-feedback').inner_text(),invalid
        assert page.evaluate('NeonViewer.settings()')==changed
    # Clipboard fallback must expose copyable JSON even without clipboard permissions.
    page.evaluate("()=>{navigator.clipboard.writeText=()=>Promise.reject(new Error('blocked'));}")
    page.locator('#neon-copy').click()
    assert json.loads(page.locator('#neon-json').input_value())==changed
    assert page.locator('#neon-json').evaluate('e=>e.selectionEnd-e.selectionStart===e.value.length')
    page.locator('#neon-file').set_input_files({'name':'settings.json','mimeType':'application/json','buffer':json.dumps(initial).encode()})
    page.wait_for_function('(v)=>JSON.stringify(NeonViewer.settings())===JSON.stringify(v)', arg=initial)
    page.locator('#neon-json').fill(json.dumps(changed))
    page.locator('#neon-load').click()
    try:
        with page.expect_download(timeout=15000) as download_info:
            page.locator('#neon-zip').click()
    except Exception:
        print('Export feedback:',page.locator('#neon-share .neon-feedback').inner_text(),failed,flush=True)
        raise
    archive=SHOTS/'export.zip'
    download_info.value.save_as(archive)
    exported=SHOTS/'exported'
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None
        assert json.loads(z.read('settings.json'))==changed
        assert not any('nav-menu' in n or 'cf.env' in n for n in z.namelist())
        assert b'window.NEON_PACKAGED=true' in z.read('index.html')
        assert b'cloudflareinsights' not in z.read('index.html')
        z.extractall(exported)
    print('JSON import, atomic validation, file import, clipboard fallback, ZIP CRC and contents passed.')
    page.locator('#neon-share [data-pane-close]').click()
    page.locator('#neon-reset').click()
    assert page.evaluate('NeonViewer.settings()')==initial
    page.locator('#neon-pause').click()
    page.locator('[data-pane-toggle=neon-settings]').click()
    page.locator('#setting-time_scale').fill('2.5')
    page.locator('#setting-time_scale').press('Tab')
    assert page.evaluate('NeonViewer.settings().time_scale')==2.5
    page.keyboard.press('Escape')
    assert page.locator('[data-pane-toggle=neon-settings]').evaluate('e=>e===document.activeElement')
    page.locator('#neon-reset').click()
    page.locator('#neon-pause').click()

    # Responsive geometry, pane accessibility and shared mode transitions.
    for width,height in [(320,568),(390,844),(568,320),(768,1024),(1366,768),(1920,1080)]:
        page.set_viewport_size({'width':width,'height':height})
        page.wait_for_timeout(300)
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(width,height,'overflow')
        assert page.locator('.map-window').evaluate('e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight+1}'),(width,height)
        for pane in ['neon-settings','neon-share']:
            page.locator(f'[data-pane-toggle={pane}]').click()
            assert page.locator('#'+pane).is_visible()
            assert page.locator(f'#{pane} [data-pane-close]').evaluate('e=>{const r=e.getBoundingClientRect();return r.width>=40&&r.height>=40&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}'),(width,height,pane)
            assert page.locator('#'+pane).evaluate('e=>{const r=e.getBoundingClientRect(),v=e.closest(".map-viewport").getBoundingClientRect();return r.left>=v.left&&r.right<=v.right+1&&r.top>=v.top&&r.bottom<=v.bottom+1&&e.scrollWidth<=e.clientWidth+1}'),(width,height,pane)
            if pane=='neon-share':
                page.screenshot(path=str(SHOTS/f'viewer-share-{width}x{height}.png'))
            page.keyboard.press('Escape')
            assert not page.locator('#'+pane).is_visible()
        page.screenshot(path=str(SHOTS/f'viewer-{width}x{height}.png'))
    page.locator('[data-window-expand]').click()
    assert page.locator('.map-window').evaluate('e=>e.classList.contains("is-expanded")')
    page.keyboard.press('Escape')
    assert not page.locator('.map-window').evaluate('e=>e.classList.contains("is-expanded")')
    page.evaluate("AcidburnMode.setMode('light')")
    page.wait_for_timeout(350)
    assert page.locator('.author-card').first.evaluate('e=>getComputedStyle(e).backgroundColor')=='rgb(253, 250, 245)'
    assert page.locator('#neon-scene canvas').count()==1
    page.screenshot(path=str(SHOTS/'viewer-light.png'))
    page.evaluate("AcidburnMode.setMode('bh')")
    page.wait_for_timeout(350)
    assert page.evaluate('AcidburnBlackhole.frames')==0
    assert page.evaluate('AcidburnMode.getMode()')=='bh'
    assert page.locator('#blackhole-container canvas').count()==0
    assert page.locator('#neon-scene canvas').count()==1
    assert page.evaluate('NeonViewer.settings()')==initial
    page.evaluate("AcidburnMode.setMode('dark')")
    assert not errors,errors
    print('Six screen sizes, pane geometry, focus return, expand/Escape, Light and BH independence passed.')

    # Launch the actual exported artifact, then export again from that portable copy.
    page.goto('https://neon.test/attached_files/neon-checks/exported/index.html')
    page.wait_for_function('window.NeonViewer && NeonViewer.frames>0', timeout=60000)
    assert page.evaluate('NeonViewer.settings()')==changed
    assert page.locator('header,#nav-menu,#blackhole-container').count()==0
    page.locator('#neon-reset').click()
    assert page.evaluate('NeonViewer.settings()')==changed
    page.locator('[data-pane-toggle=neon-share]').click()
    with page.expect_download(timeout=60000) as second:
        page.locator('#neon-zip').click()
    second.value.save_as(SHOTS/'reexport.zip')
    with zipfile.ZipFile(SHOTS/'reexport.zip') as z:
        assert z.testzip() is None and json.loads(z.read('settings.json'))==changed
    page.screenshot(path=str(SHOTS/'exported.png'))
    assert not errors,errors
    print('Exported standalone viewer renders with chosen defaults and can export itself again.')
    browser.close()
