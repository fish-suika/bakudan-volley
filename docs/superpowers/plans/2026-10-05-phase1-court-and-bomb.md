# Phase 1 コートと爆弾 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 体育館のコートに人型の選手 4 人が構えて立っている。床をクリック（タップ）すると反対側から爆弾が飛んできて、壁・天井・ネット・選手には跳ね返り、床に触れたときだけ爆発する。どちらのコートで爆発したかが表示される。

**Architecture:** three.js r128（CDN）で描画する。爆弾の物理と打ち出しの計算は three.js に依存しない `12-ball.js` / `14-shot.js` に分け、`verify.html` から自動テストする。`src/` を `sh build.sh` で 1 枚の HTML に結合する（前作「ハイジャンプ・デリバリー」＝ `../santa/` と同じ構成）。

**Tech Stack:** 素の JavaScript、three.js r128。Node も Python も無い。

**仕様書:** `docs/superpowers/specs/2026-10-05-bakudan-volley-design.md`

**座標の約束:** Y が上、単位はメートル。コートの長い辺が X。ネットは x=0 の面で、**x<0 がプレイヤーのチーム（team 0、画面の左）、x≥0 が敵（team 1、画面の右）**。カメラは +Z 側から -Z を見る。選手の位置は**足元の中心**、体の前はローカルの +Z。

---

## ファイル

| ファイル | 役割 |
|---|---|
| `.gitattributes` | 改行を LF に固定（sh が壊れないように） |
| `build.sh` | 結合 |
| `src/00-head.html` / `src/99-tail.html` | 外枠・CSS・UI の HTML・three.js の読み込み |
| `src/verify-head.html` | 検証ページの外枠 |
| `src/10-config.js` | 数値 `CFG` |
| `src/12-ball.js` | 爆弾の物理（three.js 非依存） |
| `src/14-shot.js` | 狙った地点に落とす初速の計算（three.js 非依存） |
| `src/30-gym.js` | 体育館・コート・ネット・光 |
| `src/40-player.js` | 人型の組み立て・ポーズを当てる・爆弾を目で追う |
| `src/41-bomb.js` | 爆弾の見た目と床の影 |
| `src/42-motions.js` | ポーズ（Phase 1 は構えだけ） |
| `src/44-explosion-fx.js` | 爆発（Phase 1 は火の玉と爆風の輪） |
| `src/45-camera.js` | 中継の角度のカメラ |
| `src/50-input.js` | 試し用の入力（床クリック・Space） |
| `src/60-hud.js` | 画面の文字 |
| `src/90-boot.js` | 起動とメインループ |
| `src/verify-tests.js` | 自動テスト |

テストの「実行」は、`sh build.sh` のあとに `verify.html` をアプリ内ブラウザで開くこと（`file:///C:/Users/PC_User/Second%20brain/bakudan-volley/verify.html`）。タイトルが `PASS n/n` になれば全部通過。`document.title` を読めば結果が分かる。

---

### Task 1: 骨組み

**Files:** Create `.gitattributes`, `build.sh`, `src/00-head.html`, `src/99-tail.html`, `src/verify-head.html`, `src/10-config.js`, `src/verify-tests.js`

- [ ] **Step 1: `.gitattributes`**

```
* text=auto eol=lf
```

- [ ] **Step 2: `build.sh`**（このあとのタスクで作るファイルも最初から並べておく。無いファイルは Task ごとに作るので、Task 1 の時点では本体の結合は失敗してよい。検証ページの結合だけ通ればよい）

```sh
#!/bin/sh
# 分割ソースを1枚のHTMLに結合する
cd "$(dirname "$0")"

# --- 本体 ---
cat src/00-head.html \
    src/10-config.js \
    src/12-ball.js \
    src/14-shot.js \
    src/30-gym.js \
    src/40-player.js \
    src/41-bomb.js \
    src/42-motions.js \
    src/44-explosion-fx.js \
    src/45-camera.js \
    src/50-input.js \
    src/60-hud.js \
    src/90-boot.js \
    src/99-tail.html > bakudan-volley.html
cp bakudan-volley.html index.html   # GitHub Pages はルートの index.html を配信する

# --- 検証ページ ---
# 本体と同じく1枚に結合する（<script src> で隣を読むと表示環境によって読み込まれないため）
cat src/verify-head.html \
    src/10-config.js \
    src/12-ball.js \
    src/14-shot.js \
    src/verify-tests.js \
    src/99-tail.html > verify.html

echo "built bakudan-volley.html + index.html ($(wc -c < bakudan-volley.html) bytes)"
echo "built verify.html ($(wc -c < verify.html) bytes)"
```

- [ ] **Step 3: `src/00-head.html`**

