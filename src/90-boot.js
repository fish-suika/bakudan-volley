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

  // 選手 4 人（Phase 1 は定位置で構えるだけ）。爆弾の当たり判定には足元の位置を渡す
  const players = CFG.startSpots.map(s => {
    const pl = makePlayer(scene, s.team);
    placePlayer(pl, s.x, s.z);
    return pl;
  });
  const colliders = CFG.startSpots.map(s => ({ x: s.x, z: s.z }));

  const bombMesh = makeBombMesh(scene);
  let ball = null;      // 今の爆弾（無ければ null）
  let boom = null;      // 床に触れてからの待ち { t, hit, fired }

  // 試し投げ：狙った地点の反対側のコートから投げ込む
  function throwTo(x, z) {
    if (boom) return;                                     // 爆発が終わるまでは投げない
    const from = { x: x < 0 ? CFG.test.fromX : -CFG.test.fromX, y: CFG.test.fromY, z: z * 0.3 };
    ball = newBall(from.x, from.y, from.z);
    ball.vel = shotVelocity(from, { x, z }, CFG.test.apex);
  }
  initInput(renderer.domElement, camera, throwTo);
  window.GAME = { scene, players, colliders, throwTo, get ball() { return ball; } };   // 確認用

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
    if (ball && ball.live) {
      const hit = stepBall(ball, dt, colliders);
      if (hit) boom = { t: 0, hit, fired: false };
    }
    if (boom) {
      boom.t += dt;
      if (!boom.fired && boom.t >= CFG.explodeDelay) {   // 一瞬の間をおいて爆発
        boom.fired = true;
        ball = null;
        spawnExplosion(boom.hit.x, boom.hit.z);
        showToast(boom.hit.side === 0 ? '味方コートで爆発！' : '相手コートで爆発！');
      }
      if (boom.t >= CFG.explodeDelay + 1.2) boom = null;
    }
    const focus = ball ? ball.pos : { x: 0, y: 3, z: 0 };
    for (const pl of players) updatePlayer(pl, dt, t, focus);
    updateBombMesh(bombMesh, ball, dt);
    updateFx(dt);
    updateCamera(dt, ball ? ball.pos.x : 0);
    renderer.render(scene, camera);
  }
  frame();
})();
