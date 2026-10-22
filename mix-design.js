// 配合試験・安定処理土の供試体作製
(function(){
  'use strict';

  const TYPE = 'mix-design';
  const CEMENT_CATALOG_KEY = 'soilnote-cement-catalog-v1';
  const DEFAULT_CEMENT_CATALOG = [
    'ジオセット200',
    'ジオセット225',
    'ジオセット263',
    'ユースタビラー10',
    'ユースタビラー60',
    'ユースタビラースーパー6',
    'タフロック3E型',
    'タフロックエース',
    '日鉄アースタイトR100',
    'ソリッドエース#400',
    'スーパーソリッドエース#400',
    'ハードキープP-530',
    'ハードキープP-310',
    'ハードキープLD',
  ];
  const DEFAULT_CEMENT_DETAILS = {
    'ジオセット200':'汎用（特殊土用）・一般軟弱土',
    'ジオセット225':'高有機質土用',
    'ジオセット263':'PTFE処理防塵型',
    'ユースタビラー10':'一般軟弱土用',
    'ユースタビラー60':'特殊土用（一般・高有機質土）',
    'ユースタビラースーパー6':'発塵抑制型',
    'タフロック3E型':'汎用・一般軟弱土',
    'タフロックエース':'発塵抑制型・浅層／路床改良',
    '日鉄アースタイトR100':'特殊土用（汎用）',
    'ソリッドエース#400':'特殊土用（汎用型）',
    'スーパーソリッドエース#400':'PTFE防塵・特殊土用',
    'ハードキープP-530':'特殊土用',
    'ハードキープP-310':'高有機質土用',
    'ハードキープLD':'発塵抑制型',
  };
  const SPECIMEN_TYPES = {
    unconfined: { label:'一軸圧縮試験', moldVolume:196.3, fixedSoilMass:1500 },
    cone: { label:'コーン指数試験', moldVolume:1000, fixedSoilMass:2500 },
    cbr: { label:'CBR試験', moldVolume:2209, fixedSoilMass:18000 },
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
  const formatVolume = value => Number.isInteger(Number(value)) ? Number(value).toFixed(0) : Number(value).toFixed(1);

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
    const custom = [...loadCementCatalog(), ...catalogFromSavedTests()]
      .map(name => String(name || '').trim())
      .filter(Boolean)
      .sort((a,b) => a.localeCompare(b, 'ja-JP'));
    const unique = [...DEFAULT_CEMENT_CATALOG];
    custom.forEach(name => {
      if (!unique.some(x => x.toLocaleLowerCase('ja-JP') === name.toLocaleLowerCase('ja-JP'))) unique.push(name);
    });
    return unique;
  }

  function rememberCement(name){
    const clean = String(name || '').trim();
    if (!clean) return;
    saveCementCatalog([...loadCementCatalog(), clean]);
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
    catalog.forEach(name => {
      const detail = DEFAULT_CEMENT_DETAILS[name];
      const label = detail ? `${name}｜${detail}` : name;
      select.add(new Option(label, name));
    });
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

  function specimenDefinition(){
    return SPECIMEN_TYPES[specimenType()] || SPECIMEN_TYPES.unconfined;
  }

  function applySpecimenType(){
    const f = formEl();
    if (!f) return;
    const def = specimenDefinition();
    const soilMass = f.elements.batchSoilMass;
    const note = document.getElementById('mixSoilMassNote');
    soilMass.value = String(def.fixedSoilMass);
    soilMass.readOnly = true;
    if (note) note.textContent = `${def.label}は ${def.fixedSoilMass.toLocaleString('ja-JP')} g 固定`;
    setText('mixMoldVolume', `${formatVolume(def.moldVolume)} cc`);
    setText('mixMoldVolumeHelp', `${def.label}：モールド体積 ${formatVolume(def.moldVolume)} cc で自動計算`);
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

  function readNaturalMeasurement(index){
    const f = formEl();
    if (!f) return { index, status:'blank' };

    const containerNo = f.elements[`naturalContainerNo${index}`].value.trim();
    const wetRaw = f.elements[`naturalWetMass${index}`].value.trim();
    const dryRaw = f.elements[`naturalDryMass${index}`].value.trim();
    const containerRaw = f.elements[`naturalContainerMass${index}`].value.trim();
    const any = [containerNo, wetRaw, dryRaw, containerRaw].some(value => value !== '');

    if (!any) return { index, status:'blank' };
    if (!containerNo || !wetRaw || !dryRaw || !containerRaw) return { index, status:'incomplete' };

    const wetMass = Number(wetRaw);
    const dryMass = Number(dryRaw);
    const containerMass = Number(containerRaw);
    if (![wetMass, dryMass, containerMass].every(Number.isFinite)) return { index, status:'invalid' };

    const waterMass = wetMass - dryMass;
    const drySoilMass = dryMass - containerMass;
    if (waterMass < 0 || drySoilMass <= 0) return { index, status:'invalid' };

    return {
      index,
      status:'valid',
      measurement: {
        containerNo,
        wetMass,
        dryMass,
        containerMass,
        moisture: (waterMass / drySoilMass) * 100,
      },
    };
  }

  function calculations(){
    const f = formEl();
    if (!f) return null;
    const def = specimenDefinition();
    const moldVolume = def.moldVolume;

    const naturalRows = [1,2,3].map(readNaturalMeasurement);
    const naturalWaterMeasurements = naturalRows
      .filter(row => row.status === 'valid')
      .map(row => row.measurement);
    const naturalWaterContent = naturalWaterMeasurements.length
      ? naturalWaterMeasurements.reduce((sum, row) => sum + row.moisture, 0) / naturalWaterMeasurements.length
      : null;

    const moldMass = num(f.elements.moldMass.value);
    const moldSoilMass = num(f.elements.moldSoilMass.value);
    const batchSoilMass = num(f.elements.batchSoilMass.value);
    const soilMass = moldMass !== null && moldSoilMass !== null ? moldSoilMass - moldMass : null;
    const wetDensity = soilMass !== null && soilMass > 0 ? soilMass / moldVolume : null;
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

    return {
      naturalRows,
      naturalWaterMeasurements,
      naturalWaterContent,
      moldVolume,
      moldMass,
      moldSoilMass,
      soilMass,
      wetDensity,
      batchSoilMass,
      batchVolume,
      additions,
      airDays,
      waterDays,
      enteredCuringDays,
      dateDays,
    };
  }

  function setText(id, text){
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function updatePreview(){
    const r = calculations();
    if (!r) return;

    r.naturalRows.forEach(row => {
      let text = '—';
      if (row.status === 'valid') text = `${row.measurement.moisture.toFixed(1)} %`;
      if (row.status === 'incomplete') text = '入力途中';
      if (row.status === 'invalid') text = '確認';
      setText(`mixNaturalMoisture${row.index}`, text);
    });
    setText(
      'mixNaturalWaterAverage',
      r.naturalWaterContent !== null
        ? `${r.naturalWaterContent.toFixed(1)} %（${r.naturalWaterMeasurements.length}点平均）`
        : '—'
    );

    setText('mixMoldVolume', `${formatVolume(r.moldVolume)} cc`);
    setText('mixSoilMass', r.soilMass !== null && r.soilMass > 0 ? `${r.soilMass.toFixed(1)} g` : '—');
    setText('mixWetDensity', r.wetDensity !== null ? `${r.wetDensity.toFixed(3)} g/cm³` : '—');
    setText('mixBatchVolume', r.batchVolume !== null ? `${r.batchVolume.toFixed(1)} cc` : '—');
    r.additions.forEach((a, index) => {
      setText(`mixCementMass${index + 1}`, a.cementMass !== null ? `${a.cementMass.toFixed(1)} g` : '—');
    });

    const moistureCheck = document.getElementById('mixNaturalWaterCheck');
    if (moistureCheck) {
      moistureCheck.classList.remove('error');
      const bad = r.naturalRows.find(row => row.status === 'incomplete' || row.status === 'invalid');
      if (bad) {
        moistureCheck.textContent = bad.status === 'incomplete'
          ? `⚠ ${bad.index}行目の自然含水比データが入力途中です。`
          : `⚠ ${bad.index}行目の質量関係を確認してください。`;
        moistureCheck.classList.add('error');
      } else if (r.naturalWaterMeasurements.length) {
        moistureCheck.textContent = `自然含水比 ${r.naturalWaterContent.toFixed(1)} % ｜ ${r.naturalWaterMeasurements.length}点平均`;
      } else {
        moistureCheck.textContent = '1～3点入力できます。1点だけでも保存できます。';
      }
    }

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
      check.textContent = `モールド質量とモールド＋土質量を入力すると、${formatVolume(r.moldVolume)} ccから湿潤密度を自動計算します。`;
    } else if (r.batchSoilMass === null || r.batchVolume === null) {
      check.textContent = `湿潤密度 ${r.wetDensity.toFixed(3)} g/cm³ ｜ 使用土量を入力してください。`;
    } else {
      const ready = r.additions.filter(a => a.cementMass !== null).length;
      check.textContent = `湿潤密度 ${r.wetDensity.toFixed(3)} g/cm³ ｜ 配合作製体積 ${r.batchVolume.toFixed(1)} cc ｜ 添加量 ${ready}/3 パターン計算済み`;
    }
  }

  function moistureRow(index){
    return `
      <div class="mix-moisture-row">
        <input name="naturalContainerNo${index}" autocomplete="off" placeholder="No." aria-label="容器No ${index}">
        <input name="naturalWetMass${index}" inputmode="decimal" autocomplete="off" placeholder="g" aria-label="容器＋湿潤土質量 ${index}">
        <input name="naturalDryMass${index}" inputmode="decimal" autocomplete="off" placeholder="g" aria-label="乾燥後の容器＋土質量 ${index}">
        <input name="naturalContainerMass${index}" inputmode="decimal" autocomplete="off" placeholder="g" aria-label="容器質量 ${index}">
        <strong id="mixNaturalMoisture${index}">—</strong>
      </div>`;
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
          <div class="mix-grid mix-grid-2">
            <label>試料名 / No.<select name="sample" class="managed-sample-select" required></select></label>
            <label>供試体の試験種別<select name="specimenType"><option value="unconfined">一軸圧縮試験</option><option value="cone">コーン指数試験</option><option value="cbr">CBR試験</option></select></label>
          </div>

          <div class="mix-natural-water">
            <div class="mix-natural-water-head">
              <div><strong>自然含水比 wn</strong><small>最大3点・1点だけでも可</small></div>
              <div class="mix-moisture-average"><span>平均</span><strong id="mixNaturalWaterAverage">—</strong></div>
            </div>
            <div class="mix-moisture-table-wrap">
              <div class="mix-moisture-table">
                <div class="mix-moisture-head">
                  <span>容器No.</span>
                  <span>容器＋湿潤土質量 (g)</span>
                  <span>乾燥後の容器＋土質量 (g)</span>
                  <span>容器質量 (g)</span>
                  <span>含水比</span>
                </div>
                ${moistureRow(1)}
                ${moistureRow(2)}
                ${moistureRow(3)}
              </div>
            </div>
            <div id="mixNaturalWaterCheck" class="mass-check">1～3点入力できます。1点だけでも保存できます。</div>
            <div id="mixLegacyNaturalWater" class="mix-help hidden"></div>
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
          <div class="subsection-head"><div><span class="step-badge">2</span><strong>湿潤密度</strong></div><p id="mixMoldVolumeHelp">一軸圧縮試験：モールド体積 196.3 cc で自動計算</p></div>
          <div class="mix-grid mix-grid-2">
            <label>モールド質量 (g)<input name="moldMass" inputmode="decimal" autocomplete="off"></label>
            <label>モールド＋土質量 (g)<input name="moldSoilMass" inputmode="decimal" autocomplete="off"></label>
          </div>
          <div class="mix-results mix-results-3">
            <div><span>土の質量</span><strong id="mixSoilMass">—</strong></div>
            <div><span>モールド体積</span><strong id="mixMoldVolume">196.3 cc</strong></div>
            <div><span>湿潤密度 ρt</span><strong id="mixWetDensity">—</strong></div>
          </div>
        </section>

        <section class="mix-panel">
          <div class="subsection-head"><div><span class="step-badge">3</span><strong>配合作製量</strong></div><p>一軸 1500g・コーン 2500g・CBR 18000g に自動切替します。</p></div>
          <div class="mix-grid mix-grid-2">
            <label>使用土量 (g)<input name="batchSoilMass" inputmode="decimal" autocomplete="off" value="1500" readonly><small id="mixSoilMassNote" class="mix-help">一軸圧縮試験は 1,500 g 固定</small></label>
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
        .mix-natural-water{margin:12px 0;padding:12px;border:1px solid var(--line,#dfe7e3);border-radius:14px;background:#f8fbfa}
        .mix-natural-water-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:8px}.mix-natural-water-head small{display:block;color:var(--muted,#68766e);font-size:10px;margin-top:2px}
        .mix-moisture-table-wrap{overflow-x:auto;padding-bottom:2px}.mix-moisture-table{min-width:720px;display:grid;gap:6px}
        .mix-moisture-head,.mix-moisture-row{display:grid;grid-template-columns:90px 1fr 1fr 1fr 100px;gap:6px;align-items:center}
        .mix-moisture-head{font-size:10px;color:var(--muted,#68766e);padding:0 4px}
        .mix-moisture-row input{min-width:0}.mix-moisture-row>strong{display:flex;align-items:center;justify-content:center;min-height:46px;border:1px solid var(--line,#dfe7e3);border-radius:11px;background:#fff;color:var(--accent-dark,#0b5136)}
        .mix-moisture-average{display:flex;align-items:center;gap:8px;padding:7px 10px;border:1px solid var(--line,#dfe7e3);border-radius:10px;background:#fff}.mix-moisture-average span{font-size:11px;color:var(--muted,#68766e)}.mix-moisture-average strong{font-size:15px;color:var(--accent-dark,#0b5136)}
        .mix-results{display:grid;gap:9px;margin-top:10px}.mix-results-3{grid-template-columns:repeat(3,1fr)}.mix-results>div,.mix-result-highlight{padding:12px;border:1px solid var(--line,#dfe7e3);border-radius:13px;background:#f8fbfa;text-align:center}
        .mix-results span,.mix-result-highlight span,.mix-result-highlight small{display:block;font-size:11px;color:var(--muted,#68766e)}.mix-results strong,.mix-result-highlight strong{display:block;margin:3px 0;font-size:23px;color:var(--accent-dark,#0b5136)}
        .mix-help{display:block;margin-top:5px;color:var(--muted,#68766e);font-size:10px}.mix-additions{display:grid;gap:9px}.mix-addition-row{display:grid;grid-template-columns:42px 1fr 1fr;gap:10px;align-items:end;padding:11px;border:1px solid var(--line,#dfe7e3);border-radius:14px;background:#f8fbfa}.mix-addition-row>strong{font-size:22px;color:var(--accent-dark,#0b5136);align-self:center;text-align:center}.mix-addition-row>div{min-height:48px;padding:8px 10px;border:1px solid var(--line,#dfe7e3);border-radius:12px;background:#fff;display:flex;flex-direction:column;justify-content:center}.mix-addition-row>div span{font-size:11px;color:var(--muted,#68766e)}.mix-addition-row>div strong{font-size:20px;color:var(--accent-dark,#0b5136)}
        @media(max-width:760px){.mix-grid-3{grid-template-columns:1fr 1fr}.mix-addition-row{grid-template-columns:36px 1fr 1fr}}
        @media(max-width:560px){.mix-grid-3,.mix-grid-2{grid-template-columns:1fr}.mix-results-3{grid-template-columns:1fr 1fr}.mix-addition-row{grid-template-columns:32px 1fr}.mix-addition-row>div{grid-column:2}.mix-design-dialog .subsection-head{align-items:flex-start}.mix-natural-water-head{align-items:flex-start;flex-direction:column}.mix-moisture-average{width:100%;justify-content:space-between}}
      `;
      document.head.appendChild(style);
    }

    const f = formEl();
    f.addEventListener('input', updatePreview);
    f.addEventListener('change', updatePreview);
    f.addEventListener('submit', saveTest);
    f.elements.specimenType.addEventListener('change', () => { applySpecimenType(); updatePreview(); });
    f.elements.cementChoice.addEventListener('change', toggleManualCement);
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
    f.elements.airCuringDays.value = '';
    f.elements.waterCuringDays.value = '';
    document.getElementById('mixLegacyNaturalWater')?.classList.add('hidden');
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

    const measurements = Array.isArray(test.naturalWaterMeasurements) ? test.naturalWaterMeasurements.slice(0,3) : [];
    measurements.forEach((m, i) => {
      const n = i + 1;
      f.elements[`naturalContainerNo${n}`].value = m.containerNo ?? '';
      f.elements[`naturalWetMass${n}`].value = m.wetMass ?? '';
      f.elements[`naturalDryMass${n}`].value = m.dryMass ?? '';
      f.elements[`naturalContainerMass${n}`].value = m.containerMass ?? '';
    });

    if (!measurements.length && num(test.naturalWaterContent) !== null) {
      const legacy = document.getElementById('mixLegacyNaturalWater');
      if (legacy) {
        legacy.textContent = `旧形式の自然含水比 ${num(test.naturalWaterContent).toFixed(1)} % を保持しています。質量を入力すると新形式に更新します。`;
        legacy.classList.remove('hidden');
      }
    }

    f.elements.specimenType.value = test.specimenType || 'unconfined';
    f.elements.specimenDate.value = test.specimenDate || '';
    f.elements.compressionDate.value = test.compressionDate || '';
    f.elements.preparationMethod.value = test.preparationMethod || 'jcas-l01';
    f.elements.airCuringDays.value = test.curing?.airDays ?? '';
    f.elements.waterCuringDays.value = test.curing?.waterDays ?? '';
    f.elements.moldMass.value = test.moldMass ?? '';
    f.elements.moldSoilMass.value = test.moldSoilMass ?? '';
    applySpecimenType();
    f.elements.batchSoilMass.value = test.batchSoilMass ?? SPECIMEN_TYPES[f.elements.specimenType.value]?.fixedSoilMass ?? 1500;
    (test.additions || []).slice(0,3).forEach((row, i) => {
      f.elements[`dosage${i + 1}`].value = row.dosage ?? '';
    });
    updatePreview();
    dialogEl().showModal();
  }

  function saveTest(event){
    event.preventDefault();
    const f = formEl();
    const p = currentProject?.();
    if (!f || !p) return;

    const sample = f.elements.sample.value.trim();
    const cementName = selectedCement();
    const r = calculations();
    const existing = state.editingTestId
      ? p.tests.find(x => x.id === state.editingTestId && x.type === TYPE)
      : null;
    const legacyWn = existing && num(existing.naturalWaterContent) !== null
      ? num(existing.naturalWaterContent)
      : null;
    const badNaturalRow = r.naturalRows.find(row => row.status === 'incomplete' || row.status === 'invalid');

    if (!sample) { alert('試料を選択してください。'); return; }
    if (badNaturalRow) {
      alert(badNaturalRow.status === 'incomplete'
        ? `自然含水比の${badNaturalRow.index}行目が入力途中です。容器No.と3つの質量を入力してください。`
        : `自然含水比の${badNaturalRow.index}行目の質量関係を確認してください。`);
      return;
    }
    if (!r.naturalWaterMeasurements.length && legacyWn === null) {
      alert('自然含水比を1点以上入力してください。');
      return;
    }
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

    const naturalWaterContent = r.naturalWaterMeasurements.length ? r.naturalWaterContent : legacyWn;
    const naturalWaterMeasurements = r.naturalWaterMeasurements.length
      ? r.naturalWaterMeasurements
      : (Array.isArray(existing?.naturalWaterMeasurements) ? existing.naturalWaterMeasurements : []);
    const naturalWaterContents = r.naturalWaterMeasurements.length
      ? r.naturalWaterMeasurements.map(row => row.moisture)
      : (Array.isArray(existing?.naturalWaterContents)
        ? existing.naturalWaterContents
        : (legacyWn !== null ? [legacyWn] : []));

    const sampleOption = f.elements.sample.selectedOptions[0];
    const sampleId = sampleOption?.dataset?.sampleId || null;
    const now = new Date().toISOString();
    const payload = {
      sample,
      sampleId,
      naturalWaterContent,
      naturalWaterContents,
      naturalWaterMeasurements,
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
      moldVolume: r.moldVolume,
      moldMass: r.moldMass,
      moldSoilMass: r.moldSoilMass,
      soilMass: r.soilMass,
      wetDensity: r.wetDensity,
      batchSoilMass: r.batchSoilMass,
      batchVolume: r.batchVolume,
      additions: r.additions.map(a => ({ dosage:a.dosage, cementMass:a.cementMass })),
    };

    rememberCement(cementName);
    if (existing) {
      Object.assign(existing, payload, { updatedAt:now });
      delete existing.draft;
      delete existing.draftFields;
      delete existing.draftFieldLabels;
      delete existing.draftSavedAt;
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
    const wn = num(test.naturalWaterContent);
    const moistureCount = Array.isArray(test.naturalWaterMeasurements) ? test.naturalWaterMeasurements.length : 0;
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
        <div><span>自然含水比 wn</span><strong>${wn !== null ? wn.toFixed(1) : '—'} %</strong>${moistureCount ? `<small>${moistureCount}点平均</small>` : ''}</div>
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
