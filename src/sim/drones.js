// ---- Drone Hardware Types, Constants & Simulation Logic -----------------------------------------
// Extracted from AMMO_v3.html monolith (lines 347-565, 877-933)

import { S } from './engine.js';
import { dist2 } from './utils.js';
import { triggerElection } from './election.js';
import { recordDeath, updatePartitions } from './metrics.js';
import { addLog, addAILog } from '../ui/log.js';
import { updateDroneInfoPanel } from '../ui/panels.js';

// ---- Hardware catalog (9 entries) ---------------------------------------------------------------
export const DRONE_TYPES = {
  COMMAND_NODE:{name:'Command Node',cls:'Ground / Heavy UAS',cpu:'x86-64 Core i7',gpu:'RTX 3060 Mobile',ram:'32 GB',comms:'5G + WiFi 6E + SDR',carryKg:8.0,airtimeMin:45,maxAltM:4000,speedKmh:85,weightKg:4.2,rfRangeMult:2.2,aiLevel:4,battCapMult:1.0,drainMult:1.8,missionTypes:['ORCHESTRATE','STRIKE','ISR','RELAY','CLOUD_INFERENCE'],aiDesc:'Full LLM reasoning + cloud ML inference. Delegates autonomously. No human in loop.',color:'#00d4ff'},
  JETSON_AGX:{name:'Jetson AGX Orin',cls:'Heavy Leader UAS',cpu:'A78AE 12-core',gpu:'Ampere 2048c + 64 Tensor',ram:'64 GB',comms:'WiFi 6 + LoRa + SDR mesh',carryKg:3.5,airtimeMin:35,maxAltM:3500,speedKmh:70,weightKg:2.8,rfRangeMult:1.7,aiLevel:3,battCapMult:0.9,drainMult:1.5,missionTypes:['ORCHESTRATE','STRIKE','ISR','LOCAL_INFERENCE'],aiDesc:'Full YOLO/transformer on-device. No cloud needed. Autonomous mission adaptation.',color:'#00d4ff'},
  JETSON_NX:{name:'Jetson Orin NX',cls:'Mid Leader UAS',cpu:'A78AE 8-core',gpu:'Ampere 1024c + 32 Tensor',ram:'16 GB',comms:'WiFi 6 + LoRa + mesh',carryKg:2.0,airtimeMin:28,maxAltM:2800,speedKmh:65,weightKg:1.9,rfRangeMult:1.4,aiLevel:3,battCapMult:0.85,drainMult:1.3,missionTypes:['ORCHESTRATE','ISR','LOCAL_INFERENCE'],aiDesc:'Compressed transformer models. Full squad orchestration without GL. Prime election candidate.',color:'#bf7fff'},
  JETSON_NANO:{name:'Jetson Nano 4GB',cls:'Light SBC UAS',cpu:'A57 4-core',gpu:'Maxwell 128-core',ram:'4 GB',comms:'WiFi 5 + LoRa',carryKg:0.8,airtimeMin:22,maxAltM:1800,speedKmh:55,weightKg:1.1,rfRangeMult:1.1,aiLevel:2,battCapMult:0.75,drainMult:1.1,missionTypes:['ISR','RELAY','EDGE_INFERENCE'],aiDesc:'Runs MobileNet/TFLite. Object detection, basic scene classification. Cannot lead a squad alone.',color:'#00ffcc'},
  RPI5:{name:'RPi5 + Hailo NPU',cls:'Light SBC UAS',cpu:'A76 4-core 2.4GHz',gpu:'VideoCore VII + Hailo-8',ram:'8 GB',comms:'WiFi 5 + LoRa + mesh',carryKg:0.6,airtimeMin:25,maxAltM:1500,speedKmh:50,weightKg:0.9,rfRangeMult:1.0,aiLevel:2,battCapMult:0.8,drainMult:1.0,missionTypes:['ISR','RELAY','EDGE_INFERENCE'],aiDesc:'Hailo NPU: 26 TOPS edge inference. Supports basic orchestration duties under direction.',color:'#00ffcc'},
  RPI_ZERO:{name:'RPi Zero 2W',cls:'Micro Worker UAS',cpu:'A53 4-core 1GHz',gpu:'VideoCore IV',ram:'512 MB',comms:'WiFi 4 + RF',carryKg:0.2,airtimeMin:18,maxAltM:800,speedKmh:40,weightKg:0.35,rfRangeMult:0.85,aiLevel:1,battCapMult:0.6,drainMult:0.7,missionTypes:['ISR','RELAY'],aiDesc:'Rule-engine only. IF/THEN chains. No ML. Must receive all task assignments from SL.',color:'#39ff88'},
  STM32_ADV:{name:'STM32H7 Advanced',cls:'Constrained MCU UAS',cpu:'Cortex-M7 480MHz',gpu:'None (SIMD only)',ram:'1 MB SRAM',comms:'LoRa + 900MHz FHSS',carryKg:0.15,airtimeMin:40,maxAltM:600,speedKmh:65,weightKg:0.28,rfRangeMult:0.9,aiLevel:1,battCapMult:1.2,drainMult:0.5,missionTypes:['STRIKE','RELAY','SENSOR'],aiDesc:'Deterministic firmware + basic rule engine. Sub-ms reflexes. Long battery. No autonomous reasoning.',color:'#39ff88'},
  STM32_BASIC:{name:'STM32F4 Basic',cls:'Minimal MCU UAS',cpu:'Cortex-M4 168MHz',gpu:'None',ram:'192 KB SRAM',comms:'LoRa / 433MHz',carryKg:0.05,airtimeMin:55,maxAltM:400,speedKmh:70,weightKg:0.18,rfRangeMult:0.75,aiLevel:0,battCapMult:1.5,drainMult:0.3,missionTypes:['RELAY','SENSOR'],aiDesc:'Pure deterministic code. No decisions beyond pre-programmed sequences. Follows TASK_ASSIGN only.',color:'#ffe033'},
  ESP32_MESH:{name:'ESP32 Mesh Node',cls:'Ultra-light Relay',cpu:'Xtensa LX6 240MHz',gpu:'None',ram:'520 KB',comms:'WiFi-mesh + BLE + 915MHz',carryKg:0.0,airtimeMin:90,maxAltM:300,speedKmh:50,weightKg:0.12,rfRangeMult:0.8,aiLevel:0,battCapMult:2.0,drainMult:0.2,missionTypes:['RELAY'],aiDesc:'Pure mesh relay. Zero mission payload. Extremely low power. Long endurance. RF bridge only.',color:'#ffe033'}
};

