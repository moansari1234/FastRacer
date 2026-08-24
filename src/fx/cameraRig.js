import * as THREE from "three";
import { clamp, damp } from "../utils.js";

const MODES = {
  chase: { dist: 6.8, height: 2.7, lookAhead: 5, fov: 64 },
  far: { dist: 10.2, height: 3.9, lookAhead: 7, fov: 60 },
  hood: { dist: -0.4, height: 1.15, lookAhead: 12, fov: 72 }
};

export class CameraRig {
  constructor(camera) {
    this.cam = camera;
    this.mode = "chase";
    this.shakeAmp = 0;
    this.fovKick = 0;
    this.pos = new THREE.Vector3(0, 5, -10);
    this.look = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this.slowmo = 0;
  }
  cycle() {
    this.mode = this.mode === "chase" ? "far" : this.mode === "far" ? "hood" : "chase";
    return this.mode;
  }
  shake(amt) {
    this.shakeAmp = Math.min(1.4, this.shakeAmp + amt);
  }
  kick(amt) {
    this.fovKick = Math.min(18, this.fovKick + amt);
  }
  snapBehind(car) {
    const m = MODES[this.mode];
    const fx = car.fwdX;
    const fz = car.fwdZ;
    this.pos.set(car.pos.x - fx * m.dist, car.pos.y + m.height, car.pos.z - fz * m.dist);
  }
  update(dt, car, opts) {
    const m = MODES[this.mode];
    const speed01 = clamp(Math.abs(car.speed) / 90, 0, 1);
    let dist = m.dist * (1 + speed01 * 0.16);
    let height = m.height;
    if (this.slowmo > 0) {
      this.slowmo -= dt;
      dist *= 0.82;
      height += 0.4;
    }
    const fx = car.fwdX;
    const fz = car.fwdZ;
    if (this.mode === "hood") {
      this._tmp.set(car.pos.x + fx * 0.9, car.pos.y + 1.25, car.pos.z + fz * 0.9);
      this.pos.copy(this._tmp);
    } else {
      const lat = clamp(-car.vLat * 0.14, -1.4, 1.4);
      const rx = car.rightX;
      const rz = car.rightZ;
      this._tmp.set(
        car.pos.x - fx * dist + rx * lat,
        car.pos.y + height,
        car.pos.z - fz * dist + rz * lat
      );
      const lambda = this.slowmo > 0 ? 10 : 6.5;
      this.pos.x = damp(this.pos.x, this._tmp.x, lambda, dt);
      this.pos.y = damp(this.pos.y, this._tmp.y, lambda, dt);
      this.pos.z = damp(this.pos.z, this._tmp.z, lambda, dt);
    }
    this.look.set(
      car.pos.x + fx * m.lookAhead + car.vx * 0.12,
      car.pos.y + 1.1 + (car.grounded ? 0 : car.airTime * 1.5),
      car.pos.z + fz * m.lookAhead + car.vz * 0.12
    );
    this.cam.position.copy(this.pos);
    if (opts && opts.shakeEnabled && this.shakeAmp > 0.001) {
      const s = this.shakeAmp;
      this.cam.position.x += (Math.random() - 0.5) * s * 0.5;
      this.cam.position.y += (Math.random() - 0.5) * s * 0.35;
      this.cam.position.z += (Math.random() - 0.5) * s * 0.5;
      this.shakeAmp *= Math.exp(-5 * dt);
    }
    this.cam.lookAt(this.look);
    this.cam.rotation.z += clamp(-car.visRoll * 0.55 - car.vLat * 0.004, -0.09, 0.09);

    const targetFov = m.fov + speed01 * 10 + this.fovKick + (car.boostLevel === 3 ? 8 : car.nitroActive ? 4 : 0);
    this.fovKick *= Math.exp(-3.5 * dt);
    if (Math.abs(this.cam.fov - targetFov) > 0.05) {
      this.cam.fov = damp(this.cam.fov, targetFov, 4.5, dt);
      this.cam.updateProjectionMatrix();
    }
  }
}
