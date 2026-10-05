// ===== 爆発（一瞬の静止と白い光 → 火の玉 2 重 → 爆風の輪 → 煙・火花・床板の破片 → 揺れ。煙は数秒で晴れる） =====
const FX = { scene: null, light: null, geo: null, list: [], shake: 0, freeze: 0, glow: 0 };

function initFx(scene) {
  FX.scene = scene;
  FX.light = new THREE.PointLight(0xffb040, 0, 40);       // 最初から置いておく（途中で光を足すと描画が一瞬止まるため）
  scene.add(FX.light);
  FX.geo = {                                              // 形は使い回す（材質は 1 つずつ作って、消えるときに捨てる）
    sphere: new THREE.SphereGeometry(1, 20, 14),
    small: new THREE.SphereGeometry(1, 6, 4),
    box: new THREE.BoxGeometry(1, 1, 1),
    ring: new THREE.RingGeometry(0.85, 1, 48),
  };
}

function addPart(kind, geo, mat, pos, vel, life, size, extra) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(pos.x, pos.y, pos.z);
  m.scale.setScalar(size);
  FX.scene.add(m);
  FX.list.push(Object.assign({ kind, m, vel, life, size, t: 0 }, extra));
}

function spawnExplosion(x, z) {
  const rnd = Math.random, basic = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o === undefined ? 1 : o, depthWrite: false });
  // 一瞬の静止・白い光・揺れ
  FX.freeze = CFG.fx.freeze;
  FX.shake = 1.0;
  FX.glow = 9;
  FX.light.position.set(x, 2.5, z);
  const flash = document.getElementById('flash');
  flash.style.transition = 'none';
  flash.style.opacity = '0.85';
  requestAnimationFrame(() => { flash.style.transition = 'opacity .35s'; flash.style.opacity = '0'; });
  // 火の玉（白っぽい芯と、外側のオレンジ）と、床を走る輪
  addPart('fire', FX.geo.sphere, basic(0xfff2b0), { x, y: 0.8, z }, null, 0.6, 0.6, { grow: 4.5, hue: 0.13 });
  addPart('fire', FX.geo.sphere, basic(0xff8a20, 0.9), { x, y: 1.0, z }, null, 1.0, 0.8, { grow: 6.5, hue: 0.07 });
  addPartRing(x, z);
  // 煙：まわりに広がりながら上がり、ゆっくり薄くなる（＝煙が晴れる）
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2, r = 0.5 + rnd() * 2;
    const mat = new THREE.MeshLambertMaterial({ color: 0x5a5a5a, transparent: true, opacity: 0.5, depthWrite: false });
    addPart('smoke', FX.geo.sphere, mat, { x: x + Math.cos(a) * r, y: 0.5 + rnd() * 2, z: z + Math.sin(a) * r },
      { x: Math.cos(a) * (1 + rnd() * 1.5), y: 0.8 + rnd() * 1.2, z: Math.sin(a) * (1 + rnd() * 1.5) }, 3.2 + rnd() * 1.2, 1.1 + rnd() * 0.8);
  }
  // 火花
  for (let i = 0; i < 36; i++) {
    const a = rnd() * Math.PI * 2, up = 0.3 + rnd() * 0.9, sp = 8 + rnd() * 8;
    addPart('spark', FX.geo.small, basic(0xffd060), { x, y: 0.6, z },
      { x: Math.cos(a) * sp * (1 - up * 0.5), y: sp * up, z: Math.sin(a) * sp * (1 - up * 0.5) }, 0.8 + rnd() * 0.6, 0.07);
  }
  // 床板の破片
  for (let i = 0; i < 12; i++) {
    const a = rnd() * Math.PI * 2, sp = 4 + rnd() * 5;
    const mat = new THREE.MeshLambertMaterial({ color: 0xb07840, transparent: true, opacity: 1 });
    addPart('debris', FX.geo.box, mat, { x, y: 0.3, z },
      { x: Math.cos(a) * sp, y: 6 + rnd() * 6, z: Math.sin(a) * sp }, 2.5, 1,
      { dims: [0.35 + rnd() * 0.3, 0.05, 0.12 + rnd() * 0.1], spin: { x: rnd() * 12 - 6, y: rnd() * 12 - 6, z: rnd() * 12 - 6 } });
  }
}

function addPartRing(x, z) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
  addPart('ring', FX.geo.ring, mat, { x, y: 0.03, z }, null, 0.9, 1);
  FX.list[FX.list.length - 1].m.rotation.x = -Math.PI / 2;
}

function updateFx(dt) {
  for (const p of FX.list) {
    p.t += dt;
    const a = Math.min(1, p.t / p.life), m = p.m, v = p.vel;
    if (p.kind === 'fire') {
      m.scale.setScalar(p.size + p.grow * Math.sqrt(a));
      m.material.opacity = (1 - a) * (1 - a);
      m.material.color.setHSL(p.hue * (1 - a), 1, 0.65 - 0.4 * a);
    } else if (p.kind === 'ring') {
      m.scale.setScalar(1 + 15 * a);
      m.material.opacity = 0.85 * (1 - a);
    } else if (p.kind === 'smoke') {
      m.position.x += v.x * dt; m.position.y += v.y * dt; m.position.z += v.z * dt;
      const drag = Math.max(0, 1 - dt * 0.7);
      v.x *= drag; v.z *= drag;
      m.scale.setScalar(p.size * (1 + 1.3 * a));
      m.material.opacity = 0.5 * Math.pow(1 - a, 1.5);   // 濃すぎると爆心のまわりが何も見えないので薄め
    } else if (p.kind === 'spark') {
      v.y -= CFG.gravity * dt;
      m.position.x += v.x * dt; m.position.y += v.y * dt; m.position.z += v.z * dt;
      if (m.position.y < 0.05) { m.position.y = 0.05; v.y = -v.y * 0.3; }
      m.scale.setScalar(p.size * (1 - a));
    } else if (p.kind === 'debris') {
      v.y -= CFG.gravity * dt;
      m.position.x += v.x * dt; m.position.y += v.y * dt; m.position.z += v.z * dt;
      if (m.position.y < 0.03) { m.position.y = 0.03; v.y = -v.y * 0.35; v.x *= 0.7; v.z *= 0.7; p.spin.x *= 0.6; p.spin.y *= 0.6; p.spin.z *= 0.6; }
      m.rotation.x += p.spin.x * dt; m.rotation.y += p.spin.y * dt; m.rotation.z += p.spin.z * dt;
      m.scale.set(p.dims[0], p.dims[1], p.dims[2]);
      m.material.opacity = a < 0.7 ? 1 : (1 - a) / 0.3;
    }
  }
  for (let i = FX.list.length - 1; i >= 0; i--) {
    const p = FX.list[i];
    if (p.t < p.life) continue;
    FX.scene.remove(p.m);
    p.m.material.dispose();                               // 形は使い回しなので捨てない
    FX.list.splice(i, 1);
  }
  FX.glow = Math.max(0, FX.glow - dt * 12);
  FX.light.intensity = FX.glow;
  FX.shake = Math.max(0, FX.shake - dt * 1.2);
}
