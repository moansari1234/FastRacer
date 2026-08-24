import { catmull } from "../utils.js";

export const SURFACES = {
  asphalt: { grip: 1.0, name: "Asphalt" },
  dirt: { grip: 0.72, name: "Dirt" },
  ice: { grip: 0.42, name: "Ice" },
  metal: { grip: 1.06, name: "Metal" }
};

export function buildTrackData(def) {
  const pts = def.pts;
  const n_pts = pts.length;
  const subs = [];
  let approx = 0;
  for (let i = 0; i < n_pts; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n_pts];
    const d = Math.hypot(b[0] - a[0], b[2] - a[2]);
    approx += d;
    subs.push(Math.max(6, Math.min(70, Math.round(d / 3))));
  }
  const raw = [];
  for (let i = 0; i < n_pts; i++) {
    const p0 = pts[(i - 1 + n_pts) % n_pts];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n_pts];
    const p3 = pts[(i + 2) % n_pts];
    for (let j = 0; j < subs[i]; j++) {
      raw.push(catmull(p0, p1, p2, p3, j / subs[i]));
    }
  }
  const n = raw.length;
  const px = new Float32Array(n);
  const pyBase = new Float32Array(n);
  const pz = new Float32Array(n);
  const tx = new Float32Array(n);
  const tz = new Float32Array(n);
  const nx = new Float32Array(n);
  const nz = new Float32Array(n);
  const cum = new Float32Array(n + 1);
  const curv = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    px[i] = raw[i][0];
    pyBase[i] = raw[i][1];
    pz[i] = raw[i][2];
  }
  for (let i = 0; i < n; i++) {
    const a = i;
    const b = (i + 1) % n;
    let dx = px[b] - px[a];
    let dz = pz[b] - pz[a];
    const l = Math.hypot(dx, dz) || 1;
    dx /= l;
    dz /= l;
    tx[i] = dx;
    tz[i] = dz;
    nx[i] = -dz;
    nz[i] = dx;
    cum[i + 1] = cum[i] + l;
  }
  const total = cum[n];
  for (let i = 0; i < n; i++) {
    const a = i;
    const b = (i + 1) % n;
    const cross = tx[a] * tz[b] - tz[a] * tx[b];
    const ds = Math.max(0.001, cum[i + 1] - cum[i]);
    curv[i] = Math.asin(Math.max(-1, Math.min(1, cross))) / ds;
  }
  const sm = new Float32Array(n);
  const R = 3;
  for (let i = 0; i < n; i++) {
    let acc = 0;
    for (let k = -R; k <= R; k++) acc += curv[(i + k + n) % n];
    sm[i] = acc / (R * 2 + 1);
  }
  const py = Float32Array.from(pyBase);
  const ramps = [];
  if (def.ramps) {
    for (const r of def.ramps) {
      const s0 = r.at * total;
      const s1 = s0 + r.len;
      ramps.push({ s0, s1, height: r.height });
      let i = Math.floor((s0 / total) * n);
      const end = Math.floor((s1 / total) * n);
      for (; i !== end; i = (i + 1) % n) {
        const sc = cum[i];
        const u = Math.min(1, Math.max(0, (sc - s0) / r.len));
        py[i] += r.height * Math.pow(u, 1.7);
      }
    }
  }
  const data = {
    def,
    n,
    px,
    py,
    pz,
    tx,
    tz,
    nx,
    nz,
    cum,
    curv: sm,
    total,
    halfW: def.width / 2,
    ramps
  };
  data.sampleAt = (s) => sampleAt(data, s);
  data.nearest = (x, z, hint) => nearest(data, x, z, hint);
  data.surfAt = (s) => {
    const f = ((s % total) + total) % total / total;
    if (!def.surfaces) return "asphalt";
    for (const sf of def.surfaces) {
      if (f >= sf.f0 && f <= sf.f1) return sf.type;
    }
    return "asphalt";
  };
  data.groundYAt = (s) => groundYAt(data, s);
  return data;
}

function groundYAt(d, s) {
  const ss = ((s % d.total) + d.total) % d.total;
  let lo = 0;
  let hi = d.n;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (d.cum[mid] <= ss) lo = mid;
    else hi = mid;
  }
  const i0 = lo;
  const i1 = (lo + 1) % d.n;
  const segLen = i0 === d.n - 1 ? d.total - d.cum[d.n - 1] : d.cum[i0 + 1] - d.cum[i0];
  const t = Math.min(1, Math.max(0, (ss - d.cum[i0]) / (segLen || 1)));
  return d.py[i0] * (1 - t) + d.py[i1] * t;
}

export function sampleAt(d, s) {
  const ss = ((s % d.total) + d.total) % d.total;
  let lo = 0;
  let hi = d.n;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (d.cum[mid] <= ss) lo = mid;
    else hi = mid;
  }
  const i0 = lo;
  const i1 = (i0 + 1) % d.n;
  const segLen = i0 === d.n - 1 ? d.total - d.cum[d.n - 1] : d.cum[i0 + 1] - d.cum[i0];
  const t = segLen > 0 ? Math.min(1, Math.max(0, (ss - d.cum[i0]) / segLen)) : 0;
  return {
    x: d.px[i0] * (1 - t) + d.px[i1] * t,
    y: d.py[i0] * (1 - t) + d.py[i1] * t,
    z: d.pz[i0] * (1 - t) + d.pz[i1] * t,
    tx: d.tx[i0],
    tz: d.tz[i0],
    nx: d.nx[i0],
    nz: d.nz[i0],
    curv: d.curv[i0],
    s: ss,
    idx: i0
  };
}

function nearest(d, x, z, hint) {
  let bestIdx = -1;
  let bestD2 = Infinity;
  const windowSize = 60;
  if (hint != null && hint >= 0 && hint < d.n) {
    for (let k = -windowSize; k <= windowSize; k++) {
      const i = (hint + k + d.n) % d.n;
      const dx = x - d.px[i];
      const dz = z - d.pz[i];
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) {
        bestD2 = d2;
        bestIdx = i;
      }
    }
    if (bestD2 > 2500) bestIdx = -1;
  }
  if (bestIdx < 0) {
    bestD2 = Infinity;
    for (let i = 0; i < d.n; i++) {
      const dx = x - d.px[i];
      const dz = z - d.pz[i];
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) {
        bestD2 = d2;
        bestIdx = i;
      }
    }
  }
  const i0 = bestIdx;
  const i1 = (bestIdx + 1) % d.n;
  const segx = d.px[i1] - d.px[i0];
  const segz = d.pz[i1] - d.pz[i0];
  const segLen2 = segx * segx + segz * segz || 1;
  let t = ((x - d.px[i0]) * segx + (z - d.pz[i0]) * segz) / segLen2;
  t = Math.min(1, Math.max(0, t));
  const cx = d.px[i0] + segx * t;
  const cz = d.pz[i0] + segz * t;
  let lat = (x - cx) * d.nx[i0] + (z - cz) * d.nz[i0];
  const segLen = Math.sqrt(segLen2);
  let s = d.cum[i0] + segLen * t;
  if (s >= d.total) s -= d.total;
  return {
    idx: i0,
    s: Math.max(0, s),
    lat,
    side: lat >= 0 ? 1 : -1,
    cx,
    cz,
    gy: groundYAt(d, s),
    tx: d.tx[i0],
    tz: d.tz[i0],
    nx: d.nx[i0],
    nz: d.nz[i0]
  };
}
