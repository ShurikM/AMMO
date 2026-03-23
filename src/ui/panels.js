import { S, resetSim } from '../sim/engine.js';
import { ROLES, RCOL, killDrone, AI_LEVEL_DESC, MISSION_COLORS } from '../sim/drones.js';
import { addLog, addAILog } from './log.js';
import { getDroneState, getDroneTransitions, STATE_COLORS, STATES } from '../sim/protocol.js';
import { getAssertionResults, RESULT } from '../sim/assertions.js';
import { getCommsLevel, COMMS_LEVEL } from '../sim/comms.js';

// ---- Drone info panel ----------------------------------------------------------------------------
export function updateDroneInfoPanel() {
  const panel=document.getElementById('drone-info');
  const d=S.selectedId?S.drones.find(d=>d.id===S.selectedId):null;
  if (!d){panel.innerHTML='<div style="padding:18px;color:var(--muted);font-family:\'Share Tech Mono\',monospace;font-size:11px">Click a drone to inspect</div>';return;}
  const hc=d.health>60?'var(--ok)':d.health>30?'var(--warn)':'var(--alert)';
  const bc=d.battery>40?'var(--ok)':d.battery>20?'var(--warn)':'var(--alert)';
  const hw=d.hw||{};
  const ail=AI_LEVEL_DESC[hw.aiLevel||0];
  const missions=(hw.missionTypes||[]).map(m=>'<span style="font-size:9px;padding:1px 5px;background:rgba(0,0,0,0.4);border:1px solid '+(MISSION_COLORS[m]||'#444')+';color:'+(MISSION_COLORS[m]||'#888')+';margin:1px 2px;display:inline-block">'+m+'</span>').join('');
  panel.innerHTML=
    '<div class="dstat"><div class="dsl">Identity</div>'+
    '<div class="dsv" style="color:'+d.color+'">'+d.role+' #'+d.id+'</div>'+
    '<div style="font-size:10px;color:var(--muted)">Squad '+d.squadId+' &middot; '+(d.alive?'<span style="color:var(--ok)">ALIVE</span>':'<span style="color:var(--alert)">DESTROYED</span>')+'</div>'+
    (d.shadowOf?'<div style="color:var(--sh);font-size:10px">Shadow &rarr; #'+d.shadowOf+'</div>':'')+
    '</div>'+
    (function(){
      var protoState = getDroneState(d.id);
      var stateCol = STATE_COLORS[protoState] || '#4a6680';
      var transitions = getDroneTransitions(d.id, 5);
      var transHtml = transitions.map(function(t) {
        var mm = String(Math.floor(t.t/60)).padStart(2,'0');
        var ss = String(Math.floor(t.t%60)).padStart(2,'0');
        return '<div style="font-size:9px;color:var(--muted)"><span style="color:var(--muted)">'+mm+':'+ss+'</span> '+t.from+' → <span style="color:'+STATE_COLORS[t.to]+'">'+t.to+'</span></div>';
      }).join('');
      return '<div class="dstat"><div class="dsl">Protocol State</div>' +
        '<div style="display:flex;align-items:center;gap:6px;margin:3px 0">' +
        '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + stateCol + '"></span>' +
        '<span style="font-family:\'Share Tech Mono\',monospace;font-size:12px;color:' + stateCol + ';font-weight:700">' + protoState + '</span>' +
        '</div>' +
        (transitions.length ? '<div class="dsl" style="margin-top:4px">Recent Transitions</div>' + transHtml : '') +
        '</div>';
    })()+
    '<div class="dstat" style="background:rgba(0,10,20,0.4)">'+
    '<div class="dsl" style="color:var(--gl)">'+hw.name+'</div>'+
    '<div style="font-size:9px;color:var(--muted);margin-bottom:6px">'+hw.cls+'</div>'+
    '<div class="sc-row"><span class="sk">CPU</span><span class="sv" style="font-size:9px;color:var(--text)">'+hw.cpu+'</span></div>'+
    '<div class="sc-row"><span class="sk">GPU/NPU</span><span class="sv" style="font-size:9px;color:var(--text)">'+hw.gpu+'</span></div>'+
    '<div class="sc-row"><span class="sk">RAM</span><span class="sv">'+hw.ram+'</span></div>'+
    '<div class="sc-row"><span class="sk">Comms</span><span class="sv" style="font-size:9px;color:var(--text)">'+hw.comms+'</span></div>'+
    '</div>'+
    '<div class="dstat">'+
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-bottom:6px">'+
    '<div style="text-align:center"><div class="dsl">Carry</div><div class="dsv" style="font-size:12px">'+hw.carryKg+'kg</div></div>'+
    '<div style="text-align:center"><div class="dsl">Air Time</div><div class="dsv" style="font-size:12px">'+hw.airtimeMin+'min</div></div>'+
    '<div style="text-align:center"><div class="dsl">Alt Max</div><div class="dsv" style="font-size:12px">'+hw.maxAltM+'m</div></div>'+
    '<div style="text-align:center"><div class="dsl">Speed</div><div class="dsv" style="font-size:12px">'+hw.speedKmh+'km/h</div></div>'+
    '<div style="text-align:center"><div class="dsl">Weight</div><div class="dsv" style="font-size:12px">'+hw.weightKg+'kg</div></div>'+
    '<div style="text-align:center"><div class="dsl">RF Mult</div><div class="dsv" style="font-size:12px">'+hw.rfRangeMult+'x</div></div>'+
    '</div>'+
    '<div class="dsl" style="margin-bottom:3px">AI Capability</div>'+
    '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">'+
    '<span style="font-family:\'Share Tech Mono\',monospace;font-size:11px;color:'+ail.color+';font-weight:700">'+ail.label+'</span>'+
    '<div style="flex:1;height:4px;background:var(--border);border-radius:2px"><div style="width:'+((hw.aiLevel||0)/4*100)+'%;height:100%;background:'+ail.color+';border-radius:2px"></div></div>'+
    '</div>'+
    '<div style="font-size:9px;color:var(--muted);line-height:1.4;margin-bottom:6px">'+hw.aiDesc+'</div>'+
    '<div class="dsl" style="margin-bottom:3px">Mission Types</div>'+
    '<div>'+missions+'</div>'+
    '</div>'+
    '<div class="dstat"><div class="dsr">'+
    '<div><div class="dsl">Health</div><div class="dsv" style="color:'+hc+'">'+Math.round(d.health)+'%</div></div>'+
    '<div><div class="dsl">Battery</div><div class="dsv" style="color:'+bc+'">'+Math.round(d.battery)+'%</div></div>'+
    '<div><div class="dsl">Links</div><div class="dsv">'+S.links.filter(l=>l.a.id===d.id||l.b.id===d.id).length+'</div></div>'+
    '</div>'+
    '<div class="hbar" style="margin-top:5px"><div class="hfill" style="width:'+d.battery+'%;background:'+bc+'"></div></div>'+
    '</div>'+
    '<div class="dstat"><div class="dsr">'+
    '<div><div class="dsl">RF</div><div class="dsv" style="color:'+(d.jammed?'var(--alert)':'var(--ok)')+'">'+( d.jammed?'JAMMED':'CLEAR')+'</div></div>'+
    '<div><div class="dsl">GPS</div><div class="dsv" style="color:'+(d.gpsLost?'var(--warn)':'var(--ok)')+'">'+( d.gpsLost?'DENIED':'OK')+'</div></div>'+
    '<div><div class="dsl">Task</div><div class="dsv">'+Math.round(d.taskProgress)+'%</div></div>'+
    '<div><div class="dsl">Comms</div><div class="dsv" style="color:'+(getCommsLevel(d.id).level.color)+'">'+(getCommsLevel(d.id).level.label)+'</div></div>'+
    '</div></div>'+
    (d.alive?'<div style="padding:7px 11px"><button onclick="killDrone('+d.id+',\'Manual kill\')" class="danger" style="width:100%">DESTROY #'+d.id+'</button></div>':'');
}

