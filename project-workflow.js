// SoilNote project workflow folders + exclusive project work lock.
// Folders: testing -> completed -> organized. Shared users cannot work on the same project at once.
(function(){
  'use strict';

  const CONFIG = window.SOILNOTE_SUPABASE || {};
  const SUPABASE_URL = String(CONFIG.url || '').trim();
  const SUPABASE_KEY = String(CONFIG.publishableKey || CONFIG.anonKey || '').trim();
  const SHARE_KEY = 'soilnote-share-code-v2';
  const NAME_KEY = 'soilnote-editor-name-v1';
  const DEVICE_KEY = 'soilnote-device-id-v1';
  const FOLDER_KEY = 'soilnote-project-folder-v1';
  const PROJECT_LOCK_ID = '__project_work__';
  const SUPABASE_JS_VERSION = '2.117.3';
  const CDN = `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@${SUPABASE_JS_VERSION}`;
  const FOLDERS = [
    {key:'testing', label:'試験中', icon:'📂'},
    {key:'completed', label:'試験完了', icon:'✅'},
    {key:'organized', label:'データ整理済み', icon:'📁'},
  ];

  let client = null;
  let activeProjectLock = null;
  let heartbeatTimer = null;
  let refreshTimer = null;
  let lastLocks = [];
  let selectedFolder = FOLDERS.some(x=>x.key===localStorage.getItem(FOLDER_KEY)) ? localStorage.getItem(FOLDER_KEY) : 'testing';
  let ensuringProjectId = '';
  const bypassCards = new WeakSet();

  function esc(v){
    return String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }

  function normalizeCode(v){
    return String(v||'').toUpperCase().replace(/[^0-9A-F]/g,'');
  }

  function shareCode(){
    const code = normalizeCode(localStorage.getItem(SHARE_KEY));
    return code.length === 20 ? code : '';
  }

  function deviceId(){
    let id = localStorage.getItem(DEVICE_KEY);
    if(!id){
      id = `device-${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(DEVICE_KEY,id);
    }
    return id;
  }

  function editorName(ask=false){
    let name = String(localStorage.getItem(NAME_KEY)||'').trim();
    if(name || !ask) return name;
    name = String(window.prompt('共有で作業者を区別するため、この端末を使う人の名前を入力してください。\n例：吉村、後輩')||'').trim().slice(0,60);
    if(name) localStorage.setItem(NAME_KEY,name);
    return name;
  }

  function projects(){
    try{return Array.isArray(state?.data?.projects) ? state.data.projects : [];}catch{return [];}
  }

  function sortedProjects(){
    return [...projects()].sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
  }

  function currentProjectSafe(){
    try{return currentProject();}catch{return null;}
  }

  function timeOf(value){
    const t = new Date(value || 0).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  function workflowStatus(project){
    if(!project?.completedAt) return 'testing';
    const completed = timeOf(project.completedAt);
    const organized = timeOf(project.organizedAt);
    return organized && organized >= completed ? 'organized' : 'completed';
  }

  function loadScript(src){
    return new Promise((resolve,reject)=>{
      if(window.supabase?.createClient){resolve();return;}
      const existing=[...document.scripts].find(s=>s.src===src);
      if(existing){
        const started=Date.now();
        const timer=setInterval(()=>{
          if(window.supabase?.createClient){clearInterval(timer);resolve();}
          else if(Date.now()-started>8000){clearInterval(timer);reject(new Error('Supabase SDK timeout'));}
        },50);
        return;
      }
      const s=document.createElement('script');
      s.src=src;s.async=true;s.onload=resolve;s.onerror=reject;
      document.head.appendChild(s);
    });
  }

  function injectStyles(){
    if(document.getElementById('projectWorkflowStyle')) return;
    const style=document.createElement('style');
    style.id='projectWorkflowStyle';
    style.textContent=`
      .project-folders{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:2px 0 16px}.project-folder-btn{border:1px solid var(--line,#dfe7e3);background:#fff;border-radius:14px;padding:11px 9px;display:flex;align-items:center;justify-content:center;gap:6px;font-weight:800;color:#53605d;cursor:pointer}.project-folder-btn.active{background:#e9f4ef;border-color:#94c5af;color:var(--accent-dark,#0b5136);box-shadow:inset 0 0 0 1px #94c5af}.project-folder-count{min-width:22px;height:22px;border-radius:999px;background:#eef2f0;display:inline-flex;align-items:center;justify-content:center;font-size:11px}.project-folder-btn.active .project-folder-count{background:#fff;color:var(--accent-dark,#0b5136)}
      .workflow-badge,.project-work-badge{display:inline-flex;align-items:center;gap:4px;margin:5px 6px 1px 0;padding:5px 8px;border-radius:999px;font-size:11px;font-weight:800}.workflow-badge.testing{background:#eef2f0;color:#5f6d66}.workflow-badge.completed{background:#e7f4ff;color:#175cd3}.workflow-badge.organized{background:#f0ebff;color:#6938ef}.project-work-badge.mine{background:#e5f5ed;color:#087443}.project-work-badge.other{background:#fff3e8;color:#9a3412}.card-button.project-work-locked{border-color:#fdba74!important;background:#fffaf5!important}.card-button.project-work-locked:hover{transform:none}.project-folder-empty{padding:26px 16px;border:1px dashed var(--line,#dfe7e3);border-radius:16px;text-align:center;color:var(--muted,#68766e);background:#fafcfb}.project-folder-empty strong{display:block;color:#3d4b44;margin-bottom:5px}
      .project-workflow-panel{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:10px 0 16px;padding:13px 14px;border:1px solid var(--line,#dfe7e3);border-radius:15px;background:#f8fbfa}.project-workflow-copy strong{display:block;font-size:13px;color:#24312b}.project-workflow-copy small{display:block;margin-top:4px;color:var(--muted,#68766e);font-size:11px;line-height:1.5}.organized-readonly-note{color:#6938ef!important}.project-lock-waiting{opacity:.7;pointer-events:none}.workflow-readonly{opacity:.55!important;cursor:not-allowed!important}
      @media(max-width:650px){.project-folders{grid-template-columns:1fr;gap:6px}.project-folder-btn{justify-content:space-between;padding:10px 12px}.project-workflow-panel{align-items:stretch;flex-direction:column}.project-workflow-panel button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function folderCounts(){
    const counts={testing:0,completed:0,organized:0};
    projects().forEach(p=>{counts[workflowStatus(p)]++;});
    return counts;
  }

  function ensureFolderNav(){
    const section=document.getElementById('projectView');
    const list=document.getElementById('projectList');
    if(!section||!list)return null;
    let nav=document.getElementById('projectWorkflowFolders');
    if(!nav){
      nav=document.createElement('div');
      nav.id='projectWorkflowFolders';
      nav.className='project-folders';
      list.insertAdjacentElement('beforebegin',nav);
    }
    const counts=folderCounts();
    nav.innerHTML=FOLDERS.map(folder=>`<button type="button" class="project-folder-btn ${selectedFolder===folder.key?'active':''}" data-project-folder="${folder.key}"><span>${folder.icon} ${esc(folder.label)}</span><span class="project-folder-count">${counts[folder.key]}</span></button>`).join('');
    nav.querySelectorAll('[data-project-folder]').forEach(btn=>btn.addEventListener('click',()=>{
      selectedFolder=btn.dataset.projectFolder;
      localStorage.setItem(FOLDER_KEY,selectedFolder);
      decorateProjectCards();
    }));
    return nav;
  }

  function projectLock(projectId){
    return lastLocks.find(l=>String(l.project_id)===String(projectId)&&String(l.test_id)===PROJECT_LOCK_ID) || null;
  }

  function addBadge(card,className,text){
    const badge=document.createElement('span');
    badge.className=className;
    badge.textContent=text;
    const meta=card.querySelector('.meta');
    if(meta)meta.insertAdjacentElement('beforebegin',badge);else card.appendChild(badge);
  }

  function decorateProjectCards(){
    ensureFolderNav();
    const list=document.getElementById('projectList');
    if(!list)return;
    const sorted=sortedProjects();
    const cards=[...list.querySelectorAll(':scope > .card-button')];
    const mine=deviceId();
    let visible=0;

    cards.forEach((card,index)=>{
      const project=sorted[index];
      if(!project)return;
      card.dataset.projectId=String(project.id||'');
      card.querySelectorAll('.workflow-badge,.project-work-badge').forEach(el=>el.remove());
      card.classList.remove('project-work-locked');
      const status=workflowStatus(project);
      const def=FOLDERS.find(x=>x.key===status);
      addBadge(card,`workflow-badge ${status}`,`${def?.icon||''} ${def?.label||status}`.trim());

      const lock=projectLock(project.id);
      if(lock){
        const isMine=String(lock.device_id)===mine;
        addBadge(card,`project-work-badge ${isMine?'mine':'other'}`,isMine?'● 自分が作業中':`🔒 ${lock.display_name||'他端末'}さん作業中`);
        if(!isMine)card.classList.add('project-work-locked');
      }

      const show=status===selectedFolder;
      card.hidden=!show;
      if(show)visible++;
    });

    let empty=document.getElementById('projectFolderEmpty');
    if(!empty){
      empty=document.createElement('div');
      empty.id='projectFolderEmpty';
      empty.className='project-folder-empty hidden';
      list.insertAdjacentElement('afterend',empty);
    }
    const total=projects().length;
    const baseEmpty=document.getElementById('emptyProjects');
    if(total===0){
      empty.classList.add('hidden');
    }else{
      baseEmpty?.classList.add('hidden');
      const def=FOLDERS.find(x=>x.key===selectedFolder);
      empty.innerHTML=`<strong>${def?.icon||''} ${esc(def?.label||'')}</strong><span>このフォルダには工事がありません。</span>`;
      empty.classList.toggle('hidden',visible>0);
    }
  }

  async function rpc(name,args){
    if(!client)throw new Error('project lock client unavailable');
    return client.rpc(name,args);
  }

  async function acquireProjectLock(projectId,quiet=false){
    const code=shareCode();
    if(!code||!projectId)return {acquired:true,localOnly:true};
    const name=editorName(!quiet);
    if(!name){
      if(!quiet)alert('作業者名を入力しないと共有作業を開始できません。');
      return {acquired:false,cancelled:true};
    }
    try{
      const {data,error}=await rpc('soilnote_lock_acquire',{
        p_code:code,
        p_project_id:String(projectId),
        p_test_id:PROJECT_LOCK_ID,
        p_device_id:deviceId(),
        p_display_name:name
      });
      if(error)throw error;
      const row=Array.isArray(data)?data[0]:data;
      return {acquired:!!row?.acquired,holderName:String(row?.holder_name||''),holderDeviceId:String(row?.holder_device_id||''),expiresAt:row?.expires_at};
    }catch(error){
      console.error('[SoilNote Project Lock] acquire',error);
      if(!quiet)alert('共有作業ロックを確認できませんでした。通信状態を確認してください。');
      return {acquired:false,error};
    }
  }

  async function releaseProjectLock(lock=activeProjectLock){
    if(!lock)return;
    if(activeProjectLock===lock)activeProjectLock=null;
    stopHeartbeat();
    const code=shareCode();
    if(!code||!client)return;
    try{
      await rpc('soilnote_lock_release',{
        p_code:code,
        p_project_id:String(lock.projectId),
        p_test_id:PROJECT_LOCK_ID,
        p_device_id:deviceId()
      });
    }catch(err){console.warn('[SoilNote Project Lock] release',err);}
    refreshLocks();
  }

  function startHeartbeat(){
    stopHeartbeat();
    heartbeatTimer=setInterval(()=>renewActiveProjectLock(true),25000);
  }

  function stopHeartbeat(){
    if(heartbeatTimer){clearInterval(heartbeatTimer);heartbeatTimer=null;}
  }

  async function renewActiveProjectLock(kickOnLoss=false){
    const lock=activeProjectLock;
    if(!lock)return true;
    const result=await acquireProjectLock(lock.projectId,true);
    if(result.acquired)return true;
    activeProjectLock=null;
    stopHeartbeat();
    if(kickOnLoss){
      const who=result.holderName?`${result.holderName}さんが`:'別の共有者が';
      alert(`この工事の作業権が切り替わりました。\n${who}作業中です。\n二重作業防止のため工事一覧へ戻ります。`);
      try{closeProject();}catch{}
    }
    await refreshLocks();
    return false;
  }

  async function refreshLocks(){
    const code=shareCode();
    if(!client||!code){lastLocks=[];decorateProjectCards();return;}
    try{
      const {data,error}=await rpc('soilnote_lock_list',{p_code:code});
      if(error)throw error;
      lastLocks=Array.isArray(data)?data:[];
      decorateProjectCards();
    }catch(err){console.warn('[SoilNote Project Lock] list',err);}
  }

  function setDetailLockPending(pending){
    const detail=document.getElementById('detailView');
    if(!detail)return;
    const panel=detail.querySelector('.panel');
    panel?.classList.toggle('project-lock-waiting',!!pending);
  }

  async function ensureCurrentProjectLock(){
    const project=currentProjectSafe();
    if(!project||!shareCode()||!client)return;
    const id=String(project.id||'');
    if(activeProjectLock&&String(activeProjectLock.projectId)===id)return;
    if(ensuringProjectId===id)return;
    ensuringProjectId=id;
    setDetailLockPending(true);
    const result=await acquireProjectLock(id,false);
    ensuringProjectId='';
    setDetailLockPending(false);
    if(result.acquired){
      activeProjectLock={projectId:id};
      startHeartbeat();
      refreshLocks();
      return;
    }
    if(!result.cancelled&&!result.error){
      alert(`${result.holderName||'別の共有者'}さんがこの工事を作業中です。\n同じ工事で作業が重ならないよう、工事一覧へ戻ります。`);
    }
    try{closeProject();}catch{}
  }

  async function handleProjectCardClick(event){
    const card=event.target.closest?.('#projectList .card-button');
    if(!card||!shareCode()||!client)return;
    if(bypassCards.has(card)){bypassCards.delete(card);return;}
    const projectId=String(card.dataset.projectId||'');
    if(!projectId)return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const known=projectLock(projectId);
    if(known&&String(known.device_id)!==deviceId()){
      alert(`${known.display_name||'別の共有者'}さんがこの工事を作業中です。\n二重作業防止のため、今は開けません。`);
      return;
    }

    const result=await acquireProjectLock(projectId,false);
    if(!result.acquired){
      if(!result.cancelled&&!result.error)alert(`${result.holderName||'別の共有者'}さんがこの工事を作業中です。\n二重作業防止のため、今は開けません。`);
      await refreshLocks();
      return;
    }

    if(activeProjectLock&&String(activeProjectLock.projectId)!==projectId)await releaseProjectLock(activeProjectLock);
    activeProjectLock={projectId};
    startHeartbeat();
    bypassCards.add(card);
    card.click();
    refreshLocks();
  }

  function lockHeldForCurrent(){
    if(!shareCode())return true;
    const p=currentProjectSafe();
    return !!p&&!!activeProjectLock&&String(activeProjectLock.projectId)===String(p.id);
  }

  function applyOrganizedReadOnly(project){
    const organized=workflowStatus(project)==='organized';
    const detail=document.getElementById('detailView');
    if(!detail)return;
    const disable=[];
    detail.querySelectorAll('.test-actions button,#editProjectInfoBtn,#deleteProjectBtn,#cancelProjectCompletion').forEach(btn=>disable.push(btn));
    detail.querySelectorAll('button').forEach(btn=>{
      if([...btn.attributes].some(a=>a.name.startsWith('data-edit-')))disable.push(btn);
      if(btn.matches('[data-delete-test],[data-delete-grain],[data-delete-moisture]'))disable.push(btn);
    });
    [...new Set(disable)].forEach(btn=>{
      if(organized){
        if(btn.dataset.workflowWasDisabled==null)btn.dataset.workflowWasDisabled=btn.disabled?'1':'0';
        btn.disabled=true;btn.classList.add('workflow-readonly');
      }else if(btn.dataset.workflowWasDisabled!=null){
        btn.disabled=btn.dataset.workflowWasDisabled==='1';
        delete btn.dataset.workflowWasDisabled;btn.classList.remove('workflow-readonly');
      }
    });
  }

  function renderDetailWorkflow(){
    const detail=document.getElementById('detailView');
    const project=currentProjectSafe();
    let panel=document.getElementById('projectWorkflowPanel');
    if(!detail||!project){panel?.remove();return;}
    if(!panel){
      panel=document.createElement('div');
      panel.id='projectWorkflowPanel';
      panel.className='project-workflow-panel';
      const anchor=document.getElementById('projectCompletionPanel')||document.getElementById('projectPlanDetail')||detail.querySelector('.detail-title');
      if(anchor)anchor.insertAdjacentElement('afterend',panel);else detail.prepend(panel);
    }
    const status=workflowStatus(project);
    const name=String(project.organizedByName||'').trim();
    if(status==='testing'){
      panel.innerHTML='<div class="project-workflow-copy"><strong>📂 試験中</strong><small>予定した試験が終わると「試験完了」に移動できます。共有中はこの工事を1人だけが作業できます。</small></div>';
    }else if(status==='completed'){
      panel.innerHTML='<div class="project-workflow-copy"><strong>✅ 試験完了</strong><small>試験結果の確認・成果データの整理が終わったら、整理済みに移動してください。</small></div><button type="button" class="primary" id="markProjectOrganized">📁 データ整理済みにする</button>';
      document.getElementById('markProjectOrganized')?.addEventListener('click',markOrganized);
    }else{
      const date=new Date(project.organizedAt||'');
      const when=Number.isNaN(date.getTime())?'':date.toLocaleString('ja-JP');
      panel.innerHTML=`<div class="project-workflow-copy"><strong class="organized-readonly-note">📁 データ整理済み</strong><small>${esc([when,name?`${name}さん`:'' ].filter(Boolean).join(' ｜ '))}<br>誤操作防止のため試験入力・訂正はロックしています。</small></div><button type="button" class="ghost" id="undoProjectOrganized">整理済みを解除</button>`;
      document.getElementById('undoProjectOrganized')?.addEventListener('click',undoOrganized);
    }
    applyOrganizedReadOnly(project);
  }

  async function markOrganized(){
    const project=currentProjectSafe();
    if(!project||workflowStatus(project)!=='completed')return;
    if(!lockHeldForCurrent()){
      alert('この工事の作業権を確認できません。工事一覧から開き直してください。');return;
    }
    if(!confirm(`「${project.name}」をデータ整理済みにしますか？\n整理済みになると試験入力・訂正はロックされます。`))return;
    const now=new Date().toISOString();
    project.organizedAt=now;
    project.organizedByDevice=deviceId();
    project.organizedByName=editorName(false)||'';
    project.updatedAt=now;
    saveData();
    try{renderTests();renderProjects();}catch{}
  }

  async function undoOrganized(){
    const project=currentProjectSafe();
    if(!project||workflowStatus(project)!=='organized')return;
    if(!lockHeldForCurrent()){
      alert('この工事の作業権を確認できません。工事一覧から開き直してください。');return;
    }
    if(!confirm(`「${project.name}」を試験完了フォルダへ戻しますか？`))return;
    delete project.organizedAt;
    delete project.organizedByDevice;
    delete project.organizedByName;
    project.updatedAt=new Date().toISOString();
    saveData();
    try{renderTests();renderProjects();}catch{}
  }

  function installHooks(){
    if(typeof renderProjects==='function'){
      const baseRenderProjects=renderProjects;
      renderProjects=function(){
        const result=baseRenderProjects.apply(this,arguments);
        decorateProjectCards();
        return result;
      };
    }
    if(typeof renderTests==='function'){
      const baseRenderTests=renderTests;
      renderTests=function(){
        const result=baseRenderTests.apply(this,arguments);
        renderDetailWorkflow();
        setTimeout(ensureCurrentProjectLock,0);
        return result;
      };
    }
  }

  function startRefresh(){
    if(refreshTimer)clearInterval(refreshTimer);
    refreshTimer=setInterval(()=>{
      if(document.visibilityState==='visible'){
        if(activeProjectLock)renewActiveProjectLock(true);
        refreshLocks();
      }
    },5000);
  }

  async function boot(){
    injectStyles();
    deviceId();
    installHooks();
    ensureFolderNav();
    decorateProjectCards();
    renderDetailWorkflow();

    document.addEventListener('click',handleProjectCardClick,true);
    document.getElementById('backBtn')?.addEventListener('click',()=>{releaseProjectLock();});
    document.getElementById('deleteProjectBtn')?.addEventListener('click',()=>{setTimeout(()=>releaseProjectLock(),100);});
    window.addEventListener('pagehide',()=>{releaseProjectLock();});
    window.addEventListener('beforeunload',()=>{releaseProjectLock();});
    document.addEventListener('visibilitychange',()=>{
      if(document.visibilityState==='visible'){
        if(activeProjectLock)renewActiveProjectLock(true);
        refreshLocks();
      }
    });

    if(!/^https:\/\//.test(SUPABASE_URL)||!SUPABASE_KEY.startsWith('sb_publishable_'))return;
    try{
      if(!window.supabase?.createClient)await loadScript(CDN);
      client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
      startRefresh();
      await refreshLocks();
      if(currentProjectSafe())await ensureCurrentProjectLock();
    }catch(err){console.error('[SoilNote Project Workflow] boot',err);}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
