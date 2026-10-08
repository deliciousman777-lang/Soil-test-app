// 保存済み試験の「確認」共通機能
// 各試験カードの「訂正」と「確認」を分離し、確認は閲覧専用にする。
(function(){
  const TYPE_NAMES={
    moisture:'含水比試験',
    grain:'粒度試験',
    particleDensity:'土粒子の密度試験',
    atterberg:'液性限界・塑性限界試験',
    'cone-index':'締固めた土のコーン指数試験'
  };

  const finite=v=>Number.isFinite(Number(v));
  const num=(v,d=3)=>finite(v)?Number(v).toFixed(d):'—';
  const esc=v=>typeof escapeHtml==='function'?escapeHtml(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const dateText=v=>{if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('ja-JP');};

  function dialogEls(){
    return {
      dialog:document.getElementById('testReviewDialog'),
      title:document.getElementById('testReviewTitle'),
      body:document.getElementById('testReviewBody')
    };
  }

  function meta(test){
    return `<p class="review-meta">試料：${esc(test.sample||'—')} ｜ 登録：${dateText(test.createdAt)}${test.updatedAt?` ｜ 最終訂正：${dateText(test.updatedAt)}`:''}</p>`;
  }

  function note(){
    return '<div class="review-note">この画面は確認専用です。数値を直す場合は「訂正」から変更します。</div>';
  }

  function moistureHtml(test){
    const rows=(Array.isArray(test.measurements)?test.measurements:[]).map((m,i)=>`<tr><th>測定 ${i+1}</th><td>${esc(m.containerNo||'—')}</td><td>${num(m.wetMass)} g</td><td>${num(m.dryMass)} g</td><td>${num(m.containerMass)} g</td><td><strong>${num(m.moisture,1)} %</strong></td></tr>`).join('');
    const avg=finite(test.moistureAverage)?Number(test.moistureAverage):(Array.isArray(test.measurements)&&test.measurements.length?test.measurements.reduce((s,m)=>s+(Number(m.moisture)||0),0)/test.measurements.length:null);
    return `${meta(test)}<div class="review-summary"><div><span>平均含水比</span><strong>${finite(avg)?Number(avg).toFixed(1):'—'} %</strong></div><div><span>測定数</span><strong>${test.measurements?.length||0}</strong></div><div><span>状態</span><strong>${test.updatedAt?'訂正済':'保存済'}</strong></div></div><section class="review-section"><h3>測定値</h3><div class="table-wrap"><table class="review-table"><thead><tr><th>測定</th><th>容器番号</th><th>容器＋湿潤試料</th><th>容器＋乾燥試料</th><th>容器質量</th><th>含水比</th></tr></thead><tbody>${rows||'<tr><td colspan="6">測定値がありません</td></tr>'}</tbody></table></div></section>${note()}`;
  }

  function particleDensityHtml(test){
    const rows=(test.measurements||[]).map((r,i)=>`<tr><th>測定 ${i+1}</th><td>${esc(r.pycnometerNo||r.containerNo||'—')}</td><td>${num(r.mb1)} g</td><td>${num(r.t1,1)} ℃</td><td>${num(r.ms)} g</td><td>${num(r.ma1)} g</td><td><strong>${num(r.rhoS,3)} Mg/m³</strong></td></tr>`).join('');
    return `${meta(test)}<div class="review-summary"><div><span>平均土粒子密度</span><strong>${num(test.particleDensityAverage,3)}</strong><small>Mg/m³</small></div><div><span>測定数</span><strong>${test.measurements?.length||0}</strong></div><div><span>状態</span><strong>${test.updatedAt?'訂正済':'保存済'}</strong></div></div><section class="review-section"><h3>測定値</h3><div class="table-wrap"><table class="review-table"><thead><tr><th>測定</th><th>ピクノメーターNo.</th><th>mᵦ</th><th>温度 T</th><th>炉乾燥質量 mₛ</th><th>mₐ(T)</th><th>ρₛ</th></tr></thead><tbody>${rows||'<tr><td colspan="7">測定値がありません</td></tr>'}</tbody></table></div></section>${note()}`;
  }

  function atterbergHtml(test){
    if(test.nonPlastic){
      return `${meta(test)}<div class="review-summary"><div><span>判定</span><strong>NP</strong><small>非塑性</small></div><div><span>液性限界</span><strong>NP</strong></div><div><span>塑性限界</span><strong>NP</strong></div></div><div class="review-note">NP（非塑性）として保存されています。</div>${note()}`;
    }
    const liquid=(test.liquid||[]).map((r,i)=>`<tr><th>${i+1}</th><td>${num(r.N,0)}</td><td>${esc(r.containerNo||'—')}</td><td>${num(r.wetMass)} g</td><td>${num(r.dryMass)} g</td><td>${num(r.containerMass)} g</td><td>${num(r.moisture,1)} %</td></tr>`).join('');
    const plastic=(test.plastic||[]).map((r,i)=>`<tr><th>${i+1}</th><td>${esc(r.containerNo||'—')}</td><td>${num(r.wetMass)} g</td><td>${num(r.dryMass)} g</td><td>${num(r.containerMass)} g</td><td>${num(r.moisture,1)} %</td></tr>`).join('');
    return `${meta(test)}<div class="review-summary"><div><span>液性限界 wL</span><strong>${num(test.liquidLimit,1)} %</strong></div><div><span>塑性限界 wP</span><strong>${num(test.plasticLimit,1)} %</strong></div><div><span>塑性指数 IP</span><strong>${num(test.plasticityIndex,1)}</strong></div></div><p class="review-meta">流動指数 If：${num(test.flowIndex,1)} ｜ R²：${num(test.r2,3)}</p><section class="review-section"><h3>液性限界</h3><div class="table-wrap"><table class="review-table"><thead><tr><th>No.</th><th>落下回数 N</th><th>容器No.</th><th>容器＋湿潤試料</th><th>容器＋乾燥試料</th><th>容器質量</th><th>w</th></tr></thead><tbody>${liquid||'<tr><td colspan="7">測定値がありません</td></tr>'}</tbody></table></div></section><section class="review-section"><h3>塑性限界</h3><div class="table-wrap"><table class="review-table"><thead><tr><th>No.</th><th>容器No.</th><th>容器＋湿潤試料</th><th>容器＋乾燥試料</th><th>容器質量</th><th>w</th></tr></thead><tbody>${plastic||'<tr><td colspan="6">測定値がありません</td></tr>'}</tbody></table></div></section>${note()}`;
  }

  function coneIndexHtml(test){
    const waters=(test.moistureMeasurements||[]).map((r,i)=>`<tr><th>測定 ${i+1}</th><td>${esc(r.containerNo||'—')}</td><td>${num(r.ma)} g</td><td>${num(r.mb)} g</td><td>${num(r.mc)} g</td><td>${num(r.w,1)} %</td></tr>`).join('');
    const pens=(test.penetrations||[]).map(r=>`<tr><th>${num(r.depth,1)} cm</th><td>${num(r.reading,1)}</td><td>${num(r.force,1)} N</td></tr>`).join('');
    return `${meta(test)}<div class="review-summary"><div><span>コーン指数 qc</span><strong>${num(test.coneIndex,0)}</strong><small>kN/m²</small></div><div><span>平均含水比</span><strong>${num(test.moistureAverage,1)} %</strong></div><div><span>乾燥密度 ρd</span><strong>${num(test.dryDensity,3)}</strong><small>g/cm³</small></div></div><section class="review-section"><h3>含水比</h3><div class="table-wrap"><table class="review-table"><thead><tr><th>測定</th><th>容器No.</th><th>ma 容器＋湿潤試料</th><th>mb 容器＋乾燥試料</th><th>mc 容器</th><th>w</th></tr></thead><tbody>${waters||'<tr><td colspan="6">測定値がありません</td></tr>'}</tbody></table></div></section><section class="review-section"><h3>供試体・モールド</h3><div class="table-wrap"><table class="review-table"><tbody><tr><th>モールドNo.</th><td>${esc(test.moldNo||'—')}</td><th>モールド質量</th><td>${num(test.moldMass)} g</td><th>土＋モールド質量</th><td>${num(test.moldSoilMass)} g</td></tr><tr><th>湿潤密度 ρt</th><td>${num(test.wetDensity,3)} g/cm³</td><th>乾燥密度 ρd</th><td>${num(test.dryDensity,3)} g/cm³</td><th>容量</th><td>${num(test.moldVolume,0)} cm³</td></tr></tbody></table></div></section><section class="review-section"><h3>コーン貫入</h3><p class="review-meta">荷重計 No.${esc(test.loadCellNo||'—')} ｜ 容量 ${num(test.loadCellCapacity,0)} N ｜ 較正係数 ${num(test.calibrationFactor,3)} N/目盛 ｜ 平均 Qc ${num(test.averagePenetrationForce,1)} N</p><div class="table-wrap"><table class="review-table"><thead><tr><th>貫入深さ</th><th>荷重計の読み</th><th>貫入抵抗力</th></tr></thead><tbody>${pens||'<tr><td colspan="3">測定値がありません</td></tr>'}</tbody></table></div></section>${note()}`;
  }

  function genericValue(v){
    if(v===null||v===undefined||v==='')return '—';
    if(typeof v==='boolean')return v?'はい':'いいえ';
    if(typeof v==='number')return Number.isFinite(v)?String(v):'—';
    if(typeof v==='string')return esc(v);
    return esc(JSON.stringify(v));
  }

  function genericHtml(test){
    const skip=new Set(['id','type','sample','createdAt','updatedAt']);
    const rows=Object.entries(test).filter(([k])=>!skip.has(k)).map(([k,v])=>`<tr><th>${esc(k)}</th><td style="text-align:left;white-space:normal">${genericValue(v)}</td></tr>`).join('');
    return `${meta(test)}<section class="review-section"><h3>保存データ</h3><div class="table-wrap"><table class="review-table"><tbody>${rows||'<tr><td>保存データがありません</td></tr>'}</tbody></table></div></section>${note()}`;
  }

  function htmlFor(test){
    if(test.type==='moisture')return moistureHtml(test);
    if(test.type==='particleDensity')return particleDensityHtml(test);
    if(test.type==='atterberg')return atterbergHtml(test);
    if(test.type==='cone-index')return coneIndexHtml(test);
    return genericHtml(test);
  }

  function openReview(id){
    const p=currentProject?.();
    const test=p?.tests?.find(t=>t.id===id);
    if(!test)return;
    const {dialog,title,body}=dialogEls();
    if(!dialog||!title||!body)return;
    title.textContent=`${TYPE_NAMES[test.type]||'試験データ'}・詳細確認`;
    body.innerHTML=htmlFor(test);
    dialog.showModal();
  }

  function editId(button){
    if(!button)return '';
    const attr=[...button.attributes].find(a=>a.name.startsWith('data-edit-'));
    return attr?.value||'';
  }

  function enhanceReviewButtons(){
    document.querySelectorAll('#testList .card').forEach(card=>{
      if(card.querySelector('[data-view-test],[data-view-any-test]'))return;
      const edit=card.querySelector('.edit-btn');
      const id=editId(edit);
      if(!edit||!id)return;
      const review=document.createElement('button');
      review.type='button';review.className='review-btn';review.dataset.viewAnyTest=id;review.textContent='確認';
      let actions=edit.closest('.card-action-row');
      if(actions){actions.insertBefore(review,edit);return;}
      actions=document.createElement('div');actions.className='card-action-row';
      edit.replaceWith(actions);actions.append(review,edit);
    });
  }

  document.addEventListener('click',e=>{
    const b=e.target.closest?.('[data-view-any-test]');
    if(b)openReview(b.dataset.viewAnyTest);
  });

  if(typeof renderTests==='function'){
    const base=renderTests;
    renderTests=function(){base();enhanceReviewButtons();};
  }

  // すでに一覧が描画済みの場合にも対応
  queueMicrotask(enhanceReviewButtons);
})();
