const STORAGE_KEY = 'soil-test-app-v1';

const state = {
  data: loadData(),
  currentProjectId: null,
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

function renderTests() {
  const p = currentProject();
  if (!p) return;
  testList.innerHTML = '';
  const tests = [...p.tests].sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  emptyTests.classList.toggle('hidden', tests.length > 0);

  tests.forEach(test => {
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <h3>含水比試験 ${escapeHtml(test.sample)}</h3>
      <p>容器 ${escapeHtml(test.containerNo || '—')} ｜ ${new Date(test.createdAt).toLocaleString('ja-JP')}</p>
      <div class="value">${test.moisture.toFixed(1)} %</div>
      <div class="meta">
        <span>容器 ${format(test.containerMass)} g</span>
        <span>湿潤 ${format(test.wetMass)} g</span>
        <span>乾燥 ${format(test.dryMass)} g</span>
      </div>
    `;
    testList.appendChild(card);
  });
}

function format(n) {
  return Number(n).toLocaleString('ja-JP', { maximumFractionDigits: 3 });
}

function moistureValue() {
  const c = Number(moistureForm.elements.containerMass.value);
  const wet = Number(moistureForm.elements.wetMass.value);
  const dry = Number(moistureForm.elements.dryMass.value);
  const water = wet - dry;
  const drySoil = dry - c;
  if (![c, wet, dry].every(Number.isFinite) || drySoil <= 0 || water < 0) return null;
  return (water / drySoil) * 100;
}

function updateMoisturePreview() {
  const value = moistureValue();
  document.getElementById('moisturePreview').textContent = value == null ? '含水比：—' : `含水比：${value.toFixed(1)} %`;
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
  const moisture = moistureValue();
  if (moisture == null) {
    alert('質量の値を確認してください。湿潤質量 ≥ 乾燥質量 > 容器質量になるよう入力してください。');
    return;
  }
  const p = currentProject();
  if (!p) return;
  const fd = new FormData(moistureForm);
  p.tests.push({
    id: uid(),
    type: 'moisture',
    sample: String(fd.get('sample')).trim(),
    containerNo: String(fd.get('containerNo')).trim(),
    containerMass: Number(fd.get('containerMass')),
    wetMass: Number(fd.get('wetMass')),
    dryMass: Number(fd.get('dryMass')),
    moisture,
    createdAt: new Date().toISOString(),
  });
  p.updatedAt = new Date().toISOString();
  saveData();
  moistureForm.reset();
  updateMoisturePreview();
  moistureDialog.close();
  renderTests();
});

document.getElementById('newProjectBtn').addEventListener('click', () => projectDialog.showModal());
document.getElementById('backBtn').addEventListener('click', closeProject);
document.getElementById('addMoistureBtn').addEventListener('click', () => {
  moistureForm.reset();
  updateMoisturePreview();
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
