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
  // Reference-shaped capitals in a 100-unit cap box. Other characters retain
  // the bundled font, normalized to the same cap height and spacing.
  const artifactGlyphs={
    B:[67,'M0 0H35Q65 0 65 25Q65 43 51 49Q67 56 67 76Q67 100 35 100H0Z M14 14V42H31Q49 42 49 27Q49 14 31 14Z M14 56V86H32Q51 86 51 72Q51 56 32 56Z'],
    E:[55,'M0 0H55V14H14V41H47V55H14V86H55V100H0Z'],
    Y:[65,'M0 0H16L32 39L49 0H65L40 58V100H25V58Z'],
    O:[68,'M34 0Q68 0 68 28V72Q68 100 34 100Q0 100 0 72V28Q0 0 34 0Z M34 14Q15 14 15 31V69Q15 86 34 86Q53 86 53 69V31Q53 14 34 14Z'],
    N:[67,'M0 0H16L52 68V0H67V100H51L15 33V100H0Z'],
    D:[67,'M0 0H31Q67 0 67 30V70Q67 100 31 100H0Z M15 14V86H30Q52 86 52 66V34Q52 14 30 14Z'],
    H:[64,'M0 0H14V42H50V0H64V100H50V56H14V100H0Z'],
    U:[66,'M0 0H15V69Q15 86 33 86Q51 86 51 69V0H66V72Q66 100 33 100Q0 100 0 72Z'],
    M:[80,'M0 0H17L40 63L63 0H80V100H65V34L40 95L15 34V100H0Z'],
    A:[72,'M27 0H45L72 100H56L49 76H23L16 100H0Z M36 23L27 62H45Z'],
    F:[55,'M0 0H55V14H14V41H47V55H14V100H0Z'],
    I:[22,'M4 0H18V100H4Z'],L:[55,'M0 0H15V86H55V100H0Z'],
    T:[64,'M0 0H64V14H40V100H24V14H0Z'],
    V:[68,'M0 0H16L34 74L52 0H68L42 100H26Z'],
    W:[94,'M0 0H15L27 74L40 0H54L67 74L79 0H94L76 100H59L47 34L35 100H18Z'],
    X:[66,'M0 0H17L33 34L49 0H66L42 49L66 100H49L33 65L17 100H0L24 49Z'],
    Z:[60,'M0 0H60V14L18 86H60V100H0V86L42 14H0Z'],
    P:[64,'M0 0H32Q64 0 64 28Q64 57 32 57H15V100H0Z M15 14V43H31Q49 43 49 28Q49 14 31 14Z'],
    R:[67,'M0 0H32Q64 0 64 28Q64 48 47 55L67 100H50L32 58H15V100H0Z M15 14V43H31Q49 43 49 28Q49 14 31 14Z'],
    C:[65,'M65 22L51 27Q49 14 33 14Q15 14 15 31V69Q15 86 33 86Q49 86 51 73L65 78Q61 100 33 100Q0 100 0 72V28Q0 0 33 0Q61 0 65 22Z'],
    G:[67,'M65 22L51 27Q49 14 33 14Q15 14 15 31V69Q15 86 33 86Q52 86 52 70V61H35V47H67V73Q67 100 33 100Q0 100 0 72V28Q0 0 33 0Q61 0 65 22Z'],
    J:[55,'M40 0H55V73Q55 100 27 100Q0 100 0 76V67H15V73Q15 86 27 86Q40 86 40 71Z'],
    K:[67,'M0 0H15V43L48 0H66L29 48L67 100H49L15 55V100H0Z'],
    Q:[70,'M34 0Q68 0 68 28V72Q68 88 57 94L70 106H51L43 99Q39 100 34 100Q0 100 0 72V28Q0 0 34 0Z M34 14Q15 14 15 31V69Q15 86 34 86Q53 86 53 69V31Q53 14 34 14Z'],
    S:[64,'M63 24L48 27Q47 14 32 14Q15 14 15 26Q15 36 35 43Q64 53 64 75Q64 100 32 100Q1 100 0 76L15 73Q16 86 32 86Q49 86 49 74Q49 63 29 56Q0 46 0 26Q0 0 32 0Q61 0 63 24Z']
  };
  function artifactLine(line,size,target,cx,cy,angular){
    const chars=[...line],glyphs=chars.map(ch=>artifactGlyphs[ch]);
    const widths=chars.map((ch,i)=>glyphs[i]?glyphs[i][0]:ch===' '?30:60),units=widths.reduce((a,b)=>a+b,0)+Math.max(0,chars.length-1)*5;
    if(target){let x=cx-units*size/200;chars.forEach((ch,i)=>{target.save();target.translate(x,cy-size/2);target.scale(size/100,size/100);
      if(glyphs[i]){let path=glyphs[i][1];
        if(angular&&i===0&&ch==='H')path='M0 0H14V42H50V0H64V100H50V56H14V100L0 125Z';
        if(angular&&i===chars.length-1&&ch==='N')path='M0 0H16L52 68V0H67V125L51 100L15 33V100H0Z';
        target.fill(new Path2D(path),'evenodd');
      }else if(ch!==' '){target.textAlign='left';target.textBaseline='alphabetic';const m=target.measureText(ch),height=m.actualBoundingBoxAscent+m.actualBoundingBoxDescent;target.translate(4,0);target.scale(52/Math.max(m.width,1),100/Math.max(height,1));target.fillText(ch,0,m.actualBoundingBoxAscent);}
      target.restore();x+=(widths[i]+5)*size/100;
    });}
    return units*size/100;
  }
  function drawLettering(){
    if(!viewer)return;
    const c=viewer.params.caption,w=Math.max(1,scene.clientWidth),h=Math.max(1,scene.clientHeight),dpr=Math.min(devicePixelRatio,2);
    const key=JSON.stringify([c,w,h,dpr,posterFontReady,document.fonts.status,viewer.params.look.floor_palette,viewer.params.look.floor_color]);
    if(key===letteringKey)return;letteringKey=key;
    lettering.width=Math.round(w*dpr);lettering.height=Math.round(h*dpr);
    const ctx=lettering.getContext('2d');ctx.scale(dpr,dpr);
    lettering.hidden=!c.enabled||!c.text;
    if(lettering.hidden)return;
    if((c.font==='Teko'||c.font==='Sculpted')&&!posterFontReady)loadPosterFont();
    const lines=(c.uppercase?c.text.toUpperCase():c.text).split(/[|\n]/).slice(0,6),size=h*c.size/100,lineHeight=size*c.line_gap;
    const sculpted=c.font==='Sculpted';
    ctx.font=`${c.font==='Teko'||sculpted?700:900} ${size}px ${c.font==='Teko'||sculpted?'"Neon Teko"':c.font==='Orbitron'?'Orbitron':'Impact, "Arial Black"'}, sans-serif`;
    const measured=Math.max(...lines.map(line=>sculpted?artifactLine(line,size):ctx.measureText(line).width),1),scale=Math.min(c.stretch,w*c.width/100/measured);
    // Fit long sculpted rows uniformly on narrow screens. The explicit width
    // multiplier still works, but automatic fitting does not crush the glyphs.
    ctx.translate(w*c.x/100,h*c.y/100);ctx.scale(scale,sculpted?Math.min(1,scale/c.stretch):1);ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='miter';ctx.miterLimit=2;
    lines.forEach((line,index)=>{
      const y=(index-(lines.length-1)/2)*lineHeight;
      const lineWidth=sculpted?artifactLine(line,size):ctx.measureText(line).width;
      const metrics=sculpted?{actualBoundingBoxAscent:size/2,actualBoundingBoxDescent:size/2,actualBoundingBoxLeft:lineWidth/2,actualBoundingBoxRight:lineWidth/2}:ctx.measureText(line),base=metrics.actualBoundingBoxDescent;
      function terminals(target,cx,cy){
        if(sculpted||!c.angular||index===0||!line.trim())return;
        const left=cx-metrics.actualBoundingBoxLeft,right=cx+metrics.actualBoundingBoxRight,bottom=cy+base;
        target.moveTo(left,bottom-size*.035);target.lineTo(left,bottom+size*.2);target.lineTo(left+size*.09,bottom-size*.035);target.closePath();
        target.moveTo(right,bottom-size*.035);target.lineTo(right,bottom+size*.2);target.lineTo(right-size*.09,bottom-size*.035);target.closePath();
      }
      const face=document.createElement('canvas'),fw=Math.ceil(lineWidth+size*.16),fh=Math.ceil(size*1.8);
      face.width=Math.ceil(fw*dpr);face.height=Math.ceil(fh*dpr);
      const fc=face.getContext('2d');fc.scale(dpr,dpr);fc.font=ctx.font;fc.textAlign='center';fc.textBaseline='middle';
      // One alpha silhouette joins the pointed feet to the glyphs before
      // beveling. Separate strokes left visible seams across their joins.
      fc.fillStyle='#fff';if(sculpted)artifactLine(line,size,fc,fw/2,fh/2,c.angular&&index>0);else fc.fillText(line,fw/2,fh/2);fc.beginPath();terminals(fc,fw/2,fh/2);fc.fill();
      const mask=document.createElement('canvas');mask.width=face.width;mask.height=face.height;mask.getContext('2d').drawImage(face,0,0);
      const top=fh/2-metrics.actualBoundingBoxAscent,bottom=fh/2+base,inkHeight=bottom-top;
      const bevel=size*.028*c.bevel,neon=viewer.params.look.floor_palette?viewer.params.look.floor_color:'#e879ef';
      function metalGradient(stops){const g=fc.createLinearGradient(0,top,0,bottom);stops.forEach(([at,color])=>g.addColorStop(at,color));return g;}
      function silhouette(radius,fill,dx=0,dy=0,blur=0){
        const layer=document.createElement('canvas');layer.width=face.width;layer.height=face.height;const lc=layer.getContext('2d');
        lc.drawImage(mask,0,0);
        if(radius)for(let i=0;i<24;i++){const a=i*Math.PI/12;lc.drawImage(mask,Math.cos(a)*radius*dpr,Math.sin(a)*radius*dpr);}
        lc.scale(dpr,dpr);lc.globalCompositeOperation='source-in';lc.fillStyle=fill;lc.fillRect(0,0,fw,fh);
        ctx.shadowColor=neon;ctx.shadowBlur=blur;ctx.drawImage(layer,-fw/2+dx,y-fh/2+dy,fw,fh);ctx.shadowBlur=0;
      }
      // Directional extrusion and alternating light/dark bevel bands give
      // depth without a wide flat outline. Masks include internal counters.
      const side=metalGradient([[0,'#221910'],[.45,'#31483b'],[.65,'#121915'],[1,'#7b4931']]);
      for(let i=5;i>0;i--)silhouette(bevel,side,size*.005*i,size*.007*i);
      if(c.glow){silhouette(bevel*1.1,neon,0,0,size*.045*c.glow);ctx.globalAlpha=.18;silhouette(bevel*1.1,neon,0,0,size*.12*c.glow);ctx.globalAlpha=1;}
      if(bevel){
        silhouette(bevel,metalGradient([[0,'#fff0cf'],[.25,'#b87351'],[.5,'#ffdeb5'],[.7,'#79402d'],[1,'#efbf8c']]));
        silhouette(bevel*.74,'#48291f');
        silhouette(bevel*.44,metalGradient([[0,'#fff0d0'],[.48,'#f4cba1'],[.55,'#a15e43'],[1,'#ffe3bb']]));
        silhouette(bevel*.15,'#44291e');
      }
      const iridescent=c.style==='iridescent'||c.style==='mixed'&&index>0;
      const stops=!iridescent?[[0,'#5d3022'],[.24,'#a86242'],[.44,'#e7ad78'],[.51,'#fff4d2'],[.55,'#fff7da'],[.59,'#1a3427'],[.69,'#17291f'],[.84,'#46344c'],[1,'#c38b92']]:[[0,'#0e3026'],[.25,'#224a35'],[.44,'#87a568'],[.53,'#eef0ba'],[.58,'#f7f8d8'],[.62,'#182b24'],[.77,'#252535'],[.92,'#aa759d'],[1,'#e2a87b']];
      fc.clearRect(0,0,fw,fh);fc.globalCompositeOperation='source-over';
      // The reflected skyline undulates gently across the metal face; its
      // shading is anchored to actual ink bounds, not the font's em box.
      for(let x=0;x<fw;x+=2){const wave=inkHeight*.022*(Math.sin(x/fw*32)+.45*Math.sin(x/fw*61));const g=fc.createLinearGradient(0,top+wave,0,bottom+wave);stops.forEach(([at,color])=>g.addColorStop(at,color));fc.fillStyle=g;fc.fillRect(x,0,2,fh);}
      fc.globalCompositeOperation='destination-in';fc.drawImage(mask,0,0,fw,fh);
      fc.globalCompositeOperation='source-atop';
      if(c.metal){
        const shine=fc.createLinearGradient(0,0,fw,fh*.6);[[0,'rgba(255,250,223,0)'],[.38,`rgba(255,250,223,${c.metal*.03})`],[.47,`rgba(255,250,223,${c.metal*.23})`],[.52,'rgba(255,250,223,0)'],[1,'rgba(255,250,223,0)']].forEach(([at,color])=>shine.addColorStop(at,color));fc.fillStyle=shine;fc.fillRect(0,0,fw,fh);
      }
      if(c.grid&&!iridescent){const rgb=parseInt(neon.slice(1),16);fc.strokeStyle=`rgba(${rgb>>16&255},${rgb>>8&255},${rgb&255},${c.grid*.55})`;fc.lineWidth=Math.max(.4,size*.004);const horizon=top+inkHeight*.68;
        fc.beginPath();for(let i=1;i<=5;i++){const gy=horizon+(bottom-horizon)*Math.pow(i/5,1.7);fc.moveTo(0,gy);fc.lineTo(fw,gy);}
        for(let i=-9;i<=9;i++){fc.moveTo(fw*.5+i*size*.11,horizon);fc.lineTo(fw*.5+i*size*.48,bottom+size*.2);}fc.stroke();
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
    poster.addEventListener('click',()=>{const s=viewer.settings();Object.assign(s.observer,{motion:false,azimuth:0,elevation:0,distance:30,rotation_speed:0});Object.assign(s.camera,{height:-5.4,pitch:0,yaw:0,offset_x:0,offset_y:0,offset_z:0,wobble_pitch:0,wobble_yaw:0});s.neon_floor=true;s.neon_grid=false;Object.assign(s.look,{floor_follow_camera:false,floor_tilt:0,floor_height:6,floor_lensing:false,floor_infinite:true,floor_strength:.975,floor_concentration:18,floor_palette:true,floor_color:'#e879ef',floor_major_color:'#e879ef',floor_reflection:.45,floor_roughness:.1,floor_speed:0,floor_sway:0,gas_tint:.75,gas_color:'#ffbd87',disk_tilt:17,disk_yaw:90,disk_temp:5500,nebula_amount:1.7,nebula_scale:3,nebula_color:'#85cfa3',nebula_resolution:'high',render_scale:1,auto_res:false,antialiasing:true});Object.assign(s.caption,{enabled:true,text:s.caption.text||'BEYOND|HUMAN',style:'mixed',font:'Sculpted',uppercase:true,bevel:1,grid:.85,size:22,y:68,width:90,stretch:1,line_gap:1.12,angular:true,metal:.65,glow:.85,fuzz:.22});load(s);message('Warm chrome starting scene: low camera looking up. Adjust Disk, Floor, Sky and Poster text to customize.');});
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
