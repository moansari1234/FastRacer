import * as THREE from "three";
import { SaveManager } from "./core/save.js";
import { InputManager } from "./core/input.js";
import { AudioManager } from "./core/audio.js";
import { HUD } from "./ui/hud.js";
import { Screens } from "./ui/screens.js";
import { Race } from "./game/race.js";
import { buildCarMesh, syncCarView } from "./render/vehicleView.js";
import { RenderPipeline } from "./render/postfx.js";
import { initEnvironment } from "./render/materials.js";
import { CAR_MAP, derived } from "./data/cars.js";
import { TRACK_MAP, DIFFICULTIES, CAREER } from "./data/tracks.js";
import { clamp } from "./utils.js";

const IS_TOUCH = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;

function detectQuality(settings) {
  const q = settings.quality;
  if (q !== "auto") return q;
  const cores = navigator.hardwareConcurrency || 4;
  return IS_TOUCH || cores <= 4 ? "medium" : "high";
}

class Game {
  constructor() {
    this.save = new SaveManager();
    this.settings = this.save.settings;
    this.audio = new AudioManager(this.settings);
    this.input = new InputManager();
    this.quality = detectQuality(this.settings);
    this.state = "boot";
    this.race = null;
    this.lastRaceCfg = null;
    this.lastCareerEv = null;
    this.fpsAvg = 60;

    const canvas = document.getElementById("gl");
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.quality !== "low",
      powerPreference: "high-performance"
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = this.quality === "high";
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this._applyPixelRatio();
    this.pipeline = new RenderPipeline(this.renderer, this.quality);

    this.menuScene = this._buildMenuScene();
    initEnvironment(this.renderer, this.menuScene);
    this.menuScene.environmentIntensity = 0.7;
    this.menuCam = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 100);
    this.menuCam.position.set(4.4, 2.0, 5.2);
    this.menuCam.lookAt(0, 0.6, 0);
    this.showcaseGroup = null;
    this.garageRenderer = null;

    this.hudRoot = document.getElementById("hud");
    this.screensEl = document.getElementById("screens-root");
    this.bus = this._buildBus();
    this.screens = new Screens(this.screensEl, this.bus);
    this.hud = new HUD(this.hudRoot, { isTouch: IS_TOUCH, settings: this.settings, input: this.input });

    this.input.onCamera = null;
    this.input.onRespawn = null;
    this.input.onPause = () => this._togglePause();

