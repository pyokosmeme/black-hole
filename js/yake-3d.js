/* Interactive, static 3D atlas using the site's bundled THREE r73.
 * Display radii/phases and illustrative surfaces are not a physics simulation.
 * Frames are rendered only when the camera, selection, or viewport changes. */
window.YakeScene = (function () {
  'use strict';
  function create(host, onSelect, onFailure) {
    if (!window.THREE) throw new Error('3D library unavailable');
    const T = window.THREE;
    const data = window.YAKE_ATLAS;
    const worlds = new Map(data.worlds.map(w => [w.id,w]));
    const renderer = new T.WebGLRenderer({antialias:true, alpha:false});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x05050f, 1);
    const canvas = renderer.domElement;
    canvas.className = 'scene-canvas';
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label','3D system map. Arrow keys rotate; Shift and arrows pan; plus and minus zoom; zero resets. Tab to world labels to select.');
    host.appendChild(canvas);
    const labelLayer = document.createElement('div');
    labelLayer.className = 'scene-labels';
    host.appendChild(labelLayer);
    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(43, 1, .1, 12000);
    scene.add(new T.AmbientLight(0x8da8cb, .7));
    const light = new T.PointLight(0xffd7a0, 1.35, 0, 0);
    scene.add(light);
    const fill = new T.DirectionalLight(0xa4c3ef, .35);
    fill.position.set(100,200,250);
    scene.add(fill);
    const target = new T.Vector3();
    let theta = .28, phi = .72, radius = 950;
    let content = null, currentView = null, selected = null;
    let bodies = [], tracks = [], frame = null, destroyed = false;
    let width = 1, height = 1, labelsOn = true;
    const pointers = new Map();
    let gesture = null, dragged = false;
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

    function noise(x,y,z) {
      const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);
      const smooth=v=>v*v*(3-2*v),fx=smooth(x-ix),fy=smooth(y-iy),fz=smooth(z-iz);
      const hash=(a,b,c)=>{let n=Math.imul(a,73856093)^Math.imul(b,19349663)^Math.imul(c,83492791);n=Math.imul(n^(n>>>13),1274126177);return (n>>>0)/4294967295;};
      const mix=(a,b,t)=>a+(b-a)*t;
      return mix(mix(mix(hash(ix,iy,iz),hash(ix+1,iy,iz),fx),mix(hash(ix,iy+1,iz),hash(ix+1,iy+1,iz),fx),fy),mix(mix(hash(ix,iy,iz+1),hash(ix+1,iy,iz+1),fx),mix(hash(ix,iy+1,iz+1),hash(ix+1,iy+1,iz+1),fx),fy),fz);
    }
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
        ctx.fillStyle=`rgb(${i+1},0,0)`;ctx.beginPath();
        shape.forEach(([x,y],j)=>{if(j)ctx.lineTo(x*c.width,y*c.height);else ctx.moveTo(x*c.width,y*c.height);});ctx.closePath();ctx.fill();
        // Small shelf islands; deterministic, confined to each continent's coast.
        shape.forEach(([x,y],j)=>{
          for(let k=0;k<3;k++){
            const dx=Math.sin(j*13+k*7)*.024,dy=Math.cos(j*9+k*17)*.023;
            ctx.beginPath();ctx.ellipse((x+dx)*c.width,(y+dy)*c.height,1+(j+k)%3,.7+(j*3+k)%2, j,0,Math.PI*2);ctx.fill();
          }
        });
      });
      return ctx.getImageData(0,0,c.width,c.height).data;
    }
    function texture(id) {
      const c=document.createElement('canvas'); c.width=['jin','shu','celosia'].includes(id)?1024:512; c.height=c.width/2;
      const ctx=c.getContext('2d'), pixels=ctx.createImageData(c.width,c.height);
      const base=new T.Color(worlds.get(id).color);
      const gas=['jin','shu','xuan'].includes(id);
      const continents=id==='celosia'?continentMask():null;
      const landAt=(u,v)=>continents[(Math.max(0,Math.min(511,Math.floor(v*512)))*1024+((Math.floor(u*1024)%1024+1024)%1024))*4];
      const offset=id.split('').reduce((n,ch)=>n+ch.charCodeAt(0),0)*.17;
      for(let y=0;y<c.height;y++) for(let x=0;x<c.width;x++) {
        const lon=x/c.width*Math.PI*2, lat=(y/c.height-.5)*Math.PI;
        const sx=Math.cos(lon)*Math.cos(lat), sy=Math.sin(lat), sz=Math.sin(lon)*Math.cos(lat);
        const n=(noise(sx*5+offset,sy*5,sz*5)*.65+noise(sx*13+offset,sy*13,sz*13)*.25+noise(sx*35,sy*35+offset,sz*35)*.1)*2-1;
        let rgb;
        if(id==='yake') rgb=[255,155+35*n,53+20*n];
        else if(gas) {
          // Differential cloud belts, curled shear filaments and oval storms.
          // Spherical noise and wrapped longitudes keep the seam continuous.
          let flowLat=lat, storm=0;
          const storms=id==='jin'?[[1.6,-.25,.28,.10],[4.5,.36,.17,.065]]:[[1.35,-.18,.24,.085],[4.1,.42,.16,.06]];
          storms.forEach(([cx,cy,rx,ry])=>{
            const dx=Math.atan2(Math.sin(lon-cx),Math.cos(lon-cx))/rx,dy=(lat-cy)/ry,d=dx*dx+dy*dy;
            if(d<9){const twist=2.9*Math.exp(-d*.45);flowLat+=(dx*Math.sin(twist)+dy*(Math.cos(twist)-1))*ry;storm=Math.max(storm,Math.exp(-d*1.5));}
          });
          const turbulence=noise(sx*18+offset,sy*32,sz*18)-.5;
          const flow=flowLat*18+n*.8+turbulence*.4;
          const band=Math.max(0,Math.min(1,.52+.23*Math.sin(flow)+.18*Math.sin(flowLat*7+.5)+.06*Math.sin(flow*3.7+turbulence*4)+.035*Math.sin(flow*13)));
          const dark=id==='jin'?[130,83,51]:id==='shu'?[65,92,126]:[92,148,174];
          const pale=id==='jin'?[242,226,185]:id==='shu'?[215,226,229]:[186,223,230];
          rgb=dark.map((v,i)=>v+(pale[i]-v)*band+n*12);
          const eye=id==='jin'?[185,100,58]:[233,238,222];
          rgb=rgb.map((v,i)=>v*(1-storm*.75)+eye[i]*storm*.75);
        } else if(id==='celosia') {
          const u=x/c.width+(noise(sx*42,sy*42,sz*42)-.5)*.014;
          const v=y/c.height+(noise(sx*57+8,sy*57,sz*57)-.5)*.01;
          const land=landAt(u,v),shore=landAt(u+.003,v)||landAt(u-.003,v)||landAt(u,v+.004)||landAt(u,v-.004);
          rgb=shore?[30+n*7,87+n*15,103+n*20]:[14+n*5,40+n*12,70+n*15];
          if(land){
            const dry=land===2?Math.max(0,Math.min(1,(v-.51)*8)):.18;
            rgb=[67+dry*103+n*25,106+dry*40+n*22,64+dry*22+n*17];
            if(land===1 && v<.29){const ice=Math.min(1,(.29-v)*8);rgb=rgb.map((c,i)=>c*(1-ice)+[198,215,216][i]*ice);}
            const ridge=noise(sx*28+4,sy*28,sz*28);
            if(ridge>.7)rgb=rgb.map(c=>c*.65+53);
          }
          const polar=Math.max(0,Math.min(1,(Math.abs(sy)-.984+n*.009)*90));
          rgb=rgb.map((v,i)=>v*(1-polar)+[177+n*18,202+n*13,212+n*10][i]*polar);
          const cloud=Math.max(0,noise(sx*7+n*.4+3,sy*23+5,sz*7+9)-.72)*.8;
          rgb=rgb.map(v=>v*(1-cloud)+228*cloud);
        } else if(id==='gullinkambi') {
          const comb=Math.abs(lat-.15-Math.sin(lon*3)*.09)<.09 && Math.cos(lon)>.15;
          rgb=comb?[160+n*35,113+n*30,42+n*10]:[181+n*27,196+n*24,199+n*23];
        } else {
          const shade=.7+n*.15;
          rgb=[base.r*255*shade,base.g*255*shade,base.b*255*shade];
        }
        const i=(y*c.width+x)*4;
        pixels.data[i]=rgb[0];pixels.data[i+1]=rgb[1];pixels.data[i+2]=rgb[2];pixels.data[i+3]=255;
      }
      ctx.putImageData(pixels,0,0);
      const map=new T.Texture(c); map.needsUpdate=true;map.anisotropy=Math.min(4,renderer.getMaxAnisotropy());
      return map;
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

    function body(id,position,size,habitat) {
      const w=worlds.get(id);
      let mesh;
      if(id==='marassa') {
        mesh=new T.Group();
        // Two full Stanford toruses, spokes and hubs joined as a dumbbell.
        [-1,1].forEach((side,i)=>{
          const ring=new T.Group();ring.userData.world=i?'chawkee':'buka';ring.position.x=side*size*.54;
          const metal=new T.MeshPhongMaterial({color:0xbac5cc,shininess:55});
          ring.add(new T.Mesh(new T.TorusGeometry(size*.34,size*.028,12,64),metal));
          const interior=new T.Mesh(new T.TorusGeometry(size*.318,size*.009,8,64),new T.MeshPhongMaterial({color:i?0x819cae:0x7a9c7d}));ring.add(interior);
          ring.add(new T.Mesh(new T.SphereGeometry(size*.045,12,8),metal.clone()));
          for(let j=0;j<6;j++){
            const a=j*Math.PI/3,spoke=new T.Mesh(new T.CylinderGeometry(size*.008,size*.008,size*.34,5),metal.clone());
            spoke.position.set(Math.cos(a)*size*.17,Math.sin(a)*size*.17,0);spoke.rotation.z=a-Math.PI/2;ring.add(spoke);
          }
          mesh.add(ring);
        });
        const bridge=new T.Mesh(new T.CylinderGeometry(size*.021,size*.021,size*1.08,10),new T.MeshPhongMaterial({color:0x9baebb,shininess:40}));bridge.rotation.z=Math.PI/2;mesh.add(bridge);
        mesh.rotation.set(-.4,.2,.2);
      } else if(id==='five') {
        mesh=new T.Group();
        const offsets=[[-.68,.2,0],[-.18,-.28,.42],[.25,.16,-.35],[.7,-.1,.12],[.1,.42,.6]];
        ['mun','in','sin','island-mu','yong'].forEach((island,i)=>{
          const m=new T.Mesh(new T.SphereGeometry(size*(i?.16:.24),24,16),new T.MeshPhongMaterial({map:texture(island)}));
          m.position.set(...offsets[i].map(v=>v*size));mesh.add(m);
        });
      } else if(habitat) {
        mesh=new T.Mesh(new T.OctahedronGeometry(size*.7),new T.MeshPhongMaterial({color:0xa7c9d1,shininess:45}));
      } else {
        const material=id==='yake'?new T.MeshBasicMaterial({map:texture(id)}):new T.MeshPhongMaterial({map:texture(id),shininess:id==='celosia'?28:6,specular:0x334155});
        mesh=new T.Mesh(new T.SphereGeometry(size,40,24),material);
      }
      mesh.position.copy(position);mesh.userData.world=id;content.add(mesh);
      const marker=new T.Mesh(new T.TorusGeometry(size+2,.12,6,64),new T.MeshBasicMaterial({color:0xff0099,transparent:true,opacity:.85,depthTest:false,depthWrite:false}));
      marker.position.copy(position);marker.visible=false;marker.renderOrder=10;content.add(marker);
      const label=document.createElement('button');label.type='button';label.className='scene-label';label.dataset.pick=id;
      label.textContent=w.mapLabel || w.name;label.setAttribute('aria-label','Select '+w.name);label.setAttribute('aria-pressed','false');labelLayer.appendChild(label);
      label.addEventListener('click',e=>{ if(e.detail===0) onSelect(id); });
      bodies.push({id,mesh,marker,label,position,size});
    }

    function point(r,angle,inc) {
      return new T.Vector3(r*Math.cos(angle),r*Math.sin(angle)*Math.sin(inc),r*Math.sin(angle)*Math.cos(inc));
    }
    function orbit(id,r,inc,ez) {
      const geometry=new T.Geometry();
      for(let i=0;i<=180;i++) geometry.vertices.push(point(r,i/180*Math.PI*2,inc));
      const material=new T.LineBasicMaterial({color:ez?0xc57b4a:0x536480,transparent:true,opacity:ez?.4:.36});
      const line=new T.Line(geometry,material);content.add(line);tracks.push({id,line,ez});
    }
    function release(group) {
      group.traverse(obj=>{
        if(obj.geometry) obj.geometry.dispose();
        if(obj.material) { if(obj.material.map) obj.material.map.dispose();obj.material.dispose(); }
      });
    }
    function setView(name,id) {
      if(currentView!==name) {
        if(content) {scene.remove(content);release(content);}
        content=new T.Group();scene.add(content);bodies=[];tracks=[];labelLayer.textContent='';currentView=name;
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
          (cfg.locals||[]).forEach(([world,r,a])=>body(world,point(r,a*Math.PI/180,0),world==='marassa'?20:worlds.get(world).mapLabel?5:8,!!worlds.get(world).mapLabel));
          if(cfg.ez) {
            const points=[[0,0],...cfg.nodes.map(([world,r])=>[worlds.get(world).km,r]).filter(p=>p[0]).sort((a,b)=>a[0]-b[0])];
            for(let i=1;i<points.length;i++) {
              const [lo,rl]=points[i-1], [hi,rh]=points[i];
              if(hi>=cfg.ez) {
                orbit(null,rl+(cfg.ez-lo)/(hi-lo)*(rh-rl),0,true);break;
              }
            }
          }
        }
        home();
      }
      select(id);
    }
    function select(id) {
      selected=id;
      bodies.forEach(b=>{const active=b.id===id || (b.id==='marassa' && worlds.get(id)?.parent==='marassa');b.marker.visible=active;b.label.setAttribute('aria-pressed',active?'true':'false');});
      tracks.forEach(t=>{t.line.material.color.setHex(t.id===id?0xff0099:t.ez?0xc57b4a:0x536480);t.line.material.opacity=t.id===id?.9:t.ez?.4:.36;});
      draw();
    }
    function home() {
      target.set(0,0,0); theta=.28;phi=.72;
      radius=360/Math.tan(camera.fov*Math.PI/360)/Math.min(1,width/height)*1.08;
      draw();
    }
    function focus() {
      const b=bodies.find(b=>b.id===selected || (b.id==='marassa' && worlds.get(selected)?.parent==='marassa'));if(!b)return;
      target.copy(b.position);radius=Math.max(b.size*(width<600?11:9),75);phi=1.25;
      if(width<600)target.add(new T.Vector3(0,1,0).applyQuaternion(camera.quaternion).multiplyScalar(-b.size*1.7));
      draw();
    }
    function surface(region) {
      if(selected!=='celosia')return;
      focus();theta=({fusang:.25,mu:.62,diyu:.77}[region]-.25)*Math.PI*2;draw();
    }
    function zoom(factor) {radius=Math.max(40,Math.min(2600,radius*factor));draw();}
    function pan(dx,dy) {
      const unit=radius*2*Math.tan(camera.fov*Math.PI/360)/height;
      const right=new T.Vector3(1,0,0).applyQuaternion(camera.quaternion);
      const up=new T.Vector3(0,1,0).applyQuaternion(camera.quaternion);
      target.add(right.multiplyScalar(-dx*unit)).add(up.multiplyScalar(dy*unit));
    }
    function draw() {
      if(frame!==null||destroyed||document.hidden)return;
      frame=requestAnimationFrame(()=>{frame=null;render();});
    }
    function render() {
      phi=Math.max(.12,Math.min(Math.PI-.12,phi));
      camera.position.set(target.x+radius*Math.sin(phi)*Math.sin(theta),target.y+radius*Math.cos(phi),target.z+radius*Math.sin(phi)*Math.cos(theta));
      camera.lookAt(target);camera.updateMatrixWorld();
      bodies.forEach(b=>b.marker.quaternion.copy(camera.quaternion));
      renderer.render(scene,camera);
      const occupied=[];
      // Place the selected label first; keep other labels clear as the camera moves.
      bodies.slice().sort((a,b)=>Number(b.id===selected)-Number(a.id===selected)).forEach(b=>{
        const p=b.position.clone().project(camera), x=(p.x*.5+.5)*width,y=(-p.y*.5+.5)*height;
        const visible=labelsOn&&p.z>-1&&p.z<1&&x>0&&x<width&&y>0&&y<height;
        b.label.hidden=!visible;
        if(!visible)return;
        const w=b.label.offsetWidth,h=b.label.offsetHeight;
        const r=b.size*height/(2*Math.tan(camera.fov*Math.PI/360)*camera.position.distanceTo(b.position));
        const candidates=[[x+r+7,y-h/2],[x-r-w-7,y-h/2],[x-w/2,y-r-h-6],[x-w/2,y+r+6]];
        let chosen=null;
        for(const [cx,cy] of candidates) {
          const box={x:Math.max(4,Math.min(width-w-4,cx)),y:Math.max(35,Math.min(height-h-62,cy)),w,h};
          if(!occupied.some(o=>box.x<o.x+o.w+4&&box.x+box.w+4>o.x&&box.y<o.y+o.h+3&&box.y+box.h+3>o.y)){chosen=box;break;}
        }
        if(!chosen){b.label.hidden=true;return;}
        occupied.push(chosen);b.label.style.transform=`translate(${chosen.x}px,${chosen.y}px)`;
      });
    }
    function resize() {
      const oldAspect=width/height;
      width=host.clientWidth;height=host.clientHeight;
      if(!width||!height)return;
      camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false);
      if(oldAspect!==width/height && radius>500) home();else draw();
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
      if(e.target.closest('.scene-controls,.scene-card,.scene-heading'))return;
      if(e.button!==0&&e.button!==2)return;
      e.preventDefault();
      if(!pointers.size){dragged=false;gesture={x:e.clientX,y:e.clientY,pick:e.target.closest('[data-pick]')?.dataset.pick,button:e.button};}
      pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      canvas.setPointerCapture(e.pointerId);
      if(pointers.size>1)dragged=true;
    }
    function pointerMove(e) {
      if(!pointers.has(e.pointerId))return;
      const before=[...pointers.values()], old=pointers.get(e.pointerId),dx=e.clientX-old.x,dy=e.clientY-old.y;
      if(Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>5)dragged=true;
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
      if(!pointers.size && !dragged && e.type==='pointerup' && gesture.button===0)onSelect(gesture.pick||hit(e.clientX,e.clientY));
    }
    function wheel(e){if(e.target.closest('.scene-card'))return;e.preventDefault();zoom(Math.exp(Math.max(-200,Math.min(200,e.deltaY))*.002));}
    function keyboard(e){
      if(e.target!==canvas)return;
      if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','0'].includes(e.key))e.preventDefault();else return;
      if(e.key==='0')home();else if(e.key==='+'||e.key==='=')zoom(.85);else if(e.key==='-')zoom(1.15);
      else{const dx=e.key==='ArrowLeft'?-20:e.key==='ArrowRight'?20:0,dy=e.key==='ArrowUp'?-20:e.key==='ArrowDown'?20:0;if(e.shiftKey)pan(dx,dy);else{theta+=dx*.008;phi+=dy*.008;}draw();}
    }
    function contextMenu(e){if(!e.target.closest('.scene-card'))e.preventDefault();}
    function lost(e){e.preventDefault();onFailure();}
    host.addEventListener('pointerdown',pointerDown);host.addEventListener('pointermove',pointerMove);
    host.addEventListener('pointerup',pointerUp);host.addEventListener('pointercancel',pointerUp);
    host.addEventListener('wheel',wheel,{passive:false});host.addEventListener('keydown',keyboard);
    host.addEventListener('contextmenu',contextMenu);canvas.addEventListener('webglcontextlost',lost);
    document.addEventListener('visibilitychange',draw);
    const observer=new ResizeObserver(resize);observer.observe(host);resize();
    return {
      setView,select,home,focus,zoom,surface,
      hasBody:id=>bodies.some(b=>b.id===id || (b.id==='marassa' && worlds.get(id)?.parent==='marassa')),
      toggleLabels:()=>{labelsOn=!labelsOn;draw();return labelsOn;},
      destroy:()=>{destroyed=true;if(frame!==null)cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',draw);
        host.removeEventListener('pointerdown',pointerDown);host.removeEventListener('pointermove',pointerMove);host.removeEventListener('pointerup',pointerUp);host.removeEventListener('pointercancel',pointerUp);host.removeEventListener('keydown',keyboard);host.removeEventListener('contextmenu',contextMenu);
        host.removeEventListener('wheel',wheel);canvas.removeEventListener('webglcontextlost',lost);release(scene);renderer.dispose();if(renderer.forceContextLoss)renderer.forceContextLoss();canvas.remove();labelLayer.remove();}
    };
  }
  return {create};
})();
