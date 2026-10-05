// ===== 爆弾の見た目（黒い球にバレーボールの縫い目、口金と導火線）と床の影 =====
function makeBombMesh(scene) {
  const r = CFG.ball.r;
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), new THREE.MeshPhongMaterial({ color: 0x1b1b1f, shininess: 80 }));
  body.castShadow = true;
  g.add(body);
  const seamMat = new THREE.MeshBasicMaterial({ color: 0xe8e8e8 });
  for (const rot of [[0, 0, 0], [Math.PI / 2, 0, 0], [0, 0, Math.PI / 2]]) {
    const s = new THREE.Mesh(new THREE.TorusGeometry(r * 1.005, 0.012, 6, 40), seamMat);
    s.rotation.set(rot[0], rot[1], rot[2]);
    g.add(s);
  }
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.08, 12), new THREE.MeshLambertMaterial({ color: 0x777777 }));
  cap.position.y = r + 0.02;
  g.add(cap);
  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 6), new THREE.MeshLambertMaterial({ color: 0xc8b48a }));
  fuse.position.set(0.03, r + 0.12, 0);
  fuse.rotation.z = -0.4;
  g.add(fuse);
  const spark = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd04a }));
  spark.position.set(0.07, r + 0.2, 0);
  g.add(spark);
  scene.add(g);
  // 真下の丸い影（高い所にあっても落ちる場所が分かるように）
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(r, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);
  return { g, spark, shadow };
}

// ball が null なら隠す。飛んでいる間は進む向きに転がす
function updateBombMesh(m, ball, dt) {
  m.g.visible = m.shadow.visible = !!ball;
  if (!ball) return;
  m.g.position.set(ball.pos.x, ball.pos.y, ball.pos.z);
  if (ball.live) {
    m.g.rotation.x += ball.vel.z / CFG.ball.r * dt;
    m.g.rotation.z -= ball.vel.x / CFG.ball.r * dt;
  }
  m.spark.scale.setScalar(0.7 + Math.random() * 0.8);    // 導火線の火花のちらつき（時間で爆発はしない）
  m.shadow.position.set(ball.pos.x, 0.015, ball.pos.z);
  const k = Math.max(0.4, 1 - ball.pos.y / 14);
  m.shadow.scale.setScalar(k * 1.2);
  m.shadow.material.opacity = 0.35 * k;
}
