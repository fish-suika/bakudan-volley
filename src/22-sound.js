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
