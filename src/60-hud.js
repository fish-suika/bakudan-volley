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
function showChoice(scene, attack, allowed) {
  const box = document.getElementById('actions');
  box.classList.add('on');
  box.querySelectorAll('button').forEach(b => b.classList.toggle('off', !!allowed && !allowed.includes(b.dataset.act)));
  const el = document.getElementById('scene');
  el.textContent = scene === 'incoming' && attack ? 'アタックが来る！' : SCENE_TEXT[scene];
  el.classList.add('on');
}
function hideChoice() {
  document.getElementById('actions').classList.remove('on');
  document.querySelectorAll('#actions button.off').forEach(b => b.classList.remove('off'));
  document.getElementById('scene').classList.remove('on');
  setTimer(0);
}
function setTimer(frac) {
  document.querySelector('#timer i').style.width = (Math.max(0, Math.min(1, frac)) * 100) + '%';
}
