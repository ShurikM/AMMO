# AMMO — Aerial Mesh Mission Orchestration
## Claude Code Handover Document
**Date:** 2026-03-15  
**Current version:** v0.3 (single HTML file)  
**Goal:** Evolve into a multi-file tactical planning + strategic simulation platform

---

## 1. What AMMO Is

AMMO is a simulation platform for autonomous drone swarms operating in GPS-denied, RF-contested environments. It models the AMMO protocol — a hierarchical mesh orchestration protocol where:

- **GL (Group Leader)** — top of hierarchy, AI-enabled, commands all squads
- **SL / ASL (Squad Leader / AI Squad Leader)** — commands 3-8 workers per squad
- **SH (Shadow)** — hot-standby that pre-receives mission state, wins elections with +40 score
- **W (Worker)** — executes tasks, reports upward
- **RL (Relay)** — pure RF mesh extender, no mission payload

The protocol handles: leader election on failure (sub-second), RF jamming, GPS denial, moving attacker threats, battery depletion, and AI-driven decision-making at leader nodes.

The product vision is a **Strategic Simulation Platform** — run thousands of scenarios, output survivability metrics, answer questions like: *What hardware mix survives 60% node loss? At what squad density does the mesh stay connected through a full RF jamming corridor?*

---

## 2. Current File

**File:** `AMMO_v3.html` — single self-contained HTML/CSS/JS file, ~1300 lines.

**Do not edit in-place.** Refactor into a proper project structure (see Section 5).

---

## 3. Current Architecture

### 3.1 Key Global State

```javascript
// View state (zoom/pan)
let V = { zoom, px, py, dragging, dx, dy, dpx, dpy }

// Simulation state
let S = {
  drones: Drone[],
  zones:  Zone[],        // { type:'jam'|'gps'|'attacker', x, y, radius, ang? }
  packets: Packet[],     // animated data packets on mesh links
  elections: Election[], // active leader elections
  links: Link[],         // { a: Drone, b: Drone, q: 0-1, isLeader: bool }
  route: WP[],           // { x, y } waypoints
  tick, missionTime, paused, speed,
  placeMode, selectedId,
  electionCount, lostCount, lastFrame,
  cfg: {
    squads, workers, relays,
    aiGL, aiSL, shadowOn,
    rfRange, noise, battDrain,
    hwGL, hwSL, hwWorker, hwRelay   // keys into DRONE_TYPES
  }
}
```

### 3.2 Drone Object Shape

```javascript
{
  id, role,             // role: 'GL'|'SL'|'ASL'|'W'|'SH'|'RL'
  hwType, hw,           // hwType: key into DRONE_TYPES, hw: full spec object
  x, y,                 // current world position (canvas pixels)
  px, py,               // patrol target position
  originX, originY,     // spawn position (squad center)
  health,               // 0-100
  battery,              // 0-100 (drains in real sim time)
  aiEnabled,            // bool — set from hw.aiLevel >= 3
  alive,                // bool
  squadId,              // integer, 0=unassigned (GL/RL)
  leaderId,             // id of direct leader
  shadowOf,             // id of drone this is shadowing (SH only)
  color,                // hex
  taskProgress,         // 0-100 cycling
  electing,             // bool — during election
  electPulse,           // animation counter
  electFlash,           // seconds remaining on flash animation
  patrolTimer,          // countdown to next patrol target pick
  patrolRadius,         // max wander distance from origin
  routeTarget,          // index into S.route (null = free patrol)
  jammed,               // bool — set each frame from zone check
  gpsLost,              // bool — set each frame from zone check
}
```

### 3.3 Hardware Types Catalog

10 hardware types defined in `DRONE_TYPES` constant. Each has:

```javascript
{
  name, cls,             // display strings
  cpu, gpu, ram, comms,  // spec strings
  carryKg, airtimeMin, maxAltM, speedKmh, weightKg,
  rfRangeMult,           // multiplies global rfRange (0.75 – 2.2)
  aiLevel,               // 0=none 1=rules 2=edge-ml 3=full-ai 4=cloud-ai
  battCapMult,           // multiplies base battery capacity
  drainMult,             // multiplies drain rate (0.2 – 1.8)
  missionTypes: string[],
  aiDesc: string,
  color: hex
}
```

Types: `COMMAND_NODE`, `JETSON_AGX`, `JETSON_NX`, `JETSON_NANO`, `RPI5`, `RPI_ZERO`, `STM32_ADV`, `STM32_BASIC`, `ESP32_MESH`

