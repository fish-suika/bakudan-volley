// ===== 画面の文字 =====
let __toastTimer = 0;
function showToast(text, sec) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.add('on');
  clearTimeout(__toastTimer);
  __toastTimer = setTimeout(() => el.classList.remove('on'), (sec || 1.6) * 1000);
}
