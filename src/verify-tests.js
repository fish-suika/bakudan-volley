// ===== 検証ハーネス =====
const __results = [];
function test(name, fn) {
  try { fn(); __results.push({ name, ok: true }); }
  catch (e) { __results.push({ name, ok: false, why: e.message }); }
}
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a !== b) throw new Error((label ? label + ': ' : '') + 'expected ' + b + ' but got ' + a);
}
function near(actual, expected, tol, label) {
  if (!(Math.abs(actual - expected) <= tol)) throw new Error((label ? label + ': ' : '') + 'expected ' + expected + ' ±' + tol + ' but got ' + actual);
}

// ===== 爆弾の物理 =====
const noRand = () => 0;
function run(b, sec, players) {          // sec 秒ぶん 1/60 ずつ進め、床に触れたらその結果を返す
  for (let i = 0; i < Math.round(sec * 60); i++) {
    const h = stepBall(b, 1 / 60, players || [], noRand);
    if (h) return h;
  }
  return null;
}

test('sideOf: ネットより左は 0（味方）、右は 1（敵）', () => {
  eq([sideOf(-0.1), sideOf(0.1), sideOf(-8), sideOf(14)], [0, 1, 0, 1]);
});

test('空中では爆発しない（放物線の途中）', () => {
  const b = newBall(-4, 5, 0); b.vel = { x: 2, y: 4, z: 0 };
  eq(run(b, 0.3), null);
  eq(b.live, true);
});

test('床に触れたら爆発の結果を返し、live が false になる', () => {
  const b = newBall(-4, 3, 1);
  const h = run(b, 1.0);
  eq(h && h.side, 0);
  near(h.x, -4, 0.001); near(h.z, 1, 0.001);
  eq(b.live, false);
  eq(stepBall(b, 1 / 60, [], noRand), null, '2回目は返さない');
});

test('天井に当たっても爆発せず、下向きに跳ね返る', () => {
  const b = newBall(-5, 11, 0); b.vel = { x: 0, y: 10, z: 0 };
  eq(run(b, 0.1), null);
  eq(b.vel.y < 0, true, '下向き');
  eq(b.pos.y + CFG.ball.r <= CFG.gym.ceil, true, '天井より下');
});

test('壁に当たっても爆発せず、跳ね返る', () => {
  const b = newBall(-14.5, 5, 0); b.vel = { x: -10, y: 0, z: 0 };
  eq(run(b, 0.05), null);
  eq(b.vel.x > 0, true);
  const c = newBall(0 - 3, 5, 10.5); c.vel = { x: 0, y: 0, z: 10 };
  eq(run(c, 0.05), null);
  eq(c.vel.z < 0, true, '手前の壁（見えないが当たる）');
});

test('ネットに当たっても爆発せず、こちら側へ弱く跳ね返る', () => {
  const b = newBall(-1, 2.0, 0); b.vel = { x: 10, y: 0, z: 0 };
  eq(run(b, 0.15), null);
  eq(b.vel.x < 0, true, '戻ってくる');
  eq(b.pos.x < 0, true, 'まだ味方側');
  eq(Math.abs(b.vel.x) < 5, true, '弱く');
});

test('ネットの上は越えられる', () => {
  const b = newBall(-2, 3.5, 0); b.vel = { x: 10, y: 0, z: 0 };
  eq(run(b, 0.4), null);
  eq(b.pos.x > 0, true);
});

test('速くても薄いネットをすり抜けない', () => {
  const b = newBall(-1, 2.0, 0); b.vel = { x: 40, y: 0, z: 0 };
  for (let i = 0; i < 10; i++) stepBall(b, 1 / 30, [], noRand);
  eq(b.pos.x < 0, true);
});

test('選手の体に当たっても爆発せず、跳ね返る', () => {
  const b = newBall(-3.5, 1.2, 0); b.vel = { x: -10, y: 0, z: 0 };
  eq(run(b, 0.15, [{ x: -5, z: 0 }]), null);
  eq(b.live, true);
  eq(b.vel.x > 0, true);
});

test('選手の頭の上に落ちても爆発せず、上に弾む（横にも少し押される）', () => {
  const b = newBall(-5, 3, 0);
  eq(run(b, 0.5, [{ x: -5, z: 0 }]), null);
  eq(b.live, true);
  eq(b.pos.y > CFG.player.h, true, '頭より上');
  eq(Math.abs(b.vel.x) + Math.abs(b.vel.z) > 0.5, true, '横に押される');
});

test('コートの外の床でも爆発する。どちら側かは x の符号だけで決まる', () => {
  const b = newBall(12, 1, 9);
  const h = run(b, 1.0);
  eq(h && h.side, 1);
  eq(inCourt(h.x, h.z), false);
  eq([inCourt(-8.9, 4.4), inCourt(-9.1, 0), inCourt(0, 4.6)], [true, false, false]);
});

// ===== 打ち出し =====
test('shotVelocity: 右から打つと、狙った左の地点で床に触れる', () => {
  const from = { x: 7, y: 2.6, z: 0 };
  const b = newBall(from.x, from.y, from.z);
  b.vel = shotVelocity(from, { x: -5, z: 2 }, 7);
  const h = run(b, 10);
  eq(h && h.side, 0);
  near(h.x, -5, 0.05, 'x'); near(h.z, 2, 0.05, 'z');
});

test('shotVelocity: 左から低めの最高点で打っても、ネットを越えて右の地点に落ちる', () => {
  const from = { x: -7, y: 2.6, z: 0 };
  const b = newBall(from.x, from.y, from.z);
  b.vel = shotVelocity(from, { x: 6, z: -3 }, 5);
  const h = run(b, 10);
  eq(h && h.side, 1);
  near(h.x, 6, 0.05, 'x'); near(h.z, -3, 0.05, 'z');
});

