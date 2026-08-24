import { CAR_MAP, derived } from "../src/data/cars.js";
import { TRACK_MAP, DIFFICULTIES } from "../src/data/tracks.js";

// shared stubs for integration tests
function makeCtxStub() {
  const stub = new Proxy(function () {}, {
    get(target, prop) {
      if (prop === Symbol.toPrimitive) return () => 0;
      if (prop === "canvas") return { width: 300, height: 150 };
      return stub;
    },
    apply() { return stub; },
    set() { return true; }
  });
  return stub;
}

function silentAudio() {
  const noop = () => {};
  return {
    collision: noop,
    scrape: noop,
    nitroStart: noop,
    nearMiss: noop,
    knockdown: noop,
    checkpoint: noop,
    countdown: noop,
    pickup: noop,
    uiClick: noop,
    buy: noop,
    finish: noop,
    eliminated: noop,
    thunder: noop,
    updateEngines: noop,
    setSkid: noop,
    setWind: noop,
    setIntensity: noop,
    startMusic: noop,
    stopMusic: noop
  };
}

function stubInput() {
  return {
    enabled: true,
    keys: new Set(),
    read: () => ({ throttle: 1, brake: 0, steer: 0, drift: false }),
    consumeNitroTap: () => 0,
    consumeShockTap: () => 0,
    clearTaps() {},
    setVirtual() {}
  };
}

function stubHud() {
  return {
    notify() {},
    showCountdown() {},
    setState() {},
    flash() {},
    buildMinimap() {},
    reset() {},
    setFps() {}
  };
}

function makeCfg(over) {
  const spec = CAR_MAP.get("vento");
  return Object.assign(
    {
      mode: "race",
      trackDef: TRACK_MAP.get("cape"),
      laps: 2,
      rivals: 3,
      diffKey: "easy",
      diffCfg: DIFFICULTIES.easy,
      modifiers: {},
      target: {},
      careerId: null,
      rewardCar: null,
      carSpec: spec,
      derivedStats: derived(spec, null),
      customization: { paint: spec.color, rim: "#181c22", spoiler: "stock" },
      statProvider: (s) => derived(s, null),
      quality: "low",
      particleScale: 0.4,
      aspect: 16 / 9,
      seed: 777,
      settings: { cam: "chase", shake: true, speedLines: true, fps: false },
      audio: silentAudio(),
      input: stubInput(),
      hud: stubHud(),
      isTouch: false,
      touchDrive: false,
      ghostData: null,
      onSaveGhost: null,
      onFinished: null
    },
    over
  );
}


export { makeCfg, silentAudio, stubInput, stubHud };
export { makeCtxStub };
