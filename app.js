const STORAGE_KEY = 'soil-test-app-v1';
const SIEVES = [53, 37.5, 26.5, 19, 9.5, 4.75, 2, 0.85, 0.425, 0.25, 0.106, 0.075];

const state = {
  data: loadData(),
  currentProjectId: null,
  editingTestId: null,
};

const projectView = document.getElementById('projectView');
const detailView = document.getElementById('detailView');
const projectList = document.getElementById('projectList');
const emptyProjects = document.getElementById('emptyProjects');
const testList = document.getElementById('testList');
const emptyTests = document.getElementById('emptyTests');
const projectDialog = document.getElementById('projectDialog');
const moistureDialog = document.getElementById('moistureDialog');
const grainDialog = document.getElementById('grainDialog');
const projectForm = document.getElementById('projectForm');
const moistureForm = document.getElementById('moistureForm');
const grainForm = document.getElementById('grainForm');
const moistureDialogTitle = document.getElementById('moistureDialogTitle');
const moistureSubmitBtn = document.getElementById('moistureSubmitBtn');
const grainDialogTitle = document.getElementById('grainDialogTitle');
const grainSubmitBtn = document.getElementById('grainSubmitBtn');

function loadData() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return parsed && Array.isArray(parsed.projects) ? parsed : { projects: [] };
  } catch {
    return { projects: [] };
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[ch]));
}

function format(n, digits = 3) {
  return Number(n).toLocaleString('ja-JP', { maximumFractionDigits: digits });
}

function fieldKey(size) {
  return String(size).replace('.', '_');
}

function renderProjects() {
  projectList.innerHTML = '';
  const projects = [...state.data.projects].sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
  emptyProjects.classList.toggle('hidden', projects.length > 0);

  projects.forEach(project => {
    const btn = document.createElement('button');
    btn.className = 'card card-button';
    btn.innerHTML = `
      <h3>${escapeHtml(project.name)}</h3>
      <p>${escapeHtml(project.location || '場所未入力')}</p>
      <div class="meta"><span>試験 ${project.tests.length}件</span><span>${new Date(project.updatedAt).toLocaleDateString('ja-JP')}</span></div>
    `;
    btn.addEventListener('click', () => openProject(project.id));
    projectList.appendChild(btn);
  });
}

function currentProject() {
  return state.data.projects.find(p => p.id === state.currentProjectId);
}

function openProject(id) {
  state.currentProjectId = id;
  const p = currentProject();
  if (!p) return;
  document.getElementById('projectTitle').textContent = p.name;
  document.getElementById('projectMeta').textContent = [p.location, p.client].filter(Boolean).join(' ｜ ') || '詳細未入力';
  projectView.classList.add('hidden');
  detailView.classList.remove('hidden');
  renderTests();
}

function closeProject() {
  state.currentProjectId = null;
  detailView.classList.add('hidden');
  projectView.classList.remove('hidden');
  renderProjects();
}

function testMeasurements(test) {
  if (Array.isArray(test.measurements) && test.measurements.length) return test.measurements;
  if (test.containerMass != null && test.wetMass != null && test.dryMass != null) {
    return [{
      containerNo: test.containerNo || '',
      containerMass: Number(test.containerMass),
      wetMass: Number(test.wetMass),
      dryMass: Number(test.dryMass),
      moisture: Number(test.moisture),
    }];
  }
  return [];
}

function averageForTest(test) {
  if (Number.isFinite(Number(test.moistureAverage))) return Number(test.moistureAverage);
  const values = testMeasurements(test).map(m => Number(m.moisture)).filter(Number.isFinite);
  if (values.length) return values.reduce((a,b) => a + b, 0) / values.length;
  return Number(test.moisture) || 0;
}

