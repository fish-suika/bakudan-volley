# Phase 4b 本格的なモーション Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 選手の動きを「スポーツゲームとして見ても自然」にする。
- アタック：打つ所の 2.6m 手前まで下がって待ち、跳ぶ 0.75 秒前から助走する（両腕を後ろへ振り下ろし、深くかがんで踏み切る）。空中では弓なりに反って腕を振りかぶり、前へ跳びながら打って、膝を曲げて着地する
- レシーブ：低く構えて待ち、当たる瞬間に脚を伸ばして押し上げる
- トス：額の前に手を上げて待ち、全身を伸ばして上げる
- ブロック：肩の高さに手を構え、沈み込んでから跳び、ネットの上へ腕を伸ばす
- サーブ：爆弾を持ってじっと構え、左手で高く上げ、踏み込んで跳んで打つ
- 移動：遠くへは向きを変えて走り、近くへはネットを向いたままサイドステップ。走りは歩幅に合わせて脚が回る

**Architecture:** モーションは「ポーズの並び（クリップ）」を時刻で補間して作る。時刻の基準は、その動きで爆弾に触る予定の時刻（`task.contactAt` など）にする。こうすると、跳ぶ・打つ・着地がゲームの判定（`jumpAt`・`contactAt`）とずれない。クリップと補間（`42-motions.js`）は three.js を使わないので、`verify.html` に入れてテストする。助走（下がって待つ → 踏み切り位置へ走る → 前へ跳ぶ）は、選手の動き（`15-actors.js`）に足す。

**Tech Stack:** 素の JavaScript、three.js r128。Node は無い。

**仕様書:** `docs/superpowers/specs/2026-10-05-bakudan-volley-design.md`（5 動き）

**角度の約束（今までどおり）:** 腕・太ももは rx が負で前へ振る（-π/2 で水平、-π で真上）。spine の rx が正で前かがみ。膝・肘は rx で曲げる。L は体の左（ローカル +X）、rz が L で正・R で負なら外へ開く。`hipsDrop` は、膝を曲げても足が床から浮かないように腰を下げる量（太もも 0.45m・すね 0.45m の縦の長さの合計が 0.9m からどれだけ短くなったか）。

---

## ファイル

| ファイル | 変更 |
|---|---|
| `src/10-config.js` | `motion`（助走・サイドステップ・歩幅など）を足す |
| `src/15-actors.js` | 助走（`planApproach`）、空中で前へ流れる、着地の時刻、歩いた距離・向き |
| `src/16-rally.js` | アタックの行き先が決まったら助走を決める |
| `src/42-motions.js` | `JOINTS` をここへ移す。新しいポーズ、クリップ、`blendPose` / `sampleClip` / `motionFor` / `facingFor`。`poseFor` は消す |
| `src/40-player.js` | `JOINTS` を消す。`motionFor` を使い、向きをなめらかに変える |
| `build.sh` | 検証ページに `42-motions.js` を足す |
| `src/verify-tests.js` | テストを足す |

---

### Task 1: ポーズの補間とクリップ（three.js 非依存にして検証に入れる）

**Files:** Modify `src/40-player.js`, `src/42-motions.js`, `build.sh`, `src/10-config.js`, `src/verify-tests.js`

- [ ] **Step 1: `JOINTS` を移す**

`src/40-player.js` の `const JOINTS = [...];` の行を消し、`src/42-motions.js` の先頭（1 行目のコメントの次）に置く：

```js
const JOINTS = ['hips', 'spine', 'neck', 'head', 'shoulderL', 'elbowL', 'shoulderR', 'elbowR', 'hipL', 'kneeL', 'hipR', 'kneeR'];
```

（1 枚の `<script>` に結合されるので、40 の関数は呼ばれる時点で 42 の `JOINTS` を使える。）

- [ ] **Step 2: `build.sh` の検証ページの `src/20-blast.js \` の次の行に足す**

```sh
    src/42-motions.js \
