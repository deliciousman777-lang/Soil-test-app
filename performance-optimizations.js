// SoilNote performance optimizations: keep report pages complete on iPhone and release report DOM after closing.
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
      #reportPages .report-page{content-visibility:visible!important;contain:none!important}

      @media(max-width:900px){
        #reportSheetDialog.report-dialog{
          width:100vw!important;
          max-width:none!important;
          height:100dvh!important;
          max-height:100dvh!important;
          margin:0!important;
          border-radius:0!important;
          overflow:auto!important;
        }
        #reportSheetDialog .report-ui{
          flex-wrap:wrap!important;
          gap:8px!important;
          padding:8px 10px!important;
        }
        #reportSheetDialog .report-ui>div{width:100%;margin-right:0!important}
        #reportSheetDialog .report-ui label{margin:0!important;flex:1 1 150px}
        #reportSheetDialog .report-ui select{min-width:0!important;width:100%}
        #reportSheetDialog .report-pages{
          display:block!important;
          width:100%!important;
          padding:8px!important;
          overflow-x:hidden!important;
        }
        #reportPages>.report-page{
          width:210mm!important;
          max-width:none!important;
          min-width:210mm!important;
          min-height:297mm!important;
          padding:10mm 11mm!important;
          box-sizing:border-box!important;
          margin-left:0!important;
          margin-right:0!important;
        }
        #reportPages>.ucs-page{
          height:297mm!important;
          min-height:297mm!important;
          padding:8mm 8mm 7mm!important;
          overflow:hidden!important;
        }
        #reportPages .r-chart-grid,
        #reportPages .r-grain-grid{grid-template-columns:1.15fr .85fr!important}
        #reportPages .ucs-blocks{display:grid!important;grid-template-rows:repeat(3,1fr)!important;gap:3mm!important}
        #reportPages .ucs-block{display:grid!important;grid-template-columns:47% 53%!important;gap:3mm!important;margin-top:0!important}
        #reportPages .ucs-right{display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:3.2mm!important;min-height:0!important}
        #reportPages .ucs-spec{display:grid!important;grid-template-rows:5mm 1fr 30mm!important}
        #reportPages .ucs-sketch{height:auto!important;min-height:35mm!important;max-height:42mm!important}
      }

      @media print{
        #soilnotePrintRoot .report-page{
          transform:none!important;
          transform-origin:initial!important;
          margin:0!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function installMobileReportFit(){
    const root = document.getElementById('reportPages');
    const dialog = document.getElementById('reportSheetDialog');
    if(!root || !dialog || window.__soilnoteMobileReportFitInstalled) return;

    let raf = 0;
    const fit = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const mobile = window.matchMedia('(max-width:900px)').matches;
        const pages = [...root.querySelectorAll(':scope > .report-page')];

        pages.forEach(page => {
          page.style.removeProperty('transform');
          page.style.removeProperty('transform-origin');
          page.style.removeProperty('margin-bottom');
        });

        if(!mobile || !dialog.open || !pages.length) return;

        const available = Math.max(240, root.clientWidth - 16);
        pages.forEach(page => {
          const naturalWidth = page.offsetWidth || 794;
          const naturalHeight = page.offsetHeight || 1123;
          const scale = Math.min(1, available / naturalWidth);
          page.style.transformOrigin = 'top left';
          page.style.transform = `scale(${scale})`;
          page.style.marginBottom = `${Math.round(-naturalHeight * (1 - scale) + 18)}px`;
        });
      });
    };

    const rootObserver = new MutationObserver(fit);
    rootObserver.observe(root,{childList:true,subtree:false});
    const dialogObserver = new MutationObserver(fit);
    dialogObserver.observe(dialog,{attributes:true,attributeFilter:['open']});
    window.addEventListener('resize',fit,{passive:true});
    document.getElementById('reportSampleSelect')?.addEventListener('change',fit,{passive:true});

    window.__soilnoteMobileReportFitInstalled = true;
    fit();
  }

  function setup(){
    installStyles();
    installReportCleanup();
    installMobileReportFit();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', () => setTimeout(setup, 0), {once:true});
  }else{
    setTimeout(setup, 0);
  }

  let tries = 0;
  const retry = setInterval(() => {
    tries++;
    setup();
    if((window.__soilnoteReportCleanupInstalled && window.__soilnoteMobileReportFitInstalled) || tries >= 40){
      clearInterval(retry);
    }
  }, 250);
})();
