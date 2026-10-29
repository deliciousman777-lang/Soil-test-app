// 一軸圧縮試験：供試体状態を「改良土 / 乱さない試料」の選択式にする
(function(){
  'use strict';

  const OPTIONS=[
    {value:'改良土',label:'改良土'},
    {value:'乱さない試料',label:'乱さない試料'},
  ];

  function replaceStateField(index){
    const form=document.getElementById('unconfinedForm');
    const old=form?.elements?.[`state${index}`];
    if(!old||old.tagName==='SELECT')return;

    const select=document.createElement('select');
    select.name=`state${index}`;
    select.setAttribute('aria-label',`供試体${index}の状態`);
    OPTIONS.forEach(item=>select.add(new Option(item.label,item.value)));

    const saved=String(old.value||'').trim();
    if(saved&&OPTIONS.some(item=>item.value===saved))select.value=saved;
    else select.value='改良土';

    old.replaceWith(select);
  }

  function apply(){
    if(!document.getElementById('unconfinedForm'))return false;
    [1,2,3].forEach(replaceStateField);
    return true;
  }

  function setup(){
    if(apply())return;
    const observer=new MutationObserver(()=>{
      if(apply())observer.disconnect();
    });
    observer.observe(document.body,{childList:true,subtree:true});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);
  else setup();
})();