```

- [ ] **Step 3: `src/10-config.js` の `fx: ...` の行の次に足す**

```js
  // ---- Phase 4b：モーション ----
  motion: {
    approachDist: 2.6,                                    // アタックの助走を始める所（打つ所からネットと反対へ m）
    approachTime: 0.75,                                   // 跳ぶ何秒前から助走するか
    broad: 0.6,                                           // 踏み切り位置（打つ所の手前 m）。空中で前へ流れて打つ所の真下に来る
    serveContact: 0.68,                                   // サーブでトスを上げてから打つまで（秒。トスの初速 4.5m/s で高さ 2.8m に戻るまで）
    strideLen: 1.5,                                       // 走るとき脚が一回りする距離 m
    shuffleDist: 2.5,                                     // これより近い所へはサイドステップ（ネットを向いたまま）
  },
```

- [ ] **Step 4: テストを書く**（`// ===== 結果表示 =====` の直前）

```js
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
```

- [ ] **Step 5: 失敗を確かめる**

Run: `sh build.sh` → verify.html を開く
Expected: FAIL（新しい 9 本）

- [ ] **Step 6: `src/42-motions.js` に新しいポーズを足す**（`POSES` の `serveHold` の次、`stagger` の前）

```js
  approachReady: {                                        // 助走の前：少し前かがみで、打つ所をにらむ
    hipsDrop: 0.12,
    spine: [0.45, 0, 0], neck: [-0.35, 0, 0],
    shoulderL: [0.3, 0, 0.1], elbowL: [-0.4, 0, 0],
    shoulderR: [0.3, 0, -0.1], elbowR: [-0.4, 0, 0],
    hipL: [-0.6, 0, 0.05], kneeL: [1.0, 0, 0],
    hipR: [-0.3, 0, -0.05], kneeR: [0.8, 0, 0],
  },
  step1: {                                                // 助走の 1 歩目：腕を前に
    hipsDrop: 0.08,
    spine: [0.35, 0, 0], neck: [-0.3, 0, 0],
    shoulderL: [-0.5, 0, 0.1], elbowL: [-0.6, 0, 0],
    shoulderR: [-0.5, 0, -0.1], elbowR: [-0.6, 0, 0],
    hipL: [-0.9, 0, 0], kneeL: [0.5, 0, 0],
    hipR: [0.4, 0, 0], kneeR: [1.1, 0, 0],
  },
  step2: {                                                // 助走の 2 歩目：両腕を後ろへ振り上げる
    hipsDrop: 0.12,
    spine: [0.45, 0, 0], neck: [-0.35, 0, 0],
    shoulderL: [0.9, 0, 0.15], elbowL: [-0.2, 0, 0],
    shoulderR: [0.9, 0, -0.15], elbowR: [-0.2, 0, 0],
    hipL: [0.3, 0, 0], kneeL: [0.9, 0, 0],
    hipR: [-1.0, 0, 0], kneeR: [0.8, 0, 0],
  },
  armsBack: {                                             // 踏み切りの直前：深くかがみ、両腕は後ろいっぱい
    hipsDrop: 0.31,
    spine: [0.7, 0, 0], neck: [-0.6, 0, 0],
    shoulderL: [1.3, 0, 0.2], elbowL: [-0.1, 0, 0],
    shoulderR: [1.3, 0, -0.2], elbowR: [-0.1, 0, 0],
    hipL: [-1.0, 0, 0.1], kneeL: [1.7, 0, 0],
    hipR: [-0.9, 0, -0.1], kneeR: [1.6, 0, 0],
  },
  takeoff: {                                              // 踏み切り：両腕を前から上へ振り上げ、全身を伸ばす
    spine: [-0.1, 0, 0], neck: [0.1, 0, 0],
    shoulderL: [-2.6, 0, 0.2], elbowL: [-0.3, 0, 0],
    shoulderR: [-2.4, 0, -0.2], elbowR: [-0.5, 0, 0],
    hipL: [0.1, 0, 0], kneeL: [0.1, 0, 0],
    hipR: [0.1, 0, 0], kneeR: [0.15, 0, 0],
  },
  spikeFollow: {                                          // 振り抜き：右腕が体の前を通って下へ
    spine: [0.6, -0.4, 0], neck: [-0.4, 0, 0],
    shoulderL: [-0.2, 0, 0.4], elbowL: [-0.8, 0, 0],
    shoulderR: [-0.3, 0, 0.2], elbowR: [-0.3, 0, 0],
    hipL: [-0.7, 0, 0], kneeL: [1.0, 0, 0],
    hipR: [-0.4, 0, 0], kneeR: [0.8, 0, 0],
  },
  landing: {                                              // 着地：膝を深く曲げて受け止める
    hipsDrop: 0.25,
    spine: [0.5, 0, 0], neck: [-0.4, 0, 0],
    shoulderL: [-0.8, 0, 0.3], elbowL: [-0.5, 0, 0],
    shoulderR: [-0.8, 0, -0.3], elbowR: [-0.5, 0, 0],
    hipL: [-0.9, 0, 0.1], kneeL: [1.5, 0, 0],
    hipR: [-0.9, 0, -0.1], kneeR: [1.5, 0, 0],
  },
  receiveReady: {                                         // レシーブの待ち：足を開いて低く、腕は前で開く
    hipsDrop: 0.19,
    spine: [0.45, 0, 0], neck: [-0.35, 0, 0],
    shoulderL: [-0.7, 0, 0.25], elbowL: [-0.5, 0, 0],
    shoulderR: [-0.7, 0, -0.25], elbowR: [-0.5, 0, 0],
    hipL: [-0.75, 0, 0.25], kneeL: [1.3, 0, 0],
    hipR: [-0.75, 0, -0.25], kneeR: [1.3, 0, 0],
  },
  receivePush: {                                          // レシーブの瞬間：脚を伸ばして押し上げる（腕は組んだまま）
    hipsDrop: 0.03,
    spine: [0.35, 0, 0], neck: [-0.2, 0, 0],
    shoulderL: [-1.2, 0, -0.28], elbowL: [0, 0, 0],
    shoulderR: [-1.2, 0, 0.28], elbowR: [0, 0, 0],
    hipL: [-0.35, 0, 0.15], kneeL: [0.5, 0, 0],
    hipR: [-0.35, 0, -0.15], kneeR: [0.5, 0, 0],
  },
  tossReady: {                                            // トスの待ち：額の前へ手を上げ、軽く膝を曲げる
    hipsDrop: 0.08,
    spine: [0.05, 0, 0], neck: [0.25, 0, 0],
    shoulderL: [-2.3, 0, 0.35], elbowL: [-1.4, 0, 0],
    shoulderR: [-2.3, 0, -0.35], elbowR: [-1.4, 0, 0],
    hipL: [-0.45, 0, 0.05], kneeL: [0.8, 0, 0],
    hipR: [-0.45, 0, -0.05], kneeR: [0.8, 0, 0],
  },
  tossPush: {                                             // トスの瞬間：全身と腕を上へ伸ばす
    spine: [-0.1, 0, 0], neck: [0.3, 0, 0],
    shoulderL: [-2.9, 0, 0.2], elbowL: [-0.3, 0, 0],
    shoulderR: [-2.9, 0, -0.2], elbowR: [-0.3, 0, 0],
    hipL: [-0.05, 0, 0], kneeL: [0.1, 0, 0],
    hipR: [-0.05, 0, 0], kneeR: [0.1, 0, 0],
  },
  blockReady: {                                           // ブロックの構え：手を肩の高さに
    hipsDrop: 0.06,
    spine: [0.1, 0, 0],
    shoulderL: [-2.0, 0, 0.3], elbowL: [-1.6, 0, 0],
    shoulderR: [-2.0, 0, -0.3], elbowR: [-1.6, 0, 0],
    hipL: [-0.4, 0, 0], kneeL: [0.7, 0, 0],
    hipR: [-0.4, 0, 0], kneeR: [0.7, 0, 0],
  },
  blockDip: {                                             // ブロックの沈み込み
    hipsDrop: 0.22,
    spine: [0.25, 0, 0],
    shoulderL: [-2.0, 0, 0.3], elbowL: [-1.6, 0, 0],
    shoulderR: [-2.0, 0, -0.3], elbowR: [-1.6, 0, 0],
    hipL: [-0.8, 0, 0], kneeL: [1.4, 0, 0],
    hipR: [-0.8, 0, 0], kneeR: [1.4, 0, 0],
  },
  blockTakeoff: {                                         // ブロックの踏み切り：腕を上へ
    shoulderL: [-2.7, 0, 0.15], elbowL: [-0.6, 0, 0],
    shoulderR: [-2.7, 0, -0.15], elbowR: [-0.6, 0, 0],
    hipL: [-0.1, 0, 0], kneeL: [0.15, 0, 0],
    hipR: [-0.1, 0, 0], kneeR: [0.15, 0, 0],
  },
  blockReach: {                                           // ブロックの最高点：腕をネットの上へ突き出す
    spine: [0.15, 0, 0],
    shoulderL: [-2.75, 0, 0.12], elbowL: [0, 0, 0],
    shoulderR: [-2.75, 0, -0.12], elbowR: [0, 0, 0],
    hipL: [-0.15, 0, 0], kneeL: [0.25, 0, 0],
    hipR: [-0.15, 0, 0], kneeR: [0.25, 0, 0],
  },
  serveToss: {                                            // サーブのトス：左手を真上へ、右手は振りかぶる
    spine: [-0.15, 0.3, 0], neck: [0.4, 0, 0],
    shoulderL: [-3.0, 0, 0.1], elbowL: [0, 0, 0],
    shoulderR: [-2.6, 0, -0.3], elbowR: [-1.6, 0, 0],
    hipL: [-0.3, 0, 0], kneeL: [0.5, 0, 0],
    hipR: [0.2, 0, 0], kneeR: [0.3, 0, 0],
  },
  shuffle1: {                                             // サイドステップ（足を開く）
    hipsDrop: 0.12,
    spine: [0.35, 0, 0], neck: [-0.25, 0, 0],
    shoulderL: [-0.6, 0, 0.2], elbowL: [-0.9, 0, 0],
    shoulderR: [-0.6, 0, -0.2], elbowR: [-0.9, 0, 0],
    hipL: [-0.55, 0, 0.35], kneeL: [1.1, 0, 0],
    hipR: [-0.55, 0, -0.05], kneeR: [1.1, 0, 0],
  },
```

