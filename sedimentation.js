// 沈降分析（JIS A 1204 / JGS 0131）拡張
// 既存の粒度試験に追加する。L・Fは浮ひょう等の校正条件に依存するため入力値とする。
const SED_TIMES_EXT = [1, 2, 5, 15, 30, 60, 240, 1440];
const SED_GN = 9.80665;
const useSedimentationEl = document.getElementById('useSedimentation');
const sedimentationSectionEl = document.getElementById('sedimentationSection');

function sedWaterDensity(temp) {
  const T = Number(temp);
  if (!Number.isFinite(T) || T < 0 || T > 50) return null;
  const kgm3 = 1000 * (1 - ((T + 288.9414) / (508929.2 * (T + 68.12963))) * Math.pow(T - 3.9863, 2));
  return kgm3 / 1000;
}

function sedWaterViscosity(temp) {
  const T = Number(temp);
  if (!Number.isFinite(T) || T < 0 || T > 50) return null;
  return 2.414e-2 * Math.pow(10, 247.8 / (T + 133.15));
}

function sedNormalizeHydrometerReading(value) {
  const r = Number(value);
  if (!Number.isFinite(r)) return null;
  return (r >= 0.9 && r < 1.2) ? r - 1 : r;
}

function buildSedimentationRows() {
  const body = document.getElementById('sedRows');
  if (!body) return;
  body.innerHTML = SED_TIMES_EXT.map((t, i) => `
    <tr>
      <th>${t}</th>
      <td><input class="measure-time" name="sed_clock_${i}" inputmode="text" placeholder="9:30"></td>
      <td><div class="table-voice-input"><input name="sed_r_${i}" inputmode="decimal" placeholder="0.0160"><button type="button" class="mic mini" data-voice="sed_r_${i}" data-form="grainForm">🎤</button></div></td>
      <td class="calc" id="sed_rc_${i}">—</td>
      <td><input name="sed_temp_${i}" inputmode="decimal" placeholder="20.0"></td>
      <td><input name="sed_L_${i}" inputmode="decimal" placeholder="145.0"></td>
      <td class="calc" id="sed_K_${i}">—</td>
      <td class="calc" id="sed_d_${i}">—</td>
      <td><input name="sed_F_${i}" inputmode="decimal" placeholder="+0.0005"></td>
      <td class="calc" id="sed_P_${i}">—</td>
      <td class="calc" id="sed_overall_${i}">—</td>
    </tr>
  `).join('');
}

function sedimentationSettingsExt() {
  const ms1 = Number(grainForm.elements.sedDryMass?.value);
  const rhoS = Number(grainForm.elements.particleDensity?.value);
  const cm = Number(grainForm.elements.meniscusCorrection?.value);
  const volume = Number(grainForm.elements.suspensionVolume?.value);
  const refTemp = Number(grainForm.elements.referenceTemp?.value);
  const ratio = Number(grainForm.elements.twoMmPassRatio?.value);
  const rhoW = sedWaterDensity(refTemp);
  const valid = [ms1, rhoS, cm, volume, refTemp, ratio].every(Number.isFinite) && ms1 > 0 && rhoS > 1 && volume > 0 && ratio >= 0 && ratio <= 100 && Number.isFinite(rhoW) && rhoS > rhoW;
  const M = valid ? (volume / ms1) * (rhoS / (rhoS - rhoW)) * rhoW * 100 : null;
  return { valid, ms1, rhoS, cm, volume, refTemp, ratio, rhoW, M };
}

function readSedimentationRowsExt(settings) {
  return SED_TIMES_EXT.map((t, i) => {
    const rRaw = grainForm.elements[`sed_r_${i}`]?.value.trim() ?? '';
    const tempRaw = grainForm.elements[`sed_temp_${i}`]?.value.trim() ?? '';
    const lRaw = grainForm.elements[`sed_L_${i}`]?.value.trim() ?? '';
    const fRaw = grainForm.elements[`sed_F_${i}`]?.value.trim() ?? '';
    const clock = grainForm.elements[`sed_clock_${i}`]?.value.trim() ?? '';
    const entered = [rRaw, tempRaw, lRaw, fRaw].some(v => v !== '');
    if (!entered) return { t, entered: false, clock, r: null, temp: null, L: null, F: null };
    const r = sedNormalizeHydrometerReading(rRaw);
    const temp = Number(tempRaw);
    const L = Number(lRaw);
    const F = Number(fRaw);
    const rhoW = sedWaterDensity(temp);
    const eta = sedWaterViscosity(temp);
    const valid = settings.valid && [r, temp, L, F, rhoW, eta].every(Number.isFinite) && L > 0 && settings.rhoS > rhoW;
    if (!valid) return { t, entered: true, valid: false, clock, r, temp, L, F };
    const correctedR = r + settings.cm;
    const K = Math.sqrt((30 * eta) / (SED_GN * (settings.rhoS - rhoW)) * 1e-5);
    const d = K * Math.sqrt(L / t);
    const P = settings.M * (r + F);
    const overall = settings.ratio * (P / 100);
    return { t, entered: true, valid: true, clock, r, temp, L, F, correctedR, rhoW, eta, K, d, P, overall };
  });
}