// ---- AI level descriptors -----------------------------------------------------------------------
export const AI_LEVEL_DESC = [
  {label:'NONE',    color:'#4a6680',desc:'Deterministic firmware only'},
  {label:'RULES',   color:'#ffe033',desc:'IF/THEN rule engine, pre-programmed'},
  {label:'EDGE-ML', color:'#ff9e00',desc:'TFLite/MobileNet on NPU, object detect'},
  {label:'FULL-AI', color:'#bf7fff',desc:'Local transformer, autonomous adapt'},
  {label:'CLOUD-AI',color:'#00d4ff',desc:'Remote ML via 5G/Ethernet, unlimited compute'}
];

// ---- Mission color map --------------------------------------------------------------------------
export const MISSION_COLORS = {
  ORCHESTRATE:'#00d4ff',STRIKE:'#ff3b3b',ISR:'#00ffcc',
  RELAY:'#ffe033',LOCAL_INFERENCE:'#bf7fff',
  EDGE_INFERENCE:'#ff9e00',CLOUD_INFERENCE:'#00d4ff',SENSOR:'#39ff88'
};

// ---- Role constants -----------------------------------------------------------------------------
export const ROLES  = { GL:'GL', SL:'SL', ASL:'ASL', W:'W', SH:'SH', RL:'RL' };
export const RCOL   = { GL:'#00d4ff', SL:'#00ffcc', ASL:'#bf7fff', W:'#39ff88', SH:'#ff9e00', RL:'#ffe033' };
export const RRAD   = { GL:14, SL:11, ASL:11, W:8, SH:9, RL:7 };
export const RRANGE = { GL:1.6, SL:1.3, ASL:1.3, W:1.0, SH:1.0, RL:1.5 };

