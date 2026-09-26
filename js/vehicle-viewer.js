
/* CHOMP rig and scene adapted from the supplied viewer. The site background
 * keeps its own Three.js; this scene uses the delivered r160 build. */
(function(){
'use strict';
const THREE=window.CHOMP_THREE, OrbitControls=window.CHOMP_OrbitControls;
const stage=document.getElementById('stage'), statusEl=document.getElementById('status');
if(!THREE){statusEl.textContent='The 3D library did not load. Vehicle specifications remain available under Details.';return;}
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});}catch(e){statusEl.textContent='WebGL is unavailable. Vehicle specifications remain available under Details.';document.body.classList.add('no-webgl');return;}
renderer.setPixelRatio(Math.min(devicePixelRatio||1,innerWidth<600?1:1.25));
// 244 source chunks remain separately pickable. Shadow passes multiplied their
// draw calls, so use one inexpensive contact ellipse instead.
renderer.shadowMap.enabled=false;
renderer.outputColorSpace=THREE.SRGBColorSpace;
stage.prepend(renderer.domElement);
renderer.domElement.tabIndex=0;
renderer.domElement.setAttribute('role','img');
renderer.domElement.setAttribute('aria-label','CHOMP 3D model. Drag to orbit, scroll or pinch to zoom, click to identify a part. Arrow keys pan after focusing this view.');
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(32,1,0.1,400);
camera.up.set(0,0,1);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true; controls.dampingFactor=.09; controls.maxDistance=80; controls.minDistance=2;
controls.listenToKeyEvents(renderer.domElement);

const ambient=new THREE.HemisphereLight(0xe8eef0,0x3a3f36,1.6); scene.add(ambient);
const sun=new THREE.DirectionalLight(0xfff4e2,2.1);
sun.position.set(-7,-9,16);
scene.add(sun); scene.add(sun.target);
const fill=new THREE.DirectionalLight(0xcfe0ff,.7); fill.position.set(10,8,4); scene.add(fill);
const lightingDefaults=Object.freeze({ambient:1.6,key:2.1,fill:.7,bearing:-128});
const lighting={...lightingDefaults};
const lightingControls={
  ambient:document.getElementById('lightAmbient'), key:document.getElementById('lightKey'),
  fill:document.getElementById('lightFill'), bearing:document.getElementById('lightBearing')
};
const lightingStorageKey='chomp-lighting-v1';
try{
  const saved=JSON.parse(localStorage.getItem(lightingStorageKey));
  if(saved&&typeof saved==='object')for(const [key,input] of Object.entries(lightingControls)){
    const value=saved[key];
    if(Number.isFinite(value)&&value>=Number(input.min)&&value<=Number(input.max))lighting[key]=value;
  }
}catch{}
function applyLighting(){
  ambient.intensity=lighting.ambient; sun.intensity=lighting.key; fill.intensity=lighting.fill;
  const angle=THREE.MathUtils.degToRad(lighting.bearing),radius=Math.hypot(7,9);
  sun.position.set(Math.cos(angle)*radius,Math.sin(angle)*radius,16);
  for(const [key,input] of Object.entries(lightingControls)){
    input.value=lighting[key];
    document.getElementById(input.id+'Value').textContent=key==='bearing'?`${lighting[key]}°`:`${lighting[key].toFixed(1)}×`;
  }
}
applyLighting();
for(const [key,input] of Object.entries(lightingControls)){
  input.addEventListener('input',()=>{lighting[key]=Number(input.value);applyLighting();requestRender();});
  input.addEventListener('change',()=>{try{localStorage.setItem(lightingStorageKey,JSON.stringify(lighting));}catch{}});
}
document.getElementById('resetLighting').addEventListener('click',()=>{
  Object.assign(lighting,lightingDefaults);applyLighting();
  try{localStorage.removeItem(lightingStorageKey);}catch{}
  requestRender();
});

const contactTexture=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');const g=x.createRadialGradient(32,32,2,32,32,32);g.addColorStop(0,'rgba(0,0,0,.34)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);})();
const groundShadow=new THREE.Mesh(new THREE.PlaneGeometry(14,10),new THREE.MeshBasicMaterial({map:contactTexture,transparent:true,depthWrite:false}));
groundShadow.position.z=-.005; scene.add(groundShadow);
function makeGrid(){
  const css=getComputedStyle(stage);
  const g=new THREE.GridHelper(24,24,css.getPropertyValue('--grid-major').trim(),css.getPropertyValue('--grid').trim());
  g.rotation.x=Math.PI/2; g.material.transparent=true; g.material.opacity=.55; return g;
}
let grid=makeGrid(); scene.add(grid);
// Ground scatter. A 1 m grid is periodic, so at a sprint (0.37 m per frame at
// 60 fps, more at lower frame rates) it strobes like a wagon wheel and can even
// appear to run backwards. Randomly placed pebbles have no period to alias with,
// so they carry the sense of speed; the grid fades as the ground speeds up.
const SCN=110,SCW=24,scX0=new Float32Array(SCN),scY=new Float32Array(SCN),scR=new Float32Array(SCN),scA=new Float32Array(SCN);
const scatter=new THREE.InstancedMesh(new THREE.CircleGeometry(1,5),
  new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.28,depthWrite:false}),SCN);
{let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
 for(let i=0;i<SCN;i++){scX0[i]=(rnd()-.5)*SCW;scY[i]=(rnd()-.5)*SCW;scR[i]=.04+.16*rnd()**2;scA[i]=rnd()*6.283;}}
scatter.frustumCulled=false;scene.add(scatter);
function scatterColour(){scatter.material.color.set(getComputedStyle(stage).getPropertyValue('--grid-major').trim());}scatterColour();
const scM=new THREE.Matrix4(),scQ=new THREE.Quaternion(),scP=new THREE.Vector3(),scS=new THREE.Vector3(),scZ=new THREE.Vector3(0,0,1);
function placeScatter(gx){
  for(let i=0;i<SCN;i++){
    const x=((scX0[i]+gx+SCW/2)%SCW+SCW)%SCW-SCW/2;
    scP.set(x,scY[i],.004);scQ.setFromAxisAngle(scZ,scA[i]);scS.set(scR[i],scR[i]*.7,1);
    scatter.setMatrixAt(i,scM.compose(scP,scQ,scS));}
  scatter.instanceMatrix.needsUpdate=true;
}
placeScatter(0);
let groundSpeed=0;
function gridFade(){ // full grid below ~3 m/s, faint above ~9 m/s
  const k=Math.min(1,Math.max(0,(groundSpeed-3)/6));grid.material.opacity=.55*(1-.85*k);
}

