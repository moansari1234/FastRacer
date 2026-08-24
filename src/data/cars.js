export const CLASSES = ["D", "C", "B", "A", "S"];

export function rating(spec) {
  const accelScore = (27.8 / Math.max(2.2, spec.accel)) * 3.4;
  return spec.topSpeed * 0.42 + accelScore + spec.handling * 4.6 + spec.nitro * 3.1;
}

export function derived(spec, upgrades) {
  const u = upgrades || { topSpeed: 0, accel: 0, handling: 0, nitro: 0 };
  const bonus = (lvl) => 1 + lvl * 0.045;
  const topSpeed = spec.topSpeed * bonus(u.topSpeed);
  const accel = spec.accel / bonus(u.accel);
  const handling = spec.handling * bonus(u.handling);
  const nitro = spec.nitro * bonus(u.nitro);
  return {
    topSpeed,
    accel,
    handling,
    nitro,
    maxSpeed: topSpeed / 3.6,
    accelRate: 27.8 / Math.max(2.0, accel),
    dragK: (0.52 * (27.8 / Math.max(2.0, accel))) / Math.pow(topSpeed / 3.6, 2),
    grip: 2.05 + handling * 0.155,
    steerResp: 5.5 + handling * 0.55,
    nitroPower: 0.75 + nitro * 0.075,
    nitroGain: 0.8 + nitro * 0.05,
    starLevel: Math.min(5, Math.floor(((u.topSpeed + u.accel + u.handling + u.nitro) / 20) * 5))
  };
}

