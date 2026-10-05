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

test('ブロックは手の範囲に触れたときだけ止める', () => {
  const a = newActor(0, 0, -0.5, 0);
  a.y = 0.9;
  a.task = { kind: 'block', contact: true, ok: false, at: { x: -0.5, z: 0 } };
  const b = newBall(-0.35, 2.9, 0);
  eq(checkContact(a, b), 'hit', '手の位置');
  b.pos = { x: -0.35, y: 2.9, z: 1.3 }; eq(checkContact(a, b), null, '横に外れた');
  b.pos = { x: -0.35, y: 3.8, z: 0 }; eq(checkContact(a, b), null, '手より上');
});

test('stepActor: task.delay の間は動き出さない（反応の遅れ）', () => {
  const a = newActor(0, 0, -5, 0);
  a.task = { at: { x: -2, z: 0 }, delay: 0.3, start: 0 };
  stepFor(a, 0.2);
  eq(a.x, -5, 'まだ動かない');
  stepFor(a, 0.5);                                         // stepFor は時刻を 0 から数え直すので、遅れ（0.3 秒）より長く進める
  eq(a.x > -5, true, '動き出した');
});

test('stepActor: stun の間は動けず、時間がたつと戻る', () => {
  const a = newActor(0, 0, -5, 0);
  a.task = { at: { x: -2, z: 0 } };
  a.stun = 0.5;
  stepFor(a, 0.4);
  eq(a.x, -5);
  stepFor(a, 0.3);
  eq(a.stun, 0);
  eq(a.x > -5, true);
});

test('separateActors: 重なった選手は押し合って離れ、2 人とも爆弾へ走っていたらぶつかってよろける', () => {
  const R = { actors: [newActor(0, 0, -3, 0), newActor(1, 0, -2.6, 0)], events: [] };
  const [a, b] = R.actors;
  a.task = { kind: 'receive', contact: true, at: { x: 0, z: 0 } }; a.moving = true;
  b.task = { kind: 'receive', contact: true, at: { x: 0, z: 0 } }; b.moving = true;
  separateActors(R);
  near(Math.hypot(a.x - b.x, a.z - b.z), CFG.player.r * 2, 0.001, '離れた');
  eq(a.stun > 0 && b.stun > 0, true, 'よろけた');
  eq(R.events.some(e => e.type === 'bump'), true);
  a.stun = b.stun = 0; a.task = null;
  a.x = -3; b.x = -2.6;
  R.events.length = 0;
  separateActors(R);
  eq(R.events.length, 0, '片方だけなら押し合うだけ');
});

// ===== ラリー =====
const zero = () => 0;
function runFor(R, sec) {
  const ev = R.events.splice(0);
  for (let i = 0; i < Math.round(sec * 60); i++) { tickRally(R, 1 / 60); ev.push(...R.events.splice(0)); }
  return ev;
}
function runUntilChoose(R, sec) {                          // 'choose' が出るまで進め、その間の出来事を返す
  const ev = R.events.splice(0);
  for (let i = 0; i < Math.round(sec * 60) && !ev.some(e => e.type === 'choose'); i++) {
    tickRally(R, 1 / 60);
    ev.push(...R.events.splice(0));
  }
  return ev;
}
function runUntil(R, type, sec) {                          // type の出来事が出るまで（最大 sec 秒）進め、その間の出来事を返す
  const ev = R.events.splice(0);
  for (let i = 0; i < Math.round(sec * 60) && !ev.some(e => e.type === type); i++) {
    tickRally(R, 1 / 60);
    ev.push(...R.events.splice(0));
  }
  return ev;
}
const hitBy = (ev, a, kind) => ev.some(e => e.type === 'hit' && e.actor === a && e.kind === kind);
const boomSide = ev => { const e = ev.find(e => e.type === 'explode'); return e ? e.side : null; };
function quietRally() { const R = newRally(zero); R.idle[1] = true; return R; }   // 敵が受けない（Phase 2 までのテスト用）
function enemyAttack(R) {                                  // 試し：敵がネット際でトスを上げ、もう 1 人がアタックしてくる
  startPoint(R, 1);
  for (const a of R.actors) a.task = null;
  R.events.length = 0;
  const setter = R.actors[2], hitter = R.actors[3];
  setter.home = { x: 2.5, z: 0 }; setter.x = 2.5; setter.z = 0;
  R.ball = newBall(2.5, 2.3, 0);
  R.ball.vel = shotVelocity(R.ball.pos, { x: CFG.shots.set.toX, z: hitter.base.z * 0.5 }, CFG.shots.set.apex);
  afterHit(R, setter, { kind: 'toss', ok: true });
}
function withAI(changes, fn) {                             // CFG.ai を一時的に変えて試す
  const old = {};
  for (const k in changes) { old[k] = CFG.ai[k]; CFG.ai[k] = changes[k]; }
  try { fn(); } finally { Object.assign(CFG.ai, old); }
}

