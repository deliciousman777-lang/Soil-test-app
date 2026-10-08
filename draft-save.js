// 全試験共通：入力途中の保存・再開
// 完成保存のバリデーションは既存のまま維持し、途中保存だけ入力値をそのまま保持する。
(function(){
  const CONFIGS={
    moistureForm:{type:'moisture',dialog:'moistureDialog',name:'含水比試験',editAttr:'data-edit-moisture'},
    grainForm:{type:'grain',dialog:'grainDialog',name:'粒度試験',editAttr:'data-edit-grain'},
    particleDensityForm:{type:'particleDensity',dialog:'particleDensityDialog',name:'土粒子の密度試験',editAttr:'data-edit-pd'},
    atterbergForm:{type:'atterberg',dialog:'atterbergDialog',name:'液性限界・塑性限界試験',editAttr:'data-edit-atterberg'},
    coneIndexForm:{type:'cone-index',dialog:'coneIndexDialog',name:'締固めた土のコーン指数試験',editAttr:'data-edit-cone-index'}
  };

  const esc=v=>typeof escapeHtml==='function'?escapeHtml(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  function project(){
    try{return currentProject?.()||null;}catch{return null;}
  }

  function testById(id){
    return project()?.tests?.find(t=>t.id===id)||null;
  }

  function configForType(type){
    return Object.values(CONFIGS).find(c=>c.type===type)||null;
  }

  function cleanLabel(text){
    return String(text||'').replace(/🎤/g,'').replace(/\s+/g,' ').trim().slice(0,90);
  }

  function labelFor(el){
    if(el.getAttribute('aria-label'))return cleanLabel(el.getAttribute('aria-label'));
    const label=el.closest('label');
    if(label){
      const clone=label.cloneNode(true);
      clone.querySelectorAll('input,select,textarea,button').forEach(x=>x.remove());
      const text=cleanLabel(clone.textContent);
      if(text)return text;
    }
    const cell=el.closest('td');
    if(cell){
      const row=cell.parentElement;
      const table=el.closest('table');
      const index=[...row.children].indexOf(cell);
      const head=table?.querySelector(`thead tr:last-child > *:nth-child(${index+1})`);
      const rowHead=row?.querySelector('th');
      const parts=[cleanLabel(rowHead?.textContent),cleanLabel(head?.textContent)].filter(Boolean);
      if(parts.length)return parts.join(' / ');
    }
    return el.name||'入力値';
  }

  function serializeForm(form){
    const fields={};
    const labels={};
    [...form.elements].forEach(el=>{
      if(!el.name||['submit','button','reset'].includes(el.type))return;
      if(el.type==='radio'){
        if(el.checked)fields[el.name]=el.value;
        labels[el.name]=labelFor(el);
        return;
      }
      fields[el.name]=el.type==='checkbox'?Boolean(el.checked):el.value;
      labels[el.name]=labelFor(el);
    });
    return {fields,labels};
  }

  function meaningfulCount(fields){
    return Object.entries(fields||{}).filter(([k,v])=>{
      if(typeof v==='boolean')return v;
      if(v===null||v===undefined)return false;
      return String(v).trim()!=='';
    }).length;
  }

  function toast(message){
    let el=document.getElementById('draftSaveToast');
    if(!el){
      el=document.createElement('div');
      el.id='draftSaveToast';
      el.style.cssText='position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:9999;background:#173f35;color:#fff;padding:11px 16px;border-radius:999px;font-weight:800;font-size:13px;box-shadow:0 8px 28px rgba(0,0,0,.22);opacity:0;transition:opacity .2s;pointer-events:none;';
      document.body.appendChild(el);
    }
    el.textContent=message;el.style.opacity='1';
    clearTimeout(toast._timer);toast._timer=setTimeout(()=>{el.style.opacity='0';},1600);
  }

  function saveDraft(form,cfg){
    const p=project();if(!p)return;
    const {fields,labels}=serializeForm(form);
    const now=new Date().toISOString();
    const sample=String(fields.sample??'').trim();
    let test=state.editingTestId?testById(state.editingTestId):null;
    if(test&&test.type!==cfg.type)test=null;

    if(test){
      Object.assign(test,{
        sample,
        draft:true,
        draftFields:fields,
        draftFieldLabels:labels,
        draftSavedAt:now,
        updatedAt:now
      });
    }else{
      test={
        id:uid(),type:cfg.type,sample,
        draft:true,draftFields:fields,draftFieldLabels:labels,
        draftSavedAt:now,createdAt:now,updatedAt:now
      };
      p.tests.push(test);
    }
    p.updatedAt=now;
    saveData();
    form.dataset.keepDraftOnClose='1';
    document.getElementById(cfg.dialog)?.close();
    state.editingTestId=null;
    renderTests();
    toast('途中保存しました');
  }

  function restoreDraft(test,cfg){
    const form=document.getElementById(Object.keys(CONFIGS).find(id=>CONFIGS[id]===cfg));
    if(!form||!test?.draftFields)return;
    Object.entries(test.draftFields).forEach(([name,value])=>{
      const controls=form.elements[name];if(!controls)return;
      const list=(typeof controls.length==='number'&&!controls.tagName)?[...controls]:[controls];
      list.forEach(el=>{
        if(el.type==='checkbox')el.checked=Boolean(value);
        else if(el.type==='radio')el.checked=String(el.value)===String(value);
        else el.value=value??'';
      });
    });
    form.dataset.draftTestId=test.id;
    form.dispatchEvent(new Event('input',{bubbles:true}));
    form.dispatchEvent(new Event('change',{bubbles:true}));
  }

  function ensureDraftButtons(){
    Object.entries(CONFIGS).forEach(([formId,cfg])=>{
      const form=document.getElementById(formId);if(!form||form.dataset.draftEnabled==='1')return;
      form.dataset.draftEnabled='1';
      const actions=form.querySelector('.dialog-actions');if(!actions)return;
      const btn=document.createElement('button');
      btn.type='button';btn.className='ghost draft-save-btn';btn.textContent='途中保存';
      btn.style.cssText='border-color:#8aa99f;color:#155343;background:#f3f8f6;';
      btn.addEventListener('click',()=>saveDraft(form,cfg));
      const cancel=actions.querySelector('.ghost');
      if(cancel)actions.insertBefore(btn,cancel);else actions.insertBefore(btn,actions.firstChild);

      const dialog=document.getElementById(cfg.dialog);
      dialog?.addEventListener('close',()=>{
        const id=form.dataset.draftTestId;
        if(form.dataset.keepDraftOnClose==='1'){
          form.dataset.keepDraftOnClose='';form.dataset.finalSubmitPending='';return;
        }
        if(form.dataset.finalSubmitPending==='1'&&id){
          const t=testById(id);
          if(t?.draft){
            delete t.draft;delete t.draftFields;delete t.draftFieldLabels;delete t.draftSavedAt;
            saveData();
            renderTests();
          }
        }
        form.dataset.finalSubmitPending='';
        form.dataset.draftTestId='';
      });

      const submit=actions.querySelector('button:not([type="button"]),button[type="submit"]');
      submit?.addEventListener('click',()=>{
        if(!form.dataset.draftTestId)return;
        form.dataset.finalSubmitPending='1';
        setTimeout(()=>{if(document.getElementById(cfg.dialog)?.open)form.dataset.finalSubmitPending='';},0);
      },true);
    });
  }

  function draftCard(test){
    const cfg=configForType(test.type);
    const id=esc(test.id);
    const sample=esc(test.sample||'試料名未入力');
    const count=meaningfulCount(test.draftFields);
    const saved=test.draftSavedAt||test.updatedAt||test.createdAt;
    const when=saved?new Date(saved).toLocaleString('ja-JP'):'';
    return `<div class="card-title-row"><div><p class="test-kind">${esc(cfg?.name||'試験データ')}</p><h3>${sample}</h3><p>${esc(when)} ｜ <strong style="color:#9a6700">途中保存</strong></p></div><button type="button" class="edit-btn" ${cfg?.editAttr||'data-edit-draft'}="${id}">続き</button></div><div class="value" style="font-size:22px;color:#9a6700">入力途中 <small>${count}項目保存</small></div><div class="meta"><span>あとで続きから入力できます</span></div>`;
  }

  if(typeof renderMoistureCard==='function'){
    const base=renderMoistureCard;
    renderMoistureCard=function(test){if(test?.draft)return draftCard(test);return base(test);};
  }
  if(typeof renderGrainCard==='function'){
    const base=renderGrainCard;
    renderGrainCard=function(test){if(test?.draft)return draftCard(test);return base(test);};
  }

  function openDraftReview(test){
    const dialog=document.getElementById('testReviewDialog');
    const title=document.getElementById('testReviewTitle');
    const body=document.getElementById('testReviewBody');
    if(!dialog||!title||!body)return;
    const cfg=configForType(test.type);
    title.textContent=`${cfg?.name||'試験データ'}・途中保存確認`;
    const entries=Object.entries(test.draftFields||{}).filter(([k,v])=>{
      if(k==='sample')return false;
      if(typeof v==='boolean')return v;
      return v!==null&&v!==undefined&&String(v).trim()!=='';
    });
    const rows=entries.map(([k,v])=>`<tr><th style="text-align:left">${esc(test.draftFieldLabels?.[k]||k)}</th><td style="text-align:left">${typeof v==='boolean'?(v?'ON':'OFF'):esc(v)}</td></tr>`).join('');
    body.innerHTML=`<p class="review-meta">試料：${esc(test.sample||'未入力')} ｜ 状態：途中保存 ｜ 保存日時：${esc(new Date(test.draftSavedAt||test.updatedAt||test.createdAt).toLocaleString('ja-JP'))}</p><div class="review-summary"><div><span>状態</span><strong style="color:#9a6700">途中保存</strong></div><div><span>入力済み</span><strong>${meaningfulCount(test.draftFields)}</strong><small>項目</small></div><div><span>操作</span><strong>続き</strong><small>から再開可能</small></div></div><section class="review-section"><h3>現在の入力値</h3><div class="table-wrap"><table class="review-table"><tbody>${rows||'<tr><td>まだ入力値がありません</td></tr>'}</tbody></table></div></section><div class="review-note">途中保存データです。「続き」から入力を再開し、必要な項目がそろったら通常の「保存」で完成データにします。</div>`;
    dialog.showModal();
  }

  document.addEventListener('click',e=>{
    const review=e.target.closest?.('[data-view-any-test],[data-view-test]');
    if(review){
      const id=review.dataset.viewAnyTest||review.dataset.viewTest;
      const t=testById(id);
      if(t?.draft){
        e.preventDefault();e.stopImmediatePropagation();openDraftReview(t);return;
      }
    }

    const edit=e.target.closest?.('.edit-btn');
    if(!edit)return;
    const attr=[...edit.attributes].find(a=>a.name.startsWith('data-edit-'));
    const id=attr?.value;if(!id)return;
    const t=testById(id);if(!t?.draft)return;
    const cfg=configForType(t.type);if(!cfg)return;
    setTimeout(()=>restoreDraft(t,cfg),0);
  },true);

  // Enterキーで完成保存した場合も、ドラフト完了判定に使う。
  document.addEventListener('keydown',e=>{
    if(e.key!=='Enter')return;
    const form=e.target?.closest?.('form');
    if(!form?.dataset?.draftTestId)return;
    if(CONFIGS[form.id])form.dataset.finalSubmitPending='1';
  },true);

  const observer=new MutationObserver(ensureDraftButtons);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  ensureDraftButtons();
})();
