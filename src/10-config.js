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
  camera: { y: 8.5, z: 17, lookY: 2.0, fov: 42, follow: 0.25 },
  test: { apex: 7, fromX: 7, fromY: 2.6 },                // 試し投げ：反対側 x=±7、高さ 2.6m から、最高点 7m
};
