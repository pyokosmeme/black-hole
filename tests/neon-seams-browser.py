"""Check escaping rays converge at normal quality instead of step-count seams."""
from pathlib import Path
from urllib.parse import urlparse
import io,mimetypes,subprocess
from PIL import Image,ImageChops,ImageStat
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'attached_files/neon-checks';OUT.mkdir(parents=True,exist_ok=True)
OLD=subprocess.check_output(['git','show','d024932:neon/raytracer-neon.glsl'],cwd=ROOT).decode()
NEW=(ROOT/'neon/raytracer-neon.glsl').read_text()
def difference(a,b):
    # Outer strips contain the screenshot's distant grid, away from the shadow.
    w,h=a.size
    diff=ImageChops.difference(a,b)
    return sum(sum(ImageStat.Stat(diff.crop(box)).mean) for box in [(0,0,w//5,h),(w*4//5,0,w,h)])
with sync_playwright() as p:
    browser=p.chromium.launch(args=['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    results=[]
    for old in [True,False]:
        page=browser.new_page(viewport={'width':1400,'height':900})
        def serve(route):
            name=urlparse(route.request.url).path.lstrip('/');path=(ROOT/name).resolve()
            if not path.is_relative_to(ROOT) or not path.is_file():route.abort();return
            data=path.read_bytes()
            if name=='neon/raytracer-neon.glsl':data=(OLD if old else NEW).encode()
            route.fulfill(body=data,content_type=mimetypes.guess_type(name)[0] or 'application/octet-stream')
        page.route('**/*',serve);errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda m:errors.append(m.text) if m.type=='error' and 'THREE.WebGL' in m.text else None)
        page.goto('https://seams.test/neon-black-hole.html')
        page.wait_for_function('window.NeonViewer && NeonViewer.frames>0');page.evaluate('NeonViewer.setPaused(true)')
        s=page.evaluate('NeonViewer.settings()')
        s['observer'].update(motion=False,distance=8,elevation=0,azimuth=-90)
        s['look'].update(auto_res=False,render_scale=1,grid_strength=.25,grid_glow=1,grid_pulse=0,bloom_strength=0,antialiasing=False)
        s.update(accretion_disk=False,neon_floor=False);s['planet']['enabled']=False
        def shot():return Image.open(io.BytesIO(page.locator('#neon-scene canvas').screenshot(style='.map-hud,.neon-status,.neon-camera-controls{visibility:hidden!important}'))).convert('RGB')
        # Capture actual scene before replacing the output with a direction probe.
        page.evaluate('(s)=>NeonViewer.applySettings(s)',s);page.wait_for_timeout(150)
        shot().save(OUT/('seams-before.png' if old else 'seams-after.png'))
        # Probe escape directions without sky textures, bloom or grid AA hiding
        # their discontinuities. Override only this test's shader and compositor.
        diagnostic=(OLD if old else NEW).replace('gl_FragColor = color*ray_intensity;','gl_FragColor = vec4(0.5 + 0.5 * esc, 1.0);')
        page.route('**/neon/raytracer-neon.glsl',lambda r:r.fulfill(body=diagnostic,content_type='text/plain'))
        # A reload loads the diagnostic template; other assets remain real.
        page.reload();page.wait_for_function('window.NeonViewer && NeonViewer.frames>0');page.evaluate('NeonViewer.setPaused(true)')
        images=[]
        for steps in [60,300]:
            s['n_steps']=steps;f=page.evaluate('NeonViewer.frames');page.evaluate('(s)=>NeonViewer.applySettings(s)',s)
            page.wait_for_function('(f)=>NeonViewer.frames>f',arg=f);images.append(shot())
        results.append(difference(*images));assert not errors,errors;page.close()
    assert results[1]<results[0]*.25,('Escape direction convergence did not improve',results)
    print('PASS normal/high-quality escape direction error reduced; before/after:',results,flush=True)
    browser.close()
