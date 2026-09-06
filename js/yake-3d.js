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
    let bodies = [], tracks = [], annotations = [], frame = null, destroyed = false;
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
        // Broad continental shelves, scalloped bays and a fragmented archipelago
        // silhouette rather than three narrow polygon strips.
        const center=[.255,.62,.77][i];
        shape=shape.map(([x,y])=>[center+(x-center)*(i===0?1.5:1.22),y]);
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
      const mask=ctx.getImageData(0,0,c.width,c.height).data;
      // Sheltered seas and narrow straits break up the land masses. Coastline
      // distortion below supplies smaller fjords; the rest of the globe is ocean.
      for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
        const j=(y*c.width+x)*4;if(!mask[j])continue;
        const u=x/c.width,v=y/c.height;
        const channel=noise(u*45+8,v*57,2)*.65+noise(u*110,v*130,7)*.35;
        if(channel>.57)mask[j]=0;
      }
      return mask;
    }
    function texture(id) {
      const c=document.createElement('canvas'); c.width=['jin','shu','celosia','gullinkambi'].includes(id)?1024:512; c.height=c.width/2;
      const ctx=c.getContext('2d'), pixels=ctx.createImageData(c.width,c.height);
      const detailed=['celosia','gullinkambi'].includes(id);
      const relief=detailed?ctx.createImageData(c.width,c.height):null;
      const reflectivity=detailed?ctx.createImageData(c.width,c.height):null;
      const base=new T.Color(worlds.get(id).color);
      const gas=['jin','shu','xuan'].includes(id);
      const continents=id==='celosia'?continentMask():null;
      const landAt=(u,v)=>Math.round(continents[(Math.max(0,Math.min(511,Math.floor(v*512)))*1024+((Math.floor(u*1024)%1024+1024)%1024))*4]/64);
      const offset=id.split('').reduce((n,ch)=>n+ch.charCodeAt(0),0)*.17;
      for(let y=0;y<c.height;y++) for(let x=0;x<c.width;x++) {
        const lon=x/c.width*Math.PI*2, lat=(y/c.height-.5)*Math.PI;
        const sx=Math.cos(lon)*Math.cos(lat), sy=Math.sin(lat), sz=Math.sin(lon)*Math.cos(lat);
        const n=(noise(sx*5+offset,sy*5,sz*5)*.65+noise(sx*13+offset,sy*13,sz*13)*.25+noise(sx*35,sy*35+offset,sz*35)*.1)*2-1;
        let rgb, elevation=110+n*25, shine=45;
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
          rgb=shore?[32+n*7,105+n*15,122+n*20]:[12+n*5,43+n*12,73+n*15];
          elevation=75;shine=185;
          if(land){
            const dry=land===2?Math.max(0,Math.min(1,(v-.51)*8)):.18;
            rgb=[67+dry*103+n*25,106+dry*40+n*22,64+dry*22+n*17];
            if(land===1 && v<.29){const ice=Math.min(1,(.29-v)*8);rgb=rgb.map((c,i)=>c*(1-ice)+[198,215,216][i]*ice);}
            const ridge=1-Math.abs(noise(sx*23+4,sy*23,sz*23)*2-1);
            const fine=noise(sx*110,sy*110,sz*110)-.5;
            elevation=115+ridge*65+fine*25;shine=15;
            rgb=rgb.map(c=>c*(.82+ridge*.18)+fine*16);
            if(ridge>.94 && land===1 && v<.4)rgb=rgb.map(c=>c*.6+81);
          }
          const polar=Math.max(0,Math.min(1,(Math.abs(sy)-.984+n*.009)*90));
          rgb=rgb.map((v,i)=>v*(1-polar)+[177+n*18,202+n*13,212+n*10][i]*polar);
          const cloud=Math.max(0,noise(sx*7+n*.4+3,sy*23+5,sz*7+9)-.72)*.8;
          rgb=rgb.map(v=>v*(1-cloud)+228*cloud);
        } else if(id==='gullinkambi') {
          // A localized oblique fissure province, not an equatorial gold belt.
          const dx=Math.atan2(Math.sin(lon-1.55),Math.cos(lon-1.55));
          const along=dx*.8+lat*.6, cross=lat*.8-dx*.6-.045*Math.sin(along*9);
          const age=Math.max(0,Math.min(1,(along+.72)/1.5));
          const teeth=.4+.4*noise(sx*27+7,sy*27,sz*27)+.2*noise(sx*83,sy*83,sz*83);
          const taper=Math.sqrt(Math.max(0,1-Math.pow(along/.87,2)));
          const apron=(.055+age*.25)*teeth*taper;
          const comb=Math.abs(along)<.86 && Math.abs(cross)<apron;
          const iceVein=Math.abs(noise(sx*31,sy*31,sz*31)-.5);
          rgb=[180+n*25,197+n*22,207+n*18];
          elevation=130+n*22;shine=70;
          if(iceVein<.018){rgb=rgb.map(v=>v*.65);elevation-=18;}
          if(comb){
            const lamina=.5+.5*Math.sin(cross*235+along*16+n*8+noise(sx*90,sy*90,sz*90)*3);
            const old=[180,132,57],fresh=[61,62,57];
            rgb=fresh.map((v,i)=>v+(old[i]-v)*Math.pow(age,.6)+n*20+(lamina-.5)*32);
            elevation=145+lamina*30+n*12;shine=20;
            if(Math.abs(cross)<.013+(.8-age)*.009){rgb=rgb.map(v=>v*.37);elevation=78;}
          }
        } else {
          const shade=.7+n*.15;
          rgb=[base.r*255*shade,base.g*255*shade,base.b*255*shade];
        }
        const i=(y*c.width+x)*4;
        pixels.data[i]=rgb[0];pixels.data[i+1]=rgb[1];pixels.data[i+2]=rgb[2];pixels.data[i+3]=255;
        if(detailed){
          for(let k=0;k<3;k++){relief.data[i+k]=elevation;reflectivity.data[i+k]=shine;}
          relief.data[i+3]=reflectivity.data[i+3]=255;
        }
      }
      ctx.putImageData(pixels,0,0);
      const map=new T.Texture(c); map.needsUpdate=true;map.anisotropy=Math.min(4,renderer.getMaxAnisotropy());
      if(detailed){
        [relief,reflectivity].forEach((pixels,i)=>{const layer=document.createElement('canvas');layer.width=c.width;layer.height=c.height;layer.getContext('2d').putImageData(pixels,0,0);const t=new T.Texture(layer);t.needsUpdate=true;map[i?'surfaceSpecular':'surfaceRelief']=t;});
      }
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
        // Coaxial counter-rotating wheels: the stationary spine passes through
        // bearing hubs along the spin axis, never through either inhabited rim.
        [-1,1].forEach((side,i)=>{
          const ring=new T.Group();ring.name='rotating-wheel';ring.userData.world=i?'chawkee':'buka';ring.userData.spinDirection=i?-1:1;ring.position.x=side*size*.54;ring.rotation.y=Math.PI/2;
          const metal=new T.MeshPhongMaterial({color:0xbac5cc,shininess:55});
          ring.add(new T.Mesh(new T.TorusGeometry(size*.34,size*.028,12,64),metal));
          const interior=new T.Mesh(new T.TorusGeometry(size*.318,size*.009,8,64),new T.MeshPhongMaterial({color:i?0x819cae:0x7a9c7d}));ring.add(interior);
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
        const offsets=[[-.68,.2,0],[-.18,-.28,.42],[.25,.16,-.35],[.7,-.1,.12],[.1,.42,.6]];
        ['mun','in','sin','island-mu','yong'].forEach((island,i)=>{
          const m=new T.Mesh(new T.SphereGeometry(size*(i?.16:.24),24,16),new T.MeshPhongMaterial({map:texture(island)}));
          m.position.set(...offsets[i].map(v=>v*size));mesh.add(m);
        });
      } else if(habitat) {
        mesh=new T.Mesh(new T.OctahedronGeometry(size*.7),new T.MeshPhongMaterial({color:0xa7c9d1,shininess:45}));
      } else {
        const map=texture(id);
        const material=id==='yake'?new T.MeshBasicMaterial({map}):new T.MeshPhongMaterial({map,shininess:id==='celosia'?28:6,specular:map.surfaceRelief?0x60758b:0x334155});
        if(map.surfaceRelief){material.bumpMap=map.surfaceRelief;material.bumpScale=size*.018;material.specularMap=map.surfaceSpecular;}
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
    // One radial conversion for moons, Jin's EZ, and Lagrange neighborhoods.
    // Unknown offset bearings remain explicit display choices, not orbital data.
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
      const label=document.createElement('span');label.className='scene-label scene-annotation';label.textContent=text;labelLayer.appendChild(label);annotations.push({label,position});
    }
    function lagrangeNeighborhood(local,cfg) {
      const node=cfg.nodes.find(n=>n[0]===local.secondary);
      const km=worlds.get(local.secondary).km;
      // Positive angular progression is the schematic prograde convention.
      const angle=(node[2]+(local.point==='L5'?-60:60))*Math.PI/180;
      const center=point(km,angle,0);
      const project=p=>point(scaledRadius(p.length(),cfg),Math.atan2(p.z,p.x),0);
      const pos=project(point(km+local.offsetKm,angle,0));
      body(local.id,pos,20,false);
      bodies[bodies.length-1].mesh.userData.placement={secondary:local.secondary,point:local.point,offsetKm:local.offsetKm,offsetDirection:local.offsetDirection};
      annotation('SKARDA–JIN L5',project(center));
      const geometry=new T.Geometry();
      for(let i=0;i<=120;i++)geometry.vertices.push(project(center.clone().add(point(local.offsetKm,i/120*Math.PI*2,0))));
      geometry.computeLineDistances();
      const line=new T.Line(geometry,new T.LineDashedMaterial({color:0xa6a2b4,transparent:true,opacity:.6,dashSize:1.5,gapSize:1.5}));
      line.name='L5 offset uncertainty';content.add(line);
    }
    function release(group) {
      group.traverse(obj=>{
        if(obj.geometry) obj.geometry.dispose();
        if(obj.material) { ['map','bumpMap','specularMap'].forEach(key=>{if(obj.material[key])obj.material[key].dispose();});obj.material.dispose(); }
      });
    }
    function setView(name,id) {
      if(currentView!==name) {
        if(content) {scene.remove(content);release(content);}
        content=new T.Group();scene.add(content);bodies=[];tracks=[];annotations=[];labelLayer.textContent='';currentView=name;
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
          (cfg.lagrangeLocals||[]).forEach(local=>lagrangeNeighborhood(local,cfg));
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
      selected=id;
      bodies.forEach(b=>{const active=b.id===id || (b.id==='marassa' && worlds.get(id)?.parent==='marassa');b.marker.visible=active;b.label.setAttribute('aria-pressed',active?'true':'false');});
      tracks.forEach(t=>{const active=id!=null && t.id===id;t.line.material.color.setHex(active?0xff0099:t.ez?0xc57b4a:0x536480);t.line.material.opacity=active?.9:t.ez?.4:.36;});
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
      // Bring the named geological feature into view when inspecting this world.
      if(selected==='gullinkambi')theta=.1;
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
      annotations.forEach(({label,position})=>{
        const p=position.clone().project(camera),x=(p.x*.5+.5)*width,y=(-p.y*.5+.5)*height;
        label.hidden=!labelsOn||p.z<=-1||p.z>=1||x<0||x>width||y<35||y>height-62;
        if(label.hidden)return;
        const w=label.offsetWidth,h=label.offsetHeight,bx=Math.max(4,Math.min(width-w-4,x+8));
        const box=[0,h+4,-h-4,2*h+8,-2*h-8].map(d=>({x:bx,y:y+d,w,h})).find(b=>b.y>=35&&b.y+h<=height-62&&!occupied.some(o=>b.x<o.x+o.w+4&&b.x+w+4>o.x&&b.y<o.y+o.h+3&&b.y+h+3>o.y));
        if(!box){label.hidden=true;return;}
        occupied.push(box);label.style.transform=`translate(${box.x}px,${box.y}px)`;
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