test('startPoint(0)：プレイヤーがエンドラインの外で爆弾を持ち、①サーブ番の選択になる', () => {
  const R = quietRally();
  startPoint(R, 0);
  eq([R.state, R.choose.scene, R.ball.held === R.me], ['choose', 'serve', true]);
  eq(R.me.x, -CFG.serveSpot);
  eq(R.events.some(e => e.type === 'choose' && e.scene === 'serve'), true);
});

test('① サーブを選ぶと、構えてからトスを上げて打ち、相手コートで爆発する', () => {
  const R = quietRally();
  startPoint(R, 0);
  choose(R, 'serve');
  const ev = runFor(R, 5);
  eq(hitBy(ev, R.me, 'serve'), true);
  eq(boomSide(ev), 1);
});

test('① 時間切れなら自動でサーブする', () => {
  const R = quietRally();
  startPoint(R, 0);
  const ev = runFor(R, CFG.choiceTime + 0.1);
  eq(ev.some(e => e.type === 'chosen' && e.action === null), true);
  eq(R.state, 'play');
  eq(R.me.task && R.me.task.kind, 'serve');
});

test('① ブロックを選ぶと、爆弾を持ったままネット際で跳んで戻り、もう一度選ぶ', () => {
  const R = quietRally();
  startPoint(R, 0);
  R.events.length = 0;
  choose(R, 'block');
  eq(R.me.task && R.me.task.kind, 'blockNoop');
  const ev = runUntilChoose(R, 6);
  eq(ev.some(e => e.type === 'choose' && e.scene === 'serve'), true);
  eq(R.ball.held === R.me, true);
  eq(ev.some(e => e.type === 'explode'), false);
});

test('相手のサーブにもブロックとアタックを選べる：ブロックは空振りで味方がカバー、アタックは直接打ち返しに行く', () => {
  const R = quietRally();
  startPoint(R, 1);
  runUntilChoose(R, 4);
  choose(R, 'block');
  eq([R.state, R.me.task.kind, R.me.task.ok, R.mate.task && R.mate.task.kind], ['play', 'block', false, 'receive']);
  const R2 = quietRally();
  startPoint(R2, 1);
  runUntilChoose(R2, 4);
  choose(R2, 'attack');
  eq([R2.state, R2.me.task.kind], ['play', 'direct']);
});

test('敵のサーブを打たれた瞬間に ②（アタックではない）の選択になる', () => {
  const R = quietRally();
  startPoint(R, 1);
  const ev = runUntilChoose(R, 4);
  const c = ev.find(e => e.type === 'choose');
  eq(c && [c.scene, c.attack], ['incoming', false]);
  eq(hitBy(ev, R.actors[2], 'serve'), true);
});

test('② レシーブ → 味方がトス → ③ の選択 → アタックで相手コートに爆発', () => {
  const R = quietRally();
  startPoint(R, 1);
  runUntilChoose(R, 4);
  choose(R, 'receive');
  const ev = runUntilChoose(R, 6);
  eq(hitBy(ev, R.me, 'receive'), true, '自分がレシーブ');
  eq(hitBy(ev, R.mate, 'toss'), true, '味方がトス');
  eq(R.state === 'choose' && R.choose.scene, 'tossed');
  choose(R, 'attack');
  const ev2 = runFor(R, 4);
  eq(hitBy(ev2, R.me, 'attack'), true, '自分がアタック');
  eq(boomSide(ev2), 1);
});

