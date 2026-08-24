import { clamp, lerp, catmullClosed, fmtTime } from "../src/utils.js";
import { CARS, CAR_MAP, derived, rating } from "../src/data/cars.js";
import { TRACKS, TRACK_MAP, CAREER, DIFFICULTIES } from "../src/data/tracks.js";
import { buildTrackData } from "../src/world/trackData.js";
import { VehicleCore, resolveCarCollision } from "../src/physics/vehicleCore.js";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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
function eq(a, b, eps, msg) {
  if (Math.abs(a - b) > eps) throw new Error(`${msg || "num"}: ${a} != ${b}`);
}
function ok(cond, msg) {
  if (!cond) throw new Error(msg || "cond failed");
}

t("utils basics", () => {
  ok(clamp(5, 0, 3) === 3 && clamp(-2, 0, 3) === 0, "clamp");
  eq(lerp(0, 10, 0.5), 5, 1e-9, "lerp");
  ok(fmtTime(83.456) === "1:23.456", "fmtTime");
});

t("car roster integrity", () => {
  ok(CARS.length === 30, `expected 30 cars, got ${CARS.length}`);
  const ids = new Set(CARS.map((c) => c.id));
  ok(ids.size === CARS.length, "duplicate car ids");
  for (const c of CARS) {
    ok(["D", "C", "B", "A", "S"].includes(c.cls), `bad class ${c.id}`);
    ok(c.topSpeed > 180 && c.topSpeed < 450, `bad topSpeed ${c.id}`);
    ok(CAR_MAP.get(c.id) === c, "map mismatch");
    const d = derived(c, null);
    ok(d.maxSpeed > 50 && d.grip > 2, `derived broken ${c.id}`);
    ok(rating(c) > 100, "rating sane");
  }
});

t("tracks referenced by career exist", () => {
  for (const ch of CAREER) {
    for (const ev of ch.events) {
      ok(TRACK_MAP.has(ev.track), `missing track ${ev.track}`);
      ok(DIFFICULTIES[ev.diff], `missing diff ${ev.diff}`);
    }
  }
});

t("track spline sampling", () => {
  for (const def of TRACKS) {
    const trk = buildTrackData(def);
    ok(trk.total > 400, `${def.id} too short: ${trk.total}`);
    ok(trk.n > 100, `${def.id} too few samples`);
    let prev = trk.sampleAt(0);
    for (let s = 0; s < trk.total; s += 7.3) {
      const sm = trk.sampleAt(s);
      const d = Math.hypot(sm.x - prev.x, sm.z - prev.z);
      ok(d < 12, `${def.id} discontinuity ${d.toFixed(1)} at s=${s}`);
      prev = sm;
    }
    const mid = trk.sampleAt(trk.total / 2);
    const nr = trk.nearest(mid.x, mid.z, null);
    ok(Math.abs(nr.lat) < 1.5, `${def.id} nearest lat off: ${nr.lat}`);
    ok(nr.s >= 0 && nr.s < trk.total, "nearest s range");
    const gy = trk.groundYAt(nr.s);
    ok(Number.isFinite(gy), "groundY finite");
    ok(typeof trk.surfAt(123) === "string", "surfAt string");
  }
});

t("ramps raise track height", () => {
  const flat = TRACK_MAP.get("cape");
  const trk = buildTrackData(flat);
  const r = flat.ramps[0];
  const before = trk.sampleAt(r.at * trk.total + r.len * 0.95).y;
  const base = Math.min(...flat.pts.map((p) => p[1]));
  ok(before >= base, "ramp should add height");
});

t("vehicle accelerates and follows track", () => {
  const def = {
    pts: [[0, 0, -200], [200, 0, -200], [200, 0, 200], [-200, 0, 200]],
    width: 20,
    surfaces: [],
    ramps: []
  };
  const trk = buildTrackData(def);
  const stats = derived({ topSpeed: 300, accel: 5.5, handling: 5, nitro: 5 }, null);
  const v = new VehicleCore(stats, true);
  v.place(trk.total - 5, trk, 0);
  v.input.throttle = 1;
  for (let i = 0; i < 60 * 12; i++) {
    const ahead = trk.sampleAt(v.s + 14);
    const tx = ahead.x - v.pos.x;
    const tz = ahead.z - v.pos.z;
    v.input.steer = Math.max(-1, Math.min(1, Math.atan2(tx * v.rightX + tz * v.rightZ, tx * v.fwdX + tz * v.fwdZ) * 2));
    v.step(1 / 60, trk, { surfGrip: () => 1, weatherGrip: 1 });
  }
  ok(v.speed > 35, `should be fast after 12s, got ${v.speed.toFixed(1)}`);
  const nr = trk.nearest(v.pos.x, v.pos.z, v.idx);
  ok(Math.abs(nr.lat) < trk.halfW, `stayed on track, lat=${nr.lat}`);
  ok(v.progress > 30 * 5, `progress moved ${v.progress}`);
  ok(v.lap === 0, "lap field untouched by core");
});

