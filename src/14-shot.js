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
