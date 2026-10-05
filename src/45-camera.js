// ===== カメラ（中継の角度：コートの横、斜め上から） =====
const CAM = { cam: null, x: 0 };

// focusX：爆弾の x。少しだけ追って横に振る
function updateCamera(dt, focusX) {
  const c = CFG.camera, s = FX.shake;
  CAM.x += (focusX * c.follow - CAM.x) * Math.min(1, dt * 2);
  CAM.cam.position.set(CAM.x + (Math.random() - 0.5) * s, c.y + (Math.random() - 0.5) * s, c.z);
  CAM.cam.lookAt(CAM.x, c.lookY, 0);
}
