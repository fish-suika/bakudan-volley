// ===== 起動とメインループ =====
(function boot() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  buildGym(scene);
  initFx(scene);
  const camera = new THREE.PerspectiveCamera(CFG.camera.fov, innerWidth / innerHeight, 0.1, 200);
  CAM.cam = camera;

  // 選手 4 人（Phase 1 は定位置で構えるだけ）
  const players = CFG.startSpots.map(s => {
    const pl = makePlayer(scene, s.team);
    placePlayer(pl, s.x, s.z);
    return pl;
  });

  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  });

  const clock = new THREE.Clock();
  let t = 0;
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 1 / 30);
    t += dt;
    for (const pl of players) updatePlayer(pl, dt, t, { x: 0, y: 3, z: 0 });
    updateFx(dt);
    updateCamera(dt, 0);
    renderer.render(scene, camera);
  }
  frame();
})();
