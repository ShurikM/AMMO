import { S } from './engine.js';
import { ROLES } from './drones.js';
import { addLog, addAILog } from '../ui/log.js';

// Phase definitions
export const PHASES = {
  STAGING: { id: 'STAGING', label: 'STAGING', color: '#4a6680', desc: 'Fleet assembled, awaiting orders' },
  INGRESS: { id: 'INGRESS', label: 'INGRESS', color: '#00d4ff', desc: 'Moving to area of operations' },
  LOITER: { id: 'LOITER', label: 'LOITER', color: '#00ffcc', desc: 'Orbiting waypoint, maintaining coverage' },
  EXECUTE: { id: 'EXECUTE', label: 'EXECUTE', color: '#bf7fff', desc: 'Mission execution — spread and survey' },
  EGRESS: { id: 'EGRESS', label: 'EGRESS', color: '#ff9e00', desc: 'Withdrawing from area of operations' },
  RTB: { id: 'RTB', label: 'RTB', color: '#ff9000', desc: 'Return to base — heading to origin' }
};

export const PHASE_ORDER = ['STAGING', 'INGRESS', 'LOITER', 'EXECUTE', 'EGRESS', 'RTB'];

// Mission state
let currentPhase = 'STAGING';
let phaseStartTime = 0;
let missionActive = false;
let phaseLog = []; // {t, from, to, reason}

export function getCurrentPhase() { return currentPhase; }
export function isMissionActive() { return missionActive; }
export function getPhaseLog() { return phaseLog; }
export function getPhaseElapsed() { return S.missionTime - phaseStartTime; }

// Start mission — requires at least 1 waypoint set as route
export function startMission() {
  if (S.route.length === 0) {
    addLog('Cannot start mission: set route waypoints first', 'warn');
    return false;
  }
  missionActive = true;
  transitionTo('INGRESS', 'Mission started');

  // Assign all workers to follow route
  S.drones.filter(d => d.alive && (d.role === ROLES.W || d.role === ROLES.SH)).forEach(d => {
    d.routeTarget = 0;
  });

  const gl = S.drones.find(d => d.alive && d.role === ROLES.GL && d.aiEnabled);
  if (gl) addAILog('GL', 'MISSION_START', 'Mission initiated. ' + S.route.length + ' waypoints. Ingress phase. All squads moving.');

  return true;
}

// Advance to next phase
export function advancePhase() {
  const idx = PHASE_ORDER.indexOf(currentPhase);
  if (idx < PHASE_ORDER.length - 1) {
    transitionTo(PHASE_ORDER[idx + 1], 'Manual advance');
  }
}

// Go to specific phase
export function setPhase(phaseId) {
  if (PHASES[phaseId]) {
    transitionTo(phaseId, 'Manual set');
  }
}

function transitionTo(phaseId, reason) {
  const from = currentPhase;
  phaseLog.push({ t: S.missionTime, from, to: phaseId, reason });
  currentPhase = phaseId;
  phaseStartTime = S.missionTime;
  addLog('PHASE: ' + PHASES[from].label + ' \u2192 ' + PHASES[phaseId].label + ' (' + reason + ')', 'ok');

  // Apply phase-specific behavior modifiers
  applyPhaseBehavior(phaseId);
}