export const CARS = [
  { id: "vento", name: "Vento Mini", cls: "D", price: 0, topSpeed: 212, accel: 9.4, handling: 3.2, nitro: 3.0, shape: "hatch", color: "#e8542f", unlock: null },
  { id: "kodo", name: "Kodo Hatch R", cls: "D", price: 8500, topSpeed: 228, accel: 8.7, handling: 3.8, nitro: 3.2, shape: "hatch", color: "#2f9de8", unlock: null },
  { id: "pixie", name: "Pixie Turbo", cls: "D", price: 11000, topSpeed: 236, accel: 8.2, handling: 4.1, nitro: 3.4, shape: "hatch", color: "#f2c230", unlock: null },
  { id: "rusty", name: "Rusty Rod", cls: "D", price: 13500, topSpeed: 244, accel: 7.9, handling: 3.5, nitro: 3.8, shape: "muscle", color: "#8a6d4b", unlock: null },
  { id: "nano", name: "Nano EV", cls: "D", price: 16000, topSpeed: 240, accel: 7.2, handling: 4.4, nitro: 3.6, shape: "exotic", color: "#dfe6ec", unlock: null },

  { id: "silhouette", name: "Silhouette S2", cls: "C", price: 22000, topSpeed: 258, accel: 7.4, handling: 4.6, nitro: 4.0, shape: "gt", color: "#b02f3a", unlock: null },
  { id: "falcone350", name: "Falcone 350", cls: "C", price: 27000, topSpeed: 268, accel: 7.0, handling: 4.4, nitro: 4.2, shape: "muscle", color: "#20242c", unlock: null },
  { id: "driftking", name: "Drift King MK", cls: "C", price: 31000, topSpeed: 264, accel: 7.2, handling: 5.2, nitro: 4.4, shape: "gt", color: "#e8e2d4", unlock: null },
  { id: "kestrel", name: "Kestrel T", cls: "C", price: 34000, topSpeed: 276, accel: 6.7, handling: 4.8, nitro: 4.5, shape: "rally", color: "#3a7d44", unlock: null },
  { id: "bandit", name: "Bandit V8", cls: "C", price: 38000, topSpeed: 282, accel: 6.5, handling: 4.5, nitro: 4.8, shape: "muscle", color: "#7a1fa2", unlock: null },

  { id: "vipera", name: "Vipera RT", cls: "B", price: 48000, topSpeed: 294, accel: 6.1, handling: 5.2, nitro: 5.0, shape: "gt", color: "#d4af37", unlock: { stars: 3 } },
  { id: "storme", name: "Storme GT", cls: "B", price: 55000, topSpeed: 300, accel: 5.9, handling: 5.5, nitro: 5.2, shape: "gt", color: "#1d6fd1", unlock: { stars: 4 } },
  { id: "machina", name: "Machina 5", cls: "B", price: 60000, topSpeed: 306, accel: 5.8, handling: 5.4, nitro: 5.5, shape: "super", color: "#c0c7cf", unlock: { stars: 5 } },
  { id: "nighthawk", name: "Nighthawk Z", cls: "B", price: 66000, topSpeed: 312, accel: 5.6, handling: 5.7, nitro: 5.6, shape: "super", color: "#101418", unlock: { stars: 6 } },
  { id: "rallyefox", name: "Rallye Fox 04", cls: "B", price: 70000, topSpeed: 304, accel: 5.7, handling: 6.2, nitro: 5.4, shape: "rally", color: "#e03a2f", unlock: { stars: 7 } },
  { id: "tempest", name: "Tempest S", cls: "B", price: 76000, topSpeed: 318, accel: 5.5, handling: 5.8, nitro: 5.8, shape: "super", color: "#0fb8a9", unlock: { stars: 8 } },

  { id: "falconeevo", name: "Falcone Evo", cls: "A", price: 90000, topSpeed: 330, accel: 5.0, handling: 6.0, nitro: 6.0, shape: "super", color: "#ff8c1a", unlock: { stars: 10 } },
  { id: "vulcan", name: "Vulcan GTR", cls: "A", price: 100000, topSpeed: 338, accel: 4.8, handling: 6.3, nitro: 6.2, shape: "super", color: "#39424e", unlock: { stars: 12 } },
  { id: "corsavita", name: "Corsa Vita", cls: "A", price: 108000, topSpeed: 332, accel: 4.9, handling: 6.8, nitro: 6.1, shape: "exotic", color: "#f5e663", unlock: { stars: 13 } },
  { id: "spectre", name: "Spectre R", cls: "A", price: 118000, topSpeed: 346, accel: 4.6, handling: 6.5, nitro: 6.5, shape: "hyper", color: "#57e389", unlock: { stars: 15 } },
  { id: "auroch", name: "Auroch 4X", cls: "A", price: 126000, topSpeed: 328, accel: 4.8, handling: 7.0, nitro: 6.3, shape: "rally", color: "#8d99ae", unlock: { stars: 16 } },
  { id: "bladenine", name: "Blade Nine", cls: "A", price: 138000, topSpeed: 352, accel: 4.5, handling: 6.6, nitro: 6.7, shape: "hyper", color: "#e8336d", unlock: { event: "c2e4" } },

  { id: "seraph", name: "Seraph X1", cls: "S", price: 175000, topSpeed: 366, accel: 4.0, handling: 7.0, nitro: 7.0, shape: "hyper", color: "#00e5ff", unlock: { stars: 19 } },
  { id: "monarch", name: "Monarch SS", cls: "S", price: 195000, topSpeed: 374, accel: 3.8, handling: 7.2, nitro: 7.2, shape: "hyper", color: "#f2f2f2", unlock: { stars: 21 } },
  { id: "halcyon", name: "Halcyon LM", cls: "S", price: 215000, topSpeed: 380, accel: 3.7, handling: 7.5, nitro: 7.3, shape: "hyper", color: "#7c4dff", unlock: { stars: 23 } },
  { id: "voidrunner", name: "Void Runner", cls: "S", price: 245000, topSpeed: 388, accel: 3.5, handling: 7.6, nitro: 7.6, shape: "concept", color: "#12125a", unlock: { event: "c3e3" } },
  { id: "zenith", name: "Zenith SSR", cls: "S", price: 290000, topSpeed: 396, accel: 3.3, handling: 7.8, nitro: 7.8, shape: "concept", color: "#ffb300", unlock: { stars: 27 } },
  { id: "solenne", name: "Solenne R", cls: "S", price: 265000, topSpeed: 392, accel: 3.4, handling: 7.7, nitro: 7.7, shape: "hyper", color: "#9ef01a", unlock: { stars: 25 } },
  { id: "phantom", name: "Phantom GT1", cls: "S", price: 340000, topSpeed: 404, accel: 3.2, handling: 8.0, nitro: 8.0, shape: "concept", color: "#22262b", unlock: { stars: 30 } },
  { id: "novaimperator", name: "Nova Imperator", cls: "S", price: 420000, topSpeed: 418, accel: 3.0, handling: 8.2, nitro: 8.4, shape: "concept", color: "#ff2d55", unlock: { stars: 34 } }
];

export const CAR_MAP = new Map(CARS.map((c) => [c.id, c]));

export const PAINTS = ["#e8542f", "#f2c230", "#2f9de8", "#0fb8a9", "#57e389", "#e8336d", "#7c4dff", "#f2f2f2", "#20242c", "#8a6d4b"];
export const RIMS = ["#cfd6dd", "#181c22", "#d4af37", "#b02f3a", "#00e5ff"];

export function upgradeCost(spec, stat, level) {
  const base = { D: 1400, C: 2200, B: 3200, A: 4500, S: 6200 }[spec.cls];
  return Math.round(base * Math.pow(level + 1, 1.65));
}
