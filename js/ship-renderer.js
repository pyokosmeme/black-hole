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
  let vp=IDENT,compare=false,comparisonHeight=160;
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
      meshes.forEach(m=>{m.buffers={};for(const [key,data] of Object.entries({positions:m.positions,normals:m.normals,linePositions:m.linePositions,lineNormals:m.lineNormals})){const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);m.buffers[key]=b;}});
      return {cfg,meshes,p,uniforms,aPos:gl.getAttribLocation(p,'aPosition'),aNor:gl.getAttribLocation(p,'aNormal')};
    })();
    cache.set(id,promise);
    promise.catch(()=>cache.delete(id));
    return promise;
  }
  function modelMatrix(cfg,material,state) {
    const angle=cfg.wholeSpin?(material.evaOnly?0:state.phase):state.phase*(material.spins||0);
    return mul(translate(0,0,compare?comparisonHeight*(cfg.id==='el-cajon'?.20:-.25):0),rotX(angle));
  }
  function render(models,state) {
    const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
    if(!w||!h)return;
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    const aspect=w/h;compare=state.compare;
    if(compare){
      const worldWidth=Math.max(236,160*aspect)/state.zoom;
      comparisonHeight=worldWidth/aspect;
      vp=mul(ortho(worldWidth/2,worldWidth/aspect/2),lookAt([96,-500,0],[96,0,0],[0,0,1]));
    }else{
      const cfg=models[0].cfg,dist=cfg.distance*Math.max(1,1/aspect)/state.zoom,ce=Math.cos(state.el);
      const eye=[cfg.target+dist*Math.cos(state.az)*ce,dist*Math.sin(state.az)*ce,dist*Math.sin(state.el)];
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
    return {x:(x/w*.5+.5)*canvas.clientWidth,y:(.5-y/w*.5)*canvas.clientHeight};
  }
  function anchor(cfg,label,state) { return project(transform(label.p,modelMatrix(cfg,{evaOnly:label.t==='SCALE FIGURE'},state))); }
  function measure(cfg) {
    const z=comparisonHeight*(cfg.id==='el-cajon'?.20:-.25)+cfg.span/2;
    return {start:project([0,0,z]),end:project([cfg.length,0,z])};
  }
  return {load,render,project,anchor,measure};
}
return {create};
})();
