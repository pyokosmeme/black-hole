/* Neon Visualizer Capture, Video Recording, and Standalone HTML Exporter */
(function (window) {
  'use strict';

  const RESOLUTIONS = {
    current: { label: 'Current Viewport', width: 0, height: 0 },
    '1080p': { label: '1080p FHD (1920×1080)', width: 1920, height: 1080 },
    '720p':  { label: '720p HD (1280×720)', width: 1280, height: 720 },
    '4k':    { label: '4K UHD (3840×2160)', width: 3840, height: 2160 },
    square:  { label: 'Square (1080×1080)', width: 1080, height: 1080 },
    portrait:{ label: 'Portrait (1080×1920)', width: 1080, height: 1920 }
  };

  function getSupportedVideoMimeType() {
    if (typeof MediaRecorder === 'undefined') return '';
    const candidates = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4;codecs=avc1',
      'video/mp4'
    ];
    for (const t of candidates) {
      if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) return t;
    }
    return '';
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      link.remove();
      URL.revokeObjectURL(url);
    }, 30000);
  }

  function padZero(n) { return n < 10 ? '0' + n : String(n); }
  function formatTime(sec) {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    return padZero(m) + ':' + padZero(s % 60);
  }

  function notify(msg) {
    const status = document.getElementById('neon-status');
    if (status) status.textContent = msg;
  }

  let mediaRecorder = null;
  let recordedChunks = [];
  let recordTimerInterval = null;
  let recordTimeout = null;
  let compositingRaf = null;
  let recordingStartTime = 0;
  let activeRecordingRes = null;

  async function takeStill(viewer, opts = {}) {
    if (!viewer) throw new Error('Visualizer not ready.');
    await viewer.ready;
    await viewer.textureReady;
    if (document.fonts && document.fonts.ready) await document.fonts.ready;

    const resKey = opts.resolution || '1080p';
    const res = RESOLUTIONS[resKey] || RESOLUTIONS.current;
    let targetW = opts.width || res.width;
    let targetH = opts.height || res.height;
    const includeCaption = opts.caption !== false;

    const sceneEl = document.getElementById('neon-scene');
    const liveCanvas = sceneEl ? sceneEl.querySelector('canvas') : null;
    if (!targetW || !targetH) {
      targetW = liveCanvas ? liveCanvas.width : 1100;
      targetH = liveCanvas ? liveCanvas.height : 800;
    }

    notify(`Rendering still at ${targetW}×${targetH}…`);

    const rendered = (typeof viewer.captureAt === 'function' && (targetW !== (liveCanvas && liveCanvas.width) || targetH !== (liveCanvas && liveCanvas.height)))
      ? viewer.captureAt(targetW, targetH)
      : viewer.capture();

    const out = document.createElement('canvas');
    out.width = targetW;
    out.height = targetH;
    const ctx = out.getContext('2d');
    ctx.drawImage(rendered, 0, 0, targetW, targetH);

    const lettering = document.querySelector('.neon-lettering');
    const hasCaption = includeCaption && viewer.params && viewer.params.caption && viewer.params.caption.enabled && viewer.params.caption.text;
    if (hasCaption && typeof window.renderLettering === 'function') {
      window.renderLettering(out, targetW, targetH);
    } else if (includeCaption && lettering && !lettering.hidden) {
      ctx.drawImage(lettering, 0, 0, targetW, targetH);
    }

    return new Promise((resolve, reject) => {
      out.toBlob(blob => {
        if (!blob) {
          reject(new Error('Still capture failed.'));
          return;
        }
        const name = opts.filename || `neon-black-hole-${targetW}x${targetH}.png`;
        downloadBlob(blob, name);
        notify(`Still downloaded: ${name}`);
        resolve({ blob, filename: name, width: targetW, height: targetH });
      }, 'image/png');
    });
  }

  function startRecording(viewer, opts = {}) {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      stopRecording();
      return;
    }
    if (!viewer) throw new Error('Visualizer not ready.');

    const mimeType = getSupportedVideoMimeType();
    if (!mimeType) throw new Error('MediaRecorder video recording is not supported in this browser.');

    const resKey = opts.resolution || '1080p';
    const res = RESOLUTIONS[resKey] || RESOLUTIONS.current;
    const durationSec = parseFloat(opts.duration ?? 5);
    const fps = parseInt(opts.fps || 30, 10);
    const includeCaption = opts.caption !== false;

    const sceneEl = document.getElementById('neon-scene');
    const liveCanvas = sceneEl ? sceneEl.querySelector('canvas') : null;
    if (!liveCanvas) throw new Error('Scene canvas not found.');

    let targetW = res.width || liveCanvas.width;
    let targetH = res.height || liveCanvas.height;

    const compCanvas = document.createElement('canvas');
    compCanvas.width = targetW;
    compCanvas.height = targetH;
    const compCtx = compCanvas.getContext('2d');

    const stream = compCanvas.captureStream(fps);
    recordedChunks = [];

    try {
      mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 12000000 });
    } catch {
      mediaRecorder = new MediaRecorder(stream);
    }

    activeRecordingRes = { width: targetW, height: targetH, mimeType };

    mediaRecorder.ondataavailable = e => {
      if (e.data && e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      if (compositingRaf) cancelAnimationFrame(compositingRaf);
      if (recordTimerInterval) clearInterval(recordTimerInterval);
      if (recordTimeout) clearTimeout(recordTimeout);
      updateRecordingUI(false);

      if (recordedChunks.length === 0) {
        notify('No video data recorded.');
        return;
      }
      const blob = new Blob(recordedChunks, { type: activeRecordingRes.mimeType });
      const ext = activeRecordingRes.mimeType.includes('mp4') ? 'mp4' : 'webm';
      const filename = opts.filename || `neon-black-hole-${activeRecordingRes.width}x${activeRecordingRes.height}.${ext}`;
      downloadBlob(blob, filename);
      notify(`Video saved: ${filename}`);
      if (typeof opts.onComplete === 'function') opts.onComplete(blob, filename);
    };

    const lettering = document.querySelector('.neon-lettering');
    const hasCaption = includeCaption && viewer.params && viewer.params.caption && viewer.params.caption.enabled && viewer.params.caption.text;
    const captionCanvas = document.createElement('canvas');
    captionCanvas.width = targetW;
    captionCanvas.height = targetH;
    if (hasCaption && typeof window.renderLettering === 'function') {
      window.renderLettering(captionCanvas, targetW, targetH);
    }
    function pump() {
      compCtx.drawImage(liveCanvas, 0, 0, targetW, targetH);
      if (hasCaption && typeof window.renderLettering === 'function') {
        compCtx.drawImage(captionCanvas, 0, 0);
      } else if (includeCaption && lettering && !lettering.hidden) {
        compCtx.drawImage(lettering, 0, 0, targetW, targetH);
      }
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        compositingRaf = requestAnimationFrame(pump);
      }
    }

    mediaRecorder.start(200);
    recordingStartTime = performance.now();
    pump();
    updateRecordingUI(true, durationSec);

    if (durationSec > 0) {
      recordTimeout = setTimeout(() => {
        stopRecording();
      }, durationSec * 1000);
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
  }

  function updateRecordingUI(isRecording, totalSec = 0) {
    const pill = document.getElementById('neon-rec-pill');
    const timerText = document.getElementById('neon-rec-timer');
    const startBtn = document.getElementById('neon-start-record');
    const quickBtn = document.getElementById('neon-quick-rec');

    if (isRecording) {
      if (pill) {
        pill.hidden = false;
        pill.classList.add('is-recording');
      }
      if (startBtn) {
        startBtn.textContent = 'Stop Recording';
        startBtn.classList.add('is-recording');
      }
      if (quickBtn) {
        quickBtn.textContent = 'Stop';
        quickBtn.classList.add('is-recording');
      }

      if (recordTimerInterval) clearInterval(recordTimerInterval);
      recordTimerInterval = setInterval(() => {
        const elapsed = (performance.now() - recordingStartTime) / 1000;
        const txt = totalSec > 0
          ? `${formatTime(elapsed)} / ${formatTime(totalSec)}`
          : formatTime(elapsed);
        if (timerText) timerText.textContent = txt;
        notify(`Recording video… ${txt}`);
      }, 100);
    } else {
      if (pill) {
        pill.hidden = true;
        pill.classList.remove('is-recording');
      }
      if (startBtn) {
        startBtn.textContent = 'Start Recording';
        startBtn.classList.remove('is-recording');
      }
      if (quickBtn) {
        quickBtn.textContent = 'Record';
        quickBtn.classList.remove('is-recording');
      }
    }
  }

  function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i += 8192) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + 8192, len)));
    }
    return btoa(binary);
  }

  async function exportStandaloneHtml(viewer, opts = {}) {
    notify('Preparing single-file HTML bundle…');
    const snapshot = viewer ? viewer.settings() : {};

    function resolveBases() {
      const scriptTag = document.querySelector('script[src*="capture.js"]') || document.currentScript;
      let base;
      if (scriptTag && scriptTag.src) {
        base = new URL('./', scriptTag.src);
      } else if (window.location.pathname.includes('/neon/')) {
        base = new URL('./', window.location.href);
      } else {
        base = new URL('neon/', window.location.href);
      }
      const siteBase = window.NEON_SITE_ASSETS
        ? new URL(window.NEON_SITE_ASSETS, base)
        : new URL('../', base);
      return { base, siteBase };
    }

    const { base, siteBase } = resolveBases();

    const textAssets = [
      { key: 'raytracerNeon', url: new URL('raytracer-neon.glsl', base) },
      { key: 'raytracerOrig', url: new URL('raytracer-orig.glsl', base) },
      { key: 'cssAcidburn',   url: new URL('css/acidburn.css', siteBase) },
      { key: 'cssMapWindow',  url: new URL('css/map-window.css', siteBase) },
      { key: 'cssNeonViewer', url: new URL('css/neon-viewer.css', siteBase) },
      { key: 'jsThree',       url: new URL('js-libs/three.min.js', base) },
      { key: 'jsDetector',    url: new URL('js-libs/Detector.js', base) },
      { key: 'jsMustache',    url: new URL('js-libs/mustache.min.js', base) },
      { key: 'jsMonkeyPatch', url: new URL('js-libs/three-js-monkey-patch.js', base) },
      { key: 'jsGalaxy',      url: new URL('js-libs/acidburn-galaxy.js', base) },
      { key: 'jsMapWindow',   url: new URL(window.NEON_PACKAGED ? 'map-window.js' : 'js/map-window.js', siteBase) },
      { key: 'jsSettings',    url: new URL('settings.js', base) },
      { key: 'jsWarmChrome',  url: new URL('warm-chrome.js', base) },
      { key: 'jsCrimsonSnow', url: new URL('crimson-snow.js', base) },
      { key: 'jsBlackhole',   url: new URL('js-libs/neon-blackhole.js', base) },
      { key: 'jsZip',         url: new URL('zip.js', base) },
      { key: 'jsCapture',     url: new URL('capture.js', base) },
      { key: 'jsViewer',      url: new URL('viewer.js', base) }
    ];

    const imageAssets = [
      { key: 'spectra', mime: 'image/png', url: new URL('img/spectra.png', base) },
      { key: 'moon',    mime: 'image/png', url: new URL('img/beach-ball.png', base) },
      { key: 'stars',   mime: 'image/png', url: new URL('img/stars.png', base) },
      { key: 'disk',    mime: 'image/png', url: new URL('img/accretion-disk.png', base) }
    ];

    const texts = {};
    for (const item of textAssets) {
      const res = await fetch(item.url);
      if (!res.ok) throw new Error(`Could not load ${item.key} from ${item.url}`);
      texts[item.key] = await res.text();
    }

    const textures = {};
    for (const item of imageAssets) {
      try {
        const res = await fetch(item.url);
        if (!res.ok) throw new Error(`Could not fetch ${item.key}`);
        const buf = await res.arrayBuffer();
        textures[item.key] = `data:${item.mime};base64,${arrayBufferToBase64(buf)}`;
      } catch (err) {
        console.warn(`Fallback for texture ${item.key}:`, err);
        textures[item.key] = '';
      }
    }

    let fontDataUrl = '';
    try {
      const fontRes = await fetch(new URL('fonts/Teko.ttf', base));
      if (fontRes.ok) {
        const fontBuf = await fontRes.arrayBuffer();
        fontDataUrl = `data:font/ttf;base64,${arrayBufferToBase64(fontBuf)}`;
      }
    } catch {
      // optional font fallback
    }

    function escapeInlineScript(code) {
      return (code || '').replace(/<\/script/gi, '<\\/script');
    }

    const fontStyle = fontDataUrl
      ? `@font-face { font-family: 'Neon Teko'; src: url('${fontDataUrl}') format('truetype'); font-weight: 300 700; }\n`
      : '';

    const combinedCss = fontStyle + [texts.cssAcidburn, texts.cssMapWindow, texts.cssNeonViewer].filter(Boolean).join('\n\n');

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Neon Black Hole — Standalone Visualizer</title>
  <meta name="description" content="Offline standalone neon black hole visualizer.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=Share+Tech+Mono&family=Space+Mono:ital,wght@0,400;0,700;1,400&family=VT323&display=swap" rel="stylesheet">
  <style>
${combinedCss}
  </style>
</head>
<body class="neon-viewer dark-mode neon-standalone">
  <a class="skip-link" href="#main">Skip to viewer</a>
  <main id="main" class="main-content map-window-shell">
    <section class="author-card map-window" data-map-window aria-labelledby="viewer-title">
      <div class="section-header window-toolbar">
        <h2 id="viewer-title">NEON BLACK HOLE</h2><div class="section-line"></div>
        <div class="window-actions" role="group" aria-label="Window controls">
          <button class="acidburn-button" type="button" data-window-expand aria-pressed="false" aria-label="Expand window" title="Expand window">
            <svg class="expand-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/></svg>
            <svg class="collapse-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h6V3m6 0v6h6M9 21v-6H3m18 0h-6v6"/></svg>
          </button>
          <a class="acidburn-button" href="index.html" aria-label="Reset viewer page" title="Reset viewer page"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg></a>
        </div>
      </div>
      <div class="map-viewport neon-viewport">
        <div id="neon-scene" class="neon-scene" role="img" tabindex="0" aria-describedby="neon-camera-help" aria-label="Animated black hole with a lensed accretion disk"></div>
        <div class="map-hud map-hud-tl"><div class="map-controls">
          <button type="button" class="acidburn-button" id="neon-pause" aria-pressed="false">Pause</button>
          <button type="button" class="acidburn-button" id="neon-reset">Reset</button>
          <button type="button" class="acidburn-button" id="neon-grid" aria-pressed="true">Grid</button>
          <button type="button" class="acidburn-button" id="neon-floor" aria-pressed="false">Floor</button>
          <button type="button" class="acidburn-button" id="neon-stationary" aria-pressed="false">Stationary</button>
          <button type="button" class="acidburn-button" id="neon-warm">Warm chrome scene</button>
          <button type="button" class="acidburn-button" id="neon-snow">Crimson snow scene</button>
          <div id="neon-rec-pill" class="neon-rec-pill" hidden><span class="neon-rec-dot"></span><span id="neon-rec-timer">00:00</span><button type="button" id="neon-rec-stop-btn" class="acidburn-button neon-rec-stop">Stop</button></div>
          <button type="button" class="acidburn-button" id="neon-link">Share link</button>
          <button type="button" class="acidburn-button" id="neon-camera-free" aria-pressed="false" hidden>Free move</button>
        </div></div>
        <div class="map-hud map-hud-br"><div class="map-controls">
          <button type="button" class="acidburn-button" data-pane-toggle="neon-settings" aria-expanded="false">Settings</button>
          <button type="button" class="acidburn-button" data-pane-toggle="neon-capture" aria-expanded="false" id="neon-capture-toggle">Capture</button>
          <button type="button" class="acidburn-button" data-pane-toggle="neon-share" aria-expanded="false">Share / ZIP</button>
        </div></div>
        <section class="author-card map-pane" id="neon-settings" data-map-pane hidden aria-labelledby="settings-title">
          <div class="section-header window-toolbar"><h2 id="settings-title">Settings</h2><div class="section-line"></div><div class="window-actions"><button type="button" class="acidburn-button" data-pane-close aria-label="Close settings">×</button></div></div>
          <div class="map-pane-body"><p>Change the view, then copy or download your settings.</p><div id="neon-fields"></div></div>
        </section>
        <section class="author-card map-pane" id="neon-capture" data-map-pane hidden aria-labelledby="capture-title">
          <div class="section-header window-toolbar"><h2 id="capture-title">Capture Studio</h2><div class="section-line"></div><div class="window-actions"><button type="button" class="acidburn-button" data-pane-close aria-label="Close capture">×</button></div></div>
          <div class="map-pane-body">
            <p>Capture high-resolution stills, record clips, or export this visualizer offline.</p>
            <div class="neon-capture-quick-bar" style="display:flex;gap:8px;margin-bottom:12px;">
              <button type="button" class="acidburn-button neon-action-btn" id="neon-quick-snap" style="flex:1;">📸 Save PNG Still</button>
              <button type="button" class="acidburn-button neon-action-btn" id="neon-quick-rec" style="flex:1;">⏺️ Record Video</button>
            </div>
            <details open class="neon-capture-section">
              <summary>Record Video</summary>
              <div class="neon-capture-controls">
                <label class="acidburn-field neon-control">
                  <span>Resolution</span>
                  <select id="neon-video-res" class="acidburn-select">
                    <option value="current">Current Viewport</option>
                    <option value="1080p" selected>1080p FHD (1920×1080)</option>
                    <option value="720p">720p HD (1280×720)</option>
                    <option value="square">Square (1080×1080)</option>
                  </select>
                </label>
                <label class="acidburn-field neon-control">
                  <span>Clip Length</span>
                  <select id="neon-video-len" class="acidburn-select">
                    <option value="2">2 seconds</option>
                    <option value="3">3 seconds</option>
                    <option value="5" selected>5 seconds</option>
                    <option value="10">10 seconds</option>
                    <option value="15">15 seconds</option>
                    <option value="30">30 seconds</option>
                    <option value="0">Manual (Start / Stop)</option>
                  </select>
                </label>
                <label class="acidburn-field neon-control">
                  <span>Frame Rate</span>
                  <select id="neon-video-fps" class="acidburn-select">
                    <option value="30" selected>30 FPS</option>
                    <option value="60">60 FPS</option>
                  </select>
                </label>
                <label class="acidburn-field neon-control">
                  <span>Include poster text</span>
                  <input type="checkbox" id="neon-video-caption" checked>
                </label>
                <button type="button" class="acidburn-button neon-action-btn" id="neon-start-record">Start Recording</button>
              </div>
            </details>
            <details open class="neon-capture-section">
              <summary>Take PNG Still</summary>
              <div class="neon-capture-controls">
                <label class="acidburn-field neon-control">
                  <span>Resolution</span>
                  <select id="neon-still-res" class="acidburn-select">
                    <option value="current">Current Viewport</option>
                    <option value="1080p" selected>1080p FHD (1920×1080)</option>
                    <option value="4k">4K UHD (3840×2160)</option>
                    <option value="720p">720p HD (1280×720)</option>
                    <option value="square">Square (1080×1080)</option>
                    <option value="portrait">Portrait (1080×1920)</option>
                  </select>
                </label>
                <label class="acidburn-field neon-control">
                  <span>Include poster text</span>
                  <input type="checkbox" id="neon-still-caption" checked>
                </label>
                <button type="button" class="acidburn-button neon-action-btn" id="neon-capture-still">Download PNG Still</button>
              </div>
            </details>
            <details open class="neon-capture-section">
              <summary>Standalone Visualizer HTML</summary>
              <div class="neon-capture-controls">
                <p class="neon-help-note">Download a single self-contained HTML file of this exact visualizer with your active settings, shaders, and textures baked in. Runs anywhere offline with no web server required.</p>
                <button type="button" class="acidburn-button neon-action-btn" id="neon-export-html">Download Standalone HTML</button>
              </div>
            </details>
          </div>
        </section>
        <section class="author-card map-pane" id="neon-share" data-map-pane hidden aria-labelledby="share-title">
          <div class="section-header window-toolbar"><h2 id="share-title">Share / ZIP</h2><div class="section-line"></div><div class="window-actions"><button type="button" class="acidburn-button" data-pane-close aria-label="Close sharing">×</button></div></div>
          <div class="map-pane-body">
            <p>Copy this view, load someone else’s settings, or take the viewer with you.</p>
            <div class="neon-share-actions">
              <button type="button" class="acidburn-button" id="neon-copy">Copy settings</button>
              <button type="button" class="acidburn-button" id="neon-copy-link">Copy scene link</button>
              <button type="button" class="acidburn-button" id="neon-share-html">Download HTML</button>
              <button type="button" class="acidburn-button" id="neon-zip">Download ZIP</button>
            </div>
            <label class="acidburn-field" for="neon-json">Settings JSON<textarea id="neon-json" rows="6" spellcheck="false" placeholder="Paste copied settings here"></textarea></label>
            <label class="acidburn-field neon-link-field" for="neon-link-url" hidden>Scene link<input id="neon-link-url" type="text" readonly></label>
            <button type="button" class="acidburn-button" id="neon-load">Load JSON</button>
            <label class="acidburn-field" for="neon-file">Or choose a settings file<input id="neon-file" type="file" accept=".json,application/json"></label>
            <p>Your ZIP opens with these settings as its defaults. Includes the viewer’s code and assets, plus launch instructions.</p>
          </div>
        </section>
        <div id="neon-camera-controls" class="neon-camera-controls" hidden>
          <button type="button" id="neon-camera-pad" class="acidburn-button neon-camera-pad" hidden aria-label="Camera thumb pad: drag to look around" aria-describedby="neon-camera-help"><span class="neon-pad-thumb" aria-hidden="true"></span><span aria-hidden="true">↕ ↔</span></button>
          <div class="neon-camera-actions">
            <button type="button" class="acidburn-button" id="neon-zoom-in" aria-label="Move camera closer">+</button>
            <button type="button" class="acidburn-button" id="neon-zoom-out" aria-label="Move camera farther away">−</button>
            <button type="button" class="acidburn-button" id="neon-camera-center">Center</button>
            <button type="button" class="acidburn-button" id="neon-camera-move" aria-pressed="false" title="Switch dragging and thumb pad between looking and moving">Move</button>
          </div>
          <p id="neon-camera-help">Move: drag / WASD · Q/E up/down · Shift keys / Alt drag: fine</p>
        </div>
        <p id="neon-status" class="neon-status" role="status">Black-hole viewer</p>
      </div>
    </section>
    <noscript><p>This viewer needs JavaScript and WebGL.</p></noscript>
  </main>
  <script>
    window.NEON_PACKAGED = true;
    window.NEON_SITE_ASSETS = './';
    window.NEON_DEFAULT_SETTINGS = ${JSON.stringify(snapshot, null, 2)};
    window.NEON_FONT_URL = ${fontDataUrl ? JSON.stringify('url(' + fontDataUrl + ')') : 'null'};
    window.NEON_TEXTURES = {
      spectra: ${JSON.stringify(textures.spectra || '')},
      moon: ${JSON.stringify(textures.moon || '')},
      stars: ${JSON.stringify(textures.stars || '')},
      accretion_disk: ${JSON.stringify(textures.disk || '')}
    };
    window.NEON_SHADERS = {
      neon: ${JSON.stringify(texts.raytracerNeon || '')},
      orig: ${JSON.stringify(texts.raytracerOrig || '')}
    };
  </script>
  <script>${escapeInlineScript(texts.jsThree)}</script>
  <script>${escapeInlineScript(texts.jsDetector)}</script>
  <script>${escapeInlineScript(texts.jsMustache)}</script>
  <script>${escapeInlineScript(texts.jsMonkeyPatch)}</script>
  <script>${escapeInlineScript(texts.jsGalaxy)}</script>
  <script>${escapeInlineScript(texts.jsMapWindow)}</script>
  <script>${escapeInlineScript(texts.jsSettings)}</script>
  <script>${escapeInlineScript(texts.jsWarmChrome)}</script>
  <script>${escapeInlineScript(texts.jsCrimsonSnow)}</script>
  <script>${escapeInlineScript(texts.jsBlackhole)}</script>
  <script>${escapeInlineScript(texts.jsZip)}</script>
  <script>${escapeInlineScript(texts.jsCapture)}</script>
  <script>${escapeInlineScript(texts.jsViewer)}</script>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const filename = opts.filename || 'neon-black-hole.html';
    downloadBlob(blob, filename);
    notify(`Standalone HTML downloaded: ${filename}`);
    return { blob, filename };
  }

  function initUI() {
    function getViewer() { return window.NeonViewer; }

    const quickSnap = document.getElementById('neon-quick-snap');
    if (quickSnap) {
      quickSnap.addEventListener('click', () => {
        const v = getViewer();
        if (v) takeStill(v, { resolution: '1080p', caption: true }).catch(err => notify(err.message));
      });
    }

    const quickRec = document.getElementById('neon-quick-rec');
    if (quickRec) {
      quickRec.addEventListener('click', () => {
        const v = getViewer();
        if (!v) return;
        if (mediaRecorder && mediaRecorder.state === 'recording') {
          stopRecording();
        } else {
          startRecording(v, { resolution: '1080p', duration: 5, fps: 30, caption: true });
        }
      });
    }

    const stopBtn = document.getElementById('neon-rec-stop-btn');
    if (stopBtn) {
      stopBtn.addEventListener('click', stopRecording);
    }

    const captureStillBtn = document.getElementById('neon-capture-still');
    if (captureStillBtn) {
      captureStillBtn.addEventListener('click', () => {
        const v = getViewer();
        if (!v) return;
        const resSelect = document.getElementById('neon-still-res');
        const captionCheck = document.getElementById('neon-still-caption');
        const resKey = resSelect ? resSelect.value : '1080p';
        const includeCap = captionCheck ? captionCheck.checked : true;
        takeStill(v, { resolution: resKey, caption: includeCap }).catch(err => notify(err.message));
      });
    }

    const startRecBtn = document.getElementById('neon-start-record');
    if (startRecBtn) {
      startRecBtn.addEventListener('click', () => {
        const v = getViewer();
        if (!v) return;
        if (mediaRecorder && mediaRecorder.state === 'recording') {
          stopRecording();
        } else {
          const resSelect = document.getElementById('neon-video-res');
          const lenSelect = document.getElementById('neon-video-len');
          const fpsSelect = document.getElementById('neon-video-fps');
          const capCheck = document.getElementById('neon-video-caption');
          startRecording(v, {
            resolution: resSelect ? resSelect.value : '1080p',
            duration: lenSelect ? parseFloat(lenSelect.value) : 5,
            fps: fpsSelect ? parseInt(fpsSelect.value, 10) : 30,
            caption: capCheck ? capCheck.checked : true
          });
        }
      });
    }

    const exportHtmlBtn = document.getElementById('neon-export-html');
    if (exportHtmlBtn) {
      exportHtmlBtn.addEventListener('click', () => {
        const v = getViewer();
        if (v) exportStandaloneHtml(v).catch(err => notify(err.message));
      });
    }

    const shareHtmlBtn = document.getElementById('neon-share-html');
    if (shareHtmlBtn) {
      shareHtmlBtn.addEventListener('click', () => {
        const v = getViewer();
        if (v) exportStandaloneHtml(v).catch(err => notify(err.message));
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
  } else {
    initUI();
  }

  window.NeonCapture = {
    takeStill,
    startRecording,
    stopRecording,
    exportStandaloneHtml,
    resolutions: RESOLUTIONS,
    getSupportedVideoMimeType
  };

})(window);
