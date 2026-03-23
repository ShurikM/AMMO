# AMMO Digital Twin Simulator — Feature Roadmap

**Purpose:** Drone swarm digital twin for (1) operator training and (2) SW verification of the AMMO mesh orchestration protocol.

**Current state:** v0.4 — Vite project with core simulation (hierarchy, elections, battery, RF links, zones), metrics engine, batch mode, scenario save/load, Leaflet map toggle.

---

## TIER 1 — Simulation Foundations (DONE)

| ID | Feature | Status |
|----|---------|--------|
| T1.1 | Fleet hierarchy (GL/SL/ASL/W/SH/RL) | Done |
| T1.2 | Leader election on failure | Done |
| T1.3 | Battery drain model (linear, HW-specific, AI multiplier) | Done |
| T1.4 | RF link quality model (distance, noise, jam penalty) | Done |
| T1.5 | Jam / GPS denial / attacker zones | Done |
| T1.6 | 10 hardware types with full specs | Done |
| T1.7 | Metrics engine (timeline, elections, deaths, partitions) | Done |
| T1.8 | Batch simulation with seeded PRNG | Done |
| T1.9 | Scenario save/load/export/import | Done |
| T1.10 | Leaflet map toggle | Done |
| T1.11 | Metrics dashboard (KPIs + 4 charts) | Done |

---

## TIER 2 — Operator Training Features

### P1: Deterministic Replay + Fault Injection
**Why:** Enables reproducible training scenarios and systematic "what-if" exploration.

| Task | Description | Files |
|------|-------------|-------|
| P1.1 | **State recorder** — capture full sim state (drones, zones, links, elections) every N ticks into a replay buffer | `src/sim/replay.js` (new) |
| P1.2 | **Replay playback** — pause live sim, step through recorded states forward/backward with timeline scrubber | `src/sim/replay.js`, `src/ui/panels.js` |
| P1.3 | **Fault injection scheduler** — define fault scripts: `[{t:300, action:'kill', target:'GL'}, {t:180, action:'jam', x:400, y:300, radius:150}]` | `src/sim/faults.js` (new) |
| P1.4 | **Fault injection UI** — timeline editor to schedule faults visually, load/save fault scripts as JSON | `src/ui/modals.js`, `index.html` |
| P1.5 | **Fault execution engine** — check fault schedule each tick, execute actions at scheduled times | `src/sim/faults.js`, `src/sim/engine.js` |

### P2: Protocol State Machine Visualization
**Why:** Operators and engineers see exactly what each drone's protocol state is and why transitions happen.

| Task | Description | Files |
|------|-------------|-------|
| P2.1 | **Define protocol states** — IDLE, PATROL, TASKED, REPORTING, ELECTING, SHADOWING, RTB, LOST_LINK, JAMMED, LOW_BATT, DEAD | `src/sim/protocol.js` (new) |
| P2.2 | **State assignment logic** — derive protocol state from drone properties each frame (alive, electing, jammed, gpsLost, battery, role, taskProgress) | `src/sim/protocol.js` |
| P2.3 | **State transition logging** — record state changes with timestamps and reasons | `src/sim/protocol.js`, `src/sim/metrics.js` |
| P2.4 | **State display in drone info panel** — show current protocol state with color badge and transition history | `src/ui/panels.js` |
| P2.5 | **State overlay on canvas** — optional colored ring or label showing protocol state on each drone | `src/render/canvas.js` |
| P2.6 | **State machine diagram** — static reference diagram showing valid transitions, highlight current state for selected drone | `src/render/charts.js` or new panel |

### P3: Assertion Engine
**Why:** Automated pass/fail verification of protocol behavior without human eyeballing.

| Task | Description | Files |
|------|-------------|-------|
| P3.1 | **Assertion definition format** — `{name, condition, severity, checkInterval}`. Conditions: JS expressions evaluated against S | `src/sim/assertions.js` (new) |
| P3.2 | **Built-in assertions** — GL elected within 2s, no drone <5% battery without RTB, mesh reconnects within 5s after jam clears, shadow promotes within 1.5s | `src/sim/assertions.js` |
| P3.3 | **Assertion checker** — evaluate assertions at configured intervals during simulation | `src/sim/assertions.js`, `src/sim/engine.js` |
| P3.4 | **Assertion results panel** — red/green/yellow status board in a new tab or overlay | `src/ui/panels.js`, `index.html` |
| P3.5 | **Assertion results in batch mode** — include pass/fail counts in batch output | `src/sim/batch.js`, `src/sim/assertions.js` |
| P3.6 | **Custom assertion editor** — UI to define/edit assertions without code | `src/ui/modals.js` |

