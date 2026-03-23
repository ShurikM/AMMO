// ── Canvas rendering ────────────────────────────────────────────────
// All draw functions extracted from AMMO_v3.html (lines 641-853).
// Zoom/pan controls and canvas event wiring (lines 1054-1130).

import { S, V, toWorld } from '../sim/engine.js';
import { ROLES, RCOL, RRAD, killDrone } from '../sim/drones.js';
import { STATE_COLORS } from '../sim/protocol.js';
import { dist2 } from '../sim/utils.js';
import { addLog, addAILog } from '../ui/log.js';
import { updateDroneInfoPanel, showTab, setPlaceMode } from '../ui/panels.js';
import { THREAT_TYPES, spawnThreat } from '../sim/threats.js';

// ---- Canvas references (set during init) -------------------------------------------------------
let canvas, ctx;

export function initCanvas() {
  canvas = document.getElementById('sim-canvas');
  ctx = canvas.getContext('2d');
  return { canvas, ctx };
}

export function getCanvas() { return canvas; }
export function getCtx() { return ctx; }

// ---- Main draw (called every frame) ------------------------------------------------------------
export function draw() {
  const W=canvas.width, H=canvas.height;
  ctx.clearRect(0,0,W,H);
  ctx.save();
  ctx.translate(V.px,V.py);
  ctx.scale(V.zoom,V.zoom);

  drawMap();
  drawRoute();
  drawZones();
  drawLinks();
  drawPackets();
  S.drones.forEach(d=>drawDrone(d));
  S.elections.forEach(e=>drawElection(e));

  ctx.restore();

  // HUD (not zoomed)
  ctx.fillStyle='rgba(74,102,128,0.65)';
  ctx.font='10px Share Tech Mono, monospace';
  ctx.textAlign='left';
  ctx.fillText('ZOOM '+V.zoom.toFixed(2)+'x  |  scroll=zoom  ctrl+drag=pan  right-click=kill drone', 8, H-8);
}

// ---- Tactical grid + compass rose --------------------------------------------------------------
function drawMap() {
  const W=canvas.width/V.zoom, H=canvas.height/V.zoom;
  const ox=-V.px/V.zoom, oy=-V.py/V.zoom;
  const gridSize=50;

  ctx.strokeStyle='rgba(26,45,69,0.5)';
  ctx.lineWidth=0.5;
  for (let x=Math.floor(ox/gridSize)*gridSize; x<ox+W+gridSize; x+=gridSize) {
    ctx.beginPath(); ctx.moveTo(x,oy); ctx.lineTo(x,oy+H); ctx.stroke();
  }
  for (let y=Math.floor(oy/gridSize)*gridSize; y<oy+H+gridSize; y+=gridSize) {
    ctx.beginPath(); ctx.moveTo(ox,y); ctx.lineTo(ox+W,y); ctx.stroke();
  }

  // Coordinate labels
  ctx.fillStyle='rgba(74,102,128,0.4)';
  ctx.font='9px Share Tech Mono, monospace';
  ctx.textAlign='center';
  for (let x=Math.floor(ox/gridSize)*gridSize; x<ox+W+gridSize; x+=gridSize*2) {
    ctx.fillText(Math.round(x), x, oy+10);
  }
  ctx.textAlign='right';
  for (let y=Math.floor(oy/gridSize)*gridSize; y<oy+H+gridSize; y+=gridSize*2) {
    ctx.fillText(Math.round(y), ox+28, y+3);
  }

  // Compass rose (top-right of world)
  const cx2=ox+W-40, cy2=oy+30;
  ctx.strokeStyle='rgba(0,212,255,0.3)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(cx2,cy2-12); ctx.lineTo(cx2,cy2+12); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx2-12,cy2); ctx.lineTo(cx2+12,cy2); ctx.stroke();
  ctx.fillStyle='rgba(0,212,255,0.5)';
  ctx.font='9px Share Tech Mono, monospace'; ctx.textAlign='center';
  ctx.fillText('N',cx2,cy2-15);
}

