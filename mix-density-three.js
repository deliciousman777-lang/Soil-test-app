// 配合試験：湿潤密度を3点測定の平均で扱う
(function(){
  'use strict';

  const COUNT = 3;

  const num = value => {
    const s = String(value ?? '').trim();
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  function formEl(){ return document.getElementById('mixDesignForm'); }
  function dialogEl(){ return document.getElementById('mixDesignDialog'); }

  function moldVolume(){
    const f = formEl();
    const type = f?.elements.specimenType?.value || 'unconfined';
    if (type === 'cone') return 1000;
    if (type === 'cbr') return 2209;
    return 196.3;
  }

  function rowInput(index, kind){
    return formEl()?.elements?.[`density${kind}${index}`] || null;
  }

  function readRow(index){
    const moldMass = num(rowInput(index, 'MoldMass')?.value);
    const moldSoilMass = num(rowInput(index, 'MoldSoilMass')?.value);
    const entered = moldMass !== null || moldSoilMass !== null;
    if (!entered) return { index, status:'blank', moldMass, moldSoilMass, soilMass:null, wetDensity:null };
    if (moldMass === null || moldSoilMass === null) return { index, status:'incomplete', moldMass, moldSoilMass, soilMass:null, wetDensity:null };
    const soilMass = moldSoilMass - moldMass;
    if (!(soilMass > 0)) return { index, status:'invalid', moldMass, moldSoilMass, soilMass, wetDensity:null };
    const wetDensity = soilMass / moldVolume();
    return { index, status:'valid', moldMass, moldSoilMass, soilMass, wetDensity };
  }

  function rows(){ return [1,2,3].map(readRow); }

  function averages(validRows){
    if (!validRows.length) return null;
    const avg = key => validRows.reduce((sum,row)=>sum + row[key],0) / validRows.length;
    return {
      moldMass: avg('moldMass'),
      moldSoilMass: avg('moldSoilMass'),
      soilMass: avg('soilMass'),
      wetDensity: avg('wetDensity'),
    };
  }

  function setLegacyAverage(result){
    const f = formEl();
    if (!f) return;
    const mm = f.elements.moldMass;
    const ms = f.elements.moldSoilMass;
    if (!mm || !ms) return;
    if (!result) {
      mm.value = '';
      ms.value = '';
    } else {
      mm.value = String(result.moldMass);
      ms.value = String(result.moldSoilMass);
    }
  }

  function setText(id, text){ const el=document.getElementById(id); if(el)el.textContent=text; }

  function update(){
    const all = rows();
    all.forEach(row => {
      setText(`mixDensitySoilMass${row.index}`, row.soilMass !== null && row.soilMass > 0 ? `${row.soilMass.toFixed(1)} g` : '—');
      setText(`mixDensityValue${row.index}`, row.wetDensity !== null ? `${row.wetDensity.toFixed(3)} g/cm³` : '—');
    });

    const valid = all.filter(row => row.status === 'valid');
    const avg = averages(valid);
    setLegacyAverage(valid.length === COUNT ? avg : null);

    setText('mixDensityAverage', valid.length === COUNT && avg ? `${avg.wetDensity.toFixed(3)} g/cm³` : '—');
    setText('mixSoilMass', valid.length === COUNT && avg ? `${avg.soilMass.toFixed(1)} g` : '—');
    setText('mixWetDensity', valid.length === COUNT && avg ? `${avg.wetDensity.toFixed(3)} g/cm³` : '—');

    const status = document.getElementById('mixDensityThreeCheck');
    if (status) {
      status.classList.remove('error');
      const bad = all.find(row => row.status === 'incomplete' || row.status === 'invalid');
      if (bad) {
        status.textContent = bad.status === 'incomplete'
          ? `⚠ ${bad.index}点目の質量が入力途中です。`
          : `⚠ ${bad.index}点目は「モールド＋土質量」がモールド質量より大きくなるよう確認してください。`;
        status.classList.add('error');
      } else if (valid.length < COUNT) {
        status.textContent = `湿潤密度は3点平均です。残り ${COUNT-valid.length} 点を入力してください。`;
      } else {
        status.textContent = `3点平均 ρt = ${avg.wetDensity.toFixed(3)} g/cm³`;
      }
    }

    // 既存の配合試験計算を平均密度で再計算させる。
    const legacy = formEl()?.elements.moldSoilMass;
    if (legacy) legacy.dispatchEvent(new Event('input',{bubbles:true}));
    return { rows:all, validRows:valid, average:avg };
  }

  function makeRow(index){
    return `
      <div class="mix-density-row">
        <strong>${index}</strong>
        <input name="densityMoldMass${index}" inputmode="decimal" autocomplete="off" placeholder="g" aria-label="モールド質量 ${index}">
        <input name="densityMoldSoilMass${index}" inputmode="decimal" autocomplete="off" placeholder="g" aria-label="モールド＋土質量 ${index}">
        <span id="mixDensitySoilMass${index}">—</span>
        <span id="mixDensityValue${index}">—</span>
      </div>`;
  }

  function inject(){
    const f = formEl();
    if (!f || document.getElementById('mixDensityThreeTable')) return false;
    const legacyGrid = f.elements.moldMass?.closest('.mix-grid');
    const panel = legacyGrid?.closest('.mix-panel');
    if (!legacyGrid || !panel) return false;

    legacyGrid.classList.add('mix-density-legacy-hidden');
    f.elements.moldMass.type = 'hidden';
    f.elements.moldSoilMass.type = 'hidden';

    const block = document.createElement('div');
    block.id = 'mixDensityThreeTable';
    block.className = 'mix-density-three';
    block.innerHTML = `
      <div class="mix-density-three-head">
        <span>No.</span><span>モールド質量 (g)</span><span>モールド＋土質量 (g)</span><span>土の質量</span><span>湿潤密度 ρt</span>
      </div>
      ${makeRow(1)}${makeRow(2)}${makeRow(3)}
      <div class="mix-density-average"><span>3点平均</span><strong id="mixDensityAverage">—</strong></div>
      <div id="mixDensityThreeCheck" class="mass-check">湿潤密度は3点平均です。3点すべて入力してください。</div>`;
    legacyGrid.insertAdjacentElement('beforebegin', block);

    const soilMassLabel = document.getElementById('mixSoilMass')?.previousElementSibling;
    if (soilMassLabel) soilMassLabel.textContent = '平均土の質量';
    const wetLabel = document.getElementById('mixWetDensity')?.previousElementSibling;
    if (wetLabel) wetLabel.textContent = '平均湿潤密度 ρt';

    if (!document.getElementById('mixDensityThreeStyle')) {
      const style=document.createElement('style');
      style.id='mixDensityThreeStyle';
      style.textContent=`
        .mix-density-legacy-hidden{display:none!important}.mix-density-three{margin-top:10px}.mix-density-three-head,.mix-density-row{display:grid;grid-template-columns:44px 1fr 1fr 130px 150px;gap:7px;align-items:center}.mix-density-three-head{padding:0 4px 5px;color:var(--muted,#68766e);font-size:10px}.mix-density-row{margin-bottom:7px}.mix-density-row>strong{display:flex;align-items:center;justify-content:center;height:46px;border-radius:11px;background:#eef4f1;color:var(--accent-dark,#0b5136)}.mix-density-row>span{display:flex;align-items:center;justify-content:center;min-height:46px;border:1px solid var(--line,#dfe7e3);border-radius:11px;background:#f8fbfa;font-weight:800;color:var(--accent-dark,#0b5136);font-size:13px}.mix-density-average{margin-top:9px;display:flex;align-items:center;justify-content:space-between;padding:11px 13px;border-radius:12px;background:#eaf5ef;border:1px solid #b9dec9}.mix-density-average span{font-size:12px;color:#53605d}.mix-density-average strong{font-size:22px;color:var(--accent-dark,#0b5136)}@media(max-width:720px){.mix-density-three{overflow-x:auto;padding-bottom:2px}.mix-density-three-head,.mix-density-row{min-width:720px}}
      `;
      document.head.appendChild(style);
    }

    [1,2,3].forEach(i=>{
      rowInput(i,'MoldMass')?.addEventListener('input', update);
      rowInput(i,'MoldSoilMass')?.addEventListener('input', update);
    });
    f.elements.specimenType?.addEventListener('change',()=>setTimeout(update,0));

    // 保存前に3点必須を確認し、保存後に3点の元データも試験データへ残す。
    f.addEventListener('submit', event => {
      const result=update();
      if (result.validRows.length !== COUNT) {
        event.preventDefault();
        event.stopImmediatePropagation();
        alert('湿潤密度は3点平均です。モールド質量とモールド＋土質量を3点すべて入力してください。');
        return;
      }
      const p = typeof currentProject === 'function' ? currentProject() : null;
      const projectId = p?.id || null;
      const editingId = state?.editingTestId || null;
      const beforeIds = new Set((p?.tests || []).filter(t=>t.type==='mix-design').map(t=>t.id));
      const savedRows = result.validRows.map(row=>({
        moldMass:row.moldMass,
        moldSoilMass:row.moldSoilMass,
        soilMass:row.soilMass,
        wetDensity:row.wetDensity,
      }));
      const average = {...result.average};
      setTimeout(()=>{
        const project = (state?.data?.projects || []).find(x=>String(x.id)===String(projectId));
        if (!project || dialogEl()?.open) return;
        let test = editingId ? project.tests.find(t=>t.id===editingId&&t.type==='mix-design') : null;
        if (!test) test = [...(project.tests||[])].reverse().find(t=>t.type==='mix-design'&&!beforeIds.has(t.id));
        if (!test) return;
        test.densityMeasurements = savedRows;
        test.densityMeasurementCount = COUNT;
        test.moldMass = average.moldMass;
        test.moldSoilMass = average.moldSoilMass;
        test.soilMass = average.soilMass;
        test.wetDensity = average.wetDensity;
        if (Number.isFinite(Number(test.batchSoilMass)) && average.wetDensity > 0) {
          test.batchVolume = Number(test.batchSoilMass) / average.wetDensity;
          if (Array.isArray(test.additions)) {
            test.additions = test.additions.map(row=>({
              ...row,
              cementMass:Number.isFinite(Number(row.dosage)) ? (Number(row.dosage)/1000)*test.batchVolume : row.cementMass,
            }));
          }
        }
        if (typeof saveData === 'function') saveData();
      },0);
    },true);

    const observer = new MutationObserver(()=>{
      if (dialogEl()?.open) populateFromSaved();
    });
    observer.observe(dialogEl(),{attributes:true,attributeFilter:['open']});

    window.SoilNoteMixDensity3 = {
      update,
      getMeasurements(){ return rows().filter(r=>r.status==='valid'); },
      clear(){
        [1,2,3].forEach(i=>{rowInput(i,'MoldMass').value='';rowInput(i,'MoldSoilMass').value='';});
        update();
      },
      setMeasurements(items, sourceText=''){
        [1,2,3].forEach(i=>{rowInput(i,'MoldMass').value='';rowInput(i,'MoldSoilMass').value='';});
        (Array.isArray(items)?items:[]).slice(0,3).forEach((item,idx)=>{
          const i=idx+1;
          rowInput(i,'MoldMass').value=item?.moldMass ?? '';
          rowInput(i,'MoldSoilMass').value=item?.moldSoilMass ?? '';
        });
        const result=update();
        if (sourceText) {
          const status=document.getElementById('mixOriginalDensityStatus');
          if(status)status.textContent=sourceText;
        }
        return result;
      },
    };

    update();
    return true;
  }

  function populateFromSaved(){
    const f=formEl();
    if(!f)return;
    const p=typeof currentProject==='function'?currentProject():null;
    const id=state?.editingTestId;
    const test=id?(p?.tests||[]).find(t=>t.id===id&&t.type==='mix-design'):null;
    [1,2,3].forEach(i=>{rowInput(i,'MoldMass').value='';rowInput(i,'MoldSoilMass').value='';});
    if(test){
      const saved=Array.isArray(test.densityMeasurements)?test.densityMeasurements.slice(0,3):[];
      if(saved.length){
        saved.forEach((row,idx)=>{
          const i=idx+1;
          rowInput(i,'MoldMass').value=row.moldMass??'';
          rowInput(i,'MoldSoilMass').value=row.moldSoilMass??'';
        });
      }else if(num(test.moldMass)!==null&&num(test.moldSoilMass)!==null){
        rowInput(1,'MoldMass').value=test.moldMass;
        rowInput(1,'MoldSoilMass').value=test.moldSoilMass;
      }
    }
    update();
  }

  function init(){ if(!inject()) setTimeout(init,60); }
  init();
})();
