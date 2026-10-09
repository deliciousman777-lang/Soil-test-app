// 全試験共通：試験日の入力・保存・訂正・確認
(function(){
  const CONFIGS={
    moistureForm:{type:'moisture',dialog:'moistureDialog',addBtn:'addMoistureBtn',editAttr:'data-edit-moisture'},
    grainForm:{type:'grain',dialog:'grainDialog',addBtn:'addGrainBtn',editAttr:'data-edit-grain'},
    particleDensityForm:{type:'particleDensity',dialog:'particleDensityDialog',addBtn:'addParticleDensityBtn',editAttr:'data-edit-pd'},
    atterbergForm:{type:'atterberg',dialog:'atterbergDialog',addBtn:'addAtterbergBtn',editAttr:'data-edit-atterberg'},
    coneIndexForm:{type:'cone-index',dialog:'coneIndexDialog',addBtn:'addConeIndexBtn',editAttr:'data-edit-cone-index'}
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
    if(!form||form.elements?.testDate)return;
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

  function setNewDate(form){
    if(!form)return;
    injectDateField(form);
    if(form.elements.testDate)form.elements.testDate.value=today();
    form.dataset.testDateTargetId='';
  }

  function setEditDate(form,test){
    if(!form||!test)return;
    injectDateField(form);
    const draftDate=test.draftFields?.testDate;
    if(form.elements.testDate)form.elements.testDate.value=draftDate??test.testDate??'';
    form.dataset.testDateTargetId=test.id;
  }

  function attachDateAfterSave(form,cfg,beforeIds,editId,value){
    const dialog=document.getElementById(cfg.dialog);
    setTimeout(()=>{
      // バリデーションエラーならダイアログが開いたままなので何もしない
      if(dialog?.open)return;
      const p=current();if(!p)return;
      let test=editId?p.tests.find(t=>t.id===editId&&t.type===cfg.type):null;
      if(!test){
        const created=[...(p.tests||[])].reverse().find(t=>t.type===cfg.type&&!beforeIds.has(t.id));
        if(created)test=created;
      }
      if(!test)return;
      test.testDate=value||'';
      if(test.draftFields)test.draftFields.testDate=value||'';
      p.updatedAt=new Date().toISOString();
      saveData();
      renderTests();
    },0);
  }

  function handleFinalSaveClick(button){
    const form=button.closest('form');
    const cfg=cfgForForm(form);if(!cfg)return;
    // 「途中保存」やキャンセルは対象外
    if(button.type==='button')return;
    const p=current();if(!p)return;
    const beforeIds=new Set((p.tests||[]).map(t=>t.id));
    const editId=state.editingTestId||form.dataset.testDateTargetId||'';
    const value=form.elements.testDate?.value||'';
    attachDateAfterSave(form,cfg,beforeIds,editId,value);
  }

  function enhanceCards(){
    const p=current();if(!p)return;
    document.querySelectorAll('#testList .card').forEach(card=>{
      if(card.querySelector('.test-date-chip'))return;
      const edit=card.querySelector('.edit-btn');
      if(!edit)return;
      const attr=[...edit.attributes].find(a=>a.name.startsWith('data-edit-'));
      const id=attr?.value;if(!id)return;
      const test=p.tests?.find(t=>t.id===id);if(!test?.testDate&&!test?.draftFields?.testDate)return;
      const value=test.draftFields?.testDate||test.testDate;
      const host=card.querySelector('.card-title-row > div')||card;
      const chip=document.createElement('span');chip.className='test-date-chip';chip.textContent=`試験日 ${displayDate(value)}`;
      host.appendChild(chip);
    });
  }

  function addDateToReview(id){
    const test=testById(id);if(!test)return;
    const value=test.draftFields?.testDate||test.testDate;if(!value)return;
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

    // 完成保存
    handleFinalSaveClick(target);
  },true);

  // Enterで保存する場合にも対応
  document.addEventListener('keydown',e=>{
    if(e.key!=='Enter')return;
    const form=e.target?.closest?.('form');const cfg=cfgForForm(form);if(!cfg)return;
    const p=current();if(!p)return;
    const beforeIds=new Set((p.tests||[]).map(t=>t.id));
    const editId=state.editingTestId||form.dataset.testDateTargetId||'';
    const value=form.elements.testDate?.value||'';
    attachDateAfterSave(form,cfg,beforeIds,editId,value);
  },true);

  if(typeof renderTests==='function'){
    const base=renderTests;
    renderTests=function(){base();enhanceCards();};
  }

  const observer=new MutationObserver(()=>{ensureFields();enhanceCards();});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  ensureFields();
  queueMicrotask(enhanceCards);
})();
