// ---- Metrics Dashboard: KPI row, 4 Canvas2D mini-charts, export button ----------------------
import { METRICS, computeSummary } from '../sim/metrics.js';
import { S } from '../sim/engine.js';

let chartsContainer = null;
let kpiRow = null;
let chartCanvases = {};
let lastChartUpdate = 0;

// ---- initMetricsTab() -- build DOM for metrics tab content ----------------------------------
export function initMetricsTab() {
  chartsContainer = document.getElementById('metrics-content');
  if (!chartsContainer) return;

  // KPI row at top
  kpiRow = document.createElement('div');
  kpiRow.id = 'kpi-row';
  kpiRow.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:4px;padding:8px;';
  chartsContainer.appendChild(kpiRow);

  // 4 chart containers
  const chartNames = ['fleet-size', 'election-recovery', 'battery-dist', 'link-quality'];
  const chartLabels = ['Fleet Size', 'Election Recovery', 'Battery Distribution', 'Mesh Link Quality'];
  chartNames.forEach((name, i) => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'padding:4px 8px;';
    const label = document.createElement('div');
    label.style.cssText = 'font-size:9px;color:#4a6680;letter-spacing:1px;text-transform:uppercase;margin-bottom:3px;font-family:Rajdhani,sans-serif;font-weight:600;';
    label.textContent = chartLabels[i];
    wrap.appendChild(label);
    const cvs = document.createElement('canvas');
    cvs.width = 260;
    cvs.height = 100;
    cvs.style.cssText = 'width:100%;height:100px;background:#080c12;border:1px solid #1a2d45;';
    wrap.appendChild(cvs);
    chartsContainer.appendChild(wrap);
    chartCanvases[name] = cvs;
  });

  // Export button
  const expBtn = document.createElement('button');
  expBtn.textContent = 'EXPORT JSON';
  expBtn.style.cssText = 'margin:8px;font-size:10px;padding:5px 10px;width:calc(100% - 16px);border-color:#00e87a;color:#00e87a;background:#0f1a28;border:1px solid #00e87a;cursor:pointer;font-family:Rajdhani,sans-serif;font-weight:600;letter-spacing:1px;';
  expBtn.addEventListener('click', exportMetricsJSON);
  chartsContainer.appendChild(expBtn);
}

// ---- updateMetricsTab() -- throttled update (every 2s), force=true bypasses throttle --------
export function updateMetricsTab(force) {
  const now = performance.now();
  if (!force && now - lastChartUpdate < 2000) return;
  lastChartUpdate = now;

  if (!chartsContainer) return;

  computeSummary();
  updateKPIRow();
  drawFleetSizeChart();
  drawElectionRecoveryChart();
  drawBatteryDistChart();
  drawLinkQualityChart();
}

// ---- KPI Row ------------------------------------------------------------------------------------
function updateKPIRow() {
  if (!kpiRow) return;
  const s = METRICS.summary || {};
  const kpis = [
    { label: 'MTTR', value: ((s.avgElectionRecoveryMs || 0) / 1000).toFixed(1) + 's' },
    { label: 'MESH UP', value: (s.meshUptimePct || 0).toFixed(0) + '%' },
    { label: 'SURVIVAL', value: (s.fleetSurvivalPct || 0).toFixed(0) + '%' },
    { label: 'SHADOW WIN', value: (s.shadowWinRate || 0).toFixed(0) + '%' },
  ];
  kpiRow.innerHTML = kpis.map(k =>
    '<div style="text-align:center;background:#0d1420;padding:4px;border:1px solid #1a2d45;">' +
    '<div style="font-size:8px;color:#4a6680;letter-spacing:1px;font-family:Rajdhani,sans-serif;">' + k.label + '</div>' +
    '<div style="font-family:\'Share Tech Mono\',monospace;font-size:14px;color:#00e87a;">' + k.value + '</div>' +
    '</div>'
  ).join('');
}

// ---- Helper: clear canvas and return context ------------------------------------------------
function getCtx(name) {
  const cvs = chartCanvases[name];
  if (!cvs) return null;
  const ctx = cvs.getContext('2d');
  ctx.clearRect(0, 0, cvs.width, cvs.height);
  return ctx;
}

