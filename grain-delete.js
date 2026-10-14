// 粒度試験カード：個別削除
// 完成データ・途中保存データの両方を、描画後のカードへ確実に削除ボタンを付ける。
(function(){
  if(window.__soilnoteGrainDeleteV2)return;
  window.__soilnoteGrainDeleteV2=true;

  function addButtons(){
    const root=document.getElementById('testList');
    if(!root)return;
    root.querySelectorAll('[data-edit-grain]').forEach(edit=>{
      const id=edit.dataset.editGrain;
      if(!id)return;
      const card=edit.closest('article.card');
      if(!card||card.querySelector(`[data-delete-grain="${CSS.escape(id)}"]`))return;

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
    e.stopPropagation();

    const id=btn.dataset.deleteGrain;
    let p=null;
    try{p=currentProject?.()||null;}catch{}
    if(!p){alert('工事件名を開き直してから削除してください。');return;}

    const test=p.tests?.find(t=>t.id===id&&t.type==='grain');
    if(!test){
      alert('削除対象の粒度試験が見つかりません。画面を開き直してください。');
      addButtons();
      return;
    }

    const sample=String(test.sample||'試料名未入力').trim()||'試料名未入力';
    const stateText=test.draft?'途中保存の粒度試験':'粒度試験';
    if(!confirm(`「${sample}」の${stateText}を削除しますか？\nこの操作は元に戻せません。`))return;

    const before=p.tests.length;
    p.tests=p.tests.filter(t=>t.id!==id);
    if(p.tests.length===before){alert('削除できませんでした。');return;}

    p.updatedAt=new Date().toISOString();
    try{saveData();}catch(err){console.error(err);alert('保存処理でエラーが発生しました。');return;}
    try{renderTests();renderProjects();}catch(err){console.error(err);}
    setTimeout(addButtons,0);
  },true);

  const root=document.getElementById('testList');
  if(root){
    const observer=new MutationObserver(()=>addButtons());
    observer.observe(root,{childList:true,subtree:true});
  }

  document.addEventListener('click',e=>{
    if(e.target.closest?.('#backBtn,.card-button,[data-edit-grain],#addGrainBtn'))setTimeout(addButtons,0);
  });

  addButtons();
  setTimeout(addButtons,100);
})();