`POSES.flail2 = mirrorPose(POSES.flail1);` の次の行に足す：

```js
POSES.shuffle2 = mirrorPose(POSES.shuffle1);
```

- [ ] **Step 7: `src/42-motions.js` の `HIT_POSE` / `WAIT_POSE` / `poseFor` を消し、次を書く**（`flyPose` はそのまま残す）

```js
// 2 つのポーズを k（0〜1）で混ぜる。無い関節は 0
function blendPose(a, b, k) {
  const out = { hipsDrop: (a.hipsDrop || 0) + ((b.hipsDrop || 0) - (a.hipsDrop || 0)) * k };
  for (const n of JOINTS) {
    const ra = a[n] || [0, 0, 0], rb = b[n] || [0, 0, 0];
    out[n] = [ra[0] + (rb[0] - ra[0]) * k, ra[1] + (rb[1] - ra[1]) * k, ra[2] + (rb[2] - ra[2]) * k];
  }
  return out;
}

// クリップ = [[時刻, ポーズ名], ...]。時刻 t のポーズを、前後のキーの間でなめらかに（smoothstep）混ぜて返す
function sampleClip(clip, t) {
  if (t <= clip[0][0]) return POSES[clip[0][1]];
  for (let i = 1; i < clip.length; i++) {
    if (t === clip[i][0]) return POSES[clip[i][1]];       // ちょうどキーの時刻（混ぜると小数の誤差が出るので、そのまま返す）
    if (t < clip[i][0]) {
      const [t0, p0] = clip[i - 1], [t1, p1] = clip[i];
      const k = (t - t0) / (t1 - t0), s = k * k * (3 - 2 * k);
      return blendPose(POSES[p0], POSES[p1], s);
    }
  }
  return POSES[clip[clip.length - 1][1]];
}

// クリップの時刻は「爆弾に触る瞬間」を 0 にする（ブロックは跳んだ最高点、空振りは振り下ろす瞬間）。
// アタック・ブロックの踏み切りは -0.43（riseTime）、着地は +0.43。ゲームの判定の時刻と合わせてある
const CLIPS = {
  attack: [[-1.2, 'approachReady'], [-0.75, 'step1'], [-0.6, 'step2'], [-0.5, 'armsBack'], [-0.43, 'takeoff'],
    [-0.25, 'spikeBack'], [-0.04, 'spikeBack'], [0, 'spikeHit'], [0.15, 'spikeFollow'], [0.43, 'landing'], [0.75, 'ready']],
  direct: [[-0.6, 'ready'], [-0.5, 'armsBack'], [-0.43, 'takeoff'], [-0.25, 'spikeBack'], [-0.04, 'spikeBack'],
    [0, 'spikeHit'], [0.15, 'spikeFollow'], [0.43, 'landing'], [0.75, 'ready']],
  standSpike: [[-0.5, 'ready'], [-0.25, 'spikeBack'], [-0.03, 'spikeBack'], [0, 'spikeHit'], [0.2, 'spikeFollow'], [0.6, 'ready']],
  receive: [[-0.6, 'receiveReady'], [-0.12, 'receive'], [0, 'receivePush'], [0.3, 'receivePush'], [0.6, 'ready']],
  toss: [[-0.6, 'tossReady'], [-0.1, 'toss'], [0, 'tossPush'], [0.3, 'tossPush'], [0.6, 'ready']],
  block: [[-0.75, 'blockReady'], [-0.55, 'blockDip'], [-0.43, 'blockTakeoff'], [-0.1, 'blockReach'], [0.15, 'blockReach'],
    [0.43, 'landing'], [0.75, 'ready']],
  serve: [[-1.6, 'serveHold'], [-0.7, 'serveHold'], [-0.55, 'serveToss'], [-0.45, 'step2'], [-0.4, 'armsBack'], [-0.36, 'takeoff'],
    [-0.2, 'spikeBack'], [-0.04, 'spikeBack'], [0, 'spikeHit'], [0.15, 'spikeFollow'], [0.38, 'landing'], [0.7, 'ready']],
  whiff: [[-0.4, 'ready'], [-0.2, 'spikeBack'], [0, 'spikeHit'], [0.2, 'spikeFollow'], [0.6, 'ready']],
};
CLIPS.return = CLIPS.receive;
CLIPS.bump = CLIPS.receive;
CLIPS.blockNoop = CLIPS.block;
const LAND_CLIP = [[0, 'landing'], [0.35, 'ready']];
const WAIT_POSE = { receive: 'receiveReady', bump: 'receiveReady', return: 'receiveReady', toss: 'tossReady',
  serve: 'serveHold', attack: 'approachReady', block: 'blockReady', blockNoop: 'blockReady' };

// クリップの 0 の時刻（まだ決まっていなければ null）
function clipAnchor(t) {
  if (t.kind === 'serve') return t.hold + CFG.motion.serveContact;
  if (t.kind === 'block' || t.kind === 'blockNoop') return t.jumpAt != null ? t.jumpAt + riseTime() : null;
  if (t.kind === 'whiff') return t.start + 0.4;
  return t.contactAt != null ? t.contactAt : null;
}

// 近い所へ動くときはサイドステップ（ネットを向いたまま）
function isShuffle(a) { return a.moving && a.moveLeft < CFG.motion.shuffleDist; }

// 走る・サイドステップの脚は、歩いた距離で回す（時間で回すと、速さと脚が合わない）
function runPose(a) {
  const k = (Math.sin(a.stride / CFG.motion.strideLen * Math.PI * 2) + 1) / 2;
  return isShuffle(a) ? blendPose(POSES.shuffle1, POSES.shuffle2, k) : blendPose(POSES.run1, POSES.run2, k);
}

// 選手の状態（15-actors.js の actor）から、今とるべきポーズを返す
function motionFor(a, simT) {
  if (a.stun > 0) return POSES.stagger;
  const h = a.lastHit;
  if (h && CLIPS[h.kind] && simT - h.at < 0.8) return sampleClip(CLIPS[h.kind], simT - h.at);   // 打ったあとの続き
  const t = a.task;
  if (t && CLIPS[t.kind]) {
    const at = clipAnchor(t);
    if (at !== null && simT - at >= CLIPS[t.kind][0][0]) return sampleClip(CLIPS[t.kind], simT - at);   // 予定の時刻が近づいた
  }
  if (a.y > 0) return POSES.jump;
  if (a.landT != null && simT - a.landT < 0.35) return sampleClip(LAND_CLIP, simT - a.landT);
  if (a.moving) return runPose(a);
  if (t && WAIT_POSE[t.kind]) return POSES[WAIT_POSE[t.kind]];
  return POSES.ready;
}

// 体の向き（root の y 回転）。止まっている・近くへ動く・吹っ飛んでいるときはネットのほう、遠くへ走るときは進む向き
function facingFor(a) {
  const net = a.team === 0 ? Math.PI / 2 : -Math.PI / 2;
  if (!a.moving || isShuffle(a) || a.fly) return net;
  return Math.atan2(a.mdx, a.mdz);
}
```

