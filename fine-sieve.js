// 2 mm通過試料を別採取する粒度試験の補正
// 2 mm以上は全試料、0.85 mm以下は2 mm通過試料を基準に加積残留率を計算し、2 mm通過率を掛け戻す。
(function () {
  if (typeof grainForm === 'undefined' || !grainForm || typeof SIEVES === 'undefined') return;

  const FINE_LIMIT = 2;

  function finiteNumber(v) {
    return Number.isFinite(Number(v));
  }

  function injectFineSampleField() {
    if (grainForm.elements.fineDryMass) return;
    const topGrid = grainForm.querySelector('.grid2');
    if (!topGrid) return;
    const label = document.createElement('label');
    label.innerHTML = `2 mmふるい通過試料の炉乾燥質量 ms1 (g)
      <div class="voice-input">
        <input name="fineDryMass" inputmode="decimal" placeholder="例：120.00" />
        <button type="button" class="mic" data-voice="fineDryMass" data-form="grainForm" aria-label="音声入力">🎤</button>
      </div>`;
    topGrid.appendChild(label);

    const note = document.createElement('p');
    note.className = 'hint';
    note.id = 'fineSieveHint';
    note.textContent = '2 mm以上は全試料で計算し、0.85 mm以下はこの2 mm通過試料質量を基準に加積残留率を求め、2 mm通過率を掛けて全試料の通過率 P(d) に換算します。';
    topGrid.after(note);
  }

  function rebuildGrainRowsFine() {
    const body = document.getElementById('grainRows');
    if (!body) return;
    const table = body.closest('table');
    const head = table?.querySelector('thead tr');
    if (head) {
      head.innerHTML = '<th>ふるい径</th><th>残留質量 (g)</th><th>加積残留 (g)</th><th>加積残留率 (%)</th><th>試料内通過率 P (%)</th><th>全試料通過率 P(d) (%)</th>';
    }
    if (table) table.style.minWidth = '920px';

    body.innerHTML = SIEVES.map(size => {
      const key = fieldKey(size);
      const isBoundary = size === 2 || size === 0.075;
      const basis = size < FINE_LIMIT ? '2mm通過試料' : '全試料';
      return `
        <tr class="${isBoundary ? 'boundary-row' : ''}">
          <th>${size} mm<small>${isBoundary ? '区分境界・' : ''}${basis}</small></th>
          <td>
            <div class="table-voice-input">
              <input name="retained_${key}" inputmode="decimal" placeholder="0.00" aria-label="${size} mm 残留質量" />
              <button type="button" class="mic mini" data-voice="retained_${key}" data-form="grainForm" aria-label="音声入力">🎤</button>
            </div>
          </td>
          <td id="cum_${key}">—</td>
          <td id="retpct_${key}">—</td>
          <td id="localpass_${key}">—</td>
          <td id="pass_${key}">—</td>
        </tr>`;
    }).join('');
  }

  function calculateGrainFine() {
    const totalRaw = grainForm.elements.totalDryMass?.value.trim() ?? '';
    const total = Number(totalRaw);
    if (!totalRaw || !Number.isFinite(total) || total <= 0) return { valid: false, reason: 'total' };

    const fineRaw = grainForm.elements.fineDryMass?.value.trim() ?? '';
    const fineDryMass = Number(fineRaw);
    const fineMassReady = fineRaw !== '' && Number.isFinite(fineDryMass) && fineDryMass > 0;

    let coarseCumulative = 0;
    let fineCumulative = 0;
    let invalid = false;
    let hasFineInput = false;
    let pass2 = null;

    const sieves = SIEVES.map(size => {
      const key = fieldKey(size);
      const raw = grainForm.elements[`retained_${key}`]?.value.trim() ?? '';
      let retained = null;
      if (raw !== '') {
        retained = Number(raw);
        if (!Number.isFinite(retained) || retained < 0) invalid = true;
      }

      if (size >= FINE_LIMIT) {
        if (retained != null && Number.isFinite(retained)) coarseCumulative += retained;
        const cumulative = retained == null ? null : coarseCumulative;
        const retainedRate = cumulative == null ? null : (cumulative / total) * 100;
        const localPassing = retainedRate == null ? null : 100 - retainedRate;
        const passing = localPassing;
        if (size === 2 && passing != null) pass2 = passing;
        return { size, retained, basis: 'total', cumulative, retainedRate, localPassing, passing };
      }

      if (retained != null) hasFineInput = true;
      if (retained != null && Number.isFinite(retained)) fineCumulative += retained;
      const cumulative = retained == null ? null : fineCumulative;
      const retainedRate = cumulative == null || !fineMassReady ? null : (cumulative / fineDryMass) * 100;
      const localPassing = retainedRate == null ? null : 100 - retainedRate;
      const passing = localPassing == null || pass2 == null ? null : pass2 * (localPassing / 100);
      return { size, retained, basis: 'fine', cumulative, retainedRate, localPassing, passing };
    });

    if (invalid) return { valid: false, reason: 'value' };
    if (coarseCumulative > total + 1e-6) {
      return { valid: false, reason: 'overCoarse', total, coarseRetainedTotal: coarseCumulative, sieves };
    }
    if (hasFineInput && !fineMassReady) {
      return { valid: false, reason: 'fineMass', total, coarseRetainedTotal: coarseCumulative, sieves };
    }
    if (fineMassReady && fineCumulative > fineDryMass + 1e-6) {
      return { valid: false, reason: 'overFine', total, fineDryMass, fineRetainedTotal: fineCumulative, sieves };
    }

    const row2 = sieves.find(row => row.size === 2);
    const row075 = sieves.find(row => row.size === 0.075);
    const boundariesReady = row2?.retained != null && row075?.retained != null && fineMassReady && finiteNumber(row075.passing);
    let fractions = null;
    if (boundariesReady) {
      const p2 = Number(row2.passing);
      const p075 = Number(row075.passing);
      fractions = { gravel: 100 - p2, sand: p2 - p075, fines: p075 };
    }

    return {
      valid: true,
      total,
      fineDryMass: fineMassReady ? fineDryMass : null,
      coarseRetainedTotal: coarseCumulative,
      fineRetainedTotal: fineCumulative,
      remainder: fineMassReady ? Math.max(0, fineDryMass - fineCumulative) : null,
      pass2,
      sieves,
      fractions,
      boundariesReady,
      fineMassReady,
      hasFineInput,
    };
  }

  function updateGrainPreviewFine() {
    const result = calculateGrainFine();
    const massCheck = document.getElementById('grainMassCheck');
    massCheck?.classList.remove('error');

    SIEVES.forEach(size => {
      const key = fieldKey(size);
      ['cum_', 'retpct_', 'localpass_', 'pass_'].forEach(prefix => {
        const el = document.getElementById(`${prefix}${key}`);
        if (el) el.textContent = '—';
      });
    });
    const gravelEl = document.getElementById('gravelPct');
    const sandEl = document.getElementById('sandPct');
    const finesEl = document.getElementById('finesPct');
    if (gravelEl) gravelEl.textContent = '— %';
    if (sandEl) sandEl.textContent = '— %';
    if (finesEl) finesEl.textContent = '— %';

    if (!result.valid) {
      if (massCheck) {
        massCheck.classList.add('error');
        if (result.reason === 'fineMass') massCheck.textContent = '⚠ 0.85 mm以下を入力する場合は「2 mmふるい通過試料の炉乾燥質量 ms1」を入力してください。';
        else if (result.reason === 'overFine') massCheck.textContent = `⚠ 0.85 mm以下の残留質量合計 ${format(result.fineRetainedTotal)} g が、2 mm通過試料 ${format(result.fineDryMass)} g を超えています。`;
        else if (result.reason === 'overCoarse') massCheck.textContent = `⚠ 2 mm以上の残留質量合計 ${format(result.coarseRetainedTotal)} g が、全試料 ${format(result.total)} g を超えています。`;
        else massCheck.textContent = '入力値を確認してください。';
      }
      return;
    }

    result.sieves.forEach(row => {
      if (row.retained == null) return;
      const key = fieldKey(row.size);
      const cum = document.getElementById(`cum_${key}`);
      const retPct = document.getElementById(`retpct_${key}`);
      const localPass = document.getElementById(`localpass_${key}`);
      const pass = document.getElementById(`pass_${key}`);
      if (cum) cum.textContent = format(row.cumulative);
      if (retPct && finiteNumber(row.retainedRate)) retPct.textContent = Number(row.retainedRate).toFixed(1);
      if (localPass && finiteNumber(row.localPassing)) localPass.textContent = Number(row.localPassing).toFixed(1);
      if (pass && finiteNumber(row.passing)) pass.textContent = Number(row.passing).toFixed(1);
    });

    if (massCheck) {
      const p2 = finiteNumber(result.pass2) ? `${Number(result.pass2).toFixed(1)} %` : '—';
      const fineText = result.fineMassReady
        ? `2 mm通過試料 ${format(result.fineDryMass)} g ｜ 細粒側残留合計 ${format(result.fineRetainedTotal)} g`
        : '2 mm通過試料質量 未入力';
      massCheck.textContent = `2 mm通過率 ${p2} ｜ ${fineText}`;
    }

    if (result.fractions) {
      if (gravelEl) gravelEl.textContent = `${result.fractions.gravel.toFixed(1)} %`;
      if (sandEl) sandEl.textContent = `${result.fractions.sand.toFixed(1)} %`;
      if (finesEl) finesEl.textContent = `${result.fractions.fines.toFixed(1)} %`;
    }
  }

  calculateGrain = calculateGrainFine;
  updateGrainPreview = updateGrainPreviewFine;

  injectFineSampleField();
  rebuildGrainRowsFine();

  const previousReset = resetGrainDialog;
  resetGrainDialog = function () {
    previousReset();
    if (grainForm.elements.fineDryMass) grainForm.elements.fineDryMass.value = '';
    updateGrainPreviewFine();
  };

  const previousEdit = openEditGrain;
  openEditGrain = function (testId) {
    previousEdit(testId);
    const test = currentProject()?.tests.find(t => t.id === testId && t.type === 'grain');
    if (!test) return;
    if (grainForm.elements.fineDryMass) grainForm.elements.fineDryMass.value = test.fineDryMass ?? '';
    updateGrainPreviewFine();
    if (typeof syncTwoMmPassingRatio === 'function') syncTwoMmPassingRatio();
    if (typeof updateSedimentationPreview === 'function') updateSedimentationPreview();
  };

  function savedFinePoints(test) {
    if (!test || !finiteNumber(test.totalDryMass) || Number(test.totalDryMass) <= 0) return [];
    const total = Number(test.totalDryMass);
    const fineMass = Number(test.fineDryMass);
    const bySize = new Map((test.sieves || []).map(r => [Number(r.size), r.retained]));
    let coarseCum = 0, fineCum = 0, p2 = null;
    const points = [];
    SIEVES.forEach(size => {
      const retained = bySize.get(Number(size));
      if (retained == null || !finiteNumber(retained)) return;
      if (size >= 2) {
        coarseCum += Number(retained);
        const p = 100 - coarseCum / total * 100;
        if (size === 2) p2 = p;
        points.push({ d: size, p });
      } else if (finiteNumber(fineMass) && fineMass > 0 && finiteNumber(p2)) {
        fineCum += Number(retained);
        const localP = 100 - fineCum / fineMass * 100;
        points.push({ d: size, p: p2 * localP / 100 });
      }
    });
    if (test.sedimentation?.enabled) {
      (test.sedimentation.rows || []).forEach(row => {
        if (finiteNumber(row.d) && Number(row.d) > 0 && finiteNumber(row.overall)) points.push({ d: Number(row.d), p: Number(row.overall) });
      });
    }
    return points.sort((a,b) => a.d - b.d);
  }

  function dAt(points, target) {
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      if (!finiteNumber(a.p) || !finiteNumber(b.p) || a.p === b.p) continue;
      if (target < Math.min(a.p,b.p) || target > Math.max(a.p,b.p)) continue;
      const q = (target - a.p) / (b.p - a.p);
      return Math.pow(10, Math.log10(a.d) + q * (Math.log10(b.d) - Math.log10(a.d)));
    }
    return null;
  }

  function fmtDLocal(v) {
    if (!finiteNumber(v) || Number(v) <= 0) return '—';
    const n = Number(v);
    return n >= 1 ? n.toFixed(3) : n.toPrecision(3);
  }

  const previousRenderCard = renderGrainCard;
  renderGrainCard = function (test) {
    let html = previousRenderCard(test);
    html = html.replace(/<div class="grain-card-metrics">[\s\S]*?<\/div>/g, '');
    const points = savedFinePoints(test);
    const d10 = dAt(points,10), d30 = dAt(points,30), d50 = dAt(points,50), d60 = dAt(points,60);
    const uc = d10 && d60 ? d60/d10 : null;
    const ucp = d10 && d30 && d60 ? d30*d30/(d10*d60) : null;
    const bits = [];
    if (finiteNumber(d50)) bits.push(`<span>D50 <strong>${fmtDLocal(d50)} mm</strong></span>`);
    if (finiteNumber(uc)) bits.push(`<span>Uc <strong>${Number(uc).toFixed(2)}</strong></span>`);
    if (finiteNumber(ucp)) bits.push(`<span>Uc' <strong>${Number(ucp).toFixed(2)}</strong></span>`);
    if (test.fineDryMass != null) bits.unshift(`<span>2mm通過試料 <strong>${format(test.fineDryMass)} g</strong></span>`);
    return bits.length ? html + `<div class="grain-card-metrics">${bits.join('')}</div>` : html;
  };

  document.addEventListener('submit', event => {
    if (event.target !== grainForm) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const result = calculateGrainFine();
    if (!result.valid) {
      if (result.reason === 'fineMass') alert('0.85 mm以下を入力する場合は、2 mmふるい通過試料の炉乾燥質量 ms1 を入力してください。');
      else if (result.reason === 'overFine') alert('0.85 mm以下の残留質量合計が、2 mm通過試料質量を超えています。');
      else if (result.reason === 'overCoarse') alert('2 mm以上の残留質量合計が、全試料質量を超えています。');
      else alert('粒度試験の入力値を確認してください。');
      return;
    }
    if (!result.boundariesReady) {
      alert('礫分・砂分・細粒分を計算するため、2 mm・0.075 mmの残留質量と、2 mmふるい通過試料の炉乾燥質量 ms1 を入力してください。');
      return;
    }

    const sed = typeof getSedimentationPayloadExt === 'function' ? getSedimentationPayloadExt() : { enabled: false };
    if (sed.enabled && !sed.valid) {
      const message = sed.reason === 'rows'
        ? '沈降分析は8測定点すべてで r・水温・L・F を入力してください。'
        : sed.reason === 'range'
          ? '沈降分析の計算結果が範囲外です。r・F・2 mm通過比を確認してください。'
          : '沈降分析の設定値を確認してください。';
      alert(message);
      return;
    }

    const p = currentProject();
    if (!p) return;
    const sample = grainForm.elements.sample.value.trim();
    if (!sample) return;
    const now = new Date().toISOString();
    const payload = {
      sample,
      totalDryMass: result.total,
      fineDryMass: result.fineDryMass,
      sieves: result.sieves.map(row => ({ size: row.size, retained: row.retained })),
      remainder: result.remainder,
      fractions: result.fractions,
      sedimentation: sed,
    };

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

  grainForm.addEventListener('input', () => {
    updateGrainPreviewFine();
    if (typeof syncTwoMmPassingRatio === 'function') syncTwoMmPassingRatio();
  });
  grainForm.addEventListener('change', updateGrainPreviewFine);

  updateGrainPreviewFine();
  if (typeof syncTwoMmPassingRatio === 'function') syncTwoMmPassingRatio();
})();