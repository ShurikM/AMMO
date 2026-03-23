// ── Election logic ──────────────────────────────────────────────────
// Leader-loss detection, candidate scoring, and promotion.

import { S } from './engine.js';
import { ROLES, RCOL } from './drones.js';
import { recordElectionStart, recordElectionEnd } from './metrics.js';
import { addLog, addAILog } from '../ui/log.js';

// ---- Trigger election when a leader is lost -------------------------
export function triggerElection(dead) {
  const cands = S.drones.filter(d => d.alive && d.squadId === dead.squadId && d.id !== dead.id);
  if (!cands.length) { addLog('Squad ' + dead.squadId + ' orphaned -- no candidates', 'alert'); return; }
  const shadow = cands.find(c => c.shadowOf === dead.id);
  cands.forEach(c => {
    c.score = c.health * 0.5 + (c.battery > 40 ? 20 : -30) + (c.shadowOf === dead.id ? 40 : 0);
    c.electing = true; c.electPulse = 0;
  });
  cands.sort((a, b) => b.score - a.score);
  const win = cands[0];
  const cx2 = cands.reduce((s, c) => s + c.x, 0) / cands.length;
  const cy2 = cands.reduce((s, c) => s + c.y, 0) / cands.length;
  S.elections.push({ squadId: dead.squadId, winnerId: win.id, cx: cx2, cy: cy2, timer: 1.4, phase: 0, resolved: false });
  S.electionCount++;
  recordElectionStart(dead, cands.length);
  addLog('ELECTION -- Squad ' + dead.squadId + ' -- ' + cands.length + ' candidates', 'warn');
  if (shadow) addLog('Shadow #' + shadow.id + ' nominated (+40pts) -- state intact', 'warn');
}

// ---- Resolve a completed election ------------------------------------
export function resolveElection(e) {
  const win = S.drones.find(d => d.id === e.winnerId);
  if (!win || !win.alive) return;
  const isGL = !S.drones.some(d => d.alive && d.role === ROLES.GL);
  win.role = isGL ? ROLES.GL : (S.cfg.aiSL ? ROLES.ASL : ROLES.SL);
  win.aiEnabled = isGL ? S.cfg.aiGL : S.cfg.aiSL;
  win.color = RCOL[win.role];
  win.electing = false; win.electFlash = 1.5;
  const wasShadow = win.shadowOf != null;
  win.shadowOf = null;
  S.drones.filter(d => d.squadId === win.squadId).forEach(d => d.electing = false);
  recordElectionEnd(win.id, e.squadId, wasShadow);
  // New shadow
  if (S.cfg.shadowOn) {
    const ns = S.drones.filter(d => d.alive && d.squadId === win.squadId && d.id !== win.id && d.role === ROLES.W).sort((a, b) => b.health - a.health)[0];
    if (ns) { ns.role = ROLES.SH; ns.color = RCOL.SH; ns.shadowOf = win.id; ns.leaderId = win.id; addLog('#' + ns.id + ' now Shadow -> ' + win.role + ' #' + win.id, 'ok'); }
  }
  addLog('ELECTED -- #' + win.id + ' => ' + win.role, 'ok');
  if (win.aiEnabled) addAILog(win.role, 'POST-ELECT', 'Inherited mission state. Rebuilding squad plan. ' + S.drones.filter(d => d.alive && d.squadId === win.squadId).length + ' nodes active.');
}

// ---- Tick election timers --------------------------------------------
export function updateElections(dt) {
  S.elections = S.elections.filter(e => {
    e.timer -= dt; e.phase += dt;
    if (e.timer < 0 && !e.resolved) { e.resolved = true; resolveElection(e); }
    return e.phase < 3.0;
  });
}