- [ ] **Step 8: `src/15-actors.js` の `newActor` に、テストで使う項目を足す**（中身は Task 2 で使う）

```js
  return { id, team, x, z, y: 0, vy: 0, home: { x, z }, base: { x, z }, task: null, moving: false, lastHit: null, stun: 0, fly: null,
    stride: 0, mdx: 0, mdz: 0, moveLeft: 0, dvx: 0, dvz: 0, landT: null };
```

- [ ] **Step 9: `src/40-player.js` の `updatePlayer` で、`poseFor(a, simT)` を `motionFor(a, simT)` にする**（向きは Task 3 で直す）

- [ ] **Step 10: 通過を確かめる**

Run: `sh build.sh` → verify.html を再読み込み
Expected: PASS（65/65）。本体（bakudan-volley.html）を開いてコンソールにエラーが無いこと。

- [ ] **Step 11: Commit**

```bash
git add build.sh src bakudan-volley.html index.html verify.html
git commit -m "モーションをクリップ（ポーズの並び）にする：触る予定の時刻を基準に補間。助走・踏み切り・着地・レシーブの押し上げ・トス・ブロック・サーブのトスの形"
```

---

### Task 2: 助走・前へ流れるジャンプ・着地・歩いた距離

**Files:** Modify `src/15-actors.js`, `src/16-rally.js`, `src/verify-tests.js`