```html
<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<title>爆弾バレー</title>
<style>
  :root{--ink:#fff;--jp:"Hiragino Kaku Gothic ProN","Yu Gothic","YuGothic","Meiryo","Noto Sans JP",sans-serif}
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:100%;height:100%;overflow:hidden;background:#20242a;color:var(--ink);font-family:var(--jp);
    touch-action:none;user-select:none;-webkit-user-select:none}
  canvas{display:block;width:100%;height:100%}

  /* ---- 試し用の案内（Phase 1） ---- */
  #hint{position:fixed;left:16px;bottom:16px;z-index:5;font-size:13px;opacity:.8;pointer-events:none;text-shadow:0 1px 6px #000}

  /* ---- お知らせ ---- */
  #toast{position:fixed;left:50%;top:22%;z-index:7;transform:translate(-50%,-50%);width:max-content;max-width:90vw;
    font-size:clamp(22px,5vw,40px);font-weight:700;letter-spacing:.08em;text-align:center;
    text-shadow:0 2px 16px rgba(0,0,0,.8);opacity:0;transition:opacity .25s;pointer-events:none}
  #toast.on{opacity:1}

  /* ---- スマホが縦向きのときの案内 ---- */
  #rotate{position:fixed;inset:0;z-index:50;display:none;align-items:center;justify-content:center;padding:16px;
    text-align:center;font-size:20px;background:#20242a}
  @media (orientation: portrait) and (pointer: coarse){#rotate{display:flex}}
</style>
</head>
<body>
<div id="hint">床をクリック（タップ）すると、反対側から爆弾が飛んでくる（試し用）／ Space でランダムな場所へ</div>
<div id="toast"></div>
<div id="rotate">横画面にしてください</div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script>
"use strict";
```

- [ ] **Step 4: `src/99-tail.html`**

```html
</script>
</body>
</html>
```

- [ ] **Step 5: `src/verify-head.html`**

```html
<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>検証 — 爆弾バレー</title>
<style>
  body{font-family:"Yu Gothic UI",system-ui,sans-serif;background:#1c1c1e;color:#eee;padding:24px;line-height:1.7}
  h1{font-size:18px;margin-bottom:16px}
  .r{padding:4px 0;border-bottom:1px solid #333}
  .ok::before{content:"PASS ";color:#6bd07a;font-weight:bold}
  .ng::before{content:"FAIL ";color:#ff6b6b;font-weight:bold}
  .ng{color:#ffb0b0}
  .why{color:#ff8f8f;padding-left:3em;font-size:13px}
  #sum{margin-top:18px;font-size:16px;font-weight:bold}
</style>
</head>
<body>
<h1>爆弾バレー — 検証</h1>
<div id="out"></div>
<div id="sum"></div>

<script>
"use strict";
```

- [ ] **Step 6: `src/10-config.js`**

```js
// ===== 数値（遊びながら調整する） =====
const CFG = {
  gravity: 9.8,
  court: { halfLen: 9, halfWid: 4.5 },                    // コートは x:-9..9, z:-4.5..4.5。ネットは x=0
  net: { top: 2.43, bottom: 1.43, halfWid: 5.5, thick: 0.06 },
  gym: { halfX: 15, halfZ: 11, ceil: 12 },                // 壁は x=±15, z=±11、天井は 12m
  ball: { r: 0.3, bounce: 0.65, netBounce: 0.25, playerBounce: 0.5, maxStep: 1 / 240 },
  player: { r: 0.4, h: 1.9, hipY: 0.95 },                 // 当たり判定は足元から高さ h の円柱
  startSpots: [                                           // 構える位置（team 0 = 味方・左、1 = 敵・右）
    { team: 0, x: -5, z: -2 }, { team: 0, x: -5, z: 2 },
    { team: 1, x: 5, z: -2 },  { team: 1, x: 5, z: 2 },
  ],
  explodeDelay: 0.25,                                     // 床に触れてから爆発するまでの「一瞬の間」（秒）
  camera: { y: 8.5, z: 17, lookY: 1.0, fov: 42, follow: 0.25 },
  test: { apex: 7, fromX: 7, fromY: 2.6 },                // 試し投げ：反対側 x=±7、高さ 2.6m から、最高点 7m
};
```

- [ ] **Step 7: `src/verify-tests.js`**（ハーネスと結果表示だけ。テストは Task 2・3 で間に足す）

```js
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
```

- [ ] **Step 8: 空の `src/12-ball.js` と `src/14-shot.js` を作り（中身はコメント 1 行ずつ）、結合する**

```js
// ===== 爆弾の物理（three.js 非依存） =====
```

```js
// ===== 打ち出しの計算（three.js 非依存） =====
```

Run: `sh build.sh`
Expected: 本体の結合で「No such file」が出る（まだ無いファイルがあるため）が、`verify.html` はできる。verify.html を開くとタイトルが `PASS 0/0`。

- [ ] **Step 9: Commit**

```bash
git add .gitattributes build.sh src
git commit -m "骨組み：結合スクリプト・外枠・数値・検証ページ"
```

---

### Task 2: 爆弾の物理

**Files:** Modify `src/12-ball.js`, `src/verify-tests.js`（結果表示の直前に足す）

約束：爆弾は**床に触れたときだけ**爆発する。天井・壁・ネット・選手には跳ね返るだけ。床に触れた側（x<0 なら 0、それ以外は 1）が失点する。コートの外の床でも同じ。

- [ ] **Step 1: テストを書く**（`// ===== 結果表示 =====` の直前に追加）

```js
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
```

- [ ] **Step 2: 失敗を確かめる**

Run: `sh build.sh` → verify.html を開く
Expected: タイトルが `FAIL 0/11`（`stepBall is not defined` など）

