// 液性・塑性限界試験 NP（Non-Plastic）対応
(function(){
  const TYPE='atterberg';
  const clean=v=>String(v??'').trim();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  function form(){return document.getElementById('atterbergForm');}
  function dialog(){return document.getElementById('atterbergDialog');}
  function checkbox(){return form()?.elements?.nonPlastic||null;}

  function inject(){
    const f=form();
    if(!f||f.elements.nonPlastic)return;
    const sample=f.elements.sample;
    const label=sample?.closest('label');
    if(label){
      const box=document.createElement('div');
      box.className='att-np-box';
      box.innerHTML=`<label class="att-np-label"><input type="checkbox" name="nonPlastic" id="atterbergNP"><span><strong>NP（非塑性）</strong><small>液性限界・塑性限界試験ができない場合</small></span></label>`;
      label.insertAdjacentElement('afterend',box);
    }
    if(!document.getElementById('atterbergNpStyles')){
      const s=document.createElement('style');s.id='atterbergNpStyles';s.textContent=`
        .att-np-box{margin:10px 0 2px}.att-np-label{display:flex!important;align-items:center;gap:10px;padding:12px 14px;border:1px solid var(--line,#dfe7e3);border-radius:14px;background:#f8faf9;cursor:pointer}.att-np-label input{width:22px;height:22px;accent-color:#0b5136}.att-np-label span{display:flex;flex-direction:column;gap:2px}.att-np-label strong{font-size:15px;color:#1f2a24}.att-np-label small{font-size:11px;color:var(--muted,#68766e)}.att-np-box:has(input:checked) .att-np-label{background:#e7f2ed;border-color:#8bb9a2}.att-np-disabled{opacity:.38;pointer-events:none}.att-np-result{font-weight:800;color:#0b5136}
      `;document.head.appendChild(s);
    }
    f.elements.nonPlastic.addEventListener('change',applyNpState);
    dialog()?.addEventListener('close',()=>{
      const cb=checkbox();if(cb){cb.checked=false;applyNpState();}
    });
  }

  function applyNpState(){
    const f=form(),cb=checkbox();if(!f||!cb)return;
    const np=cb.checked;
    f.querySelectorAll('.att-grid input').forEach(el=>el.disabled=np);
    f.querySelector('.att-grid')?.classList.toggle('att-np-disabled',np);
    f.querySelector('.att-chart-card')?.classList.toggle('hidden',np);
    if(np){
      ['attWL','attWP','attIP','attIF'].forEach(id=>{const el=document.getElementById(id);if(el){el.textContent='NP';el.classList.add('att-np-result');}});
      const check=document.getElementById('atterbergCheck');if(check){check.classList.remove('error');check.textContent='NP（非塑性）として保存します。液性限界・塑性限界の測定値入力は不要です。';}
    }else{
      ['attWL','attWP','attIP','attIF'].forEach(id=>document.getElementById(id)?.classList.remove('att-np-result'));
      // 元のプレビュー処理を再実行
      f.dispatchEvent(new Event('input',{bubbles:true}));
    }
  }

  function saveNp(e){
    if(e.target?.id!=='atterbergForm')return;
    const f=e.target,cb=f.elements.nonPlastic;
    if(!cb?.checked){
      // NP保存済みデータを通常測定へ変更して保存した場合だけ、成功後にNPフラグを解除する。
      const p=currentProject();
      const t=p?.tests?.find(x=>x.id===state.editingTestId&&x.type===TYPE);
      if(t?.nonPlastic){
        setTimeout(()=>{
          if(!dialog()?.open){
            delete t.nonPlastic;delete t.result;
            saveData();renderTests();
          }
        },0);
      }
      return;
    }
    e.preventDefault();e.stopImmediatePropagation();
    const sample=clean(f.elements.sample?.value);
    if(!sample){alert('試料を選択してください。');return;}
    const p=currentProject();if(!p)return;
    const now=new Date().toISOString();
    const payload={sample,nonPlastic:true,result:'NP',liquid:[],plastic:[],liquidLimit:null,plasticLimit:null,plasticityIndex:null,flowIndex:null,r2:null};
    if(state.editingTestId){
      const t=p.tests.find(x=>x.id===state.editingTestId&&x.type===TYPE);if(!t)return;
      Object.assign(t,payload,{updatedAt:now});
    }else{
      p.tests.push({id:uid(),type:TYPE,...payload,createdAt:now});
    }
    p.updatedAt=now;saveData();
    state.editingTestId=null;
    f.reset();applyNpState();dialog()?.close();renderTests();
  }

  // 元の液塑性カード描画をNPだけ上書き
  function patchCard(){
    if(typeof renderMoistureCard!=='function'||renderMoistureCard.__npPatched)return;
    const base=renderMoistureCard;
    const wrapped=function(test){
      if(test?.type===TYPE&&test?.nonPlastic){
        return `<div class="card-title-row"><div><p class="test-kind">液性限界・塑性限界試験</p><h3>${esc(test.sample)}</h3><p>${new Date(test.createdAt).toLocaleString('ja-JP')}${test.updatedAt?' ｜ 訂正済み':''}</p></div><button type="button" class="edit-btn" data-edit-atterberg="${esc(test.id)}">訂正</button></div><div class="value" style="color:#0b5136">NP <small>非塑性</small></div>`;
      }
      return base(test);
    };
    wrapped.__npPatched=true;renderMoistureCard=wrapped;
  }

  // NPデータの訂正画面を開いた時にチェック状態を復元
  document.addEventListener('click',e=>{
    const b=e.target.closest?.('[data-edit-atterberg]');if(!b)return;
    const p=currentProject();const t=p?.tests?.find(x=>x.id===b.dataset.editAtterberg&&x.type===TYPE);
    setTimeout(()=>{
      inject();const cb=checkbox();if(!cb)return;
      cb.checked=!!t?.nonPlastic;applyNpState();
    },0);
  },true);

  // NP保存時は元の「測定点必須」処理より先に処理
  document.addEventListener('submit',saveNp,true);

  // データシート3枚目の液塑性欄をNP表示へ差し替え
  function latestNp(){
    const p=currentProject();const sel=document.getElementById('reportSampleSelect');if(!p||!sel)return null;
    const sample=sel.value||'';
    return [...(p.tests||[])].filter(t=>t.type===TYPE&&clean(t.sample)===clean(sample)).sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')))[0]||null;
  }
  function patchReportNp(){
    const page=document.getElementById('reportPage3');if(!page)return;
    const t=latestNp();if(!t?.nonPlastic)return;
    const sections=[...page.querySelectorAll('.r-section')];
    const sec=sections.find(x=>x.querySelector('.r-section-title')?.textContent.includes('液性限界・塑性限界'));
    if(!sec||sec.dataset.npPatched==='1')return;
    sec.dataset.npPatched='1';
    sec.innerHTML=`<div class="r-section-title">液性限界・塑性限界試験 <span class="r-small">JIS A 1205 / JGS 0141</span></div><div style="border:1px solid #333;padding:24px;text-align:center"><strong style="font-size:30px">NP</strong><div style="margin-top:6px">非塑性（液性限界・塑性限界試験不可）</div></div>`;
  }
  function setupReportWatch(){
    const root=document.getElementById('reportPages');if(!root)return;
    const obs=new MutationObserver(()=>requestAnimationFrame(patchReportNp));
    obs.observe(root,{childList:true,subtree:true});
    document.getElementById('reportSampleSelect')?.addEventListener('change',()=>requestAnimationFrame(patchReportNp));
    requestAnimationFrame(patchReportNp);
  }

  function setup(){inject();patchCard();setTimeout(setupReportWatch,0);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();