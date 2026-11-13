// SoilNote: トップ画面の引き継ぎ・自由メモ (端末保存 + 共有コード同期)
(function(){
  'use strict';

  const STORAGE_KEY='soilnote-handover-memos-v1';
  const SHARE_KEY='soilnote-share-code-v2';
  const NAME_KEY='soilnote-editor-name-v1';
  const CONFIG=window.SOILNOTE_SUPABASE||{};
  const MAX_BODY=10000;
  let store=readStore();
  let currentScope='';
  let client=null;
  let syncing=false;
  let syncTimer=null;
  let editingId='';
  let section,form,list,status,saveButton,cancelButton;

  function readStore(){
    try{
      const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
      return parsed&&typeof parsed==='object'&&parsed.buckets&&typeof parsed.buckets==='object'?parsed:{buckets:{}};
    }catch{return {buckets:{}};}
  }
  function persist(){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(store));return true;}
    catch(e){console.error('[SoilNote Memo] local save',e);setStatus('端末への保存に失敗しました。空き容量を確認してください。','error');return false;}
  }
  function code(){
    const value=String(localStorage.getItem(SHARE_KEY)||'').toUpperCase().replace(/[^0-9A-F]/g,'');
    return value.length===20?value:'';
  }
  function scope(){return code()||'local';}
  function bucket(){return store.buckets[currentScope]||(store.buckets[currentScope]={});}
  function uid(){return 'memo-'+Date.now()+'-'+Math.random().toString(16).slice(2);}
  function escapeHTML(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));}
  function displayTime(iso){
    const d=new Date(iso||'');
    return Number.isNaN(d.getTime())?'日時不明':d.toLocaleString('ja-JP',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  }
  function setStatus(message,kind){
    if(!status)return;
    status.textContent=message;
    status.dataset.kind=kind||'';
  }
  function refreshScope(){
    const next=scope();
    if(next===currentScope)return;
    // ローカル時に作ったメモは初回の共有接続で引き継ぐ。
    if(next!=='local'&&!store.buckets[next]&&store.buckets.local){
      store.buckets[next]=JSON.parse(JSON.stringify(store.buckets.local));
      persist();
    }
    currentScope=next;
    editingId='';
    if(form){form.reset();form.elements.author.value=localStorage.getItem(NAME_KEY)||'';cancelButton.hidden=true;saveButton.textContent='メモを保存';}
    renderList();
    setStatus(next==='local'?'この端末に保存中。共有コードを設定すると他端末とも同期できます。':'共有メモの同期を確認中…');
  }
  function renderList(){
    if(!list)return;
    updateLauncherCount();
    const items=Object.values(bucket()).filter(x=>x&&!x.deletedAt&&x.body).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));
    if(!items.length){
      list.innerHTML='<p class="sn-memo-empty">まだメモがありません。引き継ぎや連絡事項などを自由に記録できます。</p>';
      return;
    }
    list.innerHTML=items.map(m=>{
      const title=String(m.title||'').trim()||String(m.body).split('\n').find(Boolean)?.slice(0,45)||'メモ';
      const author=m.author?' · '+escapeHTML(m.author):'';
      return '<article class="sn-memo-item" data-memo-id="'+escapeHTML(m.id)+'">'+
        '<div class="sn-memo-item-head"><strong>'+escapeHTML(title)+'</strong><span>'+escapeHTML(displayTime(m.updatedAt))+author+'</span></div>'+
        '<p class="sn-memo-body">'+escapeHTML(m.body)+'</p>'+
        '<div class="sn-memo-item-actions"><button type="button" data-memo-action="edit">編集</button><button type="button" class="sn-memo-delete" data-memo-action="delete">削除</button></div>'+
        '</article>';
    }).join('');
  }
  function resetEditor(){
    editingId='';
    form.reset();
    form.elements.author.value=localStorage.getItem(NAME_KEY)||'';
    saveButton.textContent='メモを保存';
    cancelButton.hidden=true;
  }
  function saveMemo(event){
    event.preventDefault();
    const title=String(form.elements.title.value||'').trim();
    const body=String(form.elements.body.value||'').trim();
    const author=String(form.elements.author.value||'').trim();
    if(!body){setStatus('メモ本文を入力してください。','error');form.elements.body.focus();return;}
    if(body.length>MAX_BODY){setStatus('本文は10,000文字以内で入力してください。','error');return;}
    if(title.length>120||author.length>60){setStatus('件名または記入者名が長すぎます。','error');return;}
    const id=editingId||uid();
    const now=new Date().toISOString();
    const prev=bucket()[id];
    bucket()[id]={id,title,body,author,createdAt:prev?.createdAt||now,updatedAt:now,deletedAt:null};
    if(!persist())return;
    if(author)localStorage.setItem(NAME_KEY,author);
    resetEditor();
    renderList();
    document.dispatchEvent(new CustomEvent('soilnote:memo-saved',{detail:{id,scope:currentScope}}));
    setStatus(currentScope==='local'?'端末に保存しました。':'端末に保存しました。クラウドへ同期中…','ok');
    queueSync();
  }
  function onListClick(event){
    const btn=event.target.closest('[data-memo-action]');
    if(!btn)return;
    const item=btn.closest('[data-memo-id]');
    const memo=item&&bucket()[item.dataset.memoId];
    if(!memo||memo.deletedAt)return;
    if(btn.dataset.memoAction==='edit'){
      editingId=memo.id;
      form.elements.title.value=memo.title||'';
      form.elements.body.value=memo.body||'';
      form.elements.author.value=memo.author||'';
      saveButton.textContent='変更を保存';
      cancelButton.hidden=false;
      form.scrollIntoView({behavior:'smooth',block:'center'});
      form.elements.body.focus({preventScroll:true});
      return;
    }
    if(btn.dataset.memoAction==='delete'){
      if(!window.confirm('このメモを削除しますか？\n共有中の場合は他の端末からも削除されます。'))return;
      bucket()[memo.id]={...memo,title:'',body:'',updatedAt:new Date().toISOString(),deletedAt:new Date().toISOString()};
      if(!persist())return;
      if(editingId===memo.id)resetEditor();
      renderList();
      document.dispatchEvent(new CustomEvent('soilnote:memo-deleted',{detail:{id:memo.id,scope:currentScope}}));
      setStatus('メモを削除しました。','ok');
      queueSync();
    }
  }

  function updateLauncherCount(){
    const counter=document.getElementById('soilnoteMemoCount');
    if(!counter)return;
    const count=Object.values(bucket()).filter(x=>x&&!x.deletedAt&&x.body).length;
    counter.textContent=count?count+'件':'';
    counter.hidden=!count;
  }

  function makeUI(){
    const host=document.getElementById('projectView');
    if(!host||document.getElementById('soilnoteMemoOpen'))return;

    // トップは一行のボタンだけ。入力と一覧は専用の全画面で表示する。
    const launcher=document.createElement('div');
    launcher.className='sn-memo-launcher';
    launcher.innerHTML='<button type="button" class="sn-memo-open" id="soilnoteMemoOpen" aria-haspopup="dialog"><span aria-hidden="true">📝</span><span>引き継ぎメモ</span><small id="soilnoteMemoCount" hidden></small><span class="sn-memo-chevron" aria-hidden="true">›</span></button>';
    host.insertBefore(launcher,host.firstChild);

    const dialog=document.createElement('dialog');
    dialog.id='soilnoteMemoBoard';
    dialog.className='sn-memo-dialog';
    dialog.setAttribute('aria-labelledby','soilnoteMemoPageTitle');
    dialog.innerHTML=[
      '<div class="sn-memo-page">',
      '<header class="sn-memo-page-header"><div class="sn-memo-header-inner">',
      '<button type="button" class="sn-memo-back" id="soilnoteMemoBack">← 戻る</button>',
      '<strong id="soilnoteMemoPageTitle">引き継ぎメモ</strong>',
      '</div></header>',
      '<div class="sn-memo-page-inner">',
      '<section class="sn-memo-board">',
      '<div class="sn-memo-heading"><div><p class="eyebrow">SHARED NOTES</p><h2>引き継ぎ・連絡メモ</h2><p>試験の引き継ぎや注意事項、その他のメモを自由に残せます。</p></div><span class="sn-memo-mark">📝</span></div>',
      '<form id="soilnoteMemoForm" class="sn-memo-form">',
      '<label>件名（任意）<input name="title" maxlength="120" autocomplete="off" placeholder="例：CBR試験の引き継ぎ"></label>',
      '<label>メモ本文<textarea name="body" maxlength="10000" rows="4" required placeholder="例：No.3は乾燥中。明日mbを測定してください。"></textarea></label>',
      '<div class="sn-memo-form-foot"><label>記入者（任意）<input name="author" maxlength="60" autocomplete="off" placeholder="例：吉村"></label>',
      '<div class="sn-memo-form-buttons"><button id="soilnoteMemoCancel" type="button" class="ghost" hidden>編集取消</button><button id="soilnoteMemoSave" class="primary" type="submit">メモを保存</button></div></div>',
      '</form>',
      '<div class="sn-memo-status" id="soilnoteMemoStatus" role="status"></div>',
      '<div class="sn-memo-list-heading"><h3>保存済みメモ</h3><button id="soilnoteMemoRefresh" type="button" class="ghost">更新</button></div>',
      '<div id="soilnoteMemoList" class="sn-memo-list"></div>',
      '</section></div></div>'
    ].join('');
    document.body.appendChild(dialog);

    const style=document.createElement('style');
    style.id='soilnoteMemoStyles';
    style.textContent=[
      '.sn-memo-launcher{margin:0 0 16px}',
      '.sn-memo-open{display:inline-flex;align-items:center;gap:8px;max-width:100%;padding:10px 14px;border:1px solid #cbdcd5;border-radius:11px;background:#fff;color:var(--accent-dark,#155343);font-weight:800;font-size:14px;box-shadow:0 2px 8px rgba(24,38,34,.04);cursor:pointer}',
      '.sn-memo-open:active{background:#eaf5ef}.sn-memo-open small{font-size:11px;color:#fff;background:var(--accent,#1e6f5c);border-radius:999px;padding:2px 7px}.sn-memo-chevron{font-size:21px;font-weight:400;line-height:1;color:#7c958b}',
      '.sn-memo-dialog{position:fixed;inset:0;margin:0;width:100%;max-width:none;height:100dvh;max-height:none;border:0;border-radius:0;overflow:auto;background:#f4f7f6;color:#17211f;padding:0;overscroll-behavior:contain}',
      '.sn-memo-dialog::backdrop{background:rgba(12,20,18,.4)}',
      '.sn-memo-page{min-height:100%;padding-bottom:env(safe-area-inset-bottom,0px)}',
      '.sn-memo-page-header{position:sticky;top:0;z-index:3;border-bottom:1px solid #dfe7e4;background:rgba(244,247,246,.97);backdrop-filter:blur(10px);padding:calc(10px + env(safe-area-inset-top,0px)) 16px 10px}',
      '.sn-memo-header-inner{max-width:820px;margin:auto;display:flex;align-items:center;gap:16px;font-size:17px}',
      '.sn-memo-back{border:0;background:transparent;color:#155343;font-size:14px;font-weight:800;padding:7px 0;cursor:pointer;white-space:nowrap}',
      '.sn-memo-page-inner{max-width:820px;margin:auto;padding:18px 16px 32px}',
      '.sn-memo-board{background:#fff;border:1px solid var(--line,#dfe7e4);border-radius:18px;padding:18px;box-shadow:0 4px 18px rgba(24,38,34,.04)}',
      '.sn-memo-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;border-bottom:1px solid var(--line,#dfe7e4);padding-bottom:12px;margin-bottom:15px}',
      '.sn-memo-heading h2{font-size:19px;margin:4px 0 5px}.sn-memo-heading p:not(.eyebrow){margin:0;color:var(--muted,#6b7774);font-size:12px;line-height:1.6}.sn-memo-mark{font-size:24px}',
      '.sn-memo-form label{display:block;margin-bottom:12px;font-size:12px;font-weight:750;color:#40514b}',
      '.sn-memo-form input,.sn-memo-form textarea{margin-top:5px;width:100%;border:1px solid #cfdad6;background:#fff;border-radius:11px;padding:11px;font:inherit;font-size:16px;outline:none}',
      '.sn-memo-form textarea{display:block;min-height:110px;resize:vertical;line-height:1.6;white-space:pre-wrap}',
      '.sn-memo-form input:focus,.sn-memo-form textarea:focus{border-color:var(--accent,#1e6f5c);box-shadow:0 0 0 3px rgba(30,111,92,.12)}',
      '.sn-memo-form-foot{display:flex;align-items:flex-end;justify-content:space-between;gap:12px}.sn-memo-form-foot label{flex:1;margin:0}.sn-memo-form-buttons{display:flex;gap:8px;align-items:center}.sn-memo-form-buttons button{white-space:nowrap}',
      '.sn-memo-status{font-size:12px;color:#66736e;line-height:1.5;min-height:20px;margin:11px 0}.sn-memo-status[data-kind="error"]{color:#b42318}.sn-memo-status[data-kind="ok"]{color:#176b50}',
      '.sn-memo-list-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:18px 0 10px}.sn-memo-list-heading h3{font-size:15px;margin:0}.sn-memo-list-heading button{font-size:12px;padding:7px 11px}',
      '.sn-memo-list{display:grid;gap:9px}.sn-memo-empty{border:1px dashed #b9c7c3;border-radius:12px;padding:16px;color:#66736e;font-size:13px;margin:0}',
      '.sn-memo-item{border:1px solid #dfe7e4;background:#f8fbfa;border-radius:12px;padding:13px}.sn-memo-item-head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:5px 12px}.sn-memo-item-head strong{font-size:14px;overflow-wrap:anywhere}.sn-memo-item-head span{font-size:11px;color:#66736e}',
      '.sn-memo-body{font-size:13px;line-height:1.65;white-space:pre-wrap;overflow-wrap:anywhere;margin:8px 0 10px;color:#263832}',
      '.sn-memo-item-actions{display:flex;justify-content:flex-end;gap:8px}.sn-memo-item-actions button{border:1px solid #cddad5;border-radius:8px;background:#fff;color:#155343;padding:6px 12px;font-weight:700;font-size:12px}.sn-memo-item-actions button.sn-memo-delete{color:#b42318}',
      '.sn-memo-dialog [hidden]{display:none!important}',
      '@media(max-width:560px){.sn-memo-board{padding:14px}.sn-memo-form-foot{display:block}.sn-memo-form-foot label{display:block;margin-bottom:12px}.sn-memo-form-buttons{justify-content:flex-end}.sn-memo-form-buttons button{font-size:13px;padding:10px 12px}}'
    ].join('\n');
    document.head.appendChild(style);

    form=document.getElementById('soilnoteMemoForm');
    list=document.getElementById('soilnoteMemoList');
    status=document.getElementById('soilnoteMemoStatus');
    saveButton=document.getElementById('soilnoteMemoSave');
    cancelButton=document.getElementById('soilnoteMemoCancel');
    form.elements.author.value=localStorage.getItem(NAME_KEY)||'';
    form.addEventListener('submit',saveMemo);
    cancelButton.addEventListener('click',resetEditor);
    list.addEventListener('click',onListClick);
    document.getElementById('soilnoteMemoRefresh').addEventListener('click',()=>syncNow(true));
    document.getElementById('soilnoteMemoOpen').addEventListener('click',()=>{
      refreshScope();
      if(!dialog.open)dialog.showModal();
      dialog.scrollTop=0;
      syncNow(false);
    });
    document.getElementById('soilnoteMemoBack').addEventListener('click',()=>dialog.close());
  }

  function ensureClient(){
    if(client)return true;
    if(!/^https:\/\//.test(String(CONFIG.url||''))||!String(CONFIG.publishableKey||CONFIG.anonKey||'').trim())return false;
    if(!window.supabase?.createClient)return false;
    try{
      client=window.supabase.createClient(CONFIG.url,CONFIG.publishableKey||CONFIG.anonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
      return true;
    }catch(e){console.error('[SoilNote Memo] client',e);return false;}
  }
  function queueSync(){
    if(currentScope==='local')return;
    clearTimeout(syncTimer);
    syncTimer=setTimeout(()=>syncNow(false),450);
  }
  async function syncNow(manual){
    refreshScope();
    const active=currentScope;
    if(active==='local'){
      if(manual)setStatus('現在は端末保存です。「データ共有」で共有コードを設定すると同期できます。');
      return;
    }
    if(syncing)return;
    if(!navigator.onLine||!ensureClient()){
      if(manual)setStatus('同期できません。端末には保存されています。接続後に再同期します。','error');
      return;
    }
    syncing=true;
    if(manual)setStatus('共有メモを同期中…');
    try{
      const result=await client.rpc('soilnote_memo_list',{p_code:active});
      if(result.error)throw result.error;
      if(scope()!==active)return;
      const remote=new Map((result.data||[]).map(x=>[String(x.memo_id),x]));
      const local=bucket();
      let changed=false;
      for(const r of remote.values()){
        const prev=local[String(r.memo_id)];
        const remoteTime=new Date(r.updated_at).getTime()||0;
        const localTime=new Date(prev?.updatedAt||0).getTime()||0;
        if(!prev||remoteTime>localTime){
          local[String(r.memo_id)]={id:String(r.memo_id),title:r.title||'',body:r.body||'',author:r.author||'',updatedAt:r.updated_at,createdAt:prev?.createdAt||r.updated_at,deletedAt:r.deleted_at||null};
          changed=true;
        }
      }
      if(changed){persist();renderList();}
      for(const note of Object.values(local)){
        if(scope()!==active)return;
        const r=remote.get(String(note.id));
        if(r&&(new Date(r.updated_at).getTime()||0)>=(new Date(note.updatedAt).getTime()||0))continue;
        const params={p_code:active,p_memo_id:note.id,p_updated_at:note.updatedAt};
        const res=note.deletedAt
          ?await client.rpc('soilnote_memo_delete',params)
          :await client.rpc('soilnote_memo_upsert',{...params,p_title:note.title||'',p_body:note.body||'',p_author:note.author||''});
        if(res.error)throw res.error;
      }
      setStatus('共有メモ同期済み（端末にも保存）','ok');
      document.dispatchEvent(new CustomEvent('soilnote:memo-cloud-synced',{detail:{scope:active}}));
    }catch(e){
      console.error('[SoilNote Memo] sync',e);
      setStatus('共有メモの同期に失敗しました。入力内容は端末に保存されています。','error');
    }finally{syncing=false;}
  }
  function boot(){
    makeUI();
    if(!form)return;
    refreshScope();
    setInterval(()=>{
      refreshScope();
      if(document.visibilityState==='visible')syncNow(false);
    },10000);
    window.addEventListener('focus',()=>syncNow(false));
    window.addEventListener('online',()=>syncNow(false));
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')syncNow(false);});
    window.addEventListener('storage',e=>{
      if(e.key===STORAGE_KEY){store=readStore();renderList();}
      if(e.key===SHARE_KEY){refreshScope();syncNow(false);}
    });
    setTimeout(()=>syncNow(false),1500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();