const shared={uSel:{value:-1},uCamo:{value:null}};
function patch(mat,useCamo){
  mat.onBeforeCompile=(sh)=>{
    sh.uniforms.uSel=shared.uSel; sh.uniforms.uCamo=shared.uCamo; sh.uniforms.uUseCamo={value:useCamo?1:0};
    sh.vertexShader=sh.vertexShader
      .replace('#include <common>','#include <common>\nattribute float partId;\nvarying float vPart;\nvarying vec3 vObjPos;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvPart=partId;\nvObjPos=position;');
    sh.fragmentShader=sh.fragmentShader
      .replace('#include <common>','#include <common>\nvarying float vPart;\nvarying vec3 vObjPos;\nuniform float uSel;\nuniform sampler2D uCamo;\nuniform float uUseCamo;')
      .replace('#include <color_fragment>',`#include <color_fragment>
        if(uUseCamo>0.5){
          // Triplanar blend: 45-degree bevels (leg plinths, chamfers) no longer
          // flicker between two projections pixel by pixel.
          vec3 nn=normalize(cross(dFdx(vObjPos),dFdy(vObjPos)));vec3 w=pow(abs(nn),vec3(6.0));w/=(w.x+w.y+w.z);
          diffuseColor.rgb=texture2D(uCamo,vObjPos.yz/6.0).rgb*w.x+texture2D(uCamo,vObjPos.xz/6.0).rgb*w.y+texture2D(uCamo,vObjPos.xy/6.0).rgb*w.z;
        }
        if(abs(vPart-uSel)<0.5)diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.0,0.55,0.08),0.6);`);
  };
  mat.customProgramCacheKey=()=>'chomp'+(useCamo?1:0);
  return mat;
}

const layers={hull:[],turret:[],legs:[],radiator:[],cargo:[],ramp:[]};
const pickables=[]; let names=[], rampInfo=null;
const world=new THREE.Group(); scene.add(world);
const pivot=new THREE.Group(); world.add(pivot);
const turretPivot=new THREE.Group(); world.add(turretPivot);
const variantMeshes={}; let currentVariant='cic';
const VARIANT_INFO={
  cic:['CIC','360-degree collection and dissemination: a surface-capable, radiation-hardened space AWACS. Phased arrays sit behind flush armoured radome panels covering every bearing (head optics forward; pod faces fore, outboard and aft; head rear face). Laser-comm turrets are recessed in the pod roofs; the optics hood carries retractable radiation shutters. Heat goes to the belly radiator.'],
  gun:['Autocannon','Military only. 50 g osmium at 4.12 km/s and 2,047 rpm: 25x the TECH BRACE round at twice the rate. Full rate needs ~52 MW, so it fires in bursts from the finned pulse-power bank; the reactor sustains ~144 rpm. Magazine is internal; the rotor mantlet elevates between cheeks that continue the house front.'],
  cadss:['CIWS (CADSS)','Civilian / CADSS point defense, provisional licence. Four uprated TECH BRACE autocannons in two sealed pods, each hung at its centre of mass on a trunnion yoke outboard of the shoulders, so the pods elevate from -5° to about 90° (guns straight up). Large ammunition cassettes, radiator wings, capped barrels.'],
  laser:['CIWS laser','Cutting-edge MilSpec point defense. One large beam director: fixed drum, rolling gimbal ring, and a nose whose off-axis aperture shows the steering mirror, covering nearly the whole upper hemisphere. Heat-limited instead of ammunition-limited.'],
  missile:['Missile / drone','20 blast-KKV cells plus two bays of miniature Titan-flyer drones, 12 KKV reloads aft (32 total). The fire-control director is a small gimballed sensor head (EO, IR, laser rangefinder) built like the laser CIWS, with a TECH BRACE-pattern autocannon firing from inside its drum.']
};
function applyVariant(){
  const on=document.getElementById('lay-turret').checked;
  for(const [v,ms] of Object.entries(variantMeshes))for(const m of ms)m.visible=on&&v===currentVariant;
  const [n,d]=VARIANT_INFO[currentVariant]; document.getElementById('varName').textContent=n; document.getElementById('varNote').textContent=d;
  for(const b of document.querySelectorAll('#variants button'))b.setAttribute('aria-pressed',b.dataset.variant===currentVariant);
  droneBtn.hidden=currentVariant!=='missile';
}
const stayMat=new THREE.MeshStandardMaterial({side:THREE.DoubleSide,color:new THREE.Color().setRGB(.43,.47,.45,THREE.SRGBColorSpace),roughness:.35,metalness:.6,flatShading:true});
const stays=[];

async function load(){
  statusEl.textContent='Unpacking model…';
  await new Promise(r=>setTimeout(r,0));
  const response=await fetch('models/chomp/chomp.bin');
  if(!response.ok)throw new Error(`Model download failed (${response.status})`);
  const buf=new Uint8Array(await response.arrayBuffer());
  const dv=new DataView(buf.buffer); const hlen=dv.getUint32(0,true);
  const header=JSON.parse(new TextDecoder().decode(buf.subarray(4,4+hlen))); const base=4+hlen;
  names=header.names; rampInfo=header.ramp;
  const tex=await new THREE.TextureLoader().loadAsync('models/chomp/chomp_camo.webp');
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.colorSpace=THREE.SRGBColorSpace; tex.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy()); shared.uCamo.value=tex;
  const mats={};
  for(const [name,m] of Object.entries(header.materials)){
    const col=new THREE.Color().setRGB(...m.kd,THREE.SRGBColorSpace);
    const glassy=['glass','lens'].includes(name), metal=['steel','piston','nozzle'].includes(name);
    const mat=new THREE.MeshStandardMaterial({side:THREE.DoubleSide,color:m.tex?0xffffff:col,flatShading:true,roughness:glassy?.15:(metal?.45:.82),metalness:metal?.55:(glassy?.2:.08)});
    if(m.emit){mat.emissive=col;mat.emissiveIntensity=1.2;}
    mats[name]=patch(mat,m.tex);
  }
  buildRig(header.rig);
  const hp=rampInfo.hinge_point; pivot.position.set(hp[0],hp[1],hp[2]);
  const ta=header.turret_axis; turretPivot.position.set(ta[0],ta[1],0);
  for(const c of header.chunks){
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(buf.buffer,base+c.pos,c.nv*3),3));
    g.setAttribute('partId',new THREE.BufferAttribute(new Uint16Array(buf.buffer,base+c.part,c.nv),1));
    g.setIndex(new THREE.BufferAttribute(c.i16?new Uint16Array(buf.buffer,base+c.idx,c.ni):new Uint32Array(buf.buffer,base+c.idx,c.ni),1));
    g.computeBoundingSphere();
    const mesh=new THREE.Mesh(g,mats[c.mat]);
    if(c.variant){
      const g=c.tgroup?turretGroup(c.variant,c.tgroup,header.turret_groups[c.variant],ta):null;
      if(g){mesh.position.copy(g.userData.pivot).negate();g.add(mesh);} else {mesh.position.set(-ta[0],-ta[1],0); turretPivot.add(mesh);}
      (variantMeshes[c.variant]??=[]).push(mesh);}
    else if(c.anim){mesh.position.set(-hp[0],-hp[1],-hp[2]); pivot.add(mesh);}
    else if(c.rig){const [lg,sg]=c.rig.split(':');const g=rig.legs[lg].groups[sg];mesh.position.copy(rig.legs[lg].origin[sg]).negate();g.add(mesh);if(sg==='foot')rig.legs[lg].feet.push(mesh);}
    else world.add(mesh);
    if(!c.variant)layers[c.layer].push(mesh); pickables.push(mesh);
  }
  for(const s of rampInfo.stays_closed){
    const m=new THREE.Mesh(new THREE.CylinderGeometry(.032,.032,1,8),stayMat); m.visible=false;
    m.userData={p0:new THREE.Vector3(...s[0]),p1:new THREE.Vector3(...s[1])}; world.add(m); stays.push(m); layers.ramp.push(m);
  }
  const ga=rampInfo.ground_angle_deg; rampSlider.max=ga.toFixed(1); document.getElementById('gAngle').textContent=ga.toFixed(1);
  world.updateMatrixWorld(true);
  const box=new THREE.Box3();for(const m of layers.legs)box.expandByObject(m);document.getElementById('span').textContent=(box.max.y-box.min.y).toFixed(2)+' m';
  world.updateMatrixWorld(true);
  {const fb=new THREE.Box3();for(const L of Object.values(rig.legs))for(const m of L.feet)fb.expandByObject(m);rig.footMin=fb.min.z;}
  buildPlumes();buildSplashes();
  applyPose();
  applyVariant();
  statusEl.hidden=true;
  requestRender();
}

