// ---- Metrics Engine -----------------------------------------------------------------------
// Tracks simulation metrics: timeline, elections, deaths, mesh partitions.
// Imported by engine.js, drones.js, election.js for hook points.

import { S } from './engine.js';
import { ROLES } from './drones.js';

// ---- METRICS object (importable by other modules) -----------------------------------------
export const METRICS = {
  // Time-series (push every 5 sim-seconds)
  timeline: [],
  // Each entry: { t, aliveCount, leaderCount, linkCount, avgBattery, meshPartitioned }

  // Election events
  elections: [],
  // Each: { t, squadId, deadRole, winnerRole, wasShadow, recoveryMs, candidateCount }

  // Drone deaths
  deaths: [],
  // Each: { t, id, role, hwType, cause, batteryAtDeath, missionTimeAlive }

  // Mesh partition events
  partitions: [],
  // Each: { tStart, tEnd, partitionCount, dronesIsolated }

  // Counters
  batteryDeaths: 0,
  attackerDeaths: 0,
  manualDeaths: 0,

  // Summary (computed on demand)
  summary: null,
};

// ---- Internal state for partition tracking ------------------------------------------------
let _activePartition = null;

// ---- Internal state for election timing ---------------------------------------------------
// Map from squadId -> { t, deadRole, candidateCount }
const _pendingElections = new Map();

// ---- resetMetrics() -- clear all METRICS arrays and counters ------------------------------
export function resetMetrics() {
  METRICS.timeline.length = 0;
  METRICS.elections.length = 0;
  METRICS.deaths.length = 0;
  METRICS.partitions.length = 0;
  METRICS.batteryDeaths = 0;
  METRICS.attackerDeaths = 0;
  METRICS.manualDeaths = 0;
  METRICS.summary = null;
  _activePartition = null;
  _pendingElections.clear();
}

// ---- detectPartitions() -- BFS from GL to find isolated nodes -----------------------------
export function detectPartitions() {
  const alive = S.drones.filter(d => d.alive);
  if (!alive.length) return { partitionCount: 0, isolated: 0 };

  const connected = new Set();
  const start = alive.find(d => d.role === ROLES.GL) || alive[0];
  const queue = [start.id];
  connected.add(start.id);

  while (queue.length) {
    const id = queue.shift();
    S.links.forEach(l => {
      const neighbor = l.a.id === id ? l.b.id : l.b.id === id ? l.a.id : null;
      if (neighbor && !connected.has(neighbor)) {
        connected.add(neighbor);
        queue.push(neighbor);
      }
    });
  }

  const isolatedCount = alive.filter(d => !connected.has(d.id)).length;
  return { partitionCount: isolatedCount > 0 ? 2 : 1, isolated: isolatedCount };
}

// ---- recordTimeline() -- push a timeline entry (every 5 sim-seconds) ----------------------
export function recordTimeline() {
  const alive = S.drones.filter(d => d.alive);
  const leaders = alive.filter(d => d.role === ROLES.GL || d.role === ROLES.SL || d.role === ROLES.ASL);
  const avgBatt = alive.length ? alive.reduce((s, d) => s + d.battery, 0) / alive.length : 0;
  const partitioned = detectPartitions();

  METRICS.timeline.push({
    t: S.missionTime,
    aliveCount: alive.length,
    leaderCount: leaders.length,
    linkCount: S.links.length,
    avgBattery: avgBatt,
    meshPartitioned: partitioned.isolated > 0
  });
}

// ---- recordDeath(drone, cause) -- record drone death event --------------------------------
export function recordDeath(drone, cause) {
  METRICS.deaths.push({
    t: S.missionTime,
    id: drone.id,
    role: drone.role,
    hwType: drone.hwType,
    cause,
    batteryAtDeath: drone.battery,
    missionTimeAlive: S.missionTime
  });

  if (cause === 'Battery depleted') METRICS.batteryDeaths++;
  else if (cause === 'Attacker strike') METRICS.attackerDeaths++;
  else METRICS.manualDeaths++;
}

// ---- recordElectionStart(dead, candidateCount) -- stash election start time ---------------
export function recordElectionStart(dead, candidateCount) {
  _pendingElections.set(dead.squadId, {
    t: S.missionTime,
    deadRole: dead.role,
    candidateCount
  });
}

// ---- recordElectionEnd(winnerId, squadId, wasShadow) -- record completed election ---------
export function recordElectionEnd(winnerId, squadId, wasShadow) {
  const pending = _pendingElections.get(squadId);
  if (!pending) return;

  const winner = S.drones.find(d => d.id === winnerId);
  const recoveryMs = (S.missionTime - pending.t) * 1000;

  METRICS.elections.push({
    t: pending.t,
    squadId,
    deadRole: pending.deadRole,
    winnerRole: winner ? winner.role : null,
    wasShadow,
    recoveryMs,
    candidateCount: pending.candidateCount
  });

  _pendingElections.delete(squadId);
}

// ---- updatePartitions() -- track open/closed partition events -----------------------------
export function updatePartitions() {
  const result = detectPartitions();

  if (result.isolated > 0) {
    // Mesh is partitioned
    if (!_activePartition) {
      _activePartition = {
        tStart: S.missionTime,
        tEnd: null,
        partitionCount: result.partitionCount,
        dronesIsolated: result.isolated
      };
    } else {
      // Update ongoing partition with latest counts
      _activePartition.partitionCount = result.partitionCount;
      _activePartition.dronesIsolated = result.isolated;
    }
  } else {
    // Mesh is connected -- close any active partition
    if (_activePartition) {
      _activePartition.tEnd = S.missionTime;
      METRICS.partitions.push({ ..._activePartition });
      _activePartition = null;
    }
  }
}

// ---- calculateMeshUptime() -- % of timeline entries with no partition ---------------------
export function calculateMeshUptime() {
  if (!METRICS.timeline.length) return 100;
  const connected = METRICS.timeline.filter(e => !e.meshPartitioned).length;
  return (connected / METRICS.timeline.length) * 100;
}

// ---- computeSummary() -- calculate summary stats on demand --------------------------------
export function computeSummary() {
  const total = S.drones.length;
  const alive = S.drones.filter(d => d.alive).length;
  const elections = METRICS.elections;
  const recoveries = elections.map(e => e.recoveryMs).filter(r => r != null);
  const shadowWins = elections.filter(e => e.wasShadow).length;

  METRICS.summary = {
    totalSimTime: S.missionTime,
    avgElectionRecoveryMs: recoveries.length
      ? recoveries.reduce((a, b) => a + b, 0) / recoveries.length
      : 0,
    p99ElectionRecoveryMs: recoveries.length
      ? recoveries.sort((a, b) => a - b)[Math.floor(recoveries.length * 0.99)]
      : 0,
    meshUptimePct: calculateMeshUptime(),
    fleetSurvivalPct: total ? (alive / total) * 100 : 0,
    avgBatteryAtEnd: alive
      ? S.drones.filter(d => d.alive).reduce((s, d) => s + d.battery, 0) / alive
      : 0,
    totalElections: elections.length,
    shadowWinRate: elections.length ? (shadowWins / elections.length) * 100 : 0,
  };

  return METRICS.summary;
}
