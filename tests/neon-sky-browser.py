"""Sky motion changes actual sky pixels while leaving the grid/camera fixed."""
from pathlib import Path
from urllib.parse import urlparse
import io,mimetypes
from PIL import Image,ImageChops
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'attached_files/neon-checks';OUT.mkdir(parents=True,exist_ok=True)
black=io.BytesIO();Image.new('RGBA',(16,8),(0,0,0,255)).save(black,format='PNG')
with sync_playwright() as p:
    browser=p.chromium.launch(args=['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    for grid_only in [False,True]:
        page=browser.new_page(viewport={'width':900,'height':700})
        def serve(route):
            name=urlparse(route.request.url).path.lstrip('/')
            path=(ROOT/name).resolve()
            if grid_only and name=='neon/img/stars.png':route.fulfill(body=black.getvalue(),content_type='image/png')
            elif path.is_relative_to(ROOT) and path.is_file():route.fulfill(body=path.read_bytes(),content_type=mimetypes.guess_type(name)[0] or 'application/octet-stream')
            else:route.abort()
        page.route('**/*',serve)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda m:errors.append(m.text) if m.type=='error' and 'THREE.WebGL' in m.text else None)
        page.goto('https://sky.test/neon-black-hole.html')
        page.wait_for_function('window.NeonViewer && NeonViewer.frames>0')
        page.evaluate('NeonViewer.setPaused(true)')
        s=page.evaluate('NeonViewer.settings()')
        s['observer'].update(motion=False,distance=14,rotation_speed=0)
        s['camera'].update(wobble_pitch=0,wobble_yaw=0)
        s['look'].update(auto_res=False,render_scale=.85,sky_motion=True,sky_speed=5,sky_axis_tilt=30,grid_pulse=0)
        if grid_only:s['look']['galaxy_gain']=0
        s.update(accretion_disk=False,neon_floor=False)
        s['planet']['enabled']=False
        page.evaluate('(s)=>NeonViewer.applySettings(s)',s)
        def shot():
            f=page.evaluate('NeonViewer.frames');page.evaluate('NeonViewer.recompile()')
            page.wait_for_function('(f)=>NeonViewer.frames>f',arg=f)
            return Image.open(io.BytesIO(page.locator('#neon-scene canvas').screenshot())).convert('RGB')
        first=shot();position=page.evaluate('NeonViewer.observer.position.toArray()')
        page.evaluate('NeonViewer.observer.update(3)')
        second=shot()
        assert page.evaluate('NeonViewer.observer.position.toArray()')==position
        diff=ImageChops.difference(first,second).getbbox()
        assert (diff is None)==grid_only,('Sky must move and grid must stay fixed',grid_only,diff)
        if not grid_only:
            second.save(OUT/'moving-sky.png')
            page.locator('[data-pane-toggle=neon-settings]').click()
            page.locator('summary').filter(has_text='Sky').click()
            control=page.locator('#setting-look-sky_motion');control.check()
            assert page.evaluate('NeonViewer.settings().look.sky_motion')
            control.uncheck();angle=page.evaluate('NeonViewer.observer.skyAngle')
            page.evaluate('NeonViewer.observer.update(2)');assert page.evaluate('NeonViewer.observer.skyAngle')==angle
            control.check();page.locator('#setting-look-sky_speed').fill('-2');page.locator('#setting-look-sky_speed').press('Tab')
            page.evaluate('NeonViewer.observer.update(2)');assert page.evaluate('NeonViewer.observer.skyAngle')<angle
            page.keyboard.press('Escape');page.evaluate('NeonViewer.setPaused(false)')
            start=page.evaluate('NeonViewer.observer.skyAngle');page.wait_for_timeout(200)
            assert page.evaluate('NeonViewer.observer.skyAngle')<start
            page.evaluate('NeonViewer.setPaused(true)');angle=page.evaluate('NeonViewer.observer.skyAngle')
            page.wait_for_timeout(200);assert page.evaluate('NeonViewer.observer.skyAngle')==angle
        assert not errors,errors
        page.close()
    print('PASS actual star/galaxy motion, identical grid pixels, fixed camera, viewer controls, reverse, stop-in-place and Pause.',flush=True)
    browser.close()
