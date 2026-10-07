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
          <div class="ternary-wrap"><svg id="ternarySvg" viewBox="0 0 440 390" role="img" aria-label="礫砂細粒分の三角座標"></svg></div>
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
      .grain-metric-grid span,.grain-metric-grid small{display:block;color:var(--muted);font-size:10px}.grain-metric-grid strong{display:block;color:var(--accent-dark);font-size:18px;margin:3px 0;overflow-wrap:anywhere}
      .grain-chart-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(280px,.85fr);gap:12px}
      .grain-chart-card{border:1px solid var(--line);border-radius:16px;background:#fff;padding:12px;min-width:0}
      .grain-chart-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px}.grain-chart-head strong{font-size:14px}.grain-chart-head span{font-size:10px;color:var(--muted);text-align:right}
      .svg-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}.svg-scroll svg{display:block;width:100%;min-width:620px;height:auto}
      .ternary-wrap svg{display:block;width:100%;max-width:440px;margin:0 auto;height:auto}.chart-hint{margin:8px 0 0;text-align:center}
      .grain-card-metrics{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;padding-top:9px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}
      .grain-card-metrics strong{color:var(--accent-dark)}
      @media(max-width:820px){.grain-metric-grid{grid-template-columns:repeat(3,1fr)}.grain-chart-grid{grid-template-columns:1fr}.grain-chart-head{flex-direction:column}.grain-chart-head span{text-align:left}}
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
    if (typeof useSedimentationEl !== 'undefined' && useSedimentationEl?.checked && typeof sedimentationSettingsExt === 'function' && typeof readSedimentationRowsExt === 'function') {
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
    Object.entries(map).forEach(([id,v]) => { const el=document.getElementById(id); if(el) el.textContent=fmtD(v); });
    const uc = document.getElementById('metricUc'); if (uc) uc.textContent = finite(m.uc) ? Number(m.uc).toFixed(2) : '—';
    const ucp = document.getElementById('metricUcp'); if (ucp) ucp.textContent = finite(m.ucp) ? Number(m.ucp).toFixed(2) : '—';
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
      const yy=y(p); svg.appendChild(svgEl('line',{x1:L,y1:yy,x2:W-R,y2:yy,stroke:p%20===0?'#d1dad7':'#e9eeec','stroke-width':1}));
      svg.appendChild(svgEl('text',{x:L-10,y:yy+4,'text-anchor':'end','font-size':10,fill:'#66736f'},String(p)));
    }
    [0.001,0.01,0.1,1,10,100].forEach(d=>{
      const xx=x(d); svg.appendChild(svgEl('line',{x1:xx,y1:T,x2:xx,y2:H-B,stroke:'#d1dad7','stroke-width':1}));
      svg.appendChild(svgEl('text',{x:xx,y:H-B+18,'text-anchor':'middle','font-size':10,fill:'#66736f'},String(d)));
    });
    [0.075,2].forEach((d,i)=>{
      const xx=x(d); svg.appendChild(svgEl('line',{x1:xx,y1:T,x2:xx,y2:H-B,stroke:'#7d8a86','stroke-width':1,'stroke-dasharray':'5 4'}));
      svg.appendChild(svgEl('text',{x:xx+4,y:T+13,'font-size':9,fill:'#53605d'},i===0?'0.075 mm':'2 mm'));
    });
    svg.appendChild(svgEl('text',{x:W/2,y:H-9,'text-anchor':'middle','font-size':11,fill:'#42504c'},'粒径 d (mm)'));
    svg.appendChild(svgEl('text',{x:15,y:H/2,'text-anchor':'middle','font-size':11,fill:'#42504c',transform:`rotate(-90 15 ${H/2})`},'通過質量百分率 (%)'));

    const visible=points.filter(pt=>pt.d>=.001&&pt.d<=100&&pt.p>=0&&pt.p<=100);
    if(visible.length){
      const poly=visible.map(pt=>`${x(pt.d).toFixed(1)},${y(pt.p).toFixed(1)}`).join(' ');
      svg.appendChild(svgEl('polyline',{points:poly,fill:'none',stroke:'#1e6f5c','stroke-width':2.5,'stroke-linejoin':'round','stroke-linecap':'round'}));
      visible.forEach(pt=>svg.appendChild(svgEl('circle',{cx:x(pt.d),cy:y(pt.p),r:pt.source==='sed'?3.5:4.2,fill:pt.source==='sed'?'#285d78':'#1e6f5c',stroke:'#fff','stroke-width':1.2})));
    }
    if(hint){
      const sieveCount=points.filter(p=>p.source==='sieve').length, sedCount=points.filter(p=>p.source==='sed').length;
      hint.textContent=points.length>=2?`ふるい ${sieveCount}点${sedCount?` ＋ 沈降 ${sedCount}点`:''} を描画中。D値は片対数補間。`:'2点以上の有効データが入ると曲線を描画します。';
    }
  }

  function bary(g,s,f, verts) {
    const sum=g+s+f || 1;
    return { x:(g*verts.g.x+s*verts.s.x+f*verts.f.x)/sum, y:(g*verts.g.y+s*verts.s.y+f*verts.f.y)/sum };
  }

  function drawTernary(fractions) {
    const svg=document.getElementById('ternarySvg'), hint=document.getElementById('ternaryHint');
    if(!svg) return; svg.innerHTML='';
    const v={g:{x:220,y:28},f:{x:34,y:334},s:{x:406,y:334}};
    svg.appendChild(svgEl('polygon',{points:`${v.g.x},${v.g.y} ${v.s.x},${v.s.y} ${v.f.x},${v.f.y}`,fill:'#fbfdfc',stroke:'#64736e','stroke-width':1.5}));
    [20,40,60,80].forEach(k=>{
      const a=bary(k,100-k,0,v), b=bary(k,0,100-k,v); svg.appendChild(svgEl('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#dfe7e4','stroke-width':1}));
      const c=bary(100-k,k,0,v), d=bary(0,k,100-k,v); svg.appendChild(svgEl('line',{x1:c.x,y1:c.y,x2:d.x,y2:d.y,stroke:'#dfe7e4','stroke-width':1}));
      const e=bary(100-k,0,k,v), f=bary(0,100-k,k,v); svg.appendChild(svgEl('line',{x1:e.x,y1:e.y,x2:f.x,y2:f.y,stroke:'#dfe7e4','stroke-width':1}));
    });
    svg.appendChild(svgEl('text',{x:v.g.x,y:16,'text-anchor':'middle','font-size':11,'font-weight':700,fill:'#33403d'},'礫分 100%'));
    svg.appendChild(svgEl('text',{x:v.f.x,y:354,'text-anchor':'middle','font-size':11,'font-weight':700,fill:'#33403d'},'細粒分 100%'));
    svg.appendChild(svgEl('text',{x:v.s.x,y:354,'text-anchor':'middle','font-size':11,'font-weight':700,fill:'#33403d'},'砂分 100%'));
    if(fractions && [fractions.gravel,fractions.sand,fractions.fines].every(finite)){
      const g=clamp(Number(fractions.gravel),0,100), s=clamp(Number(fractions.sand),0,100), f=clamp(Number(fractions.fines),0,100);
      const pt=bary(g,s,f,v);
      svg.appendChild(svgEl('circle',{cx:pt.x,cy:pt.y,r:7,fill:'#b42318',stroke:'#fff','stroke-width':2}));
      svg.appendChild(svgEl('circle',{cx:pt.x,cy:pt.y,r:10,fill:'none',stroke:'#b42318','stroke-width':1,opacity:.45}));
      svg.appendChild(svgEl('text',{x:220,y:380,'text-anchor':'middle','font-size':11,fill:'#53605d'},`礫 ${g.toFixed(1)}%　砂 ${s.toFixed(1)}%　細粒 ${f.toFixed(1)}%`));
      if(hint) hint.textContent='現在の礫分・砂分・細粒分を赤点でプロットしています。';
    } else if(hint) hint.textContent='2 mm と 0.075 mm の残留質量を入力するとプロットします。';
  }

  function renderGrainVisuals() {
    injectGrainVisualUI(); injectGrainVisualStyles();
    const data=currentCurvePoints();
    const m=grainMetrics(data.points); setMetrics(m); drawCurve(data.points); drawTernary(data.fractions);
  }

  if (typeof renderGrainCard === 'function') {
    const baseRenderGrainCardCharts = renderGrainCard;
    renderGrainCard = function(test) {
      const html = baseRenderGrainCardCharts(test);
      const m = grainMetrics(savedCurvePoints(test));
      const bits=[];
      if(finite(m.d50)) bits.push(`<span>D50 <strong>${fmtD(m.d50)} mm</strong></span>`);
      if(finite(m.uc)) bits.push(`<span>Uc <strong>${Number(m.uc).toFixed(2)}</strong></span>`);
      if(finite(m.ucp)) bits.push(`<span>Uc' <strong>${Number(m.ucp).toFixed(2)}</strong></span>`);
      return bits.length ? html + `<div class="grain-card-metrics">${bits.join('')}</div>` : html;
    };
  }

  if (typeof resetGrainDialog === 'function') {
    const baseResetCharts = resetGrainDialog;
    resetGrainDialog = function(){ baseResetCharts(); requestAnimationFrame(renderGrainVisuals); };
  }
  if (typeof openEditGrain === 'function') {
    const baseEditCharts = openEditGrain;
    openEditGrain = function(id){ baseEditCharts(id); requestAnimationFrame(renderGrainVisuals); };
  }

  document.addEventListener('input', e => { if(e.target?.closest?.('#grainForm')) requestAnimationFrame(renderGrainVisuals); });
  document.addEventListener('change', e => { if(e.target?.closest?.('#grainForm')) requestAnimationFrame(renderGrainVisuals); });
  injectGrainVisualUI(); injectGrainVisualStyles(); renderGrainVisuals();
})();
