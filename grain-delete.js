// 粒度試験カード：個別削除（同期復活防止つき）
// 削除した試験IDを tombstone として工事データ内に残し、クラウド同期で古い試験が戻っても再除去する。
(function(){
  if(window.__soilnoteGrainDeleteV3)return;
  window.__soilnoteGrainDeleteV3=true;

  const TOMBSTONE_KEY='deletedTestIds';
  let applying=false;
  let saveTimer=null;

  function tombstones(project){
    const raw=project?.[TOMBSTONE_KEY];
    return raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
  }

  function markDeleted(project,id){
    if(!project||!id)return;
    const map={...tombstones(project)};
    map[String(id)]=new Date().toISOString();
    project[TOMBSTONE_KEY]=map;
  }

  function applyTombstones(saveIfChanged=false){
    if(applying)return false;
    applying=true;
    let changed=false;
    try{
      const projects=Array.isArray(state?.data?.projects)?state.data.projects:[];
      projects.forEach(project=>{
        const map=tombstones(project);
        const ids=new Set(Object.keys(map));
        if(!ids.size||!Array.isArray(project.tests))return;
        const before=project.tests.length;
        project.tests=project.tests.filter(test=>!ids.has(String(test?.id||'')));
        if(project.tests.length!==before){
          changed=true;
          const newest=Math.max(0,...Object.values(map).map(v=>new Date(v||0).getTime()).filter(Number.isFinite));
          if(newest){
            const current=new Date(project.updatedAt||project.createdAt||0).getTime();
            if(!Number.isFinite(current)||current<newest)project.updatedAt=new Date(newest).toISOString();
          }
        }
      });
      if(changed&&saveIfChanged&&typeof saveData==='function'){
        clearTimeout(saveTimer);
        saveTimer=setTimeout(()=>{try{saveData();}catch(err){console.error('[GrainDelete] tombstone save',err);}},0);
      }
    }catch(err){console.error('[GrainDelete] apply tombstones',err);}
    finally{applying=false;}
    return changed;
  }

  function addButtons(){
    applyTombstones(false);
    const root=document.getElementById('testList');
    if(!root)return;
    root.querySelectorAll('[data-edit-grain]').forEach(edit=>{
      const id=edit.dataset.editGrain;
      if(!id)return;
      const card=edit.closest('article.card');
      if(!card)return;
      if(card.querySelector('[data-delete-grain]'))return;

      const btn=document.createElement('button');
      btn.type='button';
      btn.className='grain-delete-btn';
      btn.dataset.deleteGrain=id;
      btn.textContent='削除';

      const actions=edit.closest('.card-action-row,.grain-card-actions');
      if(actions){
        actions.appendChild(btn);
      }else{
        const wrap=document.createElement('div');
        wrap.className='grain-card-actions';
        edit.parentNode?.insertBefore(wrap,edit);
        wrap.appendChild(edit);
        wrap.appendChild(btn);
      }
    });
  }

  function toast(text){
    let el=document.getElementById('grainDeleteToast');
    if(!el){
      el=document.createElement('div');
      el.id='grainDeleteToast';
      el.style.cssText='position:fixed;left:50%;bottom:calc(26px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:10050;background:#8b1f1f;color:#fff;padding:11px 16px;border-radius:999px;font-weight:800;font-size:13px;box-shadow:0 8px 28px rgba(0,0,0,.22);opacity:0;transition:opacity .2s;pointer-events:none;';
      document.body.appendChild(el);
    }
    el.textContent=text;el.style.opacity='1';
    clearTimeout(toast._timer);toast._timer=setTimeout(()=>{el.style.opacity='0';},1700);
  }

  if(!document.getElementById('grainDeleteStyle')){
    const s=document.createElement('style');
    s.id='grainDeleteStyle';
    s.textContent=`
      .grain-card-actions{display:flex;gap:7px;align-items:center;justify-content:flex-end;flex-wrap:wrap}
      .grain-delete-btn{border:1px solid #d9a9a9;background:#fff7f7;color:#9d2424;border-radius:10px;padding:8px 11px;font-weight:800}
      .grain-delete-btn:active{transform:translateY(1px)}
      @media(max-width:560px){.grain-card-actions{flex-direction:column;align-items:stretch}.grain-card-actions button{width:100%}}
    `;
    document.head.appendChild(s);
  }

  document.addEventListener('click',e=>{
    const btn=e.target.closest?.('[data-delete-grain]');
    if(!btn)return;
    e.preventDefault();
    e.stopImmediatePropagation();

    const id=String(btn.dataset.deleteGrain||'');
    let p=null;
    try{p=currentProject?.()||null;}catch{}
    if(!p){alert('工事件名を開き直してから削除してください。');return;}

    const test=p.tests?.find(t=>String(t?.id||'')===id&&t.type==='grain');
    if(!test){
      // すでに消えている場合も tombstone を残して復活防止する。
      markDeleted(p,id);
      p.updatedAt=new Date().toISOString();
      try{saveData();renderTests?.();renderProjects?.();}catch(err){console.error(err);}
      toast('削除済みです');
      return;
    }

    const sample=String(test.sample||'試料名未入力').trim()||'試料名未入力';
    const stateText=test.draft?'途中保存の粒度試験':'粒度試験';
    if(!confirm(`「${sample}」の${stateText}を削除しますか？\nこの操作は元に戻せません。`))return;

    markDeleted(p,id);
    p.tests=p.tests.filter(t=>String(t?.id||'')!==id);
    p.updatedAt=new Date().toISOString();

    try{saveData();}catch(err){console.error(err);alert('保存処理でエラーが発生しました。');return;}
    applyTombstones(false);
    try{renderTests?.();renderProjects?.();}catch(err){console.error(err);}
    toast('粒度試験を削除しました');
    setTimeout(addButtons,0);
  },true);

  // 他機能・クラウド同期が一覧を再描画しても tombstone を先に適用する。
  if(typeof renderTests==='function'&&!renderTests.__grainDeletePatched){
    const base=renderTests;
    const wrapped=function(){applyTombstones(true);const result=base.apply(this,arguments);queueMicrotask(addButtons);return result;};
    wrapped.__grainDeletePatched=true;
    renderTests=wrapped;
  }
  if(typeof renderProjects==='function'&&!renderProjects.__grainDeletePatched){
    const base=renderProjects;
    const wrapped=function(){applyTombstones(true);return base.apply(this,arguments);};
    wrapped.__grainDeletePatched=true;
    renderProjects=wrapped;
  }

  const root=document.getElementById('testList');
  if(root){
    const observer=new MutationObserver(()=>addButtons());
    observer.observe(root,{childList:true,subtree:true});
  }

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'){
      if(applyTombstones(true)){try{renderTests?.();renderProjects?.();}catch{}}
      setTimeout(addButtons,0);
    }
  });
  window.addEventListener('focus',()=>{
    if(applyTombstones(true)){try{renderTests?.();renderProjects?.();}catch{}}
    setTimeout(addButtons,0);
  });

  // クラウドの10秒ポーリング直後にも復活を抑止。
  setInterval(()=>{
    if(document.visibilityState!=='visible')return;
    const changed=applyTombstones(true);
    if(changed){try{renderTests?.();renderProjects?.();}catch{}}
    addButtons();
  },2500);

  applyTombstones(true);
  addButtons();
  setTimeout(addButtons,100);
})();
