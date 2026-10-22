// 配合試験・安定処理土の供試体作製
(function(){
  'use strict';

  const TYPE = 'mix-design';
  const MOLD_VOLUME = 196.3; // cm3
  const CEMENT_CATALOG_KEY = 'soilnote-cement-catalog-v1';
  const SPECIMEN_TYPES = {
    unconfined: { label:'一軸圧縮試験', fixedSoilMass:1500 },
    cone: { label:'コーン指数試験', fixedSoilMass:null },
    cbr: { label:'CBR試験', fixedSoilMass:null },
  };
  const PREPARATION_METHODS = {
    'jcas-l01':'JCAS L-01（セメント協会仕様）',
    'jgs-0821':'JGS 0821（締固めをしない供試体作製・タッピング法）',
    tamping:'タンピング法（突棒による供試体作製）',
  };

  const num = value => {
    const s = String(value ?? '').trim();
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };
  const esc = value => typeof escapeHtml === 'function'
    ? escapeHtml(value)
    : String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  function formEl(){ return document.getElementById('mixDesignForm'); }
  function dialogEl(){ return document.getElementById('mixDesignDialog'); }

  function loadCementCatalog(){
    try {
      const parsed = JSON.parse(localStorage.getItem(CEMENT_CATALOG_KEY));
      return Array.isArray(parsed) ? parsed.map(x => String(x).trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  function saveCementCatalog(list){
    const unique = [];
    list.forEach(name => {
      const clean = String(name || '').trim();
      if (clean && !unique.some(x => x.toLocaleLowerCase('ja-JP') === clean.toLocaleLowerCase('ja-JP'))) unique.push(clean);
    });
    localStorage.setItem(CEMENT_CATALOG_KEY, JSON.stringify(unique));
  }

  function catalogFromSavedTests(){
    const names = [];
    try {
      (state?.data?.projects || []).forEach(project => {
        (project.tests || []).forEach(test => {
          if (test?.type === TYPE && test.cementName) names.push(String(test.cementName).trim());
        });
      });
    } catch {}
    return names.filter(Boolean);
  }

  function cementCatalog(){
    const all = [...loadCementCatalog(), ...catalogFromSavedTests()];
    const unique = [];
    all.forEach(name => {
      if (!unique.some(x => x.toLocaleLowerCase('ja-JP') === name.toLocaleLowerCase('ja-JP'))) unique.push(name);
    });
    return unique.sort((a,b) => a.localeCompare(b, 'ja-JP'));
  }

  function rememberCement(name){
    const clean = String(name || '').trim();
    if (!clean) return;
    saveCementCatalog([...cementCatalog(), clean]);
  }

  function sampleOptions(){
    const p = currentProject?.();
    const samples = Array.isArray(p?.samples) ? p.samples : [];
    const activeId = p?.activeSampleId;
    return samples.map(sample => ({
      id: String(sample.id || ''),
      name: String(sample.name || '').trim(),
      active: String(sample.id || '') === String(activeId || ''),
    })).filter(x => x.name);
  }

  function syncSampleSelect(selectedName = ''){
    const f = formEl();
    if (!f?.elements.sample) return;
    const select = f.elements.sample;
    const samples = sampleOptions();
    select.innerHTML = '';
    if (!samples.length) {
      select.add(new Option('先に試料を登録してください', ''));
      select.disabled = true;
      return;
    }
    select.disabled = false;
    samples.forEach(s => {
      const option = new Option(s.name, s.name);
      option.dataset.sampleId = s.id;
      option.selected = selectedName ? s.name === selectedName : s.active;
      select.add(option);
    });
    if (!select.value) select.selectedIndex = 0;
  }

  function syncCementSelect(selectedName = ''){
    const f = formEl();
    if (!f) return;
    const select = f.elements.cementChoice;
    const manual = f.elements.cementManual;
    const catalog = cementCatalog();
    select.innerHTML = '<option value="">選択してください</option>';
    catalog.forEach(name => select.add(new Option(name, name)));
    select.add(new Option('その他／新しいセメントを入力', '__manual__'));

    if (selectedName && catalog.includes(selectedName)) {
      select.value = selectedName;
      manual.value = '';
    } else if (selectedName) {
      select.value = '__manual__';
      manual.value = selectedName;
    } else if (!catalog.length) {
      select.value = '__manual__';
      manual.value = '';
    } else {
      select.value = '';
      manual.value = '';
    }
    toggleManualCement();
  }

  function toggleManualCement(){
    const f = formEl();
    if (!f) return;
    const manualWrap = document.getElementById('mixCementManualWrap');
    const manual = f.elements.cementManual;
    const show = f.elements.cementChoice.value === '__manual__';
    manualWrap?.classList.toggle('hidden', !show);
    manual.required = show;
  }

  function selectedCement(){
    const f = formEl();
    if (!f) return '';
    return f.elements.cementChoice.value === '__manual__'
      ? f.elements.cementManual.value.trim()
      : f.elements.cementChoice.value.trim();
  }

  function specimenType(){
    const f = formEl();
    return f?.elements.specimenType.value || 'unconfined';
  }

  function applySpecimenType(){
    const f = formEl();
    if (!f) return;
    const def = SPECIMEN_TYPES[specimenType()] || SPECIMEN_TYPES.unconfined;
    const soilMass = f.elements.batchSoilMass;
    const note = document.getElementById('mixSoilMassNote');
    if (def.fixedSoilMass != null) {
      soilMass.value = String(def.fixedSoilMass);
      soilMass.readOnly = true;
      if (note) note.textContent = '一軸圧縮試験は 1500 g 固定';
    } else {
      if (soilMass.readOnly || Number(soilMass.value) === 1500) soilMass.value = '';
      soilMass.readOnly = false;
      if (note) note.textContent = `${def.label}は使用する土量を入力`;
    }
  }

  function dateOnly(value){
    if (!value) return null;
    const d = new Date(`${value}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function dateDiffDays(from, to){
    const a = dateOnly(from), b = dateOnly(to);
    if (!a || !b) return null;
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  }

  function calculations(){
    const f = formEl();
    if (!f) return null;
    const moldMass = num(f.elements.moldMass.value);
    const moldSoilMass = num(f.elements.moldSoilMass.value);
    const batchSoilMass = num(f.elements.batchSoilMass.value);
    const soilMass = moldMass !== null && moldSoilMass !== null ? moldSoilMass - moldMass : null;
    const wetDensity = soilMass !== null && soilMass > 0 ? soilMass / MOLD_VOLUME : null;
    const batchVolume = wetDensity !== null && batchSoilMass !== null && batchSoilMass > 0 ? batchSoilMass / wetDensity : null;
    const additions = [1,2,3].map(i => {
      const dosage = num(f.elements[`dosage${i}`].value);
      const cementMass = dosage !== null && dosage >= 0 && batchVolume !== null ? (dosage / 1000) * batchVolume : null;
      return { dosage, cementMass };
    });
    const airDays = num(f.elements.airCuringDays.value);
    const waterDays = num(f.elements.waterCuringDays.value);
    const enteredCuringDays = airDays !== null || waterDays !== null
      ? (airDays || 0) + (waterDays || 0)
      : null;
    const dateDays = dateDiffDays(f.elements.specimenDate.value, f.elements.compressionDate.value);
    return { moldMass, moldSoilMass, soilMass, wetDensity, batchSoilMass, batchVolume, additions, airDays, waterDays, enteredCuringDays, dateDays };
  }

  function setText(id, text){
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function updatePreview(){
    const r = calculations();
    if (!r) return;
    setText('mixSoilMass', r.soilMass !== null && r.soilMass > 0 ? `${r.soilMass.toFixed(1)} g` : '—');
    setText('mixWetDensity', r.wetDensity !== null ? `${r.wetDensity.toFixed(3)} g/cm³` : '—');
    setText('mixBatchVolume', r.batchVolume !== null ? `${r.batchVolume.toFixed(1)} cc` : '—');
    r.additions.forEach((a, index) => {
      setText(`mixCementMass${index + 1}`, a.cementMass !== null ? `${a.cementMass.toFixed(1)} g` : '—');
    });

    const curing = document.getElementById('mixCuringCheck');
    if (curing) {
      curing.classList.remove('error');
      if (r.dateDays !== null && r.dateDays < 0) {
        curing.textContent = '⚠ 圧縮日／試験日が供試体作製日より前になっています。';
        curing.classList.add('error');
      } else if (r.dateDays !== null && r.enteredCuringDays !== null) {
        curing.textContent = `作製→試験 ${r.dateDays}日 ｜ 空気養生＋水浸養生 ${r.enteredCuringDays}日${r.dateDays !== r.enteredCuringDays ? '（日数を確認）' : ''}`;
        if (r.dateDays !== r.enteredCuringDays) curing.classList.add('error');
      } else if (r.dateDays !== null) {
        curing.textContent = `作製→試験 ${r.dateDays}日 ｜ 空気養生・水浸養生日数を入力してください。`;
      } else {
        curing.textContent = '作製日・圧縮日／試験日と養生日数を入力すると確認します。';
      }
    }

    const check = document.getElementById('mixDesignCheck');
    if (!check) return;
    check.classList.remove('error');
    if (r.moldMass !== null && r.moldSoilMass !== null && r.soilMass <= 0) {
      check.textContent = '⚠ モールド＋土質量はモールド質量より大きい値を入力してください。';
      check.classList.add('error');
    } else if (r.wetDensity === null) {
      check.textContent = `モールド質量とモールド＋土質量を入力すると、${MOLD_VOLUME} ccから湿潤密度を自動計算します。`;
    } else if (r.batchSoilMass === null || r.batchVolume === null) {
      check.textContent = `湿潤密度 ${r.wetDensity.toFixed(3)} g/cm³ ｜ 使用土量を入力してください。`;
    } else {
      const ready = r.additions.filter(a => a.cementMass !== null).length;
      check.textContent = `湿潤密度 ${r.wetDensity.toFixed(3)} g/cm³ ｜ 配合作製体積 ${r.batchVolume.toFixed(1)} cc ｜ 添加量 ${ready}/3 パターン計算済み`;
    }
  }

  function injectUI(){
    const actions = document.querySelector('#detailView .test-actions');
    if (actions && !document.getElementById('addMixDesignBtn')) {
      const button = document.createElement('button');
      button.id = 'addMixDesignBtn';
      button.type = 'button';
      button.className = 'primary secondary';
      button.textContent = '＋ 配合試験';
      actions.appendChild(button);
      button.addEventListener('click', openNew);
    }
    if (document.getElementById('mixDesignDialog')) return;

    const dialog = document.createElement('dialog');
    dialog.id = 'mixDesignDialog';
    dialog.className = 'wide-dialog mix-design-dialog';
    dialog.innerHTML = `
      <form id="mixDesignForm" method="dialog">
        <div class="dialog-head">
          <div><p class="eyebrow">STABILIZED SOIL</p><h2 id="mixDesignTitle">配合試験・安定処理土の供試体作製</h2></div>
          <button type="button" class="icon-btn" id="mixDesignClose">×</button>
        </div>

        <section class="mix-panel">
          <div class="subsection-head"><div><span class="step-badge">1</span><strong>基本条件</strong></div><p>供試体作製条件と養生条件を記録します。</p></div>
          <div class="mix-grid mix-grid-3">
            <label>試料名 / No.<select name="sample" class="managed-sample-select" required></select></label>
            <label>自然含水比 wn (%)<div class="mix-inline"><input name="naturalWaterContent" inputmode="decimal" autocomplete="off"><button type="button" class="ghost" id="mixLoadNaturalWater">含水比から読込</button></div></label>
            <label>供試体の試験種別<select name="specimenType"><option value="unconfined">一軸圧縮試験</option><option value="cone">コーン指数試験</option><option value="cbr">CBR試験</option></select></label>
          </div>
          <div class="mix-grid mix-grid-2">
            <label>使用セメント<select name="cementChoice"></select></label>
            <label id="mixCementManualWrap" class="hidden">新しいセメント名<input name="cementManual" autocomplete="off" placeholder="例：○○固化材"></label>
          </div>
          <div class="mix-grid mix-grid-3">
            <label>供試体作製日<input name="specimenDate" type="date"></label>
            <label>圧縮日 / 試験日<input name="compressionDate" type="date"></label>
            <label>供試体作製条件<select name="preparationMethod"><option value="jcas-l01">JCAS L-01（セメント協会仕様）</option><option value="jgs-0821">JGS 0821（締固めをしない供試体作製・タッピング法）</option><option value="tamping">タンピング法（突棒による供試体作製）</option></select></label>
          </div>
          <div class="mix-grid mix-grid-2">
            <label>空気養生 (日)<input name="airCuringDays" inputmode="numeric" min="0" step="1"></label>
            <label>水浸養生 (日)<input name="waterCuringDays" inputmode="numeric" min="0" step="1"></label>
          </div>
          <div id="mixCuringCheck" class="mass-check">作製日・圧縮日／試験日と養生日数を入力すると確認します。</div>
        </section>

        <section class="mix-panel">
          <div class="subsection-head"><div><span class="step-badge">2</span><strong>湿潤密度</strong></div><p>モールド体積 ${MOLD_VOLUME} cc で自動計算します。</p></div>
          <div class="mix-grid mix-grid-2">
            <label>モールド質量 (g)<input name="moldMass" inputmode="decimal" autocomplete="off"></label>
            <label>モールド＋土質量 (g)<input name="moldSoilMass" inputmode="decimal" autocomplete="off"></label>
          </div>
          <div class="mix-results mix-results-3">
            <div><span>土の質量</span><strong id="mixSoilMass">—</strong></div>
            <div><span>モールド体積</span><strong>${MOLD_VOLUME.toFixed(1)} cc</strong></div>
            <div><span>湿潤密度 ρt</span><strong id="mixWetDensity">—</strong></div>
          </div>
        </section>

        <section class="mix-panel">
          <div class="subsection-head"><div><span class="step-badge">3</span><strong>配合作製量</strong></div><p>一軸は1500g固定。コーン・CBRは使用土量を入力します。</p></div>
          <div class="mix-grid mix-grid-2">
            <label>使用土量 (g)<input name="batchSoilMass" inputmode="decimal" autocomplete="off" value="1500"><small id="mixSoilMassNote" class="mix-help">一軸圧縮試験は 1500 g 固定</small></label>
            <div class="mix-result-highlight"><span>配合作製体積</span><strong id="mixBatchVolume">—</strong><small>使用土量 ÷ 湿潤密度</small></div>
          </div>
        </section>

        <section class="mix-panel">
          <div class="subsection-head"><div><span class="step-badge">4</span><strong>添加量3パターン</strong></div><p>kg/m³を入力すると必要セメント量(g)を自動計算します。</p></div>
          <div class="mix-additions">
            <div class="mix-addition-row"><strong>①</strong><label>添加量 (kg/m³)<input name="dosage1" inputmode="decimal" autocomplete="off"></label><div><span>必要セメント量</span><strong id="mixCementMass1">—</strong></div></div>
            <div class="mix-addition-row"><strong>②</strong><label>添加量 (kg/m³)<input name="dosage2" inputmode="decimal" autocomplete="off"></label><div><span>必要セメント量</span><strong id="mixCementMass2">—</strong></div></div>
            <div class="mix-addition-row"><strong>③</strong><label>添加量 (kg/m³)<input name="dosage3" inputmode="decimal" autocomplete="off"></label><div><span>必要セメント量</span><strong id="mixCementMass3">—</strong></div></div>
          </div>
          <p class="hint">計算：必要セメント量(g) ＝ 添加量(kg/m³) ÷ 1000 × 配合作製体積(cc)</p>
        </section>

        <div id="mixDesignCheck" class="mass-check">モールド質量とモールド＋土質量を入力してください。</div>
        <div class="dialog-actions"><button type="button" class="ghost" id="mixDesignCancel">キャンセル</button><button class="primary" id="mixDesignSubmit">保存</button></div>
      </form>`;
    document.body.appendChild(dialog);

    if (!document.getElementById('mixDesignStyles')) {
      const style = document.createElement('style');
      style.id = 'mixDesignStyles';
      style.textContent = `
        .mix-panel{margin-top:14px;padding:14px;border:1px solid var(--line,#dfe7e3);border-radius:16px;background:#fff}
        .mix-grid{display:grid;gap:10px;align-items:end}.mix-grid-3{grid-template-columns:repeat(3,1fr)}.mix-grid-2{grid-template-columns:repeat(2,1fr)}
        .mix-design-dialog select{width:100%;min-height:46px;border:1px solid var(--line,#dfe7e3);border-radius:12px;background:#fff;padding:0 10px;font-size:15px;color:#1f2a24}
        .mix-inline{display:grid;grid-template-columns:1fr auto;gap:7px;align-items:stretch}.mix-inline .ghost{white-space:nowrap;padding:0 12px}
        .mix-results{display:grid;gap:9px;margin-top:10px}.mix-results-3{grid-template-columns:repeat(3,1fr)}.mix-results>div,.mix-result-highlight{padding:12px;border:1px solid var(--line,#dfe7e3);border-radius:13px;background:#f8fbfa;text-align:center}
        .mix-results span,.mix-result-highlight span,.mix-result-highlight small{display:block;font-size:11px;color:var(--muted,#68766e)}.mix-results strong,.mix-result-highlight strong{display:block;margin:3px 0;font-size:23px;color:var(--accent-dark,#0b5136)}
        .mix-help{display:block;margin-top:5px;color:var(--muted,#68766e);font-size:10px}.mix-additions{display:grid;gap:9px}.mix-addition-row{display:grid;grid-template-columns:42px 1fr 1fr;gap:10px;align-items:end;padding:11px;border:1px solid var(--line,#dfe7e3);border-radius:14px;background:#f8fbfa}.mix-addition-row>strong{font-size:22px;color:var(--accent-dark,#0b5136);align-self:center;text-align:center}.mix-addition-row>div{min-height:48px;padding:8px 10px;border:1px solid var(--line,#dfe7e3);border-radius:12px;background:#fff;display:flex;flex-direction:column;justify-content:center}.mix-addition-row>div span{font-size:11px;color:var(--muted,#68766e)}.mix-addition-row>div strong{font-size:20px;color:var(--accent-dark,#0b5136)}
        @media(max-width:760px){.mix-grid-3{grid-template-columns:1fr 1fr}.mix-addition-row{grid-template-columns:36px 1fr 1fr}}
        @media(max-width:560px){.mix-grid-3,.mix-grid-2{grid-template-columns:1fr}.mix-inline{grid-template-columns:1fr}.mix-results-3{grid-template-columns:1fr 1fr}.mix-addition-row{grid-template-columns:32px 1fr}.mix-addition-row>div{grid-column:2}.mix-design-dialog .subsection-head{align-items:flex-start}}
      `;
      document.head.appendChild(style);
    }

    const f = formEl();
    f.addEventListener('input', updatePreview);
    f.addEventListener('change', updatePreview);
    f.addEventListener('submit', saveTest);
    f.elements.specimenType.addEventListener('change', () => { applySpecimenType(); updatePreview(); });
    f.elements.cementChoice.addEventListener('change', toggleManualCement);
    dialog.querySelector('#mixLoadNaturalWater').addEventListener('click', loadNaturalWater);
    dialog.querySelector('#mixDesignClose').addEventListener('click', () => dialog.close());
    dialog.querySelector('#mixDesignCancel').addEventListener('click', () => dialog.close());
  }

  function resetForm(){
    state.editingTestId = null;
    const f = formEl();
    f.reset();
    syncSampleSelect();
    syncCementSelect();
    f.elements.specimenType.value = 'unconfined';
    f.elements.preparationMethod.value = 'jcas-l01';
    f.elements.batchSoilMass.value = '1500';
    f.elements.airCuringDays.value = '';
    f.elements.waterCuringDays.value = '';
    applySpecimenType();
    document.getElementById('mixDesignTitle').textContent = '配合試験・安定処理土の供試体作製';
    document.getElementById('mixDesignSubmit').textContent = '保存';
    updatePreview();
  }

  function openNew(){
    const samples = sampleOptions();
    if (!samples.length) {
      alert('先にこの工事件名の「試料」を登録してください。');
      document.getElementById('addSampleBtn')?.focus();
      return;
    }
    resetForm();
    dialogEl().showModal();
  }

  function openEdit(id){
    const p = currentProject?.();
    const test = p?.tests?.find(x => x.id === id && x.type === TYPE);
    if (!test) return;
    resetForm();
    state.editingTestId = id;
    const f = formEl();
    document.getElementById('mixDesignTitle').textContent = '配合試験を訂正';
    document.getElementById('mixDesignSubmit').textContent = '訂正を保存';
    syncSampleSelect(test.sample || '');
    syncCementSelect(test.cementName || '');
    f.elements.naturalWaterContent.value = test.naturalWaterContent ?? '';
    f.elements.specimenType.value = test.specimenType || 'unconfined';
    f.elements.specimenDate.value = test.specimenDate || '';
    f.elements.compressionDate.value = test.compressionDate || '';
    f.elements.preparationMethod.value = test.preparationMethod || 'jcas-l01';
    f.elements.airCuringDays.value = test.curing?.airDays ?? '';
    f.elements.waterCuringDays.value = test.curing?.waterDays ?? '';
    f.elements.moldMass.value = test.moldMass ?? '';
    f.elements.moldSoilMass.value = test.moldSoilMass ?? '';
    applySpecimenType();
    f.elements.batchSoilMass.value = test.batchSoilMass ?? (specimenType() === 'unconfined' ? 1500 : '');
    (test.additions || []).slice(0,3).forEach((row, i) => { f.elements[`dosage${i + 1}`].value = row.dosage ?? ''; });
    updatePreview();
    dialogEl().showModal();
  }

  function loadNaturalWater(){
    const p = currentProject?.();
    const f = formEl();
    const sample = f?.elements.sample.value.trim();
    if (!p || !f) return;
    const candidates = (p.tests || [])
      .filter(test => test.type === 'moisture' && Number.isFinite(Number(test.moistureAverage)))
      .sort((a,b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
    const chosen = candidates.find(test => sample && String(test.sample || '').trim() === sample) || candidates[0];
    if (!chosen) {
      alert('この工事件名に保存済みの含水比試験がありません。');
      return;
    }
    f.elements.naturalWaterContent.value = Number(chosen.moistureAverage).toFixed(1);
    updatePreview();
  }

  function saveTest(event){
    event.preventDefault();
    const f = formEl();
    const p = currentProject?.();
    if (!f || !p) return;
    const sample = f.elements.sample.value.trim();
    const cementName = selectedCement();
    const r = calculations();

    if (!sample) { alert('試料を選択してください。'); return; }
    if (!cementName) { alert('使用セメントを選択または入力してください。'); return; }
    if (r.moldMass === null || r.moldSoilMass === null || r.soilMass === null || r.soilMass <= 0 || r.wetDensity === null) {
      alert('モールド質量とモールド＋土質量を確認してください。'); return;
    }
    if (r.batchSoilMass === null || r.batchSoilMass <= 0 || r.batchVolume === null) {
      alert('使用土量を入力してください。'); return;
    }
    if (r.additions.some(a => a.dosage === null || a.dosage < 0 || a.cementMass === null)) {
      alert('3つの添加量をすべて入力してください。'); return;
    }
    if (r.dateDays !== null && r.dateDays < 0) {
      alert('圧縮日／試験日が供試体作製日より前になっています。'); return;
    }

    const sampleOption = f.elements.sample.selectedOptions[0];
    const sampleId = sampleOption?.dataset?.sampleId || null;
    const now = new Date().toISOString();
    const payload = {
      sample,
      sampleId,
      naturalWaterContent: num(f.elements.naturalWaterContent.value),
      cementName,
      specimenType: f.elements.specimenType.value,
      specimenDate: f.elements.specimenDate.value || '',
      compressionDate: f.elements.compressionDate.value || '',
      curing: {
        airDays: r.airDays,
        waterDays: r.waterDays,
        totalEnteredDays: r.enteredCuringDays,
        dateDifferenceDays: r.dateDays,
      },
      preparationMethod: f.elements.preparationMethod.value,
      preparationMethodLabel: PREPARATION_METHODS[f.elements.preparationMethod.value] || f.elements.preparationMethod.value,
      moldVolume: MOLD_VOLUME,
      moldMass: r.moldMass,
      moldSoilMass: r.moldSoilMass,
      soilMass: r.soilMass,
      wetDensity: r.wetDensity,
      batchSoilMass: r.batchSoilMass,
      batchVolume: r.batchVolume,
      additions: r.additions.map(a => ({ dosage:a.dosage, cementMass:a.cementMass })),
    };

    rememberCement(cementName);
    if (state.editingTestId) {
      const test = p.tests.find(x => x.id === state.editingTestId && x.type === TYPE);
      if (!test) return;
      Object.assign(test, payload, { updatedAt:now });
      delete test.draft;
      delete test.draftFields;
      delete test.draftFieldLabels;
      delete test.draftSavedAt;
    } else {
      p.tests.push({ id:uid(), type:TYPE, ...payload, createdAt:now });
    }
    p.updatedAt = now;
    saveData();
    dialogEl().close();
    resetForm();
    renderTests();
  }

  function renderCard(test){
    const def = SPECIMEN_TYPES[test.specimenType] || SPECIMEN_TYPES.unconfined;
    const adds = (test.additions || []).slice(0,3).map(a => Number.isFinite(Number(a.dosage)) ? Number(a.dosage).toFixed(0) : '—').join(' / ');
    return `
      <div class="card-title-row">
        <div>
          <p class="test-kind">配合試験・安定処理土供試体作製</p>
          <h3>${esc(test.sample || '')}</h3>
          <p>${new Date(test.createdAt).toLocaleString('ja-JP')}${test.updatedAt ? ' ｜ 訂正済み' : ''}</p>
        </div>
        <button type="button" class="edit-btn" data-edit-mix-design="${esc(test.id)}">訂正</button>
      </div>
      <div class="fraction-card-row">
        <div><span>湿潤密度 ρt</span><strong>${num(test.wetDensity)?.toFixed(3) ?? '—'} g/cm³</strong></div>
        <div><span>作製体積</span><strong>${num(test.batchVolume)?.toFixed(1) ?? '—'} cc</strong></div>
        <div><span>添加量 kg/m³</span><strong>${esc(adds)}</strong></div>
      </div>
      <div class="meta"><span>${esc(def.label)}</span><span>${esc(test.cementName || 'セメント未入力')}</span></div>`;
  }

  const baseRenderMoistureCard = renderMoistureCard;
  renderMoistureCard = function(test){
    if (test?.type === TYPE) return renderCard(test);
    return baseRenderMoistureCard(test);
  };

  const baseRenderTests = renderTests;
  renderTests = function(){
    const result = baseRenderTests.apply(this, arguments);
    document.querySelectorAll('[data-edit-mix-design]').forEach(button => {
      button.addEventListener('click', () => openEdit(button.dataset.editMixDesign));
    });
    return result;
  };

  injectUI();
})();
