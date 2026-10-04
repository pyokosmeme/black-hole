"""The infinite floor converges to a bright horizon; bounded floor stays faint."""
from pathlib import Path
from urllib.parse import urlparse
import io,mimetypes,subprocess
from PIL import Image,ImageChops
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'attached_files/neon-checks';OUT.mkdir(parents=True,exist_ok=True)
BASE=subprocess.check_output(['git','show','42cf2c6:neon/raytracer-neon.glsl'],cwd=ROOT)
black=io.BytesIO();Image.new('RGBA',(16,8),(0,0,0,255)).save(black,format='PNG')
def peak_row(image):
    w,h=image.size;p=image.load();xs=list(range(w//5))+list(range(w*4//5,w))
    return max(sum(sum(p[x,y]) for x in xs)/len(xs) for y in range(h))
with sync_playwright() as p:
    browser=p.chromium.launch(args=['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    results=[]
    for old in [True,False]:
        page=browser.new_page(viewport={'width':900,'height':700})
        def serve(route):
            name=urlparse(route.request.url).path.lstrip('/');path=(ROOT/name).resolve()
            if name=='neon/img/stars.png':route.fulfill(body=black.getvalue(),content_type='image/png')
            elif path.is_relative_to(ROOT) and path.is_file():route.fulfill(body=BASE if old and name=='neon/raytracer-neon.glsl' else path.read_bytes(),content_type=mimetypes.guess_type(name)[0] or 'application/octet-stream')
            else:route.abort()
        page.route('**/*',serve);errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda m:errors.append(m.text) if m.type=='error' and 'THREE.WebGL' in m.text else None)
        page.goto('https://horizon.test/neon-black-hole.html')
        page.wait_for_function('window.NeonViewer && NeonViewer.frames>0')
        page.evaluate('NeonViewer.setPaused(true)');s=page.evaluate('NeonViewer.settings()')
        s['observer'].update(motion=False,distance=18,elevation=0)
        s['camera'].update(height=-5.4,pitch=0,yaw=0)
        s['look'].update(auto_res=False,render_scale=1,bloom_strength=0,galaxy_gain=0,floor_tilt=0,floor_follow_camera=False,antialiasing=False)
        s.update(accretion_disk=False,neon_grid=False,neon_floor=True);s['planet']['enabled']=False
        images=[]
        for infinite in [True,False]:
            s['look']['floor_infinite']=infinite;f=page.evaluate('NeonViewer.frames')
            page.evaluate('(s)=>NeonViewer.applySettings(s)',s)
            page.wait_for_function('(f)=>NeonViewer.frames>f',arg=f)
            png=page.locator('#neon-scene canvas').screenshot(style='.map-hud,.neon-status,.neon-camera-controls{visibility:hidden!important}')
            images.append(Image.open(io.BytesIO(png)).convert('RGB'))
        images[0].save(OUT/('horizon-before.png' if old else 'horizon-after.png'))
        assert not errors,errors;results.append(images);page.close()
    assert peak_row(results[1][0])>peak_row(results[0][0])*1.15,('Horizon did not brighten',peak_row(results[0][0]),peak_row(results[1][0]))
    # The improved ray solver shifts the projected wires slightly; compare the
    # horizon against the current bounded plane rather than demanding old pixels.
    assert peak_row(results[1][0])>peak_row(results[1][1])*1.15,'Horizon leaked into bounded floor'
    print('PASS brighter integrated horizon, bounded floor without horizon glow, no shader errors; peak row before/after:',peak_row(results[0][0]),peak_row(results[1][0]),flush=True)
    browser.close()
