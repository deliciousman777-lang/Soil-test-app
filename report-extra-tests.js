// データシート3枚目：液性・塑性限界 + コーン指数
(function(){
  const finite=v=>Number.isFinite(Number(v));
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const f=(v,d=1)=>finite(v)?Number(v).toFixed(d):'';

  function project(){
    try{return state.data.projects.find(p=>p.id===state.currentProjectId)||null;}catch{return null;}
  }
  function latest(tests,type,sample){
    return [...(tests||[])].filter(t=>t.type===type&&String(t.sample||'')===String(sample||''))
      .sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')))[0]||null;
  }
  function metaFor(p,sample){return p?.reportMeta?.[sample]||{depth:'',tester:'',testDate:'',item:'室内土質試験'};}

  function header(p,sample,meta){
    return `<div class="r-head">
      <div class="r-field"><b>件名</b><span>${esc(p?.name||'')}</span></div><div class="r-field"><b>試料名</b><span>${esc(sample)}</span></div>
      <div class="r-field"><b>試験項目</b><span>${esc(meta.item||'室内土質試験')}</span></div><div class="r-field"><b>深さ</b><span>${esc(meta.depth||'')}</span></div>
      <div class="r-field"><b>試験日</b><span>${esc(meta.testDate||'')}</span></div><div class="r-field"><b>試験者</b><span>${esc(meta.tester||'')}</span></div>
    </div><div class="r-small" style="text-align:right">3 / 3</div>`;
  }

  function atterbergSection(test){
    const liquid=Array.isArray(test?.liquid)?test.liquid:[];
    const plastic=Array.isArray(test?.plastic)?test.plastic:[];
    const llRows=Array.from({length:6},(_,i)=>liquid[i]||{});
    const plRows=Array.from({length:3},(_,i)=>plastic[i]||{});
    return `<div class="r-section"><div class="r-section-title">液性限界・塑性限界試験 <span class="r-small">JIS A 1205 / JGS 0141</span></div>
      <table class="r-table"><tr><th colspan="7">液性限界</th></tr><tr><th>No.</th><th>落下回数 N</th><th>容器No.</th><th>容器質量 m<sub>c</sub> (g)</th><th>容器＋湿潤土 m<sub>a</sub> (g)</th><th>容器＋乾燥土 m<sub>b</sub> (g)</th><th>w (%)</th></tr>
      ${llRows.map((r,i)=>`<tr><td>${i+1}</td><td>${f(r.N,0)}</td><td>${esc(r.containerNo||'')}</td><td>${f(r.containerMass,1)}</td><td>${f(r.wetMass,1)}</td><td>${f(r.dryMass,1)}</td><td>${f(r.moisture,1)}</td></tr>`).join('')}</table>
      <div style="height:5px"></div>
      <table class="r-table"><tr><th colspan="6">塑性限界</th></tr><tr><th>No.</th><th>容器No.</th><th>容器質量 m<sub>c</sub> (g)</th><th>容器＋湿潤土 m<sub>a</sub> (g)</th><th>容器＋乾燥土 m<sub>b</sub> (g)</th><th>w (%)</th></tr>
      ${plRows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.containerNo||'')}</td><td>${f(r.containerMass,1)}</td><td>${f(r.wetMass,1)}</td><td>${f(r.dryMass,1)}</td><td>${f(r.moisture,1)}</td></tr>`).join('')}</table>
      <div class="r-metric-grid" style="grid-template-columns:repeat(4,1fr)">
        <div class="r-metric"><span>液性限界 wL</span><strong>${f(test?.liquidLimit,1)}</strong><span>%</span></div>
        <div class="r-metric"><span>塑性限界 wP</span><strong>${f(test?.plasticLimit,1)}</strong><span>%</span></div>
        <div class="r-metric"><span>塑性指数 IP</span><strong>${f(test?.plasticityIndex,1)}</strong></div>
        <div class="r-metric"><span>流動指数 If</span><strong>${f(test?.flowIndex,1)}</strong></div>
      </div>
    </div>`;
  }

  function coneSection(test){
    const waters=Array.isArray(test?.moistureMeasurements)?test.moistureMeasurements:[];
    const wr=Array.from({length:2},(_,i)=>waters[i]||{});
    const pens=Array.isArray(test?.penetrations)?test.penetrations:[];
    const pr=[5,7.5,10].map(depth=>pens.find(x=>Number(x.depth)===depth)||{});
    return `<div class="r-section"><div class="r-section-title">締固めた土のコーン指数試験 <span class="r-small">JIS A 1228 / JGS 0716</span></div>
      <table class="r-table"><tr><th colspan="6">含水比</th></tr><tr><th>測定</th><th>容器No.</th><th>m<sub>a</sub> 容器＋湿潤土 (g)</th><th>m<sub>b</sub> 容器＋乾燥土 (g)</th><th>m<sub>c</sub> 容器 (g)</th><th>w (%)</th></tr>
      ${wr.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.containerNo||'')}</td><td>${f(r.ma,1)}</td><td>${f(r.mb,1)}</td><td>${f(r.mc,1)}</td><td>${f(r.w,1)}</td></tr>`).join('')}
      <tr class="r-total"><th colspan="5">平均含水比 w</th><td>${finite(test?.moistureAverage)?f(test.moistureAverage,1)+' %':''}</td></tr></table>
      <div style="height:5px"></div>
      <table class="r-table"><tr><th>モールドNo.</th><td>${esc(test?.moldNo||'')}</td><th>モールド容量 V</th><td>${finite(test?.moldVolume)?f(test.moldVolume,0)+' cm³':'1000 cm³'}</td></tr>
      <tr><th>モールド質量 m<sub>1</sub></th><td>${finite(test?.moldMass)?f(test.moldMass,1)+' g':''}</td><th>土＋モールド質量 m<sub>2</sub></th><td>${finite(test?.moldSoilMass)?f(test.moldSoilMass,1)+' g':''}</td></tr>
      <tr><th>湿潤密度 ρ<sub>t</sub></th><td>${finite(test?.wetDensity)?f(test.wetDensity,3)+' g/cm³':''}</td><th>乾燥密度 ρ<sub>d</sub></th><td>${finite(test?.dryDensity)?f(test.dryDensity,3)+' g/cm³':''}</td></tr></table>
      <div style="height:5px"></div>
      <table class="r-table"><tr><th>荷重計No.</th><td>No.${esc(test?.loadCellNo||'')}</td><th>容量</th><td>${finite(test?.loadCellCapacity)?f(test.loadCellCapacity,0)+' N':''}</td><th>較正係数 K</th><td>${finite(test?.calibrationFactor)?f(test.calibrationFactor,Number(test?.loadCellNo)===1?3:2)+' N/目盛':''}</td><th>コーン底面積 A</th><td>${finite(test?.coneArea)?f(test.coneArea,2)+' cm²':'3.24 cm²'}</td></tr></table>
      <div style="height:5px"></div>
      <table class="r-table"><tr><th>貫入深さ</th><th>5.0 cm</th><th>7.5 cm</th><th>10.0 cm</th><th>平均貫入抵抗力 Qc</th><th>コーン指数 qc</th></tr>
      <tr><th>荷重計の読み（目盛）</th>${pr.map(r=>`<td>${f(r.reading,1)}</td>`).join('')}<td rowspan="2">${finite(test?.averagePenetrationForce)?f(test.averagePenetrationForce,1)+' N':''}</td><td rowspan="2" style="font-weight:700;font-size:15px">${finite(test?.coneIndex)?f(test.coneIndex,0)+' kN/m²':''}</td></tr>
      <tr><th>貫入抵抗力 (N)</th>${pr.map(r=>`<td>${f(r.force,1)}</td>`).join('')}</tr></table>
    </div>`;
  }

  function makePage3(p,sample,att,cone){
    const meta=metaFor(p,sample);
    return `<section class="report-page" id="reportPage3">${header(p,sample,meta)}${atterbergSection(att)}${coneSection(cone)}</section>`;
  }

  function patchCounters(total){
    const p1=document.querySelector('#reportPage1 > .r-small');
    const p2=document.querySelector('#reportPage2 > .r-small');
    if(p1)p1.textContent=`1 / ${total}`;
    if(p2)p2.textContent=`2 / ${total}`;
    const hint=document.querySelector('#reportSheetDialog .report-ui span');
    if(hint)hint.textContent=total===3?'保存済み試験から1・2・3枚目を自動作成':'保存済み試験から1・2枚目を自動作成';
  }

  function enhance(){
    const root=document.getElementById('reportPages');
    const select=document.getElementById('reportSampleSelect');
    const p=project();
    if(!root||!select||!p||!document.getElementById('reportPage1'))return;
    if(document.getElementById('reportPage3')){patchCounters(3);return;}
    const sample=select.value||'';
    const att=latest(p.tests,'atterberg',sample);
    const cone=latest(p.tests,'cone-index',sample);
    if(!att&&!cone){patchCounters(2);return;}
    root.insertAdjacentHTML('beforeend',makePage3(p,sample,att,cone));
    patchCounters(3);
  }

  function setup(){
    const root=document.getElementById('reportPages');
    if(!root)return;
    const observer=new MutationObserver(()=>requestAnimationFrame(enhance));
    observer.observe(root,{childList:true,subtree:false});
    document.getElementById('reportSampleSelect')?.addEventListener('change',()=>requestAnimationFrame(enhance));
    requestAnimationFrame(enhance);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(setup,0));else setTimeout(setup,0);
})();