### P4: Mission Phases
**Why:** Transforms sim from "watch drones fly randomly" into structured mission execution.

| Task | Description | Files |
|------|-------------|-------|
| P4.1 | **Phase model** — define phases: STAGING, INGRESS, LOITER, EXECUTE, EGRESS, RTB. Each phase has: entry conditions, exit conditions, allowed actions, duration limit | `src/sim/mission.js` (new) |
| P4.2 | **Phase transition engine** — check exit conditions each tick, transition to next phase, log transitions | `src/sim/mission.js`, `src/sim/engine.js` |
| P4.3 | **Phase-aware drone behavior** — drones act differently per phase: STAGING=hold position, INGRESS=follow route, LOITER=orbit waypoint, EXECUTE=spread and survey, EGRESS=reverse route, RTB=return to origin | `src/sim/drones.js` |
| P4.4 | **Mission planning UI** — phase timeline bar at top of canvas showing current phase, click to define phase waypoints and objectives | `src/ui/panels.js`, `index.html`, `styles/main.css` |
| P4.5 | **Phase-dependent objectives** — each phase can have objectives (reach waypoint, surveil area, maintain coverage, hold position). Track completion % | `src/sim/mission.js`, `src/sim/metrics.js` |
| P4.6 | **Mission templates** — pre-built mission types: ISR sweep, perimeter patrol, convoy escort, area denial. Load from `data/missions/` | `data/missions/` (new), `src/sim/mission.js` |

### P5: Comms Degradation Ladder
**Why:** The #1 skill operators must learn — recognizing degradation and switching to contingency plans.

| Task | Description | Files |
|------|-------------|-------|
| P5.1 | **Comms status model** — per-drone comms level: FULL_MESH (all links healthy), DEGRADED (some links lost), RELAY_ONLY (connected only via relay chain), ISOLATED (no links, but alive), LOST_CONTACT (no comms for >N seconds) | `src/sim/comms.js` (new) |
| P5.2 | **Latency simulation** — add message delay proportional to hop count. Direct link=50ms, 1 relay=150ms, 2 relays=300ms. Show latency in packet animations | `src/sim/comms.js`, `src/sim/engine.js` |
| P5.3 | **Degradation indicators** — per-drone comms quality icon/bar in canvas overlay. Fleet-wide comms health indicator in topbar | `src/render/canvas.js`, `index.html` |
| P5.4 | **Lost-link protocol** — when drone loses all links for >T seconds: configurable behavior (hover, RTB, continue last mission, spiral search for mesh) | `src/sim/comms.js`, `src/sim/drones.js` |
| P5.5 | **Comms degradation scenarios** — pre-built: "gradual jam expansion", "relay chain failure", "GL comms loss", "squad isolation" | `data/scenarios/` |
| P5.6 | **Operator alerts** — visual + log alerts when comms degrade past thresholds. "SQUAD 2 RELAY-ONLY", "DRONE #7 LOST CONTACT 15s" | `src/ui/log.js`, `src/render/canvas.js` |

### P6: Threat Model Library
**Why:** Operators must plan around realistic threats, not abstract circles.

| Task | Description | Files |
|------|-------------|-------|
| P6.1 | **Threat type definitions** — static AA (fixed position, kill radius), mobile patrol (follows path, detection radius), counter-UAS RF detector (detects active comms), directed energy (disables electronics in cone), net gun (captures single drone) | `src/sim/threats.js` (new) |
| P6.2 | **Threat behavior engine** — each threat type has update logic: mobile patrols follow routes, detectors scan, AA engages closest drone, counter-UAS jams detected drones | `src/sim/threats.js` |
| P6.3 | **Threat rendering** — distinct icons/shapes per threat type, detection/kill radius visualization, engagement lines | `src/render/canvas.js` |
| P6.4 | **Threat placement UI** — dropdown to select threat type, click canvas to place | `src/ui/panels.js`, `index.html` |
| P6.5 | **Threat library panel** — browse available threat types with specs (range, lethality, mobility) | `src/ui/modals.js` |

---

## TIER 3 — SW Verification Features

### P7: Message Inspector
| Task | Description |
|------|-------------|
| P7.1 | Message bus — centralized message routing with logging |
| P7.2 | Message types — HEARTBEAT, TASK_ASSIGN, INTEL_REPORT, SYNC_STATE, ELECTION_VOTE, STATUS_UPDATE |
| P7.3 | Message inspector panel — filterable log showing sender, receiver, type, payload, latency, status |
| P7.4 | Message drop simulation — configurable drop rate per link quality tier |

