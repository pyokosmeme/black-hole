"""Local CHOMP viewer browser checks. Run with Python Playwright."""
from pathlib import Path
from urllib.parse import urlparse, unquote
import mimetypes
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

ROOT = Path(__file__).resolve().parents[1]
SHOTS = ROOT / "attached_files"


def serve(route):
    url = urlparse(route.request.url)
    if url.hostname == "fonts.googleapis.com":
        route.fulfill(body=(ROOT / "tests/fixtures/acidburn-fonts.css").read_bytes(), content_type="text/css")
        return
    if url.hostname != "vehicle.test":
        route.abort()
        return
    path = (ROOT / unquote(url.path).lstrip("/")).resolve()
    if not path.is_relative_to(ROOT) or not path.is_file():
        route.fulfill(status=404, body="Not found")
        return
    route.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or "application/octet-stream")


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--enable-webgl", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        for width, height in [(320, 568), (390, 844), (568, 320), (768, 1024), (1366, 768), (1920, 1080)]:
            page = browser.new_page(viewport={"width": width, "height": height}, has_touch=width < 600)
            errors = []
            failed = []
            request_failed = []
            console_errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
            page.on("response", lambda response: failed.append(f"{response.status} {response.url}") if response.status >= 400 else None)
            page.on("requestfailed", lambda request: request_failed.append(f"{request.url}: {request.failure}"))
            page.route("**/*", serve)
            page.add_init_script("if(!localStorage.getItem('acidburn-mode')) localStorage.setItem('acidburn-mode','dark')")
            page.goto("https://vehicle.test/vehicle-viewer.html")
            try:
                page.wait_for_function("window.__vehicleViewer?.loaded", timeout=20000)
            except PlaywrightTimeout:
                print("LOAD DIAGNOSTICS", width, height, errors, failed, page.locator("#status").inner_text(), page.evaluate("({viewer:!!window.__vehicleViewer,three:!!window.CHOMP_THREE,modelCanvas:document.querySelectorAll('#stage > canvas').length})"), flush=True)
                raise
            page.evaluate("() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")
            assert not errors, (width, height, errors)
            assert not failed, (width, height, failed)
            assert page.locator("#stage > canvas").count() == 1
            assert page.locator("#blackhole-container canvas").count() == 0
            assert page.locator('#nav-menu a[href="/vehicle-viewer.html"]').count() == 1
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
            assert page.evaluate("""() => {
                const a=document.querySelector('.map-window').getBoundingClientRect();
                const b=document.querySelector('.map-controls').getBoundingClientRect();
                const s=document.querySelector('#stage').getBoundingClientRect();
                return a.left>=0&&a.right<=innerWidth&&b.left>=s.left&&b.right<=s.right&&b.top>=s.top&&b.bottom<=s.bottom;
            }""")
            assert page.evaluate("getComputedStyle(document.querySelector('#chart-title')).fontFamily.includes('Orbitron')")
            assert page.evaluate("getComputedStyle(document.querySelector('.map-window')).borderImageSource.includes('gradient')")
            if width == 1366:
                try:
                    fonts = page.evaluate("""async () => {
                    await document.fonts.ready;
                    await document.fonts.load('14px "Share Tech Mono"');
                    await document.fonts.load('14px Orbitron');
                    return [...document.fonts].filter(f=>['Share Tech Mono','Orbitron'].includes(f.family.replaceAll('"',''))&&f.status==='loaded').map(f=>f.family);
                }""")
                except Exception:
                    print("FONT DIAGNOSTICS", failed, request_failed, console_errors, page.evaluate("[...document.fonts].map(f=>[f.family,f.status])"), flush=True)
                    raise
                assert any("Share Tech Mono" in name for name in fonts), fonts
                assert any("Orbitron" in name for name in fonts), fonts
            page.screenshot(path=str(SHOTS / f"chomp-{width}x{height}-dark.png"))
            print(f"PASS {width}x{height}: loaded, bounded, one model canvas", flush=True)
            if width in (320, 390, 568):
                page.locator('[data-pane-toggle="motion-pane"]').click()
                assert page.evaluate("""() => {
                    const p=document.querySelector('#motion-pane').getBoundingClientRect();
                    const v=document.querySelector('#stage').getBoundingClientRect();
                    const x=document.querySelector('#motion-pane [data-pane-close]').getBoundingClientRect();
                    return p.left>=v.left&&p.right<=v.right&&p.top>=v.top&&p.bottom<=v.bottom&&x.width>=40&&x.height>=40;
                }""")
                page.screenshot(path=str(SHOTS / f"chomp-{width}x{height}-motion.png"))
                page.locator('#motion-pane [data-pane-close]').click()
            if width == 1366:
                page.wait_for_timeout(400)
                idle = page.evaluate("__vehicleViewer.renderCount")
                page.wait_for_timeout(400)
                assert page.evaluate("__vehicleViewer.renderCount") - idle <= 1
                page.locator('#stage > canvas').focus()
                before = page.evaluate("__vehicleViewer.camera.position.toArray()")
                page.keyboard.press('ArrowRight')
                assert page.evaluate("__vehicleViewer.camera.position.toArray()") != before
                page.locator('#resetView').click()
                assert page.evaluate("""async () => {
                  const s=[...document.styleSheets].find(x=>x.href?.endsWith('/css/acidburn.css'));
                  const n=s.cssRules.length;s.insertRule('.section-header h2 {color:rgb(12,34,56)}',n);
                  let ok=false;for(let i=0;i<25&&!ok;i++){await new Promise(r=>setTimeout(r,100));ok=getComputedStyle(document.querySelector('#chart-title')).color==='rgb(12, 34, 56)';}
                  s.deleteRule(n);return ok;
                }""")
                for mode in ("light", "bh", "dark"):
                    page.evaluate("mode => AcidburnMode.setMode(mode)", mode)
                    if mode == "bh":
                        page.wait_for_selector("#blackhole-container canvas", timeout=30000)
                    else:
                        page.wait_for_function("getComputedStyle(document.querySelector('#blackhole-container')).display==='none'")
                    assert page.locator("#stage > canvas").count() == 1
                    page.screenshot(path=str(SHOTS / f"chomp-{width}x{height}-{mode}.png"))
                page.locator('[data-pane-toggle="turret-pane"]').click()
                page.locator('[data-variant="missile"]').click()
                assert page.evaluate("__vehicleViewer.currentVariant === 'missile'")
                assert page.locator("#droneBtn").is_visible()
                page.locator("#droneBtn").click()
                page.locator('#turret-pane [data-pane-close]').click()
                page.locator('[data-pane-toggle="motion-pane"]').click()
                page.locator('[data-pose="walk"]').click()
                page.wait_for_function("document.querySelector('#gaitSpeed').textContent.length > 0", timeout=5000)
                assert page.locator("#gaitSpeed").inner_text()
                page.locator('[data-pose="stand"]').click()
                page.locator("#jumpBtn").click()
                page.locator('#motion-pane [data-pane-close]').click()
                page.wait_for_function("__vehicleViewer.rocketPhase==='boost' && __vehicleViewer.visiblePlumes>0", timeout=5000)
                page.wait_for_timeout(800)
                assert page.evaluate("__vehicleViewer.visiblePlumes === 6")
                page.screenshot(path=str(SHOTS / "chomp-rocket-burn.png"))
                assert page.evaluate("__vehicleViewer.drawCalls > 0")
                page.locator('[data-pane-toggle="motion-pane"]').click()
                page.locator("#powerBtn").click()
                assert page.locator("#jStride").is_disabled()
                page.locator("#powerBtn").click()
                assert not page.locator("#jStride").is_disabled()
                page.evaluate("AcidburnMode.setMode('light')")
                page.reload()
                page.wait_for_function("window.__vehicleViewer?.loaded", timeout=20000)
                assert page.locator("body.light-mode").count() == 1
                assert page.locator("#stage > canvas").count() == 1
            page.close()

        first_bh = browser.new_page(viewport={"width": 1366, "height": 768})
        first_bh.route("**/*", serve)
        first_bh.goto("https://vehicle.test/vehicle-viewer.html")
        first_bh.wait_for_function("window.__vehicleViewer?.loaded", timeout=20000)
        first_bh.wait_for_selector("#blackhole-container canvas", timeout=30000)
        assert first_bh.locator("body.bh-mode").count() == 1
        assert first_bh.locator("#blackhole-container canvas").count() == 1
        assert first_bh.locator("#stage > canvas").count() == 1
        first_bh.close()

        reduced = browser.new_page(viewport={"width": 390, "height": 844}, reduced_motion="reduce")
        reduced.route("**/*", serve)
        reduced.add_init_script("localStorage.setItem('acidburn-mode','dark')")
        reduced.goto("https://vehicle.test/vehicle-viewer.html")
        reduced.wait_for_function("window.__vehicleViewer?.loaded", timeout=20000)
        for selector in ("#spin", "#turretAnim", "#jumpBtn"):
            assert reduced.locator(selector).is_disabled()
        reduced.locator('[data-pane-toggle="motion-pane"]').click()
        reduced.locator('[data-pose="walk"]').click()
        assert reduced.locator('[data-pose="stride"]').get_attribute('aria-pressed') == 'true'
        reduced.close()

        no_gl = browser.new_page(viewport={"width": 390, "height": 844})
        no_gl.route("**/*", serve)
        no_gl.add_init_script("""(() => {const original=HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext=function(type,...args){
                if(['webgl','webgl2','experimental-webgl'].includes(type))return null;
                return original.call(this,type,...args);
            }})()""")
        no_gl.goto("https://vehicle.test/vehicle-viewer.html")
        assert "WebGL is unavailable" in no_gl.locator("#status").inner_text()
        no_gl.locator('[data-pane-toggle="details-pane"]').click()
        assert no_gl.locator("#details-pane .vehicle-specs").is_visible()
        no_gl.close()

        hub = browser.new_page(viewport={"width": 1366, "height": 768})
        hub.route("**/*", serve)
        hub.add_init_script("localStorage.setItem('acidburn-mode','dark')")
        hub.goto("https://vehicle.test/maps.html")
        hub.wait_for_selector('a[href="vehicle-viewer.html"]', timeout=15000)
        assert "CHOMP Vehicle Viewer" in hub.locator('a[href="vehicle-viewer.html"]').inner_text()
        hub.close()
        browser.close()


if __name__ == "__main__":
    run()
