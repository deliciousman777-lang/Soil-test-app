// 全試験共通：数値欄は数字キーボード＋数値以外を除外
(function(){
  const INTEGER_NAMES=[
    /^containerNo\d+$/,
    /^pycNo_\d+$/,
    /^waterNo\d+$/,
    /^cylinderNo$/,
    /^hydrometerNo$/,
    /^moldNo$/,
    /^llN_\d+$/,
    /^llNo_\d+$/,
    /^plNo_\d+$/
  ];

  const MULTI_INTEGER_NAMES=new Set([
    'washContainer2mmRetained',
    'washContainer2mmPassing'
  ]);

  function isIntegerName(name){
    return INTEGER_NAMES.some(re=>re.test(name||''));
  }

  function toHalfWidth(value){
    return String(value??'')
      .replace(/[０-９]/g,ch=>String.fromCharCode(ch.charCodeAt(0)-0xFEE0))
      .replace(/．/g,'.')
      .replace(/[，、]/g,',')
      .replace(/[−ー―]/g,'-')
      .replace(/点/g,'.');
  }

  function sanitizeDecimal(value){
    let s=toHalfWidth(value).replace(/[^0-9.\-]/g,'');
    const neg=s.startsWith('-');
    s=s.replace(/-/g,'');
    const dot=s.indexOf('.');
    if(dot>=0)s=s.slice(0,dot+1)+s.slice(dot+1).replace(/\./g,'');
    return (neg?'-':'')+s;
  }

  function sanitizeInteger(value){
    return toHalfWidth(value).replace(/[^0-9]/g,'');
  }

  function sanitizeMultiInteger(value){
    let s=toHalfWidth(value)
      .replace(/[\/／・\s]+/g,',')
      .replace(/[^0-9,]/g,'')
      .replace(/,+/g,',')
      .replace(/^,|,$/g,'');
    return s;
  }

  function modeFor(input){
    const name=input.name||'';
    if(MULTI_INTEGER_NAMES.has(name))return 'multi';
    if(isIntegerName(name))return 'integer';
    if(input.inputMode==='numeric')return 'integer';
    if(input.inputMode==='decimal')return 'decimal';
    if(input.type==='number')return 'decimal';
    return '';
  }

  function configure(input){
    if(!(input instanceof HTMLInputElement))return;
    if(['date','time','datetime-local','checkbox','radio','file','hidden'].includes(input.type))return;
    const mode=modeFor(input);
    if(!mode)return;

    input.dataset.numericOnly='1';
    input.autocomplete='off';
    input.autocapitalize='off';
    input.spellcheck=false;
    input.enterKeyHint=input.enterKeyHint||'next';

    if(mode==='decimal'){
      input.inputMode='decimal';
      input.pattern='[-0-9.]*';
    }else{
      input.inputMode='numeric';
      input.pattern='[0-9,]*';
    }
  }

  function sanitize(input){
    if(!(input instanceof HTMLInputElement)||input.dataset.numericOnly!=='1')return;
    const mode=modeFor(input);
    const before=input.value;
    let after=before;
    if(mode==='multi')after=sanitizeMultiInteger(before);
    else if(mode==='integer')after=sanitizeInteger(before);
    else if(mode==='decimal')after=sanitizeDecimal(before);
    if(after!==before){
      const pos=input.selectionStart;
      input.value=after;
      try{input.setSelectionRange(Math.min(pos??after.length,after.length),Math.min(pos??after.length,after.length));}catch{}
    }
  }

  function scan(root=document){
    root.querySelectorAll?.('input').forEach(configure);
  }

  document.addEventListener('input',e=>{
    const input=e.target;
    if(!(input instanceof HTMLInputElement))return;
    configure(input);
    if(e.isComposing)return;
    sanitize(input);
  },true);

  document.addEventListener('compositionend',e=>{
    const input=e.target;
    if(!(input instanceof HTMLInputElement))return;
    configure(input);
    sanitize(input);
    input.dispatchEvent(new Event('input',{bubbles:true}));
  },true);

  document.addEventListener('focusin',e=>{
    if(e.target instanceof HTMLInputElement)configure(e.target);
  },true);

  new MutationObserver(mutations=>{
    mutations.forEach(m=>m.addedNodes.forEach(node=>{
      if(node.nodeType!==1)return;
      if(node.matches?.('input'))configure(node);
      scan(node);
    }));
  }).observe(document.documentElement,{childList:true,subtree:true});

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>scan());
  else scan();
})();
