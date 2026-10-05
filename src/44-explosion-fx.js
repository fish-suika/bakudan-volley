// ===== 爆発（Phase 1 は火の玉と爆風の輪。本格的な演出は Phase 4） =====
const FX = { scene: null, light: null, list: [], shake: 0 };
const FX_LIFE = 0.9;                                      // 秒

function initFx(scene) {
  FX.scene = scene;
  FX.light = new THREE.PointLight(0xffb040, 0, 30);       // 最初から置いておく（途中で光を足すと描画が一瞬止まるため）
  scene.add(FX.light);
}

function spawnExplosion(x, z) {
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xffa020, transparent: true }));
  ball.position.set(x, 0.5, z);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40),
    new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.03, z);
  FX.scene.add(ball, ring);
  FX.light.position.set(x, 2, z);
  FX.list.push({ t: 0, ball, ring });
  FX.shake = 0.6;
}

function updateFx(dt) {
  let glow = 0;
  for (const f of FX.list) {
    f.t += dt;
    const a = Math.min(1, f.t / FX_LIFE);
    f.ball.scale.setScalar(0.5 + 4 * Math.sqrt(a));
    f.ball.material.opacity = 1 - a;
    f.ball.material.color.setHSL(0.09 - 0.07 * a, 1, 0.6 - 0.3 * a);
    f.ring.scale.setScalar(1 + 12 * a);
    f.ring.material.opacity = 0.8 * (1 - a);
    glow = Math.max(glow, 6 * (1 - a));
  }
  for (let i = FX.list.length - 1; i >= 0; i--) {
    const f = FX.list[i];
    if (f.t < FX_LIFE) continue;
    FX.scene.remove(f.ball, f.ring);
    for (const m of [f.ball, f.ring]) { m.geometry.dispose(); m.material.dispose(); }
    FX.list.splice(i, 1);
  }
  FX.light.intensity = glow;
  FX.shake = Math.max(0, FX.shake - dt * 1.2);
}