### 3.4 Key Functions

| Function | What it does |
|---|---|
| `initSim()` | Spawns all drones from cfg, places them geometrically |
| `update(dt)` | Master update: drones, links, packets, elections, zones |
| `updateDrones(dt)` | Patrol movement, battery drain, zone effects |
| `updateLinks()` | Rebuilds mesh link list every frame |
| `triggerElection(dead)` | Scores candidates, creates election object |
| `resolveElection(e)` | Promotes winner, assigns new shadow |
| `killDrone(id, reason)` | Marks dead, triggers election if leader |
| `mkDrone(x,y,role,leaderId,squadId,hwTypeKey)` | Factory — reads hw spec |
| `drawDrone(d)` | Draws shape+battery ring+labels on canvas |
| `spawnIntel()` | Creates upward data packet animations |
| `addLog(msg, type)` | Appends to EVENTS tab |
| `addAILog(role, trigger, reason)` | Appends to AI LOG tab |

### 3.5 Battery Drain Formula

```javascript
drainPerSec = cfg.battDrain / 60.0      // % per sim-second
aiMult      = d.aiEnabled ? 1.4 : 1.0
hwMult      = d.hw.drainMult            // hardware-specific
d.battery  -= drainPerSec * aiMult * hwMult * dt
```

At `battDrain=5`, `drainMult=1.0`, `aiMult=1.0`: a drone depletes in ~20 sim-minutes at 1x speed.

### 3.6 RF Link Quality Formula

```javascript
maxRange = cfg.rfRange * min(hw_a.rfRangeMult * RRANGE[role_a],
                              hw_b.rfRangeMult * RRANGE[role_b])
quality  = 1 - (distance / maxRange) - noise*0.5
quality -= jammingPenalty  // per jam zone
// link dropped if quality < 0.04
```

---

## 4. What Needs to Be Built

### 4.1 PRIORITY 1 — Metrics Engine (makes it a real product)

The simulation currently tracks no quantitative metrics. Add a `METRICS` object that records throughout the run:

```javascript
const METRICS = {
  // Time-series (push every 5 sim-seconds)
  timeline: [
    { t, aliveCount, leaderCount, linkCount, avgBattery, meshPartitioned }
  ],

  // Election events
  elections: [
    { t, squadId, deadRole, winnerRole, wasShadow, recoveryMs, candidateCount }
  ],
  // recoveryMs = sim-time from leader death to first new TASK_ASSIGN

  // Drone deaths
  deaths: [
    { t, id, role, hwType, cause, batteryAtDeath, missionTimeAlive }
  ],

  // Mesh partition events
  partitions: [
    { tStart, tEnd, partitionCount, dronesIsolated }
  ],
  // A partition = any alive drone with zero links

  // Battery events
  batteryDeaths: 0,
  attackerDeaths: 0,
  manualDeaths: 0,

  // Summary (computed at end or on demand)
  summary: {
    totalSimTime,
    avgElectionRecoveryMs,
    p99ElectionRecoveryMs,
    meshUptimePct,            // % of sim time with zero partitions
    fleetSurvivalPct,         // alive/total at end
    avgBatteryAtEnd,
    missionCompletionPct,     // % of route waypoints reached by workers
    totalElections,
    shadowWinRate,            // % of elections won by shadow node
  }
}
```

**Where to call:**
- `METRICS.timeline`: push every 5 sim-seconds in `update()`
- `METRICS.elections`: record in `triggerElection()` and enrich in `resolveElection()`
- `METRICS.deaths`: record in `killDrone()`
- Partition detection: in `updateLinks()`, check for isolated alive drones

**Mesh partition detection:**
```javascript
// After updateLinks(), find isolated nodes:
const isolated = S.drones.filter(d => 
  d.alive && !S.links.some(l => l.a.id===d.id || l.b.id===d.id)
)
```

---

### 4.2 PRIORITY 2 — Metrics Dashboard Tab

Add a 4th tab: **METRICS** to the right panel. Show live-updating charts and key numbers.

**Live KPI row** (top of metrics tab):
```
MTTR        MESH UP     SURVIVAL    SHADOW WIN
 0.8s         94%          87%         67%
```

**Charts to implement using plain Canvas 2D** (no library dependency):

1. **Fleet Size over Time** — line chart, alive drone count vs sim-time
2. **Election Recovery Times** — horizontal bar chart, each election = one bar, colored by: shadow win (green) vs non-shadow (orange)
3. **Battery Distribution** — live histogram of current battery levels across fleet
4. **Mesh Link Quality** — line chart, average link quality over time

