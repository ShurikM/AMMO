# Changelog

All notable changes to AMMO are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/).

## [0.4.0] - 2025-03-20

### Added
- Protocol state machine with 11 states and transition logging
- Assertion engine with 6 built-in protocol compliance checks
- 6-phase mission lifecycle (STAGING → INGRESS → LOITER → EXECUTE → EGRESS → RTB)
- 5-level comms degradation model (FULL_MESH → LOST_CONTACT)
- Threat library with 5 adversarial threat types
- Deterministic replay with bidirectional timeline scrubbing
- Fault injection scheduler with JSON-defined scripts

## [0.3.0] - 2025-03-10

### Added
- Modular Vite project structure (21 ES modules)
- Metrics engine with timeline, elections, deaths, and partition tracking
- Real-time metrics dashboard with 4 Canvas 2D charts and KPI row
- Batch simulation mode with seeded PRNG and parameter sweeps
- Scenario save/load/export/import system
- Leaflet map integration with coordinate bridge

## [0.2.0] - 2025-03-01

### Added
- Fleet hierarchy (GL/SL/ASL/Worker/Shadow/Relay)
- Score-based leader election with shadow node promotion
- Battery drain model with hardware-specific multipliers
- RF link quality model with jamming penalty
- 9 hardware types catalog (ESP32 to Jetson AGX)
- Jam, GPS denial, and attacker zone placement
- Canvas 2D rendering with zoom/pan/selection

## [0.1.0] - 2025-02-20

### Added
- Initial prototype with basic drone simulation
- Canvas rendering of drone fleet
- Simple mesh link visualization
