import * as THREE from "three";
import { buildTrackData } from "../world/trackData.js";
import { buildTrackScene } from "../world/trackScene.js";
import { Environment } from "../world/environment.js";
import { VehicleCore, resolveCarCollision } from "../physics/vehicleCore.js";
import { CAR_MAP, rating } from "../data/cars.js";
import { AIDriver, makePersonality } from "../ai/driver.js";
import { Particles } from "../fx/particles.js";
import { CameraRig } from "../fx/cameraRig.js";
import { buildCarMesh, syncCarView, updateCarCosmetics } from "../render/vehicleView.js";
import { clamp, damp, mulberry32, pick } from "../utils.js";

const AI_NAMES = ["Rex", "Mia", "Kaido", "Vera", "Jax", "Noir", "Sable", "Iris", "Duke", "Lena"];
const WEATHER_GRIP = { clear: 1, rain: 0.85, snow: 0.72, storm: 0.8 };
const SURF_GRIP = { asphalt: 1, dirt: 0.72, ice: 0.42, metal: 1.06 };
const NITRO_DRAIN = [0, 26, 30, 33];

export class Race {
  constructor(cfg) {
    this.cfg = cfg;
    this.scene = new THREE.Scene();
    this.trackDef = cfg.trackDef;
    this.track = buildTrackData(cfg.trackDef);
    this.env = new Environment(this.scene, null, cfg.trackDef, cfg.quality, cfg.seed || 1234, this.track);
    const ts = buildTrackScene(this.track, cfg.trackDef, cfg.quality);
    this.trackScene = ts;
    this.scene.add(ts.group);
    this.env.onLightning = () => {
      this.hud.flash();
      this.audio.thunder();
    };

    this.fxAdd = new Particles(this.scene, Math.floor(2400 * cfg.particleScale), true);
    this.fxSmoke = new Particles(this.scene, Math.floor(700 * cfg.particleScale), false);

    this.camera = new THREE.PerspectiveCamera(64, cfg.aspect, 0.1, 1700);
    this.rig = new CameraRig(this.camera);
    this.rig.mode = cfg.settings.cam === "hood" ? "hood" : cfg.settings.cam;

    if (cfg.trackDef.time === "night") {
      this.headlight = new THREE.SpotLight(0xfff3d6, 140, 70, 0.62, 0.55, 1.2);
      this.headlight.position.set(0, 2.4, -2);
      const target = new THREE.Object3D();
      target.position.set(0, 0.4, 26);
      this.scene.add(this.headlight);
      this.scene.add(target);
      this.headlight.target = target;
    }

    this.rng = mulberry32(cfg.seed || 99);
    this.cars = [];
    this.drivers = [];
    this.player = this._makeCar(cfg.carSpec, cfg.derivedStats, true, 0);
    this._buildRivals();
    this._grid();

    this.traffic = [];
    if (cfg.trackDef.traffic && cfg.trackDef.traffic.count > 0 && !cfg.modifiers.noTraffic) {
      this._buildTraffic();
    }
    this.pickups = [];
    this._buildPickups();

    this.mode = cfg.mode;
    this.laps = cfg.laps;
    this.totalRacing = this.laps * this.track.total;
    this.diff = cfg.diff;
    this.modifiers = cfg.modifiers || {};
    this.state = "countdown";
    this.stateT = 3.7;
    this.lastBeep = 4;
    this.raceTime = 0;
    this.timeScale = 1;
    this.slowmoT = 0;
    this.slowmoScale = 1;
    this.positions = [];
    this.rankT = 0;
    this.hudT = 0;
    this.elimInterval = 18;
    this.elimT = this.elimInterval;
    this.eliminatedCount = 0;
    this.finishedOrder = [];

    this.stats = {
      topSpeed: 0,
      nearMisses: 0,
      knockdowns: 0,
      stunts: 0,
      pickups: 0
    };

    this.ghostView = null;
    if (this.mode === "timeattack" && cfg.ghostData && cfg.ghostData.samples.length > 4) {
      this.ghostView = buildCarMesh(CAR_MAP.get(cfg.ghostData.carId) || cfg.carSpec, { ghost: true, paint: "#8fe3ff" });
      this.scene.add(this.ghostView.group);
      this.ghostCursor = 0;
    }
    this.recSamples = [];
    this.recT = 0;
    this.recording = this.mode === "timeattack";

    this.nearMissCooldown = new Map();
    this.driftChain = { active: false, dist: 0 };
    this.onSaveGhost = cfg.onSaveGhost || null;
    this.audio = cfg.audio;
    this.input = cfg.input;
    this.settings = cfg.settings;
    this.hud = cfg.hud;
    this.isTouch = cfg.isTouch;
    this.touchDrive = cfg.touchDrive;

    this._respawnHandler = () => this.respawnPlayer();
    this._camHandler = () => {
      const m = this.rig.cycle();
      this.hud.notify(`CAMERA: ${m.toUpperCase()}`, "minor");
    };
    this.input.onRespawn = this._respawnHandler;
    this.input.onCamera = this._camHandler;
  }

