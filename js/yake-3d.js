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
    renderer.setClearColor(0x050810, 1);
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
    function texture(id) {
      const c=document.createElement('canvas'); c.width=512; c.height=256;
      const ctx=c.getContext('2d'), pixels=ctx.createImageData(c.width,c.height);
      const base=new T.Color(worlds.get(id).color);
      const gas=['jin','shu','xuan'].includes(id);
      const offset=id.split('').reduce((n,ch)=>n+ch.charCodeAt(0),0)*.17;
      for(let y=0;y<c.height;y++) for(let x=0;x<c.width;x++) {
        const lon=x/c.width*Math.PI*2, lat=(y/c.height-.5)*Math.PI;
        const sx=Math.cos(lon)*Math.cos(lat), sy=Math.sin(lat), sz=Math.sin(lon)*Math.cos(lat);
        const n=(noise(sx*5+offset,sy*5,sz*5)*.65+noise(sx*13+offset,sy*13,sz*13)*.25+noise(sx*35,sy*35+offset,sz*35)*.1)*2-1;
        let rgb;
        if(id==='yake') rgb=[255,155+35*n,53+20*n];
        else if(gas) {
          const band=.74+.14*Math.sin(lat*48+Math.sin(lon*5+lat*8)*.5)+n*.08;
          rgb=[base.r*255*band,base.g*255*band,base.b*255*band];
        } else if(id==='celosia') {
          rgb=n>.18?[132+n*35,113+n*27,56+n*20]:[18+n*5,62+n*16,94+n*24];
          if(Math.abs(sy)>.91) rgb=[170,191,197];
          const cloud=noise(sx*11+3,sy*18+5,sz*11+9);
          if(cloud>.67) rgb=rgb.map(v=>v*.6+90);
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
      const map=new T.Texture(c); map.needsUpdate=true;
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
      if(habitat) {
        mesh=new T.Mesh(new T.TorusGeometry(size,size*.16,10,48),new T.MeshPhongMaterial({color:w.color,shininess:45}));
        mesh.rotation.set(.7,.25,.15);
      } else {
        const material=id==='yake'?new T.MeshBasicMaterial({map:texture(id)}):new T.MeshPhongMaterial({map:texture(id),shininess:id==='celosia'?28:6,specular:0x334155});
        mesh=new T.Mesh(new T.SphereGeometry(size,40,24),material);
      }
      mesh.position.copy(position);mesh.userData.world=id;content.add(mesh);
      const marker=new T.Mesh(new T.TorusGeometry(size+2,.32,6,64),new T.MeshBasicMaterial({color:0xff0099,transparent:true,opacity:.95,depthTest:false,depthWrite:false}));
      marker.position.copy(position);marker.visible=false;marker.renderOrder=10;content.add(marker);
      const label=document.createElement('button');label.type='button';label.className='scene-label';label.dataset.pick=id;
      label.textContent=w.name;label.setAttribute('aria-label','Select '+w.name);label.setAttribute('aria-pressed','false');labelLayer.appendChild(label);
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
        if(name==='habitats') {
          const positions=[[-190,0,-80],[-190,0,30],[-90,0,130],[-150,-45,210],[30,-45,210],[100,0,-80],[240,0,60]];
          cfg.members.forEach((world,i)=>body(world,new T.Vector3(...positions[i]),world==='marassa'?22:14,true));
          light.position.set(0,200,0);
        } else {
          body(cfg.parent,new T.Vector3(),cfg.parent==='yake'?24:27,false);
          if(cfg.parent==='yake') corona();
          light.position.set(cfg.parent==='yake'?0:-200,cfg.parent==='yake'?0:160,cfg.parent==='yake'?0:80);
          cfg.nodes.forEach(([world,r,a])=>{
            const inc=world==='celosia'?4.78*Math.PI/180:0;
            orbit(world,r,inc,false);
            const size={jin:13,shu:12,xuan:11,celosia:9,gullinkambi:7,chanticleer:7,five:8,kukkuta:7}[world]||8;
            body(world,point(r,a*Math.PI/180,inc),size,false);
          });
          if(cfg.ez) {
            for(let i=1;i<cfg.nodes.length;i++) {
              const [lo,rl]=cfg.nodes[i-1], [hi,rh]=cfg.nodes[i];
              if(worlds.get(hi).km>=cfg.ez) {
                orbit(null,rl+(cfg.ez-worlds.get(lo).km)/(worlds.get(hi).km-worlds.get(lo).km)*(rh-rl),0,true);break;
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
      bodies.forEach(b=>{b.marker.visible=b.id===id;b.label.setAttribute('aria-pressed',b.id===id?'true':'false');});
      tracks.forEach(t=>{t.line.material.color.setHex(t.id===id?0xff0099:t.ez?0xc57b4a:0x536480);t.line.material.opacity=t.id===id?.9:t.ez?.4:.36;});
      draw();
    }
    function home() {
      target.set(0,0,0); theta=.28;phi=.72;
      radius=360/Math.tan(camera.fov*Math.PI/360)/Math.min(1,width/height)*1.08;
      draw();
    }
    function focus() {
      const b=bodies.find(b=>b.id===selected);if(!b)return;
      target.copy(b.position);radius=Math.max(b.size*(width<600?11:9),75);
      if(width<600)target.add(new T.Vector3(0,1,0).applyQuaternion(camera.quaternion).multiplyScalar(-b.size*1.7));
      draw();
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
      const hits=raycaster.intersectObjects(bodies.map(b=>b.mesh));
      if(hits.length)return hits[0].object.userData.world;
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
      setView,select,home,focus,zoom,
      hasBody:id=>bodies.some(b=>b.id===id),
      toggleLabels:()=>{labelsOn=!labelsOn;draw();return labelsOn;},
      destroy:()=>{destroyed=true;if(frame!==null)cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',draw);
        host.removeEventListener('pointerdown',pointerDown);host.removeEventListener('pointermove',pointerMove);host.removeEventListener('pointerup',pointerUp);host.removeEventListener('pointercancel',pointerUp);host.removeEventListener('keydown',keyboard);host.removeEventListener('contextmenu',contextMenu);
        host.removeEventListener('wheel',wheel);canvas.removeEventListener('webglcontextlost',lost);release(scene);renderer.dispose();if(renderer.forceContextLoss)renderer.forceContextLoss();canvas.remove();labelLayer.remove();}
    };
  }
  return {create};
})();
