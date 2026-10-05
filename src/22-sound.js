// ===== 音（Web Audio で作る。音声ファイルは使わない） =====
// ブラウザは最初の操作（クリック・タップ・キー）まで音を出せないので、そのときに作る
const SND = { ctx: null, out: null, noise: null, pink: null, brown: null, mute: false };

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
  if (!SND.ctx || SND.mute) return;
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
  if (!SND.ctx || SND.mute) return;
  const t0 = SND.ctx.currentTime + (delay || 0), s = SND.ctx.createBufferSource(), f = SND.ctx.createBiquadFilter(), g = SND.ctx.createGain();
  s.buffer = SND.noise;
  f.type = filter; f.frequency.setValueAtTime(from, t0);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(SND.out);
  s.start(t0); s.stop(t0 + dur + 0.02);
}

// 柔らかいザーッ（ピンク：高い音ほど弱い）と、もっと低く丸いザーッ（ブラウン）。タッチ音に使う
function sndColoredNoise() {
  const len = SND.ctx.sampleRate * 2;
  SND.pink = SND.ctx.createBuffer(1, len, SND.ctx.sampleRate);
  SND.brown = SND.ctx.createBuffer(1, len, SND.ctx.sampleRate);
  const p = SND.pink.getChannelData(0), b = SND.brown.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    p[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
    last = (last + 0.02 * w) / 1.02; b[i] = last * 3.5;
  }
}

// ザーッを、共鳴しない（Q を低くした）ローパスで短く切って出す
function sndBurst(buf, dur, vol, from, to, delay) {
  if (!SND.ctx || SND.mute) return;
  const t0 = SND.ctx.currentTime + (delay || 0), s = SND.ctx.createBufferSource(), f = SND.ctx.createBiquadFilter(), g = SND.ctx.createGain();
  s.buffer = buf;
  f.type = 'lowpass'; f.Q.value = 0.5;
  f.frequency.setValueAtTime(from, t0);
  f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.001);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(SND.out);
  s.start(t0, Math.random()); s.stop(t0 + dur + 0.05);
}

// 手でボールを叩く音：手が当たる「パッ」（ピンク）とボールが潰れる「ボフッ」（ブラウン）を重ねる。
// 本人が聞き比べて選んだ（sound-test.html の I）。音程のある音は太鼓に、高い所だけは電気に、
// 共鳴するフィルタや音のずらし重ねは金属に聞こえたので、どれも使わない
function sndHit(kind) {
  if (!SND.ctx) return;
  if (!SND.pink) sndColoredNoise();
  if (['attack', 'direct', 'standSpike', 'serve', 'block'].includes(kind)) {
    sndBurst(SND.pink, 0.045, 1.2, 4000, 1500);
    sndBurst(SND.brown, 0.09, 1.8, 1300, 300, 0.004);
  } else {
    sndBurst(SND.pink, 0.03, 0.65, 3000, 1200);
    sndBurst(SND.brown, 0.06, 1.0, 1100, 300, 0.003);
  }
}
// 点が入った音。味方の得点は明るく上がる「テレレン↑」、失点は残念に下がる「デロロ↓」
function sndPoint(ours) {
  const notes = ours ? [523, 659, 784, 1047] : [392, 330, 262, 196];
  notes.forEach((f, i) => {
    const last = i === notes.length - 1, dur = last ? 0.35 : 0.11;
    sndTone(f, f * (ours ? 1 : 0.97), dur, 'triangle', 0.35, i * 0.1);
    sndTone(f * 2, f * 2, dur * 0.8, 'square', 0.05, i * 0.1);   // 少しだけ明るさを足す
  });
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
