// ===== ラリーの流れ（three.js 非依存） =====
// R.state: 'choose'（スローで選択中）/ 'play'（それ以外の試合中）/ 'boom'（床に触れたあと）/ 'reset'（点のあと定位置へ戻る）/ 'over'（試合終了）
// 選ぶ場面: 'serve' ①自分のサーブ番 / 'incoming' ②相手が打った（attack なら相手のトス＝アタックが来る）/ 'tossed' ③味方が自分にトスした
// 描画側へは R.events に出来事を積む：choose / chosen / hit / miss / floor / explode / point / gameover / bump
const ACTIONS = ['receive', 'attack', 'block', 'serve'];

function newRally(rand) {
  const actors = CFG.startSpots.map((s, i) => newActor(i, s.team, s.x, s.z));
  return {
    state: 'play', simT: 0, ball: null, actors, me: actors[0], mate: actors[1],
    choose: null, boom: null, awaiting: false, events: [], rand: rand || Math.random,
    score: [0, 0], winner: null, resetT: 0, nextServe: 0, enemyServer: 0,
    idle: [false, false],                                 // テスト用：true のチームは AI が受けに行かない
  };
}
function partnerOf(R, a) { return R.actors.find(o => o.team === a.team && o !== a); }
function roll(R, p) { return R.rand() < p; }

function mishap(R, p) { return R.rand() >= 1 - p; }       // AI のミス（rand が 0 なら起きない）
function speedOf(b) { return Math.hypot(b.vel.x, b.vel.y, b.vel.z); }
// AI の反応の遅れ（秒）
function reaction(R) {
  const D = CFG.ai.delay;
  return D[0] + R.rand() * (D[1] - D[0]) + (mishap(R, CFG.ai.slowChance) ? CFG.ai.slowDelay : 0);
}
// AI のレシーブ（強い球なら成功率が下がる。反応の遅れあり）
function aiReceive(R, a, kind, hard) {
  const t = giveTask(R, a, kind || 'receive', roll(R, hard ? CFG.ai.dig : CFG.ai.receive), { h: CFG.contactH.receive });
  t.delay = reaction(R);
  return t;
}

// こちらの球が敵の側へ来た：落下地点に近いほうがレシーブ。bothGo なら 2 人とも向かう
function enemyDefend(R) {
  if (R.idle[1]) return;
  const land = predictDescent(R.ball, CFG.contactH.receive);
  const free = R.actors.filter(a => a.team === 1 && !(a.task && a.task.kind === 'block'));
  if (!land || !free.length) return;
  const dist = a => Math.hypot(a.x - land.x, a.z - land.z);
  free.sort((a, b) => dist(a) - dist(b));
  const hard = speedOf(R.ball) > CFG.hardSpeed;
  aiReceive(R, free[0], 'receive', hard);
  if (free[1] && mishap(R, CFG.ai.bothGo)) aiReceive(R, free[1], 'receive', hard);
}

// こちらのアタッカーがアタックに入った：blockTry の確率で、アタッカーに近い敵がブロックに跳ぶ
function enemyMaybeBlock(R, attacker) {
  if (R.idle[1] || !mishap(R, CFG.ai.blockTry)) return;
  const z = attacker.task.at.z;
  const opp = R.actors.filter(a => a.team === 1).sort((a, b) => Math.abs(a.z - z) - Math.abs(b.z - z));
  giveBlock(R, opp[0], roll(R, CFG.ai.block));
}

// サーブする人と、その立ち位置
function serverOf(R, team) { return team === 0 ? R.me : R.actors[2 + R.enemyServer]; }
function serveSpotOf(a) { return { x: -dirOf(a.team) * CFG.serveSpot, z: a.base.z * 0.5 }; }

// 試合を始める（0-0、自分のサーブ）
function newGame(R) {
  R.score = [0, 0]; R.winner = null;
  for (const a of R.actors) a.soot = false;
  startPoint(R, R.rand() < 0.5 ? 0 : 1);                  // 先攻（最初のサーブ）はランダム
}

// 全員を定位置に置いて、すぐ team のサーブを始める（試合の最初とテスト用）
function startPoint(R, team) {
  for (const a of R.actors) {
    a.task = null; a.y = 0; a.vy = 0; a.lastHit = null; a.stun = 0; a.fly = null;
    a.home = { ...a.base }; a.x = a.base.x; a.z = a.base.z;
  }
  const s = serverOf(R, team);
  s.home = serveSpotOf(s); s.x = s.home.x; s.z = s.home.z;
  startServe(R, team);
}

