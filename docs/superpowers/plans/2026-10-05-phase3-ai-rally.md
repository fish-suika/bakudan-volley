# Phase 3 AI とラリー・点数 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 敵 2 人が AI で動き、こちらの球をレシーブ → トス → アタックで返してくる（ときどきブロックもする）。ラリーが続き、爆発 1 回で 1 点、3 点先取で勝敗が決まる。点が決まると全員が歩いて定位置へ戻り、取られた側のサーブで次が始まる。AI には笑えるミスを入れる：反応が遅れる、2 人とも同じ球へ向かってぶつかる、ジャンプが早すぎて空振りする。

**Architecture:** AI とラリーの流れは `16-rally.js`（three.js 非依存）に足し、`verify.html` で自動テストする。AI のミスは `mishap(R, p)` で決める。これは `R.rand() >= 1 - p` で判定するので、テストの `rand = () => 0` ではミスが起きない。ミスを試したいときは、テストの中で `CFG.ai` の確率を一時的に 1 にする。

**Tech Stack:** 素の JavaScript、three.js r128。Node は無い。

**仕様書:** `docs/superpowers/specs/2026-10-05-bakudan-volley-design.md`（3.2 点の決まり方、3.5 1 点の流れ、4 AI）

**Phase 2 からの変更:** Phase 2 の試しの「敵はサーブとアタックを交互に打つ」（`CFG.enemyOpeners` / `enemyAttackOpener` / `R.openerIdx`）は消す。敵は毎回ふつうにサーブを打つ。テストで敵のアタックが必要なときは、テスト側の補助関数 `enemyAttack(R)` で作る。

---

## AI の決まり（仕様書 4 をコードにしたもの）

| 場面 | 敵 AI | 味方 AI |
|---|---|---|
| こちらの球が敵の側へ飛んだ | 落下地点に近いほうがレシーブに走る（強い球なら成功率は `dig`）。`bothGo` の確率で 2 人とも向かう | — |
| レシーブが上がった | 相方がトス → レシーブした人がアタック（今までどおり） | 同じ。ただし自分（プレイヤー）がアタックするときは③の選択 |
| こちらのアタッカーがアタックに入った | `blockTry` の確率で、アタッカーに近いほうがブロックに跳ぶ（成功率 `block`） | — |
| 相手の球がこちらへ来た | — | プレイヤーの選択しだい（②）。プレイヤーがレシーブを選んでも、`bothGo` の確率で味方も向かってしまう |
| ミス | 反応の遅れ（`delay`、`slowChance` の確率でさらに `slowDelay` 遅れる）、ジャンプが早すぎて空振り（`earlyJump`）、2 人がぶつかってよろける（`bumpStun` 秒動けない） | 同じ確率 |

## ファイル

| ファイル | 変更 |
|---|---|
| `src/10-config.js` | `ai` を置き換え、`winScore` `resetMax` を足す。`enemyOpeners` を消す |
| `src/15-actors.js` | 反応の遅れ（`task.delay`）、よろけ（`a.stun`）、選手どうしの押し合いとぶつかり（`separateActors`） |
| `src/16-rally.js` | 点数・勝敗・定位置へ戻る流れ、敵のレシーブとブロックの判断、ミス |
| `src/00-head.html` | 点数表示、勝敗の画面 |
| `src/60-hud.js` | 点数・勝敗の画面の表示 |
| `src/42-motions.js` | よろけるポーズ |
| `src/90-boot.js` | 点数・勝敗・ぶつかりの出来事を画面へ。もう一回 |
| `src/verify-tests.js` | Phase 2 のテストの手直しと、新しいテスト |

---

### Task 1: 選手の反応の遅れ・よろけ・ぶつかり

**Files:** Modify `src/15-actors.js`, `src/verify-tests.js`

- [ ] **Step 1: テストを書く**（選手の動きのテスト `ブロックは手の範囲に触れたときだけ止める` の後に足す）

```js
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
```

- [ ] **Step 2: 失敗を確かめる**

Run: `sh build.sh` → verify.html を開く
Expected: FAIL（新しい 3 本）

- [ ] **Step 3: 実装する**

`newActor` の返す中身に `stun: 0` を足す：

```js
  return { id, team, x, z, y: 0, vy: 0, home: { x, z }, base: { x, z }, task: null, moving: false, lastHit: null, stun: 0 };
```

`stepActor` の移動部分（`a.moving = false;` から移動の `if` の閉じかっこまで）を次に置き換える：

