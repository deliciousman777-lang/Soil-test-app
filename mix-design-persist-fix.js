// 配合試験：3点湿潤密度・供試体作製条件・3配合を保存データへ確実に反映
(function(){
  'use strict';

  const TYPE='mix-design';
  const PREP_LABELS={
    'jcas-l01':'JCAS L-01（セメント協会仕様）',
    'jgs-0821':'JGS 0821（締固めをしない供試体作製・タッピング法）',
    tamping:'タンピング法（突棒による供試体作製）',
  };
  const SPEC={
    unconfined:{volume:196.3,count:3},
    cone:{volume:1000,count:1},
    cbr:{volume:2209,count:1},
  };

  const number=value=>{
    const text=String(value??'').trim();
    if(text==='')return null;
    const n=Number(text);
    return Number.isFinite(n)?n:null;
  };

  function value(form,name){return form?.elements?.[name]?.value??'';}

  function snapshot(form){
    const project=typeof currentProject==='function'?currentProject():null;
    if(!project)return null;
    const specimenType=value(form,'specimenType')||'unconfined';
    const def=SPEC[specimenType]||SPEC.unconfined;
    const densityMeasurements=[];
    for(let i=1;i<=def.count;i++){
      const moldMass=number(value(form,`densityMoldMass${i}`));
      const moldSoilMass=number(value(form,`densityMoldSoilMass${i}`));
      if(moldMass===null||moldSoilMass===null||moldSoilMass<=moldMass)continue;
      const soilMass=moldSoilMass-moldMass;
      densityMeasurements.push({moldMass,moldSoilMass,soilMass,wetDensity:soilMass/def.volume});
    }
    if(!densityMeasurements.length){
      const moldMass=number(value(form,'moldMass'));
      const moldSoilMass=number(value(form,'moldSoilMass'));
      if(moldMass!==null&&moldSoilMass!==null&&moldSoilMass>moldMass){
        const soilMass=moldSoilMass-moldMass;
        densityMeasurements.push({moldMass,moldSoilMass,soilMass,wetDensity:soilMass/def.volume});
      }
    }
    const avg=key=>densityMeasurements.length?densityMeasurements.reduce((s,r)=>s+r[key],0)/densityMeasurements.length:null;
    const wetDensity=avg('wetDensity');
    const batchSoilMass=number(value(form,'batchSoilMass'));
    const batchVolume=wetDensity!==null&&wetDensity>0&&batchSoilMass!==null?batchSoilMass/wetDensity:null;
    const additions=[1,2,3].map(i=>{
      const dosage=number(value(form,`dosage${i}`));
      return {dosage,cementMass:dosage!==null&&batchVolume!==null?(dosage/1000)*batchVolume:null};
    });
    const editingId=(typeof state!=='undefined'&&state)?state.editingTestId:null;
    return {
      projectId:project.id,
      editingId,
      beforeIds:new Set((project.tests||[]).filter(t=>t.type===TYPE).map(t=>t.id)),
      specimenType,
      moldVolume:def.volume,
      densityMeasurements,
      densityMeasurementCount:def.count,
      moldMass:avg('moldMass'),
      moldSoilMass:avg('moldSoilMass'),
      soilMass:avg('soilMass'),
      wetDensity,
      batchSoilMass,
      batchVolume,
      additions,
      preparationMethod:value(form,'preparationMethod'),
      specimenDate:value(form,'specimenDate'),
      compressionDate:value(form,'compressionDate'),
      airDays:number(value(form,'airCuringDays')),
      waterDays:number(value(form,'waterCuringDays')),
    };
  }

  function patchSaved(snap){
    const dialog=document.getElementById('mixDesignDialog');
    if(dialog?.open)return;
    const projects=(typeof state!=='undefined'&&state?.data?.projects)||[];
    const project=projects.find(p=>String(p.id)===String(snap.projectId));
    if(!project)return;
    let test=snap.editingId?(project.tests||[]).find(t=>t.id===snap.editingId&&t.type===TYPE):null;
    if(!test)test=[...(project.tests||[])].reverse().find(t=>t.type===TYPE&&!snap.beforeIds.has(t.id));
    if(!test)return;

    if(snap.densityMeasurements.length){
      test.densityMeasurements=snap.densityMeasurements;
      test.densityMeasurementCount=snap.densityMeasurementCount;
      test.moldVolume=snap.moldVolume;
      test.moldMass=snap.moldMass;
      test.moldSoilMass=snap.moldSoilMass;
      test.soilMass=snap.soilMass;
      test.wetDensity=snap.wetDensity;
      test.batchSoilMass=snap.batchSoilMass;
      test.batchVolume=snap.batchVolume;
      test.additions=snap.additions;
    }
    test.preparationMethod=snap.preparationMethod;
    test.preparationMethodLabel=PREP_LABELS[snap.preparationMethod]||snap.preparationMethod||'';
    test.specimenDate=snap.specimenDate;
    test.compressionDate=snap.compressionDate;
    test.curing={
      ...(test.curing||{}),
      airDays:snap.airDays,
      waterDays:snap.waterDays,
      totalEnteredDays:snap.airDays!==null||snap.waterDays!==null?(snap.airDays||0)+(snap.waterDays||0):null,
    };
    if(typeof saveData==='function')saveData();
    if(typeof renderTests==='function')renderTests();
  }

  window.addEventListener('submit',event=>{
    const form=event.target;
    if(!(form instanceof HTMLFormElement)||form.id!=='mixDesignForm')return;
    const snap=snapshot(form);
    if(!snap)return;
    setTimeout(()=>patchSaved(snap),0);
  },true);
})();
