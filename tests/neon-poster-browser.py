"""Rendered grid integration, reflected scene, gas maps, poster and portable exports."""
from pathlib import Path
from urllib.parse import urlparse, unquote
from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright
import io, json, mimetypes, zipfile, base64

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'attached_files/neon-poster-checks'
OUT.mkdir(parents=True,exist_ok=True)

def serve(route):
    path=(ROOT/unquote(urlparse(route.request.url).path).lstrip('/')).resolve()
    if path.is_dir():path=path/'index.html'
    if path.is_relative_to(ROOT) and path.is_file():
        route.fulfill(body=path.read_bytes(),content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
    else:route.abort()

def pixels(page):return Image.open(io.BytesIO(page.locator('#neon-scene canvas').screenshot())).convert('RGB')
def apply(page,s):
    frame=page.evaluate('NeonViewer.frames')
    page.evaluate('(s)=>NeonViewer.applySettings(s)',s)
    page.wait_for_function('(f)=>NeonViewer.frames>f',arg=frame)
def draws(page):
    return page.evaluate('()=>{window.drawCount=0;NeonViewer.capture();return window.drawCount}')

with sync_playwright() as p:
    browser=p.chromium.launch(args=['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1100,'height':900})
    page.route('**/*',serve)
    page.add_init_script('''window.drawCount=0;window.skyAllocations=[];const draw=WebGLRenderingContext.prototype.drawElements;WebGLRenderingContext.prototype.drawElements=function(...args){window.drawCount++;return draw.apply(this,args)};const tex=WebGLRenderingContext.prototype.texImage2D;WebGLRenderingContext.prototype.texImage2D=function(...args){if(args.length===9&&args[3]>=2048&&args[4]===args[3]/2)skyAllocations.push([args[3],args[4],args[7]]);return tex.apply(this,args)};''')
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('console',lambda m:errors.append(m.text) if m.type=='error' and ('THREE' in m.text or 'GL_' in m.text) else None)
    page.goto('https://poster.test/neon-black-hole.html')
    page.wait_for_function('window.NeonViewer && NeonViewer.frames>0')
    page.locator('#neon-pause').click()
    initial=page.evaluate('NeonViewer.settings()')
    assert initial['look']['gas_tint']==initial['look']['floor_reflection']==0 and not initial['caption']['enabled']
    # Old saved files acquire all new defaults; bad values fail atomically.
    old=json.loads(json.dumps(initial));del old['caption']
    for key in ['gas_color','gas_texture','gas_tint','floor_concentration','floor_reflection','floor_roughness']:del old['look'][key]
    apply(page,old)
    assert page.evaluate('NeonViewer.settings()')==initial
    for bad in [{'look':{'gas_color':'red'}},{'caption':{'text':'x'*121}},{'caption':{'enabled':'yes'}},{'look':{'floor_reflection':2}},{'caption':{'unknown':True}}]:
        assert page.evaluate('s=>{try{NeonViewer.applySettings(s);return false}catch{return true}}',bad)
        assert page.evaluate('NeonViewer.settings()')==initial
    page.locator('[data-pane-toggle=neon-settings]').click()
    page.locator('#neon-poster-preset').click()
    page.keyboard.press('Escape')
    page.wait_for_function('''[...document.fonts].some(f=>f.family.replaceAll('"','')==='Neon Teko'&&f.status==='loaded')''')
    s=page.evaluate('NeonViewer.settings()')
    assert s['caption']['font']=='Sculpted'
    assert s['observer']['elevation']==0 and s['camera']['height']<0
    assert abs(s['camera']['height']+s['look']['floor_height']-.6)<.00001
    assert s['look']['floor_palette'] and s['look']['floor_color']==s['look']['floor_major_color']
    assert not s['look']['floor_lensing'] and s['caption']['uppercase']
    assert s['look']['disk_tilt']==17 and s['look']['disk_yaw']==90
    assert s['look']['nebula_resolution']=='high' and s['look']['nebula_color']=='#85cfa3'
    assert s['caption']['angular'] and s['caption']['metal']>0 and s['caption']['fuzz']>0
    assert page.evaluate('''()=>{const gl=document.querySelector('#neon-scene canvas').getContext('webgl'),n=Math.min(4096,gl.getParameter(gl.MAX_TEXTURE_SIZE));return skyAllocations.some(a=>a[0]===n&&a[1]===n/2)}'''),'High gas texture was not allocated'
    s['look'].update(auto_res=False,render_scale=.7,bloom_strength=0,sky_motion=False)
    apply(page,s)
    # Isolate the floor in an expanded wide viewport. Its vanishing row must
    # reach both edges at the same height, including fractional pixel coverage.
    only_floor=json.loads(json.dumps(s));only_floor['accretion_disk']=False
    only_floor['look'].update(galaxy_gain=0,floor_reflection=0)
    page.set_viewport_size({'width':1920,'height':1080});page.locator('[data-window-expand]').click()
    apply(page,only_floor)
    raw=page.evaluate('NeonViewer.capture().toDataURL()')
    wide=Image.open(io.BytesIO(base64.b64decode(raw.split(',')[1]))).convert('RGB')
    rows=[]
    for x in [2,wide.width//2,wide.width-3]:
        rows.append(next(y for y in range(wide.height//3,wide.height*4//5) if (lambda rgb:rgb[0]>40 and rgb[0]>rgb[1]*1.3 and rgb[2]>rgb[1]*1.3)(wide.getpixel((x,y)))))
    assert max(rows)-min(rows)<=1,('Horizon ends or shifts at edges',rows)
    wide.save(OUT/'wide-horizon.png')
    page.locator('[data-window-expand]').click();page.set_viewport_size({'width':1100,'height':900});apply(page,s)
    assert abs(page.evaluate('NeonViewer.observer.position.z')+s['look']['floor_height']-.6)<.00001
    assert page.evaluate('''()=>{const o=NeonViewer.observer,e=o.orientation.elements;return new THREE.Vector3(e[6],e[7],e[8]).dot(o.position.clone().normalize().negate())}''')>.999
    gas=pixels(page);s['look']['nebula_amount']=0;apply(page,s)
    assert ImageChops.difference(gas,pixels(page)).getbbox(),'Extra galaxy gas did not change pixels'
    s['look']['nebula_amount']=1.7;apply(page,s)
    high_gas=pixels(page);s['look']['nebula_resolution']='standard';apply(page,s)
    assert ImageChops.difference(high_gas,pixels(page)).getbbox(),'High gas resolution did not change pixels'
    s['look']['nebula_resolution']='high';apply(page,s)
    flat=pixels(page);s['look']['floor_lensing']=True;apply(page,s)
    assert ImageChops.difference(flat,pixels(page)).getbbox(),'Floor lensing toggle did not change pixels'
    s['look']['floor_lensing']=False;apply(page,s)
    s['look']['floor_color']=s['look']['floor_major_color']='#20ff80';apply(page,s);green_floor=pixels(page)
    s['look']['floor_color']=s['look']['floor_major_color']='#e879ef';apply(page,s)
    assert ImageChops.difference(green_floor,pixels(page)).getbbox(),'Custom grid pigment did not change pixels'
    reflected=pixels(page);with_reflection=draws(page)
    assert page.locator('#neon-scene canvas').evaluate("e=>e.getContext('webgl').getError()") == 0
    s['look']['floor_reflection']=0;apply(page,s)
    unreflected=pixels(page);without_reflection=draws(page)
    assert with_reflection==without_reflection+1,(with_reflection,without_reflection)
    assert ImageChops.difference(reflected,unreflected).getbbox(),'Reflection did not change pixels'
    s['look']['floor_reflection']=.45;s['look']['floor_roughness']=.7;apply(page,s)
    assert ImageChops.difference(reflected,pixels(page)).getbbox(),'Roughness did not change pixels'
    # Integrated glow is a property of projected wires and vanishes with them.
    s['look'].update(floor_reflection=0,floor_concentration=0);apply(page,s);no_concentration=pixels(page)
    s['look']['floor_concentration']=30;apply(page,s)
    assert ImageChops.difference(no_concentration,pixels(page)).getbbox(),'Wire concentration did not change pixels'
    s['look']['floor_strength']=0;apply(page,s);invisible=pixels(page)
    s['neon_floor']=False;apply(page,s)
    assert ImageChops.difference(invisible,pixels(page)).getbbox() is None,'Horizon remains when wires are invisible'
    # Gas color affects the raytraced disk independently of temperature.
    s['look']['gas_tint']=1;s['look']['gas_color']='#20ffaa';apply(page,s);green=pixels(page)
    s['look']['gas_color']='#ff5020';apply(page,s)
    assert ImageChops.difference(green,pixels(page)).getbbox(),'Gas tint did not change disk pixels'
    page.locator('[data-pane-toggle=neon-settings]').click()
    page.get_by_text('Disk',exact=True).click()
    buf=io.BytesIO();Image.new('RGB',(128,256),(60,30,15)).save(buf,format='PNG')
    page.locator('#neon-gas-texture').set_input_files({'name':'gas.png','mimeType':'image/png','buffer':buf.getvalue()})
    page.wait_for_function("NeonViewer.settings().look.gas_texture.startsWith('data:image/jpeg;base64,')")
    page.evaluate('async()=>await NeonViewer.textureReady')
    embedded=page.evaluate('NeonViewer.settings().look.gas_texture')
    page.keyboard.press('Escape')
    custom=page.evaluate('NeonViewer.settings()');apply(page,custom)
    mapped=pixels(page)
    custom['look']['gas_texture']='';apply(page,custom)
    assert ImageChops.difference(mapped,pixels(page)).getbbox(),'Custom gas map did not change disk pixels'
    # A distinct text overlay never intercepts navigation or adds a scene canvas.
    assert page.locator('#neon-scene canvas').count()==1
    assert page.locator('.neon-lettering').evaluate('e=>getComputedStyle(e).pointerEvents')=='none'
    for width,height in [(320,568),(390,844),(568,320),(768,1024),(1366,768)]:
        page.set_viewport_size({'width':width,'height':height})
        page.wait_for_timeout(100)
        page.locator('[data-pane-toggle=neon-settings]').click()
        assert page.locator('#neon-settings').evaluate('e=>e.scrollWidth<=e.clientWidth+1'),(width,height)
        page.keyboard.press('Escape')
    page.set_viewport_size({'width':1100,'height':900})
    page.locator('[data-pane-toggle=neon-settings]').click()
    page.locator('#neon-poster-preset').click();page.keyboard.press('Escape')
    page.locator('[data-pane-toggle=neon-settings]').click()
    page.get_by_text('Poster text',exact=True).click()
    def lettering_pixels():
        import base64
        src=page.locator('.neon-lettering').evaluate('e=>e.toDataURL()')
        return Image.open(io.BytesIO(base64.b64decode(src.split(',')[1]))).convert('RGBA')
    detail=lettering_pixels()
    page.locator('#setting-caption-grid').fill('0');page.locator('#setting-caption-grid').press('Tab')
    assert ImageChops.difference(detail,lettering_pixels()).convert('RGB').getbbox(),'Reflected lettering grid did not change pixels'
    page.locator('#setting-caption-grid').fill('.85');page.locator('#setting-caption-grid').press('Tab')
    edged=lettering_pixels();page.locator('#setting-caption-angular').uncheck()
    assert ImageChops.difference(edged,lettering_pixels()).convert('RGB').getbbox(),'Pointed terminals did not change lettering'
    page.locator('#setting-caption-angular').check()
    metal=lettering_pixels();page.locator('#setting-caption-metal').fill('0');page.locator('#setting-caption-metal').press('Tab')
    assert ImageChops.difference(metal,lettering_pixels()).convert('RGB').getbbox(),'Metal surface detail did not change lettering'
    page.locator('#setting-caption-metal').fill('.65');page.locator('#setting-caption-metal').press('Tab')
    page.keyboard.press('Escape')
    # Sculpted counters must be open shapes, rather than the tiny rectangular
    # holes of the previous heavy font. Check the actual exported alpha mask.
    saved=page.evaluate('NeonViewer.settings()');probe=json.loads(json.dumps(saved))
    def import_caption(settings):
        page.locator('[data-pane-toggle=neon-share]').click()
        page.locator('#neon-json').fill(json.dumps(settings));page.locator('#neon-load').click();page.keyboard.press('Escape')
    probe['caption'].update(text='O',size=20,x=50,y=50,stretch=1,bevel=0,glow=0,metal=0,fuzz=0,grid=0)
    import_caption(probe);ink=lettering_pixels();ink.save(OUT/'counter-probe.png');cx,cy=ink.width//2,ink.height//2;em=ink.height*.2
    assert ink.crop((int(cx-em*.1),int(cy-em*.2),int(cx+em*.1),int(cy+em*.2))).getchannel('A').getbbox() is None,'Sculpted O counter is not open'
    probe['caption']['text']='ABCDEFGHIJKLMNOPQRSTUVWXYZ|0123456789 !?';import_caption(probe)
    assert lettering_pixels().getchannel('A').getbbox(),'Editable alphabet/fallback characters did not render'
    import_caption(saved)
    s=page.evaluate('NeonViewer.settings()');s['look'].update(auto_res=False,render_scale=.85,bloom_strength=.35)
    apply(page,s);page.screenshot(path=str(OUT/'warm-chrome.png'))
    page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(150)
    page.screenshot(path=str(OUT/'warm-phone.png'))
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
    page.set_viewport_size({'width':1100,'height':900});apply(page,s)
    page.locator('[data-pane-toggle=neon-share]').click()
    with page.expect_download() as png:page.locator('#neon-image').click()
    png.value.save_as(OUT/'poster.png')
    image=Image.open(OUT/'poster.png').convert('RGB')
    assert image.size==tuple(page.locator('#neon-scene canvas').evaluate('e=>[e.width,e.height]'))
    assert len(image.getcolors(image.width*image.height))>100,'PNG is blank'
    # PNG includes text but no controls; compare it with the raw renderer capture.
    raw=page.evaluate('NeonViewer.capture().toDataURL()')
    import base64
    raw_image=Image.open(io.BytesIO(base64.b64decode(raw.split(',')[1]))).convert('RGB')
    assert ImageChops.difference(image,raw_image).getbbox(),'Poster text missing from PNG'
    s['look']['gas_texture']=embedded;apply(page,s)
    with page.expect_download(timeout=60000) as archive:page.locator('#neon-zip').click()
    archive.value.save_as(OUT/'poster.zip')
    with zipfile.ZipFile(OUT/'poster.zip') as z:
        assert z.testzip() is None and json.loads(z.read('settings.json'))==s
        assert z.read('fonts/Teko.ttf').startswith(b'\x00\x01\x00\x00')
        assert b'SIL OPEN FONT LICENSE' in z.read('fonts/OFL.txt')
        z.extractall(OUT/'standalone')
    page.goto('https://poster.test/attached_files/neon-poster-checks/standalone/index.html')
    page.wait_for_function('window.NeonViewer && NeonViewer.frames>0')
    page.wait_for_function('''[...document.fonts].some(f=>f.family.replaceAll('"','')==='Neon Teko'&&f.status==='loaded')''')
    assert page.evaluate('NeonViewer.settings()')==s
    assert page.locator('.neon-lettering').is_visible()
    page.locator('#neon-reset').click()
    assert page.evaluate('NeonViewer.settings()')==s
    page.locator('[data-pane-toggle=neon-share]').click()
    with page.expect_download(timeout=60000) as archive:page.locator('#neon-zip').click()
    archive.value.save_as(OUT/'reexport.zip')
    with zipfile.ZipFile(OUT/'reexport.zip') as z:assert json.loads(z.read('settings.json'))==s
    assert not errors,errors
    print('PASS low camera aim, consistent grid pigments/lensing, nebula gas, beveled lettering grid, tint/map, reflection pass/roughness, atomic JSON, five sizes, PNG and standalone ZIP re-export.')
    browser.close()