```js
  a.moving = false;
  if (a.stun > 0) a.stun = Math.max(0, a.stun - dt);
  const waiting = t && t.delay && simT < t.start + t.delay;   // 反応が遅れて、まだ動き出さない
  if (a.y === 0 && !waiting && !(a.stun > 0)) {
    const dx = g.x - a.x, dz = g.z - a.z, d = Math.hypot(dx, dz), step = CFG.runSpeed * dt;
    if (d > 0.02) {
      a.moving = true;
      if (d <= step) { a.x = g.x; a.z = g.z; } else { a.x += dx / d * step; a.z += dz / d * step; }
    }
  }
```

ファイルの末尾に足す：

```js
// 選手どうしが重ならないよう押し合う。2 人とも爆弾へ走っていてぶつかったら、よろけて少し動けない
function separateActors(R) {
  const A = R.actors, min = CFG.player.r * 2;
  for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
    const a = A[i], b = A[j];
    if (a.y > 0 || b.y > 0) continue;
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
```

`CFG.ai.bumpStun` は Task 2 で足す。テストが先に通るよう、Task 1 の時点で `src/10-config.js` の `ai:` の行を Task 2 Step 1 の内容に置き換えておいてよい（Task 2 Step 1 はそのとき済みとする）。

- [ ] **Step 4: 通過を確かめる**

Run: `sh build.sh` → verify.html を再読み込み
Expected: PASS（37/37）

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "選手の反応の遅れ・よろけ・ぶつかり"
```

---

### Task 2: 点数・勝敗・定位置へ戻る流れ

**Files:** Modify `src/10-config.js`, `src/16-rally.js`, `src/verify-tests.js`

- [ ] **Step 1: `src/10-config.js`**

`ai: { ... },` の行を次に置き換え、`enemyOpeners: ...` の行を消す：

```js
  ai: {                                                   // 味方と敵の AI（ミスの確率は両チーム同じ）
    receive: 0.85, dig: 0.45, toss: 0.9, attack: 0.8, serve: 0.9, block: 0.5,   // 成功率（dig は強い球のレシーブ）
    blockTry: 0.35,                                       // 相手のアタックにブロックへ跳ぶ確率
    delay: [0.05, 0.3], slowChance: 0.15, slowDelay: 0.5, // 反応の遅れ（秒）。slowChance の確率でさらに slowDelay 遅れる
    bothGo: 0.12,                                         // 2 人とも同じ球へ向かってしまう確率
    earlyJump: 0.1,                                       // アタックでジャンプが早すぎて空振りする確率
    bumpStun: 0.7,                                        // ぶつかったときによろけて動けない時間（秒）
  },
  // ---- Phase 3：ラリーと点数 ----
  winScore: 3,                                            // 先に取ったほうの勝ち
  resetMax: 3.0,                                          // 点が決まってから、定位置へ戻るのを待つ最長（秒）
```

- [ ] **Step 2: テストを直す・書く**

(a) ラリーのテストの補助関数（`const boomSide = ...` の行の後）に足す：

```js
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
```

(b) Phase 2 のラリーのテスト（`startPoint(0)：…` から `敵がトスを上げた瞬間に…` まで）の `const R = newRally(zero);` を、すべて `const R = quietRally();` にする（敵がこちらの球を受けるようになったため）。

(c) `相手のサーブでは…4 つとも押せる` の後半の 3 行
```js
  const R2 = newRally(zero);
  R2.openerIdx = 1;
  startPoint(R2, 1);
```
を次に置き換える：
```js
  const R2 = quietRally();
  enemyAttack(R2);
```

(d) `敵がトスを上げた瞬間に…` のテストの
```js
  R.openerIdx = 1;                                         // 敵の 2 番目の打ち方＝トスからアタック
  startPoint(R, 1);
