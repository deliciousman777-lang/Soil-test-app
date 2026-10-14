// 粒度試験カード：個別削除
// 完成データ・途中保存データの両方をカードから削除できるようにする。
(function(){
  if(window.__soilnoteGrainDelete)return;
  window.__soilnoteGrainDelete=true;

  const esc=v=>typeof escapeHtml==='function'?escapeHtml(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  function injectDeleteButton(html,test){
    if(!test||test.type!=='grain'||String(html).includes('data-delete-grain='))return html;
    const id=esc(test.id);
    const button=`<button type="button" class="grain-delete-btn" data-delete-grain="${id}">削除</button>`;
    const re=/(<button type="button" class="edit-btn" data-edit-grain="[^"]+">[\s\S]*?<\/button>)/;
    if(re.test(html)){
      return html.replace(re,`<div class="grain-card-actions">$1${button}</div>`);
    }
    return html+button;
  }

  if(typeof renderGrainCard==='function'){
    const base=renderGrainCard;
    renderGrainCard=function(test){return injectDeleteButton(base(test),test);};
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
    const id=btn.dataset.deleteGrain;
    let p=null;
    try{p=currentProject?.()||null;}catch{}
    if(!p)return;
    const test=p.tests?.find(t=>t.id===id&&t.type==='grain');
    if(!test)return;
    const sample=String(test.sample||'試料名未入力').trim()||'試料名未入力';
    const stateText=test.draft?'途中保存の粒度試験':'粒度試験';
    if(!confirm(`「${sample}」の${stateText}を削除しますか？\nこの操作は元に戻せません。`))return;
    p.tests=p.tests.filter(t=>t.id!==id);
    p.updatedAt=new Date().toISOString();
    try{saveData?.();}catch{}
    try{renderTests?.();renderProjects?.();}catch{}
  },true);
})();
