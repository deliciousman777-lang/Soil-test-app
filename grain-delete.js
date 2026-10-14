// 全試験カード：個別削除（確認＋同期復活防止つき）
// 削除した試験IDを tombstone として工事データ内に残し、クラウド同期で古い試験が戻っても再除去する。
(function(){
  if(window.__soilnoteTestDeleteV1)return;
  window.__soilnoteTestDeleteV1=true;

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
        saveTimer=setTimeout(()=>{try{saveData();}catch(err){console.error('[TestDelete] tombstone save',err);}},0);
      }
    }catch(err){console.error('[TestDelete] apply tombstones',err);}
    finally{applying=false;}
    return changed;
  }

  function getProject(){
    try{return currentProject?.()||null;}catch{return null;}
  }

  function idFromCard(card,project){
    if(!card||!project||!Array.isArray(project.tests))return '';
    const ids=new Set(project.tests.map(test=>String(test?.id||'')).filter(Boolean));
    const candidates=card.querySelectorAll('button,[data-view-test],[data-test-id]');
    for(const el of candidates){
      const data=el.dataset||{};
      for(const value of Object.values(data)){
        const id=String(value||'');
        if(id&&ids.has(id))return id;
      }
    }
    return '';
  }

  function actionHost(card){
    const existing=card.querySelector('.card-action-row,.grain-card-actions,.test-card-actions');
    if(existing)return existing;
    const title=card.querySelector('.card-title-row');
    if(!title)return card;
    const wrap=document.createElement('div');
    wrap.className='test-card-actions';
    title.appendChild(wrap);
    return wrap;
  }

  function addButtons(){
    applyTombstones(false);
    const root=document.getElementById('testList');
    const project=getProject();
    if(!root||!project)return;

    root.querySelectorAll('article.card').forEach(card=>{
      const id=idFromCard(card,project);
      if(!id)return;
      const test=project.tests.find(t=>String(t?.id||'')===id);
      if(!test)return;

      if(test.type==='grain'){
        if(card.querySelector('[data-delete-grain]'))return;
      }else if(card.querySelector('[data-delete-test]')){
        return;
      }

      const btn=document.createElement('button');
      btn.type='button';
      btn.className='test-delete-btn';
      if(test.type==='grain')btn.dataset.deleteGrain=id;
      else btn.dataset.deleteTest=id;
      btn.textContent='削除';
      actionHost(card).appendChild(btn);
    });
  }

  function testLabel(test,card){
    const visible=String(card?.querySelector('.test-kind')?.textContent||'').trim();
    if(visible)return visible;
    const labels={
      moisture:'含水比試験',
      grain:'粒度試験',
      particleDensity:'土粒子の密度試験',
      atterberg:'液性限界・塑性限界試験',
      coneIndex:'コーン指数試験'
    };
    return labels[test?.type]||'試験データ';
  }

  function toast(text){
    let el=document.getElementById('testDeleteToast');
    if(!el){
      el=document.createElement('div');
      el.id='testDeleteToast';
      el.style.cssText='position:fixed;left:50%;bottom:calc(26px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:10050;background:#8b1f1f;color:#fff;padding:11px 16px;border-radius:999px;font-weight:800;font-size:13px;box-shadow:0 8px 28px rgba(0,0,0,.22);opacity:0;transition:opacity .2s;pointer-events:none;';
      document.body.appendChild(el);
    }
    el.textContent=text;
    el.style.opacity='1';
    clearTimeout(toast._timer);
    toast._timer=setTimeout(()=>{el.style.opacity='0';},1700);
  }

  if(!document.getElementById('testDeleteStyle')){
    const s=document.createElement('style');
    s.id='testDeleteStyle';
    s.textContent=`
      .test-card-actions,.grain-card-actions{display:flex;gap:7px;align-items:center;justify-content:flex-end;flex-wrap:wrap}
      .test-delete-btn,.grain-delete-btn{border:1px solid #d9a9a9;background:#fff7f7;color:#9d2424;border-radius:10px;padding:8px 11px;font-weight:800}
      .test-delete-btn:active,.grain-delete-btn:active{transform:translateY(1px)}
      @media(max-width:560px){.test-card-actions,.grain-card-actions{flex-direction:column;align-items:stretch}.test-card-actions button,.grain-card-actions button{width:100%}}
    `;
    document.head.appendChild(s);
  }

  document.addEventListener('click',e=>{
    const btn=e.target.closest?.('[data-delete-test],[data-delete-grain]');
    if(!btn)return;
    e.preventDefault();
    e.stopImmediatePropagation();

    const id=String(btn.dataset.deleteTest||btn.dataset.deleteGrain||'');
    const project=getProject();
    if(!project){alert('工事件名を開き直してから削除してください。');return;}

    const card=btn.closest('article.card');
    const test=project.tests?.find(t=>String(t?.id||'')===id);
    if(!test){
      markDeleted(project,id);
      project.updatedAt=new Date().toISOString();
      try{saveData();renderTests?.();renderProjects?.();}catch(err){console.error(err);}
      toast('削除済みです');
      return;
    }

    const sample=String(test.sample||test.sampleName||'試料名未入力').trim()||'試料名未入力';
    const label=testLabel(test,card);
    const stateText=test.draft?`途中保存の${label}`:label;
    if(!confirm(`「${sample}」の${stateText}を削除しますか？\nこの操作は元に戻せません。`))return;

    markDeleted(project,id);
    project.tests=project.tests.filter(t=>String(t?.id||'')!==id);
    project.updatedAt=new Date().toISOString();
    if(typeof state==='object'&&String(state.editingTestId||'')===id)state.editingTestId=null;

    try{saveData();}catch(err){console.error(err);alert('削除の保存に失敗しました。');return;}
    applyTombstones(false);
    try{renderTests?.();renderProjects?.();}catch(err){console.error(err);}
    toast(`${label}を削除しました`);
    setTimeout(addButtons,0);
  },true);

  // 他機能・クラウド同期が一覧を再描画しても tombstone を先に適用する。
  if(typeof renderTests==='function'&&!renderTests.__testDeletePatched){
    const base=renderTests;
    const wrapped=function(){applyTombstones(true);const result=base.apply(this,arguments);queueMicrotask(addButtons);return result;};
    wrapped.__testDeletePatched=true;
    renderTests=wrapped;
  }
  if(typeof renderProjects==='function'&&!renderProjects.__testDeletePatched){
    const base=renderProjects;
    const wrapped=function(){applyTombstones(true);return base.apply(this,arguments);};
    wrapped.__testDeletePatched=true;
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

  // クラウドのポーリング直後にも復活を抑止。
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
