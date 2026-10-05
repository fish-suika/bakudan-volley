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

  const R = newRally();
  const players = R.actors.map(a => {
    const pl = makePlayer(scene, a.team);
    placePlayer(pl, a.x, a.z);                            // 向き（ネットのほう）を決める
    return pl;
  });
  const bombMesh = makeBombMesh(scene);
  initInput(act => choose(R, act));
  window.GAME = { R, choose: act => choose(R, act) };     // 確認用

  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  });

  document.getElementById('againBtn').addEventListener('click', () => {
    hideResult();
    newGame(R);
    setScore(R.score);
  });
  newGame(R);                                             // 0-0、最初のサーブはプレイヤーのチーム
  const clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 1 / 30);
    tickRally(R, dt);
    for (const e of R.events) {
      if (e.type === 'choose') showChoice(e.scene, e.attack, e.allowed);
      else if (e.type === 'chosen') { hideChoice(); if (e.action === null) showToast('時間切れ！', 1.0); }
      else if (e.type === 'explode') {
        spawnExplosion(e.x, e.z);
        showToast(e.side === 0 ? '味方コートで爆発！' : '相手コートで爆発！');
      }
      else if (e.type === 'point') {
        setScore(e.score);
        showToast(e.scorer === 0 ? '味方に 1 点！' : '相手に 1 点……', 1.4);
      }
      else if (e.type === 'gameover') showResult(e.winner, e.score);
      else if (e.type === 'bump') showToast('ゴツン！', 0.8);
    }
    R.events.length = 0;
    if (R.state === 'choose') setTimer(R.choose.left / CFG.choiceTime);
    const slow = R.state === 'choose' ? CFG.slowScale : 1;
    const shown = R.ball && !(R.state === 'boom' && R.boom.fired) ? R.ball : null;   // 爆発したら爆弾を消す
    const focus = R.ball ? R.ball.pos : { x: 0, y: 3, z: 0 };
    R.actors.forEach((a, i) => updatePlayer(players[i], a, dt, R.simT, focus));
    updateBombMesh(bombMesh, shown, dt * slow);
    updateFx(dt);
    updateCamera(dt, R.ball ? R.ball.pos.x : 0);
    renderer.render(scene, camera);
  }
  frame();
})();
