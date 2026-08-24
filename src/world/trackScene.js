import * as THREE from "three";

export const THEME_ACCENTS = {
  coast: { wall: "#8f9aa6", emissive: "#000000", curbA: "#e03a2f", curbB: "#f2f2f2", h: 0.7 },
  desert: { wall: "#b08a54", emissive: "#000000", curbA: "#d1495b", curbB: "#f2e9d8", h: 0.9 },
  city: { wall: "#232a36", emissive: "#00e5ff", curbA: "#00e5ff", curbB: "#12151c", h: 1.0 },
  mountain: { wall: "#6d7683", emissive: "#000000", curbA: "#c1121f", curbB: "#e5e5e5", h: 0.8 },
  snow: { wall: "#aebfd2", emissive: "#7fd4ff", curbA: "#ff5d4d", curbB: "#ffffff", h: 0.8 },
  future: { wall: "#141a2e", emissive: "#7c4dff", curbA: "#7c4dff", curbB: "#00e5ff", h: 1.2 },
  tropical: { wall: "#5e7355", emissive: "#000000", curbA: "#ff7a18", curbB: "#f5f0e6", h: 0.7 }
};

function makeAsphaltTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#8a8f96";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const v = Math.floor(Math.random() * 40);
    g.fillStyle = `rgba(${v},${v},${v},0.16)`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  g.fillStyle = "#e8e8e8";
  g.fillRect(4, 0, 5, 256);
  g.fillRect(247, 0, 5, 256);
  g.fillStyle = "#ffd23e";
  for (let y = 0; y < 256; y += 64) {
    g.fillRect(124, y, 8, 34);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function ribbon(track, offInner, offOuter, yOff, uvScaleV, colorFn) {
  const n = track.n;
  const pos = [];
  const uv = [];
  const col = [];
  const idx = [];
  for (let i = 0; i < n; i++) {
    const cx = track.px[i];
    const cy = track.py[i];
    const cz = track.pz[i];
    const nxv = track.nx[i];
    const nzv = track.nz[i];
    const s = track.cum[i];
    const ax = cx + nxv * offInner;
    const az = cz + nzv * offInner;
    const bx = cx + nxv * offOuter;
    const bz = cz + nzv * offOuter;
    pos.push(ax, cy + yOff, az, bx, cy + yOff, bz);
    uv.push(0, s / uvScaleV, 1, s / uvScaleV);
    if (colorFn) {
      const cA = colorFn(i, s);
      col.push(cA.r, cA.g, cA.b, cA.r, cA.g, cA.b);
    } else {
      col.push(1, 1, 1, 1, 1, 1);
    }
    const i2 = (i + 1) % n;
    const a = i * 2;
    const b = i * 2 + 1;
    const c = i2 * 2;
    const d = i2 * 2 + 1;
    idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

const SURF_TINTS = {
  asphalt: new THREE.Color("#ffffff"),
  dirt: new THREE.Color("#d8b072"),
  ice: new THREE.Color("#d6ecff"),
  metal: new THREE.Color("#c2ccda")
};

export function buildTrackScene(track, def, quality) {
  const group = new THREE.Group();
  const accent = THEME_ACCENTS[def.theme] || THEME_ACCENTS.coast;
  const tex = makeAsphaltTexture();

  const surfColorFn = (i, s) => SURF_TINTS[track.surfAt(s)] || SURF_TINTS.asphalt;
  const roadMat = new THREE.MeshPhongMaterial({ map: tex, vertexColors: true, shininess: 8 });
  const halfW = track.halfW;
  const roadGeo = ribbon(track, halfW, -halfW, 0.05, 9, surfColorFn);
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.receiveShadow = quality !== "low";
  group.add(road);

  const curbMat = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 20 });
  for (const side of [1, -1]) {
    const o1 = side > 0 ? halfW - 0.15 : -halfW - 0.55;
    const o2 = side > 0 ? halfW + 0.55 : -halfW + 0.15;
    const cg = ribbon(track, o1, o2, 0.09, 4, null);
    const cnt = cg.attributes.position.count;
    const cols = new Float32Array(cnt * 3);
    for (let i = 0; i < cnt / 2; i++) {
      const c = (Math.floor(i / 2) % 2 === 0) ? new THREE.Color(accent.curbA) : new THREE.Color(accent.curbB);
      cols[i * 6] = c.r; cols[i * 6 + 1] = c.g; cols[i * 6 + 2] = c.b;
      cols[i * 6 + 3] = c.r; cols[i * 6 + 4] = c.g; cols[i * 6 + 5] = c.b;
    }
    cg.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    const cm = new THREE.Mesh(cg, curbMat);
    group.add(cm);
  }

  const wallMat = new THREE.MeshPhongMaterial({
    color: new THREE.Color(accent.wall),
    emissive: new THREE.Color(accent.emissive),
    emissiveIntensity: 0.55,
    shininess: 30
  });
  for (const side of [1, -1]) {
    const o = side * (halfW + 0.75);
    const wg = wallRibbon(track, o, accent.h);
    const wm = new THREE.Mesh(wg, wallMat);
    wm.castShadow = false;
    group.add(wm);
  }

  const postGeo = new THREE.BoxGeometry(0.14, accent.h * 2.4, 0.14);
  const postSpacing = Math.max(8, Math.floor(track.n / Math.max(40, track.n / 6)));
  const postCount = Math.floor(track.n / postSpacing) * 2;
  if (postCount > 0) {
    const posts = new THREE.InstancedMesh(postGeo, wallMat, postCount);
    const m4 = new THREE.Matrix4();
    let pi = 0;
    for (let i = 0; i < track.n; i += postSpacing) {
      for (const side of [1, -1]) {
        if (pi >= postCount) break;
        const ox = track.px[i] + track.nx[i] * side * (halfW + 0.78);
        const oz = track.pz[i] + track.nz[i] * side * (halfW + 0.78);
        m4.makeTranslation(ox, track.py[i] + accent.h * 1.2, oz);
        posts.setMatrixAt(pi++, m4);
      }
    }
    posts.count = pi;
    posts.instanceMatrix.needsUpdate = true;
    group.add(posts);
  }

  const stripY = 0.11;
  const neonEdgeMat = def.theme === "city" || def.theme === "future" || def.theme === "snow"
    ? new THREE.MeshBasicMaterial({ color: new THREE.Color(def.theme === "future" ? "#7c4dff" : "#00e5ff"), transparent: true, opacity: 0.85 })
    : null;
  if (neonEdgeMat) {
    const stripW = 0.18;
    for (const side of [1, -1]) {
      const o1 = side > 0 ? halfW - 0.28 : -halfW + 0.28;
      const o2 = o1 + side * stripW * 2;
      const sg = ribbon(track, o1, o2, stripY, 9, null);
      const sm = new THREE.Mesh(sg, neonEdgeMat);
      group.add(sm);
    }
  }

  const arches = [];
  const pillarGeo = new THREE.BoxGeometry(0.8, 6, 0.8);
  const beamGeo = new THREE.BoxGeometry(halfW * 2 + 3, 0.9, 0.9);
  const neonMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(def.theme === "future" ? "#7c4dff" : "#00e5ff") });
  const pillarMat = new THREE.MeshPhongMaterial({ color: 0x1c2129, shininess: 40 });
  for (const frac of [0.25, 0.5, 0.75]) {
    const sm = track.sampleAt(frac * track.total);
    const a = new THREE.Group();
    for (const sd of [1, -1]) {
      const p = new THREE.Mesh(pillarGeo, pillarMat);
      p.position.set(sm.x + sm.nx * sd * (halfW + 1), sm.y + 3, sm.z + sm.nz * sd * (halfW + 1));
      a.add(p);
    }
    const yaw = Math.atan2(sm.tx, sm.tz);
    a.rotation.y = yaw;
    const beam = new THREE.Mesh(beamGeo, pillarMat);
    beam.position.y = 6;
    a.add(beam);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 + 2, 0.25, 0.2), neonMat);
    glow.position.y = 5.45;
    a.add(glow);
    const lamps = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.16, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe9b0 }),
      6
    );
    const lm = new THREE.Matrix4();
    for (let li = 0; li < 6; li++) {
      lm.makeTranslation(-halfW + (li / 5) * halfW * 2, 5.75, 0);
      lamps.setMatrixAt(li, lm);
    }
    a.add(lamps);
    group.add(a);
    arches.push(a);
  }

  const startSm = track.sampleAt(2);
  const startGroup = new THREE.Group();
  for (const sd of [1, -1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.1, 8, 1.1), pillarMat);
    p.position.set(startSm.x + startSm.nx * sd * (halfW + 1.2), startSm.y + 4, startSm.z + startSm.nz * sd * (halfW + 1.2));
    startGroup.add(p);
  }
  startGroup.rotation.y = Math.atan2(startSm.tx, startSm.tz);
  const bannerTex = makeBannerTexture(def.name.toUpperCase());
  const banner = new THREE.Mesh(
    new THREE.BoxGeometry(halfW * 2 + 4, 1.8, 0.3),
    [
      pillarMat, pillarMat, pillarMat, pillarMat,
      new THREE.MeshBasicMaterial({ map: bannerTex }),
      new THREE.MeshBasicMaterial({ map: bannerTex })
    ]
  );
  banner.position.y = 7.4;
  startGroup.add(banner);
  const startLine = new THREE.Mesh(
    new THREE.PlaneGeometry(halfW * 2, 3),
    new THREE.MeshBasicMaterial({ map: makeCheckerTexture() })
  );
  startLine.rotation.x = -Math.PI / 2;
  startLine.rotation.z = -Math.atan2(startSm.tx, startSm.tz);
  startLine.position.set(startSm.x, startSm.y + 0.07, startSm.z);
  group.add(startLine);
  group.add(startGroup);

  function dispose() {
    tex.dispose();
    bannerTex.dispose();
    group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) m.dispose();
    });
  }

  return { group, dispose };
}

