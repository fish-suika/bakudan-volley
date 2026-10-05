// ===== 入力：4 つの行動ボタン（スマホはタップ）と 1〜4 キー =====
function initInput(onAction) {
  for (const btn of document.querySelectorAll('#actions button')) {
    btn.addEventListener('pointerdown', e => { e.preventDefault(); onAction(btn.dataset.act); });
  }
  const keys = {
    Digit1: 'receive', Digit2: 'attack', Digit3: 'block', Digit4: 'serve',
    Numpad1: 'receive', Numpad2: 'attack', Numpad3: 'block', Numpad4: 'serve',
  };
  addEventListener('keydown', e => { if (keys[e.code]) onAction(keys[e.code]); });
}
