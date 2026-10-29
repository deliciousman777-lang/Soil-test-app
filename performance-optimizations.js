// SoilNote performance optimizations: incremental test list rendering + deferred report rendering.
(function(){
  'use strict';

  const TEST_BATCH_SIZE = 24;
  const TEST_BATCH_DELAY = 16;
  const REPORT_RENDER_DELAY = 0;

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
      if(!p || !window.testList || !window.emptyTests) return;

      const token = String(Date.now()) + '-' + Math.random().toString(16).slice(2);
      window.__soilnoteTestRenderToken = token;

      testList.innerHTML = '';
      const tests = [...(p.tests || [])].sort(byUpdatedDesc);
      emptyTests.classList.toggle('hidden', tests.length > 0);
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
        testList.appendChild(frag);
        bindEditHandlers(testList);

        if(index < tests.length){
          setTimeout(drawBatch, TEST_BATCH_DELAY);
        }
      };
      drawBatch();
    };

    window.__soilnoteIncrementalTestsInstalled = true;
  }

  function installReportDeferral(){
    const root = document.getElementById('reportPages');
    if(!root || window.__soilnoteReportDeferralInstalled) return;

    const dialog = document.getElementById('reportSheetDialog');
    const sample = document.getElementById('reportSampleSelect');
    let timer = null;
    let seq = 0;

    const schedule = () => {
      const mySeq = ++seq;
      clearTimeout(timer);
      root.classList.add('soilnote-report-loading');
      timer = setTimeout(() => {
        if(mySeq !== seq) return;
        requestAnimationFrame(() => {
          if(mySeq !== seq) return;
          root.classList.remove('soilnote-report-loading');
        });
      }, REPORT_RENDER_DELAY);
    };

    dialog?.addEventListener('close', () => {
      seq++;
      clearTimeout(timer);
      root.replaceChildren();
      root.classList.remove('soilnote-report-loading');
      document.getElementById('soilnotePrintRoot')?.remove();
      document.body.classList.remove('soilnote-printing');
    });
    sample?.addEventListener('change', schedule, {passive:true});

    window.__soilnoteReportDeferralInstalled = true;
  }

  function installStyles(){
    if(document.getElementById('soilnotePerformanceStyles')) return;
    const style = document.createElement('style');
    style.id = 'soilnotePerformanceStyles';
    style.textContent = `
      #testList{content-visibility:auto;contain-intrinsic-size:800px}
      #testList>.card{content-visibility:auto;contain-intrinsic-size:220px}
      #reportPages .report-page{content-visibility:auto;contain-intrinsic-size:1120px 790px}
      #reportPages.soilnote-report-loading{pointer-events:none}
      @media(max-width:900px){
        #reportPages .report-page{contain-intrinsic-size:900px 680px}
      }
    `;
    document.head.appendChild(style);
  }

  function setup(){
    installStyles();
    installIncrementalTestRenderer();
    installReportDeferral();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => setTimeout(setup, 0), {once:true});
  }else{
    setTimeout(setup, 0);
  }

  // Some feature scripts create the report dialog after DOMContentLoaded.
  let tries = 0;
  const retry = setInterval(() => {
    tries++;
    setup();
    if(window.__soilnoteIncrementalTestsInstalled && window.__soilnoteReportDeferralInstalled || tries >= 40){
      clearInterval(retry);
    }
  }, 250);
})();