- [ ] **Step 1: テストを書く**（モーションのテストの後）

```js
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
```

- [ ] **Step 2: 失敗を確かめる**

Run: `sh build.sh` → verify.html を再読み込み
Expected: FAIL（新しい 2 本。`planApproach is not defined` など）

- [ ] **Step 3: `src/15-actors.js`**

`stepActor` を丸ごと置き換える：

```js
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
```

- [ ] **Step 4: `src/16-rally.js` の `aimTask` の最後の行 `if (t.jump) t.jumpAt = t.contactAt - riseTime();` の次に足す**

```js
  if (t.kind === 'attack') planApproach(a);              // アタックは助走して跳ぶ
```

- [ ] **Step 5: 通過を確かめる**

Run: `sh build.sh` → verify.html を再読み込み
Expected: PASS（67/67）。助走でアタックが届かなくなっていないことを、Phase 3 のランダム 60 点のスクリプト（`docs/superpowers/plans/2026-10-05-phase3-ai-rally.md` の Task 3 Step 5。`R.choose.allowed` は無いので `ACTIONS` から選ぶ）で確かめる。あわせて、アタックの `hit` と `miss` を数える（`e.type === 'miss' && e.kind === 'attack'`）。Expected：points 60・stuck 0。アタックの miss の割合が、助走を入れる前（`git stash` で戻して同じスクリプトを回す）より大きく増えていないこと。増えていたら原因（踏み切りが遅れる・前へ流れて届かない）を調べて直す。

