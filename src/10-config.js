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
  camera: { y: 8.5, z: 17, lookY: 2.0, fov: 42, follow: 0.25 },
};
