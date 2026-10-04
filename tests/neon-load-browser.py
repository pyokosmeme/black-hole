"""Measure dependency startup with controlled network latency and real scripts."""
import asyncio,mimetypes,subprocess,time
from pathlib import Path
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
OLD=subprocess.check_output(['git','show','4a2abad:js/acidburn-blackhole.js'],cwd=ROOT)
DEPENDENCIES=['js-libs/three.min.js','js-libs/Detector.js','js-libs/mustache.min.js','three-js-monkey-patch.js','neon/settings.js','neon/js-libs/neon-blackhole.js']
async def main():
    async with async_playwright() as p:
        browser=await p.chromium.launch(args=['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        results=[]
        for old in [True,False]:
            page=await browser.new_page(viewport={'width':640,'height':360});times={};errors=[]
            async def serve(route):
                name=urlparse(route.request.url).path.lstrip('/')
                if name=='fixture':
                    await route.fulfill(content_type='text/html',body='<style>body{margin:0}#blackhole-container{width:640px;height:360px}</style><body class="bh-mode"><div id="blackhole-container"></div><script src="/js/acidburn-blackhole.js"></script></body>');return
                path=(ROOT/name).resolve()
                if not path.is_relative_to(ROOT) or not path.is_file():await route.abort();return
                if name in DEPENDENCIES:
                    times[name]=[time.monotonic()]
                    await asyncio.sleep(.08)
                    times[name].append(time.monotonic())
                await route.fulfill(body=OLD if old and name=='js/acidburn-blackhole.js' else path.read_bytes(),content_type=mimetypes.guess_type(name)[0] or 'application/octet-stream')
            await page.route('**/*',serve);page.on('pageerror',lambda e:errors.append(str(e)))
            await page.goto('https://load.test/fixture')
            await page.wait_for_function('window.AcidburnBlackhole && AcidburnBlackhole.frames>0',timeout=60000)
            assert set(times)==set(DEPENDENCIES),times
            assert not errors,errors
            results.append((max(t[1] for t in times.values())-min(t[0] for t in times.values()))*1000)
            if not old:
                for a,b in [('js-libs/Detector.js','js-libs/mustache.min.js'),('neon/settings.js','neon/js-libs/neon-blackhole.js')]:
                    assert times[a][0]<times[b][1] and times[b][0]<times[a][1],('Independent requests did not overlap',a,b)
            await page.close()
        assert results[1]<results[0]*.8,results
        print('PASS real dependency loading, overlapping independent requests; startup dependency window at 80 ms/request before/after (ms):',results,flush=True)
        await browser.close()
asyncio.run(main())
