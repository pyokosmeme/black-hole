/* Shared renderer; original OBJ parser, matrices and ship shaders retained. */
window.ShipRenderer=(function(){
function parseOBJ(text, MAT){
  var verts=[], objs=new Map(), cur='default'; objs.set(cur,[]);
  var lines=text.split(/\r?\n/);
  for(var li=0;li<lines.length;li++){
    var L=lines[li]; if(!L||L.charCodeAt(0)===35) continue;
    var p=L.split(/\s+/);
    if(p[0]==='v'){ verts.push([+p[1],+p[2],+p[3]]); }
    else if(p[0]==='o'||p[0]==='g'){ cur=p.slice(1).join('_')||'unnamed'; if(!objs.has(cur))objs.set(cur,[]); }
    else if(p[0]==='f'){
      var idx=[];
      for(var i=1;i<p.length;i++){ var n=parseInt(p[i].split('/')[0],10); idx.push(n<0?verts.length+n:n-1); }
      var out=objs.get(cur);
      for(var k=1;k<idx.length-1;k++) out.push(idx[0],idx[k],idx[k+1]);
    }
  }
  var meshes=[];
  objs.forEach(function(ind,name){
    if(!ind.length) return;
    var pos=new Float32Array(ind.length*3), nor=new Float32Array(ind.length*3);
    var lp=new Float32Array((ind.length/3)*18), ln=new Float32Array((ind.length/3)*18), lc=0;
    for(var i=0;i<ind.length;i+=3){
      var a=verts[ind[i]],b=verts[ind[i+1]],c=verts[ind[i+2]];
      var abx=b[0]-a[0],aby=b[1]-a[1],abz=b[2]-a[2];
      var acx=c[0]-a[0],acy=c[1]-a[1],acz=c[2]-a[2];
      var nx=aby*acz-abz*acy, ny=abz*acx-abx*acz, nz=abx*acy-aby*acx;
      var nl=Math.hypot(nx,ny,nz)||1; nx/=nl;ny/=nl;nz/=nl;
      var t=[a,b,c];
      for(var k=0;k<3;k++){ var j=(i+k)*3;
        pos[j]=t[k][0];pos[j+1]=t[k][1];pos[j+2]=t[k][2];
        nor[j]=nx;nor[j+1]=ny;nor[j+2]=nz; }
      var eo=[0,1,1,2,2,0];
      for(var e=0;e<6;e++){ var v=t[eo[e]];
        lp[lc]=v[0];ln[lc++]=nx; lp[lc]=v[1];ln[lc++]=ny; lp[lc]=v[2];ln[lc++]=nz; }
    }
    meshes.push({name:name,positions:pos,normals:nor,count:ind.length,
                 linePositions:lp,lineNormals:ln,lineCount:lp.length/3,
                 material:MAT[name]||{color:[.55,.55,.53],type:5}});
  });
  return meshes;
}


function mul(a,b){ var o=new Float32Array(16);
  for(var i=0;i<4;i++)for(var j=0;j<4;j++){ var s=0;
    for(var k=0;k<4;k++) s+=a[k*4+j]*b[i*4+k]; o[i*4+j]=s; } return o; }
function persp(f,ar,n,fa){ var t=1/Math.tan(f/2), o=new Float32Array(16);
  o[0]=t/ar;o[5]=t;o[10]=(fa+n)/(n-fa);o[11]=-1;o[14]=2*fa*n/(n-fa); return o; }
function lookAt(e,c,u){
  var z=[e[0]-c[0],e[1]-c[1],e[2]-c[2]]; var zl=Math.hypot(z[0],z[1],z[2])||1; z=[z[0]/zl,z[1]/zl,z[2]/zl];
  var x=[u[1]*z[2]-u[2]*z[1],u[2]*z[0]-u[0]*z[2],u[0]*z[1]-u[1]*z[0]];
  var xl=Math.hypot(x[0],x[1],x[2])||1; x=[x[0]/xl,x[1]/xl,x[2]/xl];
  var y=[z[1]*x[2]-z[2]*x[1],z[2]*x[0]-z[0]*x[2],z[0]*x[1]-z[1]*x[0]];
  return new Float32Array([x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0,
    -(x[0]*e[0]+x[1]*e[1]+x[2]*e[2]), -(y[0]*e[0]+y[1]*e[1]+y[2]*e[2]), -(z[0]*e[0]+z[1]*e[1]+z[2]*e[2]),1]);
}
function rotX(a){ var c=Math.cos(a),s=Math.sin(a);
  return new Float32Array([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]); }
var IDENT=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);


var VS = [
'attribute vec3 aPosition; attribute vec3 aNormal;',
'uniform mat4 uMVP; uniform mat4 uModel;',
'varying vec3 vObj; varying vec3 vN;',
'void main(){ vObj=aPosition; vN=mat3(uModel)*aNormal;',
'  gl_Position=uMVP*vec4(aPosition,1.0); }'].join('\n');
function ortho(halfWidth,halfHeight) {
  return new Float32Array([1/halfWidth,0,0,0,0,1/halfHeight,0,0,0,0,-2/2000,0,0,0,-1,1]);
}
function translate(x,y,z) { const m=new Float32Array(IDENT);m[12]=x;m[13]=y;m[14]=z;return m; }
function transform(p,m) { return [m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]]; }
function create(canvas) {
  const gl=canvas.getContext('webgl',{alpha:true,antialias:true});
  if(!gl)throw new Error('3D is unavailable. Open Specifications for ship and comparison data.');
  const cache=new Map();
  let vp=IDENT,compare=false,comparisonHeight=160,eyeWorld=null,cw=1,ch=1,pick=null;
  function shader(type,source) { const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const error=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error(error);}return s; }
  async function load(id) {
    if(cache.has(id))return cache.get(id);
    const promise=(async()=>{
      const cfg=ShipCatalog[id],response=await fetch('maps/ships/'+id+'.obj');
      if(!response.ok)throw new Error('Could not load '+cfg.name+'. Please try again.');
      const meshes=parseOBJ(await response.text(),cfg.materials);
      const p=gl.createProgram(),vs=shader(gl.VERTEX_SHADER,VS),fs=shader(gl.FRAGMENT_SHADER,cfg.fragment);
      gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);gl.deleteShader(vs);gl.deleteShader(fs);
      if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error('Could not initialize the ship material.');
      const uniforms=Object.fromEntries(['uMVP','uModel','uBase','uType','uExp','uWire','uGlowPass'].map(n=>[n,gl.getUniformLocation(p,n)]));
      meshes.forEach(m=>{m.buffers={};for(const [key,data] of Object.entries({positions:m.positions,normals:m.normals,linePositions:m.linePositions,lineNormals:m.lineNormals})){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);m.buffers[key]=b;}
        const stride=Math.max(1,Math.floor(m.count/120)),pts=[];
        for(let vi=0;vi<m.count;vi+=stride){
          const nx=m.normals[vi*3],ny=m.normals[vi*3+1],nz=m.normals[vi*3+2];
          if(!nx&&!ny&&!nz)continue;
          pts.push(m.positions[vi*3],m.positions[vi*3+1],m.positions[vi*3+2],nx,ny,nz);
        }
        m.probes=new Float32Array(pts);
      });
      // Coarse radial profile of the whole model: max hull radius per 2 m
      // station, so callouts can be pushed outside the projected silhouette.
      const profile=new Float32Array(256);
      meshes.forEach(m=>{
        for(let i=0;i<m.count;i++){
          const x=m.positions[i*3],r=Math.hypot(m.positions[i*3+1],m.positions[i*3+2]);
          const b=Math.min(255,Math.max(0,Math.round(x/2)));
          if(r>profile[b])profile[b]=r;
        }
      });
      return {cfg,meshes,p,uniforms,aPos:gl.getAttribLocation(p,'aPosition'),aNor:gl.getAttribLocation(p,'aNormal'),profile};
    })();
    cache.set(id,promise);
    promise.catch(()=>cache.delete(id));
    return promise;
  }
  function matAngle(cfg,material,state) { return cfg.wholeSpin?(material.evaOnly?0:state.phase):state.phase*(material.spins||0); }
  function matFor(cfg,material,state) {
    const angle=matAngle(cfg,material,state);
    return mul(translate(0,0,compare?comparisonHeight*(cfg.id==='el-cajon'?.20:-.25):0),rotX(angle));
  }
  function modelMatrix(cfg,material,state) {
    return matFor(cfg,material,state);
  }
  function render(models,state) {
    const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
    if(!w||!h)return;
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    const aspect=w/h;compare=state.compare;cw=w;ch=h;
    if(compare){
      const worldWidth=Math.max(236,160*aspect)/state.zoom;
      comparisonHeight=worldWidth/aspect;
      vp=mul(ortho(worldWidth/2,worldWidth/aspect/2),lookAt([96,-500,0],[96,0,0],[0,0,1]));
    }else{
      const cfg=models[0].cfg,
      // widen the default framing when callouts are on, so the docking
      // columns on either side stay clear of the hull
      gutter=!compare&&state.labels?1.3:1,
      dist=cfg.distance*0.78*Math.max(1,1/aspect)*gutter/state.zoom,ce=Math.cos(state.el);
      const eye=[cfg.target+dist*Math.cos(state.az)*ce,dist*Math.sin(state.az)*ce,dist*Math.sin(state.el)];eyeWorld=eye;
      vp=mul(persp(38*Math.PI/180,aspect,.1,10000),lookAt(eye,[cfg.target,0,0],[0,0,1]));
    }
    gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.depthFunc(gl.LEQUAL);
    models.forEach(model=>{
      const {cfg,p,uniforms:u,aPos,aNor}=model;gl.useProgram(p);
      gl.uniform1f(u.uExp,1.05);gl.uniform1f(u.uWire,state.wire?1:0);gl.uniform1f(u.uGlowPass,0);
      model.meshes.forEach(m=>{
        const mat=m.material;if(mat.evaOnly&&!state.eva||mat.shell&&state.cut)return;
        const matrix=modelMatrix(cfg,mat,state);
        gl.uniformMatrix4fv(u.uMVP,false,mul(vp,matrix));gl.uniformMatrix4fv(u.uModel,false,matrix);
        gl.uniform3fv(u.uBase,mat.color);gl.uniform1f(u.uType,mat.type);
        gl.bindBuffer(gl.ARRAY_BUFFER,m.buffers[state.wire?'linePositions':'positions']);gl.enableVertexAttribArray(aPos);gl.vertexAttribPointer(aPos,3,gl.FLOAT,false,0,0);
        gl.bindBuffer(gl.ARRAY_BUFFER,m.buffers[state.wire?'lineNormals':'normals']);gl.enableVertexAttribArray(aNor);gl.vertexAttribPointer(aNor,3,gl.FLOAT,false,0,0);
        gl.drawArrays(state.wire?gl.LINES:gl.TRIANGLES,0,state.wire?m.lineCount:m.count);
      });
    });
  }
  function project(point) {
    const x=vp[0]*point[0]+vp[4]*point[1]+vp[8]*point[2]+vp[12],y=vp[1]*point[0]+vp[5]*point[1]+vp[9]*point[2]+vp[13];
    const z=vp[2]*point[0]+vp[6]*point[1]+vp[10]*point[2]+vp[14],w=vp[3]*point[0]+vp[7]*point[1]+vp[11]*point[2]+vp[15];
    if(w<=0||z/w<-1||z/w>1)return null;
    return {x:(x/w*.5+.5)*canvas.clientWidth,y:(.5-y/w*.5)*canvas.clientHeight,d:z/w};
  }
  function anchor(cfg,label,state) { return project(transform(label.p,modelMatrix(cfg,{evaOnly:label.t==='SCALE FIGURE'},state))); }
  function pickTarget() {
    const fw=Math.max(96,Math.min(320,Math.round(cw/4))),fh=Math.max(64,Math.round(fw*ch/Math.max(cw,1)));
    if(pick&&pick.fw===fw&&pick.fh===fh)return pick;
    if(pick){gl.deleteFramebuffer(pick.fb);gl.deleteTexture(pick.tex);gl.deleteRenderbuffer(pick.rb);gl.deleteProgram(pick.prog);gl.deleteBuffer(pick.buf);pick=null;}
    const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,fw,fh,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    const rb=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,rb);
    gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,fw,fh);
    const fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,rb);
    if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE){gl.bindFramebuffer(gl.FRAMEBUFFER,null);return null;}
    let prog;
    try{
      const vs=shader(gl.VERTEX_SHADER,'attribute vec3 aP;attribute vec3 aC;uniform mat4 uVP;varying vec3 vC;void main(){vC=aC;gl_Position=uVP*vec4(aP,1.0);gl_Position.z-=0.003;gl_PointSize=2.0;}');
      const fs2=shader(gl.FRAGMENT_SHADER,'precision mediump float;varying vec3 vC;void main(){gl_FragColor=vec4(vC,1.0);}');
      prog=gl.createProgram();gl.attachShader(prog,vs);gl.attachShader(prog,fs2);gl.linkProgram(prog);gl.deleteShader(vs);gl.deleteShader(fs2);
      if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw new Error('pick program');
    }catch(e){gl.bindFramebuffer(gl.FRAMEBUFFER,null);return null;}
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    pick={fw,fh,fb,tex,rb,prog,uVP:gl.getUniformLocation(prog,'uVP'),aP:gl.getAttribLocation(prog,'aP'),aC:gl.getAttribLocation(prog,'aC'),buf:gl.createBuffer(),pix:new Uint8Array(fw*fh*4)};
    return pick;
  }
  function labelAnchors(model,state,requests) {
    const cfg=model.cfg;
    const meshR=m=>{if(m.maxR===undefined){m.maxR=0;for(let i=0;i<m.count;i++){const r=Math.hypot(m.positions[i*3+1],m.positions[i*3+2]);if(r>m.maxR)m.maxR=r;}}return m.maxR;};
    const silh=(x,mesh)=>{const c=project([x,0,0]);if(!c)return 0;const b0=Math.min(255,Math.max(0,Math.round(x/2)));let R=mesh?meshR(mesh):0;if(model.profile)for(let db=-8;db<=8;db++){const b=Math.min(255,Math.max(0,b0+db));R=Math.max(R,model.profile[b]);}if(!R)return 0;let w=0;for(const s of [1,-1]){const pp=project([x,0,s*R]);if(pp)w=Math.max(w,Math.hypot(pp.x-c.x,pp.y-c.y));}return w;};
    const legacy=()=>requests.map(rq=>{const p=project(transform(rq.part.p,matFor(cfg,{evaOnly:rq.part.t==='SCALE FIGURE'},state)));return p?{x:p.x,y:p.y,probe:-1,r:silh(rq.part.p[0])}:null;});
    if(!eyeWorld||state.compare)return legacy();
    const byName=new Map(model.meshes.map(m=>[m.name,m]));
    const visible=m=>{const mat=m.material;return !(mat.evaOnly&&!state.eva)&&!(mat.shell&&state.cut);};
    const reqs=requests.map(r=>({part:r.part,prev:r.prev|0,force:!!r.force,
      mesh:r.part.m?byName.get(r.part.m)||null:null,fmesh:r.part.fm?byName.get(r.part.fm)||null:null}));
    if(!reqs.some(q=>(q.mesh&&visible(q.mesh))||(q.fmesh&&visible(q.fmesh))))return legacy();
    const pk=pickTarget();
    if(!pk)return legacy();
    const {fw,fh}=pk;
    gl.bindFramebuffer(gl.FRAMEBUFFER,pk.fb);
    gl.viewport(0,0,fw,fh);
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);gl.enable(gl.CULL_FACE);
    gl.colorMask(false,false,false,false);
    model.meshes.forEach(m=>{
      if(!visible(m))return;
      const matrix=matFor(cfg,m.material,state);
      gl.useProgram(model.p);
      gl.uniformMatrix4fv(model.uniforms.uMVP,false,mul(vp,matrix));
      gl.uniformMatrix4fv(model.uniforms.uModel,false,matrix);
      gl.bindBuffer(gl.ARRAY_BUFFER,m.buffers.positions);
      gl.enableVertexAttribArray(model.aPos);gl.vertexAttribPointer(model.aPos,3,gl.FLOAT,false,0,0);
      gl.drawArrays(gl.TRIANGLES,0,m.count);
    });
    gl.colorMask(true,true,true,true);gl.depthMask(false);
    const verts=[],ranges=[];
    reqs.forEach((q,qi)=>{
      const m=q.mesh&&visible(q.mesh)?q.mesh:(q.fmesh&&visible(q.fmesh)?q.fmesh:null);
      if(!m||!m.probes||!m.probes.length){ranges.push(null);return;}
      const matrix=matFor(cfg,m.material,state),start=verts.length/6;
      for(let vi=0;vi<m.probes.length;vi+=6){
        const w=transform([m.probes[vi],m.probes[vi+1],m.probes[vi+2]],matrix);
        verts.push(w[0],w[1],w[2],(qi+1)/255,0,0);
      }
      ranges.push({m,matrix,start,n:m.probes.length/6});
    });
    gl.useProgram(pk.prog);
    gl.uniformMatrix4fv(pk.uVP,false,vp);
    gl.bindBuffer(gl.ARRAY_BUFFER,pk.buf);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(pk.aP);gl.vertexAttribPointer(pk.aP,3,gl.FLOAT,false,24,0);
    gl.enableVertexAttribArray(pk.aC);gl.vertexAttribPointer(pk.aC,3,gl.FLOAT,false,24,12);
    gl.drawArrays(gl.POINTS,0,verts.length/6);
    gl.readPixels(0,0,fw,fh,gl.RGBA,gl.UNSIGNED_BYTE,pk.pix);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    gl.depthMask(true);
    const px=pk.pix;
    const onSurface=(sp,ri)=>{
      const fx=Math.round(sp.x/cw*(fw-1)),fy=Math.round((ch-sp.y)/ch*(fh-1));
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const gx=fx+dx,gy=fy+dy;
        if(gx<0||gy<0||gx>=fw||gy>=fh)continue;
        const ii=(gy*fw+gx)*4;
        if(px[ii]===ri+1&&px[ii+1]===0)return true;
      }
      return false;
    };
    return reqs.map((q,ri)=>{
      const rg=ranges[ri];
      if(!rg)return null;
      const {m,matrix}=rg,c=Math.cos(matAngle(cfg,m.material,state)),s=Math.sin(matAngle(cfg,m.material,state));
      let best=-1,bestScore=Infinity,keep=-1;
      for(let pi=0;pi<rg.n;pi++){
        const o=pi*6;
        const w=transform([m.probes[o],m.probes[o+1],m.probes[o+2]],matrix);
        const sp=project(w);
        if(!sp||sp.x<0||sp.y<0||sp.x>=cw||sp.y>=ch)continue;
        const nx0=m.probes[o+3],ny0=m.probes[o+4],nz0=m.probes[o+5];
        const tx=eyeWorld[0]-w[0],ty=eyeWorld[1]-w[1],tz=eyeWorld[2]-w[2];
        const tl=Math.hypot(tx,ty,tz)||1;
        const facing=(nx0*tx+(c*ny0-s*nz0)*ty+(s*ny0+c*nz0)*tz)/tl;
        if(facing<0.02)continue;
        if(!(q.force||onSurface(sp,ri)))continue;
        if(pi===q.prev&&facing>0.15){keep=pi;continue;}
        const d=Math.hypot(m.probes[o]-q.part.p[0],m.probes[o+1]-q.part.p[1],m.probes[o+2]-q.part.p[2]);
        if(d<bestScore){bestScore=d;best=pi;}
      }
      const pi=keep>=0?keep:best;
      if(pi<0){
        // No probe passed facing/occlusion (e.g. the drive spine edge-on at
        // standard angles). Fall back to the annotated point itself so the
        // label keeps a real anchor instead of vanishing to (0,0).
        const sp=project(transform(q.part.p,matrix));
        return sp?{x:sp.x,y:sp.y,probe:-1,r:silh(q.part.p[0],q.mesh||q.fmesh)}:null;
      }
      const w=transform([m.probes[pi*6],m.probes[pi*6+1],m.probes[pi*6+2]],matrix);
      const sp=project(w);
      return sp?{x:sp.x,y:sp.y,probe:pi,r:silh(q.part.p[0],m)}:null;
    });
  }
  // Screen-space horizontal extent of the hull silhouette, so callout
  // columns can dock just outside the outline on either side.
  function hullExtent(model) {
    if(!model||!model.profile)return null;
    let x0=Infinity,x1=-Infinity;
    for(let b=0;b<256;b+=4){
      const R=model.profile[b];if(!R)continue;
      const c=project([b*2,0,0]);if(!c)continue;
      x0=Math.min(x0,c.x);x1=Math.max(x1,c.x);
      for(const ss of [1,-1]){const pp=project([b*2,0,ss*R]);if(pp){x0=Math.min(x0,pp.x);x1=Math.max(x1,pp.x);}}
    }
    return x0<x1?{x0,x1}:null;
  }
  function measure(cfg) {
    const z=comparisonHeight*(cfg.id==='el-cajon'?.20:-.25)+cfg.span/2;
    return {start:project([0,0,z]),end:project([cfg.length,0,z])};
  }
  return {load,render,project,anchor,measure,labelAnchors,hullExtent};
}
return {create};
})();
