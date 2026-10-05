# Phase 5 演出強化・タイトル Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 本人が選んだ 5 つを入れる。
1. **すすだらけで起き上がる**：吹っ飛んだ人は顔と服が真っ黒、髪はアフロになって起き上がる。次の爆発まで、そのまま真面目にバレーを続ける
2. **壁に人型の跡**：壁に張り付いた所に大の字のへこみが残り、試合中ずっと増えていく（最大 12 個）
3. **真面目な実況テロップ**：「見事なレシーブ！」「これは痛い！」「何事もなかったかのように起き上がります」などを、中継の字幕のように画面左上に出す
4. **爆発のリプレイ**：点が入ったら、爆発の前後を低い角度から半分の速さで見せ直す。タップかキーで飛ばせる
5. **真面目なスポーツ中継風のタイトル**：「第 1 回 全日本 爆弾バレーボール選手権」。後ろで AI どうしが試合をしていて、ときどき爆発する。遊び方を 3 行で書き、「試合開始」で始める。勝敗の画面には「タイトルへ」も置く

**Architecture:** すす・壁の跡の出来事・実況の文の選び方・リプレイの記録は three.js を使わずに書き、`verify.html` で試す。リプレイは描画側（`90-boot.js`）で行う。再生中はラリーを止め、記録しておいた選手の見た目（位置・回転・関節）を半分の速さで当て直す。

**Tech Stack:** 素の JavaScript、three.js r128、Web Audio。Node は無い。

**仕様書:** `docs/superpowers/specs/2026-10-05-bakudan-volley-design.md`（7 画面とカメラ、9 爆発後）

**公開:** 本人の選択は「完成したら公開する」。この計画には入れない。Phase 5 を遊んで OK が出たら、GitHub Pages への公開の手順を別に行う（外へ出す操作なので、本人の確認を取ってから）。

---

## ファイル

| ファイル | 変更 |
|---|---|
| `src/10-config.js` | `comment`（実況）と `replay`（リプレイ）の数値 |
| `src/15-actors.js` | `soot` を持たせる |
| `src/16-rally.js` | `newGame` ですすを落とす |
| `src/20-blast.js` | 吹っ飛んだ人をすすだらけにする。壁に張り付いたら `stick`、起き上がったら `getup` の出来事 |
| `src/24-commentary.js` | 新規。出来事から実況の文を選ぶ（three.js 非依存） |
| `src/40-player.js` | すす（色を暗く）とアフロ |
| `src/46-replay.js` | 新規。リプレイの記録・探す・当て直す（three.js の物は作らない） |
| `src/47-decals.js` | 新規。壁の人型の跡 |
| `src/00-head.html` | タイトル・実況・リプレイの表示、勝敗の画面に「タイトルへ」 |
| `src/60-hud.js` | 実況・リプレイの表示、タイトルの出し入れ |
| `src/90-boot.js` | タイトル（後ろで試合）、実況、リプレイ、壁の跡、すす |
| `build.sh` | 新しいファイルを足す |
| `src/verify-tests.js` | テストを足す |

---

### Task 1: すす・壁の跡・起き上がりの出来事（ロジック）

**Files:** Modify `src/15-actors.js`, `src/16-rally.js`, `src/20-blast.js`, `src/verify-tests.js`

- [ ] **Step 1: テストを書く**（`// ===== 結果表示 =====` の直前）

```js
// ===== Phase 5：すす・壁の跡・起き上がり =====
test('すす：吹っ飛んだ人だけすすだらけ。次の爆発で入れ替わり、newGame で落ちる', () => {
  const R = quietRally();
  startPoint(R, 0);
  blastActors(R, { x: 5, z: 0, side: 1 });
  eq(R.actors.map(a => a.soot), [false, false, true, true]);
  startPoint(R, 0);
  eq(R.actors.map(a => a.soot), [false, false, true, true], '次の点の間はそのまま');
  blastActors(R, { x: -5, z: 0, side: 0 });
  eq(R.actors.map(a => a.soot), [true, true, false, false], '次の爆発で入れ替わる');
  newGame(R);
  eq(R.actors.map(a => a.soot), [false, false, false, false]);
});

test('すす：飛んできた人に巻き込まれて飛んだ人も、すすだらけ', () => {
  const a = newActor(0, 0, -5, 0), b = newActor(1, 0, -4, 0), R = soloR(a, b);
  launch(R, a, { x: 6, y: 0.5, z: 0 });
  for (let i = 0; i < 20 && !b.fly; i++) { stepFly(a, 1 / 60, R); collideFlyers(R); }
  eq([a.soot, b.soot], [true, true]);
});

test('壁に張り付いたら stick（どの壁か）、起き上がったら getup の出来事', () => {
  const a = newActor(0, 0, -13, 0), R = soloR(a);
  launch(R, a, { x: -15, y: 3, z: 0 });
  flyFor(R, a, 4);
  const s = R.events.find(e => e.type === 'stick');
  eq(s && [s.axis, s.sign], ['x', -1]);
  eq(R.events.some(e => e.type === 'getup' && e.actor === a), true);
});
```