// ---- Mission route waypoints --------------------------------------------------------------------
function drawRoute() {
  if (S.route.length===0) return;

  // Dashed route path
  ctx.setLineDash([8,5]);
  ctx.strokeStyle='rgba(0,232,122,0.6)';
  ctx.lineWidth=1.5;
  ctx.beginPath();
  S.route.forEach((wp,i)=>{ i===0?ctx.moveTo(wp.x,wp.y):ctx.lineTo(wp.x,wp.y); });
  ctx.stroke();
  ctx.setLineDash([]);

  // Waypoint markers
  S.route.forEach((wp,i)=>{
    ctx.beginPath(); ctx.arc(wp.x,wp.y,7,0,Math.PI*2);
    ctx.fillStyle='rgba(0,232,122,0.15)'; ctx.fill();
    ctx.strokeStyle='rgba(0,232,122,0.8)'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle='rgba(0,232,122,0.9)';
    ctx.font='bold 9px Share Tech Mono, monospace'; ctx.textAlign='center';
    ctx.fillText('WP'+(i+1), wp.x, wp.y-11);

    // Radius halo on last waypoint (target)
    if (i===S.route.length-1) {
      ctx.beginPath(); ctx.arc(wp.x,wp.y,24,0,Math.PI*2);
      ctx.strokeStyle='rgba(0,232,122,0.25)'; ctx.lineWidth=1;
      ctx.setLineDash([3,5]); ctx.stroke(); ctx.setLineDash([]);
    }
  });
}

