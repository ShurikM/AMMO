import { ROLES, DRONE_TYPES, RCOL, RRANGE } from './drones.js';
import { dist2, seedRNG, resetRNG, random } from './utils.js';

// ---- Headless drone factory ---
function mkDroneHeadless(state, x, y, role, leaderId, squadId, cfg) {
  const hwKey = role===ROLES.GL?cfg.hwGL : role===ROLES.SL||role===ROLES.ASL?cfg.hwSL :
    role===ROLES.RL?cfg.hwRelay : cfg.hwWorker;
  const hw = DRONE_TYPES[hwKey] || DRONE_TYPES.STM32_BASIC;
  const battCap = 85 * hw.battCapMult + random()*8;
  return {
    id: state.nextId++, role, hwType: hwKey, hw,
    x, y, px:x, py:y,
    health:100, battery:Math.min(100, battCap),
    aiEnabled: hw.aiLevel >= 3,
    alive:true, squadId, leaderId, shadowOf:null,
    color: RCOL[role]||hw.color||'#888',
    taskProgress: random()*60,
    electing:false, electPulse:0, electFlash:0,
    patrolTimer: random()*200,
    patrolRadius: role===ROLES.GL?18:role===ROLES.SL||role===ROLES.ASL?32:role===ROLES.W?48:12,
    originX:x, originY:y, routeTarget:null,
    jammed:false, gpsLost:false
  };
}

// ---- Headless init ---
function headlessInit(cfg) {
  const state = {
    drones:[], zones:[], links:[], elections:[], packets:[],
    route:[], tick:0, missionTime:0, nextId:1,
    electionCount:0, lostCount:0,
    worldWidth:800, worldHeight:600,
    cfg: { ...cfg }
  };
  const cx=400, cy=300;
  const c = state.cfg;

  // GL
  const gl = mkDroneHeadless(state, cx, cy, ROLES.GL, null, 0, c);
  gl.aiEnabled = c.aiGL;
  state.drones.push(gl);

  const angles = [[-Math.PI/3, Math.PI/3], [0], [-Math.PI*2/3,0,Math.PI*2/3],
    [-Math.PI*3/4,-Math.PI/4,Math.PI/4,Math.PI*3/4]][c.squads-1];

  angles.forEach((ang, si) => {
    const sr=170, sx=cx+Math.cos(ang)*sr, sy=cy+Math.sin(ang)*(sr*0.8);
    const slRole = c.aiSL ? ROLES.ASL : ROLES.SL;
    const sl = mkDroneHeadless(state, sx, sy, slRole, gl.id, si+1, c);
    sl.aiEnabled = c.aiSL;
    state.drones.push(sl);

    if (c.shadowOn) {
      const sa=ang+0.35;
      const sh = mkDroneHeadless(state, sx+Math.cos(sa)*48, sy+Math.sin(sa)*48, ROLES.SH, sl.id, si+1, c);
      sh.shadowOf=sl.id; sh.leaderId=sl.id;
      state.drones.push(sh);
    }

    for (let wi=0; wi<c.workers; wi++) {
      const wa=ang+(wi-(c.workers-1)/2)*0.44;
      const wr=80+(wi%2)*18;
      const w = mkDroneHeadless(state, sx+Math.cos(wa)*wr, sy+Math.sin(wa)*(wr*0.88), ROLES.W, sl.id, si+1, c);
      w.leaderId=sl.id;
      state.drones.push(w);
    }
  });

  for (let ri=0; ri<c.relays; ri++) {
    const ra=(ri/c.relays)*Math.PI*2;
    state.drones.push(mkDroneHeadless(state, cx+Math.cos(ra)*230, cy+Math.sin(ra)*170, ROLES.RL, null, 0, c));
  }

  return state;
}

