# NITRO APEX — Legends of Arcade Speed

A complete, high-fidelity **arcade racing game inspired by Asphalt 9: Legends**, built from scratch with
**Three.js (WebGL)** + **WebAudio** — no build step, no engine, no assets. Every car, track, sound and UI element is
generated procedurally in code.

![status](https://img.shields.io/badge/tests-17%2F17-brightgreen) ![engine](https://img.shields.io/badge/render-WebGL%20%2F%20three.js-blue)

---

## Run it

```bash
python3 -m http.server 8000        # or: npm run dev / npx serve .
# open http://localhost:8000
```

Run the test suites (pure-sim unit tests + headless full-race integration tests):

```bash
npm test          # standard environments
./run-tests.sh    # wrapper that also works under WSL w/ Windows node interop
```

> A static server is required because the game uses ES modules.

## Controls

| Action | Input |
|---|---|
| Throttle / Brake–Reverse | `W`/`↑` · `S`/`↓` |
| Steer | `A`/`D` or `←`/`→` |
| Drift / handbrake (+360 stunts in air) | `SPACE` |
| Nitro (tap) | `N` or `L-SHIFT` |
| **Perfect Nitro** | tap nitro again inside the sliding window |
| **Shockwave** (meter ≥ 92%) | `Q` — knocks out nearby rivals, limiter off |
| Camera cycle / Reset car / Pause | `C` / `R` / `ESC` |

Touch devices get an on-screen control deck plus a **TouchDrive** assist option in Settings.
Tilt-steer and gamepads are natural extensions of `src/core/input.js`.

---

## Feature map (challenge → implementation)

### 1. Vehicle physics & handling — `src/physics/vehicleCore.js`
Custom arcade model (not realism): forward/lateral velocity decomposition, speed-sensitive steering,
grip circles per stat, weight-transfer visual springs, surface types (**asphalt / dirt / ice / metal**) with
per-track surface zones, weather grip multipliers, ramp-launch physics with airborne pitch control and
**360° stunt spins**, crash-on-bad-landing, wall scraping with damage, spin-outs, suspension roll/pitch,
damage that saps top speed and smokes the hood.

### 2. Nitro — three tiers, one risk/reward loop
Drifting, near-misses, air time, stunts and track pickups fill the meter.
`tap → NITRO`, `tap again in the shrinking zone → PERFECT NITRO`, `Q at ≥92% → SHOCKWAVE`
(speed-limiter break, FOV surge, screen shake, area knockdown). AI runs the same state machine with its own strategy.

### 3. Tracks & environments — `src/data/tracks.js`, `src/world/*`
7 themed circuits: **Cape Vela** (coast), **Dune Rush** (desert sunset), **Neo Kanto Nights** (rain-slick neon city),
**Alpine Ridge** (climbing switchbacks), **Frostline** (blizzard night on ice), **Aurora Loop** (futuristic launch decks),
**Tempest Isle** (tropical storm). Catmull-Rom splines drive road/curb/wall meshes, elevation changes create real jumps,
quarter-beam checkpoints, start gantry, nitro pickups, traffic lanes, dynamic weather (rain/snow/storm + lightning)
and day/sunset/night lighting palettes.

### 4. Cars & progression — `src/data/cars.js`
30 fictional cars across **D/C/B/A/S**, each with distinct power curves; upgrades (Top speed/Accel/Grip/Nitro ×5 levels)
grant **star ratings** that gate cars and career chapters; paint/rims/body-kit customization; credit economy.

### 5. Modes — `src/game/race.js`
Career (3 chapters × 4 events incl. specials like *Shockwave Sprint*), Classic Race, Time Attack **with persistent ghost**,
Elimination, Versus duel, quick-race setup with difficulty tiers Easy → Legend.

### 6. AI opponents — `src/ai/driver.js`
Racing-line followers with lookahead cornering limits, lane variation, overtaking avoidance, three personalities
(aggressive/defensive/technical), strategic nitro use, difficulty scaling, mistake simulation and gentle rubber-banding.

### 7. Visual effects — `src/fx/*`, `src/render/vehicleView.js`
GPU point-particle pools (sparks, drift smoke, nitro flames, debris, dust), speed-scaled FOV + radial speed lines,
screen shake, chromatic-ish boost flashes, lightning flashes, slow-motion on big airs, damage darkening/smoke,
brake-light glow, ghost translucency.

### 8. Audio — `src/core/audio.js`
100% synthesized: RPM-tracked dual-osc engines with boost noise layers, skids, wind, doppler-ish near-miss whooshes,
impact thumps scaled by severity, thunder, countdown/checkpoint/purchase cues, plus a **dynamic music sequencer**
(layers intensify on final lap and nitro).

### 9. UI — `src/ui/hud.js`, `src/ui/screens.js`
Asphalt-style slanted neon UI: animated main menu with rotating showcase car, career map, mode/track pickers,
garage with live 3D preview + upgrade pips, race HUD (position, lap, timer, damage, minimap, gauge, segmented nitro bar
with perfect-nitro marker, elimination timer, notification feed), results screen with rewards breakdown and stars,
settings (volumes, units, camera, quality, TouchDrive, save export/import).

### 10. Performance
Fixed-timestep sim (120 Hz) decoupled from render, instanced scenery, frustum culling, pooled particles,
quality tiers (pixel-ratio caps, shadow toggles, particle scaling, auto-detect), HUD DOM throttled to ~14 Hz,
single draw-call-heavy track mesh, disposal on race teardown.

### 11. Data architecture
Declarative car/track/career tables (plain JSON-style modules), versioned localStorage profile, best times,
per-track ghosts, telemetry-friendly pure-sim core that runs headless under Node (that's what the test suite does),
save export/import for "cloud" portability.

---

## Architecture notes

```
src/
├── data/       declarative content (cars, tracks, career)
├── core/       save (localStorage), input (kb/touch), audio (synth engine + music)
├── world/      trackData (pure spline math) · trackScene + environment (three.js)
├── physics/    vehicleCore — deterministic arcade sim, zero rendering deps
├── render/     vehicleView — procedural low-poly car builder + sync
├── ai/         waypoint drivers w/ personalities
├── fx/         particle pools, camera rig
├── game/       race orchestrator (modes, laps, collisions, traffic, rewards)
├── ui/         hud + screens (menus/garage/results/settings)
└── main.js     Game shell: renderer, menu showcase scene, state machine
tests/
├── run.mjs     unit tests of spline/physics/nitro/data logic (no DOM)
└── smoke.mjs   headless end-to-end races via DOM-stubbed Race class
```

Design rules that keep it maintainable:
- **Simulation is render-free.** `VehicleCore` and `trackData` import nothing visual, so gameplay is testable and portable.
- **Events, not coupling.** Vehicles emit events (`wall`, `land`, `launch`…) that the race layer translates into FX/audio/score.
- **Content = data.** New car = one object. New track = control points + theme + weather.

## Honest scope notes

- *Multiplayer*: netcode is stubbed by design — Versus is a heated 1v1 vs AI. The deterministic fixed-step sim was chosen
  specifically so lockstep/rollback can be layered on later without touching gameplay code.
- Photo mode, replays, livery editor, clans and VR are roadmap items, not shims.

## Credits

Original work — all names, brands, tracks and audio are fictional/procedural. Built with the amazing [three.js](https://threejs.org).