```
を `enemyAttack(R);` に置き換える。

(e) `爆発したら、取られた側のサーブで次が始まる` のテストを消し、次のテストを足す：

```js
// ===== 点数と勝敗 =====
test('爆発してしばらくすると点が入り、全員が歩いて定位置へ戻ってから、取られた側がサーブする', () => {
  const R = quietRally();
  startPoint(R, 0);
  choose(R, 'serve');
  const ev = runFor(R, 5 + CFG.afterBoom);
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
    ev = ev.concat(runFor(R, CFG.explodeDelay + CFG.afterBoom + 0.1));
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
```

- [ ] **Step 3: 失敗を確かめる**

Run: `sh build.sh` → verify.html を再読み込み
Expected: FAIL（`quietRally` の中の `R.idle` が無い、`newGame` が無い、など）

- [ ] **Step 4: 実装する（`src/16-rally.js`）**

`newRally` を置き換える：

```js
function newRally(rand) {
  const actors = CFG.startSpots.map((s, i) => newActor(i, s.team, s.x, s.z));
  return {
    state: 'play', simT: 0, ball: null, actors, me: actors[0], mate: actors[1],
    choose: null, boom: null, awaiting: false, events: [], rand: rand || Math.random,
    score: [0, 0], winner: null, resetT: 0, nextServe: 0, enemyServer: 0,
    idle: [false, false],                                 // テスト用：true のチームは AI が受けに行かない
  };
}
```

`startPoint` と `enemyAttackOpener` を消し、代わりに次を書く：

```js
// サーブする人と、その立ち位置
function serverOf(R, team) { return team === 0 ? R.me : R.actors[2 + R.enemyServer]; }
function serveSpotOf(a) { return { x: -dirOf(a.team) * CFG.serveSpot, z: a.base.z * 0.5 }; }

// 試合を始める（0-0、自分のサーブ）
function newGame(R) {
  R.score = [0, 0]; R.winner = null;
  startPoint(R, 0);
}

// 全員を定位置に置いて、すぐ team のサーブを始める（試合の最初とテスト用）
function startPoint(R, team) {
  for (const a of R.actors) {
    a.task = null; a.y = 0; a.vy = 0; a.lastHit = null; a.stun = 0;
    a.home = { ...a.base }; a.x = a.base.x; a.z = a.base.z;
  }
  const s = serverOf(R, team);
  s.home = serveSpotOf(s); s.x = s.home.x; s.z = s.home.z;
  startServe(R, team);
}

// その場からサーブを始める。0 ならプレイヤーの①の選択、1 なら敵がサーブ（2 人が交代で打つ）
function startServe(R, team) {
  R.boom = null; R.choose = null; R.awaiting = false; R.state = 'play';
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
  R.state = 'reset'; R.resetT = 0; R.nextServe = loser;   // 取られた側がサーブ
  const s = serverOf(R, loser);
  s.home = serveSpotOf(s);
}
```

`tickRally` の最後の `if (R.state === 'boom') { ... }` のブロックを次に置き換え、その後ろに `reset` の処理を足す：

```js
  if (R.state === 'boom') {
    R.boom.t += realDt;
    if (!R.boom.fired && R.boom.t >= CFG.explodeDelay) {
      R.boom.fired = true;
      R.events.push({ type: 'explode', x: R.boom.hit.x, z: R.boom.hit.z, side: R.boom.hit.side });
    }
    if (R.boom.t >= CFG.explodeDelay + CFG.afterBoom) endPoint(R, R.boom.hit.side);
  }
  if (R.state === 'reset') {                              // 全員が定位置（サーブの人はサーブ位置）に着いたら次のサーブ
    R.resetT += realDt;
    const home = R.actors.every(a => Math.hypot(a.x - a.home.x, a.z - a.home.z) < 0.05);
    if (home || R.resetT > CFG.resetMax) startServe(R, R.nextServe);
  }
```

`tickRally` の `for (const a of R.actors) stepActor(a, dt, R.simT);` の次の行に `separateActors(R);` を足す。

- [ ] **Step 5: 通過を確かめる**

Run: `sh build.sh` → verify.html を再読み込み
Expected: PASS（39/39）。`R.idle` はこの時点ではまだ何もしないが、敵はまだ受けに行かないので通る。

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "点数と勝敗（3 点先取）、点が決まったら定位置へ戻って取られた側がサーブ"
```

---

### Task 3: 敵の AI（レシーブ・ブロック）とミス

**Files:** Modify `src/16-rally.js`, `src/verify-tests.js`

- [ ] **Step 1: テストを書く**（`敵のサーブは 2 人が交代で打つ` の後）

```js
// ===== AI =====
test('敵 AI：こちらのサーブを近いほうがレシーブし、相方がトスし、アタックが来る（②アタック）', () => {
  const R = newRally(zero);
  startPoint(R, 0);
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
```

- [ ] **Step 2: 失敗を確かめる**

Run: `sh build.sh` → verify.html を再読み込み
Expected: FAIL（新しい 7 本）

- [ ] **Step 3: 実装する（`src/16-rally.js`）**

`function roll(R, p) ...` の次に足す：

```js
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
```

`giveAttack` を置き換える（AI のジャンプが早すぎるミスと、敵のブロックの判断を足す）：

```js
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
```

`choose` の中の味方の動きを AI に合わせる（反応の遅れ・強い球・2 人とも行く）。`if (sc === 'incoming') { ... }` のブロックを次に置き換える：

```js
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
```

`'tossed'` の最後の行 `else giveReturn(R, mate, roll(R, CFG.ai.receive));` を次に置き換える：

```js
  else aiReceive(R, mate, 'return', false);              // 時間切れ：味方が返す
```

`afterHit` の最後の `if (!headingTo(R, a.team)) { ... }` を次に置き換える：

```js
  if (!headingTo(R, a.team)) {                            // 相手側へ飛んだ
    retarget(R, 1 - a.team);
    if (a.team === 0) enemyDefend(R);
    if (a.team === 1 && !R.awaiting && R.state !== 'choose') openChoice(R, 'incoming', false, t.kind === 'serve');
  }
```

`resolveContact` で、触った人と同じチームでまだ同じ球を追っている人（2 人とも向かったとき）の仕事を消す。`a.task = null;` の次の行に足す：

```js
  const p = partnerOf(R, a);
  if (p.task && p.task.contact && p.task.kind === t.kind) p.task = null;   // もう 1 人が触った球は追わない
```

- [ ] **Step 4: 通過を確かめる**

Run: `sh build.sh` → verify.html を再読み込み
Expected: PASS（46/46）

失敗したら、テストを緩める前に `R.actors` の位置・`task`・`R.ball` を出力して原因を探す。とくに「敵のレシーブ → トス → アタック」が届かない場合は、走る距離と時間を確かめる。直した箇所と原因は最終報告に書く。

- [ ] **Step 5: ランダムで回して止まらないことを確かめる**

verify.html を開いたまま、javascript_tool で次を実行する。どの点も 40 秒以内に終わり、例外が出ないこと。

```js
(() => {
  const R = newRally(Math.random); newGame(R);
  let points = 0, stuck = 0, t = 0, last = 0;
  while (points < 60 && t < 3000) {
    if (R.state === 'choose' && Math.random() < 0.05) choose(R, [...R.choose.allowed, null][Math.floor(Math.random() * (R.choose.allowed.length + 1))]);
    tickRally(R, 1 / 60); t += 1 / 60;
    for (const e of R.events) if (e.type === 'point') { points++; if (t - last > 40) stuck++; last = t; }
    R.events.length = 0;
    if (R.state === 'over') newGame(R);
  }
  return { points, stuck, seconds: Math.round(t) };
})()
```

Expected: `points` が 60、`stuck` が 0。

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "敵 AI：近いほうがレシーブ、こちらのアタックにブロック。反応の遅れ・2 人とも向かう・早すぎるジャンプのミス"
```

---

### Task 4: 点数・勝敗の画面とよろけるポーズ

**Files:** Modify `src/00-head.html`, `src/60-hud.js`, `src/42-motions.js`, `src/90-boot.js`

- [ ] **Step 1: `src/00-head.html` の CSS の最後（`</style>` の前）に足す**

```css
  /* ---- 点数 ---- */
  #score{position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:5;display:flex;align-items:center;gap:10px;
    padding:6px 16px;border-radius:20px;background:rgba(10,12,16,.6);font-size:15px;letter-spacing:.08em;pointer-events:none}
  #score b{font-size:24px;min-width:1ch;text-align:center}
  #score .t0{color:#8fb6ff}
  #score .t1{color:#ff9a8f}
  @media (max-width:820px){#hint{display:none}}

  /* ---- 勝敗の画面 ---- */
  #result{position:fixed;inset:0;z-index:12;display:none;flex-direction:column;align-items:center;justify-content:center;
    gap:14px;padding:16px;text-align:center;background:rgba(10,12,16,.72)}
  #result.on{display:flex}
  #result h2{font-size:clamp(30px,7vw,56px);letter-spacing:.08em}
  #result p{font-size:20px;letter-spacing:.12em}
  #againBtn{margin-top:8px;font:700 18px var(--jp);letter-spacing:.15em;color:#fff;background:#d8433a;border:0;
    border-radius:28px;padding:12px 34px;cursor:pointer}
