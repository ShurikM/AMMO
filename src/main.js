// ============================================================
//  AMMO SIMULATOR — Main entry point & event wiring
// ============================================================

import { S, resizeCanvas, loop, resetSim } from './sim/engine.js';
import { killDrone } from './sim/drones.js';
import { initCanvas, setupCanvasEvents, zoomIn, zoomOut, resetZoom } from './render/canvas.js';
import {
  togglePause, setSpeed, updateFleetConfig, updateEnv,
  setPlaceMode, showTab,
  killGroupLeader, killSquadLeader, killSquad,
  rfStorm, gpsBlackout, attackerStrike,
  clearZones, resetBattery, healAll, clearRoute,
  updateDroneInfoPanel,
  saveScenario, loadScenario, exportScenario, importScenario, deleteScenario, updateScenarioDropdown
} from './ui/panels.js';
import { openSpecModal, closeSpecModal, openBatchModal, closeBatchModal, startBatchRun } from './ui/modals.js';
import { initTooltip } from './ui/tooltip.js';
import { addAILog } from './ui/log.js';
import { initMap, toggleMap } from './render/map.js';
import { initMetricsTab, updateMetricsTab } from './render/charts.js';
import { startPlayback, stopPlayback, stepForward, stepBackward, seekTo, getSnapshotCount, getSnapshotTime, isPlaybackActive } from './sim/replay.js';
import { loadFaultSchedule, clearFaultSchedule, getExampleSchedule } from './sim/faults.js';
import { initAssertions } from './sim/assertions.js';
import { updateAssertPanel } from './ui/panels.js';
import { startMission, advancePhase, getCurrentPhase, PHASES } from './sim/mission.js';
import { spawnThreat, THREAT_TYPES } from './sim/threats.js';

// ---- Expose killDrone globally for dynamic inline onclick in drone info panel ----
window.killDrone = killDrone;

// ---- Init canvas ---------------------------------------------------------------
const { canvas } = initCanvas();
const wrap = document.getElementById('canvas-wrap');

// ---- Canvas events (zoom, pan, click, contextmenu) ----------------------------
setupCanvasEvents();

// ---- Tooltip -------------------------------------------------------------------
initTooltip();

// ---- Leaflet map ---------------------------------------------------------------
initMap();

// ---- Metrics dashboard ---------------------------------------------------------
initMetricsTab();
window._updateMetricsTab = function(force) {
  if (force) { updateMetricsTab(true); } else { updateMetricsTab(); }
};
setInterval(updateMetricsTab, 2000);

// ---- Assertions engine ---------------------------------------------------------
initAssertions();
setInterval(updateAssertPanel, 2000);

// ---- Map toggle button ---------------------------------------------------------
document.getElementById('btn-map-toggle').addEventListener('click', () => {
  const on = toggleMap();
  const btn = document.getElementById('btn-map-toggle');
  btn.classList.toggle('active', on);
  btn.textContent = on ? 'MAP ON' : 'MAP';
});

// ---- Topbar controls -----------------------------------------------------------
document.getElementById('btn-pause').addEventListener('click', togglePause);
document.getElementById('sp-05').addEventListener('click', () => setSpeed(0.5));
document.getElementById('sp-1').addEventListener('click', () => setSpeed(1));
document.getElementById('sp-2').addEventListener('click', () => setSpeed(2));
document.getElementById('sp-5').addEventListener('click', () => setSpeed(5));
document.getElementById('btn-reset').addEventListener('click', resetSim);

// ---- Fleet configuration sliders -----------------------------------------------
document.getElementById('cfg-squads').addEventListener('input', updateFleetConfig);
document.getElementById('cfg-workers').addEventListener('input', updateFleetConfig);
document.getElementById('cfg-relays').addEventListener('input', updateFleetConfig);

// ---- AI capability checkboxes --------------------------------------------------
document.getElementById('ai-gl').addEventListener('change', updateFleetConfig);
document.getElementById('ai-sl').addEventListener('change', updateFleetConfig);
document.getElementById('shadow-on').addEventListener('change', updateFleetConfig);

// ---- Hardware selects ----------------------------------------------------------
document.getElementById('hw-gl').addEventListener('change', updateFleetConfig);
document.getElementById('hw-sl').addEventListener('change', updateFleetConfig);
document.getElementById('hw-worker').addEventListener('change', updateFleetConfig);
document.getElementById('hw-relay').addEventListener('change', updateFleetConfig);
document.getElementById('btn-view-specs').addEventListener('click', openSpecModal);

