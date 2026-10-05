# Phase 4a 爆発・吹っ飛び・カメラ・音 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 爆弾が床に触れると、一瞬止まって画面が白く光り、大きな火の玉・爆風の輪・煙・火花・床板の破片が出て、カメラが揺れる。爆発した側の 2 人は猛烈に吹き飛ぶ。体はくるくる回りながら天井・壁・ネット・他の選手に当たって跳ね返り、壁に当たると張り付いてからずり落ちる。床に落ちると何メートルも滑る。ときどき 1 人だけ異常に高く飛んだり、ネットに引っかかったりする。煙が晴れると、何事もなかったように起き上がる。打つ音・ホイッスル・爆発・激突の音も付ける。

**Architecture:** 吹っ飛びの物理は `20-blast.js`（three.js 非依存）に書き、`verify.html` でテストする。吹っ飛んでいる選手は `actor.fly` を持ち、その間は普段の動き（`stepActor`）の代わりに `stepFly` で動く。ラリーは、全員が起き上がるまで（最長 `CFG.blast.maxTime` 秒）点を進めない。見た目の側では、選手の体の中心で回す入れ物（`tumble`）を足し、回転と寝る・起き上がる動きを付ける。音は Web Audio で作り、音声ファイルは使わない。

**Tech Stack:** 素の JavaScript、three.js r128、Web Audio。Node は無い。

**仕様書:** `docs/superpowers/specs/2026-10-05-bakudan-volley-design.md`（6 爆発と吹っ飛び、7 カメラ、8 音、3.5 1 点の流れ）

**Phase 4 の分け方（本人の選択）:** 4a ＝爆発・吹っ飛び・カメラ・音（「バカ」の側）。遊んで OK のあと、4b ＝本格的なモーション（「本格」の側）。

---

## ファイル

| ファイル | 変更 |
|---|---|
| `src/10-config.js` | `blast`（吹っ飛び）と `fx`（演出）の数値を足す |
| `src/20-blast.js` | 新規。吹っ飛ばす・飛んでいる体の物理・体どうしのぶつかり（three.js 非依存） |
| `src/16-rally.js` | 爆発で吹っ飛ばす。飛んでいる人は `stepFly` で動かす。全員が起き上がってから点を進める |
| `src/22-sound.js` | 新規。音（Web Audio） |
| `src/40-player.js` | 体の中心で回す入れ物 `tumble`。飛んでいる・寝ている・起き上がる見た目 |
| `src/42-motions.js` | ばたつく・壁に張り付く・寝ているポーズと、それを選ぶ `flyPose` |
| `src/44-explosion-fx.js` | 爆発の演出を作り直す（白い光・火の玉 2 重・輪・煙・火花・破片・一瞬の静止） |
| `src/45-camera.js` | 爆発の間は、上を見上げて爆発のほうへ振り、大きく揺らす |
| `src/00-head.html` | 白い光の `#flash` |
| `src/90-boot.js` | 一瞬の静止、音、カメラ、吹っ飛びの出来事 |
| `build.sh` | `20-blast.js` を本体と検証に、`22-sound.js` を本体に足す |
| `src/verify-tests.js` | 吹っ飛びのテスト、Phase 3 のテストの待ち時間の手直し |

---

### Task 1: 吹っ飛びの物理

**Files:** Modify `src/10-config.js`, `build.sh`, `src/verify-tests.js`; Create `src/20-blast.js`

- [ ] **Step 1: `src/10-config.js` の `resetMax` の行の次に足す**

```js
  // ---- Phase 4a：吹っ飛び・爆発 ----
  blast: {
    radius: 12, minPower: 0.45,                           // 爆発した側：中心から遠いほど弱まるが、最低でもこの強さで飛ぶ
    nearRadius: 4, nearPower: 0.4,                        // 反対側：この距離以内なら軽く飛ぶ
    speed: 11, up: 13, jitter: 0.35,                      // 横・上の初速（強さ 1 のとき m/s）と毎回のばらつき（±35%）
    superChance: 0.15, superMul: 1.7,                     // たまに 1 人だけ異常に高く飛ぶ（上の初速が 1.7 倍）
    spin: 14,                                             // 空中で回る速さの幅（rad/s）
    center: 1.0, r: 0.45,                                 // 体の中心の高さ、体の当たり判定（球）の半径
    bounce: 0.45, floorBounce: 0.3, landSpeed: 4,         // 跳ね返り。床へ秒速 landSpeed 以上で落ちたら弾む
    friction: 4,                                          // 床を滑るときの減速 m/s²（秒速 8m なら 8m 滑る）
    stickSpeed: 5, stickTime: 0.35, slideDown: 1.8,       // この速さ以上で壁に当たると張り付き、少ししてずり落ちる
    netHang: 0.25, hangTime: 1.0,                         // ネットに引っかかる確率と、ぶら下がる時間
    downTime: 0.8, getupTime: 0.6,                        // 倒れている時間、起き上がるのにかかる時間
    maxTime: 7,                                           // 爆発からこれ以上は待たずに点を進める（秒）
  },
  fx: { freeze: 0.12 },                                   // 爆発の瞬間に画面を止める時間（秒）
```

- [ ] **Step 2: `build.sh` の本体の `src/16-rally.js \` の次に 2 行、検証の `src/16-rally.js \` の次に 1 行足す**

本体：
```sh
    src/20-blast.js \
    src/22-sound.js \