/* leg rig: fixed -> femur (ball, 2 DOF) -> shin (knee) -> foot (passive gimbal) */
const rig={legs:{},footMin:0,limit:3,roll:30};
const V3=a=>new THREE.Vector3(...a);
function buildRig(R){
  rig.limit=R.ankle_limit;rig.roll=R.ankle_roll??rig.limit;
  for(const L of R.legs){
    const ball=V3(L.ball),knee=V3(L.knee),ankle=V3(L.ankle);
    const femur=new THREE.Group(),shin=new THREE.Group(),foot=new THREE.Group();
    femur.position.copy(ball); world.add(femur);
    shin.position.copy(knee).sub(ball); femur.add(shin);
    foot.position.copy(ankle).sub(knee); shin.add(foot);
    rig.legs[L.leg]={L,groups:{femur,shin,foot},origin:{femur:ball,shin:knee,foot:ankle},feet:[],ankle,
      axis:V3(L.knee_axis).normalize(),pose:{stride:0,lift:0,knee:0}};
  }
}
const qY=new THREE.Quaternion(),qX=new THREE.Quaternion(),qK=new THREE.Quaternion(),qS=new THREE.Quaternion(),qF=new THREE.Quaternion(),qI=new THREE.Quaternion();
const AY=new THREE.Vector3(0,1,0),AX=new THREE.Vector3(1,0,0),aw=new THREE.Vector3();
function poseLeg(leg){
  const {L,groups,axis,pose}=leg; const d=THREE.MathUtils.degToRad;
  qY.setFromAxisAngle(AY,d(pose.stride*L.sign_stride)); qX.setFromAxisAngle(AX,d(pose.lift*L.sign_lift));
  groups.femur.quaternion.copy(qY).multiply(qX);
  qK.setFromAxisAngle(axis,d(pose.knee*L.sign_knee)); groups.shin.quaternion.copy(qK);
  qS.copy(groups.femur.quaternion).multiply(qK);           // shin world rotation
  ankleGimbal(leg,qS,groups.foot.quaternion);                // foot relative to shin
}
// Passive ankle: the block rolls on the through-pin (knee-parallel, fixed in
// the shin, +/-30 deg) and pitches on the cross pin (horizontal, carried by
// the block, +/-3 deg). Solve the pin angles that keep the sole level, clamp
// each to its travel; any excess tips the foot with the shin.
const gU=new THREE.Vector3(),gV=new THREE.Vector3(),gT=new THREE.Vector3(),gW=new THREE.Vector3(),gQ=new THREE.Quaternion(),gQ2=new THREE.Quaternion(),gZ=new THREE.Vector3(0,0,1);
function ankleGimbal(leg,qS,out){
  if(!leg.pa){leg.pa=leg.axis.clone().normalize();leg.ca=new THREE.Vector3().crossVectors(gZ,leg.pa).normalize();leg.cz=new THREE.Vector3().crossVectors(leg.ca,gZ);}
  const {pa,ca,cz}=leg,r=Math.PI/180;
  gU.copy(gZ).applyQuaternion(gQ.copy(qS).invert());        // world up in the shin frame
  const A=pa.z,B=pa.dot(cz),h=Math.hypot(A,B),base=Math.atan2(B,A),d=Math.acos(Math.max(-1,Math.min(1,pa.dot(gU)/h)));
  const wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));
  let phi=wrap(base+d),p2=wrap(base-d);if(Math.abs(p2)<Math.abs(phi))phi=p2;
  gV.copy(gZ).multiplyScalar(Math.cos(phi)).addScaledVector(cz,Math.sin(phi));
  gV.addScaledVector(pa,-pa.dot(gV));gT.copy(gU).addScaledVector(pa,-pa.dot(gU));
  const th=Math.atan2(pa.dot(gW.crossVectors(gV,gT)),gV.dot(gT));
  const cl=(x,l)=>Math.max(-l*r,Math.min(l*r,x));
  out.setFromAxisAngle(pa,cl(th,rig.roll)).multiply(gQ2.setFromAxisAngle(ca,cl(phi,rig.limit)));
}
function settle(){
  world.position.set(0,0,0); world.quaternion.identity(); world.updateMatrixWorld(true);
  let lo=Infinity;
  for(const [k,leg] of Object.entries(rig.legs)){
    if(stanceLegs&&stanceLegs.size&&!stanceLegs.has(k))continue;
    leg.groups.foot.getWorldPosition(aw); lo=Math.min(lo,aw.z-(leg.ankle.z-rig.footMin));}
  if(stanceLegs&&!stanceLegs.size)lo=settle.lastLo??lo; else settle.lastLo=lo;
  world.position.z=-(lo-rig.footMin)+jumpZ+gaitZ;
  if(hullPitch){ // nose-down positive, about the hull's centre of mass
    world.quaternion.setFromAxisAngle(AY,-hullPitch*Math.PI/180);
    pcTmp.copy(PITCH_C).applyQuaternion(world.quaternion);world.position.add(PITCH_C).sub(pcTmp);
  }
  const bz=(1.07+world.position.z).toFixed(2)+' m';if(bellyEl.textContent!==bz)bellyEl.textContent=bz;
}
const bellyEl=document.getElementById('bellyEl');
let hullPitch=0;const PITCH_C=new THREE.Vector3(0,0,2.6),pcTmp=new THREE.Vector3();
const ALL=['L1','L2','L3','R1','R2','R3'];
const PRESETS={
  stand:()=>({}),
  crouch:()=>Object.fromEntries(ALL.map(k=>[k,{lift:0,knee:30}])),
  tall:()=>Object.fromEntries(ALL.map(k=>[k,{lift:16,knee:16}])),
  stride:()=>({L1:{stride:-14,knee:22},R2:{stride:-14,knee:22},L3:{stride:-14,knee:22},R1:{stride:12,knee:4},L2:{stride:12,knee:4},R3:{stride:12,knee:4}}),
  reach:()=>({L1:{stride:-15,knee:45},R1:{stride:-15,knee:45}})
};
let walking=false,powered=true;
const speedEl=document.getElementById('gaitSpeed');
document.getElementById('slowMo').addEventListener('change',ev=>{gaitScale=ev.target.checked?.25:1;});
function applyPose(){for(const leg of Object.values(rig.legs))poseLeg(leg);settle();}
function setPreset(name){
  for(const b of document.querySelectorAll('#poses button'))b.setAttribute('aria-pressed',b.dataset.pose===name);
  if(GAITS[name]){
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){setPreset('stride');return;}
    gait=GAITS[name];walking=true;gaitClock=0;lastGaitT=null;powered=true;powerBtn.textContent='Cut power';return;
  }
  walking=false; stanceLegs=null; gaitZ=0; const P=PRESETS[name]();
  for(const [k,leg] of Object.entries(rig.legs))leg.pose=Object.assign({stride:0,lift:0,knee:0},P[k]||{});
  applyPose(); syncSliders();
}
// Tripod gaits. Stance legs sit mid-range (lift 16, knee 16: shin level,
// body raised) so a swing lifts the foot straight up by folding both joints.
// Stance feet move aft at the body's speed so they stay planted, and the
// ground scrolls under the machine. Duty factor below 0.5 (jog) leaves a
// flight phase between tripods, with the body bobbing through it.
//
// Sprint is a bound. A planted foot can only travel as fast as the leg sweeps,
// so speed = sweep / stance time; the sweep (2 x 1.6 m x sin 21 deg = 1.15 m)
// is fixed by the leg, so the bound shortens stance to ~52 ms (about 800 deg/s
// at the ball) and spends the rest of the cycle ballistic. The two tripods land
// back to back, then the hull flies under real gravity (Titan) for ~0.8 s.
// Canon top speed: 21.9 m/s. Peak leg load on Titan ~0.6 MN, on Earth ~4.4 MN,
// both inside the canon 10 g0 leg rating (5.08 MN).
const GAITS={
  walk:  {T:3.2,A:10,duty:.50,lift:1.0,bob:0},
  jog:   {T:1.2,A:15,duty:.40,lift:1.0,bob:.08},
  sprint:{T:.9, A:21,v:21.9,lift:1.0,bound:true}
};
let gait=GAITS.walk,stanceLegs=null,gaitZ=0,groundX=0,gaitClock=0,gaitScale=1;
const HLEG=1.6,GAIT_G=1.352;
function moveGround(dx){
  groundX+=dx;grid.position.x=((groundX%1)+1)%1;placeScatter(groundX);
  for(let k=0;k<DUSTN;k++)dustPos[3*k]+=dx;
}
let lastGaitT=null;
function gaitSpeed(g){const D=HLEG*Math.sin(g.A*Math.PI/180);return g.v??2*D/(g.duty*g.T);}
function walkPose(t){
  const {T,A,lift:lf,bound}=gait,D=HLEG*Math.sin(A*Math.PI/180),v=gaitSpeed(gait);
  const duty=bound?2*D/(v*T):gait.duty;          // bound: stance time = sweep / speed
  const offB=bound?duty:.5;                       // bound: second tripod lands as the first lifts
  stanceLegs=new Set();
  for(const [k,leg] of Object.entries(rig.legs)){
    const p=((t/T)+(['L1','R2','L3'].includes(k)?0:1-offB))%1;
    let fx,lift=16,knee=16;
    if(p<duty){const u=p/duty;fx=-D+2*D*u;stanceLegs.add(k);}
    else{const u=(p-duty)/(1-duty);fx=D-2*D*(u-Math.sin(2*Math.PI*u)/(2*Math.PI));const b=Math.sin(Math.PI*u)*lf;lift=16-15*b;knee=16-9*b;}
    leg.pose={stride:Math.asin(fx/HLEG)*180/Math.PI,lift,knee};
  }
  if(bound){
    const tc=2*duty*T,tf=T-tc,u=(t%T)-tc;        // contact window, then ballistic flight
    gaitZ=u>0?GAIT_G/2*u*(tf-u):0;
  }else{
    const ph=(t/T)%.5;
    gaitZ=gait.bob*(.5-.5*Math.cos(4*Math.PI*(ph-duty/2)));
  }
  applyPose();groundSpeed=v;
  if(lastGaitT!==null)moveGround(v*(t-lastGaitT));
  lastGaitT=t;
  speedEl.textContent=(v*3.6).toFixed(0)+' km/h ('+v.toFixed(1)+' m/s)'+(gaitScale<1?' · slow motion':'');
}
const jS=document.getElementById('jStride'),jL=document.getElementById('jLift'),jK=document.getElementById('jKnee'),legSel=document.getElementById('legSel');
const powerBtn=document.getElementById('powerBtn');
function syncSliders(){
  const leg=rig.legs[legSel.value==='all'?'L2':legSel.value]; if(!leg)return;
  jS.value=leg.pose.stride;jL.value=leg.pose.lift;jK.value=leg.pose.knee;
  document.getElementById('vStride').textContent=(+leg.pose.stride).toFixed(1)+'°';
  document.getElementById('vLift').textContent=(+leg.pose.lift).toFixed(1)+'°';
  document.getElementById('vKnee').textContent=(+leg.pose.knee).toFixed(1)+'°';
}
function fromSliders(){
  if(!powered)return;
  walking=false; for(const b of document.querySelectorAll('#poses button'))b.setAttribute('aria-pressed','false');
  const keys=legSel.value==='all'?ALL:[legSel.value];
  for(const k of keys)rig.legs[k].pose={stride:+jS.value,lift:+jL.value,knee:+jK.value};
  applyPose(); syncSliders();
}
for(const el of [jS,jL,jK])el.addEventListener('input',fromSliders);
legSel.addEventListener('change',syncSliders);
document.getElementById('poses').addEventListener('click',e=>{const b=e.target.closest('button[data-pose]'); if(b&&powered)setPreset(b.dataset.pose);});
powerBtn.addEventListener('click',()=>{
  powered=!powered; walking=false;
  powerBtn.textContent=powered?'Cut power':'Restore power';
  powerBtn.setAttribute('aria-pressed',!powered);
  document.getElementById('legNote').textContent=powered?'Ball joint: stride ±21°, lift 0–16°. Knee: 0–45°, side-by-side on one pin. Ankle: passive gimbal, ±3°; the jointed talons take the rest. Muscles are internal fibre bundles; each joint has a spring-applied brake that locks it if power or a muscle is lost.':'Power cut: every brake has set. The legs are locked at the angles they held and still carry the hull. Restore power to move them again.';
  for(const el of [jS,jL,jK,legSel])el.disabled=!powered;
  syncSliders();
});

