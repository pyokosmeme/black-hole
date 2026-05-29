// ⇒ handles the Three.js 3D Ising simulation, no UI, but
//    dispatches a 'magnetizationUpdate' event with the
//    current smoothed magnetization (mVal ∈ [−1,1])

export function initIsingSimulator(container) {
  // import global THREE
  const { Scene, PerspectiveCamera, WebGLRenderer, AmbientLight,
          DirectionalLight, Vector3, MeshBasicMaterial,
          MeshPhongMaterial, SphereGeometry, BufferGeometry,
          BufferAttribute, LineBasicMaterial, Line, CanvasTexture,
          TextureLoader, SpriteMaterial, Sprite, Color,
          DoubleSide, AdditiveBlending } = THREE;

  // basic setup
  const scene = new Scene();
  const cam = new PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);
  cam.position.set(0, 0, 50);

  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  const controls = new THREE.OrbitControls(cam, renderer.domElement);
  controls.enableDamping = true;

  // lighting
  scene.add(new AmbientLight(0xffffff, 0.6));
  const dl = new DirectionalLight(0xffffff, 0.8);
  dl.position.set(0,1,1);
  scene.add(dl);

  // simulation params
  let nodes = [], edges = [];
  const params = {
    numNodes: 300,
    neighborsCount: 4,
    coupling: 1.0,
    temperature: 1.0,
    field: 0.0,
    threeState: false,
    density: 2.5,
    fluctInterval: 500,
    lastFluct: performance.now(),
  };
  let magnetHistory = [], smoothedMag = 0;

  // create background gradient canvas
  const bgCanvas = document.createElement('canvas');
  bgCanvas.width = bgCanvas.height = 128;
  const bgCtx = bgCanvas.getContext('2d');
  const bgTex = new CanvasTexture(bgCanvas);
  scene.background = bgTex;

  initScene();
  window.addEventListener('resize', onResize);

  function onResize() {
    cam.aspect = window.innerWidth/window.innerHeight;
    cam.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function initScene() {
    // clear
    nodes.forEach(n=> scene.remove(n.mesh));
    edges.forEach(e=> scene.remove(e.obj));
    nodes = []; edges = [];

    // create nodes
    const sphereGeo = new SphereGeometry(0.4, 12, 12);
    for (let i = 0; i < params.numNodes; i++) {
      const spin = params.threeState
        ? [ -1,0,1 ][Math.floor(Math.random()*3)]
        : (Math.random()<0.5 ? 1 : -1);
      // random pos in box
      const base = new Vector3(
        (Math.random()-0.5)*30,
        (Math.random()-0.5)*30,
        (Math.random()-0.5)*30
      );
      const mat = new MeshPhongMaterial({
        color: spin>0 ? 0xff77ff : 0x77ffff,
        emissive: 0x111111
      });
      const mesh = new THREE.Mesh(sphereGeo, mat);
      mesh.position.copy(base);
      scene.add(mesh);
      nodes.push({ mesh, spin, pos: base });
    }

    // simple nearest‑neighbors graph
    let counts = Array(params.numNodes).fill(0);
    const linked = new Set();
    for (let i=0; i<params.numNodes; i++) {
      // sort others by distance
      const dists = nodes.map((n,j)=> j!==i
        ? { j, d:nodes[i].pos.distanceToSquared(n.pos) }
        : null
      ).filter(Boolean).sort((a,b)=>a.d-b.d);
      for (let k=0; k<params.neighborsCount; k++) {
        const j = dists[k].j;
        const key = i<j ? `${i}-${j}` : `${j}-${i}`;
        if (!linked.has(key)) {
          linked.add(key);
          const geo = new BufferGeometry().setFromPoints([nodes[i].pos, nodes[j].pos]);
          const line = new Line(geo, new LineBasicMaterial({ color:0xffffff, transparent:true, opacity:0.3 }));
          scene.add(line);
          edges.push({ i, j, obj: line });
          counts[i]++; counts[j]++;
        }
      }
    }
  }

  // simulation “flip” step
  function step() {
    for (let k=0; k<100; k++) {
      const i = Math.floor(Math.random()*nodes.length);
      const node = nodes[i];
      let sumN = 0;
      edges.forEach(e=>{
        if (e.i===i) sumN += nodes[e.j].spin;
        else if (e.j===i) sumN += nodes[e.i].spin;
      });
      const s = node.spin;
      const dE = 2*s*(params.coupling*sumN + params.field);
      if (dE <= 0 || Math.random()<Math.exp(-dE/params.temperature)) {
        node.spin = -s;
        node.mesh.material.color.set(node.spin>0 ? 0xff77ff : 0x77ffff);
      }
    }
  }

  // compute magnetization & background
  function updateMagnet() {
    let total = nodes.reduce((sum,n)=>sum + n.spin, 0);
    const m = total / nodes.length;
    magnetHistory.push(m);
    if (magnetHistory.length>200) magnetHistory.shift();
    smoothedMag += 0.01*(m - smoothedMag);

    // dispatch to market overlay
    window.dispatchEvent(new CustomEvent('magnetizationUpdate', {
      detail: { smoothedMag }
    }));

    // animate sky
    const t = (smoothedMag + 1)/2;
    const top = new Color('#0a0c37').lerp(new Color('#ff61c6'), t);
    const bot = new Color('#375971').lerp(new Color('#ff9900'), t);
    const g = bgCtx.createLinearGradient(0,0,0,128);
    g.addColorStop(0, '#'+top.getHexString());
    g.addColorStop(1, '#'+bot.getHexString());
    bgCtx.fillStyle = g;
    bgCtx.fillRect(0,0,128,128);
    bgTex.needsUpdate=true;
  }

  // random walk T & H
  function fluctuate(now) {
    if (now - params.lastFluct > params.fluctInterval) {
      params.lastFluct = now;
      params.temperature = Math.min(5, Math.max(0.5, params.temperature + (Math.random()-0.5)*0.1));
      params.field       = Math.min(5, Math.max(-5, params.field       + (Math.random()-0.5)*0.1));
    }
  }

  // main loop
  function animate(now) {
    requestAnimationFrame(animate);
    fluctuate(now);
    step();
    updateMagnet();
    controls.update();
    renderer.render(scene, cam);
  }
  animate();
}