```
検証：
```sh
    src/20-blast.js \
```

`src/22-sound.js` はコメント 1 行（`// ===== 音（Web Audio） =====`）だけで作っておく。

- [ ] **Step 3: テストを書く**（`// ===== 結果表示 =====` の直前）

```js
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
```

- [ ] **Step 4: 失敗を確かめる**

Run: `sh build.sh` → verify.html を開く
Expected: FAIL（新しい 8 本。`blastActors is not defined` など）

- [ ] **Step 5: `src/20-blast.js` を書く**

```js
// ===== 吹っ飛び（three.js 非依存） =====
// 爆発で選手を体ごと飛ばす。体は中心の高さ center・半径 r の球として、天井・壁・床・ネット・他の選手に当たる
// actor.fly = { pos（体の中心）, vel, rx, rz（回転）, spinX, spinZ, state, t, hung }
// state: 'air' 飛んでいる / 'stick' 壁に張り付き→ずり落ちる / 'slide' 床を滑る / 'hang' ネットにぶら下がる / 'down' 倒れている / 'getup' 起き上がる
// 起き上がり終わると actor.fly は null に戻り、普段の動き（stepActor）に戻る

// 体ごと飛ばす（今の仕事は捨てる）
function launch(R, a, vel) {
  const B = CFG.blast;
  a.task = null; a.stun = 0;
  a.fly = {
    pos: { x: a.x, y: a.y + B.center, z: a.z }, vel, rx: 0, rz: 0,
    spinX: (R.rand() - 0.5) * B.spin, spinZ: (R.rand() - 0.5) * B.spin, state: 'air', t: 0, hung: false,
  };
}

// 爆発（hit = { x, z, side }）で選手を飛ばす。爆発した側は全員、反対側は爆心の近くの人だけ軽く
function blastActors(R, hit) {
  const B = CFG.blast;
  for (const a of R.actors) {
    const dx = a.x - hit.x, dz = a.z - hit.z, d = Math.hypot(dx, dz);
    let k;
    if (a.team === hit.side) k = Math.max(B.minPower, 1 - d / B.radius);
    else if (d < B.nearRadius) k = B.nearPower * (1 - d / B.nearRadius);
    else continue;
    let nx, nz;
    if (d > 0.1) { nx = dx / d; nz = dz / d; }
    else { const ang = R.rand() * Math.PI * 2; nx = Math.cos(ang); nz = Math.sin(ang); }   // 真上で爆発したら向きはでたらめ
    const jit = () => 1 + (R.rand() - 0.5) * 2 * B.jitter;
    const side = B.speed * k * jit();
    const up = B.up * k * jit() * (mishap(R, B.superChance) ? B.superMul : 1);
    launch(R, a, { x: nx * side, y: up, z: nz * side });
  }
}

// 体とネット（白帯から下 1m の薄い板）。引っかかったら true
function hitNetBody(a, R) {
  const f = a.fly, p = f.pos, v = f.vel, N = CFG.net, B = CFG.blast, r = B.r;
  const dx = p.x - clamp(p.x, -N.thick / 2, N.thick / 2);
  const dy = p.y - clamp(p.y, N.bottom, N.top);
  const dz = p.z - clamp(p.z, -N.halfWid, N.halfWid);
  const d = Math.hypot(dx, dy, dz);
  if (d >= r) return false;
  const side = p.x < 0 ? -1 : 1;
  if (!f.hung && mishap(R, B.netHang)) {                  // ネットに引っかかってぶら下がる
    f.hung = true; f.state = 'hang'; f.t = 0;
    p.x = side * 0.3; p.y = N.top - 0.35; p.z = clamp(p.z, -N.halfWid + 0.5, N.halfWid - 0.5);
    v.x = v.y = v.z = 0;
    R.events.push({ type: 'net', actor: a });
    return true;
  }
  if (d < 1e-6) {                                         // 中心がネットの中：来た側へ押し出す
    p.x = side * (N.thick / 2 + r);
    if (v.x * side < 0) v.x = -v.x * B.bounce;
    return false;
  }
  const k = (r - d) / d;
  p.x += dx * k; p.y += dy * k; p.z += dz * k;
  const nx = dx / d, ny = dy / d, nz = dz / d, vn = v.x * nx + v.y * ny + v.z * nz;
  if (vn < 0) { const j = (1 + B.bounce) * vn; v.x -= j * nx; v.y -= j * ny; v.z -= j * nz; }
  return false;
}

// 壁（x=±halfX, z=±halfZ）。速く当たったら張り付く（true）、遅ければ跳ね返る
function hitWallsBody(a, R, canStick) {
  const f = a.fly, p = f.pos, v = f.vel, G = CFG.gym, B = CFG.blast;
  for (const [ax, lim] of [['x', G.halfX], ['z', G.halfZ]]) {
    if (Math.abs(p[ax]) + B.r <= lim) continue;
    const s = Math.sign(p[ax]);
    p[ax] = s * (lim - B.r);
    if (v[ax] * s <= 0) continue;                         // 離れていく向き
    if (canStick && Math.abs(v[ax]) > B.stickSpeed) {
      f.state = 'stick'; f.t = 0;
      v.x = v.y = v.z = 0;
      R.events.push({ type: 'crash', actor: a, x: p.x, y: p.y, z: p.z });
      return true;
    }
    v[ax] = -v[ax] * B.bounce;
  }
  return false;
}

// 飛んでいる人を dt 進める
function stepFly(a, dt, R) {
  const f = a.fly, B = CFG.blast, G = CFG.gym, p = f.pos, v = f.vel;
  f.t += dt;
  if (f.state === 'air') {
    v.y -= CFG.gravity * dt;
    p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt;
    f.rx += f.spinX * dt; f.rz += f.spinZ * dt;
    if (p.y + B.r > G.ceil) {                             // 天井
      p.y = G.ceil - B.r;
      if (v.y > 0) { v.y = -v.y * B.bounce; R.events.push({ type: 'crash', actor: a, x: p.x, y: p.y, z: p.z }); }
    }
    if (!hitWallsBody(a, R, true) && !hitNetBody(a, R) && p.y - B.r <= 0) {   // 床
      p.y = B.r;
      R.events.push({ type: 'land', actor: a, x: p.x, z: p.z });
      if (v.y < -B.landSpeed) { v.y = -v.y * B.floorBounce; f.spinX *= 0.6; f.spinZ *= 0.6; }
      else { v.y = 0; f.state = 'slide'; f.t = 0; }
    }
  } else if (f.state === 'stick') {                       // 壁に張り付いて、少ししたらずり落ちる
    if (f.t > B.stickTime) {
      p.y -= B.slideDown * dt;
      if (p.y - B.r <= 0) { p.y = B.r; f.state = 'down'; f.t = 0; }
    }
  } else if (f.state === 'slide') {                       // 床を滑る
    const s = Math.hypot(v.x, v.z), ns = Math.max(0, s - B.friction * dt);
    if (s > 0) { v.x *= ns / s; v.z *= ns / s; }
    p.x += v.x * dt; p.z += v.z * dt;
    hitWallsBody(a, R, false);
    f.spinX *= Math.max(0, 1 - dt * 3); f.spinZ *= Math.max(0, 1 - dt * 3);
    if (ns < 0.3) { f.state = 'down'; f.t = 0; }
  } else if (f.state === 'hang') {                        // ネットにぶら下がって、落ちる
    if (f.t > B.hangTime) { f.state = 'air'; f.t = 0; v.x = (p.x < 0 ? -1 : 1) * 0.8; v.y = 0; v.z = 0; }
  } else if (f.state === 'down') {
    if (f.t > B.downTime) { f.state = 'getup'; f.t = 0; }
  } else if (f.state === 'getup') {
    if (f.t > B.getupTime) { a.x = p.x; a.z = p.z; a.y = 0; a.vy = 0; a.fly = null; return; }
  }
  a.x = p.x; a.z = p.z;
}

// 飛んでいる体どうし、飛んでいる体と立っている人のぶつかり。立っている人は一緒に吹っ飛ぶ
function collideFlyers(R) {
  const A = R.actors, B = CFG.blast, min = B.r * 2;
  const airborne = o => o.fly && o.fly.state === 'air';
  for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
    const a = A[i], b = A[j];
    if (!airborne(a) && !airborne(b)) continue;
    if ((a.fly && !airborne(a)) || (b.fly && !airborne(b))) continue;   // 寝ている・張り付いている人とはぶつからない
    const pa = a.fly ? a.fly.pos : { x: a.x, y: B.center, z: a.z };
    const pb = b.fly ? b.fly.pos : { x: b.x, y: B.center, z: b.z };
    const dx = pb.x - pa.x, dy = pb.y - pa.y, dz = pb.z - pa.z, d = Math.hypot(dx, dy, dz);
    if (d >= min || d < 1e-6) continue;
    if (!b.fly || !a.fly) {                                // 立っている人に当たった：勢いを半分ずつ分ける
      const flyer = a.fly ? a : b, other = a.fly ? b : a, v = flyer.fly.vel;
      launch(R, other, { x: v.x * 0.5, y: Math.abs(v.y) * 0.5 + 3, z: v.z * 0.5 });
      v.x *= 0.5; v.y *= 0.5; v.z *= 0.5;
    } else {                                               // 飛んでいる体どうし：ぶつかる向きの速さを交換する
      const va = a.fly.vel, vb = b.fly.vel, nx = dx / d, ny = dy / d, nz = dz / d;
      const rel = (va.x - vb.x) * nx + (va.y - vb.y) * ny + (va.z - vb.z) * nz;
      if (rel <= 0) continue;                             // 離れていく向き
      const k = rel * 0.9;
      va.x -= k * nx; va.y -= k * ny; va.z -= k * nz;
      vb.x += k * nx; vb.y += k * ny; vb.z += k * nz;
    }
    R.events.push({ type: 'collide', a, b });
  }
}
```