- [ ] **Step 3: 実装する（`src/12-ball.js` を丸ごと書き換え）**

```js
// ===== 爆弾の物理（three.js 非依存） =====
// 爆弾は床に触れたときだけ爆発する。天井・壁・ネット・選手には跳ね返るだけ。
function newBall(x, y, z) {
  return { pos: { x, y, z }, vel: { x: 0, y: 0, z: 0 }, live: true };
}
function sideOf(x) { return x < 0 ? 0 : 1; }             // 0 = 味方（左）、1 = 敵（右）
function inCourt(x, z) { return Math.abs(x) <= CFG.court.halfLen && Math.abs(z) <= CFG.court.halfWid; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

// dt 秒進める。床に触れたら { x, z, side } を返して live=false にする。それ以外は null。
// players: [{ x, z }] 選手の足元。rand: 0..1 の乱数（テストで固定するため）
function stepBall(b, dt, players, rand) {
  if (!b.live) return null;
  rand = rand || Math.random;
  const n = Math.max(1, Math.ceil(dt / CFG.ball.maxStep - 1e-9));   // すり抜けないよう細かく刻む
  const h = dt / n, g = CFG.gravity;
  for (let i = 0; i < n; i++) {
    b.pos.x += b.vel.x * h;
    b.pos.y += (b.vel.y - 0.5 * g * h) * h;              // 重力一定なので、この刻みでも放物線は正確
    b.pos.z += b.vel.z * h;
    b.vel.y -= g * h;
    const hit = collideBall(b, players || [], rand);
    if (hit) return hit;
  }
  return null;
}

function collideBall(b, players, rand) {
  const r = CFG.ball.r, G = CFG.gym, e = CFG.ball.bounce, p = b.pos, v = b.vel;
  // 床：ここだけ爆発する
  if (p.y - r <= 0) {
    p.y = r;
    b.live = false;
    return { x: p.x, z: p.z, side: sideOf(p.x) };
  }
  // 天井・壁（手前の壁は見えないが当たる）
  if (p.y + r > G.ceil)   { p.y = G.ceil - r;   if (v.y > 0) v.y = -v.y * e; }
  if (p.x - r < -G.halfX) { p.x = -G.halfX + r; if (v.x < 0) v.x = -v.x * e; }
  if (p.x + r >  G.halfX) { p.x =  G.halfX - r; if (v.x > 0) v.x = -v.x * e; }
  if (p.z - r < -G.halfZ) { p.z = -G.halfZ + r; if (v.z < 0) v.z = -v.z * e; }
  if (p.z + r >  G.halfZ) { p.z =  G.halfZ - r; if (v.z > 0) v.z = -v.z * e; }
  // ネット（白帯から下 1m の薄い板）
  const N = CFG.net;
  sphereBox(b, { minX: -N.thick / 2, maxX: N.thick / 2, minY: N.bottom, maxY: N.top, minZ: -N.halfWid, maxZ: N.halfWid }, CFG.ball.netBounce);
  for (const pl of players) hitPlayer(b, pl, rand);
  return null;
}

// 球と箱。重なっていれば外へ押し出し、面の向きの速さを反転して e 倍にする
function sphereBox(b, box, e) {
  const p = b.pos, v = b.vel, r = CFG.ball.r;
  let dx = p.x - clamp(p.x, box.minX, box.maxX);
  let dy = p.y - clamp(p.y, box.minY, box.maxY);
  let dz = p.z - clamp(p.z, box.minZ, box.maxZ);
  const d2 = dx * dx + dy * dy + dz * dz;
  if (d2 >= r * r) return false;
  let d = Math.sqrt(d2);
  if (d < 1e-6) {                                         // 中心が箱の中：x の向きに押し出す（ネットは薄いので）
    const left = p.x < (box.minX + box.maxX) / 2;
    p.x = left ? box.minX - r : box.maxX + r;
    dx = left ? -1 : 1; dy = 0; dz = 0; d = 1;
  } else {
    const k = (r - d) / d;
    p.x += dx * k; p.y += dy * k; p.z += dz * k;
  }
  const nx = dx / d, ny = dy / d, nz = dz / d;
  const vn = v.x * nx + v.y * ny + v.z * nz;
  if (vn < 0) { const j = (1 + e) * vn; v.x -= j * nx; v.y -= j * ny; v.z -= j * nz; }
  return true;
}

// 選手は足元から高さ h の円柱。横から当たれば横へ、頭の上なら上へ弾く
function hitPlayer(b, pl, rand) {
  const R = CFG.player.r, H = CFG.player.h, r = CFG.ball.r, e = CFG.ball.playerBounce, p = b.pos, v = b.vel;
  const dx = p.x - pl.x, dz = p.z - pl.z, d = Math.hypot(dx, dz);
  if (p.y - r >= H || d >= R + r) return false;
  if (p.y > H && d < R) {                                 // 頭の上：上へ弾く。真上で止まらないよう横にも押す
    p.y = H + r;
    if (v.y < 0) v.y = -v.y * e;
    const a = rand() * Math.PI * 2;
    v.x += Math.cos(a) * 1.2; v.z += Math.sin(a) * 1.2;
    return true;
  }
  const nx = d < 1e-6 ? 1 : dx / d, nz = d < 1e-6 ? 0 : dz / d;
  p.x = pl.x + nx * (R + r); p.z = pl.z + nz * (R + r);
  const vn = v.x * nx + v.z * nz;
  if (vn < 0) { const j = (1 + e) * vn; v.x -= j * nx; v.z -= j * nz; }
  return true;
}
```

