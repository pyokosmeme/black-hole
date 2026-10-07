"""Automated test suite for Neon Black Hole capture, video recording, and standalone HTML export."""
from pathlib import Path
from urllib.parse import urlparse, unquote
from PIL import Image
from playwright.sync_api import sync_playwright
import io, mimetypes, os

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'attached_files/neon-capture-checks'
OUT.mkdir(parents=True, exist_ok=True)

def serve(route):
    path = (ROOT / unquote(urlparse(route.request.url).path).lstrip('/')).resolve()
    if path.is_dir():
        path = path / 'index.html'
    if path.is_relative_to(ROOT) and path.is_file():
        route.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
    else:
        route.abort()

with sync_playwright() as p:
    browser = p.chromium.launch(args=['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    context = browser.new_context(viewport={'width': 1100, 'height': 800}, reduced_motion='reduce')
    context.route('**/*', serve)
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' and ('THREE' in m.text or 'GL_' in m.text or 'Error' in m.text) else None)

    page.goto('https://capture.test/neon-black-hole.html')
    page.wait_for_function('window.NeonViewer && NeonViewer.frames>0', timeout=60000)

    # 1. Check HUD and Pane elements exist
    assert page.locator('#neon-quick-snap').is_visible()
    assert page.locator('#neon-quick-rec').is_visible()
    assert page.locator('#neon-capture-toggle').is_visible()

    # Open Capture Pane
    page.locator('#neon-capture-toggle').click()
    page.wait_for_selector('#neon-capture', state='visible')

    # 2. Test PNG Still capture at 1080p
    page.locator('#neon-still-res').select_option('1080p')
    with page.expect_download(timeout=30000) as still_dl:
        page.locator('#neon-capture-still').click()
    still_path = OUT / 'snap-1080p.png'
    still_dl.value.save_as(str(still_path))
    assert still_path.stat().st_size > 10000, f'PNG file too small: {still_path.stat().st_size} bytes'
    img = Image.open(still_path)
    assert img.size == (1920, 1080), f'Expected 1920x1080, got {img.size}'
    print(f'PASS: Captured 1080p still image ({img.size[0]}x{img.size[1]}, {still_path.stat().st_size} bytes)')

    # 3. Test Video Recording clip (2 seconds)
    page.locator('#neon-video-len').select_option('2')
    page.locator('#neon-video-res').select_option('720p')
    with page.expect_download(timeout=30000) as video_dl:
        page.locator('#neon-start-record').click()
        # Verify recording pill is visible
        page.wait_for_selector('#neon-rec-pill.is-recording', state='visible', timeout=5000)
    video_path = OUT / 'clip-720p.webm'
    video_dl.value.save_as(str(video_path))
    assert video_path.stat().st_size > 5000, f'Video file too small: {video_path.stat().st_size} bytes'
    print(f'PASS: Recorded 2s clip at 720p ({video_path.stat().st_size} bytes)')

    # 4. Test Standalone HTML Export from Capture pane
    with page.expect_download(timeout=60000) as html_dl:
        page.locator('#neon-export-html').click()
    html_path = OUT / 'standalone.html'
    html_dl.value.save_as(str(html_path))
    assert html_path.stat().st_size > 50000, f'Standalone HTML too small: {html_path.stat().st_size} bytes'
    html_text = html_path.read_text(encoding='utf-8')
    assert 'NEON_SHADERS' in html_text, 'NEON_SHADERS missing from standalone HTML'
    assert 'NEON_TEXTURES' in html_text, 'NEON_TEXTURES missing from standalone HTML'
    assert 'data:image/png;base64,' in html_text, 'Base64 textures missing from standalone HTML'
    print(f'PASS: Exported standalone HTML ({html_path.stat().st_size} bytes)')

    # 5. Open Standalone HTML and verify offline execution without errors
    test_page = context.new_page()
    test_errors = []
    test_page.on('pageerror', lambda e: test_errors.append(str(e)))
    test_page.on('console', lambda m: test_errors.append(m.text) if m.type == 'error' and ('THREE' in m.text or 'GL_' in m.text or 'Error' in m.text) else None)
    test_page.goto('https://capture.test/attached_files/neon-capture-checks/standalone.html')
    test_page.wait_for_function('window.NeonViewer && NeonViewer.frames>0', timeout=60000)
    frames = test_page.evaluate('NeonViewer.frames')
    assert frames > 0, f'Standalone viewer did not render frames: {frames}'
    test_page.screenshot(path=str(OUT / 'standalone-screenshot.png'))
    assert not test_errors, f'Errors in standalone viewer: {test_errors}'
    print('PASS: Standalone HTML rendered frames cleanly with 0 errors')
    test_page.close()

    # 6. Test Download HTML button in Share pane (#neon-share-html)
    page.locator('[data-pane-toggle=neon-share]').click()
    with page.expect_download(timeout=60000) as share_dl:
        page.locator('#neon-share-html').click()
    share_path = OUT / 'share-standalone.html'
    share_dl.value.save_as(str(share_path))
    assert share_path.stat().st_size > 50000
    print('PASS: Download HTML button in Share pane works')
    page.keyboard.press('Escape')  # close share pane

    # 7. Verify Quick Snap button in HUD
    with page.expect_download(timeout=30000) as quick_dl:
        page.locator('#neon-quick-snap').click()
    quick_path = OUT / 'quick-snap.png'
    quick_dl.value.save_as(str(quick_path))
    assert quick_path.stat().st_size > 10000
    print('PASS: Quick snap HUD button works')

    assert not errors, f'Console/page errors: {errors}'
    browser.close()
    print('ALL CAPTURE TESTS PASSED.')