- [ ] **Step 6: 通過を確かめる**

Run: `sh build.sh` → verify.html を再読み込み
Expected: PASS（54/54）

- [ ] **Step 7: Commit**

```bash
git add build.sh src
git commit -m "吹っ飛びの物理：天井・壁（張り付き）・床（滑る）・ネット（引っかかる）・体どうしのぶつかり"
```

---

### Task 2: ラリーにつなぐ

**Files:** Modify `src/16-rally.js`, `src/verify-tests.js`

- [ ] **Step 1: テストを直す・書く**

(a) ラリーのテストの補助関数（`runUntilChoose` の次）に足す：

```js
function runUntil(R, type, sec) {                          // type の出来事が出るまで（最大 sec 秒）進め、その間の出来事を返す
  const ev = R.events.splice(0);
  for (let i = 0; i < Math.round(sec * 60) && !ev.some(e => e.type === type); i++) {
    tickRally(R, 1 / 60);
    ev.push(...R.events.splice(0));
  }
  return ev;
}
```

(b) `爆発してしばらくすると点が入り…` のテストの `const ev = runFor(R, 5 + CFG.afterBoom);` を次に置き換える（吹っ飛んだ人が起き上がるまで点が入らなくなったため）：

```js
  const ev = runUntil(R, 'point', 5 + CFG.afterBoom + CFG.blast.maxTime);
```