- [ ] **Step 6: Commit**

```bash
git add src bakudan-volley.html index.html verify.html
git commit -m "アタックの助走：手前で待ち、踏み切り位置へ走って跳び、空中で前へ流れて打つ。着地の時刻と歩いた距離を数える"
```

---

### Task 3: 向きをなめらかに変える・見た目の確認

**Files:** Modify `src/40-player.js`

- [ ] **Step 1: `src/40-player.js` の `updatePlayer` を直す**

ポーズを寄せる速さを上げる（クリップの速い動き＝スパイクの振り下ろしが鈍らないように）。`const k = Math.min(1, dt * 14);` を次にする：

```js
  const k = Math.min(1, dt * (f ? 14 : 24));               // クリップの速い動き（振り下ろし）が鈍らないよう、普段は速めに寄せる
```

`pl.root.rotation.y = pl.team === 0 ? Math.PI / 2 : -Math.PI / 2;   // 吹っ飛びで回った向きを戻す` の行を次に置き換える：

```js
  const yaw = facingFor(a);                               // 遠くへは走る向き、近くへはネットを向いたまま。なめらかに回す
  const dy = Math.atan2(Math.sin(yaw - pl.root.rotation.y), Math.cos(yaw - pl.root.rotation.y));
  pl.root.rotation.y += dy * Math.min(1, dt * 10);
```

