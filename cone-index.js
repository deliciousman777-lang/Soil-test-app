// 締固めた土のコーン指数試験 JIS A 1228 / JGS 0716
(function(){
  const TYPE='cone-index';
  const MOLD_VOLUME=1000; // cm3
  const CONE_AREA=3.24; // cm2
  const LOAD_CELLS={
    '1':{capacity:1000,calibration:4.470},
    '2':{capacity:20000,calibration:78.40},
  };
  const DEPTHS=[
    {key:'5',label:'5.0 cm'},
    {key:'75',label:'7.5 cm'},
    {key:'10',label:'10.0 cm'},
  ];

  const num=v=>{const s=String(v??'').trim();if(s==='')return null;const n=Number(s);return Number.isFinite(n)?n:null;};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  function moisture(i){
    const f=formEl();
    const no=f.elements[`waterNo${i}`].value.trim();
    const ma=num(f.elements[`ma${i}`].value);
    const mb=num(f.elements[`mb${i}`].value);
    const mc=num(f.elements[`mc${i}`].value);
    const entered=no!==''||[ma,mb,mc].some(v=>v!==null);
    if(!entered)return {entered:false,valid:false,containerNo:no,ma,mb,mc,w:null};
    const valid=ma!==null&&mb!==null&&mc!==null&&ma>=mb&&mb>mc;
    const w=valid?(ma-mb)/(mb-mc)*100:null;
    return {entered:true,valid,containerNo:no,ma,mb,mc,w};
  }

  function calculate(){
    const f=formEl();
    const waters=[moisture(1),moisture(2)];
    const watersValid=waters.every(x=>x.valid);
    const averageW=watersValid?(waters[0].w+waters[1].w)/2:null;

    const moldNo=f.elements.moldNo.value.trim();
    const moldMass=num(f.elements.moldMass.value);
    const moldSoilMass=num(f.elements.moldSoilMass.value);
    const densityValid=moldMass!==null&&moldSoilMass!==null&&moldSoilMass>moldMass;
    const wetDensity=densityValid?(moldSoilMass-moldMass)/MOLD_VOLUME:null;
    const dryDensity=wetDensity!==null&&averageW!==null?wetDensity/(1+averageW/100):null;

    const loadCellNo=f.elements.loadCellNo.value;
    const loadCell=LOAD_CELLS[loadCellNo]||LOAD_CELLS['1'];
    const penetrations=DEPTHS.map(d=>{
      const reading=num(f.elements[`reading${d.key}`].value);
      const force=reading!==null&&reading>=0?reading*loadCell.calibration:null;
      return {...d,reading,force,valid:reading!==null&&reading>=0,over:force!==null&&force>loadCell.capacity};
    });
    const penValid=penetrations.every(p=>p.valid);
    const averageQc=penValid?penetrations.reduce((s,p)=>s+p.force,0)/penetrations.length:null;
    // Qc [N], A [cm2] -> qc [kN/m2]: Qc / A * 10
    const coneIndex=averageQc!==null?averageQc/CONE_AREA*10:null;

    return {waters,watersValid,averageW,moldNo,moldMass,moldSoilMass,densityValid,wetDensity,dryDensity,loadCellNo,loadCell,penetrations,penValid,averageQc,coneIndex};
  }

  function voice(name){
    return `<div class="voice-input"><input name="${name}" inputmode="decimal" autocomplete="off"><button type="button" class="mic" data-voice="${name}" data-form="coneIndexForm" aria-label="音声入力">🎤</button></div>`;
  }

  function injectUI(){
    const actions=document.querySelector('#detailView .test-actions');
    if(actions&&!document.getElementById('addConeIndexBtn')){
      const b=document.createElement('button');
      b.id='addConeIndexBtn';b.type='button';b.className='primary secondary';b.textContent='＋ コーン指数';
      actions.appendChild(b);b.addEventListener('click',openNew);
    }
    if(document.getElementById('coneIndexDialog'))return;

    const d=document.createElement('dialog');
    d.id='coneIndexDialog';d.className='wide-dialog cone-dialog';
    d.innerHTML=`<form id="coneIndexForm" method="dialog">
      <div class="dialog-head"><div><p class="eyebrow">JIS A 1228 / JGS 0716</p><h2 id="coneIndexTitle">締固めた土のコーン指数試験</h2></div><button type="button" class="icon-btn" id="coneIndexClose">×</button></div>
      <label>試料名 / No.<input name="sample" required autocomplete="off" placeholder="例：現場発生土"></label>

      <section class="cone-panel">
        <div class="subsection-head"><div><span class="step-badge">1</span><strong>含水比（2測定）</strong></div><p>ma：容器＋湿潤土、mb：容器＋乾燥土、mc：容器</p></div>
        <div class="cone-water-grid">
          ${[1,2].map(i=>`<div class="cone-water-card"><div class="specimen-head"><strong>測定 ${i}</strong><span id="coneW${i}">— %</span></div><label>容器 No.<input name="waterNo${i}" autocomplete="off"></label><div class="measurement-grid"><label>ma (g)${voice(`ma${i}`)}</label><label>mb (g)${voice(`mb${i}`)}</label><label>mc (g)${voice(`mc${i}`)}</label></div></div>`).join('')}
        </div>
        <div class="cone-inline-result"><span>平均含水比 w</span><strong id="coneAverageW">— %</strong></div>
      </section>

      <section class="cone-panel">
        <div class="subsection-head"><div><span class="step-badge">2</span><strong>供試体・モールド</strong></div><p>モールド容量は 1000 cm³ 固定</p></div>
        <div class="cone-form-grid">
          <label>モールド No.<input name="moldNo" autocomplete="off" placeholder="例：103"></label>
          <label>モールド質量 m1 (g)${voice('moldMass')}</label>
          <label>土＋モールド質量 m2 (g)${voice('moldSoilMass')}</label>
          <div class="cone-fixed"><span>モールド容量 V</span><strong>1000 cm³</strong></div>
        </div>
        <div class="cone-density-grid"><div><span>湿潤密度 ρt</span><strong id="coneWetDensity">—</strong><small>g/cm³</small></div><div><span>乾燥密度 ρd</span><strong id="coneDryDensity">—</strong><small>g/cm³</small></div></div>
      </section>

      <section class="cone-panel">
        <div class="subsection-head"><div><span class="step-badge">3</span><strong>コーン貫入</strong></div><p>コーン底面積は 3.24 cm² 固定</p></div>
        <div class="cone-loadcell-row">
          <label>荷重計 No.<select name="loadCellNo"><option value="1">No.1</option><option value="2">No.2</option></select></label>
          <div class="cone-fixed"><span>容量</span><strong id="coneCapacity">1000 N</strong></div>
          <div class="cone-fixed"><span>較正係数</span><strong id="coneCalibration">4.470 N/目盛</strong></div>
          <div class="cone-fixed"><span>コーン底面積 A</span><strong>3.24 cm²</strong></div>
        </div>
        <div class="table-wrap"><table class="grain-table cone-table"><thead><tr><th>貫入深さ</th><th>荷重計の読み（目盛）</th><th>貫入抵抗力（N）</th></tr></thead><tbody>${DEPTHS.map(d=>`<tr><th>${d.label}</th><td>${voice(`reading${d.key}`)}</td><td id="force${d.key}" class="calc">—</td></tr>`).join('')}</tbody></table></div>
      </section>

      <section class="cone-main-results">
        <div><span>平均貫入抵抗力 Qc</span><strong id="coneAverageQc">—</strong><small>N</small></div>
        <div class="cone-qc"><span>コーン指数 qc</span><strong id="coneQc">—</strong><small>kN/m²</small></div>
      </section>
      <div id="coneIndexCheck" class="mass-check">含水比・モールド質量・貫入値を入力すると自動計算します。</div>
      <div class="dialog-actions"><button type="button" class="ghost" id="coneIndexCancel">キャンセル</button><button class="primary" id="coneIndexSubmit">保存</button></div>
    </form>`;
    document.body.appendChild(d);

    if(!document.getElementById('coneIndexStyles')){
      const s=document.createElement('style');s.id='coneIndexStyles';s.textContent=`
        .cone-panel{margin-top:14px;padding:14px;border:1px solid var(--line,#dfe7e3);border-radius:16px;background:#fff}.cone-water-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.cone-water-card{padding:12px;border:1px solid var(--line,#dfe7e3);border-radius:14px;background:#f8faf9}.cone-inline-result{margin-top:10px;display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-radius:12px;background:#edf7f2}.cone-inline-result strong{font-size:22px;color:var(--accent-dark,#0b5136)}.cone-form-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;align-items:end}.cone-loadcell-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;align-items:end}.cone-fixed{min-height:52px;border:1px solid var(--line,#dfe7e3);border-radius:12px;padding:8px 11px;background:#f8faf9;display:flex;flex-direction:column;justify-content:center}.cone-fixed span{font-size:11px;color:var(--muted,#68766e)}.cone-fixed strong{font-size:14px}.cone-density-grid,.cone-main-results{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}.cone-density-grid>div,.cone-main-results>div{padding:14px;border-radius:14px;border:1px solid var(--line,#dfe7e3);background:#f8faf9;text-align:center}.cone-density-grid span,.cone-main-results span,.cone-density-grid small,.cone-main-results small{display:block;color:var(--muted,#68766e);font-size:11px}.cone-density-grid strong{display:block;font-size:23px;color:var(--accent-dark,#0b5136);margin:3px}.cone-main-results strong{display:block;font-size:30px;margin:4px;color:#1f2937}.cone-main-results .cone-qc{background:#e7f5ed;border-color:#b9dec9}.cone-main-results .cone-qc strong{font-size:38px;color:var(--accent-dark,#0b5136)}.cone-table{min-width:620px}.cone-table .voice-input{min-width:220px}.cone-over{color:#b42318!important;font-weight:800}.cone-dialog select{min-height:46px;border:1px solid var(--line,#dfe7e3);border-radius:12px;background:#fff;padding:0 10px;font-size:16px}@media(max-width:760px){.cone-water-grid,.cone-form-grid,.cone-loadcell-row{grid-template-columns:1fr 1fr}.cone-main-results{grid-template-columns:1fr}.cone-density-grid{grid-template-columns:1fr 1fr}}@media(max-width:440px){.cone-water-grid,.cone-form-grid,.cone-loadcell-row{grid-template-columns:1fr}.cone-density-grid{grid-template-columns:1fr 1fr}}
      `;document.head.appendChild(s);
    }

    const f=formEl();
    f.addEventListener('input',updatePreview);f.addEventListener('change',updatePreview);f.addEventListener('submit',saveTest);
    d.querySelector('#coneIndexClose').addEventListener('click',()=>d.close());
    d.querySelector('#coneIndexCancel').addEventListener('click',()=>d.close());
  }

  function formEl(){return document.getElementById('coneIndexForm');}
  function dialogEl(){return document.getElementById('coneIndexDialog');}

  function updatePreview(){
    const a=calculate();
    a.waters.forEach((w,j)=>{document.getElementById(`coneW${j+1}`).textContent=w.valid?`${w.w.toFixed(1)} %`:'— %';});
    document.getElementById('coneAverageW').textContent=a.averageW!==null?`${a.averageW.toFixed(1)} %`:'— %';
    document.getElementById('coneWetDensity').textContent=a.wetDensity!==null?a.wetDensity.toFixed(3):'—';
    document.getElementById('coneDryDensity').textContent=a.dryDensity!==null?a.dryDensity.toFixed(3):'—';
    document.getElementById('coneCapacity').textContent=`${a.loadCell.capacity} N`;
    document.getElementById('coneCalibration').textContent=`${a.loadCell.calibration.toFixed(a.loadCellNo==='1'?3:2)} N/目盛`;
    a.penetrations.forEach(p=>{const el=document.getElementById(`force${p.key}`);el.textContent=p.force!==null?p.force.toFixed(1):'—';el.classList.toggle('cone-over',p.over);});
    document.getElementById('coneAverageQc').textContent=a.averageQc!==null?a.averageQc.toFixed(1):'—';
    document.getElementById('coneQc').textContent=a.coneIndex!==null?a.coneIndex.toFixed(0):'—';

    const check=document.getElementById('coneIndexCheck');check.classList.remove('error');
    if(a.penetrations.some(p=>p.over)){
      check.textContent=`⚠ 荷重計No.${a.loadCellNo}の容量 ${a.loadCell.capacity} N を超える値があります。荷重計または読み値を確認してください。`;check.classList.add('error');
    }else if(!a.watersValid||!a.densityValid||!a.penValid){
      check.textContent='含水比2測定・モールド質量・5/7.5/10cmの読みをすべて入力してください。';
    }else{
      check.textContent=`No.${a.loadCellNo} ｜ K=${a.loadCell.calibration.toFixed(a.loadCellNo==='1'?3:2)} N/目盛 ｜ A=${CONE_AREA} cm² ｜ V=${MOLD_VOLUME} cm³`;
    }
  }

  function resetForm(){
    state.editingTestId=null;formEl().reset();formEl().elements.loadCellNo.value='1';
    document.getElementById('coneIndexTitle').textContent='締固めた土のコーン指数試験';document.getElementById('coneIndexSubmit').textContent='保存';updatePreview();
  }
  function openNew(){resetForm();dialogEl().showModal();}

  function openEdit(id){
    const p=currentProject(),t=p?.tests.find(x=>x.id===id&&x.type===TYPE);if(!t)return;
    state.editingTestId=id;formEl().reset();const f=formEl();
    f.elements.sample.value=t.sample||'';f.elements.moldNo.value=t.moldNo||'';f.elements.moldMass.value=t.moldMass??'';f.elements.moldSoilMass.value=t.moldSoilMass??'';f.elements.loadCellNo.value=t.loadCellNo||'1';
    (t.moistureMeasurements||[]).slice(0,2).forEach((m,j)=>{const i=j+1;f.elements[`waterNo${i}`].value=m.containerNo||'';f.elements[`ma${i}`].value=m.ma??'';f.elements[`mb${i}`].value=m.mb??'';f.elements[`mc${i}`].value=m.mc??'';});
    (t.penetrations||[]).forEach(pn=>{const key=String(pn.depth).replace('.','');const map={'5':'5','75':'75','10':'10'};const k=map[key];if(k&&f.elements[`reading${k}`])f.elements[`reading${k}`].value=pn.reading??'';});
    document.getElementById('coneIndexTitle').textContent='コーン指数試験を訂正';document.getElementById('coneIndexSubmit').textContent='訂正を保存';updatePreview();dialogEl().showModal();
  }

  function saveTest(e){
    e.preventDefault();const f=formEl(),sample=f.elements.sample.value.trim();if(!sample)return;const a=calculate();
    if(!a.watersValid){alert('含水比2測定の ma・mb・mc を確認してください。ma ≥ mb > mc で入力してください。');return;}
    if(!a.densityValid){alert('モールド質量と土＋モールド質量を確認してください。');return;}
    if(!a.penValid){alert('5 cm・7.5 cm・10 cm の荷重計の読みをすべて入力してください。');return;}
    if(a.penetrations.some(p=>p.over)){alert(`荷重計No.${a.loadCellNo}の容量 ${a.loadCell.capacity} N を超えています。`);return;}
    const p=currentProject();if(!p)return;const now=new Date().toISOString();
    const payload={sample,moldNo:a.moldNo,moldMass:a.moldMass,moldSoilMass:a.moldSoilMass,moldVolume:MOLD_VOLUME,coneArea:CONE_AREA,moistureMeasurements:a.waters.map(x=>({containerNo:x.containerNo,ma:x.ma,mb:x.mb,mc:x.mc,w:x.w})),moistureAverage:a.averageW,wetDensity:a.wetDensity,dryDensity:a.dryDensity,loadCellNo:a.loadCellNo,loadCellCapacity:a.loadCell.capacity,calibrationFactor:a.loadCell.calibration,penetrations:a.penetrations.map(x=>({depth:x.label==='7.5 cm'?7.5:parseFloat(x.label),reading:x.reading,force:x.force})),averagePenetrationForce:a.averageQc,coneIndex:a.coneIndex};
    if(state.editingTestId){const t=p.tests.find(x=>x.id===state.editingTestId&&x.type===TYPE);if(!t)return;Object.assign(t,payload,{updatedAt:now});}
    else p.tests.push({id:uid(),type:TYPE,...payload,createdAt:now});
    p.updatedAt=now;saveData();dialogEl().close();resetForm();renderTests();
  }

  function renderCard(t){
    return `<div class="card-title-row"><div><p class="test-kind">締固めた土のコーン指数試験</p><h3>${esc(t.sample)}</h3><p>${new Date(t.createdAt).toLocaleString('ja-JP')}${t.updatedAt?' ｜ 訂正済み':''}</p></div><button type="button" class="edit-btn" data-edit-cone-index="${esc(t.id)}">訂正</button></div><div class="fraction-card-row"><div><span>コーン指数 qc</span><strong>${num(t.coneIndex)?.toFixed(0)??'—'} kN/m²</strong></div><div><span>平均含水比</span><strong>${num(t.moistureAverage)?.toFixed(1)??'—'} %</strong></div><div><span>乾燥密度 ρd</span><strong>${num(t.dryDensity)?.toFixed(3)??'—'} g/cm³</strong></div></div><div class="meta"><span>荷重計 No.${esc(t.loadCellNo||'—')}</span><span>平均 Qc ${num(t.averagePenetrationForce)?.toFixed(1)??'—'} N</span></div>`;
  }

  const baseRenderMoistureCard=renderMoistureCard;
  renderMoistureCard=function(test){if(test?.type===TYPE)return renderCard(test);return baseRenderMoistureCard(test);};
  const baseRenderTests=renderTests;
  renderTests=function(){baseRenderTests();document.querySelectorAll('[data-edit-cone-index]').forEach(b=>b.addEventListener('click',()=>openEdit(b.dataset.editConeIndex)));};

  injectUI();
})();
