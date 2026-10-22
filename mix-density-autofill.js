// 配合試験：同一試料の原土試験から湿潤密度の元データを自動入力
(function(){
  'use strict';

  const TARGETS = {
    cone: { label:'コーン指数試験', volume:1000 },
    cbr: { label:'CBR試験', volume:2209 },
  };

  const clean = value => String(value ?? '').trim();
  const sameText = (a,b) => clean(a).toLocaleLowerCase('ja-JP') === clean(b).toLocaleLowerCase('ja-JP');
  const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;

  function formEl(){ return document.getElementById('mixDesignForm'); }
  function project(){ try{return currentProject?.()||null;}catch{return null;} }

  function currentMixTest(){
    const p=project();
    if(!p||!state?.editingTestId)return null;
    return (p.tests||[]).find(t=>t.id===state.editingTestId&&t.type==='mix-design')||null;
  }

  function selectedSample(){
    const f=formEl();
    const option=f?.elements.sample?.selectedOptions?.[0];
    return {id:clean(option?.dataset?.sampleId),name:clean(f?.elements.sample?.value)};
  }

  function sameSample(test,sample){
    const id=clean(test?.sampleId);
    if(sample.id&&id)return sample.id===id;
    return !!sample.name&&sameText(test?.sample,sample.name);
  }

  function isTargetType(test,target){
    const type=clean(test?.type).toLocaleLowerCase('ja-JP');
    if(!type||type==='mix-design')return false;
    if(target==='cone')return type==='cone-index'||type.includes('cone');
    if(target==='cbr')return type.includes('cbr');
    return false;
  }

  function isLikelyOriginal(test){
    return !clean(test?.cementName)&&!clean(test?.stabilizerName)&&!clean(test?.binderName)
      && test?.dosage==null&&!Array.isArray(test?.additions);
  }

  function timeOf(test){
    const t=new Date(test?.updatedAt||test?.createdAt||0).getTime();
    return Number.isFinite(t)?t:0;
  }

  function measurementRows(test,target){
    const def=TARGETS[target];
    if(!def)return [];
    const volume=finite(test?.moldVolume)??def.volume;
    const source=Array.isArray(test?.densityMeasurements)?test.densityMeasurements:[];
    const rows=source.map(row=>{
      const moldMass=finite(row?.moldMass);
      const moldSoilMass=finite(row?.moldSoilMass);
      if(moldMass===null||moldSoilMass===null||moldSoilMass<=moldMass)return null;
      return {moldMass,moldSoilMass,soilMass:moldSoilMass-moldMass,wetDensity:(moldSoilMass-moldMass)/volume};
    }).filter(Boolean);
    if(rows.length)return rows.slice(0,1);

    const moldMass=finite(test?.moldMass);
    const moldSoilMass=finite(test?.moldSoilMass);
    if(moldMass!==null&&moldSoilMass!==null&&moldSoilMass>moldMass){
      return [{moldMass,moldSoilMass,soilMass:moldSoilMass-moldMass,wetDensity:(moldSoilMass-moldMass)/volume}];
    }
    return [];
  }

  function candidateFrom(test,target){
    const def=TARGETS[target];
    if(!def)return null;
    const sourceVolume=finite(test?.moldVolume)??def.volume;
    const rows=measurementRows(test,target);
    const wetDensity=rows.length ? rows[0].wetDensity : finite(test?.wetDensity);
    if(wetDensity===null||wetDensity<=0)return null;
    return {test,rows,wetDensity,sourceVolume,volumeMatches:Math.abs(sourceVolume-def.volume)<0.01,original:isLikelyOriginal(test)};
  }

  function findSource(target){
    const p=project(),sample=selectedSample();
    if(!p||!sample.name||!TARGETS[target])return null;
    return (p.tests||[])
      .filter(t=>isTargetType(t,target)&&sameSample(t,sample))
      .map(t=>candidateFrom(t,target)).filter(Boolean)
      .sort((a,b)=>(Number(b.original)-Number(a.original))||(timeOf(b.test)-timeOf(a.test)))[0]||null;
  }

  function ensureStatus(){
    let el=document.getElementById('mixOriginalDensityStatus');
    if(el)return el;
    const section=document.getElementById('mixWetDensity')?.closest('.mix-panel');
    if(!section)return null;
    el=document.createElement('div');el.id='mixOriginalDensityStatus';el.className='mass-check';el.style.marginTop='10px';section.appendChild(el);return el;
  }
  function setStatus(text,error=false){const el=ensureStatus();if(!el)return;el.textContent=text;el.classList.toggle('error',!!error);}

  function clearInputs(){
    if(window.SoilNoteMixDensity3?.clear){window.SoilNoteMixDensity3.clear();return;}
    const f=formEl();if(!f)return;
    if(f.elements.moldMass)f.elements.moldMass.value='';
    if(f.elements.moldSoilMass)f.elements.moldSoilMass.value='';
  }

  function applyRows(rows,label){
    const row=rows[0];
    if(!row)return;
    const text=`✓ 同一試料の原土${label}から湿潤密度 ${row.wetDensity.toFixed(3)} g/cm³ を自動入力しました。`;
    if(window.SoilNoteMixDensity3?.setMeasurements){
      window.SoilNoteMixDensity3.setMeasurements([row],text);
      setStatus(text,false);
      return;
    }
    const f=formEl();
    if(!f)return;
    f.elements.moldMass.value=String(row.moldMass);
    f.elements.moldSoilMass.value=String(row.moldSoilMass);
    f.elements.moldSoilMass.dispatchEvent(new Event('input',{bubbles:true}));
    setStatus(text,false);
  }

  function applyFromOriginal(){
    const f=formEl();if(!f)return;
    const target=clean(f.elements.specimenType?.value);

    if(currentMixTest()){
      setStatus('訂正中のため、保存済みの湿潤密度データを保持しています。');
      return;
    }

    clearInputs();
    if(!TARGETS[target]){
      setStatus('一軸圧縮試験はモールド質量とモールド＋土質量を3点入力し、その平均密度を使用します。');
      return;
    }

    const source=findSource(target),label=TARGETS[target].label;
    if(!source){
      setStatus(`同一試料の原土${label}データが見つかりません。密度を1点入力してください。`);
      return;
    }
    if(!source.volumeMatches){
      setStatus(`原土${label}のモールド体積が現在の条件と異なるため、自動入力しません。`,true);
      return;
    }
    if(!source.rows.length){
      setStatus(`原土${label}に湿潤密度 ${source.wetDensity.toFixed(3)} g/cm³ はありますが、元のモールド質量データがないため自動入力できません。`,true);
      return;
    }
    applyRows(source.rows,label);
  }

  function bind(){
    const f=formEl();if(!f||f.dataset.originalDensityBound==='1')return;
    f.dataset.originalDensityBound='1';ensureStatus();
    f.elements.specimenType?.addEventListener('change',()=>setTimeout(applyFromOriginal,0));
    f.elements.sample?.addEventListener('change',()=>setTimeout(applyFromOriginal,0));
    f.addEventListener('input',event=>{
      if(!event.isTrusted)return;
      if(/^density(MoldMass|MoldSoilMass)[123]$/.test(event.target?.name||'')){
        const target=clean(f.elements.specimenType?.value);
        setStatus(TARGETS[target]
          ? '原土データからの自動入力後に手動変更しました。現在の1点入力値を使用します。'
          : '現在の3点入力値を使用します。');
      }
    });
    document.getElementById('addMixDesignBtn')?.addEventListener('click',()=>setTimeout(applyFromOriginal,0));
  }

  function init(){bind();if(!formEl())setTimeout(init,60);}
  init();
})();
