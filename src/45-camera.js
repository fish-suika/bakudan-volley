// ===== カメラ（中継の角度：コートの横、斜め上から）。爆発の間は上を見上げて爆発のほうへ振り、天井まで飛ぶ人も入れる =====
const CAM = { cam: null, x: 0, y: null, lx: 0, ly: null, lz: 0 };

// focusX：爆弾の x（少しだけ追って横に振る）。boomAt：爆発した場所（爆発の間だけ）
function updateCamera(dt, focusX, boomAt) {
  const c = CFG.camera, s = FX.shake;
  const goal = boomAt
    ? { x: boomAt.x * 0.3, y: c.y, lx: boomAt.x * 0.45, ly: 5.0, lz: boomAt.z * 0.2 }
    : { x: focusX * c.follow, y: c.y, lx: focusX * c.follow, ly: c.lookY, lz: 0 };
  const k = Math.min(1, dt * (boomAt ? 3 : 1.5));
  for (const key in goal) CAM[key] = CAM[key] === null ? goal[key] : CAM[key] + (goal[key] - CAM[key]) * k;
  CAM.cam.position.set(CAM.x + (Math.random() - 0.5) * s, CAM.y + (Math.random() - 0.5) * s, c.z);
  CAM.cam.lookAt(CAM.lx, CAM.ly, CAM.lz);
}