```

`<div id="toast"></div>` の行の前に足す：

```html
<div id="score"><span class="t0">味方</span><b id="s0">0</b><span>-</span><b id="s1">0</b><span class="t1">相手</span></div>
<div id="result"><h2 id="resultText"></h2><p id="resultScore"></p><button id="againBtn">もう一回</button></div>
```

- [ ] **Step 2: `src/60-hud.js` の末尾に足す**

```js
function setScore(s) {
  document.getElementById('s0').textContent = s[0];
  document.getElementById('s1').textContent = s[1];
}
function showResult(winner, s) {
  document.getElementById('resultText').textContent = winner === 0 ? '勝ち！' : '負け……';
  document.getElementById('resultScore').textContent = '味方 ' + s[0] + ' - ' + s[1] + ' 相手';
  document.getElementById('result').classList.add('on');
}
function hideResult() { document.getElementById('result').classList.remove('on'); }
```

- [ ] **Step 3: `src/42-motions.js`**

`POSES` の `serveHold` の次に足す：

```js
  stagger: {                                              // ぶつかってよろける：のけぞって両腕を振り回す
    hipsDrop: 0.08,
    spine: [-0.4, 0.2, 0.15], neck: [0.3, 0, 0],
    shoulderL: [-1.6, 0, 1.0], elbowL: [-0.4, 0, 0],
    shoulderR: [-1.2, 0, -1.2], elbowR: [-0.6, 0, 0],
    hipL: [0.2, 0, 0.1], kneeL: [0.5, 0, 0],
    hipR: [-0.6, 0, -0.1], kneeR: [0.9, 0, 0],
  },
