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
  let posterFontPromise=null,posterFontReady=false;
  function loadPosterFont(){
    if(!posterFontPromise){const font=new FontFace('Neon Teko',`url("${new URL('fonts/Teko.ttf',base).href}")`,{weight:'300 700'});document.fonts.add(font);posterFontPromise=font.load().then(()=>{posterFontReady=true;drawLettering();}).catch(()=>message('Poster font could not load. Using fallback lettering.'));}
    return posterFontPromise;
  }
  const lettering=document.createElement('canvas');lettering.className='neon-lettering';lettering.setAttribute('aria-hidden','true');scene.after(lettering);
  let letteringKey=null;
  function drawLettering(){
    if(!viewer)return;
    const c=viewer.params.caption,w=Math.max(1,scene.clientWidth),h=Math.max(1,scene.clientHeight),dpr=Math.min(devicePixelRatio,2);
    const key=JSON.stringify([c,w,h,dpr,posterFontReady,document.fonts.status,viewer.params.look.floor_palette,viewer.params.look.floor_color]);
    if(key===letteringKey)return;letteringKey=key;
    lettering.width=Math.round(w*dpr);lettering.height=Math.round(h*dpr);
    const ctx=lettering.getContext('2d');ctx.scale(dpr,dpr);
    lettering.hidden=!c.enabled||!c.text;
    if(lettering.hidden)return;
    if(c.font==='Teko'&&!posterFontReady)loadPosterFont();
    const lines=(c.uppercase?c.text.toUpperCase():c.text).split(/[|\n]/).slice(0,6),size=h*c.size/100,lineHeight=size*c.line_gap;
    ctx.font=`${c.font==='Teko'?700:900} ${size}px ${c.font==='Teko'?'"Neon Teko"':c.font==='Orbitron'?'Orbitron':'Impact, "Arial Black"'}, sans-serif`;
    const measured=Math.max(...lines.map(line=>ctx.measureText(line).width),1),scale=Math.min(c.stretch,w*c.width/100/measured);
    ctx.translate(w*c.x/100,h*c.y/100);ctx.scale(scale,1);ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='miter';ctx.miterLimit=2;
    lines.forEach((line,index)=>{
      const y=(index-(lines.length-1)/2)*lineHeight;
      const metrics=ctx.measureText(line),lineWidth=metrics.width,base=metrics.actualBoundingBoxDescent;
      function terminals(target,cx,cy){
        if(!c.angular||index===0||!line.trim())return;
        const left=cx-metrics.actualBoundingBoxLeft,right=cx+metrics.actualBoundingBoxRight,bottom=cy+base;
        target.moveTo(left,bottom-size*.035);target.lineTo(left,bottom+size*.2);target.lineTo(left+size*.14,bottom-size*.035);target.closePath();
        target.moveTo(right,bottom-size*.035);target.lineTo(right,bottom+size*.2);target.lineTo(right-size*.14,bottom-size*.035);target.closePath();
      }
      function strokeLetters(){ctx.strokeText(line,0,y);ctx.beginPath();terminals(ctx,0,y);ctx.stroke();}
      // Narrow layered metal bevels, with a dark face reflecting a horizon
      // and perspective grid rather than a thick, rounded pastel outline.
      const bevel=size*.04*c.bevel;
      ctx.fillStyle='#211b24';ctx.strokeStyle='#20121b';ctx.lineWidth=Math.max(1,bevel);
      for(let i=4;i>0;i--){ctx.fillText(line,i*size*.008,y+i*size*.008);if(bevel)ctx.strokeText(line,i*size*.008,y+i*size*.008);}
      if(bevel){
        const edge=ctx.createLinearGradient(0,y-size*.5,0,y+size*.5);[[0,'#ffdfac'],[.25,'#68412e'],[.48,'#f8ddb4'],[.53,'#483125'],[1,'#dba575']].forEach(([at,color])=>edge.addColorStop(at,color));
        const neon=viewer.params.look.floor_palette?viewer.params.look.floor_color:'#e879ef';
        if(c.glow){ctx.strokeStyle=neon;ctx.lineWidth=bevel*2.1;ctx.shadowColor=neon;ctx.shadowBlur=size*.045*c.glow;strokeLetters();ctx.shadowBlur=size*.12*c.glow;ctx.globalAlpha=.2;strokeLetters();ctx.globalAlpha=1;ctx.shadowBlur=0;}
        ctx.strokeStyle=edge;ctx.lineWidth=bevel*1.7;ctx.shadowColor=neon;ctx.shadowBlur=size*.02;strokeLetters();ctx.shadowBlur=0;
        ctx.strokeStyle='#281c21';ctx.lineWidth=bevel;strokeLetters();
        ctx.strokeStyle='#f2cda0';ctx.lineWidth=bevel*.24;strokeLetters();
      }
      const face=document.createElement('canvas'),fw=Math.ceil(lineWidth+size*.16),fh=Math.ceil(size*1.8);
      face.width=Math.ceil(fw*dpr);face.height=Math.ceil(fh*dpr);
      const fc=face.getContext('2d');fc.scale(dpr,dpr);fc.font=ctx.font;fc.textAlign='center';fc.textBaseline='middle';
      const gradient=fc.createLinearGradient(0,fh/2-size*.5,0,fh/2+size*.5);
      const iridescent=c.style==='iridescent'||c.style==='mixed'&&index>0;
      const stops=!iridescent?[[0,'#563324'],[.2,'#a66c42'],[.43,'#eac395'],[.49,'#fff4d5'],[.53,'#16291f'],[.69,'#101a20'],[.8,'#643d71'],[1,'#c49b77']]:[[0,'#184738'],[.27,'#397957'],[.47,'#ffe2bb'],[.53,'#162820'],[.66,'#121b28'],[.82,'#965490'],[1,'#eed1a5']];
      stops.forEach(([at,color])=>gradient.addColorStop(at,color));fc.fillStyle=gradient;fc.fillText(line,fw/2,fh/2);
      fc.beginPath();terminals(fc,fw/2,fh/2);fc.fill();
      fc.globalCompositeOperation='source-atop';
      if(c.metal){
        fc.lineWidth=Math.max(.35,size*.003);fc.strokeStyle=`rgba(255,245,222,${c.metal*.22})`;
        for(let i=0;i<38;i++){const sy=fh*.18+i*size*.009;fc.beginPath();fc.moveTo(0,sy);fc.bezierCurveTo(fw*.3,sy+Math.sin(i*1.37)*size*.012,fw*.7,sy-Math.cos(i*.91)*size*.009,fw,sy+size*.004);fc.stroke();}
        const shine=fc.createLinearGradient(0,0,fw,fh*.6);[[0,'rgba(255,250,223,0)'],[.38,`rgba(255,250,223,${c.metal*.03})`],[.47,`rgba(255,250,223,${c.metal*.23})`],[.52,'rgba(255,250,223,0)'],[1,'rgba(255,250,223,0)']].forEach(([at,color])=>shine.addColorStop(at,color));fc.fillStyle=shine;fc.fillRect(0,0,fw,fh);
      }
      if(c.grid){const rgb=parseInt((viewer.params.look.floor_palette?viewer.params.look.floor_color:'#e879ef').slice(1),16);fc.strokeStyle=`rgba(${rgb>>16&255},${rgb>>8&255},${rgb&255},${c.grid*.72})`;fc.lineWidth=Math.max(.5,size*.006);const horizon=fh*.53;
        fc.beginPath();for(let i=0;i<=9;i++){const gy=horizon+(fh-horizon)*Math.pow(i/9,1.7);fc.moveTo(0,gy);fc.lineTo(fw,gy);}
        for(let i=-12;i<=12;i++){fc.moveTo(fw*.5+i*size*.055,horizon);fc.lineTo(fw*.5+i*size*.6,fh);}fc.stroke();
      }
      if(c.fuzz){const grain=document.createElement('canvas');grain.width=grain.height=64;const gc=grain.getContext('2d'),pixels=gc.createImageData(64,64);let seed=9217;
        for(let i=0;i<pixels.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)|0;const value=seed>>>24;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=value;pixels.data[i+3]=Math.round(c.fuzz*32);}
        gc.putImageData(pixels,0,0);fc.fillStyle=fc.createPattern(grain,'repeat');fc.fillRect(0,0,fw,fh);
      }
      ctx.drawImage(face,-fw/2,y-fh/2,fw,fh);
    });
  }
  new ResizeObserver(drawLettering).observe(scene);
  document.fonts.ready.then(drawLettering);
  function message(text){
    clearTimeout(feedbackTimer);status.textContent=text;
    // Keep errors and clipboard/export feedback readable even with a pane open.
    const pane=document.querySelector('.neon-viewport [data-map-pane]:not([hidden]) .map-pane-body');
    if(pane){let note=pane.querySelector('.neon-feedback');if(!note){note=document.createElement('p');note.className='neon-feedback';note.setAttribute('role','status');pane.prepend(note);}note.textContent=text;}
  }
  function syncFields(){
    const values=viewer.settings();for(const [path,input] of controls){const value=NeonSettings.get(values,path);if(input.type==='checkbox')input.checked=value;else input.value=value;}
    const height=controls.get('camera.height');if(height)height.disabled=values.observer.motion;
    for(const path of ['look.sky_motion','look.sky_speed','look.sky_axis_tilt','look.nebula_amount','look.nebula_scale','look.nebula_color','look.nebula_resolution']){const input=controls.get(path);if(input)input.disabled=values.renderer!=='neon';}
    for(const path of ['look.floor_color','look.floor_major_color']){const input=controls.get(path);if(input)input.disabled=!values.look.floor_palette;}
    for(const [name,path,asset] of [['planet','planet.texture','beach-ball.png'],['gas','look.gas_texture','accretion-disk.png']]){const preview=$('neon-'+name+'-preview');if(preview){const src=NeonSettings.get(values,path)||new URL('img/'+asset,base).href;if(preview.getAttribute('src')!==src)preview.src=src;}}
    drawLettering();
    $('neon-grid').setAttribute('aria-pressed',String(values.neon_grid));
    $('neon-floor').setAttribute('aria-pressed',String(values.neon_floor));
    $('neon-stationary').setAttribute('aria-pressed',String(!values.observer.motion));
    $('neon-camera-free').hidden=values.observer.motion;
    $('neon-camera-free').setAttribute('aria-pressed',String(values.camera.navigation==='free'));
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
    const c=viewer.params.camera;
    if(c.navigation==='free'&&(move||zoom)){viewer.translateCamera(move?yaw*c.move_speed/30:0,move?pitch*c.move_speed/30:0,-zoom*c.move_speed*4);if(!move)viewer.moveCamera(yaw,pitch,0);}
    else if(move){viewer.orbitCamera(yaw,pitch);viewer.moveCamera(0,0,zoom);}else viewer.moveCamera(yaw,pitch,zoom);
    syncFields();
  }
  function setupCamera(){
    const pad=$('neon-camera-pad');pad.hidden=!mobile;
    movingCamera=viewer.params.camera.navigation==='free';$('neon-camera-move').setAttribute('aria-pressed',String(movingCamera));
    $('neon-camera-free').addEventListener('click',()=>{stopCamera();viewer.params.camera.navigation=viewer.params.camera.navigation==='free'?'orbit':'free';movingCamera=viewer.params.camera.navigation==='free';$('neon-camera-move').setAttribute('aria-pressed',String(movingCamera));syncFields();message(movingCamera?'Free movement: drag or thumb pad to translate. Q/E changes height.':'Orbit movement restored.');});
    if(mobile)$('neon-camera-help').textContent='Drag / thumb pad · Move changes position · +/− zoom';
    $('neon-camera-move').addEventListener('click',()=>{movingCamera=!movingCamera;$('neon-camera-move').setAttribute('aria-pressed',String(movingCamera));message(movingCamera?'Move camera around the hole.':'Look around from this position.');});
    const available=()=>!viewer.settings().observer.motion&&!scene.closest('.neon-viewport').classList.contains('has-pane');
    function padPosition(e){const r=pad.getBoundingClientRect();padX=Math.max(-1,Math.min(1,(e.clientX-r.x-r.width/2)/30));padY=Math.max(-1,Math.min(1,(e.clientY-r.y-r.height/2)/30));pad.querySelector('.neon-pad-thumb').style.transform=`translate(${padX*24}px,${padY*24}px)`;}
    function tick(now){if(padPointer===null||!available()){stopCamera();return;}const dt=Math.min((now-padTime)/1000,.05);padTime=now;const factor=viewer.params.camera.sensitivity/.18;moveCamera(padX*45*dt*factor,-padY*35*dt*factor);padFrame=requestAnimationFrame(tick);}
    pad.addEventListener('pointerdown',e=>{if(!available()||padPointer!==null||e.button!==0)return;e.preventDefault();padPointer=e.pointerId;pad.setPointerCapture(e.pointerId);padPosition(e);padTime=performance.now();padFrame=requestAnimationFrame(tick);});
    pad.addEventListener('pointermove',e=>{if(e.pointerId===padPointer)padPosition(e);});
    for(const name of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(name,e=>{if(e.pointerId===padPointer)stopCamera();});
    scene.addEventListener('pointerdown',e=>{if(!available()||drag||e.button!==0)return;scene.focus({preventScroll:true});scene.setPointerCapture(e.pointerId);drag={id:e.pointerId,x:e.clientX,y:e.clientY};});
    scene.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const factor=viewer.params.camera.sensitivity*(e.altKey?.1:1);moveCamera((e.clientX-drag.x)*factor,(drag.y-e.clientY)*factor,0,movingCamera||e.shiftKey);drag.x=e.clientX;drag.y=e.clientY;});
    for(const name of ['pointerup','pointercancel','lostpointercapture'])scene.addEventListener(name,e=>{if(drag?.id===e.pointerId)drag=null;});
    scene.addEventListener('wheel',e=>{if(!available())return;e.preventDefault();moveCamera(0,0,Math.sign(e.deltaY)*.07);},{passive:false});
    function keyboard(e){
      if(!available())return;
      const k=e.key.toLowerCase(),c=viewer.params.camera,factor=(e.shiftKey?.1:1)*c.sensitivity/.18;
      const free={a:[-1,0,0],d:[1,0,0],w:[0,0,1],s:[0,0,-1],q:[0,-1,0],e:[0,1,0]};
      if(c.navigation==='free'&&free[k]){e.preventDefault();viewer.translateCamera(...free[k].map(v=>v*c.move_speed*.1*(e.shiftKey?.1:1)));syncFields();return;}
      const moves={ArrowLeft:[-3,0],ArrowRight:[3,0],ArrowUp:[0,3],ArrowDown:[0,-3],'+':[0,0,-.07],'=':[0,0,-.07],'-':[0,0,.07]},positions={a:[-3,0],d:[3,0],w:[0,3],s:[0,-3]};
      if(positions[k]){e.preventDefault();viewer.orbitCamera(...positions[k].map(v=>v*factor));syncFields();}else if(moves[e.key]){e.preventDefault();moveCamera(...moves[e.key].map(v=>v*factor));}
    }
    scene.addEventListener('keydown',keyboard);pad.addEventListener('keydown',keyboard);
    $('neon-zoom-in').addEventListener('click',()=>moveCamera(0,0,-.1));
    $('neon-zoom-out').addEventListener('click',()=>moveCamera(0,0,.1));
    $('neon-camera-center').addEventListener('click',()=>{const c=viewer.settings().camera;moveCamera(-c.yaw,-c.pitch,0,false);});
    window.addEventListener('blur',stopCamera);
    document.addEventListener('visibilitychange',stopCamera);
    document.addEventListener('mapwindow:layout',()=>{if(!available())stopCamera();});
  }
  function pause(on){viewer.setPaused(on);$('neon-pause').setAttribute('aria-pressed',String(on));$('neon-pause').textContent=on?'Resume':'Pause';}
  function load(input){viewer.applySettings(input);viewer.textureReady.catch(error=>message(error.message));syncFields();message('Settings loaded.');}
  function buildFields(){
    const groups=new Map();
    for(const field of NeonSettings.fields){
      if(!groups.has(field.group)){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent=field.group;details.append(summary);details.open=field.group==='View';$('neon-fields').append(details);groups.set(field.group,details);}
      const label=document.createElement('label');label.className='acidburn-field neon-control';
      const caption=document.createElement('span');caption.textContent=field.label;label.append(caption);
      if(field.type==='texture'){
        const name=field.path==='planet.texture'?'planet':'gas';label.classList.add('neon-wide-control');
        const file=document.createElement('input');file.type='file';file.id='neon-'+name+'-texture';file.accept='image/png,image/jpeg,image/webp';label.append(file);groups.get(field.group).append(label);
        const preview=document.createElement('img');preview.id='neon-'+name+'-preview';preview.className='neon-planet-preview';preview.alt=field.label+' map';groups.get(field.group).append(preview);
        const reset=document.createElement('button');reset.type='button';reset.className='acidburn-button';reset.id='neon-'+name+'-texture-reset';reset.textContent='Default '+name+' map';groups.get(field.group).append(reset);
        const note=document.createElement('p');note.textContent='Upload PNG, JPEG or WebP (up to 8 MB). '+(name==='planet'?'Images wrap as a 2:1 longitude / latitude map.':'Gas maps use horizontal radius and vertical angle around the disk; brightness controls emission.')+' Your map is embedded in copied settings and ZIPs.';groups.get(field.group).append(note);
        let generation=0;
        reset.addEventListener('click',()=>{generation++;const next=viewer.settings();NeonSettings.set(next,field.path,'');viewer.applySettings(next,true);syncFields();message('Default '+name+' map restored.');});
        file.addEventListener('change',async()=>{
          const chosen=file.files[0],request=++generation;if(!chosen)return;
          try{if(chosen.size>8388608||!['image/png','image/jpeg','image/webp'].includes(chosen.type))throw new Error('Choose PNG, JPEG or WebP under 8 MB.');
            const bitmap=await createImageBitmap(chosen);const canvas=document.createElement('canvas');canvas.width=Math.min(1024,bitmap.width);canvas.height=name==='planet'?Math.max(1,Math.round(canvas.width/2)):Math.max(1,Math.round(bitmap.height*canvas.width/bitmap.width));if(canvas.height>1024){canvas.width=Math.max(1,Math.round(canvas.width*1024/canvas.height));canvas.height=1024;}canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
            if(request!==generation)return;const next=viewer.settings();NeonSettings.set(next,field.path,canvas.toDataURL('image/jpeg',.92));viewer.applySettings(next,true);await viewer.textureReady;if(request===generation){syncFields();message(field.label+' loaded.');}
          }catch(error){message(error.message);}finally{file.value='';}
        });continue;
      }
      const input=document.createElement(field.type==='select'?'select':'input');input.id='setting-'+field.path.replaceAll('.','-');
      if(field.type==='select')for(const value of field.values){const option=document.createElement('option');option.value=value;option.textContent=value;input.append(option);}
      else{input.type=field.type;if(field.type==='number'){input.min=field.min;input.max=field.max;input.step=field.step;}if(field.type==='text'){input.maxLength=field.maxLength;label.classList.add('neon-wide-control');}}
      label.append(input);groups.get(field.group).append(label);controls.set(field.path,input);
      input.addEventListener('change',()=>{
        const next=viewer.settings();NeonSettings.set(next,field.path,input.type==='checkbox'?input.checked:input.type==='number'?input.valueAsNumber:input.value);
        try{viewer.applySettings(next,true);viewer.textureReady.catch(error=>message(error.message));syncFields();input.setCustomValidity('');message('View updated.');}catch(error){input.setCustomValidity(error.message);input.reportValidity();message(error.message);}
      });
      input.addEventListener('input',()=>input.setCustomValidity(''));
    }
    const lowView=document.createElement('button');lowView.type='button';lowView.className='acidburn-button';lowView.id='neon-camera-low';lowView.textContent='Near floor · look up';groups.get('Camera').append(lowView);
    lowView.addEventListener('click',()=>{stopCamera();const next=viewer.settings();next.observer.motion=false;next.observer.elevation=0;next.observer.distance=Math.max(next.observer.distance,Math.min(30,next.look.disk_outer+5));next.camera.height=Math.max(-100,Math.min(100,.5-next.look.floor_height));next.camera.pitch=next.camera.yaw=0;next.camera.offset_x=next.camera.offset_y=next.camera.offset_z=0;next.neon_floor=true;next.look.floor_follow_camera=false;viewer.applySettings(next,true);syncFields();message('Low view: adjust Camera height to raise or lower your viewpoint.');});
    const cameraHelp=document.createElement('p');cameraHelp.textContent='Stationary camera height raises or lowers the viewpoint while aiming at the black hole. Negative values move below it; Near floor gives a low starting view with the grid visible. Free move translates the camera. WASD moves sideways/forward, Q/E moves down/up. Shift keys or Alt-drag gives 10× finer control. On touch devices, lower sensitivity or movement speed for fine adjustments.';groups.get('Camera').append(cameraHelp);
    const floorHelp=document.createElement('p');floorHelp.textContent='With Floor follows camera off, the plane stays fixed in world space. Height places the black hole above or below it; X/Y offsets move the grid independently. Turn floor lensing off for a straight poster horizon. Custom grid colors apply to nearby wires and their distant glow.';groups.get('Floor').append(floorHelp);
    const skyHelp=document.createElement('p');skyHelp.textContent='Neon mode: move the stars and galaxies while the grid stays fixed. Use Stationary and set camera rotation and wobble to zero to hold the view still. Sky speed uses real seconds; Pause freezes it. Turn motion off or set speed to zero to stop in place.';groups.get('Sky').append(skyHelp);
    const poster=document.createElement('button');poster.type='button';poster.className='acidburn-button';poster.id='neon-poster-preset';poster.textContent='Warm chrome scene';groups.get('View').append(poster);
    poster.addEventListener('click',()=>{const s=viewer.settings();Object.assign(s.observer,{motion:false,azimuth:0,elevation:0,distance:30,rotation_speed:0});Object.assign(s.camera,{height:-5.4,pitch:0,yaw:0,offset_x:0,offset_y:0,offset_z:0,wobble_pitch:0,wobble_yaw:0});s.neon_floor=true;s.neon_grid=false;Object.assign(s.look,{floor_follow_camera:false,floor_tilt:0,floor_height:6,floor_lensing:false,floor_infinite:true,floor_strength:.975,floor_concentration:18,floor_palette:true,floor_color:'#e879ef',floor_major_color:'#e879ef',floor_reflection:.45,floor_roughness:.1,floor_speed:0,floor_sway:0,gas_tint:.75,gas_color:'#ffbd87',disk_tilt:17,disk_yaw:90,disk_temp:5500,nebula_amount:1.7,nebula_scale:3,nebula_color:'#85cfa3',nebula_resolution:'high',render_scale:1,auto_res:false,antialiasing:true});Object.assign(s.caption,{enabled:true,text:s.caption.text||'BEYOND|HUMAN',style:'mixed',font:'Teko',uppercase:true,bevel:1,grid:.85,size:24,y:75,width:90,stretch:1.15,line_gap:.85,angular:true,metal:.65,glow:.85,fuzz:.22});load(s);message('Warm chrome starting scene: low camera looking up. Adjust Disk, Floor, Sky and Poster text to customize.');});
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
      const neonFiles=['index.html','settings.js','zip.js','viewer.js','NOTICE.txt','fonts/Teko.ttf','fonts/OFL.txt','raytracer-neon.glsl','raytracer-orig.glsl','js-libs/three.min.js','js-libs/Detector.js','js-libs/mustache.min.js','js-libs/three-js-monkey-patch.js','js-libs/acidburn-galaxy.js','js-libs/neon-blackhole.js','img/accretion-disk.png','img/beach-ball.png','img/spectra.png','img/stars.png'];
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
    viewer=createNeonBlackhole({container:scene,base:base.href,skyMotion:true,antialiasing:true,settings:window.NEON_DEFAULT_SETTINGS||{look:{floor_infinite:true,floor_follow_camera:false}}});
    window.NeonViewer=viewer;
    if(reduced.matches)pause(true);
    const initial=viewer.settings();
    buildFields();
    setupCamera();
    for(const [id,key] of [['neon-grid','neon_grid'],['neon-floor','neon_floor']])$(id).addEventListener('click',()=>{viewer.params[key]=!viewer.params[key];viewer.recompile();syncFields();message((key==='neon_grid'?'Grid':'Floor')+(viewer.params[key]?' on.':' off.'));});
    $('neon-stationary').addEventListener('click',()=>{try{const next=viewer.settings();next.observer.motion=!next.observer.motion;if(!next.observer.motion){next.camera.pitch=0;next.camera.yaw=0;}load(next);message(next.observer.motion?'Automatic orbit.':'Stationary camera. Drag to look around.');}catch(error){message(error.message);}});
    $('neon-pause').addEventListener('click',()=>pause(!viewer.isPaused()));
    $('neon-reset').addEventListener('click',()=>{load(initial);pause(reduced.matches);message('Default settings restored.');});
    $('neon-copy').addEventListener('click',copy);
    $('neon-zip').addEventListener('click',download);
    const imageButton=document.createElement('button');imageButton.type='button';imageButton.className='acidburn-button';imageButton.id='neon-image';imageButton.textContent='Download PNG';$('neon-zip').parentElement.append(imageButton);
    imageButton.addEventListener('click',async()=>{try{await viewer.ready;await viewer.textureReady;await posterFontPromise;await document.fonts.ready;drawLettering();const rendered=viewer.capture(),canvas=document.createElement('canvas');canvas.width=rendered.width;canvas.height=rendered.height;const ctx=canvas.getContext('2d');ctx.drawImage(rendered,0,0);if(!lettering.hidden)ctx.drawImage(lettering,0,0,canvas.width,canvas.height);canvas.toBlob(blob=>{if(!blob){message('PNG export failed.');return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='neon-black-hole.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);message('PNG downloaded with scene and poster text.');},'image/png');}catch(error){message(error.message);}});
    $('neon-load').addEventListener('click',()=>{try{load(JSON.parse($('neon-json').value));}catch(error){message('Could not load JSON: '+error.message);}});
    $('neon-file').addEventListener('change',async()=>{const file=$('neon-file').files[0];if(!file)return;try{if(file.size>6400000)throw new Error('Settings files must be under 6.4 MB.');load(JSON.parse(await file.text()));}catch(error){message('Could not load file: '+error.message);}finally{$('neon-file').value='';}});
    reduced.addEventListener('change',()=>{if(reduced.matches)pause(true);});
    viewer.ready.then(()=>message(reduced.matches?'Paused for reduced motion.':'Neon black hole ready.')).catch(error=>{viewer.setActive(false);message('Viewer unavailable: '+error.message);});
  }catch(error){
    document.body.classList.add('no-webgl');
    message(error.message);
    for(const id of ['neon-pause','neon-reset','neon-copy','neon-zip','neon-load','neon-file','neon-grid','neon-floor','neon-stationary','neon-camera-free'])$(id).disabled=true;
  }
})();
