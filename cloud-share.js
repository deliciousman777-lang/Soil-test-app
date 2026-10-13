// SoilNote Cloud Share v2 (share-code only, no email/password login)
// Local-first: localStorage remains the offline source; a secret share code connects devices.
(function(){
  'use strict';

  const CONFIG = window.SOILNOTE_SUPABASE || {};
  const SUPABASE_URL = String(CONFIG.url || '').trim();
  const SUPABASE_KEY = String(CONFIG.publishableKey || CONFIG.anonKey || '').trim();
  const SHARE_KEY = 'soilnote-share-code-v2';
  const SUPABASE_JS_VERSION = '2.117.3';
  const CDN = `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@${SUPABASE_JS_VERSION}`;

  let client = null;
  let shareCode = '';
  let workspace = null;
  let syncing = false;
  let saveTimer = null;
  let pollTimer = null;
  let originalSaveData = null;

  function esc(v){
    return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }

  function clone(v){
    return v == null ? v : JSON.parse(JSON.stringify(v));
  }

  function timeOf(value){
    const t = new Date(value || 0).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  function projectStamp(p){
    return timeOf(p?.updatedAt || p?.createdAt);
  }

  function testStamp(t){
    return timeOf(t?.updatedAt || t?.createdAt);
  }

  function testKey(t,index){
    if(t?.id != null && String(t.id) !== '') return `id:${String(t.id)}`;
    return `legacy:${String(t?.type||'')}:${String(t?.sample||'')}:${String(t?.createdAt||'')}:${index}`;
  }

  function mergeProjects(a,b){
    if(!a)return clone(b);
    if(!b)return clone(a);
    const base = clone(projectStamp(a) >= projectStamp(b) ? a : b);
    const merged = new Map();
    const add=(list)=>{
      (Array.isArray(list)?list:[]).forEach((t,i)=>{
        const key=testKey(t,i);
        const old=merged.get(key);
        if(!old || testStamp(t) >= testStamp(old)) merged.set(key,clone(t));
      });
    };
    add(a.tests);add(b.tests);
    const tests=[...merged.values()].sort((x,y)=>{
      const d=timeOf(x?.createdAt)-timeOf(y?.createdAt);
      return d || String(x?.id||'').localeCompare(String(y?.id||''));
    });
    const before=JSON.stringify(Array.isArray(base.tests)?base.tests:[]);
    base.tests=tests;
    if(JSON.stringify(tests)!==before)base.updatedAt=new Date().toISOString();
    return base;
  }

  function normalizeCode(v){
    return String(v||'').toUpperCase().replace(/[^0-9A-F]/g,'');
  }

  function prettyCode(v){
    const s=normalizeCode(v);
    return s.match(/.{1,4}/g)?.join('-') || s;
  }

  function configReady(){
    return /^https:\/\//.test(SUPABASE_URL) && SUPABASE_KEY.startsWith('sb_publishable_');
  }

  function loadScript(src){
    return new Promise((resolve,reject)=>{
      const existing=[...document.scripts].find(s=>s.src===src);
      if(existing && window.supabase){resolve();return;}
      const s=document.createElement('script');
      s.src=src;s.async=true;s.onload=resolve;s.onerror=reject;
      document.head.appendChild(s);
    });
  }

  function injectUI(){
    if(document.getElementById('cloudShareBtn'))return;
    const topbar=document.querySelector('.topbar');
    if(!topbar)return;

    const wrap=document.createElement('div');
    wrap.className='cloud-sync-top';
    wrap.innerHTML='<button id="cloudShareBtn" type="button" class="ghost cloud-sync-btn"><span id="cloudShareDot" class="cloud-dot local"></span><span id="cloudShareLabel">端末保存</span></button>';
    const newProjectBtn=document.getElementById('newProjectBtn');
    if(newProjectBtn)topbar.insertBefore(wrap,newProjectBtn);else topbar.appendChild(wrap);

    const d=document.createElement('dialog');
    d.id='cloudShareDialog';d.className='cloud-dialog';
    d.innerHTML='<div class="cloud-box"><div class="dialog-head"><div><p class="eyebrow">SOILNOTE SHARE</p><h2>データ共有</h2></div><button id="cloudShareClose" type="button" class="icon-btn">×</button></div><div id="cloudShareBody"></div></div>';
    document.body.appendChild(d);

    if(!document.getElementById('cloudShareStyle')){
      const s=document.createElement('style');s.id='cloudShareStyle';s.textContent=`
        .cloud-sync-top{margin-left:auto;margin-right:8px}.cloud-sync-btn{display:flex;align-items:center;gap:7px;white-space:nowrap}.cloud-dot{width:9px;height:9px;border-radius:50%;display:inline-block;background:#98a2b3}.cloud-dot.online{background:#12b76a}.cloud-dot.syncing{background:#f79009}.cloud-dot.error{background:#f04438}.cloud-dialog{width:min(520px,calc(100% - 24px));border:0;border-radius:18px;padding:0}.cloud-dialog::backdrop{background:rgba(0,0,0,.35)}.cloud-box{padding:20px}.cloud-card{border:1px solid var(--line,#dfe7e3);border-radius:14px;padding:14px;margin-top:12px;background:#f8faf9}.cloud-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.cloud-actions button{flex:1;min-width:120px}.cloud-status{font-size:12px;color:var(--muted,#68766e);margin-top:8px;line-height:1.6}.cloud-code{font-size:23px;letter-spacing:2px;font-weight:800;color:var(--accent-dark,#0b5136);text-align:center;padding:12px 8px;background:#fff;border-radius:10px;border:1px dashed var(--line,#dfe7e3);word-break:break-all}.cloud-error{color:#b42318;font-weight:700}.cloud-ok{color:#067647;font-weight:700}.cloud-note{background:#eef8f2;border-radius:10px;padding:10px;font-size:12px;line-height:1.6;margin-top:10px}@media(max-width:560px){.topbar{flex-wrap:wrap}.cloud-sync-top{order:3;width:100%;margin:6px 0 0}.cloud-sync-btn{width:100%;justify-content:center}.cloud-code{font-size:18px;letter-spacing:1px}}
      `;document.head.appendChild(s);
    }

    document.getElementById('cloudShareBtn').addEventListener('click',()=>{renderDialog();d.showModal();});
    document.getElementById('cloudShareClose').addEventListener('click',()=>d.close());
  }

  function setTopStatus(kind,label){
    const dot=document.getElementById('cloudShareDot');
    const text=document.getElementById('cloudShareLabel');
    if(dot)dot.className=`cloud-dot ${kind}`;
    if(text)text.textContent=label;
    const hint=document.querySelector('#projectView .section-head p');
    if(hint)hint.textContent=workspace?'クラウド共有＋端末にも保存':'端末内に保存されます';
  }

  function message(text,type=''){
    const el=document.getElementById('cloudShareMessage');
    if(!el)return;
    el.className=`cloud-status ${type==='error'?'cloud-error':type==='ok'?'cloud-ok':''}`;
    el.textContent=text||'';
  }

  function renderDialog(){
    const body=document.getElementById('cloudShareBody');if(!body)return;
    if(!configReady()){
      body.innerHTML='<div class="cloud-card"><strong>クラウド設定エラー</strong><p class="cloud-status">共有設定を読み込めませんでした。端末データは残っています。</p></div>';
      return;
    }

    if(!workspace){
      body.innerHTML=`
        <div class="cloud-note">メールアドレス・パスワードは不要です。<br>最初の端末で共有を作り、もう1台は表示された共有コードで参加します。</div>
        <div class="cloud-card"><strong>① この端末から共有を作る</strong><label>共有名<input id="cloudShareName" autocomplete="off" value="土質試験室" placeholder="例：土質試験室"></label><div class="cloud-actions"><button id="cloudShareCreate" class="primary" type="button">共有を作る</button></div></div>
        <div class="cloud-card"><strong>② 共有コードで参加する</strong><label>共有コード<input id="cloudShareJoinCode" autocomplete="off" autocapitalize="characters" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"></label><div class="cloud-actions"><button id="cloudShareJoin" class="primary secondary" type="button">参加する</button></div></div>
        <p id="cloudShareMessage" class="cloud-status"></p>`;
      document.getElementById('cloudShareCreate').onclick=createWorkspace;
      document.getElementById('cloudShareJoin').onclick=joinWorkspace;
      return;
    }

    body.innerHTML=`
      <div class="cloud-card"><strong>${esc(workspace.name)}</strong><p class="cloud-status">もう1台の端末には、この共有コードを入力してください。</p><div class="cloud-code">${esc(prettyCode(shareCode))}</div></div>
      <div class="cloud-card"><strong>同期状態</strong><p class="cloud-status">端末にも保存しながら共有します。保存後は自動同期し、定期的にも更新を確認します。</p><div class="cloud-actions"><button id="cloudShareSyncNow" type="button" class="primary">今すぐ同期</button></div><p id="cloudShareMessage" class="cloud-status"></p></div>
      <div class="cloud-actions"><button id="cloudShareDisconnect" type="button" class="ghost">この端末の共有を解除</button></div>`;
    document.getElementById('cloudShareSyncNow').onclick=()=>syncNow(true);
    document.getElementById('cloudShareDisconnect').onclick=disconnect;
  }

  async function createWorkspace(){
    const name=document.getElementById('cloudShareName')?.value.trim()||'土質試験室';
    message('共有を作成中…');
    const {data,error}=await client.rpc('soilnote_share_create',{p_name:name});
    if(error){message('共有を作成できませんでした。','error');return;}
    const row=Array.isArray(data)?data[0]:data;
    if(!row?.share_code){message('共有コードを取得できませんでした。','error');return;}
    shareCode=normalizeCode(row.share_code);
    workspace={id:row.workspace_id,name:row.workspace_name||name};
    localStorage.setItem(SHARE_KEY,shareCode);
    startPolling();
    setTopStatus('online',`共有：${workspace.name}`);
    await syncNow(true);
    renderDialog();
  }

  async function joinWorkspace(){
    const code=normalizeCode(document.getElementById('cloudShareJoinCode')?.value);
    if(code.length!==20){message('共有コードを確認してください。','error');return;}
    message('共有を確認中…');
    const {data,error}=await client.rpc('soilnote_share_info',{p_code:code});
    const row=Array.isArray(data)?data[0]:data;
    if(error||!row?.workspace_id){message('共有コードが違います。','error');return;}
    shareCode=code;
    workspace={id:row.workspace_id,name:row.workspace_name||'共有'};
    localStorage.setItem(SHARE_KEY,shareCode);
    startPolling();
    setTopStatus('online',`共有：${workspace.name}`);
    await syncNow(true);
    renderDialog();
  }

  function disconnect(){
    localStorage.removeItem(SHARE_KEY);
    shareCode='';workspace=null;stopPolling();
    setTopStatus('local','端末保存');
    renderDialog();
  }

  async function loadWorkspace(){
    const code=normalizeCode(localStorage.getItem(SHARE_KEY));
    if(code.length!==20){shareCode='';workspace=null;setTopStatus('local','端末保存');return;}
    const {data,error}=await client.rpc('soilnote_share_info',{p_code:code});
    const row=Array.isArray(data)?data[0]:data;
    if(error||!row?.workspace_id){localStorage.removeItem(SHARE_KEY);shareCode='';workspace=null;setTopStatus('local','端末保存');return;}
    shareCode=code;workspace={id:row.workspace_id,name:row.workspace_name||'共有'};
    setTopStatus('online',`共有：${workspace.name}`);
    startPolling();
  }

  function localProjects(){
    try{return Array.isArray(state?.data?.projects)?state.data.projects:[];}catch{return [];}
  }

  async function uploadProject(p){
    const stamp=projectStamp(p)||Date.now();
    const {error}=await client.rpc('soilnote_share_upsert',{
      p_code:shareCode,
      p_project_id:String(p.id),
      p_payload:p,
      p_updated_at:new Date(stamp).toISOString()
    });
    if(error)throw error;
  }

  async function syncNow(showMessage=false){
    if(!client||!workspace||!shareCode||syncing)return;
    syncing=true;
    if(showMessage){setTopStatus('syncing','同期中…');message('同期中…');}
    try{
      const {data:rows,error}=await client.rpc('soilnote_share_projects',{p_code:shareCode});
      if(error)throw error;
      const local=localProjects();
      const localMap=new Map(local.map(p=>[String(p.id),p]));
      const remoteMap=new Map((rows||[]).map(r=>[String(r.project_id),r]));
      let localChanged=false;
      const uploads=[];

      for(const row of rows||[]){
        const id=String(row.project_id);const lp=localMap.get(id);const remoteTime=timeOf(row.updated_at);
        if(row.deleted_at){
          if(lp&&projectStamp(lp)>remoteTime){uploads.push(lp);}
          else if(lp){const idx=local.findIndex(p=>String(p.id)===id);if(idx>=0)local.splice(idx,1);localMap.delete(id);localChanged=true;}
          continue;
        }
        if(!lp){if(row.payload){const rp=clone(row.payload);local.push(rp);localMap.set(id,rp);localChanged=true;}continue;}
        const merged=mergeProjects(lp,row.payload);
        if(JSON.stringify(merged)!==JSON.stringify(lp)){
          const idx=local.findIndex(p=>String(p.id)===id);if(idx>=0)local[idx]=merged;localMap.set(id,merged);localChanged=true;
        }
        if(JSON.stringify(merged)!==JSON.stringify(row.payload))uploads.push(merged);
      }

      for(const p of local){if(!remoteMap.has(String(p.id)))uploads.push(p);}

      if(localChanged){
        originalSaveData?.();
        try{renderProjects();if(state.currentProjectId)renderTests();}catch{}
      }

      const unique=[...new Map(uploads.map(p=>[String(p.id),p])).values()];
      for(const p of unique)await uploadProject(p);

      setTopStatus('online',`共有：${workspace.name}`);
      if(showMessage)message(`同期完了（工事 ${local.length}件）`,'ok');
    }catch(err){
      console.error('[SoilNote Share] sync',err);
      setTopStatus('error','同期エラー');
      if(showMessage)message('同期に失敗しました。通信状態を確認してください。','error');
    }finally{syncing=false;}
  }

  function queueSync(){
    if(!workspace||!shareCode)return;
    clearTimeout(saveTimer);saveTimer=setTimeout(()=>syncNow(false),700);
  }

  async function deleteCloudProject(projectId){
    if(!client||!workspace||!shareCode||!projectId)return;
    const now=new Date().toISOString();
    const {error}=await client.rpc('soilnote_share_delete',{p_code:shareCode,p_project_id:String(projectId),p_updated_at:now});
    if(error)console.error('[SoilNote Share] delete',error);
  }

  function installSaveHook(){
    if(typeof saveData!=='function'||originalSaveData)return;
    originalSaveData=saveData;
    saveData=function(){originalSaveData();queueSync();};
    document.addEventListener('click',e=>{
      if(!e.target.closest?.('#deleteProjectBtn'))return;
      let id=null;try{id=state.currentProjectId;}catch{}
      if(!id)return;
      setTimeout(()=>{
        const exists=localProjects().some(p=>String(p.id)===String(id));
        if(!exists)deleteCloudProject(id);
      },80);
    },true);
  }

  function startPolling(){
    stopPolling();
    pollTimer=setInterval(()=>{if(document.visibilityState==='visible')syncNow(false);},10000);
  }

  function stopPolling(){
    if(pollTimer){clearInterval(pollTimer);pollTimer=null;}
  }

  async function boot(){
    injectUI();installSaveHook();
    if(!configReady()){setTopStatus('error','共有設定エラー');return;}
    try{
      if(!window.supabase)await loadScript(CDN);
      if(!window.supabase?.createClient)throw new Error('Supabase SDKを読み込めませんでした');
      client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
      await loadWorkspace();
      if(workspace)await syncNow(false);
      document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&workspace)syncNow(false);});
      window.addEventListener('focus',()=>{if(workspace)syncNow(false);});
    }catch(err){
      console.error('[SoilNote Share] boot',err);
      setTopStatus('error','共有設定エラー');
    }
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
