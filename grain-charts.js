// 粒度試験の可視化：粒径加積曲線・D値・均等係数・三角座標
(function () {
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }
  function finite(v) { return Number.isFinite(Number(v)); }
  function fmtD(v) {
    if (!finite(v) || v <= 0) return '—';
    const n = Number(v);
    if (n >= 10) return n.toFixed(2);
    if (n >= 1) return n.toFixed(3);
    if (n >= 0.1) return n.toFixed(3);
    return n.toPrecision(3);
  }

  function injectGrainVisualUI() {
    if (document.getElementById('grainVisualSection') || typeof grainForm === 'undefined' || !grainForm) return;
    const actions = grainForm.querySelector('.dialog-actions');
    if (!actions) return;
    const section = document.createElement('section');
    section.id = 'grainVisualSection';
    section.className = 'grain-visual-section';
    section.innerHTML = `
      <div class="subsection-head">
        <div><span class="step-badge">3</span><strong>粒度結果</strong></div>
        <p>ふるい分析と沈降分析をつないで、粒径加積曲線と三角座標をリアルタイム表示します。</p>
      </div>
      <div class="grain-metric-grid">
        <div><span>D10</span><strong id="metricD10">—</strong><small>mm</small></div>
        <div><span>D30</span><strong id="metricD30">—</strong><small>mm</small></div>
        <div><span>D50</span><strong id="metricD50">—</strong><small>mm</small></div>
        <div><span>D60</span><strong id="metricD60">—</strong><small>mm</small></div>
        <div><span>Uc</span><strong id="metricUc">—</strong><small>D60 / D10</small></div>
        <div><span>Uc'</span><strong id="metricUcp">—</strong><small>D30² / D10D60</small></div>
      </div>
      <div class="grain-chart-grid">
        <article class="grain-chart-card">
          <div class="grain-chart-head"><strong>粒径加積曲線</strong><span>横軸：粒径 mm（対数）／縦軸：通過質量百分率 %</span></div>
          <div class="svg-scroll"><svg id="gradationCurveSvg" viewBox="0 0 760 390" role="img" aria-label="粒径加積曲線"></svg></div>
          <p id="curveHint" class="hint chart-hint">ふるい残留質量を入力すると描画します。</p>
        </article>
        <article class="grain-chart-card">
          <div class="grain-chart-head"><strong>三角座標</strong><span>礫分・砂分・細粒分</span></div>
          <div class="ternary-wrap"><svg id="ternarySvg" viewBox="0 0 520 455" role="img" aria-label="礫砂細粒分の三角座標"></svg></div>
          <div id="ternaryClassResult" class="ternary-class-result">分類：—</div>
          <p id="ternaryHint" class="hint chart-hint">2 mm・0.075 mmの結果から自動プロットします。</p>
        </article>
      </div>`;
    actions.before(section);
  }

  function injectGrainVisualStyles() {
    if (document.getElementById('grainVisualStyles')) return;
    const style = document.createElement('style');
    style.id = 'grainVisualStyles';
    style.textContent = `
      .grain-visual-section{margin-top:22px;padding-top:2px;border-top:1px solid var(--line)}
      .grain-metric-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin:10px 0 14px}
      .grain-metric-grid>div{border:1px solid var(--line);border-radius:12px;background:#f8fbfa;padding:10px 6px;text-align:center;min-width:0}
      .grain-metric-grid span,.grain-metric-grid small{display:block;color:var(--muted);font-size:10px}
      .grain-metric-grid strong{display:block;color:var(--accent-dark);font-size:18px;margin:3px 0;overflow-wrap:anywhere}
      .grain-chart-grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(360px,1fr);gap:12px}
      .grain-chart-card{border:1px solid var(--line);border-radius:16px;background:#fff;padding:12px;min-width:0}
      .grain-chart-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px}
      .grain-chart-head strong{font-size:14px}.grain-chart-head span{font-size:10px;color:var(--muted);text-align:right}
      .svg-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}.svg-scroll svg{display:block;width:100%;min-width:620px;height:auto}
      .ternary-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}.ternary-wrap svg{display:block;width:100%;min-width:430px;max-width:520px;margin:0 auto;height:auto}
      .chart-hint{margin:8px 0 0;text-align:center}
      .ternary-class-result{margin:7px auto 0;padding:9px 12px;max-width:330px;border-radius:10px;background:#f3f8f6;text-align:center;font-size:13px;font-weight:800;color:var(--accent-dark)}
      .grain-card-metrics{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;padding-top:9px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}
      .grain-card-metrics strong{color:var(--accent-dark)}
      @media(max-width:900px){.grain-metric-grid{grid-template-columns:repeat(3,1fr)}.grain-chart-grid{grid-template-columns:1fr}.grain-chart-head{flex-direction:column}.grain-chart-head span{text-align:left}}
    `;
    document.head.appendChild(style);
  }

  function currentCurvePoints() {
    if (typeof calculateGrain !== 'function') return { points: [], fractions: null };
    const result = calculateGrain();
    if (!result?.valid) return { points: [], fractions: null };
    const points = [];
    (result.sieves || []).forEach(row => {
      if (row.retained == null || !finite(row.passing) || !finite(row.size) || Number(row.size) <= 0) return;
      points.push({ d: Number(row.size), p: clamp(Number(row.passing), 0, 100), source: 'sieve' });
    });
    if (typeof useSedimentationEl !== 'undefined' && useSedimentationEl?.checked &&
        typeof sedimentationSettingsExt === 'function' && typeof readSedimentationRowsExt === 'function') {
      const settings = sedimentationSettingsExt();
      const rows = readSedimentationRowsExt(settings);
      rows.forEach(row => {
        if (!row.valid || !finite(row.d) || Number(row.d) <= 0 || !finite(row.overall)) return;
        points.push({ d: Number(row.d), p: clamp(Number(row.overall), 0, 100), source: 'sed' });
      });
    }
    return { points: cleanPoints(points), fractions: result.fractions || null };
  }

  function savedCurvePoints(test) {
    if (!test || !finite(test.totalDryMass) || Number(test.totalDryMass) <= 0) return [];
    const total = Number(test.totalDryMass);
    const bySize = new Map((test.sieves || []).map(r => [Number(r.size), r.retained]));
    let cumulative = 0;
    const points = [];
    [53,37.5,26.5,19,9.5,4.75,2,.85,.425,.25,.106,.075].forEach(size => {
      const retained = bySize.get(Number(size));
      if (retained == null || !finite(retained)) return;
      cumulative += Number(retained);
      points.push({ d: Number(size), p: clamp(100 - cumulative / total * 100, 0, 100), source: 'sieve' });
    });
    if (test.sedimentation?.enabled) {
      (test.sedimentation.rows || []).forEach(row => {
        if (row.valid === false || !finite(row.d) || Number(row.d) <= 0 || !finite(row.overall)) return;
        points.push({ d: Number(row.d), p: clamp(Number(row.overall), 0, 100), source: 'sed' });
      });
    }
    return cleanPoints(points);
  }

  function cleanPoints(points) {
    const good = points.filter(pt => finite(pt.d) && pt.d > 0 && finite(pt.p));
    good.sort((a,b) => a.d - b.d);
    return good;
  }

  function diameterAt(points, target) {
    if (!Array.isArray(points) || points.length < 2) return null;
    const pts = [...points].sort((a,b) => a.d - b.d);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (!finite(a.p) || !finite(b.p) || a.p === b.p) continue;
      const low = Math.min(a.p, b.p), high = Math.max(a.p, b.p);
      if (target < low || target > high) continue;
      const ratio = (target - a.p) / (b.p - a.p);
      const logD = Math.log10(a.d) + ratio * (Math.log10(b.d) - Math.log10(a.d));
      const d = Math.pow(10, logD);
      if (finite(d) && d > 0) return d;
    }
    return null;
  }

  function grainMetrics(points) {
    const d10 = diameterAt(points, 10), d30 = diameterAt(points, 30), d50 = diameterAt(points, 50), d60 = diameterAt(points, 60);
    const uc = d10 && d60 ? d60 / d10 : null;
    const ucp = d10 && d30 && d60 ? (d30 * d30) / (d10 * d60) : null;
    return { d10, d30, d50, d60, uc, ucp };
  }

  function setMetrics(m) {
    const map = { metricD10:m.d10, metricD30:m.d30, metricD50:m.d50, metricD60:m.d60 };
    Object.entries(map).forEach(([id,v]) => {
      const el=document.getElementById(id);
      if(el) el.textContent=fmtD(v);
    });
    const uc = document.getElementById('metricUc');
    if (uc) uc.textContent = finite(m.uc) ? Number(m.uc).toFixed(2) : '—';
    const ucp = document.getElementById('metricUcp');
    if (ucp) ucp.textContent = finite(m.ucp) ? Number(m.ucp).toFixed(2) : '—';
  }

  function svgEl(name, attrs = {}, text = '') {
    const el = document.createElementNS(SVG_NS, name);
    Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k, String(v)));
    if (text !== '') el.textContent = text;
    return el;
  }

  function drawCurve(points) {
    const svg = document.getElementById('gradationCurveSvg');
    const hint = document.getElementById('curveHint');
    if (!svg) return;
    svg.innerHTML = '';
    const W=760,H=390,L=66,R=20,T=22,B=54,pw=W-L-R,ph=H-T-B;
    const logMin=-3, logMax=2;
    const x = d => L + (Math.log10(d)-logMin)/(logMax-logMin)*pw;
    const y = p => T + (100-p)/100*ph;

    svg.appendChild(svgEl('rect',{x:L,y:T,width:pw,height:ph,fill:'#fff',stroke:'#aebbb7'}));
    for(let p=0;p<=100;p+=10){
      const yy=y(p);
      svg.appendChild(svgEl('line',{x1:L,y1:yy,x2:W-R,y2:yy,stroke:p%20===0?'#d1dad7':'#e9eeec','stroke-width':1}));
      svg.appendChild(svgEl('text',{x:L-10,y:yy+4,'text-anchor':'end','font-size':10,fill:'#66736f'},String(p)));
    }
    [0.001,0.01,0.1,1,10,100].forEach(d=>{
      const xx=x(d);
      svg.appendChild(svgEl('line',{x1:xx,y1:T,x2:xx,y2:H-B,stroke:'#d1dad7','stroke-width':1}));
      svg.appendChild(svgEl('text',{x:xx,y:H-B+18,'text-anchor':'middle','font-size':10,fill:'#66736f'},String(d)));
    });
    [0.075,2].forEach((d,i)=>{
      const xx=x(d);
      svg.appendChild(svgEl('line',{x1:xx,y1:T,x2:xx,y2:H-B,stroke:'#7d8a86','stroke-width':1,'stroke-dasharray':'5 4'}));
      svg.appendChild(svgEl('text',{x:xx+4,y:T+13,'font-size':9,fill:'#53605d'},i===0?'0.075 mm':'2 mm'));
    });
    svg.appendChild(svgEl('text',{x:W/2,y:H-9,'text-anchor':'middle','font-size':11,fill:'#42504c'},'粒径 d (mm)'));
    svg.appendChild(svgEl('text',{x:15,y:H/2,'text-anchor':'middle','font-size':11,fill:'#42504c',transform:`rotate(-90 15 ${H/2})`},'通過質量百分率 (%)'));

    const visible=points.filter(pt=>pt.d>=.001&&pt.d<=100&&pt.p>=0&&pt.p<=100);
    if(visible.length){
      const poly=visible.map(pt=>`${x(pt.d).toFixed(1)},${y(pt.p).toFixed(1)}`).join(' ');
      svg.appendChild(svgEl('polyline',{points:poly,fill:'none',stroke:'#1e6f5c','stroke-width':2.5,'stroke-linejoin':'round','stroke-linecap':'round'}));
      visible.forEach(pt=>svg.appendChild(svgEl('circle',{
        cx:x(pt.d),cy:y(pt.p),r:pt.source==='sed'?3.5:4.2,
        fill:pt.source==='sed'?'#285d78':'#1e6f5c',stroke:'#fff','stroke-width':1.2
      })));
    }
    if(hint){
      const sieveCount=points.filter(p=>p.source==='sieve').length;
      const sedCount=points.filter(p=>p.source==='sed').length;
      hint.textContent=points.length>=2
        ? `ふるい ${sieveCount}点${sedCount?` ＋ 沈降 ${sedCount}点`:''} を描画中。D値は片対数補間。`
        : '2点以上の有効データが入ると曲線を描画します。';
    }
  }

  function bary(g,s,f, verts) {
    const sum=g+s+f || 1;
    return {
      x:(g*verts.g.x+s*verts.s.x+f*verts.f.x)/sum,
      y:(g*verts.g.y+s*verts.s.y+f*verts.f.y)/sum
    };
  }

  function classifyTernary(fractions) {
    if (!fractions || ![fractions.gravel,fractions.sand,fractions.fines].every(finite)) return null;
    const g=clamp(Number(fractions.gravel),0,100);
    const s=clamp(Number(fractions.sand),0,100);
    const f=clamp(Number(fractions.fines),0,100);
    if (f >= 50) return { code:'F', name:'細粒土', g,s,f };
    if (f >= 15) return g >= s
      ? { code:'GF', name:'礫質土', g,s,f }
      : { code:'SF', name:'砂質土', g,s,f };
    return g >= s
      ? { code:'G', name:'礫', g,s,f }
      : { code:'S', name:'砂', g,s,f };
  }

  function lineForComponent(component, value, v) {
    if (component === 'f') return [bary(100-value,0,value,v), bary(0,100-value,value,v)];
    if (component === 'g') return [bary(value,100-value,0,v), bary(value,0,100-value,v)];
    return [bary(100-value,value,0,v), bary(0,value,100-value,v)];
  }

  function drawGridLine(svg, component, value, v, major=false) {
    const [a,b]=lineForComponent(component,value,v);
    svg.appendChild(svgEl('line',{
      x1:a.x,y1:a.y,x2:b.x,y2:b.y,
      stroke:major?'#8d9894':'#cfd8d5',
      'stroke-width':major?1.15:.8,
      'stroke-dasharray':major?'4 3':'3 4',
      opacity:major?.95:.72
    }));
  }

  function edgePoint(a,b,t) {
    return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
  }

  function drawTernaryTicks(svg,v) {
    const ticks=[0,5,15,50,85,95,100];
    ticks.forEach(k=>{
      const t=k/100;
      const p=edgePoint(v.g,v.s,t);
      svg.appendChild(svgEl('text',{x:p.x,y:p.y+19,'text-anchor':'middle','font-size':9,fill:'#66736f'},String(k)));
      const lg=edgePoint(v.f,v.g,t);
      svg.appendChild(svgEl('text',{x:lg.x-10,y:lg.y+3,'text-anchor':'end','font-size':9,fill:'#66736f'},String(k)));
      const rf=edgePoint(v.s,v.f,t);
      svg.appendChild(svgEl('text',{x:rf.x+10,y:rf.y+3,'text-anchor':'start','font-size':9,fill:'#66736f'},String(k)));
    });
  }

  function drawRegionLabel(svg,text,g,s,f,v,sub='') {
    const p=bary(g,s,f,v);
    svg.appendChild(svgEl('text',{
      x:p.x,y:p.y-2,'text-anchor':'middle','font-size':14,'font-weight':800,fill:'#33403d'
    },text));
    if(sub) svg.appendChild(svgEl('text',{
      x:p.x,y:p.y+14,'text-anchor':'middle','font-size':9,fill:'#66736f'
    },sub));
  }

  function drawTernary(fractions) {
    const svg=document.getElementById('ternarySvg');
    const hint=document.getElementById('ternaryHint');
    const resultEl=document.getElementById('ternaryClassResult');
    if(!svg) return;
    svg.innerHTML='';

    const v={
      f:{x:260,y:32},
      g:{x:54,y:366},
      s:{x:466,y:366}
    };

    svg.appendChild(svgEl('polygon',{
      points:`${v.f.x},${v.f.y} ${v.s.x},${v.s.y} ${v.g.x},${v.g.y}`,
      fill:'#fbfdfc',stroke:'#33403d','stroke-width':2
    }));

    for(let k=10;k<100;k+=10){
      drawGridLine(svg,'f',k,v,false);
      drawGridLine(svg,'g',k,v,false);
      drawGridLine(svg,'s',k,v,false);
    }
    [5,15,50,85,95].forEach(k=>{
      drawGridLine(svg,'f',k,v,true);
      drawGridLine(svg,'g',k,v,true);
      drawGridLine(svg,'s',k,v,true);
    });

    [15,50].forEach(k=>{
      const [a,b]=lineForComponent('f',k,v);
      svg.appendChild(svgEl('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#202826','stroke-width':2.1}));
    });

    const a=bary(50,50,0,v);
    const b=bary(25,25,50,v);
    svg.appendChild(svgEl('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#202826','stroke-width':2.1}));

    drawRegionLabel(svg,'F',15,15,70,v,'細粒土');
    drawRegionLabel(svg,'GF',55,20,25,v,'礫質土');
    drawRegionLabel(svg,'SF',20,55,25,v,'砂質土');
    drawRegionLabel(svg,'G',70,25,5,v,'礫');
    drawRegionLabel(svg,'S',25,70,5,v,'砂');

    drawTernaryTicks(svg,v);

    svg.appendChild(svgEl('text',{
      x:260,y:431,'text-anchor':'middle','font-size':11,'font-weight':700,fill:'#33403d'
    },'砂分（0.075〜2 mm）（%）'));
    svg.appendChild(svgEl('text',{
      x:92,y:207,'text-anchor':'middle','font-size':11,'font-weight':700,fill:'#33403d',
      transform:'rotate(-59 92 207)'
    },'礫分（2〜75 mm）（%）'));
    svg.appendChild(svgEl('text',{
      x:428,y:207,'text-anchor':'middle','font-size':11,'font-weight':700,fill:'#33403d',
      transform:'rotate(59 428 207)'
    },'細粒分（0.075 mm未満）（%）'));

    const cls=classifyTernary(fractions);
    if(cls){
      const pt=bary(cls.g,cls.s,cls.f,v);
      svg.appendChild(svgEl('circle',{cx:pt.x,cy:pt.y,r:7.5,fill:'#b42318',stroke:'#fff','stroke-width':2}));
      svg.appendChild(svgEl('circle',{cx:pt.x,cy:pt.y,r:11,fill:'none',stroke:'#b42318','stroke-width':1.3,opacity:.55}));
      const labelY = pt.y < 75 ? pt.y + 28 : pt.y - 15;
      svg.appendChild(svgEl('text',{
        x:pt.x,y:labelY,'text-anchor':'middle','font-size':10,'font-weight':800,fill:'#b42318'
      },cls.code));
      svg.appendChild(svgEl('text',{
        x:260,y:451,'text-anchor':'middle','font-size':10,fill:'#53605d'
      },`礫 ${cls.g.toFixed(1)}%　砂 ${cls.s.toFixed(1)}%　細粒 ${cls.f.toFixed(1)}%`));
      if(resultEl) resultEl.textContent=`分類：${cls.name}（${cls.code}）`;
      if(hint) hint.textContent='画像と同じ5領域のベース三角座標に、現在の試料を赤点でプロットしています。';
    } else {
      if(resultEl) resultEl.textContent='分類：—';
      if(hint) hint.textContent='2 mm と 0.075 mm の残留質量を入力するとプロットします。';
    }
  }

  function renderGrainVisuals() {
    injectGrainVisualUI();
    injectGrainVisualStyles();
    const data=currentCurvePoints();
    const m=grainMetrics(data.points);
    setMetrics(m);
    drawCurve(data.points);
    drawTernary(data.fractions);
  }

  if (typeof renderGrainCard === 'function') {
    const baseRenderGrainCardCharts = renderGrainCard;
    renderGrainCard = function(test) {
      const html = baseRenderGrainCardCharts(test);
      const m = grainMetrics(savedCurvePoints(test));
      const cls = classifyTernary(test?.fractions);
      const bits=[];
      if(finite(m.d50)) bits.push(`<span>D50 <strong>${fmtD(m.d50)} mm</strong></span>`);
      if(finite(m.uc)) bits.push(`<span>Uc <strong>${Number(m.uc).toFixed(2)}</strong></span>`);
      if(finite(m.ucp)) bits.push(`<span>Uc' <strong>${Number(m.ucp).toFixed(2)}</strong></span>`);
      if(cls) bits.push(`<span>三角座標 <strong>${cls.code}</strong></span>`);
      return bits.length ? html + `<div class="grain-card-metrics">${bits.join('')}</div>` : html;
    };
  }

  if (typeof resetGrainDialog === 'function') {
    const baseResetCharts = resetGrainDialog;
    resetGrainDialog = function(){
      baseResetCharts();
      requestAnimationFrame(renderGrainVisuals);
    };
  }
  if (typeof openEditGrain === 'function') {
    const baseEditCharts = openEditGrain;
    openEditGrain = function(id){
      baseEditCharts(id);
      requestAnimationFrame(renderGrainVisuals);
    };
  }

  document.addEventListener('input', e => {
    if(e.target?.closest?.('#grainForm')) requestAnimationFrame(renderGrainVisuals);
  });
  document.addEventListener('change', e => {
    if(e.target?.closest?.('#grainForm')) requestAnimationFrame(renderGrainVisuals);
  });

  injectGrainVisualUI();
  injectGrainVisualStyles();
  renderGrainVisuals();
})();