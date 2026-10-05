// ===== 吹っ飛び（three.js 非依存） =====
// 爆発で選手を体ごと飛ばす。体は中心の高さ center・半径 r の球として、天井・壁・床・ネット・他の選手に当たる
// actor.fly = { pos（体の中心）, vel, rx, rz（回転）, spinX, spinZ, state, t, hung }
// state: 'air' 飛んでいる / 'stick' 壁に張り付き→ずり落ちる / 'slide' 床を滑る / 'hang' ネットにぶら下がる / 'down' 倒れている / 'getup' 起き上がる
// 起き上がり終わると actor.fly は null に戻り、普段の動き（stepActor）に戻る

// 体ごと飛ばす（今の仕事は捨てる）
function launch(R, a, vel) {
  const B = CFG.blast;
  a.task = null; a.stun = 0; a.soot = true;   // 吹っ飛んだ人はすすだらけ
  a.fly = {
    pos: { x: a.x, y: a.y + B.center, z: a.z }, vel, rx: 0, rz: 0,
    spinX: (R.rand() - 0.5) * B.spin, spinZ: (R.rand() - 0.5) * B.spin, state: 'air', t: 0, hung: false,
  };
}

// 爆発（hit = { x, z, side }）で選手を飛ばす。爆発した側は全員、反対側は爆心の近くの人だけ軽く
function blastActors(R, hit) {
  const B = CFG.blast;
  for (const a of R.actors) a.soot = false;               // 前の爆発のすすは落ちる（次の爆発まではそのまま）
  for (const a of R.actors) {
    const dx = a.x - hit.x, dz = a.z - hit.z, d = Math.hypot(dx, dz);
    let k;
    if (a.team === hit.side) k = Math.max(B.minPower, 1 - d / B.radius);
    else if (d < B.nearRadius) k = B.nearPower * (1 - d / B.nearRadius);
    else continue;
    let nx, nz;
    if (d > 0.1) { nx = dx / d; nz = dz / d; }
    else { const ang = R.rand() * Math.PI * 2; nx = Math.cos(ang); nz = Math.sin(ang); }   // 真上で爆発したら向きはでたらめ
    nx += (a.x < 0 ? -1 : 1) * B.outward;                 // 自陣の奥（横の壁）のほうへ寄せる
    const nn = Math.hypot(nx, nz) || 1;
    nx /= nn; nz /= nn;
    nz *= nz > 0 ? B.zFront : B.zBack;                    // カメラのほう（+z）へはあまり飛ばさない（画面の外へ出るため）
    const jit = () => 1 + (R.rand() - 0.5) * 2 * B.jitter;
    const side = B.speed * k * jit();
    const up = B.up * k * jit() * (mishap(R, B.superChance) ? B.superMul : 1);
    launch(R, a, { x: nx * side, y: up, z: nz * side });
  }
}

// 体とネット（白帯から下 1m の薄い板）。引っかかったら true
function hitNetBody(a, R) {
  const f = a.fly, p = f.pos, v = f.vel, N = CFG.net, B = CFG.blast, r = B.r;
  const dx = p.x - clamp(p.x, -N.thick / 2, N.thick / 2);
  const dy = p.y - clamp(p.y, N.bottom, N.top);
  const dz = p.z - clamp(p.z, -N.halfWid, N.halfWid);
  const d = Math.hypot(dx, dy, dz);
  if (d >= r) return false;
  const side = p.x < 0 ? -1 : 1;
  if (!f.hung && mishap(R, B.netHang)) {                  // ネットに引っかかってぶら下がる
    f.hung = true; f.state = 'hang'; f.t = 0;
    p.x = side * 0.3; p.y = N.top - 0.35; p.z = clamp(p.z, -N.halfWid + 0.5, N.halfWid - 0.5);
    v.x = v.y = v.z = 0;
    R.events.push({ type: 'net', actor: a });
    return true;
  }
  if (d < 1e-6) {                                         // 中心がネットの中：来た側へ押し出す
    p.x = side * (N.thick / 2 + r);
    if (v.x * side < 0) v.x = -v.x * B.bounce;
    return false;
  }
  const k = (r - d) / d;
  p.x += dx * k; p.y += dy * k; p.z += dz * k;
  const nx = dx / d, ny = dy / d, nz = dz / d, vn = v.x * nx + v.y * ny + v.z * nz;
  if (vn < 0) { const j = (1 + B.bounce) * vn; v.x -= j * nx; v.y -= j * ny; v.z -= j * nz; }
  return false;
}

// 壁（x=±halfX, z=±halfZ）。速く当たったら張り付く（true）、遅ければ跳ね返る
function hitWallsBody(a, R, canStick) {
  const f = a.fly, p = f.pos, v = f.vel, G = CFG.gym, B = CFG.blast;
  for (const [ax, lim] of [['x', G.halfX], ['z', G.halfZ]]) {
    if (Math.abs(p[ax]) + B.r <= lim) continue;
    const s = Math.sign(p[ax]);
    p[ax] = s * (lim - B.r);
    if (v[ax] * s <= 0) continue;                         // 離れていく向き
    if (canStick && Math.abs(v[ax]) > B.stickSpeed) {
      f.state = 'stick'; f.t = 0;
      v.x = v.y = v.z = 0;
      R.events.push({ type: 'crash', actor: a, x: p.x, y: p.y, z: p.z });
      R.events.push({ type: 'stick', actor: a, axis: ax, sign: s, x: p.x, y: p.y, z: p.z });   // 壁の人型の跡を残す
      return true;
    }
    v[ax] = -v[ax] * B.bounce;
  }
  return false;
}

