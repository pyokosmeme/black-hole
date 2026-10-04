"""Actual translated camera, fixed floor, tilted eccentric planet and embedded map export."""
from pathlib import Path
from urllib.parse import urlparse
from PIL import Image, ImageChops
import io,json,mimetypes,zipfile
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'attached_files/neon-checks';OUT.mkdir(parents=True,exist_ok=True)
def serve(route):
    name=urlparse(route.request.url).path.lstrip('/')
    path=(ROOT/name).resolve()
    if path.is_relative_to(ROOT) and path.is_file():route.fulfill(body=path.read_bytes(),content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
    else:route.abort()
def screenshot(page):return Image.open(io.BytesIO(page.locator('#neon-scene canvas').screenshot())).convert('RGB')
def apply(page,settings):
    frame=page.evaluate('NeonViewer.frames')
    page.evaluate('(s)=>NeonViewer.applySettings(s)',settings)
    page.wait_for_function('(f)=>NeonViewer.frames>f',arg=frame,timeout=30000)

with sync_playwright() as p:
    browser=p.chromium.launch(args=['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':900,'height':700});page.route('**/*',serve)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda m:errors.append(m.text) if m.type=='error' and 'THREE.WebGL' in m.text else None)
    page.goto('https://planet.test/neon-black-hole.html')
    page.wait_for_function('window.NeonViewer && NeonViewer.frames>0')
    page.locator('#neon-stationary').click();page.locator('#neon-pause').click()
    s=page.evaluate('NeonViewer.settings()');s['look']['auto_res']=False;s['look']['render_scale']=.5
    s['camera']['navigation']='free';apply(page,s)
    page.locator('#neon-scene').focus()
    page.keyboard.press('d');first=page.evaluate('NeonViewer.settings().camera.offset_x')
    assert abs(first-.1)<.0001
    page.keyboard.press('Shift+d');second=page.evaluate('NeonViewer.settings().camera.offset_x')
    assert abs(second-first-.01)<.0001
    page.keyboard.press('e');assert page.evaluate('NeonViewer.settings().camera.offset_z')>.09
    page.keyboard.press('w');assert page.evaluate('NeonViewer.settings().camera.offset_y')>0
    s=page.evaluate('NeonViewer.settings()');s['neon_floor']=True;s['look']['floor_follow_camera']=False;s['look']['floor_height']=12
    apply(page,s);floor0=screenshot(page)
    s['look']['floor_height']=20;s['look']['floor_x']=3;s['look']['floor_y']=-4;apply(page,s)
    assert ImageChops.difference(floor0,screenshot(page)).getbbox() is not None
    page.screenshot(path=str(OUT/'fixed-floor-placement.png'))
    s['neon_floor']=False;s['accretion_disk']=False;s['observer']['distance']=14
    s['observer']['elevation']=0;s['observer']['azimuth']=-90
    for axis in ['x','y','z']:s['camera']['offset_'+axis]=0
    s['camera']['pitch']=s['camera']['yaw']=0
    s['planet'].update(enabled=True,distance=7,radius=1,eccentricity=.2,inclination=35,node=15,phase=-90,speed=0,spin=0)
    apply(page,s);with_planet=screenshot(page)
    s['planet']['enabled']=False;apply(page,s)
    assert ImageChops.difference(with_planet,screenshot(page)).getbbox() is not None,'Planet is invisible'
    s['planet']['enabled']=True;apply(page,s)
    page.locator('[data-pane-toggle=neon-settings]').click()
    page.locator('summary').filter(has_text='Planet').click()
    png=io.BytesIO();map_image=Image.new('RGB',(256,128),(20,240,80));map_image.paste((250,30,60),(0,0,128,128));map_image.save(png,format='PNG')
    page.locator('#neon-planet-texture').set_input_files({'name':'green-map.png','mimeType':'image/png','buffer':png.getvalue()})
    page.wait_for_function("NeonViewer.settings().planet.texture.startsWith('data:image/jpeg;base64,')")
    page.evaluate('async()=>await NeonViewer.textureReady')
    assert 'Planet texture loaded' in page.locator('#neon-settings .neon-feedback').inner_text()
    page.keyboard.press('Escape');page.wait_for_timeout(200)
    assert ImageChops.difference(with_planet,screenshot(page)).getbbox() is not None,'Uploaded texture did not change planet pixels'
    textured=screenshot(page)
    custom=page.evaluate('NeonViewer.settings()');custom['planet']['texture_offset']=.5;apply(page,custom)
    assert ImageChops.difference(textured,screenshot(page)).getbbox() is not None,'Texture longitude mapping has no effect'
    custom['look'].update(sky_motion=True,sky_speed=2,sky_axis_tilt=30,antialiasing=True);apply(page,custom)
    page.screenshot(path=str(OUT/'custom-textured-planet.png'))
    page.locator('[data-pane-toggle=neon-share]').click()
    with page.expect_download() as download:page.locator('#neon-zip').click()
    download.value.save_as(OUT/'planet-export.zip')
    exported=OUT/'planet-exported'
    with zipfile.ZipFile(OUT/'planet-export.zip') as z:
        chosen=json.loads(z.read('settings.json'));assert chosen['planet']['texture'].startswith('data:image/jpeg;base64,')
        assert chosen['look']['sky_motion'] and chosen['look']['sky_speed']==2 and chosen['look']['sky_axis_tilt']==30
        assert chosen['look']['antialiasing']
        assert chosen['planet']['eccentricity']==.2 and chosen['planet']['inclination']==35
        z.extractall(exported)
    page.goto('https://planet.test/attached_files/neon-checks/planet-exported/index.html')
    page.wait_for_function('window.NeonViewer && NeonViewer.frames>0')
    page.evaluate('async()=>await NeonViewer.textureReady')
    assert page.evaluate('NeonViewer.settings()')==chosen
    # All new parameters and the image survive JSON import and both shaders.
    page.evaluate('NeonViewer.setPaused(true)')
    chosen['renderer']='original';apply(page,chosen)
    page.locator('[data-pane-toggle=neon-settings]').click();page.locator('summary').filter(has_text='Planet').click()
    page.locator('#neon-planet-texture-reset').click()
    assert page.evaluate('NeonViewer.settings().planet.texture')==''
    assert not errors,errors
    print('PASS fine free camera, floor placement, visible inclined eccentric planet, custom mapped pixels, ZIP round-trip and original shader.',flush=True)
    browser.close()
