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
