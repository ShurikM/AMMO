import { S } from '../sim/engine.js';

let evCnt = 0, aiCnt = 0;

export function ts() {
  const m = String(Math.floor(S.missionTime / 60)).padStart(2, '0');
  const s = String(Math.floor(S.missionTime % 60)).padStart(2, '0');
  return m + ':' + s;
}

export function addLog(msg, type) {
  const el = document.getElementById('event-log');
  const e = document.createElement('div');
  e.className = 'lentry ' + (type || '');
  e.innerHTML = '<span class="ts">' + ts() + '</span>' + msg;
  el.insertBefore(e, el.firstChild);
  if (++evCnt > 100) el.removeChild(el.lastChild);
}

export function addAILog(role, trig, reason) {
  const el = document.getElementById('decision-log');
  const conf = (0.62 + Math.random() * 0.32).toFixed(2);
  const e = document.createElement('div');
  e.className = 'lentry ai';
  e.innerHTML = '<span class="ts">' + ts() + '</span><strong style="color:var(--asl)">[' + role + ']</strong> <span style="color:var(--warn)">' + trig + '</span><br><span style="color:rgba(180,200,220,0.8);font-size:9px">' + reason + '</span><br><span style="color:var(--muted);font-size:8px">conf=' + conf + ' escalate=false</span>';
  el.insertBefore(e, el.firstChild);
  if (++aiCnt > 50) el.removeChild(el.lastChild);
}

export function resetLogCounters() {
  evCnt = 0;
  aiCnt = 0;
}
