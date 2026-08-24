import * as THREE from "three";

const SHAPES = {
  hatch: { L: 3.5, W: 1.78, H: 0.6, cabW: 1.5, cabH: 0.56, cabL: 2.0, cabY: 0.24, cabZ: -0.15, wheel: 0.33, spoiler: 0, stripe: false, scoop: false, exhaust: 1 },
  muscle: { L: 4.8, W: 2.0, H: 0.62, cabW: 1.62, cabH: 0.52, cabL: 1.7, cabY: 0.18, cabZ: -0.55, wheel: 0.38, spoiler: 1, stripe: true, scoop: true, exhaust: 2 },
  gt: { L: 4.5, W: 1.95, H: 0.54, cabW: 1.55, cabH: 0.48, cabL: 1.9, cabY: 0.16, cabZ: -0.35, wheel: 0.36, spoiler: 1, stripe: true, scoop: false, exhaust: 2 },
  rally: { L: 4.3, W: 1.94, H: 0.64, cabW: 1.6, cabH: 0.56, cabL: 1.9, cabY: 0.22, cabZ: -0.2, wheel: 0.38, spoiler: 1, stripe: false, scoop: true, exhaust: 1 },
  super: { L: 4.6, W: 2.04, H: 0.48, cabW: 1.42, cabH: 0.44, cabL: 1.7, cabY: 0.12, cabZ: -0.4, wheel: 0.36, spoiler: 2, stripe: false, scoop: false, exhaust: 3 },
  hyper: { L: 4.75, W: 2.08, H: 0.44, cabW: 1.36, cabH: 0.4, cabL: 1.66, cabY: 0.11, cabZ: -0.45, wheel: 0.37, spoiler: 2, stripe: true, scoop: false, exhaust: 3 },
  concept: { L: 4.9, W: 2.12, H: 0.42, cabW: 1.32, cabH: 0.38, cabL: 1.72, cabY: 0.1, cabZ: -0.5, wheel: 0.37, spoiler: 3, stripe: true, scoop: false, exhaust: 2 },
  traffic: { L: 4.4, W: 1.85, H: 0.8, cabW: 1.7, cabH: 0.58, cabL: 1.6, cabY: 0.26, cabZ: -0.2, wheel: 0.35, spoiler: 0, stripe: false, scoop: false, exhaust: 1 }
};

let _wheelTex = null;
function wheelTexture() {
  if (_wheelTex) return _wheelTex;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#101319";
  g.fillRect(0, 0, 256, 256);
  g.beginPath();
  g.arc(128, 128, 122, 0, Math.PI * 2);
  g.fillStyle = "#15181e";
  g.fill();
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
  g.fillStyle = "#22262d";
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.beginPath();
    g.arc(128 + Math.cos(a) * 22, 128 + Math.sin(a) * 22, 5, 0, Math.PI * 2);
    g.fill();
  }
  _wheelTex = new THREE.CanvasTexture(c);
  return _wheelTex;
}

