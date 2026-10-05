// ===== 選手の動き（three.js 非依存） =====
// actor = { id, team, x, z, y（跳んでいる高さ）, vy, home（仕事が無いとき戻る所）, base（定位置）, task, moving, lastHit }
// task  = { kind, ok, contact, h, at, pending, jump, jumpAt, jumped, jumpOnArrive, whiff, end, then, target, hold, contactAt, start }
function newActor(id, team, x, z) {
  return { id, team, x, z, y: 0, vy: 0, home: { x, z }, base: { x, z }, task: null, moving: false, lastHit: null, stun: 0, fly: null,
    stride: 0, mdx: 0, mdz: 0, moveLeft: 0, dvx: 0, dvz: 0, landT: null, soot: false };
}
function dirOf(team) { return team === 0 ? 1 : -1; }      // 相手コートの向き（x の符号）
function riseTime() { return Math.sqrt(2 * CFG.jumpH / CFG.gravity); }   // 踏み切ってから最高点まで

// dt 進める。地上なら task.at（仕事が無ければ home）へ走る。jumpAt を過ぎたら跳ぶ。
// アタックの助走（planApproach）があれば、approachStart までは手前で待ち、そこから踏み切り位置へ走って跳び、空中で前へ流れる
function stepActor(a, dt, simT) {
  const t = a.task;
  if (a.y > 0) {
    a.vy -= CFG.gravity * dt;
    a.y += a.vy * dt;
    a.x += a.dvx * dt; a.z += a.dvz * dt;
    a.x = a.team === 0 ? Math.min(a.x, -0.35) : Math.max(a.x, 0.35);   // 空中でもネットは越えない
    if (a.y <= 0) { a.y = 0; a.vy = 0; a.dvx = a.dvz = 0; a.landT = simT; }
  }
  let g = t ? t.at : a.home, speed = CFG.runSpeed;
  if (t && t.approachSpot && !t.jumped) {
    if (simT < t.approachStart) g = t.approachSpot;
    else {
      g = t.takeoff;
      const left = Math.max(0.05, t.jumpAt - simT);
      speed = Math.min(CFG.runSpeed * 1.2, Math.max(2, Math.hypot(g.x - a.x, g.z - a.z) / left));   // 踏み切りの時刻に着く速さ
    }
  }
  a.moving = false;
  if (a.stun > 0) a.stun = Math.max(0, a.stun - dt);
  const waiting = t && t.delay && simT < t.start + t.delay;   // 反応が遅れて、まだ動き出さない
  if (a.y === 0 && !waiting && !(a.stun > 0)) {
    const dx = g.x - a.x, dz = g.z - a.z, d = Math.hypot(dx, dz), step = speed * dt;
    if (d > 0.02) {
      a.moving = true;
      a.mdx = dx / d; a.mdz = dz / d; a.moveLeft = d;
      const moved = Math.min(d, step);
      a.stride += moved;
      if (d <= step) { a.x = g.x; a.z = g.z; } else { a.x += a.mdx * step; a.z += a.mdz * step; }
    }
  }
  if (t && t.jumpOnArrive && t.jumpAt == null && !a.moving) t.jumpAt = simT;
  if (t && t.jumpAt != null && !t.jumped && simT >= t.jumpAt && a.y === 0) {
    t.jumped = true;
    a.vy = Math.sqrt(2 * CFG.gravity * CFG.jumpH);
    a.y = 1e-4;
    if (t.approachSpot) {                                 // 助走の勢いで前へ流れ、最高点で打つ所の上に来る
      const r = riseTime();
      a.dvx = (t.at.x - a.x) / r; a.dvz = (t.at.z - a.z) / r;
    }
  }
}

// アタックの助走を決める（t.at・t.jumpAt が決まったあとに呼ぶ）
function planApproach(a) {
  const t = a.task, M = CFG.motion, d = dirOf(a.team), G = CFG.gym;
  t.takeoff = { x: t.at.x - d * M.broad, z: t.at.z };
  t.approachSpot = { x: clamp(t.at.x - d * M.approachDist, -G.halfX + 0.5, G.halfX - 0.5), z: t.at.z };
  t.approachStart = t.jumpAt - M.approachTime;
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

// 選手どうしが重ならないよう押し合う。2 人とも爆弾へ走っていてぶつかったら、よろけて少し動けない
function separateActors(R) {
  const A = R.actors, min = CFG.player.r * 2;
  for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
    const a = A[i], b = A[j];
    if (a.y > 0 || b.y > 0 || a.fly || b.fly) continue;
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
    if (d >= min) continue;
    const nx = d > 1e-6 ? dx / d : 1, nz = d > 1e-6 ? dz / d : 0, push = (min - d) / 2;
    a.x -= nx * push; a.z -= nz * push;
    b.x += nx * push; b.z += nz * push;
    const chasing = o => o.task && o.task.contact && o.moving && !(o.stun > 0);
    if (chasing(a) && chasing(b)) {
      a.stun = b.stun = CFG.ai.bumpStun;
      R.events.push({ type: 'bump', a, b });
    }
  }
}