(c) `3 点目で試合が終わり…` のテストの `ev = ev.concat(runFor(R, CFG.explodeDelay + CFG.afterBoom + 0.1));` を次に置き換える：

```js
    ev = ev.concat(runUntil(R, 'point', CFG.explodeDelay + CFG.afterBoom + CFG.blast.maxTime));
```

(d) 吹っ飛びのテストの最後に足す：

```js
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
```

- [ ] **Step 2: 失敗を確かめる**

Run: `sh build.sh` → verify.html を再読み込み
Expected: FAIL（新しい 2 本）

- [ ] **Step 3: 実装する（`src/16-rally.js`）**

`newActor` は `fly` を持たないので、`src/15-actors.js` の `newActor` の返す中身に `fly: null` を足す：

```js
  return { id, team, x, z, y: 0, vy: 0, home: { x, z }, base: { x, z }, task: null, moving: false, lastHit: null, stun: 0, fly: null };
```

`src/15-actors.js` の `separateActors` の `if (a.y > 0 || b.y > 0) continue;` を次に置き換える（飛んでいる人は `collideFlyers` で扱う）：

```js
    if (a.y > 0 || b.y > 0 || a.fly || b.fly) continue;
```

`src/16-rally.js` の `startPoint` の `for` の中の 1 行目を次に置き換える：

```js
    a.task = null; a.y = 0; a.vy = 0; a.lastHit = null; a.stun = 0; a.fly = null;
```

`tickRally` の

```js
  for (const a of R.actors) stepActor(a, dt, R.simT);
  separateActors(R);
```

を次に置き換える：

```js
  for (const a of R.actors) { if (a.fly) stepFly(a, dt, R); else stepActor(a, dt, R.simT); }
  separateActors(R);
  collideFlyers(R);
```

`tickRally` の `if (R.state === 'boom') { ... }` のブロックを次に置き換える：

```js
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
```

`tickRally` の `reset` のブロックの `const home = ...` と `if (home || ...) startServe(...)` の 2 行を次に置き換える（`maxTime` で点を進めたあと、まだ飛んでいる人がいればサーブを始めない。飛んでいる間は時間切れも数えない）：

```js
    const flying = R.actors.some(a => a.fly);
    if (flying) R.resetT = 0;
    const home = R.actors.every(a => Math.hypot(a.x - a.home.x, a.z - a.home.z) < 0.05);
    if (!flying && (home || R.resetT > CFG.resetMax)) startServe(R, R.nextServe);
```

- [ ] **Step 4: 通過を確かめる**

Run: `sh build.sh` → verify.html を再読み込み
Expected: PASS（56/56）

Phase 3 の Task 3 Step 5 と同じランダム 60 点の確認を、verify.html で javascript_tool から行う（`stuck` の判定は 40 秒のまま）。Expected: `points` 60、`stuck` 0。

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "爆発で選手を吹っ飛ばし、全員が起き上がってから点を進める"
```

---

### Task 3: 吹っ飛びの見た目

**Files:** Modify `src/40-player.js`, `src/42-motions.js`

- [ ] **Step 1: `src/42-motions.js` の `POSES` の `stagger` の次に足す**

```js
  flail1: {                                               // 空中でばたつく
    spine: [-0.3, 0, 0], neck: [0.4, 0, 0],
    shoulderL: [-2.6, 0, 1.2], elbowL: [-0.5, 0, 0],
    shoulderR: [-1.8, 0, -1.4], elbowR: [-1.0, 0, 0],
    hipL: [-0.9, 0, 0.4], kneeL: [1.2, 0, 0],
    hipR: [0.3, 0, -0.5], kneeR: [0.4, 0, 0],
  },
  splat: {                                                // 壁に張り付く：大の字
    shoulderL: [0, 0, 2.2], shoulderR: [0, 0, -2.2],
    hipL: [0, 0, 0.6], hipR: [0, 0, -0.6],
  },
  lie: {                                                  // 倒れている：手足を投げ出す
    neck: [-0.2, 0, 0],
    shoulderL: [-0.2, 0, 1.1], elbowL: [-0.3, 0, 0],
    shoulderR: [-0.2, 0, -1.1], elbowR: [-0.3, 0, 0],
    hipL: [0, 0, 0.15], kneeL: [0.2, 0, 0],
    hipR: [0, 0, -0.15], kneeR: [0.2, 0, 0],
  },
```

`POSES.run2 = mirrorPose(POSES.run1);` の次の行に足す：

```js
POSES.flail2 = mirrorPose(POSES.flail1);
```

ファイルの末尾に足す：

```js
// 吹っ飛んでいる人のポーズ（20-blast.js の fly.state から）
function flyPose(f, simT) {
  if (f.state === 'air' || f.state === 'hang') return Math.sin(simT * 18) > 0 ? POSES.flail1 : POSES.flail2;
  if (f.state === 'stick') return POSES.splat;
  if (f.state === 'getup') return f.t < CFG.blast.getupTime * 0.5 ? POSES.lie : POSES.ready;
  return POSES.lie;
}
```

- [ ] **Step 2: `src/40-player.js` の `makePlayer` で、`hips` を `tumble` の中に入れる**

```js
  const root = new THREE.Group();
  scene.add(root);
  const hips = grp('hips', root, 0, CFG.player.hipY, 0);