/* crew ramp */
const rampSlider=document.getElementById('ramp'), rampVal=document.getElementById('rampVal'), rampBtn=document.getElementById('rampBtn');
const up=new THREE.Vector3(0,1,0), tmp=new THREE.Vector3();
function setRamp(deg){
  const th=THREE.MathUtils.degToRad(deg); pivot.rotation.set(0,th,0);
  rampSlider.value=deg; rampVal.textContent=(+deg).toFixed(1)+'°';
  rampBtn.textContent=deg>0.5?'Close ramp':'Open ramp';
  if(!rampInfo)return;
  const h=pivot.position;
  for(const s of stays){
    const p1=tmp.copy(s.userData.p1).sub(h).applyAxisAngle(up,th).add(h);
    const d=new THREE.Vector3().subVectors(p1,s.userData.p0); const len=d.length();
    s.position.copy(s.userData.p0).addScaledVector(d,.5); s.scale.set(1,len,1);
    s.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());
    s.visible=deg>1&&document.getElementById('lay-ramp').checked;
  }
}
let rampAnim=null;
rampSlider.addEventListener('input',()=>{rampAnim=null;setRamp(+rampSlider.value);});
rampBtn.addEventListener('click',()=>{
  const from=+rampSlider.value, to=from>0.5?0:+rampSlider.max;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce){setRamp(to);return;}
  rampAnim={from,to,t0:performance.now(),dur:1600};
});

