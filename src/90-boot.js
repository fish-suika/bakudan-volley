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
  initDecals(scene);
  const camera = new THREE.PerspectiveCamera(CFG.camera.fov, innerWidth / innerHeight, 0.1, 200);
  CAM.cam = camera;

  const R = newRally();
  const players = R.actors.map(a => {
    const pl = makePlayer(scene, a.team);
    placePlayer(pl, a.x, a.z);                            // 向き（ネットのほう）を決める
    return pl;
  });
  const bombMesh = makeBombMesh(scene);
  let titleOn = true, replay = null, pendingResult = null, lastBoom = null, realT = 0;
  const rec = makeRecorder(), CMT = { until: 0, prio: -1, last: '' };
  initInput(act => { if (!titleOn && !replay) choose(R, act); });
  addEventListener('pointerdown', sndInit);
  addEventListener('keydown', sndInit);
  window.GAME = { R, choose: act => choose(R, act), start: () => startGame() };   // 確認用

  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  });

  // 試合を始める（タイトルの「試合開始」・勝敗の画面の「もう一回」）
  function startGame() {
    titleOn = false; replay = null; pendingResult = null; lastBoom = null;
    setTitle(false); setReplayTag(false); hideResult(); hideChoice();
    clearDecals();
    newGame(R);                                           // 積まれた①の選択は、次のフレームでボタンに出る
    setScore(R.score);
  }
  // タイトルへ：後ろで AI どうしの試合を流す
  function showTitle() {
    titleOn = true; replay = null; pendingResult = null;
    setTitle(true); setReplayTag(false); hideResult(); hideChoice();
    newGame(R);
    R.events.length = 0;
  }
  // リプレイ：爆発の before 秒前から after 秒後までを、speed 倍の速さで、低い角度から見せ直す
  function startReplay() {
    const P = CFG.replay;
    replay = { t: lastBoom.t - P.before, end: lastBoom.t + P.after, boom: lastBoom, fired: false };
    lastBoom = null;
    setReplayTag(true); hideChoice();
  }
  function endReplay() {
    replay = null;
    setReplayTag(false);
    FX.freeze = 0;
    if (pendingResult) { showResult(pendingResult.winner, pendingResult.score); pendingResult = null; }
  }
  function stepReplay(dt) {
    const P = CFG.replay, b = replay.boom;
    replay.t += dt * P.speed;
    applyFrame(frameAt(rec, replay.t), players, bombMesh);
    if (!replay.fired && replay.t >= b.t) { replay.fired = true; spawnExplosion(b.x, b.z); FX.freeze = 0; sndBoom(); }
    updateFx(dt * P.speed);
    camera.fov = P.fov; camera.updateProjectionMatrix();
    // 爆心と、吹っ飛んだ側の選手の両方が入るように見る（爆弾がコートの外に落ちると、爆心だけを見ていたら選手が映らなかった）
    const f = frameAt(rec, replay.t), side = R.actors.map((a, i) => a.team === b.side ? f.players[i].p : null).filter(Boolean);
    const pts = [[b.x, 1.0, b.z], ...side];
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const cz = pts.reduce((s, p) => s + p[2], 0) / pts.length;
    const spread = Math.max(...pts.map(p => Math.hypot(p[0] - cx, (p[1] - cy) * 1.5, p[2] - cz)));
    const dist = clamp(spread * 1.9 + 4, 7, 16);           // 広がっているほど引く
    const goal = { x: clamp(cx + (cx < 0 ? 1 : -1) * dist * 0.35, -13.5, 13.5), y: 1.4 + dist * 0.12, z: Math.min(cz + dist, 16),
      lx: cx, ly: Math.max(1.6, cy + 0.6), lz: cz };
    const k = replay.cam ? Math.min(1, dt * 4) : 1;       // 最初の 1 回はそのまま、あとはなめらかに追う
    replay.cam = replay.cam || {};
    for (const key in goal) replay.cam[key] = replay.cam[key] === undefined ? goal[key] : replay.cam[key] + (goal[key] - replay.cam[key]) * k;
    const c = replay.cam;
    camera.position.set(c.x, c.y, c.z);
    camera.lookAt(c.lx, c.ly, c.lz);
    if (replay.t >= replay.end) endReplay();
  }
  // タイトル中の試合：プレイヤーの番も、少し待ってから場面に合う行動を自動で選ぶ
  function demoPick(c) {
    if (c.scene === 'serve') return 'serve';
    if (c.scene === 'tossed') return 'attack';
    return c.attack && Math.random() < 0.4 ? 'block' : 'receive';
  }

  document.getElementById('startBtn').addEventListener('click', startGame);
  document.getElementById('againBtn').addEventListener('click', startGame);
  document.getElementById('titleBtn').addEventListener('click', showTitle);
  addEventListener('pointerdown', () => { if (replay) endReplay(); });
  addEventListener('keydown', () => { if (replay) endReplay(); });
  showTitle();
  const clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 1 / 30);
    realT += dt;
    if (replay) { stepReplay(dt); renderer.render(scene, camera); return; }
    if (FX.freeze > 0) { FX.freeze -= dt; renderer.render(scene, camera); return; }   // 爆発の瞬間の一瞬の静止
    if (titleOn && R.state === 'choose' && R.choose.left < CFG.choiceTime - 0.8) choose(R, demoPick(R.choose));
    tickRally(R, dt);
    for (const e of R.events) {
      const line = pickComment(CMT, e, realT);
      if (line) showCaption(line);
      if (e.type === 'choose') { if (!titleOn) { showChoice(e.scene, e.attack); sndSlow(); } }
      else if (e.type === 'chosen') { hideChoice(); if (e.action === null) showToast('時間切れ！', 1.0); }
      else if (e.type === 'floor') hideChoice();         // 選んでいる途中で床に落ちたら、ボタンを消す
      else if (e.type === 'explode') {
        lastBoom = { t: realT, x: e.x, z: e.z, side: e.side };
        sndBoom();
        spawnExplosion(e.x, e.z);
        showToast(e.side === 0 ? '味方コートで爆発！' : '相手コートで爆発！');
      }
      else if (e.type === 'point') {
        sndPoint(e.scorer === 0);
        setScore(e.score);
        if (e.score[e.scorer] < CFG.winScore) showToast(e.scorer === 0 ? '味方に 1 点！' : '相手に 1 点……', 1.4);   // 最後の 1 点は勝敗の画面に任せる
        if (!titleOn && lastBoom && realT - lastBoom.t < CFG.replay.keep - CFG.replay.after) startReplay();
      }
      else if (e.type === 'gameover') {
        if (titleOn) newGame(R);                          // タイトル中の試合は、終わったらそのまま次へ
        else if (replay) pendingResult = e;               // リプレイを見せてから勝敗の画面
        else showResult(e.winner, e.score);
      }
      else if (e.type === 'bump') showToast('ゴツン！', 0.8);
      else if (e.type === 'stick') addDecal(e);
      else if (e.type === 'crash') { FX.shake = Math.min(1.2, FX.shake + 0.35); sndCrash(); }   // 壁・天井に激突
      else if (e.type === 'hit') sndHit(e.kind);
      else if (e.type === 'land' || e.type === 'net') sndLand();
      else if (e.type === 'collide') sndCrash();
    }
    R.events.length = 0;
    if (R.state === 'choose') { setTimer(R.choose.left / CFG.choiceTime); setCount(R.choose.left); }
    const slow = R.state === 'choose' ? CFG.slowScale : 1;
    const shown = R.ball && !(R.state === 'boom' && R.boom.fired) ? R.ball : null;   // 爆発したら爆弾を消す
    const focus = R.ball ? R.ball.pos : { x: 0, y: 3, z: 0 };
    R.actors.forEach((a, i) => updatePlayer(players[i], a, dt, R.simT, focus));
    updateBombMesh(bombMesh, shown, dt * slow);
    updateFx(dt);
    updateCamera(dt, R.ball ? R.ball.pos.x : 0, R.state === 'boom' && R.boom.fired ? R.boom.hit : null);
    recordFrame(rec, realT, players, bombMesh, CFG.replay.keep);
    renderer.render(scene, camera);
  }
  frame();
})();
