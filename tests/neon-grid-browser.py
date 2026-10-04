"""Compare rendered wire coverage and transparent floor cells with the shipped grid."""
from pathlib import Path
from urllib.parse import urlparse
import io, mimetypes, subprocess
from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'attached_files/neon-checks'
OUT.mkdir(parents=True,exist_ok=True)
BASELINE=subprocess.check_output(['git','show','8cdd76c:neon/raytracer-neon.glsl'],cwd=ROOT)

def coverage(a,b):
    return sum(max(pixel)>4 for pixel in ImageChops.difference(a,b).getdata())

with sync_playwright() as p:
    browser=p.chromium.launch(args=['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    results=[]
    for old in [True,False]:
        page=browser.new_page(viewport={'width':900,'height':700})
        def serve(route):
            name=urlparse(route.request.url).path.lstrip('/')
            path=(ROOT/name).resolve()
            if path.is_relative_to(ROOT) and path.is_file():
                data=BASELINE if old and name=='neon/raytracer-neon.glsl' else path.read_bytes()
                route.fulfill(body=data,content_type=mimetypes.guess_type(name)[0] or 'application/octet-stream')
            else:route.abort()
        page.route('**/*',serve)
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda m:errors.append(m.text) if m.type=='error' and 'THREE.WebGL' in m.text else None)
        page.goto('https://grid.test/neon-black-hole.html')
        page.wait_for_function('window.NeonViewer && NeonViewer.frames>0')
        page.evaluate('NeonViewer.setPaused(true)')
        s=page.evaluate('NeonViewer.settings()')
        s['observer'].update(motion=False,distance=14,elevation=15,azimuth=0)
        s['camera'].update(pitch=0,yaw=0)
        s['look'].update(auto_res=False,render_scale=1,bloom_strength=0,floor_follow_camera=False,floor_height=5.9,grid_strength=.15)
        s['planet']['enabled']=False
        s['accretion_disk']=False
        def render(floor,grid):
            s.update(neon_floor=floor,neon_grid=grid)
            frame=page.evaluate('NeonViewer.frames')
            page.evaluate('(s)=>NeonViewer.applySettings(s)',s)
            page.wait_for_function('(f)=>NeonViewer.frames>f',arg=frame)
            return Image.open(io.BytesIO(page.locator('#neon-scene canvas').screenshot())).convert('RGB')
        base=render(False,False)
        floor=render(True,False)
        grid=render(False,True)
        label='before' if old else 'after'
        floor.save(OUT/('grid-floor-'+label+'.png'))
        grid.save(OUT/('grid-sky-'+label+'.png'))
        results.append((coverage(base,floor),coverage(base,grid)))
        # Also compile the bounded floor variant, which uses a different fade.
        s['look']['floor_infinite']=False
        render(True,True)
        assert not errors,errors
        page.close()
    assert 0<results[1][0]<results[0][0]*.55,('Floor cells remain filled',results)
    assert 0<results[1][1]<results[0][1]*.8,('Sky grid footprint did not thin',results)
    print('PASS transparent floor cells, thinner sky wires, infinite/bounded shader variants; changed pixels before/after:',results,flush=True)
    browser.close()
