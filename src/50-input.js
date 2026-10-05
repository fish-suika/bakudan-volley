// ===== 入力（Phase 1 は試し用：床をクリック・タップすると爆弾が飛んでくる。Space でランダムな場所へ） =====
function initInput(canvas, camera, onFloor) {
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  canvas.addEventListener('pointerdown', e => {
    ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(floor, hit)) onFloor(hit.x, hit.z);
  });
  addEventListener('keydown', e => {
    if (e.code !== 'Space') return;
    e.preventDefault();
    const C = CFG.court;
    onFloor((Math.random() * 2 - 1) * C.halfLen, (Math.random() * 2 - 1) * C.halfWid);
  });
}
