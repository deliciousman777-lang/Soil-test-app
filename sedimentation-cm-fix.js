// 沈降分析の通過率計算補正
// 元ソフトと同じく P = M × (r + Cm + F) とする。
(function () {
  if (typeof readSedimentationRowsExt !== 'function') return;

  readSedimentationRowsExt = function (settings) {
    const eta = sedWaterViscosity(settings.temp);
    const K = settings.valid && Number.isFinite(eta)
      ? Math.sqrt((30 * eta) / (SED_GN * (settings.rhoS - settings.rhoW)) * 1e-5)
      : null;

    return SED_TIMES_EXT.map((t, i) => {
      const raw = grainForm.elements[`sed_r_${i}`]?.value.trim() ?? '';
      const clock = addMinutesToClock(settings.startTime, t);
      if (raw === '') return { t, entered: false, valid: false, clock, r: null };

      const r = sedNormalizeHydrometerReading(raw);
      if (!settings.valid || !Number.isFinite(r) || !Number.isFinite(K)) {
        return { t, entered: true, valid: false, clock, r };
      }

      const correctedR = r + settings.cm;
      const L = settings.cal.A - settings.cal.B * correctedR;
      const valid = Number.isFinite(L) && L > 0;
      if (!valid) return { t, entered: true, valid: false, clock, r, correctedR, L };

      const d = K * Math.sqrt(L / t);
      // 重要: P は浮ひょう読み r に Cm と F の両方を加えて計算する。
      const P = settings.M * (correctedR + settings.correctionF);
      const overall = settings.ratio * (P / 100);

      return {
        t,
        entered: true,
        valid: true,
        clock,
        r,
        correctedR,
        temp: settings.temp,
        L,
        K,
        d,
        F: settings.correctionF,
        P,
        overall,
      };
    });
  };

  grainForm?.addEventListener('input', () => {
    if (typeof updateSedimentationPreview === 'function') updateSedimentationPreview();
  });
})();