// ---- Tabs ----------------------------------------------------------------------------------------------------
export function showTab(n) {
  const tabNames = ['events','decisions','drone','metrics','assert'];
  const tabIds = ['event-log','decision-log','drone-info','metrics-content','assert-content'];
  document.querySelectorAll('.tab').forEach((tab, i) => {
    if (i < tabNames.length) tab.classList.toggle('active', tabNames[i] === n);
  });
  tabIds.forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', tabNames[i] === n);
  });
  if (n === 'drone') updateDroneInfoPanel();
  if (n === 'metrics' && window._updateMetricsTab) window._updateMetricsTab(true);
  if (n === 'assert') updateAssertPanel();
}

// ---- Assertion panel -----------------------------------------------------------------------------------------
export function updateAssertPanel() {
  const panel = document.getElementById('assert-content');
  if (!panel) return;
  const results = getAssertionResults();

  const COLORS = {
    PASS: '#00e87a',
    FAIL: '#ff3b3b',
    WARN: '#ff9000',
    PENDING: '#4a6680'
  };

  let html = '<div style="padding:8px;">';

  // Summary bar
  const counts = { PASS:0, FAIL:0, WARN:0, PENDING:0 };
  results.forEach(r => counts[r.result]++);
  html += '<div style="display:flex;gap:8px;margin-bottom:8px;font-family:Share Tech Mono,monospace;font-size:11px;">';
  html += '<span style="color:#00e87a;">' + counts.PASS + ' PASS</span>';
  html += '<span style="color:#ff3b3b;">' + counts.FAIL + ' FAIL</span>';
  html += '<span style="color:#ff9000;">' + counts.WARN + ' WARN</span>';
  html += '<span style="color:#4a6680;">' + counts.PENDING + ' PEND</span>';
  html += '</div>';

  // Individual assertions
  results.forEach(r => {
    const col = COLORS[r.result] || '#4a6680';
    const sevBadge = r.severity === 'critical' ? '<span style="color:#ff3b3b;font-size:8px;margin-left:4px;">CRIT</span>' : '';
    html += '<div style="padding:6px;border-bottom:1px solid #0d1520;border-left:3px solid ' + col + ';margin-bottom:2px;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
    html += '<span style="font-size:11px;color:var(--text);">' + r.name + sevBadge + '</span>';
    html += '<span style="font-family:Share Tech Mono,monospace;font-size:10px;color:' + col + ';font-weight:700;">' + r.result + '</span>';
    html += '</div>';
    html += '<div style="font-size:9px;color:var(--muted);margin-top:2px;">' + (r.detail || '') + '</div>';
    html += '</div>';
  });

  html += '</div>';
  panel.innerHTML = html;
}

