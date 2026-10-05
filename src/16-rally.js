// ===== ラリーの流れ（three.js 非依存） =====
// R.state: 'choose'（スローで選択中）/ 'play'（それ以外の試合中）/ 'boom'（床に触れたあと）
// 選ぶ場面: 'serve' ①自分のサーブ番 / 'incoming' ②相手が打った（attack なら相手のトス＝アタックが来る）/ 'tossed' ③味方が自分にトスした
// 描画側へは R.events に出来事を積む：choose / chosen / hit / miss / floor / explode
const ACTIONS = ['receive', 'attack', 'block', 'serve'];

function newRally(rand) {
  const actors = CFG.startSpots.map((s, i) => newActor(i, s.team, s.x, s.z));
  return {
    state: 'play', simT: 0, ball: null, actors, me: actors[0], mate: actors[1],
    choose: null, boom: null, awaiting: false, openerIdx: 0, events: [], rand: rand || Math.random,
  };
}
function partnerOf(R, a) { return R.actors.find(o => o.team === a.team && o !== a); }
function roll(R, p) { return R.rand() < p; }

// 次の 1 点を始める。team が打つ（0 ならプレイヤー＝①の選択、1 なら敵。Phase 2 の敵はサーブとアタックを交互に）
function startPoint(R, team) {
  for (const a of R.actors) {
    a.task = null; a.y = 0; a.vy = 0; a.lastHit = null;
    a.home = { ...a.base }; a.x = a.base.x; a.z = a.base.z;
  }
  R.boom = null; R.choose = null; R.awaiting = false; R.state = 'play';
  const server = team === 0 ? R.me : R.actors[2];
  server.home = { x: -dirOf(team) * CFG.serveSpot, z: server.base.z * 0.5 };
  server.x = server.home.x; server.z = server.home.z;
  R.ball = newBall(server.x, 1.2, server.z);
  R.ball.held = server;
  if (team === 0) { openChoice(R, 'serve'); return; }
  const kind = CFG.enemyOpeners[R.openerIdx++ % CFG.enemyOpeners.length];
  if (kind === 'serve') giveServe(R, server, roll(R, CFG.ai.serve));
  else enemyAttackOpener(R);
}

// Phase 2 の試し：敵の 1 人がネット際でトスを上げ、もう 1 人がアタックしてくる
function enemyAttackOpener(R) {
  const setter = R.actors[2], hitter = R.actors[3];
  setter.home = { x: 2.5, z: 0 }; setter.x = 2.5; setter.z = 0;
  R.ball = newBall(2.5, 2.3, 0);
  R.ball.vel = shotVelocity(R.ball.pos, { x: CFG.shots.set.toX, z: hitter.base.z * 0.5 }, CFG.shots.set.apex);
  setter.lastHit = { kind: 'toss', at: R.simT };
  afterHit(R, setter, { kind: 'toss', ok: true });
}

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
}
function retarget(R, team) {
  for (const a of R.actors) if (a.team === team && a.task && a.task.pending && a.task.kind !== 'block') aimTask(R, a);
}

function giveServe(R, a, ok) {
  const t = giveTask(R, a, 'serve', ok, { h: CFG.contactH.serve, pending: false, hold: R.simT + CFG.serveHold, jump: true });
  t.jumpAt = t.hold + 0.3;
}
function giveReceive(R, a, ok) { return giveTask(R, a, 'receive', ok, { h: CFG.contactH.receive }); }
function giveReturn(R, a, ok) { return giveTask(R, a, 'return', ok, { h: CFG.contactH.receive }); }
function giveToss(R, a, target) { return giveTask(R, a, 'toss', roll(R, CFG.ai.toss), { h: CFG.contactH.toss, target }); }
function giveAttack(R, a, ok, kind) {
  const whiff = !ok && R.rand() < 0.5;                    // 失敗の半分は空振り、残りはネットにかける
  return giveTask(R, a, kind || 'attack', ok, { h: kind === 'direct' ? CFG.contactH.direct : CFG.contactH.attack, jump: true, whiff });
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
    else if (action === 'block') giveNoop(R, me, 'blockNoop', () => openChoice(R, 'serve'));
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
    if (action === 'receive') giveReceive(R, me, roll(R, P.incoming.receive));
    else if (action === 'attack') {
      const hard = attack || Math.hypot(b.vel.x, b.vel.y, b.vel.z) > CFG.hardSpeed;
      giveAttack(R, me, roll(R, hard ? P.incoming.directHard : P.incoming.directSoft), 'direct');
    } else {
      if (action === 'block') giveBlock(R, me, attack && roll(R, P.incoming.block));
      else if (action === 'serve') giveNoop(R, me, 'whiff');
      giveReceive(R, mate, roll(R, CFG.ai.receive));      // 空いた所は味方がカバー（時間切れも同じ）
    }
    return;
  }
  // 'tossed'
  if (action === 'attack') giveAttack(R, me, roll(R, P.tossed.attack));
  else if (action === 'receive') giveReturn(R, me, roll(R, P.tossed.receive));
  else if (action === 'block') giveNoop(R, me, 'blockNoop');
  else if (action === 'serve') giveNoop(R, me, 'whiff');
  else giveReturn(R, mate, roll(R, CFG.ai.receive));      // 時間切れ：味方が返す
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
    case 'serve': return t.ok ? shotVelocity(from, opp(3, 8.5), S.serveApex) : shotVelocity(from, { x: -d * 0.6, z: p.z * 0.5 }, from.y + 0.3);   // ネットに届かない
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
  if (!headingTo(R, a.team)) {
    retarget(R, 1 - a.team);
    if (a.team === 1 && !R.awaiting && R.state !== 'choose') openChoice(R, 'incoming', false);
  }
}

function resolveContact(R, a, c) {
  const t = a.task;
  a.task = null;
  a.home = { ...a.base };                                 // サーブを打ったら定位置へ戻る
  if (c === 'miss') { R.events.push({ type: 'miss', actor: a, kind: t.kind }); return; }
  a.lastHit = { kind: t.kind, at: R.simT };
  R.ball.vel = shotFor(R, a, t);
  R.events.push({ type: 'hit', actor: a, kind: t.kind, ok: t.ok });
  afterHit(R, a, t);
}

function onFloor(R, hit) {
  for (const a of R.actors) a.task = null;
  R.state = 'boom'; R.choose = null;
  R.boom = { t: 0, hit, fired: false };
  R.events.push({ type: 'floor', x: hit.x, z: hit.z, side: hit.side });
}

// realDt（実時間）進める。選択中はゲームの時間を slowScale 倍にする
function tickRally(R, realDt) {
  const dt = R.state === 'choose' ? realDt * CFG.slowScale : realDt;
  if (R.state === 'choose') R.choose.left -= realDt;
  R.simT += dt;
  for (const a of R.actors) stepActor(a, dt, R.simT);
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
      b.pos = { x: a.x + d * 0.3, y: 2.0, z: a.z };
      b.vel = { x: d * 0.4, y: 4.5, z: 0 };
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
    }
    if (R.boom.t >= CFG.explodeDelay + CFG.afterBoom) startPoint(R, R.boom.hit.side);   // 取られた側のサーブ
  }
}