function mkBox(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

export function buildCarMesh(spec, opts = {}) {
  const shape = SHAPES[spec.shape] || SHAPES.gt;
  const ghost = !!opts.ghost;
  const paint = opts.paint || spec.color;
  const rimCol = opts.rim || "#181c22";
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);

  const baseColor = new THREE.Color(paint);
  const paintMat = new THREE.MeshPhongMaterial({ color: baseColor, shininess: 120, specular: new THREE.Color("#8a8f98") });
  const darkPaint = new THREE.MeshPhongMaterial({
    color: baseColor.clone().multiplyScalar(0.42),
    shininess: 60,
    specular: new THREE.Color("#333333")
  });
  const carbon = new THREE.MeshPhongMaterial({ color: 0x14171c, shininess: 24, specular: new THREE.Color("#222") });
  const metal = new THREE.MeshPhongMaterial({ color: 0x6b7480, shininess: 140, specular: new THREE.Color("#ccced2") });
  const glassMat = new THREE.MeshPhongMaterial({ color: 0x0a1018, shininess: 200, specular: new THREE.Color("#aaccee") });
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6da });
  const drlMat = new THREE.MeshBasicMaterial({ color: 0xbfe9ff });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0x550000 });

  if (rimCol !== "#181c22" || ghost) {
    /* rim tint handled below */
  }
  if (ghost) {
    for (const m of [paintMat, darkPaint, carbon, metal, glassMat, headMat, drlMat, tailMat]) {
      m.transparent = true;
      m.opacity = 0.28;
      m.depthWrite = false;
    }
  }

  const halfL = shape.L / 2;
  const halfW = shape.W / 2;

  body.add(mkBox(shape.W * 0.97, shape.H * 0.46, shape.L * 0.93, carbon, 0, 0.31, 0));
  body.add(mkBox(shape.W, shape.H, shape.L * 0.995, paintMat, 0, 0.52, 0));
  const shoulder = mkBox(shape.W * 1.01, shape.H * 0.16, shape.L * 0.86, darkPaint, 0, 0.52 + shape.H / 2 - 0.05, -shape.L * 0.02);
  body.add(shoulder);

  const nose = mkBox(shape.W * 0.88, shape.H * 0.52, shape.L * 0.2, paintMat, 0, 0.44, halfL - shape.L * 0.09);
  body.add(nose);
  body.add(mkBox(shape.W * 1.04, 0.07, 0.34, carbon, 0, 0.24, halfL - 0.06));

  const cabinY = 0.52 + shape.H / 2 + shape.cabH / 2 - 0.03;
  const cabin = mkBox(shape.cabW, shape.cabH, shape.cabL, glassMat, 0, cabinY, shape.cabZ);
  body.add(cabin);
  const windshield = mkBox(shape.cabW * 0.94, 0.05, shape.cabL * 0.42, glassMat, 0, cabinY + shape.cabH / 2 - 0.02, shape.cabZ + shape.cabL * 0.3);
  windshield.rotation.x = -0.32;
  body.add(windshield);
  const roof = mkBox(shape.cabW * 0.82, 0.05, shape.cabL * 0.62, darkPaint, 0, cabinY + shape.cabH / 2 + 0.005, shape.cabZ - 0.05);
  body.add(roof);

  for (const sd of [1, -1]) {
    body.add(mkBox(0.06, 0.07, 0.2, carbon, sd * (halfW + 0.02), 0.56, halfL * 0.28));
  }

  if (shape.scoop) {
    body.add(mkBox(shape.W * 0.3, 0.09, shape.L * 0.16, darkPaint, 0, 0.52 + shape.H / 2 + 0.03, halfL * 0.42));
  }
  if (shape.stripe && !ghost) {
    const stripeMat = new THREE.MeshPhongMaterial({
      color: new THREE.Color(paint).offsetHSL(0, 0, 0.5 > 1 ? 0 : 0),
      emissive: new THREE.Color(paint).multiplyScalar(0.15),
      shininess: 90
    });
    stripeMat.color = new THREE.Color("#f2f2f2").lerp(new THREE.Color(paint), 0.25);
    body.add(mkBox(0.14, 0.015, shape.L * 0.96, stripeMat, 0, 0.52 + shape.H / 2 + 0.008, 0));
  }

  if (shape.spoiler >= 1 && opts.spoiler !== "none") {
    const big = shape.spoiler >= 2;
    const wY = 0.52 + shape.H / 2 + (big ? 0.34 : 0.2);
    const wingW = big ? shape.W * 0.96 : shape.W * 0.78;
    const wing = mkBox(wingW, 0.055, big ? 0.4 : 0.28, big ? carbon : darkPaint, 0, wY, -halfL + 0.18);
    wing.rotation.x = -0.12;
    body.add(wing);
    if (big) {
      body.add(mkBox(0.05, 0.16, 0.42, carbon, wingW / 2, wY, -halfL + 0.18));
      body.add(mkBox(0.05, 0.16, 0.42, carbon, -wingW / 2, wY, -halfL + 0.18));
    }
    body.add(mkBox(0.07, big ? 0.3 : 0.17, 0.09, carbon, shape.W * 0.3, 0.52 + shape.H / 2 + (big ? 0.15 : 0.08), -halfL + 0.22));
    body.add(mkBox(0.07, big ? 0.3 : 0.17, 0.09, carbon, -shape.W * 0.3, 0.52 + shape.H / 2 + (big ? 0.15 : 0.08), -halfL + 0.22));
  }
  if (shape.spoiler === 3) {
    body.add(mkBox(0.035, 0.035, shape.L * 0.66, drlMat, halfW + 0.005, 0.6, -0.1));
    body.add(mkBox(0.035, 0.035, shape.L * 0.66, drlMat, -halfW - 0.005, 0.6, -0.1));
  }

  body.add(mkBox(0.36, 0.09, 0.05, headMat, halfW * 0.56, 0.56, halfL + 0.005));
  body.add(mkBox(0.36, 0.09, 0.05, headMat, -halfW * 0.56, 0.56, halfL + 0.005));
  body.add(mkBox(shape.W * 0.84, 0.045, 0.04, drlMat, 0, 0.47, halfL + 0.02));
  const tail = mkBox(shape.W * 0.86, 0.075, 0.05, tailMat, 0, 0.58, -halfL - 0.01);
  body.add(tail);

  for (let i = 0; i < 3; i++) {
    body.add(mkBox(0.05, shape.H * 0.4, 0.16, carbon, (i - 1) * shape.W * 0.22, 0.3, -halfL + 0.05));
  }
  const exY = 0.36;
  const exXs = shape.exhaust === 3 ? [-shape.W * 0.28, 0, shape.W * 0.28] : shape.exhaust === 2 ? [-shape.W * 0.2, shape.W * 0.2] : [shape.W * 0.12];
  for (const ex of exXs) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.14, 10), metal);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(ex, exY, -halfL - 0.03);
    body.add(pipe);
  }

  const flameL = new THREE.Object3D();
  flameL.position.set((exXs[0] || 0) - 0.08, exY, -halfL - 0.25);
  body.add(flameL);
  const flameR = new THREE.Object3D();
  flameR.position.set((exXs[exXs.length - 1] || 0) + 0.08, exY, -halfL - 0.25);
  body.add(flameR);

  const capMat = new THREE.MeshPhongMaterial({
    map: wheelTexture(),
    color: new THREE.Color(rimCol).lerp(new THREE.Color("#ffffff"), 0.25),
    shininess: 110,
    specular: new THREE.Color("#aabbcc")
  });
  const tireMat = new THREE.MeshPhongMaterial({ color: 0x0d0f13, shininess: 10 });
  const wheelGeo = new THREE.CylinderGeometry(shape.wheel, shape.wheel, 0.3, 20);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  const wx = halfW - 0.02;
  const wzF = halfL * 0.63;
  const wzR = -halfL * 0.63;
  for (const [x, z, front] of [[wx, wzF, 1], [-wx, wzF, 1], [wx, wzR, 0], [-wx, wzR, 0]]) {
    body.add(mkBox(0.1, shape.wheel * 1.25, shape.wheel * 2.1, darkPaint, x > 0 ? wx - 0.02 : -wx + 0.02, shape.wheel + 0.18, z));
    const wg = new THREE.Group();
    wg.position.set(x * 1.02, shape.wheel, z);
    wg.rotation.order = "YXZ";
    const mesh = new THREE.Mesh(wheelGeo, [tireMat, capMat, capMat]);
    mesh.castShadow = !ghost;
    wg.add(mesh);
    body.add(wg);
    wheels.push({ group: wg, front: !!front });
  }

  return {
    group,
    body,
    wheels,
    tailMat,
    bodyMat: paintMat,
    baseColor,
    flameAnchors: [flameL, flameR],
    length: shape.L,
    width: shape.W
  };
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
    const g = 1 - d * 0.45;
    view.bodyMat.color.copy(view.baseColor).multiplyScalar(g);
  } else {
    view.bodyMat.color.copy(view.baseColor);
  }
}