- [ ] **Step 2: 失敗を確かめる**

Run: `sh build.sh` → verify.html を開く
Expected: FAIL（新しい 3 本）

- [ ] **Step 3: 実装する**

`src/15-actors.js` の `newActor` の返す中身の最後（`landT: null` の後）に `, soot: false` を足す。

`src/20-blast.js`：
- `launch` の `a.task = null; a.stun = 0;` の行を `a.task = null; a.stun = 0; a.soot = true;   // 吹っ飛んだ人はすすだらけ` にする
- `blastActors` の `const B = CFG.blast;` の次の行に足す：

```js
  for (const a of R.actors) a.soot = false;               // 前の爆発のすすは落ちる（次の爆発まではそのまま）
```

- `hitWallsBody` の張り付くところの `R.events.push({ type: 'crash', ... });` の次の行に足す：

```js
      R.events.push({ type: 'stick', actor: a, axis: ax, sign: s, x: p.x, y: p.y, z: p.z });   // 壁の人型の跡を残す
```

- `stepFly` の `getup` の終わり `if (f.t > B.getupTime) { ...; a.fly = null; return; }` を次にする：

```js
    if (f.t > B.getupTime) {
      a.x = p.x; a.z = p.z; a.y = 0; a.vy = 0; a.fly = null;
      R.events.push({ type: 'getup', actor: a });
      return;
    }
```

`src/16-rally.js` の `newGame` の `R.score = [0, 0]; R.winner = null;` の次の行に足す：

```js
  for (const a of R.actors) a.soot = false;
```

- [ ] **Step 4: 通過を確かめる**

Run: `sh build.sh` → verify.html を再読み込み
Expected: PASS（70/70）

- [ ] **Step 5: Commit**

```bash
git add src bakudan-volley.html index.html verify.html
git commit -m "吹っ飛んだ人はすすだらけ（次の爆発まで）。壁に張り付いた・起き上がったの出来事"
```

---

### Task 2: 実況の文を選ぶ・リプレイの記録（ロジック）

**Files:** Create `src/24-commentary.js`, `src/46-replay.js`; Modify `src/10-config.js`, `build.sh`, `src/verify-tests.js`

- [ ] **Step 1: `src/10-config.js` の `motion: { ... },` の次に足す**

```js
  // ---- Phase 5：演出 ----
  comment: { hold: 2.2 },                                 // 実況の文を出しておく秒数（この間は、より大事な出来事だけ差し替える）
  replay: { before: 0.5, after: 2.0, speed: 0.5, keep: 8, fov: 50 },   // 爆発の何秒前から何秒後まで、何倍の速さで。記録は 8 秒ぶん
```

- [ ] **Step 2: `build.sh`**

本体の `src/22-sound.js \` の次に `src/24-commentary.js \`、`src/45-camera.js \` の次に `src/46-replay.js \` と `src/47-decals.js \` を足す。
検証の `src/20-blast.js \` の次に `src/24-commentary.js \`、`src/42-motions.js \` の次に `src/46-replay.js \` を足す。

`src/47-decals.js` はコメント 1 行（`// ===== 壁の人型の跡 =====`）で作っておく（中身は Task 4）。

- [ ] **Step 3: テストを書く**（Task 1 のテストの後）