```

`poseFor` の先頭（`const t = a.task;` の次）に足す：

```js
  if (a.stun > 0) return POSES.stagger;
```

- [ ] **Step 4: `src/90-boot.js`**

`startPoint(R, 0);                                       // 最初のサーブはプレイヤーのチーム` の行を次に置き換える：

```js
  document.getElementById('againBtn').addEventListener('click', () => {
    hideResult();
    newGame(R);
    setScore(R.score);
  });
  newGame(R);                                             // 0-0、最初のサーブはプレイヤーのチーム
```

イベントの `for` の中、`else if (e.type === 'explode') { ... }` の後に足す：

```js
      else if (e.type === 'point') {
        setScore(e.score);
        showToast(e.scorer === 0 ? '味方に 1 点！' : '相手に 1 点……', 1.4);
      }
      else if (e.type === 'gameover') showResult(e.winner, e.score);
      else if (e.type === 'bump') showToast('ゴツン！', 0.8);
```

- [ ] **Step 5: 画面で確かめる**

Run: `sh build.sh` → アプリ内ブラウザで bakudan-volley.html を開く（resize_window `{width:1280,height:720}` → navigate し直す → `dispatchEvent(new Event('resize'))`。終わったら preset "desktop" に戻す）。

Expected（javascript_tool で `GAME.choose(...)` を呼び、wait してから撮る）:
1. 上の真ん中に「味方 0 - 0 相手」
2. サーブを打つと、敵の近いほうが走ってレシーブし、相方がトスし、アタックしてくる（「アタックが来る！」）
3. 爆発のあと「相手に 1 点……」などが出て点数が変わり、全員が歩いて定位置へ戻ってから次のサーブが始まる
4. `GAME.R.score = [2, 0]` にしてから相手コートで爆発させると「勝ち！ 味方 3 - 0 相手」の画面が出る。「もう一回」で 0-0 から自分のサーブ
5. コンソールにエラーが無い。verify.html は PASS 46/46

ラリー中（敵がレシーブしている所）と勝敗の画面を撮る。

- [ ] **Step 6: Commit**

```bash
git add src bakudan-volley.html index.html verify.html
git commit -m "点数と勝敗の画面、もう一回。ぶつかったらよろける"
```

---

## Phase 3 の終わり

本人に `C:\Users\PC_User\Second brain\bakudan-volley\bakudan-volley.html` を開いて遊んでもらう。確かめてもらうのは次の 3 点。
- 1 試合（3 点先取）を通して遊べるか、長さはちょうどよいか
- AI の強さ（勝てるか、理不尽に負けないか）
- AI のミス（反応の遅れ・ぶつかる・空振り）が笑えるか、多すぎないか

吹っ飛び・爆発の演出・本格的なモーションは Phase 4 で入れる。
