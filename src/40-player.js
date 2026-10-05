// ===== 選手の人型（コードで組む。関節を回してポーズを作る） =====
// 関節は腰（hips）を根元にした木構造。体の前はローカルの +Z、左は +X
const TEAM_COLORS = [{ shirt: 0x2f6fdf, shorts: 0x1d2b4f }, { shirt: 0xd8433a, shorts: 0x4a1d1d }];

function makePlayer(scene, team) {
  const col = TEAM_COLORS[team];
  const lam = c => new THREE.MeshLambertMaterial({ color: c });
  const skin = lam(0xeec39a), shirt = lam(col.shirt), shorts = lam(col.shorts), shoe = lam(0xf2f2f2), hair = lam(0x2a1d14);
  const j = {};
  const grp = (name, parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); j[name] = g; return g; };
  const part = (parent, geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
  const limb = (len, r0, r1) => new THREE.CylinderGeometry(r0, r1, len, 10);

  const root = new THREE.Group();
  scene.add(root);
  const tumble = new THREE.Group();                       // 吹っ飛びで体の中心のまわりに回すための入れ物
  tumble.position.y = CFG.blast.center;
  root.add(tumble);
  const inner = new THREE.Group();
  inner.position.y = -CFG.blast.center;
  tumble.add(inner);
  const hips = grp('hips', inner, 0, CFG.player.hipY, 0);
  part(hips, new THREE.BoxGeometry(0.34, 0.2, 0.22), shorts, 0, 0, 0);
  const spine = grp('spine', hips, 0, 0.08, 0);
  part(spine, new THREE.BoxGeometry(0.38, 0.56, 0.24), shirt, 0, 0.3, 0);
  const neck = grp('neck', spine, 0, 0.6, 0);
  part(neck, limb(0.1, 0.05, 0.06), skin, 0, 0.03, 0);
  const head = grp('head', neck, 0, 0.1, 0);
  head.rotation.order = 'YXZ';                            // 横を向いてから上下を向く
  part(head, new THREE.SphereGeometry(0.12, 16, 12), skin, 0, 0.1, 0);
  part(head, new THREE.SphereGeometry(0.125, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), hair, 0, 0.115, -0.01);

  for (const [s, L] of [[1, 'L'], [-1, 'R']]) {
    const sh = grp('shoulder' + L, spine, s * 0.25, 0.54, 0);
    part(sh, limb(0.12, 0.07, 0.065), shirt, 0, -0.04, 0);          // 袖
    part(sh, limb(0.3, 0.05, 0.045), skin, 0, -0.15, 0);
    const el = grp('elbow' + L, sh, 0, -0.3, 0);
    part(el, limb(0.27, 0.045, 0.04), skin, 0, -0.135, 0);
    part(el, new THREE.SphereGeometry(0.05, 10, 8), skin, 0, -0.3, 0);   // 手
    const hp = grp('hip' + L, hips, s * 0.1, -0.05, 0);
    part(hp, limb(0.45, 0.085, 0.065), skin, 0, -0.225, 0);
    part(hp, limb(0.2, 0.095, 0.09), shorts, 0, -0.08, 0);          // 短パンの裾
    const kn = grp('knee' + L, hp, 0, -0.45, 0);
    part(kn, limb(0.42, 0.06, 0.045), skin, 0, -0.21, 0);
    part(kn, new THREE.BoxGeometry(0.11, 0.08, 0.24), shoe, 0, -0.41, 0.04);
  }
  return { root, tumble, j, team, phase: Math.random() * 6, look: { yaw: 0, pitch: 0 }, tx: 0, tz: 0 };
}

// 足元を (x, z) に置き、ネットのほうを向かせる
function placePlayer(pl, x, z) {
  pl.root.position.set(x, 0, z);
  pl.root.rotation.y = pl.team === 0 ? Math.PI / 2 : -Math.PI / 2;
}

function applyPose(pl, pose) {
  for (const name of JOINTS) {
    const r = pose[name] || [0, 0, 0];
    pl.j[name].rotation.set(r[0], r[1], r[2]);
  }
  pl.j.hips.position.y = CFG.player.hipY - (pose.hipsDrop || 0);
}

