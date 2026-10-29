// SoilNote performance optimizations: reduce off-screen rendering and release report DOM after closing.
(function(){
  'use strict';

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
      #testList>.card{content-visibility:auto;contain-intrinsic-size:220px}
      #reportPages .report-page{content-visibility:auto;contain-intrinsic-size:900px}
    `;
    document.head.appendChild(style);
  }

  function setup(){
    installStyles();
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
    if(window.__soilnoteReportCleanupInstalled || tries >= 40){
      clearInterval(retry);
    }
  }, 250);
})();
