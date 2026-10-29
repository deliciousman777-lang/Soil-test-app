// 配合試験：確認画面を3点湿潤密度・供試体作製条件・3配合対応にする
(function(){
  'use strict';
  const TYPE='mix-design';
  const SPEC={
    unconfined:{label:'一軸圧縮試験',volume:196.3},
    cone:{label:'コーン指数試験',volume:1000},
    cbr:{label:'CBR試験',volume:2209},
  };
  const PREP={
    'jcas-l01':'JCAS L-01（セメント協会仕様）',
    'jgs-0821':'JGS 0821（締固めをしない供試体作製・タッピング法）',
    tamping:'タンピング法（突棒による供試体作製）',
  };
  const finite=v=>v!==null&&v!==''&&Number.isFinite(Number(v));
  const esc=v=>typeof escapeHtml==='function'?escapeHtml(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const num=(v,d=1)=>finite(v)?Number(v).toFixed(d):'—';
  const date=v=>{
    if(!v)return '—';
    const d=new Date(`${String(v).slice(0,10)}T00:00:00`);
    return Number.isNaN(d.getTime())?esc(v):d.toLocaleDateString('ja-JP');
  };

  function density(test){
    const def=SPEC[test.specimenType]||SPEC.unconfined;
    let rows=Array.isArray(test.densityMeasurements)?test.densityMeasurements.map(r=>({...r})):[];
    if(!rows.length&&finite(test.moldMass)&&finite(test.moldSoilMass))rows=[{moldMass:Number(test.moldMass),moldSoilMass:Number(test.moldSoilMass)}];
    rows=rows.map(r=>{
      const moldMass=finite(r.moldMass)?Number(r.moldMass):null;
      const moldSoilMass=finite(r.moldSoilMass)?Number(r.moldSoilMass):null;
      const soilMass=finite(r.soilMass)?Number(r.soilMass):(moldMass!==null&&moldSoilMass!==null?moldSoilMass-moldMass:null);
      const wetDensity=finite(r.wetDensity)?Number(r.wetDensity):(soilMass!==null&&soilMass>0?soilMass/(finite(test.moldVolume)?Number(test.moldVolume):def.volume):null);
      return {moldMass,moldSoilMass,soilMass,wetDensity};
    }).filter(r=>r.moldMass!==null||r.moldSoilMass!==null);
    const vals=rows.map(r=>r.wetDensity).filter(finite).map(Number);
    const average=finite(test.wetDensity)?Number(test.wetDensity):(vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null);
    return {rows,average,volume:finite(test.moldVolume)?Number(test.moldVolume):def.volume};
  }

  function additions(test,wetDensity){
    const batchSoilMass=finite(test.batchSoilMass)?Number(test.batchSoilMass):null;
    const batchVolume=finite(test.batchVolume)?Number(test.batchVolume):(batchSoilMass!==null&&finite(wetDensity)&&Number(wetDensity)>0?batchSoilMass/Number(wetDensity):null);
    const rows=(Array.isArray(test.additions)?test.additions:[]).slice(0,3).map((r,i)=>{
      const dosage=finite(r?.dosage)?Number(r.dosage):null;
      const cementMass=finite(r?.cementMass)?Number(r.cementMass):(dosage!==null&&batchVolume!==null?(dosage/1000)*batchVolume:null);
      return {index:i+1,dosage,cementMass};
    });
    while(rows.length<3)rows.push({index:rows.length+1,dosage:null,cementMass:null});
    return {rows,batchSoilMass,batchVolume};
  }

  function moistureRows(test){
    const rows=Array.isArray(test.naturalWaterMeasurements)?test.naturalWaterMeasurements:[];
    return rows.map((m,i)=>`<tr><th>${i+1}</th><td>${esc(m.containerNo||'—')}</td><td>${num(m.wetMass,2)}</td><td>${num(m.dryMass,2)}</td><td>${num(m.containerMass,2)}</td><td><strong>${num(m.moisture,1)}%</strong></td></tr>`).join('');
  }

  function ensureStyles(){
    if(document.getElementById('mixReviewV2Styles'))return;
    const s=document.createElement('style');s.id='mixReviewV2Styles';s.textContent=`
      .mix-review-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}.mix-review-card{border:1px solid var(--line,#dfe7e3);border-radius:12px;padding:10px;background:#f8fbfa}.mix-review-card span{display:block;font-size:11px;color:var(--muted,#68766e)}.mix-review-card strong{display:block;margin-top:3px;color:var(--accent-dark,#0b5136);font-size:17px;line-height:1.35}.mix-review-wide{grid-column:1/-1}.mix-review-scroll{overflow-x:auto}.mix-review-table{width:100%;min-width:620px;border-collapse:collapse;font-size:12px}.mix-review-table th,.mix-review-table td{border-bottom:1px solid var(--line,#dfe7e3);padding:9px 8px;text-align:right;white-space:nowrap}.mix-review-table th:first-child,.mix-review-table td:first-child{text-align:left}.mix-review-adds{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.mix-review-add{border:1px solid var(--line,#dfe7e3);border-radius:12px;padding:10px;text-align:center;background:#f8fbfa}.mix-review-add span{display:block;font-size:11px;color:var(--muted,#68766e)}.mix-review-add strong{display:block;font-size:18px;color:var(--accent-dark,#0b5136)}@media(max-width:560px){.mix-review-adds{grid-template-columns:1fr}.mix-review-grid{grid-template-columns:1fr 1fr}.mix-review-card strong{font-size:15px}}
    `;document.head.appendChild(s);
  }

  function html(test){
    ensureStyles();
    const def=SPEC[test.specimenType]||SPEC.unconfined;
    const d=density(test);
    const a=additions(test,d.average);
    const curing=test.curing||{};
    const prep=test.preparationMethodLabel||PREP[test.preparationMethod]||test.preparationMethod||'—';
    const densityRows=d.rows.map((r,i)=>`<tr><th>測定 ${i+1}</th><td>${num(r.moldMass,1)} g</td><td>${num(r.moldSoilMass,1)} g</td><td>${num(r.soilMass,1)} g</td><td><strong>${num(r.wetDensity,3)} g/cm³</strong></td></tr>`).join('');
    const moisture=moistureRows(test);
    const adds=a.rows.map(r=>`<div class="mix-review-add"><span>パターン ${r.index}</span><strong>${num(r.dosage,0)} kg/m³</strong><span>必要セメント量</span><strong>${num(r.cementMass,1)} g</strong></div>`).join('');
    return `<p class="review-meta">試料：${esc(test.sample||'—')}</p>
      <div class="review-summary"><div><span>自然含水比 wn</span><strong>${num(test.naturalWaterContent,1)} %</strong></div><div><span>平均湿潤密度 ρt</span><strong>${num(d.average,3)}</strong><small>g/cm³</small></div><div><span>供試体</span><strong style="font-size:15px">${esc(def.label)}</strong></div></div>
      <section class="review-section"><h3>供試体作製条件</h3><div class="mix-review-grid"><div class="mix-review-card"><span>使用セメント</span><strong>${esc(test.cementName||'—')}</strong></div><div class="mix-review-card"><span>供試体作製日</span><strong>${date(test.specimenDate)}</strong></div><div class="mix-review-card"><span>圧縮日 / 試験日</span><strong>${date(test.compressionDate)}</strong></div><div class="mix-review-card mix-review-wide"><span>供試体作製条件</span><strong>${esc(prep)}</strong></div><div class="mix-review-card"><span>空気養生</span><strong>${num(curing.airDays,0)} 日</strong></div><div class="mix-review-card"><span>水浸養生</span><strong>${num(curing.waterDays,0)} 日</strong></div></div></section>
      <section class="review-section"><h3>自然含水比</h3><div class="mix-review-scroll"><table class="mix-review-table"><thead><tr><th>測定</th><th>容器No.</th><th>容器＋湿潤土</th><th>容器＋乾燥土</th><th>容器</th><th>w</th></tr></thead><tbody>${moisture||'<tr><td colspan="6">保存データなし</td></tr>'}</tbody></table></div></section>
      <section class="review-section"><h3>湿潤密度</h3><div class="mix-review-scroll"><table class="mix-review-table"><thead><tr><th>測定</th><th>モールド</th><th>モールド＋土</th><th>土の質量</th><th>ρt</th></tr></thead><tbody>${densityRows||'<tr><td colspan="5">保存データなし</td></tr>'}</tbody></table></div><p class="review-meta">モールド体積 ${num(d.volume,1)} cm³ ｜ 採用湿潤密度 ${num(d.average,3)} g/cm³</p></section>
      <section class="review-section"><h3>配合作製量</h3><div class="mix-review-grid"><div class="mix-review-card"><span>使用土量</span><strong>${num(a.batchSoilMass,0)} g</strong></div><div class="mix-review-card"><span>配合作製体積</span><strong>${num(a.batchVolume,1)} cm³</strong></div></div></section>
      <section class="review-section"><h3>添加量 3パターン</h3><div class="mix-review-adds">${adds}</div></section>
      <div class="review-note">確認画面には入力した3点湿潤密度・供試体作製条件・3配合を表示します。</div>`;
  }

  window.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-view-any-test]');
    if(!button)return;
    const project=typeof currentProject==='function'?currentProject():null;
    const test=project?.tests?.find(t=>t.id===button.dataset.viewAnyTest);
    if(!test||test.type!==TYPE)return;
    event.preventDefault();event.stopImmediatePropagation();
    const dialog=document.getElementById('testReviewDialog');
    const title=document.getElementById('testReviewTitle');
    const body=document.getElementById('testReviewBody');
    if(!dialog||!title||!body)return;
    title.textContent='安定処理土・供試体作製条件';
    body.innerHTML=html(test);
    dialog.showModal();
  },true);
})();