test('③ でブロックを選ぶと、ネット際で跳ぶだけで爆弾には触らない', () => {
  const R = quietRally();
  startPoint(R, 1);
  runUntilChoose(R, 4);
  choose(R, 'receive');
  runUntilChoose(R, 6);
  choose(R, 'block');
  const ev = runFor(R, 4);
  eq(ev.some(e => e.type === 'hit' && e.actor === R.me), false);
  eq(boomSide(ev) !== null, true, '爆発はする');
});

test('② 時間切れ（味方に任せる）なら味方がレシーブし、自分が自動でトスし、味方がアタックする', () => {
  const R = quietRally();
  startPoint(R, 1);
  runUntilChoose(R, 4);
  choose(R, null);
  const ev = runFor(R, 6);
  eq(hitBy(ev, R.mate, 'receive'), true, '味方がレシーブ');
  eq(hitBy(ev, R.me, 'toss'), true, '自分が自動でトス');
  eq(hitBy(ev, R.mate, 'attack'), true, '味方がアタック');
  eq(boomSide(ev), 1);
});

test('② でサーブを選ぶと、その場で空振りし、味方がカバーしてレシーブする', () => {
  const R = quietRally();
  startPoint(R, 1);
  runUntilChoose(R, 4);
  choose(R, 'serve');
  eq(R.me.task.kind, 'whiff');
  const ev = runFor(R, 3);
  eq(hitBy(ev, R.mate, 'receive'), true);
});

test('敵がトスを上げた瞬間に ②（アタックが来る）の選択になり、ブロックで止めて相手コートに落とせる', () => {
  const R = quietRally();
  enemyAttack(R);
  const c = R.events.find(e => e.type === 'choose');
  eq(c && [c.scene, c.attack], ['incoming', true]);
  choose(R, 'block');
  const ev = runFor(R, 5);
  eq(hitBy(ev, R.actors[3], 'attack'), true, '敵がアタック');
  eq(hitBy(ev, R.me, 'block'), true, 'ブロックで止めた');
  eq(boomSide(ev), 1);
});

// ===== 点数と勝敗 =====
test('爆発してしばらくすると点が入り、全員が歩いて定位置へ戻ってから、取られた側がサーブする', () => {
  const R = quietRally();
  startPoint(R, 0);
  choose(R, 'serve');
  const ev = runUntil(R, 'point', 5 + CFG.afterBoom + CFG.blast.maxTime);
  const p = ev.find(e => e.type === 'point');
  eq(p && [p.scorer, p.score], [0, [1, 0]]);
  eq(R.score, [1, 0]);
  const ev2 = runUntilChoose(R, 8);
  eq(ev2.some(e => e.type === 'hit' && e.kind === 'serve' && e.actor.team === 1), true, '敵がサーブ');
  eq(R.choose && R.choose.scene, 'incoming');
});

test('3 点目で試合が終わり、newGame で 0-0 から自分のサーブで始まる', () => {
  const R = quietRally();
  startPoint(R, 0);
  let ev = [];
  for (let k = 0; k < CFG.winScore; k++) {
    onFloor(R, { x: 5, z: 0, side: 1 });
    ev = ev.concat(runUntil(R, 'point', CFG.explodeDelay + CFG.afterBoom + CFG.blast.maxTime));
  }
  eq(R.state, 'over');
  eq(R.winner, 0);
  eq(ev.some(e => e.type === 'gameover' && e.winner === 0), true);
  newGame(R);
  eq([R.score, R.state, R.choose.scene], [[0, 0], 'choose', 'serve']);
});

test('敵のサーブは 2 人が交代で打つ', () => {
  const R = quietRally();
  startPoint(R, 1);
  const first = R.ball.held;
  startPoint(R, 1);
  eq(first !== R.ball.held && first.team === 1 && R.ball.held.team === 1, true);
});


// ===== AI =====
test('敵 AI：こちらのサーブを近いほうがレシーブし、相方がトスし、アタックが来る（②アタック）', () => {
  const R = newRally(zero);
  startPoint(R, 0);
  R.events.length = 0;                                     // サーブの選択の出来事を捨てる（runUntilChoose がすぐ止まらないように）
  choose(R, 'serve');
  const ev = runUntilChoose(R, 8);
  eq(hitBy(ev, R.actors[2], 'receive'), true, '近いほう（z=-2）がレシーブ');
  eq(hitBy(ev, R.actors[3], 'toss'), true, '相方がトス');
  eq(R.choose && [R.choose.scene, R.choose.attack], ['incoming', true]);
});