// 飛んでいる人を dt 進める
function stepFly(a, dt, R) {
  const f = a.fly, B = CFG.blast, G = CFG.gym, p = f.pos, v = f.vel;
  f.t += dt;
  if (f.state === 'air') {
    v.y -= CFG.gravity * dt;
    p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt;
    f.rx += f.spinX * dt; f.rz += f.spinZ * dt;
    if (p.y + B.r > G.ceil) {                             // 天井
      p.y = G.ceil - B.r;
      if (v.y > 0) { v.y = -v.y * B.bounce; R.events.push({ type: 'crash', actor: a, x: p.x, y: p.y, z: p.z }); }
    }
    if (!hitWallsBody(a, R, true) && !hitNetBody(a, R) && p.y - B.r <= 0) {   // 床
      p.y = B.r;
      R.events.push({ type: 'land', actor: a, x: p.x, z: p.z });
      if (v.y < -B.landSpeed) { v.y = -v.y * B.floorBounce; f.spinX *= 0.6; f.spinZ *= 0.6; }
      else { v.y = 0; f.state = 'slide'; f.t = 0; }
    }
  } else if (f.state === 'stick') {                       // 壁に張り付いて、少ししたらずり落ちる
    if (f.t > B.stickTime) {
      p.y -= B.slideDown * dt;
      if (p.y - B.r <= 0) { p.y = B.r; f.state = 'down'; f.t = 0; }
    }
  } else if (f.state === 'slide') {                       // 床を滑る
    const s = Math.hypot(v.x, v.z), ns = Math.max(0, s - B.friction * dt);
    if (s > 0) { v.x *= ns / s; v.z *= ns / s; }
    p.x += v.x * dt; p.z += v.z * dt;
    hitWallsBody(a, R, false);
    f.spinX *= Math.max(0, 1 - dt * 3); f.spinZ *= Math.max(0, 1 - dt * 3);
    if (ns < 0.3) { f.state = 'down'; f.t = 0; }
  } else if (f.state === 'hang') {                        // ネットにぶら下がって、落ちる
    if (f.t > B.hangTime) { f.state = 'air'; f.t = 0; v.x = (p.x < 0 ? -1 : 1) * 0.8; v.y = 0; v.z = 0; }
  } else if (f.state === 'down') {
    if (f.t > B.downTime) { f.state = 'getup'; f.t = 0; }
  } else if (f.state === 'getup') {
    if (f.t > B.getupTime) {
      a.x = p.x; a.z = p.z; a.y = 0; a.vy = 0; a.fly = null;
      R.events.push({ type: 'getup', actor: a });
      return;
    }
  }
  a.x = p.x; a.z = p.z;
}

// 飛んでいる体どうし、飛んでいる体と立っている人のぶつかり。立っている人は一緒に吹っ飛ぶ
function collideFlyers(R) {
  const A = R.actors, B = CFG.blast, min = B.r * 2;
  const airborne = o => o.fly && o.fly.state === 'air';
  for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
    const a = A[i], b = A[j];
    if (!airborne(a) && !airborne(b)) continue;
    if ((a.fly && !airborne(a)) || (b.fly && !airborne(b))) continue;   // 寝ている・張り付いている人とはぶつからない
    const pa = a.fly ? a.fly.pos : { x: a.x, y: B.center, z: a.z };
    const pb = b.fly ? b.fly.pos : { x: b.x, y: B.center, z: b.z };
    const dx = pb.x - pa.x, dy = pb.y - pa.y, dz = pb.z - pa.z, d = Math.hypot(dx, dy, dz);
    if (d >= min || d < 1e-6) continue;
    if (!b.fly || !a.fly) {                                // 立っている人に当たった：勢いを半分ずつ分ける
      const flyer = a.fly ? a : b, other = a.fly ? b : a, v = flyer.fly.vel;
      launch(R, other, { x: v.x * 0.5, y: Math.abs(v.y) * 0.5 + 3, z: v.z * 0.5 });
      v.x *= 0.5; v.y *= 0.5; v.z *= 0.5;
    } else {                                               // 飛んでいる体どうし：ぶつかる向きの速さを交換する
      const va = a.fly.vel, vb = b.fly.vel, nx = dx / d, ny = dy / d, nz = dz / d;
      const rel = (va.x - vb.x) * nx + (va.y - vb.y) * ny + (va.z - vb.z) * nz;
      if (rel <= 0) continue;                             // 離れていく向き
      const k = rel * 0.9;
      va.x -= k * nx; va.y -= k * ny; va.z -= k * nz;
      vb.x += k * nx; vb.y += k * ny; vb.z += k * nz;
    }
    R.events.push({ type: 'collide', a, b });
  }
}