```js
// ===== 実況 =====
test('実況：出来事の種類で文を選ぶ（爆発はどちらのコートか、天井、壁、起き上がり）', () => {
  const C = { until: 0, prio: -1, last: '' };
  eq(COMMENT_LINES.explodeThem.includes(pickComment(C, { type: 'explode', side: 1 }, 0, zero)), true);
  const C2 = { until: 0, prio: -1, last: '' };
  eq(COMMENT_LINES.explodeUs.includes(pickComment(C2, { type: 'explode', side: 0 }, 0, zero)), true);
  eq(commentKey({ type: 'crash', y: CFG.gym.ceil - 0.45 }), 'ceiling');
  eq(commentKey({ type: 'crash', y: 3 }), null, '壁への激突は stick で言う');
  eq(commentKey({ type: 'hit', kind: 'receive', ok: false }), null, '弾いたレシーブはほめない');
  eq(commentKey({ type: 'hit', kind: 'attack', ok: true }), 'attack');
  eq(commentKey({ type: 'getup' }), 'getup');
});

test('実況：出している間（hold 秒）は、より大事な出来事だけ差し替える', () => {
  const C = { until: 0, prio: -1, last: '' };
  eq(!!pickComment(C, { type: 'hit', kind: 'receive', ok: true }, 0, zero), true);
  eq(pickComment(C, { type: 'hit', kind: 'toss', ok: true }, 0.5, zero), null, '同じか低い優先度は出さない');
  eq(!!pickComment(C, { type: 'explode', side: 1 }, 0.6, zero), true, '爆発は差し替える');
  eq(!!pickComment(C, { type: 'hit', kind: 'receive', ok: true }, 0.6 + CFG.comment.hold + 0.01, zero), true, '時間がたてば出す');
});

test('実況：同じ文を続けて出さない', () => {
  const C = { until: 0, prio: -1, last: '' };
  const a = pickComment(C, { type: 'hit', kind: 'receive', ok: true }, 0, zero);
  const b = pickComment(C, { type: 'hit', kind: 'receive', ok: true }, 10, zero);
  eq(a !== b, true);
});

// ===== リプレイ =====
function fakePlayer(x) {                                   // 記録に使う項目だけを持つ選手の見た目
  const j = {};
  for (const n of JOINTS) j[n] = { rotation: { x: 0, y: 0, z: 0 }, position: { y: 0 } };
  return { root: { position: { x, y: 0, z: 0 }, rotation: { y: 0 } }, tumble: { rotation: { x: 0, z: 0 } }, j };
}
function fakeBomb() { return { g: { visible: true, position: { x: 1, y: 2, z: 3 } }, shadow: { visible: true, position: { x: 0, y: 0, z: 0 } } }; }

test('リプレイ：記録は keep 秒より古いものを捨て、frameAt はその時刻以前で一番新しいフレームを返す', () => {
  const rec = makeRecorder(), pl = fakePlayer(0), bomb = fakeBomb();
  for (let i = 0; i <= 100; i++) { pl.root.position.x = i; recordFrame(rec, i * 0.1, [pl], bomb, 5); }
  eq(rec.frames[0].t >= 10 - 5 - 1e-9, true, '古いものは捨てる');
  eq(frameAt(rec, 7.25).players[0].p[0], 72);
  eq(frameAt(rec, 0).players[0].p[0], rec.frames[0].players[0].p[0], '範囲より前は最初');
  eq(frameAt(rec, 99).players[0].p[0], 100, '範囲より後は最後');
});

test('リプレイ：applyFrame で、記録した位置・回転・関節・爆弾を当て直す', () => {
  const rec = makeRecorder(), pl = fakePlayer(0), bomb = fakeBomb();
  pl.root.position.x = 3; pl.root.rotation.y = 1; pl.tumble.rotation.x = 2; pl.j.kneeL.rotation.x = 1.5; pl.j.hips.position.y = 0.8;
  recordFrame(rec, 0, [pl], bomb, 5);
  bomb.g.visible = false;
  recordFrame(rec, 1, [pl], bomb, 5);
  const target = fakePlayer(0), b2 = fakeBomb();
  applyFrame(frameAt(rec, 0), [target], b2);
  eq([target.root.position.x, target.root.rotation.y, target.tumble.rotation.x, target.j.kneeL.rotation.x, target.j.hips.position.y], [3, 1, 2, 1.5, 0.8]);
  eq([b2.g.visible, b2.g.position.x], [true, 1]);
  applyFrame(frameAt(rec, 1), [target], b2);
  eq([b2.g.visible, b2.shadow.visible], [false, false]);
});
```

- [ ] **Step 4: 失敗を確かめる**

Run: `sh build.sh` → verify.html を再読み込み
Expected: FAIL（新しい 5 本）

- [ ] **Step 5: `src/24-commentary.js` を書く**

