import { S } from './engine.js';
import { killDrone, ROLES } from './drones.js';
import { addLog } from '../ui/log.js';

// Fault schedule — array of {t: seconds, action: string, params: {}}
let faultSchedule = [];
let executedFaults = new Set();

// Supported fault actions
const FAULT_ACTIONS = {
  kill_gl: () => {
    const gl = S.drones.find(d => d.alive && d.role === ROLES.GL);
    if (gl) killDrone(gl.id, 'Fault injection: GL destroyed');
  },
  kill_sl: () => {
    const sls = S.drones.filter(d => d.alive && (d.role === ROLES.SL || d.role === ROLES.ASL));
    if (sls.length) killDrone(sls[Math.floor(Math.random() * sls.length)].id, 'Fault injection: SL destroyed');
  },
  kill_drone: (params) => {
    if (params.id) killDrone(params.id, 'Fault injection: targeted kill');
  },
  kill_random: () => {
    const alive = S.drones.filter(d => d.alive);
    if (alive.length) killDrone(alive[Math.floor(Math.random() * alive.length)].id, 'Fault injection: random kill');
  },
  jam_zone: (params) => {
    S.zones.push({ type: 'jam', x: params.x || S.worldWidth/2, y: params.y || S.worldHeight/2, radius: params.radius || 150 });
    addLog('FAULT: RF jam zone injected', 'alert');
  },
  gps_deny: (params) => {
    S.zones.push({ type: 'gps', x: params.x || S.worldWidth/2, y: params.y || S.worldHeight/2, radius: params.radius || 200 });
    addLog('FAULT: GPS denial zone injected', 'warn');
  },
  attacker: (params) => {
    S.zones.push({ type: 'attacker', x: params.x || S.worldWidth * 0.7, y: params.y || S.worldHeight/2, radius: params.radius || 85, ang: 0 });
    addLog('FAULT: Attacker drone injected', 'alert');
  },
  drain_battery: (params) => {
    const targets = params.squadId != null
      ? S.drones.filter(d => d.alive && d.squadId === params.squadId)
      : S.drones.filter(d => d.alive);
    targets.forEach(d => d.battery = Math.max(0, d.battery - (params.amount || 50)));
    addLog('FAULT: Battery drain injected (' + targets.length + ' drones)', 'warn');
  },
  clear_zones: () => {
    S.zones = [];
    addLog('FAULT: All zones cleared', 'ok');
  }
};

// Load a fault schedule
export function loadFaultSchedule(schedule) {
  faultSchedule = schedule.map(f => ({ ...f }));
  executedFaults.clear();
  addLog('Fault schedule loaded: ' + faultSchedule.length + ' events', 'ok');
}

// Check and execute faults due at current time
export function checkFaults() {
  faultSchedule.forEach((fault, i) => {
    if (executedFaults.has(i)) return;
    if (S.missionTime >= fault.t) {
      executedFaults.add(i);
      const action = FAULT_ACTIONS[fault.action];
      if (action) {
        action(fault.params || {});
        addLog('FAULT EXECUTED @ T+' + Math.floor(fault.t) + 's: ' + fault.action, 'alert');
      }
    }
  });
}

// Get the fault schedule
export function getFaultSchedule() { return faultSchedule; }

// Clear fault schedule
export function clearFaultSchedule() {
  faultSchedule = [];
  executedFaults.clear();
}

// Reset
export function resetFaults() {
  executedFaults.clear();
}

// Get available fault actions (for UI)
export function getFaultActions() {
  return Object.keys(FAULT_ACTIONS);
}

// Export example schedule
export function getExampleSchedule() {
  return [
    { t: 60, action: 'kill_gl', params: {} },
    { t: 120, action: 'jam_zone', params: { x: 400, y: 300, radius: 150 } },
    { t: 180, action: 'kill_sl', params: {} },
    { t: 240, action: 'drain_battery', params: { amount: 40 } },
    { t: 300, action: 'attacker', params: {} },
    { t: 360, action: 'clear_zones', params: {} }
  ];
}