test('敵 AI：rand が 0 ならミスは起きない（反応の遅れは最短、2 人目は向かわない）', () => {
  const R = newRally(zero);
  startPoint(R, 0);
  choose(R, 'serve');
  runFor(R, 2.3);                                          // サーブを打った直後
  const t2 = R.actors[2].task, t3 = R.actors[3].task;
  eq(t2 && t2.kind, 'receive');
  near(t2.delay, CFG.ai.delay[0], 1e-9);
  eq(t3, null);
});

test('敵 AI：bothGo なら 2 人とも同じ球へ向かう', () => {
  withAI({ bothGo: 1 }, () => {
    const R = newRally(zero);
    startPoint(R, 0);
    choose(R, 'serve');
    runFor(R, 2.3);
    eq([R.actors[2].task && R.actors[2].task.kind, R.actors[3].task && R.actors[3].task.kind], ['receive', 'receive']);
  });
});

test('敵 AI：earlyJump ならアタックのジャンプが早すぎて空振りになる', () => {
  withAI({ earlyJump: 1 }, () => {
    const R = newRally(zero);
    startPoint(R, 0);
    R.events.length = 0;
    choose(R, 'serve');
    runUntilChoose(R, 8);
    const t = R.actors[2].task;
    eq(t && [t.kind, t.whiff], ['attack', true]);
  });
});

test('敵 AI：blockTry なら、こちらのアタックにアタッカーへ近いほうがブロックに跳ぶ', () => {
  withAI({ blockTry: 1 }, () => {
    const R = newRally(zero);
    startPoint(R, 1);
    runUntilChoose(R, 4);
    choose(R, 'receive');
    runUntilChoose(R, 6);
    choose(R, 'attack');
    const blk = R.actors.find(a => a.team === 1 && a.task && a.task.kind === 'block');
    eq(!!blk, true);
    const other = R.actors.find(a => a.team === 1 && a !== blk);
    eq(Math.abs(blk.z - R.me.task.at.z) <= Math.abs(other.z - R.me.task.at.z), true, '近いほう');
  });
});

test('味方 AI：bothGo なら、自分がレシーブを選んでも味方も向かってしまう', () => {
  withAI({ bothGo: 1 }, () => {
    const R = newRally(zero);
    startPoint(R, 1);
    runUntilChoose(R, 4);
    choose(R, 'receive');
    eq([R.me.task.kind, R.mate.task && R.mate.task.kind], ['receive', 'receive']);
  });
});

test('味方 AI：カバーのレシーブにも反応の遅れがある', () => {
  withAI({ slowChance: 1 }, () => {
    const R = newRally(zero);
    startPoint(R, 1);
    runUntilChoose(R, 4);
    choose(R, null);
    near(R.mate.task.delay, CFG.ai.delay[0] + CFG.ai.slowDelay, 1e-9);
  });
});

// ===== 吹っ飛び =====
function withBlast(changes, fn) {                          // CFG.blast を一時的に変えて試す
  const old = {};
  for (const k in changes) { old[k] = CFG.blast[k]; CFG.blast[k] = changes[k]; }
  try { fn(); } finally { Object.assign(CFG.blast, old); }
}
function soloR(...actors) { return { actors, events: [], rand: zero }; }
function flyFor(R, a, sec) { for (let i = 0; i < Math.round(sec * 60) && a.fly; i++) stepFly(a, 1 / 60, R); }

test('blastActors: 爆発した側の 2 人は上へ・外へ飛び、反対側の遠い人は飛ばない', () => {
  const R = quietRally();
  startPoint(R, 0);
  blastActors(R, { x: 5, z: 0, side: 1 });
  const [me, mate, e2, e3] = R.actors;
  eq([!!me.fly, !!mate.fly, !!e2.fly, !!e3.fly], [false, false, true, true]);
  eq(e2.fly.vel.y > 0 && e2.fly.vel.z < 0, true, 'z=-2 の人は -z へ');
  eq(e3.fly.vel.z > 0, true, 'z=+2 の人は +z へ');
  eq(e2.task, null);
});

