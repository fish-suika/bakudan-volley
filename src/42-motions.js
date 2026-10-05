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
  if (a.stun > 0) return POSES.stagger;
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

// 吹っ飛んでいる人のポーズ（20-blast.js の fly.state から）
function flyPose(f, simT) {
  if (f.state === 'air' || f.state === 'hang') return Math.sin(simT * 18) > 0 ? POSES.flail1 : POSES.flail2;
  if (f.state === 'stick') return POSES.splat;
  if (f.state === 'getup') return f.t < CFG.blast.getupTime * 0.5 ? POSES.lie : POSES.ready;
  return POSES.lie;
}
