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
    if(rows.length)return rows.slice(0,3);

    // 旧形式は1点だけ。3点へ勝手に複製せず、その1点だけ引き継ぐ。
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
    const wetDensity=rows.length
      ? rows.reduce((s,r)=>s+r.wetDensity,0)/rows.length
      : finite(test?.wetDensity);
    if(wetDensity===null||wetDensity<=0)return null;
    return {test,rows,wetDensity,sourceVolume,volumeMatches:Math.abs(sourceVolume-def.volume)<0.01,original:isLikelyOriginal(test)};
  }

  function findSource(target){
    const p=project(),sample=selectedSample();
    if(!p||!sample.name||!TARGETS[target])return null;
    return (p.tests||[])
      .filter(t=>isTargetType(t,target)&&sameSample(t,sample))
      .map(t=>candidateFrom(t,target)).filter(Boolean)
      .sort((a,b)=>(Number(b.original)-Number(a.original))||(b.rows.length-a.rows.length)||(timeOf(b.test)-timeOf(a.test)))[0]||null;
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

  function applyRows(rows,label,source){
    if(window.SoilNoteMixDensity3?.setMeasurements){
      const count=rows.length;
      const average=count?rows.reduce((s,r)=>s+r.wetDensity,0)/count:null;
      const text=count>=3
        ? `✓ 同一試料の原土${label}から密度3点を自動入力しました。平均 ${average.toFixed(3)} g/cm³`
        : `原土${label}は旧形式で密度元データが${count}点だけです。${count}点を自動入力しました。残り${3-count}点を入力してください。`;
      window.SoilNoteMixDensity3.setMeasurements(rows,text);
      setStatus(text,count<3);
      return;
    }
    // 3点平均モジュール未読込時の互換処理。
    const f=formEl();
    if(!f||!rows.length)return;
    const avgM=rows.reduce((s,r)=>s+r.moldMass,0)/rows.length;
    const avgMS=rows.reduce((s,r)=>s+r.moldSoilMass,0)/rows.length;
    f.elements.moldMass.value=String(avgM);f.elements.moldSoilMass.value=String(avgMS);
    f.elements.moldSoilMass.dispatchEvent(new Event('input',{bubbles:true}));
    setStatus(`原土${label}の密度データを反映しました。`);
  }

  function applyFromOriginal(){
    const f=formEl();if(!f)return;
    const target=clean(f.elements.specimenType?.value);

    if(currentMixTest()){
      setStatus('訂正中のため、保存済みの密度3点データを保持しています。');
      return;
    }

    clearInputs();
    if(!TARGETS[target]){
      setStatus('一軸圧縮試験はモールド質量とモールド＋土質量を3点入力し、その平均密度を使用します。');
      return;
    }

    const source=findSource(target),label=TARGETS[target].label;
    if(!source){
      setStatus(`同一試料の原土${label}データが見つかりません。密度3点を入力してください。`);
      return;
    }
    if(!source.volumeMatches){
      setStatus(`原土${label}のモールド体積が現在の条件と異なるため、自動入力しません。`,true);
      return;
    }
    if(!source.rows.length){
      setStatus(`原土${label}に湿潤密度 ${source.wetDensity.toFixed(3)} g/cm³ はありますが、元の質量データがないため自動入力できません。`,true);
      return;
    }
    applyRows(source.rows,label,source);
  }

  function bind(){
    const f=formEl();if(!f||f.dataset.originalDensityBound==='1')return;
    f.dataset.originalDensityBound='1';ensureStatus();
    f.elements.specimenType?.addEventListener('change',()=>setTimeout(applyFromOriginal,0));
    f.elements.sample?.addEventListener('change',()=>setTimeout(applyFromOriginal,0));
    f.addEventListener('input',event=>{
      if(!event.isTrusted)return;
      if(/^density(MoldMass|MoldSoilMass)[123]$/.test(event.target?.name||'')){
        setStatus('原土データからの自動入力後に手動変更しました。現在の3点入力値を使用します。');
      }
    });
    document.getElementById('addMixDesignBtn')?.addEventListener('click',()=>setTimeout(applyFromOriginal,0));
  }

  function init(){bind();if(!formEl())setTimeout(init,60);}
  init();
})();
