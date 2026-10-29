// SoilNote performance optimizations: incremental test list rendering + off-screen rendering reduction.
(function(){
  'use strict';

  const TEST_BATCH_SIZE = 24;
  const TEST_BATCH_DELAY = 16;

  function byUpdatedDesc(a,b){
    return String(b?.updatedAt || b?.createdAt || '').localeCompare(String(a?.updatedAt || a?.createdAt || ''));
  }

  function currentProjectSafe(){
    try{return typeof currentProject === 'function' ? currentProject() : null;}catch{return null;}
  }

  function renderTestCard(test){
    const card = document.createElement('article');
    card.className = 'card';
    try{
      card.innerHTML = test.type === 'grain' ? renderGrainCard(test) : renderMoistureCard(test);
    }catch(err){
      console.warn('[SoilNote performance] card render failed', err, test);
      return null;
    }
    return card;
  }

  function bindEditHandlers(root){
    root.querySelectorAll('[data-edit-moisture]').forEach(btn => {
      if(btn.dataset.perfBound) return;
      btn.dataset.perfBound = '1';
      btn.addEventListener('click', () => openEditMoisture(btn.dataset.editMoisture));
    });
    root.querySelectorAll('[data-edit-grain]').forEach(btn => {
      if(btn.dataset.perfBound) return;
      btn.dataset.perfBound = '1';
      btn.addEventListener('click', () => openEditGrain(btn.dataset.editGrain));
    });
  }

  function installIncrementalTestRenderer(){
    if(typeof window.renderTests !== 'function' || window.__soilnoteIncrementalTestsInstalled) return;

    window.renderTests = function(){
      const p = currentProjectSafe();
      const list = document.getElementById('testList');
      const empty = document.getElementById('emptyTests');
      if(!p || !list || !empty) return;

      const token = String(Date.now()) + '-' + Math.random().toString(16).slice(2);
      window.__soilnoteTestRenderToken = token;

      list.innerHTML = '';
      const tests = [...(p.tests || [])].sort(byUpdatedDesc);
      empty.classList.toggle('hidden', tests.length > 0);
      if(!tests.length) return;

      let index = 0;
      const drawBatch = () => {
        if(window.__soilnoteTestRenderToken !== token) return;
        const frag = document.createDocumentFragment();
        const end = Math.min(index + TEST_BATCH_SIZE, tests.length);
        for(; index < end; index++){
          const card = renderTestCard(tests[index]);
          if(card) frag.appendChild(card);
        }
        list.appendChild(frag);
        bindEditHandlers(list);

        if(index < tests.length){
          setTimeout(drawBatch, TEST_BATCH_DELAY);
        }
      };
      drawBatch();
    };

    window.__soilnoteIncrementalTestsInstalled = true;
  }

  function installReportCleanup(){
    const root = document.getElementById('reportPages');
    const dialog = document.getElementById('reportSheetDialog');
    if(!root || !dialog || window.__soilnoteReportCleanupInstalled) return;

    dialog.addEventListener('close', () => {
      root.replaceChildren();
      document.getElementById('soilnotePrintRoot')?.remove();
      document.body.classList.remove('soilnote-printing');
    });

    window.__soilnoteReportCleanupInstalled = true;
  }

  function installStyles(){
    if(document.getElementById('soilnotePerformanceStyles')) return;
    const style = document.createElement('style');
    style.id = 'soilnotePerformanceStyles';
    style.textContent = `
      #testList{content-visibility:auto;contain-intrinsic-size:800px}
      #testList>.card{content-visibility:auto;contain-intrinsic-size:220px}
      #reportPages .report-page{content-visibility:auto;contain-intrinsic-size:1120px 790px}
      @media(max-width:900px){
        #reportPages .report-page{contain-intrinsic-size:900px 680px}
      }
    `;
    document.head.appendChild(style);
  }

  function setup(){
    installStyles();
    installIncrementalTestRenderer();
    installReportCleanup();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => setTimeout(setup, 0), {once:true});
  }else{
    setTimeout(setup, 0);
  }

  // Report UI is injected by another feature script, so retry briefly until it exists.
  let tries = 0;
  const retry = setInterval(() => {
    tries++;
    setup();
    if((window.__soilnoteIncrementalTestsInstalled && window.__soilnoteReportCleanupInstalled) || tries >= 40){
      clearInterval(retry);
    }
  }, 250);
})();