// その場からサーブを始める。0 ならプレイヤーの①の選択、1 なら敵がサーブ（2 人が交代で打つ）
function startServe(R, team) {
  R.boom = null; R.choose = null; R.awaiting = false; R.reserve = false; R.state = 'play';
  const s = serverOf(R, team);
  R.ball = newBall(s.x, 1.2, s.z);
  R.ball.held = s;
  if (team === 0) { openChoice(R, 'serve'); return; }
  R.enemyServer ^= 1;
  giveServe(R, s, roll(R, CFG.ai.serve));
}

// 爆発を見せきったあと：点を入れ、勝敗が決まっていなければ定位置へ戻り始める
function endPoint(R, loser) {
  const scorer = 1 - loser;
  R.score[scorer]++;
  R.events.push({ type: 'point', scorer, score: R.score.slice() });
  R.boom = null; R.ball = null;
  for (const a of R.actors) { a.task = null; a.home = { ...a.base }; }
  if (R.score[scorer] >= CFG.winScore) {
    R.state = 'over'; R.winner = scorer;
    R.events.push({ type: 'gameover', winner: scorer, score: R.score.slice() });
    return;
  }
  R.state = 'reset'; R.resetT = 0; R.nextServe = scorer;   // 点を取った側がサーブ（本人の要望、2026-10-05）
  const s = serverOf(R, scorer);
  s.home = serveSpotOf(s);
}

// 4 つの行動はどの場面でも押せる。場面に合わない行動は、合わないなりの動きになる（本人の判断、2026-10-05）
function openChoice(R, scene, attack) {
  R.state = 'choose';
  R.choose = { scene, attack: !!attack, left: CFG.choiceTime };
  R.events.push({ type: 'choose', scene, attack: !!attack });
}

// 爆弾がそのまま落ちると team の側か
function headingTo(R, team) {
  const l = predictDescent(R.ball, CFG.ball.r + 0.01);
  return !!l && sideOf(l.x) === team;
}

// 仕事を渡す。爆弾がもう自分の側へ来ているなら、すぐ行き先を決める（来ていなければ pending のまま）
function giveTask(R, a, kind, ok, extra) {
  a.task = Object.assign({ kind, ok, contact: true, pending: true, at: { x: a.x, z: a.z }, start: R.simT }, extra);
  const t = a.task;
  if (t.contact && t.pending && headingTo(R, a.team)) aimTask(R, a);
  return t;
}

// 落ちてくる場所を予測して行き先を決める。ネットを越えて相手側へは行かない
function aimTask(R, a) {
  const t = a.task, p = predictDescent(R.ball, t.h);
  if (!p) return;
  const G = CFG.gym;
  let x = clamp(p.x, -G.halfX + 0.5, G.halfX - 0.5);
  x = a.team === 0 ? Math.min(x, -0.4) : Math.max(x, 0.4);
  t.at = { x, z: clamp(p.z, -G.halfZ + 0.5, G.halfZ - 0.5) };
  t.pending = false;
  t.contactAt = R.simT + p.t;
  if (t.jump) t.jumpAt = t.contactAt - riseTime();
  if (t.kind === 'attack') planApproach(a);              // アタックは助走して跳ぶ
}
function retarget(R, team) {
  for (const a of R.actors) if (a.team === team && a.task && a.task.pending && a.task.kind !== 'block') aimTask(R, a);
}

