import { S } from './engine.js';
import { ROLES } from './drones.js';
import { addLog } from '../ui/log.js';

// Comms levels (from best to worst)
export const COMMS_LEVEL = {
  FULL_MESH: { id: 'FULL_MESH', label: 'FULL MESH', color: '#00e87a', order: 0 },
  DEGRADED: { id: 'DEGRADED', label: 'DEGRADED', color: '#ff9e00', order: 1 },
  RELAY_ONLY: { id: 'RELAY_ONLY', label: 'RELAY ONLY', color: '#ff9000', order: 2 },
  ISOLATED: { id: 'ISOLATED', label: 'ISOLATED', color: '#ff3b3b', order: 3 },
  LOST_CONTACT: { id: 'LOST_CONTACT', label: 'LOST CONTACT', color: '#660000', order: 4 }
};

// Per-drone comms state
const droneComms = new Map(); // id -> { level, directLinks, hopCount, lastContactTime, lostDuration }

// Fleet-wide stats
let fleetCommsHealth = 100; // 0-100

// Thresholds
const LOST_CONTACT_THRESHOLD = 10; // seconds with no links before LOST_CONTACT

export function getCommsLevel(droneId) {
  return droneComms.get(droneId) || { level: COMMS_LEVEL.FULL_MESH, directLinks: 0, hopCount: 0, lastContactTime: 0, lostDuration: 0 };
}

export function getFleetCommsHealth() { return fleetCommsHealth; }

// Compute comms status for all drones (called after updateLinks)
export function updateCommsStatus() {
  const alive = S.drones.filter(d => d.alive);
  if (!alive.length) return;

  // Build adjacency map
  const adj = new Map();
  alive.forEach(d => adj.set(d.id, []));
  S.links.forEach(l => {
    if (adj.has(l.a.id)) adj.get(l.a.id).push(l.b.id);
    if (adj.has(l.b.id)) adj.get(l.b.id).push(l.a.id);
  });

  // Find GL (or best leader) as reference node
  const gl = alive.find(d => d.role === ROLES.GL) || alive.find(d => d.role === ROLES.SL || d.role === ROLES.ASL) || alive[0];

  // BFS from GL to compute hop counts
  const hopCount = new Map();
  const visited = new Set();
  const queue = [[gl.id, 0]];
  visited.add(gl.id);
  hopCount.set(gl.id, 0);

  while (queue.length) {
    const [id, hops] = queue.shift();
    const neighbors = adj.get(id) || [];
    for (const nid of neighbors) {
      if (!visited.has(nid)) {
        visited.add(nid);
        hopCount.set(nid, hops + 1);
        queue.push([nid, hops + 1]);
      }
    }
  }

  // Classify each drone
  alive.forEach(d => {
    const prev = droneComms.get(d.id) || { level: COMMS_LEVEL.FULL_MESH, directLinks: 0, hopCount: 0, lastContactTime: S.missionTime, lostDuration: 0 };
    const directLinks = (adj.get(d.id) || []).length;
    const hops = hopCount.get(d.id);

    let level;
    let lostDuration = 0;
    let lastContactTime = prev.lastContactTime;

    if (hops === undefined) {
      // Not connected to GL at all
      lostDuration = S.missionTime - prev.lastContactTime;
      if (lostDuration > LOST_CONTACT_THRESHOLD) {
        level = COMMS_LEVEL.LOST_CONTACT;
      } else {
        level = COMMS_LEVEL.ISOLATED;
      }
    } else {
      lastContactTime = S.missionTime;
      if (directLinks >= 3 && hops <= 2) {
        level = COMMS_LEVEL.FULL_MESH;
      } else if (directLinks >= 1 && hops <= 3) {
        level = COMMS_LEVEL.DEGRADED;
      } else {
        level = COMMS_LEVEL.RELAY_ONLY;
      }
    }

    // Log significant transitions
    if (prev.level.id !== level.id) {
      if (level.order > prev.level.order && level.order >= 3) {
        addLog(d.role + ' #' + d.id + ' comms: ' + level.label, level.order >= 4 ? 'alert' : 'warn');
      }
    }

    droneComms.set(d.id, { level, directLinks, hopCount: hops || -1, lastContactTime, lostDuration });
    d._commsLevel = level.id;
  });

  // Fleet health: weighted average
  let totalScore = 0;
  alive.forEach(d => {
    const c = droneComms.get(d.id);
    if (!c) return;
    switch (c.level.id) {
      case 'FULL_MESH': totalScore += 100; break;
      case 'DEGRADED': totalScore += 70; break;
      case 'RELAY_ONLY': totalScore += 40; break;
      case 'ISOLATED': totalScore += 10; break;
      case 'LOST_CONTACT': totalScore += 0; break;
    }
  });
  fleetCommsHealth = alive.length ? Math.round(totalScore / alive.length) : 0;
}

// Reset
export function resetComms() {
  droneComms.clear();
  fleetCommsHealth = 100;
}