// ---- RF jam, GPS denial, attacker zones ---------------------------------------------------------
function drawZones() {
  S.zones.forEach(z=>{
    const g=ctx.createRadialGradient(z.x,z.y,0,z.x,z.y,z.radius);
    let sc, lc;
    if (z.type==='jam'){sc='rgba(255,40,40,0.2)';lc='rgba(255,60,60,0.5)';}
    else if (z.type==='gps'){sc='rgba(40,100,255,0.18)';lc='rgba(80,130,255,0.5)';}
    else {sc='rgba(255,130,0,0.15)';lc='rgba(255,140,0,0.6)';}
    g.addColorStop(0,sc); g.addColorStop(0.6,sc.replace('0.2','0.1').replace('0.18','0.09').replace('0.15','0.08')); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(z.x,z.y,z.radius,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=lc; ctx.lineWidth=1; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.arc(z.x,z.y,z.radius,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle=z.type==='jam'?'#ff4444':z.type==='gps'?'#8899ff':'#ffaa44';
    ctx.font='10px Share Tech Mono, monospace'; ctx.textAlign='center';
    const lbl=z.type==='jam'?'RF JAM':z.type==='gps'?'GPS DENY':'ATTACKER';
    ctx.fillText(lbl, z.x, z.y-z.radius-5);

    // Threat-specific rendering
    if (z.threatType) {
      const tt = THREAT_TYPES[z.threatType];
      if (tt) {
        // Draw threat icon
        ctx.fillStyle = tt.color;
        ctx.font = 'bold 12px Share Tech Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(z.icon || tt.icon, z.x, z.y + 4);

        // Kill radius (inner dashed circle)
        if (z.killRadius) {
          ctx.strokeStyle = tt.color;
          ctx.lineWidth = 1;
          ctx.setLineDash([2,4]);
          ctx.beginPath();
          ctx.arc(z.x, z.y, z.killRadius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Kill count badge
        if (z.kills > 0) {
          ctx.fillStyle = '#ff3b3b';
          ctx.font = '8px Share Tech Mono, monospace';
          ctx.fillText(z.kills + ' kills', z.x, z.y + z.radius + 10);
        }

        // Directed energy cone indicator
        if (z.threatType === 'DIRECTED_ENERGY') {
          ctx.strokeStyle = 'rgba(255,255,0,0.3)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(z.x, z.y);
          ctx.arc(z.x, z.y, z.killRadius, z.ang - 0.5, z.ang + 0.5);
          ctx.closePath();
          ctx.stroke();
        }
      }
    }
  });
}

// ---- Mesh links between drones ------------------------------------------------------------------
function drawLinks() {
  S.links.forEach(lk=>{
    const q=lk.q;
    const col=q>0.65?'rgba(0,230,120,'+(0.15+q*0.3)+')':q>0.35?'rgba(255,165,0,'+(0.15+q*0.3)+')':'rgba(255,60,60,'+(0.12+q*0.25)+')';
    ctx.strokeStyle=col; ctx.lineWidth=lk.isLeader?1.6:0.8;
    if (!lk.isLeader) ctx.setLineDash([3,6]);
    ctx.beginPath(); ctx.moveTo(lk.a.x,lk.a.y); ctx.lineTo(lk.b.x,lk.b.y); ctx.stroke();
    ctx.setLineDash([]);
  });
}

// ---- Animated data packets ----------------------------------------------------------------------
function drawPackets() {
  S.packets.forEach(p=>{
    ctx.beginPath(); ctx.arc(p.x,p.y,p.sz||3,0,Math.PI*2);
    ctx.fillStyle=p.col||'#00ffcc';
    ctx.shadowColor=p.col||'#00ffcc'; ctx.shadowBlur=6;
    ctx.fill(); ctx.shadowBlur=0;
  });
}

// ---- Individual drone rendering -----------------------------------------------------------------
function drawDrone(d) {
  const r=RRAD[d.role]||8;
  if (!d.alive) {
    ctx.strokeStyle='rgba(80,10,10,0.7)'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(d.x-5,d.y-5); ctx.lineTo(d.x+5,d.y+5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(d.x+5,d.y-5); ctx.lineTo(d.x-5,d.y+5); ctx.stroke();
    return;
  }

  const col=d.color;
  const sel=d.id===S.selectedId;

  if (sel) {
    ctx.strokeStyle='#ffffff'; ctx.lineWidth=1; ctx.setLineDash([3,3]);
    ctx.beginPath(); ctx.arc(d.x,d.y,r+7,0,Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
  }
  if (d.electing && d.electPulse>0) {
    const pr=r+(d.electPulse%1)*28, pa=1-(d.electPulse%1);
    ctx.strokeStyle='rgba(255,220,0,'+pa*0.8+')'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(d.x,d.y,pr,0,Math.PI*2); ctx.stroke();
  }

  // Jammed halo
  if (d.jammed) {
    ctx.fillStyle='rgba(255,60,60,0.2)';
    ctx.beginPath(); ctx.arc(d.x,d.y,r+5,0,Math.PI*2); ctx.fill();
  }

  ctx.shadowColor=col;
  ctx.shadowBlur=d.electFlash>0?28:(d.role===ROLES.GL?16:8);
  ctx.fillStyle=col;
  ctx.beginPath();

  if (d.role===ROLES.GL) {
    ctx.moveTo(d.x,d.y-r*1.35); ctx.lineTo(d.x+r*1.1,d.y);
    ctx.lineTo(d.x,d.y+r*1.35); ctx.lineTo(d.x-r*1.1,d.y); ctx.closePath();
  } else if (d.role===ROLES.SH) {
    for (let i=0;i<6;i++){const a=i/6*Math.PI*2-Math.PI/6; i?ctx.lineTo(d.x+r*Math.cos(a),d.y+r*Math.sin(a)):ctx.moveTo(d.x+r*Math.cos(a),d.y+r*Math.sin(a));}
    ctx.closePath();
  } else if (d.role===ROLES.RL) {
    ctx.rect(d.x-r*0.9,d.y-r*0.9,r*1.8,r*1.8);
  } else {
    ctx.arc(d.x,d.y,r,0,Math.PI*2);
  }
  ctx.fill();
  ctx.shadowBlur=0;

  // AI indicator
  if (d.aiEnabled) {
    ctx.fillStyle='rgba(0,0,0,0.7)'; ctx.font='bold '+(r*0.9)+'px Arial';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('*',d.x,d.y);
  } else {
    ctx.fillStyle=d.role===ROLES.GL?'#000':'rgba(0,0,0,0.75)';
    ctx.font='bold '+(Math.max(7,r*0.75))+'px Rajdhani, sans-serif';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(d.role,d.x,d.y);
  }
  ctx.textBaseline='alphabetic';

  // ID label
  ctx.fillStyle='rgba(180,210,230,0.6)';
  ctx.font='8px Share Tech Mono, monospace'; ctx.textAlign='center';
  ctx.fillText('#'+d.id,d.x,d.y-r-5);

  // Comms status ring (thin inner ring)
  if (d.alive && d._commsLevel) {
    const levelOrder = {'FULL_MESH':0,'DEGRADED':1,'RELAY_ONLY':2,'ISOLATED':3,'LOST_CONTACT':4};
    if (levelOrder[d._commsLevel] > 0) {
      const commsColors = {'DEGRADED':'#ff9e00','RELAY_ONLY':'#ff9000','ISOLATED':'#ff3b3b','LOST_CONTACT':'#660000'};
      ctx.strokeStyle = commsColors[d._commsLevel] || '#4a6680';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([2,2]);
      ctx.beginPath(); ctx.arc(d.x, d.y, r + 6, 0, Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Battery indicator (colored ring segment)
  const battAngle = (d.battery/100) * Math.PI*2;
  const battCol = d.battery>40?'rgba(0,232,122,0.7)':d.battery>20?'rgba(255,144,0,0.8)':'rgba(255,59,59,0.9)';
  ctx.strokeStyle=battCol; ctx.lineWidth=2.5;
  ctx.beginPath(); ctx.arc(d.x,d.y,r+3.5,-Math.PI/2,-Math.PI/2+battAngle); ctx.stroke();

  // Protocol state indicator (small label below drone)
  if (d._protoState && d._protoState !== 'PATROL' && d._protoState !== 'DEAD') {
    ctx.fillStyle = STATE_COLORS[d._protoState] || '#4a6680';
    ctx.font = '7px Share Tech Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(d._protoState, d.x, d.y + r + 12);
  }
}

// ---- Election animation ring --------------------------------------------------------------------
function drawElection(e) {
  const alpha=Math.min(1,e.phase)*(1-Math.max(0,e.phase-2));
  if (alpha<=0) return;
  ctx.strokeStyle='rgba(255,220,0,'+alpha*0.8+')'; ctx.lineWidth=2;
  const rr=15+e.phase*20;
  ctx.beginPath(); ctx.arc(e.cx,e.cy,rr,0,Math.PI*2); ctx.stroke();
  ctx.fillStyle='rgba(255,220,0,'+alpha+')';
  ctx.font='bold 10px Share Tech Mono, monospace'; ctx.textAlign='center';
  const lbl=e.resolved?('ELECTED #'+e.winnerId):'ELECTION';
  ctx.fillText(lbl, e.cx, e.cy-rr-7);
}

// ---- Zoom / Pan ---------------------------------------------------------------------------------
export function zoomIn(){V.zoom=Math.min(6,V.zoom*1.25);}
export function zoomOut(){V.zoom=Math.max(0.2,V.zoom/1.25);}
export function resetZoom(){V.zoom=1;V.px=0;V.py=0;}

export function getMouseWorld(e) {
  const r=canvas.getBoundingClientRect();
  const sx=canvas.width/r.width, sy=canvas.height/r.height;
  const cx=(e.clientX-r.left)*sx, cy=(e.clientY-r.top)*sy;
  return toWorld(cx,cy);
}

// ---- Canvas event wiring ------------------------------------------------------------------------
export function setupCanvasEvents() {
  // Wheel zoom
  canvas.addEventListener('wheel', e=>{
    e.preventDefault();
    const r=canvas.getBoundingClientRect();
    const sx=canvas.width/r.width, sy=canvas.height/r.height;
    const cx=(e.clientX-r.left)*sx, cy=(e.clientY-r.top)*sy;
    const f=e.deltaY<0?1.12:1/1.12;
    const nz=Math.max(0.2,Math.min(6,V.zoom*f));
    V.px=cx-(cx-V.px)*(nz/V.zoom); V.py=cy-(cy-V.py)*(nz/V.zoom); V.zoom=nz;
  },{passive:false});

  // Pan start
  canvas.addEventListener('mousedown', e=>{
    if (e.button===1||(e.button===0&&e.ctrlKey)){
      e.preventDefault(); V.dragging=true;
      V.dx=e.clientX; V.dy=e.clientY; V.dpx=V.px; V.dpy=V.py;
      canvas.style.cursor='grabbing';
    }
  });

  // Pan move
  window.addEventListener('mousemove', e=>{
    if (!V.dragging) return;
    const r=canvas.getBoundingClientRect();
    const sx=canvas.width/r.width, sy=canvas.height/r.height;
    V.px=V.dpx+(e.clientX-V.dx)*sx; V.py=V.dpy+(e.clientY-V.dy)*sy;
  });

  // Pan end
  window.addEventListener('mouseup', ()=>{ if(V.dragging){V.dragging=false;canvas.style.cursor='crosshair';} });

  // Click: route/zone placement or drone selection
  canvas.addEventListener('click', e=>{
    if (V.dragging) return;
    const {x:wx,y:wy}=getMouseWorld(e);

    if (S.placeMode==='route') {
      S.route.push({x:wx,y:wy});
      document.getElementById('route-info').style.display='block';
      addLog('Waypoint WP'+S.route.length+' set at ('+Math.round(wx)+','+Math.round(wy)+')','ok');
      // Assign workers to new route
      S.drones.filter(d=>d.alive&&d.role===ROLES.W).forEach(d=>d.routeTarget=0);
      const gl=S.drones.find(d=>d.alive&&d.role===ROLES.GL&&d.aiEnabled);
      if (gl&&S.route.length===1) addAILog('GL','ROUTE_UPDATE','New mission route received. WP1 locked at ('+Math.round(wx)+','+Math.round(wy)+'). Redistributing worker tasks.');
      return;
    }

    if (S.placeMode === 'threat') {
      const typeId = document.getElementById('threat-type-select').value;
      spawnThreat(typeId, wx, wy);
      setPlaceMode(null);
      return;
    }

    if (S.placeMode&&S.placeMode!=='route') {
      const radius=S.placeMode==='jam'?125:S.placeMode==='gps'?175:85;
      S.zones.push({type:S.placeMode,x:wx,y:wy,radius});
      addLog(S.placeMode.toUpperCase()+' zone placed','warn');
      setPlaceMode(null);
      return;
    }

    // Select drone
    const hitR=20/V.zoom;
    let closest=null, minD=hitR;
    S.drones.forEach(d=>{const dd=dist2(d.x,d.y,wx,wy);if(dd<minD){minD=dd;closest=d;}});
    S.selectedId=closest?closest.id:null;
    if (closest){showTab('drone');updateDroneInfoPanel();}
  });

  // Right-click: kill drone or finish route
  canvas.addEventListener('contextmenu', e=>{
    e.preventDefault();
    if (S.placeMode==='route'){setPlaceMode(null);addLog('Route entry complete -- '+S.route.length+' waypoints','ok');return;}
    const {x:wx,y:wy}=getMouseWorld(e);
    const hitR=20/V.zoom;
    let closest=null, minD=hitR;
    S.drones.forEach(d=>{if(!d.alive)return;const dd=dist2(d.x,d.y,wx,wy);if(dd<minD){minD=dd;closest=d;}});
    if (closest) killDrone(closest.id,'Right-click kill');
  });
}