// ---- Place mode ----------------------------------------------------------------------------------------
export function setPlaceMode(mode) {
  S.placeMode=mode;
  const ind=document.getElementById('mode-indicator');
  if (mode) {
    const lbl=mode==='route'?'Click to add waypoints (right-click to finish)':('Click to place '+mode.toUpperCase()+' zone  |  ESC cancel');
    ind.textContent=lbl; ind.style.opacity='1';
  } else { ind.style.opacity='0'; }
  ['mode-route','mode-jam','mode-gps','mode-atk'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.classList.remove('active');
  });
  if (mode) {const m={'route':'mode-route','jam':'mode-jam','gps':'mode-gps','attacker':'mode-atk'};const el=document.getElementById(m[mode]);if(el) el.classList.add('active');}
}

// ---- Controls --------------------------------------------------------------------------------------------
export function togglePause(){S.paused=!S.paused;const b=document.getElementById('btn-pause');b.textContent=S.paused?'RESUME':'\u25AE\u25AE PAUSE';b.classList.toggle('active',S.paused);}
export function setSpeed(s){S.speed=s;['sp-05','sp-1','sp-2','sp-5'].forEach(id=>document.getElementById(id).classList.remove('active'));const m={0.5:'sp-05',1:'sp-1',2:'sp-2',5:'sp-5'};document.getElementById(m[s]).classList.add('active');}