// ジャンプサーブのトス：手（高さ 2.0m）から、tossTime 秒後に高さ contactH.serve を降りてくるとき、打つ所の真上に来る初速
function serveToss(a) {
  const J = CFG.jumpServe, d = dirOf(a.team), T = J.tossTime, x0 = a.x + d * 0.3, xc = -d * (CFG.court.halfLen - J.contactIn);
  return { pos: { x: x0, y: 2.0, z: a.z }, vel: { x: (xc - x0) / T, y: (CFG.contactH.serve - 2.0 + 0.5 * CFG.gravity * T * T) / T, z: 0 } };
}
// ジャンプサーブ：構えて、トスを上げ、エンドラインの 3m 後ろから助走し、ラインの手前で踏み切って、コートの中の空中で打つ
function giveServe(R, a, ok) {
  const J = CFG.jumpServe, d = dirOf(a.team);
  const t = giveTask(R, a, 'serve', ok, { h: CFG.contactH.serve, pending: false, hold: R.simT + CFG.serveHold, jump: true });
  const spot = serveSpotOf(a);                            // サーブの位置から助走する（そこにいなければ、まず戻る）
  t.approachSpot = spot;
  t.approachStart = t.hold + J.approachDelay;
  t.takeoff = { x: -d * J.takeoffX, z: spot.z };
  t.at = { x: -d * (CFG.court.halfLen - J.contactIn), z: spot.z };
  t.jumpAt = t.hold + J.tossTime - riseTime();
}
function giveReceive(R, a, ok) { return giveTask(R, a, 'receive', ok, { h: CFG.contactH.receive }); }
function giveReturn(R, a, ok) { return giveTask(R, a, 'return', ok, { h: CFG.contactH.receive }); }
function giveToss(R, a, target) { return giveTask(R, a, 'toss', roll(R, CFG.ai.toss), { h: CFG.contactH.toss, target }); }
function giveAttack(R, a, ok, kind) {
  const whiff = !ok && R.rand() < 0.5;                    // 失敗の半分は空振り、残りはネットにかける
  const t = giveTask(R, a, kind || 'attack', ok, { h: kind === 'direct' ? CFG.contactH.direct : CFG.contactH.attack, jump: true, whiff });
  if (a !== R.me && t.jumpAt != null && mishap(R, CFG.ai.earlyJump)) {   // AI：ジャンプが早すぎて空振り
    t.jumpAt -= 0.35;
    t.whiff = true;
  }
  if (a.team === 0) enemyMaybeBlock(R, a);
  return t;
}
// ブロック：相手のアタッカーの正面のネット際へ行き、打つ瞬間に合わせて跳ぶ
function giveBlock(R, a, ok) {
  const opp = R.actors.find(o => o.team !== a.team && o.task && (o.task.kind === 'attack' || o.task.kind === 'direct'));
  const z = opp ? opp.task.at.z : R.ball.pos.z;
  const t = giveTask(R, a, 'block', ok, { pending: false, at: { x: -dirOf(a.team) * 0.5, z: clamp(z, -4, 4) } });
  if (opp && opp.task.contactAt != null) t.jumpAt = opp.task.contactAt - riseTime() + 0.05;
  else t.jumpOnArrive = true;
  return t;
}
// 場面に合わない動き：'blockNoop' はネット際で跳ぶだけ、'whiff' はその場でサーブの構えをして空振り
function giveNoop(R, a, kind, then) {
  if (kind === 'blockNoop') return giveTask(R, a, kind, false, { contact: false, pending: false, at: { x: -dirOf(a.team) * 0.5, z: a.z }, jumpOnArrive: true, then });
  return giveTask(R, a, kind, false, { contact: false, pending: false, end: R.simT + 1.0, then });
}

// プレイヤーが選んだ（action が null なら時間切れ）
function choose(R, action) {
  if (R.state !== 'choose') return;
  const sc = R.choose.scene, attack = R.choose.attack, me = R.me, mate = R.mate, P = CFG.success, b = R.ball;
  R.choose = null; R.state = 'play';
  R.events.push({ type: 'chosen', action, scene: sc });
  if (sc === 'serve') {
    if (action === 'serve' || action === null) giveServe(R, me, roll(R, P.serve.serve));
    else if (action === 'block') giveNoop(R, me, 'blockNoop', () => { R.reserve = true; });   // 爆弾を持ったままネット際で跳び、サーブの位置へ戻ってから、もう一度選ぶ
    else {                                                // その場で爆弾を放り上げ、レシーブかアタックで打つ
      const d = dirOf(me.team);
      b.held = null;
      b.pos = { x: me.x + d * 0.3, y: 1.3, z: me.z };
      b.vel = { x: 0, y: action === 'receive' ? 2.5 : 4, z: 0 };
      giveTask(R, me, action === 'receive' ? 'bump' : 'standSpike', roll(R, P.serve[action]),
        { h: action === 'receive' ? 0.9 : 1.9, pending: false });
    }
    return;
  }
  if (sc === 'incoming') {
    R.awaiting = true;
    const hard = attack || speedOf(b) > CFG.hardSpeed;
    if (action === 'receive') {
      giveReceive(R, me, roll(R, P.incoming.receive));
      if (mishap(R, CFG.ai.bothGo)) aiReceive(R, mate, 'receive', hard);   // 味方も向かってしまう
    } else if (action === 'attack') {
      giveAttack(R, me, roll(R, hard ? P.incoming.directHard : P.incoming.directSoft), 'direct');
    } else {
      if (action === 'block') giveBlock(R, me, attack && roll(R, P.incoming.block));
      else if (action === 'serve') giveNoop(R, me, 'whiff');
      aiReceive(R, mate, 'receive', hard);                // 空いた所は味方がカバー（時間切れも同じ）
    }
    return;
  }
  // 'tossed'
  if (action === 'attack') giveAttack(R, me, roll(R, P.tossed.attack));
  else if (action === 'receive') giveReturn(R, me, roll(R, P.tossed.receive));
  else if (action === 'block') giveNoop(R, me, 'blockNoop');
  else if (action === 'serve') giveNoop(R, me, 'whiff');
  else aiReceive(R, mate, 'return', false);              // 時間切れ：味方が返す
}