/* views */
const VIEWS={
  three:[[-11.5,-17,6.8],[0,0,2.4]], front:[[-19,0,3.6],[0,0,2.6]], side:[[0,-21,3.4],[0,0,2.6]],
  rear:[[18,-3,5],[0,0,2.6]], top:[[0,-0.6,26],[0,0,2.4]], under:[[-4,-10,-3.2],[-0.5,0,1.4]],
  ramp:[[-11.5,-9.5,1.1],[-3.3,0,1.1]], turret:[[-6.8,-7.2,7.4],[-0.9,0,4.8]], leg:[[-1.6,-6.6,1.0],[-0.2,-2.1,1.8]], legout:[[2.2,-10.8,2.9],[0.2,-3.0,1.7]]
};
let camAnim=null;
function goView(k,instant){
  const [e,t]=VIEWS[k]; const to={e:new THREE.Vector3(...e),t:new THREE.Vector3(...t)};
  for(const b of document.querySelectorAll('#views [data-view]'))b.setAttribute('aria-pressed',String(b.dataset.view===k));
  if(typeof jumpCamOff==='number'&&jumpCamOff){to.e.z+=jumpCamOff;to.t.z+=jumpCamOff;}
  if(instant||matchMedia('(prefers-reduced-motion: reduce)').matches){camera.position.copy(to.e);controls.target.copy(to.t);requestRender();return;}
  camAnim={fe:camera.position.clone(),ft:controls.target.clone(),...to,t0:performance.now(),dur:900};
  requestRender();
}
document.getElementById('views').addEventListener('click',e=>{const b=e.target.closest('button[data-view]'); if(b)goView(b.dataset.view);});
document.getElementById('resetView').addEventListener('click',()=>goView('three'));
for(const b of document.querySelectorAll('[data-scene-action]'))b.addEventListener('click',()=>{
  const offset=camera.position.clone().sub(controls.target);
  offset.multiplyScalar(b.dataset.sceneAction==='in'?.8:1.25);
  offset.clampLength(controls.minDistance,controls.maxDistance);
  camera.position.copy(controls.target).add(offset);controls.update();requestRender();
});
const spin=document.getElementById('spin');
spin.addEventListener('click',()=>{const on=spin.getAttribute('aria-pressed')!=='true';spin.setAttribute('aria-pressed',on);controls.autoRotate=on;controls.autoRotateSpeed=.8;requestRender();});

/* turret */
document.getElementById('variants').addEventListener('click',e=>{const b=e.target.closest('button[data-variant]'); if(!b)return; currentVariant=b.dataset.variant; shared.uSel.value=-1; document.getElementById('pick').hidden=true; applyVariant();});
const trav=document.getElementById('traverse');
trav.addEventListener('input',()=>{if(tAnim)stopTurretAnim();poseTrav=null;turretPivot.rotation.z=THREE.MathUtils.degToRad(+trav.value);document.getElementById('travVal').textContent=trav.value+'°';});

/* turret animation groups: elevating heads and guns, slewing sensor domes, drones */
const TG={};            // variant -> gid -> Group
function turretGroup(v,gid,defs,ta){
  TG[v]??={};
  if(TG[v][gid])return TG[v][gid];
  const d=defs[gid]; const P=new THREE.Vector3(...d.pivot);
  const parent=d.parent?turretGroup(v,d.parent,defs,ta):null;
  const origin=parent?parent.userData.pivot:new THREE.Vector3(ta[0],ta[1],0);
  const g=new THREE.Group(); g.position.copy(P).sub(origin);
  g.userData={pivot:P,base:g.position.clone(),def:d,axis:new THREE.Vector3(...d.axis).normalize()};
  (parent||turretPivot).add(g); TG[v][gid]=g; return g;
}
const tAnimBtn=document.getElementById('turretAnim'), droneBtn=document.getElementById('droneBtn');
let tAnim=false,tAnimT0=0,droneT0=null,turretSettling=false;
function setGroupAngle(g,deg){const d=g.userData.def;g.quaternion.setFromAxisAngle(g.userData.axis,THREE.MathUtils.degToRad(deg-d.rest));g.userData.pa=deg;g.userData.fresh=true;}
function stopTurretAnim(){
  tAnim=false;tAnimBtn.setAttribute('aria-pressed','false');
  for(const v of Object.values(TG))for(const g of Object.values(v))if(g.userData.def.kind==='rot'){g.quaternion.identity();g.userData.stab=0;g.userData.pa=g.userData.def.rest;}
}
// Action pose: weapons and optics slew to a firing posture, the laser shutter
// and the drone bay flap open, and the turret traverses; toggling eases back.
const poseBtn=document.getElementById('poseBtn');let poseOn=false,poseTrav=null;
const POSE_ANG={laser_azimuth:-35,laser_elevation:-58,head_elevation:18,optic_pan:-30,optic_tilt:10,
  pod_elevation_L:35,pod_elevation_R:60,gun_elevation:11,launcher_elevation:26,fcs_azimuth:-40,
  fcs_gun_elevation:12,fcs_sensor_elevation:-55,panorama_azimuth:55,panorama_azimuth_2:-50};