// ---- Headless update functions (no DOM, no canvas) ---
function headlessUpdateDrones(state, dt) {
  const drainPerSec = state.cfg.battDrain / 60.0;
  state.drones.forEach(d => {
    if (!d.alive) return;
    // Patrol
    d.patrolTimer -= dt*60;
    if (d.patrolTimer<=0) {
      d.patrolTimer=70+random()*150;
      const ang=random()*Math.PI*2, r=random()*d.patrolRadius;
      d.px=Math.max(30,Math.min(state.worldWidth-30, d.originX+Math.cos(ang)*r));
      d.py=Math.max(30,Math.min(state.worldHeight-30, d.originY+Math.sin(ang)*r));
    }
    // Move
    const dx=d.px-d.x, dy=d.py-d.y;
    const spd=(d.role===ROLES.GL?14:d.role===ROLES.W?24:19)*dt;
    const dstv=Math.sqrt(dx*dx+dy*dy);
    if (dstv>1){d.x+=(dx/dstv)*Math.min(spd,dstv); d.y+=(dy/dstv)*Math.min(spd,dstv);}
    d.x+=(random()-0.5)*0.6*dt*60;
    d.y+=(random()-0.5)*0.6*dt*60;
    // Battery
    const aiMult = d.aiEnabled ? 1.4 : 1.0;
    const hwMult = d.hw.drainMult || 1.0;
    d.battery = Math.max(0, d.battery - drainPerSec * aiMult * hwMult * dt);
    if (d.battery <= 0) { headlessKill(state, d.id, 'Battery depleted'); return; }
    if (d.battery < 15) d.health = Math.max(0, d.health - 0.5*dt);
    // Zone effects
    d.jammed=false; d.gpsLost=false;
    state.zones.forEach(z => {
      const dd=dist2(d.x,d.y,z.x,z.y);
      if (z.type==='jam' && dd<z.radius) { d.jammed=true; d.battery=Math.max(0, d.battery-0.02*dt); }
      if (z.type==='gps' && dd<z.radius) d.gpsLost=true;
      if (z.type==='attacker' && dd<z.radius*0.28 && random()<0.0012) headlessKill(state, d.id, 'Attacker strike');
    });
  });
}

function headlessUpdateLinks(state) {
  state.links=[];
  const alive=state.drones.filter(d=>d.alive);
  const noise=state.cfg.noise/100;
  for (let i=0;i<alive.length;i++) for (let j=i+1;j<alive.length;j++) {
    const a=alive[i], b=alive[j];
    const maxR=state.cfg.rfRange*Math.min((a.hw.rfRangeMult||1)*RRANGE[a.role],(b.hw.rfRangeMult||1)*RRANGE[b.role]);
    const d=dist2(a.x,a.y,b.x,b.y);
    if (d>maxR) continue;
    let q=1-(d/maxR)-noise*0.5;
    state.zones.forEach(z=>{
      if (z.type!=='jam') return;
      const md=Math.min(dist2(a.x,a.y,z.x,z.y),dist2(b.x,b.y,z.x,z.y));
      if (md<z.radius) q-=(1-md/z.radius)*0.85;
    });
    q=Math.max(0,Math.min(1,q+(random()-0.5)*0.04));
    if (q<0.04) continue;
    state.links.push({a,b,q});
  }
}

function headlessKill(state, id, reason) {
  const d = state.drones.find(d=>d.id===id);
  if (!d||!d.alive) return;
  d.alive=false; d.health=0; state.lostCount++;
  if (d.role===ROLES.GL||d.role===ROLES.SL||d.role===ROLES.ASL) headlessElection(state, d);
}

function headlessElection(state, dead) {
  const cands = state.drones.filter(d=>d.alive&&d.squadId===dead.squadId&&d.id!==dead.id);
  if (!cands.length) return;
  cands.forEach(c => {
    c.score = c.health*0.5 + (c.battery>40?20:-30) + (c.shadowOf===dead.id?40:0);
  });
  cands.sort((a,b)=>b.score-a.score);
  const win = cands[0];
  const isGL = !state.drones.some(d=>d.alive&&d.role===ROLES.GL);
  win.role = isGL ? ROLES.GL : (state.cfg.aiSL?ROLES.ASL:ROLES.SL);
  win.aiEnabled = isGL ? state.cfg.aiGL : state.cfg.aiSL;
  win.shadowOf = null;
  state.electionCount++;
  // Assign new shadow
  if (state.cfg.shadowOn) {
    const ns = state.drones.filter(d=>d.alive&&d.squadId===win.squadId&&d.id!==win.id&&d.role===ROLES.W).sort((a,b)=>b.health-a.health)[0];
    if (ns) { ns.role=ROLES.SH; ns.shadowOf=win.id; ns.leaderId=win.id; }
  }
}

