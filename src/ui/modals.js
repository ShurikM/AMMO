import { S } from '../sim/engine.js';
import { DRONE_TYPES, AI_LEVEL_DESC, MISSION_COLORS } from '../sim/drones.js';
import { runBatch, buildScenarios } from '../sim/batch.js';

export function openSpecModal() {
  const grid = document.getElementById('spec-grid');
  grid.innerHTML = '';
  Object.entries(DRONE_TYPES).forEach(([key, hw]) => {
    const ail = AI_LEVEL_DESC[hw.aiLevel||0];
    const missions = (hw.missionTypes||[]).map(m =>
      '<span style="font-size:9px;padding:1px 5px;background:rgba(0,0,0,0.4);border:1px solid '+(MISSION_COLORS[m]||'#444')+';color:'+(MISSION_COLORS[m]||'#888')+';margin:1px 2px;display:inline-block">'+m+'</span>'
    ).join('');
    const isSelected = [S.cfg.hwGL, S.cfg.hwSL, S.cfg.hwWorker, S.cfg.hwRelay].includes(key);
    const card = document.createElement('div');
    card.className = 'spec-card' + (isSelected ? ' selected' : '');
    card.innerHTML =
      '<div class="sc-name" style="color:'+hw.color+'">'+hw.name+'</div>'+
      '<div class="sc-class">'+hw.cls+'</div>'+
      '<div class="sc-row"><span class="sk">CPU</span><span class="sv" style="font-size:9px">'+hw.cpu+'</span></div>'+
      '<div class="sc-row"><span class="sk">GPU / NPU</span><span class="sv" style="font-size:9px">'+hw.gpu+'</span></div>'+
      '<div class="sc-row"><span class="sk">RAM</span><span class="sv">'+hw.ram+'</span></div>'+
      '<div class="sc-row"><span class="sk">Comms</span><span class="sv" style="font-size:9px">'+hw.comms+'</span></div>'+
      '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin:8px 0">'+
      ['Carry|'+hw.carryKg+'kg','Air|'+hw.airtimeMin+'min','Alt|'+hw.maxAltM+'m','Speed|'+hw.speedKmh+'kph','Mass|'+hw.weightKg+'kg','RF|'+hw.rfRangeMult+'x'].map(s=>{
        const [k,v]=s.split('|');
        return '<div style="text-align:center;background:rgba(0,0,0,0.3);padding:3px"><div style="font-size:8px;color:var(--muted);text-transform:uppercase">'+k+'</div><div style="font-family:Share Tech Mono,monospace;font-size:11px;color:var(--text)">'+v+'</div></div>';
      }).join('')+
      '</div>'+
      '<div class="cap-row"><div class="cap-label">AI Level</div>'+
      '<div style="display:flex;align-items:center;gap:6px;margin-top:3px">'+
      '<span style="font-family:Share Tech Mono,monospace;font-size:10px;color:'+ail.color+';min-width:60px">'+ail.label+'</span>'+
      '<div style="flex:1;height:4px;background:var(--border);border-radius:2px"><div style="width:'+((hw.aiLevel||0)/4*100)+'%;height:100%;background:'+ail.color+';border-radius:2px"></div></div>'+
      '</div><div style="font-size:9px;color:var(--muted);margin-top:3px;line-height:1.4">'+hw.aiDesc+'</div></div>'+
      '<div style="margin-top:6px"><div class="cap-label" style="margin-bottom:3px">Missions</div>'+missions+'</div>';
    grid.appendChild(card);
  });
  document.getElementById('spec-modal').classList.add('open');
}

export function closeSpecModal() {
  document.getElementById('spec-modal').classList.remove('open');
}

export function openBatchModal() {
  document.getElementById('batch-modal').classList.add('open');
}

export function closeBatchModal() {
  document.getElementById('batch-modal').classList.remove('open');
}

