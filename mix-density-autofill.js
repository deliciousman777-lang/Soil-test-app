// 配合試験：同一試料の原土試験から湿潤密度を自動入力
(function(){
  'use strict';

  const TARGETS = {
    cone: { label:'コーン指数試験', volume:1000 },
    cbr: { label:'CBR試験', volume:2209 },
  };

  const clean = value => String(value ?? '').trim();
  const sameText = (a,b) => clean(a).toLocaleLowerCase('ja-JP') === clean(b).toLocaleLowerCase('ja-JP');
  const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;

  function formEl(){ return document.getElementById('mixDesignForm'); }
  function project(){
    try { return currentProject?.() || null; } catch { return null; }
  }

  function currentMixTest(){
    const p = project();
    if (!p || !state?.editingTestId) return null;
    return (p.tests || []).find(test => test.id === state.editingTestId && test.type === 'mix-design') || null;
  }

  function selectedSample(){
    const f = formEl();
    if (!f?.elements.sample) return { id:'', name:'' };
    const option = f.elements.sample.selectedOptions?.[0];
    return {
      id: clean(option?.dataset?.sampleId),
      name: clean(f.elements.sample.value),
    };
  }

  function sameSample(test, sample){
    const testId = clean(test?.sampleId);
    if (sample.id && testId) return sample.id === testId;
    return !!sample.name && sameText(test?.sample, sample.name);
  }

  function isTargetType(test, target){
    const type = clean(test?.type).toLocaleLowerCase('ja-JP');
    if (!type || type === 'mix-design') return false;
    if (target === 'cone') return type === 'cone-index' || type.includes('cone');
    if (target === 'cbr') return type.includes('cbr');
    return false;
  }

  function isLikelyOriginal(test){
    return !clean(test?.cementName)
      && !clean(test?.stabilizerName)
      && !clean(test?.binderName)
      && test?.dosage == null
      && !Array.isArray(test?.additions);
  }

  function timeOf(test){
    const t = new Date(test?.updatedAt || test?.createdAt || 0).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  function candidateFrom(test, target){
    const def = TARGETS[target];
    if (!def) return null;
    const moldMass = finite(test?.moldMass);
    const moldSoilMass = finite(test?.moldSoilMass);
    const sourceVolume = finite(test?.moldVolume) ?? def.volume;
    const storedDensity = finite(test?.wetDensity);
    const massDensity = moldMass !== null && moldSoilMass !== null && moldSoilMass > moldMass && sourceVolume > 0
      ? (moldSoilMass - moldMass) / sourceVolume
      : null;
    const wetDensity = storedDensity ?? massDensity;
    if (wetDensity === null || wetDensity <= 0) return null;

    const volumeMatches = Math.abs(sourceVolume - def.volume) < 0.01;
    return {
      test,
      moldMass,
      moldSoilMass,
      sourceVolume,
      wetDensity,
      canCopyMasses: volumeMatches && moldMass !== null && moldSoilMass !== null && moldSoilMass > moldMass,
      original: isLikelyOriginal(test),
    };
  }

  function findSource(target){
    const p = project();
    const sample = selectedSample();
    if (!p || !sample.name || !TARGETS[target]) return null;
    return (p.tests || [])
      .filter(test => isTargetType(test, target) && sameSample(test, sample))
      .map(test => candidateFrom(test, target))
      .filter(Boolean)
      .sort((a,b) => (Number(b.original) - Number(a.original)) || (timeOf(b.test) - timeOf(a.test)))[0] || null;
  }

  function ensureStatus(){
    const f = formEl();
    if (!f) return null;
    let status = document.getElementById('mixOriginalDensityStatus');
    if (status) return status;
    const density = document.getElementById('mixWetDensity');
    const section = density?.closest('.mix-panel');
    if (!section) return null;
    status = document.createElement('div');
    status.id = 'mixOriginalDensityStatus';
    status.className = 'mass-check';
    status.style.marginTop = '10px';
    section.appendChild(status);
    return status;
  }

  function setStatus(text, isError = false){
    const status = ensureStatus();
    if (!status) return;
    status.textContent = text;
    status.classList.toggle('error', !!isError);
  }

  function clearDensityFields(clearValues = false){
    const f = formEl();
    if (!f) return;
    ['moldMass','moldSoilMass'].forEach(name => {
      const input = f.elements[name];
      if (!input) return;
      if (clearValues || input.dataset.originalDensityAuto === '1') input.value = '';
      delete input.dataset.originalDensityAuto;
    });
    delete f.dataset.originalDensitySource;
  }

  function dispatchRecalc(){
    const f = formEl();
    const input = f?.elements.moldSoilMass;
    if (input) input.dispatchEvent(new Event('input', { bubbles:true }));
  }

  function applyFromOriginal(){
    const f = formEl();
    if (!f) return;
    const target = clean(f.elements.specimenType?.value);

    // 訂正画面では保存済みの配合試験値を優先し、自動で上書きしない。
    if (currentMixTest()) {
      setStatus('訂正中のため、保存済みの湿潤密度データを保持しています。');
      return;
    }

    // 新規入力で試験種別・試料を変えた場合、別条件の密度値を持ち越さない。
    clearDensityFields(true);

    if (!TARGETS[target]) {
      setStatus('一軸圧縮試験は配合試験用モールドの質量から湿潤密度を計算します。');
      dispatchRecalc();
      return;
    }

    const source = findSource(target);
    const label = TARGETS[target].label;

    if (!source) {
      setStatus(`同一試料の原土${label}データが見つからないため、モールド質量を入力してください。`);
      dispatchRecalc();
      return;
    }

    if (!source.canCopyMasses) {
      setStatus(`原土${label}に湿潤密度 ${source.wetDensity.toFixed(3)} g/cm³ はありますが、元のモールド質量データがないため自動入力できません。`, true);
      dispatchRecalc();
      return;
    }

    f.elements.moldMass.value = String(source.moldMass);
    f.elements.moldSoilMass.value = String(source.moldSoilMass);
    f.elements.moldMass.dataset.originalDensityAuto = '1';
    f.elements.moldSoilMass.dataset.originalDensityAuto = '1';
    f.dataset.originalDensitySource = clean(source.test?.id);
    setStatus(`✓ 同一試料の原土${label}から湿潤密度 ${source.wetDensity.toFixed(3)} g/cm³ を自動入力しました。`);
    dispatchRecalc();
  }

  function bind(){
    const f = formEl();
    if (!f || f.dataset.originalDensityBound === '1') return;
    f.dataset.originalDensityBound = '1';
    ensureStatus();

    f.elements.specimenType?.addEventListener('change', () => setTimeout(applyFromOriginal, 0));
    f.elements.sample?.addEventListener('change', () => setTimeout(applyFromOriginal, 0));

    ['moldMass','moldSoilMass'].forEach(name => {
      f.elements[name]?.addEventListener('input', event => {
        if (!event.isTrusted) return;
        if (event.currentTarget.dataset.originalDensityAuto !== '1' && !f.dataset.originalDensitySource) return;
        delete f.elements.moldMass?.dataset.originalDensityAuto;
        delete f.elements.moldSoilMass?.dataset.originalDensityAuto;
        delete f.dataset.originalDensitySource;
        setStatus('原土データの自動入力後に手動で変更しました。現在は手入力値を使用しています。');
      });
    });

    document.getElementById('addMixDesignBtn')?.addEventListener('click', () => setTimeout(applyFromOriginal, 0));
  }

  function init(){
    bind();
    if (!formEl()) setTimeout(init, 50);
  }

  init();
})();
