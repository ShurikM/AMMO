import { mkDrone, ROLES, RCOL, updateDrones, updateLinks, checkBattAlerts } from './drones.js';
import { updateElections } from './election.js';
import { recordTimeline, resetMetrics } from './metrics.js';
import { updateProtocolStates, resetProtocolStates } from './protocol.js';
import { draw } from '../render/canvas.js';
import { addLog, addAILog, resetLogCounters } from '../ui/log.js';
import { updateDroneInfoPanel } from '../ui/panels.js';
import { recordSnapshot, resetReplay, isPlaybackActive } from './replay.js';
import { checkFaults, resetFaults } from './faults.js';
import { checkAssertions, initAssertions } from './assertions.js';
import { updateMission, resetMission } from './mission.js';
import { updateCommsStatus, resetComms, getFleetCommsHealth } from './comms.js';
import { updateThreats, resetThreats } from './threats.js';

// ---- View (zoom/pan) -------------------------------------------------------------------------
export let V = { zoom:1, px:0, py:0, dragging:false, dx:0, dy:0, dpx:0, dpy:0 };

export function toWorld(cx, cy) {
  return { x:(cx - V.px)/V.zoom, y:(cy - V.py)/V.zoom };
}

export function toScreen(wx, wy) {
  return { x: wx*V.zoom + V.px, y: wy*V.zoom + V.py };
}

// ---- Simulation state -------------------------------------------------------------------------
export let S = {
  drones:[], zones:[], packets:[], elections:[], links:[],
  route:[], routeMode:false,
  tick:0, missionTime:0, paused:false, speed:1,
  placeMode:null, selectedId:null,
  electionCount:0, lostCount:0, lastFrame:null,
  nextId:1,
  worldWidth:800, worldHeight:600,
  cfg:{ squads:2, workers:4, relays:2, aiGL:true, aiSL:false, shadowOn:true, rfRange:130, noise:10, battDrain:5, hwGL:'COMMAND_NODE', hwSL:'JETSON_NX', hwWorker:'STM32_ADV', hwRelay:'ESP32_MESH' }
};

// ---- Init -------------------------------------------------------------------------------------
export function initSim() {
  S.drones=[]; S.zones=[]; S.packets=[]; S.elections=[];
  S.tick=0; S.missionTime=0; S.electionCount=0; S.lostCount=0;
  S.nextId=1; S.selectedId=null; S.route=[];
  const cw=S.worldWidth, ch=S.worldHeight, cx=cw/2, cy=ch/2;
  const c=S.cfg;

  // GL at center
  const gl = mkDrone(cx, cy, ROLES.GL, null, 0);
  gl.aiEnabled = c.aiGL;
  if (c.aiGL) gl.color = RCOL.ASL;
  S.drones.push(gl);

  const angles = [[-Math.PI/3, Math.PI/3], [0], [-Math.PI*2/3,0,Math.PI*2/3],
    [-Math.PI*3/4,-Math.PI/4,Math.PI/4,Math.PI*3/4]][c.squads-1];

  angles.forEach((ang, si) => {
    const sr=170, sx=cx+Math.cos(ang)*sr, sy=cy+Math.sin(ang)*(sr*0.8);
    const slRole = c.aiSL ? ROLES.ASL : ROLES.SL;
    const sl = mkDrone(sx, sy, slRole, gl.id, si+1);
    sl.aiEnabled = c.aiSL;
    S.drones.push(sl);

    if (c.shadowOn) {
      const sa=ang+0.35;
      const sh = mkDrone(sx+Math.cos(sa)*48, sy+Math.sin(sa)*48, ROLES.SH, sl.id, si+1);
      sh.shadowOf=sl.id; sh.leaderId=sl.id;
      S.drones.push(sh);
    }

    for (let wi=0; wi<c.workers; wi++) {
      const wa=ang+(wi-(c.workers-1)/2)*0.44;
      const wr=80+(wi%2)*18;
      const w=mkDrone(sx+Math.cos(wa)*wr, sy+Math.sin(wa)*(wr*0.88), ROLES.W, sl.id, si+1);
      w.leaderId=sl.id;
      S.drones.push(w);
    }
  });

  for (let ri=0; ri<c.relays; ri++) {
    const ra=(ri/c.relays)*Math.PI*2;
    S.drones.push(mkDrone(cx+Math.cos(ra)*230, cy+Math.sin(ra)*170, ROLES.RL, null, 0));
  }

  addLog('AMMO SIM INITIALIZED -- '+S.drones.length+' drones deployed', 'ok');
  addLog('Fleet: 1 GL, '+c.squads+' SLs, '+c.squads*c.workers+' workers, '+c.relays+' relays', 'ok');
  if (c.aiGL) addAILog('GL','INIT','Mission loaded. Composing squad assignments. Goal vector locked.');
  updateDroneInfoPanel();
}

// ---- Resize ------------------------------------------------------------------------------------
export function resizeCanvas(canvas, wrap) {
  const r=wrap.getBoundingClientRect();
  canvas.width=Math.floor(r.width);
  canvas.height=Math.floor(r.height);
  S.worldWidth=canvas.width;
  S.worldHeight=canvas.height;
  initSim();
}

// ---- Main loop ---------------------------------------------------------------------------------
export function loop(ts) {
  if (!S.lastFrame) S.lastFrame=ts;
  const raw=Math.min((ts-S.lastFrame)/1000, 0.05);
  S.lastFrame=ts;
  if (!S.paused) update(raw*S.speed);
  draw();
  requestAnimationFrame(loop);
}

