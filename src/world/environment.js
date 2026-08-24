import * as THREE from "three";
import { mulberry32 } from "../utils.js";

const PALETTES = {
  coast_day: { top: 0x2e7cd6, bot: 0xbfe3ff, fog: 0xcfe6f5, fogFar: 750, sun: 0xfff2cc, sunInt: 1.25, hemi: 0xbfdfff, gnd: 0x8a7a5a, gndCol: 0x6fae63, star: false },
  desert_sunset: { top: 0x452b63, bot: 0xff9a5a, fog: 0xe8a070, fogFar: 650, sun: 0xffb36b, sunInt: 1.15, hemi: 0xffc9a0, gnd: 0x7a5a34, gndCol: 0xd9b26a, star: false },
  city_night: { top: 0x05070f, bot: 0x121c33, fog: 0x0a0f1c, fogFar: 430, sun: 0x9db4ff, sunInt: 0.32, hemi: 0x22304a, gnd: 0x11141b, gndCol: 0x15181f, star: true },
  mountain_day: { top: 0x3f86d8, bot: 0xdfeeff, fog: 0xd8e6f2, fogFar: 720, sun: 0xfff6dd, sunInt: 1.3, hemi: 0xcfe4ff, gnd: 0x4a5a42, gndCol: 0x5d7050, star: false },
  snow_night: { top: 0x0a1220, bot: 0x27394f, fog: 0x2c3d52, fogFar: 270, sun: 0xaac6ee, sunInt: 0.4, hemi: 0x33465e, gnd: 0x5a6a7a, gndCol: 0xdfe8f0, star: true },
  future_sunset: { top: 0x191243, bot: 0xff8ac2, fog: 0x8a5aa8, fogFar: 600, sun: 0xff9ad5, sunInt: 1.0, hemi: 0xcf9ae8, gnd: 0x10131f, gndCol: 0x181c2c, star: true },
  tropical_storm: { top: 0x55616e, bot: 0x97a6b0, fog: 0x7d8b96, fogFar: 320, sun: 0xdde6ee, sunInt: 0.75, hemi: 0x9fb2bf, gnd: 0x3d5638, gndCol: 0x4f7a4a, star: false }
};

function makeWindowTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#000000";
  g.fillRect(0, 0, 64, 128);
  for (let y = 4; y < 124; y += 10) {
    for (let x = 4; x < 60; x += 10) {
      if (Math.random() < 0.5) {
        const warm = Math.random() < 0.7;
        g.fillStyle = warm ? "#ffd98a" : "#9adcff";
        g.fillRect(x, y, 6, 6);
      }
    }
  }
  return new THREE.CanvasTexture(c);
}

