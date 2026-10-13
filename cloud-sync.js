// SoilNote Cloud Sync (Supabase)
// Local-first: localStorage remains the offline source; cloud sync shares data between users.
(function(){
  'use strict';

  const CONFIG = window.SOILNOTE_SUPABASE || {};
  const SUPABASE_URL = String(CONFIG.url || '').trim();
  const SUPABASE_KEY = String(CONFIG.publishableKey || CONFIG.anonKey || '').trim();
  const WORKSPACE_KEY = 'soilnote-workspace-id-v1';
  const SUPABASE_JS_VERSION = '2.117.3';
  const CDN = `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@${SUPABASE_JS_VERSION}`;

  let client = null;
  let session = null;
  let workspace = null;
  let channel = null;
  let syncing = false;
  let saveTimer = null;
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

  function rowStamp(row){
    return Math.max(projectStamp(row?.payload), timeOf(row?.updated_at), timeOf(row?.deleted_at));
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
    if(document.getElementById('cloudSyncBtn'))return;
    const topbar=document.querySelector('.topbar');
    if(!topbar)return;

    const wrap=document.createElement('div');
    wrap.className='cloud-sync-top';
    wrap.innerHTML='<button id="cloudSyncBtn" type="button" class="ghost cloud-sync-btn"><span id="cloudSyncDot" class="cloud-dot local"></span><span id="cloudSyncLabel">端末保存</span></button>';
    const newProjectBtn=document.getElementById('newProjectBtn');
    if(newProjectBtn)topbar.insertBefore(wrap,newProjectBtn);else topbar.appendChild(wrap);

    const d=document.createElement('dialog');
    d.id='cloudSyncDialog';d.className='cloud-dialog';
    d.innerHTML='<div class="cloud-box"><div class="dialog-head"><div><p class="eyebrow">SOILNOTE CLOUD</p><h2>データ共有</h2></div><button id="cloudClose" type="button" class="icon-btn">×</button></div><div id="cloudBody"></div></div>';
    document.body.appendChild(d);

    if(!document.getElementById('cloudSyncStyle')){
      const s=document.createElement('style');s.id='cloudSyncStyle';s.textContent=`
        .cloud-sync-top{margin-left:auto;margin-right:8px}.cloud-sync-btn{display:flex;align-items:center;gap:7px;white-space:nowrap}.cloud-dot{width:9px;height:9px;border-radius:50%;display:inline-block;background:#98a2b3}.cloud-dot.online{background:#12b76a}.cloud-dot.syncing{background:#f79009}.cloud-dot.error{background:#f04438}.cloud-dialog{width:min(520px,calc(100% - 24px));border:0;border-radius:18px;padding:0}.cloud-dialog::backdrop{background:rgba(0,0,0,.35)}.cloud-box{padding:20px}.cloud-card{border:1px solid var(--line,#dfe7e3);border-radius:14px;padding:14px;margin-top:12px;background:#f8faf9}.cloud-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.cloud-actions button{flex:1;min-width:120px}.cloud-status{font-size:12px;color:var(--muted,#68766e);margin-top:8px;line-height:1.6}.cloud-code{font-size:27px;letter-spacing:4px;font-weight:800;color:var(--accent-dark,#0b5136);text-align:center;padding:10px;background:#fff;border-radius:10px;border:1px dashed var(--line,#dfe7e3)}.cloud-user{font-size:12px;color:var(--muted,#68766e);word-break:break-all}.cloud-error{color:#b42318;font-weight:700}.cloud-ok{color:#067647;font-weight:700}@media(max-width:560px){.topbar{flex-wrap:wrap}.cloud-sync-top{order:3;width:100%;margin:6px 0 0}.cloud-sync-btn{width:100%;justify-content:center}}
      `;document.head.appendChild(s);
    }
    document.getElementById('cloudSyncBtn').addEventListener('click',()=>{renderDialog();d.showModal();});
    document.getElementById('cloudClose').addEventListener('click',()=>d.close());
  }

  function setTopStatus(kind,label){
    const dot=document.getElementById('cloudSyncDot');
    const text=document.getElementById('cloudSyncLabel');
    if(dot)dot.className=`cloud-dot ${kind}`;
    if(text)text.textContent=label;
    const hint=document.querySelector('#projectView .section-head p');
    if(hint)hint.textContent=workspace?'クラウド共有＋端末にも保存':'端末内に保存されます';
  }

  function message(text,type=''){
    const el=document.getElementById('cloudMessage');
    if(!el)return;
    el.className=`cloud-status ${type==='error'?'cloud-error':type==='ok'?'cloud-ok':''}`;
    el.textContent=text||'';
  }

  function configReady(){return /^https:\/\//.test(SUPABASE_URL)&&SUPABASE_KEY.startsWith('sb_publishable_');}

  function renderDialog(){
    const body=document.getElementById('cloudBody');if(!body)return;
    if(!configReady()){
      body.innerHTML='<div class="cloud-card"><strong>クラウド設定待ち</strong><p class="cloud-status">Supabaseの設定が完了すると共有を開始できます。端末データはそのまま残ります。</p></div>';
      return;
    }
    if(!session){
      body.innerHTML=`<div class="cloud-card"><strong>ログイン</strong><p class="cloud-status">それぞれ自分のメールアドレスで登録・ログインします。</p><label>メールアドレス<input id="cloudEmail" type="email" autocomplete="email"></label><label>パスワード<input id="cloudPassword" type="password" autocomplete="current-password"></label><div class="cloud-actions"><button id="cloudLogin" class="primary" type="button">ログイン</button><button id="cloudSignup" class="ghost" type="button">初回登録</button></div><p id="cloudMessage" class="cloud-status"></p></div>`;
      document.getElementById('cloudLogin').onclick=signIn;document.getElementById('cloudSignup').onclick=signUp;return;
    }
    if(!workspace){
      body.innerHTML=`<p class="cloud-user">ログイン中：${esc(session.user?.email||'')}</p><div class="cloud-card"><strong>新しい共有スペースを作る</strong><label>共有名<input id="cloudWorkspaceName" autocomplete="off" placeholder="例：土質試験室"></label><div class="cloud-actions"><button id="cloudCreateWorkspace" type="button" class="primary">作成</button></div></div><div class="cloud-card"><strong>共有コードで参加</strong><label>8桁の共有コード<input id="cloudJoinCode" autocomplete="off" autocapitalize="characters" maxlength="8" placeholder="AB12CD34"></label><div class="cloud-actions"><button id="cloudJoinWorkspace" type="button" class="primary secondary">参加</button></div></div><p id="cloudMessage" class="cloud-status"></p><div class="cloud-actions"><button id="cloudLogout" type="button" class="ghost">ログアウト</button></div>`;
      document.getElementById('cloudCreateWorkspace').onclick=createWorkspace;document.getElementById('cloudJoinWorkspace').onclick=joinWorkspace;document.getElementById('cloudLogout').onclick=signOut;return;
    }
    body.innerHTML=`<p class="cloud-user">${esc(session.user?.email||'')}</p><div class="cloud-card"><strong>${esc(workspace.name)}</strong><p class="cloud-status">このコードを共有相手に伝えてください。</p><div class="cloud-code">${esc(workspace.join_code)}</div></div><div class="cloud-card"><strong>同期状態</strong><p class="cloud-status">端末にも保存しつつ、クラウドへ同期します。別端末で追加した試験は自動でマージします。</p><div class="cloud-actions"><button id="cloudSyncNow" type="button" class="primary">今すぐ同期</button></div><p id="cloudMessage" class="cloud-status"></p></div><div class="cloud-actions"><button id="cloudLeaveDevice" type="button" class="ghost">この端末の共有解除</button><button id="cloudLogout" type="button" class="ghost">ログアウト</button></div>`;
    document.getElementById('cloudSyncNow').onclick=()=>syncNow(true);document.getElementById('cloudLeaveDevice').onclick=clearWorkspaceOnDevice;document.getElementById('cloudLogout').onclick=signOut;
  }

  async function signIn(){
    const email=document.getElementById('cloudEmail')?.value.trim();const password=document.getElementById('cloudPassword')?.value||'';
    if(!email||!password){message('メールアドレスとパスワードを入力してください。','error');return;}
    message('ログイン中…');const {error}=await client.auth.signInWithPassword({email,password});if(error){message(error.message,'error');return;}message('ログインしました。','ok');
  }

  async function signUp(){
    const email=document.getElementById('cloudEmail')?.value.trim();const password=document.getElementById('cloudPassword')?.value||'';
    if(!email||password.length<8){message('メールアドレスと8文字以上のパスワードを入力してください。','error');return;}
    message('登録中…');const {data,error}=await client.auth.signUp({email,password});if(error){message(error.message,'error');return;}if(data.session)message('登録・ログインしました。','ok');else message('確認メールを送信しました。メール内のリンクを開いてからログインしてください。','ok');
  }

  async function signOut(){
    await client.auth.signOut();session=null;workspace=null;localStorage.removeItem(WORKSPACE_KEY);stopRealtime();setTopStatus('local','端末保存');renderDialog();
  }

  async function createWorkspace(){
    const name=document.getElementById('cloudWorkspaceName')?.value.trim();if(!name){message('共有名を入力してください。','error');return;}
    message('共有スペースを作成中…');const {data,error}=await client.rpc('create_workspace',{p_name:name});if(error){message(error.message,'error');return;}
    const id=data?.[0]?.workspace_id;if(!id){message('共有スペースを取得できませんでした。','error');return;}localStorage.setItem(WORKSPACE_KEY,id);await loadWorkspace();await syncNow(true);renderDialog();
  }

  async function joinWorkspace(){
    const code=document.getElementById('cloudJoinCode')?.value.trim().toUpperCase();if(!/^[0-9A-F]{8}$/.test(code||'')){message('8桁の共有コードを確認してください。','error');return;}
    message('参加中…');const {data,error}=await client.rpc('join_workspace',{p_code:code});if(error){message('共有コードを確認してください。','error');return;}localStorage.setItem(WORKSPACE_KEY,data);await loadWorkspace();await syncNow(true);renderDialog();
  }

  function clearWorkspaceOnDevice(){localStorage.removeItem(WORKSPACE_KEY);workspace=null;stopRealtime();setTopStatus('online','ログイン済み');renderDialog();}

  async function loadWorkspace(){
    if(!session){workspace=null;return;}
    const saved=localStorage.getItem(WORKSPACE_KEY);let q=client.from('workspaces').select('id,name,join_code,created_at').order('created_at',{ascending:true});if(saved)q=q.eq('id',saved);
    const {data,error}=await q;if(error){console.error('[SoilNote Cloud] workspace',error);workspace=null;return;}workspace=(data||[])[0]||null;
    if(workspace){localStorage.setItem(WORKSPACE_KEY,workspace.id);startRealtime();setTopStatus('online',`共有：${workspace.name}`);}else setTopStatus('online','ログイン済み');
  }

  function localProjects(){try{return Array.isArray(state?.data?.projects)?state.data.projects:[];}catch{return [];}}

  async function syncNow(showMessage=false){
    if(!client||!session||!workspace||syncing)return;
    syncing=true;setTopStatus('syncing','同期中…');if(showMessage)message('同期中…');
    try{
      const {data:rows,error}=await client.from('projects').select('project_id,payload,updated_at,updated_by,deleted_at').eq('workspace_id',workspace.id);if(error)throw error;
      const local=localProjects();const localMap=new Map(local.map(p=>[String(p.id),p]));const cloudMap=new Map((rows||[]).map(r=>[String(r.project_id),r]));let localChanged=false;const uploads=[];

      for(const row of rows||[]){
        const id=String(row.project_id);const lp=localMap.get(id);
        if(row.deleted_at){
          if(lp&&projectStamp(lp)>rowStamp(row)){uploads.push(lp);}else if(lp){const idx=local.findIndex(p=>String(p.id)===id);if(idx>=0)local.splice(idx,1);localMap.delete(id);localChanged=true;}
          continue;
        }
        if(!lp){if(row.payload){const rp=clone(row.payload);local.push(rp);localMap.set(id,rp);localChanged=true;}continue;}
        const merged=mergeProjects(lp,row.payload);
        if(JSON.stringify(merged)!==JSON.stringify(lp)){const idx=local.findIndex(p=>String(p.id)===id);if(idx>=0)local[idx]=merged;localMap.set(id,merged);localChanged=true;}
        if(JSON.stringify(merged)!==JSON.stringify(row.payload))uploads.push(merged);
      }

      for(const p of local){if(!cloudMap.has(String(p.id)))uploads.push(p);}

      if(localChanged){originalSaveData?.();try{renderProjects();if(state.currentProjectId)renderTests();}catch{}}

      if(uploads.length){
        const unique=[...new Map(uploads.map(p=>[String(p.id),p])).values()];
        const payload=unique.map(p=>({workspace_id:workspace.id,project_id:String(p.id),payload:p,updated_at:p.updatedAt||p.createdAt||new Date().toISOString(),updated_by:session.user.id,deleted_at:null}));
        const {error:upError}=await client.from('projects').upsert(payload,{onConflict:'workspace_id,project_id'});if(upError)throw upError;
      }

      setTopStatus('online',`共有：${workspace.name}`);if(showMessage)message(`同期完了（工事 ${local.length}件）`,'ok');
    }catch(err){console.error('[SoilNote Cloud] sync',err);setTopStatus('error','同期エラー');if(showMessage)message(err?.message||'同期に失敗しました。','error');}
    finally{syncing=false;}
  }

  function queueSync(){if(!workspace||!session)return;clearTimeout(saveTimer);saveTimer=setTimeout(()=>syncNow(false),500);}

  async function deleteCloudProject(projectId){
    if(!client||!session||!workspace||!projectId)return;const now=new Date().toISOString();
    const {error}=await client.from('projects').update({deleted_at:now,updated_at:now,updated_by:session.user.id}).eq('workspace_id',workspace.id).eq('project_id',String(projectId));if(error)console.error('[SoilNote Cloud] delete',error);
  }

  function startRealtime(){
    stopRealtime();if(!workspace||!client)return;
    channel=client.channel(`soilnote-${workspace.id}`).on('postgres_changes',{event:'*',schema:'public',table:'projects',filter:`workspace_id=eq.${workspace.id}`},()=>{if(!syncing)setTimeout(()=>syncNow(false),250);}).subscribe();
  }

  function stopRealtime(){if(channel&&client)client.removeChannel(channel).catch(()=>{});channel=null;}

  function installSaveHook(){
    if(typeof saveData!=='function'||originalSaveData)return;originalSaveData=saveData;saveData=function(){originalSaveData();queueSync();};
    document.addEventListener('click',e=>{if(!e.target.closest?.('#deleteProjectBtn'))return;let id=null;try{id=state.currentProjectId;}catch{}if(!id)return;setTimeout(()=>{const exists=localProjects().some(p=>String(p.id)===String(id));if(!exists)deleteCloudProject(id);},50);},true);
  }

  async function boot(){
    injectUI();installSaveHook();if(!configReady()){setTopStatus('local','端末保存');return;}
    try{
      if(!window.supabase)await loadScript(CDN);if(!window.supabase?.createClient)throw new Error('Supabase SDKを読み込めませんでした');
      client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      const {data}=await client.auth.getSession();session=data.session||null;
      client.auth.onAuthStateChange((_event,next)=>{session=next||null;if(!session){workspace=null;stopRealtime();setTopStatus('local','端末保存');renderDialog();return;}setTimeout(async()=>{await loadWorkspace();if(workspace)await syncNow(false);renderDialog();},0);});
      if(session){await loadWorkspace();if(workspace)await syncNow(false);}else setTopStatus('local','端末保存');
    }catch(err){console.error('[SoilNote Cloud] boot',err);setTopStatus('error','クラウド設定エラー');}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();