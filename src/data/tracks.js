export const TRACKS = [
  {
    id: "cape",
    name: "Cape Vela",
    theme: "coast",
    laps: 3,
    width: 15,
    weather: "clear",
    time: "day",
    pts: [
      [0, 0, -170], [125, 2, -145], [195, 5, -60], [172, 8, 42],
      [214, 10, 122], [142, 6, 202], [20, 3, 222], [-92, 5, 182],
      [-162, 9, 82], [-142, 12, -32], [-192, 7, -112], [-112, 2, -175]
    ],
    surfaces: [{ f0: 0.62, f1: 0.68, type: "dirt" }],
    ramps: [{ at: 0.34, len: 46, height: 5 }],
    decor: { palms: 90, rocks: 40 },
    traffic: { count: 8, speed: 13 },
    nitroPads: 6,
    unlockStars: 0,
    desc: "Sun-splashed seaside sweepers with a cliff jump."
  },
  {
    id: "dune",
    name: "Dune Rush",
    theme: "desert",
    laps: 3,
    width: 17,
    weather: "clear",
    time: "sunset",
    pts: [
      [0, 0, -245], [152, 0, -232], [262, 1, -150], [284, 3, -22],
      [262, 6, 108], [304, 11, 202], [178, 13, 252], [58, 10, 238],
      [0, 8, 178], [-122, 6, 198], [-232, 4, 138], [-262, 2, -2],
      [-222, 0, -132], [-102, 0, -235]
    ],
    surfaces: [{ f0: 0.18, f1: 0.30, type: "dirt" }, { f0: 0.72, f1: 0.80, type: "dirt" }],
    ramps: [{ at: 0.52, len: 55, height: 7 }, { at: 0.88, len: 40, height: 4 }],
    decor: { cacti: 70, rocks: 80 },
    traffic: { count: 5, speed: 12 },
    nitroPads: 6,
    unlockStars: 0,
    desc: "Blistering desert straights, dirt cuts and mega jumps."
  },
  {
    id: "neon",
    name: "Neo Kanto Nights",
    theme: "city",
    laps: 3,
    width: 16,
    weather: "clear",
    time: "night",
    pts: [
      [-185, 0, -185], [0, 0, -188], [186, 0, -184], [188, 0, -62],
      [62, 0, -60], [60, 0, 62], [186, 0, 60], [188, 0, 186],
      [0, 0, 188], [-186, 0, 186], [-188, 0, 62], [-62, 0, 60],
      [-60, 0, -62], [-186, 0, -60]
    ],
    surfaces: [],
    ramps: [],
    decor: { buildings: 110, neons: 40 },
    traffic: { count: 14, speed: 12 },
    nitroPads: 7,
    unlockStars: 2,
    desc: "Neon canyon streets packed with traffic. Thread the needle."
  },
  {
    id: "alpine",
    name: "Alpine Ridge",
    theme: "mountain",
    laps: 3,
    width: 14,
    weather: "clear",
    time: "day",
    pts: [
      [-240, 0, -140], [-100, 1, -215], [80, 2, -215], [205, 5, -135],
      [255, 7, -55], [195, 10, -10], [255, 13, 65], [215, 17, 150],
      [95, 21, 205], [-70, 22, 215], [-195, 19, 140], [-255, 14, 20],
      [-285, 7, -105]
    ],
    surfaces: [{ f0: 0.44, f1: 0.50, type: "dirt" }],
    ramps: [{ at: 0.66, len: 48, height: 6 }],
    decor: { pines: 120, rocks: 90 },
    traffic: { count: 6, speed: 12 },
    nitroPads: 6,
    unlockStars: 5,
    desc: "A climbing ridge road with switchbacks and thin air."
  },
  {
    id: "frost",
    name: "Frostline",
    theme: "snow",
    laps: 3,
    width: 18,
    weather: "snow",
    time: "night",
    pts: [
      [0, 0, -205], [132, 0, -162], [204, 0, -42], [162, 0, 78],
      [222, 0, 168], [92, 0, 218], [-62, 0, 202], [-162, 0, 118],
      [-122, 0, 8], [-222, 0, -62], [-162, 0, -162]
    ],
    surfaces: [{ f0: 0.05, f1: 0.45, type: "ice" }, { f0: 0.55, f1: 0.95, type: "ice" }],
    ramps: [{ at: 0.5, len: 44, height: 5 }],
    decor: { pines: 100, rocks: 50, iceCrystals: 30 },
    traffic: { count: 4, speed: 11 },
    nitroPads: 7,
    unlockStars: 9,
    desc: "Blizzard night on black ice. Grip is a rumor."
  },
  {
    id: "aurora",
    name: "Aurora Loop",
    theme: "future",
    laps: 3,
    width: 15,
    weather: "clear",
    time: "sunset",
    pts: [
      [0, 4, -222], [140, 8, -172], [222, 12, -42], [182, 16, 88],
      [242, 20, 178], [112, 22, 240], [-42, 18, 232], [-142, 14, 148],
      [-82, 10, 38], [-182, 8, -42], [-122, 4, -158]
    ],
    surfaces: [{ f0: 0.40, f1: 0.46, type: "metal" }],
    ramps: [{ at: 0.24, len: 60, height: 8 }, { at: 0.74, len: 52, height: 6 }],
    decor: { pylons: 80, rings: 14 },
    traffic: { count: 0, speed: 0 },
    nitroPads: 8,
    unlockStars: 14,
    desc: "Hover-pylons, light rings and double launch decks."
  },
  {
    id: "tempest",
    name: "Tempest Isle",
    theme: "tropical",
    laps: 3,
    width: 15,
    weather: "storm",
    time: "day",
    pts: [
      [0, 0, -185], [112, 0, -162], [182, 2, -62], [152, 4, 40],
      [212, 8, 128], [122, 12, 208], [-12, 14, 228], [-122, 10, 188],
      [-92, 6, 78], [-172, 3, 8], [-122, 0, -102]
    ],
    surfaces: [{ f0: 0.30, f1: 0.36, type: "dirt" }],
    ramps: [{ at: 0.58, len: 50, height: 7 }],
    decor: { palms: 110, rocks: 60 },
    traffic: { count: 6, speed: 12 },
    nitroPads: 6,
    unlockStars: 18,
    desc: "Monsoon winds, flooded palms and a volcano jump."
  }
];

