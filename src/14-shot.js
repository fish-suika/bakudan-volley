// ===== 打ち出しの計算（three.js 非依存） =====
// from から打ち出し、床からの高さ apex の最高点を通って、to（x, z）の地点で床に触れる初速を返す。
// 「床に触れる」は爆弾の中心が半径 r の高さになったとき。apex が打つ高さより低いときは打つ高さを最高点とする
function shotVelocity(from, to, apex) {
  const g = CFG.gravity, r = CFG.ball.r;
  const top = Math.max(apex, from.y + 0.01, r + 0.01);
  const vy = Math.sqrt(2 * g * (top - from.y));
  const t = vy / g + Math.sqrt(2 * (top - r) / g);          // 上がる時間＋最高点から床までの時間
  return { x: (to.x - from.x) / t, y: vy, z: (to.z - from.z) / t };
}

// 爆弾を試しに動かして（選手は無視）、高さ h まで降りてきたときの位置と、今からの時間を返す。
// 上りの途中で h を通っても数えない。先に床に触れるなら null
function predictDescent(ball, h, maxT) {
  const b = { pos: { ...ball.pos }, vel: { ...ball.vel }, live: true };
  const dt = 1 / 120;
  for (let t = 0; t < (maxT || 6); ) {
    if (stepBall(b, dt, [], () => 0.5)) return null;
    t += dt;
    if (b.vel.y < 0 && b.pos.y <= h) return { x: b.pos.x, z: b.pos.z, t };
  }
  return null;
}

// 強打：from から to（x, z の床）へ、横の速さ speed で叩き込む初速。
// ネットの白帯にかかるなら、速さを落として（＝山なりにして）越えられる速さを探す
function spikeVelocity(from, to, speed) {
  const g = CFG.gravity, r = CFG.ball.r, N = CFG.net;
  const dx = to.x - from.x, dz = to.z - from.z, dist = Math.hypot(dx, dz);
  for (let s = speed; s >= 6; s -= 0.5) {
    const t = dist / s;
    const v = { x: dx / t, y: (r - from.y + 0.5 * g * t * t) / t, z: dz / t };
    if (from.x * to.x >= 0) return v;                     // ネットを越えない打球は確かめない
    const tc = -from.x / v.x;                             // ネットの真上を通る時刻
    const yc = from.y + v.y * tc - 0.5 * g * tc * tc;
    if (yc - r > N.top + 0.05) return v;
  }
  return shotVelocity(from, to, from.y + 1.5);            // どうしても越えないなら山なりで
}
