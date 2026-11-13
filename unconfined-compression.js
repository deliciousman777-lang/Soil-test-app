// 一軸圧縮試験：3供試体 + 含水比 + 破壊スケッチ
(function(){
  'use strict';

  const TYPE='unconfined-compression';
  const sketchState=[[],[],[]];
  let levelValues=[];
  let levelCache=new Map();
  let activeLevel=null;
  let draftOriginId=null;
  const n=v=>{const s=String(v??'').trim();if(s==='')return null;const x=Number(s);return Number.isFinite(x)?x:null;};
  const esc=v=>typeof escapeHtml==='function'?escapeHtml(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const form=()=>document.getElementById('unconfinedForm');
  const dialog=()=>document.getElementById('unconfinedDialog');

  function samples(){
    const p=typeof currentProject==='function'?currentProject():null;
    return (p?.samples||[]).map(s=>({id:String(s.id||''),name:String(s.name||'').trim()})).filter(s=>s.name);
  }
  function latestMix(sample){
    const p=typeof currentProject==='function'?currentProject():null;
    return [...(p?.tests||[])].filter(t=>t.type==='mix-design'&&String(t.sample||'')===String(sample||''))
      .sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')))[0]||null;
  }
  function syncSample(selected=''){
    const f=form();if(!f)return;
    const sel=f.elements.sample;const list=samples();sel.innerHTML='';
    if(!list.length){sel.add(new Option('先に試料を登録してください',''));sel.disabled=true;return;}
    sel.disabled=false;list.forEach(s=>{const o=new Option(s.name,s.name);o.dataset.sampleId=s.id;sel.add(o);});
    if(selected&&list.some(s=>s.name===selected))sel.value=selected;
    else sel.selectedIndex=0;
    syncDosages();
  }

  function doseChoices(sample){
    const p=typeof currentProject==='function'?currentProject():null;
    const mix=latestMix(sample);
    const mixValues=(mix?.additions||[]).map(a=>n(a.dosage)).filter(v=>v!==null&&v>=0);
    const saved=(p?.tests||[]).filter(t=>t.type===TYPE&&String(t.sample||'')===String(sample||''))
      .map(t=>n(t.dosage)).filter(v=>v!==null&&v>=0);
    const result=[];
    [...mixValues,...saved].forEach(v=>{if(!result.includes(v))result.push(v);});
    if(result.length<3)[50,100,150].forEach(v=>{if(result.length<3&&!result.includes(v))result.push(v);});
    return result.sort((a,b)=>a-b);
  }
  function syncDosages(selected=null){
    const f=form();if(!f)return;
    const sel=f.elements.dosage,mix=latestMix(f.elements.sample.value);
    const values=doseChoices(f.elements.sample.value);
    if(selected!==null&&n(selected)!==null&&!values.includes(n(selected)))values.push(n(selected));
    levelValues=values.sort((a,b)=>a-b);
    sel.innerHTML='';levelValues.forEach(v=>sel.add(new Option(String(v)+' kg/m³',String(v))));
    sel.add(new Option('その他（手入力）','__manual__'));
    const wanted=selected!==null?n(selected):n(activeLevel);
    sel.value=wanted!==null&&levelValues.includes(wanted)?String(wanted):String(levelValues[0]??'__manual__');
    toggleManualDosage();
    if(mix){
      if(!f.elements.improvementDate.value)f.elements.improvementDate.value=mix.specimenDate||'';
      if(!f.elements.compressionDate.value)f.elements.compressionDate.value=mix.compressionDate||'';
    }
    renderLevelTabs();
  }
  function toggleManualDosage(){
    const f=form();if(!f)return;const wrap=document.getElementById('unconfinedDosageManualWrap');
    const show=f.elements.dosage.value==='__manual__';wrap?.classList.toggle('hidden',!show);f.elements.dosageManual.required=show;
  }
  function selectedDosage(){const f=form();return f.elements.dosage.value==='__manual__'?n(f.elements.dosageManual.value):n(f.elements.dosage.value);}


  // 1水準＝3供試体。切替中の未保存データも水準ごとに保持する。
  const clone=value=>JSON.parse(JSON.stringify(value));
  const levelKey=value=>n(value)===null?'':String(n(value));
  function latestUnconfined(sample,dosage){
    const p=typeof currentProject==='function'?currentProject():null;
    return [...(p?.tests||[])].filter(t=>t.type===TYPE&&!t.draft&&String(t.sample||'')===String(sample||'')
      &&levelKey(t.dosage)===levelKey(dosage))
      .sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')))[0]||null;
  }
  function levelFields(){
    const f=form(),fields={};
    if(!f)return fields;
    f.querySelectorAll('[name]').forEach(el=>{
      if(!el.name||['sample','dosage','dosageManual'].includes(el.name)||el.tagName==='BUTTON')return;
      fields[el.name]=el.value;
    });
    return fields;
  }
  function captureLevel(){
    return {fields:levelFields(),sketches:clone(sketchState)};
  }
  function testSnapshot(t){
    const fields={improvementDate:t?.improvementDate||latestMix(form()?.elements.sample.value)?.specimenDate||'',
      compressionDate:t?.compressionDate||latestMix(form()?.elements.sample.value)?.compressionDate||''};
    [1,2,3].forEach(i=>{
      const specimen=t?.specimens?.[i-1]||{},m=specimen.moisture||{};
      ['state','mass','diameter','height','maxStrength','note'].forEach(k=>fields[k+i]=specimen[k]??'');
      ['containerNo','ma','mb','mc'].forEach(k=>fields[k+i]=m[k]??'');
    });
    return {fields,sketches:[1,2,3].map(i=>clone(t?.specimens?.[i-1]?.sketch||[]))};
  }
  function hasLevelData(snapshot){
    const fields=snapshot?.fields||{};
    return [1,2,3].some(i=>
      ['state','mass','diameter','height','maxStrength','note','containerNo','ma','mb','mc']
      .some(k=>String(fields[k+i]??'').trim()!=='')||(snapshot?.sketches?.[i-1]||[]).length>0);
  }
  function renderLevelTabs(){
    const root=document.getElementById('unconfinedLevelButtons');if(!root)return;
    const sample=form()?.elements.sample.value||'';
    root.innerHTML=levelValues.map(v=>{
      const key=levelKey(v),cached=levelCache.get(key),saved=latestUnconfined(sample,v);
      const status=saved?'✓':(hasLevelData(cached)?'入力中':'');
      return `<button type="button" data-level-key="${esc(key)}" class="unconfined-level-tab ${activeLevel===key?'active':''}">${esc(Number(v).toLocaleString('ja-JP'))} ${status}</button>`;
    }).join('');
  }
  function switchLevel(value,saveCurrent=true){
    const f=form(),key=levelKey(value);if(!f||!key)return;
    if(saveCurrent&&activeLevel!==null)levelCache.set(activeLevel,captureLevel());
    activeLevel=key;
    if(!levelValues.some(v=>levelKey(v)===key)){
      levelValues.push(Number(key));levelValues.sort((a,b)=>a-b);
      const option=new Option(key+' kg/m³',key);
      f.elements.dosage.add(option,f.elements.dosage.options[f.elements.dosage.options.length-1]);
    }
    const stored=levelCache.get(key)||testSnapshot(latestUnconfined(f.elements.sample.value,key));
    f.querySelectorAll('[name]').forEach(el=>{
      if(!el.name||['sample','dosage','dosageManual'].includes(el.name)||el.tagName==='BUTTON')return;
      el.value=stored.fields?.[el.name]??'';
    });
    [1,2,3].forEach(i=>{sketchState[i-1]=clone(stored.sketches?.[i-1]||[]);redraw(i);});
    f.elements.dosage.value=key;toggleManualDosage();
    const existing=latestUnconfined(f.elements.sample.value,key);
    state.editingTestId=existing?.id||draftOriginId||null;
    updatePreview();renderLevelTabs();
    const note=document.getElementById('unconfinedLevelNote');
    if(note)note.textContent=key+' kg/m³・供試体3本';
  }
  function specimensFromSnapshot(snap){
    const fields=snap.fields||{};
    return [1,2,3].map(i=>{
      const ma=n(fields['ma'+i]),mb=n(fields['mb'+i]),mc=n(fields['mc'+i]);
      const containerNo=String(fields['containerNo'+i]||'').trim();
      const entered=containerNo!==''||[ma,mb,mc].some(v=>v!==null);
      const valid=!entered||(ma!==null&&mb!==null&&mc!==null&&ma>=mb&&mb>mc);
      return {
        no:i,state:String(fields['state'+i]||'').trim(),mass:n(fields['mass'+i]),
        diameter:n(fields['diameter'+i]),height:n(fields['height'+i]),
        maxStrength:n(fields['maxStrength'+i]),note:String(fields['note'+i]||'').trim(),
        moisture:{containerNo,ma,mb,mc,w:valid&&entered?(ma-mb)/(mb-mc)*100:null,valid},
        sketch:clone(snap.sketches?.[i-1]||[])
      };
    });
  }

  function moisture(i){
    const f=form();const containerNo=f.elements[`containerNo${i}`].value.trim();
    const ma=n(f.elements[`ma${i}`].value),mb=n(f.elements[`mb${i}`].value),mc=n(f.elements[`mc${i}`].value);
    const entered=containerNo!==''||[ma,mb,mc].some(v=>v!==null);
    if(!entered)return {containerNo:'',ma:null,mb:null,mc:null,w:null,valid:true};
    const valid=ma!==null&&mb!==null&&mc!==null&&ma>=mb&&mb>mc;
    return {containerNo,ma,mb,mc,w:valid?(ma-mb)/(mb-mc)*100:null,valid};
  }
  function specimen(i){
    const f=form();return {
      no:i,
      state:f.elements[`state${i}`].value.trim(),
      mass:n(f.elements[`mass${i}`].value),
      diameter:n(f.elements[`diameter${i}`].value),
      height:n(f.elements[`height${i}`].value),
      maxStrength:n(f.elements[`maxStrength${i}`].value),
      note:f.elements[`note${i}`].value.trim(),
      moisture:moisture(i),
      sketch:JSON.parse(JSON.stringify(sketchState[i-1]||[])),
    };
  }
  function setText(id,text){const el=document.getElementById(id);if(el)el.textContent=text;}
  function updatePreview(){
    [1,2,3].forEach(i=>{const m=moisture(i);setText(`unconfinedW${i}`,m.w!==null?`${m.w.toFixed(1)} %`:'—');});
  }

  function canvas(i){return document.getElementById(`unconfinedSketch${i}`);}
  function redraw(i){
    const c=canvas(i);if(!c)return;const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.lineWidth=2;ctx.lineCap='round';ctx.lineJoin='round';
    (sketchState[i-1]||[]).forEach(stroke=>{if(!stroke.length)return;ctx.beginPath();stroke.forEach((p,j)=>{const x=p.x*c.width,y=p.y*c.height;j?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();});
  }
  function attachCanvas(i){
    const c=canvas(i);if(!c||c.dataset.ready)return;c.dataset.ready='1';let active=null;
    const point=e=>{const r=c.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};};
    c.addEventListener('pointerdown',e=>{e.preventDefault();c.setPointerCapture(e.pointerId);active=[point(e)];sketchState[i-1].push(active);redraw(i);});
    c.addEventListener('pointermove',e=>{if(!active)return;e.preventDefault();active.push(point(e));redraw(i);});
    const end=()=>{active=null;};c.addEventListener('pointerup',end);c.addEventListener('pointercancel',end);
  }
  function clearSketch(i){sketchState[i-1]=[];redraw(i);}

  function specimenCard(i){return `<section class="unconfined-specimen"><div class="specimen-head"><strong>供試体 ${i}</strong><span>最大値 qu</span></div>
    <div class="unconfined-main-grid"><label>供試体状態<input name="state${i}" autocomplete="off" placeholder="例：良好"></label><label>質量 (g)<input name="mass${i}" inputmode="decimal"></label><label>直径 D (cm)<input name="diameter${i}" inputmode="decimal"></label><label>高さ L (cm)<input name="height${i}" inputmode="decimal"></label><label>最大値 (kN/m²)<input name="maxStrength${i}" inputmode="decimal"></label><label>記事<input name="note${i}" autocomplete="off"></label></div>
    <div class="unconfined-lower"><div><div class="unconfined-sketch-head"><strong>破壊スケッチ</strong><button type="button" class="ghost" data-clear-sketch="${i}">クリア</button></div><canvas id="unconfinedSketch${i}" width="150" height="210" aria-label="供試体${i}の破壊スケッチ"></canvas></div>
    <div class="unconfined-moisture"><strong>含水比</strong><label>容器No.<input name="containerNo${i}" autocomplete="off"></label><label>ma 容器＋湿潤土 (g)<input name="ma${i}" inputmode="decimal"></label><label>mb 容器＋乾燥土 (g)<input name="mb${i}" inputmode="decimal"></label><label>mc 容器 (g)<input name="mc${i}" inputmode="decimal"></label><div class="unconfined-w"><span>w</span><strong id="unconfinedW${i}">—</strong></div></div></div></section>`;}

  function inject(){
    const actions=document.querySelector('#detailView .test-actions');
    if(actions&&!document.getElementById('addUnconfinedBtn')){const b=document.createElement('button');b.id='addUnconfinedBtn';b.type='button';b.className='primary secondary';b.textContent='＋ 一軸圧縮';actions.appendChild(b);b.addEventListener('click',openNew);}
    if(document.getElementById('unconfinedDialog'))return;
    const d=document.createElement('dialog');d.id='unconfinedDialog';d.className='wide-dialog unconfined-dialog';d.innerHTML=`<form id="unconfinedForm" method="dialog"><div class="dialog-head"><div><p class="eyebrow">JIS A 1216 / JGS 0511</p><h2 id="unconfinedTitle">一軸圧縮試験</h2></div><button type="button" class="icon-btn" id="unconfinedClose">×</button></div>
      <div class="unconfined-top"><label>試料名 / No.<select name="sample" required></select></label><label class="hidden">配合<select name="dosage"></select></label><label id="unconfinedDosageManualWrap" class="hidden">添加量 (kg/m³)<input name="dosageManual" inputmode="decimal"></label><label>改良日<input name="improvementDate" type="date"></label><label>圧縮日<input name="compressionDate" type="date"></label></div>
      <div class="unconfined-level-switch"><div class="unconfined-level-head"><strong>添加量（kg/m³）・水準切り替え</strong><button type="button" class="ghost" id="unconfinedAddLevel">＋水準追加</button></div><div id="unconfinedLevelButtons" class="unconfined-level-buttons"></div><small id="unconfinedLevelNote">水準を選択してください</small><small>水準を切り替えても入力中の数値とスケッチは残ります。保存で入力済みの水準をまとめて登録します。</small></div>
      <div class="unconfined-specimens">${specimenCard(1)}${specimenCard(2)}${specimenCard(3)}</div>
      <div id="unconfinedCheck" class="mass-check">3本の質量・直径・高さ・最大値を入力してください。含水比と破壊スケッチは任意です。</div><div class="dialog-actions"><button type="button" class="ghost" id="unconfinedCancel">キャンセル</button><button class="primary" id="unconfinedSubmit">保存</button></div></form>`;document.body.appendChild(d);
    const style=document.createElement('style');style.id='unconfinedStyles';style.textContent=`
      .unconfined-top{display:grid;grid-template-columns:1.3fr 1fr 1fr 1fr 1fr;gap:8px}.unconfined-specimens{display:grid;gap:12px;margin-top:12px}.unconfined-specimen{padding:13px;border:1px solid var(--line,#dfe7e3);border-radius:15px;background:#fff}.unconfined-main-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:7px}.unconfined-lower{display:grid;grid-template-columns:180px 1fr;gap:12px;margin-top:10px}.unconfined-sketch-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:5px}.unconfined-sketch-head button{padding:5px 8px;font-size:11px}.unconfined-specimen canvas{display:block;width:150px;height:210px;border:1px dashed #7d8783;background:#fff;touch-action:none}.unconfined-moisture{display:grid;grid-template-columns:repeat(2,1fr);gap:7px;align-content:start}.unconfined-moisture>strong{grid-column:1/-1}.unconfined-w{display:flex;align-items:center;justify-content:space-between;border:1px solid var(--line,#dfe7e3);border-radius:11px;padding:8px 10px;background:#f8fbfa}.unconfined-w strong{color:var(--accent-dark,#0b5136)}@media(max-width:900px){.unconfined-top{grid-template-columns:1fr 1fr}.unconfined-main-grid{grid-template-columns:repeat(3,1fr)}}@media(max-width:560px){.unconfined-top,.unconfined-main-grid,.unconfined-lower{grid-template-columns:1fr}.unconfined-moisture{grid-template-columns:1fr 1fr}.unconfined-specimen canvas{width:100%;max-width:220px;height:250px}}

      .unconfined-level-switch{margin:12px 0;padding:12px;border:1px solid #d9e6df;border-radius:14px;background:#f7faf8}.unconfined-level-head{display:flex;justify-content:space-between;align-items:center;gap:10px}.unconfined-level-head strong{font-size:14px}.unconfined-level-head button{font-size:12px;padding:6px 10px}.unconfined-level-buttons{display:flex;gap:8px;overflow-x:auto;padding:12px 0 7px}.unconfined-level-tab{min-width:85px;padding:10px 16px;white-space:nowrap;border:1px solid #c9d8d0;border-radius:11px;background:#fff;font-weight:800;color:#51615a}.unconfined-level-tab.active{background:#16745c;color:#fff;border-color:#16745c}.unconfined-level-switch small{display:block;color:#68756e;font-size:11px;line-height:1.5}.unconfined-level-switch #unconfinedLevelNote{font-weight:700;color:#24644e;margin-bottom:3px}.unconfined-card-levels{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:10px}.unconfined-card-levels button{padding:7px 11px;border:1px solid #a9caba;border-radius:9px;color:#2a5c49;background:#f4faf7;font-weight:800;font-size:12px}.unconfined-card-levels button.active{background:#176c55;color:#fff}
    `;document.head.appendChild(style);
    const f=form();f.addEventListener('input',updatePreview);
    f.elements.sample.addEventListener('change',()=>{
      levelCache.clear();activeLevel=null;draftOriginId=null;
      syncDosages();switchLevel(levelValues[0],false);
    });
    f.elements.dosage.addEventListener('change',()=>{
      const v=selectedDosage();
      if(v!==null)switchLevel(v);
      else toggleManualDosage();
    });
    f.addEventListener('submit',saveTest);
    document.getElementById('unconfinedLevelButtons').addEventListener('click',e=>{
      const b=e.target.closest('[data-level-key]');if(b)switchLevel(b.dataset.levelKey);
    });
    document.getElementById('unconfinedAddLevel').addEventListener('click',()=>{
      const raw=prompt('追加する添加量を kg/m³ で入力してください（例：200）');
      if(raw===null)return;const value=n(raw);
      if(value===null||value<0){alert('0以上の数値を入力してください。');return;}
      switchLevel(value);
    });
    d.querySelector('#unconfinedClose').addEventListener('click',()=>d.close());d.querySelector('#unconfinedCancel').addEventListener('click',()=>d.close());d.addEventListener('click',e=>{const b=e.target.closest('[data-clear-sketch]');if(b)clearSketch(Number(b.dataset.clearSketch));});
    [1,2,3].forEach(attachCanvas);
  }


  function reset(){
    state.editingTestId=null;draftOriginId=null;levelCache.clear();activeLevel=null;
    const f=form();f.reset();sketchState.splice(0,3,[],[],[]);syncSample();
    document.getElementById('unconfinedTitle').textContent='一軸圧縮試験';
    document.getElementById('unconfinedSubmit').textContent='入力済み水準をまとめて保存';
    switchLevel(levelValues[0],false);
  }
  function openNew(){if(!samples().length){alert('先に試料を登録してください。');return;}reset();dialog().showModal();}

  function openEdit(id){
    const p=currentProject(),t=p?.tests?.find(x=>x.id===id&&x.type===TYPE);if(!t)return;
    reset();levelCache.clear();activeLevel=null;
    draftOriginId=t.draft?id:null;
    document.getElementById('unconfinedTitle').textContent='一軸圧縮試験を訂正';
    document.getElementById('unconfinedSubmit').textContent='入力済み水準をまとめて保存';
    syncSample(t.sample||'');
    const value=n(t.dosage)??n(t.draftFields?.dosage)??levelValues[0];
    syncDosages(value);
    switchLevel(value,false);
    state.editingTestId=t.id;
    dialog().showModal();
  }

  function saveTest(e){
    e.preventDefault();
    const f=form(),p=currentProject();if(!f||!p)return;
    const sample=f.elements.sample.value.trim();
    if(!sample){alert('試料を選択してください。');return;}
    if(activeLevel!==null)levelCache.set(activeLevel,captureLevel());
    const entries=levelValues.map(d=>({dosage:n(d),snapshot:levelCache.get(levelKey(d))}))
      .filter(x=>x.snapshot&&hasLevelData(x.snapshot));
    if(!entries.length){alert('まず水準を選び、供試体の試験値を入力してください。');return;}
    const validated=[];
    for(const entry of entries){
      const specimens=specimensFromSnapshot(entry.snapshot);
      for(const specimen of specimens){
        if([specimen.mass,specimen.diameter,specimen.height,specimen.maxStrength].some(v=>v===null)){
          alert(entry.dosage+' kg/m³：供試体'+specimen.no+'の質量・直径・高さ・最大値を入力してください。未完成なら「途中保存」を利用してください。');return;
        }
        if(!specimen.moisture.valid){
          alert(entry.dosage+' kg/m³：供試体'+specimen.no+'の含水比質量を確認してください。');return;
        }
      }
      validated.push({...entry,specimens});
    }
    const sampleOption=f.elements.sample.selectedOptions[0],now=new Date().toISOString();
    let draftReused=false;
    for(const entry of validated){
      const payload={sample,sampleId:sampleOption?.dataset?.sampleId||null,dosage:entry.dosage,
        improvementDate:entry.snapshot.fields.improvementDate||'',
        compressionDate:entry.snapshot.fields.compressionDate||'',specimens:entry.specimens};
      let existing=latestUnconfined(sample,entry.dosage);
      if(!existing&&!draftReused&&draftOriginId){
        existing=p.tests.find(t=>t.id===draftOriginId&&t.type===TYPE&&t.draft);
        if(existing)draftReused=true;
      }
      if(existing){
        Object.assign(existing,payload,{updatedAt:now});
        ['draft','draftFields','draftFieldLabels','draftSavedAt','draftExtra'].forEach(k=>delete existing[k]);
      }else p.tests.push({id:uid(),type:TYPE,...payload,createdAt:now});
    }
    p.updatedAt=now;saveData();dialog().close();reset();renderTests();
  }
  function card(t){const strengths=(t.specimens||[]).map(s=>n(s.maxStrength)).filter(v=>v!==null);const avg=strengths.length?strengths.reduce((a,b)=>a+b,0)/strengths.length:null;return `<div class="card-title-row"><div><p class="test-kind">一軸圧縮試験</p><h3>${esc(t.sample||'')} ｜ ${n(t.dosage)!==null?Number(t.dosage).toFixed(0):'—'} kg/m³</h3><p>${new Date(t.createdAt).toLocaleString('ja-JP')}${t.updatedAt?' ｜ 訂正済み':''}</p></div><button type="button" class="edit-btn" data-edit-unconfined="${esc(t.id)}">訂正</button></div><div class="fraction-card-row"><div><span>供試体1</span><strong>${strengths[0]!=null?strengths[0].toFixed(1):'—'} kN/m²</strong></div><div><span>供試体2</span><strong>${strengths[1]!=null?strengths[1].toFixed(1):'—'} kN/m²</strong></div><div><span>供試体3</span><strong>${strengths[2]!=null?strengths[2].toFixed(1):'—'} kN/m²</strong></div><div><span>平均</span><strong>${avg!==null?avg.toFixed(1):'—'} kN/m²</strong></div></div>`;}
  const baseCard=renderMoistureCard;renderMoistureCard=function(t){if(t?.type===TYPE)return card(t);return baseCard(t);};

  function compactSavedLevels(){
    const p=typeof currentProject==='function'?currentProject():null;
    const list=document.getElementById('testList');if(!p||!list)return;
    const byId=new Map((p.tests||[]).map(t=>[String(t.id),t]));
    const groups=new Map();
    [...list.querySelectorAll(':scope > .card')].forEach(card=>{
      const id=card.querySelector('[data-edit-unconfined]')?.dataset.editUnconfined;
      const t=id&&byId.get(String(id));
      if(!t||t.type!==TYPE||t.draft)return;
      const key=String(t.sampleId||t.sample||'');
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push({card,test:t});
    });
    groups.forEach(rows=>{
      if(rows.length<2)return;
      rows.sort((a,b)=>(n(a.test.dosage)??Infinity)-(n(b.test.dosage)??Infinity));
      const bar=document.createElement('div');bar.className='unconfined-card-levels';
      const buttons=rows.map((row,i)=>{
        const b=document.createElement('button');b.type='button';
        b.textContent=(n(row.test.dosage)!==null?Number(row.test.dosage).toLocaleString('ja-JP'):'—')+' kg/m³';
        b.addEventListener('click',()=>show(i));bar.appendChild(b);return b;
      });
      function show(i){
        rows.forEach((row,j)=>row.card.classList.toggle('hidden',i!==j));
        buttons.forEach((b,j)=>b.classList.toggle('active',i===j));
        rows[i].card.prepend(bar);
      }
      show(0);
    });
  }
  const baseRender=renderTests;renderTests=function(){
    const r=baseRender.apply(this,arguments);
    document.querySelectorAll('[data-edit-unconfined]').forEach(b=>b.addEventListener('click',()=>openEdit(b.dataset.editUnconfined)));
    compactSavedLevels();return r;
  };

  function sketchSvg(strokes){
    const lines=(Array.isArray(strokes)?strokes:[]).map(st=>`<polyline points="${(st||[]).map(p=>`${(Number(p.x)||0)*100},${(Number(p.y)||0)*160}`).join(' ')}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
    return `<svg viewBox="0 0 100 160">${lines}</svg>`;
  }
  function installReview(){
    window.addEventListener('click',e=>{
      const b=e.target.closest?.('[data-view-any-test]');if(!b)return;
      const p=typeof currentProject==='function'?currentProject():null;const t=p?.tests?.find(x=>x.id===b.dataset.viewAnyTest);
      if(!t||t.type!==TYPE)return;e.preventDefault();e.stopImmediatePropagation();
      const d=document.getElementById('testReviewDialog'),title=document.getElementById('testReviewTitle'),body=document.getElementById('testReviewBody');if(!d||!title||!body)return;
      const rows=(t.specimens||[]).map((s,i)=>`<tr><th>${i+1}</th><td>${esc(s.state||'—')}</td><td>${s.mass!=null?Number(s.mass).toFixed(1):'—'}</td><td>${s.diameter!=null?Number(s.diameter).toFixed(2):'—'}</td><td>${s.height!=null?Number(s.height).toFixed(2):'—'}</td><td><strong>${s.maxStrength!=null?Number(s.maxStrength).toFixed(1):'—'}</strong></td><td>${s.moisture?.w!=null?Number(s.moisture.w).toFixed(1)+' %':'—'}</td></tr>`).join('');
      const sketches=(t.specimens||[]).map((s,i)=>`<div style="text-align:center"><strong>${i+1}</strong><div style="height:150px;border:1px dashed #888;margin-top:5px">${sketchSvg(s.sketch)}</div></div>`).join('');
      title.textContent='一軸圧縮試験・詳細確認';body.innerHTML=`<p class="review-meta">試料：${esc(t.sample||'—')} ｜ 配合：${t.dosage!=null?Number(t.dosage).toFixed(0):'—'} kg/m³ ｜ 改良日：${esc(t.improvementDate||'—')} ｜ 圧縮日：${esc(t.compressionDate||'—')}</p><section class="review-section"><h3>供試体</h3><div class="table-wrap"><table class="review-table"><thead><tr><th>No.</th><th>状態</th><th>質量 g</th><th>直径 cm</th><th>高さ cm</th><th>最大値 kN/m²</th><th>含水比</th></tr></thead><tbody>${rows}</tbody></table></div></section><section class="review-section"><h3>破壊スケッチ</h3><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">${sketches}</div></section><div class="review-note">確認専用です。修正は「訂正」から行います。</div>`;d.showModal();
    },true);
  }

  // 破壊スケッチはフォーム要素ではないので、途中保存時に線データも退避する。

  window.SoilNoteUnconfinedDraft={
    snapshot:()=>{
      if(activeLevel!==null)levelCache.set(activeLevel,captureLevel());
      return {sketches:clone(sketchState),levels:[...levelValues],active:activeLevel,
        cache:Object.fromEntries(levelCache)};
    },
    restore:data=>{
      if(Array.isArray(data)){
        [1,2,3].forEach(i=>{sketchState[i-1]=clone(data[i-1]||[]);redraw(i);});
        return;
      }
      if(!data||typeof data!=='object')return;
      levelValues=Array.isArray(data.levels)&&data.levels.length?data.levels.map(n).filter(v=>v!==null):doseChoices(form()?.elements.sample.value||'');
      levelCache=new Map(Object.entries(data.cache||{}));
      const f=form(),sel=f?.elements.dosage;
      if(sel){
        levelValues.forEach(v=>{
          if(![...sel.options].some(o=>o.value===String(v))){
            sel.add(new Option(String(v)+' kg/m³',String(v)),sel.options[sel.options.length-1]);
          }
        });
      }
      activeLevel=null;
      switchLevel(data.active||levelValues[0],false);
    }
  };
  installReview();
  inject();
})();
