// 沈降分析（JIS A 1204 / JGS 0131）
// 実作業に合わせ、Cmは0.0005固定、水温・補正係数Fは試料ごとに1回だけ入力。
// 測定時刻・有効深さL・K・粒径d・P・P(d)は自動計算する。
const SED_TIMES_EXT = [1, 2, 5, 15, 30, 60, 240, 1440];
const SED_GN = 9.80665;
const SED_CM_FIXED = 0.0005;
const SED_VOLUME_FIXED = 1000;
// 画像で使用中の浮ひょうNo.1に合う校正式: L(mm) = A - B(r+Cm)
const SED_HYDROMETER_CAL = { '1': { A: 180.7, B: 2200 } };

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

function addMinutesToClock(clock, minutes) {
  if (!clock || !/^\d{1,2}:\d{2}$/.test(clock)) return '';
  const [h, m] = clock.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '';
  const total = (h * 60 + m + Number(minutes)) % (24 * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function injectSedimentationLabUI() {
  if (!sedimentationSectionEl) return;
  sedimentationSectionEl.innerHTML = `
    <div class="sed-lab-settings">
      <label>メスシリンダーNo.<input name="cylinderNo" autocomplete="off" placeholder="例：1" /></label>
      <label>浮ひょうNo.<input name="hydrometerNo" autocomplete="off" value="1" placeholder="例：1" /></label>
      <label>沈降分析用試料の乾燥質量 ms1 (g)
        <div class="voice-input"><input name="sedDryMass" inputmode="decimal" placeholder="例：73.4" /><button type="button" class="mic" data-voice="sedDryMass" data-form="grainForm">🎤</button></div>
      </label>
      <label>土粒子の密度 ρs (Mg/m³)<input name="particleDensity" inputmode="decimal" placeholder="例：2.637" /></label>
      <label>メニスカス補正値 Cm<input name="meniscusCorrectionDisplay" value="0.0005" readonly /></label>
      <label>測定時の水温 (℃)<input name="sedWaterTemp" inputmode="decimal" value="22" placeholder="例：22" /></label>
      <label>測定開始時刻<input name="sedStartTime" type="time" value="09:00" /></label>
      <label>補正係数 F<input name="sedCorrectionF" inputmode="decimal" value="0.0010" placeholder="例：0.0010" /></label>
      <label>使用した分散剤<input name="dispersant" autocomplete="off" value="ヘキサメタリン酸ナトリウム" /></label>
      <label>溶液添加量 (mL)<input name="solutionAddition" inputmode="decimal" value="10" /></label>
      <label>2 mm通過質量比 (%)<input id="twoMmPassRatio" name="twoMmPassRatio" inputmode="decimal" placeholder="ふるい分析から自動" /></label>
    </div>
    <div class="sed-info-grid">
      <div><span>水の密度 ρw</span><strong id="waterDensityPreview">—</strong><small>Mg/m³</small></div>
      <div><span>換算係数 M</span><strong id="mFactorPreview">—</strong></div>
      <div><span>水温</span><strong id="sedTempPreview">—</strong><small>℃・全測定共通</small></div>
      <div><span>Cm</span><strong>0.0005</strong><small>固定</small></div>
    </div>
    <p class="hint">水温・F・開始時刻は上で1回だけ入力。各測定では浮ひょうの読み r だけ入力すれば、測定時刻・r+Cm・有効深さL・K・粒径d・P・P(d)を自動計算します。</p>
    <div class="table-wrap">
      <table class="grain-table sed-table" style="min-width:1180px">
        <thead><tr>
          <th>測定時刻</th><th>t (min)</th><th>浮ひょう r</th><th>r＋Cm</th><th>水温 ℃</th><th>有効深さ L mm</th><th>K</th><th>粒径 d mm</th><th>F</th><th>P %</th><th>P(d) %</th>
        </tr></thead>
        <tbody id="sedRows"></tbody>
      </table>
    </div>
    <div id="sedCheck" class="mass-check">設定値と浮ひょうの読みを入力すると計算します。</div>
    <p class="hint">現在の有効深さLは浮ひょうNo.1の校正式 L = 180.7 − 2200(r+Cm) で自動計算。別の浮ひょうを使う場合は校正係数を追加できます。</p>
  `;

  if (!document.getElementById('sedLabStyle')) {
    const style = document.createElement('style');
    style.id = 'sedLabStyle';
    style.textContent = `
      .sed-lab-settings{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px;padding:14px;border:1px solid var(--line);border-radius:16px;background:#fbfdfc}
      .sed-lab-settings input[readonly]{background:#eef3f1;color:#43504d;font-weight:800}
      .sed-info-grid{grid-template-columns:repeat(4,1fr)}
      @media(max-width:800px){.sed-lab-settings{grid-template-columns:1fr 1fr}.sed-info-grid{grid-template-columns:1fr 1fr}}
      @media(max-width:560px){.sed-lab-settings{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }
}

function buildSedimentationRows() {
  const body = document.getElementById('sedRows');
  if (!body) return;
  body.innerHTML = SED_TIMES_EXT.map((t, i) => `
    <tr>
      <td class="calc" id="sed_clock_${i}">—</td>
      <th>${t}</th>
      <td><div class="table-voice-input"><input name="sed_r_${i}" inputmode="decimal" placeholder="0.0175"><button type="button" class="mic mini" data-voice="sed_r_${i}" data-form="grainForm">🎤</button></div></td>
      <td class="calc" id="sed_rc_${i}">—</td>
      <td class="calc" id="sed_temp_${i}">—</td>
      <td class="calc" id="sed_L_${i}">—</td>
      <td class="calc" id="sed_K_${i}">—</td>
      <td class="calc" id="sed_d_${i}">—</td>
      <td class="calc" id="sed_F_${i}">—</td>
      <td class="calc" id="sed_P_${i}">—</td>
      <td class="calc" id="sed_overall_${i}">—</td>
    </tr>
  `).join('');
}

function sedimentationSettingsExt() {
  const cylinderNo = grainForm.elements.cylinderNo?.value.trim() ?? '';
  const hydrometerNo = grainForm.elements.hydrometerNo?.value.trim() || '1';
  const ms1 = Number(grainForm.elements.sedDryMass?.value);
  const rhoS = Number(grainForm.elements.particleDensity?.value);
  const temp = Number(grainForm.elements.sedWaterTemp?.value);
  const correctionF = Number(grainForm.elements.sedCorrectionF?.value);
  const startTime = grainForm.elements.sedStartTime?.value || '';
  const ratio = Number(grainForm.elements.twoMmPassRatio?.value);
  const dispersant = grainForm.elements.dispersant?.value.trim() ?? '';
  const solutionAddition = Number(grainForm.elements.solutionAddition?.value);
  const rhoW = sedWaterDensity(temp);
  const cal = SED_HYDROMETER_CAL[hydrometerNo] || SED_HYDROMETER_CAL['1'];
  const valid = [ms1, rhoS, temp, correctionF, ratio, rhoW].every(Number.isFinite)
    && ms1 > 0 && rhoS > 1 && ratio >= 0 && ratio <= 100 && rhoS > rhoW;
  const M = valid ? (SED_VOLUME_FIXED / ms1) * (rhoS / (rhoS - rhoW)) * rhoW * 100 : null;
  return {
    valid, cylinderNo, hydrometerNo, ms1, rhoS, cm: SED_CM_FIXED,
    volume: SED_VOLUME_FIXED, temp, correctionF, startTime, ratio,
    dispersant, solutionAddition: Number.isFinite(solutionAddition) ? solutionAddition : null,
    rhoW, M, cal,
  };
}

function readSedimentationRowsExt(settings) {
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
    const P = settings.M * (r + settings.correctionF);
    const overall = settings.ratio * (P / 100);
    return {
      t, entered: true, valid: true, clock, r, correctedR,
      temp: settings.temp, L, K, d, F: settings.correctionF, P, overall,
    };
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
  const tempEl = document.getElementById('sedTempPreview');
  if (rhoEl) rhoEl.textContent = Number.isFinite(settings.rhoW) ? settings.rhoW.toFixed(5) : '—';
  if (mEl) mEl.textContent = Number.isFinite(settings.M) ? settings.M.toFixed(2) : '—';
  if (tempEl) tempEl.textContent = Number.isFinite(settings.temp) ? settings.temp.toFixed(1) : '—';

  const rows = readSedimentationRowsExt(settings);
  let invalid = false;
  let computed = 0;
  rows.forEach((row, i) => {
    const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    set(`sed_clock_${i}`, row.clock || '—');
    set(`sed_rc_${i}`, row.valid ? row.correctedR.toFixed(4) : '—');
    set(`sed_temp_${i}`, Number.isFinite(settings.temp) ? settings.temp.toFixed(1) : '—');
    set(`sed_L_${i}`, row.valid ? row.L.toFixed(1) : '—');
    set(`sed_K_${i}`, row.valid ? row.K.toFixed(4) : '—');
    set(`sed_d_${i}`, row.valid ? row.d.toFixed(4) : '—');
    set(`sed_F_${i}`, Number.isFinite(settings.correctionF) ? settings.correctionF.toFixed(4) : '—');
    set(`sed_P_${i}`, row.valid ? row.P.toFixed(1) : '—');
    set(`sed_overall_${i}`, row.valid ? row.overall.toFixed(1) : '—');
    if (row.entered && !row.valid) invalid = true;
    if (row.valid) computed++;
  });

  const check = document.getElementById('sedCheck');
  if (!check) return;
  check.classList.remove('error');
  if (!settings.valid) {
    check.textContent = '沈降分析用乾燥質量・土粒子密度・水温・F・2 mm通過率を確認してください。';
    check.classList.add('error');
  } else if (invalid) {
    check.textContent = '⚠ 浮ひょうの読みを確認してください。';
    check.classList.add('error');
  } else {
    check.textContent = `Cm 0.0005固定 ｜ 水温 ${settings.temp.toFixed(1)}℃ 共通 ｜ K ${rows.find(r => r.valid)?.K?.toFixed(4) || '—'} ｜ 計算済み ${computed}/8点`;
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
  return {
    enabled: true,
    valid: true,
    settings: {
      cylinderNo: settings.cylinderNo,
      hydrometerNo: settings.hydrometerNo,
      ms1: settings.ms1,
      rhoS: settings.rhoS,
      cm: settings.cm,
      volume: settings.volume,
      referenceTemp: settings.temp,
      waterTemp: settings.temp,
      correctionF: settings.correctionF,
      startTime: settings.startTime,
      twoMmPassRatio: settings.ratio,
      dispersant: settings.dispersant,
      solutionAddition: settings.solutionAddition,
      rhoW: settings.rhoW,
      M: settings.M,
      calibrationA: settings.cal.A,
      calibrationB: settings.cal.B,
    },
    rows: entered,
  };
}

function syncTwoMmPassingRatio() {
  const field = grainForm.elements.twoMmPassRatio;
  if (!field || document.activeElement === field) return;
  const result = calculateGrain();
  if (!result.valid) return;
  const row2 = result.sieves?.find(row => row.size === 2);
  if (row2?.passing != null) field.value = row2.passing.toFixed(2);
}

injectSedimentationLabUI();
buildSedimentationRows();

const baseResetGrainDialog = resetGrainDialog;
resetGrainDialog = function() {
  baseResetGrainDialog();
  if (grainForm.elements.hydrometerNo) grainForm.elements.hydrometerNo.value = '1';
  if (grainForm.elements.sedWaterTemp) grainForm.elements.sedWaterTemp.value = '22';
  if (grainForm.elements.sedStartTime) grainForm.elements.sedStartTime.value = '09:00';
  if (grainForm.elements.sedCorrectionF) grainForm.elements.sedCorrectionF.value = '0.0010';
  if (grainForm.elements.dispersant) grainForm.elements.dispersant.value = 'ヘキサメタリン酸ナトリウム';
  if (grainForm.elements.solutionAddition) grainForm.elements.solutionAddition.value = '10';
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
  const s = sed?.settings || {};
  if (grainForm.elements.cylinderNo) grainForm.elements.cylinderNo.value = s.cylinderNo ?? '';
  if (grainForm.elements.hydrometerNo) grainForm.elements.hydrometerNo.value = s.hydrometerNo ?? '1';
  if (grainForm.elements.sedDryMass) grainForm.elements.sedDryMass.value = s.ms1 ?? '';
  if (grainForm.elements.particleDensity) grainForm.elements.particleDensity.value = s.rhoS ?? '';
  if (grainForm.elements.sedWaterTemp) grainForm.elements.sedWaterTemp.value = s.waterTemp ?? s.referenceTemp ?? sed?.rows?.[0]?.temp ?? 22;
  if (grainForm.elements.sedStartTime) grainForm.elements.sedStartTime.value = s.startTime ?? '09:00';
  if (grainForm.elements.sedCorrectionF) grainForm.elements.sedCorrectionF.value = s.correctionF ?? sed?.rows?.[0]?.F ?? 0.0010;
  if (grainForm.elements.dispersant) grainForm.elements.dispersant.value = s.dispersant ?? 'ヘキサメタリン酸ナトリウム';
  if (grainForm.elements.solutionAddition) grainForm.elements.solutionAddition.value = s.solutionAddition ?? 10;
  if (grainForm.elements.twoMmPassRatio) grainForm.elements.twoMmPassRatio.value = s.twoMmPassRatio ?? '';

  (sed?.rows || []).forEach((row, i) => {
    if (i >= SED_TIMES_EXT.length) return;
    const el = grainForm.elements[`sed_r_${i}`];
    if (el) el.value = row.r ?? '';
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
    const cylinderNo = test.sedimentation?.settings?.cylinderNo;
    const hydrometerNo = test.sedimentation?.settings?.hydrometerNo;
    const parts = [];
    if (cylinderNo) parts.push(`メスシリンダー No.${escapeHtml(cylinderNo)}`);
    if (hydrometerNo) parts.push(`浮ひょう No.${escapeHtml(hydrometerNo)}`);
    parts.push('沈降分析 8点');
    html = html.replace('<span>ふるい分析</span>', `<span>${parts.join(' ｜ ')}</span>`);
  }
  return html;
};

grainForm.addEventListener('input', () => {
  syncTwoMmPassingRatio();
  updateSedimentationPreview();
});
grainForm.addEventListener('change', () => {
  syncTwoMmPassingRatio();
  updateSedimentationPreview();
});
useSedimentationEl?.addEventListener('change', updateSedimentationVisibility);

syncTwoMmPassingRatio();
updateSedimentationVisibility();
