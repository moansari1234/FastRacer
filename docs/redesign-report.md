# NITRO APEX — Complete Redesign Report

## Ledgers

Skill-loading ledger:
- Director: active
- Gameplay systems: yes, ~/.agents/skills/threejs-gameplay-systems/SKILL.md
- AAA graphics: yes, ~/.agents/skills/threejs-aaa-graphics-builder/SKILL.md
- UI: yes, ~/.agents/skills/threejs-game-ui-designer/SKILL.md
- Debug/profile: yes, ~/.agents/skills/threejs-debug-profiler/SKILL.md
- QA/release: yes, ~/.agents/skills/threejs-qa-release/SKILL.md
- 3D generator: yes, ~/.agents/skills/threejs-3d-generator/SKILL.md
- Image generator: yes, ~/.agents/skills/threejs-image-generator/SKILL.md
- Audio generator: yes, ~/.agents/skills/threejs-audio-generator/SKILL.md

External asset sourcing ledger:
- Credential probe output: TRIPO_API_KEY=MISSING / GEMINI_API_KEY=MISSING / ELEVENLABS_API_KEY=MISSING
- Hero/player source: procedural (blocker: probe MISSING)
- Enemies/rivals/traffic source: procedural factory variants (same blocker)
- Signature props/pickups source: procedural instanced kits (same blocker)
- World/sky/background source: procedural gradient-sky shader + layered silhouettes (same blocker)
- Materials/textures/decals source: procedural canvas textures (spokes, asphalt, windows, blob shadows) (same blocker)
- Logos/icons/GUI art source: bundled Orbitron/Rajdhani fonts + CSS/SVG-styled UI (same blocker)
- Audio/SFX/voice source: WebAudio synthesis (engine/SFX/music) — offline by design (same blocker)
- External assets generated: no — allowed blocker: all three credential probes MISSING
- Audio assets generated: no external; synthesized in-engine (allowed blocker above)

Reference ledger:
- gameplay-workflows: yes
- game-design-level-design: yes (brief/loop/lap plan below)
- game-feel: yes (tuning table applied: trauma², hitstop, squash/stretch, pitch variance, duck)
- physics-engine-selection: not-needed (existing custom arcade rig kept; documented choice)
- new-game DoD checklist: not-needed (redesign of existing verified game)
- visual-scorecard: yes · implementation-blueprint: yes · model-recipes: yes · render-recipes: yes · technical-art: yes · shader-cookbook: yes
- aaa quality-gate + visual-scorecard checklists: via scorecard section below
- ui-patterns: partial (SKILL workflow followed; patterns file unreadable this pass — recorded as gap)
- debug-profile-checklists: yes (root-cause fixes below)
- qa-release-checklists / visual-verification / release: yes (browser steps delegated to user, runner lacks Playwright)
- visual-test-harness: skipped-with-reason (no browser automation on runner)
- bot-playtest: skipped-with-reason (headless sim tests cover loop; live-input bot needs Playwright)
- 3d/image/audio api-notes & workflows: not-needed given MISSING keys (no provider calls possible)

Phase ledger:
- Gameplay systems: done — steering-convention regression test; drift chains; class-separation test; 20/20 suites
- External asset sourcing: done (blocked) — probe output above
- AAA graphics: implemented — see changes; verification partially blocked (no browser on runner)
- UI: done (fonts/panels/boot/menu/HUD digits) — mobile screenshot evidence pending user run
- Debug/profile: done — fixed shared-material mutation bug, SW stale-cache bug, inverted steering root cause
- QA/release: partially done — headless integration races green; live-browser evidence delegated to user

## Design brief
Player promise: absurd speed you fully control. Primary verb: drive (steer/drift/nitro). Objective: beat rivals/targets. Pressure: traffic, ice/storm grip, elimination clock. Reward: nitro economy → position; credits/stars → upgrades. Fail/retry: DNF/eliminated → instant retry. Skill expression: drift chains, perfect-nitro timing windows, jump landings, traffic threading. Non-goals: sim realism, open world.

## Core loop contract
Drive → corner/drift banks nitro → spend on overtakes/shockwave → checkpoints → podium → credits → upgrades → faster events.

## Level/encounter plan
Per lap: start straight (boost teach) → S-curves (drift teach) → ramp jump @~35% (air-reward) → dirt-cut gamble @~60% (risk shortcut) → hairpin overtake window → final-straight slingshot; checkpoint arches as recovery beats each quarter; traffic density scales by theme.

## Physics
Engine choice: custom arcade rig (documented — kinematic hull + analytic wall distance; rigid-body solver unnecessary for drift feel). Timestep: fixed 120 Hz accumulator inside scaled frame dt. Collider strategy: car-car spheres (r=1.45), track lateral clamp halfW−0.85, traffic spheres; collision proxies independent of visuals. Sensors/CCD: not applicable (analytic bounds). Diagnostics: headless integration races assert accel/top-speed/wall-clamp/momentum transfer.

## Render budget / technical-art brief
Hero: player car extruded-hull silhouette, clearcoat paint, spoked wheels, DRL/tail signals, jet-flame boost state. Support: rivals/traffic same factory; instanced posts/palms/pines/buildings/neons/pylons.
Material roles: bodyPrimary(clearcoat) bodySecondary(darkPaint) carbon chrome rubberTire glassFake emissiveSignal basicGlow roadSurface(vertex-tint) groundContact neonAccent(theme).
Lighting: key dir (2048 shadow, high tier) + hemi fill + rim dir + practicals (headlights spot at night, emissive props).
Budget target desktop-high: calls ≤300 · tris ≤750k · post passes 2 (bloom+grade) · 1×2048 shadow · DPR ≤2. Mobile/low: composer off, shadows off, particles ×0.5, DPR 1.
VFX language: pickup burst+ring pulse · wall scrape sparks · impact hitstop+trauma · knockdown big burst · boost jets+bloom+FOV · land dust+squash · shockwave knock aura · finish confetti+orbit cam.

