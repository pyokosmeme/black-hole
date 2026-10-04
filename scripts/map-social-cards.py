"""Render share images from the actual maps and shared Acid Burn components.

Run with C:\\Python314\\python.exe scripts/map-social-cards.py.
Only the generated JPEGs are public; fixtures and this builder are excluded.
"""
from pathlib import Path
from urllib.parse import urlparse, unquote
import base64
import html
import json
import mimetypes
import sys
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'img/social'
SHOTS = ROOT / 'attached_files/map-social-scenes'
LINKS = json.loads((ROOT / 'maps/config.json').read_text(encoding='utf-8'))['links']

def serve(route):
    url = urlparse(route.request.url)
    if url.hostname == 'fonts.googleapis.com':
        route.fulfill(content_type='text/css', body='''
        @font-face {font-family:'Orbitron';font-weight:400 900;src:url(https://cards.test/tests/fixtures/fonts/orbitron-700.ttf)}
        @font-face {font-family:'Share Tech Mono';src:url(https://cards.test/tests/fixtures/fonts/share-tech-mono-400.ttf)}''')
        return
    if url.hostname != 'cards.test':
        route.abort()
        return
    path = (ROOT / unquote(url.path).lstrip('/')).resolve()
    if not path.suffix:
        path = path.with_suffix('.html')
    if path.is_relative_to(ROOT) and path.is_file():
        route.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
    else:
        route.fulfill(status=404, body='Not found')

def card(page, item, scene):
    image = 'data:image/png;base64,' + base64.b64encode(scene.read_bytes()).decode()
    page.set_viewport_size({'width':1200, 'height':630})
    # Fixed export geometry; theme, heading, framing and fonts come from shared CSS.
    page.set_content(f'''<!doctype html><html><head>
      <link rel="stylesheet" href="https://cards.test/css/acidburn.css">
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Orbitron&family=Share+Tech+Mono">
      <style>
        body {{width:1200px;height:630px;overflow:hidden;margin:0;padding:32px;box-sizing:border-box}}
        .social-card {{display:grid;grid-template-columns:530px 1fr;gap:36px;height:566px;margin:0;padding:24px;box-sizing:border-box}}
        .social-scene {{width:100%;height:100%;object-fit:cover;min-height:0}}
        .social-copy {{display:flex;flex-direction:column;justify-content:center;min-width:0}}
        .social-copy .section-header {{display:block;margin:24px 0}}
        .social-copy .section-header h2 {{font-size:40px;line-height:1.25;overflow-wrap:normal}}
        .social-copy .author-bio {{font-size:22px;line-height:1.5}}
        .social-copy .post-date {{font-size:17px}}
      </style></head><body class="dark-mode">
      <article class="author-card social-card">
        <img class="social-scene" src="{image}" alt="">
        <div class="social-copy"><p class="post-date">POSSIBLE TERRITORIES</p>
          <div class="section-header"><h2>{html.escape(item['label'])}</h2></div>
          <div class="author-bio">{html.escape(item['desc'])}</div>
          <p class="post-date">lastnpcalex.agency / {html.escape(item['id'])}</p>
        </div>
      </article></body></html>''')
    page.evaluate('document.fonts.ready')
    page.wait_for_function('document.images[0].complete && document.images[0].naturalWidth > 0')
    assert page.evaluate("document.fonts.check('40px Orbitron') && document.fonts.check('22px \"Share Tech Mono\"')")
    assert page.locator('.social-card').evaluate('(e)=>e.scrollHeight <= e.clientHeight')
    version='v2' if item['id']=='neon-black-hole' else 'v1'
    page.screenshot(path=str(OUT / (item['id']+'-'+version+'.jpg')), type='jpeg', quality=92)

def main():
    OUT.mkdir(exist_ok=True, parents=True)
    SHOTS.mkdir(exist_ok=True, parents=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        context = browser.new_context(viewport={'width':1366,'height':900})
        context.route('**/*', serve)
        context.add_init_script("localStorage.setItem('acidburn-mode','dark')")
        for item in LINKS:
            if len(sys.argv)>1 and item['id'] not in sys.argv[1:]:
                continue
            page = context.new_page()
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.goto('https://cards.test/'+item['url'])
            page.evaluate('document.fonts.ready')
            if item['id']=='neon-black-hole':
                page.wait_for_function('window.NeonViewer?.frames > 2', timeout=60000)
                page.evaluate('''() => {
                  const s=NeonViewer.settings();
                  s.observer.motion=false;s.observer.distance=18;s.observer.azimuth=0;s.observer.elevation=6;
                  s.camera.pitch=0;s.camera.yaw=0;s.camera.height=0;
                  s.camera.offset_x=0;s.camera.offset_y=0;s.camera.offset_z=0;
                  s.look.disk_tilt=0;s.look.disk_yaw=0;s.look.auto_res=false;s.look.render_scale=1;
                  NeonViewer.applySettings(s);NeonViewer.setPaused(true);
                }''')
            elif item['id']=='vehicle-viewer':
                page.wait_for_function('window.__vehicleViewer?.loaded', timeout=60000)
            else:
                page.wait_for_timeout(3000)
            assert not errors, (item['id'], errors)
            # Hide controls only in the capture fixture; no page source is changed.
            page.add_style_tag(content='''
              .map-hud,.map-pane,.map-window > .window-toolbar .window-actions{display:none!important}
              .map-viewport,.orbital-field{width:600px!important;height:600px!important;min-height:600px!important}
            ''')
            page.wait_for_timeout(600)
            if item['id'] in ['exu2374', 'galaxy']:
                page.locator('[data-map-action="fit"]').dispatch_event('click')
                page.wait_for_timeout(600)
            scene = SHOTS / (item['id']+'.png')
            target = page.locator('.map-viewport').first
            if not target.count():
                target = page.locator('#orbital-field')
            target.screenshot(path=str(scene))
            card(page, item, scene)
            print('Rendered',item['id'],flush=True)
            page.close()
        if len(sys.argv)==1:
            page = context.new_page()
            card(page, {'id':'maps','label':'Possible Territories','desc':'Maps and charts of speculative worlds. Explore star systems, transit networks, spacecraft, and a neon black hole.'}, SHOTS/'galaxy.png')
        browser.close()

if __name__ == '__main__':
    main()
