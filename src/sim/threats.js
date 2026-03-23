import { S } from './engine.js';
import { killDrone, ROLES } from './drones.js';
import { dist2 } from './utils.js';
import { addLog } from '../ui/log.js';

// Threat type definitions
export const THREAT_TYPES = {
  STATIC_AA: {
    id: 'STATIC_AA', name: 'Static Anti-Air', color: '#ff3b3b',
    desc: 'Fixed position air defense. Engages closest drone within kill radius.',
    defaultRadius: 100, killRadius: 40, engageRate: 0.003, mobile: false,
    icon: 'AA'
  },
  MOBILE_PATROL: {
    id: 'MOBILE_PATROL', name: 'Mobile Patrol', color: '#ff6633',
    desc: 'Ground patrol unit following a circuit. Detects and engages drones in range.',
    defaultRadius: 70, killRadius: 30, engageRate: 0.002, mobile: true,
    icon: 'MP'
  },
  COUNTER_UAS_RF: {
    id: 'COUNTER_UAS_RF', name: 'Counter-UAS RF Detector', color: '#ff00ff',
    desc: 'Detects active RF comms. Jams detected drones. Does not destroy.',
    defaultRadius: 150, killRadius: 0, engageRate: 0, mobile: false,
    icon: 'RF'
  },
  DIRECTED_ENERGY: {
    id: 'DIRECTED_ENERGY', name: 'Directed Energy Weapon', color: '#ffff00',
    desc: 'Disables electronics in a directional cone. High power, slow rotation.',
    defaultRadius: 120, killRadius: 60, engageRate: 0.005, mobile: false,
    icon: 'DE'
  },
  NET_GUN: {
    id: 'NET_GUN', name: 'Net Gun Interceptor', color: '#66ffcc',
    desc: 'Launches nets to physically capture drones. Single-target, slow reload.',
    defaultRadius: 50, killRadius: 25, engageRate: 0.001, mobile: true,
    icon: 'NG'
  }
};

// Active threats (extend S.zones but with richer behavior)
// Each threat: { id, type, x, y, radius, killRadius, ang, speed, cooldown, kills }

let nextThreatId = 1;

export function spawnThreat(typeId, x, y) {
  const type = THREAT_TYPES[typeId];
  if (!type) return;

  const threat = {
    id: 'T' + nextThreatId++,
    threatType: typeId,
    type: typeId === 'COUNTER_UAS_RF' ? 'jam' : 'attacker', // for zone effect compatibility
    x, y,
    radius: type.defaultRadius,
    killRadius: type.killRadius,
    ang: Math.random() * Math.PI * 2,
    speed: type.mobile ? 12 : 0,
    cooldown: 0,
    kills: 0,
    engageRate: type.engageRate,
    color: type.color,
    icon: type.icon
  };

  S.zones.push(threat);
  addLog('THREAT: ' + type.name + ' deployed at (' + Math.round(x) + ',' + Math.round(y) + ')', 'alert');
  return threat;
}

// Update threat behaviors (called from engine.js update)
export function updateThreats(dt) {
  S.zones.forEach(z => {
    if (!z.threatType) return; // skip plain zones

    const type = THREAT_TYPES[z.threatType];
    if (!type) return;

    // Cooldown
    if (z.cooldown > 0) z.cooldown -= dt;

    // Movement (mobile threats)
    if (type.mobile) {
      z.ang += dt * 0.3;
      z.x = Math.max(60, Math.min(S.worldWidth - 60, z.x + Math.cos(z.ang) * z.speed * dt));
      z.y = Math.max(60, Math.min(S.worldHeight - 60, z.y + Math.sin(z.ang) * z.speed * dt));
    }

    // Engagement logic
    if (z.cooldown > 0) return;

    const alive = S.drones.filter(d => d.alive);

    switch (z.threatType) {
      case 'STATIC_AA':
      case 'MOBILE_PATROL': {
        // Engage closest drone in kill radius
        let closest = null, minD = z.killRadius;
        alive.forEach(d => {
          const dd = dist2(d.x, d.y, z.x, z.y);
          if (dd < minD) { minD = dd; closest = d; }
        });
        if (closest && Math.random() < z.engageRate * S.speed) {
          killDrone(closest.id, type.name + ' engagement');
          z.kills++;
          z.cooldown = 3; // 3 second cooldown
          addLog('THREAT ' + z.icon + ' engaged ' + closest.role + ' #' + closest.id, 'alert');
        }
        break;
      }

      case 'COUNTER_UAS_RF': {
        // Jam all drones in radius (already handled by zone type='jam')
        // Additionally: detect non-jammed drones transmitting
        alive.forEach(d => {
          const dd = dist2(d.x, d.y, z.x, z.y);
          if (dd < z.radius && !d.jammed) {
            // RF detection - flag drone
            d._rfDetected = true;
          }
        });
        break;
      }

      case 'DIRECTED_ENERGY': {
        // Cone-shaped engagement
        alive.forEach(d => {
          const dd = dist2(d.x, d.y, z.x, z.y);
          if (dd > z.killRadius) return;
          const angle = Math.atan2(d.y - z.y, d.x - z.x);
          const diff = Math.abs(((angle - z.ang) + Math.PI) % (Math.PI * 2) - Math.PI);
          if (diff < 0.5 && Math.random() < z.engageRate * S.speed) { // ~57 degree cone
            killDrone(d.id, 'Directed energy strike');
            z.kills++;
            z.cooldown = 5;
          }
        });
        // Slowly rotate
        z.ang += dt * 0.15;
        break;
      }

      case 'NET_GUN': {
        // Engage single closest target
        let target = null, minDist = z.killRadius;
        alive.forEach(d => {
          const dd = dist2(d.x, d.y, z.x, z.y);
          if (dd < minDist) { minDist = dd; target = d; }
        });
        if (target && Math.random() < z.engageRate * S.speed) {
          killDrone(target.id, 'Net gun capture');
          z.kills++;
          z.cooldown = 8; // long reload
          addLog('THREAT ' + z.icon + ' captured ' + target.role + ' #' + target.id, 'alert');
        }
        break;
      }
    }
  });
}

// Reset
export function resetThreats() {
  nextThreatId = 1;
  // Remove threat-type zones
  S.zones = S.zones.filter(z => !z.threatType);
}

// Get threat counts
export function getThreatCounts() {
  const counts = {};
  S.zones.filter(z => z.threatType).forEach(z => {
    counts[z.threatType] = (counts[z.threatType] || 0) + 1;
  });
  return counts;
}