// 頭（と少し胴）を target へ向ける。ポーズを当てたあとに呼ぶ
function lookAtTarget(pl, target, dt) {
  const p = pl.root.position;
  const dx = target.x - p.x, dy = target.y - (p.y + 1.75), dz = target.z - p.z;
  let yaw = Math.atan2(dx, dz) - pl.root.rotation.y;
  yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
  yaw = Math.max(-1.3, Math.min(1.3, yaw));
  const pitch = Math.max(-1.0, Math.min(0.7, -Math.atan2(dy, Math.hypot(dx, dz))));
  const k = Math.min(1, dt * 8);
  pl.look.yaw += (yaw - pl.look.yaw) * k;
  pl.look.pitch += (pitch - pl.look.pitch) * k;
  pl.j.head.rotation.y += pl.look.yaw * 0.7;
  pl.j.head.rotation.x += pl.look.pitch;
  pl.j.spine.rotation.y += pl.look.yaw * 0.3;
}

// 選手の見た目を actor（15-actors.js）に合わせる。ポーズは目標へなめらかに寄せ、focus（爆弾）を目で追う。
// 吹っ飛んでいる間（actor.fly）は、体の中心で回し、倒れて、起き上がる
function updatePlayer(pl, a, dt, simT, focus) {
  const f = a.fly;
  const target = f ? flyPose(f, simT) : motionFor(a, simT);
  if (!pl.cur) pl.cur = { hipsDrop: 0 };
  const k = Math.min(1, dt * (f ? 14 : 24));               // クリップの速い動き（振り下ろし）が鈍らないよう、普段は速めに寄せる
  for (const name of JOINTS) {
    const to = target[name] || [0, 0, 0];
    const c = pl.cur[name] || (pl.cur[name] = [0, 0, 0]);
    for (let i = 0; i < 3; i++) c[i] += (to[i] - c[i]) * k;
  }
  pl.cur.hipsDrop += ((target.hipsDrop || 0) - pl.cur.hipsDrop) * k;
  applyPose(pl, pl.cur);
  if (f) { placeFlying(pl, f, dt); return; }
  pl.tumble.rotation.set(0, 0, 0);
  const yaw = facingFor(a);                               // 遠くへは走る向き、近くへはネットを向いたまま。なめらかに回す
  const dyaw = Math.atan2(Math.sin(yaw - pl.root.rotation.y), Math.cos(yaw - pl.root.rotation.y));
  pl.root.rotation.y += dyaw * Math.min(1, dt * 10);
  pl.tx = pl.tz = 0;
  pl.root.position.set(a.x, a.y, a.z);
  if (!a.moving && a.y === 0 && !a.task) pl.j.hips.position.y += Math.sin(simT * 3 + pl.phase) * 0.012;   // 構えたまま小さく揺れる
  lookAtTarget(pl, focus, dt);
}

// 吹っ飛んでいる人の置き方。空中・ぶら下がり・張り付きは物理の回転のまま。
// 滑る・倒れているときは、あお向けかうつ伏せの近いほうへ倒し、起き上がるときは立てる
function placeFlying(pl, f, dt) {
  const B = CFG.blast, T = pl.tumble, G = CFG.gym;
  let yaw = pl.team === 0 ? Math.PI / 2 : -Math.PI / 2;   // 普段の向き（ネットのほう）
  if (f.state === 'stick') {                              // 壁に張り付くときは、壁のほうを向いて大の字になる
    const onX = Math.abs(f.pos.x) + B.r >= G.halfX - 0.01;
    yaw = onX ? Math.atan2(Math.sign(f.pos.x), 0) : Math.atan2(0, Math.sign(f.pos.z));
  }
  const dy = Math.atan2(Math.sin(yaw - pl.root.rotation.y), Math.cos(yaw - pl.root.rotation.y));
  pl.root.rotation.y += dy * Math.min(1, dt * 10);
  if (f.state === 'air' || f.state === 'hang' || f.state === 'stick') {
    T.rotation.set(f.rx, 0, f.rz);
    pl.tx = Math.atan2(Math.sin(f.rx), Math.cos(f.rx));
    pl.tz = Math.atan2(Math.sin(f.rz), Math.cos(f.rz));
    pl.root.position.set(f.pos.x, f.pos.y - B.center, f.pos.z);
    return;
  }
  const up = f.state === 'getup' ? Math.min(1, f.t / B.getupTime) : 0;
  const goal = f.state === 'getup' ? 0 : (pl.tx >= 0 ? Math.PI / 2 : -Math.PI / 2);
  const k = Math.min(1, dt * 8);
  pl.tx += (goal - pl.tx) * k;
  pl.tz += (0 - pl.tz) * k;
  T.rotation.set(pl.tx, 0, pl.tz);
  const cy = 0.28 + (B.center - 0.28) * up;              // 寝ているとき体の中心は床から 0.28m
  pl.root.position.set(f.pos.x, cy - B.center, f.pos.z);
}
