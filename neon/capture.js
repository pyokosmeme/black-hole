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
  let activeFrameHandler = null;
  let recordingStartTime = 0;
  let activeRecordingRes = null;
  let fixedRecording = null;

  // Minimal WebM muxer for timestamped VP8 frames. Fixed clips do not depend on
  // captureStream's wall clock or the speed of the user's GPU.
  function makeWebM(frames, width, height, duration) {
    const bytes = (...parts) => {
      const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
      let offset = 0; for (const p of parts) { out.set(p, offset); offset += p.length; } return out;
    };
    const id = n => { const a = []; do { a.unshift(n & 255); n = Math.floor(n / 256); } while (n); return new Uint8Array(a); };
    const size = n => {
      let length = 1; while (n >= 2 ** (7 * length) - 1) length++;
      const a = new Uint8Array(length);
      for (let i = length - 1; i >= 0; i--) { a[i] = n % 256; n = Math.floor(n / 256); }
      a[0] |= 1 << (8 - length); return a;
    };
    const element = (key, data) => bytes(id(key), size(data.length), data);
    const uint = (key, n) => element(key, id(n));
    const str = (key, s) => element(key, new TextEncoder().encode(s));
    const float = (key, n) => { const a = new Uint8Array(8); new DataView(a.buffer).setFloat64(0, n); return element(key, a); };
    const header = element(0x1a45dfa3, bytes(uint(0x4286, 1), uint(0x42f7, 1), uint(0x42f2, 4), uint(0x42f3, 8), str(0x4282, 'webm'), uint(0x4287, 2), uint(0x4285, 2)));
    const info = element(0x1549a966, bytes(uint(0x2ad7b1, 1000000), float(0x4489, duration * 1000), str(0x4d80, 'Neon'), str(0x5741, 'Neon')));
    const track = element(0x1654ae6b, element(0xae, bytes(uint(0xd7, 1), uint(0x73c5, 1), uint(0x83, 1), str(0x86, 'V_VP8'), element(0xe0, bytes(uint(0xb0, width), uint(0xba, height))))));
    const clusters = frames.map(f => element(0x1f43b675, bytes(uint(0xe7, Math.round(f.timestamp / 1000)), element(0xa3, bytes(new Uint8Array([0x81, 0, 0, f.key ? 0x80 : 0]), f.data)))));
    return new Blob([header, element(0x18538067, bytes(info, track, ...clusters))], { type: 'video/webm' });
  }

  async function renderFixedClip(viewer, opts, width, height, duration, fps) {
    if (!window.VideoEncoder || !window.VideoFrame) throw new Error('Fixed clips require a browser with VideoEncoder support. Use Manual recording in this browser.');
    const config = { codec: 'vp8', width, height, bitrate: Math.max(12000000, Math.min(60000000, width * height * fps * .4)), framerate: fps };
    if (!(await VideoEncoder.isConfigSupported(config)).supported) throw new Error('This browser cannot encode VP8 at the chosen dimensions. Choose a smaller resolution or Manual recording.');
    const job = fixedRecording;
    let timeline, encoder, failure;
    try {
      await viewer.ready; await viewer.textureReady;
      if (document.fonts) await document.fonts.ready;
      if (job.cancelled) return;
      timeline = viewer.beginCaptureTimeline();
      const sceneSettings = JSON.stringify(viewer.settings());
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d'), caption = document.createElement('canvas'); caption.width = width; caption.height = height;
      const lettering = document.querySelector('.neon-lettering');
      if (opts.caption !== false) {
        if (typeof window.renderLettering === 'function') window.renderLettering(caption, width, height);
        else if (lettering && !lettering.hidden) caption.getContext('2d').drawImage(lettering, 0, 0, width, height);
      }
      const frames = [];
      encoder = new VideoEncoder({ output: chunk => { const data = new Uint8Array(chunk.byteLength); chunk.copyTo(data); frames.push({ data, timestamp: chunk.timestamp, key: chunk.type === 'key' }); }, error: error => { failure = error; } });
      encoder.configure(config);
      const count = Math.round(duration * fps);
      recordingStartTime = performance.now(); updateRecordingUI(true, duration);
      // Frame count determines completion, even if rendering takes minutes.
      for (let i = 0; i < count && !job.cancelled; i++) {
        if (JSON.stringify(viewer.settings()) !== sceneSettings) throw new Error('Scene settings changed. Video cancelled; record again with the new settings.');
        const elapsed = i / fps;
        const sample = opts.loop ? duration / (2 * Math.PI) * (1 - Math.cos(2 * Math.PI * elapsed / duration)) : elapsed;
        ctx.drawImage(timeline.captureAtTime(sample, width, height), 0, 0);
        ctx.drawImage(caption, 0, 0);
        const frame = new VideoFrame(canvas, { timestamp: Math.round(i * 1000000 / fps), duration: Math.round(1000000 / fps) });
        try { encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 }); } finally { frame.close(); }
        if (encoder.encodeQueueSize > 4) await encoder.flush();
        if (failure) throw failure;
        notify(`Rendering video: ${i + 1} / ${count} frames`);
        const timerText = document.getElementById('neon-rec-timer');
        if (timerText) timerText.textContent = `${i + 1} / ${count} frames`;
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      if (job.cancelled) { notify('Video export cancelled.'); return; }
      await encoder.flush(); if (failure) throw failure;
      if (job.cancelled) { notify('Video export cancelled.'); return; }
      const blob = makeWebM(frames, width, height, duration);
      const filename = opts.filename || `neon-black-hole-${width}x${height}${opts.loop ? '-loop' : ''}.webm`;
      downloadBlob(blob, filename); notify(`Video saved: ${filename}`);
      if (typeof opts.onComplete === 'function') opts.onComplete(blob, filename);
    } finally {
      if (encoder && encoder.state !== 'closed') encoder.close();
      if (timeline) timeline.finish();
      if (recordTimerInterval) clearInterval(recordTimerInterval);
      fixedRecording = null; updateRecordingUI(false);
    }
  }

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
      // Draw the poster text at 2x and downsample with smoothing, so beveled
      // edges and the "Sculpted" glyph paths get real antialiasing in stills
      // instead of the single-sample edges a direct same-size draw leaves.
      const ssScale = 2;
      const ss = document.createElement('canvas');
      ss.width = targetW * ssScale;
      ss.height = targetH * ssScale;
      window.renderLettering(ss, ss.width, ss.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(ss, 0, 0, targetW, targetH);
    } else if (includeCaption && lettering && !lettering.hidden) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
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
    if (fixedRecording) { stopRecording(); return; }
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      stopRecording();
      return;
    }
    if (!viewer) throw new Error('Visualizer not ready.');

    const resKey = opts.resolution || '1080p';
    const res = RESOLUTIONS[resKey] || RESOLUTIONS.current;
    const durationSec = parseFloat(opts.duration ?? 5);
    const fps = parseInt(opts.fps || 30, 10);
    const includeCaption = opts.caption !== false;
    const loop = opts.loop === true;
    if (loop && (!Number.isFinite(durationSec) || durationSec <= 0)) throw new Error('Choose a fixed clip length for a loop.');
    if (loop && typeof viewer.beginCaptureTimeline !== 'function') throw new Error('This viewer does not support loop recording.');

    const sceneEl = document.getElementById('neon-scene');
    const liveCanvas = sceneEl ? sceneEl.querySelector('canvas') : null;
    if (!liveCanvas) throw new Error('Scene canvas not found.');

    let targetW = opts.width || res.width || liveCanvas.width;
    let targetH = opts.height || res.height || liveCanvas.height;

    if (durationSec > 0) {
      if (![30, 60].includes(fps) || !Number.isFinite(durationSec) || durationSec > 30) throw new Error('Choose 30 or 60 FPS and a clip length up to 30 seconds.');
      fixedRecording = { cancelled: false };
      return renderFixedClip(viewer, opts, targetW, targetH, durationSec, fps).catch(error => { fixedRecording = null; notify(error.message); });
    }

    const mimeType = getSupportedVideoMimeType();
    if (!mimeType) throw new Error('MediaRecorder video recording is not supported in this browser.');

    const compCanvas = document.createElement('canvas');
    compCanvas.width = targetW;
    compCanvas.height = targetH;
    const compCtx = compCanvas.getContext('2d');

    // Seed the canvas before recording: captureStream can otherwise encode its
    // initial transparent frame as a black flash at the start of every repeat.
    compCtx.drawImage(viewer.captureAt(targetW, targetH), 0, 0, targetW, targetH);
    const stream = compCanvas.captureStream(fps);
    recordedChunks = [];

    try {
      mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: Math.max(12000000, Math.min(60000000, targetW * targetH * fps * 0.4)) });
    } catch {
      mediaRecorder = new MediaRecorder(stream);
    }

    activeRecordingRes = { width: targetW, height: targetH, mimeType: mediaRecorder.mimeType || mimeType };

    mediaRecorder.ondataavailable = e => {
      if (e.data && e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      if (compositingRaf) cancelAnimationFrame(compositingRaf);
      if (activeFrameHandler) {
        if (typeof viewer.removeFrameListener === 'function') viewer.removeFrameListener(activeFrameHandler);
        activeFrameHandler = null;
      }
      if (recordTimerInterval) clearInterval(recordTimerInterval);
      if (recordTimeout) clearTimeout(recordTimeout);
      stream.getTracks().forEach(track => track.stop());
      updateRecordingUI(false);

      if (recordedChunks.length === 0) {
        notify('No video data recorded.');
        return;
      }
      const blob = new Blob(recordedChunks, { type: activeRecordingRes.mimeType });
      const ext = activeRecordingRes.mimeType.includes('mp4') ? 'mp4' : 'webm';
      const filename = opts.filename || `neon-black-hole-${activeRecordingRes.width}x${activeRecordingRes.height}${loop ? '-loop' : ''}.${ext}`;
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
      compCtx.drawImage(captionCanvas, 0, 0);
    } else if (includeCaption && lettering && !lettering.hidden) {
      compCtx.drawImage(lettering, 0, 0, targetW, targetH);
    }
    let lastComposite = -Infinity;
    function compositeFrame() {
      const now = performance.now();
      if (now - lastComposite < 1000 / fps) return;
      lastComposite = now;
      const rendered = targetW === liveCanvas.width && targetH === liveCanvas.height
          ? liveCanvas : viewer.captureAt(targetW, targetH);
      // Draw straight from the live canvas, called synchronously right after the
      // viewer renders it (see addFrameListener below). Without this, reading the
      // canvas from a second, independent requestAnimationFrame loop could land
      // after the browser silently clears the WebGL buffer (preserveDrawingBuffer
      // is off for performance), grabbing a blank or half-composited frame —
      // the source of the flicker/garbage-block artifacts in recorded video.
      compCtx.drawImage(rendered, 0, 0, targetW, targetH);
      if (hasCaption && typeof window.renderLettering === 'function') {
        compCtx.drawImage(captionCanvas, 0, 0);
      } else if (includeCaption && lettering && !lettering.hidden) {
        compCtx.drawImage(lettering, 0, 0, targetW, targetH);
      }
    }
    function pump() {
      compositeFrame();
      if (mediaRecorder && mediaRecorder.state === 'recording') {
        compositingRaf = requestAnimationFrame(pump);
      }
    }

    mediaRecorder.start(200);
    recordingStartTime = performance.now();
    if (typeof viewer.addFrameListener === 'function') {
      activeFrameHandler = compositeFrame;
      viewer.addFrameListener(activeFrameHandler);
      viewer.capture();
      compositeFrame();
    } else {
      pump();
    }
    updateRecordingUI(true, durationSec);

    if (durationSec > 0) {
      recordTimeout = setTimeout(() => {
        stopRecording();
      }, durationSec * 1000);
    }
  }

  function stopRecording() {
    if (fixedRecording) { fixedRecording.cancelled = true; return; }
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
        if (fixedRecording) return; // Fixed exports report rendered frames, not wall-clock time.
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
                    <option value="custom">Custom aspect ratio…</option>
                  </select>
                </label>
                <label class="acidburn-field neon-control" id="neon-video-custom-w-field" hidden>
                  <span>Width (px)</span>
                  <input type="number" id="neon-video-custom-w" min="160" max="7680" step="2" value="1920">
                </label>
                <label class="acidburn-field neon-control" id="neon-video-custom-h-field" hidden>
                  <span>Height (px)</span>
                  <input type="number" id="neon-video-custom-h" min="160" max="7680" step="2" value="1080">
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
                <label class="acidburn-field neon-control">
                  <span>Smooth back-and-forth loop</span>
                  <input type="checkbox" id="neon-video-loop" aria-describedby="neon-loop-note">
                </label>
                <p id="neon-loop-note">Eases forward, then reverses to the starting scene. Choose a fixed clip length. Keep scene settings unchanged during recording.</p>
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
                    <option value="custom">Custom aspect ratio…</option>
                  </select>
                </label>
                <label class="acidburn-field neon-control" id="neon-still-custom-w-field" hidden>
                  <span>Width (px)</span>
                  <input type="number" id="neon-still-custom-w" min="160" max="7680" step="2" value="1920">
                </label>
                <label class="acidburn-field neon-control" id="neon-still-custom-h-field" hidden>
                  <span>Height (px)</span>
                  <input type="number" id="neon-still-custom-h" min="160" max="7680" step="2" value="1080">
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

  function clampDim(v, fallback) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n >= 160 && n <= 7680 ? n : fallback;
  }

  function wireCustomResField(selectId, wFieldId, hFieldId) {
    const select = document.getElementById(selectId);
    const wField = document.getElementById(wFieldId);
    const hField = document.getElementById(hFieldId);
    if (!select || !wField || !hField) return;
    const sync = () => {
      const isCustom = select.value === 'custom';
      wField.hidden = !isCustom;
      hField.hidden = !isCustom;
    };
    select.addEventListener('change', sync);
    sync();
  }

  function initUI() {
    function getViewer() { return window.NeonViewer; }
    const loopCheck = document.getElementById('neon-video-loop');
    const clipLength = document.getElementById('neon-video-len');
    if (loopCheck && clipLength) {
      loopCheck.addEventListener('change', () => {
        clipLength.querySelector('option[value="0"]').disabled = loopCheck.checked;
        if (loopCheck.checked && clipLength.value === '0') clipLength.value = '5';
      });
    }

    wireCustomResField('neon-video-res', 'neon-video-custom-w-field', 'neon-video-custom-h-field');
    wireCustomResField('neon-still-res', 'neon-still-custom-w-field', 'neon-still-custom-h-field');

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
        document.getElementById('neon-start-record')?.click();
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
        const opts = { resolution: resKey, caption: includeCap };
        if (resKey === 'custom') {
          opts.width = clampDim(document.getElementById('neon-still-custom-w')?.value, 1920);
          opts.height = clampDim(document.getElementById('neon-still-custom-h')?.value, 1080);
        }
        takeStill(v, opts).catch(err => notify(err.message));
      });
    }

    const startRecBtn = document.getElementById('neon-start-record');
    if (startRecBtn) {
      startRecBtn.addEventListener('click', () => {
        const v = getViewer();
        if (!v) return;
        if (fixedRecording || (mediaRecorder && mediaRecorder.state === 'recording')) {
          stopRecording();
        } else {
          const resSelect = document.getElementById('neon-video-res');
          const lenSelect = document.getElementById('neon-video-len');
          const fpsSelect = document.getElementById('neon-video-fps');
          const capCheck = document.getElementById('neon-video-caption');
          const resKey = resSelect ? resSelect.value : '1080p';
          const recOpts = {
            resolution: resKey,
            duration: lenSelect ? parseFloat(lenSelect.value) : 5,
            fps: fpsSelect ? parseInt(fpsSelect.value, 10) : 30,
            caption: capCheck ? capCheck.checked : true,
            loop: document.getElementById('neon-video-loop')?.checked === true
          };
          if (resKey === 'custom') {
            recOpts.width = clampDim(document.getElementById('neon-video-custom-w')?.value, 1920);
            recOpts.height = clampDim(document.getElementById('neon-video-custom-h')?.value, 1080);
          }
          try { startRecording(v, recOpts); } catch (err) { notify(err.message); }
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
