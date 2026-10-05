# Phase 2 4 つの行動と選択 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 選ぶ場面になると時間がスローになり、画面下の 4 つのボタン（PC は 1〜4 キー）から行動を選べる。選ぶと自分の選手が走って跳んで打つ。味方はレシーブのカバーとトスを自動で行う。敵は Phase 2 の試しとして、サーブとアタック（トス → スパイク）を交互に打ってくるだけで、こちらの球は受けない。

**Architecture:** 選手の動き（`15-actors.js`）とラリーの流れ（`16-rally.js`）は three.js を使わず、`verify.html` で自動テストする。描画側（`40-player.js` / `42-motions.js` / `90-boot.js`）は、毎フレーム `tickRally` を呼んでから、そこで出た出来事（`R.events`）と選手の状態を見て絵を合わせるだけにする。

**Tech Stack:** 素の JavaScript、three.js r128。Node は無い。

**仕様書:** `docs/superpowers/specs/2026-10-05-bakudan-volley-design.md`（3.3 選ぶ場面と 4 択、3.4 ブロック、4 AI の「レシーブした人がアタック、もう 1 人がトス」）

**Phase 1 の約束はそのまま:** Y が上、x<0 が味方（team 0）、x≥0 が敵（team 1）。爆弾は床でだけ爆発する（`12-ball.js` は変えない）。

---

## 用語

| 言葉 | 意味 |
|---|---|
| actor | 選手のデータ（位置・跳んでいる高さ・今の仕事）。`R.actors[0]` がプレイヤー（me）、`[1]` が味方（mate）、`[2][3]` が敵 |
| task | 選手の今の仕事。`at` へ走り、爆弾が高さ `h` まで降りてきて手の届く距離（`CFG.reach`）にあれば触る（`contact: true`）。空振りやネット際で跳ぶだけの仕事は `contact: false` |
| pending | まだ爆弾がこちらへ来ていないので、どこへ走ればよいか分からない仕事。相手が打った瞬間に `aimTask` で行き先が決まる |
| scene | 選ぶ場面。`'serve'` ①自分のサーブ番、`'incoming'` ②相手が打った（`attack: true` なら相手のトス＝アタックが来る）、`'tossed'` ③味方が自分にトスした |
| task.kind | `receive`（②のレシーブ）/ `toss` / `attack`（③のアタック）/ `direct`（②で直接打ち返す）/ `block` / `serve` / `return`（③のレシーブ＝弱く確実に返す）/ `bump`・`standSpike`（①でサーブ以外を選んだとき）/ `whiff`（場面に合わないサーブの構えで空振り）/ `blockNoop`（相手が打っていないのにネット際で跳ぶ） |

ブロックは、相手のスパイクがネットを越える 0.1 秒前後に空中にいないと止められない。そのため、相手がアタッカーへトスを上げた瞬間に②（`attack: true`）を開く。レシーブを選ぶと、スパイクが打たれた瞬間に行き先が決まる。

## ファイル

| ファイル | 変更 |
|---|---|
| `src/10-config.js` | Phase 2 の数値を足し、試し投げの `test` を消す |
| `src/14-shot.js` | `predictDescent`（爆弾が高さ h まで降りてくる場所と時間）と `spikeVelocity`（強打。ネットにかかるなら速さを落とす）を足す |
| `src/15-actors.js` | 新規。選手の移動・ジャンプ・爆弾に触れたかの判定 |
| `src/16-rally.js` | 新規。ラリーの流れ・選択・成功判定・打った球の行き先 |
| `src/00-head.html` | 4 つのボタン・残り時間のバー・場面の文字 |
| `src/50-input.js` | ボタンと 1〜4 キー（試し投げは消す） |
| `src/60-hud.js` | ボタンの表示・残り時間・場面の文字 |
| `src/42-motions.js` | 走る・レシーブ・トス・ジャンプ・スパイク・ブロック・サーブのポーズと、選手の状態からポーズを選ぶ `poseFor` |
| `src/40-player.js` | `updatePlayer` を actor に合わせる形に変える（ポーズはなめらかに寄せる） |
| `src/90-boot.js` | ラリーを回す形に書き換える |
| `build.sh` | `15-actors.js` `16-rally.js` を本体と検証の両方に足す |
| `src/verify-tests.js` | テストを足す |

