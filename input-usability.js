// SoilNote 入力操作改善
// 1) 液性・塑性限界試験：PCは固定列、スマホは横スクロールを使わないカード表示
// 2) 沈降分析の土粒子密度を、同一工事・同一試料の土粒子密度試験から自動入力
(function(){
  function rearrangeAtterbergColumns(){
    const dialog=document.getElementById('atterbergDialog');
    if(!dialog || dialog.dataset.containerColumnsFixed==='1') return;

    const tables=dialog.querySelectorAll('.att-table');
    const liquid=tables[0];
    const plastic=tables[1];

    // 液性限界: No. / 落下回数 / 容器No. → 容器No. / No. / 落下回数
    if(liquid){
      const head=liquid.tHead?.rows?.[0];
      if(head?.cells?.length>=3) head.insertBefore(head.cells[2],head.cells[0]);
      Array.from(liquid.tBodies?.[0]?.rows||[]).forEach(row=>{
        if(row.cells.length>=3) row.insertBefore(row.cells[2],row.cells[0]);
      });
      liquid.classList.add('att-frozen-table');
    }

    // 塑性限界: No. / 容器No. → 容器No. / No.
    if(plastic){
      const head=plastic.tHead?.rows?.[0];
      if(head?.cells?.length>=2) head.insertBefore(head.cells[1],head.cells[0]);
      Array.from(plastic.tBodies?.[0]?.rows||[]).forEach(row=>{
        if(row.cells.length>=2) row.insertBefore(row.cells[1],row.cells[0]);
      });
      plastic.classList.add('att-frozen-table');
    }

    dialog.dataset.containerColumnsFixed='1';
  }

  function addAtterbergStickyStyles(){
    if(document.getElementById('soilnoteInputUsabilityStyles')) return;
    const s=document.createElement('style');
    s.id='soilnoteInputUsabilityStyles';
    s.textContent=`
      /* PC / タブレット：容器No.と測定No.を左固定 */
      #atterbergDialog .table-wrap{position:relative;isolation:isolate}
      #atterbergDialog .att-frozen-table{border-collapse:separate!important;border-spacing:0!important}
      #atterbergDialog .att-frozen-table tr > :first-child{
        position:-webkit-sticky!important;position:sticky!important;left:0!important;z-index:6!important;
        min-width:132px!important;width:132px!important;max-width:132px!important;background:#fff!important;
        text-align:left!important;box-shadow:2px 0 0 var(--line),8px 0 14px rgba(30,60,52,.10)
      }
      #atterbergDialog .att-frozen-table tr > :nth-child(2){
        position:-webkit-sticky!important;position:sticky!important;left:132px!important;z-index:5!important;
        min-width:48px!important;width:48px!important;max-width:48px!important;background:#fff!important;text-align:center!important
      }
      #atterbergDialog .att-frozen-table thead tr > :first-child,
      #atterbergDialog .att-frozen-table thead tr > :nth-child(2){z-index:9!important;background:#eef4f2!important}
      #atterbergDialog .att-frozen-table tbody tr > :nth-child(2){font-weight:800}
      #atterbergDialog .att-frozen-table tr > :first-child input{width:105px!important;min-width:105px!important}

      /* iPhone：stickyに依存せず、1測定ずつカードにする */
      @media(max-width:800px){
        #atterbergDialog .att-panel{padding:10px!important}
        #atterbergDialog .att-panel .table-wrap{overflow:visible!important;border:0!important;background:transparent!important}
        #atterbergDialog .att-table{display:block!important;min-width:0!important;width:100%!important}
        #atterbergDialog .att-table thead{display:none!important}
        #atterbergDialog .att-table tbody{display:grid!important;gap:10px!important;width:100%!important}
        #atterbergDialog .att-table tbody tr{
          display:grid!important;grid-template-columns:1fr 1fr!important;gap:9px!important;width:100%!important;
          padding:11px!important;border:1px solid var(--line)!important;border-radius:14px!important;background:#fff!important;
          box-shadow:0 2px 8px rgba(24,38,34,.04)!important
        }
        #atterbergDialog .att-table tbody tr > *{
          position:static!important;left:auto!important;z-index:auto!important;display:flex!important;flex-direction:column!important;
          gap:4px!important;min-width:0!important;width:auto!important;max-width:none!important;padding:0!important;border:0!important;
          background:transparent!important;box-shadow:none!important;text-align:left!important;white-space:normal!important
        }
        #atterbergDialog .att-table tbody tr > :nth-child(2){
          order:1!important;grid-column:1/-1!important;display:block!important;padding:0 0 7px!important;
          border-bottom:1px solid var(--line)!important;color:var(--accent-dark)!important;font-size:15px!important;font-weight:900!important
        }
        #atterbergDialog .att-table tbody tr > :nth-child(2)::before{content:'測定 ';color:var(--muted);font-size:11px;font-weight:700}
        #atterbergDialog .att-table tbody tr > :first-child{
          order:2!important;grid-column:1/-1!important;padding:9px!important;border-radius:10px!important;background:#eef8f3!important
        }
        #atterbergDialog .att-table tbody tr > :first-child::before{content:'容器No.';color:var(--accent-dark);font-size:11px;font-weight:900}
        #atterbergDialog .att-table tbody tr > :first-child input{width:100%!important;min-width:0!important;background:#fff!important}
        #atterbergDialog .att-table tbody tr > :nth-child(n+3){order:3!important}
        #atterbergDialog .att-table input{width:100%!important;min-width:0!important;margin:0!important;padding:11px!important;text-align:right!important}

        /* 液性限界：並び替え後 3=落下回数, 4=容器質量, 5=湿潤, 6=乾燥, 7=含水比 */
        #atterbergDialog .att-panel:first-of-type .att-table tbody tr > :nth-child(3)::before{content:'落下回数 N';color:var(--muted);font-size:11px;font-weight:700}
        #atterbergDialog .att-panel:first-of-type .att-table tbody tr > :nth-child(4)::before{content:'容器質量 mc';color:var(--muted);font-size:11px;font-weight:700}
        #atterbergDialog .att-panel:first-of-type .att-table tbody tr > :nth-child(5)::before{content:'容器＋湿潤土 ma';color:var(--muted);font-size:11px;font-weight:700}
        #atterbergDialog .att-panel:first-of-type .att-table tbody tr > :nth-child(6)::before{content:'容器＋乾燥土 mb';color:var(--muted);font-size:11px;font-weight:700}
        #atterbergDialog .att-panel:first-of-type .att-table tbody tr > :nth-child(7)::before{content:'含水比 w %';color:var(--muted);font-size:11px;font-weight:700}

        /* 塑性限界：並び替え後 3=容器質量, 4=湿潤, 5=乾燥, 6=含水比 */
        #atterbergDialog .att-panel:nth-of-type(2) .att-table tbody tr > :nth-child(3)::before{content:'容器質量 mc';color:var(--muted);font-size:11px;font-weight:700}
        #atterbergDialog .att-panel:nth-of-type(2) .att-table tbody tr > :nth-child(4)::before{content:'容器＋湿潤土 ma';color:var(--muted);font-size:11px;font-weight:700}
        #atterbergDialog .att-panel:nth-of-type(2) .att-table tbody tr > :nth-child(5)::before{content:'容器＋乾燥土 mb';color:var(--muted);font-size:11px;font-weight:700}
        #atterbergDialog .att-panel:nth-of-type(2) .att-table tbody tr > :nth-child(6)::before{content:'含水比 w %';color:var(--muted);font-size:11px;font-weight:700}

        #atterbergDialog .att-table td.calc{padding:10px!important;border-radius:10px!important;background:#f4f8f7!important;color:var(--accent-dark)!important;font-weight:900!important}
      }

      #grainForm input[name="particleDensity"][data-auto-pd="1"]{background:#eef8f3}
      .sed-pd-auto-note{display:block;margin-top:5px;font-size:11px;color:var(--muted);font-weight:700}
      .sed-pd-auto-note.active{color:var(--accent-dark)}
    `;
    document.head.appendChild(s);
  }

  function normalizedSample(value){
    return String(value??'').normalize('NFKC').toLowerCase().replace(/[\s　]+/g,'').trim();
  }

  function densityInput(){
    return document.getElementById('grainForm')?.elements?.particleDensity || null;
  }

  function ensureDensityNote(){
    const input=densityInput();
    if(!input) return null;
    let note=document.getElementById('sedParticleDensityAutoNote');
    if(note) return note;
    note=document.createElement('small');
    note.id='sedParticleDensityAutoNote';
    note.className='sed-pd-auto-note';
    input.insertAdjacentElement('afterend',note);
    return note;
  }

  function setDensityNote(text,active=false){
    const note=ensureDensityNote();
    if(!note) return;
    note.textContent=text||'';
    note.classList.toggle('active',Boolean(active));
  }

  function latestDensityTest(sample){
    const key=normalizedSample(sample);
    if(!key || typeof currentProject!=='function') return null;
    const project=currentProject();
    const matches=(project?.tests||[]).filter(t=>
      t?.type==='particleDensity' &&
      normalizedSample(t.sample)===key &&
      Number.isFinite(Number(t.particleDensityAverage))
    );
    matches.sort((a,b)=>String(b.updatedAt||b.createdAt||'').localeCompare(String(a.updatedAt||a.createdAt||'')));
    return matches[0]||null;
  }

  function refreshSedimentationPreview(){
    if(typeof updateSedimentationPreview==='function') updateSedimentationPreview();
  }

  function syncParticleDensityFromTest(){
    const form=document.getElementById('grainForm');
    const input=densityInput();
    const sample=form?.elements?.sample?.value?.trim()||'';
    if(!form || !input) return;

    const wasAuto=input.dataset.autoParticleDensity==='1';
    const match=latestDensityTest(sample);
    if(!match){
      if(wasAuto){
        input.value='';
        delete input.dataset.autoParticleDensity;
        delete input.dataset.autoPdTestId;
        refreshSedimentationPreview();
      }
      if(document.getElementById('useSedimentation')?.checked && sample){
        setDensityNote('同じ試料名の土粒子密度試験データはまだありません。');
      }else{
        setDensityNote('');
      }
      return;
    }

    // 手入力済み、または保存済みの沈降分析値は勝手に上書きしない。
    if(String(input.value||'').trim()!=='' && !wasAuto){
      setDensityNote('土粒子密度は入力済みです。');
      return;
    }

    const value=Number(match.particleDensityAverage);
    if(!Number.isFinite(value)) return;
    input.value=value.toFixed(3);
    input.dataset.autoParticleDensity='1';
    input.dataset.autoPdTestId=match.id||'';
    setDensityNote(`土粒子密度試験「${match.sample||sample}」から自動入力`,true);
    refreshSedimentationPreview();
  }

  function markDensityAsManual(){
    const input=densityInput();
    if(!input) return;
    delete input.dataset.autoParticleDensity;
    delete input.dataset.autoPdTestId;
    input.removeAttribute('data-auto-pd');
    setDensityNote(String(input.value||'').trim()?'手入力値を使用中':'');
  }

  function updateAutoVisual(){
    const input=densityInput();
    if(!input) return;
    if(input.dataset.autoParticleDensity==='1') input.setAttribute('data-auto-pd','1');
    else input.removeAttribute('data-auto-pd');
  }

  function clearSessionFlag(){
    const input=densityInput();
    if(!input) return;
    delete input.dataset.autoParticleDensity;
    delete input.dataset.autoPdTestId;
    input.removeAttribute('data-auto-pd');
    setDensityNote('');
  }

  function initDensityAutoFill(){
    const form=document.getElementById('grainForm');
    if(!form || form.dataset.pdAutoBound==='1') return;
    form.dataset.pdAutoBound='1';
    ensureDensityNote();

    form.addEventListener('input',e=>{
      if(e.target===form.elements.particleDensity && e.isTrusted){
        markDensityAsManual();
        return;
      }
      if(e.target===form.elements.sample){
        syncParticleDensityFromTest();
        updateAutoVisual();
      }
    });

    document.getElementById('useSedimentation')?.addEventListener('change',()=>{
      if(document.getElementById('useSedimentation')?.checked) syncParticleDensityFromTest();
      else setDensityNote('');
      updateAutoVisual();
    });

    document.getElementById('addGrainBtn')?.addEventListener('click',()=>{
      setTimeout(()=>{
        clearSessionFlag();
        syncParticleDensityFromTest();
        updateAutoVisual();
      },0);
    });

    document.addEventListener('click',e=>{
      if(!e.target.closest?.('[data-edit-grain]')) return;
      setTimeout(()=>{
        // 編集時に保存済みのρsが入っていれば、それを優先する。
        clearSessionFlag();
        if(!String(densityInput()?.value||'').trim()) syncParticleDensityFromTest();
        updateAutoVisual();
      },0);
    });

    document.getElementById('grainDialog')?.addEventListener('close',clearSessionFlag);
  }

  function init(){
    rearrangeAtterbergColumns();
    addAtterbergStickyStyles();
    initDensityAutoFill();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();