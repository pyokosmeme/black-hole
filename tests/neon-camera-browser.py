"""Camera input, mobile detection and background suppression on the real viewer."""
from pathlib import Path
from urllib.parse import urlparse, unquote
import mimetypes
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
SHOTS=ROOT/'attached_files/neon-checks'
SHOTS.mkdir(parents=True,exist_ok=True)
def serve(route):
    url=urlparse(route.request.url)
    if url.hostname!='camera.test':
        route.abort();return
    path=(ROOT/unquote(url.path).lstrip('/')).resolve()
    if not path.is_relative_to(ROOT) or not path.is_file():
        route.fulfill(status=404);return
    route.fulfill(body=path.read_bytes(),content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')

with sync_playwright() as p:
    browser=p.chromium.launch(args=['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    for kind,opts in [('desktop',{'viewport':{'width':1366,'height':768}}),('arm-laptop',{'viewport':{'width':568,'height':320},'has_touch':True,'user_agent':'Mozilla/5.0 (Windows NT 10.0; ARM64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36'}),('phone',p.devices['iPhone 13']),('tablet',p.devices['iPad Mini'])]:
        context=browser.new_context(**opts)
        context.route('**/*',serve)
        context.add_init_script("localStorage.setItem('acidburn-mode','bh')")
        page=context.new_page();errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda m:errors.append(m.text) if m.type=='error' and 'THREE.WebGL' in m.text else None)
        page.goto('https://camera.test/neon-black-hole.html')
        page.wait_for_function('window.NeonViewer && NeonViewer.frames>1',timeout=60000)
        assert page.locator('#blackhole-container canvas').count()==0
        assert page.evaluate("localStorage.getItem('acidburn-mode')")=='bh'
        for name,feature in [('grid','neon_grid'),('floor','neon_floor')]:
            before=page.evaluate(f'NeonViewer.settings().{feature}')
            page.locator('#neon-'+name).click()
            assert page.evaluate(f'NeonViewer.settings().{feature}')!=before
            page.locator('#neon-'+name).click()
        page.locator('#neon-stationary').click()
        page.locator('#neon-pause').click()
        page.wait_for_timeout(300)
        assert not page.evaluate('NeonViewer.settings().observer.motion')
        assert page.locator('#neon-camera-pad').is_visible()==(kind in ['phone','tablet'])
        position=page.evaluate('NeonViewer.observer.position.toArray()')
        page.locator('#neon-scene').focus();page.keyboard.press('ArrowRight')
        page.wait_for_timeout(200)
        assert page.evaluate('NeonViewer.settings().camera.yaw')==3
        assert page.evaluate('NeonViewer.observer.position.toArray()')==position
        box=page.locator('#neon-scene').bounding_box()
        page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2)
        page.mouse.down();page.mouse.move(box['x']+box['width']/2+30,box['y']+box['height']/2-10);page.mouse.up()
        assert page.evaluate('NeonViewer.settings().camera.yaw')>3
        page.locator('#neon-zoom-in').click()
        assert page.evaluate('NeonViewer.settings().observer.distance')<8
        page.locator('#neon-camera-center').click()
        assert page.evaluate('NeonViewer.settings().camera.yaw')==0
        page.locator('#neon-camera-move').click()
        azimuth=page.evaluate('NeonViewer.settings().observer.azimuth')
        page.locator('#neon-scene').focus();page.keyboard.press('ArrowRight');page.keyboard.press('w')
        assert page.evaluate('NeonViewer.settings().observer.azimuth')==azimuth+3
        assert page.evaluate('NeonViewer.settings().observer.elevation')==3
        page.wait_for_timeout(200)
        assert page.evaluate('NeonViewer.observer.position.toArray()')!=position
        page.locator('#neon-camera-move').click()
        # Disk tilt and optional stationary rotation must remain independent.
        page.evaluate('''()=>{const s=NeonViewer.settings();s.look.disk_tilt=30;s.look.disk_yaw=20;s.observer.rotation_speed=3;s.neon_floor=true;NeonViewer.applySettings(s);NeonViewer.setPaused(false);}''')
        clock=page.evaluate('NeonViewer.observer.time')
        page.wait_for_function('(clock)=>NeonViewer.observer.time>clock',arg=clock,timeout=30000)
        assert page.evaluate('NeonViewer.observer.rotation')>0
        page.evaluate('NeonViewer.setPaused(true)')
        page.wait_for_timeout(100)
        if kind=='desktop':
            page.screenshot(path=str(SHOTS/'stationary-infinite-floor.png'))
            frame=page.evaluate('NeonViewer.frames')
            page.evaluate('''()=>{const s=NeonViewer.settings();s.neon_floor=false;NeonViewer.applySettings(s,true);}''')
            page.wait_for_function('(frame)=>NeonViewer.frames>frame',arg=frame)
            page.screenshot(path=str(SHOTS/'stationary-tilted-disk.png'))
        if kind in ['phone','tablet']:
            pad=page.locator('#neon-camera-pad');r=pad.bounding_box()
            page.mouse.move(r['x']+r['width']/2+25,r['y']+r['height']/2)
            before_yaw=page.evaluate('NeonViewer.settings().camera.yaw')
            page.mouse.down()
            page.wait_for_function('(yaw)=>NeonViewer.settings().camera.yaw>yaw',arg=before_yaw,timeout=30000)
            page.mouse.up()
            yaw=page.evaluate('NeonViewer.settings().camera.yaw');assert yaw>0
            page.wait_for_timeout(200);assert page.evaluate('NeonViewer.settings().camera.yaw')==yaw
            # Cancelled touches must stop continuous motion, too.
            page.mouse.down()
            pad.dispatch_event('pointercancel',{'pointerId':1})
            yaw=page.evaluate('NeonViewer.settings().camera.yaw')
            page.wait_for_timeout(200);assert page.evaluate('NeonViewer.settings().camera.yaw')==yaw
            page.mouse.up()
            cdp=context.new_cdp_session(page)
            cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':r['x']+r['width']/2+25,'y':r['y']+r['height']/2}]})
            page.wait_for_timeout(250)
            cdp.send('Input.dispatchTouchEvent',{'type':'touchCancel','touchPoints':[]})
            yaw=page.evaluate('NeonViewer.settings().camera.yaw')
            page.wait_for_timeout(200);assert page.evaluate('NeonViewer.settings().camera.yaw')==yaw
        page.screenshot(path=str(SHOTS/f'camera-{kind}.png'))
        page.locator('#neon-camera-free').click()
        assert page.evaluate('NeonViewer.settings().camera.navigation')=='free'
        offset=page.evaluate('NeonViewer.settings().camera.offset_x')
        page.locator('#neon-scene').focus();page.keyboard.press('Shift+d')
        assert page.evaluate('NeonViewer.settings().camera.offset_x')!=offset
        page.locator('#neon-camera-free').click()
        if kind=='phone':
            for width,height in [(320,568),(568,320),(390,844)]:
                page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(200)
                assert page.locator('#neon-camera-controls').evaluate('e=>{const r=e.getBoundingClientRect(),v=e.closest(".map-viewport").getBoundingClientRect(),t=e.closest(".map-viewport").querySelector(".map-hud-tl").getBoundingClientRect();return r.left>=v.left&&r.right<=v.right&&r.bottom<=v.bottom&&r.top>=t.bottom;}'),(width,height)
                page.screenshot(path=str(SHOTS/f'camera-phone-{width}x{height}.png'))
        page.locator('[data-pane-toggle=neon-settings]').click()
        assert not page.locator('#neon-camera-controls').is_visible()
        page.keyboard.press('Escape')
        page.locator('#neon-stationary').click()
        assert page.evaluate('NeonViewer.settings().observer.motion')
        assert not page.locator('#neon-camera-controls').is_visible()
        assert not errors,errors
        print('PASS stationary fixed position, look/zoom, toggles and device controls:',kind,flush=True)
        context.close()
    browser.close()
