// SoilNote collaborative edit lock
// Prevents two devices from editing the same existing test at the same time.
(function(){
  'use strict';

  const CONFIG = window.SOILNOTE_SUPABASE || {};
  const SUPABASE_URL = String(CONFIG.url || '').trim();
  const SUPABASE_KEY = String(CONFIG.publishableKey || CONFIG.anonKey || '').trim();
  const SHARE_KEY = 'soilnote-share-code-v2';
  const NAME_KEY = 'soilnote-editor-name-v1';
  const DEVICE_KEY = 'soilnote-device-id-v1';
  const SUPABASE_JS_VERSION = '2.117.3';
  const CDN = `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@${SUPABASE_JS_VERSION}`;

  let client = null;
  let activeLock = null;
  let activeDialog = null;
  let heartbeatTimer = null;
  let refreshTimer = null;
  let lastLocks = [];
  const bypassButtons = new WeakSet();
  const bypassForms = new WeakSet();

  function normalizeCode(v){
    return String(v||'').toUpperCase().replace(/[^0-9A-F]/g,'');
  }

  function shareCode(){
    const code=normalizeCode(localStorage.getItem(SHARE_KEY));
    return code.length===20?code:'';
  }

  function deviceId(){
    let id=localStorage.getItem(DEVICE_KEY);
    if(!id){
      id=`device-${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem(DEVICE_KEY,id);
    }
    return id;
  }

  function editorName(ask=false){
    let name=String(localStorage.getItem(NAME_KEY)||'').trim();
    if(name||!ask)return name;
    name=String(window.prompt('この端末を使う人の名前を入力してください。\n例：吉村、後輩')||'').trim().slice(0,60);
    if(name)localStorage.setItem(NAME_KEY,name);
    return name;
  }

  function currentProjectId(){
    try{return String(state?.currentProjectId||'');}catch{return '';}
  }

  function targetFromButton(button){
    if(!button)return null;
    for(const attr of [...button.attributes]){
      if(attr.name.startsWith('data-edit-')&&attr.value){
        return {projectId:currentProjectId(),testId:String(attr.value)};
      }
    }
    const explicit=button.getAttribute('data-test-id');
    return explicit?{projectId:currentProjectId(),testId:String(explicit)}:null;
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

  function ensureStyle(){
    if(document.getElementById('soilnoteEditLockStyle'))return;
    const style=document.createElement('style');
    style.id='soilnoteEditLockStyle';
    style.textContent=`
      .edit-locked{opacity:.78!important;cursor:not-allowed!important;background:#fff3e8!important;color:#9a3412!important;border-color:#fdba74!important}
    `;
    document.head.appendChild(style);
  }

  async function rpc(name,args){
    if(!client)throw new Error('lock client unavailable');
    return client.rpc(name,args);
  }

  async function acquireLock(projectId,testId,quiet=false){
    const code=shareCode();
    if(!code||!projectId||!testId)return {acquired:true,localOnly:true};
    const name=editorName(!quiet);
    if(!name){
      if(!quiet)window.alert('編集者名を入力しないと共有編集中のロックを開始できません。');
      return {acquired:false,cancelled:true};
    }
    const {data,error}=await rpc('soilnote_lock_acquire',{
      p_code:code,
      p_project_id:String(projectId),
      p_test_id:String(testId),
      p_device_id:deviceId(),
      p_display_name:name
    });
    if(error){
      console.error('[SoilNote Lock] acquire',error);
      if(!quiet)window.alert('編集中ロックの確認に失敗しました。通信状態を確認してください。');
      return {acquired:false,error};
    }
    const row=Array.isArray(data)?data[0]:data;
    if(!row)return {acquired:false};
    return {
      acquired:!!row.acquired,
      holderName:String(row.holder_name||''),
      holderDeviceId:String(row.holder_device_id||''),
      expiresAt:row.expires_at
    };
  }

  async function releaseLock(lock=activeLock){
    if(!lock)return;
    if(activeLock===lock)activeLock=null;
    stopHeartbeat();
    const code=shareCode();
    if(!code)return;
    try{
      await rpc('soilnote_lock_release',{
        p_code:code,
        p_project_id:String(lock.projectId),
        p_test_id:String(lock.testId),
        p_device_id:deviceId()
      });
    }catch(err){console.warn('[SoilNote Lock] release',err);}
    refreshLocks();
  }

  function startHeartbeat(){
    stopHeartbeat();
    heartbeatTimer=setInterval(()=>renewActiveLock(false),30000);
  }

  function stopHeartbeat(){
    if(heartbeatTimer){clearInterval(heartbeatTimer);heartbeatTimer=null;}
  }

  async function renewActiveLock(showLoss=true){
    const lock=activeLock;
    if(!lock)return true;
    const result=await acquireLock(lock.projectId,lock.testId,true);
    if(result.acquired)return true;
    activeLock=null;
    stopHeartbeat();
    if(showLoss){
      const who=result.holderName?`${result.holderName}さんが`:'別の端末が';
      window.alert(`編集権限が切り替わりました。\n${who}この試験を編集中です。\nこの画面からの保存はできません。`);
    }
    if(activeDialog?.open){
      activeDialog.querySelectorAll('input,select,textarea').forEach(el=>{el.disabled=true;});
      activeDialog.querySelectorAll('button[type="submit"],button[value="default"]').forEach(el=>{el.disabled=true;});
    }
    await refreshLocks();
    return false;
  }

  function attachDialogRelease(){
    setTimeout(()=>{
      const dialogs=[...document.querySelectorAll('dialog[open]')].filter(d=>d.id!=='cloudShareDialog');
      activeDialog=dialogs[dialogs.length-1]||null;
      if(!activeDialog)return;
      const d=activeDialog;
      const onClose=()=>{
        if(activeDialog===d)activeDialog=null;
        releaseLock();
      };
      d.addEventListener('close',onClose,{once:true});
    },0);
  }

  async function handleEditClick(e){
    const button=e.target.closest?.('button');
    if(!button)return;
    const target=targetFromButton(button);
    if(!target?.projectId||!target?.testId)return;
    if(!shareCode())return;
    if(bypassButtons.has(button)){bypassButtons.delete(button);return;}

    e.preventDefault();
    e.stopImmediatePropagation();

    const result=await acquireLock(target.projectId,target.testId,false);
    if(!result.acquired){
      if(!result.cancelled&&!result.error){
        const who=result.holderName||'別のユーザー';
        window.alert(`${who}さんがこの試験を編集中です。\n相手が閉じるまで、この試験は訂正できません。`);
      }
      await refreshLocks();
      return;
    }

    activeLock={projectId:target.projectId,testId:target.testId};
    startHeartbeat();
    bypassButtons.add(button);
    button.click();
    attachDialogRelease();
    refreshLocks();
  }

  async function handleSubmit(e){
    if(!activeLock||!shareCode())return;
    const form=e.target;
    if(!(form instanceof HTMLFormElement))return;
    if(activeDialog&&!activeDialog.contains(form))return;
    if(bypassForms.has(form)){bypassForms.delete(form);return;}

    e.preventDefault();
    e.stopImmediatePropagation();
    const submitter=e.submitter||null;
    const ok=await renewActiveLock(true);
    if(!ok)return;
    bypassForms.add(form);
    if(submitter&&typeof form.requestSubmit==='function')form.requestSubmit(submitter);
    else if(typeof form.requestSubmit==='function')form.requestSubmit();
  }

  async function refreshLocks(){
    const code=shareCode();
    if(!client||!code){lastLocks=[];applyLockUI();return;}
    try{
      const {data,error}=await rpc('soilnote_lock_list',{p_code:code});
      if(error)throw error;
      lastLocks=Array.isArray(data)?data:[];
      applyLockUI();
    }catch(err){console.warn('[SoilNote Lock] list',err);}
  }

  function applyLockUI(){
    const mine=deviceId();
    document.querySelectorAll('button').forEach(button=>{
      const target=targetFromButton(button);
      if(!target?.testId)return;
      if(!button.dataset.lockOriginalText)button.dataset.lockOriginalText=button.textContent||'訂正';
      const lock=lastLocks.find(l=>String(l.project_id)===String(target.projectId)&&String(l.test_id)===String(target.testId));
      const other=lock&&String(lock.device_id)!==mine;
      if(other){
        button.disabled=true;
        button.dataset.soilnoteLockDisabled='1';
        button.classList.add('edit-locked');
        const text=`${lock.display_name||'他端末'}さん編集中`;
        if(button.textContent!==text)button.textContent=text;
      }else if(button.dataset.soilnoteLockDisabled==='1'){
        button.disabled=false;
        delete button.dataset.soilnoteLockDisabled;
        button.classList.remove('edit-locked');
        const text=button.dataset.lockOriginalText||'訂正';
        if(button.textContent!==text)button.textContent=text;
      }
    });
  }

  function startRefresh(){
    if(refreshTimer)clearInterval(refreshTimer);
    refreshTimer=setInterval(()=>{if(document.visibilityState==='visible')refreshLocks();},5000);
  }

  async function boot(){
    ensureStyle();
    if(!/^https:\/\//.test(SUPABASE_URL)||!SUPABASE_KEY.startsWith('sb_publishable_'))return;
    try{
      if(!window.supabase?.createClient)await loadScript(CDN);
      client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
      deviceId();
      document.addEventListener('click',handleEditClick,true);
      document.addEventListener('submit',handleSubmit,true);
      document.addEventListener('visibilitychange',async()=>{
        if(document.visibilityState==='visible'){
          if(activeLock)await renewActiveLock(true);
          await refreshLocks();
        }
      });
      window.addEventListener('focus',()=>{if(activeLock)renewActiveLock(true);refreshLocks();});
      startRefresh();
      await refreshLocks();
    }catch(err){console.error('[SoilNote Lock] boot',err);}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
