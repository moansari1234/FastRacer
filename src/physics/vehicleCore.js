import { clamp, damp, wrapAngle } from "../utils.js";

const G = 24;
const WALL_MARGIN = 0.85;
const RADIUS = 1.45;

export class VehicleCore {
  constructor(stats, isPlayer) {
    this.stats = stats;
    this.isPlayer = !!isPlayer;
    this.pos = { x: 0, y: 0, z: 0 };
    this.yaw = 0;
    this.vx = 0;
    this.vz = 0;
    this.vy = 0;
    this.steer = 0;
    this.speed = 0;
    this.vLat = 0;
    this.grounded = true;
    this.pitch = 0;
    this.airTime = 0;
    this.spinAir = 0;
    this.visRoll = 0;
    this.visPitch = 0;
    this.wheelSpin = 0;
    this.rpm = 0;
    this.gearFrac = 0;
    this.drifting = false;
    this.driftDir = 0;
    this.driftDist = 0;
    this.totalDriftDist = 0;
    this.damage = 0;
    this.spinT = 0;
    this.spinDir = 0;
    this.meter = 0;
    this.boostLevel = 0;
    this.boostTimer = 0;
    this.perfectWindow = 0;
    this.nitroActive = false;
    this.idx = null;
    this.s = 0;
    this.lap = 0;
    this.progress = 0;
    this.finished = false;
    this.finishTime = 0;
    this.wrongWayT = 0;
    this.surface = "asphalt";
    this.slip = 0;
    this.input = { throttle: 0, brake: 0, steer: 0, drift: false };
    this.events = [];
    this._lastVFwd = 0;
    this._groundVy = 0;
    this._prevS = null;
    this._wallCd = 0;
  }

  get fwdX() { return Math.sin(this.yaw); }
  get fwdZ() { return Math.cos(this.yaw); }
  get rightX() { return Math.cos(this.yaw); }
  get rightZ() { return -Math.sin(this.yaw); }

  place(s, track, laneOffset) {
    const sm = track.sampleAt(s);
    this.pos.x = sm.x + sm.nx * (laneOffset || 0);
    this.pos.z = sm.z + sm.nz * (laneOffset || 0);
    this.pos.y = sm.y;
    this.yaw = Math.atan2(sm.tx, sm.tz);
    this.vx = 0;
    this.vz = 0;
    this.vy = 0;
    this.speed = 0;
    this.vLat = 0;
    this.grounded = true;
    this.pitch = 0;
    this.idx = sm.idx;
    this.s = sm.s;
    this._prevS = sm.s;
    this.progress = s;
    this.meter = 30;
  }

  addImpulse(nx, nz, mag) {
    this.vx += nx * mag;
    this.vz += nz * mag;
  }

  takeDamage(amount) {
    this.damage = Math.min(0.95, this.damage + amount);
  }

  spinOut(dir) {
    if (this.spinT > 0 || this.boostLevel === 3 || !this.grounded) return false;
    this.spinT = 1.15;
    this.spinDir = dir >= 0 ? 1 : -1;
    this.drifting = false;
    return true;
  }

