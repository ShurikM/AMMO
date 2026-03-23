import { S } from './engine.js';
import { ROLES } from './drones.js';

// Protocol states
export const STATES = {
  IDLE: 'IDLE',
  PATROL: 'PATROL',
  TASKED: 'TASKED',
  REPORTING: 'REPORTING',
  ELECTING: 'ELECTING',
  SHADOWING: 'SHADOWING',
  RTB: 'RTB',
  LOST_LINK: 'LOST_LINK',
  JAMMED: 'JAMMED',
  LOW_BATT: 'LOW_BATT',
  DEAD: 'DEAD'
};

export const STATE_COLORS = {
  IDLE: '#4a6680',
  PATROL: '#39ff88',
  TASKED: '#00ffcc',
  REPORTING: '#00d4ff',
  ELECTING: '#ffdc00',
  SHADOWING: '#ff9e00',
  RTB: '#ff9000',
  LOST_LINK: '#ff3b3b',
  JAMMED: '#ff3b3b',
  LOW_BATT: '#ff6600',
  DEAD: '#330000'
};

// Transition log (ring buffer, last 200 transitions)
const MAX_LOG = 200;
export const stateLog = [];

// Per-drone state cache
const droneStates = new Map();

// Derive protocol state from drone properties
export function deriveState(d) {
  if (!d.alive) return STATES.DEAD;
  if (d.electing) return STATES.ELECTING;
  if (d.jammed) return STATES.JAMMED;
  if (d.battery < 15) return STATES.LOW_BATT;

  // Check if drone has any links
  const hasLinks = S.links.some(l => l.a.id === d.id || l.b.id === d.id);
  if (!hasLinks && d.role !== ROLES.GL) return STATES.LOST_LINK;

  if (d.role === ROLES.SH) return STATES.SHADOWING;

  // Check if working on a route
  if (d.routeTarget !== null && S.route.length > 0) return STATES.TASKED;

  // Workers and shadows with active tasks
  if ((d.role === ROLES.W || d.role === ROLES.SH) && d.taskProgress > 0 && d.taskProgress < 95) return STATES.TASKED;

  // Leaders reporting
  if ((d.role === ROLES.SL || d.role === ROLES.ASL) && d.aiEnabled) return STATES.REPORTING;

  return STATES.PATROL;
}

// Update all drone states, log transitions
export function updateProtocolStates() {
  S.drones.forEach(d => {
    const newState = deriveState(d);
    const oldState = droneStates.get(d.id);

    if (oldState !== newState) {
      droneStates.set(d.id, newState);
      if (oldState !== undefined) {
        stateLog.push({
          t: S.missionTime,
          droneId: d.id,
          role: d.role,
          from: oldState,
          to: newState
        });
        if (stateLog.length > MAX_LOG) stateLog.shift();
      }
    }

    // Store on drone object for easy access
    d._protoState = newState;
  });
}

// Get state for a specific drone
export function getDroneState(droneId) {
  return droneStates.get(droneId) || STATES.IDLE;
}

// Get recent transitions for a specific drone
export function getDroneTransitions(droneId, maxCount = 10) {
  return stateLog.filter(e => e.droneId === droneId).slice(-maxCount);
}

// Reset on sim reset
export function resetProtocolStates() {
  droneStates.clear();
  stateLog.length = 0;
}

// Get fleet-wide state distribution
export function getStateDistribution() {
  const dist = {};
  Object.values(STATES).forEach(s => dist[s] = 0);
  S.drones.forEach(d => {
    const state = d._protoState || STATES.IDLE;
    dist[state] = (dist[state] || 0) + 1;
  });
  return dist;
}