// 相手がブロックに跳んでいれば、そのブロックの成否に合わせてコースを決める：
// 成功（ok）なら手のある線へ打ち込む（＝手に当たって止まる）、失敗なら手の横 1.4m を抜く線にする
function spikeTarget(R, a, from, to) {
  const blk = R.actors.find(o => o.team !== a.team && o.task && o.task.kind === 'block');
  if (!blk) return to;
  const bx = blk.task.at.x + dirOf(blk.team) * 0.15;
  const bz = blk.task.at.z + (blk.task.ok ? 0 : (R.rand() < 0.5 ? -1.4 : 1.4));
  const W = CFG.court.halfWid - 0.3, dz = bz - from.z;
  let k = (to.x - from.x) / (bx - from.x);                // 手の位置を通る線を、床まで延ばす
  if (Math.abs(dz) > 1e-6) k = Math.min(k, (Math.sign(dz) * W - from.z) / dz);   // コートの横からはみ出さない所まで
  k = Math.max(k, 1.5);
  return { x: from.x + (bx - from.x) * k, z: from.z + dz * k };
}

// 打った球の初速。成功なら狙いどおり、失敗なら笑える方向へ
function shotFor(R, a, t) {
  const d = dirOf(a.team), p = R.ball.pos, rnd = R.rand, S = CFG.shots, W = CFG.court.halfWid - 0.7;
  const from = { x: p.x, y: p.y, z: p.z };
  const opp = (x0, x1) => ({ x: d * (x0 + rnd() * (x1 - x0)), z: (rnd() * 2 - 1) * W });   // 相手コートのネットから x0〜x1 m
  const shank = () => shotVelocity(from, { x: -d * (9.5 + rnd() * 3), z: (rnd() * 2 - 1) * 7 }, from.y + 1.5 + rnd() * 2);   // 自陣の後ろへ弾く
  const intoNet = () => { const dx = -p.x, dy = 1.7 - p.y, n = Math.hypot(dx, dy) || 1; return { x: dx / n * 14, y: dy / n * 14, z: 0 }; };
  switch (t.kind) {
    case 'receive': return t.ok ? shotVelocity(from, { x: -d * S.pass.toX, z: 0 }, S.pass.apex) : shank();
    case 'toss':
      return t.ok ? shotVelocity(from, { x: -d * S.set.toX, z: clamp(t.target.z, -3.5, 3.5) }, S.set.apex)
                  : shotVelocity(from, { x: -d * 0.3, z: p.z }, from.y + 0.8);          // 低いトスでネット際に落ちる
    case 'attack': case 'direct': case 'standSpike':
      return t.ok ? spikeVelocity(from, spikeTarget(R, a, from, opp(4.5, 8.5)), S.spikeSpeed) : intoNet();
    case 'block': return spikeVelocity(from, opp(1.5, 4), 10);
    case 'return': return t.ok ? shotVelocity(from, opp(5, 8.5), S.returnApex) : shank();
    case 'bump': return t.ok ? shotVelocity(from, opp(5, 8.5), S.returnApex) : shotVelocity(from, { x: p.x - d * 0.6, z: p.z + 0.4 }, from.y + 1.2);   // 足元に落とす
    case 'serve': return t.ok ? spikeVelocity(from, opp(4, 8.5), CFG.jumpServe.speed) : shotVelocity(from, { x: -d * 0.6, z: p.z * 0.5 }, from.y + 0.3);   // ネットに届かない
  }
  return { x: 0, y: 0, z: 0 };
}

// 打ったあと：レシーブ → 相方がトス、トス → 相方（レシーブした人）がアタック。相手側へ飛んだら相手の pending を決める
function afterHit(R, a, t) {
  const partner = partnerOf(R, a);
  if (a.team === 0) R.awaiting = false;
  if (t.ok && t.kind === 'receive') giveToss(R, partner, a);
  if (t.ok && t.kind === 'toss') {
    if (partner === R.me) openChoice(R, 'tossed');
    else giveAttack(R, partner, roll(R, CFG.ai.attack));
    if (a.team === 1 && !R.awaiting && R.state !== 'choose') openChoice(R, 'incoming', true);   // 敵のトス＝アタックが来る
  }
  if (!headingTo(R, a.team)) {                            // 相手側へ飛んだ
    retarget(R, 1 - a.team);
    if (a.team === 0) enemyDefend(R);
    if (a.team === 1 && !R.awaiting && R.state !== 'choose') openChoice(R, 'incoming', false);
  }
}

