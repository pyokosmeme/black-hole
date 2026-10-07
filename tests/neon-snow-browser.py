"""Verify the Crimson snow scene, crystalline dunes, stardust plume, and metallic text styles."""
from pathlib import Path
from urllib.parse import urlparse, unquote
from playwright.sync_api import sync_playwright
from PIL import Image
import json, mimetypes, zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'attached_files/neon-snow-checks'
OUT.mkdir(parents=True, exist_ok=True)

def serve(route):
    path = (ROOT / unquote(urlparse(route.request.url).path).lstrip('/')).resolve()
    if path.is_relative_to(ROOT) and path.is_file():
        route.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
    else:
        route.abort()

with sync_playwright() as p:
    browser = p.chromium.launch(args=['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    page = browser.new_page(viewport={'width': 1100, 'height': 800}, reduced_motion='reduce')
    page.route('**/*', serve)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' and ('THREE' in m.text or 'GL_' in m.text) else None)
    
    page.goto('https://snow.test/neon-black-hole.html')
    page.wait_for_function('window.NeonViewer && NeonViewer.frames>0', timeout=60000)
    
    # 1. Load Crimson Snow preset via HUD button
    frame = page.evaluate('NeonViewer.frames')
    page.locator('#neon-snow').click()
    page.wait_for_function('(n)=>NeonViewer.frames>n', arg=frame)
    page.wait_for_function('''[...document.fonts].some(f=>f.family.replaceAll('"','')==='Neon Teko'&&f.status==='loaded')''')
    
    s = page.evaluate('NeonViewer.settings()')
    expected = page.evaluate('NEON_CRIMSON_SNOW')
    assert s['look']['floor_snow'], 'floor_snow not enabled'
    assert s['look']['floor_sparkle'] > 0, 'floor_sparkle not set'
    assert s['look']['sky_plume'] > 0, 'sky_plume not set'
    assert s['caption']['style'] == 'ice', 'caption style not ice'
    assert s == expected, f'Settings mismatch: {s} != {expected}'
    
    # Screenshot of the Crimson Snow scene
    shot_path = OUT / 'crimson-snow-scene.png'
    page.screenshot(path=str(shot_path))
    assert Image.open(shot_path).width == 1100
    print(f'Captured Crimson Snow scene at {shot_path}')
    
    # 2. Test ruby style
    page.evaluate('''() => {
        const next = NeonViewer.settings();
        next.caption.style = 'ruby';
        NeonViewer.applySettings(next);
    }''')
    page.wait_for_timeout(300)
    ruby_path = OUT / 'ruby-style.png'
    page.screenshot(path=str(ruby_path))
    assert page.evaluate('NeonViewer.settings().caption.style') == 'ruby'
    print(f'Captured Ruby text style at {ruby_path}')
    
    # 3. Test Warm Chrome preset still works
    frame = page.evaluate('NeonViewer.frames')
    page.locator('#neon-warm').click()
    page.wait_for_function('(n)=>NeonViewer.frames>n', arg=frame)
    warm_s = page.evaluate('NeonViewer.settings()')
    assert warm_s == page.evaluate('NEON_WARM_CHROME')
    assert not warm_s['look']['floor_snow']
    assert warm_s['look']['floor_opaque']
    print('Warm chrome preset round-trips cleanly')
    
    # 4. Switch back to snow and test ZIP export
    page.locator('#neon-snow').click()
    page.wait_for_timeout(300)
    page.locator('[data-pane-toggle=neon-share]').click()
    with page.expect_download(timeout=60000) as archive:
        page.locator('#neon-zip').click()
    zip_path = OUT / 'crimson-snow.zip'
    archive.value.save_as(zip_path)
    with zipfile.ZipFile(zip_path) as z:
        assert 'crimson-snow.js' in z.namelist(), 'crimson-snow.js missing from ZIP'
        assert 'warm-chrome.js' in z.namelist(), 'warm-chrome.js missing from ZIP'
        assert json.loads(z.read('settings.json')) == expected
        assert z.testzip() is None
    print('ZIP export includes crimson-snow.js and valid settings')
    
    assert not errors, f'Console/page errors: {errors}'
    print('PASS: Crimson snow scene, crystalline dunes, stardust plume, metallic finishes and ZIP export.')
    browser.close()
