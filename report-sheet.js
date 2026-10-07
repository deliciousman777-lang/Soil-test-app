// 2ページ土質試験データシート（保存済み試験データから自動作成）
(function(){
  const SVG='http://www.w3.org/2000/svg';
  const SIEVE_ORDER=[53,37.5,26.5,19,9.5,4.75,2,0.85,0.425,0.25,0.106,0.075];

  const finite=v=>Number.isFinite(Number(v));
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const f=(v,d=1)=>finite(v)?Number(v).toFixed(d):'';
  const dateValue=v=>{try{return v?new Date(v).toISOString().slice(0,10):''}catch{return''}};

  function latest(tests,type,sample){
    return [...tests].filter(t=>t.type===type&&String(t.sample||'')===String(sample||''))
      .sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')))[0]||null;
  }

  function sampleNames(project){
    return [...new Set((project?.tests||[]).map(t=>String(t.sample||'').trim()).filter(Boolean))];
  }

  function moistureRows(test){
    const arr=Array.isArray(test?.measurements)?test.measurements:[];
    return [0,1,2].map(i=>{
      const m=arr[i]||{};
      return {no:m.containerNo||'',ma:m.wetMass,mb:m.dryMass,mc:m.containerMass,w:m.moisture};
    });
  }

  function pdRows(test){
    const arr=Array.isArray(test?.measurements)?test.measurements:[];
    return [0,1,2].map(i=>{
      const r=arr[i]||{};
      return {no:r.pycnometerNo||'',mb:r.mb1,t:r.t1,ms:r.ms,rho:r.rhoS};
    });
  }

  function sieveMap(test){
    const m=new Map();
    (test?.sieves||[]).forEach(r=>m.set(Number(r.size),r.retained));
    return m;
  }

  function grainPoints(test){
    if(!test||!finite(test.totalDryMass)||Number(test.totalDryMass)<=0)return[];
    const total=Number(test.totalDryMass), fine=Number(test.fineDryMass), by=sieveMap(test);
    let coarse=0,fineCum=0,p2=null; const pts=[];
    SIEVE_ORDER.forEach(size=>{
      const retained=by.get(size);
      if(retained==null||!finite(retained))return;
      if(size>=2){
        coarse+=Number(retained); const p=100-coarse/total*100; if(size===2)p2=p; pts.push({d:size,p});
      }else if(finite(fine)&&fine>0&&finite(p2)){
        fineCum+=Number(retained); const lp=100-fineCum/fine*100; pts.push({d:size,p:p2*lp/100});
      }
    });
    if(test.sedimentation?.enabled){
      (test.sedimentation.rows||[]).forEach(r=>{if(finite(r.d)&&Number(r.d)>0&&finite(r.overall))pts.push({d:Number(r.d),p:Number(r.overall)});});
    }
    return pts.filter(p=>finite(p.d)&&p.d>0&&finite(p.p)).sort((a,b)=>a.d-b.d);
  }

  function metrics(points){
    if(window.grainSmoothMetrics)return window.grainSmoothMetrics(points);
    const dAt=target=>{
      for(let i=0;i<points.length-1;i++){
        const a=points[i],b=points[i+1];
        if(target<Math.min(a.p,b.p)||target>Math.max(a.p,b.p)||a.p===b.p)continue;
        const q=(target-a.p)/(b.p-a.p);
        return Math.pow(10,Math.log10(a.d)+q*(Math.log10(b.d)-Math.log10(a.d)));
      }
      return null;
    };
    const d10=dAt(10),d30=dAt(30),d50=dAt(50),d60=dAt(60);
    return {d10,d30,d50,d60,uc:d10&&d60?d60/d10:null,ucp:d10&&d30&&d60?d30*d30/(d10*d60):null};
  }

  function classify(fr){
    if(!fr)return {code:'',name:''};
    const g=Number(fr.gravel)||0,s=Number(fr.sand)||0,fi=Number(fr.fines)||0;
    if(fi>=50)return {code:'F',name:'細粒土'};
    if(fi>=15)return g>=s?{code:'GF',name:'礫質土'}:{code:'SF',name:'砂質土'};
    return g>=s?{code:'G',name:'礫'}:{code:'S',name:'砂'};
  }

  function inject(){
    const actions=document.querySelector('#detailView .test-actions');
    if(actions&&!document.getElementById('openReportBtn')){
      const b=document.createElement('button'); b.id='openReportBtn'; b.type='button'; b.className='primary'; b.textContent='📄 データシート';
      actions.appendChild(b); b.addEventListener('click',openReport);
    }
    if(document.getElementById('reportSheetDialog'))return;
    const d=document.createElement('dialog'); d.id='reportSheetDialog'; d.className='report-dialog';
    d.innerHTML=`<div class="report-ui"><div><strong>データシート</strong><span>保存済み試験から1・2枚目を自動作成</span></div><label>試料 <select id="reportSampleSelect"></select></label><button id="reportPrintBtn" class="primary">印刷 / PDF</button><button id="reportCloseBtn" class="icon-btn">×</button></div><div id="reportPages" class="report-pages"></div>`;
    document.body.appendChild(d);
    d.querySelector('#reportCloseBtn').addEventListener('click',()=>d.close());
    d.querySelector('#reportSampleSelect').addEventListener('change',renderReport);
    d.querySelector('#reportPrintBtn').addEventListener('click',()=>{saveMeta();window.print();});
    d.addEventListener('input',e=>{if(e.target.matches('[data-report-meta]'))saveMeta();});
    addStyles();
  }

  function addStyles(){
    if(document.getElementById('reportSheetStyles'))return;
    const s=document.createElement('style'); s.id='reportSheetStyles'; s.textContent=`
      .report-dialog{width:min(100vw,1160px);max-width:none;height:96vh;padding:0;border:0;border-radius:16px;background:#e9edeb}.report-dialog::backdrop{background:rgba(0,0,0,.5)}
      .report-ui{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:12px;padding:10px 14px;background:#fff;border-bottom:1px solid #ccd5d1}.report-ui>div{margin-right:auto}.report-ui span{display:block;font-size:11px;color:#65716d}.report-ui label{display:flex;align-items:center;gap:6px}.report-ui select{min-width:150px}
      .report-pages{padding:18px;display:grid;gap:18px;justify-content:center}.report-page{width:210mm;min-height:297mm;background:#fff;padding:10mm 11mm;box-sizing:border-box;color:#111;font-family:-apple-system,BlinkMacSystemFont,"Yu Gothic","Meiryo",sans-serif;font-size:10.5px;box-shadow:0 2px 14px rgba(0,0,0,.12)}
      .r-head{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px}.r-field{display:flex;align-items:center;border-bottom:1px solid #333;min-height:27px}.r-field b{min-width:72px;font-weight:600}.r-field input{flex:1;border:0!important;border-radius:0!important;padding:2px 4px!important;min-height:24px!important;background:transparent!important;color:#111!important;font-size:11px!important}
      .r-section{margin-top:9px}.r-section-title{font-weight:700;font-size:12px;margin:0 0 3px}.r-table{width:100%;border-collapse:collapse;table-layout:fixed}.r-table th,.r-table td{border:1px solid #333;padding:3px 4px;text-align:center;vertical-align:middle;height:23px}.r-table th{font-weight:600;background:#fafafa}.r-left{text-align:left!important}.r-total{font-weight:700}.r-small{font-size:9px;color:#333}.r-grain-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:8px}.r-note{margin-top:3px;font-size:8.5px}.r-metric-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin:7px 0}.r-metric{border:1px solid #444;padding:6px;text-align:center}.r-metric span{display:block;font-size:9px}.r-metric strong{font-size:14px}.r-chart-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:8px}.r-chart{border:1px solid #444;padding:5px}.r-chart svg{width:100%;height:auto;display:block}.r-frac{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin:7px 0}.r-frac div{border:1px solid #444;padding:7px;text-align:center}.r-frac strong{display:block;font-size:16px}.r-class{border:1px solid #444;padding:7px;text-align:center;font-weight:700;margin-top:5px}
      @media(max-width:900px){.report-page{width:100%;min-height:auto;padding:14px}.r-chart-grid,.r-grain-grid{grid-template-columns:1fr}.report-pages{padding:8px}.report-dialog{height:98vh}}
      @media print{@page{size:A4 portrait;margin:0}.topbar,main,.report-ui{display:none!important}body{background:#fff!important}.report-dialog{position:static!important;display:block!important;width:auto!important;height:auto!important;max-height:none!important;margin:0!important;padding:0!important;border:0!important;background:#fff!important}.report-dialog::backdrop{display:none}.report-pages{display:block!important;padding:0!important}.report-page{width:210mm!important;min-height:297mm!important;box-shadow:none!important;margin:0!important;page-break-after:always;break-after:page}.report-page:last-child{page-break-after:auto;break-after:auto}}
    `; document.head.appendChild(s);
  }

  function openReport(){
    const p=currentProject(); if(!p)return;
    const sel=document.getElementById('reportSampleSelect'); const names=sampleNames(p);
    sel.innerHTML=names.length?names.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join(''):'<option value="">試料なし</option>';
    renderReport(); document.getElementById('reportSheetDialog').showModal();
  }

  function metaFor(p,sample){
    p.reportMeta=p.reportMeta||{};
    p.reportMeta[sample]=p.reportMeta[sample]||{depth:'',tester:'',testDate:'',item:'室内土質試験'};
    return p.reportMeta[sample];
  }
  function saveMeta(){
    const p=currentProject(); const sample=document.getElementById('reportSampleSelect')?.value; if(!p||!sample)return;
    const m=metaFor(p,sample);
    document.querySelectorAll('#reportPages [data-report-meta]').forEach(el=>m[el.dataset.reportMeta]=el.value);
    saveData();
  }

  function renderReport(){
    const p=currentProject(); const sample=document.getElementById('reportSampleSelect')?.value||''; const root=document.getElementById('reportPages'); if(!p||!root)return;
    const moisture=latest(p.tests,'moisture',sample), pd=latest(p.tests,'particleDensity',sample), grain=latest(p.tests,'grain',sample), meta=metaFor(p,sample);
    root.innerHTML=page1(p,sample,meta,moisture,pd,grain)+page2(p,sample,meta,grain);
    drawReportCurve(grain); drawReportTernary(grain);
  }

  function top(p,sample,meta,page){
    return `<div class="r-head">
      <div class="r-field"><b>件名</b><span>${esc(p.name||'')}</span></div><div class="r-field"><b>試料名</b><span>${esc(sample)}</span></div>
      <div class="r-field"><b>試験項目</b><input data-report-meta="item" value="${esc(meta.item||'室内土質試験')}"></div><div class="r-field"><b>深さ</b><input data-report-meta="depth" value="${esc(meta.depth||'')}"></div>
      <div class="r-field"><b>試験日</b><input type="date" data-report-meta="testDate" value="${esc(meta.testDate||'')}"></div><div class="r-field"><b>試験者</b><input data-report-meta="tester" value="${esc(meta.tester||'')}"></div>
    </div><div class="r-small" style="text-align:right">${page} / 2</div>`;
  }

  function page1(p,sample,meta,moisture,pd,grain){
    const prs=pdRows(pd), mrs=moistureRows(moisture), sm=sieveMap(grain), sed=grain?.sedimentation;
    const avgPd=finite(pd?.particleDensityAverage)?Number(pd.particleDensityAverage):null;
    const avgW=finite(moisture?.moistureAverage)?Number(moisture.moistureAverage):null;
    const coarse=[75,53,37.5,26.5,19,9.5,4.75,2], fine=[0.85,0.425,0.25,0.106,0.075];
    const sedRows=sed?.rows||[], cylinder=sed?.settings?.cylinderNo||'';
    return `<section class="report-page" id="reportPage1">${top(p,sample,meta,1)}
      <div class="r-section"><div class="r-section-title">土粒子の密度</div><table class="r-table"><tr><th>ピクノメーター No.</th>${prs.map(r=>`<td>${esc(r.no)}</td>`).join('')}</tr><tr><th>(試料+蒸留水+ピクノメーター) m<sub>b</sub> (g)</th>${prs.map(r=>`<td>${f(r.mb,3)}</td>`).join('')}</tr><tr><th>m<sub>b</sub>測定時の温度 T (℃)</th>${prs.map(r=>`<td>${f(r.t,1)}</td>`).join('')}</tr><tr><th>試料の炉乾燥質量 m<sub>s</sub> (g)</th>${prs.map(r=>`<td>${f(r.ms,3)}</td>`).join('')}</tr><tr><th>土粒子の密度 ρ<sub>s</sub> (Mg/m³)</th>${prs.map(r=>`<td>${f(r.rho,3)}</td>`).join('')}</tr><tr class="r-total"><th>平均値</th><td colspan="3">${avgPd!=null?avgPd.toFixed(3):''}</td></tr></table></div>

      <div class="r-section"><div class="r-section-title">含水比試験</div><table class="r-table"><tr><th>No.</th>${mrs.map(r=>`<td>${esc(r.no)}</td>`).join('')}</tr><tr><th>m<sub>a</sub> 容器＋湿潤土 (g)</th>${mrs.map(r=>`<td>${f(r.ma,1)}</td>`).join('')}</tr><tr><th>m<sub>b</sub> 容器＋乾燥土 (g)</th>${mrs.map(r=>`<td>${f(r.mb,1)}</td>`).join('')}</tr><tr><th>m<sub>c</sub> 容器質量 (g)</th>${mrs.map(r=>`<td>${f(r.mc,1)}</td>`).join('')}</tr><tr><th>w (%)</th>${mrs.map(r=>`<td>${f(r.w,1)}</td>`).join('')}</tr><tr class="r-total"><th>平均含水比</th><td colspan="3">${avgW!=null?avgW.toFixed(1)+' %':''}</td></tr></table></div>

      <div class="r-section"><div class="r-section-title">粒度試験</div><table class="r-table"><tr><th class="r-left">全試料の炉乾燥質量</th><td>${f(grain?.totalDryMass,1)} g</td><th class="r-left">2 mmふるい通過試料</th><td>${sed?.enabled?'沈降あり':'沈降なし'}</td></tr><tr><th class="r-left">2 mm通過分の炉乾燥質量 / 沈降用質量</th><td>${f(grain?.fineDryMass,1)} g</td><th class="r-left">メスシリンダーNo.</th><td>${esc(cylinder)}</td></tr></table>
      <div class="r-grain-grid" style="margin-top:6px"><div><table class="r-table"><tr><th colspan="4">沈降分析</th></tr><tr><th>測定時刻</th><th>経過時間(min)</th><th>浮ひょう</th><th>温度(℃)</th></tr>${[1,2,5,15,30,60,240,1440].map((t,i)=>{const r=sedRows[i]||{};return`<tr><td>${esc(r.clock||'')}</td><td>${t}</td><td>${r.r!=null?String(r.r):''}</td><td>${f(r.temp??sed?.settings?.waterTemp,1)}</td></tr>`}).join('')}</table></div>
      <div><table class="r-table"><tr><th colspan="2">ふるい分析（2 mm残留分）</th><th colspan="2">ふるい分析（2 mm通過分）</th></tr><tr><th>ふるい(mm)</th><th>残留(g)</th><th>ふるい(mm)</th><th>残留(g)</th></tr>${Array.from({length:8},(_,i)=>{const a=coarse[i],b=fine[i];return`<tr><td>${a??''}</td><td>${a!=null?f(sm.get(a),1):''}</td><td>${b??''}</td><td>${b!=null?f(sm.get(b),2):''}</td></tr>`}).join('')}</table></div></div></div>
    </section>`;
  }

  function fmtD(v){if(!finite(v)||Number(v)<=0)return'';const n=Number(v);return n>=1?n.toFixed(3):n.toPrecision(3);}
  function page2(p,sample,meta,grain){
    const fr=grain?.fractions||null, pts=grainPoints(grain), m=metrics(pts), cl=classify(fr);
    return `<section class="report-page" id="reportPage2">${top(p,sample,meta,2)}<div class="r-section"><div class="r-section-title">粒度試験結果</div>
      <div class="r-frac"><div>礫分<strong>${fr?f(fr.gravel,1)+' %':''}</strong></div><div>砂分<strong>${fr?f(fr.sand,1)+' %':''}</strong></div><div>細粒分<strong>${fr?f(fr.fines,1)+' %':''}</strong></div></div>
      <div class="r-metric-grid"><div class="r-metric"><span>D10</span><strong>${fmtD(m.d10)}</strong><span>mm</span></div><div class="r-metric"><span>D30</span><strong>${fmtD(m.d30)}</strong><span>mm</span></div><div class="r-metric"><span>D50</span><strong>${fmtD(m.d50)}</strong><span>mm</span></div><div class="r-metric"><span>D60</span><strong>${fmtD(m.d60)}</strong><span>mm</span></div><div class="r-metric"><span>Uc</span><strong>${finite(m.uc)?Number(m.uc).toFixed(2):''}</strong></div><div class="r-metric"><span>Uc'</span><strong>${finite(m.ucp)?Number(m.ucp).toFixed(2):''}</strong></div><div class="r-metric"><span>2 mm通過</span><strong>${grain?.sedimentation?.settings?.twoMmPassRatio!=null?f(grain.sedimentation.settings.twoMmPassRatio,1)+' %':''}</strong></div><div class="r-metric"><span>分類</span><strong>${esc(cl.code)}</strong></div></div>
      <div class="r-chart-grid"><div class="r-chart"><b>粒径加積曲線</b><svg id="reportCurveSvg" viewBox="0 0 720 390"></svg></div><div class="r-chart"><b>礫・砂・細粒分 三角座標</b><svg id="reportTernarySvg" viewBox="0 0 520 455"></svg><div class="r-class">分類：${esc(cl.name)}${cl.code?'（'+esc(cl.code)+'）':''}</div></div></div>
      </div></section>`;
  }

  function se(name,attrs={},text=''){const e=document.createElementNS(SVG,name);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,String(v)));if(text)e.textContent=text;return e;}
  function drawReportCurve(grain){
    const svg=document.getElementById('reportCurveSvg');if(!svg)return;svg.innerHTML='';const pts=grainPoints(grain);const W=720,H=390,L=62,R=18,T=22,B=50,pw=W-L-R,ph=H-T-B,x=d=>L+(Math.log10(d)+3)/5*pw,y=p=>T+(100-p)/100*ph;
    svg.appendChild(se('rect',{x:L,y:T,width:pw,height:ph,fill:'#fff',stroke:'#555'}));
    for(let p=0;p<=100;p+=10){const yy=y(p);svg.appendChild(se('line',{x1:L,y1:yy,x2:W-R,y2:yy,stroke:'#ddd'}));svg.appendChild(se('text',{x:L-7,y:yy+3,'text-anchor':'end','font-size':9},String(p)));}
    [0.001,.01,.1,1,10,100].forEach(d=>{const xx=x(d);svg.appendChild(se('line',{x1:xx,y1:T,x2:xx,y2:H-B,stroke:'#ddd'}));svg.appendChild(se('text',{x:xx,y:H-B+16,'text-anchor':'middle','font-size':9},String(d)));});
    [0.075,2].forEach(d=>svg.appendChild(se('line',{x1:x(d),y1:T,x2:x(d),y2:H-B,stroke:'#777','stroke-dasharray':'4 3'})));
    const vis=pts.filter(q=>q.d>=.001&&q.d<=100&&q.p>=0&&q.p<=100);if(vis.length){svg.appendChild(se('polyline',{points:vis.map(q=>`${x(q.d)},${y(q.p)}`).join(' '),fill:'none',stroke:'#111','stroke-width':2}));vis.forEach(q=>svg.appendChild(se('circle',{cx:x(q.d),cy:y(q.p),r:3.2,fill:'#111'})));}
    svg.appendChild(se('text',{x:W/2,y:H-7,'text-anchor':'middle','font-size':10},'粒径 d (mm)'));svg.appendChild(se('text',{x:14,y:H/2,'text-anchor':'middle','font-size':10,transform:`rotate(-90 14 ${H/2})`},'通過質量百分率 (%)'));
  }

  function drawReportTernary(grain){
    const svg=document.getElementById('reportTernarySvg');if(!svg)return;svg.innerHTML='';const fr=grain?.fractions;if(!fr)return;
    const V={g:{x:55,y:400},s:{x:465,y:400},f:{x:260,y:45}};const point=(g,s,fi)=>({x:(g*V.g.x+s*V.s.x+fi*V.f.x)/100,y:(g*V.g.y+s*V.s.y+fi*V.f.y)/100});
    svg.appendChild(se('polygon',{points:`${V.g.x},${V.g.y} ${V.s.x},${V.s.y} ${V.f.x},${V.f.y}`,fill:'#fff',stroke:'#111','stroke-width':2}));
    [5,15,50,85,95].forEach(q=>{const a=point(100-q,0,q),b=point(0,100-q,q);svg.appendChild(se('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:q===15||q===50?'#555':'#bbb','stroke-width':q===15||q===50?1.5:1,'stroke-dasharray':q===15||q===50?'':'3 3'}));});
    const midA=point(50,50,0),midB=point(25,25,50);svg.appendChild(se('line',{x1:midA.x,y1:midA.y,x2:midB.x,y2:midB.y,stroke:'#555','stroke-width':1.5}));
    [['G',135,350],['S',385,350],['GF',170,245],['SF',350,245],['F',260,145]].forEach(a=>svg.appendChild(se('text',{x:a[1],y:a[2],'text-anchor':'middle','font-size':18,'font-weight':'700'},a[0])));
    svg.appendChild(se('text',{x:55,y:425,'text-anchor':'middle','font-size':11},'礫分100%'));svg.appendChild(se('text',{x:465,y:425,'text-anchor':'middle','font-size':11},'砂分100%'));svg.appendChild(se('text',{x:260,y:28,'text-anchor':'middle','font-size':11},'細粒分100%'));
    const p=point(Number(fr.gravel)||0,Number(fr.sand)||0,Number(fr.fines)||0);svg.appendChild(se('circle',{cx:p.x,cy:p.y,r:7,fill:'#111',stroke:'#fff','stroke-width':2}));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inject);else inject();
})();