// ---- Update ------------------------------------------------------------------------------------
export function update(dt) {
  if (isPlaybackActive()) return;
  S.missionTime+=dt; S.tick++;
  updateDrones(dt);
  updateLinks();
  updateCommsStatus();
  updatePackets(dt);
  updateElections(dt);
  updateZones(dt);
  updateThreats(dt);
  if (S.tick%90===0) spawnIntel();
  if (S.tick%130===0) spawnBeacons();
  if (S.tick%240===0) checkBattAlerts();
  updateStats();
  checkFaults();
  checkAssertions();
  updateMission(dt);
  updateProtocolStates();
  if (Math.floor(S.missionTime / 5) > Math.floor((S.missionTime - dt) / 5)) recordTimeline();
  if (Math.floor(S.missionTime) > Math.floor(S.missionTime - dt)) recordSnapshot();
}

// ---- Packets ------------------------------------------------------------------------------------
function updatePackets(dt) {
  S.packets=S.packets.filter(p=>{
    p.prog+=dt*(p.spd||1.2);
    const a=S.drones.find(d=>d.id===p.from), b=S.drones.find(d=>d.id===p.to);
    if (!a||!b||!a.alive||!b.alive) return false;
    p.x=a.x+(b.x-a.x)*p.prog; p.y=a.y+(b.y-a.y)*p.prog;
    return p.prog<1;
  });
}

// ---- Zones --------------------------------------------------------------------------------------
function updateZones(dt) {
  S.zones.forEach(z=>{
    if (z.type!=='attacker') return;
    z.ang=(z.ang||0)+dt*0.25;
    z.x=Math.max(60,Math.min(S.worldWidth-60, z.x+Math.cos(z.ang)*18*dt));
    z.y=Math.max(60,Math.min(S.worldHeight-60, z.y+Math.sin(z.ang)*18*dt));
  });
}

// ---- Stats --------------------------------------------------------------------------------------
function updateStats() {
  const alive=S.drones.filter(d=>d.alive);
  const leaders=alive.filter(d=>d.role===ROLES.GL||d.role===ROLES.SL||d.role===ROLES.ASL);
  const avgBatt=alive.length?alive.reduce((s,d)=>s+d.battery,0)/alive.length:0;

  document.getElementById('stat-alive').textContent=alive.length;
  document.getElementById('stat-leaders').textContent=leaders.length;

  const dd=document.getElementById('stat-dead');
  dd.textContent=S.lostCount;
  dd.className='val '+(S.lostCount>3?'alert':S.lostCount>0?'warn':'ok');

  document.getElementById('stat-elections').textContent=S.electionCount;
  document.getElementById('stat-links').textContent=S.links.length;

  const battEl=document.getElementById('stat-batt');
  battEl.textContent=Math.round(avgBatt)+'%';
  battEl.className='val '+(avgBatt>50?'ok':avgBatt>25?'warn':'alert');

  const commsEl = document.getElementById('stat-comms');
  if (commsEl) {
    const ch = getFleetCommsHealth();
    commsEl.textContent = ch + '%';
    commsEl.className = 'val ' + (ch > 70 ? 'ok' : ch > 40 ? 'warn' : 'alert');
  }

  const mm=String(Math.floor(S.missionTime/60)).padStart(2,'0');
  const ss=String(Math.floor(S.missionTime%60)).padStart(2,'0');
  document.getElementById('mission-clock').textContent='T+'+mm+':'+ss;
}

// ---- Intel / Beacon packets -------------------------------------------------------------------
function spawnIntel() {
  S.drones.filter(d=>d.alive&&d.role===ROLES.W).forEach(w=>{
    const sl=S.drones.find(d=>d.id===w.leaderId&&d.alive);
    if (sl&&Math.random()<0.45) S.packets.push({from:w.id,to:sl.id,x:w.x,y:w.y,prog:0,col:'#39ff88',sz:2.5,spd:0.35+Math.random()*0.25});
  });
  S.drones.filter(d=>d.alive&&(d.role===ROLES.SL||d.role===ROLES.ASL)).forEach(sl=>{
    const gl=S.drones.find(d=>d.alive&&(d.role===ROLES.GL));
    if (gl&&Math.random()<0.65) S.packets.push({from:sl.id,to:gl.id,x:sl.x,y:sl.y,prog:0,col:'#00ffcc',sz:3,spd:0.45+Math.random()*0.2});
  });
}

function spawnBeacons() {
  S.drones.filter(d=>d.alive&&!d.jammed).forEach(d=>{
    S.links.filter(l=>l.a.id===d.id||l.b.id===d.id).slice(0,2).forEach(lk=>{
      const t=lk.a.id===d.id?lk.b:lk.a;
      if (Math.random()<0.25) S.packets.push({from:d.id,to:t.id,x:d.x,y:d.y,prog:0,col:'rgba(100,180,255,0.6)',sz:1.5,spd:0.9});
    });
  });
}

// ---- Reset -------------------------------------------------------------------------------------
export function resetSim() {
  S.paused=false;
  document.getElementById('btn-pause').textContent='\u25AE\u25AE PAUSE';
  document.getElementById('btn-pause').classList.remove('active');
  document.getElementById('event-log').innerHTML='';
  document.getElementById('decision-log').innerHTML='';
  resetLogCounters();
  resetMetrics();
  resetProtocolStates();
  resetReplay();
  resetFaults();
  resetMission();
  resetComms();
  resetThreats();
  initAssertions();
  S.zones=[];
  initSim();
}
