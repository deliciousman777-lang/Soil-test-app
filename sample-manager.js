// SoilNote 試料管理：工事件名 → 試料 → 各試験
(function(){
  const MANAGED_FORMS=['moistureForm','grainForm','particleDensityForm','atterbergForm','coneIndexForm'];
  const ADD_BUTTONS=['addMoistureBtn','addGrainBtn','addParticleDensityBtn','addAtterbergBtn','addConeIndexBtn'];
  let pendingTestButtonId=null;
  let editingSampleId=null;

  const now=()=>new Date().toISOString();
  const clean=v=>String(v??'').trim();
  const sameName=(a,b)=>clean(a).toLocaleLowerCase('ja-JP')===clean(b).toLocaleLowerCase('ja-JP');

  function sampleId(){
    try{return uid();}catch{return `${Date.now()}-${Math.random().toString(16).slice(2)}`;}
  }

  function ensureProjectSamples(project){
    if(!project)return false;
    let changed=false;
    if(!Array.isArray(project.samples)){
      project.samples=[];
      changed=true;
    }

    // 旧データ互換：文字列配列等があればオブジェクト形式へ変換。
    project.samples=project.samples.map(s=>{
      if(typeof s==='string'){
        changed=true;
        return {id:sampleId(),name:clean(s),createdAt:project.createdAt||now()};
      }
      if(!s||typeof s!=='object'){
        changed=true;
        return null;
      }
      const name=clean(s.name);
      if(!name)return null;
      if(!s.id){s.id=sampleId();changed=true;}
      if(!s.createdAt){s.createdAt=project.createdAt||now();changed=true;}
      if(s.name!==name){s.name=name;changed=true;}
      return s;
    }).filter(Boolean);

    // これまで各試験に直接入力していた試料名から自動移行。
    (project.tests||[]).forEach(test=>{
      const name=clean(test.sample);
      if(!name)return;
      let s=project.samples.find(x=>sameName(x.name,name));
      if(!s){
        s={id:sampleId(),name,createdAt:test.createdAt||project.createdAt||now()};
        project.samples.push(s);
        changed=true;
      }
      if(test.sampleId!==s.id){test.sampleId=s.id;changed=true;}
    });

    // 重複名を整理（先頭を残す）。
    const seen=[];
    const dedup=[];
    project.samples.forEach(s=>{
      const hit=seen.find(x=>sameName(x.name,s.name));
      if(hit){
        (project.tests||[]).forEach(t=>{if(t.sampleId===s.id)t.sampleId=hit.id;});
        changed=true;
      }else{seen.push(s);dedup.push(s);}
    });
    project.samples=dedup;

    const activeExists=project.samples.some(s=>s.id===project.activeSampleId);
    if(!activeExists){
      const next=project.samples[0]?.id||null;
      if(project.activeSampleId!==next){project.activeSampleId=next;changed=true;}
    }
    return changed;
  }

  function migrateAll(){
    let changed=false;
    (state.data.projects||[]).forEach(p=>{if(ensureProjectSamples(p))changed=true;});
    if(changed)saveData();
  }

  function samples(project=currentProject()){
    if(!project)return[];
    if(ensureProjectSamples(project))saveData();
    return project.samples||[];
  }

  function activeSample(project=currentProject()){
    if(!project)return null;
    const list=samples(project);
    return list.find(s=>s.id===project.activeSampleId)||list[0]||null;
  }

  function setActiveSample(id){
    const p=currentProject();if(!p)return;
    const s=samples(p).find(x=>x.id===id);if(!s)return;
    p.activeSampleId=s.id;
    saveData();
    syncSampleControls();
    renderSamplePanel();
  }

  function injectSamplePanel(){
    const detail=document.getElementById('detailView');
    const testPanel=detail?.querySelector('.panel');
    if(!detail||!testPanel||document.getElementById('samplePanel'))return;
    const panel=document.createElement('div');
    panel.id='samplePanel';panel.className='panel sample-panel';
    panel.innerHTML=`
      <div class="section-head sample-head">
        <div><h3>試料</h3><p>ここで一度登録すれば、各試験で試料名を打ち直す必要はありません。</p></div>
        <button type="button" id="addSampleBtn" class="primary">＋ 試料</button>
      </div>
      <div id="sampleList" class="sample-list"></div>
      <div id="emptySamples" class="empty compact"><strong>試料がまだありません</strong><span>最初に「＋ 試料」から登録してください。</span></div>`;
    testPanel.parentNode.insertBefore(panel,testPanel);
    panel.querySelector('#addSampleBtn').addEventListener('click',()=>openSampleDialog());
  }

  function injectSampleDialog(){
    if(document.getElementById('sampleDialog'))return;
    const d=document.createElement('dialog');d.id='sampleDialog';
    d.innerHTML=`<form id="sampleForm" method="dialog">
      <div class="dialog-head"><div><p class="eyebrow">SAMPLE</p><h2 id="sampleDialogTitle">試料を追加</h2></div><button type="button" class="icon-btn" id="sampleClose">×</button></div>
      <label>試料名 / No.<input name="name" required autocomplete="off" placeholder="例：No.1 現場発生土"></label>
      <label>メモ <input name="note" autocomplete="off" placeholder="例：GL-1.0〜2.0m（任意）"></label>
      <p class="hint">試料名は工事件名の中で一度だけ登録します。各試験では選ぶだけになります。</p>
      <div id="sampleFormCheck" class="mass-check">同じ工事件名の中で試料を管理します。</div>
      <div class="dialog-actions"><button type="button" class="ghost" id="sampleCancel">キャンセル</button><button class="primary" id="sampleSubmit">登録</button></div>
    </form>`;
    document.body.appendChild(d);
    d.querySelector('#sampleClose').addEventListener('click',()=>{pendingTestButtonId=null;d.close();});
    d.querySelector('#sampleCancel').addEventListener('click',()=>{pendingTestButtonId=null;d.close();});
    d.querySelector('#sampleForm').addEventListener('submit',saveSample);
  }

  function addStyles(){
    if(document.getElementById('sampleManagerStyles'))return;
    const s=document.createElement('style');s.id='sampleManagerStyles';s.textContent=`
      .sample-panel{margin-bottom:14px}.sample-head{align-items:center}.sample-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}.sample-card{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:stretch;border:1px solid var(--line,#dfe7e3);border-radius:15px;background:#fff;overflow:hidden}.sample-card.active{border-color:#4d8f72;box-shadow:0 0 0 2px rgba(11,81,54,.08);background:#f5fbf8}.sample-main{appearance:none;border:0;background:transparent;text-align:left;padding:12px 13px;color:inherit;min-width:0}.sample-main strong{display:block;font-size:16px;color:#1f2a24;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sample-main span{display:block;margin-top:4px;font-size:11px;color:var(--muted,#65716d)}.sample-card.active .sample-main strong{color:#0b5136}.sample-edit{border:0;border-left:1px solid var(--line,#dfe7e3);background:transparent;padding:0 12px;color:#0b5136;font-weight:700}.sample-active-badge{display:inline-block!important;width:max-content;margin-top:7px!important;padding:3px 7px;border-radius:999px;background:#e4f2ea;color:#0b5136!important;font-size:10px!important;font-weight:800}.managed-sample-label{position:relative}.managed-sample-select{width:100%;min-height:48px;border:1px solid var(--line,#dfe7e3);border-radius:12px;background:#fff;padding:0 40px 0 12px;font-size:16px;color:#1f2a24}.managed-sample-select:focus{outline:none;border-color:#0b5136;box-shadow:0 0 0 3px rgba(11,81,54,.10)}.managed-sample-select.single{background:#f2f7f4;font-weight:700;color:#0b5136}.sample-help{display:block;margin-top:4px;color:var(--muted,#65716d);font-size:10px}@media(max-width:600px){.sample-list{grid-template-columns:1fr}.sample-head{align-items:flex-start}.sample-head #addSampleBtn{white-space:nowrap}}
    `;document.head.appendChild(s);
  }

  function renderSamplePanel(){
    const p=currentProject();
    const listEl=document.getElementById('sampleList');
    const empty=document.getElementById('emptySamples');
    if(!p||!listEl||!empty)return;
    const list=samples(p);
    const active=activeSample(p);
    empty.classList.toggle('hidden',list.length>0);
    listEl.innerHTML=list.map(s=>{
      const count=(p.tests||[]).filter(t=>t.sampleId===s.id||sameName(t.sample,s.name)).length;
      const on=active?.id===s.id;
      return `<div class="sample-card${on?' active':''}">
        <button type="button" class="sample-main" data-select-sample="${escapeHtml(s.id)}"><strong>${escapeHtml(s.name)}</strong><span>${escapeHtml(s.note||'メモなし')} ｜ 試験 ${count}件</span>${on?'<span class="sample-active-badge">選択中</span>':''}</button>
        <button type="button" class="sample-edit" data-edit-sample="${escapeHtml(s.id)}">編集</button>
      </div>`;
    }).join('');
    listEl.querySelectorAll('[data-select-sample]').forEach(b=>b.addEventListener('click',()=>setActiveSample(b.dataset.selectSample)));
    listEl.querySelectorAll('[data-edit-sample]').forEach(b=>b.addEventListener('click',()=>openSampleDialog(b.dataset.editSample)));

    const hint=document.querySelector('#detailView .panel:not(#samplePanel) .section-head p');
    if(hint){
      if(!list.length)hint.textContent='最初に試料を登録すると、各試験で試料名の再入力が不要になります。';
      else if(list.length===1)hint.textContent=`「${list[0].name}」を各試験へ自動セットします。`;
      else hint.textContent=`選択中「${active?.name||''}」。試験画面でも試料を切り替えられます。`;
    }
  }

  function openSampleDialog(id=null){
    const p=currentProject();if(!p)return;
    injectSampleDialog();
    const d=document.getElementById('sampleDialog');
    const form=document.getElementById('sampleForm');
    form.reset();editingSampleId=id;
    const title=document.getElementById('sampleDialogTitle');
    const submit=document.getElementById('sampleSubmit');
    if(id){
      const s=samples(p).find(x=>x.id===id);if(!s)return;
      form.elements.name.value=s.name||'';form.elements.note.value=s.note||'';
      title.textContent='試料を編集';submit.textContent='変更を保存';
    }else{
      title.textContent='試料を追加';submit.textContent='登録';
    }
    document.getElementById('sampleFormCheck').textContent='同じ工事件名の中で試料を管理します。';
    d.showModal();
    setTimeout(()=>form.elements.name.focus(),0);
  }

  function saveSample(e){
    e.preventDefault();
    const p=currentProject();if(!p)return;
    const form=e.currentTarget;
    const name=clean(form.elements.name.value),note=clean(form.elements.note.value);
    if(!name)return;
    const list=samples(p);
    const duplicate=list.find(s=>sameName(s.name,name)&&s.id!==editingSampleId);
    const check=document.getElementById('sampleFormCheck');
    if(duplicate){check.textContent='⚠ 同じ試料名がすでに登録されています。';check.classList.add('error');return;}
    check.classList.remove('error');

    if(editingSampleId){
      const s=list.find(x=>x.id===editingSampleId);if(!s)return;
      const oldName=s.name;
      s.name=name;s.note=note;s.updatedAt=now();
      // 旧データとの互換性のため、紐づく試験の文字列名も同時に変更。
      (p.tests||[]).forEach(t=>{if(t.sampleId===s.id||sameName(t.sample,oldName)){t.sampleId=s.id;t.sample=name;}});
      p.activeSampleId=s.id;
    }else{
      const s={id:sampleId(),name,note,createdAt:now()};
      p.samples.push(s);p.activeSampleId=s.id;
    }
    p.updatedAt=now();saveData();
    document.getElementById('sampleDialog').close();
    editingSampleId=null;
    renderSamplePanel();syncSampleControls();renderTests();renderProjects();

    if(pendingTestButtonId){
      const id=pendingTestButtonId;pendingTestButtonId=null;
      setTimeout(()=>document.getElementById(id)?.click(),0);
    }
  }

  function replaceSampleInput(form){
    const input=form?.querySelector('input[name="sample"]');
    if(!input)return form?.querySelector('select[name="sample"]')||null;
    const select=document.createElement('select');
    select.name='sample';select.required=input.required;select.className='managed-sample-select';
    select.setAttribute('aria-label','試料名 / No.');
    input.replaceWith(select);
    const label=select.closest('label');
    if(label){label.classList.add('managed-sample-label');if(!label.querySelector('.sample-help')){const help=document.createElement('small');help.className='sample-help';help.textContent='工事件名に登録した試料から選択';label.appendChild(help);}}
    select.addEventListener('change',()=>{
      const p=currentProject();if(!p)return;
      const s=samples(p).find(x=>x.id===select.selectedOptions[0]?.dataset.sampleId)||samples(p).find(x=>sameName(x.name,select.value));
      if(s){p.activeSampleId=s.id;saveData();renderSamplePanel();syncSampleControls(select);}
    });
    return select;
  }

  function syncOneSelect(select){
    if(!select)return;
    const p=currentProject();
    const list=p?samples(p):[];
    const active=p?activeSample(p):null;
    const current=clean(select.value);
    select.innerHTML='';
    if(!list.length){
      const o=new Option('先に試料を登録してください','');o.defaultSelected=true;o.selected=true;select.add(o);
      select.classList.remove('single');return;
    }
    list.forEach(s=>{
      const o=new Option(s.name,s.name);
      o.dataset.sampleId=s.id;
      const should=(current&&sameName(current,s.name))||(!current&&active?.id===s.id);
      o.selected=should;o.defaultSelected=active?.id===s.id;
      select.add(o);
    });
    if(!select.value&&active)select.value=active.name;
    select.classList.toggle('single',list.length===1);
  }

  function syncSampleControls(except=null){
    MANAGED_FORMS.forEach(id=>{
      const form=document.getElementById(id);if(!form)return;
      const select=replaceSampleInput(form);
      if(select!==except)syncOneSelect(select);
    });
  }

  function attachSampleIdsAfterSave(){
    const p=currentProject();if(!p)return;
    if(ensureProjectSamples(p)){saveData();}
    else{
      // 新規保存データにも sampleId を確実に付与。
      (p.tests||[]).forEach(t=>{
        if(t.sampleId)return;
        const s=(p.samples||[]).find(x=>sameName(x.name,t.sample));
        if(s)t.sampleId=s.id;
      });
      saveData();
    }
    renderSamplePanel();
  }

  function wireEvents(){
    // 試料未登録で試験を押したら、その場で試料登録を先に開く。
    document.addEventListener('click',e=>{
      const b=e.target.closest('button');if(!b||!ADD_BUTTONS.includes(b.id))return;
      const p=currentProject();if(!p)return;
      if(samples(p).length===0){
        e.preventDefault();e.stopImmediatePropagation();
        pendingTestButtonId=b.id;openSampleDialog();return;
      }
      syncSampleControls();
    },true);

    // 各試験保存後に sampleId を補完。
    MANAGED_FORMS.forEach(id=>{
      const form=document.getElementById(id);if(form)form.addEventListener('submit',()=>setTimeout(attachSampleIdsAfterSave,0));
    });

    // 新規工事件名作成直後は最初の試料登録を自動表示。
    if(typeof projectForm!=='undefined'&&projectForm){
      projectForm.addEventListener('submit',()=>setTimeout(()=>{
        const p=currentProject();if(p&&samples(p).length===0)openSampleDialog();
      },0));
    }
  }

  function wrapProjectNavigation(){
    if(typeof openProject==='function'){
      const base=openProject;
      openProject=function(id){base(id);const p=currentProject();if(p&&ensureProjectSamples(p))saveData();renderSamplePanel();syncSampleControls();};
    }
  }

  function init(){
    migrateAll();injectSamplePanel();injectSampleDialog();addStyles();syncSampleControls();wrapProjectNavigation();wireEvents();
    if(currentProject()){renderSamplePanel();}
    window.SoilNoteSamples={samples,activeSample,setActiveSample,syncSampleControls,renderSamplePanel,ensureProjectSamples,openSampleDialog};
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
