import { S } from './engine.js';
import { ROLES } from './drones.js';
import { METRICS } from './metrics.js';

// Assertion result states
export const RESULT = { PASS: 'PASS', FAIL: 'FAIL', WARN: 'WARN', PENDING: 'PENDING' };

// Built-in assertions
const builtinAssertions = [
  {
    id: 'election-speed',
    name: 'Election completes within 2s',
    description: 'When a leader dies, a new leader must be elected within 2 seconds',
    severity: 'critical',
    checkInterval: 30, // check every 30 ticks
    check: () => {
      const recent = METRICS.elections.filter(e => e.recoveryMs != null);
      if (!recent.length) return { result: RESULT.PENDING, detail: 'No elections yet' };
      const max = Math.max(...recent.map(e => e.recoveryMs));
      if (max > 2000) return { result: RESULT.FAIL, detail: 'Max recovery: ' + (max/1000).toFixed(2) + 's' };
      return { result: RESULT.PASS, detail: 'Max recovery: ' + (max/1000).toFixed(2) + 's' };
    }
  },
  {
    id: 'gl-exists',
    name: 'GL always exists',
    description: 'There must always be an alive GL (or election in progress)',
    severity: 'critical',
    checkInterval: 60,
    check: () => {
      const hasGL = S.drones.some(d => d.alive && d.role === ROLES.GL);
      const electing = S.elections.some(e => !e.resolved);
      if (hasGL) return { result: RESULT.PASS, detail: 'GL alive' };
      if (electing) return { result: RESULT.WARN, detail: 'GL dead, election in progress' };
      if (S.drones.filter(d => d.alive).length === 0) return { result: RESULT.PENDING, detail: 'No drones alive' };
      return { result: RESULT.FAIL, detail: 'No GL and no election in progress' };
    }
  },
  {
    id: 'low-batt-no-rtb',
    name: 'Low battery triggers alert',
    description: 'No drone should drop below 5% battery without a low-battery log entry',
    severity: 'warning',
    checkInterval: 120,
    check: () => {
      const critical = S.drones.filter(d => d.alive && d.battery < 5 && d.battery > 0);
      if (!critical.length) return { result: RESULT.PASS, detail: 'No critical battery drones' };
      return { result: RESULT.WARN, detail: critical.length + ' drone(s) below 5% battery' };
    }
  },
  {
    id: 'mesh-connected',
    name: 'Mesh stays connected',
    description: 'The mesh network should not partition for more than 10 seconds',
    severity: 'critical',
    checkInterval: 60,
    check: () => {
      const longPartitions = METRICS.partitions.filter(p => {
        const duration = (p.tEnd || S.missionTime) - p.tStart;
        return duration > 10;
      });
      if (!longPartitions.length) return { result: RESULT.PASS, detail: 'No long partitions' };
      return { result: RESULT.FAIL, detail: longPartitions.length + ' partition(s) > 10s' };
    }
  },
  {
    id: 'shadow-win-rate',
    name: 'Shadow wins > 50% of elections',
    description: 'Shadow nodes should win majority of elections (validates shadow sync)',
    severity: 'warning',
    checkInterval: 300,
    check: () => {
      const elections = METRICS.elections;
      if (elections.length < 2) return { result: RESULT.PENDING, detail: 'Need 2+ elections' };
      const shadowWins = elections.filter(e => e.wasShadow).length;
      const rate = (shadowWins / elections.length * 100).toFixed(0);
      if (shadowWins / elections.length >= 0.5) return { result: RESULT.PASS, detail: 'Shadow win rate: ' + rate + '%' };
      return { result: RESULT.WARN, detail: 'Shadow win rate: ' + rate + '% (expected >50%)' };
    }
  },
  {
    id: 'fleet-survival',
    name: 'Fleet survival > 60%',
    description: 'At least 60% of the fleet should survive throughout the mission',
    severity: 'warning',
    checkInterval: 300,
    check: () => {
      const alive = S.drones.filter(d => d.alive).length;
      const total = S.drones.length;
      if (!total) return { result: RESULT.PENDING, detail: 'No drones' };
      const pct = (alive / total * 100).toFixed(0);
      if (alive / total >= 0.6) return { result: RESULT.PASS, detail: pct + '% alive' };
      return { result: RESULT.FAIL, detail: 'Only ' + pct + '% alive' };
    }
  }
];

// Active assertions and their latest results
let assertions = [];
let results = new Map();

export function initAssertions() {
  assertions = builtinAssertions.map(a => ({ ...a }));
  results.clear();
  assertions.forEach(a => results.set(a.id, { result: RESULT.PENDING, detail: 'Not checked yet', lastCheck: 0 }));
}

// Check assertions based on their intervals
export function checkAssertions() {
  assertions.forEach(a => {
    if (S.tick % a.checkInterval !== 0) return;
    try {
      const r = a.check();
      results.set(a.id, { ...r, lastCheck: S.missionTime });
    } catch (e) {
      results.set(a.id, { result: RESULT.FAIL, detail: 'Error: ' + e.message, lastCheck: S.missionTime });
    }
  });
}

// Get all assertion results
export function getAssertionResults() {
  return assertions.map(a => ({
    ...a,
    ...(results.get(a.id) || { result: RESULT.PENDING, detail: '' })
  }));
}

// Get summary counts
export function getAssertionSummary() {
  const all = Array.from(results.values());
  return {
    pass: all.filter(r => r.result === RESULT.PASS).length,
    fail: all.filter(r => r.result === RESULT.FAIL).length,
    warn: all.filter(r => r.result === RESULT.WARN).length,
    pending: all.filter(r => r.result === RESULT.PENDING).length,
    total: all.length
  };
}

// Reset
export function resetAssertions() {
  initAssertions();
}

// Add a custom assertion
export function addAssertion(def) {
  assertions.push(def);
  results.set(def.id, { result: RESULT.PENDING, detail: 'Not checked yet', lastCheck: 0 });
}
