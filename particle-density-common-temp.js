// SoilNote: keep the three particle-density measurement temperatures identical.
(function(){
  'use strict';

  function temperatureInputs(){
    const form = document.getElementById('particleDensityForm');
    if(!form) return [];
    return [1,2,3].map(i=>form.elements[`t1_${i}`]).filter(Boolean);
  }

  function syncAll(source){
    const inputs = temperatureInputs();
    if(!source || !inputs.length) return;
    const value = source.value;
    inputs.forEach(input=>{
      if(input !== source && input.value !== value) input.value = value;
    });
  }

  function normalizeExisting(){
    const inputs = temperatureInputs();
    if(!inputs.length) return;
    const source = inputs.find(input=>String(input.value || '').trim() !== '');
    if(source) syncAll(source);
  }

  function wire(){
    const form = document.getElementById('particleDensityForm');
    if(!form) return false;
    const inputs = temperatureInputs();
    inputs.forEach(input=>{
      if(input.dataset.commonTempWired === '1') return;
      input.dataset.commonTempWired = '1';
      input.addEventListener('input',()=>syncAll(input));
      input.addEventListener('change',()=>syncAll(input));
      const label = input.closest('label');
      if(label && !label.querySelector('.pd-common-temp-note')){
        const note = document.createElement('small');
        note.className = 'pd-common-temp-note';
        note.textContent = '3測定共通';
        note.style.cssText = 'display:block;margin-top:4px;color:var(--accent-dark,#0b5136);font-weight:800;font-size:10px';
        label.appendChild(note);
      }
    });

    const hint = form.querySelector('.hint');
    if(hint && !hint.dataset.commonTempHint){
      hint.dataset.commonTempHint = '1';
      hint.textContent += ' 気温はどれか1か所に入力すると、3測定すべてへ同じ値を自動反映します。';
    }
    return true;
  }

  function boot(){
    if(!wire()){
      const observer = new MutationObserver(()=>{
        if(wire()) observer.disconnect();
      });
      observer.observe(document.body,{childList:true,subtree:true});
    }

    document.addEventListener('click',event=>{
      if(!event.target.closest?.('#addParticleDensityBtn,[data-edit-pd]')) return;
      setTimeout(normalizeExisting,0);
    },true);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot);
  else boot();
})();
