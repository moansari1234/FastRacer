function makeCtxStub() {
  const stub = new Proxy(function () {}, {
    get(target, prop) {
      if (prop === Symbol.toPrimitive) return () => 0;
      if (prop === "canvas") return { width: 300, height: 150 };
      return stub;
    },
    apply() {
      return stub;
    },
    set() {
      return true;
    }
  });
  return stub;
}

import { makeCfg } from "./helpers.mjs";

globalThis.document = {
  createElement(tag) {
    return {
      tag,
      style: {},
      width: 300,
      height: 150,
      clientWidth: 480,
      clientHeight: 260,
      getContext: () => makeCtxStub(),
      addEventListener() {},
      removeEventListener() {},
      appendChild() {},
      querySelector: () => null,
      querySelectorAll: () => []
    };
  }
};
globalThis.window = globalThis;
Object.defineProperty(globalThis, "navigator", {
  value: { hardwareConcurrency: 8, maxTouchPoints: 0 },
  configurable: true
});

const { Race } = await import("../src/game/race.js");
const { TRACK_MAP, DIFFICULTIES } = await import("../src/data/tracks.js");
const { CAR_MAP, derived } = await import("../src/data/cars.js");

let pass = 0;
let fail = 0;
function t(name, fn) {
  try {
    fn();
    pass++;
    console.log("PASS", name);
  } catch (e) {
    fail++;
    console.error("FAIL", name, "-", e.message);
  }
}
function ok(cond, msg) {
  if (!cond) throw new Error(msg || "cond failed");
}

t("race constructs and runs countdown then driving", () => {
  const race = new Race(makeCfg({ modifiers: { noTraffic: true } }));
  ok(race.cars.length === 4, "player + 3 rivals");
  ok(race.state === "countdown", "starts in countdown");
  const behindDist = (c) => race.track.total - c.core.s;
  const pB = behindDist(race.player);
  const rB = race.cars.filter((c) => !c.isPlayer).map(behindDist);
  ok(pB >= Math.max(...rB) - 0.01 && pB > Math.min(...rB), "player starts from the back of the grid");
  for (let i = 0; i < 260; i++) race.update(1 / 60);
  ok(race.state === "run", "reached run state");
  let maxSpeed = 0;
  for (let i = 0; i < 60 * 10; i++) {
    race.update(1 / 60);
    maxSpeed = Math.max(maxSpeed, Math.abs(race.player.core.speed));
  }
  ok(maxSpeed > 30 && maxSpeed < 42, `D-class car accelerated believably: ${maxSpeed.toFixed(1)} m/s`);
  ok(race.positions.length === 4, "positions computed");
  ok(race.player.core.progress > 50, "progress advanced");
  race.dispose();
});

t("class separation — S-class decisively faster than D-class", () => {
  const buildAndDrive = (carId, seconds) => {
    const spec = CAR_MAP.get(carId);
    const race = new Race(makeCfg({
      modifiers: { noTraffic: true },
      rivals: 0,
      carSpec: spec,
      derivedStats: derived(spec, null)
    }));
    for (let i = 0; i < 260; i++) race.update(1 / 60);
    let maxSpeed = 0;
    for (let i = 0; i < 60 * seconds; i++) {
      race.update(1 / 60);
      maxSpeed = Math.max(maxSpeed, Math.abs(race.player.core.speed));
    }
    race.dispose();
    return maxSpeed;
  };
  const dSpeed = buildAndDrive("vento", 10);
  const sSpeed = buildAndDrive("spectre", 10);
  ok(dSpeed > 28 && dSpeed < 44, `D-class believable: ${dSpeed.toFixed(1)} m/s`);
  ok(sSpeed > dSpeed + 12, `S-class separation: ${sSpeed.toFixed(1)} vs ${dSpeed.toFixed(1)} m/s`);
});

t("AI opponents move and rank", () => {
  const race = new Race(makeCfg({}));
  for (let i = 0; i < 260; i++) race.update(1 / 60);
  for (let i = 0; i < 60 * 6; i++) race.update(1 / 60);
  const moved = race.drivers.filter((d) => d.car.core.progress > 40);
  ok(moved.length >= Math.max(1, race.drivers.length - 1), `AIs moving: ${moved.length}/${race.drivers.length}`);
  race.dispose();
});

t("traffic spawns and animates", () => {
  const race = new Race(makeCfg({}));
  ok(race.traffic.length > 0, "traffic present on cape");
  for (let i = 0; i < 120; i++) race.update(1 / 60);
  race.dispose();
});

t("time attack ghost playback", () => {
  const ghost = {
    carId: "vento",
    time: 30,
    samples: [
      [0, 0, 0, -160, 0],
      [2, 4, 0, -156, 0.1],
      [5, 10, 0, -150, 0.3],
      [7, 18, 0, -145, 0.4],
      [10, 25, 0, -140, 0.5],
      [12, 31, 0, -136, 0.6]
    ]
  };
  const race = new Race(makeCfg({ mode: "timeattack", rivals: 0, ghostData: ghost }));
  ok(race.ghostView, "ghost view created");
  for (let i = 0; i < 200; i++) race.update(1 / 60);
  ok(Number.isFinite(race.ghostView.group.position.x), "ghost positioned");
  race.dispose();
});

t("race finishes and produces rewards", () => {
  let results = null;
  const race = new Race(makeCfg({ onFinished: (r) => (results = r), careerId: "c1e1", target: { pos: 3 } }));
  for (let i = 0; i < 260; i++) race.update(1 / 60);
  race.player.core.progress = race.totalRacing + 1;
  for (let i = 0; i < 200 && !results; i++) race.update(1 / 60);
  ok(results, "results delivered");
  ok(results.success === true, "success flag");
  ok(results.rows.length === 4, "all rows present");
  ok(results.credits > 0, `credits granted ${results.credits}`);
  ok(results.stars > 0, "stars earned vs easy P-target");
  race.dispose();
});

t("elimination eliminates last place over time", () => {
  const race = new Race(makeCfg({ mode: "elimination", laps: 99 }));
  for (let i = 0; i < 260; i++) race.update(1 / 60);
  for (let i = 0; i < 60 * 21; i++) race.update(1 / 60);
  ok(race.eliminatedCount >= 1 || race.state === "done", "an elimination happened");
  race.dispose();
});

t("modifiers infNitro keeps meter full", () => {
  const race = new Race(makeCfg({ modifiers: { infNitro: true } }));
  for (let i = 0; i < 260; i++) race.update(1 / 60);
  race.player.core.meter = 5;
  race.update(1 / 60);
  ok(race.player.core.meter === 100, "meter refilled");
  race.dispose();
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

export { makeCfg };