## Files changed (this redesign pass)
vendor/addons/** (11 three@0.160 addon modules) · src/render/materials.js (new) · src/render/postfx.js (new) · src/render/vehicleView.js (extruded hulls, jets, contact blobs, PBR kit) · src/world/environment.js (sky shader, rim light) · src/world/trackScene.js (posts, neon strips, checkpoint lamps) · src/fx/cameraRig.js (trauma model) · src/game/race.js (hitstop/squash/duck/trauma wiring) · src/core/audio.js (pitch jitter, duck) · src/ui/hud.js (renderer diagnostics line) · src/main.js (pipeline+env wiring) · sw.js (+13 precache entries) · index.html (addons import map).

## Verification
- node --check all modules: PASS
- npm test (12 unit + 8 headless full-race integration): 20/20 PASS
- Browser visual evidence: BLOCKED on runner (no Playwright). Commands for user:
  - `node node_modules/.bin/../..//../.agents/skills/threejs-qa-release/scripts/inspect-threejs-canvas.mjs --url http://localhost:8000` (desktop) and `--mobile`
  - Screenshots: OS-level or DevTools capture during active play.

## Visual scorecard (provisional — pending user-run inspector + screenshots)
- Art direction: before 1 / after 2 — theme now drives forms (hull silhouettes), materials (clearcoat paint), props (theme accent neon), UI (Orbitron/Rajdhani); evidence pending screenshot.
- Hero/player: before 1 / after 2 — extruded bevelled hull, spoked wheels, DRL/tail signals, jet-flame boost state, damage tint; blob contact shadow.
- Obstacles/enemies: before 1 / after 2 — three readable hazard families: scrape walls, knockable traffic, rival cars with spin-out telegraph.
- Rewards/interactables: before 1 / after 2 — capsule pickup + glowing pad ring, idle pulse + collect burst + respawn state.
- World/environment: before 1 / after 2 — gradient sky shader w/ sun halo, rim light, guardrail posts, neon edge strips, checkpoint lamps, layered decor kits.
- Materials/textures: before 1 / after 2 — named PBR roles (cookbook values), canvas textures (spokes/asphalt/windows/blob), vertex-tinted surfaces.
- Lighting/render: before 1 / after 2 — key/fill/rim stack, PMREM IBL, ACES, bloom+speed-grade post; readability-first thresholds.
- VFX/motion: before 1 / after 2 — event-driven jets/sparks/confetti/shockwave/hitstop/squash tied to gameplay state.
- UI/HUD: before 1 / after 2 — genre HUD (gauge, segmented nitro w/ perfect window, minimap, eliminations timer), bundled fonts, angular panels.
- Performance evidence: before 1 / after 1 — budgets defined + in-HUD renderer.info line shipped; live inspector JSON still required from user run.
Measured evidence: PENDING — colorEntropyBits/edgeDensity/luminance.contrast/dominantColorShare + renderBudget rows must come from `inspect-threejs-canvas.mjs` desktop & mobile runs.
Fresh-eyes review: adversarial self-review applied — strongest case-for-1 per category: AD(1): palette could read as fog+neon only; HERO(1): hull is one extrusion + attached primitives; OBST(1): traffic shares one silhouette; REWARD(1): single pickup type; WORLD(1): decor is instanced kits, not authored landmarks; MAT(1): no wear/roughness maps beyond canvas noise; LIGHT(1): rim light unmeasured on mobile; VFX(1): particles use round sprites only; UI(1): menu list styling still grid-like; PERF(1): no live numbers yet. Scores assigned after countering each with visible-feature evidence listed above; final numbers must be reconciled against screenshots.
Average: 1.9 provisional (premium gate ≥2.3 requires measured performance evidence + screenshot confirmation).
Automatic failures remaining: no active-play screenshot captured yet; no renderer diagnostics collected yet — both resolved by the two user commands below.

## Visual test harness decision
visual test harness: skipped for this pass — runner has no Playwright/browser; once inspector output arrives, decide on adding screenshot baselines for menu/HUD/race states.

## Build / console / pixels
Build: node --check across all modules PASS; no bundler (static ES modules). Console/page errors: to capture via inspector run (user). Canvas pixel evidence: same inspector run supplies nonblank/variance metrics (pixel statistics block).

## Chosen sources per surface
procedural for hero/rivals/traffic/props/sky/materials/UI/audio — allowed blocker: all three generator keys MISSING (probe output above).

## VFX readability
Each effect maps event→meaning: boost jets+bloom=state speed; sparks+trauma+hitstop=impact severity; pad ring=value location; confetti+orbit=finish; shockwave aura=area denial; dust=landing weight. None obscure the play path or minimap.

## Residual risks
1. Visual scorecard is provisional until inspector JSON + active-play screenshots are supplied (categories likely ≥2 but must be measured).
2. Post pipeline adds bloom+grade cost on medium tier (medium keeps composer ON; if FPS dips, switch medium to low path).
3. Math.random remains in visual-only FX paths (not sim); deterministic-seed refactor deferred.
