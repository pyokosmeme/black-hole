/* Ya Ke atlas surfaces: the procedural world textures as plain pixel
 * buffers. yake-3d.js runs this file in a few Web Workers so the worlds paint
 * in parallel, off the page's thread; yake.html also loads it so the page can
 * paint the same way when workers are unavailable. Deterministic: a world
 * always paints the same pixels, whichever thread paints it. */
(function (scope) {
  'use strict';
  // Value noise. Pure and hot (millions of calls per load).
  const smooth = v => v*v*(3-2*v);
  function hash(a,b,c) { let n=Math.imul(a,73856093)^Math.imul(b,19349663)^Math.imul(c,83492791);n=Math.imul(n^(n>>>13),1274126177);return (n>>>0)/4294967295; }
  function noise(x,y,z) {
    const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);
    const fx=smooth(x-ix),fy=smooth(y-iy),fz=smooth(z-iz);
    const a0=hash(ix,iy,iz),a1=hash(ix+1,iy,iz),b0=hash(ix,iy+1,iz),b1=hash(ix+1,iy+1,iz);
    const c0=hash(ix,iy,iz+1),c1=hash(ix+1,iy,iz+1),d0=hash(ix,iy+1,iz+1),d1=hash(ix+1,iy+1,iz+1);
    const a=a0+(a1-a0)*fx,b=b0+(b1-b0)*fx,c=c0+(c1-c0)*fx,d=d0+(d1-d0)*fx;
    const ab=a+(b-a)*fy,cd=c+(d-c)*fy;
    return ab+(cd-ab)*fz;
  }

  // Texture sizes; 'pani-clouds' is Pani's translucent cloud shell.
  function size(id) {
    if(id==='pani-clouds')return {width:512,height:256,detailed:false};
    const width=['jin','shu','celosia','gullinkambi'].includes(id)?1024:512;
    return {width,height:width/2,detailed:['celosia','gullinkambi','pani'].includes(id)};
  }

  // Sheltered seas and narrow straits break up Celosia's land masses. The
  // page draws the coast silhouettes (a canvas path; see yake-3d.js
  // continentMask) and hands the red-channel mask here.
  function channels(mask) {
    const W=1024,H=512;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const j=(y*W+x)*4;if(!mask[j])continue;
      const u=x/W,v=y/H;
      const channel=noise(u*45+8,v*57,2)*.65+noise(u*110,v*130,7)*.35;
      if(channel>.57)mask[j]=0;
    }
    return mask;
  }

  // base: the world's catalogue colour as 0-1 floats (THREE.Color r, g, b).
  function paint(id,base,mask) {
    const {width:W,height:H,detailed}=size(id);
    const color=new Uint8ClampedArray(W*H*4);
    const relief=detailed?new Uint8ClampedArray(W*H*4):null;
    const specular=detailed?new Uint8ClampedArray(W*H*4):null;
    const gas=['jin','shu','xuan'].includes(id);
    const continents=id==='celosia'?channels(mask):null;
    const landAt=(u,v)=>Math.round(continents[(Math.max(0,Math.min(511,Math.floor(v*512)))*1024+((Math.floor(u*1024)%1024+1024)%1024))*4]/64);
    const offset=id.split('').reduce((n,ch)=>n+ch.charCodeAt(0),0)*.17;
    for(let y=0;y<H;y++) for(let x=0;x<W;x++) {
      const lon=x/W*Math.PI*2, lat=(y/H-.5)*Math.PI;
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
        const u=x/W+(noise(sx*42,sy*42,sz*42)-.5)*.014;
        const v=y/H+(noise(sx*57+8,sy*57,sz*57)-.5)*.01;
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
        // Thin cartographic coast highlights, following the actual land mask.
        // They include the smaller Mu/Diyu landmasses and their shelf islands.
        if(land && [landAt(u+.0015,v),landAt(u-.0015,v),landAt(u,v+.002),landAt(u,v-.002)].some(n=>!n)) {
          const coast=[[133,231,216],[245,210,137],[218,167,236]][Math.min(3,land)-1];
          rgb=rgb.map((value,i)=>value*.2+coast[i]*.8);
        }
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
      } else if(id==='pani') {
        const minerals=noise(sx*19+2,sy*19,sz*19);
        rgb=[18+n*9+minerals*9,70+n*25+minerals*19,81+n*28+minerals*15];
        elevation=128+n*3;shine=170;
      } else {
        const shade=.7+n*.15;
        rgb=[base.r*255*shade,base.g*255*shade,base.b*255*shade];
      }
      const i=(y*W+x)*4;
      color[i]=rgb[0];color[i+1]=rgb[1];color[i+2]=rgb[2];color[i+3]=255;
      if(detailed){
        for(let k=0;k<3;k++){relief[i+k]=elevation;specular[i+k]=shine;}
        relief[i+3]=specular[i+3]=255;
      }
    }
    return {id,width:W,height:H,color,relief,specular};
  }

  function clouds() {
    const W=512,H=256,color=new Uint8ClampedArray(W*H*4);
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const lon=x/W*Math.PI*2,lat=(y/H-.5)*Math.PI;
      const sx=Math.cos(lon)*Math.cos(lat),sy=Math.sin(lat),sz=Math.sin(lon)*Math.cos(lat);
      const cloud=noise(sx*7+11,sy*11,sz*7)*.7+noise(sx*24,sy*30,sz*24)*.3;
      const i=(y*W+x)*4;
      color[i]=245;color[i+1]=190+cloud*25;color[i+2]=177+cloud*35;
      color[i+3]=Math.max(0,cloud-.43)*330;
    }
    return {id:'pani-clouds',width:W,height:H,color,relief:null,specular:null};
  }

  function run(job) { return job.id==='pani-clouds'?clouds():paint(job.id,job.base,job.mask); }
  scope.YakeSurfaces={size,run};
  // As a worker: one job in, its buffers transferred back out.
  if(typeof document==='undefined' && typeof postMessage==='function') {
    scope.onmessage=event=>{
      const out=run(event.data);
      postMessage(out,[out.color,out.relief,out.specular].filter(Boolean).map(a=>a.buffer));
    };
  }
})(self);