```js
// ===== 実況テロップ（three.js 非依存） =====
// 爆弾が爆発しても、実況はあくまで真面目に。出来事の種類から文を選ぶ
const COMMENT_LINES = {
  serve: ['サーブです', '静かにサーブの構えに入りました', 'さあ、注目のサーブ'],
  receive: ['見事なレシーブ！', 'きれいに上げました', '落ち着いて拾いました'],
  toss: ['いいトスです', 'セッター、冷静です'],
  attack: ['強烈なスパイク！', '打ち込んだ！', '鋭い！'],
  block: ['ブロック！ 止めました！', '高い壁です！'],
  miss: ['あーっと、空振り！', '触れません！'],
  bump: ['おっと、ぶつかった！', 'お見合い……ではなく、衝突です'],
  explodeUs: ['あーっと、自陣で爆発！', 'これは痛い！'],
  explodeThem: ['決まったー！ 相手コートで爆発！', '相手コート、爆発です！'],
  ceiling: ['天井まで飛んだ！', '天井に届きました'],
  stick: ['壁に、張り付いています', 'これは見事な大の字'],
  net: ['ネットに引っかかっています', 'ネットにぶら下がっています'],
  getup: ['何事もなかったかのように起き上がります', '平然と立ち上がりました', '試合は続きます'],
  gameover: ['試合終了！', 'ここで試合終了です'],
};
// 優先度：出している間は、これより大きいものだけ差し替える
const COMMENT_PRIO = { serve: 0, toss: 0, receive: 1, attack: 1, miss: 1, getup: 1, block: 2, bump: 2, ceiling: 2, stick: 2, net: 2,
  explodeUs: 3, explodeThem: 3, gameover: 3 };

// 出来事 → 実況の種類（言わないものは null）
function commentKey(e) {
  if (e.type === 'hit') {
    if (e.kind === 'serve') return 'serve';
    if (e.kind === 'toss') return 'toss';
    if (e.kind === 'block') return 'block';
    if (['attack', 'direct', 'standSpike'].includes(e.kind)) return e.ok ? 'attack' : null;
    if (['receive', 'return', 'bump'].includes(e.kind)) return e.ok ? 'receive' : null;
    return null;
  }
  if (e.type === 'explode') return e.side === 0 ? 'explodeUs' : 'explodeThem';
  if (e.type === 'crash') return e.y > CFG.gym.ceil - 1 ? 'ceiling' : null;
  if (['miss', 'bump', 'stick', 'net', 'getup', 'gameover'].includes(e.type)) return e.type;
  return null;
}

// C = { until, prio, last }（出している文の状態）。now は実時間。出すなら文、出さないなら null
function pickComment(C, e, now, rand) {
  const key = commentKey(e);
  if (!key) return null;
  const prio = COMMENT_PRIO[key];
  if (now < C.until && prio <= C.prio) return null;
  const lines = COMMENT_LINES[key].filter(s => s !== C.last);   // 同じ文は続けない
  const text = lines[Math.floor((rand || Math.random)() * lines.length)];
  C.until = now + CFG.comment.hold; C.prio = prio; C.last = text;
  return text;
}
```

- [ ] **Step 6: `src/46-replay.js` を書く**

```js
// ===== 爆発のリプレイ（記録と当て直し。three.js の物は作らない） =====
// 毎フレーム、選手と爆弾の見た目（位置・回転・関節）を記録しておき、点が入ったら爆発の前後をスローで見せ直す
function makeRecorder() { return { frames: [] }; }

// t は実時間。keep 秒より古いフレームは捨てる
function recordFrame(rec, t, players, bomb, keep) {
  rec.frames.push({
    t,
    players: players.map(pl => ({
      p: [pl.root.position.x, pl.root.position.y, pl.root.position.z],
      ry: pl.root.rotation.y,
      tr: [pl.tumble.rotation.x, pl.tumble.rotation.z],
      hy: pl.j.hips.position.y,
      j: JOINTS.map(n => [pl.j[n].rotation.x, pl.j[n].rotation.y, pl.j[n].rotation.z]),
    })),
    ball: bomb.g.visible ? [bomb.g.position.x, bomb.g.position.y, bomb.g.position.z] : null,
  });
  while (rec.frames.length && rec.frames[0].t < t - keep) rec.frames.shift();
}

// 時刻 t 以前で一番新しいフレーム（t が最初より前なら最初）
function frameAt(rec, t) {
  const F = rec.frames;
  let lo = 0, hi = F.length - 1;
  if (t <= F[0].t) return F[0];
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (F[mid].t <= t) lo = mid; else hi = mid - 1;
  }
  return F[lo];
}

// フレームの見た目を、選手と爆弾に当て直す
function applyFrame(f, players, bomb) {
  f.players.forEach((s, i) => {
    const pl = players[i];
    pl.root.position.x = s.p[0]; pl.root.position.y = s.p[1]; pl.root.position.z = s.p[2];
    pl.root.rotation.y = s.ry;
    pl.tumble.rotation.x = s.tr[0]; pl.tumble.rotation.z = s.tr[1];
    JOINTS.forEach((n, k) => { const r = pl.j[n].rotation; r.x = s.j[k][0]; r.y = s.j[k][1]; r.z = s.j[k][2]; });
    pl.j.hips.position.y = s.hy;
  });
  bomb.g.visible = bomb.shadow.visible = !!f.ball;
  if (f.ball) {
    bomb.g.position.x = f.ball[0]; bomb.g.position.y = f.ball[1]; bomb.g.position.z = f.ball[2];
    bomb.shadow.position.x = f.ball[0]; bomb.shadow.position.z = f.ball[2];
  }
}
```

- [ ] **Step 7: 通過を確かめる**

Run: `sh build.sh` → verify.html を再読み込み
Expected: PASS（75/75）

- [ ] **Step 8: Commit**

```bash
git add build.sh src bakudan-volley.html index.html verify.html
git commit -m "実況の文を選ぶ（優先度・同じ文を続けない）、リプレイの記録と当て直し"
```

---

### Task 3: すすとアフロの見た目

**Files:** Modify `src/40-player.js`

- [ ] **Step 1: `makePlayer` を直す**

`part(head, new THREE.SphereGeometry(0.125, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), hair, 0, 0.115, -0.01);` の行を次に置き換える（髪を覚えておき、アフロを作っておく）：