function renderMoistureCard(test) {
  const measurements = testMeasurements(test);
  const rows = measurements.map((m, index) => `
    <div class="measurement-row">
      <strong>${measurements.length === 1 ? '測定' : `測定 ${index + 1}`}</strong>
      <span>容器 ${escapeHtml(m.containerNo || '—')}</span>
      <span>${Number(m.moisture).toFixed(1)} %</span>
    </div>
  `).join('');

  return `
    <div class="card-title-row">
      <div>
        <p class="test-kind">含水比試験</p>
        <h3>${escapeHtml(test.sample)}</h3>
        <p>${new Date(test.createdAt).toLocaleString('ja-JP')}${test.updatedAt ? ' ｜ 訂正済み' : ''}</p>
      </div>
      <button type="button" class="edit-btn" data-edit-moisture="${escapeHtml(test.id)}">訂正</button>
    </div>
    <div class="value">${averageForTest(test).toFixed(1)} % <small>平均</small></div>
    <div class="measurement-summary">${rows}</div>
  `;
}

function grainFractions(test) {
  if (test.fractions) return test.fractions;
  return { gravel: 0, sand: 0, fines: 0 };
}

function renderGrainCard(test) {
  const f = grainFractions(test);
  return `
    <div class="card-title-row">
      <div>
        <p class="test-kind">粒度試験・ふるい分析</p>
        <h3>${escapeHtml(test.sample)}</h3>
        <p>${new Date(test.createdAt).toLocaleString('ja-JP')}${test.updatedAt ? ' ｜ 訂正済み' : ''}</p>
      </div>
      <button type="button" class="edit-btn" data-edit-grain="${escapeHtml(test.id)}">訂正</button>
    </div>
    <div class="fraction-card-row">
      <div><span>礫分</span><strong>${Number(f.gravel).toFixed(1)} %</strong></div>
      <div><span>砂分</span><strong>${Number(f.sand).toFixed(1)} %</strong></div>
      <div><span>細粒分</span><strong>${Number(f.fines).toFixed(1)} %</strong></div>
    </div>
    <div class="meta"><span>乾燥試料 ${format(test.totalDryMass)} g</span><span>ふるい分析</span></div>
  `;
}

function renderTests() {
  const p = currentProject();
  if (!p) return;
  testList.innerHTML = '';
  const tests = [...p.tests].sort((a,b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));
  emptyTests.classList.toggle('hidden', tests.length > 0);

  tests.forEach(test => {
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = test.type === 'grain' ? renderGrainCard(test) : renderMoistureCard(test);
    testList.appendChild(card);
  });

  testList.querySelectorAll('[data-edit-moisture]').forEach(btn => {
    btn.addEventListener('click', () => openEditMoisture(btn.dataset.editMoisture));
  });
  testList.querySelectorAll('[data-edit-grain]').forEach(btn => {
    btn.addEventListener('click', () => openEditGrain(btn.dataset.editGrain));
  });
}

function readMeasurement(index) {
  const cRaw = moistureForm.elements[`containerMass${index}`].value.trim();
  const wetRaw = moistureForm.elements[`wetMass${index}`].value.trim();
  const dryRaw = moistureForm.elements[`dryMass${index}`].value.trim();
  if (!cRaw || !wetRaw || !dryRaw) return null;

  const c = Number(cRaw);
  const wet = Number(wetRaw);
  const dry = Number(dryRaw);
  const water = wet - dry;
  const drySoil = dry - c;
  if (![c, wet, dry].every(Number.isFinite) || drySoil <= 0 || water < 0) return null;

  return {
    containerNo: moistureForm.elements[`containerNo${index}`].value.trim(),
    containerMass: c,
    wetMass: wet,
    dryMass: dry,
    moisture: (water / drySoil) * 100,
  };
}

function getAllMeasurements() {
  const measurements = [1,2,3].map(readMeasurement);
  return measurements.every(Boolean) ? measurements : null;
}

function updateMoisturePreview() {
  const values = [];
  [1,2,3].forEach(index => {
    const m = readMeasurement(index);
    const el = document.getElementById(`moisture${index}`);
    if (m) {
      values.push(m.moisture);
      el.textContent = `${m.moisture.toFixed(1)} %`;
    } else {
      el.textContent = '— %';
    }
  });

  const preview = document.getElementById('moisturePreview');
  if (values.length === 3) {
    const average = values.reduce((a,b) => a + b, 0) / 3;
    preview.textContent = `平均含水比：${average.toFixed(1)} %`;
  } else {
    preview.textContent = '平均含水比：—';
  }
}

