// データシート2枚目の三角座標を会社の基準図に合わせて描画
(function(){
  const NS='http://www.w3.org/2000/svg';
  const svgEl=(name,attrs={},text='')=>{const e=document.createElementNS(NS,name);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,String(v)));if(text!=='')e.textContent=text;return e;};
  const finite=v=>Number.isFinite(Number(v));

  function fractionsFromReport(){
    const vals=[...document.querySelectorAll('#reportPage2 .r-frac strong')].slice(0,3).map(el=>parseFloat(String(el.textContent).replace(/[^0-9.+-]/g,'')));
    if(vals.length!==3||!vals.every(finite)) return null;
    return {g:vals[0],s:vals[1],f:vals[2]};
  }

  function bary(g,s,f,V){
    const sum=g+s+f||1;
    return {x:(g*V.g.x+s*V.s.x+f*V.f.x)/sum,y:(g*V.g.y+s*V.s.y+f*V.f.y)/sum};
  }

  function compLine(component,value,V){
    if(component==='f') return [bary(100-value,0,value,V),bary(0,100-value,value,V)];
    if(component==='g') return [bary(value,100-value,0,V),bary(value,0,100-value,V)];
    return [bary(100-value,value,0,V),bary(0,value,100-value,V)];
  }

  function addLine(svg,a,b,attrs={}){
    svg.appendChild(svgEl('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,...attrs}));
  }

  function addGrid(svg,component,value,V,major=false){
    const [a,b]=compLine(component,value,V);
    addLine(svg,a,b,{stroke:major?'#777':'#b8b8b8','stroke-width':major?1.05:.7,'stroke-dasharray':major?'4 3':'3 4',opacity:major?.95:.72});
  }

  function twoLine(svg,x,y,top,bottom){
    svg.appendChild(svgEl('text',{x,y:y-5,'text-anchor':'middle','font-size':12,'font-weight':600,fill:'#222'},top));
    svg.appendChild(svgEl('text',{x,y:y+12,'text-anchor':'middle','font-size':16,'font-weight':800,fill:'#111'},bottom));
  }

  function draw(){
    const svg=document.getElementById('reportTernarySvg');
    const fr=fractionsFromReport();
    if(!svg||!fr) return;

    svg.setAttribute('viewBox','0 0 560 520');
    svg.innerHTML='';
    const V={f:{x:280,y:48},g:{x:65,y:405},s:{x:495,y:405}};

    svg.appendChild(svgEl('polygon',{points:`${V.f.x},${V.f.y} ${V.s.x},${V.s.y} ${V.g.x},${V.g.y}`,fill:'#fff',stroke:'#111','stroke-width':1.8}));

    // 3方向の補助格子。10%ごとの細線＋会社図で目立つ5/15/50/85/95%。
    for(let k=10;k<100;k+=10){['f','g','s'].forEach(c=>addGrid(svg,c,k,V,false));}
    [5,15,50,85,95].forEach(k=>['f','g','s'].forEach(c=>addGrid(svg,c,k,V,true)));

    // 分類境界：細粒分15%、50%、礫分=砂分（細粒分50%まで）。
    [15,50].forEach(k=>{const [a,b]=compLine('f',k,V);addLine(svg,a,b,{stroke:'#111','stroke-width':1.8});});
    addLine(svg,bary(50,50,0,V),bary(25,25,50,V),{stroke:'#111','stroke-width':1.8});

    // 目盛。下辺=砂分、左辺=礫分、右辺=細粒分。
    const ticks=[0,5,15,50,85,95,100];
    ticks.forEach(k=>{
      const pb=bary(100-k,k,0,V);
      svg.appendChild(svgEl('text',{x:pb.x,y:pb.y+19,'text-anchor':'middle','font-size':9,fill:'#222'},String(k)));
      const pl=bary(k,0,100-k,V);
      svg.appendChild(svgEl('text',{x:pl.x-11,y:pl.y+3,'text-anchor':'end','font-size':9,fill:'#222'},String(k)));
      const pr=bary(0,100-k,k,V);
      svg.appendChild(svgEl('text',{x:pr.x+11,y:pr.y+3,'text-anchor':'start','font-size':9,fill:'#222'},String(k)));
    });

    // 軸名。
    svg.appendChild(svgEl('text',{x:280,y:486,'text-anchor':'middle','font-size':11,'font-weight':600,fill:'#111'},'砂 分（0.075～2mm）（%）'));
    svg.appendChild(svgEl('text',{x:102,y:236,'text-anchor':'middle','font-size':11,'font-weight':600,fill:'#111',transform:'rotate(-59 102 236)'},'礫 分（2～75mm）（%）'));
    svg.appendChild(svgEl('text',{x:458,y:236,'text-anchor':'middle','font-size':11,'font-weight':600,fill:'#111',transform:'rotate(59 458 236)'},'細粒分（0.075mm未満）（%）'));

    // 領域名。
    let p=bary(15,15,70,V); twoLine(svg,p.x,p.y,'細粒土','F');
    p=bary(56,19,25,V); twoLine(svg,p.x,p.y,'礫質土','GF');
    p=bary(19,56,25,V); twoLine(svg,p.x,p.y,'砂質土','SF');
    p=bary(72,23,5,V); twoLine(svg,p.x,p.y,'礫','G');
    p=bary(23,72,5,V); twoLine(svg,p.x,p.y,'砂','S');

    // 試料点。
    const pt=bary(fr.g,fr.s,fr.f,V);
    svg.appendChild(svgEl('circle',{cx:pt.x,cy:pt.y,r:6.8,fill:'#b42318',stroke:'#fff','stroke-width':1.8}));
    svg.appendChild(svgEl('circle',{cx:pt.x,cy:pt.y,r:10.5,fill:'none',stroke:'#b42318','stroke-width':1.1,opacity:.6}));
  }

  function schedule(){requestAnimationFrame(()=>requestAnimationFrame(draw));}
  const obs=new MutationObserver(muts=>{if(muts.some(m=>[...m.addedNodes].some(n=>n.nodeType===1&&(n.id==='reportPage2'||n.querySelector?.('#reportPage2'))))) schedule();});
  const start=()=>{
    obs.observe(document.body,{childList:true,subtree:true});
    document.addEventListener('change',e=>{if(e.target?.id==='reportSampleSelect')schedule();});
    document.addEventListener('click',e=>{if(e.target?.id==='openReportBtn')schedule();});
    schedule();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();