テストの「実行」は Phase 1 と同じ。`sh build.sh` のあと `verify.html` を開き、`document.title` が `PASS n/n` になればよい。

---

### Task 1: 数値と、予測・強打の計算

**Files:** Modify `src/10-config.js`, `src/14-shot.js`, `src/verify-tests.js`, `build.sh`

- [ ] **Step 1: `src/10-config.js` の `test: ...` の行を消し、`explodeDelay` の行の次に次を足す**

```js
  // ---- Phase 2：行動と選択 ----
  slowScale: 0.15,                                        // 選ぶ間の時間の速さ
  choiceTime: 2.5,                                        // 選べる時間（実時間・秒）。過ぎたら味方に任せる
  afterBoom: 1.6,                                         // 爆発してから次のサーブまで（秒）
  runSpeed: 7,                                            // 選手が走る速さ m/s
  reach: 1.0,                                             // 爆弾に手が届く横の距離 m
  jumpH: 0.9,                                             // アタック・ブロック・サーブで跳ぶ高さ m
  contactH: { receive: 0.8, toss: 2.3, attack: 3.4, direct: 2.4, serve: 2.8 },   // 爆弾に触る高さ m
  serveSpot: 9.5,                                         // サーブを打つ位置（ネットからの距離。エンドラインの 0.5m 外）
  serveHold: 0.9,                                         // サーブ前に構える「真剣な間」（秒）
  hardSpeed: 13,                                          // これより速い球は「強い球」（直接打ち返しにくい）
  shots: {
    pass: { toX: 2.0, apex: 5.5 },                        // レシーブ → ネットから 2m の自陣へ高く上げる
    set: { toX: 1.2, apex: 6.0 },                         // トス → ネットから 1.2m のアタック位置へ
    spikeSpeed: 17, serveApex: 4.2, returnApex: 5.0,
  },
  success: {                                              // 場面 × 行動の成功率（仕様書 3.3）
    serve: { receive: 0.3, attack: 0.4, serve: 0.9 },
    incoming: { receive: 0.9, directSoft: 0.7, directHard: 0.25, block: 0.6 },
    tossed: { receive: 0.95, attack: 0.9 },
  },
  ai: { receive: 0.85, toss: 0.9, attack: 0.8, serve: 0.9 },
  enemyOpeners: ['serve', 'attack'],                      // Phase 2 の試し：敵は サーブ → トスからアタック を交互に打つ
```

- [ ] **Step 2: `build.sh` の本体と検証の両方で、`src/14-shot.js \` の次の行に足す**

```sh
    src/15-actors.js \
    src/16-rally.js \
```

`src/15-actors.js` と `src/16-rally.js` を、コメント 1 行（`// ===== 選手の動き（three.js 非依存） =====` / `// ===== ラリーの流れ（three.js 非依存） =====`）だけで作っておく。

- [ ] **Step 3: テストを書く**（Task 3 のテストの後、`// ===== 結果表示 =====` の直前）

```js
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
```

- [ ] **Step 4: 失敗を確かめる**

Run: `sh build.sh` → verify.html を開く
Expected: FAIL（`predictDescent is not defined` など。Phase 1 の 14 本は通過のまま）

- [ ] **Step 5: `src/14-shot.js` の末尾に足す**

```js
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
```

- [ ] **Step 6: 通過を確かめる**

Run: `sh build.sh` → verify.html を再読み込み
Expected: `PASS 18/18`

- [ ] **Step 7: Commit**

```bash
git add build.sh src
git commit -m "Phase 2 の数値と、落ちてくる場所の予測・強打の計算"
```

---

### Task 2: 選手の動き

**Files:** Modify `src/15-actors.js`, `src/verify-tests.js`

- [ ] **Step 1: テストを書く**（Task 1 のテストの後）

