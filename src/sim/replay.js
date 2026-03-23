import { S } from './engine.js';

const MAX_SNAPSHOTS = 3600; // ~60 min at 1 snapshot/sec
const snapshots = [];
let recording = true;
let playbackIndex = -1;
let playbackActive = false;

// Deep clone the essential sim state
function takeSnapshot() {
  return {
    t: S.missionTime,
    tick: S.tick,
    drones: S.drones.map(d => ({
      id:d.id, role:d.role, hwType:d.hwType, x:d.x, y:d.y, px:d.px, py:d.py,
      health:d.health, battery:d.battery, aiEnabled:d.aiEnabled,
      alive:d.alive, squadId:d.squadId, leaderId:d.leaderId, shadowOf:d.shadowOf,
      color:d.color, taskProgress:d.taskProgress, electing:d.electing,
      electPulse:d.electPulse, electFlash:d.electFlash, jammed:d.jammed,
      gpsLost:d.gpsLost, routeTarget:d.routeTarget, originX:d.originX, originY:d.originY,
      patrolTimer:d.patrolTimer, patrolRadius:d.patrolRadius,
      _protoState: d._protoState || null
    })),
    zones: S.zones.map(z => ({ ...z })),
    route: S.route.map(wp => ({ ...wp })),
    links: S.links.length,
    electionCount: S.electionCount,
    lostCount: S.lostCount
  };
}

// Record a snapshot (called every ~1 sim-second from engine.js update)
export function recordSnapshot() {
  if (!recording || playbackActive) return;
  snapshots.push(takeSnapshot());
  if (snapshots.length > MAX_SNAPSHOTS) snapshots.shift();
}

// Restore sim state from a snapshot
function restoreSnapshot(snap) {
  S.missionTime = snap.t;
  S.tick = snap.tick;
  S.electionCount = snap.electionCount;
  S.lostCount = snap.lostCount;
  S.zones = snap.zones.map(z => ({ ...z }));
  S.route = snap.route.map(wp => ({ ...wp }));

  // Restore drone states — need to preserve hw reference
  snap.drones.forEach(sd => {
    const d = S.drones.find(dd => dd.id === sd.id);
    if (d) {
      Object.assign(d, {
        role:sd.role, x:sd.x, y:sd.y, px:sd.px, py:sd.py,
        health:sd.health, battery:sd.battery, aiEnabled:sd.aiEnabled,
        alive:sd.alive, squadId:sd.squadId, leaderId:sd.leaderId,
        shadowOf:sd.shadowOf, color:sd.color, taskProgress:sd.taskProgress,
        electing:sd.electing, electPulse:sd.electPulse, electFlash:sd.electFlash,
        jammed:sd.jammed, gpsLost:sd.gpsLost, routeTarget:sd.routeTarget,
        _protoState: sd._protoState
      });
    }
  });
}

// Get total number of snapshots
export function getSnapshotCount() { return snapshots.length; }

// Get current playback position
export function getPlaybackIndex() { return playbackIndex; }

// Is replay mode active?
export function isPlaybackActive() { return playbackActive; }

// Start playback mode
export function startPlayback() {
  if (snapshots.length === 0) return false;
  playbackActive = true;
  recording = false;
  S.paused = true;
  playbackIndex = snapshots.length - 1;
  return true;
}

// Stop playback, resume live sim
export function stopPlayback() {
  playbackActive = false;
  recording = true;
  playbackIndex = -1;
}

// Seek to a specific snapshot index
export function seekTo(index) {
  if (!playbackActive || index < 0 || index >= snapshots.length) return;
  playbackIndex = index;
  restoreSnapshot(snapshots[index]);
}

// Step forward/backward
export function stepForward() {
  if (playbackIndex < snapshots.length - 1) seekTo(playbackIndex + 1);
}

export function stepBackward() {
  if (playbackIndex > 0) seekTo(playbackIndex - 1);
}

// Get snapshot time at index
export function getSnapshotTime(index) {
  if (index < 0 || index >= snapshots.length) return 0;
  return snapshots[index].t;
}

// Reset
export function resetReplay() {
  snapshots.length = 0;
  playbackIndex = -1;
  playbackActive = false;
  recording = true;
}
