import * as THREE from "three";
import { MAT } from "./materials.js";

const SHAPES = {
  hatch: { L: 3.6, W: 1.8, H: 0.72, cab: [1.5, 0.5, 1.9, -0.15], wheel: 0.33, spoiler: 0, stripe: false, scoop: false, exhaust: 1 },
  muscle: { L: 4.9, W: 2.02, H: 0.66, cab: [1.64, 0.46, 1.7, -0.55], wheel: 0.38, spoiler: 1, stripe: true, scoop: true, exhaust: 2 },
  gt: { L: 4.6, W: 1.98, H: 0.58, cab: [1.56, 0.42, 1.9, -0.35], wheel: 0.36, spoiler: 1, stripe: true, scoop: false, exhaust: 2 },
  rally: { L: 4.35, W: 1.96, H: 0.66, cab: [1.62, 0.5, 1.9, -0.2], wheel: 0.38, spoiler: 1, stripe: false, scoop: true, exhaust: 1 },
  super: { L: 4.7, W: 2.06, H: 0.52, cab: [1.44, 0.38, 1.7, -0.42], wheel: 0.36, spoiler: 2, stripe: false, scoop: false, exhaust: 3 },
  hyper: { L: 4.85, W: 2.1, H: 0.48, cab: [1.38, 0.34, 1.68, -0.47], wheel: 0.37, spoiler: 2, stripe: true, scoop: false, exhaust: 3 },
  concept: { L: 5.0, W: 2.14, H: 0.46, cab: [1.34, 0.32, 1.74, -0.52], wheel: 0.37, spoiler: 3, stripe: true, scoop: false, exhaust: 2 },
  traffic: { L: 4.45, W: 1.88, H: 0.86, cab: [1.72, 0.54, 1.6, -0.18], wheel: 0.35, spoiler: 0, stripe: false, scoop: false, exhaust: 1 }
};

function hullProfile(s) {
  const halfL = s.L / 2;
  const b = 0.24;
  const nose = 0.5 + s.H * 0.55;
  const pts = [
    [-halfL, b],
    [-halfL * 0.94, b + s.H * 0.55],
    [-halfL * 0.7, b + s.H * 0.92],
    [-halfL * 0.25, b + s.H],
    [halfL * 0.28, b + s.H * 0.96],
    [halfL * 0.62, b + s.H * 0.78],
    [halfL * 0.86, nose],
    [halfL, b + s.H * 0.28],
    [halfL * 0.98, b],
    [0, b]
  ];
  return pts;
}

function extrudeHull(pts, width, mat, bevel = 0.05) {
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.06, width - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 4
  });
  geo.rotateY(-Math.PI / 2);
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  geo.translate(-(bb.max.x + bb.min.x) / 2, 0, -(bb.max.z + bb.min.z) / 2);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

let _wheelTex = null;
function wheelTexture() {
  if (_wheelTex) return _wheelTex;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#101319";
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "#39414d";
  g.lineWidth = 10;
  g.beginPath();
  g.arc(128, 128, 116, 0, Math.PI * 2);
  g.stroke();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    g.save();
    g.translate(128, 128);
    g.rotate(a);
    g.fillStyle = i % 2 === 0 ? "#cfd8e2" : "#9aa6b4";
    g.fillRect(-13, -108, 26, 96);
    g.restore();
  }
  g.beginPath();
  g.arc(128, 128, 34, 0, Math.PI * 2);
  g.fillStyle = "#e8edf4";
  g.fill();
  _wheelTex = new THREE.CanvasTexture(c);
  return _wheelTex;
}