t("walls constrain vehicle", () => {
  const def = { pts: [[0, 0, -60], [60, 0, 0], [0, 0, 60], [-60, 0, 0]], width: 16, surfaces: [], ramps: [] };
  const trk = buildTrackData(def);
  const stats = derived({ topSpeed: 260, accel: 7, handling: 4, nitro: 4 }, null);
  const v = new VehicleCore(stats, true);
  v.place(10, trk, 0);
  v.input.throttle = 1;
  v.input.steer = 1;
  let hitWall = false;
  for (let i = 0; i < 60 * 8; i++) {
    v.input.steer = 1;
    v.step(1 / 60, trk, { surfGrip: () => 1 });
    if (v.events.some((e) => e.type === "wall")) hitWall = true;
  }
  const nr = trk.nearest(v.pos.x, v.pos.z, v.idx);
  ok(hitWall, "wall event fired");
  ok(Math.abs(nr.lat) <= trk.halfW - 0.8 + 1e-6, `lat clamped: ${Math.abs(nr.lat)} vs ${trk.halfW}`);
  ok(v.damage > 0, "damage from wall");
});

t("nitro state machine", () => {
  const stats = derived({ topSpeed: 320, accel: 4, handling: 6, nitro: 7 }, null);
  const v = new VehicleCore(stats, true);
  v.meter = 100;
  ok(v.requestNitroTap() === 1, "first tap starts normal");
  ok(v.boostLevel === 1, "level 1");
  v.perfectWindow = 0.4;
  ok(v.requestNitroTap() === 2, "second tap upgrades to perfect");
  ok(v.boostLevel === 2, "level 2");
  ok(v.requestShockwave(), "shockwave requires >=92");
  ok(v.boostLevel === 3, "level 3");
  v.endBoost();
  ok(v.boostLevel === 0, "reset");
  v.meter = 10;
  ok(v.requestShockwave() === false, "shock denied when low");
});

t("nitro drains and ends", () => {
  const stats = derived({ topSpeed: 280, accel: 6, handling: 5, nitro: 5 }, null);
  const def = { pts: [[0, 0, -100], [100, 0, 0], [0, 0, 100], [-100, 0, 0]], width: 18, surfaces: [], ramps: [] };
  const trk = buildTrackData(def);
  const v = new VehicleCore(stats, true);
  v.place(5, trk, 0);
  v.meter = 20;
  v.requestNitroTap();
  v.input.throttle = 1;
  for (let i = 0; i < 600; i++) v.step(1 / 60, trk, { surfGrip: () => 1 });
  ok(!v.nitroActive || v.meter > 0, "boost ended when meter empty");
});

t("car collision impulse", () => {
  const stats = derived({ topSpeed: 250, accel: 6, handling: 5, nitro: 5 }, null);
  const a = new VehicleCore(stats, false);
  const b = new VehicleCore(stats, false);
  a.pos.x = -1;
  b.pos.x = 1.5;
  a.vx = 30;
  b.vx = 0;
  const hit = resolveCarCollision(a, b);
  ok(hit, "hit detected");
  ok(a.vx < 29.99 && b.vx > 0, "momentum transferred");
});

t("service worker precache matches disk", () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const swText = readFileSync(join(root, "sw.js"), "utf8");
  const m = swText.match(/PRECACHE_START([\s\S]*?)PRECACHE_END/);
  ok(m, "precache block found");
  const list = eval(m[1].match(/\[[\s\S]*\]/)[0]);
  ok(list.length >= 20, `precache has entries: ${list.length}`);
  for (const entry of list) {
    const p = join(root, entry.replace(/^\.\//, ""));
    ok(existsSync(p), `missing from disk: ${entry}`);
  }
  const required = ["./index.html", "./css/style.css", "./vendor/three.module.js", "./src/main.js", "./manifest.webmanifest", "./icon.svg"];
  for (const req of required) ok(list.includes(req), `precache missing ${req}`);
  const srcDir = join(root, "src");
  const walk = (d) =>
    readdirSync(d, { withFileTypes: true }).flatMap((e) => {
      const full = join(d, e.name);
      return e.isDirectory() ? walk(full) : e.name.endsWith(".js") ? [full] : [];
    });
  for (const file of walk(srcDir)) {
    const rel = "./" + file.slice(root.length + 1).replace(/\\/g, "/");
    ok(list.includes(rel), `source not precached: ${rel}`);
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