function poseAngle(gid,d){
  if(gid in POSE_ANG)return Math.max(d.range[0],Math.min(d.range[1],POSE_ANG[gid]));
  if(gid.startsWith('panorama_elevation'))return .6*(d.range[0]===0?d.range[1]:d.range[0]);
  return d.rest;
}
poseBtn.addEventListener('click',()=>{
  if(tAnim)stopTurretAnim();
  poseOn=!poseOn;poseBtn.setAttribute('aria-pressed',String(poseOn));poseTrav=poseOn?28:0;
});
tAnimBtn.addEventListener('click',()=>{
  if(poseOn){poseOn=false;poseBtn.setAttribute('aria-pressed','false');poseTrav=null;}
  if(tAnim){stopTurretAnim();return;}
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  tAnim=true;tAnimT0=performance.now();tAnimBtn.setAttribute('aria-pressed','true');
});
droneBtn.addEventListener('click',()=>{droneT0=performance.now();});
// Elevation stabilisation: while the hull pitches (rocket hop), each outermost
// elevation axis (guns, launcher, sensor head, pods, laser ball, sights)
// counter-rotates by the hull pitch projected on its axis, holding its aim.
const sQ=new THREE.Quaternion(),sA=new THREE.Vector3();
function isLateral(g){const a=g.userData.axis;return g.userData.def&&g.userData.def.kind==='rot'&&Math.abs(a.y)>.9;}
function stabilise(){
  const gs=TG[currentVariant];if(!gs)return;
  for(const g of Object.values(gs)){
    if(!isLateral(g))continue;
    let a=g.parent,nested=false;while(a&&a!==turretPivot){if(a.userData&&a.userData.def&&isLateral(a)){nested=true;break;}a=a.parent;}
    if(nested)continue;
    if(!g.userData.fresh&&g.userData.stab)g.quaternion.multiply(sQ.setFromAxisAngle(g.userData.axis,-g.userData.stab));
    g.userData.fresh=false;
    g.userData.stab=0;
    if(!hullPitch)continue;
    g.parent.getWorldQuaternion(sQ);sA.copy(g.userData.axis).applyQuaternion(sQ);
    const d=hullPitch*Math.PI/180*sA.y;      // hull rotation vector is (0,-pitch,0)
    g.quaternion.multiply(sQ.setFromAxisAngle(g.userData.axis,d));g.userData.stab=d;
  }
}
function animTurret(now){
  turretSettling=false;
  const t=(now-tAnimT0)/1000;
  if(tAnim){
    const a=60*Math.sin(t*.35);turretPivot.rotation.z=THREE.MathUtils.degToRad(a);trav.value=Math.round(a);document.getElementById('travVal').textContent=Math.round(a)+'°';
    let k=0;
    for(const g of Object.values(TG[currentVariant]||{})){
      const d=g.userData.def; if(d.kind!=='rot')continue; k++;
      const [lo,hi]=d.range, span=Math.min(hi-lo,120), mid=Math.max(lo,Math.min(hi,(lo+hi)/2));
      setGroupAngle(g,mid+span/2*.8*Math.sin(t*(.5+.13*k)+k*1.7));
    }
  }
  // posed (or rest) angles, eased, whenever the sweep animation is off
  if(!tAnim){
    for(const [gid,g] of Object.entries(TG[currentVariant]||{})){
      const d=g.userData.def;if(d.kind!=='rot')continue;
      const tgt=poseOn?poseAngle(gid,d):d.rest,cur=g.userData.pa??d.rest;
      if(Math.abs(tgt-cur)>=.02)turretSettling=true;
      setGroupAngle(g,Math.abs(tgt-cur)<.02?tgt:cur+(tgt-cur)*.07);
    }
    if(poseTrav!==null){
      const cur=THREE.MathUtils.radToDeg(turretPivot.rotation.z),nxt=Math.abs(poseTrav-cur)<.05?poseTrav:cur+(poseTrav-cur)*.06;
      turretPivot.rotation.z=THREE.MathUtils.degToRad(nxt);trav.value=Math.round(nxt);document.getElementById('travVal').textContent=Math.round(nxt)+'°';
      if(nxt===poseTrav)poseTrav=null;
    }
  }
  // armoured shutters: slide open while the turret is working, close when it stops
  for(const v of Object.values(TG))for(const g of Object.values(v)){
    const d=g.userData.def;if(d.kind!=='flap')continue;
    const tgt=(tAnim||poseOn)?d.range[1]:d.range[0],cur=g.userData.pa??d.range[0];
    if(Math.abs(tgt-cur)>=.05)turretSettling=true;
    setGroupAngle(g,Math.abs(tgt-cur)<.05?tgt:cur+(tgt-cur)*.06);
  }
  // drone launch: flap swings up, the stowed drone slides out, then climbs
  // away; the flap closes behind it. At rest the flap is shut and the bay empty.
  const dr=TG.missile&&TG.missile.drone, door=TG.missile&&TG.missile.drone_door;
  if(dr&&door){
    const tt=droneT0===null?-1:(now-droneT0)/1000, fwd=dr.userData.axis;
    const dcur=door.userData.pa??0;let da=Math.abs((poseOn?95:0)-dcur)<.05?(poseOn?95:0):dcur+((poseOn?95:0)-dcur)*.07,out=0,vis=false;
    if(tt>=0){
      da=tt<.6?95*tt/.6:(tt<3.6?95:Math.max(0,95*(1-(tt-3.6)/.6)));
      if(tt>.55&&tt<3.4){vis=true;const u=tt-.55;out=u<.7?.9*u/.7:.9+2.6*Math.pow(u-.7,2);}
      if(tt>4.3){droneT0=null;da=poseOn?95:0;}
    }
    setGroupAngle(door,da);
    dr.visible=vis;dr.position.copy(dr.userData.base).addScaledVector(fwd,out);
    if(vis&&out>.9){dr.position.z+=.12*Math.pow(out-.9,1.4);}
  }
}

