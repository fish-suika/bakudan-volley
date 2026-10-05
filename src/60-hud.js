// ===== 画面の文字 =====
let __toastTimer = 0;
function showToast(text, sec) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.add('on');
  clearTimeout(__toastTimer);
  __toastTimer = setTimeout(() => el.classList.remove('on'), (sec || 1.6) * 1000);
}

const SCENE_TEXT = { serve: 'サーブ番', incoming: '相手が打った！', tossed: 'トスが上がった！' };
function showChoice(scene, attack) {
  document.getElementById('actions').classList.add('on');
  document.getElementById('sceneText').textContent = scene === 'incoming' && attack ? 'アタックが来る！' : SCENE_TEXT[scene];
  setCount(CFG.choiceTime);
  document.getElementById('scene').classList.add('on');
}
// 選べる残り時間を、場面の文字の横に秒で出す（4 → 1）
function setCount(left) {
  document.getElementById('count').textContent = Math.max(1, Math.ceil(left));
}
function hideChoice() {
  document.getElementById('actions').classList.remove('on');
  document.getElementById('scene').classList.remove('on');
  setTimer(0);
}
function setTimer(frac) {
  document.querySelector('#timer i').style.width = (Math.max(0, Math.min(1, frac)) * 100) + '%';
}
function setScore(s) {
  document.getElementById('s0').textContent = s[0];
  document.getElementById('s1').textContent = s[1];
}
function showResult(winner, s) {
  document.getElementById('resultText').textContent = winner === 0 ? '勝ち！' : '負け……';
  document.getElementById('resultScore').textContent = '味方 ' + s[0] + ' - ' + s[1] + ' 相手';
  document.getElementById('result').classList.add('on');
}
function hideResult() { document.getElementById('result').classList.remove('on'); }
