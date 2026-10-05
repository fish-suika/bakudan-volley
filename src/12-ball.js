// ===== 爆弾の物理（three.js 非依存） =====
// 爆弾は床に触れたときだけ爆発する。天井・壁・ネット・選手には跳ね返るだけ。
function newBall(x, y, z) {
  return { pos: { x, y, z }, vel: { x: 0, y: 0, z: 0 }, live: true };
}
function sideOf(x) { return x < 0 ? 0 : 1; }             // 0 = 味方（左）、1 = 敵（右）
function inCourt(x, z) { return Math.abs(x) <= CFG.court.halfLen && Math.abs(z) <= CFG.court.halfWid; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

// dt 秒進める。床に触れたら { x, z, side } を返して live=false にする。それ以外は null。
// players: [{ x, z }] 選手の足元。rand: 0..1 の乱数（テストで固定するため）
function stepBall(b, dt, players, rand) {
  if (!b.live) return null;
  rand = rand || Math.random;
  const n = Math.max(1, Math.ceil(dt / CFG.ball.maxStep - 1e-9));   // すり抜けないよう細かく刻む
  const h = dt / n, g = CFG.gravity;
  for (let i = 0; i < n; i++) {
    b.pos.x += b.vel.x * h;
    b.pos.y += (b.vel.y - 0.5 * g * h) * h;              // 重力一定なので、この刻みでも放物線は正確
    b.pos.z += b.vel.z * h;
    b.vel.y -= g * h;
    const hit = collideBall(b, players || [], rand);
    if (hit) return hit;
  }
  return null;
}

function collideBall(b, players, rand) {
  const r = CFG.ball.r, G = CFG.gym, e = CFG.ball.bounce, p = b.pos, v = b.vel;
  // 床：ここだけ爆発する
  if (p.y - r <= 0) {
    p.y = r;
    b.live = false;
    return { x: p.x, z: p.z, side: sideOf(p.x) };
  }
  // 天井・壁（手前の壁は見えないが当たる）
  if (p.y + r > G.ceil)   { p.y = G.ceil - r;   if (v.y > 0) v.y = -v.y * e; }
  if (p.x - r < -G.halfX) { p.x = -G.halfX + r; if (v.x < 0) v.x = -v.x * e; }
  if (p.x + r >  G.halfX) { p.x =  G.halfX - r; if (v.x > 0) v.x = -v.x * e; }
  if (p.z - r < -G.halfZ) { p.z = -G.halfZ + r; if (v.z < 0) v.z = -v.z * e; }
  if (p.z + r >  G.halfZ) { p.z =  G.halfZ - r; if (v.z > 0) v.z = -v.z * e; }
  // ネット（白帯から下 1m の薄い板）
  const N = CFG.net;
  sphereBox(b, { minX: -N.thick / 2, maxX: N.thick / 2, minY: N.bottom, maxY: N.top, minZ: -N.halfWid, maxZ: N.halfWid }, CFG.ball.netBounce);
  for (const pl of players) hitPlayer(b, pl, rand);
  return null;
}

// 球と箱。重なっていれば外へ押し出し、面の向きの速さを反転して e 倍にする
function sphereBox(b, box, e) {
  const p = b.pos, v = b.vel, r = CFG.ball.r;
  let dx = p.x - clamp(p.x, box.minX, box.maxX);
  let dy = p.y - clamp(p.y, box.minY, box.maxY);
  let dz = p.z - clamp(p.z, box.minZ, box.maxZ);
  const d2 = dx * dx + dy * dy + dz * dz;
  if (d2 >= r * r) return false;
  let d = Math.sqrt(d2);
  if (d < 1e-6) {                                         // 中心が箱の中：x の向きに押し出す（ネットは薄いので）
    const left = p.x < (box.minX + box.maxX) / 2;
    p.x = left ? box.minX - r : box.maxX + r;
    dx = left ? -1 : 1; dy = 0; dz = 0; d = 1;
  } else {
    const k = (r - d) / d;
    p.x += dx * k; p.y += dy * k; p.z += dz * k;
  }
  const nx = dx / d, ny = dy / d, nz = dz / d;
  const vn = v.x * nx + v.y * ny + v.z * nz;
  if (vn < 0) { const j = (1 + e) * vn; v.x -= j * nx; v.y -= j * ny; v.z -= j * nz; }
  return true;
}

// 選手は足元から高さ h の円柱。横から当たれば横へ、頭の上なら上へ弾く
function hitPlayer(b, pl, rand) {
  const R = CFG.player.r, H = CFG.player.h, r = CFG.ball.r, e = CFG.ball.playerBounce, p = b.pos, v = b.vel;
  const dx = p.x - pl.x, dz = p.z - pl.z, d = Math.hypot(dx, dz);
  if (p.y - r >= H || d >= R + r) return false;
  if (p.y > H && d < R) {                                 // 頭の上：上へ弾く。真上で止まらないよう横にも押す
    p.y = H + r;
    if (v.y < 0) v.y = -v.y * e;
    const a = rand() * Math.PI * 2;
    v.x += Math.cos(a) * 1.2; v.z += Math.sin(a) * 1.2;
    return true;
  }
  const nx = d < 1e-6 ? 1 : dx / d, nz = d < 1e-6 ? 0 : dz / d;
  p.x = pl.x + nx * (R + r); p.z = pl.z + nz * (R + r);
  const vn = v.x * nx + v.z * nz;
  if (vn < 0) { const j = (1 + e) * vn; v.x -= j * nx; v.z -= j * nz; }
  return true;
}
