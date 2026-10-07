// 浮ひょう入力の簡略化
// 175 -> 0.0175、80 -> 0.0080 のように、旧ソフトと同じ4桁読みをそのまま入力できるようにする。
(function () {
  if (typeof sedNormalizeHydrometerReading !== 'function') return;

  sedNormalizeHydrometerReading = function (value) {
    const text = String(value ?? '').trim();
    if (!text) return null;
    const n = Number(text);
    if (!Number.isFinite(n)) return null;

    // 旧ソフト式の整数入力：175 = 0.0175、80 = 0.0080、45 = 0.0045
    if (!text.includes('.') && Math.abs(n) >= 1) return n / 10000;

    // 比重計を 1.0175 のように入力した場合
    if (n >= 0.9 && n < 1.2) return n - 1;

    // 0.0175 のような通常の小数入力
    return n;
  };

  // 入力欄の説明も旧ソフトに合わせる
  const relabel = () => {
    if (typeof grainForm === 'undefined' || !grainForm) return;
    SED_TIMES_EXT.forEach((_, i) => {
      const el = grainForm.elements[`sed_r_${i}`];
      if (el) el.placeholder = i === 0 ? '例：175' : '例：140';
    });
    const hint = document.getElementById('sedCheck');
    if (hint && !hint.dataset.inputHintAdded) {
      hint.dataset.inputHintAdded = '1';
    }
  };

  relabel();
  document.addEventListener('change', e => {
    if (e.target?.closest?.('#grainForm') && typeof updateSedimentationPreview === 'function') {
      updateSedimentationPreview();
    }
  });
})();