- [ ] **Step 4: 通過を確かめる**

Run: `sh build.sh` → verify.html を再読み込み
Expected: `PASS 11/11`

- [ ] **Step 5: Commit**

```bash
git add src/12-ball.js src/verify-tests.js
git commit -m "爆弾の物理：床に触れたときだけ爆発、天井・壁・ネット・選手は跳ね返る"
```

---

### Task 3: 狙った地点に落とす初速

**Files:** Modify `src/14-shot.js`, `src/verify-tests.js`

- [ ] **Step 1: テストを書く**（Task 2 のテストの後、`// ===== 結果表示 =====` の直前）

```js
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
```

- [ ] **Step 2: 失敗を確かめる**

Run: `sh build.sh` → verify.html を再読み込み
Expected: `FAIL 11/14`（`shotVelocity is not defined`）

- [ ] **Step 3: 実装する（`src/14-shot.js` を丸ごと書き換え）**

```js
// ===== 打ち出しの計算（three.js 非依存） =====
// from から打ち出し、床からの高さ apex の最高点を通って、to（x, z）の地点で床に触れる初速を返す。
// 「床に触れる」は爆弾の中心が半径 r の高さになったとき。apex が打つ高さより低いときは打つ高さを最高点とする
function shotVelocity(from, to, apex) {
  const g = CFG.gravity, r = CFG.ball.r;
  const top = Math.max(apex, from.y + 0.01, r + 0.01);
  const vy = Math.sqrt(2 * g * (top - from.y));
  const t = vy / g + Math.sqrt(2 * (top - r) / g);          // 上がる時間＋最高点から床までの時間
  return { x: (to.x - from.x) / t, y: vy, z: (to.z - from.z) / t };
}
```

- [ ] **Step 4: 通過を確かめる**

Run: `sh build.sh` → verify.html を再読み込み
Expected: `PASS 14/14`

- [ ] **Step 5: Commit**

```bash
git add src/14-shot.js src/verify-tests.js
git commit -m "狙った地点に落とす初速の計算"
```

---

### Task 4: 体育館とカメラ（画面に出す）

**Files:** Create `src/30-gym.js`, `src/45-camera.js`, `src/44-explosion-fx.js`, `src/60-hud.js`, 仮の `src/90-boot.js`（Task 6 で完成させる）、空の `src/40-player.js` `src/41-bomb.js` `src/42-motions.js` `src/50-input.js`（コメント 1 行ずつ）

- [ ] **Step 1: `src/30-gym.js`**

```js
// ===== 体育館・コート・ネット・光 =====
function buildGym(scene) {
  const C = CFG.court, N = CFG.net, G = CFG.gym;
  const mat = c => new THREE.MeshLambertMaterial({ color: c });
  function box(w, h, d, color, x, y, z, cast) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    m.position.set(x, y, z);
    m.receiveShadow = true;
    if (cast) m.castShadow = true;
    scene.add(m);
    return m;
  }
  scene.background = new THREE.Color(0x20242a);

  // 床（木）とコート面
  box(G.halfX * 2, 0.1, G.halfZ * 2, 0xc89a62, 0, -0.05, 0);
  box(C.halfLen * 2, 0.01, C.halfWid * 2, 0xd77a3c, 0, 0.005, 0);
  // 線（幅 5cm）：外周、エンドライン、アタックライン（ネットから 3m）、センターライン
  const L = 0.05, ly = 0.012, white = 0xffffff;
  box(C.halfLen * 2 + L, 0.004, L, white, 0, ly,  C.halfWid);
  box(C.halfLen * 2 + L, 0.004, L, white, 0, ly, -C.halfWid);
  for (const x of [-C.halfLen, -3, 0, 3, C.halfLen]) box(L, 0.004, C.halfWid * 2, white, x, ly, 0);

  // 壁と天井（手前の壁はカメラの前なので作らない。当たり判定だけある）
  box(G.halfX * 2, G.ceil, 0.2, 0x9fb0a8, 0, G.ceil / 2, -G.halfZ - 0.1);
  box(0.2, G.ceil, G.halfZ * 2, 0xa9b6ad, -G.halfX - 0.1, G.ceil / 2, 0);
  box(0.2, G.ceil, G.halfZ * 2, 0xa9b6ad,  G.halfX + 0.1, G.ceil / 2, 0);
  box(G.halfX * 2, 0.2, G.halfZ * 2, 0x5b6168, 0, G.ceil + 0.1, 0);
  box(G.halfX * 2, 1.2, 0.05, 0x3f6f8f, 0, 0.6, -G.halfZ + 0.03);   // 奥の壁の腰板

  // 天井の照明
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff6dd });
  for (const x of [-9, -3, 3, 9]) for (const z of [-5, 1, 7]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.6), lampMat);
    m.position.set(x, G.ceil - 0.05, z);
    scene.add(m);
  }

  // ネット：支柱・網・上の白帯
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, N.top + 0.1, 12), mat(0xdddddd));
    post.position.set(0, (N.top + 0.1) / 2, s * (N.halfWid + 0.1));
    post.castShadow = true;
    scene.add(post);
  }
  const netMat = new THREE.MeshLambertMaterial({ color: 0x111111, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
  const net = new THREE.Mesh(new THREE.PlaneGeometry(N.halfWid * 2, N.top - N.bottom), netMat);
  net.rotation.y = Math.PI / 2;
  net.position.set(0, (N.top + N.bottom) / 2, 0);
  scene.add(net);
  box(0.04, 0.07, N.halfWid * 2, white, 0, N.top - 0.035, 0, true);

  // 光
  scene.add(new THREE.HemisphereLight(0xfff8ee, 0x8a6a48, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 0.55);
  sun.position.set(-4, 14, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 12, bottom: -12, near: 1, far: 40 });
  scene.add(sun);
}
```