// ---- Fleet config --------------------------------------------------------------------------------------------
export function updateFleetConfig(){
  const c=S.cfg;
  c.squads=+document.getElementById('cfg-squads').value;
  c.workers=+document.getElementById('cfg-workers').value;
  c.relays=+document.getElementById('cfg-relays').value;
  c.aiGL=document.getElementById('ai-gl').checked;
  c.aiSL=document.getElementById('ai-sl').checked;
  c.shadowOn=document.getElementById('shadow-on').checked;
  c.hwGL=document.getElementById('hw-gl').value;
  c.hwSL=document.getElementById('hw-sl').value;
  c.hwWorker=document.getElementById('hw-worker').value;
  c.hwRelay=document.getElementById('hw-relay').value;
  document.getElementById('val-squads').textContent=c.squads;
  document.getElementById('val-workers').textContent=c.workers;
  document.getElementById('val-relays').textContent=c.relays;
  resetSim();
}

// ---- Environment --------------------------------------------------------------------------------------------
export function updateEnv(){
  S.cfg.rfRange=+document.getElementById('cfg-range').value;
  S.cfg.noise=+document.getElementById('cfg-noise').value;
  S.cfg.battDrain=+document.getElementById('cfg-drain').value;
  document.getElementById('val-range').textContent=S.cfg.rfRange;
  document.getElementById('val-noise').textContent=S.cfg.noise;
  document.getElementById('val-drain').textContent=S.cfg.battDrain;
}

// ---- Scenario buttons ----------------------------------------------------------------------------
export function killGroupLeader(){const g=S.drones.find(d=>d.alive&&d.role===ROLES.GL);g?killDrone(g.id,'Targeted strike'):addLog('No GL found','warn');}
export function killSquadLeader(){const sls=S.drones.filter(d=>d.alive&&(d.role===ROLES.SL||d.role===ROLES.ASL));sls.length?killDrone(sls[Math.floor(Math.random()*sls.length)].id,'Targeted strike'):addLog('No SL found','warn');}
export function killSquad(){
  const sls=S.drones.filter(d=>d.alive&&(d.role===ROLES.SL||d.role===ROLES.ASL));
  if (!sls.length) return;
  const t=sls[Math.floor(Math.random()*sls.length)];
  const sq=S.drones.filter(d=>d.squadId===t.squadId);
  addLog('SQUAD '+t.squadId+' WIPE -- '+sq.length+' drones targeted','alert');
  sq.forEach(d=>setTimeout(()=>killDrone(d.id,'Squad wipe'),Math.random()*900));
}
export function rfStorm(){clearZones();S.zones.push({type:'jam',x:S.worldWidth*0.33,y:S.worldHeight*0.4,radius:155});S.zones.push({type:'jam',x:S.worldWidth*0.67,y:S.worldHeight*0.55,radius:120});addLog('RF STORM -- dual jam zones active','alert');}
export function gpsBlackout(){S.zones.push({type:'gps',x:S.worldWidth/2,y:S.worldHeight/2,radius:S.worldHeight*0.44});addLog('GPS BLACKOUT -- dead reckoning active','warn');const gl=S.drones.find(d=>d.alive&&d.role===ROLES.GL&&d.aiEnabled);if(gl)addAILog('GL','GPS_DENY','GPS lost. Dead reckoning enabled. Relay chain routing.');}
export function attackerStrike(){const x=Math.random()<0.5?S.worldWidth*0.2:S.worldWidth*0.8;S.zones.push({type:'attacker',x,y:S.worldHeight/2+(Math.random()-0.5)*100,radius:85,ang:Math.random()*Math.PI*2});addLog('HOSTILE DRONE detected','alert');}
export function clearZones(){S.zones=[];addLog('All zones cleared','ok');}
export function resetBattery(){S.drones.filter(d=>d.alive).forEach(d=>d.battery=88+Math.random()*12);addLog('Battery recharged -- all drones','ok');}
export function healAll(){S.drones.filter(d=>d.alive).forEach(d=>d.health=88+Math.random()*12);addLog('Health restored -- all drones','ok');}
export function clearRoute(){S.route=[];document.getElementById('route-info').style.display='none';addLog('Mission route cleared','ok');}

// ---- Scenario Save/Load ----------------------------------------------------------------------------
export function saveScenario() {
  const name = prompt('Scenario name:', 'Scenario ' + new Date().toISOString().slice(0, 16));
  if (!name) return;
  const scenario = {
    name,
    description: '',
    version: '0.4',
    cfg: { ...S.cfg },
    zones: S.zones.map(z => ({ ...z })),
    route: S.route.map(wp => ({ ...wp })),
    savedAt: new Date().toISOString()
  };
  localStorage.setItem('ammo_scenario_' + name, JSON.stringify(scenario));
  addLog('Scenario saved: ' + name, 'ok');
  updateScenarioDropdown();
}

