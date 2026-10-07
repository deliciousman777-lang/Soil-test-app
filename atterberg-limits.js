// 液性限界・塑性限界試験 JIS A 1205:2020 / JGS 0141-2020
(function(){
  const TYPE='atterberg';
  const LL_COUNT=6;
  const PL_COUNT=3;
  const NS='http://www.w3.org/2000/svg';

  const num=v=>{const s=String(v??'').trim();if(s==='')return null;const n=Number(s);return Number.isFinite(n)?n:null;};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const svgEl=(name,attrs={},text='')=>{const e=document.createElementNS(NS,name);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,String(v)));if(text!=='')e.textContent=text;return e;};

  function moisture(containerMass,wetMass,dryMass){
    const c=num(containerMass), wet=num(wetMass), dry=num(dryMass);
    if(c===null||wet===null||dry===null||dry<=c||wet<dry)return null;
    return (wet-dry)/(dry-c)*100;
  }

  function injectUI(){
    const actions=document.querySelector('#detailView .test-actions');
    if(actions&&!document.getElementById('addAtterbergBtn')){
      const b=document.createElement('button');
      b.id='addAtterbergBtn';b.type='button';b.className='primary secondary';b.textContent='＋ 液塑性限界';
      actions.appendChild(b);b.addEventListener('click',openNew);
    }
    if(document.getElementById('atterbergDialog'))return;
    const d=document.createElement('dialog');
    d.id='atterbergDialog';d.className='wide-dialog';
    d.innerHTML=`<form id="atterbergForm" method="dialog">
      <div class="dialog-head"><div><p class="eyebrow">JIS A 1205 / JGS 0141</p><h2 id="atterbergTitle">液性限界・塑性限界試験</h2></div><button type="button" class="icon-btn" id="atterbergClose">×</button></div>
      <label>試料名 / No.<input name="sample" required autocomplete="off" placeholder="例：現場発生土"></label>
      <div class="att-grid">
        <section class="att-panel"><div class="subsection-head"><div><span class="step-badge">1</span><strong>液性限界試験</strong></div><p>4点以上入力。10〜25回を2点、25〜35回を2点が目安。</p></div>
          <div class="table-wrap"><table class="grain-table att-table"><thead><tr><th>No.</th><th>落下回数 N</th><th>容器No.</th><th>容器質量 mc</th><th>容器+湿潤土 ma</th><th>容器+乾燥土 mb</th><th>w %</th></tr></thead><tbody id="llRows"></tbody></table></div>
        </section>
        <section class="att-panel"><div class="subsection-head"><div><span class="step-badge">2</span><strong>塑性限界試験</strong></div><p>3回の含水比を自動平均。</p></div>
          <div class="table-wrap"><table class="grain-table att-table"><thead><tr><th>No.</th><th>容器No.</th><th>容器質量 mc</th><th>容器+湿潤土 ma</th><th>容器+乾燥土 mb</th><th>w %</th></tr></thead><tbody id="plRows"></tbody></table></div>
        </section>
      </div>
      <section class="att-results"><div class="att-result"><span>液性限界 wL</span><strong id="attWL">—</strong><small>%</small></div><div class="att-result"><span>塑性限界 wP</span><strong id="attWP">—</strong><small>%</small></div><div class="att-result"><span>塑性指数 IP</span><strong id="attIP">—</strong></div><div class="att-result"><span>流動指数 If</span><strong id="attIF">—</strong></div></section>
      <section class="att-chart-card"><strong>流動曲線</strong><div class="svg-scroll"><svg id="attFlowSvg" viewBox="0 0 760 390" aria-label="流動曲線"></svg></div></section>
      <div id="atterbergCheck" class="mass-check">液性限界4点以上・塑性限界3点を入力してください。</div>
      <div class="dialog-actions"><button type="button" class="ghost" id="atterbergCancel">キャンセル</button><button class="primary" id="atterbergSubmit">保存</button></div>
    </form>`;
    document.body.appendChild(d);

    const ll=d.querySelector('#llRows');
    ll.innerHTML=Array.from({length:LL_COUNT},(_,j)=>{const i=j+1;return `<tr><th>${i}</th><td><input name="llN_${i}" inputmode="numeric" placeholder="例：18"></td><td><input name="llNo_${i}" autocomplete="off"></td><td><input name="llC_${i}" inputmode="decimal"></td><td><input name="llWet_${i}" inputmode="decimal"></td><td><input name="llDry_${i}" inputmode="decimal"></td><td id="llW_${i}" class="calc">—</td></tr>`;}).join('');
    const pl=d.querySelector('#plRows');
    pl.innerHTML=Array.from({length:PL_COUNT},(_,j)=>{const i=j+1;return `<tr><th>${i}</th><td><input name="plNo_${i}" autocomplete="off"></td><td><input name="plC_${i}" inputmode="decimal"></td><td><input name="plWet_${i}" inputmode="decimal"></td><td><input name="plDry_${i}" inputmode="decimal"></td><td id="plW_${i}" class="calc">—</td></tr>`;}).join('');

    if(!document.getElementById('atterbergStyles')){
      const s=document.createElement('style');s.id='atterbergStyles';s.textContent=`
        .att-grid{display:grid;gap:14px;margin-top:14px}.att-panel{border:1px solid var(--line);border-radius:16px;padding:12px;background:#fff}.att-table{min-width:900px}.att-table input{min-width:80px;padding:8px}.att-results{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0}.att-result{border:1px solid var(--line);border-radius:14px;background:#f3f8f6;padding:12px;text-align:center}.att-result span,.att-result small{display:block;color:var(--muted);font-size:11px}.att-result strong{display:block;font-size:24px;color:var(--accent-dark);margin:3px}.att-chart-card{border:1px solid var(--line);border-radius:16px;background:#fff;padding:12px}.att-chart-card svg{width:100%;height:auto;min-width:620px}.att-chart-card .svg-scroll{overflow-x:auto}.att-warn{color:#a33;font-weight:700}@media(max-width:760px){.att-results{grid-template-columns:1fr 1fr}}
      `;document.head.appendChild(s);
    }
    const f=formEl();f.addEventListener('input',updatePreview);f.addEventListener('change',updatePreview);f.addEventListener('submit',saveTest);
    d.querySelector('#atterbergClose').addEventListener('click',()=>d.close());d.querySelector('#atterbergCancel').addEventListener('click',()=>d.close());
  }

  function formEl(){return document.getElementById('atterbergForm');}
  function dialogEl(){return document.getElementById('atterbergDialog');}

  function readLL(i){
    const f=formEl(), N=num(f.elements[`llN_${i}`].value), no=f.elements[`llNo_${i}`].value.trim(), c=num(f.elements[`llC_${i}`].value), wet=num(f.elements[`llWet_${i}`].value), dry=num(f.elements[`llDry_${i}`].value);
    const entered=[N,c,wet,dry].some(v=>v!==null)||no!==''; if(!entered)return {entered:false,valid:false};
    const w=moisture(c,wet,dry); return {entered:true,valid:N!==null&&N>0&&w!==null,N,containerNo:no,containerMass:c,wetMass:wet,dryMass:dry,moisture:w};
  }
  function readPL(i){
    const f=formEl(), no=f.elements[`plNo_${i}`].value.trim(), c=num(f.elements[`plC_${i}`].value), wet=num(f.elements[`plWet_${i}`].value), dry=num(f.elements[`plDry_${i}`].value);
    const entered=[c,wet,dry].some(v=>v!==null)||no!==''; if(!entered)return {entered:false,valid:false};
    const w=moisture(c,wet,dry); return {entered:true,valid:w!==null,containerNo:no,containerMass:c,wetMass:wet,dryMass:dry,moisture:w};
  }

  function regression(rows){
    const valid=rows.filter(r=>r.valid&&r.N>0&&Number.isFinite(r.moisture));
    if(valid.length<2)return null;
    const xs=valid.map(r=>Math.log10(r.N)), ys=valid.map(r=>r.moisture), n=valid.length;
    const xm=xs.reduce((a,b)=>a+b,0)/n, ym=ys.reduce((a,b)=>a+b,0)/n;
    let sxx=0,sxy=0;for(let i=0;i<n;i++){sxx+=(xs[i]-xm)**2;sxy+=(xs[i]-xm)*(ys[i]-ym);}
    if(sxx<=0)return null;const slope=sxy/sxx, intercept=ym-slope*xm, wL=intercept+slope*Math.log10(25), flowIndex=Math.abs(slope);
    let ssTot=0,ssRes=0;for(let i=0;i<n;i++){const pred=intercept+slope*xs[i];ssTot+=(ys[i]-ym)**2;ssRes+=(ys[i]-pred)**2;}
    const r2=ssTot>0?1-ssRes/ssTot:null;
    return {slope,intercept,wL,flowIndex,r2,rows:valid};
  }

  function calcAll(){
    const ll=Array.from({length:LL_COUNT},(_,j)=>readLL(j+1));
    const pl=Array.from({length:PL_COUNT},(_,j)=>readPL(j+1));
    const llValid=ll.filter(r=>r.valid), plValid=pl.filter(r=>r.valid), reg=regression(llValid);
    const wP=plValid.length===PL_COUNT?plValid.reduce((s,r)=>s+r.moisture,0)/PL_COUNT:null;
    const wL=reg&&llValid.length>=4?reg.wL:null;
    const ip=wL!==null&&wP!==null?wL-wP:null;
    const low=llValid.filter(r=>r.N>=10&&r.N<=25).length, high=llValid.filter(r=>r.N>25&&r.N<=35).length;
    return {ll,pl,llValid,plValid,reg,wL,wP,ip,low,high};
  }

  function updatePreview(){
    const a=calcAll();
    for(let i=1;i<=LL_COUNT;i++){const r=a.ll[i-1],el=document.getElementById(`llW_${i}`);if(el)el.textContent=r.valid?`${r.moisture.toFixed(1)} %`:'—';}
    for(let i=1;i<=PL_COUNT;i++){const r=a.pl[i-1],el=document.getElementById(`plW_${i}`);if(el)el.textContent=r.valid?`${r.moisture.toFixed(1)} %`:'—';}
    document.getElementById('attWL').textContent=a.wL!==null?a.wL.toFixed(1):'—';
    document.getElementById('attWP').textContent=a.wP!==null?a.wP.toFixed(1):'—';
    document.getElementById('attIP').textContent=a.ip!==null?a.ip.toFixed(1):'—';
    document.getElementById('attIF').textContent=a.reg? a.reg.flowIndex.toFixed(1):'—';
    const check=document.getElementById('atterbergCheck');check.classList.remove('error');
    if(a.llValid.length<4||a.plValid.length<3){check.textContent=`液性限界 ${a.llValid.length}/4点以上 ｜ 塑性限界 ${a.plValid.length}/3点`;check.classList.add('error');}
    else if(a.low<2||a.high<2){check.textContent=`⚠ JIS目安：10〜25回を2点、25〜35回を2点。現在 ${a.low}点 / ${a.high}点`;check.classList.add('error');}
    else check.textContent=`液性限界 ${a.llValid.length}点 ｜ 10〜25回 ${a.low}点 ｜ 25〜35回 ${a.high}点${a.reg?.r2!=null?` ｜ R² ${a.reg.r2.toFixed(3)}`:''}`;
    drawFlow(a);
  }

  function drawFlow(a){
    const svg=document.getElementById('attFlowSvg');if(!svg)return;svg.innerHTML='';
    const W=760,H=390,L=66,R=24,T=24,B=52,pw=W-L-R,ph=H-T-B;
    const rows=a.llValid;const minW=rows.length?Math.floor((Math.min(...rows.map(r=>r.moisture))-5)/5)*5:0,maxW=rows.length?Math.ceil((Math.max(...rows.map(r=>r.moisture))+5)/5)*5:100;
    const yMin=minW,yMax=Math.max(maxW,minW+10),logMin=Math.log10(5),logMax=Math.log10(50);
    const x=n=>L+(Math.log10(n)-logMin)/(logMax-logMin)*pw,y=w=>T+(yMax-w)/(yMax-yMin)*ph;
    svg.appendChild(svgEl('rect',{x:L,y:T,width:pw,height:ph,fill:'#fff',stroke:'#888'}));
    [5,10,15,20,25,30,40,50].forEach(n=>{const xx=x(n);svg.appendChild(svgEl('line',{x1:xx,y1:T,x2:xx,y2:H-B,stroke:n===25?'#999':'#e0e0e0','stroke-dasharray':n===25?'5 4':''}));svg.appendChild(svgEl('text',{x:xx,y:H-B+17,'text-anchor':'middle','font-size':10},String(n)));});
    for(let w=Math.ceil(yMin/5)*5;w<=yMax;w+=5){const yy=y(w);svg.appendChild(svgEl('line',{x1:L,y1:yy,x2:W-R,y2:yy,stroke:'#e7e7e7'}));svg.appendChild(svgEl('text',{x:L-8,y:yy+3,'text-anchor':'end','font-size':9},String(w)));}
    if(a.reg){const w5=a.reg.intercept+a.reg.slope*Math.log10(5),w50=a.reg.intercept+a.reg.slope*Math.log10(50);svg.appendChild(svgEl('line',{x1:x(5),y1:y(w5),x2:x(50),y2:y(w50),stroke:'#1e6f5c','stroke-width':2.5}));}
    rows.forEach(r=>svg.appendChild(svgEl('circle',{cx:x(r.N),cy:y(r.moisture),r:4.5,fill:'#b42318',stroke:'#fff','stroke-width':1.3})));
    if(a.wL!==null){svg.appendChild(svgEl('circle',{cx:x(25),cy:y(a.wL),r:5.5,fill:'#1e6f5c'}));svg.appendChild(svgEl('text',{x:x(25)+8,y:y(a.wL)-8,'font-size':11,'font-weight':700,fill:'#1e6f5c'},`wL ${a.wL.toFixed(1)}%`));}
    svg.appendChild(svgEl('text',{x:W/2,y:H-7,'text-anchor':'middle','font-size':11},'落下回数 N（対数目盛）'));svg.appendChild(svgEl('text',{x:15,y:H/2,'text-anchor':'middle','font-size':11,transform:`rotate(-90 15 ${H/2})`},'含水比 w (%)'));
  }

  function resetForm(){state.editingTestId=null;formEl().reset();document.getElementById('atterbergTitle').textContent='液性限界・塑性限界試験';document.getElementById('atterbergSubmit').textContent='保存';updatePreview();}
  function openNew(){resetForm();dialogEl().showModal();}
  function openEdit(id){
    const p=currentProject(),t=p?.tests.find(x=>x.id===id&&x.type===TYPE);if(!t)return;state.editingTestId=id;formEl().reset();formEl().elements.sample.value=t.sample||'';
    (t.liquid||[]).slice(0,LL_COUNT).forEach((r,j)=>{const i=j+1;formEl().elements[`llN_${i}`].value=r.N??'';formEl().elements[`llNo_${i}`].value=r.containerNo??'';formEl().elements[`llC_${i}`].value=r.containerMass??'';formEl().elements[`llWet_${i}`].value=r.wetMass??'';formEl().elements[`llDry_${i}`].value=r.dryMass??'';});
    (t.plastic||[]).slice(0,PL_COUNT).forEach((r,j)=>{const i=j+1;formEl().elements[`plNo_${i}`].value=r.containerNo??'';formEl().elements[`plC_${i}`].value=r.containerMass??'';formEl().elements[`plWet_${i}`].value=r.wetMass??'';formEl().elements[`plDry_${i}`].value=r.dryMass??'';});
    document.getElementById('atterbergTitle').textContent='液性限界・塑性限界試験を訂正';document.getElementById('atterbergSubmit').textContent='訂正を保存';updatePreview();dialogEl().showModal();
  }

  function saveTest(e){
    e.preventDefault();const sample=formEl().elements.sample.value.trim();if(!sample)return;const a=calcAll();
    if(a.llValid.length<4||a.plValid.length<3||a.wL===null||a.wP===null){alert('液性限界は4点以上、塑性限界は3点すべて入力してください。');return;}
    const p=currentProject();if(!p)return;const now=new Date().toISOString();const payload={sample,liquid:a.llValid,plastic:a.plValid,liquidLimit:a.wL,plasticLimit:a.wP,plasticityIndex:a.ip,flowIndex:a.reg?.flowIndex??null,r2:a.reg?.r2??null};
    if(state.editingTestId){const t=p.tests.find(x=>x.id===state.editingTestId&&x.type===TYPE);if(!t)return;Object.assign(t,payload,{updatedAt:now});}else p.tests.push({id:uid(),type:TYPE,...payload,createdAt:now});
    p.updatedAt=now;saveData();dialogEl().close();resetForm();renderTests();
  }

  function renderCard(t){return `<div class="card-title-row"><div><p class="test-kind">液性限界・塑性限界試験</p><h3>${esc(t.sample)}</h3><p>${new Date(t.createdAt).toLocaleString('ja-JP')}${t.updatedAt?' ｜ 訂正済み':''}</p></div><button type="button" class="edit-btn" data-edit-atterberg="${esc(t.id)}">訂正</button></div><div class="fraction-card-row"><div><span>液性限界 wL</span><strong>${num(t.liquidLimit)?.toFixed(1)??'—'} %</strong></div><div><span>塑性限界 wP</span><strong>${num(t.plasticLimit)?.toFixed(1)??'—'} %</strong></div><div><span>塑性指数 IP</span><strong>${num(t.plasticityIndex)?.toFixed(1)??'—'}</strong></div></div>`;}

  const baseRenderMoistureCard=renderMoistureCard;
  renderMoistureCard=function(test){if(test?.type===TYPE)return renderCard(test);return baseRenderMoistureCard(test);};
  const baseRenderTests=renderTests;
  renderTests=function(){baseRenderTests();document.querySelectorAll('[data-edit-atterberg]').forEach(b=>b.addEventListener('click',()=>openEdit(b.dataset.editAtterberg)));};

  injectUI();
})();