- [ ] **Step 2: `src/44-explosion-fx.js`**（カメラの揺れ `FX.shake` を使うので先に作る）

```js
// ===== 爆発（Phase 1 は火の玉と爆風の輪。本格的な演出は Phase 4） =====
const FX = { scene: null, light: null, list: [], shake: 0 };
const FX_LIFE = 0.9;                                      // 秒

function initFx(scene) {
  FX.scene = scene;
  FX.light = new THREE.PointLight(0xffb040, 0, 30);       // 最初から置いておく（途中で光を足すと描画が一瞬止まるため）
  scene.add(FX.light);
}

function spawnExplosion(x, z) {
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xffa020, transparent: true }));
  ball.position.set(x, 0.5, z);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 40),
    new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.03, z);
  FX.scene.add(ball, ring);
  FX.light.position.set(x, 2, z);
  FX.list.push({ t: 0, ball, ring });
  FX.shake = 0.6;
}

function updateFx(dt) {
  let glow = 0;
  for (const f of FX.list) {
    f.t += dt;
    const a = Math.min(1, f.t / FX_LIFE);
    f.ball.scale.setScalar(0.5 + 4 * Math.sqrt(a));
    f.ball.material.opacity = 1 - a;
    f.ball.material.color.setHSL(0.09 - 0.07 * a, 1, 0.6 - 0.3 * a);
    f.ring.scale.setScalar(1 + 12 * a);
    f.ring.material.opacity = 0.8 * (1 - a);
    glow = Math.max(glow, 6 * (1 - a));
  }
  for (let i = FX.list.length - 1; i >= 0; i--) {
    const f = FX.list[i];
    if (f.t < FX_LIFE) continue;
    FX.scene.remove(f.ball, f.ring);
    for (const m of [f.ball, f.ring]) { m.geometry.dispose(); m.material.dispose(); }
    FX.list.splice(i, 1);
  }
  FX.light.intensity = glow;
  FX.shake = Math.max(0, FX.shake - dt * 1.2);
}
```

- [ ] **Step 3: `src/45-camera.js`**

```js
// ===== カメラ（中継の角度：コートの横、斜め上から） =====
const CAM = { cam: null, x: 0 };

// focusX：爆弾の x。少しだけ追って横に振る
function updateCamera(dt, focusX) {
  const c = CFG.camera, s = FX.shake;
  CAM.x += (focusX * c.follow - CAM.x) * Math.min(1, dt * 2);
  CAM.cam.position.set(CAM.x + (Math.random() - 0.5) * s, c.y + (Math.random() - 0.5) * s, c.z);
  CAM.cam.lookAt(CAM.x, c.lookY, 0);
}
```

- [ ] **Step 4: `src/60-hud.js`**

```js
// ===== 画面の文字 =====
let __toastTimer = 0;
function showToast(text, sec) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.add('on');
  clearTimeout(__toastTimer);
  __toastTimer = setTimeout(() => el.classList.remove('on'), (sec || 1.6) * 1000);
}
```

- [ ] **Step 5: 仮の `src/90-boot.js`**（体育館を映すだけ）

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

  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  });

  const clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 1 / 30);
    updateFx(dt);
    updateCamera(dt, 0);
    renderer.render(scene, camera);
  }
  frame();
})();
```

- [ ] **Step 6: 空の `src/40-player.js` `src/41-bomb.js` `src/42-motions.js` `src/50-input.js` を作る**（それぞれコメント 1 行：`// ===== 選手の人型 =====` / `// ===== 爆弾の見た目 =====` / `// ===== ポーズ =====` / `// ===== 入力 =====`）

- [ ] **Step 7: 画面で確かめる**

Run: `sh build.sh`（エラーなしで 2 行出る）→ アプリ内ブラウザで `file:///C:/Users/PC_User/Second%20brain/bakudan-volley/bakudan-volley.html` を開く
Expected: コンソールにエラーが無い。コート全体（左右のエンドラインまで）とネット、奥の壁、天井の照明が中継の角度で見える。スクリーンショットを撮る。verify.html は `PASS 14/14` のまま。

- [ ] **Step 8: Commit**

```bash
git add build.sh src bakudan-volley.html index.html verify.html
git commit -m "体育館・コート・ネットと中継の角度のカメラ"
```