function headlessUpdate(state, dt) {
  state.missionTime+=dt; state.tick++;
  headlessUpdateDrones(state, dt);
  headlessUpdateLinks(state);
  // Zones movement
  state.zones.forEach(z=>{
    if (z.type!=='attacker') return;
    z.ang=(z.ang||0)+dt*0.25;
    z.x=Math.max(60,Math.min(state.worldWidth-60, z.x+Math.cos(z.ang)*18*dt));
    z.y=Math.max(60,Math.min(state.worldHeight-60, z.y+Math.sin(z.ang)*18*dt));
  });
}

// ---- Run a single headless simulation ---
function runSingleSim(cfg, durationSecs, seed) {
  seedRNG(seed);
  const state = headlessInit(cfg);
  const dt = 0.1; // 100ms steps

  // Track metrics locally
  let totalPartitionedFrames = 0;
  let totalFrames = 0;

  for (let t = 0; t < durationSecs; t += dt) {
    headlessUpdate(state, dt);
    totalFrames++;
    // Simple partition check
    const alive = state.drones.filter(d=>d.alive);
    if (alive.length > 0) {
      const connected = new Set();
      const start = alive.find(d=>d.role===ROLES.GL) || alive[0];
      const queue = [start.id];
      connected.add(start.id);
      while (queue.length) {
        const id = queue.shift();
        state.links.forEach(l => {
          const n = l.a.id===id ? l.b.id : l.b.id===id ? l.a.id : null;
          if (n && !connected.has(n)) { connected.add(n); queue.push(n); }
        });
      }
      if (alive.filter(d=>!connected.has(d.id)).length > 0) totalPartitionedFrames++;
    }
  }

  resetRNG();

  const alive = state.drones.filter(d=>d.alive);
  return {
    cfg: { ...cfg },
    seed,
    summary: {
      totalSimTime: state.missionTime,
      fleetSurvivalPct: state.drones.length ? (alive.length / state.drones.length) * 100 : 0,
      avgBatteryAtEnd: alive.length ? alive.reduce((s,d)=>s+d.battery,0)/alive.length : 0,
      totalElections: state.electionCount,
      totalLost: state.lostCount,
      meshUptimePct: totalFrames ? ((totalFrames - totalPartitionedFrames) / totalFrames) * 100 : 100,
      totalDrones: state.drones.length,
      aliveAtEnd: alive.length
    }
  };
}

// ---- Run batch (chunked for UI responsiveness) ---
export function runBatch(baseCfg, scenarios, durationMin, sweepParam, sweepRange, onProgress, onComplete) {
  const durationSecs = durationMin * 60;
  const results = [];
  let idx = 0;

  function runChunk() {
    const chunkSize = 3; // runs per chunk
    const end = Math.min(idx + chunkSize, scenarios.length);

    for (let i = idx; i < end; i++) {
      const cfg = { ...baseCfg, ...scenarios[i].cfgOverride };
      const result = runSingleSim(cfg, durationSecs, scenarios[i].seed);
      result.sweepValue = scenarios[i].sweepValue;
      results.push(result);
    }

    idx = end;
    if (onProgress) onProgress(idx, scenarios.length);

    if (idx < scenarios.length) {
      setTimeout(runChunk, 0); // yield to UI
    } else {
      if (onComplete) onComplete(results);
    }
  }

  runChunk();
}

// ---- Build scenario list from sweep parameters ---
export function buildScenarios(count, sweepParam, rangeStart, rangeEnd, steps) {
  const scenarios = [];

  if (!sweepParam || sweepParam === 'none') {
    // No sweep — just run N scenarios with different seeds
    for (let i = 0; i < count; i++) {
      scenarios.push({ seed: i + 1, cfgOverride: {}, sweepValue: null });
    }
  } else {
    // Parameter sweep
    const stepSize = (rangeEnd - rangeStart) / Math.max(1, steps - 1);
    for (let s = 0; s < steps; s++) {
      const value = rangeStart + s * stepSize;
      const runsPerStep = Math.ceil(count / steps);
      for (let r = 0; r < runsPerStep; r++) {
        const override = {};
        if (sweepParam === 'workers') override.workers = Math.round(value);
        else if (sweepParam === 'noise') override.noise = Math.round(value);
        else if (sweepParam === 'battDrain') override.battDrain = Math.round(value);
        else if (sweepParam === 'squads') override.squads = Math.round(value);
        else if (sweepParam === 'rfRange') override.rfRange = Math.round(value);
        scenarios.push({ seed: s * runsPerStep + r + 1, cfgOverride: override, sweepValue: value });
      }
    }
  }

  return scenarios;
}