  _makeCar(spec, stats, isPlayer, index, name) {
    const core = new VehicleCore(stats, isPlayer);
    const cust = isPlayer ? this.cfg.customization : { paint: spec.color, rim: "#181c22", spoiler: "stock" };
    const view = buildCarMesh(spec, cust);
    this.scene.add(view.group);
    const car = {
      core,
      view,
      spec,
      name: name || (isPlayer ? "YOU" : ""),
      isPlayer,
      eliminated: false,
      knockT: 0,
      aiLane: 0
    };
    this.cars.push(car);
    return car;
  }

  _buildRivals() {
    const n = this.cfg.rivals;
    const pr = rating(this.cfg.carSpec);
    const pool = [...CAR_MAP.values()]
      .filter((c) => c.id !== this.cfg.carSpec.id)
      .sort((a, b) => Math.abs(rating(a) - pr) - Math.abs(rating(b) - pr))
      .slice(0, 14);
    const chosen = [];
    for (let i = 0; i < n; i++) {
      const c = pool[Math.floor(this.rng() * pool.length)];
      if (!chosen.includes(c)) chosen.push(c);
    }
    let guard = 0;
    while (chosen.length < n && guard++ < 50) {
      const c = pick(this.rng, pool);
      if (!chosen.includes(c)) chosen.push(c);
    }
    const diffCfg = this.cfg.diffCfg;
    chosen.forEach((spec, i) => {
      const prng = mulberry32((this.cfg.seed || 5) * 13 + i * 7);
      const pers = makePersonality(prng, i);
      pers.name = AI_NAMES[i % AI_NAMES.length];
      const stats = this.cfg.statProvider(spec);
      const bal = clamp(rating(this.cfg.carSpec) / Math.max(1, rating(spec)), 0.88, 1.14);
      stats.maxSpeed *= bal;
      stats.accelRate *= bal;
      const car = this._makeCar(spec, stats, false, i + 1, pers.name);
      const driver = new AIDriver(car.core, this.track, pers, diffCfg, (this.cfg.seed || 5) * 31 + i);
      driver.car = car;
      this.drivers.push(driver);
    });
  }

  _grid() {
    const total = this.track.total;
    const order = [...this.cars.filter((c) => !c.isPlayer), this.player];
    order.forEach((car, i) => {
      const row = Math.floor(i / 2);
      const col = i % 2 === 0 ? -1 : 1;
      const s = total - 7 - row * 7;
      car.core.place(s, this.track, col * this.track.halfW * 0.32);
      car.core.progress = s - total;
      car.core._prevS = s;
    });
    this.rig.snapBehind(this.player.core);
  }

  _buildTraffic() {
    const def = this.cfg.trackDef.traffic;
    const colors = ["#8a8f98", "#b8b2a4", "#5d6a75", "#7a4b3a", "#46586e"];
    for (let i = 0; i < def.count; i++) {
      const spec = { id: `traffic${i}`, shape: "traffic", color: pick(this.rng, colors), name: "Traffic" };
      const view = buildCarMesh(spec, {});
      this.scene.add(view.group);
      this.traffic.push({
        view,
        s: (i / def.count) * this.track.total + 60,
        lane: (i % 2 === 0 ? -1 : 1) * this.track.halfW * 0.45,
        speed: def.speed * (0.85 + this.rng() * 0.4),
        knocked: false,
        knockT: 0,
        spin: 0
      });
    }
  }

