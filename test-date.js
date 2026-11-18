// 全試験共通：試験日の入力・保存・訂正・確認
(function(){
  const CONFIGS={
    moistureForm:{type:'moisture',dialog:'moistureDialog',addBtn:'addMoistureBtn',editAttr:'data-edit-moisture'},
    grainForm:{type:'grain',dialog:'grainDialog',addBtn:'addGrainBtn',editAttr:'data-edit-grain'},
    particleDensityForm:{type:'particleDensity',dialog:'particleDensityDialog',addBtn:'addParticleDensityBtn',editAttr:'data-edit-pd'},
    atterbergForm:{type:'atterberg',dialog:'atterbergDialog',addBtn:'addAtterbergBtn',editAttr:'data-edit-atterberg'},
    coneIndexForm:{type:'cone-index',dialog:'coneIndexDialog',addBtn:'addConeIndexBtn',editAttr:'data-edit-cone-index'},
    compactionForm:{type:'compaction',dialog:'compactionDialog',addBtn:'addCompactionBtn',editAttr:'data-edit-compaction'},
    // 配合・一軸には元々「圧縮日／試験日」欄があるので二重に入力欄を作らない。
    mixDesignForm:{type:'mix-design',dialog:'mixDesignDialog',addBtn:'addMixDesignBtn',editAttr:'data-edit-mix-design',nativeDate:true},
    unconfinedForm:{type:'unconfined-compression',dialog:'unconfinedDialog',addBtn:'addUnconfinedBtn',editAttr:'data-edit-unconfined',nativeDate:true}
  };

  const esc=v=>typeof escapeHtml==='function'?escapeHtml(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const today=()=>{
    const d=new Date();
    const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  };
  const displayDate=v=>{
    if(!v)return '';
    const m=String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m?`${m[1]}/${m[2]}/${m[3]}`:String(v);
  };

  function current(){
    try{return currentProject?.()||null;}catch{return null;}
  }
  function testById(id){return current()?.tests?.find(t=>t.id===id)||null;}
  function cfgForForm(form){return form?CONFIGS[form.id]||null:null;}
  function formIdForType(type){return Object.keys(CONFIGS).find(id=>CONFIGS[id].type===type)||'';}

  function injectDateField(form){
    if(!form||cfgForForm(form)?.nativeDate||form.elements?.testDate)return;
    const sample=form.elements?.sample;
    if(!sample)return;
    const sampleLabel=sample.closest('label');
    if(!sampleLabel)return;
    const label=document.createElement('label');
    label.className='test-date-field';
    label.innerHTML='試験日<input type="date" name="testDate" autocomplete="off" />';
    sampleLabel.insertAdjacentElement('afterend',label);
    if(!document.getElementById('testDateStyles')){
      const s=document.createElement('style');s.id='testDateStyles';s.textContent=`
        .test-date-field{min-width:170px}.test-date-field input{min-height:44px}.test-date-chip{display:inline-flex;align-items:center;margin-top:6px;padding:4px 8px;border-radius:999px;background:#eef5f2;color:#245345;font-size:11px;font-weight:800}.review-test-date{margin:0 0 12px;padding:10px 12px;border:1px solid var(--line,#dfe7e3);border-radius:12px;background:#f3f8f6;color:#234d41;font-size:13px;font-weight:800}
      `;document.head.appendChild(s);
    }
  }

  function ensureFields(){
    Object.keys(CONFIGS).forEach(id=>injectDateField(document.getElementById(id)));
  }

  function storedDate(test){
    return test?.draftFields?.testDate || test?.testDate ||
      test?.draftFields?.compressionDate || test?.compressionDate || '';
  }

  function setNewDate(form){
    if(!form)return;
    const cfg=cfgForForm(form);
    injectDateField(form);
    // 配合・一軸は元からある圧縮日欄と連動させ、既存の初期値は変えない。
    if(!cfg?.nativeDate && form.elements.testDate)form.elements.testDate.value=today();
    form.dataset.testDateTargetId='';
  }

  function setEditDate(form,test){
    if(!form||!test)return;
    const cfg=cfgForForm(form);
    injectDateField(form);
    if(!cfg?.nativeDate && form.elements.testDate)form.elements.testDate.value=storedDate(test);
    form.dataset.testDateTargetId=test.id;
  }

  // submit時に日付を控えておき、保存成功後の試験データに確実に書き込む。
  // 入力フォームは保存直後にresetされるため、その後に読むと日付が消えてしまう。
  function attachDateAfterSave(form,cfg,before,editId,submittedDate){
    const dialog=document.getElementById(cfg.dialog);
    setTimeout(()=>{
      // 入力エラーで閉じていなければ保存していない。
      if(dialog?.open)return;
      const p=current();if(!p)return;
      const tests=(p.tests||[]).filter(t=>t.type===cfg.type);
      let saved=tests.filter(t=>{
        const old=before.get(t.id);
        return !old || old.updatedAt!==t.updatedAt ||
          old.draftSavedAt!==t.draftSavedAt || old.draft!==Boolean(t.draft);
      });
      // 同じミリ秒内の訂正でupdatedAtが変わらない場合への対応。
      if(!saved.length&&editId){
        const edited=tests.find(t=>t.id===editId);
        if(edited)saved=[edited];
      }
      if(!saved.length)return;
      let changed=false;
      for(const test of saved){
        // 一軸は複数水準を一括保存するので水準ごとの圧縮日を優先する。
        const value=cfg.nativeDate
          ? (test.compressionDate||test.draftFields?.compressionDate||test.testDate||submittedDate||'')
          : (submittedDate||test.draftFields?.testDate||test.testDate||'');
        if(!value)continue; // 空欄が古い日付を消さないようにする
        if(test.testDate!==value){test.testDate=value;changed=true;}
        if(test.draft&&test.draftFields?.testDate!==value){
          test.draftFields={...(test.draftFields||{}),testDate:value};
          changed=true;
        }
      }
      if(changed){
        p.updatedAt=new Date().toISOString();
        saveData();
        renderTests();
      }
    },0);
  }

  function handleFinalSubmit(form){
    const cfg=cfgForForm(form);if(!cfg)return;
    const p=current();if(!p)return;
    const before=new Map((p.tests||[]).filter(t=>t.type===cfg.type).map(t=>
      [t.id,{updatedAt:t.updatedAt,draftSavedAt:t.draftSavedAt,draft:Boolean(t.draft)}]));
    const editId=state.editingTestId||form.dataset.testDateTargetId||'';
    const value=cfg.nativeDate
      ? (form.elements.compressionDate?.value||'')
      : (form.elements.testDate?.value||'');
    attachDateAfterSave(form,cfg,before,editId,value);
  }

  function enhanceCards(){
    const p=current();if(!p)return;
    document.querySelectorAll('#testList .card').forEach(card=>{
      if(card.querySelector('.test-date-chip'))return;
      const edit=card.querySelector('.edit-btn');
      if(!edit)return;
      const attr=[...edit.attributes].find(a=>a.name.startsWith('data-edit-'));
      const id=attr?.value;if(!id)return;
      const test=p.tests?.find(t=>t.id===id);if(!storedDate(test))return;
      const value=storedDate(test);
      const host=card.querySelector('.card-title-row > div')||card;
      const chip=document.createElement('span');chip.className='test-date-chip';chip.textContent=`試験日 ${displayDate(value)}`;
      host.appendChild(chip);
    });
  }

  function addDateToReview(id){
    const test=testById(id);if(!test)return;
    const value=storedDate(test);if(!value)return;
    setTimeout(()=>{
      const body=document.getElementById('testReviewBody');if(!body||body.querySelector('.review-test-date'))return;
      const box=document.createElement('div');box.className='review-test-date';box.textContent=`試験日：${displayDate(value)}`;
      body.prepend(box);
    },0);
  }

  document.addEventListener('click',e=>{
    const target=e.target.closest?.('button');if(!target)return;

    // 新規試験
    const newCfg=Object.values(CONFIGS).find(c=>target.id===c.addBtn);
    if(newCfg){
      const formId=formIdForType(newCfg.type);
      setTimeout(()=>setNewDate(document.getElementById(formId)),0);
      return;
    }

    // 訂正・途中保存の続き
    if(target.classList.contains('edit-btn')){
      const attr=[...target.attributes].find(a=>a.name.startsWith('data-edit-'));
      const id=attr?.value;const test=testById(id);if(test){
        const formId=formIdForType(test.type);
        setTimeout(()=>setEditDate(document.getElementById(formId),test),0);
      }
    }

    // 確認画面にも試験日を表示
    const review=target.closest('[data-view-test],[data-view-any-test]');
    if(review){addDateToReview(review.dataset.viewTest||review.dataset.viewAnyTest);}

    // 保存はsubmitイベントで扱う（途中保存・入力エラーとの混同を防ぐ）。
  },true);

  // ボタン、Enterキー、iPhoneの完了操作のすべてをsubmitで捕捉する。
  document.addEventListener('submit',e=>handleFinalSubmit(e.target),true);

  if(typeof renderTests==='function'){
    const base=renderTests;
    renderTests=function(){base();enhanceCards();};
  }

  const observer=new MutationObserver(()=>{ensureFields();enhanceCards();});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  ensureFields();
  queueMicrotask(enhanceCards);
})();