```js
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
```

- [ ] **Step 2: 失敗を確かめる**

Run: `sh build.sh` → verify.html を再読み込み
Expected: FAIL（`newActor is not defined`）

- [ ] **Step 3: 実装する（`src/15-actors.js` を丸ごと書き換え）**

```js
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
  if (t.kind === 'block') {                               // ネットの上で、空中の手に当たれば止める
    if (t.ok && a.y > 0.3 && Math.abs(p.x) < 0.7 && Math.abs(p.z - a.z) < 0.9 && p.y > 2.2 && p.y < 2.5 + CFG.jumpH + 0.6) return 'hit';
    if (p.x * dirOf(a.team) < -1.0) return 'miss';        // 自陣の奥へ抜けた
    return null;
  }
  if (ball.vel.y > 0 || p.y > t.h) return null;           // まだ上にある
  if (Math.hypot(p.x - a.x, p.z - a.z) <= CFG.reach) return t.whiff ? 'miss' : 'hit';
  if (p.y < t.h - 0.6) return 'miss';
  return null;
}
```

- [ ] **Step 4: 通過を確かめる**

Run: `sh build.sh` → verify.html を再読み込み
Expected: `PASS 21/21`

- [ ] **Step 5: Commit**

```bash
git add src/15-actors.js src/verify-tests.js
git commit -m "選手の動き：走る・跳ぶ・爆弾に触れたかの判定"
```

---

### Task 3: ラリーの流れ

**Files:** Modify `src/16-rally.js`, `src/verify-tests.js`

- [ ] **Step 1: テストを書く**（Task 2 のテストの後）

テストでは `rand` を `() => 0` にする。そうすると成功判定はすべて「成功」（成功率 0 のものだけ失敗）になり、狙う場所も決まった場所になる。