```

を次に置き換える：

```js
  const root = new THREE.Group();
  scene.add(root);
  const tumble = new THREE.Group();                       // 吹っ飛びで体の中心のまわりに回すための入れ物
  tumble.position.y = CFG.blast.center;
  root.add(tumble);
  const inner = new THREE.Group();
  inner.position.y = -CFG.blast.center;
  tumble.add(inner);
  const hips = grp('hips', inner, 0, CFG.player.hipY, 0);
```

`makePlayer` の `return` を次に置き換える：

```js
  return { root, tumble, j, team, phase: Math.random() * 6, look: { yaw: 0, pitch: 0 }, tx: 0, tz: 0 };
```

- [ ] **Step 3: `src/40-player.js` の `updatePlayer` を置き換え、`placeFlying` を足す**

```js
// 選手の見た目を actor（15-actors.js）に合わせる。ポーズは目標へなめらかに寄せ、focus（爆弾）を目で追う。
// 吹っ飛んでいる間（actor.fly）は、体の中心で回し、倒れて、起き上がる
function updatePlayer(pl, a, dt, simT, focus) {
  const f = a.fly;
  const target = f ? flyPose(f, simT) : poseFor(a, simT);
  if (!pl.cur) pl.cur = { hipsDrop: 0 };
  const k = Math.min(1, dt * 14);
  for (const name of JOINTS) {
    const to = target[name] || [0, 0, 0];
    const c = pl.cur[name] || (pl.cur[name] = [0, 0, 0]);
    for (let i = 0; i < 3; i++) c[i] += (to[i] - c[i]) * k;
  }
  pl.cur.hipsDrop += ((target.hipsDrop || 0) - pl.cur.hipsDrop) * k;
  applyPose(pl, pl.cur);
  if (f) { placeFlying(pl, f, dt); return; }
  pl.tumble.rotation.set(0, 0, 0);
  pl.tx = pl.tz = 0;
  pl.root.position.set(a.x, a.y, a.z);
  if (!a.moving && a.y === 0 && !a.task) pl.j.hips.position.y += Math.sin(simT * 3 + pl.phase) * 0.012;   // 構えたまま小さく揺れる
  lookAtTarget(pl, focus, dt);
}

// 吹っ飛んでいる人の置き方。空中・ぶら下がり・張り付きは物理の回転のまま。
// 滑る・倒れているときは、あお向けかうつ伏せの近いほうへ倒し、起き上がるときは立てる
function placeFlying(pl, f, dt) {
  const B = CFG.blast, T = pl.tumble;
  if (f.state === 'air' || f.state === 'hang' || f.state === 'stick') {
    T.rotation.set(f.rx, 0, f.rz);
    pl.tx = Math.atan2(Math.sin(f.rx), Math.cos(f.rx));
    pl.tz = Math.atan2(Math.sin(f.rz), Math.cos(f.rz));
    pl.root.position.set(f.pos.x, f.pos.y - B.center, f.pos.z);
    return;
  }
  const up = f.state === 'getup' ? Math.min(1, f.t / B.getupTime) : 0;
  const goal = f.state === 'getup' ? 0 : (pl.tx >= 0 ? Math.PI / 2 : -Math.PI / 2);
  const k = Math.min(1, dt * 8);
  pl.tx += (goal - pl.tx) * k;
  pl.tz += (0 - pl.tz) * k;
  T.rotation.set(pl.tx, 0, pl.tz);
  const cy = 0.28 + (B.center - 0.28) * up;              // 寝ているとき体の中心は床から 0.28m
  pl.root.position.set(f.pos.x, cy - B.center, f.pos.z);
}
```

- [ ] **Step 4: 画面で確かめる**

Run: `sh build.sh` → bakudan-volley.html を開く（resize_window `{width:1280,height:720}` → navigate し直す → `dispatchEvent(new Event('resize'))`）。javascript_tool で `onFloor(GAME.R, { x: 5, z: 0, side: 1 })` を呼ぶ（`onFloor` は全体に見えている関数）。

Expected: 敵の 2 人が回りながら飛び、手足をばたつかせる。床に落ちると滑って倒れ、起き上がって定位置へ歩いて戻る。足が床に埋まったり、倒れた体が床の下に沈んだりしない。コンソールにエラーが無い。飛んでいる所と倒れている所を撮る。

- [ ] **Step 5: Commit**

```bash
git add src bakudan-volley.html index.html verify.html
git commit -m "吹っ飛びの見た目：回りながらばたつき、壁に大の字、倒れて起き上がる"
```

---

### Task 4: 爆発の演出とカメラ

**Files:** Modify `src/44-explosion-fx.js`, `src/45-camera.js`, `src/00-head.html`, `src/90-boot.js`

- [ ] **Step 1: `src/00-head.html`**

CSS の最後（`</style>` の前）に足す：

```css
  /* ---- 爆発の白い光 ---- */
  #flash{position:fixed;inset:0;z-index:4;background:#fff;opacity:0;pointer-events:none}