For each chart:
- Draw axes with labels
- Update every 2 seconds (not every frame — expensive)
- Keep it simple: no external libs, just `ctx.fillRect` and `ctx.lineTo`

**Export button:** "EXPORT JSON" — downloads `METRICS` object as `ammo_run_TIMESTAMP.json`

---

### 4.3 PRIORITY 3 — Real Map Integration (Leaflet.js)

Replace the current canvas grid with a real map. **Use Leaflet.js from CDN** — it's free, no API key for base tiles.

**Architecture change:** The simulation canvas sits *on top of* a Leaflet map as an absolutely-positioned overlay. Drone positions are stored in both world coordinates AND lat/lng.

```html
<div id="map-container" style="position:relative; flex:1">
  <div id="leaflet-map" style="position:absolute; inset:0; z-index:0"></div>
  <canvas id="sim-canvas" style="position:absolute; inset:0; z-index:1; pointer-events:none"></canvas>
  <!-- canvas pointer-events:none so Leaflet handles map interaction -->
  <!-- separate transparent overlay canvas for clicks -->
  <canvas id="click-canvas" style="position:absolute; inset:0; z-index:2"></canvas>
</div>
```

**Coordinate bridge:**
```javascript
// Convert Leaflet lat/lng to canvas pixel
function latLngToCanvas(lat, lng) {
  const point = map.latLngToContainerPoint([lat, lng])
  return { x: point.x, y: point.y }
}

// Convert canvas pixel to lat/lng (for placing zones)
function canvasToLatLng(x, y) {
  return map.containerPointToLatLng([x, y])
}

// Drone stores both:
drone.lat = ...
drone.lng = ...
drone.x   = latLngToCanvas(drone.lat, drone.lng).x  // recomputed each frame
drone.y   = latLngToCanvas(drone.lat, drone.lng).y
```

**Map setup:**
```javascript
const map = L.map('leaflet-map', {
  center: [31.7683, 35.2137],  // Jerusalem as default (changeable)
  zoom: 14,
  zoomControl: false  // use our own zoom buttons
})

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: 'OSM',
  maxZoom: 18
}).addTo(map)
```

**On map move/zoom:** call a `syncDronePositions()` function that recalculates `drone.x/y` for all drones from their `lat/lng`.

**Start positions:** Instead of canvas center, spawn drones at configurable lat/lng center. Add a "Set AO Center" button — click map to set area of operations center.

**Scale:** Map scale for drone spacing. At zoom=14, 1 canvas pixel ≈ 10m. Workers should spread ~200m from SL, SL ~500m from GL. Store all distances in **meters**, convert to pixels via `map.getZoom()`.

---

### 4.4 PRIORITY 4 — Batch Simulation Mode

This is what makes it a research platform. A headless runner that executes N simulations and outputs statistics.

**UI:** New modal "BATCH RUN"

```
┌─────────────────────────────────────────┐
│  BATCH SIMULATION                        │
│                                          │
│  Scenarios: [100]  Duration: [10] min    │
│                                          │
│  Sweep parameter:                        │
│  ○ None  ● Workers/Squad  ○ HW Type     │
│  ○ RF Noise  ○ Batt Drain  ○ Squad Count │
│                                          │
│  Range: [2] to [8]  Steps: [4]           │
│                                          │
│  [RUN BATCH]          Progress: 0/100    │
└─────────────────────────────────────────┘
```

**Headless simulation:** Extract simulation logic into a pure function with no canvas/DOM dependency:

```javascript
function runHeadlessSim(cfg, durationSecs) {
  // Initialize state (no canvas, no drawing)
  const state = headlessInit(cfg)
  const metrics = initMetrics()
  const dt = 0.1  // 100ms steps

  for (let t = 0; t < durationSecs; t += dt) {
    headlessUpdate(state, metrics, dt)
  }

  return computeSummary(metrics, state)
}
```

**Output per run:**
```javascript
{
  cfg: { ...scenario config },
  summary: { avgElectionRecoveryMs, meshUptimePct, fleetSurvivalPct, ... }
}
```

**Batch output:** Array of run results. Display as a comparison table. Allow CSV export.

**Implementation note:** Run batches in chunks using `setTimeout(0)` between chunks to keep the UI responsive. Show a progress bar.

---

### 4.5 PRIORITY 5 — Scenario Save/Load

Add a scenario system so users can save named configurations and share them.