  step(dt, track, env) {
    const st = this.stats;
    const inp = this.input;
    const nr = track.nearest(this.pos.x, this.pos.z, this.idx);
    this.idx = nr.idx;
    this.surface = track.surfAt(nr.s);
    const weatherGrip = env.weatherGrip || 1;
    const surfGrip = env.surfGrip(this.surface) * weatherGrip;

    let throttle = inp.throttle;
    let brake = inp.brake;
    let steerIn = clamp(-inp.steer, -1, 1);
    if (this.spinT > 0) {
      this.spinT -= dt;
      throttle = 0;
      brake = 0;
      steerIn *= 0.15;
      this.yaw += this.spinDir * 7.5 * Math.max(0, this.spinT / 1.15) * dt;
      inp.drift = false;
    }

    const fwdX = this.fwdX;
    const fwdZ = this.fwdZ;
    const rgtX = this.rightX;
    const rgtZ = this.rightZ;
    let vFwd = this.vx * fwdX + this.vz * fwdZ;
    let vLat = this.vx * rgtX + this.vz * rgtZ;
    const speedAbs = Math.abs(vFwd);

    const dmgMul = 1 - this.damage * 0.22;
    const capBase = st.maxSpeed * dmgMul;
    let cap = capBase;
    let bonusAccel = 0;
    if (this.boostLevel > 0 && this.boostTimer > 0) {
      const bMul = [0, 1.09, 1.18, 1.32][this.boostLevel];
      cap = this.boostLevel === 3 ? capBase * bMul : capBase * bMul;
      bonusAccel = st.accelRate * [0, 0.55, 0.85, 1.25][this.boostLevel] * st.nitroPower;
    }

    const maxSteer = 0.62 / (1 + speedAbs * 0.03);
    this.steer = damp(this.steer, steerIn * maxSteer, st.steerResp, dt);

    const wantDrift = inp.drift && this.grounded && speedAbs > 11 && Math.abs(this.steer) > 0.1;
    if (wantDrift && !this.drifting) {
      this.drifting = true;
      this.driftDir = Math.sign(this.steer) || 1;
      this.driftDist = 0;
    } else if (this.drifting && (!inp.drift || speedAbs < 7)) {
      this.drifting = false;
    }

    const driftGripMul = this.drifting ? 0.42 : 1;
    const grip = st.grip * surfGrip * driftGripMul;

    if (this.grounded) {
      const yawGain = this.drifting ? 0.085 : 0.057;
      let yawRate = this.steer * vFwd * yawGain * (0.72 + grip * 0.13);
      yawRate = clamp(yawRate, -2.8, 2.8);
      this.yaw += yawRate * dt;

      let accel = 0;
      if (throttle > 0) {
        const r01 = clamp(vFwd / cap, 0, 1);
        const curve = 1.14 - 0.62 * r01 * r01;
        accel += st.accelRate * curve * throttle;
      }
      accel += bonusAccel;
      const drag = st.dragK * vFwd * Math.abs(vFwd);
      accel -= drag;
      if (brake > 0) {
        if (vFwd > 0.6) accel -= 24 * surfGrip;
        else if (vFwd > -11) accel -= 7;
      }
      if (throttle === 0 && brake === 0) accel -= 2.2 * Math.sign(vFwd);
      vFwd += accel * dt;
      if (vFwd > cap && this.boostLevel !== 3) vFwd = damp(vFwd, cap, 2.6, dt);

      if (inp.drift && speedAbs > 9) {
        const kick = -(Math.sign(this.steer) || this.driftDir) * speedAbs * dt * 0.85;
        vLat += kick;
        vFwd *= Math.exp(-0.22 * dt);
      }
      const latK = this.drifting ? 1.05 : 2.1;
      vLat *= Math.exp(-grip * latK * dt);
      this.slip = Math.abs(vLat);
    } else {
      this.vy -= G * dt;
      this.airTime += dt;
      this.pitch = clamp(this.pitch + (brake > 0 ? -1.7 : throttle > 0 ? 1.25 : 0) * dt, -0.95, 0.95);
      if (inp.drift) {
        this.spinAir += 7.5 * dt;
        this.yaw += 7.5 * dt;
      } else {
        this.yaw += this.steer * 1.15 * dt;
      }
      vFwd *= Math.exp(-0.05 * dt);
      vLat *= Math.exp(-0.35 * dt);
      this.slip = 0;
    }

    this.speed = vFwd;
    this.vLat = vLat;
    this.vx = fwdX * vFwd + rgtX * vLat;
    this.vz = fwdZ * vFwd + rgtZ * vLat;

    this.pos.x += this.vx * dt;
    this.pos.z += this.vz * dt;

    const nr2 = track.nearest(this.pos.x, this.pos.z, this.idx);
    this.idx = nr2.idx;
    this.s = nr2.s;
    const gyNew = track.groundYAt(nr2.s);

    if (this.grounded) {
      const oldY = this.pos.y;
      const drop = oldY - gyNew;
      if (drop > 0.4 && vFwd > 9) {
        this.grounded = false;
        this.vy = clamp(this._groundVy, 0, 17);
        this.airTime = 0;
        this.spinAir = 0;
        this.pitch = 0;
        this.events.push({ type: "launch", vy: this.vy });
      } else {
        const gyInst = (gyNew - oldY) / dt;
        if (gyInst > -40 && gyInst < 60) {
          this._groundVy = damp(this._groundVy, Math.max(-6, gyInst), 10, dt);
        }
        this.pos.y = gyNew;
      }
    } else {
      this.pos.y += this.vy * dt;
      if (this.pos.y <= gyNew) {
        this.pos.y = gyNew;
        this.grounded = true;
        this._groundVy = 0;
        const flat = Math.abs(wrapAngle(this.pitch));
        const air = this.airTime;
        const did360 = this.spinAir >= 5.8;
        this.pitch = 0;
        this.spinAir = 0;
        this.airTime = 0;
        this.vy = 0;
        if (flat > 0.65) {
          vFwd *= 0.45;
          this.speed = vFwd;
          this.vx = fwdX * vFwd + rgtX * vLat;
          this.vz = fwdZ * vFwd + rgtZ * vLat;
          this.takeDamage(0.12);
          this.events.push({ type: "crashLand" });
        } else {
          this.events.push({ type: "land", air, did360 });
        }
      }
    }

    const limit = track.halfW - WALL_MARGIN;
    if (Math.abs(nr2.lat) > limit) {
      const side = nr2.side;
      const over = Math.abs(nr2.lat) - limit;
      this.pos.x -= nr2.nx * side * over;
      this.pos.z -= nr2.nz * side * over;
      const fx2 = this.fwdX;
      const fz2 = this.fwdZ;
      const rx2 = this.rightX;
      const rz2 = this.rightZ;
      let f2 = this.vx * fx2 + this.vz * fz2;
      let l2 = this.vx * rx2 + this.vz * rz2;
      const outward = l2 * side;
      if (outward > 0) {
        const impact = Math.abs(outward);
        l2 = -l2 * 0.28;
        this._wallCd -= dt;
        const grinding = speedAbs > 10;
        if (this._wallCd <= 0 && (impact > 2 || grinding)) {
          const eff = Math.max(impact, 2.5);
          this.takeDamage(eff * 0.006);
          this.events.push({ type: "wall", impact: eff, x: this.pos.x, z: this.pos.z, scrape: impact <= 2 });
          f2 *= Math.exp(-eff * 0.01);
          this._wallCd = impact > 2 ? 0.18 : 0.4;
        }
      } else {
        this._wallCd = 0;
      }
      this.vx = fx2 * f2 + rx2 * l2;
      this.vz = fz2 * f2 + rz2 * l2;
      this.vLat = l2;
      this.speed = f2;
    }

    if (this.drifting && this.grounded) {
      this.driftDist += Math.abs(vFwd) * dt;
      this.totalDriftDist += Math.abs(vFwd) * dt;
      if (!inp.drift && Math.abs(vLat) < 1.8) this.drifting = false;
    }

    if (this._prevS == null) this._prevS = nr2.s;
    let dsRaw = nr2.s - this._prevS;
    if (dsRaw < -track.total * 0.5) dsRaw += track.total;
    else if (dsRaw > track.total * 0.5) dsRaw -= track.total;
    this.progress += dsRaw;
    this._prevS = nr2.s;

    const tDot = fwdX * nr2.tx + fwdZ * nr2.tz;
    if (tDot < -0.3 && speedAbs > 6) this.wrongWayT += dt;
    else this.wrongWayT = 0;

    const longA = (vFwd - this._lastVFwd) / dt;
    this._lastVFwd = vFwd;
    const targetRoll = clamp(-vLat * 0.014 - this.steer * speedAbs * 0.0022, -0.16, 0.16);
    const targetPitch = this.grounded ? clamp(-longA * 0.0035, -0.09, 0.13) : -this.pitch * 0.85;
    this.visRoll = damp(this.visRoll, targetRoll, 6, dt);
    this.visPitch = damp(this.visPitch, targetPitch, 6, dt);

    this.wheelSpin += (vFwd / 0.34) * dt;
    const r01 = clamp(Math.abs(vFwd) / st.maxSpeed, 0, 1);
    const gear = Math.min(5, Math.floor(r01 * 6));
    this.gearFrac = clamp(r01 * 6 - gear, 0, 1);
    this.rpm = gear === 0 ? clamp(r01 * 5.4, 0, 0.92) : clamp(0.22 + this.gearFrac * 0.78, 0, 1);

    if (this.boostTimer > 0 && this.boostTimer < 900) {
      this.boostTimer -= dt;
      if (this.boostTimer <= 0) this.endBoost();
    }
    if (this.nitroActive && this.meter <= 0) this.endBoost();
    if (this.perfectWindow > 0) this.perfectWindow -= dt;
  }