export function loadScenario(name) {
  const raw = localStorage.getItem('ammo_scenario_' + name);
  if (!raw) { addLog('Scenario not found: ' + name, 'warn'); return; }
  const scenario = JSON.parse(raw);

  // Apply config
  Object.assign(S.cfg, scenario.cfg);

  // Update all DOM inputs to match loaded config
  document.getElementById('cfg-squads').value = S.cfg.squads;
  document.getElementById('cfg-workers').value = S.cfg.workers;
  document.getElementById('cfg-relays').value = S.cfg.relays;
  document.getElementById('ai-gl').checked = S.cfg.aiGL;
  document.getElementById('ai-sl').checked = S.cfg.aiSL;
  document.getElementById('shadow-on').checked = S.cfg.shadowOn;
  document.getElementById('hw-gl').value = S.cfg.hwGL;
  document.getElementById('hw-sl').value = S.cfg.hwSL;
  document.getElementById('hw-worker').value = S.cfg.hwWorker;
  document.getElementById('hw-relay').value = S.cfg.hwRelay;
  document.getElementById('cfg-range').value = S.cfg.rfRange;
  document.getElementById('cfg-noise').value = S.cfg.noise;
  document.getElementById('cfg-drain').value = S.cfg.battDrain;
  document.getElementById('val-squads').textContent = S.cfg.squads;
  document.getElementById('val-workers').textContent = S.cfg.workers;
  document.getElementById('val-relays').textContent = S.cfg.relays;
  document.getElementById('val-range').textContent = S.cfg.rfRange;
  document.getElementById('val-noise').textContent = S.cfg.noise;
  document.getElementById('val-drain').textContent = S.cfg.battDrain;

  // Reset sim with new config
  resetSim();

  // Apply zones and route after reset
  S.zones = scenario.zones || [];
  S.route = scenario.route || [];
  if (S.route.length > 0) {
    document.getElementById('route-info').style.display = 'block';
    S.drones.filter(d => d.alive && d.role === ROLES.W).forEach(d => d.routeTarget = 0);
  }

  addLog('Scenario loaded: ' + scenario.name, 'ok');
}

export function listScenarios() {
  const scenarios = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('ammo_scenario_')) {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        scenarios.push({ key, name: data.name, savedAt: data.savedAt });
      } catch (e) { /* skip corrupt */ }
    }
  }
  return scenarios.sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
}

export function deleteScenario(name) {
  localStorage.removeItem('ammo_scenario_' + name);
  addLog('Scenario deleted: ' + name, 'ok');
  updateScenarioDropdown();
}

export function exportScenario() {
  const name = prompt('Scenario name for export:', 'AMMO Export');
  if (!name) return;
  const scenario = {
    name,
    description: '',
    version: '0.4',
    cfg: { ...S.cfg },
    zones: S.zones.map(z => ({ ...z })),
    route: S.route.map(wp => ({ ...wp })),
    savedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(scenario, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name.replace(/\s+/g, '_') + '.ammo.json';
  a.click();
  URL.revokeObjectURL(url);
}

export function importScenario(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const scenario = JSON.parse(reader.result);
      if (!scenario.cfg) { addLog('Invalid scenario file', 'alert'); return; }
      localStorage.setItem('ammo_scenario_' + scenario.name, JSON.stringify(scenario));
      addLog('Scenario imported: ' + scenario.name, 'ok');
      updateScenarioDropdown();
    } catch (e) { addLog('Failed to parse scenario file', 'alert'); }
  };
  reader.readAsText(file);
}

export function updateScenarioDropdown() {
  const sel = document.getElementById('scenario-select');
  if (!sel) return;
  const scenarios = listScenarios();
  sel.innerHTML = '<option value="">-- Scenarios --</option>' +
    scenarios.map(s => '<option value="' + s.name + '">' + s.name + '</option>').join('');
}
