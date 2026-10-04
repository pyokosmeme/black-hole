"""Measure render work while requiring exact frozen and animated scene pixels."""
from pathlib import Path
from urllib.parse import urlparse
import io,mimetypes,subprocess
from PIL import Image,ImageChops
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
OLD=subprocess.check_output(['git','show','4a2abad:neon/js-libs/neon-blackhole.js'],cwd=ROOT)
OLD_SHADER=subprocess.check_output(['git','show','4a2abad:neon/raytracer-neon.glsl'],cwd=ROOT)
with sync_playwright() as p:
    browser=p.chromium.launch(args=['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    results={}
    for mode in ['default','pulsed-grid','no-bloom','planet-floor-aa','original']:
        pair=[]
        for old in [True,False]:
            page=browser.new_page(viewport={'width':640,'height':360})
            def serve(route):
                name=urlparse(route.request.url).path.lstrip('/')
                if name=='fixture':
                    route.fulfill(content_type='text/html',body='''<style>body{margin:0}#scene{width:640px;height:360px}</style><div id="scene"></div>
<script>performance.now=()=>1000;window.queue=[];requestAnimationFrame=f=>(queue.push(f),queue.length);cancelAnimationFrame=()=>{};window.matrices=0;window.draws=0;window.compiles=0;const compile=WebGLRenderingContext.prototype.compileShader;WebGLRenderingContext.prototype.compileShader=function(...a){compiles++;return compile.apply(this,a)};</script>
<script src="/neon/js-libs/three.min.js"></script><script src="/neon/js-libs/Detector.js"></script><script src="/neon/js-libs/mustache.min.js"></script><script src="/neon/js-libs/three-js-monkey-patch.js"></script><script src="/neon/js-libs/acidburn-galaxy.js"></script><script src="/neon/settings.js"></script>
<script>window.templatesRendered=0;const mustacheRender=Mustache.render;Mustache.render=function(...a){templatesRendered++;return mustacheRender.apply(this,a)};for(const k of ['Matrix3','Matrix4']){const T=THREE[k];THREE[k]=function(...a){matrices++;return new T(...a)};THREE[k].prototype=T.prototype;}const R=THREE.WebGLRenderer;THREE.WebGLRenderer=function(...a){const r=new R(...a),render=r.render;r.render=function(...a){draws++;return render.apply(this,a)};return r};THREE.WebGLRenderer.prototype=R.prototype;</script>
<script src="/neon/js-libs/neon-blackhole.js"></script><script>window.v=createNeonBlackhole({container:document.getElementById('scene'),base:'/neon/',test:true,skyMotion:true,antialiasing:true});v.setPaused(true);</script>''')
                elif (ROOT/name).is_file():route.fulfill(body=OLD if old and name=='neon/js-libs/neon-blackhole.js' else OLD_SHADER if old and name=='neon/raytracer-neon.glsl' else (ROOT/name).read_bytes(),content_type=mimetypes.guess_type(name)[0] or 'application/octet-stream')
                else:route.abort()
            page.route('**/*',serve);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            page.on('console',lambda m:errors.append(m.text) if m.type=='error' and 'THREE.WebGL' in m.text else None)
            page.goto('https://cost.test/fixture');page.wait_for_function('v.isReady && queue.length>0')
            s=page.evaluate('v.settings()');s['look'].update(auto_res=False,render_scale=1)
            if mode=='no-bloom':s['look']['bloom_strength']=0
            if mode=='pulsed-grid':s['look']['grid_pulse']=.6
            if mode=='original':s['renderer']='original'
            if mode=='planet-floor-aa':
                s['observer'].update(motion=False,distance=18)
                s['camera']['height']=-5.4;s['planet']['enabled']=True;s['neon_floor']=True
                s['look'].update(floor_follow_camera=False,floor_infinite=True,antialiasing=True)
            page.evaluate('(s)=>{v.applySettings(s);queue.pop()(1000)}',s)
            def shot():return Image.open(io.BytesIO(page.locator('#scene canvas').screenshot())).convert('RGB')
            frozen=shot();before=page.evaluate('({matrices,draws,compiles})')
            page.evaluate('()=>{v.setPaused(false);for(let i=1;i<=10;i++)queue.pop()(1000+i*20)}')
            stats=page.evaluate('({matrices,draws,compiles})');animated=shot()
            delta={k:stats[k]-before[k] for k in stats}
            page.evaluate('v.setPaused(true)');before_compile=page.evaluate('compiles')
            before_templates=page.evaluate('templatesRendered')
            page.evaluate('()=>{for(let i=0;i<3;i++){const s=v.settings();s.look.exposure+=.01;v.applySettings(s,true);queue.pop()(1300+i*20)}}')
            delta['uniform_compiles']=page.evaluate('compiles')-before_compile
            delta['uniform_templates']=page.evaluate('templatesRendered')-before_templates
            before_templates=page.evaluate('templatesRendered')
            page.evaluate('()=>{const s=v.settings();s.n_steps=80;v.applySettings(s,true);queue.pop()(1400)}')
            assert page.evaluate('templatesRendered')>before_templates,'Changing a shader parameter did not rebuild the template'
            assert not errors,errors;pair.append((frozen,animated,delta));page.close()
        for i in [0,1]:assert ImageChops.difference(pair[0][i],pair[1][i]).getbbox() is None,('Scene pixels changed',mode,i)
        assert pair[1][2]['matrices']<pair[0][2]['matrices'],(mode,pair[0][2],pair[1][2])
        if mode in ['original','no-bloom']:assert pair[1][2]['draws']==20 and pair[0][2]['draws']==120
        assert pair[1][2]['uniform_compiles']==0
        assert pair[1][2]['uniform_templates']==0 and pair[0][2]['uniform_templates']==3
        results[mode]=[pair[0][2],pair[1][2]]
    print('PASS exact frozen/animated pixels in five modes; work per ten frames before/after:',results,flush=True)
    browser.close()
