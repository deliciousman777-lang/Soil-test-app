// SoilNote project completion + shared completion notifications.
// Uses the existing share-code sync: completion data is stored in each project payload.
(function(){
  'use strict';

  const SHARE_KEY = 'soilnote-share-code-v2';
  const SEEN_KEY = 'soilnote-completion-seen-v1';
  const DEVICE_KEY = 'soilnote-device-id-v1';
  const MAX_SEEN = 120;
  const MAX_BACKFILL_MS = 7 * 24 * 60 * 60 * 1000;
  const TEST_DEFS = [
    {key:'moisture', label:'含水比', types:['moisture']},
    {key:'grain', label:'粒度', types:['grain']},
    {key:'particleDensity', label:'土粒子の密度', types:['particleDensity']},
    {key:'atterberg', label:'液性・塑性限界', types:['atterberg']},
    {key:'cone-index', label:'コーン指数', types:['cone-index']},
  ];

  let primed = false;
  let seen = loadSeen();
  const deviceId = getDeviceId();

  function esc(v){
    return String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }

  function makeId(){
    if(typeof uid === 'function') return uid();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function getDeviceId(){
    let id = localStorage.getItem(DEVICE_KEY);
    if(id) return id;
    id = `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(DEVICE_KEY,id);
    return id;
  }

  function loadSeen(){
    try{
      const list = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
      return new Set(Array.isArray(list) ? list.map(String) : []);
    }catch{
      return new Set();
    }
  }

  function persistSeen(){
    const list = [...seen];
    if(list.length > MAX_SEEN) seen = new Set(list.slice(-MAX_SEEN));
    localStorage.setItem(SEEN_KEY,JSON.stringify([...seen]));
  }

  function projects(){
    try{return Array.isArray(state?.data?.projects) ? state.data.projects : [];}catch{return [];}
  }

  function normalizeShareCode(v){
    return String(v || '').toUpperCase().replace(/[^0-9A-F]/g,'');
  }

  function isShared(){
    return normalizeShareCode(localStorage.getItem(SHARE_KEY)).length === 20;
  }

  function completionId(project){
    return String(project?.completedNotificationId || '').trim();
  }

  function completionTime(project){
    const t = new Date(project?.completedAt || 0).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  function planStatus(project){
    const plan = Array.isArray(project?.plannedTests) ? project.plannedTests : [];
    const tests = Array.isArray(project?.tests) ? project.tests : [];
    const pending = [];
    for(const key of plan){
      const def = TEST_DEFS.find(x=>x.key===String(key));
      if(!def) continue;
      const done = tests.some(test=>def.types.includes(String(test?.type || '')));
      if(!done) pending.push(def.label);
    }
    return {total:plan.length,pending};
  }

  function injectStyles(){
    if(document.getElementById('projectCompletionStyle')) return;
    const style = document.createElement('style');
    style.id = 'projectCompletionStyle';
    style.textContent = `
      .project-completion-panel{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:10px 0 16px;padding:13px 14px;border:1px solid var(--line,#dfe7e3);border-radius:15px;background:#fff}
      .project-completion-copy{min-width:0}.project-completion-copy strong{display:block;font-size:13px;color:#24312b}.project-completion-copy small{display:block;margin-top:4px;color:var(--muted,#68766e);font-size:11px;line-height:1.45}
      .project-completion-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.project-completion-btn{white-space:nowrap}.project-completion-btn[disabled]{opacity:.45;cursor:not-allowed}.project-completion-done{color:#087443!important}.completion-badge{display:inline-flex;align-items:center;gap:4px;margin:5px 0 1px;padding:5px 8px;border-radius:999px;background:#e5f5ed;color:#087443;font-size:11px;font-weight:800}
      .soilnote-completion-toast{position:fixed;z-index:99999;left:50%;top:max(14px,env(safe-area-inset-top));transform:translateX(-50%);width:min(440px,calc(100% - 24px));padding:13px 15px;border-radius:14px;background:#17352a;color:#fff;box-shadow:0 12px 34px rgba(0,0,0,.22);display:flex;gap:10px;align-items:flex-start;cursor:pointer}.soilnote-completion-toast strong{display:block;font-size:14px}.soilnote-completion-toast span{display:block;margin-top:3px;font-size:12px;line-height:1.45;opacity:.92}.soilnote-completion-toast button{margin-left:auto;border:0;background:transparent;color:#fff;font-size:20px;line-height:1;padding:0 0 4px 6px}
      @media(max-width:650px){.project-completion-panel{align-items:stretch;flex-direction:column}.project-completion-actions{justify-content:stretch}.project-completion-actions button{flex:1}}
    `;
    document.head.appendChild(style);
  }

  function notificationSupportText(){
    if(!('Notification' in window) || !('serviceWorker' in navigator)) return '端末通知はこの環境では利用できません（アプリ内通知は表示します）';
    if(Notification.permission === 'granted') return '端末通知 ON';
    if(Notification.permission === 'denied') return '端末通知 OFF（端末設定で許可してください）';
    return '「通知をON」を一度押すと端末通知でも受け取れます';
  }

  function renderCompletionPanel(){
    const detail = document.getElementById('detailView');
    if(!detail) return;
    let project = null;
    try{project = currentProject();}catch{}
    let holder = document.getElementById('projectCompletionPanel');
    if(!project){holder?.remove();return;}
    if(!holder){
      holder = document.createElement('div');
      holder.id = 'projectCompletionPanel';
      holder.className = 'project-completion-panel';
      const anchor = document.getElementById('projectPlanDetail') || detail.querySelector('.detail-title');
      if(anchor) anchor.insertAdjacentElement('afterend',holder); else detail.prepend(holder);
    }

    const plan = planStatus(project);
    const hasTests = Array.isArray(project.tests) && project.tests.length > 0;
    const pending = plan.pending;
    const done = Boolean(project.completedAt && completionId(project));
    const canComplete = hasTests && pending.length === 0;
    const shared = isShared();
    const notificationDefault = ('Notification' in window) && Notification.permission === 'default';

    let title = '試験がすべて終わったら完了通知';
    let sub = shared ? '完了すると、同じ共有コードを使っている端末へ通知します。' : '現在は端末保存です。共有をONにすると他の使用者にも届きます。';
    if(!hasTests) sub = '試験データを1件以上保存すると完了できます。';
    else if(pending.length) sub = `未完了：${pending.join('・')}`;
    else if(done){
      const d = new Date(project.completedAt);
      title = '✓ 試験完了済み';
      sub = `${Number.isNaN(d.getTime()) ? '' : d.toLocaleString('ja-JP')}${shared ? ' ｜ 共有端末へ通知済み' : ''}`;
    }

    holder.innerHTML = `
      <div class="project-completion-copy"><strong class="${done?'project-completion-done':''}">${esc(title)}</strong><small>${esc(sub)}<br>${esc(notificationSupportText())}</small></div>
      <div class="project-completion-actions">
        ${notificationDefault ? '<button type="button" class="ghost" id="enableCompletionNotifications">🔔 通知をON</button>' : ''}
        ${done
          ? '<button type="button" class="ghost" id="cancelProjectCompletion">完了を取消</button>'
          : `<button type="button" class="primary project-completion-btn" id="completeProjectBtn" ${canComplete?'':'disabled'}>✓ 試験完了・全員に通知</button>`}
      </div>`;

    document.getElementById('enableCompletionNotifications')?.addEventListener('click',requestNotificationPermission);
    document.getElementById('completeProjectBtn')?.addEventListener('click',completeProject);
    document.getElementById('cancelProjectCompletion')?.addEventListener('click',cancelCompletion);
  }

  async function requestNotificationPermission(){
    if(!('Notification' in window) || typeof Notification.requestPermission !== 'function'){
      alert('この端末では端末通知を有効にできません。アプリ内通知は表示されます。');
      return;
    }
    try{
      const result = await Notification.requestPermission();
      if(result === 'granted') showToast('通知をONにしました','今後、他の端末で試験完了になると端末通知でもお知らせします。');
      else if(result === 'denied') alert('通知が許可されませんでした。端末設定からSoilNoteの通知を許可できます。');
    }catch{
      alert('通知を有効にできませんでした。アプリ内通知は引き続き表示されます。');
    }
    renderCompletionPanel();
  }

  function completeProject(){
    let project = null;
    try{project = currentProject();}catch{}
    if(!project) return;
    const plan = planStatus(project);
    if(!Array.isArray(project.tests) || project.tests.length === 0 || plan.pending.length) return;
    if(!confirm(`「${project.name}」の試験を完了として、使用者へ通知しますか？`)) return;

    const now = new Date().toISOString();
    const id = makeId();
    project.completedAt = now;
    project.completedNotificationId = id;
    project.completedByDevice = deviceId;
    project.updatedAt = now;
    seen.add(id);
    persistSeen();
    saveData();
    try{renderTests();renderProjects();}catch{}
    showToast('試験完了を送信しました',isShared() ? `「${project.name}」の完了を共有端末へ通知します。` : `「${project.name}」を完了にしました。共有をONにすると他端末にも届きます。`,project.id);
  }

  function cancelCompletion(){
    let project = null;
    try{project = currentProject();}catch{}
    if(!project) return;
    if(!confirm(`「${project.name}」の試験完了を取り消しますか？`)) return;
    delete project.completedAt;
    delete project.completedNotificationId;
    delete project.completedByDevice;
    project.updatedAt = new Date().toISOString();
    saveData();
    try{renderTests();renderProjects();}catch{}
  }

  function showToast(title,body,projectId=''){
    document.querySelector('.soilnote-completion-toast')?.remove();
    const el = document.createElement('div');
    el.className = 'soilnote-completion-toast';
    el.innerHTML = `<div><strong>${esc(title)}</strong><span>${esc(body)}</span></div><button type="button" aria-label="閉じる">×</button>`;
    const close = ()=>el.remove();
    el.querySelector('button')?.addEventListener('click',e=>{e.stopPropagation();close();});
    el.addEventListener('click',()=>{
      if(projectId){
        try{if(projects().some(p=>String(p.id)===String(projectId))) openProject(projectId);}catch{}
      }
      close();
    });
    document.body.appendChild(el);
    setTimeout(()=>{if(el.isConnected)el.remove();},9000);
  }

  async function showSystemNotification(project){
    if(!('Notification' in window) || Notification.permission !== 'granted' || !('serviceWorker' in navigator)) return;
    try{
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification('SoilNote｜試験完了',{
        body:`「${project.name || '工事'}」の試験が完了しました。`,
        icon:'./icons/apple-touch-icon.png',
        badge:'./icons/apple-touch-icon.png',
        tag:`soilnote-project-complete-${completionId(project)}`,
        renotify:false,
        data:{type:'soilnote-project-complete',projectId:String(project.id || '')}
      });
    }catch(err){
      console.warn('[SoilNote Completion] notification',err);
    }
  }

  function notifyRemoteCompletion(project){
    showToast('✓ 試験完了',`「${project.name || '工事'}」の試験が完了しました。`,project.id);
    showSystemNotification(project);
  }

  function scanRemoteCompletions(){
    if(!primed) return;
    let changed = false;
    const now = Date.now();
    for(const project of projects()){
      const id = completionId(project);
      if(!id || seen.has(id)) continue;
      seen.add(id);changed = true;
      if(String(project.completedByDevice || '') === deviceId) continue;
      const t = completionTime(project);
      if(t && now - t > MAX_BACKFILL_MS) continue;
      notifyRemoteCompletion(project);
    }
    if(changed) persistSeen();
  }

  function decorateProjectCards(){
    const list = document.getElementById('projectList');
    if(!list) return;
    let sorted = [];
    try{sorted = [...projects()].sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));}catch{return;}
    const cards = [...list.querySelectorAll('.card-button')];
    cards.forEach((card,index)=>{
      card.querySelector('.completion-badge')?.remove();
      const project = sorted[index];
      if(!project?.completedAt) return;
      const meta = card.querySelector('.meta');
      const badge = document.createElement('div');
      badge.className = 'completion-badge';
      badge.textContent = '✓ 試験完了';
      if(meta) meta.insertAdjacentElement('beforebegin',badge); else card.appendChild(badge);
    });
  }

  function primeExistingCompletions(){
    for(const project of projects()){
      const id = completionId(project);
      if(id) seen.add(id);
    }
    persistSeen();
    primed = true;
  }

  function installRenderHooks(){
    if(typeof renderProjects === 'function'){
      const baseRenderProjects = renderProjects;
      renderProjects = function(){
        const result = baseRenderProjects.apply(this,arguments);
        decorateProjectCards();
        scanRemoteCompletions();
        return result;
      };
    }
    if(typeof renderTests === 'function'){
      const baseRenderTests = renderTests;
      renderTests = function(){
        const result = baseRenderTests.apply(this,arguments);
        renderCompletionPanel();
        decorateProjectCards();
        scanRemoteCompletions();
        return result;
      };
    }
  }

  function boot(){
    injectStyles();
    primeExistingCompletions();
    installRenderHooks();
    decorateProjectCards();
    renderCompletionPanel();
    window.addEventListener('storage',e=>{
      if(e.key === SHARE_KEY) renderCompletionPanel();
    });
    navigator.serviceWorker?.addEventListener?.('message',event=>{
      if(event.data?.type !== 'soilnote-project-complete') return;
      const id = String(event.data.projectId || '');
      if(!id) return;
      try{if(projects().some(p=>String(p.id)===id)) openProject(id);}catch{}
    });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot);
  else boot();
})();