test('blastActors: 反対側でも爆心の近くなら、軽く飛ぶ', () => {
  const R = quietRally();
  startPoint(R, 0);
  R.mate.x = -1; R.mate.z = 0;
  R.actors[2].x = 2; R.actors[2].z = 0;
  blastActors(R, { x: 1, z: 0, side: 1 });
  const sp = a => Math.hypot(a.fly.vel.x, a.fly.vel.y, a.fly.vel.z);
  eq(!!R.mate.fly, true);
  eq(sp(R.mate) < sp(R.actors[2]), true);
});

test('blastActors: superChance なら上へ異常に強く飛ぶ', () => {
  const R1 = quietRally(); startPoint(R1, 0);
  blastActors(R1, { x: 5, z: 0, side: 1 });
  withBlast({ superChance: 1 }, () => {
    const R2 = quietRally(); startPoint(R2, 0);
    blastActors(R2, { x: 5, z: 0, side: 1 });
    near(R2.actors[2].fly.vel.y, R1.actors[2].fly.vel.y * CFG.blast.superMul, 1e-9);
  });
});

test('stepFly: 天井に当たっても突き抜けず、下へ跳ね返る（crash）', () => {
  const a = newActor(0, 0, -5, 0), R = soloR(a);
  launch(R, a, { x: 0, y: 25, z: 0 });
  let top = 0;
  for (let i = 0; i < 50; i++) { stepFly(a, 1 / 60, R); top = Math.max(top, a.fly.pos.y); }   // 天井で跳ね返って、まだ落ちている途中まで
  eq(top <= CFG.gym.ceil - CFG.blast.r + 1e-9, true);
  eq(a.fly.vel.y < 0, true);
  eq(R.events.some(e => e.type === 'crash'), true);
});

test('stepFly: 速く壁に当たると張り付き、ずり落ちて倒れ、起き上がる', () => {
  const a = newActor(0, 0, -13, 0), R = soloR(a);
  launch(R, a, { x: -15, y: 3, z: 0 });
  flyFor(R, a, 0.3);
  eq(a.fly.state, 'stick');
  near(a.fly.pos.x, -(CFG.gym.halfX - CFG.blast.r), 1e-9);
  flyFor(R, a, 4);
  eq(a.fly, null, '起き上がった');
  eq(a.y, 0);
  near(a.x, -(CFG.gym.halfX - CFG.blast.r), 1e-9);
});

test('stepFly: 床に落ちると何メートルも滑り、倒れてから起き上がる', () => {
  const a = newActor(0, 0, -5, 0), R = soloR(a);
  launch(R, a, { x: -8, y: 2, z: 0 });
  const states = new Set();
  for (let i = 0; i < 600 && a.fly; i++) { states.add(a.fly.state); stepFly(a, 1 / 60, R); }
  eq(['slide', 'down', 'getup'].every(s => states.has(s)), true, '滑る → 倒れる → 起き上がる');
  eq(a.x < -9, true, '4m 以上滑った');
  eq(a.fly, null);
});

test('stepFly: netHang ならネットに引っかかってぶら下がり、しばらくして落ちる', () => {
  withBlast({ netHang: 1 }, () => {
    const a = newActor(0, 0, -1, 0), R = soloR(a);
    launch(R, a, { x: 6, y: 3, z: 0 });
    flyFor(R, a, 0.3);
    eq(a.fly.state, 'hang');
    eq(R.events.some(e => e.type === 'net'), true);
    flyFor(R, a, CFG.blast.hangTime + 4);
    eq(a.fly, null);
  });
});

test('collideFlyers: 飛んできた人が立っている人に当たると、その人も吹っ飛ぶ', () => {
  const a = newActor(0, 0, -5, 0), b = newActor(1, 0, -4, 0), R = soloR(a, b);
  launch(R, a, { x: 6, y: 0.5, z: 0 });
  for (let i = 0; i < 20 && !b.fly; i++) { stepFly(a, 1 / 60, R); collideFlyers(R); }
  eq(!!b.fly, true);
  eq(b.fly.vel.x > 0, true, '同じ向きへ');
  eq(R.events.some(e => e.type === 'collide'), true);
});

