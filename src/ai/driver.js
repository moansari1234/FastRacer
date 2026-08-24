import { clamp, damp, mulberry32 } from "../utils.js";

export class AIDriver {
  constructor(vehicle, track, personality, difficulty, seed) {
    this.v = vehicle;
    this.track = track;
    this.p = personality;
    this.diff = difficulty;
    this.rng = mulberry32(seed || 12345);
    this.lane = (this.rng() * 2 - 1) * track.halfW * 0.45;
    this.laneT = this.rng() * 100;
    this.mistakeT = 0;
    this.wobble = 0;
    this.nitroDelay = 2 + this.rng() * 4;
    this.blockBias = this.rng() < 0.5 ? -1 : 1;
  }

  update(dt, ctx) {
    const v = this.v;
    const trk = this.track;
    const speed = Math.abs(v.speed);
    this.laneT += dt;
    const look = 7 + speed * 0.5;
    const targetS = v.s + look;
    const sm = trk.sampleAt(targetS);
    let lane = this.lane * Math.sin(this.laneT * 0.13 + this.blockBias);
    lane = clamp(lane, -trk.halfW * 0.72, trk.halfW * 0.72);

    for (const o of ctx.others) {
      if (o === v || o.finished) continue;
      const dx = o.pos.x - v.pos.x;
      const dz = o.pos.z - v.pos.z;
      const fwdDot = dx * v.fwdX + dz * v.fwdZ;
      if (fwdDot > 1 && fwdDot < 14) {
        const latDot = dx * v.rightX + dz * v.rightZ;
        const oLat = dx * v.rightX + dz * v.rightZ;
        if (Math.abs(oLat) < 3.4) {
          lane -= Math.sign(oLat || 1) * 3.6 * (1 - fwdDot / 14);
        }
      }
    }
    lane = clamp(lane, -trk.halfW * 0.85, trk.halfW * 0.85);

    const tx = sm.x + sm.nx * lane - v.pos.x;
    const tz = sm.z + sm.nz * lane - v.pos.z;
    let steerTarget = Math.atan2(tx * v.rightX + tz * v.rightZ, tx * v.fwdX + tz * v.fwdZ);
    steerTarget = clamp(steerTarget * 1.9, -1, 1);
    if (this.mistakeT > 0) {
      this.mistakeT -= dt;
      this.wobble += dt * 9;
      steerTarget += Math.sin(this.wobble) * 0.5;
    } else if (this.rng() < this.diff.mistake * dt * 3 && speed > 18) {
      this.mistakeT = 0.5 + this.rng() * 0.6;
    }

    let maxCorner = Infinity;
    for (let d = 8; d < 90; d += 8) {
      const s2 = trk.sampleAt(v.s + d);
      const k = Math.abs(s2.curv);
      if (k > 0.0015) {
        const vc = Math.sqrt((11.5 * this.diff.corner * this.p.skill) / k);
        const allowed = vc + d * 0.06;
        if (allowed < maxCorner) maxCorner = allowed;
      }
    }
    let rubber = 1;
    if (ctx.playerProgress != null) {
      const gap = ctx.playerProgress - v.progress;
      rubber = clamp(1 + gap * 0.00035, 0.9, 1.12);
      if (gap < -80) rubber *= this.diff.rubber;
    }
    const cruise = v.stats.maxSpeed * this.diff.speed * this.p.aggression * rubber;
    const targetSpeed = Math.min(cruise, maxCorner > 0 ? maxCorner : cruise);

    let throttle = 0;
    let brake = 0;
    if (speed < targetSpeed - 1) throttle = 1;
    else if (speed > targetSpeed + 3) brake = clamp((speed - targetSpeed) * 0.15, 0, 1);

    if (!v.grounded) {
      throttle = 1;
    }

    this.nitroDelay -= dt;
    const straightAhead = true;
    let kMax = 0;
    for (let d = 5; d < 40; d += 7) {
      kMax = Math.max(kMax, Math.abs(trk.sampleAt(v.s + d).curv));
    }
    const isStraight = kMax < 0.006;
    if (straightAhead && this.nitroDelay <= 0 && v.meter > 25 && v.grounded) {
      const useNow =
        (this.p.style === "aggressive" && v.meter > 30 && isStraight) ||
        (this.p.style === "technical" && isStraight && kMax < 0.002 && v.meter > 55) ||
        (this.p.style === "defensive" && ctx.raceTime > 10 && v.meter > 60) ||
        ctx.finalLap;
      if (useNow) {
        const lvl = v.requestNitroTap();
        if (lvl > 0) {
          v.input.nitroFx = lvl;
          this.nitroDelay = 2.5 + this.rng() * 4;
          if (this.rng() < 0.3 && v.meter >= 92) v.requestShockwave();
        }
      }
    }

    v.input.throttle = throttle;
    v.input.brake = brake;
    v.input.steer = damp(v.input.steer, -steerTarget, 12, dt);
    v.input.drift = v.grounded && Math.abs(kMax) > 0.02 && speed > 24 && Math.abs(steerTarget) > 0.4 && this.p.skill > 0.85;
  }
}

export function makePersonality(rng, i) {
  const styles = ["aggressive", "defensive", "technical"];
  return {
    style: styles[i % styles.length],
    aggression: 0.88 + rng() * 0.14,
    skill: 0.82 + rng() * 0.16,
    name: ""
  };
}