```javascript
// Scenario object
{
  name: "Alpha Strike - High Noise",
  description: "...",
  version: "0.3",
  cfg: { ...S.cfg },
  zones: [ ...S.zones ],
  route: [ ...S.route ],
  savedAt: ISO timestamp
}
```

- **Save:** Serialize to JSON, store in `localStorage` with key `ammo_scenario_${name}`
- **Load:** List saved scenarios, click to restore
- **Export/Import:** Download as `.ammo.json`, import from file
- Add a "Scenario Library" panel or modal

---

## 5. Recommended Project Structure

Refactor from single HTML to:

```
ammo/
├── index.html              # Shell, loads everything
├── src/
│   ├── main.js             # Boot, event wiring
│   ├── sim/
│   │   ├── engine.js       # update(), headlessUpdate(), all simulation logic
│   │   ├── drones.js       # mkDrone(), DRONE_TYPES, ROLES constants
│   │   ├── election.js     # triggerElection(), resolveElection()
│   │   ├── metrics.js      # METRICS object, computeSummary(), export
│   │   └── batch.js        # runHeadlessSim(), runBatch()
│   ├── render/
│   │   ├── canvas.js       # draw(), drawDrone(), drawMap(), drawLinks()
│   │   ├── map.js          # Leaflet integration, coordinate bridge
│   │   └── charts.js       # Metrics charts (canvas 2D)
│   └── ui/
│       ├── panels.js       # Left panel, right panel, tabs
│       ├── modals.js       # Spec modal, batch modal, scenario modal
│       ├── tooltip.js      # Global tooltip system
│       └── log.js          # addLog(), addAILog()
├── styles/
│   └── main.css            # All CSS extracted from HTML
├── data/
│   └── scenarios/          # Bundled example scenarios as JSON
└── AMMO_HANDOVER.md        # This document
```

**Build:** Use Vite for dev server + bundling. No framework needed — vanilla JS is fine given the canvas-heavy nature.

```bash
npm create vite@latest ammo -- --template vanilla
```

---

## 6. UI/UX Improvements Needed

### 6.1 Left Panel
- Hardware dropdowns currently reset the sim — add a "APPLY" button so users can change config without auto-reset
- Add a "Custom Drone Type" form — let user define their own hardware spec inline
- Collapse/expand panel sections

### 6.2 Canvas
- Show drone **speed vectors** as small arrows when moving
- Show **RF range rings** on hover/select (faint circle showing max range of selected drone)
- Show **mission route** with distance annotations between waypoints
- Show **altitude** as a Z-indicator (small vertical bar next to drone, height = maxAltM proportion)
- Minimap in corner when zoomed in

### 6.3 Right Panel — DRONE tab
- Currently rebuilds HTML on every frame when drone is selected — **throttle to 2fps**
- Add a "FOLLOW" button — keep selected drone centered in view
- Show drone's **mission history** (list of tasks completed)

### 6.4 Right Panel — METRICS tab (new)
- Live KPIs at top
- 4 mini-charts as described in 4.2
- Export button

### 6.5 New top-bar elements
- "SCENARIO" dropdown — quick-switch between saved scenarios
- "BATCH RUN" button — opens batch modal
- "RECORD" button — save current run to METRICS history

---

## 7. Simulation Improvements

### 7.1 Mesh Partition Detection (missing, important)
```javascript
// In updateLinks(), after rebuilding S.links:
function detectPartitions() {
  const alive = S.drones.filter(d => d.alive)
  const connected = new Set()
  
  // BFS from GL or first alive node
  const start = alive.find(d => d.role === ROLES.GL) || alive[0]
  if (!start) return
  
  const queue = [start.id]
  connected.add(start.id)
  while (queue.length) {
    const id = queue.shift()
    S.links.forEach(l => {
      const neighbor = l.a.id === id ? l.b.id : l.b.id === id ? l.a.id : null
      if (neighbor && !connected.has(neighbor)) {
        connected.add(neighbor)
        queue.push(neighbor)
      }
    })
  }
  
  const isolated = alive.filter(d => !connected.has(d.id))
  // Record partition event in METRICS if any isolated
}
```

### 7.2 Election Recovery Time Measurement
```javascript
// In triggerElection():
dead._electionStartTime = S.missionTime

// In resolveElection():
const recoveryMs = (S.missionTime - dead._electionStartTime) * 1000
METRICS.elections.push({ ..., recoveryMs })
```