test('ラリー：爆発で吹っ飛んだ人が起き上がるまで点は入らず、起き上がったら入る', () => {
  const R = quietRally();
  startPoint(R, 0);
  onFloor(R, { x: 5, z: 0, side: 1 });
  const ev = runFor(R, CFG.explodeDelay + CFG.afterBoom + 0.1);
  eq(ev.some(e => e.type === 'explode'), true);
  eq(R.actors[2].fly !== null || R.actors[3].fly !== null, true, 'まだ飛んでいる人がいる');
  eq(ev.some(e => e.type === 'point'), false, 'まだ点は入らない');
  const ev2 = runUntil(R, 'point', CFG.blast.maxTime);
  eq(ev2.some(e => e.type === 'point'), true);
  eq(R.actors.every(a => !a.fly) || R.state === 'reset', true);
});

test('ラリー：startPoint は飛んでいる人も定位置に戻す', () => {
  const R = quietRally();
  startPoint(R, 0);
  blastActors(R, { x: 5, z: 0, side: 1 });
  startPoint(R, 0);
  eq(R.actors.every(a => a.fly === null), true);
});

// ===== モーション =====
test('blendPose: 2 つのポーズの間を k で混ぜる（無い関節は 0、hipsDrop も混ぜる）', () => {
  const p = blendPose({ hipsDrop: 0.2, spine: [1, 0, 0] }, { kneeL: [2, 0, 0] }, 0.25);
  eq(p.spine, [0.75, 0, 0]);
  eq(p.kneeL, [0.5, 0, 0]);
  near(p.hipsDrop, 0.15, 1e-9);
  eq(p.head, [0, 0, 0]);
});

test('sampleClip: キーの時刻ではそのポーズ、間はなめらかに混ぜ、範囲の外は端のポーズ', () => {
  const clip = [[0, 'ready'], [1, 'receive']];
  eq(sampleClip(clip, 0).spine, POSES.ready.spine);
  eq(sampleClip(clip, 1).spine, POSES.receive.spine);
  eq(sampleClip(clip, 5).spine, POSES.receive.spine);
  eq(sampleClip(clip, -5).spine, POSES.ready.spine);
  near(sampleClip(clip, 0.5).spine[0], (POSES.ready.spine[0] + POSES.receive.spine[0]) / 2, 1e-9);
});

test('クリップ：時刻は増える順で、ポーズの名前はすべて POSES にある', () => {
  for (const k in CLIPS) {
    const c = CLIPS[k];
    for (let i = 0; i < c.length; i++) {
      eq(!!POSES[c[i][1]], true, k + ' の ' + c[i][1]);
      if (i > 0) eq(c[i][0] > c[i - 1][0], true, k + ' の時刻');
    }
  }
});

test('新しいポーズの hipsDrop は、脚の縦の長さに合っている（足が床から 3cm 以上浮かない・沈まない）', () => {
  for (const name of ['armsBack', 'landing', 'receiveReady', 'receivePush', 'tossReady', 'blockReady', 'blockDip', 'approachReady']) {
    const p = POSES[name];
    for (const s of ['L', 'R']) {
      const hip = (p['hip' + s] || [0, 0, 0])[0], knee = (p['knee' + s] || [0, 0, 0])[0];
      const len = 0.45 * Math.cos(hip) + 0.45 * Math.cos(hip + knee);
      eq(Math.abs((0.9 - len) - (p.hipsDrop || 0)) < 0.06 || s === 'R' && name === 'approachReady', true, name + ' ' + s + ' の脚 ' + len.toFixed(3));
    }
  }
});

function nearJoint(p, q, joint, label) {                  // ポーズ p と q の関節 joint の角度が（小数の誤差の範囲で）同じ
  for (let i = 0; i < 3; i++) near(p[joint][i], q[joint][i], 1e-6, (label || '') + ' ' + joint + '[' + i + ']');
}

test('motionFor：アタックは打つ予定の時刻に振り下ろし、その前は振りかぶっている', () => {
  const a = newActor(0, 0, -1.3, 0);
  a.task = { kind: 'attack', contact: true, contactAt: 10, at: { x: -1.3, z: 0 } };
  nearJoint(motionFor(a, 10), POSES.spikeHit, 'shoulderR', '打つ瞬間');
  nearJoint(motionFor(a, 9.85), POSES.spikeBack, 'shoulderR', '振りかぶり');
  nearJoint(motionFor(a, 8), POSES.approachReady, 'shoulderR', '助走の前は待つ構え');
});

