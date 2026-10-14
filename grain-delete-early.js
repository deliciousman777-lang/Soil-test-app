// 粒度削除を他のカード操作より先に処理する。
// iPhoneで「確認・続き・編集ロック」等のクリック処理に遮られないよう、
// 追加スクリプト群の先頭で capture listener を登録する。
(function(){
  if(window.__soilnoteGrainDeleteEarly)return;
  window.__soilnoteGrainDeleteEarly=true;

  function markDeleted(project,id){
    if(!project||!id)return;
    const old=(project.deletedTestIds&&typeof project.deletedTestIds==='object'&&!Array.isArray(project.deletedTestIds))
      ? project.deletedTestIds : {};
    project.deletedTestIds={...old,[String(id)]:new Date().toISOString()};
  }

  function notify(text){
    let el=document.getElementById('grainDeleteEarlyToast');
    if(!el){
      el=document.createElement('div');
      el.id='grainDeleteEarlyToast';
      el.style.cssText='position:fixed;left:50%;bottom:calc(26px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:2147483647;background:#8b1f1f;color:#fff;padding:12px 18px;border-radius:999px;font-weight:900;font-size:14px;box-shadow:0 8px 28px rgba(0,0,0,.25);pointer-events:none;';
      document.body.appendChild(el);
    }
    el.textContent=text;
    el.hidden=false;
    clearTimeout(notify._timer);
    notify._timer=setTimeout(()=>{el.hidden=true;},1800);
  }

  function deleteFromButton(btn,e){
    if(!btn)return false;
    e?.preventDefault?.();
    e?.stopImmediatePropagation?.();

    const id=String(btn.dataset.deleteGrain||'');
    if(!id)return true;

    let project=null;
    try{project=currentProject?.()||null;}catch{}
    if(!project){
      window.alert('工事件名を開き直してから削除してください。');
      return true;
    }

    const tests=Array.isArray(project.tests)?project.tests:[];
    const target=tests.find(t=>String(t?.id||'')===id);
    const sample=String(target?.sample||'試料名未入力').trim()||'試料名未入力';

    if(target){
      const label=target.draft?'途中保存の粒度試験':'粒度試験';
      if(!window.confirm(`「${sample}」の${label}を削除しますか？\nこの操作は元に戻せません。`))return true;
    }

    markDeleted(project,id);
    project.tests=tests.filter(t=>String(t?.id||'')!==id);
    project.updatedAt=new Date().toISOString();

    try{
      saveData();
    }catch(err){
      console.error('[GrainDeleteEarly] save',err);
      window.alert('削除の保存に失敗しました。');
      return true;
    }

    try{renderTests?.();renderProjects?.();}catch(err){console.error('[GrainDeleteEarly] render',err);}
    notify(target?'粒度試験を削除しました':'削除済みです');
    return true;
  }

  document.addEventListener('click',e=>{
    const btn=e.target?.closest?.('[data-delete-grain]');
    if(btn)deleteFromButton(btn,e);
  },true);
})();