function wallRibbon(track, offset, h) {
  const n = track.n;
  const pos = [];
  const idx = [];
  for (let i = 0; i < n; i++) {
    const cx = track.px[i];
    const cy = track.py[i];
    const cz = track.pz[i];
    const ox = cx + track.nx[i] * offset;
    const oz = cz + track.nz[i] * offset;
    pos.push(ox, cy, oz, ox, cy + h, oz);
    const i2 = (i + 1) % n;
    const a = i * 2, b = i * 2 + 1, c = i2 * 2, d = i2 * 2 + 1;
    idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function makeBannerTexture(text) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 1024, 0);
  grad.addColorStop(0, "#0b0f1a");
  grad.addColorStop(0.5, "#14243a");
  grad.addColorStop(1, "#0b0f1a");
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 128);
  g.strokeStyle = "#00e5ff";
  g.lineWidth = 6;
  g.strokeRect(6, 6, 1012, 116);
  g.fillStyle = "#ffffff";
  g.font = "italic bold 72px Arial";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 512, 70);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

function makeCheckerTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 32;
  const g = c.getContext("2d");
  for (let x = 0; x < 16; x++) {
    for (let y = 0; y < 2; y++) {
      g.fillStyle = (x + y) % 2 === 0 ? "#f2f2f2" : "#111111";
      g.fillRect(x * 16, y * 16, 16, 16);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  return tex;
}