---

### Task 5: 人型の選手 4 人

**Files:** Modify `src/40-player.js`, `src/42-motions.js`, `src/90-boot.js`

- [ ] **Step 1: `src/42-motions.js`**

```js
// ===== ポーズ（関節の角度、ラジアン） =====
// 腕・太ももは rx が負で前へ振る。spine の rx が正で前かがみ。膝・肘は rx で曲げる
// 左右は L が体の左（ローカル +X）。rz が L で正・R で負なら外へ開く
// hipsDrop：腰を下げる量（膝を曲げても足が床から浮かないように合わせる）
const POSES = {
  ready: {                                                // 構え：膝を曲げ、前かがみで腕を前に
    hipsDrop: 0.11,
    spine: [0.35, 0, 0], neck: [-0.25, 0, 0],
    shoulderL: [-0.55, 0, 0.12], elbowL: [-0.9, 0, 0],
    shoulderR: [-0.55, 0, -0.12], elbowR: [-0.9, 0, 0],
    hipL: [-0.5, 0, 0.05], kneeL: [1.0, 0, 0],
    hipR: [-0.5, 0, -0.05], kneeR: [1.0, 0, 0],
  },
};
```

- [ ] **Step 2: `src/40-player.js`**

```js
// ===== 選手の人型（コードで組む。関節を回してポーズを作る） =====
// 関節は腰（hips）を根元にした木構造。体の前はローカルの +Z、左は +X
const JOINTS = ['hips', 'spine', 'neck', 'head', 'shoulderL', 'elbowL', 'shoulderR', 'elbowR', 'hipL', 'kneeL', 'hipR', 'kneeR'];
const TEAM_COLORS = [{ shirt: 0x2f6fdf, shorts: 0x1d2b4f }, { shirt: 0xd8433a, shorts: 0x4a1d1d }];

function makePlayer(scene, team) {
  const col = TEAM_COLORS[team];
  const lam = c => new THREE.MeshLambertMaterial({ color: c });
  const skin = lam(0xeec39a), shirt = lam(col.shirt), shorts = lam(col.shorts), shoe = lam(0xf2f2f2), hair = lam(0x2a1d14);
  const j = {};
  const grp = (name, parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); j[name] = g; return g; };
  const part = (parent, geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
  const limb = (len, r0, r1) => new THREE.CylinderGeometry(r0, r1, len, 10);

  const root = new THREE.Group();
  scene.add(root);
  const hips = grp('hips', root, 0, CFG.player.hipY, 0);
  part(hips, new THREE.BoxGeometry(0.34, 0.2, 0.22), shorts, 0, 0, 0);
  const spine = grp('spine', hips, 0, 0.08, 0);
  part(spine, new THREE.BoxGeometry(0.38, 0.56, 0.24), shirt, 0, 0.3, 0);
  const neck = grp('neck', spine, 0, 0.6, 0);
  part(neck, limb(0.1, 0.05, 0.06), skin, 0, 0.03, 0);
  const head = grp('head', neck, 0, 0.1, 0);
  head.rotation.order = 'YXZ';                            // 横を向いてから上下を向く
  part(head, new THREE.SphereGeometry(0.12, 16, 12), skin, 0, 0.1, 0);
  part(head, new THREE.SphereGeometry(0.125, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), hair, 0, 0.115, -0.01);

  for (const [s, L] of [[1, 'L'], [-1, 'R']]) {
    const sh = grp('shoulder' + L, spine, s * 0.25, 0.54, 0);
    part(sh, limb(0.12, 0.07, 0.065), shirt, 0, -0.04, 0);          // 袖
    part(sh, limb(0.3, 0.05, 0.045), skin, 0, -0.15, 0);
    const el = grp('elbow' + L, sh, 0, -0.3, 0);
    part(el, limb(0.27, 0.045, 0.04), skin, 0, -0.135, 0);
    part(el, new THREE.SphereGeometry(0.05, 10, 8), skin, 0, -0.3, 0);   // 手
    const hp = grp('hip' + L, hips, s * 0.1, -0.05, 0);
    part(hp, limb(0.45, 0.085, 0.065), skin, 0, -0.225, 0);
    part(hp, limb(0.2, 0.095, 0.09), shorts, 0, -0.08, 0);          // 短パンの裾
    const kn = grp('knee' + L, hp, 0, -0.45, 0);
    part(kn, limb(0.42, 0.06, 0.045), skin, 0, -0.21, 0);
    part(kn, new THREE.BoxGeometry(0.11, 0.08, 0.24), shoe, 0, -0.41, 0.04);
  }
  return { root, j, team, phase: Math.random() * 6, look: { yaw: 0, pitch: 0 } };
}

// 足元を (x, z) に置き、ネットのほうを向かせる
function placePlayer(pl, x, z) {
  pl.root.position.set(x, 0, z);
  pl.root.rotation.y = pl.team === 0 ? Math.PI / 2 : -Math.PI / 2;
}

function applyPose(pl, pose) {
  for (const name of JOINTS) {
    const r = pose[name] || [0, 0, 0];
    pl.j[name].rotation.set(r[0], r[1], r[2]);
  }
  pl.j.hips.position.y = CFG.player.hipY - (pose.hipsDrop || 0);
}

// 頭（と少し胴）を target へ向ける。ポーズを当てたあとに呼ぶ
function lookAtTarget(pl, target, dt) {
  const p = pl.root.position;
  const dx = target.x - p.x, dy = target.y - (p.y + 1.75), dz = target.z - p.z;
  let yaw = Math.atan2(dx, dz) - pl.root.rotation.y;
  yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
  yaw = Math.max(-1.3, Math.min(1.3, yaw));
  const pitch = Math.max(-1.0, Math.min(0.7, -Math.atan2(dy, Math.hypot(dx, dz))));
  const k = Math.min(1, dt * 8);
  pl.look.yaw += (yaw - pl.look.yaw) * k;
  pl.look.pitch += (pitch - pl.look.pitch) * k;
  pl.j.head.rotation.y += pl.look.yaw * 0.7;
  pl.j.head.rotation.x += pl.look.pitch;
  pl.j.spine.rotation.y += pl.look.yaw * 0.3;
}

// Phase 1：構えたまま小さく揺れ、focus（爆弾）を目で追う
function updatePlayer(pl, dt, t, focus) {
  applyPose(pl, POSES.ready);
  pl.j.hips.position.y += Math.sin(t * 3 + pl.phase) * 0.012;
  lookAtTarget(pl, focus, dt);
}
```