function resolveContact(R, a, c) {
  const t = a.task;
  a.task = null;
  a.home = { ...a.base };                                 // サーブを打ったら定位置へ戻る
  if (c === 'miss') { R.events.push({ type: 'miss', actor: a, kind: t.kind }); return; }   // 2 人で追っていれば、もう 1 人はそのまま追う
  const p = partnerOf(R, a);
  if (p.task && p.task.contact && p.task.kind === t.kind) p.task = null;   // もう 1 人が触った球は追わない
  a.lastHit = { kind: t.kind, at: R.simT };
  R.ball.vel = shotFor(R, a, t);
  R.events.push({ type: 'hit', actor: a, kind: t.kind, ok: t.ok });
  afterHit(R, a, t);
}

function onFloor(R, hit) {
  for (const a of R.actors) a.task = null;
  R.state = 'boom'; R.choose = null; R.reserve = false;
  R.boom = { t: 0, hit, fired: false };
  R.events.push({ type: 'floor', x: hit.x, z: hit.z, side: hit.side });
}

// realDt（実時間）進める。選択中はゲームの時間を slowScale 倍にする
function tickRally(R, realDt) {
  const dt = R.state === 'choose' ? realDt * CFG.slowScale : realDt;
  if (R.state === 'choose') R.choose.left -= realDt;
  R.simT += dt;
  for (const a of R.actors) { if (a.fly) stepFly(a, dt, R); else stepActor(a, dt, R.simT); }
  if (R.reserve && Math.hypot(R.me.x - R.me.home.x, R.me.z - R.me.home.z) < 0.05) { R.reserve = false; openChoice(R, 'serve'); }   // サーブの位置に戻ったら、もう一度選ぶ
  separateActors(R);
  collideFlyers(R);
  for (const a of R.actors) {                             // 爆弾に触らない動き（空振り・跳ぶだけ）の終わり
    const t = a.task;
    if (!t || t.contact) continue;
    if (t.end != null ? R.simT >= t.end : (t.jumped && a.y === 0)) { a.task = null; if (t.then) t.then(); }
  }
  const b = R.ball;
  if (b && b.held) {
    const a = b.held, d = dirOf(a.team), t = a.task;
    b.pos = { x: a.x + d * 0.35, y: a.y + 1.15, z: a.z };
    if (t && t.kind === 'serve' && R.simT >= t.hold) {    // 構えの間が終わったらトスを上げる
      b.held = null;
      const s = serveToss(a); b.pos = s.pos; b.vel = s.vel;
    }
  } else if (b && b.live) {
    for (const a of R.actors) { const c = checkContact(a, b); if (c) resolveContact(R, a, c); }
    const colliders = R.actors.filter(a => !(a.task && a.task.contact) && !(a.lastHit && R.simT - a.lastHit.at < 0.4)).map(a => ({ x: a.x, z: a.z }));   // 打とうとしている人・打ったばかりの人には当たらない（打った球を自分の体で弾かない）
    const hit = stepBall(b, dt, colliders, R.rand);
    if (hit) onFloor(R, hit);
  }
  if (R.state === 'choose' && R.choose.left <= 0) choose(R, null);   // 時間切れ：味方に任せる
  if (R.state === 'boom') {
    R.boom.t += realDt;
    if (!R.boom.fired && R.boom.t >= CFG.explodeDelay) {
      R.boom.fired = true;
      R.events.push({ type: 'explode', x: R.boom.hit.x, z: R.boom.hit.z, side: R.boom.hit.side });
      blastActors(R, R.boom.hit);                         // 選手を吹っ飛ばす
    }
    const settled = R.actors.every(a => !a.fly);          // 全員が起き上がった
    if (R.boom.t >= CFG.explodeDelay + CFG.afterBoom && (settled || R.boom.t >= CFG.blast.maxTime)) endPoint(R, R.boom.hit.side);
  }
  if (R.state === 'reset') {                              // 全員が定位置（サーブの人はサーブ位置）に着いたら次のサーブ
    R.resetT += realDt;
    const flying = R.actors.some(a => a.fly);
    if (flying) R.resetT = 0;
    const home = R.actors.every(a => Math.hypot(a.x - a.home.x, a.z - a.home.z) < 0.05);
    if (!flying && (home || R.resetT > CFG.resetMax)) startServe(R, R.nextServe);
  }
}