function updateSedimentationVisibility() {
  if (!useSedimentationEl || !sedimentationSectionEl) return;
  sedimentationSectionEl.classList.toggle('hidden', !useSedimentationEl.checked);
  updateSedimentationPreview();
}

function updateSedimentationPreview() {
  if (!useSedimentationEl?.checked) return;
  const settings = sedimentationSettingsExt();
  const rhoEl = document.getElementById('waterDensityPreview');
  const mEl = document.getElementById('mFactorPreview');
  if (rhoEl) rhoEl.textContent = Number.isFinite(settings.rhoW) ? settings.rhoW.toFixed(5) : '—';
  if (mEl) mEl.textContent = Number.isFinite(settings.M) ? settings.M.toFixed(2) : '—';
  const rows = readSedimentationRowsExt(settings);
  let invalid = false;
  let computed = 0;
  rows.forEach((row, i) => {
    document.getElementById(`sed_rc_${i}`).textContent = row.valid ? row.correctedR.toFixed(4) : '—';
    document.getElementById(`sed_K_${i}`).textContent = row.valid ? row.K.toFixed(5) : '—';
    document.getElementById(`sed_d_${i}`).textContent = row.valid ? row.d.toPrecision(3) : '—';
    document.getElementById(`sed_P_${i}`).textContent = row.valid ? row.P.toFixed(1) : '—';
    document.getElementById(`sed_overall_${i}`).textContent = row.valid ? row.overall.toFixed(1) : '—';
    if (row.entered && !row.valid) invalid = true;
    if (row.valid) computed++;
  });
  const check = document.getElementById('sedCheck');
  if (!check) return;
  check.classList.remove('error');
  if (!settings.valid) {
    check.textContent = '沈降分析用乾燥質量・ρs・Cm・V・基準水温・2 mm通過比を確認してください。';
    check.classList.add('error');
  } else if (invalid) {
    check.textContent = '⚠ 入力途中または不正な測定行があります。r・水温・L・Fを確認してください。';
    check.classList.add('error');
  } else {
    check.textContent = `換算係数 M ${settings.M.toFixed(2)} ｜ 計算済み ${computed}/8 点`;
  }
}

function getSedimentationPayloadExt() {
  if (!useSedimentationEl?.checked) return { enabled: false };
  const settings = sedimentationSettingsExt();
  const rows = readSedimentationRowsExt(settings);
  if (!settings.valid) return { enabled: true, valid: false, reason: 'settings' };
  const entered = rows.filter(r => r.entered);
  if (entered.length !== 8 || entered.some(r => !r.valid)) return { enabled: true, valid: false, reason: 'rows' };
  const outOfRange = entered.some(r => r.P < 0 || r.P > 105 || r.overall < 0 || r.overall > 105);
  if (outOfRange) return { enabled: true, valid: false, reason: 'range' };
  return { enabled: true, valid: true, settings: { ms1: settings.ms1, rhoS: settings.rhoS, cm: settings.cm, volume: settings.volume, referenceTemp: settings.refTemp, twoMmPassRatio: settings.ratio, rhoW: settings.rhoW, M: settings.M }, rows: entered };
}

function syncTwoMmPassingRatio() {
  const field = grainForm.elements.twoMmPassRatio;
  if (!field || document.activeElement === field) return;
  const result = calculateGrain();
  if (!result.valid) return;
  const row2 = result.sieves?.find(row => row.size === 2);
  if (row2?.passing != null) field.value = row2.passing.toFixed(2);
}

const baseResetGrainDialog = resetGrainDialog;
resetGrainDialog = function() {
  baseResetGrainDialog();
  if (grainForm.elements.suspensionVolume) grainForm.elements.suspensionVolume.value = '1000';
  if (grainForm.elements.referenceTemp) grainForm.elements.referenceTemp.value = '20';
  if (useSedimentationEl) useSedimentationEl.checked = false;
  sedimentationSectionEl?.classList.add('hidden');
  updateSedimentationPreview();
};

