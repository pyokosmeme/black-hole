/* Interactive, static 3D atlas using the site's bundled THREE r73.
 * Display radii/phases and illustrative surfaces are not a physics simulation.
 * Frames are rendered only when the camera, selection, or viewport changes. */
window.YakeScene = (function () {
  'use strict';
  // World surfaces are painted by js/yake-surfaces.js in a few Web Workers, in
  // parallel and off the page's thread; each is painted once per page and
  // reused by every view. Without workers the page paints them itself, one
  // per task. Either way the pixels are identical.
  const surfaceScript = document.currentScript && document.currentScript.src
    ? new URL('yake-surfaces.js?v=1', document.currentScript.src).href : null;
  const surfaces = new Map();
  const jobs = [];
  let idle = [], poolSize = 0, workersFailed = false, localBusy = false;
  function startPool() {
    if (poolSize || workersFailed) return;
    poolSize = !surfaceScript || typeof Worker !== 'function' ? 0
      : Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
    for (let i = 0; i < poolSize; i++) {
      let worker;
      try { worker = new Worker(surfaceScript); } catch (error) { workersFailed = true; break; }
      worker.onmessage = event => { const job = worker.job; worker.job = null; idle.push(worker); job.resolve(event.data); pump(); };
      worker.onerror = event => {
        // Script unavailable or a paint threw: hand the work to the page.
        event.preventDefault(); workersFailed = true;
        if (worker.job) jobs.unshift(worker.job);
        worker.job = null; worker.terminate(); pump();
      };
      idle.push(worker);
    }
    if (!idle.length) workersFailed = true;
  }
  function pump() {
    startPool();
    if (workersFailed) {
      idle.forEach(worker => worker.terminate()); idle = [];
      // One surface per task keeps the page responsive while it paints.
      if (localBusy || !jobs.length || !window.YakeSurfaces) return;
      localBusy = true;
      setTimeout(() => { const job = jobs.shift(); localBusy = false; job.resolve(window.YakeSurfaces.run(job.data)); pump(); }, 0);
      return;
    }
    while (idle.length && jobs.length) {
      const worker = idle.shift(), job = jobs.shift();
      worker.job = job;
      worker.postMessage(job.data, job.data.mask ? [job.data.mask.buffer] : []);
    }
  }
  function requestSurface(data) {
    return new Promise(resolve => { jobs.push({data, resolve}); pump(); });
  }
  function create(host, onSelect, onFailure, onFocus) {
    if (!window.THREE) throw new Error('3D library unavailable');
    const T = window.THREE;
    const data = window.YAKE_ATLAS;
    const worlds = new Map(data.worlds.map(w => [w.id,w]));
    const renderer = new T.WebGLRenderer({antialias:true, alpha:true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x05050f, 0);
    const canvas = renderer.domElement;
    canvas.className = 'scene-canvas';
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label','3D system map. Arrow keys rotate; Shift and arrows pan; plus and minus zoom; zero resets. Tab to world labels to select.');
    host.appendChild(canvas);
    const labelLayer = document.createElement('div');
    labelLayer.className = 'scene-labels';
    host.appendChild(labelLayer);
    const leaders=document.createElementNS('http://www.w3.org/2000/svg','svg');
    leaders.classList.add('scene-leaders','map-leaders');leaders.setAttribute('aria-hidden','true');
    host.insertBefore(leaders,labelLayer);
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(43, 1, .1, 12000);
    scene.add(new T.AmbientLight(0x8da8cb, .7));
    const light = new T.PointLight(0xffd7a0, 1.35, 0, 0);
    scene.add(light);
    const fill = new T.DirectionalLight(0xa4c3ef, .35);
    fill.position.set(100,200,250);
    scene.add(fill);
    const target = new T.Vector3();
    const systemOrientation = {theta:1.55, phi:.85};
    let theta = systemOrientation.theta, phi = systemOrientation.phi, radius = 950;
    let flight = null;
    function cancelFlight() { flight=null; }
    let content = null, currentView = null, selected = null;
    let bodies = [], tracks = [], annotations = [], frame = null, destroyed = false;
    let width = 1, height = 1, labelsOn = true;
    // Labels keep their side of each world while the camera moves and only
    // slide or fade when that side is blocked (see SceneLabelLayout.createTracker).
    const labelTracker = window.SceneLabelLayout.createTracker();
    const leaderLines = new Map();
    // Label boxes only change size with fonts or the viewport; measuring every
    // label every frame forced a layout per name.
    let labelSizes = new WeakMap();
    function labelSize(el) {
      let size = labelSizes.get(el);
      if (!size) {
        const wasHidden = el.hidden;
        el.hidden = false; el.style.visibility = 'hidden';
        size = {w:el.offsetWidth, h:el.offsetHeight};
        el.style.visibility = ''; el.hidden = wasHidden;
        if (size.w) labelSizes.set(el, size); else size = {w:60, h:20};
      }
      return size;
    }
    const pointers = new Map();
    let gesture = null, dragged = false;
    let pendingTap = null;
    function cancelTap() { if(pendingTap)clearTimeout(pendingTap.timer); pendingTap=null; }
    const raycaster = new T.Raycaster();
    const ndc = new T.Vector2();

    // A stable procedural star field, unrelated to the destination markers.
    let seed = 713;
    function random() { seed = (1664525*seed + 1013904223) >>> 0; return seed/4294967296; }
    const skyGeometry = new T.Geometry();
    for (let i=0;i<850;i++) {
      const az=random()*Math.PI*2, y=random()*2-1, r=3000+random()*1000;
      skyGeometry.vertices.push(new T.Vector3(Math.sqrt(1-y*y)*Math.cos(az)*r,y*r,Math.sqrt(1-y*y)*Math.sin(az)*r));
    }
    const skyMaterial = new T.PointsMaterial({color:0xa9bad2,size:1.5,transparent:true,opacity:.6,sizeAttenuation:false,depthWrite:false});
    scene.add(new T.Points(skyGeometry,skyMaterial));

    // Authored coast silhouettes approximate the supplied Fusang / Mu / Diyu
    // globes. This is an illustrative geography, not a georeferenced texture.
    function continentMask() {
      const c=document.createElement('canvas');c.width=1024;c.height=512;
      const ctx=c.getContext('2d');
      const shapes=[
        [[.235,.08],[.255,.10],[.246,.15],[.268,.18],[.251,.23],[.278,.28],[.272,.33],[.293,.37],[.278,.41],[.303,.45],[.283,.47],[.29,.51],[.269,.52],[.276,.57],[.301,.61],[.322,.65],[.313,.69],[.28,.70],[.274,.74],[.241,.73],[.226,.68],[.198,.67],[.184,.62],[.21,.60],[.193,.56],[.219,.54],[.21,.50],[.234,.48],[.222,.44],[.24,.42],[.232,.38],[.245,.36],[.23,.32],[.247,.29],[.232,.26],[.245,.22],[.228,.18],[.238,.15],[.222,.11]],
        [[.572,.37],[.596,.35],[.62,.39],[.608,.43],[.63,.46],[.618,.49],[.635,.53],[.655,.54],[.66,.58],[.647,.60],[.673,.64],[.666,.69],[.636,.72],[.61,.70],[.593,.66],[.611,.64],[.586,.61],[.594,.57],[.573,.56],[.582,.51],[.564,.48],[.58,.45]],
        [[.747,.35],[.77,.32],[.79,.36],[.782,.40],[.807,.42],[.8,.45],[.776,.46],[.785,.49],[.771,.52],[.80,.54],[.814,.58],[.798,.60],[.818,.64],[.802,.67],[.778,.65],[.761,.61],[.742,.60],[.747,.56],[.722,.53],[.735,.49],[.719,.46],[.735,.44],[.728,.40]]
      ];
      shapes.forEach((shape,i)=>{
        // Broad continental shelves, scalloped bays and a fragmented archipelago
        // silhouette rather than three narrow polygon strips.
        const center=[.255,.62,.77][i];
        shape=shape.map(([x,y])=>[center+(x-center)*(i===0?1.5:.85),i===0?y:.53+(y-.53)*.82]);
        ctx.fillStyle=`rgb(${(i+1)*64},0,0)`;ctx.beginPath();
        const last=shape[shape.length-1];ctx.moveTo((last[0]+shape[0][0])*c.width/2,(last[1]+shape[0][1])*c.height/2);
        shape.forEach(([x,y],j)=>{const next=shape[(j+1)%shape.length];ctx.quadraticCurveTo(x*c.width,y*c.height,(x+next[0])*c.width/2,(y+next[1])*c.height/2);});ctx.closePath();ctx.fill();
        // Small shelf islands; deterministic, confined to each continent's coast.
        shape.forEach(([x,y],j)=>{
          for(let k=0;k<3;k++){
            const dx=Math.sin(j*13+k*7)*.024,dy=Math.cos(j*9+k*17)*.023;
            ctx.beginPath();ctx.ellipse((x+dx)*c.width,(y+dy)*c.height,1+(j+k)%3,.7+(j*3+k)%2, j,0,Math.PI*2);ctx.fill();
          }
        });
      });
      // Sheltered seas and straits are cut into this mask with the paint job
      // (yake-surfaces.js channels), off the page's thread.
      return ctx.getImageData(0,0,c.width,c.height).data;
    }
    // Surfaces the current view is waiting on (see painted() below).
    let viewPaints=[];
    function texture(id) {
      const layers=paint(id);viewPaints.push(layers.ready);
      const wrap=canvas=>{const t=new T.Texture(canvas);t.needsUpdate=true;layers.ready.then(()=>{t.needsUpdate=true;draw();});return t;};
      const map=wrap(layers.color);map.anisotropy=Math.min(4,renderer.getMaxAnisotropy());
      if(layers.relief){map.surfaceRelief=wrap(layers.relief);map.surfaceSpecular=wrap(layers.specular);}
      return map;
    }
    function paint(id) {
      if(surfaces.has(id))return surfaces.get(id);
      const {width,height,detailed}=window.YakeSurfaces.size(id);
      const canvas=()=>{const c=document.createElement('canvas');c.width=width;c.height=height;return c;};
      const layers={color:canvas(),relief:detailed?canvas():null,specular:detailed?canvas():null};
      const w=worlds.get(id),base=w?new T.Color(w.color):null;
      // Until its pixels arrive a world shows its catalogue colour, not black.
      if(base){const ctx=layers.color.getContext('2d');ctx.fillStyle=w.color;ctx.fillRect(0,0,width,height);}
      layers.ready=requestSurface({id,base:base&&{r:base.r,g:base.g,b:base.b},mask:id==='celosia'?continentMask():undefined}).then(out=>{
        [['color',out.color],['relief',out.relief],['specular',out.specular]].forEach(([key,data])=>{
          if(data)layers[key].getContext('2d').putImageData(new ImageData(data,out.width,out.height),0,0);
        });
      });
      surfaces.set(id,layers);
      return layers;
    }

    function corona() {
      const c=document.createElement('canvas'); c.width=c.height=128;
      const ctx=c.getContext('2d'), gradient=ctx.createRadialGradient(64,64,10,64,64,64);
      gradient.addColorStop(0,'rgba(255,209,120,.7)'); gradient.addColorStop(.35,'rgba(255,147,51,.2)'); gradient.addColorStop(1,'rgba(255,130,30,0)');
      ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
      const map=new T.Texture(c);map.needsUpdate=true;
      const sprite=new T.Sprite(new T.SpriteMaterial({map,transparent:true,blending:T.AdditiveBlending,depthWrite:false}));
      sprite.scale.set(140,140,1);content.add(sprite);
    }

    function paniClouds() {
      return paint('pani-clouds');
    }
    function paniAtmosphere(mesh,size) {
      const layers=paniClouds(),map=new T.Texture(layers.color);viewPaints.push(layers.ready);map.needsUpdate=true;layers.ready.then(()=>{map.needsUpdate=true;draw();});
      const clouds=new T.Mesh(new T.SphereGeometry(size*1.025,40,24),new T.MeshPhongMaterial({map,transparent:true,depthWrite:false,shininess:8}));
      clouds.name='pani-clouds';mesh.add(clouds);
      const material=new T.ShaderMaterial({
        uniforms:{tint:{type:'c',value:new T.Color(0xffb08a)}},transparent:true,depthWrite:false,
        vertexShader:'varying vec3 n; varying vec3 p; void main(){vec4 v=modelViewMatrix*vec4(position,1.0); n=normalize(normalMatrix*normal); p=v.xyz; gl_Position=projectionMatrix*v;}',
        fragmentShader:'uniform vec3 tint; varying vec3 n; varying vec3 p; void main(){float rim=1.0-max(dot(normalize(n),normalize(-p)),0.0); float fade=1.0-smoothstep(0.65,1.0,rim); gl_FragColor=vec4(tint,pow(rim,2.0)*fade*0.8);}'
      });
      const air=new T.Mesh(new T.SphereGeometry(size*1.06,40,24),material);
      air.name='pani-atmosphere';air.userData.pressureKPa=95;mesh.add(air);
    }

    function body(id,position,size,habitat) {
      const w=worlds.get(id);
      let mesh;
      if(id==='marassa') {
        mesh=new T.Group();
        // Coaxial counter-rotating wheels: the stationary spine passes through
        // bearing hubs along the spin axis, never through either inhabited rim.
        [-1,1].forEach((side,i)=>{
          const ring=new T.Group();ring.name='rotating-wheel';ring.userData.world=i?'chawkee':'buka';ring.userData.spinDirection=i?-1:1;ring.position.x=side*size*.54;ring.rotation.y=Math.PI/2;
          const metal=new T.MeshPhongMaterial({color:0xbac5cc,shininess:55});
          ring.add(new T.Mesh(new T.TorusGeometry(size*.34,size*.028,12,64),metal));
          const interior=new T.Mesh(new T.TorusGeometry(size*.318,size*.009,8,64),new T.MeshPhongMaterial({color:i?0x819cae:0x7a9c7d}));ring.add(interior);
          const selection=new T.Mesh(new T.TorusGeometry(size*.34,size*.04,12,64),new T.MeshBasicMaterial({color:0xff83cd,transparent:true,opacity:.95,depthTest:false,depthWrite:false}));
          selection.name='ring-selection';selection.visible=false;selection.renderOrder=12;ring.add(selection);
          const bearing=new T.Mesh(new T.TorusGeometry(size*.055,size*.012,10,32),metal.clone());bearing.name='hub-bearing';ring.add(bearing);
          for(let j=0;j<6;j++){
            const a=j*Math.PI/3,spoke=new T.Mesh(new T.CylinderGeometry(size*.008,size*.008,size*.34,5),metal.clone());
            spoke.position.set(Math.cos(a)*size*.17,Math.sin(a)*size*.17,0);spoke.rotation.z=a-Math.PI/2;ring.add(spoke);
          }
          mesh.add(ring);
        });
        const bridge=new T.Mesh(new T.CylinderGeometry(size*.021,size*.021,size*1.24,10),new T.MeshPhongMaterial({color:0x9baebb,shininess:40}));bridge.name='stationary-axial-spine';bridge.rotation.z=Math.PI/2;mesh.add(bridge);
        mesh.rotation.set(-.3,-.4,.2);
      } else if(id==='five') {
        mesh=new T.Group();
        data.views.five.nodes.forEach(([island,r,a])=>{
          const m=new T.Mesh(new T.SphereGeometry(size*.2*worlds.get(island).radiusKm/1611,24,16),new T.MeshPhongMaterial({map:texture(island)}));
          m.name=island;m.userData.member=island;
          m.position.copy(point(r*size/300,a*Math.PI/180,0));mesh.add(m);
        });
      } else if(habitat) {
        mesh=new T.Mesh(new T.OctahedronGeometry(size*.7),new T.MeshPhongMaterial({color:0xa7c9d1,shininess:45}));
      } else {
        const map=texture(id);
        const material=id==='yake'?new T.MeshBasicMaterial({map}):new T.MeshPhongMaterial({map,shininess:id==='pani'?48:id==='celosia'?28:6,specular:map.surfaceRelief?0x60758b:0x334155});
        if(map.surfaceRelief){material.bumpMap=map.surfaceRelief;material.bumpScale=size*(id==='pani'?.001:.018);material.specularMap=map.surfaceSpecular;}
        mesh=new T.Mesh(new T.SphereGeometry(size,40,24),material);
        if(id==='pani')paniAtmosphere(mesh,size);
      }
      mesh.position.copy(position);mesh.userData.world=id;content.add(mesh);
      const marker=new T.Mesh(new T.TorusGeometry(size+2,.12,6,64),new T.MeshBasicMaterial({color:0xff0099,transparent:true,opacity:.85,depthTest:false,depthWrite:false}));
      marker.position.copy(position);marker.visible=false;marker.renderOrder=10;content.add(marker);
      const label=document.createElement('button');label.type='button';label.className='scene-label map-label';label.dataset.pick=id;
      label.textContent=w.mapLabel || w.name;label.setAttribute('aria-label','Select '+w.name);label.setAttribute('aria-pressed','false');if(id!=='yake')labelLayer.appendChild(label);
      label.addEventListener('click',e=>{ if(e.detail===0) onSelect(id); });
      // Cluster glyphs (Five Islands group, station rings) extend past the
      // nominal body size; measure the real local bounding sphere so labels
      // clear the drawn geometry instead of touching its edges.
      mesh.updateMatrixWorld(true);
      let bradius=size;
      mesh.traverse(o=>{
        if(o.geometry&&o.geometry.computeBoundingSphere){
          if(!o.geometry.boundingSphere)o.geometry.computeBoundingSphere();
          const wp=new T.Vector3().setFromMatrixPosition(o.matrixWorld);
          const ps=new T.Vector3().setFromMatrixScale(o.matrixWorld);
          bradius=Math.max(bradius,(o.geometry.boundingSphere.radius||0)*Math.max(ps.x,ps.y,ps.z)+wp.distanceTo(position));
        }
      });
      bodies.push({id,mesh,marker,label,position,size,bradius});
    }

    function point(r,angle,inc) {
      return new T.Vector3(r*Math.cos(angle),r*Math.sin(angle)*Math.sin(inc),r*Math.sin(angle)*Math.cos(inc));
    }
    function orbit(id,r,inc,ez) {
      const geometry=new T.Geometry();
      for(let i=0;i<=180;i++) geometry.vertices.push(point(r,i/180*Math.PI*2,inc));
      const material=new T.LineBasicMaterial({color:ez?0xc57b4a:0x536480,transparent:true,opacity:ez?.4:.36});
      const line=new T.Line(geometry,material);content.add(line);tracks.push({id,line,ez});
      return line;
    }
    // One radial conversion for moons and their parent's EZ.
    function scaledRadius(km,cfg) {
      const points=[[0,0],...cfg.nodes.map(([id,r])=>[worlds.get(id).km,r]).filter(p=>p[0]).sort((a,b)=>a[0]-b[0])];
      for(let i=1;i<points.length;i++){
        if(km<=points[i][0] || i===points.length-1){
          const [lo,rl]=points[i-1],[hi,rh]=points[i];
          return rl+(km-lo)/(hi-lo)*(rh-rl);
        }
      }
      throw new Error('No distance anchors for local view');
    }
    function annotation(text,position) {
      const label=document.createElement('span');label.className='scene-label scene-annotation map-label';label.textContent=text;labelLayer.appendChild(label);annotations.push({label,position});
    }
    function ezNeighborhood(local,cfg) {
      const size=20;
      // Enough display clearance for the whole illustrative station to remain
      // outside the boundary. This is not a newly invented orbital radius.
      const r=scaledRadius(cfg.ez,cfg)+size+6;
      body(local.id,point(r,local.angle*Math.PI/180,0),size,false);
      bodies[bodies.length-1].mesh.userData.placement={boundary:cfg.parent,ezKm:cfg.ez,clearance:'schematic'};
    }
    function release(group) {
      group.traverse(obj=>{
        if(obj.geometry) obj.geometry.dispose();
        if(obj.material) { ['map','bumpMap','specularMap'].forEach(key=>{if(obj.material[key])obj.material[key].dispose();});obj.material.dispose(); }
      });
    }
    function setView(name,id) {
      cancelFlight();
      cancelTap();
      if(currentView!==name) {
        if(content) {scene.remove(content);release(content);}
        content=new T.Group();scene.add(content);viewPaints=[];bodies=[];tracks=[];annotations=[];labelTracker.reset();leaderLines.clear();leaders.replaceChildren();labelLayer.textContent='';currentView=name;
        const cfg=data.views[name];
        {
          if(!cfg.cluster)body(cfg.parent,new T.Vector3(),cfg.parent==='yake'?24:27,false);
          if(cfg.parent==='yake') corona();
          light.position.set(cfg.parent==='yake'?0:-200,cfg.parent==='yake'?0:160,cfg.parent==='yake'?0:80);
          cfg.nodes.forEach(([world,r,a])=>{
            const inc=world==='celosia'?4.78*Math.PI/180:0;
            if(!cfg.cluster)orbit(world,r,inc,false);
            const size=cfg.cluster?worlds.get(world).radiusKm/65:{jin:13,shu:12,xuan:11,celosia:9,gullinkambi:7,chanticleer:7,five:20,kukkuta:7}[world]||8;
            body(world,point(r,a*Math.PI/180,inc),size,false);
          });
          if(cfg.hierarchy)cfg.hierarchy.pairs.forEach(pair=>{
            const outer=orbit(null,Math.hypot(...pair.center),0,false);
            outer.name='binary-barycenter-orbit';outer.userData.members=pair.members;
            const inner=orbit(null,Math.hypot(...pair.offset),0,false);
            inner.name='tight-binary-orbit';inner.userData.members=pair.members;
            inner.position.set(pair.center[0],0,pair.center[1]);
            annotation(pair.members.map(id=>worlds.get(id).name).join('–'),inner.position.clone());
          });
          (cfg.locals||[]).forEach(([world,r,a])=>body(world,point(r,a*Math.PI/180,0),world==='marassa'?20:worlds.get(world).mapLabel?5:8,!!worlds.get(world).mapLabel));
          (cfg.ezLocals||[]).forEach(local=>ezNeighborhood(local,cfg));
          if(cfg.ez) {
            const r=scaledRadius(cfg.ez,cfg);
            orbit(null,r,0,true);
            annotation(cfg.parent.toUpperCase()+' EZ / '+cfg.ez.toLocaleString('en-US')+' KM',point(r,-Math.PI/2,0));
          }
        }
        home();
      }
      select(id);
    }
    function select(id) {
      cancelFlight();
      cancelTap();
      selected=id;
      bodies.forEach(b=>{
        const individual=b.id==='marassa' && worlds.get(id)?.parent==='marassa';
        const active=b.id===id || individual;
        b.marker.visible=active&&!individual;b.label.setAttribute('aria-pressed',active?'true':'false');
        if(b.id==='marassa')b.mesh.children.filter(c=>c.name==='rotating-wheel').forEach(ring=>{
          ring.getObjectByName('ring-selection').visible=ring.userData.world===id;
        });
      });
      tracks.forEach(t=>{const active=id!=null && (t.id===id || t.line.userData.members?.includes(id));t.line.material.color.setHex(active?0xff0099:t.ez?0xc57b4a:0x536480);t.line.material.opacity=active?.9:t.ez?.4:.36;});
      draw();
    }
    function home() {
      cancelFlight();
      target.set(0,0,0);
      // Reference overview angle; local moon maps retain their own familiar tilt.
      theta=currentView==='system'?systemOrientation.theta:.28;
      phi=currentView==='system'?systemOrientation.phi:.72;
      const extent=Math.max(360,...bodies.map(b=>b.position.length()+b.size+24));
      radius=extent/Math.tan(camera.fov*Math.PI/360)/Math.min(1,width/height)*1.08;
      draw();
    }
    function focus(animate=false) {
      const b=bodies.find(b=>b.id===selected || (b.id==='marassa' && worlds.get(selected)?.parent==='marassa'));if(!b)return;
      cancelFlight();
      const endRadius=Math.max(b.size*(width<600?11:9),75);
      // Bring the named geological feature into view when inspecting this world.
      const endTheta=selected==='gullinkambi'?theta+Math.atan2(Math.sin(.1-theta),Math.cos(.1-theta)):theta;
      if(animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        flight={start:null,from:target.clone(),to:b.position.clone(),radius,endRadius,theta,endTheta,phi};
      } else {
        target.copy(b.position);radius=endRadius;phi=1.25;theta=endTheta;
      }
      draw();
    }
    function surface(region) {
      if(selected!=='celosia')return;
      focus();theta=({fusang:.25,mu:.62,diyu:.77}[region]-.25)*Math.PI*2;draw();
    }
    function zoom(factor) {cancelFlight();radius=Math.max(40,Math.min(2600,radius*factor));draw();}
    function pan(dx,dy) {
      cancelFlight();
      const unit=radius*2*Math.tan(camera.fov*Math.PI/360)/height;
      const right=new T.Vector3(1,0,0).applyQuaternion(camera.quaternion);
      const up=new T.Vector3(0,1,0).applyQuaternion(camera.quaternion);
      target.add(right.multiplyScalar(-dx*unit)).add(up.multiplyScalar(dy*unit));
    }
    function draw() {
      if(frame!==null||destroyed||document.hidden)return;
      frame=requestAnimationFrame(now=>{frame=null;render(now);});
    }
    function render(now) {
      if(flight) {
        // Start at the existing pose on the first frame, after the card closes.
        if(flight.start===null)flight.start=now;
        const t=Math.min(1,(now-flight.start)/1000),ease=t*t*(3-2*t),f=flight;
        target.copy(f.from).lerp(f.to,ease);
        radius=Math.exp(Math.log(f.radius)+(Math.log(f.endRadius)-Math.log(f.radius))*ease);
        theta=f.theta+(f.endTheta-f.theta)*ease;phi=f.phi+(1.25-f.phi)*ease;
        if(t===1){target.copy(f.to);radius=f.endRadius;flight=null;}
      }
      phi=Math.max(.12,Math.min(Math.PI-.12,phi));
      camera.position.set(target.x+radius*Math.sin(phi)*Math.sin(theta),target.y+radius*Math.cos(phi),target.z+radius*Math.sin(phi)*Math.cos(theta));
      camera.lookAt(target);camera.updateMatrixWorld();
      bodies.forEach(b=>b.marker.quaternion.copy(camera.quaternion));
      renderer.render(scene,camera);
      // Map chrome over the canvas (view title, controls, open panes) is
      // marked data-label-avoid; names never slide underneath it.
      const overlays=window.SceneLabelLayout.overlayRects(host,host.querySelectorAll('[data-label-avoid]'));
      leaders.setAttribute('viewBox',`0 0 ${width} ${height}`);
      const fov=Math.tan(camera.fov*Math.PI/360);
      const discs=bodies.map(b=>{
        const p=b.position.clone().project(camera);
        if(p.z<=-1||p.z>=1)return null;
        const dist=camera.position.distanceTo(b.position);
        const r=Math.max(5,Math.max(b.size,b.bradius||b.size)*height/(2*fov*dist));
        const x=(p.x*.5+.5)*width,y=(-p.y*.5+.5)*height;
        if(!isFinite(r)||!isFinite(x)||!isFinite(y))return null;
        return {id:b.id,x,y,r,depth:dist,arc:1};
      }).filter(Boolean);
      const star=discs.find(d=>d.id==='yake');
      if(star){
        // The corona sprite is 140 units across, but its additive gradient
        // is only visible out to ~45 units; keeping labels out of the whole
        // sprite pushed inner-world names onto long, hopping leaders.
        const cr=45*height/(2*fov*star.depth);
        star.r=Math.min(Math.max(star.r,cr),Math.min(width,height)*.34);
        // The glow is translucent: it pushes labels outward but callouts
        // may cross it, so inner worlds keep readable names at close range.
        star.ghost=1;
      }
      // Labels are laid out by the shared tracker: each name holds its side of
      // its world while the camera moves, slides only when that side is
      // blocked, and fades rather than jumping when there is no room.
      const bounds={x:4,y:4,w:Math.max(1,width-8),h:Math.max(1,height-8)};
      const items=[],elements=new Map();
      // The star's glow disc is a boundary for everything near it, not a
      // cull test: bodies inside the lit core keep their names, with callout
      // leaders emerging at the glow rim (arc handling in the labeler).
      discs.forEach(d=>{
        const b=bodies.find(bb=>bb.id===d.id);if(!b||b.id==='yake')return;
        if(!labelsOn||!(d.x>-40&&d.x<width+40&&d.y>-40&&d.y<height+40))return;
        b.label.style.zIndex=String(20000-Math.round(d.depth*10));
        const size=labelSize(b.label);
        items.push({id:d.id,x:d.x,y:d.y,r:d.r,w:size.w,h:size.h,tier:d.id===selected?2:1,priority:-d.depth,anchorX:d.x,anchorY:d.y,clampAnchor:true});
        elements.set(d.id,b.label);
      });
      annotations.forEach(({label,position},index)=>{
        const p=position.clone().project(camera),x=(p.x*.5+.5)*width,y=(-p.y*.5+.5)*height;
        if(!labelsOn||p.z<=-1||p.z>=1||!isFinite(x)||!isFinite(y))return;
        // Annotations for knot areas (station clusters) must remain findable
        // near the frame edge; the tracker clamps instead of culling.
        const size=labelSize(label);
        items.push({id:'annotation-'+index,x,y,r:7,w:size.w,h:size.h,tier:0,priority:-index,anchorX:x,anchorY:y,clampAnchor:true});
        elements.set('annotation-'+index,label);
      });
      const {labels,animating}=labelTracker.update(items,bounds,discs.concat(overlays),now);
      const painted=new Set();
      labels.forEach(l=>{
        if(!l.visible)return;
        const el=elements.get(l.id);painted.add(el);
        el.hidden=false;
        el.style.transform='translate('+l.x.toFixed(1)+'px,'+l.y.toFixed(1)+'px)';
        el.style.opacity=l.alpha<1?l.alpha.toFixed(3):'';
        el.style.pointerEvents=l.placed?'':'none';
        let line=leaderLines.get(l.id);
        if(!line){line=document.createElementNS('http://www.w3.org/2000/svg','line');leaders.appendChild(line);leaderLines.set(l.id,line);}
        line.style.display=l.leader?'':'none';
        if(l.leader){
          line.setAttribute('x1',l.leader.x1.toFixed(1));line.setAttribute('y1',l.leader.y1.toFixed(1));
          line.setAttribute('x2',l.leader.x2.toFixed(1));line.setAttribute('y2',l.leader.y2.toFixed(1));
          line.style.opacity=l.alpha<1?l.alpha.toFixed(3):'';
        }
      });
      bodies.forEach(b=>{if(!painted.has(b.label))b.label.hidden=true;});
      annotations.forEach(a=>{if(!painted.has(a.label))a.label.hidden=true;});
      leaderLines.forEach((line,id)=>{if(!painted.has(elements.get(id)))line.style.display='none';});
      if(flight||animating)draw();
    }
    function resize() {
      const oldAspect=width/height;
      width=host.clientWidth;height=host.clientHeight;
      if(!width||!height)return;
      labelSizes=new WeakMap();
      camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false);
      // Context controls may change canvas height; keep the selected world's
      // camera intact when its card opens or closes. Reset/Fit remain explicit.
      if(oldAspect!==width/height && radius>500 && !selected) home();else draw();
    }
    function hit(x,y) {
      const rect=canvas.getBoundingClientRect();
      ndc.set((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1);
      raycaster.setFromCamera(ndc,camera);
      const hits=raycaster.intersectObjects(bodies.map(b=>b.mesh),true);
      if(hits.length){let object=hits[0].object;while(object && !object.userData.world)object=object.parent;if(object)return object.userData.world;}
      let nearest=null,best=19;
      bodies.forEach(b=>{const p=b.position.clone().project(camera);if(p.z<-1||p.z>1)return;
        const d=Math.hypot((p.x*.5+.5)*width-(x-rect.left),(-p.y*.5+.5)*height-(y-rect.top));
        if(d<best){best=d;nearest=b.id;}
      });
      return nearest;
    }
    function pointerDown(e) {
      if(e.target.closest('.map-hud,.map-pane,.moon-frame,.fallback-chart'))return;
      if(e.button!==0&&e.button!==2)return;
      cancelFlight();
      e.preventDefault();
      if(!pointers.size){dragged=false;gesture={x:e.clientX,y:e.clientY,pick:e.target.closest('[data-pick]')?.dataset.pick,button:e.button};}
      pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      canvas.setPointerCapture(e.pointerId);
      if(pointers.size>1){dragged=true;cancelTap();}
    }
    function pointerMove(e) {
      if(!pointers.has(e.pointerId))return;
      const before=[...pointers.values()], old=pointers.get(e.pointerId),dx=e.clientX-old.x,dy=e.clientY-old.y;
      if(Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>5){dragged=true;cancelTap();}
      pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      const after=[...pointers.values()];
      if(after.length===2){
        const d0=Math.hypot(before[0].x-before[1].x,before[0].y-before[1].y),d1=Math.hypot(after[0].x-after[1].x,after[0].y-after[1].y);
        if(d0>0&&d1>0)zoom(d0/d1);pan(dx/2,dy/2);
      } else if(dragged) {
        if(gesture.button===2||e.shiftKey)pan(dx,dy);else{theta-=dx*.006;phi-=dy*.006;}
      }
      draw();
    }
    function pointerUp(e) {
      if(!pointers.has(e.pointerId))return;
      pointers.delete(e.pointerId);
      if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
      if(!pointers.size && !dragged && e.type==='pointerup' && gesture.button===0){
        const id=gesture.pick||hit(e.clientX,e.clientY);
        if(id && pendingTap?.id===id && performance.now()-pendingTap.time<320){
          cancelTap();if(onFocus)onFocus(id);else{onSelect(id);focus();}
        } else {
          cancelTap();
          // Briefly defer the card so it cannot intercept the second tap.
          pendingTap={id,time:performance.now(),timer:setTimeout(()=>{pendingTap=null;onSelect(id);},320)};
        }
      }
    }
    function wheel(e){if(e.target.closest('.map-pane,.map-hud,.moon-frame,.fallback-chart'))return;e.preventDefault();zoom(Math.exp(Math.max(-200,Math.min(200,e.deltaY))*.002));}
    function keyboard(e){
      if(e.target!==canvas)return;
      if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','0'].includes(e.key))e.preventDefault();else return;
      cancelFlight();
      if(e.key==='0')home();else if(e.key==='+'||e.key==='=')zoom(.85);else if(e.key==='-')zoom(1.15);
      else{const dx=e.key==='ArrowLeft'?-20:e.key==='ArrowRight'?20:0,dy=e.key==='ArrowUp'?-20:e.key==='ArrowDown'?20:0;if(e.shiftKey)pan(dx,dy);else{theta+=dx*.008;phi+=dy*.008;}draw();}
    }
    function contextMenu(e){if(!e.target.closest('.map-pane'))e.preventDefault();}
    function lost(e){e.preventDefault();onFailure();}
    host.addEventListener('pointerdown',pointerDown);host.addEventListener('pointermove',pointerMove);
    host.addEventListener('pointerup',pointerUp);host.addEventListener('pointercancel',pointerUp);
    host.addEventListener('wheel',wheel,{passive:false});host.addEventListener('keydown',keyboard);
    host.addEventListener('contextmenu',contextMenu);canvas.addEventListener('webglcontextlost',lost);
    document.addEventListener('visibilitychange',draw);
    const observer=new ResizeObserver(resize);observer.observe(host);resize();
    document.fonts?.ready.then(()=>{labelSizes=new WeakMap();draw();});
    return {
      setView,select,home,focus,zoom,surface,redraw:draw,
      // Resolves once every world in the current view has its painted surface.
      painted:()=>Promise.all(viewPaints),
      // Paint other views' worlds in the background so opening them is instant.
      // (Workers only: painting on the page would stall the map while in use.)
      prefetch:ids=>{if(!workersFailed)ids.forEach(id=>{if(id==='pani-clouds'||worlds.has(id))paint(id);});},
      hasBody:id=>bodies.some(b=>b.id===id || (b.id==='marassa' && worlds.get(id)?.parent==='marassa')),
      toggleLabels:()=>{labelsOn=!labelsOn;draw();return labelsOn;},
      destroy:()=>{destroyed=true;cancelFlight();cancelTap();if(frame!==null)cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',draw);
        host.removeEventListener('pointerdown',pointerDown);host.removeEventListener('pointermove',pointerMove);host.removeEventListener('pointerup',pointerUp);host.removeEventListener('pointercancel',pointerUp);host.removeEventListener('keydown',keyboard);host.removeEventListener('contextmenu',contextMenu);
        host.removeEventListener('wheel',wheel);canvas.removeEventListener('webglcontextlost',lost);release(scene);renderer.dispose();if(renderer.forceContextLoss)renderer.forceContextLoss();canvas.remove();labelLayer.remove();leaders.remove();}
    };
  }
  return {create};
})();