function applyPhaseBehavior(phaseId) {
  const workers = S.drones.filter(d => d.alive && (d.role === ROLES.W || d.role === ROLES.SH));
  const leaders = S.drones.filter(d => d.alive && (d.role === ROLES.GL || d.role === ROLES.SL || d.role === ROLES.ASL));

  switch (phaseId) {
    case 'STAGING':
      // Hold position near origin
      S.drones.filter(d => d.alive).forEach(d => {
        d.patrolRadius = 15;
        d.routeTarget = null;
      });
      break;

    case 'INGRESS':
      // Follow route, tight formation
      workers.forEach(d => {
        d.patrolRadius = 25;
        d.routeTarget = 0;
      });
      leaders.forEach(d => { d.patrolRadius = 20; });
      break;

    case 'LOITER':
      // Orbit around current waypoint
      workers.forEach(d => { d.patrolRadius = 60; });
      leaders.forEach(d => { d.patrolRadius = 30; });
      break;

    case 'EXECUTE':
      // Spread out for maximum coverage
      workers.forEach(d => { d.patrolRadius = 90; });
      leaders.forEach(d => { d.patrolRadius = 45; });
      if (S.drones.find(d => d.alive && d.role === ROLES.GL && d.aiEnabled)) {
        addAILog('GL', 'EXECUTE', 'Execution phase. Dispersing workers for area coverage. Sensor sweep active.');
      }
      break;

    case 'EGRESS':
      // Reverse route, tighten up
      workers.forEach(d => {
        d.patrolRadius = 25;
        if (S.route.length > 0) d.routeTarget = S.route.length - 1;
      });
      leaders.forEach(d => { d.patrolRadius = 20; });
      break;

    case 'RTB':
      // Return to origin
      S.drones.filter(d => d.alive).forEach(d => {
        d.routeTarget = null;
        d.px = d.originX;
        d.py = d.originY;
        d.patrolRadius = 12;
      });
      if (S.drones.find(d => d.alive && d.role === ROLES.GL && d.aiEnabled)) {
        addAILog('GL', 'RTB', 'RTB initiated. All units returning to launch point. Mission time: ' + Math.floor(S.missionTime/60) + 'min.');
      }
      break;
  }
}

// Auto-transition logic (called each frame from engine.js update)
export function updateMission(dt) {
  if (!missionActive) return;

  const elapsed = S.missionTime - phaseStartTime;

  switch (currentPhase) {
    case 'INGRESS':
      // Auto-transition to LOITER when most workers reach first waypoint
      if (S.route.length > 0) {
        const wp = S.route[0];
        const nearWP = S.drones.filter(d => d.alive && d.role === ROLES.W).filter(d => {
          const dx = d.x - wp.x, dy = d.y - wp.y;
          return Math.sqrt(dx*dx + dy*dy) < 80;
        });
        const totalWorkers = S.drones.filter(d => d.alive && d.role === ROLES.W).length;
        if (totalWorkers > 0 && nearWP.length >= totalWorkers * 0.6) {
          transitionTo('LOITER', 'Workers reached waypoint');
        }
      }
      // Timeout fallback
      if (elapsed > 120) transitionTo('LOITER', 'Ingress timeout');
      break;

    case 'LOITER':
      // Auto-transition to EXECUTE after 30s of loiter
      if (elapsed > 30) transitionTo('EXECUTE', 'Loiter complete');
      break;

    case 'EXECUTE':
      // Auto-transition to EGRESS after 120s or if fleet drops below 50%
      if (elapsed > 120) transitionTo('EGRESS', 'Execution time limit');
      const alive = S.drones.filter(d => d.alive).length;
      if (alive < S.drones.length * 0.5) transitionTo('EGRESS', 'High casualties \u2014 withdrawing');
      break;

    case 'EGRESS':
      // Auto-transition to RTB after 60s
      if (elapsed > 60) transitionTo('RTB', 'Egress complete');
      break;

    case 'RTB':
      // Check if most drones returned to origin
      const home = S.drones.filter(d => d.alive).filter(d => {
        const dx = d.x - d.originX, dy = d.y - d.originY;
        return Math.sqrt(dx*dx + dy*dy) < 40;
      });
      const totalAlive = S.drones.filter(d => d.alive).length;
      if (totalAlive > 0 && home.length >= totalAlive * 0.8) {
        missionActive = false;
        addLog('MISSION COMPLETE \u2014 ' + home.length + '/' + S.drones.length + ' drones recovered', 'ok');
        if (S.drones.find(d => d.alive && d.role === ROLES.GL && d.aiEnabled)) {
          addAILog('GL', 'MISSION_END', 'Mission complete. Fleet recovered. Generating after-action report.');
        }
      }
      break;
  }
}

// Reset
export function resetMission() {
  currentPhase = 'STAGING';
  phaseStartTime = 0;
  missionActive = false;
  phaseLog = [];
}
