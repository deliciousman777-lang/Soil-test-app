// SoilNote planned-test checklist for project cards.
// Select intended test categories when a project is created/edited;
// a category is completed automatically when a saved test of that type exists.
(function(){
  'use strict';

  const PLAN_FIELD = 'plannedTestType';
  const TEST_DEFS = [
    { key:'moisture', label:'含水比', types:['moisture'] },
    { key:'grain', label:'粒度', types:['grain'] },
    { key:'particleDensity', label:'土粒子の密度', types:['particleDensity'] },
    { key:'atterberg', label:'液性・塑性限界', types:['atterberg'] },
    { key:'cone-index', label:'コーン指数', types:['cone-index'] },
  ];
  const VALID_KEYS = new Set(TEST_DEFS.map(x=>x.key));

  function esc(v){
    return String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }

  function normalizePlan(value){
    const src = Array.isArray(value) ? value : [];
    const unique = [];
    src.forEach(key=>{
      const k=String(key||'');
      if(VALID_KEYS.has(k) && !unique.includes(k)) unique.push(k);
    });
    return TEST_DEFS.map(x=>x.key).filter(k=>unique.includes(k));
  }

  function planFor(project){
    return normalizePlan(project?.plannedTests);
  }

  function selectedFrom(form){
    if(!form) return [];
    return normalizePlan([...form.querySelectorAll(`input[name="${PLAN_FIELD}"]:checked`)].map(el=>el.value));
  }

  function setSelected(form, keys){
    if(!form) return;
    const selected=new Set(normalizePlan(keys));
    form.querySelectorAll(`input[name="${PLAN_FIELD}"]`).forEach(el=>{el.checked=selected.has(el.value);});
  }

  function completionFor(project,key){
    const def=TEST_DEFS.find(x=>x.key===key);
    if(!def) return false;
    const tests=Array.isArray(project?.tests)?project.tests:[];
    return tests.some(test=>def.types.includes(String(test?.type||'')));
  }

  function planStats(project){
    const plan=planFor(project);
    const done=plan.filter(key=>completionFor(project,key)).length;
    return {plan,done,total:plan.length};
  }

  function selectorHtml(){
    return TEST_DEFS.map(def=>`
      <label class="plan-choice">
        <input type="checkbox" name="${PLAN_FIELD}" value="${esc(def.key)}">
        <span>${esc(def.label)}</span>
      </label>`).join('');
  }

  function injectSelector(form, id){
    if(!form || form.querySelector(`[data-project-plan-selector="${id}"]`)) return;
    const block=document.createElement('div');
    block.className='project-plan-selector';
    block.dataset.projectPlanSelector=id;
    block.innerHTML=`
      <div class="project-plan-label"><strong>予定している試験</strong><small>複数選択できます。試験データを保存すると自動で✓になります。</small></div>
      <div class="project-plan-options">${selectorHtml()}</div>`;
    const actions=form.querySelector('.dialog-actions');
    if(actions) form.insertBefore(block,actions); else form.appendChild(block);
  }

  function injectStyles(){
    if(document.getElementById('projectTestPlanStyle')) return;
    const style=document.createElement('style');
    style.id='projectTestPlanStyle';
    style.textContent=`
      .project-plan-selector{margin:14px 0 4px;padding:14px;border:1px solid var(--line,#dfe7e3);border-radius:16px;background:#f8fbfa}
      .project-plan-label{display:flex;flex-direction:column;gap:3px;margin-bottom:10px}.project-plan-label strong{font-size:14px;color:#1f2a24}.project-plan-label small{font-size:11px;line-height:1.45;color:var(--muted,#68766e)}
      .project-plan-options{display:grid;grid-template-columns:1fr 1fr;gap:8px}.plan-choice{display:flex!important;align-items:center;gap:8px;margin:0!important;padding:10px 11px;border:1px solid var(--line,#dfe7e3);border-radius:12px;background:#fff;font-weight:700;font-size:13px;cursor:pointer}.plan-choice input{width:20px;height:20px;margin:0;accent-color:var(--accent-dark,#0b5136)}.plan-choice:has(input:checked){background:#eaf5f0;border-color:#9ac6b3}
      .project-plan-row{margin:10px 0 2px;padding-top:8px;border-top:1px solid #edf1ef}.project-plan-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px}.project-plan-head strong{font-size:12px;color:#53605d}.project-plan-progress{font-size:11px;font-weight:800;color:var(--accent-dark,#0b5136)}.project-plan-chips{display:flex;flex-wrap:wrap;gap:6px}.project-plan-chip{display:inline-flex;align-items:center;gap:4px;padding:5px 8px;border-radius:999px;background:#f0f3f2;color:#66736d;font-size:11px;font-weight:800;line-height:1}.project-plan-chip.done{background:#e5f5ed;color:#087443}.project-plan-chip.done::before{content:'✓';font-size:12px}.project-plan-chip.pending::before{content:'○';font-size:12px;color:#8a9690}
      .project-plan-detail{margin:10px 0 16px;padding:12px 14px;border:1px solid var(--line,#dfe7e3);border-radius:14px;background:#f8fbfa}.project-plan-detail .project-plan-row{margin:0;padding:0;border:0}
      @media(max-width:560px){.project-plan-options{grid-template-columns:1fr}.project-plan-selector{padding:12px}.project-plan-chip{font-size:10.5px;padding:5px 7px}}
    `;
    document.head.appendChild(style);
  }

  function planMarkup(project){
    const stats=planStats(project);
    if(!stats.total) return '';
    const chips=stats.plan.map(key=>{
      const def=TEST_DEFS.find(x=>x.key===key);
      const done=completionFor(project,key);
      return `<span class="project-plan-chip ${done?'done':'pending'}">${esc(def?.label||key)}</span>`;
    }).join('');
    const progress=stats.done===stats.total ? `✓ ${stats.done}/${stats.total} 完了` : `${stats.done}/${stats.total} 完了`;
    return `<div class="project-plan-row"><div class="project-plan-head"><strong>試験内容</strong><span class="project-plan-progress">${progress}</span></div><div class="project-plan-chips">${chips}</div></div>`;
  }

  function decorateProjectCards(){
    const list=document.getElementById('projectList');
    if(!list) return;
    let projects=[];
    try{projects=[...(state?.data?.projects||[])].sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));}catch{return;}
    const cards=[...list.querySelectorAll('.card-button')];
    cards.forEach((card,index)=>{
      card.querySelector('.project-plan-row')?.remove();
      const project=projects[index];
      if(!project) return;
      const html=planMarkup(project);
      if(!html) return;
      const meta=card.querySelector('.meta');
      if(meta) meta.insertAdjacentHTML('beforebegin',html); else card.insertAdjacentHTML('beforeend',html);
    });
  }

  function renderDetailPlan(){
    const detail=document.getElementById('detailView');
    if(!detail) return;
    let holder=document.getElementById('projectPlanDetail');
    let project=null;
    try{project=currentProject();}catch{}
    const html=project?planMarkup(project):'';
    if(!html){holder?.remove();return;}
    if(!holder){
      holder=document.createElement('div');
      holder.id='projectPlanDetail';
      holder.className='project-plan-detail';
      const title=detail.querySelector('.detail-title');
      if(title) title.insertAdjacentElement('afterend',holder); else detail.prepend(holder);
    }
    holder.innerHTML=html;
  }

  function persistPlan(project,keys){
    if(!project) return;
    const next=normalizePlan(keys);
    const before=JSON.stringify(planFor(project));
    const after=JSON.stringify(next);
    if(before===after) return;
    project.plannedTests=next;
    project.updatedAt=new Date().toISOString();
    saveData();
  }

  function wireNewProjectForm(){
    const form=document.getElementById('projectForm');
    if(!form || form.dataset.projectPlanWired==='1') return;
    form.dataset.projectPlanWired='1';
    injectSelector(form,'new');
    form.addEventListener('submit',()=>{
      const selected=selectedFrom(form);
      let beforeIds=new Set();
      try{beforeIds=new Set((state?.data?.projects||[]).map(p=>String(p.id)));}catch{}
      queueMicrotask(()=>{
        let created=null;
        try{created=(state?.data?.projects||[]).find(p=>!beforeIds.has(String(p.id)));}catch{}
        if(!created) return;
        persistPlan(created,selected);
        try{renderProjects();renderDetailPlan();}catch{}
      });
    },true);
  }

  function wireEditProjectForm(){
    const form=document.getElementById('projectInfoForm');
    if(!form || form.dataset.projectPlanWired==='1') return;
    form.dataset.projectPlanWired='1';
    injectSelector(form,'edit');
    form.addEventListener('submit',()=>{
      const selected=selectedFrom(form);
      let id='';
      try{id=String(currentProject()?.id||'');}catch{}
      queueMicrotask(()=>{
        let project=null;
        try{project=(state?.data?.projects||[]).find(p=>String(p.id)===id);}catch{}
        if(!project) return;
        persistPlan(project,selected);
        try{renderProjects();renderDetailPlan();}catch{}
      });
    },true);
  }

  function fillEditPlan(){
    const form=document.getElementById('projectInfoForm');
    if(!form) return;
    let project=null;
    try{project=currentProject();}catch{}
    setSelected(form,planFor(project));
  }

  injectStyles();
  wireNewProjectForm();
  wireEditProjectForm();

  document.addEventListener('click',event=>{
    if(event.target.closest('#newProjectBtn')){
      queueMicrotask(()=>setSelected(document.getElementById('projectForm'),[]));
    }
    if(event.target.closest('#editProjectInfoBtn')){
      queueMicrotask(fillEditPlan);
    }
  },true);

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
      renderDetailPlan();
      decorateProjectCards();
      return result;
    };
  }

  decorateProjectCards();
  renderDetailPlan();
})();
