// 土粒子の密度試験 JIS A 1202:2020 / JGS 0111-2020
(function () {
  const TYPE = 'particleDensity';
  const COUNT = 3;

  function rhoWater(temp) {
    const T = Number(temp);
    if (!Number.isFinite(T) || T < 0 || T > 50) return null;
    const kgm3 = 1000 * (1 - ((T + 288.9414) / (508929.2 * (T + 68.12963))) * Math.pow(T - 3.9863, 2));
    return kgm3 / 1000; // Mg/m3
  }

  function n(v) {
    const x = Number(v);
    return Number.isFinite(x) ? x : null;
  }

  function injectUI() {
    const actions = document.querySelector('#detailView .test-actions');
    if (actions && !document.getElementById('addParticleDensityBtn')) {
      const btn = document.createElement('button');
      btn.id = 'addParticleDensityBtn';
      btn.type = 'button';
      btn.className = 'primary secondary';
      btn.textContent = '＋ 土粒子密度';
      actions.appendChild(btn);
      btn.addEventListener('click', openNew);
    }

    if (document.getElementById('particleDensityDialog')) return;
    const dialog = document.createElement('dialog');
    dialog.id = 'particleDensityDialog';
    dialog.className = 'wide-dialog';
    dialog.innerHTML = `
      <form id="particleDensityForm" method="dialog">
        <div class="dialog-head">
          <div><p class="eyebrow">JIS A 1202 / JGS 0111</p><h2 id="particleDensityTitle">土粒子の密度試験</h2></div>
          <button type="button" class="icon-btn" id="particleDensityClose">×</button>
        </div>
        <label>試料名 / No.<input name="sample" required autocomplete="off" placeholder="例：No.1" /></label>
        <p class="hint">3測定を入力すると、温度補正した mₐ(T₁)、試料乾燥質量 mₛ、土粒子の密度 ρₛ と平均値を自動計算します。</p>
        <div id="particleDensityRows" class="pd-list"></div>
        <div id="particleDensityAverage" class="result-box">平均土粒子密度：— Mg/m³</div>
        <div id="particleDensityCheck" class="mass-check">3測定の値を入力してください。</div>
        <div class="dialog-actions"><button type="button" class="ghost" id="particleDensityCancel">キャンセル</button><button id="particleDensitySubmit" class="primary" value="default">保存</button></div>
      </form>`;
    document.body.appendChild(dialog);

    const rows = dialog.querySelector('#particleDensityRows');
    rows.innerHTML = Array.from({length: COUNT}, (_, j) => {
      const i = j + 1;
      return `
        <section class="specimen-card pd-card">
          <div class="specimen-head"><strong>測定 ${i}</strong><span id="pdRho_${i}">ρₛ —</span></div>
          <div class="pd-grid">
            <label>ピクノメーター No.<input name="pycNo_${i}" autocomplete="off" placeholder="例：P-1"></label>
            <label>ピクノメーター質量 m<sub>f</sub> (g)<input name="mf_${i}" inputmode="decimal" placeholder="0.000"></label>
            <label>蒸留水＋ピクノメーター m<sub>a</sub>(T₂) (g)<input name="ma2_${i}" inputmode="decimal" placeholder="0.000"></label>
            <label>T₂ (℃)<input name="t2_${i}" inputmode="decimal" placeholder="例：20.0"></label>
            <label>ρ<sub>w</sub>(T₂) <span id="pdRhoW2_${i}" class="pd-inline-result">—</span></label>
            <label>試料＋蒸留水＋ピクノメーター m<sub>b</sub>(T₁) (g)<input name="mb1_${i}" inputmode="decimal" placeholder="0.000"></label>
            <label>T₁ (℃)<input name="t1_${i}" inputmode="decimal" placeholder="例：20.0"></label>
            <label>ρ<sub>w</sub>(T₁) <span id="pdRhoW1_${i}" class="pd-inline-result">—</span></label>
            <label>補正 m<sub>a</sub>(T₁) <span id="pdMa1_${i}" class="pd-inline-result">— g</span></label>
            <label>容器 No.<input name="containerNo_${i}" autocomplete="off" placeholder="例：A-1"></label>
            <label>炉乾燥試料＋容器 (g)<input name="dryWithContainer_${i}" inputmode="decimal" placeholder="0.000"></label>
            <label>容器質量 (g)<input name="containerMass_${i}" inputmode="decimal" placeholder="0.000"></label>
            <label>試料乾燥質量 m<sub>s</sub> <span id="pdMs_${i}" class="pd-inline-result">— g</span></label>
          </div>
        </section>`;
    }).join('');

    if (!document.getElementById('particleDensityStyles')) {
      const style = document.createElement('style');
      style.id = 'particleDensityStyles';
      style.textContent = `
        .pd-list{display:grid;gap:14px;margin-top:14px}.pd-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:10px}
        .pd-inline-result{display:flex;align-items:center;min-height:45px;padding:10px 12px;margin-top:6px;border:1px solid var(--line);border-radius:10px;background:#f3f8f6;color:var(--accent-dark);font-weight:800}
        .pd-card .specimen-head span{font-weight:800;color:var(--accent-dark)}
        @media(max-width:800px){.pd-grid{grid-template-columns:1fr 1fr}}@media(max-width:560px){.pd-grid{grid-template-columns:1fr}}
      `;
      document.head.appendChild(style);
    }

    const form = dialog.querySelector('#particleDensityForm');
    form.addEventListener('input', updatePreview);
    form.addEventListener('submit', saveParticleDensity);
    dialog.querySelector('#particleDensityClose').addEventListener('click', () => dialog.close());
    dialog.querySelector('#particleDensityCancel').addEventListener('click', () => dialog.close());
  }

  function formEl() { return document.getElementById('particleDensityForm'); }
  function dialogEl() { return document.getElementById('particleDensityDialog'); }

  function calcOne(i) {
    const f = formEl();
    const mf = n(f.elements[`mf_${i}`].value);
    const ma2 = n(f.elements[`ma2_${i}`].value);
    const t2 = n(f.elements[`t2_${i}`].value);
    const mb1 = n(f.elements[`mb1_${i}`].value);
    const t1 = n(f.elements[`t1_${i}`].value);
    const dryWithContainer = n(f.elements[`dryWithContainer_${i}`].value);
    const containerMass = n(f.elements[`containerMass_${i}`].value);
    const entered = [mf, ma2, t2, mb1, t1, dryWithContainer, containerMass].some(v => v !== null);
    if (!entered) return { entered: false, valid: false };
    if ([mf,ma2,t2,mb1,t1,dryWithContainer,containerMass].some(v => v === null)) return { entered: true, valid: false };

    const rw1 = rhoWater(t1);
    const rw2 = rhoWater(t2);
    const ms = dryWithContainer - containerMass;
    if (!rw1 || !rw2 || ma2 <= mf || ms <= 0) return { entered: true, valid: false };

    const ma1 = (rw1 / rw2) * (ma2 - mf) + mf;
    const denom = ms + ma1 - mb1;
    if (!Number.isFinite(denom) || denom <= 0) return { entered: true, valid: false, rw1, rw2, ma1, ms };
    const rhoS = (ms / denom) * rw1;
    if (!Number.isFinite(rhoS) || rhoS <= 0 || rhoS > 5) return { entered: true, valid: false, rw1, rw2, ma1, ms };

    return {
      entered: true, valid: true,
      pycnometerNo: f.elements[`pycNo_${i}`].value.trim(),
      mf, ma2, t2, rhoW2: rw2, mb1, t1, rhoW1: rw1, ma1,
      containerNo: f.elements[`containerNo_${i}`].value.trim(),
      dryWithContainer, containerMass, ms, rhoS,
    };
  }

  function updatePreview() {
    const results = [];
    for (let i = 1; i <= COUNT; i++) {
      const r = calcOne(i);
      const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
      set(`pdRhoW2_${i}`, r.rhoW2 ? `${r.rhoW2.toFixed(5)} Mg/m³` : '—');
      set(`pdRhoW1_${i}`, r.rhoW1 ? `${r.rhoW1.toFixed(5)} Mg/m³` : '—');
      set(`pdMa1_${i}`, Number.isFinite(r.ma1) ? `${r.ma1.toFixed(3)} g` : '— g');
      set(`pdMs_${i}`, Number.isFinite(r.ms) ? `${r.ms.toFixed(3)} g` : '— g');
      set(`pdRho_${i}`, r.valid ? `ρₛ ${r.rhoS.toFixed(3)} Mg/m³` : 'ρₛ —');
      if (r.valid) results.push(r);
    }

    const avgEl = document.getElementById('particleDensityAverage');
    const check = document.getElementById('particleDensityCheck');
    if (results.length === COUNT) {
      const avg = results.reduce((s, r) => s + r.rhoS, 0) / COUNT;
      avgEl.textContent = `平均土粒子密度：${avg.toFixed(3)} Mg/m³`;
      check.classList.remove('error');
      check.textContent = `3測定計算済み ｜ 平均 ρₛ = ${avg.toFixed(3)} Mg/m³`;
    } else {
      avgEl.textContent = '平均土粒子密度：— Mg/m³';
      const invalidEntered = Array.from({length:COUNT}, (_,j) => calcOne(j+1)).some(r => r.entered && !r.valid);
      check.classList.toggle('error', invalidEntered);
      check.textContent = invalidEntered ? '⚠ 入力値または質量関係を確認してください。' : `計算済み ${results.length}/3 測定`;
    }
  }

  function resetForm() {
    state.editingTestId = null;
    const f = formEl();
    f.reset();
    document.getElementById('particleDensityTitle').textContent = '土粒子の密度試験';
    document.getElementById('particleDensitySubmit').textContent = '保存';
    updatePreview();
  }

  function openNew() {
    resetForm();
    dialogEl().showModal();
  }

  function openEdit(testId) {
    const p = currentProject();
    const test = p?.tests.find(t => t.id === testId && t.type === TYPE);
    if (!test) return;
    state.editingTestId = testId;
    const f = formEl();
    f.reset();
    f.elements.sample.value = test.sample || '';
    (test.measurements || []).slice(0, COUNT).forEach((r, j) => {
      const i = j + 1;
      f.elements[`pycNo_${i}`].value = r.pycnometerNo || '';
      f.elements[`mf_${i}`].value = r.mf ?? '';
      f.elements[`ma2_${i}`].value = r.ma2 ?? '';
      f.elements[`t2_${i}`].value = r.t2 ?? '';
      f.elements[`mb1_${i}`].value = r.mb1 ?? '';
      f.elements[`t1_${i}`].value = r.t1 ?? '';
      f.elements[`containerNo_${i}`].value = r.containerNo || '';
      f.elements[`dryWithContainer_${i}`].value = r.dryWithContainer ?? '';
      f.elements[`containerMass_${i}`].value = r.containerMass ?? '';
    });
    document.getElementById('particleDensityTitle').textContent = '土粒子の密度試験を訂正';
    document.getElementById('particleDensitySubmit').textContent = '訂正を保存';
    updatePreview();
    dialogEl().showModal();
  }

  function saveParticleDensity(e) {
    e.preventDefault();
    const f = formEl();
    const sample = f.elements.sample.value.trim();
    if (!sample) return;
    const measurements = Array.from({length:COUNT}, (_,j) => calcOne(j+1));
    if (measurements.some(r => !r.valid)) {
      alert('3測定すべての値を確認してください。');
      return;
    }
    const avg = measurements.reduce((s,r) => s + r.rhoS, 0) / COUNT;
    const p = currentProject();
    if (!p) return;
    const now = new Date().toISOString();
    const payload = { sample, measurements, particleDensityAverage: avg };
    if (state.editingTestId) {
      const test = p.tests.find(t => t.id === state.editingTestId && t.type === TYPE);
      if (!test) return;
      Object.assign(test, payload, { updatedAt: now });
    } else {
      p.tests.push({ id: uid(), type: TYPE, ...payload, createdAt: now });
    }
    p.updatedAt = now;
    saveData();
    dialogEl().close();
    resetForm();
    renderTests();
  }

  function renderCard(test) {
    const rows = (test.measurements || []).map((r,i) => `<div class="measurement-row"><strong>測定 ${i+1}</strong><span>Pycnometer ${escapeHtml(r.pycnometerNo || '—')}</span><span>${Number(r.rhoS).toFixed(3)} Mg/m³</span></div>`).join('');
    const avg = Number(test.particleDensityAverage);
    return `
      <div class="card-title-row"><div><p class="test-kind">土粒子の密度試験</p><h3>${escapeHtml(test.sample)}</h3><p>${new Date(test.createdAt).toLocaleString('ja-JP')}${test.updatedAt ? ' ｜ 訂正済み' : ''}</p></div><button type="button" class="edit-btn" data-edit-pd="${escapeHtml(test.id)}">訂正</button></div>
      <div class="value">${Number.isFinite(avg) ? avg.toFixed(3) : '—'} Mg/m³ <small>平均</small></div>
      <div class="measurement-summary">${rows}</div>`;
  }

  const baseRenderMoistureCard = renderMoistureCard;
  renderMoistureCard = function(test) {
    if (test?.type === TYPE) return renderCard(test);
    return baseRenderMoistureCard(test);
  };

  const baseRenderTests = renderTests;
  renderTests = function() {
    baseRenderTests();
    document.querySelectorAll('[data-edit-pd]').forEach(btn => {
      btn.addEventListener('click', () => openEdit(btn.dataset.editPd));
    });
  };

  injectUI();
})();