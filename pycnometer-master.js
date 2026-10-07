// 会社登録ピクノメーター・マスタ（写真転記）
(function(){
  const MASTER = {
    1:{mf:39.6790,ma2:154.5930,t2:22.0},2:{mf:41.2710,ma2:158.5380,t2:22.0},3:{mf:38.5870,ma2:148.4610,t2:22.0},4:{mf:41.3390,ma2:156.4390,t2:24.0},5:{mf:40.4460,ma2:154.0920,t2:24.0},
    6:{mf:45.4940,ma2:157.1350,t2:24.0},7:{mf:41.3580,ma2:160.4870,t2:24.0},8:{mf:48.6390,ma2:152.8360,t2:24.0},9:{mf:42.1180,ma2:155.2970,t2:24.0},10:{mf:48.1310,ma2:153.1540,t2:24.0},
    11:{mf:42.5360,ma2:158.8890,t2:24.0},12:{mf:42.8140,ma2:157.8520,t2:24.0},13:{mf:42.5550,ma2:158.0650,t2:24.0},14:{mf:41.3720,ma2:161.0010,t2:24.0},15:{mf:47.3780,ma2:151.7470,t2:24.0},
    16:{mf:42.2460,ma2:161.3270,t2:24.0},17:{mf:40.7780,ma2:160.8100,t2:24.0},18:{mf:43.5290,ma2:162.8230,t2:24.0},19:{mf:43.1380,ma2:159.6800,t2:24.0},20:{mf:49.7670,ma2:154.1390,t2:24.0},
    21:{mf:44.6810,ma2:163.0680,t2:24.0},22:{mf:46.4840,ma2:165.1240,t2:24.0},23:{mf:43.5130,ma2:162.7250,t2:24.0},24:{mf:41.7870,ma2:160.4290,t2:24.0},25:{mf:43.0980,ma2:161.4500,t2:24.0},
    26:{mf:42.6220,ma2:161.0340,t2:24.0},27:{mf:41.7090,ma2:160.4360,t2:24.0},28:{mf:39.6640,ma2:159.6780,t2:24.0},29:{mf:43.5830,ma2:162.8320,t2:24.0},30:{mf:42.2800,ma2:160.7150,t2:24.0},
    31:{mf:42.1360,ma2:161.5250,t2:24.0},32:{mf:42.6620,ma2:161.7280,t2:24.0},33:{mf:42.8040,ma2:161.8370,t2:24.0},34:{mf:41.8020,ma2:161.1280,t2:24.0},35:{mf:42.8630,ma2:162.5790,t2:24.0},
    36:{mf:46.7220,ma2:152.5290,t2:24.0},37:{mf:41.9060,ma2:161.2710,t2:24.0},38:{mf:42.1360,ma2:161.9130,t2:24.0},39:{mf:50.0190,ma2:153.7710,t2:24.0},40:{mf:42.8750,ma2:161.9520,t2:24.0},
    41:{mf:44.1080,ma2:163.3940,t2:24.0},42:{mf:43.4640,ma2:161.8370,t2:24.0},43:{mf:49.1390,ma2:153.8380,t2:26.0},44:{mf:40.4510,ma2:153.8280,t2:26.0},45:{mf:42.2280,ma2:153.8180,t2:26.0},
    46:{mf:35.1400,ma2:153.8080,t2:26.0},47:{mf:34.1380,ma2:153.7080,t2:26.0},48:{mf:51.0300,ma2:153.6080,t2:26.0},49:{mf:51.0200,ma2:153.0508,t2:26.0},50:{mf:51.1100,ma2:153.0405,t2:26.0},
    51:{mf:51.0400,ma2:153.6180,t2:26.0},52:{mf:50.1000,ma2:152.1400,t2:26.0},53:{mf:50.3000,ma2:152.2000,t2:26.0},54:{mf:51.4500,ma2:153.1450,t2:26.0},55:{mf:51.2300,ma2:153.0450,t2:26.0},
    56:{mf:51.2500,ma2:153.0640,t2:26.0},57:{mf:49.2080,ma2:154.0330,t2:26.0},58:{mf:49.3080,ma2:154.0440,t2:26.0},59:{mf:49.1890,ma2:153.9940,t2:24.0},60:{mf:50.1200,ma2:154.0230,t2:26.0},
    61:{mf:50.2500,ma2:154.0400,t2:26.0},62:{mf:50.3850,ma2:154.0600,t2:26.0},63:{mf:50.4400,ma2:154.0740,t2:26.0},64:{mf:50.3800,ma2:154.0650,t2:26.0},65:{mf:49.2120,ma2:153.0100,t2:26.0},
    66:{mf:49.2350,ma2:153.0800,t2:26.0},67:{mf:49.2200,ma2:153.0200,t2:26.0},68:{mf:49.2450,ma2:153.0840,t2:26.0},69:{mf:50.4520,ma2:154.0640,t2:26.0},70:{mf:50.6610,ma2:154.0840,t2:26.0},
    71:{mf:50.8560,ma2:154.1010,t2:26.0},72:{mf:50.4860,ma2:154.6200,t2:26.0},73:{mf:51.6500,ma2:155.4700,t2:26.0},74:{mf:50.5650,ma2:154.5600,t2:26.0},75:{mf:40.4510,ma2:146.6760,t2:24.0},
    76:{mf:50.4400,ma2:153.0520,t2:26.0},77:{mf:50.8200,ma2:153.0200,t2:26.0},78:{mf:51.5450,ma2:154.9800,t2:26.0},79:{mf:49.5400,ma2:153.4500,t2:26.0},80:{mf:48.0500,ma2:153.0100,t2:26.0},
    81:{mf:49.4120,ma2:154.0200,t2:26.0},82:{mf:48.6320,ma2:153.2100,t2:26.0},83:{mf:49.6500,ma2:153.5460,t2:26.0},84:{mf:50.2150,ma2:152.9520,t2:26.0},85:{mf:48.5450,ma2:153.1850,t2:26.0},
    86:{mf:49.2670,ma2:153.5690,t2:26.0},87:{mf:51.5630,ma2:153.4520,t2:26.0},88:{mf:49.4750,ma2:154.2560,t2:26.0},89:{mf:50.4180,ma2:152.9850,t2:26.0},90:{mf:43.5190,ma2:150.8390,t2:26.0},
    91:{mf:46.6590,ma2:153.4850,t2:26.0},92:{mf:49.5420,ma2:153.9850,t2:26.0},93:{mf:29.8120,ma2:86.9020,t2:26.0},94:{mf:29.7980,ma2:86.4310,t2:24.0},95:{mf:35.1400,ma2:89.6370,t2:24.0},
    96:{mf:34.1880,ma2:88.1720,t2:24.0},97:{mf:42.2280,ma2:151.9650,t2:24.0},98:{mf:34.1950,ma2:88.2930,t2:26.0},99:{mf:33.1450,ma2:87.7880,t2:26.0}
  };
  window.PYCNOMETER_MASTER = MASTER;

  function setup(){
    const form=document.getElementById('particleDensityForm');
    if(!form||form.dataset.pycMasterReady==='1') return false;
    form.dataset.pycMasterReady='1';

    let dl=document.getElementById('pycnometerMasterList');
    if(!dl){
      dl=document.createElement('datalist');
      dl.id='pycnometerMasterList';
      dl.innerHTML=Object.entries(MASTER).map(([no,v])=>`<option value="${no}" label="No.${no} / 瓶 ${v.mf.toFixed(4)} g / 水+瓶 ${v.ma2.toFixed(4)} g / ${v.t2.toFixed(1)}℃"></option>`).join('');
      document.body.appendChild(dl);
    }

    for(let i=1;i<=3;i++){
      const noEl=form.elements[`pycNo_${i}`];
      if(!noEl) continue;
      noEl.setAttribute('list','pycnometerMasterList');
      noEl.setAttribute('inputmode','numeric');
      noEl.placeholder='1〜99';

      const label=noEl.closest('label');
      if(label&&!label.querySelector('.pd-master-note')){
        const note=document.createElement('small');
        note.className='pd-master-note';
        note.textContent='会社登録No.を入力すると校正値を自動入力';
        label.appendChild(note);
      }

      const apply=()=>{
        const key=String(noEl.value||'').trim().replace(/^0+/,'')||'0';
        const item=MASTER[Number(key)];
        if(!item) return;
        form.elements[`mf_${i}`].value=item.mf.toFixed(4);
        form.elements[`ma2_${i}`].value=item.ma2.toFixed(4);
        form.elements[`t2_${i}`].value=item.t2.toFixed(1);
        form.elements[`mf_${i}`].dataset.fromMaster='1';
        form.elements[`ma2_${i}`].dataset.fromMaster='1';
        form.elements[`t2_${i}`].dataset.fromMaster='1';
        form.dispatchEvent(new Event('input',{bubbles:true}));
      };
      noEl.addEventListener('change',apply);
      noEl.addEventListener('blur',apply);
      noEl.addEventListener('input',()=>{const key=String(noEl.value||'').trim().replace(/^0+/,'')||'0';if(MASTER[Number(key)]) apply();});
    }

    if(!document.getElementById('pycnometerMasterStyle')){
      const style=document.createElement('style');
      style.id='pycnometerMasterStyle';
      style.textContent=`.pd-master-note{display:block;margin-top:4px;color:var(--muted);font-size:10px;line-height:1.35}#particleDensityForm input[data-from-master="1"]{background:#f3f8f6;border-color:#b9d5cb}`;
      document.head.appendChild(style);
    }
    return true;
  }

  if(!setup()){
    const obs=new MutationObserver(()=>{if(setup()) obs.disconnect();});
    obs.observe(document.documentElement,{childList:true,subtree:true});
  }
})();