/* rocket jump: crouch, footpad burn, ballistic hop, braking burn, landing */
let jumpZ=0,jumpT0=null;
const plumeMat=new THREE.ShaderMaterial({
  uniforms:{uTime:{value:0}}, transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
  vertexShader:'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
  fragmentShader:`varying vec2 vUv; uniform float uTime;
    void main(){
      float height=vUv.y;
      float width=mix(0.45,0.09,height);
      float radius=abs(vUv.x-0.5)/width;
      float edge=1.0-smoothstep(0.5,1.0,radius);
      float ends=smoothstep(0.0,0.12,height)*(1.0-smoothstep(0.88,1.0,height));
      float wave=0.86+0.14*sin(height*32.0-uTime*24.0+vUv.x*19.0);
      float core=exp(-5.0*radius*radius);
      float alpha=edge*ends*wave*(0.55+0.35*height);
      vec3 col=mix(vec3(1.0,0.19,0.03),vec3(1.0,0.62,0.22),height);
      col=mix(col,vec3(1.0,0.96,0.78),core*(0.45+0.5*height));
      gl_FragColor=vec4(col,alpha);
    }`
});
const plumeGeo=new THREE.PlaneGeometry(1,1),plumeUp=new THREE.Vector3(0,0,1);
const nozzleTex=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,230,1)');g.addColorStop(.3,'rgba(255,224,150,.8)');g.addColorStop(1,'rgba(255,110,20,0)');x.fillStyle=g;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);})();
const nozzleMat=new THREE.SpriteMaterial({map:nozzleTex,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false});
const plumes=[],nozzleGlows=[];
function buildPlumes(){
  for(const leg of Object.values(rig.legs)){
    const plume=new THREE.Mesh(plumeGeo,plumeMat);
    plume.up.copy(plumeUp);plume.visible=false;plume.frustumCulled=false;
    plume.userData={leg,fr:leg.ankle.x<-1.5?-1:(leg.ankle.x>1.5?1:0)};
    scene.add(plume);plumes.push(plume);
    const glow=new THREE.Sprite(nozzleMat);glow.visible=false;scene.add(glow);nozzleGlows.push(glow);
  }
}
// dust: pooled points on the ground, kicked out radially from each foot
const DUSTN=360;
const dustGeo=new THREE.BufferGeometry();
const dustPos=new Float32Array(DUSTN*3),dustVel=new Float32Array(DUSTN*3),dustAge=new Float32Array(DUSTN).fill(99);
dustGeo.setAttribute('position',new THREE.BufferAttribute(dustPos,3));
const dustTex=(()=>{const c=document.createElement('canvas');c.width=c.height=32;const x=c.getContext('2d');const gr=x.createRadialGradient(16,16,0,16,16,16);gr.addColorStop(0,'rgba(190,178,150,.9)');gr.addColorStop(1,'rgba(190,178,150,0)');x.fillStyle=gr;x.fillRect(0,0,32,32);return new THREE.CanvasTexture(c);})();
const dustMat=new THREE.PointsMaterial({size:.9,map:dustTex,transparent:true,opacity:.55,depthWrite:false,color:0xc8bca0});
const dust=new THREE.Points(dustGeo,dustMat); dust.frustumCulled=false; dust.visible=false; scene.add(dust);
let dustNext=0,dustLiveUntil=0;
function kickDust(n,only){
  dust.visible=true;dustLiveUntil=performance.now()+3100;
  const L_=Object.values(rig.legs);
  for(const leg of (only===undefined?L_:[L_[only]])){
    leg.groups.foot.getWorldPosition(aw);
    for(let i=0;i<n;i++){
      const k=dustNext;dustNext=(dustNext+1)%DUSTN;const a=Math.random()*Math.PI*2,sp=2+Math.random()*4;
      dustPos[3*k]=aw.x+Math.cos(a)*.3;dustPos[3*k+1]=aw.y+Math.sin(a)*.3;dustPos[3*k+2]=.05;
      dustVel[3*k]=Math.cos(a)*sp;dustVel[3*k+1]=Math.sin(a)*sp;dustVel[3*k+2]=.4+Math.random()*1.2;dustAge[k]=0;
    }
  }
}
function stepDust(dt){
  for(let k=0;k<DUSTN;k++){
    if(dustAge[k]>3){dustPos[3*k+2]=-50;continue;}
    dustAge[k]+=dt;const damp=Math.exp(-1.6*dt);
    dustVel[3*k]*=damp;dustVel[3*k+1]*=damp;dustVel[3*k+2]=dustVel[3*k+2]*damp-.3*dt;
    dustPos[3*k]+=dustVel[3*k]*dt;dustPos[3*k+1]+=dustVel[3*k+1]*dt;dustPos[3*k+2]=Math.max(.02,dustPos[3*k+2]+dustVel[3*k+2]*dt);
  }
  dustMat.opacity=.5;dustGeo.attributes.position.needsUpdate=true;
}
const jumpBtn=document.getElementById('jumpBtn');
jumpBtn.addEventListener('click',()=>{
  if(!powered||jumpT0!==null)return;
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  walking=false;stanceLegs=null;gaitZ=0;for(const b of document.querySelectorAll('#poses button'))b.setAttribute('aria-pressed','false');
  jumpT0=performance.now();J=null;
});
const lerp=(a,b,u)=>a+(b-a)*Math.max(0,Math.min(1,u));
let jumpLastT=0;
const splashTex=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');const g=x.createRadialGradient(64,64,4,64,64,64);g.addColorStop(0,'rgba(255,245,220,1)');g.addColorStop(.35,'rgba(255,190,110,.75)');g.addColorStop(1,'rgba(255,150,60,0)');x.fillStyle=g;x.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);})();
const splashes=[];
function buildSplashes(){
  for(const leg of Object.values(rig.legs)){
    const m=new THREE.Mesh(new THREE.CircleGeometry(1,40),new THREE.MeshBasicMaterial({map:splashTex,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false}));
    m.visible=false;scene.add(m);splashes.push(m);
  }
}
// Rocket jump, integrated frame by frame under Titan gravity (1.352 m/s^2):
// crouch, 1.2 s boost from the footpad nozzles, ballistic coast to ~10 m,
// braking burn from 3 m down to a soft touchdown, then absorb and recover.
// The ground slides aft at 1.2 m/s while airborne; the camera rises with it.
const JG=1.352,JH=10,JTB=1.2,JZB=3,JVX=1.2,JP=6,JRX=.25;
const JV0=(()=>{const a=1/(2*JG),b=JTB/2;return(-b+Math.sqrt(b*b+4*a*JH))/(2*a);})();
let J=null,jumpCamOff=0;
function jumpStep(now,dt){
  if(jumpT0===null)return;
  if(!J)J={phase:'crouch',t:0,z:0,vz:0};
  J.t+=dt;
  let lift=0,knee=0,burn=false,az=0,rearOnly=false,bias=0;
  if(J.phase==='crouch'){knee=lerp(0,10,J.t/.6);if(J.t>=.6){J.phase='boost';J.t=0;kickDust(16);}}
  else if(J.phase==='boost'){az=JV0/JTB;burn=true;lift=lerp(0,8,J.t/.5);knee=lerp(10,0,J.t/.4);
    if(J.t>=JTB){J.phase='coast';J.t=0;
      // rear pair burns JRX longer: a small nose-down rate that carries through the coast
      const v=J.vz+az*dt,tc=(v+Math.sqrt(v*v+2*JG*Math.max(0,J.z-JZB)))/JG;J.w=JP/Math.max(.5,tc-JRX/2);}}
  else if(J.phase==='coast'){az=-JG;lift=8;knee=lerp(0,24,J.t/1.5);
    J.th=J.t<JRX?J.w*J.t*J.t/(2*JRX):J.w*(J.t-JRX/2);rearOnly=J.t<JRX;
    if(J.vz<0&&J.z<=JZB){J.phase='brake';J.t=0;J.th0=J.th;J.w0=J.w;J.TB=2*J.z/Math.max(.1,-J.vz);}}
  else if(J.phase==='brake'){az=J.z>.02?J.vz*J.vz/(2*J.z):0;burn=true;lift=lerp(8,10,J.t/.6);knee=lerp(24,4,J.t/.8);
    // front overburn: pitch back to level and zero rate exactly at touchdown (cubic Hermite)
    const T=J.TB,u=Math.min(1,J.t/T);J.th=(2*u**3-3*u*u+1)*J.th0+(u**3-2*u*u+u)*T*J.w0;
    const acc=(J.th0*(12*u-6)+T*J.w0*(6*u-4))/(T*T);bias=Math.max(-1,Math.min(1,-acc/12));
    if(J.z<=.01){J.phase='land';J.t=0;J.z=0;J.vz=0;J.th=0;kickDust(16);}}
  else if(J.phase==='land'){J.th=0;knee=10*Math.sin(Math.PI*Math.min(1,J.t/.9));if(J.t>=.9){J.phase='done';}}
  if(J.phase==='boost'||J.phase==='coast'||J.phase==='brake'){J.vz+=az*dt;J.z=Math.max(0,J.z+J.vz*dt);moveGround(JVX*dt);}
  hullPitch=J.th||0;
  jumpZ=J.z;
  for(const leg of Object.values(rig.legs))leg.pose={stride:0,lift,knee};
  applyPose(); world.updateMatrixWorld(true);
  const off=Math.max(0,jumpZ)*.85,dz=off-jumpCamOff;jumpCamOff=off;camera.position.z+=dz;controls.target.z+=dz;
  const L=1.4;plumeMat.uniforms.uTime.value=now/1000;
  plumes.forEach((p,i)=>{
    const fr=p.userData.fr;                 // -1 front pair, 0 middle, +1 rear pair
    const on=burn||(rearOnly&&fr>0);p.visible=on;const sp=splashes[i];
    const glow=nozzleGlows[i];glow.visible=on;
    if(!on){sp.visible=false;return;}
    const k=rearOnly?.7:1-.35*bias*fr;      // brake: front legs overburn to level the hull
    const leg=p.userData.leg;
    leg.groups.foot.localToWorld(aw.set(0,0,.09-leg.ankle.z));
    const h=Math.max(.02,aw.z);
    // the plume stops at the ground and spreads sideways along it
    const f=.93+.07*Math.sin(now*.021+i*2.4),boostLen=J.phase==='boost'?1.5:1.0,len=L*Math.min(boostLen,h/L)*k;
    p.position.copy(aw).addScaledVector(plumeUp,-len*.5);
    p.scale.set(1.05*f*k,len,1);p.lookAt(camera.position);
    glow.position.copy(aw).addScaledVector(plumeUp,-.03);glow.scale.set(.62*k,.62*k,1);
    const g=Math.max(0,1-h/(L*1.5));sp.visible=g>0;sp.position.set(aw.x,aw.y,.015);
    const r=.35+1.8*g;sp.scale.set(r,r,1);sp.material.opacity=.9*g;
    if(g>0)kickDust(Math.round(1+4*g),i);
  });
  if(J.phase==='done'){jumpT0=null;J=null;jumpZ=0;hullPitch=0;camera.position.z-=jumpCamOff;controls.target.z-=jumpCamOff;jumpCamOff=0;plumes.forEach(p=>p.visible=false);nozzleGlows.forEach(g=>g.visible=false);splashes.forEach(s=>s.visible=false);applyPose();}
}
/* layers */
document.getElementById('lay-turret').addEventListener('change',applyVariant);
for(const k of Object.keys(layers)){
  if(k==='turret')continue;
  document.getElementById('lay-'+k).addEventListener('change',ev=>{
    for(const m of layers[k])m.visible=ev.target.checked; if(k==='ramp')setRamp(+rampSlider.value);
  });
}
document.getElementById('lay-grid').addEventListener('change',ev=>{grid.visible=scatter.visible=ev.target.checked;});

