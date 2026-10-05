// ===== 体育館・コート・ネット・光 =====
function buildGym(scene) {
  const C = CFG.court, N = CFG.net, G = CFG.gym;
  const mat = c => new THREE.MeshLambertMaterial({ color: c });
  function box(w, h, d, color, x, y, z, cast) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    m.position.set(x, y, z);
    m.receiveShadow = true;
    if (cast) m.castShadow = true;
    scene.add(m);
    return m;
  }
  scene.background = new THREE.Color(0x20242a);

  // 床（木）とコート面
  box(G.halfX * 2, 0.1, G.halfZ * 2, 0xc89a62, 0, -0.05, 0);
  box(C.halfLen * 2, 0.01, C.halfWid * 2, 0xd77a3c, 0, 0.005, 0);
  // 線（幅 5cm）：外周、エンドライン、アタックライン（ネットから 3m）、センターライン
  const L = 0.05, ly = 0.012, white = 0xffffff;
  box(C.halfLen * 2 + L, 0.004, L, white, 0, ly,  C.halfWid);
  box(C.halfLen * 2 + L, 0.004, L, white, 0, ly, -C.halfWid);
  for (const x of [-C.halfLen, -3, 0, 3, C.halfLen]) box(L, 0.004, C.halfWid * 2, white, x, ly, 0);

  // 壁と天井（手前の壁はカメラの前なので作らない。当たり判定だけある）
  box(G.halfX * 2, G.ceil, 0.2, 0x9fb0a8, 0, G.ceil / 2, -G.halfZ - 0.1);
  box(0.2, G.ceil, G.halfZ * 2, 0xa9b6ad, -G.halfX - 0.1, G.ceil / 2, 0);
  box(0.2, G.ceil, G.halfZ * 2, 0xa9b6ad,  G.halfX + 0.1, G.ceil / 2, 0);
  box(G.halfX * 2, 0.2, G.halfZ * 2, 0x5b6168, 0, G.ceil + 0.1, 0);
  box(G.halfX * 2, 1.2, 0.05, 0x3f6f8f, 0, 0.6, -G.halfZ + 0.03);   // 奥の壁の腰板

  // 天井の照明
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff6dd });
  for (const x of [-9, -3, 3, 9]) for (const z of [-5, 1, 7]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.6), lampMat);
    m.position.set(x, G.ceil - 0.05, z);
    scene.add(m);
  }

  // ネット：支柱・網・上の白帯
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, N.top + 0.1, 12), mat(0xdddddd));
    post.position.set(0, (N.top + 0.1) / 2, s * (N.halfWid + 0.1));
    post.castShadow = true;
    scene.add(post);
  }
  const netMat = new THREE.MeshLambertMaterial({ color: 0x111111, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
  const net = new THREE.Mesh(new THREE.PlaneGeometry(N.halfWid * 2, N.top - N.bottom), netMat);
  net.rotation.y = Math.PI / 2;
  net.position.set(0, (N.top + N.bottom) / 2, 0);
  scene.add(net);
  box(0.04, 0.07, N.halfWid * 2, white, 0, N.top - 0.035, 0, true);

  // 光
  scene.add(new THREE.HemisphereLight(0xfff8ee, 0x8a6a48, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 0.55);
  sun.position.set(-4, 14, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 12, bottom: -12, near: 1, far: 40 });
  scene.add(sun);
}
