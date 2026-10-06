"""The straight grid may not paint over the opaque black-hole shadow."""
from pathlib import Path
from urllib.parse import urlparse,unquote
from playwright.sync_api import sync_playwright
from PIL import Image,ImageChops
import base64,io,mimetypes
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'attached_files/neon-floor-occlusion-checks'
OUT.mkdir(parents=True,exist_ok=True)
def serve(route):
    path=(ROOT/unquote(urlparse(route.request.url).path).lstrip('/')).resolve()
    if path.is_relative_to(ROOT) and path.is_file():route.fulfill(body=path.read_bytes(),content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
    else:route.abort()
def capture(page,settings):
    frame=page.evaluate('NeonViewer.frames');page.evaluate('(s)=>NeonViewer.applySettings(s)',settings)
    page.wait_for_function('(f)=>NeonViewer.frames>f',arg=frame)
    src=page.evaluate('NeonViewer.capture().toDataURL()')
    return Image.open(io.BytesIO(base64.b64decode(src.split(',')[1]))).convert('RGB')
with sync_playwright() as p:
    browser=p.chromium.launch(args=['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':900,'height':700},reduced_motion='reduce');page.route('**/*',serve)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda m:errors.append(m.text) if m.type=='error' and 'THREE' in m.text else None)
    page.goto('https://occlusion.test/neon-black-hole.html');page.wait_for_function('window.NeonViewer && NeonViewer.frames>0')
    page.locator('[data-window-expand]').click()
    s=page.evaluate('NeonViewer.settings()');s['accretion_disk']=False;s['neon_grid']=False;s['neon_floor']=False
    s['observer'].update(motion=False,azimuth=0,elevation=0,distance=30,rotation_speed=0)
    s['camera'].update(height=0,pitch=0,yaw=0,wobble_pitch=0,wobble_yaw=0)
    s['look'].update(floor_follow_camera=False,floor_height=.5,floor_tilt=0,floor_lensing=False,floor_infinite=True,floor_reflection=0,floor_strength=3,floor_concentration=40,floor_cell=.5,floor_speed=0,floor_sway=0,floor_palette=True,floor_color='#e879ef',floor_major_color='#e879ef',galaxy_gain=0,sky_motion=False,bloom_strength=0,auto_res=False,render_scale=1,antialiasing=False)
    absent=capture(page,s);s['neon_floor']=True;present=capture(page,s)
    cx,cy=present.width//2,present.height//2;core=(cx-12,cy+3,cx+12,cy+24)
    assert max(absent.crop(core).getextrema()[i][1] for i in range(3))==0,'Probe does not cover the black-hole shadow'
    assert ImageChops.difference(absent.crop(core),present.crop(core)).getbbox() is None,'Grid paints over the black-hole shadow'
    assert ImageChops.difference(absent,present).getbbox(),'Floor disappeared outside the hole'
    assert present.crop((0,present.height*3//4,present.width,present.height)).getbbox(),'Foreground grid is missing'
    present.save(OUT/'occluded-grid.png')
    # An opaque, non-emitting floor absorbs the underlying sky, independent
    # of its brightness. Reflection remains visible on that solid surface.
    s['look'].update(floor_strength=0,floor_opaque=False,galaxy_gain=2)
    transparent=capture(page,s);region=(0,present.height*3//4,present.width,present.height)
    assert transparent.crop(region).getbbox(),'Transparency probe has no underlying sky'
    s['look']['floor_opaque']=True;opaque=capture(page,s)
    assert opaque.crop(region).getbbox() is None,'Opaque floor still reveals the sky'
    s['look']['galaxy_gain']=4;brighter=capture(page,s)
    assert brighter.crop(region).getbbox() is None,'Underlying sky brightness leaks through the floor'
    s['look']['floor_reflection']=.45;mirror=capture(page,s)
    assert mirror.crop(region).getbbox(),'Opaque floor lost its reflection'
    mirror.save(OUT/'opaque-mirror.png')
    assert not errors,errors
    print('PASS black-hole occlusion, surrounding grid, opaque surface without sky leakage, retained reflection and no shader errors.')
    browser.close()
