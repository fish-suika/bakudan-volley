// ===== 選手の動き（three.js 非依存） =====
// actor = { id, team, x, z, y（跳んでいる高さ）, vy, home（仕事が無いとき戻る所）, base（定位置）, task, moving, lastHit }
// task  = { kind, ok, contact, h, at, pending, jump, jumpAt, jumped, jumpOnArrive, whiff, end, then, target, hold, contactAt, start }
function newActor(id, team, x, z) {
  return { id, team, x, z, y: 0, vy: 0, home: { x, z }, base: { x, z }, task: null, moving: false, lastHit: null };
}
function dirOf(team) { return team === 0 ? 1 : -1; }      // 相手コートの向き（x の符号）
function riseTime() { return Math.sqrt(2 * CFG.jumpH / CFG.gravity); }   // 踏み切ってから最高点まで

// dt 進める。地上なら task.at（仕事が無ければ home）へ走る。jumpAt を過ぎたら跳ぶ
function stepActor(a, dt, simT) {
  const t = a.task;
  if (a.y > 0) {
    a.vy -= CFG.gravity * dt;
    a.y += a.vy * dt;
    if (a.y <= 0) { a.y = 0; a.vy = 0; }
  }
  const g = t ? t.at : a.home;
  a.moving = false;
  if (a.y === 0) {
    const dx = g.x - a.x, dz = g.z - a.z, d = Math.hypot(dx, dz), step = CFG.runSpeed * dt;
    if (d > 0.02) {
      a.moving = true;
      if (d <= step) { a.x = g.x; a.z = g.z; } else { a.x += dx / d * step; a.z += dz / d * step; }
    }
  }
  if (t && t.jumpOnArrive && t.jumpAt == null && !a.moving) t.jumpAt = simT;
  if (t && t.jumpAt != null && !t.jumped && simT >= t.jumpAt && a.y === 0) {
    t.jumped = true;
    a.vy = Math.sqrt(2 * CFG.gravity * CFG.jumpH);
    a.y = 1e-4;
  }
}

// 爆弾に触れたか。'hit' / 'miss' / null（まだ）
function checkContact(a, ball) {
  const t = a.task;
  if (!t || !t.contact || t.pending || !ball.live || ball.held) return null;
  const p = ball.pos;
  if (t.kind === 'block') {                               // 手の範囲（ネット側へ 0.15m、肩幅＋腕 ±0.45m、跳んだ高さ＋1.8〜2.3m）に触れたら止める
    const hx = a.x + dirOf(a.team) * 0.15, r = CFG.ball.r;
    const dx = Math.max(Math.abs(p.x - hx) - 0.12, 0);
    const dz = Math.max(Math.abs(p.z - a.z) - 0.45, 0);
    const dy = Math.max(a.y + 1.8 - p.y, p.y - (a.y + 2.3), 0);
    if (a.y > 0.1 && dx * dx + dy * dy + dz * dz <= r * r) return 'hit';
    if (p.x * dirOf(a.team) < -1.0) return 'miss';        // 自陣の奥へ抜けた
    return null;
  }
  if (ball.vel.y > 0 || p.y > t.h) return null;           // まだ上にある
  if (Math.hypot(p.x - a.x, p.z - a.z) <= CFG.reach) return t.whiff ? 'miss' : 'hit';
  if (p.y < t.h - 0.6) return 'miss';
  return null;
}