```

`<div id="toast"></div>` の行の前に `<div id="flash"></div>` を足す。

- [ ] **Step 2: `src/44-explosion-fx.js` を丸ごと書き換える**

```js
// ===== 爆発（一瞬の静止と白い光 → 火の玉 2 重 → 爆風の輪 → 煙・火花・床板の破片 → 揺れ。煙は数秒で晴れる） =====
const FX = { scene: null, light: null, geo: null, list: [], shake: 0, freeze: 0, glow: 0 };

function initFx(scene) {
  FX.scene = scene;
  FX.light = new THREE.PointLight(0xffb040, 0, 40);       // 最初から置いておく（途中で光を足すと描画が一瞬止まるため）
  scene.add(FX.light);
  FX.geo = {                                              // 形は使い回す（材質は 1 つずつ作って、消えるときに捨てる）
    sphere: new THREE.SphereGeometry(1, 20, 14),
    small: new THREE.SphereGeometry(1, 6, 4),
    box: new THREE.BoxGeometry(1, 1, 1),
    ring: new THREE.RingGeometry(0.85, 1, 48),
  };
}

function addPart(kind, geo, mat, pos, vel, life, size, extra) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(pos.x, pos.y, pos.z);
  m.scale.setScalar(size);
  FX.scene.add(m);
  FX.list.push(Object.assign({ kind, m, vel, life, size, t: 0 }, extra));
}

function spawnExplosion(x, z) {
  const rnd = Math.random, basic = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o === undefined ? 1 : o, depthWrite: false });
  // 一瞬の静止・白い光・揺れ
  FX.freeze = CFG.fx.freeze;
  FX.shake = 1.0;
  FX.glow = 9;
  FX.light.position.set(x, 2.5, z);
  const flash = document.getElementById('flash');
  flash.style.transition = 'none';
  flash.style.opacity = '0.85';
  requestAnimationFrame(() => { flash.style.transition = 'opacity .35s'; flash.style.opacity = '0'; });
  // 火の玉（白っぽい芯と、外側のオレンジ）と、床を走る輪
  addPart('fire', FX.geo.sphere, basic(0xfff2b0), { x, y: 0.8, z }, null, 0.6, 0.6, { grow: 4.5, hue: 0.13 });
  addPart('fire', FX.geo.sphere, basic(0xff8a20, 0.9), { x, y: 1.0, z }, null, 1.0, 0.8, { grow: 6.5, hue: 0.07 });
  addPartRing(x, z);
  // 煙：まわりに広がりながら上がり、ゆっくり薄くなる（＝煙が晴れる）
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2, r = 0.5 + rnd() * 2;
    const mat = new THREE.MeshLambertMaterial({ color: 0x5a5a5a, transparent: true, opacity: 0.75, depthWrite: false });
    addPart('smoke', FX.geo.sphere, mat, { x: x + Math.cos(a) * r, y: 0.5 + rnd() * 2, z: z + Math.sin(a) * r },
      { x: Math.cos(a) * (1 + rnd() * 1.5), y: 0.8 + rnd() * 1.2, z: Math.sin(a) * (1 + rnd() * 1.5) }, 3.2 + rnd() * 1.2, 1.1 + rnd() * 0.8);
  }
  // 火花
  for (let i = 0; i < 36; i++) {
    const a = rnd() * Math.PI * 2, up = 0.3 + rnd() * 0.9, sp = 8 + rnd() * 8;
    addPart('spark', FX.geo.small, basic(0xffd060), { x, y: 0.6, z },
      { x: Math.cos(a) * sp * (1 - up * 0.5), y: sp * up, z: Math.sin(a) * sp * (1 - up * 0.5) }, 0.8 + rnd() * 0.6, 0.07);
  }
  // 床板の破片
  for (let i = 0; i < 12; i++) {
    const a = rnd() * Math.PI * 2, sp = 4 + rnd() * 5;
    const mat = new THREE.MeshLambertMaterial({ color: 0xb07840, transparent: true, opacity: 1 });
    addPart('debris', FX.geo.box, mat, { x, y: 0.3, z },
      { x: Math.cos(a) * sp, y: 6 + rnd() * 6, z: Math.sin(a) * sp }, 2.5, 1,
      { dims: [0.35 + rnd() * 0.3, 0.05, 0.12 + rnd() * 0.1], spin: { x: rnd() * 12 - 6, y: rnd() * 12 - 6, z: rnd() * 12 - 6 } });
  }
}

function addPartRing(x, z) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
  addPart('ring', FX.geo.ring, mat, { x, y: 0.03, z }, null, 0.9, 1);
  FX.list[FX.list.length - 1].m.rotation.x = -Math.PI / 2;
}