// ---- Environment sliders -------------------------------------------------------
document.getElementById('cfg-range').addEventListener('input', updateEnv);
document.getElementById('cfg-noise').addEventListener('input', updateEnv);
document.getElementById('cfg-drain').addEventListener('input', updateEnv);

// ---- Place mode buttons --------------------------------------------------------
document.getElementById('mode-route').addEventListener('click', () => setPlaceMode('route'));
document.getElementById('btn-clear-route').addEventListener('click', clearRoute);
document.getElementById('mode-jam').addEventListener('click', () => setPlaceMode('jam'));
document.getElementById('mode-gps').addEventListener('click', () => setPlaceMode('gps'));
document.getElementById('mode-atk').addEventListener('click', () => setPlaceMode('attacker'));
document.getElementById('btn-clear-zones').addEventListener('click', clearZones);
document.getElementById('btn-place-threat').addEventListener('click', () => {
  S.placeMode = 'threat';
  const ind = document.getElementById('mode-indicator');
  ind.textContent = 'Click to place THREAT  |  ESC cancel';
  ind.style.opacity = '1';
});

// ---- Mission phase controls ----------------------------------------------------
document.getElementById('btn-start-mission').addEventListener('click', startMission);
document.getElementById('btn-advance-phase').addEventListener('click', advancePhase);

// ---- Inject event buttons ------------------------------------------------------
document.getElementById('btn-kill-gl').addEventListener('click', killGroupLeader);
document.getElementById('btn-kill-sl').addEventListener('click', killSquadLeader);
document.getElementById('btn-kill-squad').addEventListener('click', killSquad);
document.getElementById('btn-rf-storm').addEventListener('click', rfStorm);
document.getElementById('btn-gps-out').addEventListener('click', gpsBlackout);
document.getElementById('btn-attacker').addEventListener('click', attackerStrike);
document.getElementById('btn-recharge').addEventListener('click', resetBattery);
document.getElementById('btn-heal').addEventListener('click', healAll);

// ---- Tabs (event delegation) ---------------------------------------------------
document.getElementById('tabs').addEventListener('click', e => {
  const tab = e.target.closest('.tab');
  if (tab && tab.dataset.tab) showTab(tab.dataset.tab);
});

// ---- Zoom controls -------------------------------------------------------------
document.getElementById('btn-zoom-in').addEventListener('click', zoomIn);
document.getElementById('btn-zoom-out').addEventListener('click', zoomOut);
document.getElementById('btn-zoom-fit').addEventListener('click', resetZoom);

// ---- Spec modal close ----------------------------------------------------------
document.getElementById('spec-close').addEventListener('click', closeSpecModal);

// ---- Batch modal ---------------------------------------------------------------
document.getElementById('btn-batch').addEventListener('click', openBatchModal);
document.getElementById('batch-close').addEventListener('click', closeBatchModal);
document.getElementById('btn-start-batch').addEventListener('click', startBatchRun);

// ---- Scenario buttons ----------------------------------------------------------
document.getElementById('btn-scenario-save').addEventListener('click', saveScenario);
document.getElementById('btn-scenario-load').addEventListener('click', () => {
  const sel = document.getElementById('scenario-select');
  if (sel.value) loadScenario(sel.value);
});
document.getElementById('btn-scenario-export').addEventListener('click', exportScenario);
document.getElementById('btn-scenario-import').addEventListener('click', () => {
  document.getElementById('scenario-file-input').click();
});
document.getElementById('scenario-file-input').addEventListener('change', e => {
  if (e.target.files[0]) importScenario(e.target.files[0]);
  e.target.value = ''; // reset for re-import
});
document.getElementById('btn-scenario-delete').addEventListener('click', () => {
  const sel = document.getElementById('scenario-select');
  if (sel.value && confirm('Delete scenario: ' + sel.value + '?')) deleteScenario(sel.value);
});

// ---- Replay controls -----------------------------------------------------------
document.getElementById('btn-replay').addEventListener('click', () => {
  if (startPlayback()) {
    const bar = document.getElementById('replay-bar');
    bar.style.display = 'flex';
    const slider = document.getElementById('replay-slider');
    slider.max = getSnapshotCount() - 1;
    slider.value = slider.max;
    document.getElementById('btn-pause').textContent = 'REPLAY';
  }
});

document.getElementById('replay-exit').addEventListener('click', () => {
  stopPlayback();
  document.getElementById('replay-bar').style.display = 'none';
  document.getElementById('btn-pause').textContent = '\u25AE\u25AE PAUSE';
  S.paused = false;
});

document.getElementById('replay-step-back').addEventListener('click', () => {
  stepBackward();
  const slider = document.getElementById('replay-slider');
  slider.value = parseInt(slider.value) - 1;
  updateReplayTime();
});