```js
  const hairMesh = part(head, new THREE.SphereGeometry(0.125, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), hair, 0, 0.115, -0.01);
  const afro = new THREE.Group();                         // 爆発で髪がアフロになる（普段は隠す）
  afro.visible = false;
  head.add(afro);
  const afroMat = lam(0x14100c);
  for (const [x, y, z] of [[0, 0.25, 0], [0.11, 0.2, 0], [-0.11, 0.2, 0], [0, 0.2, 0.11], [0, 0.2, -0.11],
    [0.08, 0.14, 0.08], [-0.08, 0.14, 0.08], [0.08, 0.14, -0.08], [-0.08, 0.14, -0.08]]) {
    part(afro, new THREE.SphereGeometry(0.1, 10, 8), afroMat, x, y, z);
  }
```

`makePlayer` の `return` を次にする：

```js
  return { root, tumble, j, team, phase: Math.random() * 6, look: { yaw: 0, pitch: 0 }, tx: 0, tz: 0,
    mats: { skin, shirt, shorts }, base: { skin: 0xeec39a, shirt: col.shirt, shorts: col.shorts }, hairMesh, afro, soot: false };
```

- [ ] **Step 2: ファイルの末尾に足す**

```js
// すすだらけ（顔は焦げ茶、服は暗く、髪はアフロ）と、元に戻す
function setSoot(pl, on) {
  pl.soot = on;
  pl.mats.skin.color.setHex(on ? 0x3a2c22 : pl.base.skin);
  pl.mats.shirt.color.setHex(pl.base.shirt);
  pl.mats.shorts.color.setHex(pl.base.shorts);
  if (on) { pl.mats.shirt.color.multiplyScalar(0.3); pl.mats.shorts.color.multiplyScalar(0.4); }
  pl.hairMesh.visible = !on;
  pl.afro.visible = on;
}
```

`updatePlayer` の先頭（`const f = a.fly;` の次）に足す：

```js
  if (!!a.soot !== pl.soot) setSoot(pl, !!a.soot);
```

- [ ] **Step 3: 画面で確かめる**

Run: `sh build.sh` → bakudan-volley.html を開き、javascript_tool で `onFloor(GAME.R, { x: 5, z: 0, side: 1 })` を呼ぶ（Task 5 でタイトルが入るまでは、今の画面のまま）。

Expected: 敵 2 人が、顔は焦げ茶・服は暗く・髪はアフロになって飛び、起き上がる。次の点の間もそのまま。コンソールにエラーが無い。寄せて撮る（`CFG.camera.y = 2.5; CFG.camera.z = 6; CFG.camera.lookY = 1.2; CFG.camera.follow = 1` などを一時的に）。

- [ ] **Step 4: Commit**

```bash
git add src bakudan-volley.html index.html verify.html
git commit -m "すすだらけの見た目：顔と服を暗く、髪はアフロ"
```

---

### Task 4: 壁の人型の跡

**Files:** Modify `src/47-decals.js`

- [ ] **Step 1: `src/47-decals.js` を書く**

```js
// ===== 壁の人型の跡（張り付いた所に大の字のへこみが残る。試合中は増えていき、最大 12 個） =====
const DECALS = { scene: null, list: [], geo: null, mat: null };

function initDecals(scene) {
  DECALS.scene = scene;
  const rect = (cx, cy, w, h, ang) => {                   // 中心 (cx, cy)、幅 w・長さ h、ang だけ傾けた長方形
    const s = new THREE.Shape(), c = Math.cos(ang), n = Math.sin(ang);
    const pts = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([x, y]) => [cx + x * c - y * n, cy + x * n + y * c]);
    s.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < 4; i++) s.lineTo(pts[i][0], pts[i][1]);
    s.closePath();
    return s;
  };
  const head = new THREE.Shape();
  head.absarc(0, 0.72, 0.17, 0, Math.PI * 2, false);
  const shapes = [
    head,
    rect(0, 0.15, 0.44, 0.78, 0),                         // 胴
    rect(0.48, 0.72, 0.17, 0.8, -1.0), rect(-0.48, 0.72, 0.17, 0.8, 1.0),   // 腕（斜め上へ開く）
    rect(0.3, -0.65, 0.2, 0.95, 0.4), rect(-0.3, -0.65, 0.2, 0.95, -0.4),   // 脚（斜め下へ開く）
  ];
  DECALS.geo = new THREE.ShapeGeometry(shapes);
  DECALS.mat = new THREE.MeshLambertMaterial({ color: 0x6b7670, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
}

// stick の出来事（axis, sign, x, y, z）から跡を足す。手前の壁（見えない）には残さない
function addDecal(e) {
  if (e.axis === 'z' && e.sign > 0) return;
  const G = CFG.gym, m = new THREE.Mesh(DECALS.geo, DECALS.mat);
  const y = clamp(e.y, 1.0, G.ceil - 1.0);
  if (e.axis === 'x') { m.position.set(e.sign * (G.halfX - 0.01), y, e.z); m.rotation.y = -e.sign * Math.PI / 2; }
  else { m.position.set(e.x, y, e.sign * (G.halfZ - 0.01)); m.rotation.y = 0; }
  m.rotation.z = (Math.random() - 0.5) * 0.6;            // 少し傾いて張り付く
  m.receiveShadow = true;
  DECALS.scene.add(m);
  DECALS.list.push(m);
  if (DECALS.list.length > 12) DECALS.scene.remove(DECALS.list.shift());
}

function clearDecals() {
  for (const m of DECALS.list) DECALS.scene.remove(m);
  DECALS.list.length = 0;
}
```

