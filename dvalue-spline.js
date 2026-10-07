// D値補正：粒径加積曲線を log10(d)-P の自然3次スプラインで補間し、
// D10/D30/D50/D60 を滑らかな曲線から読み取る。
(function () {
  function finite(v) { return Number.isFinite(Number(v)); }
  function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

  function cleanPoints(points) {
    const sorted = points
      .filter(pt => finite(pt.d) && Number(pt.d) > 0 && finite(pt.p))
      .map(pt => ({ d: Number(pt.d), p: clamp(Number(pt.p), 0, 100) }))
      .sort((a, b) => a.d - b.d);

    const out = [];
    for (const pt of sorted) {
      const prev = out[out.length - 1];
      if (prev && Math.abs(Math.log10(prev.d) - Math.log10(pt.d)) < 1e-12) {
        prev.p = pt.p;
      } else {
        out.push(pt);
      }
    }
    return out;
  }

  function currentPoints() {
    if (typeof calculateGrain !== 'function') return [];
    const result = calculateGrain();
    if (!result?.valid) return [];
    const points = [];

    (result.sieves || []).forEach(row => {
      if (row.retained == null || !finite(row.size) || !finite(row.passing)) return;
      points.push({ d: Number(row.size), p: Number(row.passing) });
    });

    if (typeof useSedimentationEl !== 'undefined' && useSedimentationEl?.checked &&
        typeof sedimentationSettingsExt === 'function' && typeof readSedimentationRowsExt === 'function') {
      const settings = sedimentationSettingsExt();
      (readSedimentationRowsExt(settings) || []).forEach(row => {
        if (!row.valid || !finite(row.d) || !finite(row.overall)) return;
        points.push({ d: Number(row.d), p: Number(row.overall) });
      });
    }
    return cleanPoints(points);
  }

  function naturalSpline(points) {
    const pts = cleanPoints(points);
    if (pts.length < 3) return null;
    const x = pts.map(pt => Math.log10(pt.d));
    const a = pts.map(pt => pt.p);
    const n = x.length;
    const h = new Array(n - 1);
    for (let i = 0; i < n - 1; i++) {
      h[i] = x[i + 1] - x[i];
      if (!(h[i] > 0)) return null;
    }

    const alpha = new Array(n).fill(0);
    for (let i = 1; i < n - 1; i++) {
      alpha[i] = (3 / h[i]) * (a[i + 1] - a[i]) - (3 / h[i - 1]) * (a[i] - a[i - 1]);
    }

    const l = new Array(n).fill(0);
    const mu = new Array(n).fill(0);
    const z = new Array(n).fill(0);
    const c = new Array(n).fill(0);
    const b = new Array(n - 1).fill(0);
    const d = new Array(n - 1).fill(0);
    l[0] = 1;

    for (let i = 1; i < n - 1; i++) {
      l[i] = 2 * (x[i + 1] - x[i - 1]) - h[i - 1] * mu[i - 1];
      if (Math.abs(l[i]) < 1e-14) return null;
      mu[i] = h[i] / l[i];
      z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
    }
    l[n - 1] = 1;

    for (let j = n - 2; j >= 0; j--) {
      c[j] = z[j] - mu[j] * c[j + 1];
      b[j] = (a[j + 1] - a[j]) / h[j] - h[j] * (c[j + 1] + 2 * c[j]) / 3;
      d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
    }
    return { pts, x, a, b, c, d };
  }

  function evalInterval(s, i, xv) {
    const dx = xv - s.x[i];
    return s.a[i] + s.b[i] * dx + s.c[i] * dx * dx + s.d[i] * dx * dx * dx;
  }

  function diameterAtSmooth(points, target) {
    const pts = cleanPoints(points);
    if (pts.length < 2) return null;
    const spline = naturalSpline(pts);

    // 2点しかない場合は従来の片対数直線補間。
    if (!spline) {
      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i].p, p2 = pts[i + 1].p;
        if (target < Math.min(p1, p2) || target > Math.max(p1, p2) || p1 === p2) continue;
        const q = (target - p1) / (p2 - p1);
        return Math.pow(10, Math.log10(pts[i].d) + q * (Math.log10(pts[i + 1].d) - Math.log10(pts[i].d)));
      }
      return null;
    }

    for (let i = 0; i < spline.pts.length - 1; i++) {
      const p1 = spline.pts[i].p, p2 = spline.pts[i + 1].p;
      if (target < Math.min(p1, p2) || target > Math.max(p1, p2)) continue;

      let lo = spline.x[i], hi = spline.x[i + 1];
      let flo = evalInterval(spline, i, lo) - target;
      let fhi = evalInterval(spline, i, hi) - target;
      if (Math.abs(flo) < 1e-12) return Math.pow(10, lo);
      if (Math.abs(fhi) < 1e-12) return Math.pow(10, hi);

      // 端点で符号が変わらない稀な場合は従来補間にフォールバック。
      if (flo * fhi > 0) {
        if (p1 === p2) continue;
        const q = (target - p1) / (p2 - p1);
        return Math.pow(10, spline.x[i] + q * (spline.x[i + 1] - spline.x[i]));
      }

      for (let k = 0; k < 60; k++) {
        const mid = (lo + hi) / 2;
        const fm = evalInterval(spline, i, mid) - target;
        if (Math.abs(fm) < 1e-10) { lo = hi = mid; break; }
        if (flo * fm <= 0) {
          hi = mid;
          fhi = fm;
        } else {
          lo = mid;
          flo = fm;
        }
      }
      const logD = (lo + hi) / 2;
      const value = Math.pow(10, logD);
      return finite(value) && value > 0 ? value : null;
    }
    return null;
  }

  function metrics(points) {
    const d10 = diameterAtSmooth(points, 10);
    const d30 = diameterAtSmooth(points, 30);
    const d50 = diameterAtSmooth(points, 50);
    const d60 = diameterAtSmooth(points, 60);
    const uc = d10 && d60 ? d60 / d10 : null;
    const ucp = d10 && d30 && d60 ? (d30 * d30) / (d10 * d60) : null;
    return { d10, d30, d50, d60, uc, ucp };
  }

  function fmtD(v) {
    if (!finite(v) || Number(v) <= 0) return '—';
    const n = Number(v);
    if (n >= 10) return n.toFixed(2);
    if (n >= 1) return n.toFixed(3);
    if (n >= 0.1) return n.toFixed(3);
    return n.toPrecision(3);
  }

  function renderSmoothDValues() {
    const points = currentPoints();
    if (points.length < 2) return;
    const m = metrics(points);
    const values = {
      metricD10: fmtD(m.d10),
      metricD30: fmtD(m.d30),
      metricD50: fmtD(m.d50),
      metricD60: fmtD(m.d60),
      metricUc: finite(m.uc) ? Number(m.uc).toFixed(2) : '—',
      metricUcp: finite(m.ucp) ? Number(m.ucp).toFixed(2) : '—',
    };
    Object.entries(values).forEach(([id, text]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    });
    const hint = document.getElementById('curveHint');
    if (hint && points.length >= 3) {
      hint.textContent = `${points.length}点を滑らかな粒径加積曲線で補間。D値は曲線から自動読取り。`;
    }
  }

  function scheduleRender() {
    requestAnimationFrame(() => requestAnimationFrame(renderSmoothDValues));
  }

  document.addEventListener('input', e => {
    if (e.target?.closest?.('#grainForm')) scheduleRender();
  });
  document.addEventListener('change', e => {
    if (e.target?.closest?.('#grainForm')) scheduleRender();
  });
  document.addEventListener('submit', e => {
    if (e.target?.id === 'grainForm') scheduleRender();
  });

  window.grainDiameterAtSmooth = diameterAtSmooth;
  window.grainSmoothMetrics = metrics;
  scheduleRender();
})();