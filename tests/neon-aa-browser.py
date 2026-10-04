"""Verify AA changes rendered edges, restores exact pixels off, and resizes safely."""
from pathlib import Path
from urllib.parse import urlparse
import io,mimetypes
from PIL import Image,ImageChops,ImageStat
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'attached_files/neon-checks';OUT.mkdir(parents=True,exist_ok=True)
def edge_energy(image):
    w,h=image.size
    x=ImageChops.difference(image.crop((0,0,w-1,h)),image.crop((1,0,w,h)))
    y=ImageChops.difference(image.crop((0,0,w,h-1)),image.crop((0,1,w,h)))
    return sum(ImageStat.Stat(x).sum2)+sum(ImageStat.Stat(y).sum2)
with sync_playwright() as p:
    browser=p.chromium.launch(args=['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':900,'height':700})
    def serve(route):
        name=urlparse(route.request.url).path.lstrip('/')
        path=(ROOT/name).resolve()
        if path.is_relative_to(ROOT) and path.is_file():route.fulfill(body=path.read_bytes(),content_type=mimetypes.guess_type(name)[0] or 'application/octet-stream')
        else:route.abort()
    page.route('**/*',serve)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda m:errors.append(m.text) if m.type=='error' and 'THREE.WebGL' in m.text else None)
    page.goto('https://aa.test/neon-black-hole.html')
    page.wait_for_function('window.NeonViewer && NeonViewer.frames>0')
    page.evaluate('NeonViewer.setPaused(true)')
    s=page.evaluate('NeonViewer.settings()')
    assert s['look']['grid_strength']==.05 and s['look']['grid_glow']==0,'Viewer grid defaults changed'
    s['observer'].update(motion=False,distance=14)
    s['camera'].update(wobble_pitch=0,wobble_yaw=0)
    s['look'].update(auto_res=False,render_scale=1,grid_strength=.5,bloom_strength=0,antialiasing=False)
    page.evaluate('(s)=>NeonViewer.applySettings(s)',s)
    def shot():
        f=page.evaluate('NeonViewer.frames');page.evaluate('NeonViewer.recompile()')
        page.wait_for_function('(f)=>NeonViewer.frames>f',arg=f)
        return Image.open(io.BytesIO(page.locator('#neon-scene canvas').screenshot(style='.map-hud,.neon-status,.neon-camera-controls{visibility:hidden!important}'))).convert('RGB')
    off=shot()
    page.locator('[data-pane-toggle=neon-settings]').click()
    page.locator('summary').filter(has_text='Post / performance').click()
    control=page.locator('#setting-look-antialiasing');control.check()
    assert page.evaluate('NeonViewer.settings().look.antialiasing')
    page.keyboard.press('Escape');on=shot()
    assert off.size==on.size
    assert ImageChops.difference(off,on).getbbox() is not None
    assert edge_energy(on)<edge_energy(off),('AA did not soften jagged edges',edge_energy(off),edge_energy(on))
    off.save(OUT/'aa-off.png');on.save(OUT/'aa-on.png')
    page.locator('[data-pane-toggle=neon-settings]').click();control.uncheck()
    page.keyboard.press('Escape');restored=shot()
    assert ImageChops.difference(off,restored).getbbox() is None,'Off did not restore original pixels'
    s['look']['antialiasing']=True;page.evaluate('(s)=>NeonViewer.applySettings(s)',s)
    for width,height in [(390,844),(568,320),(1366,768)]:
        page.set_viewport_size({'width':width,'height':height});shot()
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert not errors,errors
    print('PASS FXAA toggle reduces edge energy, preserves dimensions, restores identical off pixels and handles phone/desktop resizing:',edge_energy(off),edge_energy(on),flush=True)
    browser.close()
