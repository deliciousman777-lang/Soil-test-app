// 沈降分析ワークベンチ
// 画面を離れても進行中データを保持し、複数工事・複数試料を1画面で並行管理する。
(function(){
  const STORAGE_KEY='soilnote-sedimentation-runs-v1';
  const SAMPLE_CONTAINER='sedSampleContainerNo';
  const TIMES=Array.isArray(window.SED_TIMES_EXT)?window.SED_TIMES_EXT:(typeof SED_TIMES_EXT!=='undefined'?SED_TIMES_EXT:[1,2,5,15,30,60,240,1440]);
  let renderTimer=null;
  let saveTimer=null;
  let pendingFinalSubmit=null;

  const esc=v=>typeof escapeHtml==='function'?escapeHtml(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const uidLocal=()=>typeof uid==='function'?uid():`${Date.now()}-${Math.random().toString(16).slice(2)}`;

  function loadRuns(){
    try{
      const x=JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(x)?x:[];
    }catch{return [];}
  }
  function saveRuns(runs){localStorage.setItem(STORAGE_KEY,JSON.stringify(runs));}
  function projectById(id){
    try{return state?.data?.projects?.find(p=>p.id===id)||null;}catch{return null;}
  }
  function current(){
    try{return currentProject?.()||null;}catch{return null;}
  }

  function serializeForm(){
    const form=document.getElementById('grainForm');
    const fields={};
    if(!form)return fields;
    [...form.elements].forEach(el=>{
      if(!el.name||['submit','button','reset'].includes(el.type))return;
      if(el.type==='radio'){
        if(el.checked)fields[el.name]=el.value;
      }else fields[el.name]=el.type==='checkbox'?Boolean(el.checked):el.value;
    });
    return fields;
  }

  function applyFields(fields){
    const form=document.getElementById('grainForm');
    if(!form||!fields)return;
    Object.entries(fields).forEach(([name,value])=>{
      const controls=form.elements[name];if(!controls)return;
      const list=(typeof controls.length==='number'&&!controls.tagName)?[...controls]:[controls];
      list.forEach(el=>{
        if(el.type==='checkbox')el.checked=Boolean(value);
        else if(el.type==='radio')el.checked=String(el.value)===String(value);
        else el.value=value??'';
      });
    });
    form.dispatchEvent(new Event('input',{bubbles:true}));
    form.dispatchEvent(new Event('change',{bubbles:true}));
    try{updateSedimentationVisibility?.();}catch{}
    try{updateSedimentationPreview?.();}catch{}
  }

  function activeRunId(){return document.getElementById('grainForm')?.dataset?.sedRunId||'';}
  function runById(id,runs=loadRuns()){return runs.find(r=>r.id===id)||null;}

  function runLabel(run){
    const p=projectById(run.projectId);
    return {
      projectName:p?.name||run.projectName||'工事件名未設定',
      cardNo:p?.constructionCardNo||run.constructionCardNo||'',
      sample:String(run.fields?.sample||run.sample||'試料名未入力').trim()||'試料名未入力',
      container:String(run.fields?.[SAMPLE_CONTAINER]||run.sampleContainerNo||'').trim(),
      cylinder:String(run.fields?.cylinderNo||run.cylinderNo||'').trim(),
    };
  }

  function ensureRun(opts={}){
    const form=document.getElementById('grainForm');
    const p=current();
    if(!form||!p)return null;
    let runs=loadRuns();
    let run=runById(activeRunId(),runs);
    if(!run){
      run={
        id:uidLocal(),projectId:p.id,projectName:p.name||'',constructionCardNo:p.constructionCardNo||'',
        createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),startAt:null,status:'prepared',fields:{}
      };
      runs.push(run);
      form.dataset.sedRunId=run.id;
    }
    run.projectId=p.id;
    run.projectName=p.name||run.projectName||'';
    run.constructionCardNo=p.constructionCardNo||run.constructionCardNo||'';
    run.fields=serializeForm();
    run.sample=String(run.fields.sample||'').trim();
    run.sampleContainerNo=String(run.fields[SAMPLE_CONTAINER]||'').trim();
    run.cylinderNo=String(run.fields.cylinderNo||'').trim();
    run.updatedAt=new Date().toISOString();
    if(opts.startNow){
      const now=new Date();
      run.startAt=now.toISOString();
      run.status='active';
      const hh=String(now.getHours()).padStart(2,'0');
      const mm=String(now.getMinutes()).padStart(2,'0');
      if(form.elements.sedStartTime){form.elements.sedStartTime.value=`${hh}:${mm}`;run.fields.sedStartTime=`${hh}:${mm}`;}
    }
    saveRuns(runs);
    updateWorkbenchButton();
    renderWorkbench();
    return run;
  }

  function inferStartAtFromClock(clock){
    if(!/^\d{1,2}:\d{2}$/.test(String(clock||'')))return null;
    const [h,m]=String(clock).split(':').map(Number);
    if(!Number.isFinite(h)||!Number.isFinite(m))return null;
    const now=new Date();
    const d=new Date(now);d.setHours(h,m,0,0);
    if(d.getTime()-now.getTime()>6*3600e3)d.setDate(d.getDate()-1);
    return d.toISOString();
  }

  function autosaveCurrent(){
    const form=document.getElementById('grainForm');
    if(!form?.elements?.useSedimentation?.checked)return;
    clearTimeout(saveTimer);
    saveTimer=setTimeout(()=>{
      const run=ensureRun();if(!run)return;
      if(!run.startAt){
        const fields=run.fields||{};
        const hasReading=TIMES.some((_,i)=>String(fields[`sed_r_${i}`]||'').trim()!=='');
        if(hasReading){
          const runs=loadRuns();const x=runById(run.id,runs);
          if(x&&!x.startAt){x.startAt=inferStartAtFromClock(fields.sedStartTime)||new Date().toISOString();x.status='active';x.updatedAt=new Date().toISOString();saveRuns(runs);}
        }
      }
      updateWorkbenchButton();renderWorkbench();
    },180);
  }

  function injectSampleContainer(){
    const form=document.getElementById('grainForm');
    if(!form||form.elements[SAMPLE_CONTAINER])return;
    const grid=form.querySelector('#sedimentationSection .sed-lab-settings, #sedimentationSection .sed-settings');
    if(!grid)return;
    const label=document.createElement('label');
    label.innerHTML=`沈降分析前 試料容器No.<input name="${SAMPLE_CONTAINER}" autocomplete="off" placeholder="例：13" />`;
    grid.insertAdjacentElement('afterbegin',label);
  }

  function injectStartControl(){
    const sec=document.getElementById('sedimentationSection');
    if(!sec||document.getElementById('sedStartRunBtn'))return;
    const box=document.createElement('div');box.className='sed-run-control';
    box.innerHTML=`<div><strong>沈降分析を並行管理</strong><span>開始後は画面を閉じても1・2・5・15…分の読みと進行状態を保持します。</span></div><button type="button" id="sedStartRunBtn" class="primary">▶ 今から開始</button>`;
    sec.insertAdjacentElement('afterbegin',box);
    box.querySelector('#sedStartRunBtn').addEventListener('click',()=>{
      const form=document.getElementById('grainForm');
      if(!form?.elements?.useSedimentation?.checked)return;
      const sample=String(form.elements.sample?.value||'').trim();
      const container=String(form.elements[SAMPLE_CONTAINER]?.value||'').trim();
      if(!sample){alert('試料名 / No. を入力してください。');form.elements.sample?.focus();return;}
      if(!container){alert('取り違え防止のため「沈降分析前 試料容器No.」を入力してください。');form.elements[SAMPLE_CONTAINER]?.focus();return;}
      ensureRun({startNow:true});
      alert('沈降分析を開始しました。画面を閉じても「⏱ 沈降進行中」から続けられます。');
    });
  }

  function nextIndex(run){
    const f=run.fields||{};
    for(let i=0;i<TIMES.length;i++)if(String(f[`sed_r_${i}`]||'').trim()==='')return i;
    return -1;
  }
  function dueAt(run,index){
    if(!run.startAt||index<0)return null;
    const t=new Date(run.startAt).getTime();if(!Number.isFinite(t))return null;
    return t+Number(TIMES[index])*60000;
  }
  function countdown(ms){
    const abs=Math.abs(ms);const total=Math.floor(abs/1000);const h=Math.floor(total/3600);const m=Math.floor((total%3600)/60);const s=total%60;
    const text=h>0?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`;
    return ms>=0?`あと ${text}`:`${text} 超過`;
  }

  function updateWorkbenchButton(){
    const btn=document.getElementById('openSedWorkbenchBtn');if(!btn)return;
    const runs=loadRuns();
    const active=runs.filter(r=>r.status!=='finished').length;
    btn.textContent=`⏱ 沈降進行中 ${active}`;
    btn.classList.toggle('has-active',active>0);
  }

  function workbenchCard(run){
    const label=runLabel(run);const ni=nextIndex(run);const due=dueAt(run,ni);const now=Date.now();
    const status=ni<0?'8点入力済み':!run.startAt?'開始待ち':`${TIMES[ni]}分 ${countdown(due-now)}`;
    const readingChips=TIMES.map((t,i)=>{
      const v=String(run.fields?.[`sed_r_${i}`]||'').trim();
      return `<span class="sed-chip ${v?'done':''}">${t}分 ${v?`✓ ${esc(v)}`:'—'}</span>`;
    }).join('');
    const nextInput=ni>=0?`<div class="sed-next-input"><label>次：${TIMES[ni]}分の浮ひょう r<input inputmode="decimal" data-sed-direct-input="${esc(run.id)}" data-index="${ni}" placeholder="例：175" /></label><button type="button" class="primary" data-sed-direct-save="${esc(run.id)}" data-index="${ni}">記録</button></div>`:`<div class="sed-complete">✓ 沈降分析 8点入力済み</div>`;
    return `<article class="sed-run-card" data-run-card="${esc(run.id)}">
      <div class="sed-run-head"><div><p>${esc(label.cardNo?`${label.projectName} ｜ ${label.cardNo}`:label.projectName)}</p><h3>${esc(label.sample)}</h3></div><strong class="sed-run-status">${esc(status)}</strong></div>
      <div class="sed-identifiers"><span>試料容器 No.${esc(label.container||'—')}</span><span>メスシリンダー No.${esc(label.cylinder||'—')}</span></div>
      <div class="sed-chip-row">${readingChips}</div>${nextInput}
      <div class="sed-run-actions">${!run.startAt?`<button type="button" class="ghost" data-sed-start="${esc(run.id)}">今から開始</button>`:''}<button type="button" class="ghost" data-sed-open="${esc(run.id)}">粒度画面を開く</button><button type="button" class="ghost danger" data-sed-remove="${esc(run.id)}">一覧から削除</button></div>
    </article>`;
  }

  function renderWorkbench(){
    const root=document.getElementById('sedWorkbenchList');if(!root)return;
    const runs=loadRuns().filter(r=>r.status!=='finished');
    runs.sort((a,b)=>{
      const ai=nextIndex(a),bi=nextIndex(b);const ad=dueAt(a,ai)??Infinity,bd=dueAt(b,bi)??Infinity;return ad-bd;
    });
    root.innerHTML=runs.length?runs.map(workbenchCard).join(''):'<div class="empty compact"><strong>進行中の沈降分析はありません</strong><span>粒度試験で「沈降分析を行う」をONにして開始してください。</span></div>';
  }

  function injectWorkbench(){
    if(!document.getElementById('openSedWorkbenchBtn')){
      const top=document.querySelector('.topbar');
      const newBtn=document.getElementById('newProjectBtn');
      if(top&&newBtn){
        const b=document.createElement('button');b.id='openSedWorkbenchBtn';b.type='button';b.className='sed-workbench-btn';b.textContent='⏱ 沈降進行中 0';
        newBtn.insertAdjacentElement('beforebegin',b);
        b.addEventListener('click',()=>{renderWorkbench();document.getElementById('sedWorkbenchDialog')?.showModal();});
      }
    }
    if(!document.getElementById('sedWorkbenchDialog')){
      const d=document.createElement('dialog');d.id='sedWorkbenchDialog';d.className='wide-dialog sed-workbench-dialog';
      d.innerHTML=`<div class="dialog-head"><div><p class="eyebrow">SEDIMENTATION</p><h2>沈降分析・進行中</h2></div><button type="button" class="icon-btn" id="closeSedWorkbench">×</button></div><p class="hint">工事件名を切り替えず、ここで複数試料の次の浮ひょう読みを直接記録できます。期限が近い順に並びます。</p><div id="sedWorkbenchList" class="sed-workbench-list"></div>`;
      document.body.appendChild(d);
      d.querySelector('#closeSedWorkbench').addEventListener('click',()=>d.close());
    }
    if(!document.getElementById('sedWorkbenchStyles')){
      const s=document.createElement('style');s.id='sedWorkbenchStyles';s.textContent=`
        .topbar{gap:8px}.sed-workbench-btn{margin-left:auto;border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.12);color:inherit;border-radius:12px;padding:10px 12px;font-weight:800}.topbar #newProjectBtn{margin-left:0}.sed-workbench-btn.has-active{box-shadow:0 0 0 2px rgba(255,255,255,.2) inset}
        .sed-run-control{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 14px;padding:12px 14px;border-radius:14px;background:#eef8f3;border:1px solid #cfe2da}.sed-run-control strong{display:block}.sed-run-control span{display:block;margin-top:3px;font-size:11px;color:#5e6f69}
        .sed-workbench-dialog{width:min(96vw,980px);max-width:none;padding:18px}.sed-workbench-list{display:grid;gap:12px}.sed-run-card{border:1px solid var(--line,#dfe7e4);border-radius:16px;padding:14px;background:#fff}.sed-run-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.sed-run-head p{font-size:11px;color:var(--muted,#6b7774);margin:0 0 3px}.sed-run-head h3{margin:0}.sed-run-status{font-size:14px;color:#0b5136;white-space:nowrap}.sed-identifiers{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.sed-identifiers span{padding:6px 9px;border-radius:999px;background:#f1f5f3;font-size:12px;font-weight:800}.sed-chip-row{display:flex;gap:6px;flex-wrap:wrap}.sed-chip{font-size:11px;padding:5px 7px;border-radius:8px;background:#f4f5f5;color:#77817e}.sed-chip.done{background:#e7f4ee;color:#155343;font-weight:800}.sed-next-input{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end;margin-top:12px;padding-top:12px;border-top:1px solid var(--line,#dfe7e4)}.sed-next-input label{margin:0}.sed-next-input input{margin-top:5px}.sed-complete{margin-top:12px;padding:10px;border-radius:10px;background:#e7f4ee;color:#155343;font-weight:800}.sed-run-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.sed-run-actions .danger{color:#a53636;border-color:#e2bcbc}.sed-workbench-dialog::backdrop{background:rgba(0,0,0,.45)}
        @media(max-width:680px){.topbar{flex-wrap:wrap}.sed-workbench-btn{order:3;width:100%;margin-left:0}.sed-run-control{align-items:stretch;flex-direction:column}.sed-run-control button{width:100%}.sed-run-head{display:block}.sed-run-status{display:block;margin-top:6px}.sed-next-input{grid-template-columns:1fr}.sed-next-input button{width:100%}}
      `;document.head.appendChild(s);
    }
    updateWorkbenchButton();renderWorkbench();
  }

  function directSave(runId,index,value){
    const runs=loadRuns();const run=runById(runId,runs);if(!run)return;
    const text=String(value||'').trim();if(!text)return;
    const n=Number(text);if(!Number.isFinite(n)){alert('浮ひょうの読みを数値で入力してください。');return;}
    run.fields=run.fields||{};run.fields[`sed_r_${index}`]=text;run.updatedAt=new Date().toISOString();
    if(!run.startAt){run.startAt=new Date(Date.now()-Number(TIMES[index])*60000).toISOString();run.status='active';}
    saveRuns(runs);
    const form=document.getElementById('grainForm');
    if(form?.dataset?.sedRunId===runId&&form.elements[`sed_r_${index}`]){
      form.elements[`sed_r_${index}`].value=text;form.dispatchEvent(new Event('input',{bubbles:true}));
    }
    renderWorkbench();updateWorkbenchButton();
  }

  function startExisting(runId){
    const runs=loadRuns();const run=runById(runId,runs);if(!run)return;
    run.startAt=new Date().toISOString();run.status='active';run.updatedAt=new Date().toISOString();
    const now=new Date();const hh=String(now.getHours()).padStart(2,'0'),mm=String(now.getMinutes()).padStart(2,'0');run.fields=run.fields||{};run.fields.sedStartTime=`${hh}:${mm}`;
    saveRuns(runs);renderWorkbench();updateWorkbenchButton();
  }

  function openRun(runId){
    const run=runById(runId);if(!run)return;
    const p=projectById(run.projectId);if(!p){alert('この沈降分析の工事件名が見つかりません。');return;}
    document.getElementById('sedWorkbenchDialog')?.close();
    try{openProject(p.id);}catch{}
    const form=document.getElementById('grainForm');
    try{resetGrainDialog?.();}catch{}
    if(form){form.dataset.sedRunId=run.id;applyFields(run.fields);}
    document.getElementById('grainDialog')?.showModal();
  }

  function removeRun(runId){
    const run=runById(runId);if(!run)return;
    const label=runLabel(run);
    if(!confirm(`${label.sample}（試料容器 No.${label.container||'—'}）を進行中一覧から削除しますか？\n保存済みの完成試験データは削除しません。`))return;
    const runs=loadRuns().filter(r=>r.id!==runId);saveRuns(runs);
    const form=document.getElementById('grainForm');if(form?.dataset?.sedRunId===runId)form.dataset.sedRunId='';
    renderWorkbench();updateWorkbenchButton();
  }

  function restoreLatestForCurrentProject(){
    const form=document.getElementById('grainForm');const p=current();if(!form||!p)return;
    const runs=loadRuns().filter(r=>r.projectId===p.id&&r.status!=='finished').sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
    if(runs.length!==1)return;
    const run=runs[0];form.dataset.sedRunId=run.id;applyFields(run.fields);
  }

  function attachFinalSedimentation(test,payload,containerNo){
    if(!test||!payload?.enabled||!payload?.valid)return;
    test.sedimentation=payload;
    test.sedimentation.settings=test.sedimentation.settings||{};
    test.sedimentation.settings.sampleContainerNo=containerNo||'';
  }

  function installFinalSaveHook(){
    document.addEventListener('submit',e=>{
      if(e.target?.id!=='grainForm')return;
      const form=e.target;
      if(!form.elements.useSedimentation?.checked)return;
      const payload=typeof getSedimentationPayloadExt==='function'?getSedimentationPayloadExt():null;
      if(!payload?.valid){
        e.preventDefault();e.stopImmediatePropagation();
        ensureRun();
        alert('沈降分析はまだ途中です。画面を閉じてもデータは消えません。上の「⏱ 沈降進行中」から続けて、8点入力後に保存してください。');
        return;
      }
      const p=current();if(!p)return;
      pendingFinalSubmit={
        projectId:p.id,editId:state?.editingTestId||'',beforeIds:new Set((p.tests||[]).map(t=>t.id)),
        sample:String(form.elements.sample?.value||'').trim(),payload,
        containerNo:String(form.elements[SAMPLE_CONTAINER]?.value||'').trim(),runId:activeRunId()
      };
      setTimeout(()=>{
        const pending=pendingFinalSubmit;pendingFinalSubmit=null;if(!pending)return;
        const pp=projectById(pending.projectId);if(!pp)return;
        if(document.getElementById('grainDialog')?.open)return;
        let test=pending.editId?pp.tests.find(t=>t.id===pending.editId&&t.type==='grain'):null;
        if(!test){
          test=(pp.tests||[]).filter(t=>t.type==='grain'&&!pending.beforeIds.has(t.id)).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))[0]||null;
        }
        if(!test&&pending.sample){
          test=[...(pp.tests||[])].filter(t=>t.type==='grain'&&!t.draft&&String(t.sample||'')===pending.sample).sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')))[0]||null;
        }
        if(!test)return;
        attachFinalSedimentation(test,pending.payload,pending.containerNo);
        try{saveData?.();renderTests?.();}catch{}
        if(pending.runId){saveRuns(loadRuns().filter(r=>r.id!==pending.runId));}
        updateWorkbenchButton();renderWorkbench();
      },0);
    },true);
  }

  function patchEditAndCards(){
    if(typeof openEditGrain==='function'&&!openEditGrain.__sedWorkbenchPatched){
      const base=openEditGrain;
      const wrapped=function(testId){
        base(testId);injectSampleContainer();injectStartControl();
        const p=current();const t=p?.tests?.find(x=>x.id===testId&&x.type==='grain');
        const form=document.getElementById('grainForm');if(!form||!t)return;
        if(t.sedimentation?.settings?.sampleContainerNo)form.elements[SAMPLE_CONTAINER].value=t.sedimentation.settings.sampleContainerNo;
        if(t.sedimentation?.enabled){
          let runs=loadRuns();let run=runs.find(r=>r.projectId===p.id&&String(r.fields?.sample||'')===String(t.sample||''));
          if(!run){run={id:uidLocal(),projectId:p.id,projectName:p.name||'',constructionCardNo:p.constructionCardNo||'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),startAt:null,status:'prepared',fields:serializeForm()};runs.push(run);saveRuns(runs);}
          form.dataset.sedRunId=run.id;
        }
      };
      wrapped.__sedWorkbenchPatched=true;openEditGrain=wrapped;
    }

    if(typeof renderGrainCard==='function'&&!renderGrainCard.__sedWorkbenchPatched){
      const base=renderGrainCard;
      const wrapped=function(test){
        let html=base(test);if(test?.draft)return html;
        const no=test?.sedimentation?.settings?.sampleContainerNo;
        if(no&&test?.sedimentation?.enabled)html+=`<div class="grain-wash-card-meta">沈降分析前 試料容器 No.${esc(no)}</div>`;
        return html;
      };
      wrapped.__sedWorkbenchPatched=true;renderGrainCard=wrapped;
    }
  }

  document.addEventListener('click',e=>{
    const save=e.target.closest?.('[data-sed-direct-save]');
    if(save){const id=save.dataset.sedDirectSave,index=Number(save.dataset.index);const input=document.querySelector(`[data-sed-direct-input="${CSS.escape(id)}"][data-index="${index}"]`);directSave(id,index,input?.value);return;}
    const start=e.target.closest?.('[data-sed-start]');if(start){startExisting(start.dataset.sedStart);return;}
    const open=e.target.closest?.('[data-sed-open]');if(open){openRun(open.dataset.sedOpen);return;}
    const remove=e.target.closest?.('[data-sed-remove]');if(remove){removeRun(remove.dataset.sedRemove);return;}
  });

  document.addEventListener('keydown',e=>{
    const input=e.target.closest?.('[data-sed-direct-input]');if(!input||e.key!=='Enter')return;
    e.preventDefault();directSave(input.dataset.sedDirectInput,Number(input.dataset.index),input.value);
  });

  function init(){
    injectSampleContainer();injectStartControl();injectWorkbench();patchEditAndCards();installFinalSaveHook();
    const form=document.getElementById('grainForm');
    form?.addEventListener('input',autosaveCurrent);
    form?.addEventListener('change',autosaveCurrent);
    document.getElementById('grainDialog')?.addEventListener('close',()=>{if(form?.elements?.useSedimentation?.checked)ensureRun();});
    document.getElementById('addGrainBtn')?.addEventListener('click',()=>setTimeout(()=>{injectSampleContainer();injectStartControl();restoreLatestForCurrentProject();},0));
    renderTimer=setInterval(()=>{if(document.getElementById('sedWorkbenchDialog')?.open)renderWorkbench();updateWorkbenchButton();},1000);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