- [ ] **Step 3: `src/90-boot.js` に選手を足す**（`CAM.cam = camera;` の次の行に追加）

```js
  // 選手 4 人（Phase 1 は定位置で構えるだけ）
  const players = CFG.startSpots.map(s => {
    const pl = makePlayer(scene, s.team);
    placePlayer(pl, s.x, s.z);
    return pl;
  });
```

`frame()` の中、`const dt = ...` の次の行に追加：

```js
    t += dt;
    for (const pl of players) updatePlayer(pl, dt, t, { x: 0, y: 3, z: 0 });
```

`const clock = new THREE.Clock();` の次の行に `let t = 0;` を追加。

- [ ] **Step 4: 画面で確かめる**

Run: `sh build.sh` → bakudan-volley.html を再読み込み
Expected: エラーなし。左に青のシャツ 2 人、右に赤のシャツ 2 人が、膝を曲げ前かがみで腕を前に出した構えで、ネットのほうを向いて立つ。足が床に埋まったり浮いたりしていない。頭がネットの上（0, 3, 0）を見ている。少し寄ったスクリーンショットを撮る（`CAM.cam.position.set(-5, 2, 4); CAM.cam.lookAt(-5, 1, 0)` を javascript_tool で実行したあと、次のフレームで updateCamera に戻されるので、撮るときは一時的に `CFG.camera` を書き換えてもよい：`CFG.camera.y = 2.2; CFG.camera.z = 5; CFG.camera.lookY = 1`。撮ったら再読み込みで戻す）。

- [ ] **Step 5: Commit**

```bash
git add src bakudan-volley.html index.html verify.html
git commit -m "人型の選手4人：関節の木構造と構えのポーズ、目で追う"
```

---

### Task 6: 爆弾を投げ込んで爆発させる

**Files:** Modify `src/41-bomb.js`, `src/50-input.js`, `src/90-boot.js`

- [ ] **Step 1: `src/41-bomb.js`**

```js
// ===== 爆弾の見た目（黒い球にバレーボールの縫い目、口金と導火線）と床の影 =====
function makeBombMesh(scene) {
  const r = CFG.ball.r;
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), new THREE.MeshPhongMaterial({ color: 0x1b1b1f, shininess: 80 }));
  body.castShadow = true;
  g.add(body);
  const seamMat = new THREE.MeshBasicMaterial({ color: 0xe8e8e8 });
  for (const rot of [[0, 0, 0], [Math.PI / 2, 0, 0], [0, 0, Math.PI / 2]]) {
    const s = new THREE.Mesh(new THREE.TorusGeometry(r * 1.005, 0.012, 6, 40), seamMat);
    s.rotation.set(rot[0], rot[1], rot[2]);
    g.add(s);
  }
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.08, 12), new THREE.MeshLambertMaterial({ color: 0x777777 }));
  cap.position.y = r + 0.02;
  g.add(cap);
  const fuse = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 6), new THREE.MeshLambertMaterial({ color: 0xc8b48a }));
  fuse.position.set(0.03, r + 0.12, 0);
  fuse.rotation.z = -0.4;
  g.add(fuse);
  const spark = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd04a }));
  spark.position.set(0.07, r + 0.2, 0);
  g.add(spark);
  scene.add(g);
  // 真下の丸い影（高い所にあっても落ちる場所が分かるように）
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(r, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);
  return { g, spark, shadow };
}

// ball が null なら隠す。飛んでいる間は進む向きに転がす
function updateBombMesh(m, ball, dt) {
  m.g.visible = m.shadow.visible = !!ball;
  if (!ball) return;
  m.g.position.set(ball.pos.x, ball.pos.y, ball.pos.z);
  if (ball.live) {
    m.g.rotation.x += ball.vel.z / CFG.ball.r * dt;
    m.g.rotation.z -= ball.vel.x / CFG.ball.r * dt;
  }
  m.spark.scale.setScalar(0.7 + Math.random() * 0.8);    // 導火線の火花のちらつき（時間で爆発はしない）
  m.shadow.position.set(ball.pos.x, 0.015, ball.pos.z);
  const k = Math.max(0.4, 1 - ball.pos.y / 14);
  m.shadow.scale.setScalar(k * 1.2);
  m.shadow.material.opacity = 0.35 * k;
}
```