function updateFx(dt) {
  for (const p of FX.list) {
    p.t += dt;
    const a = Math.min(1, p.t / p.life), m = p.m, v = p.vel;
    if (p.kind === 'fire') {
      m.scale.setScalar(p.size + p.grow * Math.sqrt(a));
      m.material.opacity = (1 - a) * (1 - a);
      m.material.color.setHSL(p.hue * (1 - a), 1, 0.65 - 0.4 * a);
    } else if (p.kind === 'ring') {
      m.scale.setScalar(1 + 15 * a);
      m.material.opacity = 0.85 * (1 - a);
    } else if (p.kind === 'smoke') {
      m.position.x += v.x * dt; m.position.y += v.y * dt; m.position.z += v.z * dt;
      const drag = Math.max(0, 1 - dt * 0.7);
      v.x *= drag; v.z *= drag;
      m.scale.setScalar(p.size * (1 + 1.3 * a));
      m.material.opacity = 0.75 * Math.pow(1 - a, 1.5);
    } else if (p.kind === 'spark') {
      v.y -= CFG.gravity * dt;
      m.position.x += v.x * dt; m.position.y += v.y * dt; m.position.z += v.z * dt;
      if (m.position.y < 0.05) { m.position.y = 0.05; v.y = -v.y * 0.3; }
      m.scale.setScalar(p.size * (1 - a));
    } else if (p.kind === 'debris') {
      v.y -= CFG.gravity * dt;
      m.position.x += v.x * dt; m.position.y += v.y * dt; m.position.z += v.z * dt;
      if (m.position.y < 0.03) { m.position.y = 0.03; v.y = -v.y * 0.35; v.x *= 0.7; v.z *= 0.7; p.spin.x *= 0.6; p.spin.y *= 0.6; p.spin.z *= 0.6; }
      m.rotation.x += p.spin.x * dt; m.rotation.y += p.spin.y * dt; m.rotation.z += p.spin.z * dt;
      m.scale.set(p.dims[0], p.dims[1], p.dims[2]);
      m.material.opacity = a < 0.7 ? 1 : (1 - a) / 0.3;
    }
  }
  for (let i = FX.list.length - 1; i >= 0; i--) {
    const p = FX.list[i];
    if (p.t < p.life) continue;
    FX.scene.remove(p.m);
    p.m.material.dispose();                               // 形は使い回しなので捨てない
    FX.list.splice(i, 1);
  }
  FX.glow = Math.max(0, FX.glow - dt * 12);
  FX.light.intensity = FX.glow;
  FX.shake = Math.max(0, FX.shake - dt * 1.2);
}
```


- [ ] **Step 3: `src/45-camera.js` を丸ごと書き換える**

```js
// ===== カメラ（中継の角度：コートの横、斜め上から）。爆発の間は上を見上げて爆発のほうへ振り、天井まで飛ぶ人も入れる =====
const CAM = { cam: null, x: 0, y: null, lx: 0, ly: null, lz: 0 };

// focusX：爆弾の x（少しだけ追って横に振る）。boomAt：爆発した場所（爆発の間だけ）
function updateCamera(dt, focusX, boomAt) {
  const c = CFG.camera, s = FX.shake;
  const goal = boomAt
    ? { x: boomAt.x * 0.3, y: c.y, lx: boomAt.x * 0.45, ly: 5.0, lz: boomAt.z * 0.2 }
    : { x: focusX * c.follow, y: c.y, lx: focusX * c.follow, ly: c.lookY, lz: 0 };
  const k = Math.min(1, dt * (boomAt ? 3 : 1.5));
  for (const key in goal) CAM[key] = CAM[key] === null ? goal[key] : CAM[key] + (goal[key] - CAM[key]) * k;
  CAM.cam.position.set(CAM.x + (Math.random() - 0.5) * s, CAM.y + (Math.random() - 0.5) * s, c.z);
  CAM.cam.lookAt(CAM.lx, CAM.ly, CAM.lz);
}
```

- [ ] **Step 4: `src/90-boot.js`**

`frame()` の中の `const dt = Math.min(clock.getDelta(), 1 / 30);` の次の行に足す（爆発の瞬間の一瞬の静止）：

```js
    if (FX.freeze > 0) { FX.freeze -= dt; renderer.render(scene, camera); return; }
```

`updateCamera(dt, R.ball ? R.ball.pos.x : 0);` を次に置き換える：

```js
    updateCamera(dt, R.ball ? R.ball.pos.x : 0, R.state === 'boom' && R.boom.fired ? R.boom.hit : null);
```

イベントの `for` の中に足す（`else if (e.type === 'bump') ...` の後）：

```js
      else if (e.type === 'crash') FX.shake = Math.min(1.2, FX.shake + 0.35);   // 壁・天井に激突
```

- [ ] **Step 5: 画面で確かめる**

Run: `sh build.sh` → bakudan-volley.html を開き直す（Task 3 Step 4 と同じ手順）。javascript_tool で `onFloor(GAME.R, { x: 5, z: 0, side: 1 })` を何回か（起き上がって次が始まってから）呼ぶ。

Expected: 一瞬止まって白く光り、火の玉が 2 重に広がり、床に輪が走る。火花が飛び、床板の破片が跳ねて転がり、煙が広がってから数秒で晴れる。カメラは上を見上げて揺れ、天井近くまで飛ぶ人も画面に入る。終わったらいつもの角度に戻る。コンソールにエラーが無い。爆発の直後と、煙が残っている所を撮る。

- [ ] **Step 6: Commit**

```bash
git add src bakudan-volley.html index.html verify.html
git commit -m "爆発の演出：一瞬の静止と白い光、火の玉 2 重・輪・煙・火花・破片。爆発の間のカメラ"
```

---

### Task 5: 音

**Files:** Modify `src/22-sound.js`, `src/90-boot.js`

- [ ] **Step 1: `src/22-sound.js` を丸ごと書き換える**

```js
// ===== 音（Web Audio で作る。音声ファイルは使わない） =====
// ブラウザは最初の操作（クリック・タップ・キー）まで音を出せないので、そのときに作る
const SND = { ctx: null, out: null, noise: null };

