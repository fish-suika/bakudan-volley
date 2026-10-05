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
