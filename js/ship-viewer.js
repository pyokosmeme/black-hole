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
      // A crescent sliced by the stage edge reads as a broken glyph. When
      // most of the projected ring has left the frame, drop it for this
      // frame instead of hard-clipping it.
      const w2=stage.clientWidth,h2=stage.clientHeight;
      let out=0;const total=outer.length+inner.length;
      for(const p of outer)if(p[0]<0||p[0]>w2||p[1]<0||p[1]>h2)out++;
      for(const p of inner)if(p[0]<0||p[0]>w2||p[1]<0||p[1]>h2)out++;
      if(out>total*.3){el.setAttribute('d','');return;}
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
  // Callouts share the maps' label tracker: each keeps its slot beside its
  // part while the ship turns, slides only when the slot is blocked, and
  // fades rather than jumping when there is no room.
  const labelTracker=window.SceneLabelLayout.createTracker();
  let labelSizes=new WeakMap();
  function labelSize(el){
    let size=labelSizes.get(el);
    if(!size){
      const hidden=el.hidden;el.hidden=false;el.style.visibility='hidden';
      const rect=el.getBoundingClientRect();size={w:rect.width,h:rect.height};
      el.style.visibility='';el.hidden=hidden;
      if(size.w)labelSizes.set(el,size);else size={w:80,h:18};
    }
    return size;
  }
  function hideLabel(l){l.el.hidden=true;l.line.style.display=l.dot.style.display='none';l.fix=l.anchor=l.box=l.u=null;l.side=0;}
  const decode=html=>{const text=document.createElement('textarea');text.innerHTML=html;return text.value;};
  const controls={bSpin:'spin',bOrbit:'orbit',bLab:'labels',bEva:'eva',bWire:'wire',bCut:'cut'};
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  function sync() {
    for(const [button,key] of Object.entries(controls)) {
      $(button).setAttribute('aria-pressed',String(state[key]));
      $(button).disabled=!models.length || state.compare&&['spin','orbit','labels'].includes(key) || key==='cut'&&!state.compare&&id==='el-cajon';
    }
    $('compare-ships').setAttribute('aria-pressed',String(state.compare));
    $('compare-ships').title=state.compare?'Exit comparison':'Compare both spacecraft at the same scale';
    $('view-caption').textContent=state.compare?'SCROLL / PINCH: ZOOM':'DRAG: ORBIT · SCROLL / PINCH: ZOOM';
    $('view-note').textContent='Same scale · side elevation';$('view-note').hidden=!state.compare;
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
    $('labels').querySelectorAll('.lab,.comparison-label').forEach(e=>e.remove());$('leaders').replaceChildren();labels=[];ringEls=null;labelTracker.reset();
    const entries=state.compare?['el-cajon','hackett'].map(k=>({t:(k==='el-cajon'?'El Cajon':'Hackett')+' · '+catalog[k].length.toFixed(2)+' m',id:k})):catalog[id].labels;
    entries.forEach((part,index)=>{
      const el=document.createElement('span');el.className=(state.compare?'comparison-label':'lab')+' map-label';el.textContent=decode(part.t);
      if(!state.compare)el.title=decode(part.s);
      const line=document.createElementNS(svgNS,'line');line.dataset.part=index;
      const dot=document.createElementNS(svgNS,'circle');dot.setAttribute('r','2');
      // Hidden until the first layout places them (and for good without WebGL).
      el.hidden=true;line.style.display=dot.style.display='none';
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
    // Radial callouts: each label sits just outside the projected hull
    // outline (support function over every station and spin arrow) in
    // the direction of its part. Overlaps slide vertically, and a slide
    // that would drag a label too far from its anchor flips to the
    // opposite side of the anchor stack instead.
    const reqs=[],active=[];
    labels.forEach((l)=>{
      const show=state.labels&&(l.part.t!=='SCALE FIGURE'||state.eva);
      if(!show){hideLabel(l);return;}
      active.push(l);
      reqs.push({part:l.part,prev:l.probe??-1});
    });
    const got=models.length?renderer.labelAnchors(models[0],state,reqs):[];
    // Hull silhouette stations on screen: axis point + projected radius.
    // Passed as arc discs so the shared layouter keeps boxes off the hull
    // and stops leaders from piercing it.
    const stats=[];
    const prof=models.length?models[0].profile:null;
    if(prof)for(let b=0;b<256;b+=4){
      const R=prof[b];if(!R)continue;
      const ax=renderer.project([b*2,0,0]);if(!ax)continue;
      const pe=renderer.project([b*2,0,R]);
      // Stable ids let a callout parked beside one station stay with it.
      stats.push({id:'st'+b,x:ax.x,y:ax.y,r:pe?Math.hypot(pe.x-ax.x,pe.y-ax.y):0,arc:1});
    }
    // spin arrows float clear of the hull: keep callouts outside them too
    (catalog[id].rings||[]).forEach((R2,i)=>{
      const rc=renderer.project([R2.x,0,0]);
      if(rc){const re=renderer.project([R2.x,0,R2.ro]);
        stats.push({id:'ring'+i,x:rc.x,y:rc.y,r:re?Math.hypot(re.x-rc.x,re.y-rc.y):0,arc:1});}
    });
    const pairs=[];
    const C=stats.length?stats.reduce((o,st)=>{o.x+=st.x;o.y+=st.y;return o;},{x:0,y:0}):{x:stage.clientWidth/2,y:stage.clientHeight/2};
    if(stats.length){C.x/=stats.length;C.y/=stats.length;}
    // Projected long axis (first to last hull station).
    let axis=null;
    if(prof){
      let x0=-1,x1=-1;
      for(let b=0;b<256;b++)if(prof[b]){if(x0<0)x0=b*2;x1=b*2;}
      const pA=renderer.project([x0,0,0]),pB=renderer.project([x1,0,0]),pM=renderer.project([(x0+x1)/2,0,0]);
      if(pA&&pB&&pM)axis={x0,x1,mid:pM,dx:pB.x-pA.x,dy:pB.y-pA.y,len:Math.hypot(pB.x-pA.x,pB.y-pA.y)};
    }
    const now=performance.now(),dtFix=Math.min(.1,Math.max(0,(now-(drawLabels.last||now))/1000));drawLabels.last=now;
    let fixing=false;
    // The HUD overlays and any open pane are keep-out rectangles.
    const bottomPad=4,items=[],byId=new Map();
    const overlays=window.SceneLabelLayout.overlayRects(stage,stage.querySelectorAll('[data-label-avoid]'));
    active.forEach((l,k)=>{
      const a=got?got[k]:null;
      if(!a){
        // The part turned out of view: fade the callout where it stands
        // rather than popping it, then forget it.
        if(l.anchor&&l.box){
          const itemId=String(labels.indexOf(l));byId.set(itemId,l);
          items.push({id:itemId,x:l.box.x,y:l.box.y,r:0,w:l.box.w,h:l.box.h,anchorX:l.anchor.x,anchorY:l.anchor.y,hold:true});
        } else hideLabel(l);
        l.u=null;
        return;
      }
      // The hull probe under a part can switch to another sample as the ship
      // turns. Carry the old anchor as a residual that decays on a critically
      // damped spring, so the dot, leader and callout glide to the new point
      // with continuous velocity instead of jumping.
      if(l.anchor&&l.probe!==a.probe){
        const v=l.fix?{vx:l.fix.vx,vy:l.fix.vy}:{vx:0,vy:0};
        l.fix={x:l.anchor.x-a.x,y:l.anchor.y-(a.y-8),vx:v.vx,vy:v.vy};
      }
      if(l.fix){
        const w=16,t=dtFix,e=Math.exp(-w*t),f=l.fix,cx=f.vx+w*f.x,cy=f.vy+w*f.y;
        f.x=(f.x+cx*t)*e;f.y=(f.y+cy*t)*e;f.vx=(f.vx-w*cx*t)*e;f.vy=(f.vy-w*cy*t)*e;
        if(Math.hypot(f.x,f.y)<.3&&Math.hypot(f.vx,f.vy)<6)l.fix=null;else fixing=true;
      }
      const fx=l.fix?l.fix.x:0,fy=l.fix?l.fix.y:0;
      l.probe=a.probe;
      l.anchor={x:a.x+fx,y:a.y-8+fy};
      pairs.push({l,a:Object.assign({},a,{x:a.x+fx,y:a.y+fy})});
    });
    pairs.forEach(({l,a},index)=>{
      const {w:lw,h:lh}=labelSize(l.el);
      let ux,uy;
      // Callout directions come from the ship's projected long axis, which
      // only changes as the camera moves: nose/tail parts point along the
      // axis away from the hull, the scale figure hangs below, and every
      // other part points perpendicular to the axis on its own side. The
      // sampled surface normal flipped between hull probes and made the
      // callouts jump while the ship turned.
      if(l.part.t==='SCALE FIGURE'){ux=0;uy=1;}
      else{
        let done=false;
        if(axis){
          const f=(l.part.p[0]-axis.x0)/Math.max(1,axis.x1-axis.x0);
          if(f<0.16||f>0.84){
            const pa=renderer.project([l.part.p[0],0,0]);
            if(pa){const dx=pa.x-axis.mid.x,dy=pa.y-axis.mid.y,dl=Math.hypot(dx,dy);
              if(dl>4){ux=dx/dl;uy=dy/dl;done=true;}}
          } else if(axis.len>40){
            const nx=-axis.dy/axis.len,ny=axis.dx/axis.len;
            const c0=renderer.project([l.part.p[0],0,0])||C;
            const s=(a.x-c0.x)*nx+(a.y-c0.y)*ny;
            // Side hysteresis: a part near the axis line keeps its side
            // until it is clearly across.
            if(!l.side||s*l.side<-6)l.side=s>=0?1:-1;
            ux=nx*l.side;uy=ny*l.side;done=true;
          }
        }
        if(!done){ux=a.x-C.x;uy=a.y-C.y;const m2=Math.hypot(ux,uy);if(m2>4){ux/=m2;uy/=m2;}else{ux=(l.part.side??1)>0?1:-1;uy=0;}}
      }
      // Low-pass direction changes (end-on fallback, near-axis parts) so
      // the preferred callout position glides instead of jumping.
      if(l.u){
        const k2=1-Math.exp(-dtFix/.14),sx=l.u.x+(ux-l.u.x)*k2,sy=l.u.y+(uy-l.u.y)*k2,m=Math.hypot(sx,sy);
        if(m>.2){ux=sx/m;uy=sy/m;if(Math.hypot(ux-l.u.x,uy-l.u.y)>.002)fixing=true;}
      }
      l.u={x:ux,y:uy};
      // How far along u the box must sit to clear the silhouette: for each
      // hull station / spin arrow within the box's lateral footprint, the
      // along-u distance past that disc. One continuous formula, so there is
      // no horizontal/vertical docking switch for the box to jump between.
      const px=-uy,py=ux,hu=Math.abs(ux)*lw/2+Math.abs(uy)*lh/2,hp=Math.abs(px)*lw/2+Math.abs(py)*lh/2;
      let reach=0;
      for(const st of stats){
        const along=(st.x-a.x)*ux+(st.y-a.y)*uy,lat=Math.abs((st.x-a.x)*px+(st.y-a.y)*py)-hp,R=st.r+6;
        if(lat<R)reach=Math.max(reach,along+Math.sqrt(R*R-Math.max(0,lat)*Math.max(0,lat)));
      }
      reach+=10+hu;
      let bx=a.x+ux*reach-lw/2,by=a.y+uy*reach-lh/2;
      bx=Math.max(4,Math.min(stage.clientWidth-lw-4,bx));
      by=Math.max(8,Math.min(stage.clientHeight-lh-bottomPad,by));
      l.box={x:bx+lw/2,y:by+lh/2,w:lw,h:lh};
      // The radial box is the preferred slot; the tracker falls back to
      // nearby slots around it only when it is blocked. Hull discs are arc
      // obstacles: boxes may hug their own hull's rim but never cover it,
      // and leaders never pierce another disc. The 180px cap kills the
      // far-side placements that read as 200px stabs.
      const itemId=String(labels.indexOf(l));
      byId.set(itemId,l);
      items.push({id:itemId,x:bx+lw/2,y:by+lh/2,r:0,w:lw,h:lh,preferCenter:true,
        anchorX:l.anchor.x,anchorY:l.anchor.y,maxLeader:180,ignoreLeaderObstacles:true,leaderFromAnchor:true,
        tier:0,priority:l.part.t==='SCALE FIGURE'?-100:1000-index});
    });
    const result=labelTracker.update(items,{x:4,y:8,w:Math.max(1,stage.clientWidth-8),h:Math.max(1,stage.clientHeight-bottomPad-8)},stats.concat(overlays),now);
    const painted=new Set();
    result.labels.forEach(p=>{
      const l=byId.get(p.id);
      if(!p.visible){l.el.hidden=true;l.line.style.display=l.dot.style.display='none';return;}
      painted.add(l);
      l.el.hidden=false;
      l.el.style.transform=`translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px)`;
      l.el.style.opacity=p.alpha<1?p.alpha.toFixed(3):'';
      l.el.style.pointerEvents=p.placed?'auto':'none';
      // The dot marks the hull point; the leader runs from it to the box.
      const k=l.anchor,ex=Math.max(p.x,Math.min(p.x+p.w,k.x)),ey=Math.max(p.y,Math.min(p.y+p.h,k.y));
      l.dot.style.display='';
      l.dot.setAttribute('cx',k.x.toFixed(1));l.dot.setAttribute('cy',k.y.toFixed(1));
      l.dot.setAttribute('opacity',p.alpha.toFixed(3));
      l.line.style.display=Math.hypot(ex-k.x,ey-k.y)<5?'none':'';
      l.line.setAttribute('x1',k.x.toFixed(1));l.line.setAttribute('y1',k.y.toFixed(1));
      l.line.setAttribute('x2',ex.toFixed(1));l.line.setAttribute('y2',ey.toFixed(1));
      l.line.style.opacity=(p.alpha*.55).toFixed(3);
    });
    active.forEach(l=>{if(!painted.has(l)){l.el.hidden=true;l.line.style.display=l.dot.style.display='none';}});
    return result.animating||fixing;
  }
  function draw() {
    if(frame!==null||!renderer||!models.length||document.hidden)return;
    frame=requestAnimationFrame(now=>{
      frame=null;
      // A ship switch (or lost context) may have cleared the models since
      // this frame was queued; load() schedules a fresh one when ready.
      if(!renderer||!models.length)return;
      const dt=Math.min((now-last)/1000,.05);last=now;
      if(state.spin&&!state.compare)state.phase+=(state.rpm??catalog[id].rpm)*Math.PI/30*dt;
      if(state.orbit&&!state.compare)state.az+=.12*dt;
      renderer.render(models,state);const settling=drawLabels();
      if(state.spin||state.orbit||settling)draw();
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
  stage.addEventListener('click',event=>{
    const action=event.target.closest('[data-map-action]');if(!action)return;
    state.zoom=Math.max(.3,Math.min(4,state.zoom*(action.dataset.mapAction==='in'?1.25:.8)));draw();
  });
  // Panes opening or closing move the areas callouts must avoid.
  document.addEventListener('mapwindow:layout',draw);
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
  new ResizeObserver(()=>{labelSizes=new WeakMap();seedStars();draw();}).observe(stage);document.fonts.ready.then(()=>{labelSizes=new WeakMap();draw();});
  document.addEventListener('visibilitychange',draw);
  function fromLocation(){const params=new URLSearchParams(location.search);id=catalog[params.get('ship')]?params.get('ship'):'el-cajon';state=defaults();const az=parseFloat(params.get('az'));if(isFinite(az))state.az=az*Math.PI/180;singleState=null;if(params.get('compare')==='1'){singleState=defaults();state.compare=true;}$('ship-select').value=id;load();}
  addEventListener('popstate',fromLocation);
  seedStars();fromLocation();
})();