test('motionFor：打ったあとは、そのクリップの続き（着地 → 構え）', () => {
  const a = newActor(0, 0, -1.3, 0);
  a.lastHit = { kind: 'attack', at: 10 };
  nearJoint(motionFor(a, 10.43), POSES.landing, 'kneeL', '着地');
  nearJoint(motionFor(a, 10.79), POSES.ready, 'kneeL', '構え');
});

test('motionFor：サーブはトスを上げる時刻（hold）を基準に、構え → トス → 跳んで打つ', () => {
  const a = newActor(0, 0, -9.5, 0);
  a.task = { kind: 'serve', contact: true, hold: 5, at: { x: -9.5, z: 0 } };
  nearJoint(motionFor(a, 4.5), POSES.serveHold, 'shoulderL', '構え');
  nearJoint(motionFor(a, 5 + CFG.motion.serveContact), POSES.spikeHit, 'shoulderR', '打つ瞬間');
});

test('motionFor：よろけているときは stagger、走っているときは歩いた距離で脚が回る', () => {
  const a = newActor(0, 0, -5, 0);
  a.stun = 0.3;
  eq(motionFor(a, 1), POSES.stagger);
  a.stun = 0; a.moving = true; a.moveLeft = 5; a.mdx = 1; a.mdz = 0;
  a.stride = 0;
  const p0 = motionFor(a, 1).hipL[0];
  a.stride = CFG.motion.strideLen / 4;
  eq(Math.abs(motionFor(a, 1).hipL[0] - p0) > 0.1, true, '脚が動く');
});

test('facingFor：止まっている・近くへはネットのほう、遠くへ走るときは進む向き', () => {
  const a = newActor(0, 0, -5, 0);
  near(facingFor(a), Math.PI / 2, 1e-9);
  a.moving = true; a.mdx = 0; a.mdz = 1; a.moveLeft = 1;
  near(facingFor(a), Math.PI / 2, 1e-9, 'サイドステップ');
  a.moveLeft = 5;
  near(facingFor(a), 0, 1e-9, '+z へ走る');
  const e = newActor(2, 1, 5, 0);
  near(facingFor(e), -Math.PI / 2, 1e-9);
});

test('助走：打つ所の手前で待ち、跳ぶ approachTime 秒前から走り、踏み切って前へ流れ、最高点で打つ所の上に来る', () => {
  const a = newActor(0, 0, -5, 0);
  const rise = riseTime();
  a.task = { kind: 'attack', contact: true, jump: true, at: { x: -1.3, z: 0 }, contactAt: 3, jumpAt: 3 - rise, start: 0 };
  planApproach(a);
  near(a.task.approachSpot.x, -1.3 - CFG.motion.approachDist, 1e-9);
  let simT = 0, atTakeoff = null, atPeak = null;
  while (simT < 3.8) {
    simT += 1 / 120;
    stepActor(a, 1 / 120, simT);
    if (atTakeoff === null && a.y > 0) atTakeoff = a.x;
    if (atPeak === null && simT >= 3) atPeak = { x: a.x, y: a.y };
    if (Math.abs(simT - (a.task.approachStart - 0.05)) < 1 / 240) near(a.x, a.task.approachSpot.x, 0.05, '助走の前は手前で待つ');
  }
  near(atTakeoff, -1.3 - CFG.motion.broad, 0.15, '踏み切り位置');
  near(atPeak.x, -1.3, 0.12, '最高点で打つ所の上');
  near(atPeak.y, CFG.jumpH, 0.05);
  eq(a.y, 0);
  eq(a.landT !== null && a.landT > 3, true, '着地の時刻');
  eq(a.x <= -0.35, true, 'ネットを越えない');
});

test('stepActor：走った距離（stride）・向き（mdx, mdz）・残りの距離（moveLeft）を数える', () => {
  const a = newActor(0, 0, -5, 0);
  a.task = { at: { x: -5, z: 3 } };
  stepFor(a, 0.2);
  near(a.stride, CFG.runSpeed * 0.2, 0.02);
  near(a.mdz, 1, 1e-9); near(a.mdx, 0, 1e-9);
  near(a.moveLeft, 3 - CFG.runSpeed * 0.2 + CFG.runSpeed / 60, 0.15);
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