function resetMoistureDialog() {
  state.editingTestId = null;
  moistureForm.reset();
  moistureDialogTitle.textContent = '含水比試験';
  moistureSubmitBtn.textContent = '保存';
  updateMoisturePreview();
}

function openEditMoisture(testId) {
  const p = currentProject();
  const test = p?.tests.find(t => t.id === testId);
  if (!test) return;

  state.editingTestId = testId;
  moistureForm.reset();
  moistureDialogTitle.textContent = '含水比試験を訂正';
  moistureSubmitBtn.textContent = '訂正を保存';
  moistureForm.elements.sample.value = test.sample || '';

  const measurements = testMeasurements(test);
  measurements.slice(0, 3).forEach((m, i) => {
    const index = i + 1;
    moistureForm.elements[`containerNo${index}`].value = m.containerNo || '';
    moistureForm.elements[`containerMass${index}`].value = m.containerMass ?? '';
    moistureForm.elements[`wetMass${index}`].value = m.wetMass ?? '';
    moistureForm.elements[`dryMass${index}`].value = m.dryMass ?? '';
  });

  updateMoisturePreview();
  moistureDialog.showModal();
}

function buildGrainRows() {
  const body = document.getElementById('grainRows');
  body.innerHTML = SIEVES.map(size => {
    const key = fieldKey(size);
    const isBoundary = size === 2 || size === 0.075;
    return `
      <tr class="${isBoundary ? 'boundary-row' : ''}">
        <th>${size} mm${isBoundary ? '<small>区分境界</small>' : ''}</th>
        <td>
          <div class="table-voice-input">
            <input name="retained_${key}" inputmode="decimal" placeholder="0.00" aria-label="${size} mm 残留質量" />
            <button type="button" class="mic mini" data-voice="retained_${key}" data-form="grainForm" aria-label="音声入力">🎤</button>
          </div>
        </td>
        <td id="cum_${key}">—</td>
        <td id="pass_${key}">—</td>
      </tr>
    `;
  }).join('');
}

function calculateGrain() {
  const totalRaw = grainForm.elements.totalDryMass.value.trim();
  const total = Number(totalRaw);
  if (!totalRaw || !Number.isFinite(total) || total <= 0) return { valid: false, reason: 'total' };

  let cumulative = 0;
  let invalid = false;
  const sieves = SIEVES.map(size => {
    const key = fieldKey(size);
    const raw = grainForm.elements[`retained_${key}`].value.trim();
    let retained = null;
    if (raw !== '') {
      retained = Number(raw);
      if (!Number.isFinite(retained) || retained < 0) invalid = true;
    }
    if (retained != null && Number.isFinite(retained)) cumulative += retained;
    return {
      size,
      retained,
      cumulative: retained == null ? null : cumulative,
      passing: retained == null ? null : 100 - (cumulative / total) * 100,
    };
  });

  if (invalid) return { valid: false, reason: 'value' };
  const retainedTotal = sieves.reduce((sum, row) => sum + (row.retained ?? 0), 0);
  const remainder = total - retainedTotal;
  if (remainder < -0.000001) return { valid: false, reason: 'over', total, retainedTotal, remainder, sieves };

  const row2 = sieves.find(row => row.size === 2);
  const row075 = sieves.find(row => row.size === 0.075);
  const boundariesReady = row2?.retained != null && row075?.retained != null;
  let fractions = null;
  if (boundariesReady) {
    const pass2 = row2.passing;
    const pass075 = row075.passing;
    fractions = {
      gravel: 100 - pass2,
      sand: pass2 - pass075,
      fines: pass075,
    };
  }

  return { valid: true, total, retainedTotal, remainder: Math.max(0, remainder), sieves, fractions, boundariesReady };
}

