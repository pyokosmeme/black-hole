/* Viewer settings never change the site-wide BH preference or background parameters. */
(function () {
  'use strict';
  const base=new URL('./',document.currentScript.src);
  const siteBase=new URL(window.NEON_SITE_ASSETS||'../',base);
  const scene=document.getElementById('neon-scene');
  if(!scene) return;
  const $=id=>document.getElementById(id),status=$('neon-status');
  const controls=new Map(),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let viewer,feedbackTimer,movingCamera=false;
  function message(text){
    clearTimeout(feedbackTimer);status.textContent=text;
    // Keep errors and clipboard/export feedback readable even with a pane open.
    const pane=document.querySelector('.neon-viewport [data-map-pane]:not([hidden]) .map-pane-body');
    if(pane){let note=pane.querySelector('.neon-feedback');if(!note){note=document.createElement('p');note.className='neon-feedback';note.setAttribute('role','status');pane.prepend(note);}note.textContent=text;}
  }
  function syncFields(){
    const values=viewer.settings();for(const [path,input] of controls){const value=NeonSettings.get(values,path);if(input.type==='checkbox')input.checked=value;else input.value=value;}
    $('neon-grid').setAttribute('aria-pressed',String(values.neon_grid));
    $('neon-floor').setAttribute('aria-pressed',String(values.neon_floor));
    $('neon-stationary').setAttribute('aria-pressed',String(!values.observer.motion));
    $('neon-camera-controls').hidden=values.observer.motion;
    scene.closest('.neon-viewport').classList.toggle('is-stationary',!values.observer.motion);
    if(values.observer.motion)stopCamera();
  }
  // Use mobile device signals, never CPU architecture or window size.
  const mobile=navigator.userAgentData?.mobile===true || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  let padPointer=null,drag=null,padFrame=null,padX=0,padY=0,padTime=0;
  function stopCamera(){
    if(padFrame!==null)cancelAnimationFrame(padFrame);
    padFrame=null;padPointer=null;drag=null;padX=padY=0;
    $('neon-camera-pad').querySelector('.neon-pad-thumb').style.transform='';
  }
  function moveCamera(yaw,pitch,zoom=0,move=movingCamera){
    if(move){viewer.orbitCamera(yaw,pitch);viewer.moveCamera(0,0,zoom);}else viewer.moveCamera(yaw,pitch,zoom);
    syncFields();
  }
  function setupCamera(){
    const pad=$('neon-camera-pad');pad.hidden=!mobile;
    if(mobile)$('neon-camera-help').textContent='Drag / thumb pad · Move changes position · +/− zoom';
    $('neon-camera-move').addEventListener('click',()=>{movingCamera=!movingCamera;$('neon-camera-move').setAttribute('aria-pressed',String(movingCamera));message(movingCamera?'Move camera around the hole.':'Look around from this position.');});
    const available=()=>!viewer.settings().observer.motion&&!scene.closest('.neon-viewport').classList.contains('has-pane');
    function padPosition(e){const r=pad.getBoundingClientRect();padX=Math.max(-1,Math.min(1,(e.clientX-r.x-r.width/2)/30));padY=Math.max(-1,Math.min(1,(e.clientY-r.y-r.height/2)/30));pad.querySelector('.neon-pad-thumb').style.transform=`translate(${padX*24}px,${padY*24}px)`;}
    function tick(now){if(padPointer===null||!available()){stopCamera();return;}const dt=Math.min((now-padTime)/1000,.05);padTime=now;moveCamera(padX*45*dt,-padY*35*dt);padFrame=requestAnimationFrame(tick);}
    pad.addEventListener('pointerdown',e=>{if(!available()||padPointer!==null||e.button!==0)return;e.preventDefault();padPointer=e.pointerId;pad.setPointerCapture(e.pointerId);padPosition(e);padTime=performance.now();padFrame=requestAnimationFrame(tick);});
    pad.addEventListener('pointermove',e=>{if(e.pointerId===padPointer)padPosition(e);});
    for(const name of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(name,e=>{if(e.pointerId===padPointer)stopCamera();});
    scene.addEventListener('pointerdown',e=>{if(!available()||drag||e.button!==0)return;scene.focus({preventScroll:true});scene.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX,y:e.clientY};});
    scene.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;moveCamera((e.clientX-drag.x)*.18,(drag.y-e.clientY)*.18,0,movingCamera||e.shiftKey);drag.x=e.clientX;drag.y=e.clientY;});
    for(const name of ['pointerup','pointercancel','lostpointercapture'])scene.addEventListener(name,e=>{if(drag?.id===e.pointerId)drag=null;});
    scene.addEventListener('wheel',e=>{if(!available())return;e.preventDefault();moveCamera(0,0,Math.sign(e.deltaY)*.07);},{passive:false});
    function keyboard(e){if(!available())return;const moves={ArrowLeft:[-3,0],ArrowRight:[3,0],ArrowUp:[0,3],ArrowDown:[0,-3],'+':[0,0,-.07],'=':[0,0,-.07],'-':[0,0,.07]};const positions={a:[-3,0],d:[3,0],w:[0,3],s:[0,-3]};if(positions[e.key.toLowerCase()]){e.preventDefault();viewer.orbitCamera(...positions[e.key.toLowerCase()]);syncFields();}else if(moves[e.key]){e.preventDefault();moveCamera(...moves[e.key]);}}
    scene.addEventListener('keydown',keyboard);pad.addEventListener('keydown',keyboard);
    $('neon-zoom-in').addEventListener('click',()=>moveCamera(0,0,-.1));
    $('neon-zoom-out').addEventListener('click',()=>moveCamera(0,0,.1));
    $('neon-camera-center').addEventListener('click',()=>{const c=viewer.settings().camera;moveCamera(-c.yaw,-c.pitch,0,false);});
    window.addEventListener('blur',stopCamera);
    document.addEventListener('visibilitychange',stopCamera);
    document.addEventListener('mapwindow:layout',()=>{if(!available())stopCamera();});
  }
  function pause(on){viewer.setPaused(on);$('neon-pause').setAttribute('aria-pressed',String(on));$('neon-pause').textContent=on?'Resume':'Pause';}
  function load(input){viewer.applySettings(input);syncFields();message('Settings loaded.');}
  function buildFields(){
    const groups=new Map();
    for(const field of NeonSettings.fields){
      if(!groups.has(field.group)){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=field.group;details.append(summary);details.open=field.group==='View';$('neon-fields').append(details);groups.set(field.group,details);}
      const label=document.createElement('label');label.className='acidburn-field neon-control';
      const caption=document.createElement('span');caption.textContent=field.label;label.append(caption);
      const input=document.createElement(field.type==='select'?'select':'input');input.id='setting-'+field.path.replaceAll('.','-');
      if(field.type==='select')for(const value of field.values){const option=document.createElement('option');option.value=value;option.textContent=value;input.append(option);}
      else{input.type=field.type;if(field.type==='number'){input.min=field.min;input.max=field.max;input.step=field.step;}}
      label.append(input);groups.get(field.group).append(label);controls.set(field.path,input);
      input.addEventListener('change',()=>{
        const next=viewer.settings();NeonSettings.set(next,field.path,input.type==='checkbox'?input.checked:input.type==='number'?input.valueAsNumber:input.value);
        try{viewer.applySettings(next,true);syncFields();input.setCustomValidity('');message('View updated.');}catch(error){input.setCustomValidity(error.message);input.reportValidity();message(error.message);}
      });
      input.addEventListener('input',()=>input.setCustomValidity(''));
    }
    syncFields();
  }
  async function copy(){
    const text=JSON.stringify(viewer.settings(),null,2);$('neon-json').value=text;
    try{await navigator.clipboard.writeText(text);message('Settings copied.');}
    catch{message('Select and copy the JSON below.');$('neon-json').focus();$('neon-json').select();}
  }
  async function download(){
    const button=$('neon-zip');button.disabled=true;
    // Snapshot before any asynchronous asset requests.
    const snapshot=viewer.settings();
    try{
      message('Preparing ZIP…');
      const neonFiles=['index.html','settings.js','zip.js','viewer.js','NOTICE.txt','raytracer-neon.glsl','raytracer-orig.glsl','js-libs/three.min.js','js-libs/Detector.js','js-libs/mustache.min.js','js-libs/three-js-monkey-patch.js','js-libs/acidburn-galaxy.js','js-libs/neon-blackhole.js','img/accretion-disk.png','img/beach-ball.png','img/spectra.png','img/stars.png'];
      const sharedFiles=['css/acidburn.css','css/map-window.css','css/neon-viewer.css'];
      const requests=[...neonFiles.map(name=>({name,url:new URL(name,base)})),...sharedFiles.map(name=>({name,url:new URL(name,siteBase)})),{name:'map-window.js',url:new URL(window.NEON_PACKAGED?'map-window.js':'js/map-window.js',siteBase)}];
      const entries=await Promise.all(requests.map(async item=>{
        let response;
        try{response=await fetch(item.url);}catch{throw new Error('Could not fetch '+item.name+'.');}
        if(!response.ok)throw new Error('Could not load '+item.name+'.');
        if(item.name==='index.html'){
          // Hosting may inject analytics into served HTML. The portable viewer
          // contains only its bundled scripts, even when exported from production.
          const template=new DOMParser().parseFromString(await response.text(),'text/html');
          template.querySelectorAll('script[src]').forEach(script=>{if(new URL(script.getAttribute('src'),item.url).origin!==item.url.origin)script.remove();});
          let html='<!doctype html>\n'+template.documentElement.outerHTML;
          html=html.replaceAll('../css/','css/').replaceAll('../img/','img/').replaceAll('../js/map-window.js','map-window.js').replace("window.NEON_SITE_ASSETS='../'","window.NEON_SITE_ASSETS='./'").replace('window.NEON_PACKAGED=false','window.NEON_PACKAGED=true');
          return {name:item.name,data:html};
        }
        return {name:item.name,data:await response.arrayBuffer()};
      }));
      entries.push({name:'defaults.js',data:'window.NEON_DEFAULT_SETTINGS = '+JSON.stringify(snapshot,null,2)+';\n'});
      entries.push({name:'settings.json',data:JSON.stringify(snapshot,null,2)+'\n'});
      entries.push({name:'README.txt',data:'NEON BLACK HOLE\n\nYour chosen settings are baked into defaults.js and also saved in settings.json.\n\nUnzip into a folder. Serve that folder with any static web server.\nWith Python installed, run: python -m http.server 8000 --bind 127.0.0.1\nThen open http://localhost:8000 in a WebGL-capable browser.\nOpening index.html directly as a file may block shader loading.\nAll scripts, shaders, textures and styles are included. Google Fonts is optional; the viewer works offline with fallback fonts.\n\nReset returns to the exported defaults. Load JSON accepts settings.json or copied viewer JSON.\nSettings capture configuration, not an exact animation frame.\nSee NOTICE.txt for original attribution and license information.\n'});
      const blob=NeonZip.create(entries),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='neon-black-hole.zip';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
      message('ZIP downloaded with your current settings.');
    }catch(error){message(error.message);}finally{button.disabled=false;}
  }
  try{
    viewer=createNeonBlackhole({container:scene,base:base.href,settings:window.NEON_DEFAULT_SETTINGS||{look:{floor_infinite:true}}});
    window.NeonViewer=viewer;
    if(reduced.matches)pause(true);
    const initial=viewer.settings();
    buildFields();
    setupCamera();
    for(const [id,key] of [['neon-grid','neon_grid'],['neon-floor','neon_floor']])$(id).addEventListener('click',()=>{viewer.params[key]=!viewer.params[key];viewer.recompile();syncFields();message((key==='neon_grid'?'Grid':'Floor')+(viewer.params[key]?' on.':' off.'));});
    $('neon-stationary').addEventListener('click',()=>{const next=viewer.settings();next.observer.motion=!next.observer.motion;if(!next.observer.motion){next.camera.pitch=0;next.camera.yaw=0;}load(next);message(next.observer.motion?'Automatic orbit.':'Stationary camera. Drag to look around.');});
    $('neon-pause').addEventListener('click',()=>pause(!viewer.isPaused()));
    $('neon-reset').addEventListener('click',()=>{load(initial);pause(reduced.matches);message('Default settings restored.');});
    $('neon-copy').addEventListener('click',copy);
    $('neon-zip').addEventListener('click',download);
    $('neon-load').addEventListener('click',()=>{try{load(JSON.parse($('neon-json').value));}catch(error){message('Could not load JSON: '+error.message);}});
    $('neon-file').addEventListener('change',async()=>{const file=$('neon-file').files[0];if(!file)return;try{if(file.size>65536)throw new Error('Settings files must be under 64 KB.');load(JSON.parse(await file.text()));}catch(error){message('Could not load file: '+error.message);}finally{$('neon-file').value='';}});
    reduced.addEventListener('change',()=>{if(reduced.matches)pause(true);});
    viewer.ready.then(()=>message(reduced.matches?'Paused for reduced motion.':'Neon black hole ready.')).catch(error=>{viewer.setActive(false);message('Viewer unavailable: '+error.message);});
  }catch(error){
    document.body.classList.add('no-webgl');
    message(error.message);
    for(const id of ['neon-pause','neon-reset','neon-copy','neon-zip','neon-load','neon-file','neon-grid','neon-floor','neon-stationary'])$(id).disabled=true;
  }
})();