- [ ] **Step 2: `src/90-boot.js` につなぐ**

`initFx(scene);` の次の行に `initDecals(scene);` を足す。イベントの `for` の中に足す：

```js
      else if (e.type === 'stick') addDecal(e);
```

（壁に張り付いたときは `crash` と `stick` の 2 つの出来事が続けて積まれる。揺れと音は `crash`、跡は `stick` で扱う。）

`againBtn` のクリックの中の `newGame(R);` の前に `clearDecals();` を足す。

- [ ] **Step 3: 画面で確かめる**

Run: `sh build.sh` → bakudan-volley.html を開く。javascript_tool で、敵を横の壁へ飛ばす：`const e = GAME.R.actors[2]; e.x = 12; launch(GAME.R, e, { x: 12, y: 4, z: 0 })`。数秒待って撮る。

Expected: 右の壁に大の字の跡が残る（壁より少し暗い色、ちらつかない）。奥の壁でも同じ（`launch(GAME.R, e, { x: 0, y: 4, z: -14 })`）。コンソールにエラーが無い。

- [ ] **Step 4: Commit**

```bash
git add src bakudan-volley.html index.html verify.html
git commit -m "壁に張り付いた所に、大の字の人型の跡が残る"
```

---

### Task 5: 実況・リプレイ・タイトル（画面）

**Files:** Modify `src/00-head.html`, `src/60-hud.js`, `src/22-sound.js`, `src/90-boot.js`

- [ ] **Step 1: `src/00-head.html` の CSS の最後（`</style>` の前）に足す**

```css
  /* ---- 実況テロップ（中継の字幕） ---- */
  #caption{position:fixed;left:16px;top:56px;z-index:6;max-width:calc(100vw - 32px);display:flex;align-items:stretch;
    opacity:0;transform:translateX(-12px);transition:opacity .2s,transform .2s;pointer-events:none}
  #caption.on{opacity:1;transform:none}
  #caption i{font-style:normal;font-size:11px;letter-spacing:.2em;background:#ffd04a;color:#1a1a1a;padding:6px 8px;display:flex;align-items:center}
  #caption span{background:rgba(12,18,32,.88);padding:6px 14px;font-size:clamp(14px,2.4vw,18px);letter-spacing:.06em;font-weight:700}

  /* ---- リプレイ ---- */
  #replayTag{position:fixed;right:16px;top:14px;z-index:8;display:none;flex-direction:column;align-items:flex-end;gap:4px;pointer-events:none}
  #replayTag.on{display:flex}
  #replayTag b{background:#d8433a;color:#fff;font-size:18px;letter-spacing:.2em;padding:4px 12px}
  #replayTag small{font-size:12px;opacity:.85;text-shadow:0 1px 6px #000}

  /* ---- タイトル（真面目なスポーツ中継風。後ろで試合が続いている） ---- */
  #title{position:fixed;inset:0;z-index:20;display:flex;flex-direction:column;justify-content:center;gap:10px;
    padding:24px max(24px,6vw);background:linear-gradient(90deg,rgba(8,12,22,.92) 0%,rgba(8,12,22,.7) 45%,rgba(8,12,22,.1) 100%)}
  #title.off{display:none}
  #title .cup{font-size:clamp(12px,1.8vw,15px);letter-spacing:.25em;color:#ffd04a}
  #title h1{font-size:clamp(40px,8vw,84px);letter-spacing:.12em;line-height:1.1}
  #title .sub{font-size:clamp(12px,1.8vw,15px);letter-spacing:.4em;opacity:.75}
  #title ul{list-style:none;margin:10px 0 6px;font-size:clamp(13px,2vw,16px);line-height:1.9;border-left:3px solid #ffd04a;padding-left:14px}
  #startBtn,#titleBtn{align-self:flex-start;font:700 18px var(--jp);letter-spacing:.2em;color:#fff;background:#d8433a;border:0;border-radius:4px;
    padding:12px 40px;cursor:pointer}
  #title small{font-size:12px;opacity:.6}
  body.titleMode #score,body.titleMode #actions,body.titleMode #hint,body.titleMode #scene{display:none}
  #titleBtn{align-self:center;background:transparent;border:2px solid rgba(255,255,255,.6);padding:10px 30px;font-size:15px}
```

