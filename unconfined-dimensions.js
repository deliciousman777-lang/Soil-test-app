// 一軸圧縮試験：改良土はφ50×H100mm固定、乱さない試料は湿潤密度試験連携に備える
(function(){
  'use strict';

  const FIXED_DIAMETER_CM=5.00;
  const FIXED_HEIGHT_CM=10.00;
  const TYPE_CANDIDATES=['wet-density','wet-density-test','wetDensity','wetDensityTest'];

  function form(){ return document.getElementById('unconfinedForm'); }
  function project(){ try{return typeof currentProject==='function'?currentProject():null;}catch{return null;} }
  function num(v){ const n=Number(v); return Number.isFinite(n)?n:null; }

  function latestWetDensity(sample){
    const p=project();
    const list=(p?.tests||[]).filter(t=>TYPE_CANDIDATES.includes(t.type)&&String(t.sample||'')===String(sample||''));
    return [...list].sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')))[0]||null;
  }

  function wetDensityDimensions(test,index){
    if(!test)return null;
    const candidates=[
      Array.isArray(test.specimens)?test.specimens[index-1]:null,
      Array.isArray(test.measurements)?test.measurements[index-1]:null,
      test,
    ].filter(Boolean);
    for(const row of candidates){
      const diameter=num(row.diameter ?? row.diameterCm ?? row.D ?? row.d);
      const height=num(row.height ?? row.heightCm ?? row.L ?? row.h);
      if(diameter!==null&&height!==null)return {diameter,height};
    }
    return null;
  }

  function helperFor(input,kind,index){
    const label=input?.closest('label');
    if(!label)return null;
    let helper=label.querySelector(`.ucs-dim-helper[data-kind="${kind}"]`);
    if(!helper){
      helper=document.createElement('small');
      helper.className='ucs-dim-helper';
      helper.dataset.kind=kind;
      helper.dataset.index=String(index);
      label.appendChild(helper);
    }
    return helper;
  }

  function setFixed(index){
    const f=form(); if(!f)return;
    const d=f.elements[`diameter${index}`],h=f.elements[`height${index}`];
    if(!d||!h)return;
    d.value=FIXED_DIAMETER_CM.toFixed(2);
    h.value=FIXED_HEIGHT_CM.toFixed(2);
    d.readOnly=true; h.readOnly=true;
    d.tabIndex=-1; h.tabIndex=-1;
    d.closest('label')?.classList.add('ucs-dim-fixed');
    h.closest('label')?.classList.add('ucs-dim-fixed');
    const dh=helperFor(d,'diameter',index),hh=helperFor(h,'height',index);
    if(dh)dh.textContent='固定 φ50 mm';
    if(hh)hh.textContent='固定 H100 mm';
  }

  function setUndisturbed(index){
    const f=form(); if(!f)return;
    const d=f.elements[`diameter${index}`],h=f.elements[`height${index}`];
    if(!d||!h)return;
    d.readOnly=false; h.readOnly=false;
    d.tabIndex=0; h.tabIndex=0;
    d.closest('label')?.classList.remove('ucs-dim-fixed');
    h.closest('label')?.classList.remove('ucs-dim-fixed');

    const sample=f.elements.sample?.value||'';
    const wet=latestWetDensity(sample);
    const dims=wetDensityDimensions(wet,index);
    const dh=helperFor(d,'diameter',index),hh=helperFor(h,'height',index);
    if(dims){
      d.value=Number(dims.diameter).toFixed(2);
      h.value=Number(dims.height).toFixed(2);
      d.readOnly=true; h.readOnly=true;
      d.tabIndex=-1; h.tabIndex=-1;
      if(dh)dh.textContent='湿潤密度試験から自動入力';
      if(hh)hh.textContent='湿潤密度試験から自動入力';
    }else{
      if(dh)dh.textContent='湿潤密度試験から自動入力予定（現在は手入力可）';
      if(hh)hh.textContent='湿潤密度試験から自動入力予定（現在は手入力可）';
    }
  }

  function syncOne(index){
    const f=form(); if(!f)return;
    const state=f.elements[`state${index}`]?.value;
    if(state==='改良土')setFixed(index);
    else if(state==='乱さない試料')setUndisturbed(index);
  }

  function syncAll(){
    if(!form())return;
    [1,2,3].forEach(syncOne);
  }

  function addStyles(){
    if(document.getElementById('unconfinedDimensionStyles'))return;
    const s=document.createElement('style');
    s.id='unconfinedDimensionStyles';
    s.textContent=`
      .ucs-dim-helper{display:block;margin-top:3px;font-size:10px;line-height:1.25;color:var(--muted,#68766e)}
      .ucs-dim-fixed input{background:#f2f5f3!important;color:#476058!important;border-style:dashed!important}
    `;
    document.head.appendChild(s);
  }

  function setup(){
    addStyles();
    document.addEventListener('change',e=>{
      const name=e.target?.name||'';
      const m=name.match(/^state([123])$/);
      if(m)syncOne(Number(m[1]));
      if(name==='sample')setTimeout(syncAll,0);
    },true);

    const observer=new MutationObserver(()=>{
      const d=document.getElementById('unconfinedDialog');
      if(d?.open)setTimeout(syncAll,0);
    });
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open']});

    document.addEventListener('click',e=>{
      if(e.target.closest?.('#addUnconfinedBtn,[data-edit-test]'))setTimeout(syncAll,30);
    },true);

    setTimeout(syncAll,0);
  }

  window.refreshUnconfinedDimensions=syncAll;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);
  else setup();
})();