test('shotVelocity: 最高点が打つ高さより低くても壊れない（真上に上がらず、すぐ落ちる）', () => {
  const v = shotVelocity({ x: -2, y: 3, z: 0 }, { x: -4, z: 0 }, 1);
  eq(Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z), true);
  eq(v.x < 0, true);
});

// ===== 予測と強打 =====
test('predictDescent: 爆弾を動かさずに、床に触れる場所を当てる', () => {
  const from = { x: 7, y: 2.6, z: 0 };
  const b = newBall(from.x, from.y, from.z);
  b.vel = shotVelocity(from, { x: -5, z: 2 }, 7);
  const p = predictDescent(b, CFG.ball.r + 0.01);
  near(p.x, -5, 0.05, 'x'); near(p.z, 2, 0.05, 'z');
  eq(p.t > 1 && p.t < 3, true, '時間');
  eq([b.pos.x, b.pos.y, b.live], [7, 2.6, true], '元の爆弾は動かない');
});

test('predictDescent: 上りの途中ではなく、降りてくるときの高さで答える', () => {
  const b = newBall(-3, 1, 0); b.vel = { x: 0, y: 6, z: 0 };
  const p = predictDescent(b, 2);
  eq(p.t > 0.6, true);
});

test('spikeVelocity: 高い打点からの強打は、ネットを越えて狙った所に落ちる', () => {
  const from = { x: -1.3, y: 3.4, z: -3.5 };
  const b = newBall(from.x, from.y, from.z);
  b.vel = spikeVelocity(from, { x: 4.5, z: -3.8 }, 17);
  const h = run(b, 3);
  eq(h && h.side, 1);
  near(h.x, 4.5, 0.1, 'x'); near(h.z, -3.8, 0.1, 'z');
  eq(Math.hypot(b.vel.x, b.vel.z) > 10, true, '強い');
});

test('spikeVelocity: 打点が低ければ速さを落としてネットを越える', () => {
  const from = { x: -1.3, y: 2.6, z: 0 };
  const b = newBall(from.x, from.y, from.z);
  b.vel = spikeVelocity(from, { x: 5, z: 0 }, 17);
  const h = run(b, 3);
  eq(h && h.side, 1);
  near(h.x, 5, 0.1, 'x');
});

// ===== 選手の動き =====
function stepFor(a, sec) { let t = 0; for (let i = 0; i < Math.round(sec * 60); i++) { t += 1 / 60; stepActor(a, 1 / 60, t); } }

test('stepActor: task.at へ秒速 runSpeed で走り、着いたら止まる。仕事が無ければ home へ戻る', () => {
  const a = newActor(0, 0, -5, 0);
  a.task = { at: { x: -2, z: 0 } };
  stepFor(a, 0.2);
  near(a.x, -5 + CFG.runSpeed * 0.2, 0.05);
  eq(a.moving, true);
  stepFor(a, 1);
  eq([a.x, a.moving], [-2, false]);
  a.task = null;
  stepFor(a, 1);
  eq(a.x, -5, 'home');
});

test('stepActor: jumpAt を過ぎると跳び、jumpH まで上がって床に戻る', () => {
  const a = newActor(0, 0, -5, 0);
  a.task = { at: { x: -5, z: 0 }, jumpAt: 0 };
  let top = 0;
  for (let i = 0; i < 90; i++) { stepActor(a, 1 / 60, i / 60); top = Math.max(top, a.y); }
  near(top, CFG.jumpH, 0.05);
  eq(a.y, 0);
  eq(a.task.jumped, true);
});

test('checkContact: 降りてきた爆弾が高さ h・手の届く距離なら hit、届かずに下を通れば miss、空振りなら miss', () => {
  const a = newActor(0, 0, -3, 0);
  a.task = { kind: 'receive', contact: true, h: 0.8, at: { x: -3, z: 0 } };
  const b = newBall(-3.3, 0.79, 0); b.vel = { x: 0, y: -3, z: 0 };
  eq(checkContact(a, b), 'hit');
  b.pos.y = 2; eq(checkContact(a, b), null, 'まだ上');
  b.pos = { x: -6, y: 0.15, z: 0 }; eq(checkContact(a, b), 'miss', '遠くの下を通った');
  b.pos = { x: -6, y: 0.5, z: 0 }; eq(checkContact(a, b), null, 'まだ分からない');
  a.task.whiff = true; b.pos = { x: -3.3, y: 0.79, z: 0 };
  eq(checkContact(a, b), 'miss', '空振り');
  a.task = { kind: 'receive', contact: true, pending: true, h: 0.8, at: { x: -3, z: 0 } };
  eq(checkContact(a, b), null, '行き先が決まる前は触らない');
});

// ===== 結果表示 =====
(function () {
  const out = document.getElementById('out');
  let pass = 0;
  for (const r of __results) {
    const d = document.createElement('div');
    d.className = 'r ' + (r.ok ? 'ok' : 'ng');
    d.textContent = r.name;
    out.appendChild(d);
    if (r.ok) pass++;
    else { const w = document.createElement('div'); w.className = 'why'; w.textContent = r.why; out.appendChild(w); }
  }
  const sum = pass + '/' + __results.length;
  document.getElementById('sum').textContent = (pass === __results.length ? 'すべて通過 ' : '失敗あり ') + sum;
  document.title = (pass === __results.length ? 'PASS ' : 'FAIL ') + sum;
})();
