// データシート：安定処理土の供試体作製条件
(function(){
  'use strict';
  const TYPE='mix-design';
  const SPEC={
    unconfined:'一軸圧縮試験',cone:'コーン指数試験',cbr:'CBR試験'
  };
  const PREP={
    'jcas-l01':'JCAS L-01（セメント協会仕様）',
    'jgs-0821':'JGS 0821（締固めをしない供試体作製・タッピング法）',
    tamping:'タンピング法（突棒による供試体作製）',
  };
  const finite=v=>v!==null&&v!==''&&Number.isFinite(Number(v));
  const f=(v,d=1)=>finite(v)?Number(v).toFixed(d):'';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  function project(){try{return state.data.projects.find(p=>p.id===state.currentProjectId)||null;}catch{return null;}}
  function latest(tests,type,sample){return [...(tests||[])].filter(t=>t.type===type&&String(t.sample||'')===String(sample||'')).sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')))[0]||null;}
  function reportMeta(p,sample){return p?.reportMeta?.[sample]||{tester:'',testDate:''};}
  function date(v){if(!v)return '';const m=String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);return m?`${m[1]}/${m[2]}/${m[3]}`:String(v);}

  function densityRows(test){
    const volume=finite(test?.moldVolume)?Number(test.moldVolume):(test?.specimenType==='cone'?1000:test?.specimenType==='cbr'?2209:196.3);
    let rows=Array.isArray(test?.densityMeasurements)?test.densityMeasurements.map(r=>({...r})):[];
    if(!rows.length&&finite(test?.moldMass)&&finite(test?.moldSoilMass))rows=[{moldMass:test.moldMass,moldSoilMass:test.moldSoilMass,soilMass:test.soilMass,wetDensity:test.wetDensity}];
    return rows.slice(0,3).map(r=>{
      const mm=finite(r.moldMass)?Number(r.moldMass):null,ms=finite(r.moldSoilMass)?Number(r.moldSoilMass):null;
      const soil=finite(r.soilMass)?Number(r.soilMass):(mm!==null&&ms!==null?ms-mm:null);
      const rho=finite(r.wetDensity)?Number(r.wetDensity):(soil!==null&&soil>0?soil/volume:null);
      return {moldMass:mm,moldSoilMass:ms,soilMass:soil,wetDensity:rho};
    });
  }

  function page(p,sample,test){
    const meta=reportMeta(p,sample);
    const pd=latest(p.tests,'particleDensity',sample);
    const comp=latest(p.tests,'compaction',sample);
    const moisture=Array.isArray(test.naturalWaterMeasurements)?test.naturalWaterMeasurements.slice(0,3):[];
    while(moisture.length<3)moisture.push({});
    const dens=densityRows(test);while(dens.length<3)dens.push({});
    const rho=finite(test.wetDensity)?Number(test.wetDensity):(()=>{const a=dens.map(r=>r.wetDensity).filter(finite).map(Number);return a.length?a.reduce((x,y)=>x+y,0)/a.length:null;})();
    const wn=finite(test.naturalWaterContent)?Number(test.naturalWaterContent):null;
    const dry=rho!==null&&wn!==null?rho/(1+wn/100):null;
    const batchVolume=finite(test.batchVolume)?Number(test.batchVolume):(finite(test.batchSoilMass)&&rho?Number(test.batchSoilMass)/rho:null);
    const additions=(Array.isArray(test.additions)?test.additions:[]).slice(0,3);while(additions.length<3)additions.push({});
    const prep=test.preparationMethodLabel||PREP[test.preparationMethod]||test.preparationMethod||'';
    const curing=test.curing||{};
    const specimen=SPEC[test.specimenType]||test.specimenType||'';
    const cardNo=String(p.constructionCardNo||'').trim().toUpperCase();
    return `<section class="report-page" id="reportMixDesignPage">
      <div style="text-align:center;font-size:17px;font-weight:800;letter-spacing:.08em;margin-bottom:7px">安定処理土の供試体作製</div>
      <div class="r-head"><div class="r-field"><b>調査件名</b><span>${esc(p.name||'')}</span></div><div class="r-field"><b>作成日</b><span>${esc(date(test.specimenDate)||date(meta.testDate)||'')}</span></div><div class="r-field"><b>試料番号</b><span>${esc(sample)}</span></div><div class="r-field"><b>試験者</b><span>${esc(meta.tester||'')}</span></div></div>
      <div class="r-small" style="text-align:right;font-weight:${cardNo?'700':'400'}">${cardNo?`施工カード No. ${esc(cardNo)}　　`:''}1 / 1</div>

      <div class="r-section"><div class="r-section-title">原土・作製条件</div><table class="r-table">
        <tr><th>土質名 / 試料名</th><td>${esc(sample)}</td><th>自然含水比 wn</th><td>${f(wn,1)} %</td></tr>
        <tr><th>土粒子の密度 ρs</th><td>${f(pd?.particleDensityAverage,3)} Mg/m³</td><th>湿潤密度 ρt</th><td>${f(rho,3)} g/cm³</td></tr>
        <tr><th>乾燥密度 ρd</th><td>${f(dry,3)} g/cm³</td><th>最大乾燥密度 ρdmax</th><td>${f(comp?.maxDryDensity,3)} g/cm³</td></tr>
        <tr><th>最適含水比 wopt</th><td>${f(comp?.optimumWaterContent,1)} %</td><th>供試体種別</th><td>${esc(specimen)}</td></tr>
      </table></div>

      <div class="r-section"><div class="r-section-title">自然含水比</div><table class="r-table"><tr><th>測定</th><th>容器No.</th><th>mₐ 容器＋湿潤土 (g)</th><th>mᵦ 容器＋乾燥土 (g)</th><th>mᶜ 容器 (g)</th><th>w (%)</th></tr>
        ${moisture.map((m,i)=>`<tr><td>${i+1}</td><td>${esc(m.containerNo||'')}</td><td>${f(m.wetMass,1)}</td><td>${f(m.dryMass,1)}</td><td>${f(m.containerMass,1)}</td><td>${f(m.moisture,1)}</td></tr>`).join('')}
        <tr class="r-total"><th colspan="5">平均自然含水比</th><td>${f(wn,1)} %</td></tr></table></div>

      <div class="r-section"><div class="r-section-title">供試体作製条件・添加方法</div><table class="r-table">
        <tr><th>添加剤名</th><td>${esc(test.cementName||'')}</td><th>供試体作製日</th><td>${esc(date(test.specimenDate))}</td></tr>
        <tr><th>圧縮日 / 試験日</th><td>${esc(date(test.compressionDate))}</td><th>養生日数</th><td>空気 ${f(curing.airDays,0)} 日　水浸 ${f(curing.waterDays,0)} 日</td></tr>
        <tr><th>供試体作製条件</th><td colspan="3" class="r-left">${esc(prep)}</td></tr>
      </table></div>

      <div class="r-section"><div class="r-section-title">湿潤密度</div><table class="r-table"><tr><th>測定</th><th>モールド質量 (g)</th><th>モールド＋土質量 (g)</th><th>土の質量 (g)</th><th>湿潤密度 ρt (g/cm³)</th></tr>
        ${dens.map((r,i)=>`<tr><td>${i+1}</td><td>${f(r.moldMass,1)}</td><td>${f(r.moldSoilMass,1)}</td><td>${f(r.soilMass,1)}</td><td>${f(r.wetDensity,3)}</td></tr>`).join('')}
        <tr class="r-total"><th colspan="4">採用湿潤密度</th><td>${f(rho,3)}</td></tr></table></div>

      <div class="r-section"><div class="r-section-title">添加量計算</div><div class="r-small" style="margin-bottom:4px">使用土量 ${f(test.batchSoilMass,0)} g ÷ 湿潤密度 ${f(rho,3)} g/cm³ ＝ 配合作製体積 ${f(batchVolume,1)} cm³</div><table class="r-table"><tr><th>配合</th><th>添加量 (kg/m³)</th><th>換算 (g/cm³)</th><th>配合作製体積 (cm³)</th><th>必要セメント量 (g)</th></tr>
        ${additions.map((a,i)=>{const dosage=finite(a.dosage)?Number(a.dosage):null;const cm=finite(a.cementMass)?Number(a.cementMass):(dosage!==null&&batchVolume!==null?(dosage/1000)*batchVolume:null);return `<tr><td>パターン ${i+1}</td><td>${f(dosage,0)}</td><td>${dosage!==null?f(dosage/1000,3):''}</td><td>${f(batchVolume,1)}</td><td>${f(cm,1)}</td></tr>`;}).join('')}
      </table><div class="r-note">必要セメント量(g) ＝ 添加量(kg/m³) ÷ 1000 × 配合作製体積(cm³)</div></div>
    </section>`;
  }

  function renumber(root){
    if(!root)return;
    const pages=[...root.querySelectorAll(':scope > .report-page')];
    const total=pages.length;
    pages.forEach((pg,i)=>{
      const counter=pg.querySelector(':scope > .r-small');
      if(!counter)return;
      counter.textContent=counter.textContent.replace(/\d+\s*\/\s*\d+\s*$/,`${i+1} / ${total}`);
    });
    const hint=document.querySelector('#reportSheetDialog .report-ui span');
    if(hint)hint.textContent=`保存済み試験から全 ${total} 枚を自動作成`;
  }

  function enhance(){
    const root=document.getElementById('reportPages');
    const sel=document.getElementById('reportSampleSelect');
    const p=project();
    if(!root||!sel||!p||!root.querySelector('.report-page'))return;
    const sample=sel.value||'';
    const test=latest(p.tests,TYPE,sample);
    const existing=root.querySelector('#reportMixDesignPage');
    if(test&&!existing)root.insertAdjacentHTML('beforeend',page(p,sample,test));
    if(!test&&existing)existing.remove();
    renumber(root);
  }

  function setup(){
    const root=document.getElementById('reportPages');
    if(!root){setTimeout(setup,50);return;}
    const observer=new MutationObserver(()=>requestAnimationFrame(enhance));
    observer.observe(root,{childList:true,subtree:false});
    document.getElementById('reportSampleSelect')?.addEventListener('change',()=>requestAnimationFrame(enhance));
    document.addEventListener('click',e=>{if(e.target.closest?.('#reportPrintBtn'))enhance();},true);
    requestAnimationFrame(enhance);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(setup,0));else setTimeout(setup,0);
})();