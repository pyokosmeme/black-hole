"""Compare unchanged background pixels and allocation counts to the shipped renderer."""
from pathlib import Path
import subprocess, mimetypes, io
from urllib.parse import urlparse
from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
SHOTS=ROOT/'attached_files/neon-checks'
SHOTS.mkdir(parents=True,exist_ok=True)
def source(name,old):
    # Compare allocation/lifecycle behavior with the same current shaders.
    # The ray solver has intentionally changed since the shipped JS baseline.
    if old and name == 'neon/js-libs/neon-blackhole.js':
        return subprocess.check_output(['git','show','0b33837:'+name],cwd=ROOT)
    return (ROOT/name).read_bytes()

with sync_playwright() as p:
    browser=p.chromium.launch(args=['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    results=[]
    for old in [True,False]:
        page=browser.new_page(viewport={'width':640,'height':360})
        def serve(route):
            name=urlparse(route.request.url).path.lstrip('/')
            if name=='fixture':
                route.fulfill(content_type='text/html',body='''<style>body{margin:0}#scene{width:640px;height:360px}</style><div id="scene"></div>
<script>performance.now=()=>1000;window.framesQueue=[];requestAnimationFrame=fn=>(framesQueue.push(fn),framesQueue.length);cancelAnimationFrame=()=>{};window.allocations=0;window.galaxies=0;</script>
<script src="/neon/js-libs/three.min.js"></script><script src="/neon/js-libs/Detector.js"></script><script src="/neon/js-libs/mustache.min.js"></script><script src="/neon/js-libs/three-js-monkey-patch.js"></script><script src="/neon/js-libs/acidburn-galaxy.js"></script><script src="/neon/settings.js"></script>
<script>const target=THREE.WebGLRenderTarget;THREE.WebGLRenderTarget=function(...args){allocations++;return new target(...args);};THREE.WebGLRenderTarget.prototype=target.prototype;const generate=AcidburnGalaxy.generate;AcidburnGalaxy.generate=function(...args){galaxies++;return generate(...args);};</script>
<script src="/neon/js-libs/neon-blackhole.js"></script><script>window.v=createNeonBlackhole({container:document.getElementById('scene'),base:'/neon/',test:true});v.setPaused(true);</script>''')
            elif (ROOT/name).is_file():route.fulfill(body=source(name,old),content_type=mimetypes.guess_type(name)[0] or 'application/octet-stream')
            else:route.abort()
        page.route('**/*',serve)
        errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('https://optimization.test/fixture')
        page.wait_for_function('v.isReady && framesQueue.length>0')
        # Grid styling deliberately changes; isolate the allocation optimization
        # comparison to the disk and sky, with the grid disabled in both builds.
        page.evaluate('v.params.neon_grid=false;v.recompile();framesQueue.pop()(performance.now())')
        before=page.evaluate('allocations')
        page.evaluate("()=>{for(let i=0;i<5;i++)window.dispatchEvent(new Event('resize'));}")
        stats=page.evaluate('({allocations,galaxies,frames:v.frames,scale:v.getScale()})')
        stats['resize_allocations']=stats['allocations']-before
        png=page.locator('#scene canvas').screenshot()
        (SHOTS/('background-before.png' if old else 'background-after.png')).write_bytes(png)
        page.evaluate('''()=>{v.params.look.auto_res=false;v.setPaused(false);for(let i=1;i<=10;i++)framesQueue.pop()(1000+i*20);}''')
        animated=page.locator('#scene canvas').screenshot()
        results.append((Image.open(io.BytesIO(png)).convert('RGB'),stats,Image.open(io.BytesIO(animated)).convert('RGB')))
        assert not errors,errors
        page.close()
    difference=ImageChops.difference(results[0][0],results[1][0])
    assert difference.getbbox() is None,'Default background pixels changed'
    assert ImageChops.difference(results[0][2],results[1][2]).getbbox() is None,'Animated background pixels changed'
    assert results[0][1]['galaxies']==1 and results[1][1]['galaxies']==0
    assert results[0][1]['resize_allocations']>=5 and results[1][1]['resize_allocations']==0
    print('PASS identical default background pixels; allocation counts before/after:',results[0][1],results[1][1],flush=True)
    browser.close()