### 7.3 Mission Completion Tracking
- Worker reaches a waypoint → increment `METRICS.waypointsReached`
- `missionCompletionPct = waypointsReached / (S.route.length * workerCount) * 100`

### 7.4 Make `battDrain` More Realistic
- Currently linear. Add: jammed drones drain 2x (already partly done), drones in GPS-denied areas drain 1.3x (more sensor polling), high-altitude drones drain 1.1x more.

### 7.5 Attacker Drone Intelligence
- Currently random position. Add: attacker targets highest-value drone (GL first, then SL) within range.
- Add multiple attacker types: `JAMMER` (RF only), `KINETIC` (destroys), `SPOOFER` (GPS spoof — inserts false positions)

---

## 8. Known Bugs / Tech Debt

1. **`drainPerSec` vs `baseDrainPerSec`** — was a naming mismatch bug, now fixed in v3. Watch for regression.
2. **Canvas not resizing correctly in some viewport sizes** — `resizeCanvas()` triggers `initSim()` on every resize; add a debounce (already there via `clearTimeout`).
3. **Unicode chars in JS comments** — box-drawing chars (`─`, `│`) caused silent parse failures in some browsers. In v3 these were replaced with `--`. If adding new comments, **use only ASCII**.
4. **`updateDroneInfoPanel()` rebuilds full DOM every call** — add a dirty flag or throttle to every 500ms.
5. **Election scoring uses `role === ROLES.W` for shadow candidates** — after a first election, some SH nodes get re-designated; the filter may miss nodes if their role wasn't reset. Audit `resolveElection()`.
6. **No seed for randomness** — each sim run is non-deterministic. For batch runs, implement a seeded PRNG (e.g. mulberry32) so scenarios are reproducible.

---

## 9. Product Milestones

### MVP (2-3 months) — Strategic Simulation Platform
- [ ] Refactor to multi-file project (Vite)
- [ ] Metrics engine: METRICS object, all events tracked
- [ ] Metrics tab: 4 charts + KPI row + JSON export
- [ ] Mesh partition detection
- [ ] Batch run mode: headless engine, parameter sweep, CSV export
- [ ] Scenario save/load (localStorage + file export)
- [ ] Basic Leaflet map integration

### v1.0 (5-6 months) — Tactical Planning Platform
- [ ] Full Leaflet map with OSM tiles
- [ ] Terrain-aware RF propagation (use elevation API)
- [ ] Scenario sharing (URL-encoded or S3 hosted JSON)
- [ ] PDF report generation from a run
- [ ] Custom drone type editor
- [ ] Multi-run comparison view

### v2.0 — Research Platform
- [ ] REST API for headless batch runs
- [ ] Jupyter notebook integration (Python client)
- [ ] Statistical output: confidence intervals, survivability curves
- [ ] Protocol variant comparison (AMMO vs custom protocol definitions)

---

## 10. Quick Start for Claude Code

```bash
# 1. Start with the current working file
cp AMMO_v3.html ammo_working.html

# 2. Open it in browser to verify it works before changing anything
# Expected: sim loads, drones move, battery drains visibly at drain=5+

# 3. First task: extract JS into a module and verify nothing breaks
# 4. Second task: add METRICS object and wire into existing functions
# 5. Third task: add METRICS tab to right panel with live KPI numbers
# 6. Only then: Leaflet map integration (biggest architectural change)
```

**One rule:** After every change, run:
```javascript
// In browser console — verify these work:
S.drones.length        // should be > 0
S.drones[0].hw.name   // should be 'Command Node'
S.cfg.hwGL             // should be 'COMMAND_NODE'
METRICS                // should exist after adding metrics engine
```

---

## 11. Design Language

Keep the existing visual style throughout:
- **Font:** `Share Tech Mono` (monospace data), `Rajdhani` (UI labels)
- **Colors:** defined in CSS variables — `--gl:#00d4ff`, `--sl:#00ffcc`, `--asl:#bf7fff`, `--w:#39ff88`, `--sh:#ff9e00`, `--rl:#ffe033`, `--alert:#ff3b3b`, `--warn:#ff9000`, `--ok:#00e87a`
- **Background:** `#080c12` (near-black blue)
- **Panels:** `#0d1420`
- **Borders:** `#1a2d45`
- All new UI elements must follow the same dark military aesthetic
- No rounded corners on panels (sharp edges = military)
- Subtle glow effects on active/selected elements using `text-shadow` or `box-shadow`

---

*End of handover. The current file `AMMO_v3.html` is the source of truth. All specs above describe additions, not replacements of existing behavior.*