function updateGrainPreview() {
  const result = calculateGrain();
  const massCheck = document.getElementById('grainMassCheck');
  massCheck.classList.remove('error');

  SIEVES.forEach(size => {
    const key = fieldKey(size);
    document.getElementById(`cum_${key}`).textContent = '—';
    document.getElementById(`pass_${key}`).textContent = '—';
  });
  document.getElementById('gravelPct').textContent = '— %';
  document.getElementById('sandPct').textContent = '— %';
  document.getElementById('finesPct').textContent = '— %';

  if (!result.valid) {
    if (result.reason === 'over') {
      massCheck.textContent = `⚠ 残留質量合計 ${format(result.retainedTotal)} g が乾燥試料質量 ${format(result.total)} g を超えています。`;
      massCheck.classList.add('error');
    } else {
      massCheck.textContent = '乾燥試料質量と残留質量を入力すると計算します。';
    }
    return;
  }

  result.sieves.forEach(row => {
    if (row.retained == null) return;
    const key = fieldKey(row.size);
    document.getElementById(`cum_${key}`).textContent = format(row.cumulative);
    document.getElementById(`pass_${key}`).textContent = `${row.passing.toFixed(1)}`;
  });

  massCheck.textContent = `ふるい残留合計 ${format(result.retainedTotal)} g ｜ 0.075 mm未満（差引） ${format(result.remainder)} g`;
  if (result.fractions) {
    document.getElementById('gravelPct').textContent = `${result.fractions.gravel.toFixed(1)} %`;
    document.getElementById('sandPct').textContent = `${result.fractions.sand.toFixed(1)} %`;
    document.getElementById('finesPct').textContent = `${result.fractions.fines.toFixed(1)} %`;
  }
}

function resetGrainDialog() {
  state.editingTestId = null;
  grainForm.reset();
  grainDialogTitle.textContent = '粒度試験（ふるい分析）';
  grainSubmitBtn.textContent = '保存';
  updateGrainPreview();
}

function openEditGrain(testId) {
  const p = currentProject();
  const test = p?.tests.find(t => t.id === testId && t.type === 'grain');
  if (!test) return;

  state.editingTestId = testId;
  grainForm.reset();
  grainDialogTitle.textContent = '粒度試験を訂正';
  grainSubmitBtn.textContent = '訂正を保存';
  grainForm.elements.sample.value = test.sample || '';
  grainForm.elements.totalDryMass.value = test.totalDryMass ?? '';

  (test.sieves || []).forEach(row => {
    const el = grainForm.elements[`retained_${fieldKey(row.size)}`];
    if (el && row.retained != null) el.value = row.retained;
  });
  updateGrainPreview();
  grainDialog.showModal();
}

projectForm.addEventListener('submit', e => {
  e.preventDefault();
  const fd = new FormData(projectForm);
  const now = new Date().toISOString();
  const project = {
    id: uid(),
    name: String(fd.get('name')).trim(),
    location: String(fd.get('location')).trim(),
    client: String(fd.get('client')).trim(),
    tests: [],
    createdAt: now,
    updatedAt: now,
  };
  if (!project.name) return;
  state.data.projects.push(project);
  saveData();
  projectForm.reset();
  projectDialog.close();
  renderProjects();
  openProject(project.id);
});

moistureForm.addEventListener('input', updateMoisturePreview);
moistureForm.addEventListener('submit', e => {
  e.preventDefault();
  const measurements = getAllMeasurements();
  if (!measurements) {
    alert('3測定すべての質量を確認してください。各測定で「湿潤質量 ≥ 乾燥質量 > 容器質量」になるよう入力してください。');
    return;
  }

  const p = currentProject();
  if (!p) return;
  const sample = moistureForm.elements.sample.value.trim();
  if (!sample) return;

  const average = measurements.reduce((sum, m) => sum + m.moisture, 0) / measurements.length;
  const now = new Date().toISOString();

  if (state.editingTestId) {
    const test = p.tests.find(t => t.id === state.editingTestId);
    if (!test) return;
    test.sample = sample;
    test.measurements = measurements;
    test.moistureAverage = average;
    test.updatedAt = now;
    delete test.containerNo;
    delete test.containerMass;
    delete test.wetMass;
    delete test.dryMass;
    delete test.moisture;
  } else {
    p.tests.push({
      id: uid(),
      type: 'moisture',
      sample,
      measurements,
      moistureAverage: average,
      createdAt: now,
    });
  }

  p.updatedAt = now;
  saveData();
  resetMoistureDialog();
  moistureDialog.close();
  renderTests();
});