- [ ] **Step 2: 画面で確かめる**

Run: `sh build.sh` → bakudan-volley.html を開く（resize_window `{width:1280,height:720}`、小さすぎれば `{width:640,height:360}` → navigate し直す → `dispatchEvent(new Event('resize'))`。終わったら preset "desktop" に戻す）。

各動きを止めて撮る方法：javascript_tool で `tickRally` の代わりに時刻を指定してポーズだけ確かめたいときは、`CFG.camera` を一時的に寄せる（例：`CFG.camera.y = 2.5; CFG.camera.z = 6; CFG.camera.lookY = 1.2; CFG.camera.follow = 1`）。そのうえで、ゲームを進めて（`GAME.choose(...)`）その瞬間を wait してから撮る。

Expected:
1. サーブ：爆弾を持って構える → 左手で高く上げる → 踏み込んで跳んで振りかぶる → 打つ → 膝を曲げて着地
2. ③アタック：打つ所の手前まで下がって待つ → 助走 2 歩 → 両腕を後ろへ振って深くかがむ → 跳ぶ → 空中で反って振りかぶる → 打つ → 前へ流れて着地
3. ②レシーブ：落下地点へ（遠ければ向きを変えて）走る → 低く構える → 脚を伸ばして押し上げる
4. トス：額の前に手 → 全身を伸ばして上げる
5. ブロック：肩の高さに手 → 沈む → 跳んで腕をネットの上へ
6. 近くへの移動はサイドステップ（ネットを向いたまま）、遠くへは走る向きを向く
7. 足が床に埋まる・浮く、関節が逆に曲がる、体がねじれすぎる、が無い。コンソールにエラーが無い。verify.html は PASS 67/67

おかしなポーズ（腕が体に刺さる・脚が逆に曲がる等）は、そのポーズの角度を直す。直したポーズと理由は最終報告に書く。

- [ ] **Step 3: Commit**

```bash
git add src bakudan-volley.html index.html verify.html
git commit -m "遠くへは走る向きを向き、近くへはサイドステップ。速い動きが鈍らないようにポーズを速めに寄せる"
```

---

## Phase 4b の終わり

本人に `C:\Users\PC_User\Second brain\bakudan-volley\bakudan-volley.html` を開いて遊んでもらう。確かめてもらうのは次の 3 点。
- 「めちゃくちゃ本格的なバレーだな……」と思える動きか（特にアタックの助走と、サーブ）
- 速すぎる・遅すぎる・不自然に見える動き
- 動きが本格的になって、爆発との差（「なんでボールが爆弾なんだよｗ」）が出ているか

OK が出たら Phase 5（演出強化・タイトル・リザルト・公開）の計画を書く。
