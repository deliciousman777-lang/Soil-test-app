// 配合試験の「確認」画面を人が読める形式で表示する
(function(){
  'use strict';

  const TYPE = 'mix-design';
  const SPECIMEN_LABELS = {
    unconfined: '一軸圧縮試験',
    cone: 'コーン指数試験',
    cbr: 'CBR試験',
  };

  const finite = value => Number.isFinite(Number(value));
  const esc = value => typeof escapeHtml === 'function'
    ? escapeHtml(value)
    : String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const num = (value, digits = 1) => finite(value) ? Number(value).toFixed(digits) : '—';
  const int = value => finite(value) ? Number(value).toFixed(0) : '—';
  const dateOnly = value => {
    if (!value) return '—';
    const d = new Date(`${String(value).slice(0,10)}T00:00:00`);
    return Number.isNaN(d.getTime()) ? esc(value) : d.toLocaleDateString('ja-JP');
  };
  const dateTime = value => {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('ja-JP');
  };

  function meta(test){
    return `<p class="review-meta">試料：${esc(test.sample || '—')} ｜ 登録：${dateTime(test.createdAt)}${test.updatedAt ? ` ｜ 最終訂正：${dateTime(test.updatedAt)}` : ''}</p>`;
  }

  function moistureRows(test){
    const rows = Array.isArray(test.naturalWaterMeasurements) ? test.naturalWaterMeasurements : [];
    return rows.map((m, i) => `
      <tr>
        <th>測定 ${i + 1}</th>
        <td>${esc(m.containerNo || '—')}</td>
        <td>${num(m.wetMass, 2)} g</td>
        <td>${num(m.dryMass, 2)} g</td>
        <td>${num(m.containerMass, 2)} g</td>
        <td><strong>${num(m.moisture, 1)} %</strong></td>
      </tr>`).join('');
  }

  function additionRows(test){
    const rows = Array.isArray(test.additions) ? test.additions : [];
    return rows.map((row, i) => `
      <tr>
        <th>パターン ${i + 1}</th>
        <td><strong>${int(row.dosage)} kg/m³</strong></td>
        <td>${num(row.cementMass, 1)} g</td>
      </tr>`).join('');
  }

  function html(test){
    const curing = test.curing || {};
    const specimen = SPECIMEN_LABELS[test.specimenType] || test.specimenType || '—';
    const prep = test.preparationMethodLabel || test.preparationMethod || '—';
    const moisture = moistureRows(test);
    const additions = additionRows(test);
    const moistureCount = Array.isArray(test.naturalWaterMeasurements) ? test.naturalWaterMeasurements.length : 0;

    return `${meta(test)}
      <div class="review-summary">
        <div><span>自然含水比 wn</span><strong>${num(test.naturalWaterContent, 1)} %</strong><small>${moistureCount ? `${moistureCount}点平均` : ''}</small></div>
        <div><span>湿潤密度 ρt</span><strong>${num(test.wetDensity, 3)}</strong><small>g/cm³</small></div>
        <div><span>供試体</span><strong style="font-size:16px">${esc(specimen)}</strong></div>
      </div>

      <section class="review-section">
        <h3>基本条件</h3>
        <div class="table-wrap"><table class="review-table"><tbody>
          <tr><th>使用セメント</th><td>${esc(test.cementName || '—')}</td><th>供試体種別</th><td>${esc(specimen)}</td></tr>
          <tr><th>供試体作製日</th><td>${dateOnly(test.specimenDate)}</td><th>圧縮日 / 試験日</th><td>${dateOnly(test.compressionDate)}</td></tr>
          <tr><th>供試体作製条件</th><td colspan="3" style="text-align:left;white-space:normal">${esc(prep)}</td></tr>
          <tr><th>養生</th><td colspan="3" style="text-align:left;white-space:normal">空気養生 ${int(curing.airDays)} 日 ｜ 水浸養生 ${int(curing.waterDays)} 日${finite(curing.totalEnteredDays) ? ` ｜ 合計 ${int(curing.totalEnteredDays)} 日` : ''}</td></tr>
        </tbody></table></div>
      </section>

      <section class="review-section">
        <h3>自然含水比</h3>
        <div class="table-wrap"><table class="review-table">
          <thead><tr><th>測定</th><th>容器No.</th><th>容器＋湿潤土</th><th>容器＋乾燥土</th><th>容器質量</th><th>含水比</th></tr></thead>
          <tbody>${moisture || '<tr><td colspan="6">保存された測定値がありません</td></tr>'}</tbody>
        </table></div>
      </section>

      <section class="review-section">
        <h3>湿潤密度</h3>
        <div class="table-wrap"><table class="review-table"><tbody>
          <tr><th>モールド質量</th><td>${num(test.moldMass, 1)} g</td><th>モールド＋土質量</th><td>${num(test.moldSoilMass, 1)} g</td></tr>
          <tr><th>土の質量</th><td>${num(test.soilMass, 1)} g</td><th>モールド体積</th><td>${num(test.moldVolume, 1)} cm³</td></tr>
          <tr><th>湿潤密度 ρt</th><td colspan="3"><strong>${num(test.wetDensity, 3)} g/cm³</strong></td></tr>
        </tbody></table></div>
      </section>

      <section class="review-section">
        <h3>配合作製量</h3>
        <div class="table-wrap"><table class="review-table"><tbody>
          <tr><th>使用土量</th><td><strong>${num(test.batchSoilMass, 0)} g</strong></td><th>配合作製体積</th><td><strong>${num(test.batchVolume, 1)} cm³</strong></td></tr>
        </tbody></table></div>
      </section>

      <section class="review-section">
        <h3>添加量</h3>
        <div class="table-wrap"><table class="review-table">
          <thead><tr><th>配合</th><th>添加量</th><th>必要セメント量</th></tr></thead>
          <tbody>${additions || '<tr><td colspan="3">保存された添加量がありません</td></tr>'}</tbody>
        </table></div>
      </section>

      <div class="review-note">この画面は確認専用です。数値を直す場合は「訂正」から変更します。</div>`;
  }

  // review-all-tests.js の汎用表示より先に配合試験だけ専用表示で処理する。
  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-view-any-test]');
    if (!button) return;
    const project = currentProject?.();
    const test = project?.tests?.find(row => row.id === button.dataset.viewAnyTest);
    if (!test || test.type !== TYPE) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const dialog = document.getElementById('testReviewDialog');
    const title = document.getElementById('testReviewTitle');
    const body = document.getElementById('testReviewBody');
    if (!dialog || !title || !body) return;

    title.textContent = '配合試験・詳細確認';
    body.innerHTML = html(test);
    dialog.showModal();
  }, true);
})();
