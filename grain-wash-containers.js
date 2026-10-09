// 粒度試験：2 mm残留分・2 mm通過分の水洗い容器No.を記録する
(function(){
  const RETAINED='washContainer2mmRetained';
  const PASSING='washContainer2mmPassing';
  let pendingSubmit=null;

  const esc=v=>typeof escapeHtml==='function'?escapeHtml(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  function project(){
    try{return currentProject?.()||null;}catch{return null;}
  }

  function grainById(id){
    return project()?.tests?.find(t=>t.id===id&&t.type==='grain')||null;
  }

  function injectFields(){
    const form=document.getElementById('grainForm');
    if(!form||form.elements[RETAINED])return;
    const head=form.querySelector('.subsection-head');
    if(!head)return;

    const box=document.createElement('section');
    box.className='grain-wash-box';
    box.innerHTML=`
      <div class="grain-wash-title">
        <div><strong>水洗い容器No.</strong><span>試料の取り違え防止用。複数容器は「501, 502」のように入力できます。</span></div>
      </div>
      <div class="grain-wash-grid">
        <label>2 mm残留分（2 mm以上）
          <input name="${RETAINED}" autocomplete="off" placeholder="例：501 / 501, 502" />
        </label>
        <label>2 mm通過分（沈降・細粒側）
          <input name="${PASSING}" autocomplete="off" placeholder="例：13 / 13, 14" />
        </label>
      </div>`;
    head.insertAdjacentElement('beforebegin',box);

    if(!document.getElementById('grainWashStyles')){
      const s=document.createElement('style');
      s.id='grainWashStyles';
      s.textContent=`
        .grain-wash-box{margin:14px 0 6px;padding:14px;border:1px solid var(--line,#dfe7e4);border-radius:16px;background:#f8fbfa}
        .grain-wash-title{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:10px}.grain-wash-title strong{display:block;font-size:14px;color:#24332f}.grain-wash-title span{display:block;margin-top:3px;font-size:11px;color:var(--muted,#6b7774);line-height:1.45}
        .grain-wash-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.grain-wash-grid label{margin:0}.grain-wash-grid input{margin-top:6px}
        .grain-wash-card-meta{margin-top:8px;padding:8px 10px;border-radius:10px;background:#f3f8f6;color:#53605d;font-size:12px;line-height:1.5}
        @media(max-width:560px){.grain-wash-grid{grid-template-columns:1fr}}
      `;
      document.head.appendChild(s);
    }
  }

  function valuesFromForm(form){
    return {
      retained:String(form?.elements?.[RETAINED]?.value??'').trim(),
      passing:String(form?.elements?.[PASSING]?.value??'').trim()
    };
  }

  function applyToTest(test,values){
    if(!test)return;
    test.washContainers={
      retained2mm:values.retained,
      passing2mm:values.passing
    };
    // 後方互換・検索しやすさのためトップレベルにも保持
    test[RETAINED]=values.retained;
    test[PASSING]=values.passing;
  }

  function readFromTest(test){
    return {
      retained:String(test?.washContainers?.retained2mm??test?.[RETAINED]??''),
      passing:String(test?.washContainers?.passing2mm??test?.[PASSING]??'')
    };
  }

  // 完成保存時：既存保存処理を邪魔せず、成功後に容器No.を追記する。
  document.addEventListener('submit',e=>{
    if(e.target?.id!=='grainForm')return;
    const p=project();if(!p)return;
    const form=e.target;
    pendingSubmit={
      values:valuesFromForm(form),
      editId:state?.editingTestId||'',
      sample:String(form.elements.sample?.value??'').trim(),
      beforeIds:new Set((p.tests||[]).map(t=>t.id))
    };

    setTimeout(()=>{
      const pending=pendingSubmit;pendingSubmit=null;if(!pending)return;
      const dialog=document.getElementById('grainDialog');
      // 入力不備で保存できなかった場合はダイアログが開いたままなので何もしない。
      if(dialog?.open)return;
      const pp=project();if(!pp)return;
      let test=pending.editId?pp.tests.find(t=>t.id===pending.editId&&t.type==='grain'):null;
      if(!test){
        const added=(pp.tests||[]).filter(t=>t.type==='grain'&&!pending.beforeIds.has(t.id));
        test=added.sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))[0]||null;
      }
      if(!test&&pending.sample){
        test=[...(pp.tests||[])].filter(t=>t.type==='grain'&&!t.draft&&String(t.sample||'')===pending.sample)
          .sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')))[0]||null;
      }
      if(!test)return;
      applyToTest(test,pending.values);
      saveData();
      renderTests();
    },0);
  },true);

  // 訂正画面で保存済みの容器No.を復元する。
  if(typeof openEditGrain==='function'){
    const baseOpenEditGrain=openEditGrain;
    openEditGrain=function(testId){
      baseOpenEditGrain(testId);
      injectFields();
      const form=document.getElementById('grainForm');
      const t=grainById(testId);if(!form||!t)return;
      // 途中保存は draft-save.js が直後に draftFields を復元するので、ここでは完成データだけ設定。
      if(t.draft)return;
      const v=readFromTest(t);
      if(form.elements[RETAINED])form.elements[RETAINED].value=v.retained;
      if(form.elements[PASSING])form.elements[PASSING].value=v.passing;
    };
  }

  // カード上でも容器No.を軽く確認できるようにする。
  if(typeof renderGrainCard==='function'){
    const baseRenderGrainCard=renderGrainCard;
    renderGrainCard=function(test){
      const html=baseRenderGrainCard(test);
      if(test?.draft)return html;
      const v=readFromTest(test);
      if(!v.retained&&!v.passing)return html;
      const text=`<div class="grain-wash-card-meta">水洗い容器 ｜ 2 mm残留分：${esc(v.retained||'—')} ｜ 2 mm通過分：${esc(v.passing||'—')}</div>`;
      return html+text;
    };
  }

  function appendReview(test){
    if(!test||test.type!=='grain'||test.draft)return;
    const body=document.getElementById('testReviewBody');if(!body)return;
    if(body.querySelector('[data-grain-wash-review]'))return;
    const v=readFromTest(test);
    if(!v.retained&&!v.passing)return;
    const box=document.createElement('section');
    box.className='review-section';
    box.dataset.grainWashReview='1';
    box.innerHTML=`<h3>水洗い容器No.</h3><div class="table-wrap"><table class="review-table"><tbody><tr><th>2 mm残留分（2 mm以上）</th><td style="text-align:left">${esc(v.retained||'—')}</td></tr><tr><th>2 mm通過分（沈降・細粒側）</th><td style="text-align:left">${esc(v.passing||'—')}</td></tr></tbody></table></div></section>`;
    const note=body.querySelector('.review-note');
    if(note)note.insertAdjacentElement('beforebegin',box);else body.prepend(box);
  }

  // 「確認」を開いた後に容器No.欄を追加。
  document.addEventListener('click',e=>{
    const b=e.target.closest?.('[data-view-test],[data-view-any-test]');if(!b)return;
    const id=b.dataset.viewTest||b.dataset.viewAnyTest;
    const t=grainById(id);if(!t)return;
    setTimeout(()=>appendReview(t),0);
  });

  // データシート1枚目の粒度欄にも、水洗い容器No.を表示する。
  function patchReport(){
    const page=document.getElementById('reportPage1');
    const sel=document.getElementById('reportSampleSelect');
    const p=project();if(!page||!sel||!p)return;
    const sample=String(sel.value||'');
    const t=[...(p.tests||[])].filter(x=>x.type==='grain'&&!x.draft&&String(x.sample||'')===sample)
      .sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')))[0]||null;
    if(!t)return;
    const v=readFromTest(t);
    if(!v.retained&&!v.passing)return;
    const section=[...page.querySelectorAll('.r-section')].find(s=>s.querySelector('.r-section-title')?.textContent.trim()==='粒度試験');
    const table=section?.querySelector('.r-table');if(!table||table.querySelector('[data-grain-wash-report]'))return;
    const tr=document.createElement('tr');tr.dataset.grainWashReport='1';
    tr.innerHTML=`<th class="r-left">2 mm残留分 水洗い容器No.</th><td>${esc(v.retained||'')}</td><th class="r-left">2 mm通過分 水洗い容器No.</th><td>${esc(v.passing||'')}</td>`;
    table.appendChild(tr);
  }

  const reportRoot=document.getElementById('reportPages');
  if(reportRoot){
    new MutationObserver(()=>requestAnimationFrame(patchReport)).observe(reportRoot,{childList:true,subtree:true});
  }else{
    const mo=new MutationObserver(()=>{
      const root=document.getElementById('reportPages');if(!root)return;
      mo.disconnect();
      new MutationObserver(()=>requestAnimationFrame(patchReport)).observe(root,{childList:true,subtree:true});
    });
    mo.observe(document.documentElement,{childList:true,subtree:true});
  }
  document.addEventListener('change',e=>{if(e.target?.id==='reportSampleSelect')setTimeout(patchReport,0);});

  injectFields();
})();