const baseOpenEditGrain = openEditGrain;
openEditGrain = function(testId) {
  baseOpenEditGrain(testId);
  const p = currentProject();
  const test = p?.tests.find(t => t.id === testId && t.type === 'grain');
  if (!test) return;
  const sed = test.sedimentation;
  if (useSedimentationEl) useSedimentationEl.checked = Boolean(sed?.enabled);
  if (sed?.settings) {
    grainForm.elements.sedDryMass.value = sed.settings.ms1 ?? '';
    grainForm.elements.particleDensity.value = sed.settings.rhoS ?? '';
    grainForm.elements.meniscusCorrection.value = sed.settings.cm ?? '';
    grainForm.elements.suspensionVolume.value = sed.settings.volume ?? 1000;
    grainForm.elements.referenceTemp.value = sed.settings.referenceTemp ?? 20;
    grainForm.elements.twoMmPassRatio.value = sed.settings.twoMmPassRatio ?? '';
  } else {
    grainForm.elements.suspensionVolume.value = '1000';
    grainForm.elements.referenceTemp.value = '20';
  }
  (sed?.rows || []).forEach((row, i) => {
    if (i >= SED_TIMES_EXT.length) return;
    grainForm.elements[`sed_clock_${i}`].value = row.clock || '';
    grainForm.elements[`sed_r_${i}`].value = row.r ?? '';
    grainForm.elements[`sed_temp_${i}`].value = row.temp ?? '';
    grainForm.elements[`sed_L_${i}`].value = row.L ?? '';
    grainForm.elements[`sed_F_${i}`].value = row.F ?? '';
  });
  updateSedimentationVisibility();
  syncTwoMmPassingRatio();
  updateSedimentationPreview();
};

const baseRenderGrainCard = renderGrainCard;
renderGrainCard = function(test) {
  let html = baseRenderGrainCard(test);
  if (test.sedimentation?.enabled) {
    html = html.replace('粒度試験・ふるい分析', '粒度試験・沈降分析あり');
    html = html.replace('<span>ふるい分析</span>', '<span>沈降分析 8点</span>');
  }
  return html;
};

grainForm.addEventListener('input', () => {
  syncTwoMmPassingRatio();
  updateSedimentationPreview();
});
useSedimentationEl?.addEventListener('change', updateSedimentationVisibility);

grainForm.addEventListener('submit', event => {
  event.preventDefault();
  event.stopImmediatePropagation();
  const result = calculateGrain();
  if (!result.valid) {
    alert(result.reason === 'over' ? '残留質量の合計が乾燥試料質量を超えています。入力値を確認してください。' : '乾燥試料質量と残留質量の値を確認してください。');
    return;
  }
  if (!result.boundariesReady) {
    alert('礫分・砂分・細粒分を計算するため、2 mm と 0.075 mm の残留質量は必ず入力してください。残留なしの場合は 0 を入力してください。');
    return;
  }
  const sed = getSedimentationPayloadExt();
  if (sed.enabled && !sed.valid) {
    const message = sed.reason === 'rows' ? '沈降分析は8測定点すべてで r・水温・L・F を入力してください。' : sed.reason === 'range' ? '沈降分析の計算結果が範囲外です。r・F・2 mm通過比を確認してください。' : '沈降分析の設定値を確認してください。';
    alert(message);
    return;
  }
  const p = currentProject();
  if (!p) return;
  const sample = grainForm.elements.sample.value.trim();
  if (!sample) return;
  const now = new Date().toISOString();
  const payload = { sample, totalDryMass: result.total, sieves: result.sieves.map(row => ({ size: row.size, retained: row.retained })), remainder: result.remainder, fractions: result.fractions, sedimentation: sed };
  if (state.editingTestId) {
    const test = p.tests.find(t => t.id === state.editingTestId && t.type === 'grain');
    if (!test) return;
    Object.assign(test, payload, { updatedAt: now });
  } else {
    p.tests.push({ id: uid(), type: 'grain', ...payload, createdAt: now });
  }
  p.updatedAt = now;
  saveData();
  resetGrainDialog();
  grainDialog.close();
  renderTests();
}, true);

buildSedimentationRows();
syncTwoMmPassingRatio();
updateSedimentationVisibility();