function sndInit() {
  if (SND.ctx) { if (SND.ctx.state === 'suspended') SND.ctx.resume(); return; }
  try {
    const C = window.AudioContext || window.webkitAudioContext;
    SND.ctx = new C();
    SND.out = SND.ctx.createGain();
    SND.out.gain.value = 0.6;
    SND.out.connect(SND.ctx.destination);
    const len = SND.ctx.sampleRate * 2, buf = SND.ctx.createBuffer(1, len, SND.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    SND.noise = buf;
  } catch (e) { SND.ctx = null; }                         // 音が出せない環境では鳴らさないだけ
}

// 音程のある音（freq から to へ下がる・上がる）
function sndTone(freq, to, dur, type, vol, delay) {
  if (!SND.ctx) return;
  const t0 = SND.ctx.currentTime + (delay || 0), o = SND.ctx.createOscillator(), g = SND.ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(SND.out);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

// ざらついた音（フィルタの周波数を from から to へ動かす）
function sndNoise(dur, vol, filter, from, to, delay) {
  if (!SND.ctx) return;
  const t0 = SND.ctx.currentTime + (delay || 0), s = SND.ctx.createBufferSource(), f = SND.ctx.createBiquadFilter(), g = SND.ctx.createGain();
  s.buffer = SND.noise;
  f.type = filter; f.frequency.setValueAtTime(from, t0);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(SND.out);
  s.start(t0); s.stop(t0 + dur + 0.02);
}

// 爆弾を打つ音。強打は「バシッ」、レシーブやトスは「ポン」
function sndHit(kind) {
  if (['attack', 'direct', 'standSpike', 'serve', 'block'].includes(kind)) {
    sndNoise(0.09, 0.9, 'bandpass', 2600, 1100);
    sndTone(150, 60, 0.12, 'sine', 0.7);
  } else {
    sndNoise(0.05, 0.4, 'bandpass', 1500, 900);
    sndTone(240, 130, 0.09, 'sine', 0.35);
  }
}
function sndWhistle() {                                   // 審判の笛（ピッ、ピー）
  sndTone(3100, 3000, 0.12, 'square', 0.12);
  sndTone(3100, 2950, 0.35, 'square', 0.12, 0.16);
}
function sndBoom() {                                      // 爆発：低い「ドーン」とザーッという爆風
  sndTone(80, 28, 1.3, 'sine', 1.0);
  sndNoise(1.6, 1.1, 'lowpass', 3500, 120);
  sndNoise(0.4, 0.6, 'highpass', 4000, 1500, 0.05);
}
function sndCrash() {                                     // 壁・天井・人に激突
  sndTone(110, 45, 0.25, 'sine', 0.8);
  sndNoise(0.15, 0.6, 'lowpass', 900, 200);
}
function sndLand() { sndTone(130, 60, 0.12, 'sine', 0.45); }   // 床に落ちる
function sndSlow() { sndNoise(0.5, 0.25, 'lowpass', 1400, 180); }   // スローになる「シュウッ」
```

- [ ] **Step 2: `src/90-boot.js`**

`initInput(act => choose(R, act));` の次の行に足す（最初の操作で音を作る）：

```js
  addEventListener('pointerdown', sndInit);
  addEventListener('keydown', sndInit);
```

イベントの `for` の中を、音を鳴らすように直す：
- `if (e.type === 'choose') showChoice(e.scene, e.attack);` → `if (e.type === 'choose') { showChoice(e.scene, e.attack); sndSlow(); }`
- `else if (e.type === 'explode') {` の中の最初に `sndBoom();` を足す
- `else if (e.type === 'point') {` の中の最初に `sndWhistle();` を足す
- `else if (e.type === 'crash') FX.shake = ...;` を `else if (e.type === 'crash') { FX.shake = Math.min(1.2, FX.shake + 0.35); sndCrash(); }` にする
- 次を足す：

```js
      else if (e.type === 'hit') sndHit(e.kind);
      else if (e.type === 'land' || e.type === 'net') sndLand();
      else if (e.type === 'collide') sndCrash();
```

- [ ] **Step 3: 確かめる**

Run: `sh build.sh` → bakudan-volley.html を開き直す。javascript_tool で `sndInit(); [SND.ctx && SND.ctx.state]` を実行して `running` か `suspended` が返ることを確かめ、`sndBoom(); sndHit('attack'); sndWhistle(); sndCrash()` がエラーを出さないことを確かめる（アプリ内ブラウザでは音は聞こえなくてよい）。1 点を通して遊ばせ（`GAME.choose('serve')` など）、コンソールにエラーが無いこと。verify.html は PASS 56/56。

- [ ] **Step 4: Commit**

```bash
git add src bakudan-volley.html index.html verify.html
git commit -m "音：打つ音・ホイッスル・爆発・激突・着地・スロー（Web Audio）"
```

---

## Phase 4a の終わり

本人に `C:\Users\PC_User\Second brain\bakudan-volley\bakudan-volley.html` を開いて遊んでもらう（音が出るので音量に注意）。確かめてもらうのは次の 4 点。
- 爆発の派手さ（白い光・火の玉・煙・破片）。煙が晴れるまでの長さはどうか
- 吹っ飛び方。天井まで飛ぶ、壁に張り付く、滑る、ネットに引っかかる、味方を巻き込む、の割合と大きさ
- 起き上がって次へ進むまでの待ち時間が長すぎないか
- 音

OK が出たら Phase 4b（本格的なモーション）の計画を書く。