export class Environment {
  constructor(scene, renderer, def, quality, seed, track) {
    this.scene = scene;
    this.def = def;
    this.quality = quality;
    this.rng = mulberry32(seed || 42);
    if (track) this.bindTrack(track);
    this.timeKey = `${def.theme}_${def.time}`;
    let pal = PALETTES[this.timeKey];
    if (!pal) {
      pal = def.weather === "storm" ? PALETTES.tropical_storm : PALETTES[`${def.theme}_day`] || PALETTES.coast_day;
    }
    this.pal = pal;
    scene.background = new THREE.Color(pal.fog);
    scene.fog = new THREE.Fog(pal.fog, 60, pal.fogFar);

    this.skyGeo = new THREE.SphereGeometry(950, 24, 14);
    const cols = [];
    const posAttr = this.skyGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const t = Math.max(0, Math.min(1, (posAttr.getY(i) / 950 + 1) / 2));
      const top = new THREE.Color(pal.top);
      const bot = new THREE.Color(pal.bot);
      const c = top.lerp(bot, Math.pow(t, 0.8));
      cols.push(c.r, c.g, c.b);
    }
    this.skyGeo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
    this.skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false });
    this.sky = new THREE.Mesh(this.skyGeo, this.skyMat);
    scene.add(this.sky);

    this.hemi = new THREE.HemisphereLight(pal.hemi, pal.gnd, 0.85);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(pal.sun, pal.sunInt);
    this.sun.position.set(180, 260, 120);
    if (quality === "high") {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(2048, 2048);
      this.sun.shadow.camera.left = -70;
      this.sun.shadow.camera.right = 70;
      this.sun.shadow.camera.top = 70;
      this.sun.shadow.camera.bottom = -70;
      this.sun.shadow.camera.far = 500;
      this.sun.shadow.bias = -0.0012;
    }
    scene.add(this.sun);
    scene.add(this.sun.target);

    if (pal.star) {
      const starGeo = new THREE.BufferGeometry();
      const sp = [];
      for (let i = 0; i < 420; i++) {
        const a = this.rng() * Math.PI * 2;
        const e = this.rng() * Math.PI * 0.48 + 0.06;
        const r = 900;
        sp.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
      }
      starGeo.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
      this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xcfe0ff, size: 2.2, sizeAttenuation: false, fog: false }));
      scene.add(this.stars);
    }

    this.sunDisc = new THREE.Mesh(
      new THREE.CircleGeometry(pal.sunInt > 0.8 ? 46 : 22, 20),
      new THREE.MeshBasicMaterial({ color: pal.sun, fog: false })
    );
    const sunDir = new THREE.Vector3(0.5, 0.62, 0.35).normalize();
    this.sunDisc.position.copy(sunDir).multiplyScalar(880);
    this.sunDisc.lookAt(0, 0, 0);
    scene.add(this.sunDisc);

    this.ground = new THREE.Mesh(
      new THREE.CircleGeometry(1500, 40),
      new THREE.MeshLambertMaterial({ color: pal.gndCol })
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.35;
    scene.add(this.ground);

    this.decorMeshes = [];
    this._buildDecor(def.decor || {}, seed);
    this._buildWeather(def.weather, quality);
    this.lightningT = def.weather === "storm" ? 5 : -1;
    this.onLightning = null;
  }

  _spot(count, minOff, maxOff) {
    const spots = [];
    for (let k = 0; k < count; k++) {
      spots.push({
        ang: this.rng(),
        off: minOff + this.rng() * (maxOff - minOff),
        side: this.rng() < 0.5 ? -1 : 1,
        scale: 0.7 + this.rng() * 0.8,
        rot: this.rng() * Math.PI * 2
      });
    }
    return spots;
  }

  _instanced(geo, mat, items, placeFn, shadow) {
    if (!items.length) return null;
    const im = new THREE.InstancedMesh(geo, mat, items.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const sc = new THREE.Vector3();
    items.forEach((it, i) => {
      placeFn(it, m, q, v, sc);
      im.setMatrixAt(i, m);
    });
    im.castShadow = !!shadow && this.quality !== "low";
    im.instanceMatrix.needsUpdate = true;
    this.scene.add(im);
    this.decorMeshes.push(im);
    return im;
  }

  _buildDecor(decor, seed) {
    const rng = mulberry32((seed || 7) * 31 + 17);
    const track = this.trackRef;

    const mkPalms = () => {
      const spots = this._spot(decor.palms || 0, 4, 40);
      const trunkGeo = new THREE.CylinderGeometry(0.16, 0.3, 5.2, 6);
      trunkGeo.translate(0, 2.6, 0);
      const frondGeo = new THREE.SphereGeometry(1.7, 6, 5);
      frondGeo.scale(1, 0.45, 1);
      frondGeo.translate(0, 5.3, 0);
      const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a44 });
      const frondMat = new THREE.MeshLambertMaterial({ color: 0x2f7d3a });
      const place = (it, m, q, v, sc) => {
        const sm = this.sampleForSpot(it.ang);
        v.set(sm.x + sm.nx * it.side * it.off, sm.y - 0.2, sm.z + sm.nz * it.side * it.off);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.rot);
        sc.set(it.scale, it.scale, it.scale);
        m.compose(v, q, sc);
      };
      this._instanced(trunkGeo, trunkMat, spots, place, false);
      this._instanced(frondGeo, frondMat, spots, place, false);
    };

    const mkPines = () => {
      const spots = this._spot(decor.pines || 0, 4, 46);
      const coneGeo = new THREE.ConeGeometry(1.7, 4.6, 7);
      coneGeo.translate(0, 3.4, 0);
      const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 1.6, 5);
      trunkGeo.translate(0, 0.8, 0);
      const pineMat = decor.iceCrystals ? new THREE.MeshLambertMaterial({ color: 0x2e4a3e }) : new THREE.MeshLambertMaterial({ color: 0x24552c });
      const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a4632 });
      const place = (it, m, q, v, sc) => {
        const sm = this.sampleForSpot(it.ang);
        v.set(sm.x + sm.nx * it.side * it.off, sm.y - 0.2, sm.z + sm.nz * it.side * it.off);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.rot);
        sc.set(it.scale, it.scale, it.scale);
        m.compose(v, q, sc);
      };
      this._instanced(coneGeo, pineMat, spots, place, false);
      this._instanced(trunkGeo, trunkMat, spots, place, false);
    };

    const mkRocks = () => {
      const spots = this._spot(decor.rocks || 0, 3.5, 50);
      const geo = new THREE.DodecahedronGeometry(1.3, 0);
      const mat = new THREE.MeshLambertMaterial({ color: this.pal.gnd });
      this._instanced(geo, mat, spots, (it, m, q, v, sc) => {
        const sm = this.sampleForSpot(it.ang);
        v.set(sm.x + sm.nx * it.side * it.off, sm.y + 0.2, sm.z + sm.nz * it.side * it.off);
        q.setFromEuler(new THREE.Euler(rng() * 3, it.rot, rng() * 3));
        sc.set(it.scale * 1.4, it.scale * 0.9, it.scale * 1.3);
        m.compose(v, q, sc);
      }, false);
    };

    const mkCacti = () => {
      const spots = this._spot(decor.cacti || 0, 4, 44);
      const geo = new THREE.CylinderGeometry(0.32, 0.4, 2.8, 7);
      geo.translate(0, 1.4, 0);
      const mat = new THREE.MeshLambertMaterial({ color: 0x3f7d44 });
      this._instanced(geo, mat, spots, (it, m, q, v, sc) => {
        const sm = this.sampleForSpot(it.ang);
        v.set(sm.x + sm.nx * it.side * it.off, sm.y - 0.2, sm.z + sm.nz * it.side * it.off);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.rot);
        sc.set(it.scale, it.scale, it.scale);
        m.compose(v, q, sc);
      }, false);
    };

    const mkBuildings = () => {
      const spots = this._spot(decor.buildings || 0, 6, 90);
      const winTex = makeWindowTexture();
      const mat = new THREE.MeshLambertMaterial({
        color: 0x1a2130,
        emissive: 0xffffff,
        emissiveMap: winTex,
        emissiveIntensity: 0.85
      });
      const geo = new THREE.BoxGeometry(1, 1, 1);
      geo.translate(0, 0.5, 0);
      this._instanced(geo, mat, spots, (it, m, q, v, sc) => {
        const sm = this.sampleForSpot(it.ang);
        const h = 12 + this.rng() * 58;
        const w = 8 + this.rng() * 12;
        v.set(sm.x + sm.nx * it.side * it.off, sm.y - 0.3, sm.z + sm.nz * it.side * it.off);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.floor(this.rng() * 4) * Math.PI / 2);
        sc.set(w, h, w * (0.7 + this.rng() * 0.6));
        m.compose(v, q, sc);
      }, false);
    };

    const mkNeons = () => {
      const spots = this._spot(decor.neons || 0, 3, 26);
      const mat = new THREE.MeshBasicMaterial({});
      const geo = new THREE.BoxGeometry(0.35, 6, 0.35);
      geo.translate(0, 3, 0);
      const colors = [0x00e5ff, 0xff2d95, 0x7c4dff];
      const im = this._instanced(geo, mat, spots, (it, m, q, v, sc) => {
        const sm = this.sampleForSpot(it.ang);
        v.set(sm.x + sm.nx * it.side * it.off, sm.y, sm.z + sm.nz * it.side * it.off);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.rot);
        sc.set(it.scale, it.scale * (0.8 + this.rng()), it.scale);
        m.compose(v, q, sc);
      }, false);
      if (im) {
        const colArr = new Float32Array(spots.length * 3);
        const c = new THREE.Color();
        spots.forEach((_, i) => {
          c.set(colors[i % colors.length]);
          colArr[i * 3] = c.r;
          colArr[i * 3 + 1] = c.g;
          colArr[i * 3 + 2] = c.b;
        });
        im.instanceColor = new THREE.InstancedBufferAttribute(colArr, 3);
      }
    };

    const mkPylons = () => {
      const spots = this._spot(decor.pylons || 0, 4, 30);
      const geo = new THREE.CylinderGeometry(0.22, 0.5, 11, 6);
      geo.translate(0, 5.5, 0);
      const mat = new THREE.MeshPhongMaterial({ color: 0x141a2e, emissive: 0x7c4dff, emissiveIntensity: 0.7, shininess: 60 });
      this._instanced(geo, mat, spots, (it, m, q, v, sc) => {
        const sm = this.sampleForSpot(it.ang);
        v.set(sm.x + sm.nx * it.side * it.off, sm.y - 0.3, sm.z + sm.nz * it.side * it.off);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.rot);
        sc.set(it.scale, it.scale, it.scale);
        m.compose(v, q, sc);
      }, false);
    };

    const mkRings = () => {
      const count = decor.rings || 0;
      if (!count) return;
      const geo = new THREE.TorusGeometry(13, 0.5, 8, 28);
      const mat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.65 });
      const im = new THREE.InstancedMesh(geo, mat, count);
      const m = new THREE.Matrix4();
      const n = this.trackN;
      for (let i = 0; i < count; i++) {
        const idx = Math.floor(((i + 0.5) / count) * n);
        const px = this.trackPX[idx];
        const py = this.trackPY[idx];
        const pz = this.trackPZ[idx];
        const tx = this.trackTX[idx];
        const tz = this.trackTZ[idx];
        const yaw = Math.atan2(tx, tz);
        const pos = new THREE.Vector3(px, py + 9, pz);
        const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0));
        m.compose(pos, quat, new THREE.Vector3(1, 1, 1));
        im.setMatrixAt(i, m);
      }
      this.scene.add(im);
      this.decorMeshes.push(im);
      this.ringsMesh = im;
    };

    const mkCrystals = () => {
      const spots = this._spot(decor.iceCrystals || 0, 4, 36);
      const geo = new THREE.OctahedronGeometry(1.4, 0);
      geo.translate(0, 1.4, 0);
      const mat = new THREE.MeshPhongMaterial({ color: 0x9fd8ff, emissive: 0x4a90c2, emissiveIntensity: 0.4, shininess: 120, transparent: true, opacity: 0.9 });
      this._instanced(geo, mat, spots, (it, m, q, v, sc) => {
        const sm = this.sampleForSpot(it.ang);
        v.set(sm.x + sm.nx * it.side * it.off, sm.y - 0.2, sm.z + sm.nz * it.side * it.off);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.rot);
        sc.set(it.scale, it.scale * 1.8, it.scale);
        m.compose(v, q, sc);
      }, false);
    };

    mkPalms();
    mkPines();
    mkRocks();
    mkCacti();
    mkBuildings();
    mkNeons();
    mkPylons();
    mkRings();
    mkCrystals();
  }

  bindTrack(track) {
    this.trackRef = track;
    this.trackN = track.n;
    this.trackPX = track.px;
    this.trackPY = track.py;
    this.trackPZ = track.pz;
    this.trackTX = track.tx;
    this.trackTZ = track.tz;
  }

  sampleForSpot(u) {
    const idx = Math.floor(u * this.trackN) % this.trackN;
    return { x: this.trackPX[idx], y: this.trackPY[idx], z: this.trackPZ[idx], nx: -this.trackTZ[idx], nz: this.trackTX[idx] };
  }

  _buildWeather(weather, quality) {
    if (weather !== "rain" && weather !== "snow" && weather !== "storm") return;
    const isSnow = weather === "snow";
    const count = isSnow ? 700 : 1000;
    const geo = new THREE.BufferGeometry();
    this.wPos = new Float32Array(count * 3);
    this.wVel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      this.wPos[i * 3] = (Math.random() - 0.5) * 130;
      this.wPos[i * 3 + 1] = Math.random() * 55;
      this.wPos[i * 3 + 2] = (Math.random() - 0.5) * 130;
      this.wVel[i * 3] = isSnow ? (Math.random() - 0.5) * 2 : -6 - Math.random() * 4;
      this.wVel[i * 3 + 1] = isSnow ? -(1.6 + Math.random() * 2) : -(34 + Math.random() * 12);
      this.wVel[i * 3 + 2] = isSnow ? (Math.random() - 0.5) * 2 : 0;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(this.wPos, 3));
    this.wMat = new THREE.PointsMaterial({
      color: isSnow ? 0xffffff : 0x9fc4e8,
      size: isSnow ? 0.5 : 0.34,
      transparent: true,
      opacity: isSnow ? 0.9 : 0.62,
      depthWrite: false
    });
    this.weatherPts = new THREE.Points(geo, this.wMat);
    this.weatherPts.frustumCulled = false;
    this.isSnow = isSnow;
    this.scene.add(this.weatherPts);
  }

  update(dt, focus) {
    this.sky.position.set(focus.x, 0, focus.z);
    if (this.stars) this.stars.position.set(focus.x, 0, focus.z);
    this.sunDisc.position.set(focus.x + 440, 550, focus.z + 310);
    this.ground.position.x = focus.x;
    this.ground.position.z = focus.z;
    this.sun.position.set(focus.x + 140, 220, focus.z + 90);
    this.sun.target.position.set(focus.x, 0, focus.z);

    if (this.weatherPts) {
      const arr = this.wPos;
      const cnt = arr.length / 3;
      const cx = focus.x;
      const cz = focus.z;
      for (let i = 0; i < cnt; i++) {
        const j = i * 3;
        arr[j] += this.wVel[j] * dt;
        arr[j + 1] += this.wVel[j + 1] * dt;
        arr[j + 2] += this.wVel[j + 2] * dt;
        if (this.isSnow) arr[j] += Math.sin(arr[j + 1] * 0.5 + i) * dt * 1.4;
        if (arr[j + 1] < focus.y - 4) {
          arr[j] = cx + (Math.random() - 0.5) * 130;
          arr[j + 1] = focus.y + 42 + Math.random() * 16;
          arr[j + 2] = cz + (Math.random() - 0.5) * 130;
        } else if (Math.abs(arr[j] - cx) > 80) {
          arr[j] = cx + (Math.random() - 0.5) * 130;
        } else if (Math.abs(arr[j + 2] - cz) > 80) {
          arr[j + 2] = cz + (Math.random() - 0.5) * 130;
        }
      }
      this.weatherPts.geometry.attributes.position.needsUpdate = true;
    }

    if (this.lightningT > 0) {
      this.lightningT -= dt;
      if (this.lightningT <= 0) {
        this.lightningT = 4 + Math.random() * 7;
        if (this.onLightning) this.onLightning();
      }
    }
    if (this.ringsMesh) {
      this.ringsMesh.rotation.y += dt * 0.02;
    }
  }

  dispose() {
    const disposables = [];
    this.scene.traverse && null;
    this.skyGeo.dispose();
    this.skyMat.dispose();
    this.ground.geometry.dispose();
    this.ground.material.dispose();
    for (const im of this.decorMeshes) {
      im.geometry.dispose();
      if (Array.isArray(im.material)) im.material.forEach((m) => m.dispose());
      else im.material.dispose();
      this.scene.remove(im);
    }
    this.decorMeshes.length = 0;
    if (this.stars) {
      this.stars.geometry.dispose();
      this.stars.material.dispose();
      this.scene.remove(this.stars);
    }
    if (this.weatherPts) {
      this.weatherPts.geometry.dispose();
      this.wMat.dispose();
      this.scene.remove(this.weatherPts);
    }
    this.sunDisc.geometry.dispose();
    this.sunDisc.material.dispose();
    this.scene.remove(this.sky);
    this.scene.remove(this.sun);
    this.scene.remove(this.sun.target);
    this.scene.remove(this.hemi);
    this.scene.remove(this.sunDisc);
    this.scene.remove(this.ground);
  }
}