// ---- Drone factory ------------------------------------------------------------------------------
export function mkDrone(x, y, role, leaderId, squadId, hwTypeKey) {
  const hwKey = hwTypeKey || (
    role===ROLES.GL?S.cfg.hwGL : role===ROLES.SL||role===ROLES.ASL?S.cfg.hwSL :
    role===ROLES.RL?S.cfg.hwRelay : S.cfg.hwWorker
  );
  const hw = DRONE_TYPES[hwKey] || DRONE_TYPES.STM32_BASIC;
  const battCap = 85 * hw.battCapMult + Math.random()*8;
  return {
    id:S.nextId++, role, hwType:hwKey, hw,
    x, y, px:x, py:y,
    health:100, battery:Math.min(100, battCap),
    aiEnabled: hw.aiLevel >= 3,
    alive:true, squadId,
    leaderId, shadowOf:null,
    color: RCOL[role]||hw.color||'#888',
    taskProgress:Math.random()*60,
    electing:false, electPulse:0, electFlash:0,
    patrolTimer:Math.random()*200,
    patrolRadius:role===ROLES.GL?18:role===ROLES.SL||role===ROLES.ASL?32:role===ROLES.W?48:12,
    originX:x, originY:y,
    routeTarget:null
  };
}

// ---- Main drone update (battery drain, movement, zone effects) ----------------------------------
// battDrain is "percent per sim-minute", so drain per second = battDrain/60
// At drain=5: 5%/min => 20 min to empty (clearly visible)
// At drain=20: 20%/min => 5 min to empty
export function updateDrones(dt) {
  const drainPerSec = S.cfg.battDrain / 60.0;

  S.drones.forEach(d => {
    if (!d.alive) return;

    // Patrol
    d.patrolTimer -= dt*60;
    if (d.patrolTimer<=0) {
      d.patrolTimer=70+Math.random()*150;
      // If route set, workers navigate toward route waypoints
      if (S.route.length>0 && (d.role===ROLES.W||d.role===ROLES.SH)) {
        const wi = d.routeTarget===null ? 0 : d.routeTarget;
        const wp = S.route[wi % S.route.length];
        const spread = 40;
        d.px = wp.x + (Math.random()-0.5)*spread;
        d.py = wp.y + (Math.random()-0.5)*spread;
        const dd2 = dist2(d.x, d.y, wp.x, wp.y);
        if (dd2 < 50 && S.route.length>1) d.routeTarget = (wi+1) % S.route.length;
      } else {
        const ang=Math.random()*Math.PI*2, r=Math.random()*d.patrolRadius;
        d.px=Math.max(30,Math.min(S.worldWidth-30, d.originX+Math.cos(ang)*r));
        d.py=Math.max(30,Math.min(S.worldHeight-30, d.originY+Math.sin(ang)*r));
      }
    }

    // Move
    const dx=d.px-d.x, dy=d.py-d.y;
    const spd=(d.role===ROLES.GL?14:d.role===ROLES.W?24:19)*dt;
    const dist=Math.sqrt(dx*dx+dy*dy);
    if (dist>1){d.x+=(dx/dist)*Math.min(spd,dist); d.y+=(dy/dist)*Math.min(spd,dist);}
    d.x+=(Math.random()-0.5)*0.6*dt*60;
    d.y+=(Math.random()-0.5)*0.6*dt*60;

    // REAL battery drain
    const aiMult = d.aiEnabled ? 1.4 : 1.0;
    const hwMult = (d.hw && d.hw.drainMult) ? d.hw.drainMult : 1.0;
    d.battery = Math.max(0, d.battery - drainPerSec * aiMult * hwMult * dt);
    if (d.battery <= 0) { killDrone(d.id, 'Battery depleted'); return; }

    // Low battery degrades health slowly
    if (d.battery < 15) d.health = Math.max(0, d.health - 0.5*dt);

    // Animation
    if (d.electing) d.electPulse+=dt*3;
    if (d.electFlash>0) d.electFlash-=dt;

    // Task progress
    if (d.role===ROLES.W||d.role===ROLES.SH) {
      d.taskProgress=Math.min(100,d.taskProgress+dt*(2+Math.random()*0.8));
      if (d.taskProgress>=100) d.taskProgress=0;
    }

    // Zone effects
    d.jammed=false; d.gpsLost=false;
    S.zones.forEach(z => {
      const dd=dist2(d.x,d.y,z.x,z.y);
      if (z.type==='jam' && dd<z.radius) {
        d.jammed=true;
        d.battery=Math.max(0, d.battery-0.02*dt); // jam drains faster
      }
      if (z.type==='gps' && dd<z.radius) d.gpsLost=true;
      if (z.type==='attacker' && dd<z.radius*0.28 && Math.random()<0.0012*S.speed)
        killDrone(d.id,'Attacker strike');
    });
  });
}

