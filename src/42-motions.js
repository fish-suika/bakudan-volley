// ===== ポーズ（関節の角度、ラジアン） =====
const JOINTS = ['hips', 'spine', 'neck', 'head', 'shoulderL', 'elbowL', 'shoulderR', 'elbowR', 'hipL', 'kneeL', 'hipR', 'kneeR'];
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
  spikeHit: {                                             // 打つ瞬間：右腕をほぼまっすぐ頭の上へ伸ばして当てる（跳んだ頂点で爆弾は肩の約 1.5m 上。体をたたむのは振り抜きから）
    spine: [0.2, -0.3, 0], neck: [-0.2, 0, 0],
    shoulderL: [-0.4, 0, 0.3], elbowL: [-0.6, 0, 0],
    shoulderR: [-2.7, 0, -0.1], elbowR: [-0.15, 0, 0],
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
  stagger: {                                              // ぶつかってよろける：のけぞって両腕を振り回す
    hipsDrop: 0.08,
    spine: [-0.4, 0.2, 0.15], neck: [0.3, 0, 0],
    shoulderL: [-1.6, 0, 1.0], elbowL: [-0.4, 0, 0],
    shoulderR: [-1.2, 0, -1.2], elbowR: [-0.6, 0, 0],
    hipL: [0.2, 0, 0.1], kneeL: [0.5, 0, 0],
    hipR: [-0.6, 0, -0.1], kneeR: [0.9, 0, 0],
  },
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
};

POSES.run2 = mirrorPose(POSES.run1);                      // 走る（右脚が前）
POSES.flail2 = mirrorPose(POSES.flail1);
POSES.shuffle2 = mirrorPose(POSES.shuffle1);

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

// 吹っ飛んでいる人のポーズ（20-blast.js の fly.state から）
function flyPose(f, simT) {
  if (f.state === 'air' || f.state === 'hang') return Math.sin(simT * 18) > 0 ? POSES.flail1 : POSES.flail2;
  if (f.state === 'stick') return POSES.splat;
  if (f.state === 'getup') return f.t < CFG.blast.getupTime * 0.5 ? POSES.lie : POSES.ready;
  return POSES.lie;
}