document.getElementById('replay-step-fwd').addEventListener('click', () => {
  stepForward();
  const slider = document.getElementById('replay-slider');
  slider.value = parseInt(slider.value) + 1;
  updateReplayTime();
});

document.getElementById('replay-slider').addEventListener('input', e => {
  seekTo(parseInt(e.target.value));
  updateReplayTime();
});

function updateReplayTime() {
  const idx = parseInt(document.getElementById('replay-slider').value);
  const t = getSnapshotTime(idx);
  const mm = String(Math.floor(t/60)).padStart(2,'0');
  const ss = String(Math.floor(t%60)).padStart(2,'0');
  document.getElementById('replay-time').textContent = 'T+' + mm + ':' + ss;
}

// ---- Fault injection -----------------------------------------------------------
document.getElementById('btn-faults').addEventListener('click', () => {
  document.getElementById('fault-modal').classList.add('open');
});
document.getElementById('fault-close').addEventListener('click', () => {
  document.getElementById('fault-modal').classList.remove('open');
});
document.getElementById('btn-fault-example').addEventListener('click', () => {
  document.getElementById('fault-schedule-input').value = JSON.stringify(getExampleSchedule(), null, 2);
});
document.getElementById('btn-fault-load').addEventListener('click', () => {
  try {
    const schedule = JSON.parse(document.getElementById('fault-schedule-input').value);
    loadFaultSchedule(schedule);
    document.getElementById('fault-status').textContent = 'Loaded ' + schedule.length + ' fault events';
    document.getElementById('fault-status').style.color = 'var(--ok)';
  } catch (e) {
    document.getElementById('fault-status').textContent = 'Invalid JSON: ' + e.message;
    document.getElementById('fault-status').style.color = 'var(--alert)';
  }
});
document.getElementById('btn-fault-clear').addEventListener('click', () => {
  clearFaultSchedule();
  document.getElementById('fault-schedule-input').value = '';
  document.getElementById('fault-status').textContent = 'Schedule cleared';
  document.getElementById('fault-status').style.color = 'var(--muted)';
});

// ---- Keyboard bindings ---------------------------------------------------------
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { setPlaceMode(null); closeSpecModal(); closeBatchModal(); document.getElementById('fault-modal').classList.remove('open'); }
  if (e.key === ' ' && e.target === document.body) { e.preventDefault(); togglePause(); }
  if (e.key === '+') zoomIn();
  if (e.key === '-') zoomOut();
  if (e.key === '0') resetZoom();
});

// ---- Periodic AI decisions (every 9 seconds) -----------------------------------
setInterval(() => {
  if (S.paused) return;
  const ais = S.drones.filter(d => d.alive && d.aiEnabled);
  if (!ais.length) return;
  const msgs = [
    ['THREAT_ASSESS','Threat map updated. Rerouting squad around jamming corridor.'],
    ['FORMATION','Distributing worker coverage to maintain mesh connectivity.'],
    ['INTEL_FUSION','Aggregating sensor data. No critical anomalies. Flushing intel buffer.'],
    ['BATTERY_MGT','Low battery cluster detected. Reducing patrol radius. Shadow on standby.'],
    ['MESH_OPT','Routing table updated. Relay repositioned to close coverage gap.'],
    ['ROUTE_ADAPT','Route waypoint assessment complete. Adjusting squad assignments.'],
  ];
  const [tr, re] = msgs[Math.floor(Math.random() * msgs.length)];
  const l = ais[Math.floor(Math.random() * ais.length)];
  addAILog(l.role, tr, re);
}, 9000);

// ---- Phase bar update (every 500ms) --------------------------------------------
setInterval(() => {
  const phase = getCurrentPhase();
  document.querySelectorAll('.phase-pip').forEach(el => {
    const p = el.dataset.phase;
    const info = PHASES[p];
    if (p === phase) {
      el.style.borderColor = info.color;
      el.style.color = info.color;
      el.style.background = 'rgba(13,20,32,0.95)';
    } else {
      el.style.borderColor = '#1a2d45';
      el.style.color = '#4a6680';
      el.style.background = 'rgba(13,20,32,0.85)';
    }
  });
}, 500);

// ---- Resize handler (debounced) ------------------------------------------------
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => resizeCanvas(canvas, wrap), 200);
});

// ---- Load saved scenarios into dropdown ----------------------------------------
updateScenarioDropdown();

// ---- Boot ----------------------------------------------------------------------
resizeCanvas(canvas, wrap);
requestAnimationFrame(loop);