// ---- Rebuild mesh links every frame -------------------------------------------------------------
export function updateLinks() {
  S.links=[];
  const alive=S.drones.filter(d=>d.alive);
  const noise=S.cfg.noise/100;
  for (let i=0;i<alive.length;i++) for (let j=i+1;j<alive.length;j++) {
    const a=alive[i], b=alive[j];
    const maxR=S.cfg.rfRange*Math.min((a.hw?a.hw.rfRangeMult:1)*RRANGE[a.role],(b.hw?b.hw.rfRangeMult:1)*RRANGE[b.role]);
    const d=dist2(a.x,a.y,b.x,b.y);
    if (d>maxR) continue;
    let q=1-(d/maxR)-noise*0.5;
    S.zones.forEach(z=>{
      if (z.type!=='jam') return;
      const md=Math.min(dist2(a.x,a.y,z.x,z.y),dist2(b.x,b.y,z.x,z.y));
      if (md<z.radius) q-=(1-md/z.radius)*0.85;
    });
    q=Math.max(0,Math.min(1,q+(Math.random()-0.5)*0.04));
    if (q<0.04) continue;
    const isLeader=(a.leaderId===b.id||b.leaderId===a.id||a.shadowOf===b.id||b.shadowOf===a.id);
    S.links.push({a,b,q,isLeader});
  }
  updatePartitions();
}

// ---- Kill drone & trigger election if leader ----------------------------------------------------
export function killDrone(id, reason) {
  const d=S.drones.find(d=>d.id===id);
  if (!d||!d.alive) return;
  recordDeath(d, reason);
  d.alive=false; d.health=0; S.lostCount++;
  const sev=(d.role===ROLES.GL||d.role===ROLES.SL||d.role===ROLES.ASL)?'alert':'warn';
  addLog(d.role+' #'+d.id+' LOST -- '+reason, sev);
  if (d.role===ROLES.GL||d.role===ROLES.SL||d.role===ROLES.ASL) triggerElection(d);
  if (S.selectedId===id) updateDroneInfoPanel();
}

// ---- Battery alerts + AI situational log --------------------------------------------------------
export function checkBattAlerts() {
  S.drones.filter(d=>d.alive&&d.battery<20&&d.battery>0).forEach(d=>{
    addLog('LOW BATTERY '+Math.round(d.battery)+'% -- '+d.role+' #'+d.id,'warn');
  });
  const gl=S.drones.find(d=>d.alive&&d.role===ROLES.GL&&d.aiEnabled);
  if (gl&&Math.random()<0.5) {
    const a=S.drones.filter(d=>d.alive).length, tot=S.drones.length;
    addAILog('GL','SITUATIONAL','Fleet '+Math.round(a/tot*100)+'% ('+a+'/'+tot+'). Links: '+S.links.length+'. Avg batt: '+Math.round(S.drones.filter(d=>d.alive).reduce((s,d)=>s+d.battery,0)/(a||1))+'%.');
  }
}
