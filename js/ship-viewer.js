/* One window, one renderer, ship selection and a true-scale side elevation. */
(function () {
  'use strict';
  const $=id=>document.getElementById(id),catalog=window.ShipCatalog,canvas=$('scene'),stage=$('stage');
  const defaults=()=>({az:126*Math.PI/180,el:20*Math.PI/180,zoom:1,phase:0,spin:false,orbit:false,labels:true,eva:true,wire:false,cut:false,compare:false});
  let state=defaults(),id='el-cajon',models=[],renderer,request=0,frame=null,last=0,singleState=null;
  const memory=new Map(),svgNS='http://www.w3.org/2000/svg';
  let labels=[];
  /* starfield backdrop, ported from the original standalone viewers */
  const starsCanvas=document.getElementById('stars');
  let stars=[];
  function drawStars(){
    if(!starsCanvas)return;
    const dpr=Math.min(devicePixelRatio||1,2),w=stage.clientWidth*dpr,h=stage.clientHeight*dpr;
    if(!w||!h)return;
    const ctx=starsCanvas.getContext('2d');
    starsCanvas.width=w;starsCanvas.height=h;
    ctx.clearRect(0,0,w,h);ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);
    for(let i=0;i<stars.length;i++){const st=stars[i];
      const b=40+215*st.m,r=(0.5+1.4*st.m)*dpr;
      const tint=st.t<0.10?'rgba('+b+','+(b*0.94)+','+(b*0.78)+',':st.t>0.90?'rgba('+(b*0.80)+','+(b*0.92)+','+b+',':'rgba('+b+','+b+','+b+',';
      ctx.fillStyle=tint+'1)';
      ctx.beginPath();ctx.arc(st.x*w,st.y*h,r,0,6.2832);ctx.fill();
    }
  }
  function seedStars(){
    stars=[];const n=Math.round((stage.clientWidth*stage.clientHeight)/2600);
    for(let i=0;i<n;i++)stars.push({x:Math.random(),y:Math.random(),m:Math.pow(Math.random(),2.1),t:Math.random()});
    drawStars();
  }
  /* crescent spin-direction rings, ported from the original viewers */
  let ringEls=null;
  function initRings(){
    if(ringEls)return;
    const svg=$('leaders');ringEls=[0,1].map(()=>{
      const p=document.createElementNS(svgNS,'path');
      p.setAttribute('fill','#3ECC8F');p.setAttribute('opacity','.85');
      p.setAttribute('stroke','#3ECC8F');p.setAttribute('stroke-width','1');
      p.setAttribute('stroke-linejoin','round');
      svg.insertBefore(p,svg.firstChild);return p;
    });
  }
  function clearRings(){initRings();ringEls.forEach(el=>el.setAttribute('d',''));}
  function drawRings(){
    initRings();
    const cfg=catalog[id],rings=cfg.rings||[];
    const stopped=!(state.spin&&(state.rpm??cfg.rpm)>0);
    ringEls.forEach((el,i)=>{
      const R2=rings[i];
      // arrows belong to the schematic: visible whenever labels are on,
      // dimmed while the spin is stopped
      if(!R2||state.compare||!state.labels){el.setAttribute('d','');return;}
      el.setAttribute('opacity',stopped?'0.4':'0.85');
      const N=40,span=232*Math.PI/180,lead=(state.phase+2.1)*R2.dir;
      const proj=(x,y,z)=>{const p=renderer.project([x,y,z]);return p?[p.x,p.y]:null;};
      let ok=true;const outer=[],inner=[];
      for(let k=0;k<=N;k++){
        const f=k/N,t=lead-span*R2.dir*(1.0-f);
        const wd=1.0-0.45*f,rm=(R2.ri+R2.ro)/2,hw=(R2.ro-R2.ri)/2*wd;
        const qo=proj(R2.x,(rm+hw)*Math.cos(t),(rm+hw)*Math.sin(t)),qi=proj(R2.x,(rm-hw)*Math.cos(t),(rm-hw)*Math.sin(t));
        if(!qo||!qi){ok=false;break;}
        outer.push(qo);inner.push(qi);
      }
      if(!ok){el.setAttribute('d','');return;}
      const th=lead,rm2=(R2.ri+R2.ro)/2,flare=(R2.ro-R2.ri)*0.95,tipT=th+18*Math.PI/180*R2.dir;
      const pTip=proj(R2.x,rm2*Math.cos(tipT),rm2*Math.sin(tipT)),pOut=proj(R2.x,(rm2+flare)*Math.cos(th),(rm2+flare)*Math.sin(th)),pIn=proj(R2.x,(rm2-flare)*Math.cos(th),(rm2-flare)*Math.sin(th));
      if(!pTip||!pOut||!pIn){el.setAttribute('d','');return;}
      let d='M'+outer[0][0].toFixed(1)+','+outer[0][1].toFixed(1);
      for(let k=1;k<outer.length;k++)d+=' L'+outer[k][0].toFixed(1)+','+outer[k][1].toFixed(1);
      d+=' L'+pOut[0].toFixed(1)+','+pOut[1].toFixed(1)+' L'+pTip[0].toFixed(1)+','+pTip[1].toFixed(1)+' L'+pIn[0].toFixed(1)+','+pIn[1].toFixed(1);
      for(let k=inner.length-1;k>=0;k--)d+=' L'+inner[k][0].toFixed(1)+','+inner[k][1].toFixed(1);
      el.setAttribute('d',d+' Z');
    });
  }
  function visible(l,on){l.ta=on?1:0;}
  function applyLabel(l){
    if(l.cx===undefined)return;
    l.el.style.transform=`translate(${Math.round(l.cx)}px,${Math.round(l.cy)}px)`;
    l.el.style.opacity=l.alpha.toFixed(3);
    l.el.style.pointerEvents=l.alpha>.5?'auto':'none';
    l.line.style.opacity=(l.alpha*.55).toFixed(3);
    l.dot.setAttribute('opacity',l.alpha.toFixed(3));
    l.line.setAttribute('x1',l.kx.toFixed(1));l.line.setAttribute('y1',l.ky.toFixed(1));
    l.line.setAttribute('x2',l.ex.toFixed(1));l.line.setAttribute('y2',l.ey.toFixed(1));
    l.dot.setAttribute('cx',l.kx.toFixed(1));l.dot.setAttribute('cy',l.ky.toFixed(1));
  }
  let labelAnim=null;
  function animateLabels(){
    if(labelAnim!==null)return;
    const step=()=>{
      labelAnim=null;let maxd=0;
      labels.forEach(l=>{
        if(l.tx===undefined)return;
        const e=.14;
        maxd=Math.max(maxd,Math.abs(l.tx-l.cx),Math.abs(l.ty-l.cy),Math.abs(l.dx-l.kx),Math.abs(l.dy-l.ky),Math.abs(l.ta-l.alpha)*80);
        l.cx+=(l.tx-l.cx)*e;l.cy+=(l.ty-l.cy)*e;
        l.kx+=(l.dx-l.kx)*e;l.ky+=(l.dy-l.ky)*e;
        l.alpha+=(l.ta-l.alpha)*.3;
        applyLabel(l);
      });
      if(maxd>.6)labelAnim=requestAnimationFrame(step);
    };
    labelAnim=requestAnimationFrame(step);
  }
  const decode=html=>{const text=document.createElement('textarea');text.innerHTML=html;return text.value;};
  const controls={bSpin:'spin',bOrbit:'orbit',bLab:'labels',bEva:'eva',bWire:'wire',bCut:'cut'};
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  function sync() {
    for(const [button,key] of Object.entries(controls)) {
      $(button).setAttribute('aria-pressed',String(state[key]));
      $(button).disabled=!models.length || state.compare&&['spin','orbit','labels'].includes(key) || key==='cut'&&!state.compare&&id==='el-cajon';
    }
    $('compare-ships').setAttribute('aria-pressed',String(state.compare));
    $('compare-ships').textContent=state.compare?'Exit comparison':'Compare spacecraft';
    $('view-caption').textContent=state.compare?'SAME SCALE · SIDE ELEVATION':'DRAG / ARROWS: ORBIT · SCROLL / PINCH / + −: ZOOM';
    $('gbtns').hidden=state.compare;
    if(state.compare) $('readout').textContent='Hackett is '+(catalog.hackett.length/catalog['el-cajon'].length).toFixed(2)+'× as long. Both models use the same metre scale.';
    else {
      const cfg=catalog[id],rpm=state.rpm??cfg.rpm,w=rpm*2*Math.PI/60;
      $('readout').textContent=(state.spin?rpm.toFixed(2)+' rpm':'Stopped')+' · '+(state.spin?w*w*cfg.habRadius/9.80665:0).toFixed(3)+' g at the '+cfg.habRadius.toFixed(2)+' m floor';
    }
    for(const b of $('gbtns').children)b.setAttribute('aria-pressed',String(Number(b.dataset.gravity)===0?!state.spin:state.spin&&Math.abs(Number(b.dataset.rpm)-(state.rpm??catalog[id].rpm))<.02));
  }
  function writeLocation() {
    const url=new URL(location.href);url.searchParams.set('ship',id);
    if(state.compare)url.searchParams.set('compare','1');else url.searchParams.delete('compare');
    history.replaceState(null,'',url);
  }
  function specs() {
    if(!state.compare){$('ship-specs').innerHTML=catalog[id].info;return;}
    const rows=[['Length','length',' m',2],['Radiator span','span',' m',2],['Dry mass','dry',' t',0],['Cargo capacity','cargo',' t',0],['Cargo volume','volume',' m³',1],['Accommodation','berths','',null]];
    $('ship-specs').innerHTML='<table class="ship-comparison"><caption>Supplied spacecraft specifications</caption><thead><tr><th scope="col">Measure</th><th scope="col">El Cajon</th><th scope="col">Hackett</th></tr></thead><tbody>'+rows.map(([label,key,unit,digits])=>'<tr><th scope="row">'+label+'</th>'+['el-cajon','hackett'].map(k=>'<td>'+(digits===null?catalog[k][key]:catalog[k][key].toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits}))+unit+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
  }
  function createLabels() {
    $('labels').querySelectorAll('.lab,.comparison-label').forEach(e=>e.remove());$('leaders').replaceChildren();labels=[];
    const entries=state.compare?['el-cajon','hackett'].map(k=>({t:(k==='el-cajon'?'El Cajon':'Hackett')+' · '+catalog[k].length.toFixed(2)+' m',id:k})):catalog[id].labels;
    entries.forEach((part,index)=>{
      const el=document.createElement('span');el.className=state.compare?'comparison-label':'lab';el.textContent=decode(part.t);
      if(!state.compare)el.title=decode(part.s);
      const line=document.createElementNS(svgNS,'line');line.dataset.part=index;
      const dot=document.createElementNS(svgNS,'circle');dot.setAttribute('r','2');
      $('labels').appendChild(el);$('leaders').append(line,dot);labels.push({el,line,dot,part,probe:-1});
    });
  }
  function drawLabels() {
    const w=stage.clientWidth,h=stage.clientHeight;$('leaders').setAttribute('viewBox',`0 0 ${w} ${h}`);
    if(state.compare){clearRings();
      labels.forEach(l=>{
        const {start:a,end:b}=renderer.measure(catalog[l.part.id]);
        l.el.hidden=false;
        const y=a?a.y-l.el.offsetHeight-12:-1;const fx=Math.min(a.x,w-l.el.offsetWidth-6);
        const fits=a&&b&&a.x>=6&&b.x<=w-6&&y>=6&&a.y<h-24;
        l.el.hidden=!fits;l.line.style.display=l.dot.style.display=fits?'':'none';if(!fits)return;
        l.el.style.transform=`translate(${fx}px,${y}px)`;
        l.line.setAttribute('x1',a.x);l.line.setAttribute('y1',a.y-8);l.line.setAttribute('x2',b.x);l.line.setAttribute('y2',b.y-8);
        l.dot.setAttribute('cx',a.x);l.dot.setAttribute('cy',a.y-8);
      });return;
    }
    drawRings();
    // Labels stay glued to their object: project the mesh anchor, offset to
    // its marked side, fade only for occlusion. No screen-space re-layout.
    const reqs=[],active=[];
    labels.forEach((l)=>{
      const show=state.labels&&(l.part.t!=='SCALE FIGURE'||state.eva);
      if(!show){visible(l,false);return;}
      active.push(l);
      reqs.push({part:l.part,prev:l.probe??-1});
    });
    const got=models.length?renderer.labelAnchors(models[0],state,reqs):[];
    active.forEach((l,k)=>{
      const occ=got?got[k]:null;
      const p=occ?renderer.anchor(models[0].cfg,l.part,state):null;
      if(!p){visible(l,false);return;}
      l.probe=occ.probe;
      const s=l.part.side??1,lw=l.el.offsetWidth,lh=l.el.offsetHeight;
      const lx=Math.max(6,Math.min(w-lw-6,p.x+(s>0?16:-16-lw)));
      const ly=Math.max(8,Math.min(h-lh-8,p.y-10));
      l.tx=lx;l.ty=ly;l.dx=p.x;l.dy=p.y-8;
      l.ex=Math.max(lx,Math.min(lx+lw,p.x));l.ey=Math.max(ly,Math.min(ly+lh,p.y));
      l.ta=1;
      if(l.cx===undefined){l.cx=l.tx;l.cy=l.ty;l.kx=l.dx;l.ky=l.dy;l.alpha=0;}
      l.cx=l.tx;l.cy=l.ty;l.kx=l.dx;l.ky=l.dy; // glue: track the anchor exactly
      applyLabel(l);
    });
    animateLabels();
  }
  function draw() {
    if(frame!==null||!renderer||!models.length||document.hidden)return;
    frame=requestAnimationFrame(now=>{
      frame=null;const dt=Math.min((now-last)/1000,.05);last=now;
      if(state.spin&&!state.compare)state.phase+=(state.rpm??catalog[id].rpm)*Math.PI/30*dt;
      if(state.orbit&&!state.compare)state.az+=.12*dt;
      renderer.render(models,state);drawLabels();
      if(state.spin||state.orbit)draw();
    });
  }
  async function load() {
    const token=++request;models=[];$('err').textContent='Loading ship…';$('err').style.display='grid';
    createLabels();specs();sync();
    $('gbtns').replaceChildren();
    catalog[id].presets.forEach(p=>{
      const b=document.createElement('button');b.className='acidburn-button';b.type='button';b.textContent=p.l;
      const rpm=Math.sqrt(p.g*9.80665/catalog[id].habRadius)*60/(2*Math.PI);b.dataset.gravity=p.g;b.dataset.rpm=rpm;
      b.addEventListener('click',()=>{state.rpm=rpm;state.spin=p.g!==0;sync();draw();});$('gbtns').appendChild(b);
    });
    try {
      renderer??=ShipRenderer.create(canvas);
      const loaded=await Promise.all((state.compare?['el-cajon','hackett']:[id]).map(k=>renderer.load(k)));
      if(token!==request)return;models=loaded;$('err').style.display='none';sync();draw();
    }catch(error){if(token!==request)return;$('err').textContent=error.message;$('err').style.display='grid';sync();}
  }
  function choose(next) {
    memory.set(id,state.compare?singleState:state);id=next;state={...(memory.get(id)||defaults())};singleState=null;
    $('ship-select').value=id;document.title=catalog[id].name+' · Spacecraft View';writeLocation();load();
  }
  $('ship-select').addEventListener('change',()=>choose($('ship-select').value));
  $('compare-ships').addEventListener('click',()=>{
    if(state.compare){state=singleState||defaults();singleState=null;}
    else{singleState={...state};state={...defaults(),compare:true};}
    writeLocation();load();
  });
  for(const [button,key] of Object.entries(controls))$(button).addEventListener('click',()=>{state[key]=!state[key];sync();draw();});
  $('bReset').addEventListener('click',()=>{state.az=defaults().az;state.el=defaults().el;state.zoom=1;if(!models.length)load();else draw();});
  reducedMotion.addEventListener('change',e=>{if(e.matches){state.spin=state.orbit=false;sync();draw();}});
  canvas.addEventListener('keydown',event=>{
    const key=event.key;if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-'].includes(key))return;event.preventDefault();
    if(key==='+'||key==='=')state.zoom=Math.min(4,state.zoom*1.1);
    else if(key==='-')state.zoom=Math.max(.3,state.zoom/1.1);
    else if(!state.compare){if(key==='ArrowLeft')state.az-=.1;if(key==='ArrowRight')state.az+=.1;if(key==='ArrowUp')state.el=Math.min(1.45,state.el+.1);if(key==='ArrowDown')state.el=Math.max(-1.45,state.el-.1);}
    draw();
  });
  canvas.addEventListener('wheel',event=>{event.preventDefault();state.zoom=Math.max(.3,Math.min(4,state.zoom*Math.exp(-event.deltaY*.001)));draw();},{passive:false});
  const pointers=new Map();
  canvas.addEventListener('pointerdown',event=>{pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});canvas.setPointerCapture(event.pointerId);});
  canvas.addEventListener('pointermove',event=>{
    const old=pointers.get(event.pointerId);if(!old)return;
    const next={x:event.clientX,y:event.clientY};
    if(pointers.size===2){const other=[...pointers.entries()].find(([k])=>k!==event.pointerId)[1];const before=Math.hypot(old.x-other.x,old.y-other.y),after=Math.hypot(next.x-other.x,next.y-other.y);if(before>1)state.zoom=Math.max(.3,Math.min(4,state.zoom*after/before));}
    else if(!state.compare){state.az-=(next.x-old.x)*.0062;state.el=Math.max(-1.45,Math.min(1.45,state.el+(next.y-old.y)*.0052));}
    pointers.set(event.pointerId,next);draw();
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,event=>pointers.delete(event.pointerId));
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();++request;models=[];renderer=null;$('err').textContent='3D context was interrupted. Reload the page to restore it.';$('err').style.display='grid';sync();});
  new ResizeObserver(()=>{seedStars();draw();}).observe(stage);document.fonts.ready.then(draw);
  document.addEventListener('visibilitychange',draw);
  function fromLocation(){const params=new URLSearchParams(location.search);id=catalog[params.get('ship')]?params.get('ship'):'el-cajon';state=defaults();singleState=null;if(params.get('compare')==='1'){singleState=defaults();state.compare=true;}$('ship-select').value=id;load();}
  addEventListener('popstate',fromLocation);
  $('hud').open=false;seedStars();fromLocation();
})();