`<div id="flash"></div>` の行の前に足す：

```html
<div id="caption"><i>実況</i><span id="captionText"></span></div>
<div id="replayTag"><b>REPLAY</b><small>タップかキーで飛ばす</small></div>
<div id="title">
  <p class="cup">第 1 回 全日本 爆弾バレーボール選手権</p>
  <h1>爆弾バレー</h1>
  <p class="sub">BOMB VOLLEYBALL ── 2 vs 2</p>
  <ul>
    <li>スローになったら、4 つの行動から次の一手を選ぶ</li>
    <li>爆弾は、床に落ちた瞬間だけ爆発する</li>
    <li>相手コートで 3 回爆発させたら勝ち</li>
  </ul>
  <button id="startBtn">試合開始</button>
  <small>PC は 1〜4 キー、スマホは画面下のボタン</small>
</div>
```

`<body>` を `<body class="titleMode">` にする。

勝敗の画面の `<button id="againBtn">もう一回</button>` の次に `<button id="titleBtn">タイトルへ</button>` を足す。

- [ ] **Step 2: `src/60-hud.js` の末尾に足す**

```js
let __captionTimer = 0;
function showCaption(text) {
  document.getElementById('captionText').textContent = text;
  const el = document.getElementById('caption');
  el.classList.add('on');
  clearTimeout(__captionTimer);
  __captionTimer = setTimeout(() => el.classList.remove('on'), CFG.comment.hold * 1000);
}
function setReplayTag(on) { document.getElementById('replayTag').classList.toggle('on', on); }
function setTitle(on) {
  document.getElementById('title').classList.toggle('off', !on);
  document.body.classList.toggle('titleMode', on);
  SND.mute = on;                                          // タイトルの後ろの試合では音を鳴らさない
}
```

`src/22-sound.js` の `const SND = { ... }` に `mute: false` を足し、`sndTone` / `sndNoise` / `sndBurst` の先頭の `if (!SND.ctx) return;` を `if (!SND.ctx || SND.mute) return;` にする（`sndHit` の `if (!SND.ctx) return;` はそのままでよい）。

- [ ] **Step 3: `src/90-boot.js` を書き換える**

`initInput(act => choose(R, act));` を次にする（タイトル中とリプレイ中は選べない）：

```js
  let titleOn = true, replay = null, pendingResult = null, lastBoom = null, realT = 0;
  const rec = makeRecorder(), CMT = { until: 0, prio: -1, last: '' };
  initInput(act => { if (!titleOn && !replay) choose(R, act); });
```

`window.GAME = { ... };` を次にする：

```js
  window.GAME = { R, choose: act => choose(R, act), start: () => startGame() };   // 確認用
```

`againBtn` のクリックの処理（`hideResult(); ... setScore(R.score);` の部分）を消し、`newGame(R);                                             // 0-0、...` の行を次にまとめて置き換える：

```js
  // 試合を始める（タイトルの「試合開始」・勝敗の画面の「もう一回」）
  function startGame() {
    titleOn = false; replay = null; pendingResult = null; lastBoom = null;
    setTitle(false); setReplayTag(false); hideResult(); hideChoice();
    clearDecals();
    newGame(R);                                           // 積まれた①の選択は、次のフレームでボタンに出る
    setScore(R.score);
  }
  // タイトルへ：後ろで AI どうしの試合を流す
  function showTitle() {
    titleOn = true; replay = null; pendingResult = null;
    setTitle(true); setReplayTag(false); hideResult(); hideChoice();
    newGame(R);
    R.events.length = 0;
  }
  // リプレイ：爆発の before 秒前から after 秒後までを、speed 倍の速さで、低い角度から見せ直す
  function startReplay() {
    const P = CFG.replay;
    replay = { t: lastBoom.t - P.before, end: lastBoom.t + P.after, boom: lastBoom, fired: false };
    lastBoom = null;
    setReplayTag(true); hideChoice();
  }
  function endReplay() {
    replay = null;
    setReplayTag(false);
    FX.freeze = 0;
    if (pendingResult) { showResult(pendingResult.winner, pendingResult.score); pendingResult = null; }
  }
  function stepReplay(dt) {
    const P = CFG.replay, b = replay.boom;
    replay.t += dt * P.speed;
    applyFrame(frameAt(rec, replay.t), players, bombMesh);
    if (!replay.fired && replay.t >= b.t) { replay.fired = true; spawnExplosion(b.x, b.z); FX.freeze = 0; sndBoom(); }
    updateFx(dt * P.speed);
    camera.fov = P.fov; camera.updateProjectionMatrix();
    const sx = b.x < 0 ? 1 : -1;                          // 爆心よりネット寄りの、低い所から
    camera.position.set(b.x + sx * 5.5, 1.6, b.z + 7);
    camera.lookAt(b.x, 2.2, b.z);
    if (replay.t >= replay.end) endReplay();
  }
  // タイトル中の試合：プレイヤーの番も、少し待ってから場面に合う行動を自動で選ぶ
  function demoPick(c) {
    if (c.scene === 'serve') return 'serve';
    if (c.scene === 'tossed') return 'attack';
    return c.attack && Math.random() < 0.4 ? 'block' : 'receive';
  }

  document.getElementById('startBtn').addEventListener('click', startGame);
  document.getElementById('againBtn').addEventListener('click', startGame);
  document.getElementById('titleBtn').addEventListener('click', showTitle);
  addEventListener('pointerdown', () => { if (replay) endReplay(); });
  addEventListener('keydown', () => { if (replay) endReplay(); });
  showTitle();
```