```js
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
const hitBy = (ev, a, kind) => ev.some(e => e.type === 'hit' && e.actor === a && e.kind === kind);
const boomSide = ev => { const e = ev.find(e => e.type === 'explode'); return e ? e.side : null; };

test('startPoint(0)：プレイヤーがエンドラインの外で爆弾を持ち、①サーブ番の選択になる', () => {
  const R = newRally(zero);
  startPoint(R, 0);
  eq([R.state, R.choose.scene, R.ball.held === R.me], ['choose', 'serve', true]);
  eq(R.me.x, -CFG.serveSpot);
  eq(R.events.some(e => e.type === 'choose' && e.scene === 'serve'), true);
});

test('① サーブを選ぶと、構えてからトスを上げて打ち、相手コートで爆発する', () => {
  const R = newRally(zero);
  startPoint(R, 0);
  choose(R, 'serve');
  const ev = runFor(R, 5);
  eq(hitBy(ev, R.me, 'serve'), true);
  eq(boomSide(ev), 1);
});

test('① 時間切れなら自動でサーブする', () => {
  const R = newRally(zero);
  startPoint(R, 0);
  const ev = runFor(R, CFG.choiceTime + 0.1);
  eq(ev.some(e => e.type === 'chosen' && e.action === null), true);
  eq(R.state, 'play');
  eq(R.me.task && R.me.task.kind, 'serve');
});

test('① ブロックを選ぶと、爆弾を持ったままネット際で跳んで戻り、もう一度選ぶ', () => {
  const R = newRally(zero);
  startPoint(R, 0);
  choose(R, 'block');
  const ev = runUntilChoose(R, 6);
  eq(ev.some(e => e.type === 'choose' && e.scene === 'serve'), true);
  eq(R.ball.held === R.me, true);
  eq(ev.some(e => e.type === 'explode'), false);
});

test('敵のサーブを打たれた瞬間に ②（アタックではない）の選択になる', () => {
  const R = newRally(zero);
  startPoint(R, 1);
  const ev = runUntilChoose(R, 4);
  const c = ev.find(e => e.type === 'choose');
  eq(c && [c.scene, c.attack], ['incoming', false]);
  eq(hitBy(ev, R.actors[2], 'serve'), true);
});

test('② レシーブ → 味方がトス → ③ の選択 → アタックで相手コートに爆発', () => {
  const R = newRally(zero);
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
  const R = newRally(zero);
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
  const R = newRally(zero);
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
  const R = newRally(zero);
  startPoint(R, 1);
  runUntilChoose(R, 4);
  choose(R, 'serve');
  eq(R.me.task.kind, 'whiff');
  const ev = runFor(R, 3);
  eq(hitBy(ev, R.mate, 'receive'), true);
});

test('敵がトスを上げた瞬間に ②（アタックが来る）の選択になり、ブロックで止めて相手コートに落とせる', () => {
  const R = newRally(zero);
  R.openerIdx = 1;                                         // 敵の 2 番目の打ち方＝トスからアタック
  startPoint(R, 1);
  const c = R.events.find(e => e.type === 'choose');
  eq(c && [c.scene, c.attack], ['incoming', true]);
  choose(R, 'block');
  const ev = runFor(R, 5);
  eq(hitBy(ev, R.actors[3], 'attack'), true, '敵がアタック');
  eq(hitBy(ev, R.me, 'block'), true, 'ブロックで止めた');
  eq(boomSide(ev), 1);
});

test('爆発したら、取られた側のサーブで次が始まる', () => {
  const R = newRally(zero);
  startPoint(R, 0);
  choose(R, 'serve');
  runFor(R, 5 + CFG.afterBoom);                             // 相手コートで爆発 → 敵のサーブ
  eq(R.actors[2].lastHit !== null || R.ball.held === R.actors[2], true);
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `sh build.sh` → verify.html を再読み込み
Expected: FAIL（`newRally is not defined`）

- [ ] **Step 3: 実装する（`src/16-rally.js` を丸ごと書き換え）**

```js
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
      return t.ok ? spikeVelocity(from, opp(4.5, 8.5), S.spikeSpeed) : intoNet();
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
    const colliders = R.actors.filter(a => !(a.task && a.task.contact)).map(a => ({ x: a.x, z: a.z }));   // 打とうとしている人には当たらない
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
```

- [ ] **Step 4: 通過を確かめる**

Run: `sh build.sh` → verify.html を再読み込み
Expected: `PASS 32/32`

失敗したテストがあれば、テストを緩める前に `R.actors` の位置・`task`・`R.ball` を出力して原因を突き止める。タイミングが原因の可能性が高いのは、ブロックのテスト（跳ぶ時刻とネットを越える時刻）と、③のアタック（届く距離）。直すのは数値（`CFG`）か、`aimTask` / `giveBlock` の時刻の計算にする。直した箇所と原因は最終報告に書く。

- [ ] **Step 5: Commit**

```bash
git add src/16-rally.js src/verify-tests.js
git commit -m "ラリーの流れ：スローでの選択、4 つの行動、味方のカバーとトス、敵の試しのサーブとアタック"
```

---

### Task 4: ボタンと入力

**Files:** Modify `src/00-head.html`, `src/50-input.js`, `src/60-hud.js`

- [ ] **Step 1: `src/00-head.html` の CSS で、`/* ---- 試し用の案内（Phase 1） ---- */` とその次の `#hint{...}` の行を、次に置き換える**

