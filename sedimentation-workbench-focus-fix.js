// 沈降分析ワークベンチ：入力中のカーソル消失対策
// 進行中一覧は1秒ごとに再描画されるため、浮ひょう読み入力中だけ再描画を保留する。
(function(){
  const descriptor=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
  if(!descriptor?.get||!descriptor?.set)return;
  if(window.__soilnoteSedWorkbenchFocusFix)return;
  window.__soilnoteSedWorkbenchFocusFix=true;

  let editing=false;

  document.addEventListener('focusin',e=>{
    if(e.target?.matches?.('#sedWorkbenchList [data-sed-direct-input]'))editing=true;
  },true);

  document.addEventListener('focusout',e=>{
    if(!e.target?.matches?.('#sedWorkbenchList [data-sed-direct-input]'))return;
    // iOSではフォーカス移動直後に再描画するとキーボード操作と衝突するため少しだけ遅らせる。
    setTimeout(()=>{editing=false;},80);
  },true);

  Object.defineProperty(Element.prototype,'innerHTML',{
    configurable:descriptor.configurable,
    enumerable:descriptor.enumerable,
    get:descriptor.get,
    set:function(value){
      if(
        this?.id==='sedWorkbenchList' &&
        editing &&
        document.activeElement?.matches?.('#sedWorkbenchList [data-sed-direct-input]')
      ){
        return value;
      }
      return descriptor.set.call(this,value);
    }
  });
})();