export const TRACK_MAP = new Map(TRACKS.map((t) => [t.id, t]));

export const DIFFICULTIES = {
  easy: { label: "Easy", speed: 0.76, corner: 0.78, mistake: 0.35, rubber: 0.86 },
  medium: { label: "Medium", speed: 0.86, corner: 0.87, mistake: 0.18, rubber: 0.92 },
  hard: { label: "Hard", speed: 0.94, corner: 0.95, mistake: 0.08, rubber: 0.96 },
  expert: { label: "Expert", speed: 1.0, corner: 1.02, mistake: 0.03, rubber: 1.0 },
  legend: { label: "Legend", speed: 1.06, corner: 1.09, mistake: 0.0, rubber: 1.04 }
};

export const CAREER = [
  {
    chapter: 1,
    name: "Rookie Run",
    needStars: 0,
    events: [
      { id: "c1e1", name: "First Gear", mode: "race", track: "cape", laps: 2, diff: "easy", rivals: 3, target: { pos: 3 }, reward: 1500, desc: "Finish top 3 on the coast." },
      { id: "c1e2", name: "Clock Crusher", mode: "timeattack", track: "cape", laps: 2, diff: "easy", rivals: 0, target: { time: 150 }, reward: 1800, desc: "Lap Cape Vela twice under 2:30." },
      { id: "c1e3", name: "Dust-Up", mode: "race", track: "dune", laps: 2, diff: "easy", rivals: 4, target: { pos: 3 }, reward: 2200, rewardCar: "kodo", desc: "Tame the dunes. Top 3." },
      { id: "c1e4", name: "Shockwave Sprint", mode: "race", track: "dune", laps: 2, diff: "medium", rivals: 4, target: { pos: 2 }, reward: 2800, special: { infNitro: true }, desc: "Infinite nitro. Hold nothing back." }
    ]
  },
  {
    chapter: 2,
    name: "City Lights",
    needStars: 6,
    events: [
      { id: "c2e1", name: "Neon Runner", mode: "race", track: "neon", laps: 2, diff: "medium", rivals: 5, target: { pos: 3 }, reward: 3200, desc: "Survive downtown traffic. Top 3." },
      { id: "c2e2", name: "Last Man Standing", mode: "elimination", track: "neon", laps: 99, diff: "medium", rivals: 5, target: { survive: true }, reward: 3800, desc: "Eliminations every 20 seconds." },
      { id: "c2e3", name: "Ridge Duel", mode: "versus", track: "alpine", laps: 2, diff: "hard", rivals: 1, target: { pos: 1 }, reward: 4200, rewardCar: "silhouette", desc: "Beat the Ridge King 1-on-1." },
      { id: "c2e4", name: "Blade Trial", mode: "timeattack", track: "alpine", laps: 2, diff: "hard", rivals: 0, target: { time: 165 }, reward: 5000, desc: "Prove your pace under 2:45." }
    ]
  },
  {
    chapter: 3,
    name: "Legend Status",
    needStars: 14,
    events: [
      { id: "c3e1", name: "Ice Breaker", mode: "race", track: "frost", laps: 3, diff: "hard", rivals: 5, target: { pos: 3 }, reward: 5500, desc: "Podium on pure ice." },
      { id: "c3e2", name: "Storm Chaser", mode: "elimination", track: "tempest", laps: 99, diff: "hard", rivals: 5, target: { survive: true }, reward: 6500, desc: "Outlast them all in the monsoon." },
      { id: "c3e3", name: "Light Speed", mode: "race", track: "aurora", laps: 3, diff: "expert", rivals: 5, target: { pos: 1 }, reward: 8000, desc: "Win on the Aurora Loop." },
      { id: "c3e4", name: "Grand Final", mode: "race", track: "tempest", laps: 3, diff: "legend", rivals: 7, target: { pos: 1 }, reward: 12000, rewardCar: "monarch", desc: "Eight cars. One legend." }
    ]
  }
];

export function careerEvent(id) {
  for (const ch of CAREER) {
    for (const ev of ch.events) if (ev.id === id) return ev;
  }
  return null;
}