/* picking */
const ray=new THREE.Raycaster(), ndc=new THREE.Vector2(); let downAt=null;
const pickEl=document.getElementById('pick'), partInfo=document.getElementById('partInfo');
function describe(n){
  const legs={L1:'left front',L2:'left middle',L3:'left rear',R1:'right front',R2:'right middle',R3:'right rear'};
  const m=n.match(/^([LR][123])_(.*)$/); const pretty=s=>s.replace(/_/g,' ').replace(/\b(-?\d+)$/,'').trim();
  return m?`${pretty(m[2])} · ${legs[m[1]]} leg`:pretty(n);
}
renderer.domElement.addEventListener('pointerdown',e=>{downAt=[e.clientX,e.clientY];});
renderer.domElement.addEventListener('pointerup',e=>{
  if(!downAt||Math.hypot(e.clientX-downAt[0],e.clientY-downAt[1])>5)return;
  const r=renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);
  ray.setFromCamera(ndc,camera);
  const hit=ray.intersectObjects(pickables.filter(m=>m.visible),false)[0];
  if(!hit){shared.uSel.value=-1;pickEl.hidden=true;partInfo.textContent='Nothing under the pointer. Click a part of the model.';return;}
  const pid=hit.object.geometry.attributes.partId.getX(hit.face.a); const n=names[pid];
  shared.uSel.value=pid; pickEl.hidden=false; pickEl.textContent=n;
  const p=hit.point; partInfo.innerHTML='';
  const a=document.createElement('strong'); a.textContent=describe(n);
  const b=document.createElement('div'); b.style.cssText='font:500 12.5px var(--mono);margin-top:4px;overflow-wrap:anywhere'; b.textContent=n;
  const c=document.createElement('div'); c.style.cssText='font:12.5px var(--mono);color:var(--muted);margin-top:2px';
  c.textContent=`hit at x ${p.x.toFixed(2)}  y ${p.y.toFixed(2)}  z ${p.z.toFixed(2)} m`;
  partInfo.append(a,b,c);
  requestRender();
});

/* The stage is dark in each shared display mode; mode changes still repaint
 * the scene so its controls and backdrop update together. */
window.addEventListener('acidburn-mode-change',requestRender);

function resize(){const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(16))*Math.max(1,1.35/camera.aspect)));camera.updateProjectionMatrix();requestRender();}
new ResizeObserver(resize).observe(stage);
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
let frame=0,lastPaint=0,lastTick=0,renderCount=0;
function requestRender(){if(!frame&&!document.hidden)frame=requestAnimationFrame(tick);}
function tick(now){
  frame=0;
  const active=walking||jumpT0!==null||camAnim!==null||rampAnim!==null||tAnim||poseTrav!==null||droneT0!==null||turretSettling||controls.autoRotate||dust.visible;
  if(active&&now-lastPaint<33){requestRender();return;}
  if(camAnim){const k=Math.min(1,(now-camAnim.t0)/camAnim.dur),s=ease(k);
    camera.position.lerpVectors(camAnim.fe,camAnim.e,s);controls.target.lerpVectors(camAnim.ft,camAnim.t,s);if(k>=1)camAnim=null;}
  // Advance from wall time even when a slow GPU misses frames. The cap limits
  // large tab-resume jumps without making the rocket sequence run in slow motion.
  const dtS=Math.min(.25,(now-(lastTick||now))/1000);lastTick=now;
  if(walking&&powered&&jumpT0===null){gaitClock+=dtS*gaitScale;walkPose(gaitClock);} else {lastGaitT=null;speedEl.textContent='';groundSpeed=0;}
  gridFade();
  jumpStep(now,dtS);
  if(dust.visible){if(now<dustLiveUntil)stepDust(walking?dtS*gaitScale:dtS);else dust.visible=false;}
  animTurret(now);stabilise();
  if(rampAnim){const k=Math.min(1,(now-rampAnim.t0)/rampAnim.dur);setRamp(rampAnim.from+(rampAnim.to-rampAnim.from)*ease(k));if(k>=1)rampAnim=null;}
  const moved=controls.update();renderer.render(scene,camera);lastPaint=now;renderCount++;
  if(moved||walking||jumpT0!==null||camAnim||rampAnim||tAnim||poseTrav!==null||droneT0!==null||turretSettling||controls.autoRotate||dust.visible)requestRender();
}
controls.addEventListener('change',requestRender);
stage.addEventListener('click',requestRender);
stage.addEventListener('input',requestRender);
stage.addEventListener('change',requestRender);
document.addEventListener('visibilitychange',()=>{lastTick=0;if(!document.hidden)requestRender();});
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();if(frame)cancelAnimationFrame(frame);frame=0;statusEl.hidden=false;statusEl.textContent='The 3D context was lost. Reload the page to restore CHOMP.';});
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)');
function syncMotion(){spin.disabled=tAnimBtn.disabled=jumpBtn.disabled=reduceMotion.matches;if(reduceMotion.matches){controls.autoRotate=false;spin.setAttribute('aria-pressed','false');if(tAnim)stopTurretAnim();}}
reduceMotion.addEventListener('change',syncMotion);syncMotion();
window.__vehicleViewer={get renderCount(){return renderCount;},get drawCalls(){return renderer.info.render.calls;},get currentVariant(){return currentVariant;},get loaded(){return statusEl.hidden;},get rocketPhase(){return J&&J.phase;},get visiblePlumes(){return plumes.filter(p=>p.visible).length;},renderer,scene,camera,controls};
goView('three',true);resize();
load().catch(err=>{statusEl.hidden=false;statusEl.textContent=err.message+' Reload the page to try again.';console.error(err);});
})();
