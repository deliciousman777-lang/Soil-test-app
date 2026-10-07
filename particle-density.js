// 土粒子の密度試験 JIS A 1202:2020 / JGS 0111-2020
// 会社の実作業に合わせて、入力は「ピクノメーターNo.・mb・T1・ms」のみ。
(function () {
  const TYPE = 'particleDensity';
  const COUNT = 3;

  // 会社ソフト/JISデータシートで使用している蒸留水密度表に合わせる。
  // 整数温度は表値、少数温度は隣接表値を線形補間して5桁に丸める。
  const WATER_DENSITY = {
    15: 0.99910, 16: 0.99894, 17: 0.99877, 18: 0.99859, 19: 0.99840,
    20: 0.99820, 21: 0.99799, 22: 0.99777, 23: 0.99754, 24: 0.99730,
    25: 0.99704, 26: 0.99678, 27: 0.99651, 28: 0.99623, 29: 0.99594,
    30: 0.99565, 31: 0.99534, 32: 0.99503, 33: 0.99470, 34: 0.99437,
    35: 0.99403
  };

  function rhoWater(temp) {
    const T = Number(temp);
    if (!Number.isFinite(T) || T < 15 || T > 35) return null;
    const lo = Math.floor(T);
    const hi = Math.ceil(T);
    if (lo === hi) return WATER_DENSITY[lo] ?? null;
    const a = WATER_DENSITY[lo];
    const b = WATER_DENSITY[hi];
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    const v = a + (b - a) * (T - lo);
    return Math.round(v * 100000) / 100000;
  }

  function num(v) {
    const s = String(v ?? '').trim();
    if (s === '') return null;
    const x = Number(s);
    return Number.isFinite(x) ? x : null;
  }

  function masterFor(no) {
    const key = Number(String(no ?? '').trim().replace(/^0+/, '') || '0');
    return window.PYCNOMETER_MASTER?.[key] || null;
  }

  function injectUI() {
    const actions = document.querySelector('#detailView .test-actions');
    if (actions && !document.getElementById('addParticleDensityBtn')) {
      const btn = document.createElement('button');
      btn.id = 'addParticleDensityBtn';
      btn.type = 'button';
      btn.className = 'primary secondary';
      btn.textContent = '＋ 土粒子密度';
      actions.appendChild(btn);
      btn.addEventListener('click', openNew);
    }

    if (document.getElementById('particleDensityDialog')) return;
    const dialog = document.createElement('dialog');
    dialog.id = 'particleDensityDialog';
    dialog.className = 'wide-dialog';
    dialog.innerHTML = `
      <form id="particleDensityForm" method="dialog">
        <div class="dialog-head">
          <div><p class="eyebrow">JIS A 1202 / JGS 0111</p><h2 id="particleDensityTitle">土粒子の密度試験</h2></div>
          <button type="button" class="icon-btn" id="particleDensityClose">×</button>
        </div>
        <label>試料名 / No.<input name="sample" required autocomplete="off" placeholder="例：現場発生土" /></label>
        <p class="hint">各測定は ①ピクノメーターNo. → ②mb → ③温度 → ④ms の順に入力。登録済みの瓶質量・水＋瓶質量・登録温度は自動で呼び出します。</p>
        <div id="particleDensityRows" class="pd-list"></div>
        <div id="particleDensityAverage" class="result-box">平均土粒子密度：— Mg/m³</div>
        <div id="particleDensityCheck" class="mass-check">3測定の値を入力してください。</div>
        <div class="dialog-actions"><button type="button" class="ghost" id="particleDensityCancel">キャンセル</button><button id="particleDensitySubmit" class="primary" value="default">保存</button></div>
      </form>`;
    document.body.appendChild(dialog);

    const rows = dialog.querySelector('#particleDensityRows');
    rows.innerHTML = Array.from({length: COUNT}, (_, j) => {
      const i = j + 1;
      return `
        <section class="specimen-card pd-card">
          <div class="specimen-head"><strong>測定 ${i}</strong><span id="pdRho_${i}">ρₛ —</span></div>

          <label>① ピクノメーター No.
            <input name="pycNo_${i}" inputmode="numeric" autocomplete="off" placeholder="1〜99" />
          </label>
          <input type="hidden" name="mf_${i}">
          <input type="hidden" name="ma2_${i}">
          <input type="hidden" name="t2_${i}">

          <div class="pd-auto-grid">
            <div><span>ピクノメーター質量 m<sub>f</sub></span><strong id="pdMf_${i}">— g</strong></div>
            <div><span>登録 m<sub>a</sub>(T₂)</span><strong id="pdMa2_${i}">— g</strong></div>
            <div><span>登録温度 T₂</span><strong id="pdT2_${i}">— ℃</strong></div>
            <div><span>炉乾燥容器 No.</span><strong id="pdContainerNo_${i}">—</strong></div>
            <div><span>容器質量</span><strong id="pdContainerMass_${i}">— g</strong></div>
          </div>

          <div class="pd-input-grid">
            <label>② (試料＋蒸留水＋ピクノメーター)質量 m<sub>b</sub> (g)
              <input name="mb1_${i}" inputmode="decimal" placeholder="例：179.066" />
            </label>
            <label>③ m<sub>b</sub>測定時の温度 T (℃)
              <input name="t1_${i}" inputmode="decimal" placeholder="例：22.0" />
            </label>
            <label>④ 試料の炉乾燥質量 m<sub>s</sub> (g)
              <input name="ms_${i}" inputmode="decimal" placeholder="例：25.674" />
            </label>
          </div>

          <div class="pd-result-grid">
            <div><span>蒸留水の密度 ρ<sub>w</sub>(T)</span><strong id="pdRhoW1_${i}">—</strong></div>
            <div><span>T℃における m<sub>a</sub></span><strong id="pdMa1_${i}">— g</strong></div>
            <div class="pd-result-main"><span>土粒子の密度 ρ<sub>s</sub></span><strong id="pdRhoResult_${i}">— Mg/m³</strong></div>
          </div>
        </section>`;
    }).join('');

    if (!document.getElementById('particleDensityStyles')) {
      const style = document.createElement('style');
      style.id = 'particleDensityStyles';
      style.textContent = `
        .pd-list{display:grid;gap:16px;margin-top:14px}.pd-auto-grid,.pd-result-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:10px 0}.pd-input-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:12px 0}.pd-auto-grid>div,.pd-result-grid>div{border:1px solid var(--line);border-radius:12px;background:#f3f8f6;padding:10px}.pd-auto-grid span,.pd-result-grid span{display:block;color:var(--muted);font-size:11px;margin-bottom:4px}.pd-auto-grid strong,.pd-result-grid strong{color:var(--accent-dark);font-size:16px}.pd-result-grid{grid-template-columns:1fr 1fr 1.2fr}.pd-result-main{background:#e8f4ef!important;border-color:#a9cdbc!important}.pd-result-main strong{font-size:20px!important}.pd-card .specimen-head span{font-weight:800;color:var(--accent-dark)}
        @media(max-width:800px){.pd-auto-grid{grid-template-columns:1fr 1fr}.pd-input-grid,.pd-result-grid{grid-template-columns:1fr}}
      `;
      document.head.appendChild(style);
    }

    const form = dialog.querySelector('#particleDensityForm');
    form.addEventListener('input', updatePreview);
    form.addEventListener('change', updatePreview);
    form.addEventListener('submit', saveParticleDensity);
    dialog.querySelector('#particleDensityClose').addEventListener('click', () => dialog.close());
    dialog.querySelector('#particleDensityCancel').addEventListener('click', () => dialog.close());
  }

  function formEl() { return document.getElementById('particleDensityForm'); }
  function dialogEl() { return document.getElementById('particleDensityDialog'); }

  function calcOne(i) {
    const f = formEl();
    const pycNo = f.elements[`pycNo_${i}`].value.trim();
    const master = masterFor(pycNo);

    const mf = master?.mf ?? num(f.elements[`mf_${i}`].value);
    const ma2 = master?.ma2 ?? num(f.elements[`ma2_${i}`].value);
    const t2 = master?.t2 ?? num(f.elements[`t2_${i}`].value);
    const mb1 = num(f.elements[`mb1_${i}`].value);
    const t1 = num(f.elements[`t1_${i}`].value);
    const ms = num(f.elements[`ms_${i}`].value);

    const entered = pycNo !== '' || mb1 !== null || t1 !== null || ms !== null;
    if (!entered) return { entered:false, valid:false };
    if (!master || mb1 === null || t1 === null || ms === null || ms <= 0) {
      return { entered:true, valid:false, pycnometerNo:pycNo, mf, ma2, t2, mb1, t1, ms };
    }

    const rw1 = rhoWater(t1);
    const rw2 = rhoWater(t2);
    if (!rw1 || !rw2 || ma2 <= mf) {
      return { entered:true, valid:false, pycnometerNo:pycNo, mf, ma2, t2, mb1, t1, ms };
    }

    const ma1 = (rw1 / rw2) * (ma2 - mf) + mf;
    const denom = ms + ma1 - mb1;
    if (!Number.isFinite(denom) || denom <= 0) {
      return { entered:true, valid:false, pycnometerNo:pycNo, mf, ma2, t2, mb1, t1, ms, rhoW1:rw1, rhoW2:rw2, ma1 };
    }

    const rhoS = (ms / denom) * rw1;
    if (!Number.isFinite(rhoS) || rhoS <= 0 || rhoS > 5) {
      return { entered:true, valid:false, pycnometerNo:pycNo, mf, ma2, t2, mb1, t1, ms, rhoW1:rw1, rhoW2:rw2, ma1 };
    }

    return {
      entered:true, valid:true,
      pycnometerNo:pycNo,
      mf, ma2, t2, rhoW2:rw2,
      mb1, t1, rhoW1:rw1, ma1,
      containerNo:pycNo,
      containerMass:mf,
      ms,
      rhoS
    };
  }

  function updatePreview() {
    const results = [];
    for (let i=1; i<=COUNT; i++) {
      const r = calcOne(i);
      const set = (id, text) => { const el=document.getElementById(id); if(el) el.textContent=text; };
      set(`pdMf_${i}`, Number.isFinite(r.mf) ? `${r.mf.toFixed(4)} g` : '— g');
      set(`pdMa2_${i}`, Number.isFinite(r.ma2) ? `${r.ma2.toFixed(4)} g` : '— g');
      set(`pdT2_${i}`, Number.isFinite(r.t2) ? `${r.t2.toFixed(1)} ℃` : '— ℃');
      set(`pdContainerNo_${i}`, r.pycnometerNo || '—');
      set(`pdContainerMass_${i}`, Number.isFinite(r.mf) ? `${r.mf.toFixed(4)} g` : '— g');
      set(`pdRhoW1_${i}`, Number.isFinite(r.rhoW1) ? r.rhoW1.toFixed(5) : '—');
      set(`pdMa1_${i}`, Number.isFinite(r.ma1) ? `${r.ma1.toFixed(3)} g` : '— g');
      set(`pdRho_${i}`, r.valid ? `ρₛ ${r.rhoS.toFixed(3)} Mg/m³` : 'ρₛ —');
      set(`pdRhoResult_${i}`, r.valid ? `${r.rhoS.toFixed(3)} Mg/m³` : '— Mg/m³');
      if (r.valid) results.push(r);
    }

    const avgEl=document.getElementById('particleDensityAverage');
    const check=document.getElementById('particleDensityCheck');
    if (results.length===COUNT) {
      const avg=results.reduce((s,r)=>s+r.rhoS,0)/COUNT;
      const vals=results.map(r=>r.rhoS);
      const spread=Math.max(...vals)-Math.min(...vals);
      avgEl.textContent=`平均土粒子密度：${avg.toFixed(3)} Mg/m³`;
      check.classList.toggle('error', spread>0.020);
      check.textContent=spread<=0.020
        ? `3測定計算済み ｜ 最大値－最小値 = ${spread.toFixed(3)} ≤ 0.020`
        : `⚠ 最大値－最小値 = ${spread.toFixed(3)} > 0.020。測定値を確認してください。`;
    } else {
      avgEl.textContent='平均土粒子密度：— Mg/m³';
      const invalidEntered=Array.from({length:COUNT},(_,j)=>calcOne(j+1)).some(r=>r.entered&&!r.valid);
      check.classList.toggle('error',invalidEntered);
      check.textContent=invalidEntered?'⚠ No.・mb・温度・msを確認してください。':`計算済み ${results.length}/3 測定`;
    }
  }

  function resetForm() {
    state.editingTestId=null;
    const f=formEl();
    f.reset();
    document.getElementById('particleDensityTitle').textContent='土粒子の密度試験';
    document.getElementById('particleDensitySubmit').textContent='保存';
    updatePreview();
  }

  function openNew() {
    resetForm();
    dialogEl().showModal();
  }

  function openEdit(testId) {
    const p=currentProject();
    const test=p?.tests.find(t=>t.id===testId&&t.type===TYPE);
    if(!test) return;
    state.editingTestId=testId;
    const f=formEl();
    f.reset();
    f.elements.sample.value=test.sample||'';
    (test.measurements||[]).slice(0,COUNT).forEach((r,j)=>{
      const i=j+1;
      f.elements[`pycNo_${i}`].value=r.pycnometerNo||r.containerNo||'';
      f.elements[`mb1_${i}`].value=r.mb1??'';
      f.elements[`t1_${i}`].value=r.t1??'';
      const legacyMs=Number.isFinite(Number(r.ms))?Number(r.ms):((Number(r.dryWithContainer)||0)-(Number(r.containerMass)||0));
      f.elements[`ms_${i}`].value=legacyMs>0?legacyMs:'';
    });
    document.getElementById('particleDensityTitle').textContent='土粒子の密度試験を訂正';
    document.getElementById('particleDensitySubmit').textContent='訂正を保存';
    updatePreview();
    dialogEl().showModal();
  }

  function saveParticleDensity(e) {
    e.preventDefault();
    const f=formEl();
    const sample=f.elements.sample.value.trim();
    if(!sample) return;
    const measurements=Array.from({length:COUNT},(_,j)=>calcOne(j+1));
    if(measurements.some(r=>!r.valid)) {
      alert('3測定すべての「ピクノメーターNo.・mb・温度・ms」を確認してください。');
      return;
    }
    const avg=measurements.reduce((s,r)=>s+r.rhoS,0)/COUNT;
    const p=currentProject();
    if(!p) return;
    const now=new Date().toISOString();
    const payload={sample,measurements,particleDensityAverage:avg};
    if(state.editingTestId){
      const test=p.tests.find(t=>t.id===state.editingTestId&&t.type===TYPE);
      if(!test) return;
      Object.assign(test,payload,{updatedAt:now});
    }else{
      p.tests.push({id:uid(),type:TYPE,...payload,createdAt:now});
    }
    p.updatedAt=now;
    saveData();
    dialogEl().close();
    resetForm();
    renderTests();
  }

  function renderCard(test) {
    const rows=(test.measurements||[]).map((r,i)=>`<div class="measurement-row"><strong>測定 ${i+1}</strong><span>Pycnometer ${escapeHtml(r.pycnometerNo||'—')}</span><span>${Number(r.rhoS).toFixed(3)} Mg/m³</span></div>`).join('');
    const avg=Number(test.particleDensityAverage);
    return `<div class="card-title-row"><div><p class="test-kind">土粒子の密度試験</p><h3>${escapeHtml(test.sample)}</h3><p>${new Date(test.createdAt).toLocaleString('ja-JP')}${test.updatedAt?' ｜ 訂正済み':''}</p></div><button type="button" class="edit-btn" data-edit-pd="${escapeHtml(test.id)}">訂正</button></div><div class="value">${Number.isFinite(avg)?avg.toFixed(3):'—'} Mg/m³ <small>平均</small></div><div class="measurement-summary">${rows}</div>`;
  }

  const baseRenderMoistureCard=renderMoistureCard;
  renderMoistureCard=function(test){
    if(test?.type===TYPE) return renderCard(test);
    return baseRenderMoistureCard(test);
  };

  const baseRenderTests=renderTests;
  renderTests=function(){
    baseRenderTests();
    document.querySelectorAll('[data-edit-pd]').forEach(btn=>btn.addEventListener('click',()=>openEdit(btn.dataset.editPd)));
  };

  injectUI();
})();