  _buildPickups() {
    const count = this.cfg.trackDef.nitroPads || 0;
    const geo = new THREE.CapsuleGeometry(0.55, 1.1, 4, 10);
    geo.rotateZ(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0x37f3ff, transparent: true, opacity: 0.92 });
    const ringGeo = new THREE.RingGeometry(1.15, 1.7, 24);
    for (let i = 0; i < count; i++) {
      const s = ((i + 0.5) / count) * this.track.total;
      const side = i % 2 === 0 ? -1 : 1;
      const sm = this.track.sampleAt(s);
      const grp = new THREE.Group();
      grp.position.set(sm.x + sm.nx * side * this.track.halfW * 0.5, sm.y + 0.06, sm.z + sm.nz * side * this.track.halfW * 0.5);
      grp.rotation.y = Math.atan2(sm.tx, sm.tz) + Math.PI / 2;
      const cap = new THREE.Mesh(geo, mat);
      cap.position.y = 1.1;
      grp.add(cap);
      const padMat = new THREE.MeshBasicMaterial({
        color: 0x00e5ff,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const pad = new THREE.Mesh(ringGeo, padMat);
      pad.rotation.x = -Math.PI / 2;
      grp.add(pad);
      this.scene.add(grp);
      this.pickups.push({ grp, cap, pad: padMat, x: grp.position.x, z: grp.position.z, active: true, respawnT: 0, spin: this.rng() * 6 });
    }
    this.pickupMat = mat;
  }

  respawnPlayer() {
    if (this.state !== "run") return;
    const v = this.player.core;
    v.place(v.s, this.track, 0);
    this.hud.notify("RESET", "minor");
    this.rig.snapBehind(v);
  }

  slowmo(duration, scale) {
    this.slowmoT = duration;
    this.slowmoScale = scale;
  }

  _celebrate() {
    this.rig.setVictory(true);
    this.audio.checkpoint();
    this.hud.notify("FINISH!", "boost");
    const v = this.player.core;
    const colors = [
      [1, 0.45, 0.15], [0, 0.9, 1], [1, 0.82, 0.24],
      [0.42, 1, 0.55], [1, 0.18, 0.33], [0.49, 0.3, 1]
    ];
    for (let i = 0; i < 70; i++) {
      const c = colors[i % colors.length];
      this.fxSmoke.emit({
        x: v.pos.x + (Math.random() - 0.5) * 2,
        y: v.pos.y + 1.4,
        z: v.pos.z + (Math.random() - 0.5) * 2,
        vx: (Math.random() - 0.5) * 9,
        vy: 6 + Math.random() * 9,
        vz: (Math.random() - 0.5) * 9,
        life: 1.6 + Math.random() * 1.2,
        size: 0.34,
        r: c[0], g: c[1], b: c[2],
        alpha: 1,
        grav: 9,
        drag: 0.5
      });
    }
  }

  _handleEvents(car, dt) {
    const v = car.core;
    for (const ev of v.events) {
      if (ev.type === "wall") {
        this._burstSparks(ev.x, v.pos.y + 0.4, ev.z, Math.min(14, ev.impact));
        if (car.isPlayer) {
          this.audio.collision(clamp(ev.impact / 16, 0.2, 1));
          this.rig.shake(clamp(ev.impact / 24, 0.08, 0.6));
        }
      } else if (ev.type === "land") {
        if (ev.air > 1.05 && car.isPlayer) {
          this.slowmo(0.5, 0.4);
          this.rig.kick(6);
          this.audio.collision(0.35);
        } else if (car.isPlayer) {
          this.audio.collision(0.18);
        }
        this._dustBurst(v.pos.x, v.pos.y, v.pos.z, 8);
        if (ev.did360) {
          v.addMeter(15 * v.stats.nitroGain);
          this.stats.stunts++;
          if (car.isPlayer) this.hud.notify("360 STUNT!", "good");
        }
        if (ev.air > 0.6) v.addMeter(Math.min(20, ev.air * 10) * v.stats.nitroGain);
      } else if (ev.type === "crashLand") {
        if (car.isPlayer) {
          this.audio.collision(0.9);
          this.rig.shake(0.7);
          this.hud.notify("HARD LANDING!", "bad");
        }
        this._dustBurst(v.pos.x, v.pos.y, v.pos.z, 14);
      } else if (ev.type === "launch") {
        if (car.isPlayer && ev.vy > 6) this.rig.kick(4);
      }
    }
    v.events.length = 0;
  }

  _burstSparks(x, y, z, n) {
    for (let i = 0; i < n; i++) {
      this.fxAdd.emit({
        x, y, z,
        vx: (Math.random() - 0.5) * 14,
        vy: Math.random() * 9,
        vz: (Math.random() - 0.5) * 14,
        life: 0.3 + Math.random() * 0.35,
        size: 0.28,
        r: 1, g: 0.75 + Math.random() * 0.2, b: 0.25,
        grav: 22, drag: 1.2
      });
    }
  }

  _dustBurst(x, y, z, n) {
    for (let i = 0; i < n; i++) {
      this.fxSmoke.emit({
        x: x + (Math.random() - 0.5) * 1.6,
        y: y + 0.15,
        z: z + (Math.random() - 0.5) * 1.6,
        vx: (Math.random() - 0.5) * 4,
        vy: 1 + Math.random() * 2.5,
        vz: (Math.random() - 0.5) * 4,
        life: 0.8 + Math.random() * 0.8,
        size: 1.4,
        grow: 2.4,
        r: 0.62, g: 0.58, b: 0.52,
        alpha: 0.5,
        drag: 1.1
      });
    }
  }

  _nitroFlames(car, dt) {
    const v = car.core;
    if (!v.nitroActive) return;
    const level = v.boostLevel;
    const col = level === 3 ? [0.45, 0.85, 1] : level === 2 ? [0.55, 0.75, 1] : [1, 0.6, 0.15];
    for (const anchor of car.view.flameAnchors) {
      anchor.getWorldPosition(_tmpV);
      for (let k = 0; k < (level === 3 ? 3 : 2); k++) {
        this.fxAdd.emit({
          x: _tmpV.x, y: _tmpV.y, z: _tmpV.z,
          vx: -v.fwdX * 9 + (Math.random() - 0.5) * 2,
          vy: 0.5 + Math.random(),
          vz: -v.fwdZ * 9 + (Math.random() - 0.5) * 2,
          life: 0.16 + Math.random() * 0.14,
          size: level === 3 ? 1.5 : 1.05,
          r: col[0], g: col[1], b: col[2],
          alpha: 0.95,
          drag: 2.5
        });
      }
    }
    if (car.isPlayer) this.rig.kick(dt * 2);
  }

  _driftSmoke(car, dt) {
    const v = car.core;
    if (!v.grounded || (!v.drifting && v.slip < 5)) return;
    const intensity = v.drifting ? 1 : clamp((v.slip - 5) / 6, 0, 1);
    if (Math.random() > intensity * 0.9) return;
    for (const w of [car.view.wheels[2], car.view.wheels[3]]) {
      w.group.getWorldPosition(_tmpV);
      this.fxSmoke.emit({
        x: _tmpV.x, y: _tmpV.y - 0.15, z: _tmpV.z,
        vx: (Math.random() - 0.5) * 3 - v.vx * 0.05,
        vy: 1.2 + Math.random() * 1.6,
        vz: (Math.random() - 0.5) * 3 - v.vz * 0.05,
        life: 0.7 + Math.random() * 0.6,
        size: 0.9,
        grow: 2.6,
        r: 0.78, g: 0.78, b: 0.8,
        alpha: 0.42,
        drag: 1.4
      });
    }
  }

  _damageSmoke(car, dt) {
    const v = car.core;
    if (v.damage < 0.45 || Math.random() > 0.25) return;
    this.fxSmoke.emit({
      x: v.pos.x + v.fwdX * 1.4,
      y: v.pos.y + 0.7,
      z: v.pos.z + v.fwdZ * 1.4,
      vx: 0, vy: 2.2, vz: 0,
      life: 0.9,
      size: 0.7,
      grow: 2.2,
      r: 0.2, g: 0.2, b: 0.22,
      alpha: 0.5,
      drag: 1
    });
  }

  _updateTraffic(dt) {
    const total = this.track.total;
    for (const t of this.traffic) {
      if (t.knocked) {
        t.knockT -= dt;
        t.spin += dt * 9;
        t.view.group.rotation.y = t.spin;
        t.view.group.position.y += dt * 3 * Math.max(0, t.knockT);
        if (t.knockT <= 0) {
          t.knocked = false;
          t.spin = 0;
          t.view.group.rotation.y = 0;
          t.s = (this.player.core.s + 180 + Math.random() * 200) % total;
        }
        continue;
      }
      t.s = (t.s + t.speed * dt) % total;
      const sm = this.track.sampleAt(t.s);
      t.view.group.position.set(sm.x + sm.nx * t.lane, sm.y, sm.z + sm.nz * t.lane);
      t.view.group.rotation.y = Math.atan2(sm.tx, sm.tz);
    }
  }

  _trafficCollisions(dt) {
    const p = this.player.core;
    for (const t of this.traffic) {
      if (t.knocked) continue;
      const sm = this.track.sampleAt(t.s);
      const tx = sm.x + sm.nx * t.lane;
      const tz = sm.z + sm.nz * t.lane;
      const ty = sm.y;
      for (const car of this.cars) {
        if (car.eliminated) continue;
        const v = car.core;
        const dx = tx - v.pos.x;
        const dz = tz - v.pos.z;
        const d2 = dx * dx + dz * dz;
        const rr = 2.6;
        if (d2 > rr * rr || Math.abs(ty - v.pos.y) > 2.2) {
          if (car.isPlayer) {
            const rec = this.nearMissCooldown.get(t);
            const fwdDot = dx * v.fwdX + dz * v.fwdZ;
            if (d2 < 49 && fwdDot < 0 && v.speed > 21 && (!rec || this.raceTime - rec > 1.2)) {
              this.nearMissCooldown.set(t, this.raceTime);
              this.stats.nearMisses++;
              v.addMeter(12 * v.stats.nitroGain);
              this.audio.nearMiss();
              this.hud.notify("NEAR MISS +NITRO", "good");
            }
          }
          continue;
        }
        const rel = Math.abs(v.speed) - t.speed;
        if (car.isPlayer && (v.boostLevel >= 2 || rel > 17)) {
          t.knocked = true;
          t.knockT = 1.4;
          this.stats.knockdowns++;
          v.addMeter(10);
          this.audio.knockdown();
          this.hud.notify("TRAFFIC KNOCKDOWN!", "good");
          this.rig.shake(0.45);
          this._burstSparks(tx, ty + 0.8, tz, 16);
        } else {
          const nx = dx / Math.max(0.01, Math.sqrt(d2));
          const nz = dz / Math.max(0.01, Math.sqrt(d2));
          const into = -(v.vx * nx + v.vz * nz);
          v.addImpulse(-nx, -nz, Math.max(6, into * 0.8));
          v.takeDamage(0.06);
          v.speed *= 0.55;
          this.audio.collision(0.8);
          this._burstSparks(tx, ty + 0.6, tz, 10);
          if (car.isPlayer) this.rig.shake(0.5);
        }
      }
    }
  }

  _carCollisions() {
    const alive = this.cars.filter((c) => !c.eliminated);
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const A = alive[i].core;
        const B = alive[j].core;
        const hit = resolveCarCollision(A, B);
        if (!hit || hit.impact < 2.5) continue;
        const carA = alive[i];
        const carB = alive[j];
        this._burstSparks(hit.mx, A.pos.y + 0.5, hit.mz, Math.min(16, hit.impact));
        for (const c of [carA, carB]) {
          if (c.isPlayer) {
            this.audio.collision(clamp(hit.impact / 14, 0.25, 1));
            this.rig.shake(clamp(hit.impact / 20, 0.1, 0.7));
          }
        }
        const attacker = Math.abs(A.speed) > Math.abs(B.speed) ? carA : carB;
        const victim = attacker === carA ? carB : carA;
        const av = attacker.core;
        const vv = victim.core;
        const rel = Math.abs(av.speed) - Math.abs(vv.speed);
        if (hit.impact > 7 && (rel > 11 || av.boostLevel === 3)) {
          if (vv.spinOut(av.pos.x < vv.pos.x ? -1 : 1)) {
            this.stats.knockdowns += attacker.isPlayer ? 1 : 0;
            av.addMeter(attacker.isPlayer ? 14 : 10);
            this.audio.knockdown();
            if (attacker.isPlayer) this.hud.notify(`KNOCKDOWN: ${victim.name}`, "good");
            else if (victim.isPlayer) this.hud.notify("KNOCKED OUT!", "bad");
          }
        }
      }
    }
  }

  _updatePickups(dt) {
    const p = this.player.core;
    for (const pk of this.pickups) {
      pk.spin += dt * 2.4;
      if (!pk.active) {
        pk.respawnT -= dt;
        if (pk.respawnT <= 0) {
          pk.active = true;
          pk.grp.visible = true;
        }
        continue;
      }
      pk.cap.rotation.y = pk.spin;
      const pulse = 0.3 + Math.abs(Math.sin(pk.spin * 1.5)) * 0.3;
      pk.pad.opacity = pulse;
      const dx = pk.x - p.pos.x;
      const dz = pk.z - p.pos.z;
      if (dx * dx + dz * dz < 6.2 && Math.abs(p.pos.y - pk.grp.position.y) < 3) {
        pk.active = false;
        pk.grp.visible = false;
        pk.respawnT = 10;
        p.addMeter(28);
        this.stats.pickups++;
        this.audio.pickup();
        this.hud.notify("NITRO PICKUP", "minor");
        for (let k = 0; k < 10; k++) {
          this.fxAdd.emit({
            x: pk.x, y: p.pos.y + 0.8, z: pk.z,
            vx: (Math.random() - 0.5) * 8,
            vy: Math.random() * 7,
            vz: (Math.random() - 0.5) * 8,
            life: 0.4 + Math.random() * 0.3,
            size: 0.4,
            r: 0.2, g: 0.95, b: 1,
            grav: 12, drag: 1.2
          });
        }
      }
    }
  }

  _computePositions() {
    this.positions = [...this.cars].sort((a, b) => {
      if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
      const af = a.core.finished;
      const bf = b.core.finished;
      if (af && bf) return a.core.finishTime - b.core.finishTime;
      if (af !== bf) return af ? -1 : 1;
      return b.core.progress - a.core.progress;
    });
    this.positions.forEach((c, i) => {
      c.rank = i + 1;
    });
    if (this.state === "run" && this.player.rank && this._lastRank) {
      const prev = this._lastRank;
      const now = this.player.rank;
      if (now < prev) {
        this.hud.notify(now === 1 ? "YOU TOOK THE LEAD!" : `OVERTAKE — P${now}`, "good");
        this.audio.checkpoint();
      } else if (now > prev) {
        this.hud.notify(`P${now} — FIGHT BACK`, "bad");
      }
    }
    if (this.player.rank) this._lastRank = this.player.rank;
  }

  _eliminationTick(dt) {
    if (this.mode !== "elimination") return;
    const alive = this.cars.filter((c) => !c.eliminated && !c.core.finished);
    if (alive.length <= 1) {
      const last = alive[0];
      if (last && last.isPlayer && this.state === "run") {
        this._finishRace(true, null);
      }
      return;
    }
    this.elimT -= dt;
    if (this.elimT <= 0) {
      this.elimT = this.elimInterval;
      const last = alive.reduce((acc, c) => (c.core.progress < acc.core.progress ? c : acc), alive[0]);
      last.eliminated = true;
      this.eliminatedCount++;
      this.audio.eliminated();
      this._burstSparks(last.core.pos.x, last.core.pos.y + 0.8, last.core.pos.z, 30);
      this._dustBurst(last.core.pos.x, last.core.pos.y, last.core.pos.z, 20);
      if (last.isPlayer) {
        this._finishRace(false, "ELIMINATED");
      } else {
        this.hud.notify(`${last.name} ELIMINATED`, "minor");
        last.view.group.visible = false;
      }
    }
  }

  _applyPlayerInput(dt) {
    const v = this.player.core;
    const inp = this.input.read();
    if (this.state === "countdown" || this.state === "outro") {
      v.input.throttle = 0;
      v.input.brake = this.state === "outro" ? 0.6 : 0;
      v.input.steer = 0;
      v.input.drift = false;
      return;
    }
    if (v.finished) {
      const sm = this.track.sampleAt(v.s + 14);
      const tx = sm.x - v.pos.x;
      const tz = sm.z - v.pos.z;
      const steerTo = clamp(Math.atan2(tx * v.rightX + tz * v.rightZ, tx * v.fwdX + tz * v.fwdZ) * 1.8, -1, 1);
      v.input.throttle = 0.45;
      v.input.brake = 0;
      v.input.steer = steerTo;
      v.input.drift = false;
      return;
    }

    if (this.modifiers.infNitro) v.meter = 100;

    if (this.touchDrive) {
      let kMax = 0;
      let targetSteer = 0;
      const look = 9 + Math.abs(v.speed) * 0.55;
      const sm = this.track.sampleAt(v.s + look);
      const tx = sm.x - v.pos.x;
      const tz = sm.z - v.pos.z;
      targetSteer = clamp(Math.atan2(tx * v.rightX + tz * v.rightZ, tx * v.fwdX + tz * v.fwdZ) * 2.1, -1, 1);
      for (let d = 6; d < 70; d += 8) {
        kMax = Math.max(kMax, Math.abs(this.track.sampleAt(v.s + d).curv));
      }
      const cornerSpeed = kMax > 0.001 ? Math.sqrt(11 / kMax) : 999;
      v.input.throttle = inp.brake ? 0 : 1;
      v.input.brake = Math.abs(v.speed) > cornerSpeed * 1.05 ? 0.7 : 0;
      v.input.steer = targetSteer;
      v.input.drift = kMax > 0.02 && Math.abs(v.speed) > 23;
    } else {
      v.input.throttle = inp.throttle;
      v.input.brake = inp.brake;
      v.input.steer = inp.steer;
      v.input.drift = inp.drift;
    }

    const taps = this.input.consumeNitroTap();
    if (taps > 0) {
      const lvl = v.requestNitroTap();
      if (lvl === 1) this.audio.nitroStart(0);
      else if (lvl === 2) {
        this.audio.nitroStart(1);
        this.hud.notify("PERFECT NITRO!", "boost");
        this.rig.kick(5);
      } else if (lvl === 0 && v.boostLevel === 0) {
        this.hud.notify("NO NITRO", "bad");
      }
    }
    const shocks = this.input.consumeShockTap();
    if (shocks > 0 && v.requestShockwave()) {
      this.audio.nitroStart(2);
      this.hud.notify("SHOCKWAVE!", "boost");
      this.rig.kick(10);
      this.rig.shake(0.5);
      for (const o of this.cars) {
        if (o === this.player || o.eliminated) continue;
        const d = Math.hypot(o.core.pos.x - v.pos.x, o.core.pos.z - v.pos.z);
        if (d < 9) o.core.spinOut(o.core.pos.x > v.pos.x ? 1 : -1);
      }
    }

    if (v.nitroActive && !this.modifiers.infNitro) {
      v.meter -= NITRO_DRAIN[v.boostLevel] * dt;
    }
    if (v.drifting) {
      v.addMeter(dt * 9.5 * v.stats.nitroGain);
      if (!this.driftChain.active) this.driftChain = { active: true, dist: 0 };
      this.driftChain.dist += Math.abs(v.speed) * dt;
    } else if (this.driftChain.active) {
      const d = this.driftChain.dist;
      if (d > 20) {
        const bonus = Math.min(30, d * 0.06);
        v.addMeter(bonus);
        this.hud.notify(`DRIFT ${Math.round(d)}m  +${Math.round(bonus)} NITRO`, "minor");
      }
      this.driftChain.active = false;
    }
    if (!v.grounded && v.airTime > 0.4) {
      // air chain feeds landing bonus handled by core events
    }
  }

  update(dtReal, hudCb) {
    if (this.slowmoT > 0) {
      this.slowmoT -= dtReal;
      this.timeScale = damp(this.timeScale, this.slowmoScale, 8, dtReal);
    } else {
      this.timeScale = damp(this.timeScale, 1, 5, dtReal);
    }
    const dt = dtReal * this.timeScale;

    if (this.state === "countdown") {
      this.stateT -= dtReal;
      const n = Math.ceil(this.stateT);
      if (n !== this.lastBeep && n >= 0 && n <= 3) {
        this.lastBeep = n;
        if (n > 0) {
          this.audio.countdown(false);
          this.hud.showCountdown(String(n));
        } else {
          this.audio.countdown(true);
          this.hud.showCountdown("GO!");
          this.state = "run";
        }
      }
      const pv = this.player.core;
      pv.rpm = clamp(0.35 + (3.7 - this.stateT) * 0.1, 0, 0.9);
    }

    if (this.state === "run" || this.state === "outro") {
      this.raceTime += dt;
      this._applyPlayerInput(dt);
      const others = this.cars.map((c) => c.core);
      const finalLap = this.player.core.progress > (this.laps - 1) * this.track.total;
      for (const d of this.drivers) {
        if (d.car.eliminated) continue;
        d.update(dt, {
          others,
          playerProgress: this.player.core.progress,
          raceTime: this.raceTime,
          finalLap
        });
      }

      const fixed = 1 / 120;
      let acc = dt;
      const envCtx = {
        weatherGrip: WEATHER_GRIP[this.cfg.trackDef.weather] || 1,
        surfGrip: (t) => SURF_GRIP[t] || 1
      };
      while (acc > 0) {
        const h = Math.min(fixed, acc);
        for (const car of this.cars) {
          if (!car.eliminated) car.core.step(h, this.track, envCtx);
        }
        acc -= h;
      }

      this._carCollisions();
      this._updateTraffic(dt);
      this._trafficCollisions(dt);
      this._updatePickups(dt);
      this._eliminationTick(dt);

      for (const car of this.cars) {
        this._handleEvents(car, dt);
        const v = car.core;
        if (!v.finished && v.progress >= this.totalRacing) {
          v.finished = true;
          v.finishTime = this.raceTime;
          this.finishedOrder.push(car);
          if (car.isPlayer) {
            this.state = "outro";
            this.stateT = 2.6;
            this._celebrate();
          } else {
            this.hud.notify(`${car.name} FINISHED`, "minor");
          }
        }
        this.stats.topSpeed = Math.max(this.stats.topSpeed, car.isPlayer ? Math.abs(v.speed) : 0);
        syncCarView(car.view, v, dt);
        updateCarCosmetics(car.view, v);
        if (!car.isPlayer && !car.eliminated) {
          if (v.drifting) v.addMeter(dt * 7 * v.stats.nitroGain);
          v.addMeter(dt * 0.9);
        }
        this._nitroFlames(car, dt);
        this._driftSmoke(car, dt);
        this._damageSmoke(car, dt);
        if (v.damage > 0.8 && !car.eliminated) {
          v.damage = 0.8;
        }
      }

      if (this.state === "outro") {
        this.stateT -= dtReal;
        if (this.stateT <= 0) this._finishRace(true, null);
      }
    }

    this.rankT -= dtReal;
    if (this.rankT <= 0) {
      this.rankT = 0.18;
      this._computePositions();
    }

    if (this.recording && this.state === "run") {
      this.recT -= dtReal;
      if (this.recT <= 0) {
        this.recT = 0.09;
        const p = this.player.core.pos;
        this.recSamples.push([
          Math.round(this.raceTime * 100) / 100,
          Math.round(p.x * 100) / 100,
          Math.round(p.y * 100) / 100,
          Math.round(p.z * 100) / 100,
          Math.round(this.player.core.yaw * 100) / 100
        ]);
      }
    }

    if (this.ghostView) {
      const g = this.cfg.ghostData.samples;
      const t = this.raceTime;
      while (this.ghostCursor < g.length - 2 && g[this.ghostCursor + 1][0] < t) this.ghostCursor++;
      const a = g[this.ghostCursor];
      const b = g[Math.min(g.length - 1, this.ghostCursor + 1)];
      const span = Math.max(0.001, b[0] - a[0]);
      const f = clamp((t - a[0]) / span, 0, 1);
      this.ghostView.group.position.set(a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f);
      this.ghostView.group.rotation.y = a[4] + (b[4] - a[4]) * f;
      this.ghostView.group.visible = this.state === "run";
    }

    this.fxAdd.update(dt);
    this.fxSmoke.update(dt);
    if (this.headlight) {
      const p = this.player.core;
      this.headlight.position.set(p.pos.x + p.fwdX * 1.6, p.pos.y + 1.4, p.pos.z + p.fwdZ * 1.6);
      this.headlight.target.position.set(p.pos.x + p.fwdX * 30, p.pos.y - 0.5, p.pos.z + p.fwdZ * 30);
      this.headlight.target.updateMatrixWorld();
    }
    this.env.update(dt, this.player.core.pos);
    if (this.rig.victory) {
      this.rig.updateVictory(dtReal, this.player.core);
    } else if (this.state === "countdown") {
      this.rig.cinematic(dtReal, this.player.core, clamp(this.stateT / 3.7, 0, 1));
    } else {
      this.rig.update(dtReal, this.player.core, { shakeEnabled: this.settings.shake });
    }

    this.hudT -= dtReal;
    if (this.hudT <= 0) {
      this.hudT = 0.07;
      this._pushHud();
    }

    this._pushAudio();

    if (hudCb) hudCb(dtReal);
  }

  _pushAudio() {
    const pv = this.player.core;
    let nearest = null;
    let bestD = Infinity;
    for (const c of this.cars) {
      if (c.isPlayer || c.eliminated) continue;
      const d = Math.hypot(c.core.pos.x - pv.pos.x, c.core.pos.z - pv.pos.z);
      if (d < bestD) {
        bestD = d;
        nearest = c;
      }
    }
    this.audio.updateEngines([
      { rpm: pv.rpm, load: pv.input.throttle * 0.8 + 0.2, boost: pv.nitroActive ? pv.boostLevel / 3 : 0 },
      nearest ? { rpm: nearest.core.rpm, load: 0.6, boost: nearest.core.nitroActive ? 0.6 : 0 } : null
    ]);
    this.audio.setSkid(pv.drifting ? 1 : clamp(pv.slip / 12, 0, 0.5));
    this.audio.setWind(clamp(Math.abs(pv.speed) / pv.stats.maxSpeed, 0, 1));
    let intensity = 0.3;
    if (this.state === "run") {
      intensity = 0.38;
      if (this.player.core.progress > (this.laps - 1) * this.track.total) intensity = 0.62;
      if (pv.nitroActive) intensity = 0.85;
      if (this.positions.length && this.player.rank >= Math.ceil(this.positions.length / 2)) intensity += 0.1;
    }
    this.audio.setIntensity(intensity);
  }

  _pushHud() {
    const v = this.player.core;
    const pos = this.positions.length ? this.player.rank || 1 : 1;
    const lap = clamp(Math.floor(v.progress / this.track.total) + 1, 1, this.laps);
    const minimap = this.cars.map((c) => ({
      x: c.core.pos.x,
      z: c.core.pos.z,
      player: c.isPlayer,
      eliminated: c.eliminated
    }));
    this.hud.setState({
      speed: Math.abs(v.speed) * 3.6,
      topSpeedDisplay: v.stats.topSpeed,
      nitro: v.meter,
      boostLevel: v.boostLevel,
      perfectWindow: v.perfectWindow > 0 ? v.perfectWindow / 0.55 : 0,
      pos,
      totalCars: this.cars.length,
      lap,
      laps: this.laps,
      time: this.raceTime,
      damage: v.damage,
      drifting: v.drifting,
      driftMeters: v.drifting ? this.driftChain.dist : 0,
      airborne: !v.grounded,
      wrongWay: v.wrongWayT > 1.2,
      speed01: clamp(Math.abs(v.speed) / v.stats.maxSpeed, 0, 1),
      shockReady: v.meter >= 92,
      minimap,
      elimT: this.mode === "elimination" ? this.elimT : null,
      aliveCount: this.cars.filter((c) => !c.eliminated).length
    });
  }

  _finishRace(success, failReason) {
    if (this.state === "done") return;
    this.state = "done";
    this._computePositions();
    const rows = this.positions.map((c, i) => ({
      pos: i + 1,
      name: c.name,
      car: c.spec.name,
      time: c.core.finished ? c.core.finishTime : null,
      isPlayer: c.isPlayer,
      eliminated: c.eliminated
    }));
    const p = this.player.core;
    const playerRow = rows.find((r) => r.isPlayer);
    const playerPos = playerRow ? playerRow.pos : rows.length;
    const breakdown = [];
    let credits = 0;
    const diffMul = { easy: 0.8, medium: 1, hard: 1.3, expert: 1.6, legend: 2 }[this.cfg.diffKey] || 1;
    if (success) {
      const baseTable = [1400, 1050, 850, 700, 600, 500, 420, 380];
      const base = (baseTable[playerPos - 1] || 350) * diffMul;
      credits += base;
      breakdown.push(["Finish P" + playerPos, Math.round(base)]);
    }
    if (this.mode === "elimination" && success) {
      const bonus = this.eliminatedCount * 160 * diffMul;
      credits += bonus;
      breakdown.push([`Survived ${this.eliminatedCount} rounds`, Math.round(bonus)]);
    }
    const nm = this.stats.nearMisses * 45;
    const kd = this.stats.knockdowns * 260;
    const dr = Math.round(this.player.core.totalDriftDist * 1.6);
    const st = this.stats.stunts * 220;
    const pk = this.stats.pickups * 30;
    credits += nm + kd + dr + st + pk;
    if (nm) breakdown.push([`Near misses ×${this.stats.nearMisses}`, nm]);
    if (kd) breakdown.push([`Knockdowns ×${this.stats.knockdowns}`, kd]);
    if (dr) breakdown.push(["Drift distance", dr]);
    if (st) breakdown.push([`Stunts ×${this.stats.stunts}`, st]);

    let stars = 0;
    const tgt = this.cfg.target || {};
    if (this.cfg.careerId) {
      if (failReason) stars = 0;
      else if (tgt.pos != null) {
        stars = playerPos <= tgt.pos ? (playerPos === 1 ? 3 : 2) : 0;
      } else if (tgt.time != null) {
        stars = p.finishTime <= tgt.time ? (p.finishTime <= tgt.time * 0.94 ? 3 : 2) : 0;
      } else if (tgt.survive) {
        stars = success ? 3 : 0;
      }
      if (stars > 0) credits += 400;
    }

    this.results = {
      success,
      failReason,
      rows,
      playerPos,
      playerTime: p.finished ? p.finishTime : null,
      stats: { ...this.stats, driftDist: p.totalDriftDist, topSpeedKmh: this.stats.topSpeed * 3.6 },
      credits: Math.round(credits),
      breakdown,
      stars,
      ghost: this.recording && this.recSamples.length > 10 && success
        ? { carId: this.cfg.carSpec.id, time: p.finishTime, samples: this.recSamples }
        : null
    };
    this.audio.setIntensity(0.2);
    if (this.cfg.onFinished) this.cfg.onFinished(this.results);
  }

  dispose() {
    this.input.onRespawn = null;
    this.input.onCamera = null;
    this.input.clearTaps();
    this.fxAdd.dispose();
    this.fxSmoke.dispose();
    this.trackScene.dispose();
    this.env.dispose();
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        if (m.map) m.map.dispose();
        m.dispose();
      }
    });
  }
}

const _tmpV = new THREE.Vector3();
