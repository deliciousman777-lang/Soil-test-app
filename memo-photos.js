// SoilNote memo photo attachments: private cloud storage + on-device offline copy.
(function(){
  'use strict';
  const DB_NAME='soilnote-memo-photos-local-v1';
  const CODE_KEY='soilnote-share-code-v2';
  const BUCKET_ENDPOINT='/functions/v1/soilnote-memo-photos';
  const MAX_PHOTOS=8;
  const MAX_BYTES=3145728;
  const config=window.SOILNOTE_SUPABASE||{};
  let dbPromise=null;
  let list=null,form=null,editorBox=null,photoHint=null;
  let pending=[],processing=0;
  let localPhotos=[],remotePhotos=[],deletions=[];
  let cloudBusy=false,renderScheduled=false;
  let lastScope='';
  const urlCache=new Map();

  function code(){
    const v=String(localStorage.getItem(CODE_KEY)||'').toUpperCase().replace(/[^0-9A-F]/g,'');
    return v.length===20?v:'';
  }
  function scope(){return code()||'local';}
  function esc(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));}
  function uid(){return crypto.randomUUID();}
  function hint(message,error=false){
    if(!photoHint)return;
    photoHint.textContent=message;
    photoHint.dataset.error=error?'true':'false';
  }
  function openDatabase(){
    if(dbPromise)return dbPromise;
    dbPromise=new Promise((resolve,reject)=>{
      if(!window.indexedDB){reject(Error('IndexedDB unavailable'));return;}
      const req=indexedDB.open(DB_NAME,1);
      req.onupgradeneeded=()=>{
        const d=req.result;
        if(!d.objectStoreNames.contains('photos'))d.createObjectStore('photos',{keyPath:'localId'});
        if(!d.objectStoreNames.contains('deletions'))d.createObjectStore('deletions',{keyPath:'key'});
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||Error('IndexedDB unavailable'));
    });
    return dbPromise;
  }
  async function getAll(storeName){
    const d=await openDatabase();
    return new Promise((resolve,reject)=>{
      const req=d.transaction(storeName,'readonly').objectStore(storeName).getAll();
      req.onsuccess=()=>resolve(req.result||[]);
      req.onerror=()=>reject(req.error);
    });
  }
  async function put(storeName,value){
    const d=await openDatabase();
    return new Promise((resolve,reject)=>{
      const tx=d.transaction(storeName,'readwrite');
      tx.objectStore(storeName).put(value);
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error);
      tx.onabort=()=>reject(tx.error);
    });
  }
  async function del(storeName,id){
    const d=await openDatabase();
    return new Promise((resolve,reject)=>{
      const tx=d.transaction(storeName,'readwrite');
      tx.objectStore(storeName).delete(id);
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error);
      tx.onabort=()=>reject(tx.error);
    });
  }
  async function api(action,data){
    const base=String(config.url||'').replace(/\/$/,'');
    if(!base)throw Error('共有設定がありません');
    const headers={};
    const key=config.publishableKey||config.anonKey;
    if(key)headers.apikey=key;
    let body;
    if(data instanceof FormData){body=data;}
    else{headers['Content-Type']='application/json';body=JSON.stringify({...data,action,code:code()});}
    const res=await fetch(base+BUCKET_ENDPOINT,{method:'POST',headers,body,cache:'no-store'});
    let response;
    try{response=await res.json();}catch{throw Error('写真サーバーから応答がありません');}
    if(!res.ok)throw Error(response?.error||'写真の同期に失敗しました');
    return response;
  }
  async function jpeg(file){
    if(!file||!String(file.type).startsWith('image/'))throw Error('画像ファイルを選択してください');
    if(file.size>25000000)throw Error('写真が大きすぎます（25MBまで）');
    const source=URL.createObjectURL(file);
    let img;
    try{
      img=new Image();
      img.decoding='async';
      await new Promise((resolve,reject)=>{
        img.onload=resolve;img.onerror=()=>reject(Error('画像を読み込めませんでした'));
        img.src=source;
      });
    }finally{URL.revokeObjectURL(source);}
    const w=img.naturalWidth,h=img.naturalHeight;
    if(!w||!h)throw Error('画像が不正です');
    let longest=2560;
    for(const quality of [0.88,0.78,0.68,0.62]){
      const scale=Math.min(1,longest/Math.max(w,h));
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(w*scale));
      canvas.height=Math.max(1,Math.round(h*scale));
      const ctx=canvas.getContext('2d',{alpha:false});
      if(!ctx)throw Error('画像を処理できません');
      ctx.fillStyle='#fff';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
      canvas.width=0;canvas.height=0;
      if(!blob)throw Error('画像の圧縮に失敗しました');
      if(blob.size<=MAX_BYTES)return blob;
      longest=Math.max(1400,Math.round(longest*0.82));
    }
    throw Error('写真を小さくできませんでした');
  }
  function getPhotoUrl(p){
    let u=urlCache.get(p.localId);
    if(!u){u=URL.createObjectURL(p.blob);urlCache.set(p.localId,u);}
    return u;
  }
  function cleanupUrls(){
    const ids=new Set(localPhotos.map(p=>p.localId));
    for(const [key,u] of urlCache)if(!ids.has(key)){URL.revokeObjectURL(u);urlCache.delete(key);}
  }
  async function refreshLocal(){
    const all=await getAll('photos');
    localPhotos=all.filter(p=>p.scope===scope());
    deletions=(await getAll('deletions')).filter(p=>p.scope===scope());
    cleanupUrls();
    scheduleRender();
  }
  function isDeletedRemote(id){
    return deletions.some(d=>d.kind==='photo'&&d.photoId===id||d.kind==='memo'&&remotePhotos.some(p=>p.id===id&&p.memoId===d.memoId));
  }
  function combined(memoId){
    const remote=remotePhotos.filter(p=>p.memoId===memoId&&!isDeletedRemote(p.id));
    const local=localPhotos.filter(p=>p.memoId===memoId);
    const result=remote.map(p=>{
      const cache=local.find(l=>l.remoteId===p.id);
      return {...p,localId:cache?.localId||'',url:cache?.blob?getPhotoUrl(cache):p.url,synced:true};
    });
    for(const p of local){
      if(p.remoteId&&remote.some(r=>r.id===p.remoteId))continue;
      result.push({id:p.remoteId||'',localId:p.localId,memoId:p.memoId,url:getPhotoUrl(p),synced:Boolean(p.remoteId),createdAt:p.createdAt});
    }
    return result;
  }
  function scheduleRender(){
    if(renderScheduled)return;
    renderScheduled=true;
    requestAnimationFrame(()=>{renderScheduled=false;renderCards();});
  }
  function renderCards(){
    if(!list)return;
    list.querySelectorAll('.sn-memo-item').forEach(card=>{
      const memoId=card.dataset.memoId;
      const box=card.querySelector('.sn-photo-gallery');
      if(!box)return;
      const photos=combined(memoId);
      box.innerHTML=photos.map(p=>{
        const id=p.id||'', localId=p.localId||'';
        const label=p.synced?'写真':'写真（端末保存・同期待ち）';
        return '<div class="sn-photo-tile"><button type="button" class="sn-photo-view" data-photo-view="'+esc(id)+'" data-photo-local="'+esc(localId)+'" aria-label="写真を拡大">'+
          '<img src="'+esc(p.url||'')+'" loading="lazy" alt="'+esc(label)+'"></button>'+
          '<button type="button" class="sn-photo-remove" data-photo-remove="'+esc(id)+'" data-photo-local="'+esc(localId)+'" aria-label="写真を削除">×</button>'+
          (p.synced?'':'<small>端末保存</small>')+'</div>';
      }).join('');
      const counter=card.querySelector('.sn-photo-count');
      if(counter)counter.textContent=photos.length?photos.length+'/'+MAX_PHOTOS+'枚':'';
    });
  }
  async function addSelectedFiles(files,memoId){
    if(!files.length)return;
    processing++;
    const saveBtn=document.getElementById('soilnoteMemoSave');
    if(saveBtn&&!memoId)saveBtn.disabled=true;
    try{
      const used=memoId?combined(memoId).length:pending.length;
      if(used+files.length>MAX_PHOTOS)throw Error('写真はメモ1件につき8枚までです');
      for(const file of files){
        hint('写真を準備中…');
        const blob=await jpeg(file);
        const value={localId:uid(),blob,name:file.name||'photo.jpg'};
        if(!memoId){pending.push(value);renderPending();}
        else{
          await put('photos',{localId:value.localId,scope:scope(),memoId,blob:value.blob,name:value.name,createdAt:new Date().toISOString(),remoteId:null});
          await refreshLocal();
        }
      }
      hint(memoId?'写真を端末に保存しました。共有中は自動同期します。':'写真を追加しました。「メモを保存」を押して確定してください。');
      if(memoId&&code()){
        document.getElementById('soilnoteMemoRefresh')?.click();
      }
    }catch(e){
      console.error('[SoilNote photo add]',e);
      hint(e.message||'写真を追加できませんでした',true);
    }finally{
      processing--;
      if(saveBtn&&processing===0)saveBtn.disabled=false;
    }
  }
  function renderPending(){
    if(!editorBox)return;
    const thumbs=editorBox.querySelector('.sn-photo-pending');
    thumbs.innerHTML=pending.map(p=>'<div class="sn-photo-pending-tile"><img alt="追加する写真" src="'+esc(getPendingUrl(p))+'"><button type="button" data-photo-pending-remove="'+esc(p.localId)+'" aria-label="選択解除">×</button></div>').join('');
    form.elements.body.required=!pending.length;
    editorBox.querySelector('.sn-photo-pending-count').textContent=pending.length?pending.length+'枚選択中':'';
  }
  const pendingURLs=new Map();
  function getPendingUrl(p){
    if(!pendingURLs.has(p.localId))pendingURLs.set(p.localId,URL.createObjectURL(p.blob));
    return pendingURLs.get(p.localId);
  }
  function clearPending(){
    for(const u of pendingURLs.values())URL.revokeObjectURL(u);
    pendingURLs.clear();
    pending=[];
    renderPending();
  }
  async function savePendingAfterMemo(id,memoScope){
    if(!pending.length)return;
    const files=[...pending];
    clearPending();
    let saved=0;
    for(const p of files){
      try{
        await put('photos',{localId:p.localId,scope:memoScope,memoId:id,blob:p.blob,name:p.name,createdAt:new Date().toISOString(),remoteId:null});
        saved++;
      }catch(e){console.error('[SoilNote photo local]',e);}
    }
    await refreshLocal();
    if(saved!==files.length)hint('一部の写真を端末に保存できませんでした。容量を確認してください。',true);
    else hint('写真を端末に保存しました。共有中は自動同期します。');
    if(memoScope!=='local')document.getElementById('soilnoteMemoRefresh')?.click();
  }
  function makePickers(parent,memoId){
    const wrap=document.createElement('div');
    wrap.className='sn-photo-buttons';
    wrap.innerHTML='<button type="button" class="sn-photo-camera">📷 撮影</button><button type="button" class="sn-photo-pick">🖼️ 写真を選択</button>';
    const camera=document.createElement('input');
    camera.type='file';camera.accept='image/*';camera.capture='environment';camera.hidden=true;
    const album=document.createElement('input');
    album.type='file';album.accept='image/*';album.multiple=true;album.hidden=true;
    wrap.append(camera,album);
    wrap.querySelector('.sn-photo-camera').addEventListener('click',()=>camera.click());
    wrap.querySelector('.sn-photo-pick').addEventListener('click',()=>album.click());
    camera.addEventListener('change',()=>{addSelectedFiles([...camera.files],memoId);camera.value='';});
    album.addEventListener('change',()=>{addSelectedFiles([...album.files],memoId);album.value='';});
    parent.appendChild(wrap);
  }
  function installCards(){
    if(!list)return;
    list.querySelectorAll('.sn-memo-item:not([data-sn-photo-installed])').forEach(card=>{
      card.dataset.snPhotoInstalled='true';
      const body=card.querySelector('.sn-memo-body');
      if(!body)return;
      const gallery=document.createElement('div');
      gallery.className='sn-photo-gallery';
      body.insertAdjacentElement('afterend',gallery);
      const actions=card.querySelector('.sn-memo-item-actions');
      if(actions){
        const right=document.createElement('small');
        right.className='sn-photo-count';
        const row=document.createElement('div');
        row.className='sn-photo-tools';
        makePickers(row,card.dataset.memoId);
        row.prepend(right);
        actions.insertAdjacentElement('beforebegin',row);
      }
    });
    scheduleRender();
  }
  async function postDeletion(d){
    if(!code()||d.scope!==scope())return false;
    try{
      if(d.kind==='memo')await api('delete_memo',{memoId:d.memoId});
      else await api('delete',{photoId:d.photoId});
      await del('deletions',d.key);
      return true;
    }catch(e){console.warn('[SoilNote photo delete sync]',e);return false;}
  }
  async function syncPhotos(allowUpload){
    if(cloudBusy||!code()||!navigator.onLine)return;
    cloudBusy=true;
    try{
      const allDeletes=await getAll('deletions');
      for(const d of allDeletes.filter(x=>x.scope===scope()))await postDeletion(d);
      if(allowUpload){
        const all=await getAll('photos');
        const fresh=all.filter(x=>x.scope===scope()&&!x.remoteId);
        for(const p of fresh){
          // A memo's database row must be synced before its files can be linked.
          const data=new FormData();
          data.set('action','upload');data.set('code',code());data.set('memo_id',p.memoId);
          data.set('photo',new File([p.blob],'photo.jpg',{type:'image/jpeg'}));
          try{
            const result=await api('upload',data);
            p.remoteId=result.id;
            await put('photos',p);
          }catch(e){console.warn('[SoilNote photo upload]',e);hint('写真は端末に保存済み。通信またはメモの同期後に再送します。',true);break;}
        }
      }
      const result=await api('list',{});
      remotePhotos=result.photos||[];
      await refreshLocal();
    }catch(e){
      console.warn('[SoilNote photo sync]',e);
      hint('写真のクラウド読み込みに失敗しました。端末保存の写真は残っています。',true);
    }finally{cloudBusy=false;}
  }
  async function migrateLocal(){
    const current=scope();
    if(current==='local')return;
    const all=await getAll('photos');
    const local=all.filter(x=>x.scope==='local');
    if(!local.length)return;
    const targets=all.filter(x=>x.scope===current);
    for(const p of local){
      if(targets.some(t=>t.sourceId===p.localId))continue;
      await put('photos',{...p,localId:uid(),scope:current,remoteId:null,sourceId:p.localId});
    }
    await refreshLocal();
  }
  async function onDeleteMemo(memoId,atScope){
    const all=await getAll('photos');
    for(const p of all.filter(x=>x.scope===atScope&&x.memoId===memoId))await del('photos',p.localId);
    if(atScope!=='local'){
      await put('deletions',{key:atScope+':memo:'+memoId,scope:atScope,kind:'memo',memoId});
    }
    await refreshLocal();
    if(atScope!=='local')syncPhotos(false);
  }
  async function removePhoto(id,localId){
    if(!window.confirm('この写真を削除しますか？'))return;
    if(id&&scope()!=='local'){
      await put('deletions',{key:scope()+':photo:'+id,scope:scope(),kind:'photo',photoId:id});
    }
    if(localId)await del('photos',localId);
    await refreshLocal();
    if(code())syncPhotos(false);
  }
  function makeViewer(){
    const dialog=document.createElement('dialog');
    dialog.id='soilnotePhotoViewer';
    dialog.className='sn-photo-viewer';
    dialog.innerHTML='<div class="sn-photo-viewer-inner"><button type="button" aria-label="閉じる" class="sn-photo-viewer-close">閉じる ×</button><img alt="添付写真"></div>';
    document.body.appendChild(dialog);
    dialog.querySelector('.sn-photo-viewer-close').onclick=()=>dialog.close();
    dialog.onclick=e=>{if(e.target===dialog)dialog.close();};
    return dialog;
  }
  async function boot(){
    list=document.getElementById('soilnoteMemoList');
    form=document.getElementById('soilnoteMemoForm');
    if(!list||!form)return;
    try{await openDatabase();await refreshLocal();}catch(e){console.error('[SoilNote photo DB]',e);hint('この端末では写真の保存機能が使えません。',true);return;}
    lastScope=scope();

    editorBox=document.createElement('section');
    editorBox.className='sn-photo-editor';
    editorBox.innerHTML='<div class="sn-photo-editor-head"><strong>写真を添付（最大8枚）</strong><small class="sn-photo-pending-count"></small></div><div class="sn-photo-pending"></div>';
    const bodyLabel=form.querySelector('textarea[name="body"]')?.closest('label');
    if(bodyLabel)bodyLabel.insertAdjacentElement('afterend',editorBox);
    makePickers(editorBox,null);
    photoHint=document.createElement('p');
    photoHint.className='sn-photo-hint';
    editorBox.appendChild(photoHint);
    editorBox.querySelector('.sn-photo-pending').addEventListener('click',e=>{
      const b=e.target.closest('[data-photo-pending-remove]');
      if(!b)return;
      const id=b.dataset.photoPendingRemove;
      pending=pending.filter(p=>p.localId!==id);
      const u=pendingURLs.get(id);if(u)URL.revokeObjectURL(u);
      pendingURLs.delete(id);
      renderPending();
    });
    renderPending();

    const style=document.createElement('style');
    style.id='soilnotePhotoStyles';
    style.textContent=[
      '.sn-photo-editor{border:1px solid #dfe7e4;background:#f8fbfa;border-radius:12px;padding:12px;margin-bottom:12px}',
      '.sn-photo-editor-head{display:flex;justify-content:space-between;gap:10px;align-items:center;font-size:13px}.sn-photo-editor-head small{color:#597769}',
      '.sn-photo-buttons{display:flex;gap:8px;flex-wrap:wrap;margin-top:9px}.sn-photo-buttons button{background:#fff;border:1px solid #bcd1c8;color:#155343;border-radius:9px;padding:8px 10px;font-size:13px;font-weight:750}',
      '.sn-photo-buttons input[hidden]{display:none!important}.sn-photo-pending,.sn-photo-gallery{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}',
      '.sn-photo-pending-tile,.sn-photo-tile{width:84px;position:relative}.sn-photo-pending-tile img{width:84px;height:84px;object-fit:cover;border-radius:8px}',
      '.sn-photo-pending-tile button,.sn-photo-remove{position:absolute;right:-4px;top:-4px;border:0;border-radius:50%;background:#222;color:#fff;font-size:18px;width:26px;height:26px;display:grid;place-items:center;line-height:1}',
      '.sn-photo-view{display:block;border:0;background:transparent;padding:0;cursor:zoom-in}.sn-photo-view img{display:block;width:84px;height:84px;border-radius:8px;object-fit:cover;border:1px solid #dfe7e4}',
      '.sn-photo-tile small{display:block;font-size:9px;color:#b15b21;margin-top:3px}',
      '.sn-photo-hint{font-size:11px;color:#648075;margin:8px 0 0;line-height:1.5}.sn-photo-hint[data-error="true"]{color:#b42318}',
      '.sn-photo-tools{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:8px}.sn-photo-tools .sn-photo-count{font-size:11px;color:#6b7774}',
      '.sn-photo-tools .sn-photo-buttons{margin:0}.sn-photo-tools .sn-photo-buttons button{font-size:11px;padding:6px 9px}',
      '.sn-photo-viewer{position:fixed;inset:0;margin:auto;width:min(98vw,1100px);max-width:none;max-height:94dvh;padding:12px;background:#17211f;border:0;border-radius:12px}.sn-photo-viewer::backdrop{background:rgba(0,0,0,.8)}',
      '.sn-photo-viewer-inner{display:flex;flex-direction:column;gap:8px;align-items:center}.sn-photo-viewer img{max-height:82dvh;max-width:100%;object-fit:contain}.sn-photo-viewer-close{align-self:flex-end;background:#fff;border:0;border-radius:9px;padding:8px 12px;font-size:14px;font-weight:750}',
      '@media(max-width:560px){.sn-photo-tools{justify-content:space-between}.sn-photo-tools .sn-photo-buttons{gap:5px}}'
    ].join('\n');
    document.head.appendChild(style);

    const viewer=makeViewer();
    list.addEventListener('click',e=>{
      const remove=e.target.closest('[data-photo-remove]');
      if(remove){e.preventDefault();removePhoto(remove.dataset.photoRemove,remove.dataset.photoLocal).catch(console.error);return;}
      const view=e.target.closest('[data-photo-view]');
      if(view){
        e.preventDefault();
        const local=localPhotos.find(p=>p.localId===view.dataset.photoLocal);
        const remote=remotePhotos.find(p=>p.id===view.dataset.photoView);
        const img=viewer.querySelector('img');
        img.src=local?getPhotoUrl(local):remote?.url||'';
        if(img.src&&!viewer.open)viewer.showModal();
      }
    });

    form.addEventListener('submit',e=>{
      if(processing){e.preventDefault();e.stopImmediatePropagation();hint('写真の処理が終わってから保存してください。',true);return;}
      if(pending.length&&!form.elements.body.value.trim()){
        form.elements.body.value='📷 写真メモ';
      }
    },true);
    // The core memo handler fires the saved event immediately after storing the memo text.
    document.addEventListener('soilnote:memo-saved',e=>{
      savePendingAfterMemo(e.detail.id,e.detail.scope).catch(err=>{console.error(err);hint('写真の端末保存に失敗しました。',true);});
    });
    document.addEventListener('soilnote:memo-deleted',e=>{
      onDeleteMemo(e.detail.id,e.detail.scope).catch(console.error);
    });
    document.addEventListener('soilnote:memo-cloud-synced',()=>syncPhotos(true));

    const observer=new MutationObserver(()=>installCards());
    observer.observe(list,{childList:true});
    installCards();

    document.getElementById('soilnoteMemoOpen')?.addEventListener('click',async()=>{
      if(scope()!==lastScope){
        lastScope=scope();
        await migrateLocal();
      }
      await refreshLocal();
      syncPhotos(false);
    });
    document.getElementById('soilnoteMemoRefresh')?.addEventListener('click',()=>syncPhotos(false));
    window.addEventListener('online',()=>syncPhotos(true));
    window.addEventListener('focus',()=>{
      if(scope()!==lastScope){lastScope=scope();migrateLocal().catch(console.error);}
      syncPhotos(false);
    });
    window.addEventListener('storage',e=>{
      if(e.key===CODE_KEY){lastScope=scope();migrateLocal().then(()=>syncPhotos(true)).catch(console.error);}
    });
    setInterval(()=>{
      if(scope()!==lastScope){lastScope=scope();migrateLocal().catch(console.error);}
      if(document.visibilityState==='visible'&&code())syncPhotos(false);
    },30000);
    if(code())setTimeout(()=>syncPhotos(false),1800);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);
  else boot();
})();