- [ ] **Step 2: `src/50-input.js`**

```js
// ===== 入力（Phase 1 は試し用：床をクリック・タップすると爆弾が飛んでくる。Space でランダムな場所へ） =====
function initInput(canvas, camera, onFloor) {
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  canvas.addEventListener('pointerdown', e => {
    ndc.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(floor, hit)) onFloor(hit.x, hit.z);
  });
  addEventListener('keydown', e => {
    if (e.code !== 'Space') return;
    e.preventDefault();
    const C = CFG.court;
    onFloor((Math.random() * 2 - 1) * C.halfLen, (Math.random() * 2 - 1) * C.halfWid);
  });
}
```

- [ ] **Step 3: `src/90-boot.js` を完成させる（丸ごと書き換え）**

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

  // 選手 4 人（Phase 1 は定位置で構えるだけ）。爆弾の当たり判定には足元の位置を渡す
  const players = CFG.startSpots.map(s => {
    const pl = makePlayer(scene, s.team);
    placePlayer(pl, s.x, s.z);
    return pl;
  });
  const colliders = CFG.startSpots.map(s => ({ x: s.x, z: s.z }));

  const bombMesh = makeBombMesh(scene);
  let ball = null;      // 今の爆弾（無ければ null）
  let boom = null;      // 床に触れてからの待ち { t, hit, fired }

  // 試し投げ：狙った地点の反対側のコートから投げ込む
  function throwTo(x, z) {
    if (boom) return;                                     // 爆発が終わるまでは投げない
    const from = { x: x < 0 ? CFG.test.fromX : -CFG.test.fromX, y: CFG.test.fromY, z: z * 0.3 };
    ball = newBall(from.x, from.y, from.z);
    ball.vel = shotVelocity(from, { x, z }, CFG.test.apex);
  }
  initInput(renderer.domElement, camera, throwTo);
  window.GAME = { scene, players, colliders, throwTo, get ball() { return ball; } };   // 確認用

  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  });

  const clock = new THREE.Clock();
  let t = 0;
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 1 / 30);
    t += dt;
    if (ball && ball.live) {
      const hit = stepBall(ball, dt, colliders);
      if (hit) boom = { t: 0, hit, fired: false };
    }
    if (boom) {
      boom.t += dt;
      if (!boom.fired && boom.t >= CFG.explodeDelay) {   // 一瞬の間をおいて爆発
        boom.fired = true;
        ball = null;
        spawnExplosion(boom.hit.x, boom.hit.z);
        showToast(boom.hit.side === 0 ? '味方コートで爆発！' : '相手コートで爆発！');
      }
      if (boom.t >= CFG.explodeDelay + 1.2) boom = null;
    }
    const focus = ball ? ball.pos : { x: 0, y: 3, z: 0 };
    for (const pl of players) updatePlayer(pl, dt, t, focus);
    updateBombMesh(bombMesh, ball, dt);
    updateFx(dt);
    updateCamera(dt, ball ? ball.pos.x : 0);
    renderer.render(scene, camera);
  }
  frame();
})();
```

- [ ] **Step 4: 画面で確かめる**

Run: `sh build.sh` → bakudan-volley.html を再読み込み
Expected（javascript_tool で `GAME.throwTo(x, z)` を呼び、少し待ってから撮る）:
1. `GAME.throwTo(-5, 1)`：右から爆弾が山なりに飛び、左の床に落ちる。落ちた所で一瞬止まってから火の玉と輪が広がり、カメラが揺れ、「味方コートで爆発！」が出る。選手 4 人が飛んでいる間ずっと爆弾を目で追う
2. `GAME.throwTo(6, -3)`：左から右へ、「相手コートで爆発！」
3. `GAME.throwTo(-5, -2)`（選手の真上）：選手の頭で弾んで、そのあと床で爆発する
4. `GAME.throwTo(-0.5, 0)`：ネットのすぐ手前を狙う。ネットに当たって跳ね返っても爆発せず、床で爆発する
5. コンソールにエラーが無い。verify.html は `PASS 14/14`

飛んでいる途中と爆発の瞬間のスクリーンショットを撮る。

- [ ] **Step 5: Commit**

```bash
git add src bakudan-volley.html index.html verify.html
git commit -m "試し投げ：床をクリックすると反対側から爆弾が飛び、床でだけ爆発する"
```

---

## Phase 1 の終わり

本人に `C:\Users\PC_User\Second brain\bakudan-volley\bakudan-volley.html` を開いて遊んでもらう。確かめてもらうのは次の 3 点。
- 爆弾の飛び方と跳ね返り（ネット・選手・壁・天井）
- 床に触れたときだけ爆発すること
- カメラの見やすさ

OK が出たら Phase 2（4 つの行動とスローでの選択）の計画を書く。
