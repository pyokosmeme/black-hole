/* Shared BH background: neon by default, with the actual previous renderer retained. */
(function () {
  'use strict';
  const root=new URL('../',document.currentScript.src);
  const container=document.getElementById('blackhole-container');
  if(!container) return;
  const instances={}, loads=new Map();
  let generation=0, failure=false;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const legacy=()=>localStorage.getItem('acidburn-bh-legacy')==='true';
  const active=()=>!document.body.hasAttribute('data-disable-bh-background')&&document.body.classList.contains('bh-mode')&&!document.hidden;
  function script(path,available){
    if(available()) return Promise.resolve();
    if(!loads.has(path)) loads.set(path,new Promise((resolve,reject)=>{
      const node=document.createElement('script');node.src=new URL(path,root);node.onload=resolve;node.onerror=()=>reject(new Error('Could not load '+path));document.head.appendChild(node);
    }));
    return loads.get(path);
  }
  async function dependencies(){
    await script('js-libs/three.min.js',()=>!!window.THREE);
    await Promise.all([
      script('js-libs/Detector.js',()=>!!window.Detector),
      script('js-libs/mustache.min.js',()=>!!window.Mustache),
      script('three-js-monkey-patch.js',()=>!!THREE.Matrix4.prototype.linearPart)
    ]);
    if(!Detector.webgl) throw new Error('WebGL unavailable');
  }
  async function sync(){
    const request=++generation,kind=legacy()?'legacy':'neon',on=active();
    Object.values(instances).forEach(instance=>instance.setActive(false));
    if(window.AcidburnGalaxy) AcidburnGalaxy.stop();
    if(!on||failure) return;
    try{
      await dependencies();
      if(kind==='neon'){
        await Promise.all([
          script('neon/settings.js',()=>!!window.NeonSettings),
          script('neon/js-libs/neon-blackhole.js',()=>!!window.createNeonBlackhole)
        ]);
      }else{
        await script('js-libs/jquery-2.1.4.min.js',()=>!!window.jQuery);
        await script('js-libs/ShaderLoader.min.js',()=>!!window.SHADER_LOADER);
        await script('js/acidburn-galaxy.js',()=>!!window.AcidburnGalaxy);
        await script('js/acidburn-blackhole-legacy.js',()=>!!window.createLegacyBlackhole);
      }
      if(request!==generation||!active()) return;
      if(!instances[kind]){
        instances[kind]=kind==='neon'?createNeonBlackhole({container,base:new URL('neon/',root).href,active:false,settings:{look:{grid_strength:.21875,grid_glow:1,grid_pulse:0}}}):createLegacyBlackhole({container,active:false});
        if(kind==='neon') await instances[kind].ready;
      }
      if(request!==generation||!active()) return;
      if(kind==='neon') instances[kind].setPaused(reduced.matches);
      else instances[kind].setReducedMotion(reduced.matches);
      instances[kind].setActive(true);
      window.dispatchEvent(new CustomEvent('acidburn-background-ready',{detail:{renderer:kind}}));
    }catch(error){
      failure=true;document.body.classList.add('no-webgl');
      Object.values(instances).forEach(instance=>instance.setActive(false));
      console.warn('[ACIDBURN background]',error.message);
    }
  }
  window.AcidburnBlackhole={
    get isReady(){return !!instances[legacy()?'legacy':'neon']?.isReady;},
    get renderer(){return legacy()?'legacy':'neon';},
    get frames(){return instances[this.renderer]?.frames||0;},
    getShader(){const instance=instances[this.renderer];return instance?.getShader?.()||(instance?{parameters:instance.params}:null);},
    getObserver(){const instance=instances[this.renderer];return instance?.getObserver?.()||instance?.observer;},
    setDistance(value){const instance=instances[this.renderer];if(instance?.setDistance) instance.setDistance(value);else if(instance){instance.params.observer.distance=value;instance.recompile();}},
    setTimeScale(value){const instance=instances[this.renderer];if(instance?.setTimeScale) instance.setTimeScale(value);else if(instance) instance.params.time_scale=value;}
  };
  window.addEventListener('acidburn-mode-change',sync);
  window.addEventListener('acidburn-bh-style-change',sync);
  document.addEventListener('visibilitychange',sync);
  reduced.addEventListener('change',sync);
  sync();
})();