function mkBox(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

let _blobTex = null;
function blobTexture() {
  if (_blobTex) return _blobTex;
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 8, 64, 64, 62);
  grad.addColorStop(0, "rgba(0,0,0,0.55)");
  grad.addColorStop(0.7, "rgba(0,0,0,0.28)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  _blobTex = new THREE.CanvasTexture(c);
  return _blobTex;
}

export function buildCarMesh(spec, opts = {}) {
  const s = SHAPES[spec.shape] || SHAPES.gt;
  const ghost = !!opts.ghost;
  const paint = opts.paint || spec.color;
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const paintMat = ghost ? new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(paint), metalness: 0, roughness: 0.4,
    transparent: true, opacity: 0.28, depthWrite: false
  }) : MAT.paint(paint).clone();
  const darkMat = ghost ? paintMat : (opts.rim && opts.rim !== "#181c22" ? MAT.paintDark(paint) : MAT.carbon());
  const chromeMat = ghost ? paintMat : MAT.chrome();
  const glassMat = ghost ? paintMat : MAT.glass();
  const headMat = MAT.basicGlow(0xfff6da);
  const drlMat = MAT.basicGlow(0xbfe9ff);
  const tailMat = new THREE.MeshBasicMaterial({ color: 0x550000 });
  if (ghost) [headMat, drlMat, tailMat].forEach((m) => { m.transparent = true; m.opacity = 0.28; m.depthWrite = false; });

  const baseColor = new THREE.Color(paint);

  body.add(extrudeHull(hullProfile(s), s.W, paintMat));
  const underTray = mkBox(s.W * 0.86, 0.14, s.L * 0.8, darkMat, 0, 0.26, 0);
  body.add(underTray);

  const cabinY = 0.24 + s.H * 0.92;
  const cabW = Math.min(s.cab[0], s.W * 0.82);
  const cabin = extrudeHull(
    [
      [s.cab[3] - s.cab[2] / 2, cabinY - s.cab[1] * 0.4],
      [s.cab[3] - s.cab[2] * 0.28, cabinY + s.cab[1] * 0.55],
      [s.cab[3] + s.cab[2] * 0.22, cabinY + s.cab[1] * 0.6],
      [s.cab[3] + s.cab[2] / 2, cabinY - s.cab[1] * 0.5]
    ],
    cabW,
    glassMat,
    0.03
  );
  body.add(cabin);
  const roofCap = mkBox(cabW * 0.8, 0.04, s.cab[2] * 0.5, darkMat, 0, cabinY + s.cab[1] * 0.58, s.cab[3] - 0.03);
  body.add(roofCap);

  for (const sd of [1, -1]) {
    body.add(mkBox(0.07, 0.07, 0.22, darkMat, sd * (s.W / 2 + 0.01), 0.58, s.L * 0.14));
  }

  if (shape_scoop(s)) {
    body.add(mkBox(s.W * 0.3, 0.08, s.L * 0.15, darkMat, 0, 0.24 + s.H + 0.05, s.L * 0.2));
  }
  if (s.stripe && !ghost) {
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xe8ecf2, metalness: 0.2, roughness: 0.4 });
    body.add(mkBox(0.13, 0.012, s.L * 0.94, stripeMat, 0, 0.245 + s.H + 0.002, 0));
  }
  for (const sd of [1, -1]) {
    const flare = mkBox(0.09, 0.16, s.wheel * 2.4, darkMat, sd * (s.W / 2 - 0.02), s.wheel + 0.16, s.L * 0.31);
    body.add(flare);
    const flareR = mkBox(0.09, 0.16, s.wheel * 2.4, darkMat, sd * (s.W / 2 - 0.02), s.wheel + 0.16, -s.L * 0.31);
    body.add(flareR);
  }

  if (s.spoiler >= 1 && opts.spoiler !== "none") {
    const big = s.spoiler >= 2;
    const wY = 0.24 + s.H + (big ? 0.3 : 0.17);
    const wingW = big ? s.W * 0.96 : s.W * 0.76;
    const wing = mkBox(wingW, 0.05, big ? 0.4 : 0.27, big ? darkMat : darkMat, 0, wY, -s.L / 2 + 0.16);
    wing.rotation.x = -0.13;
    body.add(wing);
    if (big) {
      body.add(mkBox(0.045, 0.15, 0.4, darkMat, wingW / 2, wY, -s.L / 2 + 0.16));
      body.add(mkBox(0.045, 0.15, 0.4, darkMat, -wingW / 2, wY, -s.L / 2 + 0.16));
    }
    body.add(mkBox(0.06, big ? 0.26 : 0.15, 0.08, darkMat, s.W * 0.29, 0.24 + s.H + (big ? 0.14 : 0.07), -s.L / 2 + 0.2));
    body.add(mkBox(0.06, big ? 0.26 : 0.15, 0.08, darkMat, -s.W * 0.29, 0.24 + s.H + (big ? 0.14 : 0.07), -s.L / 2 + 0.2));
  }
  if (s.spoiler === 3) {
    body.add(mkBox(0.03, 0.03, s.L * 0.62, drlMat, s.W / 2 + 0.004, 0.62, -0.1));
    body.add(mkBox(0.03, 0.03, s.L * 0.62, drlMat, -s.W / 2 - 0.004, 0.62, -0.1));
  }

  body.add(mkBox(0.34, 0.08, 0.05, headMat, s.W * 0.28, 0.5, s.L / 2 + 0.005));
  body.add(mkBox(0.34, 0.08, 0.05, headMat, -s.W * 0.28, 0.5, s.L / 2 + 0.005));
  body.add(mkBox(s.W * 0.8, 0.035, 0.04, drlMat, 0, 0.42, s.L / 2 + 0.02));
  const tail = mkBox(s.W * 0.84, 0.07, 0.05, tailMat, 0, 0.6, -s.L / 2 - 0.01);
  body.add(tail);

  for (let i = 0; i < 3; i++) {
    body.add(mkBox(0.045, 0.2, 0.14, darkMat, (i - 1) * s.W * 0.22, 0.3, -s.L / 2 + 0.06));
  }
  const exY = 0.34;
  const exXs = s.exhaust === 3 ? [-s.W * 0.26, 0, s.W * 0.26] : s.exhaust === 2 ? [-s.W * 0.18, s.W * 0.18] : [s.W * 0.1];
  for (const ex of exXs) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.16, 10), chromeMat);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(ex, exY, -s.L / 2 - 0.02);
    body.add(pipe);
  }

  const flameL = new THREE.Object3D();
  flameL.position.set((exXs[0] || 0) - 0.06, exY, -s.L / 2 - 0.2);
  body.add(flameL);
  const flameR = new THREE.Object3D();
  flameR.position.set((exXs[exXs.length - 1] || 0) + 0.06, exY, -s.L / 2 - 0.2);
  body.add(flameR);

  const jets = [];
  if (!ghost) {
    const jetGeo = new THREE.ConeGeometry(0.12, 1.1, 8, 1, true);
    jetGeo.rotateX(Math.PI / 2);
    jetGeo.translate(0, 0, -0.55);
    const jetMatBase = new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const anchor of [flameL, flameR]) {
      const jet = new THREE.Mesh(jetGeo, jetMatBase.clone());
      anchor.add(jet);
      jet.visible = false;
      jets.push(jet);
    }
  }

  const capMat = ghost ? paintMat : new THREE.MeshPhongMaterial({
    map: wheelTexture(),
    color: new THREE.Color(opts.rim || "#cfd6dd").lerp(new THREE.Color("#ffffff"), 0.2),
    shininess: 110,
    specular: new THREE.Color("#aabbcc")
  });
  const tireMat = ghost ? paintMat : MAT.rubber();
  const wheelGeo = new THREE.CylinderGeometry(s.wheel, s.wheel, 0.3, 20);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  const wx = s.W / 2 - 0.03;
  for (const [x, z, front] of [[wx, s.L * 0.31, 1], [-wx, s.L * 0.31, 1], [wx, -s.L * 0.31, 0], [-wx, -s.L * 0.31, 0]]) {
    const wg = new THREE.Group();
    wg.position.set(x, s.wheel, z);
    wg.rotation.order = "YXZ";
    const mesh = new THREE.Mesh(wheelGeo, [tireMat, capMat, capMat]);
    mesh.castShadow = !ghost;
    wg.add(mesh);
    body.add(wg);
    wheels.push({ group: wg, front: !!front });
  }

  let blob = null;
  if (!ghost) {
    blob = new THREE.Mesh(
      new THREE.PlaneGeometry(s.W * 2.1, s.L * 1.25),
      new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.75 })
    );
    blob.rotation.x = -Math.PI / 2;
    blob.renderOrder = 1;
    group.add(blob);
  }

  return {
    group,
    body,
    wheels,
    tailMat,
    bodyMat: paintMat,
    baseColor,
    flameAnchors: [flameL, flameR],
    jets,
    length: s.L,
    width: s.W
  };
}