```css
  /* ---- 操作の案内 ---- */
  #hint{position:fixed;left:16px;top:14px;z-index:5;font-size:13px;opacity:.8;pointer-events:none;text-shadow:0 1px 6px #000}

  /* ---- 4 つの行動ボタン（選ぶ場面だけ明るくなる） ---- */
  #actions{position:fixed;left:50%;bottom:max(14px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:6;
    display:flex;flex-wrap:wrap;gap:8px 10px;width:min(640px,calc(100vw - 32px));opacity:.35;transition:opacity .15s;pointer-events:none}
  #actions.on{opacity:1;pointer-events:auto}
  #actions button{flex:1 1 0;min-width:0;padding:10px 4px;border:2px solid rgba(255,255,255,.55);border-radius:12px;
    background:rgba(20,24,30,.72);color:#fff;font:700 clamp(14px,2.6vw,18px) var(--jp);letter-spacing:.06em;cursor:pointer;touch-action:manipulation}
  #actions.on button{border-color:#ffd04a;background:rgba(60,44,10,.85)}
  #actions button b{display:block;font-size:11px;font-weight:400;opacity:.7}
  #actions button:active{transform:scale(.96)}
  #timer{flex:0 0 100%;height:5px;background:rgba(255,255,255,.18);border-radius:3px;overflow:hidden}
  #timer i{display:block;height:100%;width:0;background:#ffd04a}

  /* ---- 選ぶ場面の文字 ---- */
  #scene{position:fixed;left:50%;bottom:calc(max(14px,env(safe-area-inset-bottom)) + 84px);transform:translateX(-50%);z-index:6;
    font-size:clamp(16px,3vw,22px);font-weight:700;letter-spacing:.1em;text-shadow:0 2px 10px #000;white-space:nowrap;
    opacity:0;transition:opacity .15s;pointer-events:none}
  #scene.on{opacity:1}
```

- [ ] **Step 2: `src/00-head.html` の `<div id="hint">…</div>` の行を、次に置き換える**

```html
<div id="hint">スローになったら 1〜4 キー（スマホはボタン）で次の行動を選ぶ</div>
<div id="scene"></div>
<div id="actions">
  <button data-act="receive"><b>1</b>レシーブ</button>
  <button data-act="attack"><b>2</b>アタック</button>
  <button data-act="block"><b>3</b>ブロック</button>
  <button data-act="serve"><b>4</b>サーブ</button>
  <div id="timer"><i></i></div>
</div>
```

- [ ] **Step 3: `src/50-input.js` を丸ごと書き換え**

```js
// ===== 入力：4 つの行動ボタン（スマホはタップ）と 1〜4 キー =====
function initInput(onAction) {
  for (const btn of document.querySelectorAll('#actions button')) {
    btn.addEventListener('pointerdown', e => { e.preventDefault(); onAction(btn.dataset.act); });
  }
  const keys = {
    Digit1: 'receive', Digit2: 'attack', Digit3: 'block', Digit4: 'serve',
    Numpad1: 'receive', Numpad2: 'attack', Numpad3: 'block', Numpad4: 'serve',
  };
  addEventListener('keydown', e => { if (keys[e.code]) onAction(keys[e.code]); });
}
```

- [ ] **Step 4: `src/60-hud.js` の末尾に足す**

```js
const SCENE_TEXT = { serve: 'サーブ番', incoming: '相手が打った！', tossed: 'トスが上がった！' };
function showChoice(scene, attack) {
  document.getElementById('actions').classList.add('on');
  const el = document.getElementById('scene');
  el.textContent = scene === 'incoming' && attack ? 'アタックが来る！' : SCENE_TEXT[scene];
  el.classList.add('on');
}
function hideChoice() {
  document.getElementById('actions').classList.remove('on');
  document.getElementById('scene').classList.remove('on');
  setTimer(0);
}
function setTimer(frac) {
  document.querySelector('#timer i').style.width = (Math.max(0, Math.min(1, frac)) * 100) + '%';
}
```

- [ ] **Step 5: Commit**（Task 5 で起動部分を直すまで本体は動かないので、画面の確認は Task 5 で行う）

```bash
git add src/00-head.html src/50-input.js src/60-hud.js
git commit -m "4 つの行動ボタンと 1〜4 キー、残り時間と場面の文字"
```

---

### Task 5: ポーズと、ラリーを回す起動部分

**Files:** Modify `src/42-motions.js`, `src/40-player.js`, `src/90-boot.js`

- [ ] **Step 1: `src/42-motions.js` の `POSES` に、`ready` の次へ足す**（角度の約束はファイル冒頭のコメントどおり）

