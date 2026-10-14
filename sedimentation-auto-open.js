// 沈降分析：チェック済みなのに入力欄が閉じたままになる状態を防止
(function(){
  if(window.__soilnoteSedAutoOpen)return;
  window.__soilnoteSedAutoOpen=true;

  function syncVisibility(){
    const form=document.getElementById('grainForm');
    const check=form?.elements?.useSedimentation;
    const section=document.getElementById('sedimentationSection');
    if(!check||!section)return;
    if(check.checked){
      section.classList.remove('hidden');
      try{updateSedimentationVisibility?.();}catch{}
      try{updateSedimentationPreview?.();}catch{}
    }
  }

  const dialog=document.getElementById('grainDialog');
  if(dialog){
    const observer=new MutationObserver(()=>{
      if(dialog.open){
        syncVisibility();
        setTimeout(syncVisibility,0);
        setTimeout(syncVisibility,120);
      }
    });
    observer.observe(dialog,{attributes:true,attributeFilter:['open']});
  }

  document.addEventListener('click',e=>{
    if(e.target.closest?.('[data-edit-grain],#addGrainBtn,[data-sed-open]')){
      setTimeout(syncVisibility,0);
      setTimeout(syncVisibility,120);
    }
  },true);

  document.getElementById('grainForm')?.addEventListener('change',e=>{
    if(e.target?.name==='useSedimentation')syncVisibility();
  });
})();
