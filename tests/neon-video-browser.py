"""Decode actual recordings to check blank frames, discontinuities and loop seams."""
from pathlib import Path
from urllib.parse import urlparse, unquote
import json
import mimetypes
import statistics
import subprocess
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'attached_files/neon-video-checks'
OUT.mkdir(parents=True, exist_ok=True)

def serve(route):
    path = (ROOT / unquote(urlparse(route.request.url).path).lstrip('/')).resolve()
    if path.is_dir():
        path /= 'index.html'
    if path.is_relative_to(ROOT) and path.is_file():
        route.fulfill(body=path.read_bytes(), content_type=mimetypes.guess_type(path)[0] or 'application/octet-stream')
    else:
        route.abort()

def inspect_video(path, loop, fps=30, fixed=True):
    info = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_streams', '-of', 'json', str(path)]))['streams'][0]
    assert (info['width'], info['height']) == (320, 180), info
    timing = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_frames', '-show_format', '-of', 'json', str(path)]))
    timestamps = [float(f['pts_time']) for f in timing['frames']]
    if fixed:
        assert len(timestamps) == 2 * fps, len(timestamps)
        assert abs(float(timing['format']['duration']) - 2) < .002
        assert all(abs(t - i / fps) < .0011 for i, t in enumerate(timestamps)), timestamps
    else:
        assert len(timestamps) > 5, len(timestamps)
        assert all(b > a for a,b in zip(timestamps,timestamps[1:])), timestamps
    result = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-vf', 'scale=160:90', '-fps_mode', 'passthrough', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True, check=True)
    assert not result.stderr, result.stderr.decode()
    size = 160 * 90 * 3
    frames = [result.stdout[i:i+size] for i in range(0, len(result.stdout), size)]
    assert len(frames) == len(timestamps), len(frames)
    assert all(len(f) == size and sum(f) / size > 3 for f in frames), 'Blank or truncated frame'
    difference = lambda a,b: sum(abs(x-y) for x,y in zip(a,b)) / size
    changes = [difference(a,b) for a,b in zip(frames, frames[1:])]
    assert max(changes) < 25, ('Large frame discontinuity', max(changes))
    if loop:
        seam = difference(frames[-1], frames[0])
        assert seam < max(2, statistics.median(changes) * 2), ('Loop seam', seam, statistics.median(changes))
        assert max(difference(frames[0], f) for f in frames) > 1, 'Loop must actually animate'
    sheet = Image.new('RGB', (640, 240), '#181818')
    draw = ImageDraw.Draw(sheet)
    indices = [round(i * (len(frames)-1) / 7) for i in range(8)]
    for tile, index in enumerate(indices):
        x,y = (tile % 4)*160, (tile//4)*120
        sheet.paste(Image.frombytes('RGB', (160,90), frames[index]), (x,y))
        draw.text((x+4,y+94), f'Frame {index}', fill='white')
    sheet.save(path.with_suffix('.png'))
    print(path.name, 'decoded frames:', len(frames), 'max adjacent change:', round(max(changes),2), 'seam:', round(difference(frames[-1],frames[0]),2), flush=True)

with sync_playwright() as p:
    browser = p.chromium.launch(args=['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    page = browser.new_page(viewport={'width':800,'height':600}, reduced_motion='reduce')
    page.add_init_script("localStorage.setItem('acidburn-mode','dark')")
    page.route('**/*', serve)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('https://video.test/neon-black-hole.html')
    page.wait_for_function('window.NeonViewer && NeonViewer.frames>0', timeout=60000)
    page.evaluate('''()=>{const s=NeonViewer.settings();s.observer.motion=false;s.camera.wobble_pitch=0;s.camera.wobble_yaw=0;s.look.auto_res=false;s.look.render_scale=.5;s.quality='fast';s.n_steps=40;s.caption.enabled=true;s.caption.text='LOOP TEST';NeonViewer.applySettings(s);NeonViewer.setPaused(false);}''')
    page.wait_for_timeout(300)
    initial = page.evaluate('NeonViewer.settings()')
    for loop, fps in [(False, 30), (True, 30), (True, 60)]:
        with page.expect_download(timeout=180000) as download:
            page.evaluate('([loop,fps])=>{NeonCapture.startRecording(NeonViewer,{width:320,height:180,duration:2,fps,loop});}', [loop,fps])
        path = OUT / (f'loop-{fps}.webm' if loop else 'normal.webm')
        download.value.save_as(path)
        inspect_video(path, loop, fps)
        assert page.evaluate('NeonViewer.settings()') == initial
        assert not page.evaluate('NeonViewer.isPaused()')
    with page.expect_download(timeout=30000) as download:
        page.evaluate('()=>NeonCapture.startRecording(NeonViewer,{width:320,height:180,duration:0,fps:30})')
        page.wait_for_timeout(2300)
        page.evaluate('NeonCapture.stopRecording()')
    download.value.save_as(OUT / 'manual.webm')
    inspect_video(OUT / 'manual.webm', False, fixed=False)
    page.locator('#neon-capture-toggle').click()
    page.locator('#neon-video-len').select_option('0')
    page.locator('#neon-video-loop').check()
    assert page.locator('#neon-video-len').input_value() == '5'
    assert page.locator('#neon-video-len option[value="0"]').is_disabled()
    page.locator('#neon-video-len').select_option('2')
    page.locator('#neon-video-res').select_option('custom')
    page.locator('#neon-video-custom-w').fill('320')
    page.locator('#neon-video-custom-h').fill('180')
    with page.expect_download(timeout=180000) as download:
        page.locator('#neon-quick-rec').click()
    assert '-loop' in download.value.suggested_filename
    download.value.save_as(OUT / 'quick-loop.webm')
    inspect_video(OUT / 'quick-loop.webm', True)
    # Cancellation restores pause state and produces no partial loop download.
    page.evaluate('''()=>{NeonViewer.setPaused(true);NeonCapture.startRecording(NeonViewer,{width:320,height:180,duration:30,fps:30,loop:true});}''')
    page.wait_for_selector('#neon-rec-pill.is-recording')
    page.locator('#neon-rec-stop-btn').click()
    page.wait_for_selector('#neon-rec-pill', state='hidden')
    assert page.evaluate('NeonViewer.isPaused()')
    # Returning to baseline is exact even with orbit, floor, sky and snow clocks.
    result = page.evaluate('''()=>{NeonViewer.setPaused(true);const s=NeonViewer.settings();s.observer.motion=true;s.look.sky_motion=true;s.look.snow_enabled=true;s.neon_floor=true;NeonViewer.applySettings(s);const before=NeonViewer.settings(),timeline=NeonViewer.beginCaptureTimeline();const a=timeline.captureAtTime(0,160,90).getContext('2d').getImageData(0,0,160,90).data.slice();timeline.captureAtTime(1,160,90);const b=timeline.captureAtTime(0,160,90).getContext('2d').getImageData(0,0,160,90).data;const same=a.every((v,i)=>v===b[i]);timeline.finish();return same&&NeonViewer.isPaused()&&JSON.stringify(before)===JSON.stringify(NeonViewer.settings());}''')
    assert result, 'Timeline must restore the exact image, settings and pause state'
    for width,height in [(320,568),(390,844),(568,320),(768,1024),(1366,768)]:
        page.set_viewport_size({'width':width,'height':height})
        page.locator('#neon-video-loop').scroll_into_view_if_needed()
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        page.screenshot(path=str(OUT / f'controls-{width}x{height}.png'))
    assert not errors, errors
    browser.close()
print('Decoded recordings, moving loop seam, exact timeline restoration, loop UI and responsive controls passed.')
