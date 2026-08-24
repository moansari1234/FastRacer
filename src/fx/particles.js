import * as THREE from "three";

const VERT = `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vAlpha = aAlpha;
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (220.0 / max(1.0, -mv.z));
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = `
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.12, d) * vAlpha;
  gl_FragColor = vec4(vColor, a);
}`;

export class Particles {
  constructor(scene, capacity, additive) {
    this.cap = capacity;
    this.count = 0;
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.grav = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.grow = new Float32Array(capacity);

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute("aColor", new THREE.BufferAttribute(this.col, 3));
    this.geo.setAttribute("aAlpha", new THREE.BufferAttribute(this.alpha, 1));
    this.geo.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1));
    this.geo.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  emit(o) {
    if (this.count >= this.cap) return;
    const i = this.count++;
    const j = i * 3;
    this.pos[j] = o.x;
    this.pos[j + 1] = o.y;
    this.pos[j + 2] = o.z;
    this.vel[j] = o.vx || 0;
    this.vel[j + 1] = o.vy || 0;
    this.vel[j + 2] = o.vz || 0;
    this.col[j] = o.r;
    this.col[j + 1] = o.g;
    this.col[j + 2] = o.b;
    this.size[i] = o.size;
    this.alpha[i] = o.alpha != null ? o.alpha : 1;
    this.life[i] = o.life;
    this.maxLife[i] = o.life;
    this.grav[i] = o.grav || 0;
    this.drag[i] = o.drag != null ? o.drag : 0.6;
    this.grow[i] = o.grow || 0;
  }

  update(dt) {
    let i = 0;
    while (i < this.count) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        const last = --this.count;
        if (i !== last) {
          const a = i * 3;
          const b = last * 3;
          for (let k = 0; k < 3; k++) {
            this.pos[a + k] = this.pos[b + k];
            this.vel[a + k] = this.vel[b + k];
            this.col[a + k] = this.col[b + k];
          }
          this.size[i] = this.size[last];
          this.alpha[i] = this.alpha[last];
          this.life[i] = this.life[last];
          this.maxLife[i] = this.maxLife[last];
          this.grav[i] = this.grav[last];
          this.drag[i] = this.drag[last];
          this.grow[i] = this.grow[last];
        }
        continue;
      }
      const j = i * 3;
      this.vel[j + 1] -= this.grav[i] * dt;
      const dr = Math.exp(-this.drag[i] * dt);
      this.vel[j] *= dr;
      this.vel[j + 1] *= dr;
      this.vel[j + 2] *= dr;
      this.pos[j] += this.vel[j] * dt;
      this.pos[j + 1] += this.vel[j + 1] * dt;
      this.pos[j + 2] += this.vel[j + 2] * dt;
      this.alpha[i] = Math.min(1, (this.life[i] / this.maxLife[i]) * 1.4);
      this.size[i] += this.grow[i] * dt;
      i++;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.setDrawRange(0, this.count);
  }

  clear() {
    this.count = 0;
    this.geo.setDrawRange(0, 0);
  }

  dispose() {
    this.geo.dispose();
    this.mat.dispose();
  }
}
