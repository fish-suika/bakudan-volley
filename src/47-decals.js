// ===== 壁の人型の跡（張り付いた所に大の字のへこみが残る。試合中は増えていき、最大 12 個） =====
const DECALS = { scene: null, list: [], geo: null, mat: null };

function initDecals(scene) {
  DECALS.scene = scene;
  const rect = (cx, cy, w, h, ang) => {                   // 中心 (cx, cy)、幅 w・長さ h、ang だけ傾けた長方形
    const s = new THREE.Shape(), c = Math.cos(ang), n = Math.sin(ang);
    const pts = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([x, y]) => [cx + x * c - y * n, cy + x * n + y * c]);
    s.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < 4; i++) s.lineTo(pts[i][0], pts[i][1]);
    s.closePath();
    return s;
  };
  const head = new THREE.Shape();
  head.absarc(0, 0.72, 0.17, 0, Math.PI * 2, false);
  const shapes = [
    head,
    rect(0, 0.15, 0.44, 0.78, 0),                         // 胴
    rect(0.48, 0.72, 0.17, 0.8, -1.0), rect(-0.48, 0.72, 0.17, 0.8, 1.0),   // 腕（斜め上へ開く）
    rect(0.3, -0.65, 0.2, 0.95, 0.4), rect(-0.3, -0.65, 0.2, 0.95, -0.4),   // 脚（斜め下へ開く）
  ];
  DECALS.geo = new THREE.ShapeGeometry(shapes);
  DECALS.mat = new THREE.MeshLambertMaterial({ color: 0x6b7670, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
}

// stick の出来事（axis, sign, x, y, z）から跡を足す。手前の壁（見えない）には残さない
function addDecal(e) {
  if (e.axis === 'z' && e.sign > 0) return;
  const G = CFG.gym, m = new THREE.Mesh(DECALS.geo, DECALS.mat);
  const y = clamp(e.y, 1.0, G.ceil - 1.0);
  if (e.axis === 'x') { m.position.set(e.sign * (G.halfX - 0.01), y, e.z); m.rotation.y = -e.sign * Math.PI / 2; }
  else { m.position.set(e.x, y, e.sign * (G.halfZ - 0.01)); m.rotation.y = 0; }
  m.rotation.z = (Math.random() - 0.5) * 0.6;            // 少し傾いて張り付く
  m.receiveShadow = true;
  DECALS.scene.add(m);
  DECALS.list.push(m);
  if (DECALS.list.length > 12) DECALS.scene.remove(DECALS.list.shift());
}

function clearDecals() {
  for (const m of DECALS.list) DECALS.scene.remove(m);
  DECALS.list.length = 0;
}