```js
  run1: {                                                 // 走る（左脚が前）
    hipsDrop: 0.05,
    spine: [0.3, 0, 0], neck: [-0.2, 0, 0],
    shoulderL: [0.7, 0, 0.1], elbowL: [-1.3, 0, 0],
    shoulderR: [-0.9, 0, -0.1], elbowR: [-1.3, 0, 0],
    hipL: [-0.9, 0, 0], kneeL: [0.6, 0, 0],
    hipR: [0.4, 0, 0], kneeR: [1.3, 0, 0],
  },
  receive: {                                              // レシーブ：深く腰を落とし、両腕を組んで前へ伸ばす
    hipsDrop: 0.2,
    spine: [0.5, 0, 0], neck: [-0.4, 0, 0],
    shoulderL: [-1.0, 0, -0.28], elbowL: [0, 0, 0],
    shoulderR: [-1.0, 0, 0.28], elbowR: [0, 0, 0],
    hipL: [-0.8, 0, 0.15], kneeL: [1.4, 0, 0],
    hipR: [-0.8, 0, -0.15], kneeR: [1.4, 0, 0],
  },
  toss: {                                                 // トス：額の前で両手を開く
    hipsDrop: 0.05,
    spine: [-0.1, 0, 0], neck: [0.2, 0, 0],
    shoulderL: [-2.6, 0, 0.3], elbowL: [-1.1, 0, 0],
    shoulderR: [-2.6, 0, -0.3], elbowR: [-1.1, 0, 0],
    hipL: [-0.25, 0, 0.05], kneeL: [0.45, 0, 0],
    hipR: [-0.25, 0, -0.05], kneeR: [0.45, 0, 0],
  },
  jump: {                                                 // 空中：両腕を上げ、膝を軽くたたむ
    spine: [0, 0, 0],
    shoulderL: [-2.8, 0, 0.2], elbowL: [-0.3, 0, 0],
    shoulderR: [-2.8, 0, -0.2], elbowR: [-0.3, 0, 0],
    hipL: [-0.3, 0, 0], kneeL: [0.6, 0, 0],
    hipR: [-0.3, 0, 0], kneeR: [0.6, 0, 0],
  },
  spikeBack: {                                            // スパイクの振りかぶり：背中を反らし、右手を頭の後ろへ
    spine: [-0.35, 0.3, 0], neck: [0.2, 0, 0],
    shoulderL: [-2.6, 0, 0.2], elbowL: [-0.3, 0, 0],
    shoulderR: [-2.9, 0, -0.2], elbowR: [-1.7, 0, 0],
    hipL: [-0.5, 0, 0], kneeL: [1.0, 0, 0],
    hipR: [-0.2, 0, 0], kneeR: [1.1, 0, 0],
  },
  spikeHit: {                                             // 振り下ろし：体をたたみ、右腕を前へ
    spine: [0.5, -0.3, 0], neck: [-0.3, 0, 0],
    shoulderL: [-0.4, 0, 0.3], elbowL: [-0.6, 0, 0],
    shoulderR: [-1.0, 0, -0.1], elbowR: [-0.2, 0, 0],
    hipL: [-0.6, 0, 0], kneeL: [0.9, 0, 0],
    hipR: [-0.4, 0, 0], kneeR: [0.7, 0, 0],
  },
  block: {                                                // ブロック：両腕をまっすぐ上へ
    spine: [0.05, 0, 0],
    shoulderL: [-3.0, 0, 0.12], elbowL: [0, 0, 0],
    shoulderR: [-3.0, 0, -0.12], elbowR: [0, 0, 0],
    hipL: [-0.1, 0, 0], kneeL: [0.2, 0, 0],
    hipR: [-0.1, 0, 0], kneeR: [0.2, 0, 0],
  },
  serveHold: {                                            // サーブの構え：左手で爆弾を前に持ち、じっと狙う
    spine: [0.1, 0, 0], neck: [-0.1, 0, 0],
    shoulderL: [-1.2, 0, 0], elbowL: [-0.6, 0, 0],
    shoulderR: [-0.3, 0, -0.15], elbowR: [-0.5, 0, 0],
    hipL: [-0.2, 0, 0.05], kneeL: [0.3, 0, 0],
    hipR: [0.15, 0, -0.05], kneeR: [0.2, 0, 0],
  },
```

