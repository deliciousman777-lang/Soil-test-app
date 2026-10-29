// 一軸圧縮試験：供試体状態を必ず「改良土 / 乱さない試料」の選択式にする
(function(){
  'use strict';

  const VALUES=['改良土','乱さない試料'];

  function ensureOne(index){
    const form=document.getElementById('unconfinedForm');
    if(!form)return false;
    const name=`state${index}`;
    const field=form.elements?.[name];
    if(!field)return false;

    if(field.tagName==='SELECT'){
      if(!VALUES.includes(field.value))field.value='改良土';
      return true;
    }

    const saved=String(field.value||'').trim();
    const select=document.createElement('select');
    select.name=name;
    select.setAttribute('aria-label',`供試体${index}の状態`);
    VALUES.forEach(value=>select.add(new Option(value,value)));
    select.value=VALUES.includes(saved)?saved:'改良土';
    field.replaceWith(select);
    return true;
  }

  function apply(){
    const form=document.getElementById('unconfinedForm');
    if(!form)return false;
    [1,2,3].forEach(ensureOne);
    return true;
  }

  function applyRepeatedly(){
    apply();
    requestAnimationFrame(apply);
    setTimeout(apply,0);
    setTimeout(apply,50);
    setTimeout(apply,150);
  }

  function setup(){
    applyRepeatedly();

    // 画面の再生成・再描画があっても常に選択式へ戻す
    const observer=new MutationObserver(()=>apply());
    observer.observe(document.body,{childList:true,subtree:true});

    // 新規・訂正でダイアログを開くたび確実に適用
    document.addEventListener('click',event=>{
      if(event.target.closest?.('#addUnconfinedBtn,[data-edit-unconfined]'))applyRepeatedly();
    },true);

    // 保存済み旧データ「良好」等を読み込んでも選択肢外なら改良土へ戻す
    document.addEventListener('input',event=>{
      if(event.target.closest?.('#unconfinedForm'))apply();
    },true);
    document.addEventListener('change',event=>{
      if(event.target.closest?.('#unconfinedForm'))apply();
    },true);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});
  else setup();
})();