    window.addEventListener("resize", () => this._onResize());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.state === "race" && !this.paused) this._togglePause();
    });

    const boot = document.getElementById("boot");
    const startFn = () => {
      boot.removeEventListener("click", startFn);
      this.audio.ensure();
      this.audio.startMusic();
      this.audio.setIntensity(0.22);
      boot.classList.add("fade");
      setTimeout(() => boot.remove(), 700);
      this.state = "menu";
      this.screens.show("main");
    };
    boot.addEventListener("click", startFn);

    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
      let reloading = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!reloading) {
          reloading = true;
          location.reload();
        }
      });
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }

    this.clock = new THREE.Clock();
    this._loop();
  }

  _applyPixelRatio() {
    const dpr = window.devicePixelRatio || 1;
    const cap = this.quality === "high" ? 2 : this.quality === "medium" ? 1.5 : 1;
    this.renderer.setPixelRatio(Math.min(dpr, cap));
    this.renderer.setSize(innerWidth, innerHeight);
  }

  _buildMenuScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07090f);
    scene.fog = new THREE.Fog(0x07090f, 12, 40);
    const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x14161c, 0.9);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff2dd, 1.6);
    key.position.set(6, 8, 4);
    scene.add(key);
    const rim = new THREE.PointLight(0x00e5ff, 30, 20);
    rim.position.set(-4, 2.2, -4);
    scene.add(rim);
    const rim2 = new THREE.PointLight(0xff7a18, 24, 18);
    rim2.position.set(4.5, 1.4, -3);
    scene.add(rim2);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(14, 48),
      new THREE.MeshPhongMaterial({ color: 0x0c0f16, shininess: 120, specular: 0x334455 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = false;
    scene.add(floor);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3.1, 0.035, 8, 64),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    scene.add(ring);
    this.menuRing = ring;
    return scene;
  }

  _setShowcaseCar(carId) {
    if (this.showcaseGroup) {
      this.menuScene.remove(this.showcaseGroup.group);
      this.showcaseGroup.group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        mats.forEach((m) => m.dispose());
      });
      this.showcaseGroup = null;
    }
    if (!carId) return;
    const spec = CAR_MAP.get(carId);
    if (!spec) return;
    const snap = this.save;
    const cust = snap.customizationFor(carId);
    const view = buildCarMesh(spec, cust);
    view.group.position.y = 0.02;
    this.menuScene.add(view.group);
    this.showcaseGroup = view;
  }

  _buildBus() {
    return {
      getProfileSnapshot: () => ({
        credits: this.save.profile.credits,
        owned: this.save.profile.owned,
        selectedCar: this.save.profile.selectedCar,
        upgrades: this.save.profile.upgrades,
        customization: this.save.profile.customization,
        stars: this.save.profile.stars,
        careerDone: this.save.profile.careerDone,
        bestTimes: this.save.profile.bestTimes
      }),
      click: () => this.audio.uiClick(),
      buySound: () => this.audio.buy(),
      toast: (msg) => this._toast(msg),
      showcase: (carId, containerEl) => {
        if (containerEl) this._attachGarageView(containerEl);
        else this._detachGarageView();
        if (carId !== this._shownCarId) {
          this._shownCarId = carId;
          this._setShowcaseCar(carId);
          if (this.garageView) this._syncGarageCamera();
        }
      },
      refreshShowcaseStats: () => {},
      selectCar: (id) => {
        this.save.profile.selectedCar = id;
        this.save.saveProfile();
      },
      buy: (id) => this.save.buy(id, CAR_MAP.get(id).price),
      upgrade: (id, stat) => {
        const spec = CAR_MAP.get(id);
        const u = this.save.upgradesFor(id);
        const cost = Math.round(({ D: 1400, C: 2200, B: 3200, A: 4500, S: 6200 })[spec.cls] * Math.pow(u[stat] + 1, 1.65));
        return this.save.upgrade(id, stat, cost);
      },
      setPaint: (id, color) => {
        this.save.customizationFor(id).paint = color;
        this.save.saveProfile();
        this._setShowcaseCar(id);
      },
      setRim: (id, color) => {
        this.save.customizationFor(id).rim = color;
        this.save.saveProfile();
        this._setShowcaseCar(id);
      },
      setSpoiler: (id, sp) => {
        this.save.customizationFor(id).spoiler = sp;
        this.save.saveProfile();
        this._setShowcaseCar(id);
      },
      startQuick: (q) => {
        this.lastCareerEv = null;
        this._launch({
          mode: q.mode,
          trackDef: TRACK_MAP.get(q.trackId),
          laps: q.mode === "elimination" ? 99 : 3,
          rivals: q.mode === "versus" ? 1 : q.mode === "timeattack" ? 0 : 5,
          diffKey: q.diff
        });
      },
      startCareerEvent: (ev) => {
        this.lastCareerEv = ev;
        this._launch({
          mode: ev.mode,
          trackDef: TRACK_MAP.get(ev.track),
          laps: ev.laps,
          rivals: ev.rivals,
          diffKey: ev.diff,
          modifiers: ev.special || {},
          target: ev.target,
          careerId: ev.id,
          rewardCar: ev.rewardCar
        });
      },
      retry: () => {
        if (this.lastRaceCfg) {
          this.lastRaceCfg.seed = Math.floor(Math.random() * 100000);
          this._launchFromCfg(this.lastRaceCfg);
        }
      },
      next: () => {
        const ev = this.lastCareerEv;
        if (ev) {
          const flat = CAREER.flatMap((c) => c.events);
          const idx = flat.findIndex((e) => e.id === ev.id);
          const nxt = flat[idx + 1];
          if (nxt) {
            this.bus.startCareerEvent(nxt);
            return;
          }
        }
        this.exitToMenu();
      },
      hasNext: () => !!this._nextCareerEvent(),
      exitToMenu: () => this.exitToMenu(),
      settings: this.settings,
      setSetting: (k, v) => {
        this.settings[k] = v;
        this.save.saveSettings();
      },
      applySettings: () => {
        this.audio.applyVolumes();
        this.quality = detectQuality(this.settings);
      },
      exportSave: () => {
        const blob = new Blob([this.save.exportSave()], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "nitroapex_save.json";
        a.click();
      },
      importSave: (txt) => this.save.importSave(txt),
      resetSave: () => {
        this.save.resetAll();
        this._setShowcaseCar(null);
        this._shownCarId = null;
      }
    };
  }

  _nextCareerEvent() {
    const ev = this.lastCareerEv;
    if (!ev) return null;
    const flat = CAREER.flatMap((c) => c.events);
    const idx = flat.findIndex((e) => e.id === ev.id);
    return flat[idx + 1] || null;
  }

  _toast(msg) {
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add("in"), 10);
    setTimeout(() => {
      t.classList.remove("in");
      setTimeout(() => t.remove(), 400);
    }, 1800);
  }

  _attachGarageView(container) {
    if (!this.garageRenderer) {
      this.garageRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      this.garageRenderer.outputColorSpace = THREE.SRGBColorSpace;
      this.garageRenderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.garageScene = new THREE.Scene();
      const hemi = new THREE.HemisphereLight(0xcfe4ff, 0x101216, 1);
      this.garageScene.add(hemi);
      const key = new THREE.DirectionalLight(0xffffff, 1.7);
      key.position.set(4, 6, 3);
      this.garageScene.add(key);
      const rim = new THREE.PointLight(0x00e5ff, 26, 16);
      rim.position.set(-3.5, 1.5, -3);
      this.garageScene.add(rim);
      this.garageCam = new THREE.PerspectiveCamera(40, 1.5, 0.1, 50);
      initEnvironment(this.garageRenderer, this.garageScene);
    }
    container.innerHTML = "";
    container.appendChild(this.garageRenderer.domElement);
    const w = container.clientWidth || 480;
    const hgt = container.clientHeight || 260;
    this.garageRenderer.setSize(w, hgt);
    this.garageCam.aspect = w / hgt;
    this.garageCam.updateProjectionMatrix();
    this.garageView = container;
  }

  _detachGarageView() {
    if (this.garageView) {
      this.garageView = null;
    }
  }

  _syncGarageCamera() {}

  _ghostKey(trackId) {
    return `nitroapex_ghost_${trackId}`;
  }

  _launch(partial) {
    const selId = this.save.profile.selectedCar;
    const spec = CAR_MAP.get(selId);
    const stats = derived(spec, this.save.upgradesFor(selId));
    const cust = { ...this.save.customizationFor(selId) };
    const cfg = {
      mode: partial.mode || "race",
      trackDef: partial.trackDef,
      laps: partial.laps != null ? partial.laps : 3,
      rivals: partial.rivals != null ? partial.rivals : 5,
      diffKey: partial.diffKey || "medium",
      diffCfg: DIFFICULTIES[partial.diffKey || "medium"],
      modifiers: partial.modifiers || {},
      target: partial.target || {},
      careerId: partial.careerId || null,
      rewardCar: partial.rewardCar || null,
      carSpec: spec,
      derivedStats: stats,
      customization: cust,
      statProvider: (s) => derived(s, null),
      quality: this.quality,
      particleScale: this.quality === "low" ? 0.5 : this.quality === "medium" ? 0.8 : 1,
      aspect: innerWidth / innerHeight,
      seed: Math.floor(Math.random() * 100000),
      settings: this.settings,
      audio: this.audio,
      input: this.input,
      hud: this.hud,
      isTouch: IS_TOUCH,
      touchDrive: this.settings.touchDrive,
      ghostData: null,
      onSaveGhost: null,
      onFinished: (res) => this._onRaceFinished(res)
    };
    this._launchFromCfg(cfg);
  }

  _launchFromCfg(cfg) {
    this.disposeRace();
    this.screens.hide();
    this.screens.showPause(false);
    this.hud.reset();
    if (!cfg.trackDef) {
      console.error("missing track");
      return;
    }
    if (cfg.mode === "timeattack") {
      try {
        const raw = localStorage.getItem(this._ghostKey(cfg.trackDef.id));
        if (raw) cfg.ghostData = JSON.parse(raw);
      } catch (e) { /* ignore */ }
      cfg.onSaveGhost = (trackId, ghost) => {
        try {
          localStorage.setItem(this._ghostKey(trackId), JSON.stringify(ghost));
        } catch (e) { /* ignore */ }
      };
    }
    this.race = new Race(cfg);
    initEnvironment(this.renderer, this.race.scene);
    this.hud.buildMinimap(this.race.track);
    this.lastRaceCfg = cfg;
    this.state = "race";
    this.paused = false;
    this.input.enabled = true;
    this._detachGarageView();
  }

  _onRaceFinished(res) {
    this.state = "results";
    this.input.enabled = false;
    this.save.addCredits(res.credits);
    if (res.success && this.lastRaceCfg.careerId) {
      this.save.markCareerDone(this.lastRaceCfg.careerId, res.stars);
      const rc = this.lastRaceCfg.rewardCar;
      if (rc && !this.save.owns(rc)) {
        this.save.profile.owned.push(rc);
        this.save.saveProfile();
      }
    }
    if (this.lastRaceCfg.mode === "timeattack" && res.playerTime) {
      const improved = this.save.setBestTime(this.lastRaceCfg.trackDef.id, res.playerTime);
      if (res.ghost && (improved || !localStorage.getItem(this._ghostKey(this.lastRaceCfg.trackDef.id)))) {
        if (this.lastRaceCfg.onSaveGhost) this.lastRaceCfg.onSaveGhost(this.lastRaceCfg.trackDef.id, res.ghost);
      }
    }
    setTimeout(() => {
      this.audio.finish(res.success);
      this.screens.show("results", res);
    }, 900);
  }

  exitToMenu() {
    this.disposeRace();
    this.audio.stopDrivingAudio();
    this.state = "menu";
    this.paused = false;
    this.input.enabled = true;
    this.audio.setIntensity(0.22);
    this.screens.showPause(false);
    this.screens.show("main");
  }

  disposeRace() {
    if (this.race) {
      this.race.dispose();
      this.race = null;
    }
  }

  _togglePause() {
    if (this.state !== "race") return;
    this.paused = !this.paused;
    this.input.enabled = !this.paused;
    this.screens.showPause(this.paused, {
      onResume: () => this._togglePause(),
      onRestart: () => {
        this.paused = false;
        if (this.lastRaceCfg) this._launchFromCfg(this.lastRaceCfg);
      },
      onQuit: () => this.exitToMenu()
    });
    if (this.paused) this.audio.setIntensity(0.15);
  }

  _onResize() {
    this._applyPixelRatio();
    this.pipeline.resize(innerWidth, innerHeight);
    this.menuCam.aspect = innerWidth / innerHeight;
    this.menuCam.updateProjectionMatrix();
    if (this.race) {
      this.race.camera.aspect = innerWidth / innerHeight;
      this.race.camera.updateProjectionMatrix();
    }
    if (this.garageRenderer) {
      const cont = this.garageView;
      if (cont) {
        this.garageRenderer.setSize(cont.clientWidth || 480, cont.clientHeight || 260);
      }
    }
  }

  _loop() {
    requestAnimationFrame(() => this._loop());
    const dt = Math.min(0.05, this.clock.getDelta());
    this.fpsAvg += ((dt > 0 ? 1 / dt : 60) - this.fpsAvg) * 0.05;

    if (this.state === "race" && this.race && !this.paused) {
      this.race.update(dt);
      const v = this.race.player.core;
      this.pipeline.update(clamp(Math.abs(v.speed) / v.stats.maxSpeed, 0, 1), v.boostLevel);
      this.pipeline.render(this.race.scene, this.race.camera);
      this.hud.setFps(this.fpsAvg, this.renderer.info);
    } else if ((this.state === "race" && this.race && this.paused) || (this.state === "results" && this.race)) {
      if (this.state === "results") this.race.update(dt);
      this.pipeline.render(this.race.scene, this.race.camera);
    } else {
      if (this.showcaseGroup) {
        this.showcaseGroup.group.rotation.y += dt * 0.55;
      }
      this.menuRing.rotation.z += dt * 0.4;
      this.pipeline.render(this.menuScene, this.menuCam);
      if (this.garageView && this.garageRenderer && this.showcaseGroup) {
        const g = this.showcaseGroup;
        g.group.rotation.y += dt * 0.35;
        const cam = this.garageCam;
        cam.position.set(3.6, 1.6, 4.2);
        cam.lookAt(0, 0.55, 0);
        this.garageRenderer.render(this.garageScene, cam);
      }
    }
  }
}

const app = new Game();
window.__game = app;