function shape_scoop(s) {
  return !!s.scoop;
}

export function syncCarView(view, core, dt) {
  view.group.position.set(core.pos.x, core.pos.y, core.pos.z);
  view.group.rotation.y = core.yaw;
  view.body.rotation.x = core.visPitch;
  view.body.rotation.z = core.visRoll;
  const spin = core.wheelSpin;
  const steerVis = core.steer * 1.4;
  for (const w of view.wheels) {
    w.group.rotation.x = spin;
    if (w.front) w.group.rotation.y = steerVis;
  }
  if (view.jets.length) {
    const on = core.nitroActive;
    const lvl = core.boostLevel;
    const t = performance.now() * 0.001;
    for (const j of view.jets) {
      j.visible = on;
      if (on) {
        const pulse = 0.75 + Math.sin(t * 40) * 0.25;
        const len = lvl === 3 ? 2.1 : lvl === 2 ? 1.6 : 1.15;
        j.scale.set(lvl >= 2 ? 1.35 : 1, lvl >= 2 ? 1.35 : 1, len * pulse);
        j.material.color.setHex(lvl === 3 ? 0x66e0ff : lvl === 2 ? 0x77b8ff : 0xffa030);
      }
    }
  }
}

export function updateCarCosmetics(view, core) {
  const braking = core.input.brake > 0 || core.drifting;
  const boosting = core.nitroActive;
  if (boosting) {
    view.tailMat.color.setRGB(1, 0.25, 0.15);
  } else if (braking) {
    view.tailMat.color.setRGB(1, 0.08, 0.05);
  } else {
    view.tailMat.color.setRGB(0.33, 0, 0);
  }
  const d = core.damage;
  if (d > 0.01) {
    const g = 1 - d * 0.4;
    view.bodyMat.color.copy(view.baseColor).multiplyScalar(g);
  } else {
    view.bodyMat.color.copy(view.baseColor);
  }
}
