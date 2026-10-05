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
  slowScale: 0.08,                                        // 選ぶ間の時間の速さ
  choiceTime: 4.0,                                        // 選べる時間（実時間・秒）。過ぎたら味方に任せる
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
  camera: { y: 8.5, z: 17, lookY: 2.0, fov: 42, follow: 0.25 },
};