// ---- Fleet Size Chart (line + filled area) --------------------------------------------------
function drawFleetSizeChart() {
  const ctx = getCtx('fleet-size');
  if (!ctx) return;
  const tl = METRICS.timeline;
  const W = 260, H = 100;
  const PAD_L = 28, PAD_B = 14, PAD_T = 6, PAD_R = 4;
  const cw = W - PAD_L - PAD_R, ch = H - PAD_T - PAD_B;

  // Axes
  ctx.strokeStyle = '#1a2d45';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD_L, PAD_T);
  ctx.lineTo(PAD_L, H - PAD_B);
  ctx.lineTo(W - PAD_R, H - PAD_B);
  ctx.stroke();

  if (!tl.length) {
    drawNoData(ctx, W, H);
    return;
  }

  const maxAlive = Math.max(...tl.map(e => e.aliveCount), 1);
  const tMin = tl[0].t;
  const tMax = tl[tl.length - 1].t;
  const tSpan = tMax - tMin || 1;

  // Y axis ticks
  ctx.fillStyle = '#4a6680';
  ctx.font = '8px Share Tech Mono, monospace';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const v = Math.round(maxAlive * i / 4);
    const y = H - PAD_B - (i / 4) * ch;
    ctx.fillText(v, PAD_L - 3, y + 3);
    if (i > 0 && i < 4) {
      ctx.strokeStyle = 'rgba(26,45,69,0.4)';
      ctx.beginPath();
      ctx.moveTo(PAD_L, y);
      ctx.lineTo(W - PAD_R, y);
      ctx.stroke();
    }
  }

  // Filled area
  ctx.beginPath();
  ctx.moveTo(PAD_L, H - PAD_B);
  tl.forEach((e, i) => {
    const x = PAD_L + ((e.t - tMin) / tSpan) * cw;
    const y = H - PAD_B - (e.aliveCount / maxAlive) * ch;
    if (i === 0) ctx.lineTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.lineTo(PAD_L + cw, H - PAD_B);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0,232,122,0.12)';
  ctx.fill();

  // Line
  ctx.beginPath();
  tl.forEach((e, i) => {
    const x = PAD_L + ((e.t - tMin) / tSpan) * cw;
    const y = H - PAD_B - (e.aliveCount / maxAlive) * ch;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#00e87a';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// ---- Election Recovery Chart (horizontal bars) ----------------------------------------------
function drawElectionRecoveryChart() {
  const ctx = getCtx('election-recovery');
  if (!ctx) return;
  const elections = METRICS.elections;
  const W = 260, H = 100;
  const PAD_L = 28, PAD_B = 14, PAD_T = 6, PAD_R = 4;
  const cw = W - PAD_L - PAD_R, ch = H - PAD_T - PAD_B;

  // Axes
  ctx.strokeStyle = '#1a2d45';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD_L, PAD_T);
  ctx.lineTo(PAD_L, H - PAD_B);
  ctx.lineTo(W - PAD_R, H - PAD_B);
  ctx.stroke();

  if (!elections.length) {
    drawNoData(ctx, W, H);
    return;
  }

  // Show last N elections that fit
  const maxBars = Math.min(elections.length, 10);
  const visible = elections.slice(-maxBars);
  const maxMs = Math.max(...visible.map(e => e.recoveryMs), 1);
  const barH = Math.min(Math.floor(ch / maxBars) - 2, 12);
  const gap = Math.max(1, Math.floor((ch - barH * maxBars) / (maxBars + 1)));

  // X axis label (ms)
  ctx.fillStyle = '#4a6680';
  ctx.font = '7px Share Tech Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('0', PAD_L, H - 2);
  ctx.fillText(maxMs.toFixed(0) + 'ms', W - PAD_R, H - 2);

  visible.forEach((e, i) => {
    const y = PAD_T + gap + i * (barH + gap);
    const bw = (e.recoveryMs / maxMs) * cw;
    ctx.fillStyle = e.wasShadow ? '#00e87a' : '#ff9e00';
    ctx.fillRect(PAD_L, y, Math.max(bw, 2), barH);

    // Label
    ctx.fillStyle = '#4a6680';
    ctx.font = '7px Share Tech Mono, monospace';
    ctx.textAlign = 'right';
    ctx.fillText('#' + e.squadId, PAD_L - 3, y + barH - 1);
  });
}

// ---- Battery Distribution Chart (histogram) -------------------------------------------------
function drawBatteryDistChart() {
  const ctx = getCtx('battery-dist');
  if (!ctx) return;
  const W = 260, H = 100;
  const PAD_L = 28, PAD_B = 14, PAD_T = 6, PAD_R = 4;
  const cw = W - PAD_L - PAD_R, ch = H - PAD_T - PAD_B;

  // Axes
  ctx.strokeStyle = '#1a2d45';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD_L, PAD_T);
  ctx.lineTo(PAD_L, H - PAD_B);
  ctx.lineTo(W - PAD_R, H - PAD_B);
  ctx.stroke();

  const alive = S.drones.filter(d => d.alive);
  if (!alive.length) {
    drawNoData(ctx, W, H);
    return;
  }

  // Build 10 bins
  const bins = new Array(10).fill(0);
  alive.forEach(d => {
    const bi = Math.min(Math.floor(d.battery / 10), 9);
    bins[bi]++;
  });
  const maxBin = Math.max(...bins, 1);
  const barW = Math.floor(cw / 10) - 2;

  bins.forEach((count, i) => {
    const x = PAD_L + i * (cw / 10) + 1;
    const bh = (count / maxBin) * ch;
    const y = H - PAD_B - bh;

    // Color based on battery range midpoint
    const mid = i * 10 + 5;
    ctx.fillStyle = mid > 50 ? '#00e87a' : mid > 20 ? '#ff9e00' : '#ff3b3b';
    ctx.fillRect(x, y, barW, bh);
  });

  // X axis labels
  ctx.fillStyle = '#4a6680';
  ctx.font = '7px Share Tech Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('0%', PAD_L, H - 2);
  ctx.fillText('50%', PAD_L + cw / 2, H - 2);
  ctx.fillText('100%', W - PAD_R, H - 2);
}

// ---- Link Quality Chart (line) ---------------------------------------------------------------
function drawLinkQualityChart() {
  const ctx = getCtx('link-quality');
  if (!ctx) return;
  const tl = METRICS.timeline;
  const W = 260, H = 100;
  const PAD_L = 28, PAD_B = 14, PAD_T = 6, PAD_R = 4;
  const cw = W - PAD_L - PAD_R, ch = H - PAD_T - PAD_B;

  // Axes
  ctx.strokeStyle = '#1a2d45';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD_L, PAD_T);
  ctx.lineTo(PAD_L, H - PAD_B);
  ctx.lineTo(W - PAD_R, H - PAD_B);
  ctx.stroke();

  if (!tl.length) {
    drawNoData(ctx, W, H);
    return;
  }

  // Compute link quality as linkCount / maxPossibleLinks
  // maxPossibleLinks = n*(n-1)/2 where n = aliveCount
  const qualities = tl.map(e => {
    const maxLinks = e.aliveCount > 1 ? (e.aliveCount * (e.aliveCount - 1)) / 2 : 1;
    return Math.min(e.linkCount / maxLinks, 1);
  });

  const tMin = tl[0].t;
  const tMax = tl[tl.length - 1].t;
  const tSpan = tMax - tMin || 1;

  // Y axis ticks (0% to 100%)
  ctx.fillStyle = '#4a6680';
  ctx.font = '8px Share Tech Mono, monospace';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const pct = Math.round(i * 25);
    const y = H - PAD_B - (i / 4) * ch;
    ctx.fillText(pct + '%', PAD_L - 3, y + 3);
    if (i > 0 && i < 4) {
      ctx.strokeStyle = 'rgba(26,45,69,0.4)';
      ctx.beginPath();
      ctx.moveTo(PAD_L, y);
      ctx.lineTo(W - PAD_R, y);
      ctx.stroke();
    }
  }

  // Filled area
  ctx.beginPath();
  ctx.moveTo(PAD_L, H - PAD_B);
  qualities.forEach((q, i) => {
    const x = PAD_L + ((tl[i].t - tMin) / tSpan) * cw;
    const y = H - PAD_B - q * ch;
    ctx.lineTo(x, y);
  });
  ctx.lineTo(PAD_L + cw, H - PAD_B);
  ctx.closePath();
  ctx.fillStyle = 'rgba(0,255,204,0.1)';
  ctx.fill();

  // Line
  ctx.beginPath();
  qualities.forEach((q, i) => {
    const x = PAD_L + ((tl[i].t - tMin) / tSpan) * cw;
    const y = H - PAD_B - q * ch;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#00ffcc';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// ---- No Data placeholder -------------------------------------------------------------------
function drawNoData(ctx, W, H) {
  ctx.fillStyle = '#4a6680';
  ctx.font = '10px Share Tech Mono, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('NO DATA', W / 2, H / 2 + 3);
}

// ---- Export METRICS as JSON file ------------------------------------------------------------
function exportMetricsJSON() {
  computeSummary();
  const blob = new Blob([JSON.stringify(METRICS, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ammo_run_' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
  a.click();
  URL.revokeObjectURL(url);
}
