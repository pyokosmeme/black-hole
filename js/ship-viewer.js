/* One window, one renderer, ship selection and a true-scale side elevation. */
(function () {
  'use strict';
  const $=id=>document.getElementById(id),catalog=window.ShipCatalog,canvas=$('scene'),stage=$('stage');
  const defaults=()=>({az:126*Math.PI/180,el:20*Math.PI/180,zoom:1,phase:0,spin:false,orbit:false,labels:true,eva:true,wire:false,cut:false,compare:false});
  let state=defaults(),id='el-cajon',models=[],renderer,request=0,frame=null,last=0,activePart=-1,singleState=null;
  const memory=new Map(),svgNS='http://www.w3.org/2000/svg';
  let labels=[];
  function visible(l,on){l.el.hidden=!on;l.line.style.display=l.dot.style.display=on?'':'none';}
  const decode=html=>{const text=document.createElement('textarea');text.innerHTML=html;return text.value;};
  const controls={bSpin:'spin',bOrbit:'orbit',bLab:'labels',bEva:'eva',bWire:'wire',bCut:'cut'};
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  function sync() {
    for(const [button,key] of Object.entries(controls)) {
      $(button).setAttribute('aria-pressed',String(state[key]));
      $(button).disabled=!models.length || state.compare&&['spin','orbit','labels'].includes(key) || key==='cut'&&!state.compare&&id==='el-cajon';
    }
    $('compare-ships').setAttribute('aria-pressed',String(state.compare));
    $('compare-ships').textContent=state.compare?'Exit comparison':'Compare ships';
    $('view-caption').textContent=state.compare?'SAME SCALE · SIDE ELEVATION':'DRAG / ARROWS: ORBIT · SCROLL / PINCH / + −: ZOOM';
    $('part-select').disabled=state.compare;
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
    $('ship-specs').innerHTML='<table class="ship-comparison"><caption>Supplied ship specifications</caption><thead><tr><th scope="col">Measure</th><th scope="col">El Cajon</th><th scope="col">Hackett</th></tr></thead><tbody>'+rows.map(([label,key,unit,digits])=>'<tr><th scope="row">'+label+'</th>'+['el-cajon','hackett'].map(k=>'<td>'+(digits===null?catalog[k][key]:catalog[k][key].toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits}))+unit+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
  }
  function selectPart(index) {
    activePart=index;$('part-select').value=index<0?'':String(index);
    const part=catalog[id].labels[index];
    $('part-detail').hidden=!part;
    $('part-detail').textContent=part?decode(part.t)+' — '+decode(part.s):'';
    labels.forEach((l,i)=>l.el.setAttribute('aria-pressed',String(i===index)));
    draw();
  }
  function createLabels() {
    $('labels').querySelectorAll('.lab,.comparison-label').forEach(e=>e.remove());$('leaders').replaceChildren();labels=[];selectPart(-1);
    $('part-select').replaceChildren(new Option('Choose a part',''));
    const entries=state.compare?['el-cajon','hackett'].map(k=>({t:(k==='el-cajon'?'El Cajon':'Hackett')+' · '+catalog[k].length.toFixed(2)+' m',id:k})):catalog[id].labels;
    entries.forEach((part,index)=>{
      const el=document.createElement(state.compare?'span':'button');el.className=state.compare?'comparison-label':'lab';el.textContent=decode(part.t);
      if(!state.compare){el.type='button';el.setAttribute('aria-pressed','false');el.title=decode(part.s);el.addEventListener('click',()=>selectPart(index));$('part-select').add(new Option(decode(part.t),String(index)));}
      const line=document.createElementNS(svgNS,'line');line.dataset.part=index;
      const dot=document.createElementNS(svgNS,'circle');dot.setAttribute('r','2.5');
      $('labels').appendChild(el);$('leaders').append(line,dot);labels.push({el,line,dot,part});
    });
  }
  function drawLabels() {
    const w=stage.clientWidth,h=stage.clientHeight;$('leaders').setAttribute('viewBox',`0 0 ${w} ${h}`);
    if(state.compare){
      labels.forEach(l=>{
        const {start:a,end:b}=renderer.measure(catalog[l.part.id]);
        l.el.hidden=false;
        const y=a?a.y-l.el.offsetHeight-12:-1;
        const fits=a&&b&&a.x>=6&&b.x<=w-6&&y>=6&&a.y<h-24;
        visible(l,fits);if(!fits)return;
        l.el.style.transform=`translate(${Math.min(a.x,w-l.el.offsetWidth-6)}px,${y}px)`;
        l.line.setAttribute('x1',a.x);l.line.setAttribute('y1',a.y-8);l.line.setAttribute('x2',b.x);l.line.setAttribute('y2',b.y-8);
        l.dot.setAttribute('cx',a.x);l.dot.setAttribute('cy',a.y-8);
      });return;
    }
    const items=[],obstacles=[];
    labels.forEach((l,i)=>{
      const p=renderer.anchor(catalog[id],l.part,state);
      l.el.hidden=!state.labels||!p||l.part.t==='SCALE FIGURE'&&!state.eva;
      l.line.style.display=l.dot.style.display='none';
      if(l.el.hidden)return;
      items.push({id:i,x:p.x,y:p.y,w:l.el.offsetWidth,h:l.el.offsetHeight,r:3,priority:i===activePart?2:0});
      obstacles.push({id:i,x:p.x,y:p.y,r:3});
    });
    const placed=new Map(SceneLabelLayout.layout(items,{x:6,y:8,w:w-12,h:h-$('view-caption').offsetHeight-20},obstacles).map(p=>[p.id,p]));
    labels.forEach((l,i)=>{
      const p=placed.get(i);visible(l,!!p);if(!p)return;
      l.el.style.transform=`translate(${p.box.x}px,${p.box.y}px)`;
      l.line.setAttribute('x1',p.start.x);l.line.setAttribute('y1',p.start.y);l.line.setAttribute('x2',p.end.x);l.line.setAttribute('y2',p.end.y);
      l.dot.setAttribute('cx',p.start.x);l.dot.setAttribute('cy',p.start.y);
    });
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
    $('ship-select').value=id;document.title=catalog[id].name+' — Ship Viewer';writeLocation();load();
  }
  $('ship-select').addEventListener('change',()=>choose($('ship-select').value));
  $('compare-ships').addEventListener('click',()=>{
    if(state.compare){state=singleState||defaults();singleState=null;}
    else{singleState={...state};state={...defaults(),compare:true};}
    writeLocation();load();
  });
  $('part-select').addEventListener('change',()=>selectPart($('part-select').value===''?-1:Number($('part-select').value)));
  for(const [button,key] of Object.entries(controls))$(button).addEventListener('click',()=>{state[key]=!state[key];sync();draw();});
  $('bReset').addEventListener('click',()=>{state.az=defaults().az;state.el=defaults().el;state.zoom=1;selectPart(-1);if(!models.length)load();else draw();});
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
  new ResizeObserver(draw).observe(stage);document.fonts.ready.then(draw);
  document.addEventListener('visibilitychange',draw);
  function fromLocation(){const params=new URLSearchParams(location.search);id=catalog[params.get('ship')]?params.get('ship'):'el-cajon';state=defaults();singleState=null;if(params.get('compare')==='1'){singleState=defaults();state.compare=true;}$('ship-select').value=id;load();}
  addEventListener('popstate',fromLocation);
  $('hud').open=innerHeight>600;fromLocation();
})();