export function startBatchRun() {
  const count = parseInt(document.getElementById('batch-count').value) || 100;
  const duration = parseInt(document.getElementById('batch-duration').value) || 10;
  const sweepParam = document.querySelector('input[name="sweep"]:checked')?.value || 'none';
  const rangeStart = parseFloat(document.getElementById('sweep-start').value) || 2;
  const rangeEnd = parseFloat(document.getElementById('sweep-end').value) || 8;
  const steps = parseInt(document.getElementById('sweep-steps').value) || 4;

  const scenarios = buildScenarios(count, sweepParam, rangeStart, rangeEnd, steps);
  const progress = document.getElementById('batch-progress');
  const resultsDiv = document.getElementById('batch-results');

  progress.textContent = '0/' + scenarios.length;
  resultsDiv.innerHTML = 'Running...';

  runBatch(
    { ...S.cfg },
    scenarios,
    duration,
    sweepParam,
    { start: rangeStart, end: rangeEnd },
    (done, total) => { progress.textContent = done + '/' + total; },
    (results) => {
      progress.textContent = 'DONE';
      displayBatchResults(results, resultsDiv, sweepParam);
    }
  );
}

function displayBatchResults(results, container, sweepParam) {
  if (!results.length) { container.innerHTML = 'No results'; return; }

  // Group by sweep value if applicable
  const grouped = new Map();
  results.forEach(r => {
    const key = r.sweepValue != null ? r.sweepValue.toFixed(1) : 'all';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(r);
  });

  let html = '<table style="width:100%;font-size:10px;font-family:Share Tech Mono,monospace;border-collapse:collapse;">';
  html += '<tr style="color:#4a6680;border-bottom:1px solid #1a2d45;">';
  if (sweepParam !== 'none') html += '<th style="padding:4px;text-align:left;">Param</th>';
  html += '<th style="padding:4px;">Runs</th><th style="padding:4px;">Survival%</th><th style="padding:4px;">Avg Batt%</th><th style="padding:4px;">Elections</th><th style="padding:4px;">Mesh Up%</th></tr>';

  grouped.forEach((runs, key) => {
    const avgSurvival = runs.reduce((s,r) => s + r.summary.fleetSurvivalPct, 0) / runs.length;
    const avgBatt = runs.reduce((s,r) => s + r.summary.avgBatteryAtEnd, 0) / runs.length;
    const avgElections = runs.reduce((s,r) => s + r.summary.totalElections, 0) / runs.length;
    const avgMesh = runs.reduce((s,r) => s + r.summary.meshUptimePct, 0) / runs.length;
    html += '<tr style="border-bottom:1px solid #0d1520;">';
    if (sweepParam !== 'none') html += '<td style="padding:4px;color:#00d4ff;">' + key + '</td>';
    html += '<td style="padding:4px;text-align:center;">' + runs.length + '</td>';
    html += '<td style="padding:4px;text-align:center;color:' + (avgSurvival>60?'#00e87a':'#ff9000') + ';">' + avgSurvival.toFixed(1) + '</td>';
    html += '<td style="padding:4px;text-align:center;">' + avgBatt.toFixed(1) + '</td>';
    html += '<td style="padding:4px;text-align:center;">' + avgElections.toFixed(1) + '</td>';
    html += '<td style="padding:4px;text-align:center;color:' + (avgMesh>90?'#00e87a':'#ff9000') + ';">' + avgMesh.toFixed(1) + '</td>';
    html += '</tr>';
  });
  html += '</table>';

  // Export CSV button
  html += '<button id="batch-export-csv" style="margin-top:8px;font-size:10px;padding:4px 10px;width:100%;border:1px solid #00e87a;color:#00e87a;background:#0f1a28;cursor:pointer;font-family:Rajdhani,sans-serif;font-weight:600;">EXPORT CSV</button>';

  container.innerHTML = html;

  // Wire CSV export
  document.getElementById('batch-export-csv')?.addEventListener('click', () => {
    let csv = sweepParam !== 'none' ? 'sweep_value,' : '';
    csv += 'seed,survival_pct,avg_battery,elections,mesh_uptime_pct,total_drones,alive_at_end\n';
    results.forEach(r => {
      if (sweepParam !== 'none') csv += (r.sweepValue?.toFixed(1) || '') + ',';
      csv += r.seed + ',' + r.summary.fleetSurvivalPct.toFixed(2) + ',' + r.summary.avgBatteryAtEnd.toFixed(2) + ',' + r.summary.totalElections + ',' + r.summary.meshUptimePct.toFixed(2) + ',' + r.summary.totalDrones + ',' + r.summary.aliveAtEnd + '\n';
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ammo_batch_' + new Date().toISOString().replace(/[:.]/g, '-') + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  });
}
