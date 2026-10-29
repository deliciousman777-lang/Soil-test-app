// データシート：一軸圧縮試験（写真様式 / 3配合 × 3供試体）
(function(){
  'use strict';

  const TYPE='unconfined-compression';
  const finite=v=>v!==null&&v!==''&&Number.isFinite(Number(v));
  const f=(v,d=1)=>finite(v)?Number(v).toFixed(d):'';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  function project(){
    try{return state.data.projects.find(p=>p.id===state.currentProjectId)||null;}
    catch{return null;}
  }

  function testRows(p,sample){
    const rows=[...(p?.tests||[])].filter(t=>t.type===TYPE&&String(t.sample||'')===String(sample||''));
    const byDosage=new Map();
    rows.sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||''))).forEach(t=>{
      const key=finite(t.dosage)?String(Number(t.dosage)):`manual:${t.id||t.createdAt||Math.random()}`;
      if(!byDosage.has(key))byDosage.set(key,t);
    });
    return [...byDosage.values()].sort((a,b)=>{
      const av=finite(a.dosage)?Number(a.dosage):Number.POSITIVE_INFINITY;
      const bv=finite(b.dosage)?Number(b.dosage):Number.POSITIVE_INFINITY;
      return av-bv;
    }).slice(0,3);
  }

  function date(v){
    if(!v)return '';
    const m=String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m?`${Number(m[2])}/${Number(m[3])}`:String(v);
  }

  function sketchSvg(strokes){
    const arr=Array.isArray(strokes)?strokes:[];
    const lines=arr.map(stroke=>{
      const points=(Array.isArray(stroke)?stroke:[]).map(p=>`${Math.max(0,Math.min(1,Number(p.x)||0))*100},${Math.max(0,Math.min(1,Number(p.y)||0))*160}`).join(' ');
      return points?`<polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`:'';
    }).join('');
    return `<svg viewBox="0 0 100 160" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>`;
  }

  function displaySample(t,fallbackSample){
    if(t&&finite(t.dosage)&&Number(t.dosage)>0)return f(t.dosage,0);
    return esc(t?.sample||fallbackSample||'');
  }

  function block(test,index,fallbackSample){
    const t=test||{};
    const ss=Array.from({length:3},(_,i)=>(Array.isArray(t.specimens)?t.specimens[i]:null)||{});
    return `<div class="ucs-block">
      <div class="ucs-left">
        <table class="ucs-table" aria-label="一軸圧縮試験 配合${index+1}">
          <tr><th>試　料　名</th><td colspan="3" class="ucs-sample">${displaySample(test,fallbackSample)}</td></tr>
          <tr><th>試　験　日</th><td class="ucs-date-label">改良日</td><td>${esc(date(t.improvementDate))}</td><td class="ucs-date-cell"><span>圧縮日</span><b>${esc(date(t.compressionDate))}</b></td></tr>
          <tr><th>供 試 体 番 号</th>${ss.map((_,i)=>`<td>${i+1}</td>`).join('')}</tr>
          <tr><th>供 試 体 状 態</th>${ss.map(s=>`<td>${esc(s.state||'')}</td>`).join('')}</tr>
          <tr><th>質　量　(g)</th>${ss.map(s=>`<td>${f(s.mass,1)}</td>`).join('')}</tr>
          <tr><th>直 径 D　(cm)</th>${ss.map(s=>`<td>${f(s.diameter,2)}</td>`).join('')}</tr>
          <tr><th>高 さ L　(cm)</th>${ss.map(s=>`<td>${f(s.height,2)}</td>`).join('')}</tr>
          <tr><th>最 大 値 (kN/m²)</th>${ss.map(s=>`<td class="ucs-max">${f(s.maxStrength,1)}</td>`).join('')}</tr>
          <tr><th>記　事</th>${ss.map(s=>`<td>${esc(s.note||'')}</td>`).join('')}</tr>
        </table>
      </div>
      <div class="ucs-right">
        ${ss.map((s,i)=>{
          const m=s.moisture||{};
          return `<div class="ucs-spec">
            <div class="ucs-no">${i+1}</div>
            <div class="ucs-sketch">${sketchSvg(s.sketch)}</div>
            <table class="ucs-moist" aria-label="供試体${i+1}の含水比容器データ">
              <tr><th>容器</th><td>${esc(m.containerNo||'')}</td></tr>
              <tr><th>ma</th><td>${f(m.ma,1)}</td></tr>
              <tr><th>mb</th><td>${f(m.mb,1)}</td></tr>
              <tr><th>mc</th><td>${f(m.mc,1)}</td></tr>
            </table>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  function page(p,sample,arr){
    const cardNo=String(p?.constructionCardNo||'').trim().toUpperCase();
    return `<section class="report-page ucs-page" id="reportUnconfinedPage">
      <div class="ucs-head">
        <div class="ucs-title-line"><span>件　名</span><strong>${esc(p?.name||'')}</strong></div>
        <div class="ucs-sheet-name">一軸圧縮試験　データシート</div>
      </div>
      <div class="r-small ucs-page-info" style="font-weight:${cardNo?'700':'400'}">${cardNo?`施工カード No. ${esc(cardNo)}　　`:''}1 / 1</div>
      <div class="ucs-blocks">${[0,1,2].map(i=>block(arr[i]||null,i,sample)).join('')}</div>
      <div class="ucs-foot">JIS A 1216 / JGS 0511</div>
    </section>`;
  }

  function styles(){
    if(document.getElementById('ucsReportStyles'))return;
    const s=document.createElement('style');
    s.id='ucsReportStyles';
    s.textContent=`
      .ucs-page{font-size:9.2px;padding:8mm 8mm 7mm!important;display:flex!important;flex-direction:column;min-height:297mm!important;height:297mm;overflow:hidden}
      .ucs-head{position:relative;min-height:14mm;margin-bottom:1.5mm}.ucs-title-line{display:grid;grid-template-columns:18mm 1fr;align-items:end;gap:2mm;padding-top:3mm}.ucs-title-line span{font-weight:700;letter-spacing:.15em}.ucs-title-line strong{border-bottom:1px solid #222;min-height:6mm;font-size:11px;padding:0 1.5mm;display:flex;align-items:end}.ucs-sheet-name{position:absolute;right:0;top:0;font-size:10px;font-weight:700;letter-spacing:.08em}.ucs-page-info{text-align:right;height:4mm;line-height:4mm;margin-bottom:1mm}.ucs-blocks{display:grid;grid-template-rows:repeat(3,1fr);gap:3mm;flex:1;min-height:0}.ucs-block{display:grid;grid-template-columns:47% 53%;gap:3mm;min-height:0;break-inside:avoid;page-break-inside:avoid}.ucs-left,.ucs-right{min-width:0;min-height:0}
      .ucs-table{width:100%;height:100%;border-collapse:collapse;table-layout:fixed}.ucs-table th,.ucs-table td{border:1px solid #222;padding:.7mm 1mm;text-align:center;vertical-align:middle;line-height:1.15}.ucs-table th{width:29%;font-weight:600;background:#fff;letter-spacing:.03em}.ucs-table td{font-size:9.3px}.ucs-sample{font-size:14px!important;font-weight:700;height:8mm}.ucs-date-label{font-weight:600;width:17%}.ucs-date-cell{display:flex;justify-content:space-between;align-items:center;height:100%;box-sizing:border-box}.ucs-date-cell span{font-weight:600}.ucs-date-cell b{font-weight:500}.ucs-max{font-size:11px!important;font-weight:700}
      .ucs-right{display:grid;grid-template-columns:repeat(3,1fr);gap:3.2mm;align-items:stretch}.ucs-spec{display:grid;grid-template-rows:5mm 1fr 30mm;min-width:0;text-align:center}.ucs-no{font-size:10px;line-height:5mm}.ucs-sketch{width:18mm;min-height:35mm;max-height:42mm;border:1px dashed #666;margin:0 auto 1.5mm;color:#111;align-self:center}.ucs-sketch svg{width:100%;height:100%;display:block}.ucs-moist{width:100%;border-collapse:collapse;table-layout:fixed;align-self:end}.ucs-moist th,.ucs-moist td{border:1px solid #222;height:6.6mm;padding:.4mm .7mm;text-align:center;vertical-align:middle;font-size:9px}.ucs-moist th{width:43%;font-weight:500}.ucs-foot{text-align:right;font-size:7.5px;margin-top:1.5mm;color:#444}
      @media(max-width:900px){.ucs-page{height:auto!important;min-height:auto!important;padding:12px!important}.ucs-blocks{display:block}.ucs-block{grid-template-columns:1fr;margin-top:16px}.ucs-right{min-height:210px}.ucs-sketch{height:110px;max-height:none}.ucs-spec{grid-template-rows:24px 1fr 108px}}
      @media print{#soilnotePrintRoot .ucs-page{width:210mm!important;height:297mm!important;min-height:297mm!important;padding:8mm 8mm 7mm!important;overflow:hidden!important}#soilnotePrintRoot .ucs-block{page-break-inside:avoid!important;break-inside:avoid!important}}
    `;
    document.head.appendChild(s);
  }

  function renumber(root){
    if(!root)return;
    const pages=[...root.querySelectorAll(':scope > .report-page')],total=pages.length;
    pages.forEach((pg,i)=>{
      const counter=pg.querySelector(':scope > .ucs-page-info, :scope > .r-small');
      if(counter)counter.textContent=counter.textContent.replace(/\d+\s*\/\s*\d+\s*$/,`${i+1} / ${total}`);
    });
    const hint=document.querySelector('#reportSheetDialog .report-ui span');
    if(hint)hint.textContent=`保存済み試験から全 ${total} 枚を自動作成`;
  }

  function enhance(root=document.getElementById('reportPages')){
    styles();
    const p=project(),sel=document.getElementById('reportSampleSelect');
    if(!root||!p||!sel||!root.querySelector('.report-page'))return;
    root.querySelector('#reportUnconfinedPage')?.remove();
    const arr=testRows(p,sel.value||'');
    if(arr.length)root.insertAdjacentHTML('beforeend',page(p,sel.value||'',arr));
    renumber(root);
  }

  function setup(){
    const root=document.getElementById('reportPages');
    if(!root){setTimeout(setup,50);return;}
    new MutationObserver(()=>requestAnimationFrame(()=>enhance(root))).observe(root,{childList:true,subtree:false});
    document.getElementById('reportSampleSelect')?.addEventListener('change',()=>requestAnimationFrame(()=>enhance(root)));
    document.addEventListener('click',e=>{
      if(!e.target.closest?.('#reportPrintBtn'))return;
      enhance(root);
      setTimeout(()=>{
        const pr=document.getElementById('soilnotePrintRoot');
        if(!pr)return;
        pr.querySelector('#reportUnconfinedPage')?.remove();
        const p=project(),sel=document.getElementById('reportSampleSelect'),arr=testRows(p,sel?.value||'');
        if(arr.length)pr.insertAdjacentHTML('beforeend',page(p,sel?.value||'',arr));
        renumber(pr);
      },0);
    },true);
    requestAnimationFrame(()=>enhance(root));
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(setup,0));
  else setTimeout(setup,0);
})();
