const STORAGE_KEY = 'soil-test-app-v1';

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
const projectForm = document.getElementById('projectForm');
const moistureForm = document.getElementById('moistureForm');
const moistureDialogTitle = document.getElementById('moistureDialogTitle');
const moistureSubmitBtn = document.getElementById('moistureSubmitBtn');

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

function renderTests() {
  const p = currentProject();
  if (!p) return;
  testList.innerHTML = '';
  const tests = [...p.tests].sort((a,b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));
  emptyTests.classList.toggle('hidden', tests.length > 0);

  tests.forEach(test => {
    const measurements = testMeasurements(test);
    const rows = measurements.map((m, index) => `
      <div class="measurement-row">
        <strong>${measurements.length === 1 ? '測定' : `測定 ${index + 1}`}</strong>
        <span>容器 ${escapeHtml(m.containerNo || '—')}</span>
        <span>${Number(m.moisture).toFixed(1)} %</span>
      </div>
    `).join('');

    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-title-row">
        <div>
          <h3>含水比試験 ${escapeHtml(test.sample)}</h3>
          <p>${new Date(test.createdAt).toLocaleString('ja-JP')}${test.updatedAt ? ' ｜ 訂正済み' : ''}</p>
        </div>
        <button type="button" class="edit-btn" data-edit-test="${escapeHtml(test.id)}">訂正</button>
      </div>
      <div class="value">${averageForTest(test).toFixed(1)} % <small>平均</small></div>
      <div class="measurement-summary">${rows}</div>
    `;
    testList.appendChild(card);
  });

  testList.querySelectorAll('[data-edit-test]').forEach(btn => {
    btn.addEventListener('click', () => openEditMoisture(btn.dataset.editTest));
  });
}

function format(n) {
  return Number(n).toLocaleString('ja-JP', { maximumFractionDigits: 3 });
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

document.getElementById('newProjectBtn').addEventListener('click', () => projectDialog.showModal());
document.getElementById('backBtn').addEventListener('click', closeProject);
document.getElementById('addMoistureBtn').addEventListener('click', () => {
  resetMoistureDialog();
  moistureDialog.showModal();
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

function startVoice(fieldName, button) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    alert('このブラウザでは音声認識ボタンを使えません。iPhoneキーボード右下のマイクから数値を音声入力できます。');
    moistureForm.elements[fieldName].focus();
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
      moistureForm.elements[fieldName].value = value;
      updateMoisturePreview();
    } else {
      alert(`「${raw}」を数値として読み取れませんでした。`);
    }
  };
  recognition.onerror = () => alert('音声入力に失敗しました。マイクの許可を確認してください。');
  recognition.onend = () => button.classList.remove('listening');
  recognition.start();
}

document.querySelectorAll('[data-voice]').forEach(btn => {
  btn.addEventListener('click', () => startVoice(btn.dataset.voice, btn));
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

renderProjects();
