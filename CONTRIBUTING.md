# Contributing to AMMO

Thank you for your interest in contributing to **AMMO** (Aerial Mesh Mission Orchestration). This document covers setup, conventions, and the process for submitting changes.

## Prerequisites

- **Node.js 18+** and **npm**
- A modern browser (Chrome or Firefox recommended)

## Development Setup

```bash
git clone https://github.com/ShurikM/AMMO.git
cd AMMO
npm install
npm run dev
```

Vite will open the simulator at `http://localhost:5173/ammo/`.

### Available Commands

| Command           | Description                |
|--------------------|---------------------------|
| `npm run dev`      | Start dev server (HMR)    |
| `npm run build`    | Production build to `dist/` |
| `npm run preview`  | Preview the production build |

## Project Structure

```
src/
  sim/        Pure simulation logic (no DOM)
    engine.js       Global state (S), tick loop
    drones.js       Hardware catalog (DRONE_TYPES), drone factory, roles
    election.js     Score-based leader election, shadow promotion
    metrics.js      Timeline, deaths, elections, partition tracking
    protocol.js     11-state protocol state machine with transition log
    assertions.js   Built-in protocol compliance checks
    mission.js      6-phase mission lifecycle
    comms.js        5-level comms degradation model
    threats.js      Adversarial threat library
    faults.js       Fault injection scheduler
    batch.js        Batch simulation with seeded PRNG and parameter sweeps
    replay.js       Deterministic replay with timeline scrubbing
    utils.js        Distance helpers, seeded PRNG

  render/     Visualization layer
    canvas.js       Canvas 2D rendering (drones, links, zones, routes)
    charts.js       4 metrics charts (Canvas 2D, no external libs)
    map.js          Leaflet map integration with coordinate bridge

  ui/         Interface and interaction
    panels.js       Left/right panel wiring, drone info, config controls
    log.js          Event log and AI decision log
    modals.js       Batch, fault injection, hardware spec modals
    tooltip.js      Hover tooltips

  main.js     Entry point — wires sim, render, and ui together
```

## Code Style

- **Vanilla JavaScript** with ES modules (`import`/`export`). No frameworks, no transpilers beyond Vite.
- **No external chart libraries.** All charts are drawn with Canvas 2D in `render/charts.js`.
- Keep functions short and focused. Prefer named exports.
- Use `const` by default; `let` only when reassignment is needed.
- Single-file modules: each file in `sim/` should contain one concern.

## Design System

### CSS Variables (defined in `styles/main.css`)

| Variable   | Value      | Usage                       |
|------------|------------|-----------------------------|
| `--bg`     | `#080c12`  | Page background             |
| `--panel`  | `#0d1420`  | Panel backgrounds           |
| `--gl`     | `#00d4ff`  | Group Leader / primary accent |
| `--sl`     | `#00ffcc`  | Squad Leader                |
| `--asl`    | `#bf7fff`  | AI Squad Leader             |
| `--w`      | `#39ff88`  | Worker drones               |
| `--sh`     | `#ff9e00`  | Shadow nodes                |
| `--rl`     | `#ffe033`  | Relay nodes                 |
| `--alert`  | `#ff3b3b`  | Errors and danger actions   |
| `--warn`   | `#ff9000`  | Warnings                    |
| `--ok`     | `#00e87a`  | Success / healthy state     |
| `--text`   | `#c8dff0`  | Default text color          |
| `--muted`  | `#4a6680`  | Secondary text              |
| `--border` | `#1a2d45`  | Panel borders               |

### Fonts

- **Share Tech Mono** — monospaced, used for data readouts, clocks, badges
- **Rajdhani** (weights 400/600/700) — UI labels, buttons, body text

## How to Add a New Hardware Type

1. Open `src/sim/drones.js`.
2. Add an entry to the `DRONE_TYPES` object. Follow the existing schema:
   ```js
   MY_NEW_HW: {
     name: 'Display Name',
     cls: 'Category',
     cpu: '...', gpu: '...', ram: '...',
     comms: '...',
     carryKg: 0, airtimeMin: 0, maxAltM: 0,
     speedKmh: 0, weightKg: 0,
     rfRangeMult: 1.0, aiLevel: 0,
     battCapMult: 1.0, drainMult: 1.0,
     missionTypes: ['RELAY'],
     aiDesc: '...',
     color: '#ffe033'
   }
   ```
3. Add corresponding `<option>` entries in `index.html` under the relevant hardware `<select>` dropdowns (GL, SL, Worker, or Relay).

## How to Add a New Threat Type

1. Open `src/sim/threats.js`.
2. Add an entry to the `THREAT_TYPES` object:
   ```js
   MY_THREAT: {
     id: 'MY_THREAT', name: 'Display Name', color: '#hexcolor',
     desc: 'What this threat does.',
     defaultRadius: 100, killRadius: 40,
     engageRate: 0.003, mobile: false,
     icon: 'XX'
   }
   ```
3. Add a matching `<option>` to the `#threat-type-select` dropdown in `index.html`.

## How to Add a New Assertion

1. Open `src/sim/assertions.js`.
2. Add an object to the `builtinAssertions` array:
   ```js
   {
     id: 'my-assertion',
     name: 'Short name shown in UI',
     description: 'Longer explanation',
     severity: 'critical' | 'warning',
     checkInterval: 60,  // ticks between checks
     check: () => {
       // Return { result: RESULT.PASS|FAIL|WARN|PENDING, detail: '...' }
     }
   }
   ```
3. The assertion engine picks it up automatically on simulation reset.

## Pull Request Process

1. **Fork** the repository and create a feature branch:
   ```bash
   git checkout -b feat/my-feature
   ```
2. Make your changes. Keep commits focused and use conventional prefixes: `feat:`, `fix:`, `refactor:`, `docs:`.
3. Run `npm run build` to verify nothing breaks.
4. Open a **Pull Request** against `main` with:
   - A clear description of what changed and why
   - Screenshots if the change affects the UI
   - Confirmation that the simulation runs without console errors
5. A maintainer will review and merge.

## Questions?

Open an issue or start a discussion on the repository.