### P8: Protocol Timing Verification
| Task | Description |
|------|-------------|
| P8.1 | Timing spec definition — expected durations for each protocol operation |
| P8.2 | Timing measurement — actual vs spec comparison per operation |
| P8.3 | Timing violation alerts — flag when operation exceeds spec |
| P8.4 | Timing report — statistical summary (mean, p50, p95, p99, max) per operation type |

### P9: Network Partition Testing
| Task | Description |
|------|-------------|
| P9.1 | Topology presets — chain, ring, star, full mesh, split-brain |
| P9.2 | Partition injection — force specific graph cuts at scheduled times |
| P9.3 | Reconvergence measurement — time from partition heal to full mesh restoration |
| P9.4 | Partition visualization — color-coded connected components on canvas |

### P10: Scalability Testing
| Task | Description |
|------|-------------|
| P10.1 | Large fleet support — optimize for 100-1000 drones (spatial indexing for link calc) |
| P10.2 | Protocol overhead metrics — messages/sec, bytes/sec vs fleet size |
| P10.3 | Election cascade detection — flag when elections trigger further elections |
| P10.4 | Scalability batch mode — sweep fleet size, measure protocol metrics |

---

## TIER 4 — Operational Realism

### P11: Weather Model
| Task | Description |
|------|-------------|
| P11.1 | Wind model — direction, speed, gusts. Affects drone movement and battery |
| P11.2 | Precipitation — reduces sensor effectiveness and battery capacity |
| P11.3 | Temperature — affects battery chemistry (capacity reduction at extremes) |
| P11.4 | Weather presets — clear, overcast, rain, storm, extreme cold |

### P12: Terrain & RF Propagation
| Task | Description |
|------|-------------|
| P12.1 | Elevation grid — import GeoTIFF or generate procedural terrain |
| P12.2 | Line-of-sight calculation — RF blocked by terrain between drones |
| P12.3 | RF propagation model — ITU-R path loss with terrain attenuation |
| P12.4 | Terrain visualization — height-colored overlay or contour lines |

### P13: Realistic Battery Model
| Task | Description |
|------|-------------|
| P13.1 | LiPo discharge curve — non-linear voltage vs capacity |
| P13.2 | Load-dependent drain — hover vs forward flight vs sensor active |
| P13.3 | Temperature-dependent capacity — reduced capacity in cold |
| P13.4 | RTB calculation — estimate remaining flight time, trigger RTB with margin |

### P14: Logistics & Sustainment
| Task | Description |
|------|-------------|
| P14.1 | Launch/recovery pads — defined locations, capacity limits |
| P14.2 | Recharge cycle — drone lands, charges for N minutes, relaunches |
| P14.3 | Drone rotation — swap depleted drones for fresh ones |
| P14.4 | Sustainment planning — show fleet availability over time |

### P15: After-Action Review
| Task | Description |
|------|-------------|
| P15.1 | Full state recording — every tick saved to buffer |
| P15.2 | Timeline scrubber — drag to any point, see full sim state |
| P15.3 | Annotation system — operators mark key events during replay |
| P15.4 | Branch from replay — pause at any point, change parameters, re-run from there |
| P15.5 | AAR report generation — export annotated timeline as HTML/PDF |

---

## Implementation Priority

**Phase A (Current Sprint):**
1. P1 — Deterministic Replay + Fault Injection
2. P2 — Protocol State Machine Visualization
3. P3 — Assertion Engine
4. P4 — Mission Phases
5. P5 — Comms Degradation Ladder
6. P6 — Threat Model Library

**Phase B:** P7, P8, P9, P10 (SW Verification depth)
**Phase C:** P11-P15 (Operational realism)

---

## Architecture Notes

- All new sim modules (`protocol.js`, `assertions.js`, `mission.js`, `comms.js`, `threats.js`, `replay.js`, `faults.js`) import `S` from `engine.js` and follow the same pattern as existing modules
- New modules hook into `update(dt)` in engine.js via explicit function calls (not events)
- State machine states are derived each frame from drone properties — no separate state storage needed initially
- Assertions evaluate against `S` and `METRICS` — they are pure read-only observers
- Mission phases own the `S.route` and drone behavior modifiers — they wrap existing patrol logic
- Comms model extends the existing `updateLinks()` output with latency/hop data
- Threat types extend the existing zone system with type-specific behaviors