`frame()` の中：
- `const dt = Math.min(clock.getDelta(), 1 / 30);` の次に `realT += dt;` と、リプレイ中の処理を足す：

```js
    realT += dt;
    if (replay) { stepReplay(dt); renderer.render(scene, camera); return; }
```

- `tickRally(R, dt);` の前に足す（タイトル中の自動の選択）：

```js
    if (titleOn && R.state === 'choose' && R.choose.left < CFG.choiceTime - 0.8) choose(R, demoPick(R.choose));
```

- イベントの `for` の先頭に、実況を足す（タイトル中も流す）：

```js
      const line = pickComment(CMT, e, realT);
      if (line) showCaption(line);
```

- イベントの処理を直す：
  - `if (e.type === 'choose') { showChoice(e.scene, e.attack); sndSlow(); }` → `if (e.type === 'choose') { if (!titleOn) { showChoice(e.scene, e.attack); sndSlow(); } }`
  - `else if (e.type === 'explode') {` の中の最初に `lastBoom = { t: realT, x: e.x, z: e.z, side: e.side };` を足す
  - `else if (e.type === 'point') {` の中の最後に足す：`if (!titleOn && lastBoom && realT - lastBoom.t < CFG.replay.keep - CFG.replay.after) startReplay();`
  - `else if (e.type === 'gameover') showResult(e.winner, e.score);` → 次にする：

```js
      else if (e.type === 'gameover') {
        if (titleOn) newGame(R);                          // タイトル中の試合は、終わったらそのまま次へ
        else if (replay) pendingResult = e;               // リプレイを見せてから勝敗の画面
        else showResult(e.winner, e.score);
      }
```

- `renderer.render(scene, camera);`（frame の最後）の直前に、記録を足す：

```js
    recordFrame(rec, realT, players, bombMesh, CFG.replay.keep);
```

- [ ] **Step 4: 画面で確かめる**

Run: `sh build.sh` → bakudan-volley.html を開く（resize_window `{width:1280,height:720}`、効かなければ `{width:640,height:360}` → navigate し直す → `dispatchEvent(new Event('resize'))`。最後に preset "desktop" に戻す）。

Expected:
1. 開くとタイトル。左に「第 1 回 全日本 爆弾バレーボール選手権」「爆弾バレー」、遊び方 3 行、「試合開始」。後ろで 4 人が試合を続け、ときどき爆発し、左上に実況が出る。点数とボタンは出ない
2. `GAME.start()`（か「試合開始」のクリック）で 0-0、①サーブ番の選択になる
3. 試合中、出来事に合わせて実況が出る（「見事なレシーブ！」「決まったー！ 相手コートで爆発！」「何事もなかったかのように起き上がります」など）
4. 点が入ると右上に「REPLAY」が出て、爆発の前後が低い角度から半分の速さで流れ、爆発も出し直される。キーを押すかタップで飛ばせる。終わると試合に戻り、定位置へ戻ってサーブになる
5. 3 点目のあとは、リプレイを見せてから勝敗の画面。「もう一回」で 0-0、「タイトルへ」でタイトル
6. 吹っ飛んだ人はすすだらけ・アフロで、壁には跡が残る（Task 3・4 のまま）
7. コンソールにエラーが無い。verify.html は PASS 75/75

タイトル・実況・リプレイ中の画面を撮る。

- [ ] **Step 5: Commit**

```bash
git add src bakudan-volley.html index.html verify.html
git commit -m "タイトル（真面目な中継風、後ろで試合）、真面目な実況テロップ、点が入ったら爆発のリプレイ"
```

---

## Phase 5 の終わり

本人に `C:\Users\PC_User\Second brain\bakudan-volley\bakudan-volley.html` を開いて、タイトルから通しで遊んでもらう。確かめてもらうのは次の 4 点。
- タイトルの雰囲気
- 実況の文と出る頻度
- リプレイの長さ（毎回だと長いか）
- すす・アフロ・壁の跡

OK が出たら、GitHub Pages で公開する（リポジトリ作成と Pages の設定は、本人にアプリ内ブラウザでサインインしてもらう。公開は本人の確認を取ってから）。