  requestNitroTap() {
    if (this.boostLevel === 0) {
      if (this.meter > 4) {
        this.boostLevel = 1;
        this.boostTimer = 999;
        this.nitroActive = true;
        this.perfectWindow = 0.55;
        return 1;
      }
      return 0;
    }
    if (this.boostLevel === 1 && this.perfectWindow > 0) {
      this.perfectWindow = 0;
      this.boostLevel = 2;
      this.boostTimer = 3.4;
      return 2;
    }
    return 0;
  }

  requestShockwave() {
    if (this.meter >= 92 && this.boostLevel < 3) {
      this.boostLevel = 3;
      this.boostTimer = 3.2;
      this.nitroActive = true;
      this.perfectWindow = 0;
      return true;
    }
    return false;
  }

  endBoost() {
    this.boostLevel = 0;
    this.boostTimer = 0;
    this.nitroActive = false;
    this.perfectWindow = 0;
  }

  addMeter(x) {
    this.meter = clamp(this.meter + x, 0, 100);
  }
}

export function resolveCarCollision(a, b) {
  const dx = b.pos.x - a.pos.x;
  const dz = b.pos.z - a.pos.z;
  const d2 = dx * dx + dz * dz;
  const minD = RADIUS * 2;
  if (d2 > minD * minD || d2 < 1e-6) return null;
  const d = Math.sqrt(d2);
  const nx = dx / d;
  const nz = dz / d;
  const overlap = minD - d;
  a.pos.x -= nx * overlap * 0.5;
  a.pos.z -= nz * overlap * 0.5;
  b.pos.x += nx * overlap * 0.5;
  b.pos.z += nz * overlap * 0.5;
  const rvx = b.vx - a.vx;
  const rvz = b.vz - a.vz;
  const relN = rvx * nx + rvz * nz;
  if (relN < 0) {
    const j = -relN * 0.72;
    a.vx -= nx * j;
    a.vz -= nz * j;
    b.vx += nx * j;
    b.vz += nz * j;
    return { impact: -relN, nx, nz, mx: (a.pos.x + b.pos.x) / 2, mz: (a.pos.z + b.pos.z) / 2 };
  }
  return null;
}
