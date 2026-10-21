// 突固めによる土の締固め試験 JIS A 1210 / JGS 0711
(function(){
  'use strict';
  const TYPE='compaction';
  const POINT_COUNT=8;
  const TRIAXIAL_VOLUME=196.35; // cm3
  const PERMEABILITY_VOLUME=1000; // cm3
  const METHOD_PRESETS={
    'B-b':{rammerMass:'2.5',dropHeight:'30',blows:'55',layers:'3',moldDiameter:'15',moldHeight:'12.50',moldVolume:'2209',maxParticle:'37.5',preparation:'乾燥法・非繰返し法'},
    'A-b':{rammerMass:'2.5',dropHeight:'30',blows:'25',layers:'3',moldDiameter:'10',moldHeight:'12.73',moldVolume:'1000',maxParticle:'19',preparation:'乾燥法・非繰返し法'},
    'B-c':{rammerMass:'2.5',dropHeight:'30',blows:'55',layers:'3',moldDiameter:'15',moldHeight:'12.50',moldVolume:'2209',maxParticle:'37.5',preparation:'湿潤法・非繰返し法'},
    'A-c':{rammerMass:'2.5',dropHeight:'30',blows:'25',layers:'3',moldDiameter:'10',moldHeight:'12.73',moldVolume:'1000',maxParticle:'19',preparation:'湿潤法・非繰返し法'},
    'E':{rammerMass:'4.5',dropHeight:'45',blows:'92',layers:'3',moldDiameter:'15',moldHeight:'12.50',moldVolume:'2209',maxParticle:'37.5',preparation:'乾燥法・非繰返し法'}
  };
  const num=v=>{const s=String(v??'').trim();if(s==='')return null;const n=Number(s);return Number.isFinite(n)?n:null;};
  const esc=v=>typeof escapeHtml==='function'?escapeHtml(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  function formEl(){return document.getElementById('compactionForm');}
  function dialogEl(){return document.getElementById('compactionDialog');}

  function applyMethodPreset(method){
    const f=formEl(),preset=METHOD_PRESETS[method];
    if(!f||!preset)return;
    Object.entries(preset).forEach(([name,value])=>{if(f.elements[name])f.elements[name].value=value;});
  }

  function waterMeasurement(i,j){
    const f=formEl();
    const no=f.elements[`waterNo_${i}_${j}`].value.trim();
    const ma=num(f.elements[`waterMa_${i}_${j}`].value);
    const mb=num(f.elements[`waterMb_${i}_${j}`].value);
    const mc=num(f.elements[`waterMc_${i}_${j}`].value);
    const entered=no!==''||[ma,mb,mc].some(v=>v!==null);
    if(!entered)return {entered:false,valid:false,containerNo:no,ma,mb,mc,w:null};
    const valid=ma!==null&&mb!==null&&mc!==null&&ma>=mb&&mb>mc;
    const w=valid?(ma-mb)/(mb-mc)*100:null;
    return {entered:true,valid,containerNo:no,ma,mb,mc,w};
  }

  function point(i){
    const f=formEl();
    const moldMass=num(f.elements.moldMass.value);
    const volume=num(f.elements.moldVolume.value);
    const moldSoilMass=num(f.elements[`moldSoilMass_${i}`].value);
    const directW=num(f.elements[`averageW_${i}`].value);
    const waters=[waterMeasurement(i,1),waterMeasurement(i,2)];
    const entered=moldSoilMass!==null||directW!==null||waters.some(x=>x.entered);
    const validWaters=waters.filter(x=>x.valid);
    const detailedEntered=waters.some(x=>x.entered);
    const detailedValid=!detailedEntered||waters.every(x=>!x.entered||x.valid);
    const detailedAverage=validWaters.length?validWaters.reduce((s,x)=>s+x.w,0)/validWaters.length:null;
    const w=detailedAverage!==null?detailedAverage:directW;
    const wetDensity=moldMass!==null&&volume!==null&&volume>0&&moldSoilMass!==null&&moldSoilMass>moldMass?(moldSoilMass-moldMass)/volume:null;
    const dryDensity=wetDensity!==null&&w!==null&&w>=0?wetDensity/(1+w/100):null;
    return {index:i,entered,valid:detailedValid&&wetDensity!==null&&dryDensity!==null,w,wetDensity,dryDensity,moldSoilMass,waters,detailedAverage,directW};
  }

  function solveQuadratic(p1,p2,p3){
    const x1=p1.w,y1=p1.dryDensity,x2=p2.w,y2=p2.dryDensity,x3=p3.w,y3=p3.dryDensity;
    const d=(x1-x2)*(x1-x3)*(x2-x3);
    if(!Number.isFinite(d)||Math.abs(d)<1e-9)return null;
    const a=(x3*(y2-y1)+x2*(y1-y3)+x1*(y3-y2))/d;
    const b=(x3*x3*(y1-y2)+x2*x2*(y3-y1)+x1*x1*(y2-y3))/d;
    const c=(x2*x3*(x2-x3)*y1+x3*x1*(x3-x1)*y2+x1*x2*(x1-x2)*y3)/d;
    if(![a,b,c].every(Number.isFinite)||a>=0)return null;
    const xv=-b/(2*a);
    if(xv<Math.min(x1,x3)||xv>Math.max(x1,x3))return null;
    const yv=a*xv*xv+b*xv+c;
    return Number.isFinite(yv)?{w:xv,rho:yv,a,b,c}:null;
  }

  function autoMaximum(points){
    const valid=points.filter(p=>p.valid).sort((a,b)=>a.w-b.w);
    if(!valid.length)return null;
    let peak=0;
    valid.forEach((p,i)=>{if(p.dryDensity>valid[peak].dryDensity)peak=i;});
    const measured={w:valid[peak].w,rho:valid[peak].dryDensity,method:'measured'};
    if(valid.length<3||peak===0||peak===valid.length-1)return measured;
    const fit=solveQuadratic(valid[peak-1],valid[peak],valid[peak+1]);
    if(!fit||fit.rho<measured.rho||fit.rho>measured.rho+0.08)return measured;
    return {...fit,method:'quadratic'};
  }

  function compactionResults(){
    const points=Array.from({length:POINT_COUNT},(_,j)=>point(j+1));
    const valid=points.filter(p=>p.valid);
    const auto=autoMaximum(points);
    const f=formEl();
    let adoptedRho=num(f.elements.adoptedRhoMax.value);
    let adoptedW=num(f.elements.adoptedWopt.value);
    if(adoptedRho===null&&auto)adoptedRho=auto.rho;
    if(adoptedW===null&&auto)adoptedW=auto.w;
    const rho95=adoptedRho!==null?adoptedRho*0.95:null;
    const rho90=adoptedRho!==null?adoptedRho*0.90:null;
    return {points,valid,auto,adoptedRho,adoptedW,rho95,rho90};
  }

  function prepCalc(kind,volume,results){
    const f=formEl();
    const ratio=num(f.elements[`${kind}Ratio`].value);
    const moistureMode=f.elements[`${kind}MoistureMode`].value;
    const naturalW=num(f.elements.naturalWater.value);
    const selectedW=moistureMode==='optimum'?results.adoptedW:naturalW;
    const targetDryDensity=results.adoptedRho!==null&&ratio!==null?results.adoptedRho*(ratio/100):null;
    const dryMass=targetDryDensity!==null?targetDryDensity*volume:null;
    const finalWetMass=dryMass!==null&&selectedW!==null?dryMass*(1+selectedW/100):null;
    const sourceWetMass=dryMass!==null&&naturalW!==null?dryMass*(1+naturalW/100):null;
    const waterAdjustment=dryMass!==null&&selectedW!==null&&naturalW!==null?dryMass*(selectedW-naturalW)/100:null;
    return {kind,volume,ratio,moistureMode,naturalW,selectedW,targetDryDensity,dryMass,finalWetMass,sourceWetMass,waterAdjustment};
  }

  function voice(name){return `<div class="voice-input"><input name="${name}" inputmode="decimal" autocomplete="off"><button type="button" class="mic" data-compaction-voice="${name}" aria-label="音声入力">🎤</button></div>`;}

  function waterDetail(i,j){
    return `<div class="comp-water-card"><div class="specimen-head"><strong>含水比 ${j}</strong><span id="compW_${i}_${j}">— %</span></div><label>容器No.<input name="waterNo_${i}_${j}" autocomplete="off"></label><div class="comp-water-grid"><label>容器＋湿潤土 ma (g)${voice(`waterMa_${i}_${j}`)}</label><label>容器＋乾燥土 mb (g)${voice(`waterMb_${i}_${j}`)}</label><label>容器 mc (g)${voice(`waterMc_${i}_${j}`)}</label></div></div>`;
  }

  function pointCard(i){
    return `<section class="comp-point-card"><div class="specimen-head"><strong>測定 ${i}</strong><span id="compPointSummary_${i}">—</span></div><div class="comp-point-main"><label>試料＋モールド質量 m₂ (g)${voice(`moldSoilMass_${i}`)}</label><label>平均含水比 w (%)<input name="averageW_${i}" inputmode="decimal" autocomplete="off" placeholder="詳細入力時は自動"></label><div class="comp-calc"><span>湿潤密度 ρt</span><strong id="compWet_${i}">—</strong></div><div class="comp-calc"><span>乾燥密度 ρd</span><strong id="compDry_${i}">—</strong></div></div><details class="comp-water-details"><summary>含水比の容器データを入力（任意・2測定）</summary><div class="comp-water-pair">${waterDetail(i,1)}${waterDetail(i,2)}</div></details></section>`;
  }

  function prepPanel(kind,label,volume){
    return `<section class="comp-prep-card"><div class="subsection-head"><div><strong>${label}</strong></div><p>供試体体積 ${volume} cm³</p></div><div class="comp-prep-controls"><label>締固め度<select name="${kind}Ratio"><option value="95">95%</option><option value="90">90%</option></select></label><label>作製含水比<select name="${kind}MoistureMode"><option value="optimum">最適含水比 wopt</option><option value="natural">自然含水比 wn</option></select></label></div><div class="comp-prep-results"><div><span>目標乾燥密度</span><strong id="${kind}TargetRho">—</strong><small>g/cm³</small></div><div><span>乾燥土量</span><strong id="${kind}DryMass">—</strong><small>g</small></div><div><span>最終湿潤試料</span><strong id="${kind}WetMass">—</strong><small>g</small></div><div><span>自然含水土を量り取る量</span><strong id="${kind}SourceMass">—</strong><small>g</small></div><div class="wide"><span>水分調整</span><strong id="${kind}WaterAdjust">—</strong><small id="${kind}WaterAdjustNote"></small></div></div></section>`;
  }

  function injectUI(){
    const actions=document.querySelector('#detailView .test-actions');
    if(actions&&!document.getElementById('addCompactionBtn')){
      const b=document.createElement('button');b.id='addCompactionBtn';b.type='button';b.className='primary secondary';b.textContent='＋ 締固め';actions.appendChild(b);b.addEventListener('click',openNew);
    }
    if(document.getElementById('compactionDialog'))return;
    const d=document.createElement('dialog');d.id='compactionDialog';d.className='wide-dialog comp-dialog';
    d.innerHTML=`<form id="compactionForm" method="dialog"><div class="dialog-head"><div><p class="eyebrow">JIS A 1210 / JGS 0711</p><h2 id="compactionTitle">突固めによる土の締固め試験</h2></div><button type="button" class="icon-btn" id="compactionClose">×</button></div>
      <div class="grid2"><label>試料名 / No.<input name="sample" required autocomplete="off" placeholder="例：現場築堤土A-A断面"></label><label>試験方法<select name="method"><option value="B-b">B-b法</option><option value="A-b">A-b法</option><option value="B-c">B-c法</option><option value="A-c">A-c法</option><option value="E">E法</option></select></label></div>
      <section class="comp-panel"><div class="subsection-head"><div><span class="step-badge">1</span><strong>試験条件</strong></div><p>試験方法を選ぶと標準条件を自動設定します。必要なら変更できます。</p></div><div class="comp-condition-grid"><label>ランマー質量 (kg)<input name="rammerMass" inputmode="decimal" value="2.5"></label><label>落下高さ (cm)<input name="dropHeight" inputmode="decimal" value="30"></label><label>突固め回数 (回/層)<input name="blows" inputmode="numeric" value="55"></label><label>層数<input name="layers" inputmode="numeric" value="3"></label><label>モールド内径 (cm)<input name="moldDiameter" inputmode="decimal" value="15"></label><label>モールド高さ (cm)<input name="moldHeight" inputmode="decimal" value="12.50"></label><label>モールド容量 V (cm³)<input name="moldVolume" inputmode="decimal" value="2209"></label><label>モールド質量 m₁ (g)${voice('moldMass')}</label><label>試料最大粒径 (mm)<input name="maxParticle" inputmode="decimal" value="37.5"></label><label>試料調製<input name="preparation" value="乾燥法・非繰返し法" autocomplete="off"></label></div></section>
      <section class="comp-panel"><div class="subsection-head"><div><span class="step-badge">2</span><strong>測定データ</strong></div><p>平均含水比を直接入力、または容器データから自動計算できます。</p></div><div class="comp-points">${Array.from({length:POINT_COUNT},(_,j)=>pointCard(j+1)).join('')}</div></section>
      <section class="comp-panel"><div class="subsection-head"><div><span class="step-badge">3</span><strong>締固め曲線</strong></div><p>最大点の前後3点から放物線補間。採用値は手修正できます。</p></div><div id="compactionChart" class="comp-chart"><div class="comp-chart-empty">有効な測定値を3点以上入力するとグラフを表示します。</div></div><div class="comp-auto-note" id="compAutoNote">自動推定：—</div><div class="comp-adopt-grid"><label>採用 最大乾燥密度 ρdmax (g/cm³)<input name="adoptedRhoMax" inputmode="decimal"></label><label>採用 最適含水比 wopt (%)<input name="adoptedWopt" inputmode="decimal"></label></div><div class="comp-main-results"><div><span>最大乾燥密度 ρdmax</span><strong id="compRhoMax">—</strong><small>g/cm³</small></div><div><span>最適含水比 wopt</span><strong id="compWopt">—</strong><small>%</small></div><div><span>95% 乾燥密度</span><strong id="compRho95">—</strong><small>g/cm³</small></div><div><span>90% 乾燥密度</span><strong id="compRho90">—</strong><small>g/cm³</small></div></div></section>
      <section class="comp-panel"><div class="subsection-head"><div><span class="step-badge">4</span><strong>三軸・透水 供試体作製量</strong></div><p>締固め度と最適/自然含水比を選んで必要試料量を計算します。</p></div><div class="comp-natural-row"><label>自然含水比 wn (%)<input name="naturalWater" inputmode="decimal" placeholder="例：17.0"></label><button type="button" class="ghost" id="loadNaturalWaterBtn">含水比試験から読込</button></div><div class="comp-prep-grid">${prepPanel('triaxial','三軸圧縮試験',TRIAXIAL_VOLUME)}${prepPanel('permeability','透水試験',PERMEABILITY_VOLUME)}</div><p class="hint">「自然含水土を量り取る量」は wn が入力されている場合に表示。最適含水へ調整する場合は追加水量も計算します。wn が wopt を上回る場合は乾燥調整が必要です。</p></section>
      <div id="compactionCheck" class="mass-check">モールド質量と3点以上の測定値を入力してください。</div><div class="dialog-actions"><button type="button" class="ghost" id="compactionCancel">キャンセル</button><button class="primary" id="compactionSubmit">保存</button></div></form>`;
    document.body.appendChild(d);

    if(!document.getElementById('compactionStyles')){
      const s=document.createElement('style');s.id='compactionStyles';s.textContent=`
      .comp-panel{margin-top:14px;padding:14px;border:1px solid var(--line,#dfe7e3);border-radius:16px;background:#fff}.comp-condition-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:9px}.comp-points{display:grid;gap:10px}.comp-point-card{padding:12px;border:1px solid var(--line,#dfe7e3);border-radius:14px;background:#f8fbfa}.comp-point-main{display:grid;grid-template-columns:1.35fr 1fr .8fr .8fr;gap:9px;align-items:end}.comp-calc{min-height:52px;padding:9px 10px;border:1px solid var(--line,#dfe7e3);border-radius:12px;background:#fff;display:flex;flex-direction:column;justify-content:center}.comp-calc span{font-size:11px;color:var(--muted,#68766e)}.comp-calc strong{font-size:18px;color:var(--accent-dark,#0b5136)}.comp-water-details{margin-top:9px}.comp-water-details summary{cursor:pointer;color:#486158;font-weight:800;font-size:12px}.comp-water-pair{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:9px}.comp-water-card{padding:10px;border:1px solid var(--line,#dfe7e3);border-radius:12px;background:#fff}.comp-water-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.comp-chart{margin-top:10px;border:1px solid var(--line,#dfe7e3);border-radius:14px;background:#fff;padding:8px;overflow:hidden}.comp-chart svg{display:block;width:100%;height:auto}.comp-chart-empty{padding:70px 12px;text-align:center;color:var(--muted,#68766e)}.comp-auto-note{margin-top:8px;font-size:12px;color:var(--muted,#68766e)}.comp-adopt-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:10px}.comp-main-results{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin-top:10px}.comp-main-results>div,.comp-prep-results>div{padding:12px;border:1px solid var(--line,#dfe7e3);border-radius:13px;background:#f8fbfa;text-align:center}.comp-main-results span,.comp-main-results small,.comp-prep-results span,.comp-prep-results small{display:block;font-size:11px;color:var(--muted,#68766e)}.comp-main-results strong,.comp-prep-results strong{display:block;margin:3px 0;font-size:23px;color:var(--accent-dark,#0b5136)}.comp-natural-row{display:grid;grid-template-columns:1fr auto;gap:9px;align-items:end}.comp-prep-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}.comp-prep-card{padding:12px;border:1px solid var(--line,#dfe7e3);border-radius:14px;background:#f8fbfa}.comp-prep-controls{display:grid;grid-template-columns:1fr 1fr;gap:8px}.comp-prep-results{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px}.comp-prep-results .wide{grid-column:1/-1}.comp-dialog select{min-height:46px;border:1px solid var(--line,#dfe7e3);border-radius:12px;background:#fff;padding:0 10px;font-size:15px}.comp-source-warn{color:#a33b20!important}.comp-source-add{color:#087443!important}@media(max-width:900px){.comp-condition-grid{grid-template-columns:repeat(3,1fr)}.comp-point-main{grid-template-columns:1fr 1fr}.comp-main-results{grid-template-columns:1fr 1fr}.comp-prep-grid{grid-template-columns:1fr}}@media(max-width:600px){.comp-condition-grid{grid-template-columns:1fr 1fr}.comp-water-pair,.comp-water-grid,.comp-adopt-grid,.comp-prep-controls{grid-template-columns:1fr}.comp-natural-row{grid-template-columns:1fr}.comp-point-main{grid-template-columns:1fr 1fr}.comp-point-main label{grid-column:1/-1}.comp-main-results{grid-template-columns:1fr 1fr}.comp-prep-results{grid-template-columns:1fr 1fr}}
      `;document.head.appendChild(s);
    }

    const f=formEl();
    f.elements.method.addEventListener('change',()=>applyMethodPreset(f.elements.method.value));
    f.addEventListener('input',updatePreview);f.addEventListener('change',updatePreview);f.addEventListener('submit',saveTest);
    ['adoptedRhoMax','adoptedWopt'].forEach(name=>f.elements[name].addEventListener('input',e=>{if(!f.dataset.autoAdopt)e.target.dataset.manual='1';}));
    d.querySelector('#compactionClose').addEventListener('click',()=>d.close());d.querySelector('#compactionCancel').addEventListener('click',()=>d.close());
    d.querySelector('#loadNaturalWaterBtn').addEventListener('click',loadNaturalWater);
    d.addEventListener('click',e=>{const b=e.target.closest('[data-compaction-voice]');if(b)startCompactionVoice(b.dataset.compactionVoice,b);});
  }

  function setText(id,text){const el=document.getElementById(id);if(el)el.textContent=text;}

  function syncAdopted(auto){
    const f=formEl();if(!auto)return;
    f.dataset.autoAdopt='1';
    if(f.elements.adoptedRhoMax.dataset.manual!=='1')f.elements.adoptedRhoMax.value=auto.rho.toFixed(3);
    if(f.elements.adoptedWopt.dataset.manual!=='1')f.elements.adoptedWopt.value=auto.w.toFixed(1);
    delete f.dataset.autoAdopt;
  }

  function renderGraph(results){
    const box=document.getElementById('compactionChart');
    const pts=results.valid.slice().sort((a,b)=>a.w-b.w);
    if(pts.length<3){box.innerHTML='<div class="comp-chart-empty">有効な測定値を3点以上入力するとグラフを表示します。</div>';return;}
    const extra=results.adoptedRho!==null&&results.adoptedW!==null?[{w:results.adoptedW,dryDensity:results.adoptedRho}]:[];
    const all=pts.concat(extra);
    let xmin=Math.min(...all.map(p=>p.w)),xmax=Math.max(...all.map(p=>p.w));
    let ymin=Math.min(...all.map(p=>p.dryDensity)),ymax=Math.max(...all.map(p=>p.dryDensity));
    const xpad=Math.max(1,(xmax-xmin)*0.10),ypad=Math.max(0.015,(ymax-ymin)*0.18);
    xmin=Math.floor((xmin-xpad)*2)/2;xmax=Math.ceil((xmax+xpad)*2)/2;ymin=Math.floor((ymin-ypad)*100)/100;ymax=Math.ceil((ymax+ypad)*100)/100;
    if(xmax<=xmin)xmax=xmin+2;if(ymax<=ymin)ymax=ymin+0.05;
    const W=760,H=410,L=62,R=20,T=18,B=52,pw=W-L-R,ph=H-T-B;
    const sx=x=>L+(x-xmin)/(xmax-xmin)*pw,sy=y=>T+(ymax-y)/(ymax-ymin)*ph;
    let grid='';
    for(let i=0;i<=6;i++){const x=xmin+(xmax-xmin)*i/6,px=sx(x);grid+=`<line x1="${px}" y1="${T}" x2="${px}" y2="${T+ph}" stroke="#e6ece9"/><text x="${px}" y="${H-24}" text-anchor="middle" font-size="11" fill="#65736d">${x.toFixed(1)}</text>`;}
    for(let i=0;i<=5;i++){const y=ymin+(ymax-ymin)*i/5,py=sy(y);grid+=`<line x1="${L}" y1="${py}" x2="${L+pw}" y2="${py}" stroke="#e6ece9"/><text x="${L-8}" y="${py+4}" text-anchor="end" font-size="11" fill="#65736d">${y.toFixed(3)}</text>`;}
    let path=`M ${sx(pts[0].w)} ${sy(pts[0].dryDensity)}`;
    for(let i=0;i<pts.length-1;i++){
      const p0=pts[i-1]||pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]||p2;
      const cp1x=p1.w+(p2.w-p0.w)/6,cp1y=p1.dryDensity+(p2.dryDensity-p0.dryDensity)/6;
      const cp2x=p2.w-(p3.w-p1.w)/6,cp2y=p2.dryDensity-(p3.dryDensity-p1.dryDensity)/6;
      path+=` C ${sx(cp1x)} ${sy(cp1y)}, ${sx(cp2x)} ${sy(cp2y)}, ${sx(p2.w)} ${sy(p2.dryDensity)}`;
    }
    const circles=pts.map((p,i)=>`<circle cx="${sx(p.w)}" cy="${sy(p.dryDensity)}" r="5" fill="#fff" stroke="#0b6b4b" stroke-width="2"/><text x="${sx(p.w)+7}" y="${sy(p.dryDensity)-7}" font-size="10" fill="#40544b">${i+1}</text>`).join('');
    const max=results.adoptedRho!==null&&results.adoptedW!==null?`<line x1="${sx(results.adoptedW)}" y1="${sy(results.adoptedRho)}" x2="${sx(results.adoptedW)}" y2="${T+ph}" stroke="#9ab8aa" stroke-dasharray="5 5"/><circle cx="${sx(results.adoptedW)}" cy="${sy(results.adoptedRho)}" r="7" fill="#0b6b4b"/><text x="${clamp(sx(results.adoptedW)+10,L+8,W-190)}" y="${Math.max(T+14,sy(results.adoptedRho)-12)}" font-size="12" font-weight="700" fill="#0b5136">ρdmax ${results.adoptedRho.toFixed(3)} / wopt ${results.adoptedW.toFixed(1)}%</text>`:'';
    box.innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="乾燥密度と含水比の締固め曲線"><rect x="0" y="0" width="${W}" height="${H}" fill="#fff"/>${grid}<line x1="${L}" y1="${T+ph}" x2="${L+pw}" y2="${T+ph}" stroke="#51615a"/><line x1="${L}" y1="${T}" x2="${L}" y2="${T+ph}" stroke="#51615a"/><path d="${path}" fill="none" stroke="#0b6b4b" stroke-width="3"/>${circles}${max}<text x="${L+pw/2}" y="${H-4}" text-anchor="middle" font-size="12" fill="#40544b">含水比 w (%)</text><text x="16" y="${T+ph/2}" text-anchor="middle" font-size="12" fill="#40544b" transform="rotate(-90 16 ${T+ph/2})">乾燥密度 ρd (g/cm³)</text></svg>`;
  }

  function renderPrep(kind,a){
    setText(`${kind}TargetRho`,a.targetDryDensity!==null?a.targetDryDensity.toFixed(3):'—');
    setText(`${kind}DryMass`,a.dryMass!==null?a.dryMass.toFixed(1):'—');
    setText(`${kind}WetMass`,a.finalWetMass!==null?a.finalWetMass.toFixed(1):'—');
    setText(`${kind}SourceMass`,a.sourceWetMass!==null?a.sourceWetMass.toFixed(1):'—');
    const main=document.getElementById(`${kind}WaterAdjust`),note=document.getElementById(`${kind}WaterAdjustNote`);
    main.classList.remove('comp-source-warn','comp-source-add');
    if(a.waterAdjustment===null){main.textContent='—';note.textContent=a.moistureMode==='natural'&&a.naturalW===null?'自然含水比を入力':'wn入力で調整量を表示';}
    else if(Math.abs(a.waterAdjustment)<0.05){main.textContent='0.0 g';note.textContent='調整不要';}
    else if(a.waterAdjustment>0){main.textContent=`＋ ${a.waterAdjustment.toFixed(1)} g`;note.textContent='水を追加';main.classList.add('comp-source-add');}
    else{main.textContent=`${a.waterAdjustment.toFixed(1)} g相当`;note.textContent='水分が多いため乾燥調整';main.classList.add('comp-source-warn');}
  }

  function updatePreview(){
    const preliminary=compactionResults();syncAdopted(preliminary.auto);const r=compactionResults();
    r.points.forEach(p=>{
      p.waters.forEach((wm,j)=>setText(`compW_${p.index}_${j+1}`,wm.valid?`${wm.w.toFixed(1)} %`:'— %'));
      if(p.detailedAverage!==null){const input=formEl().elements[`averageW_${p.index}`];if(input.dataset.manual!=='1')input.value=p.detailedAverage.toFixed(1);}
      setText(`compWet_${p.index}`,p.wetDensity!==null?p.wetDensity.toFixed(3):'—');setText(`compDry_${p.index}`,p.dryDensity!==null?p.dryDensity.toFixed(3):'—');
      setText(`compPointSummary_${p.index}`,p.valid?`w ${p.w.toFixed(1)}% ｜ ρd ${p.dryDensity.toFixed(3)}`:(p.entered?'入力確認':'—'));
    });
    setText('compAutoNote',r.auto?`自動推定：ρdmax ${r.auto.rho.toFixed(3)} g/cm³ / wopt ${r.auto.w.toFixed(1)} %（${r.auto.method==='quadratic'?'最大点前後3点の放物線補間':'測定最大値'}）`:'自動推定：—');
    setText('compRhoMax',r.adoptedRho!==null?r.adoptedRho.toFixed(3):'—');setText('compWopt',r.adoptedW!==null?r.adoptedW.toFixed(1):'—');setText('compRho95',r.rho95!==null?r.rho95.toFixed(3):'—');setText('compRho90',r.rho90!==null?r.rho90.toFixed(3):'—');
    renderGraph(r);renderPrep('triaxial',prepCalc('triaxial',TRIAXIAL_VOLUME,r));renderPrep('permeability',prepCalc('permeability',PERMEABILITY_VOLUME,r));
    const check=document.getElementById('compactionCheck');check.classList.remove('error');
    const invalidEntered=r.points.some(p=>p.entered&&!p.valid);
    if(invalidEntered){check.textContent='⚠ 入力済み測点に計算できない値があります。モールド質量・含水比・質量関係を確認してください。';check.classList.add('error');}
    else if(r.valid.length<3){check.textContent=`計算済み ${r.valid.length}点 / 最低3点必要です。`;}
    else if(r.adoptedRho===null||r.adoptedW===null){check.textContent='最大乾燥密度・最適含水比を確認してください。';}
    else{check.textContent=`${r.valid.length}点計算済み ｜ 95%=${r.rho95.toFixed(3)} ｜ 90%=${r.rho90.toFixed(3)} g/cm³`;}
  }

  function resetForm(){
    state.editingTestId=null;const f=formEl();f.reset();
    f.elements.method.value='B-b';applyMethodPreset('B-b');f.elements.triaxialRatio.value='95';f.elements.permeabilityRatio.value='95';f.elements.triaxialMoistureMode.value='optimum';f.elements.permeabilityMoistureMode.value='optimum';
    f.elements.adoptedRhoMax.dataset.manual='';f.elements.adoptedWopt.dataset.manual='';Array.from({length:POINT_COUNT},(_,j)=>f.elements[`averageW_${j+1}`].dataset.manual='');
    document.getElementById('compactionTitle').textContent='突固めによる土の締固め試験';document.getElementById('compactionSubmit').textContent='保存';updatePreview();
  }

  function openNew(){resetForm();dialogEl().showModal();}

  function openEdit(id){
    const p=currentProject();const t=p?.tests.find(x=>x.id===id&&x.type===TYPE);if(!t)return;resetForm();state.editingTestId=id;const f=formEl();
    document.getElementById('compactionTitle').textContent='締固め試験を訂正';document.getElementById('compactionSubmit').textContent='訂正を保存';
    ['sample','method','rammerMass','dropHeight','blows','layers','moldDiameter','moldHeight','moldVolume','moldMass','maxParticle','preparation'].forEach(k=>{if(f.elements[k]&&t[k]!=null)f.elements[k].value=t[k];});
    (t.points||[]).slice(0,POINT_COUNT).forEach((p,j)=>{const i=j+1;f.elements[`moldSoilMass_${i}`].value=p.moldSoilMass??'';f.elements[`averageW_${i}`].value=p.directW??p.w??'';if(p.directW!=null)f.elements[`averageW_${i}`].dataset.manual='1';(p.waters||[]).slice(0,2).forEach((wm,k)=>{const n=k+1;f.elements[`waterNo_${i}_${n}`].value=wm.containerNo??'';f.elements[`waterMa_${i}_${n}`].value=wm.ma??'';f.elements[`waterMb_${i}_${n}`].value=wm.mb??'';f.elements[`waterMc_${i}_${n}`].value=wm.mc??'';});});
    f.elements.adoptedRhoMax.value=t.maxDryDensity??'';f.elements.adoptedWopt.value=t.optimumWaterContent??'';f.elements.adoptedRhoMax.dataset.manual='1';f.elements.adoptedWopt.dataset.manual='1';
    const prep=t.specimenPreparation||{};f.elements.naturalWater.value=prep.naturalWater??'';f.elements.triaxialRatio.value=prep.triaxial?.ratio??95;f.elements.triaxialMoistureMode.value=prep.triaxial?.moistureMode??'optimum';f.elements.permeabilityRatio.value=prep.permeability?.ratio??95;f.elements.permeabilityMoistureMode.value=prep.permeability?.moistureMode??'optimum';updatePreview();dialogEl().showModal();
  }

  function loadNaturalWater(){
    const p=currentProject();const sample=formEl().elements.sample.value.trim();if(!p)return;
    const candidates=(p.tests||[]).filter(t=>t.type==='moisture'&&Number.isFinite(Number(t.moistureAverage))).sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));
    const chosen=candidates.find(t=>sample&&String(t.sample||'').trim()===sample)||candidates[0];
    if(!chosen){alert('この工事件名に保存済みの含水比試験がありません。');return;}
    formEl().elements.naturalWater.value=Number(chosen.moistureAverage).toFixed(1);updatePreview();
  }

  function startCompactionVoice(name,button){
    const f=formEl(),field=f.elements[name];if(!field)return;const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!Recognition){field.focus();return;}const r=new Recognition();r.lang='ja-JP';r.interimResults=false;r.maxAlternatives=1;button.classList.add('listening');r.onresult=e=>{let s=String(e.results[0][0].transcript).trim().replace(/[，,]/g,'').replace(/点/g,'.').replace(/。/g,'.').replace(/[^0-9.\-]/g,'');const d=s.indexOf('.');if(d>=0)s=s.slice(0,d+1)+s.slice(d+1).replace(/\./g,'');if(s){field.value=s;field.dispatchEvent(new Event('input',{bubbles:true}));}};r.onerror=()=>alert('音声入力に失敗しました。');r.onend=()=>button.classList.remove('listening');r.start();
  }

  function saveTest(e){
    e.preventDefault();const f=formEl(),sample=f.elements.sample.value.trim();if(!sample)return;const r=compactionResults();
    if(num(f.elements.moldMass.value)===null){alert('モールド質量 m₁ を入力してください。');return;}if(r.valid.length<3){alert('締固め曲線を作成するため、有効な測定値を3点以上入力してください。');return;}if(r.points.some(p=>p.entered&&!p.valid)){alert('入力済みの測点に計算できない値があります。');return;}if(r.adoptedRho===null||r.adoptedW===null){alert('最大乾燥密度と最適含水比を確認してください。');return;}
    const p=currentProject();if(!p)return;const now=new Date().toISOString();const tri=prepCalc('triaxial',TRIAXIAL_VOLUME,r),perm=prepCalc('permeability',PERMEABILITY_VOLUME,r);
    const payload={sample,method:f.elements.method.value.trim(),rammerMass:num(f.elements.rammerMass.value),dropHeight:num(f.elements.dropHeight.value),blows:num(f.elements.blows.value),layers:num(f.elements.layers.value),moldDiameter:num(f.elements.moldDiameter.value),moldHeight:num(f.elements.moldHeight.value),moldVolume:num(f.elements.moldVolume.value),moldMass:num(f.elements.moldMass.value),maxParticle:num(f.elements.maxParticle.value),preparation:f.elements.preparation.value.trim(),points:r.points.filter(x=>x.entered).map(x=>({index:x.index,moldSoilMass:x.moldSoilMass,directW:x.directW,w:x.w,wetDensity:x.wetDensity,dryDensity:x.dryDensity,waters:x.waters.filter(w=>w.entered).map(w=>({containerNo:w.containerNo,ma:w.ma,mb:w.mb,mc:w.mc,w:w.w}))})),autoMaximum:r.auto?{rho:r.auto.rho,w:r.auto.w,method:r.auto.method}:null,maxDryDensity:r.adoptedRho,optimumWaterContent:r.adoptedW,dryDensity95:r.rho95,dryDensity90:r.rho90,specimenPreparation:{naturalWater:num(f.elements.naturalWater.value),triaxial:{volume:TRIAXIAL_VOLUME,ratio:tri.ratio,moistureMode:tri.moistureMode,selectedW:tri.selectedW,targetDryDensity:tri.targetDryDensity,dryMass:tri.dryMass,finalWetMass:tri.finalWetMass,sourceWetMass:tri.sourceWetMass,waterAdjustment:tri.waterAdjustment},permeability:{volume:PERMEABILITY_VOLUME,ratio:perm.ratio,moistureMode:perm.moistureMode,selectedW:perm.selectedW,targetDryDensity:perm.targetDryDensity,dryMass:perm.dryMass,finalWetMass:perm.finalWetMass,sourceWetMass:perm.sourceWetMass,waterAdjustment:perm.waterAdjustment}}};
    if(state.editingTestId){const t=p.tests.find(x=>x.id===state.editingTestId&&x.type===TYPE);if(!t)return;Object.assign(t,payload,{updatedAt:now});delete t.draft;delete t.draftFields;delete t.draftFieldLabels;delete t.draftSavedAt;}else p.tests.push({id:uid(),type:TYPE,...payload,createdAt:now});
    p.updatedAt=now;saveData();dialogEl().close();resetForm();renderTests();
  }

  function renderCard(t){return `<div class="card-title-row"><div><p class="test-kind">突固めによる土の締固め試験</p><h3>${esc(t.sample)}</h3><p>${new Date(t.createdAt).toLocaleString('ja-JP')}${t.updatedAt?' ｜ 訂正済み':''}</p></div><button type="button" class="edit-btn" data-edit-compaction="${esc(t.id)}">訂正</button></div><div class="fraction-card-row"><div><span>最大乾燥密度 ρdmax</span><strong>${num(t.maxDryDensity)?.toFixed(3)??'—'} g/cm³</strong></div><div><span>最適含水比 wopt</span><strong>${num(t.optimumWaterContent)?.toFixed(1)??'—'} %</strong></div><div><span>95% / 90%</span><strong>${num(t.dryDensity95)?.toFixed(3)??'—'} / ${num(t.dryDensity90)?.toFixed(3)??'—'}</strong></div></div><div class="meta"><span>方法 ${esc(t.method||'—')}</span><span>測定 ${(t.points||[]).filter(p=>Number.isFinite(Number(p.dryDensity))).length}点</span></div>`;}

  const baseRenderMoistureCard=renderMoistureCard;renderMoistureCard=function(test){if(test?.type===TYPE)return renderCard(test);return baseRenderMoistureCard(test);};
  const baseRenderTests=renderTests;renderTests=function(){baseRenderTests();document.querySelectorAll('[data-edit-compaction]').forEach(b=>b.addEventListener('click',()=>openEdit(b.dataset.editCompaction)));};

  injectUI();
})();