- [ ] **Step 2: `src/42-motions.js` の末尾（`POSES` の閉じかっこの後）に足す**

```js
POSES.run2 = mirrorPose(POSES.run1);                      // 走る（右脚が前）

// 左右を入れ替えたポーズ（L ↔ R。ry と rz は向きが逆になる）
function mirrorPose(p) {
  const out = { hipsDrop: p.hipsDrop };
  for (const k in p) {
    if (k === 'hipsDrop') continue;
    const m = k.endsWith('L') ? k.slice(0, -1) + 'R' : k.endsWith('R') ? k.slice(0, -1) + 'L' : k;
    out[m] = [p[k][0], -p[k][1], -p[k][2]];
  }
  return out;
}

const HIT_POSE = { receive: 'receive', bump: 'receive', return: 'receive', toss: 'toss',
  attack: 'spikeHit', direct: 'spikeHit', standSpike: 'spikeHit', serve: 'spikeHit', block: 'block' };
const WAIT_POSE = { receive: 'receive', bump: 'receive', return: 'receive', toss: 'toss', serve: 'serveHold' };

// 選手の状態（15-actors.js の actor）から、今とるべきポーズを選ぶ
function poseFor(a, simT) {
  const t = a.task;
  const recent = a.lastHit && simT - a.lastHit.at < 0.45;   // 打った直後はその形を残す
  if (a.y > 0) {
    if (t && (t.kind === 'block' || t.kind === 'blockNoop')) return POSES.block;
    if (recent) return POSES[HIT_POSE[a.lastHit.kind]] || POSES.jump;
    if (t && t.jump) return POSES.spikeBack;
    return POSES.jump;
  }
  if (recent) return POSES[HIT_POSE[a.lastHit.kind]] || POSES.ready;
  if (a.moving) return Math.sin(simT * 14 + a.id) > 0 ? POSES.run1 : POSES.run2;
  if (t && t.kind === 'whiff') return simT - t.start < 0.35 ? POSES.spikeBack : POSES.spikeHit;
  if (t && WAIT_POSE[t.kind]) return POSES[WAIT_POSE[t.kind]];
  return POSES.ready;
}
```

`POSES.run2 = mirrorPose(...)` は `function mirrorPose` より前の行にあるが、関数宣言は巻き上げられるので動く。

- [ ] **Step 3: `src/40-player.js` の `updatePlayer` を丸ごと置き換える**

```js
// 選手の見た目を actor（15-actors.js）に合わせる。ポーズは目標へなめらかに寄せ、focus（爆弾）を目で追う
function updatePlayer(pl, a, dt, simT, focus) {
  const target = poseFor(a, simT);
  if (!pl.cur) pl.cur = { hipsDrop: 0 };
  const k = Math.min(1, dt * 14);
  for (const name of JOINTS) {
    const to = target[name] || [0, 0, 0];
    const c = pl.cur[name] || (pl.cur[name] = [0, 0, 0]);
    for (let i = 0; i < 3; i++) c[i] += (to[i] - c[i]) * k;
  }
  pl.cur.hipsDrop += ((target.hipsDrop || 0) - pl.cur.hipsDrop) * k;
  applyPose(pl, pl.cur);
  pl.root.position.set(a.x, a.y, a.z);
  if (!a.moving && a.y === 0 && !a.task) pl.j.hips.position.y += Math.sin(simT * 3 + pl.phase) * 0.012;   // 構えたまま小さく揺れる
  lookAtTarget(pl, focus, dt);
}
```

- [ ] **Step 4: `src/90-boot.js` を丸ごと書き換え**