grainForm.addEventListener('input', updateGrainPreview);
grainForm.addEventListener('submit', e => {
  e.preventDefault();
  const result = calculateGrain();
  if (!result.valid) {
    const message = result.reason === 'over'
      ? '残留質量の合計が乾燥試料質量を超えています。入力値を確認してください。'
      : '乾燥試料質量と残留質量の値を確認してください。';
    alert(message);
    return;
  }
  if (!result.boundariesReady) {
    alert('礫分・砂分・細粒分を計算するため、2 mm と 0.075 mm の残留質量は必ず入力してください。残留なしの場合は 0 を入力してください。');
    return;
  }

  const p = currentProject();
  if (!p) return;
  const sample = grainForm.elements.sample.value.trim();
  if (!sample) return;
  const now = new Date().toISOString();
  const payload = {
    sample,
    totalDryMass: result.total,
    sieves: result.sieves.map(row => ({ size: row.size, retained: row.retained })),
    remainder: result.remainder,
    fractions: result.fractions,
  };

  if (state.editingTestId) {
    const test = p.tests.find(t => t.id === state.editingTestId && t.type === 'grain');
    if (!test) return;
    Object.assign(test, payload, { updatedAt: now });
  } else {
    p.tests.push({
      id: uid(),
      type: 'grain',
      ...payload,
      createdAt: now,
    });
  }

  p.updatedAt = now;
  saveData();
  resetGrainDialog();
  grainDialog.close();
  renderTests();
});

document.getElementById('newProjectBtn').addEventListener('click', () => projectDialog.showModal());
document.getElementById('backBtn').addEventListener('click', closeProject);
document.getElementById('addMoistureBtn').addEventListener('click', () => {
  resetMoistureDialog();
  moistureDialog.showModal();
});
document.getElementById('addGrainBtn').addEventListener('click', () => {
  resetGrainDialog();
  grainDialog.showModal();
});
document.getElementById('deleteProjectBtn').addEventListener('click', () => {
  const p = currentProject();
  if (!p) return;
  if (!confirm(`「${p.name}」を削除しますか？\nこの端末に保存した試験データも削除されます。`)) return;
  state.data.projects = state.data.projects.filter(x => x.id !== p.id);
  saveData();
  closeProject();
});

document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => document.getElementById(btn.dataset.close).close());
});

function normalizeSpokenNumber(text) {
  let s = String(text).trim().replace(/[，,]/g, '').replace(/点/g, '.').replace(/。/g, '.').replace(/[^0-9.\-]/g, '');
  const firstDot = s.indexOf('.');
  if (firstDot >= 0) s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '');
  return s;
}

function startVoice(fieldName, formId, button) {
  const form = document.getElementById(formId);
  const field = form?.elements[fieldName];
  if (!form || !field) return;

  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    alert('このブラウザでは音声認識ボタンを使えません。iPhoneキーボード右下のマイクから数値を音声入力できます。');
    field.focus();
    return;
  }
  const recognition = new Recognition();
  recognition.lang = 'ja-JP';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  button.classList.add('listening');
  recognition.onresult = event => {
    const raw = event.results[0][0].transcript;
    const value = normalizeSpokenNumber(raw);
    if (value) {
      field.value = value;
      if (formId === 'grainForm') updateGrainPreview();
      else updateMoisturePreview();
    } else {
      alert(`「${raw}」を数値として読み取れませんでした。`);
    }
  };
  recognition.onerror = () => alert('音声入力に失敗しました。マイクの許可を確認してください。');
  recognition.onend = () => button.classList.remove('listening');
  recognition.start();
}

document.addEventListener('click', event => {
  const btn = event.target.closest('[data-voice]');
  if (!btn) return;
  startVoice(btn.dataset.voice, btn.dataset.form || 'moistureForm', btn);
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

buildGrainRows();
updateGrainPreview();
renderProjects();
