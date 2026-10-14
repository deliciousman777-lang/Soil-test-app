// SoilNote 沈降分析アラーム
// 進行中の沈降分析を監視し、5分以降の各測定時刻に音・通知・画面表示で知らせる。
(function(){
  const RUNS_KEY='soilnote-sedimentation-runs-v1';
  const ALARM_STATE_KEY='soilnote-sedimentation-alarm-state-v1';
  const SETTINGS_KEY='soilnote-sedimentation-alarm-settings-v1';
  const TIMES=[1,2,5,15,30,60,240,1440];
  // 1分・2分は測定データとして残すが、アラームは5分から鳴らす。
  const ALARM_INDEXES=[2,3,4,5,6,7];
  let audioCtx=null;
  let lastTick=0;

  const esc=v=>typeof escapeHtml==='function'?escapeHtml(v):String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[c]));

  function loadJson(key,fallback){
    try{const v=JSON.parse(localStorage.getItem(key));return v??fallback;}catch{return fallback;}
  }
  function saveJson(key,value){localStorage.setItem(key,JSON.stringify(value));}
  function settings(){return {...{enabled:true,sound:true,notifications:true},...loadJson(SETTINGS_KEY,{})};}
  function saveSettings(next){saveJson(SETTINGS_KEY,{...settings(),...next});updateAlarmButton();}
  function runs(){const v=loadJson(RUNS_KEY,[]);return Array.isArray(v)?v:[];}
  function alarmState(){return loadJson(ALARM_STATE_KEY,{});}
  function projectName(run){
    try{return state?.data?.projects?.find(p=>p.id===run.projectId)?.name||run.projectName||'工事件名未設定';}
    catch{return run.projectName||'工事件名未設定';}
  }
  function runLabel(run){
    const f=run.fields||{};
    return {
      project:projectName(run),
      card:String(run.constructionCardNo||'').trim(),
      sample:String(f.sample||run.sample||'試料名未入力').trim()||'試料名未入力',
      container:String(f.sedSampleContainerNo||run.sampleContainerNo||'').trim(),
      cylinder:String(f.cylinderNo||run.cylinderNo||'').trim(),
    };
  }
  function startMs(run){const t=new Date(run.startAt||'').getTime();return Number.isFinite(t)?t:null;}
  function readingMissing(run,index){return String(run.fields?.[`sed_r_${index}`]??'').trim()==='';}
  function alarmId(run,index){return `${run.id}:${index}`;}

  function ensureAudio(){
    if(audioCtx)return audioCtx;
    const Ctx=window.AudioContext||window.webkitAudioContext;
    if(!Ctx)return null;
    try{audioCtx=new Ctx();return audioCtx;}catch{return null;}
  }
  async function unlockAudio(){
    const ctx=ensureAudio();if(!ctx)return false;
    try{
      if(ctx.state==='suspended')await ctx.resume();
      const osc=ctx.createOscillator(),gain=ctx.createGain();
      gain.gain.value=0.00001;osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+0.02);
      return true;
    }catch{return false;}
  }
  function beepPattern(){
    if(!settings().sound)return;
    const ctx=ensureAudio();if(!ctx||ctx.state!=='running')return;
    const now=ctx.currentTime;
    [0,0.32,0.64,1.05].forEach((offset,i)=>{
      const osc=ctx.createOscillator(),gain=ctx.createGain();
      osc.type='sine';osc.frequency.value=i===3?1050:880;
      gain.gain.setValueAtTime(0.0001,now+offset);
      gain.gain.exponentialRampToValueAtTime(0.24,now+offset+0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001,now+offset+0.22);
      osc.connect(gain);gain.connect(ctx.destination);osc.start(now+offset);osc.stop(now+offset+0.24);
    });
    try{navigator.vibrate?.([250,100,250,100,450]);}catch{}
  }

  async function requestNotificationPermission(){
    if(!('Notification' in window))return 'unsupported';
    try{
      if(Notification.permission==='granted')return 'granted';
      if(Notification.permission==='denied')return 'denied';
      return await Notification.requestPermission();
    }catch{return 'unsupported';}
  }

  async function enableAlarmFromGesture(){
    await unlockAudio();
    saveSettings({enabled:true,sound:true});
    const permission=await requestNotificationPermission();
    if(permission==='granted')saveSettings({notifications:true});
    showToast(permission==='granted'?'沈降アラーム：音＋通知 ON':'沈降アラーム：音 ON');
    updateAlarmButton();
  }

  function showToast(text){
    let el=document.getElementById('sedAlarmToast');
    if(!el){
      el=document.createElement('div');el.id='sedAlarmToast';el.className='sed-alarm-toast';document.body.appendChild(el);
    }
    el.textContent=text;el.classList.add('show');clearTimeout(showToast._t);showToast._t=setTimeout(()=>el.classList.remove('show'),1800);
  }

  function ensureAlertArea(){
    let root=document.getElementById('sedAlarmAlerts');
    if(root)return root;
    root=document.createElement('div');root.id='sedAlarmAlerts';root.className='sed-alarm-alerts';root.setAttribute('aria-live','assertive');document.body.appendChild(root);return root;
  }

  function alertCard(run,index,due){
    const id=alarmId(run,index);const label=runLabel(run);const clock=new Date(due).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});
    return `<section class="sed-alarm-card" data-sed-alarm-card="${esc(id)}">
      <div class="sed-alarm-icon">🔔</div>
      <div class="sed-alarm-body">
        <strong>${TIMES[index]}分測定です</strong>
        <span>${esc(label.project)}${label.card?` ｜ ${esc(label.card)}`:''}</span>
        <b>${esc(label.sample)} ｜ 試料容器 No.${esc(label.container||'—')}</b>
        <small>メスシリンダー No.${esc(label.cylinder||'—')} ｜ 予定 ${esc(clock)}</small>
      </div>
      <div class="sed-alarm-actions"><button type="button" class="primary" data-sed-alarm-open="${esc(run.id)}">読みを入力</button><button type="button" class="ghost" data-sed-alarm-dismiss="${esc(id)}">確認</button></div>
    </section>`;
  }

  function showAlarmCard(run,index,due){
    const root=ensureAlertArea(),id=alarmId(run,index);
    if(root.querySelector(`[data-sed-alarm-card="${CSS.escape(id)}"]`))return;
    root.insertAdjacentHTML('beforeend',alertCard(run,index,due));
  }

  function dismissAlarm(id){document.querySelector(`[data-sed-alarm-card="${CSS.escape(id)}"]`)?.remove();}

  async function systemNotification(run,index){
    const cfg=settings();if(!cfg.notifications||!('Notification' in window)||Notification.permission!=='granted')return;
    const label=runLabel(run);
    const title=`🔔 沈降分析 ${TIMES[index]}分測定`;
    const body=`${label.project}｜${label.sample}｜試料容器 No.${label.container||'—'}`;
    const options={body,tag:`sed-${run.id}-${index}`,renotify:true,data:{runId:run.id,index},icon:'./icons/apple-touch-icon.png',badge:'./icons/apple-touch-icon.png'};
    try{
      const reg=await navigator.serviceWorker?.ready;
      if(reg?.showNotification)await reg.showNotification(title,options);
      else new Notification(title,options);
    }catch{
      try{new Notification(title,options);}catch{}
    }
  }

  function triggerAlarm(run,index,due){
    beepPattern();showAlarmCard(run,index,due);systemNotification(run,index);
  }

  function checkAlarms(){
    const cfg=settings();if(!cfg.enabled)return;
    const now=Date.now();
    const stateMap=alarmState();let changed=false;let newAlarm=false;
    for(const run of runs()){
      if(run.status==='finished'||!run.startAt)continue;
      const start=startMs(run);if(start==null)continue;
      for(const i of ALARM_INDEXES){
        if(!readingMissing(run,i))continue;
        const due=start+TIMES[i]*60000;
        if(now<due)continue;
        const id=alarmId(run,i);
        if(stateMap[id]?.firedAt)continue;
        // 長時間アプリを閉じていた場合も、復帰時に未測定を知らせる。
        stateMap[id]={firedAt:new Date(now).toISOString(),dueAt:new Date(due).toISOString()};changed=true;
        triggerAlarm(run,i,due);newAlarm=true;
      }
    }
    if(changed)saveJson(ALARM_STATE_KEY,stateMap);
    if(newAlarm&&document.hidden===false)setTimeout(beepPattern,1800);
    lastTick=now;
  }

  function cleanupAlarmState(){
    const activeIds=new Set(runs().flatMap(run=>ALARM_INDEXES.map(i=>alarmId(run,i))));
    const map=alarmState();let changed=false;
    Object.keys(map).forEach(k=>{if(!activeIds.has(k)){delete map[k];changed=true;}});
    if(changed)saveJson(ALARM_STATE_KEY,map);
  }

  function injectAlarmButton(){
    if(document.getElementById('sedAlarmToggleBtn'))return;
    const workBtn=document.getElementById('openSedWorkbenchBtn');
    const newBtn=document.getElementById('newProjectBtn');
    if(!workBtn&&!newBtn)return;
    const b=document.createElement('button');b.id='sedAlarmToggleBtn';b.type='button';b.className='sed-alarm-toggle';
    (workBtn||newBtn).insertAdjacentElement('beforebegin',b);
    b.addEventListener('click',async()=>{
      const cfg=settings();
      if(!cfg.enabled){await enableAlarmFromGesture();return;}
      saveSettings({enabled:false});showToast('沈降アラーム OFF');
    });
    updateAlarmButton();
  }

  function updateAlarmButton(){
    const b=document.getElementById('sedAlarmToggleBtn');if(!b)return;
    const cfg=settings();
    const permission=('Notification' in window)?Notification.permission:'unsupported';
    b.textContent=cfg.enabled?(permission==='granted'?'🔔 アラーム ON':'🔔 アラーム ON'):'🔕 アラーム OFF';
    b.classList.toggle('active',cfg.enabled);
  }

  function addStyles(){
    if(document.getElementById('sedAlarmStyles'))return;
    const s=document.createElement('style');s.id='sedAlarmStyles';s.textContent=`
      .sed-alarm-toggle{border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.12);color:inherit;border-radius:12px;padding:10px 12px;font-weight:800;white-space:nowrap}.sed-alarm-toggle.active{background:rgba(255,255,255,.22)}
      .sed-alarm-alerts{position:fixed;z-index:10050;left:12px;right:12px;top:calc(12px + env(safe-area-inset-top));display:grid;gap:9px;pointer-events:none}.sed-alarm-card{pointer-events:auto;display:grid;grid-template-columns:auto 1fr auto;gap:11px;align-items:center;max-width:820px;width:100%;margin:0 auto;padding:13px;border-radius:16px;background:#fff4d8;border:2px solid #e8a600;box-shadow:0 12px 38px rgba(0,0,0,.25);animation:sedAlarmPulse 1s ease-in-out 2}.sed-alarm-icon{font-size:30px}.sed-alarm-body strong{display:block;color:#8b5200;font-size:18px}.sed-alarm-body span,.sed-alarm-body b,.sed-alarm-body small{display:block;margin-top:2px}.sed-alarm-body span{font-size:12px;color:#625846}.sed-alarm-body b{font-size:14px;color:#28231b}.sed-alarm-body small{font-size:11px;color:#6d6456}.sed-alarm-actions{display:flex;gap:6px;flex-direction:column}.sed-alarm-toast{position:fixed;z-index:10060;left:50%;bottom:calc(24px + env(safe-area-inset-bottom));transform:translate(-50%,12px);background:#173f35;color:#fff;border-radius:999px;padding:10px 15px;font-weight:800;font-size:12px;opacity:0;transition:.2s;pointer-events:none}.sed-alarm-toast.show{opacity:1;transform:translate(-50%,0)}
      @keyframes sedAlarmPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.015)}}
      @media(max-width:680px){.sed-alarm-card{grid-template-columns:auto 1fr}.sed-alarm-actions{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr}.sed-alarm-toggle{order:2;flex:1}.topbar #openSedWorkbenchBtn{order:3}.topbar #newProjectBtn{order:4}}
    `;document.head.appendChild(s);
  }

  function openRunFromAlarm(runId){
    dismissCardsForRun(runId);
    const wb=document.getElementById('sedWorkbenchDialog');
    if(wb){try{if(!wb.open)wb.showModal();}catch{}setTimeout(()=>document.querySelector(`[data-run-card="${CSS.escape(runId)}"] [data-sed-direct-input]`)?.focus(),80);return;}
    document.getElementById('openSedWorkbenchBtn')?.click();
  }
  function dismissCardsForRun(runId){document.querySelectorAll(`[data-sed-alarm-card^="${CSS.escape(runId)}:"]`).forEach(x=>x.remove());}

  document.addEventListener('click',e=>{
    const dismiss=e.target.closest?.('[data-sed-alarm-dismiss]');if(dismiss){dismissAlarm(dismiss.dataset.sedAlarmDismiss);return;}
    const open=e.target.closest?.('[data-sed-alarm-open]');if(open){openRunFromAlarm(open.dataset.sedAlarmOpen);return;}
    // 「今から開始」はユーザー操作なので、このタイミングでiPhoneの音声/通知権限を有効化する。
    const start=e.target.closest?.('#sedStartRunBtn,[data-sed-start]');
    if(start&&settings().enabled){unlockAudio();requestNotificationPermission().then(p=>{if(p==='granted')saveSettings({notifications:true});});}
  },true);

  document.addEventListener('visibilitychange',()=>{if(!document.hidden){unlockAudio();setTimeout(checkAlarms,100);}});
  window.addEventListener('focus',()=>setTimeout(checkAlarms,100));
  window.addEventListener('storage',e=>{if(e.key===RUNS_KEY)setTimeout(checkAlarms,20);});

  function init(){
    addStyles();injectAlarmButton();ensureAlertArea();cleanupAlarmState();
    // 最初の明示操作で音を使える状態にする。
    document.addEventListener('pointerdown',()=>{if(settings().enabled)unlockAudio();},{once:true,capture:true});
    setInterval(checkAlarms,500);
    setInterval(cleanupAlarmState,30000);
    setTimeout(checkAlarms,600);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