```js
// ===== 起動とメインループ =====
(function boot() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  buildGym(scene);
  initFx(scene);
  const camera = new THREE.PerspectiveCamera(CFG.camera.fov, innerWidth / innerHeight, 0.1, 200);
  CAM.cam = camera;

  const R = newRally();
  const players = R.actors.map(a => {
    const pl = makePlayer(scene, a.team);
    placePlayer(pl, a.x, a.z);                            // 向き（ネットのほう）を決める
    return pl;
  });
  const bombMesh = makeBombMesh(scene);
  initInput(act => choose(R, act));
  window.GAME = { R, choose: act => choose(R, act) };     // 確認用

  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  });

  startPoint(R, 0);                                       // 最初のサーブはプレイヤーのチーム
  const clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 1 / 30);
    tickRally(R, dt);
    for (const e of R.events) {
      if (e.type === 'choose') showChoice(e.scene, e.attack);
      else if (e.type === 'chosen') { hideChoice(); if (e.action === null) showToast('時間切れ！', 1.0); }
      else if (e.type === 'explode') {
        spawnExplosion(e.x, e.z);
        showToast(e.side === 0 ? '味方コートで爆発！' : '相手コートで爆発！');
      }
    }
    R.events.length = 0;
    if (R.state === 'choose') setTimer(R.choose.left / CFG.choiceTime);
    const slow = R.state === 'choose' ? CFG.slowScale : 1;
    const shown = R.ball && !(R.state === 'boom' && R.boom.fired) ? R.ball : null;   // 爆発したら爆弾を消す
    const focus = R.ball ? R.ball.pos : { x: 0, y: 3, z: 0 };
    R.actors.forEach((a, i) => updatePlayer(players[i], a, dt, R.simT, focus));
    updateBombMesh(bombMesh, shown, dt * slow);
    updateFx(dt);
    updateCamera(dt, R.ball ? R.ball.pos.x : 0);
    renderer.render(scene, camera);
  }
  frame();
})();
```

- [ ] **Step 5: 画面で確かめる**

Run: `sh build.sh` → アプリ内ブラウザで bakudan-volley.html を開く。パネルは縦長なので、`resize_window` を `{width:1280, height:720}` にしてから再読み込みし、`dispatchEvent(new Event('resize'))` を実行して描画の大きさを合わせてから撮る。終わったら `resize_window` を `preset:"desktop"` に戻す。

Expected（javascript_tool で `GAME.choose('serve')` などを呼び、`computer` の wait で待ってから撮る）:
1. 開くとプレイヤー（青、左手前）がエンドラインの外で爆弾を持って構えている。ボタンが明るくなり「サーブ番」が出て、残り時間のバーが縮む
2. `GAME.choose('serve')`：構えて間をとり、トスを上げて跳んで打つ。相手コートで爆発し、少しあと敵がサーブを打つ。打った瞬間にスローになり「相手が打った！」が出る
3. `GAME.choose('receive')`：落下地点へ走り、腰を落としてレシーブする。味方がトスを上げると「トスが上がった！」が出る。`GAME.choose('attack')` で跳んでスパイクを打ち、相手コートで爆発する
4. 次の敵の番（トスからアタック）で「アタックが来る！」が出る。`GAME.choose('block')`：ネット際へ走り、両腕を上げて跳ぶ
5. 何も選ばずに待つと「時間切れ！」が出て、味方が動く
6. コンソールにエラーが無い。verify.html は `PASS 32/32`

レシーブ・トス・スパイクの瞬間とブロックで跳んでいる所を撮る。

- [ ] **Step 6: Commit**

```bash
git add src bakudan-volley.html index.html verify.html
git commit -m "スローで行動を選ぶと、選手が走って跳んで打つ。走る・レシーブ・トス・スパイク・ブロック・サーブの形"
```

---

## Phase 2 の終わり

本人に `C:\Users\PC_User\Second brain\bakudan-volley\bakudan-volley.html` を開いて遊んでもらう。確かめてもらうのは次の 3 点。
- 選んで、走って、打つまでの流れが気持ちよいか
- スローの速さ（0.15 倍）と選べる時間（2.5 秒）
- 成功・失敗の割合と、失敗したときの見え方

敵はまだこちらの球を受けないので、うまく打てば必ず相手コートで爆発する。ラリーと点数は Phase 3 で入れる。
