"""CHOMP asset-scope regression and optional --live browser verification."""
from pathlib import Path
from urllib.request import Request, urlopen
import json
import struct
import subprocess
import sys
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
ASSETS=['models/chomp/chomp.bin','models/chomp/chomp_camo.webp']
for ignore_case in ['true','false']:
    result=subprocess.run(['git','-c','core.ignoreCase='+ignore_case,'-c','core.excludesFile='+str(ROOT/'.assetsignore'),'check-ignore','--no-index','-z','--stdin'],cwd=ROOT,input=('\0'.join(ASSETS+['CHOMP/CHOMP_viewer.html'])+'\0').encode(),capture_output=True)
    assert result.returncode in [0,1],result.stderr
    excluded=set(result.stdout.decode().split('\0'))
    assert not excluded.intersection(ASSETS),(ignore_case,excluded)
    assert 'CHOMP/CHOMP_viewer.html' in excluded,(ignore_case,excluded)
data=(ROOT/ASSETS[0]).read_bytes()
length=struct.unpack('<I',data[:4])[0]
header=json.loads(data[4:4+length])
assert header['chunks'] and header['names'] and header['rig']
print('PASS runtime assets included, original bundle excluded with both case settings; binary model header valid.',flush=True)

if '--live' in sys.argv:
    origin='https://lastnpcalex.agency'
    revision=subprocess.check_output(['git','rev-parse','--short','HEAD'],cwd=ROOT,text=True).strip()
    for asset in ASSETS:
        with urlopen(Request(origin+'/'+asset+'?release='+revision,headers={'Cache-Control':'no-cache'}),timeout=30) as response:
            assert response.status==200
            assert response.read()==(ROOT/asset).read_bytes(),asset
    with sync_playwright() as p:
        browser=p.chromium.launch(args=['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        for width,height in [(390,844),(1366,768)]:
            page=browser.new_page(viewport={'width':width,'height':height})
            page.add_init_script("localStorage.setItem('acidburn-mode','dark')")
            errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(origin+'/vehicle-viewer?release='+revision)
            page.wait_for_function('window.__vehicleViewer?.loaded',timeout=60000)
            assert page.locator('#stage > canvas').count()==1
            page.locator('[data-pane-toggle="turret-pane"]').click()
            page.locator('#variants [data-variant="gun"]').click()
            assert page.evaluate('__vehicleViewer.currentVariant')=='gun'
            page.locator('#turret-pane [data-pane-close]').click()
            before=page.evaluate('__vehicleViewer.camera.position.toArray()')
            canvas=page.locator('#stage > canvas')
            box=canvas.bounding_box()
            page.mouse.move(box['x']+box['width']*.5,box['y']+box['height']*.5)
            page.mouse.down()
            page.mouse.move(box['x']+box['width']*.6,box['y']+box['height']*.55,steps=8)
            page.mouse.up()
            page.wait_for_timeout(200)
            assert page.evaluate('__vehicleViewer.camera.position.toArray()')!=before
            assert not errors,errors
            page.screenshot(path=str(ROOT/'attached_files'/f'chomp-live-restored-{width}.png'))
            print('PASS live model, texture, turret selection and camera:',width,height,flush=True)
            page.close()
        browser.close()
