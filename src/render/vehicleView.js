import * as THREE from "three";

const SHAPES = {
  hatch: { L: 3.5, W: 1.78, H: 0.62, cab: [1.5, 0.62, 2.0], cabY: 0.28, cabZ: -0.15, wheel: 0.32, spoiler: 0 },
  muscle: { L: 4.8, W: 2.0, H: 0.66, cab: [1.6, 0.55, 1.7], cabY: 0.22, cabZ: -0.55, wheel: 0.37, spoiler: 1 },
  gt: { L: 4.5, W: 1.95, H: 0.58, cab: [1.55, 0.52, 1.9], cabY: 0.2, cabZ: -0.35, wheel: 0.35, spoiler: 1 },
  rally: { L: 4.3, W: 1.92, H: 0.68, cab: [1.6, 0.6, 1.9], cabY: 0.26, cabZ: -0.2, wheel: 0.37, spoiler: 1 },
  super: { L: 4.6, W: 2.02, H: 0.5, cab: [1.4, 0.46, 1.7], cabY: 0.16, cabZ: -0.4, wheel: 0.35, spoiler: 2 },
  hyper: { L: 4.75, W: 2.06, H: 0.46, cab: [1.35, 0.42, 1.65], cabY: 0.15, cabZ: -0.45, wheel: 0.36, spoiler: 2 },
  concept: { L: 4.9, W: 2.1, H: 0.44, cab: [1.3, 0.4, 1.7], cabY: 0.13, cabZ: -0.5, wheel: 0.36, spoiler: 3 },
  traffic: { L: 4.4, W: 1.85, H: 0.85, cab: [1.7, 0.62, 1.6], cabY: 0.3, cabZ: -0.2, wheel: 0.35, spoiler: 0 }
};

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

  const bodyMat = new THREE.MeshPhongMaterial({
    color: new THREE.Color(paint),
    shininess: 80,
    specular: new THREE.Color("#666666")
  });
  const glassMat = new THREE.MeshPhongMaterial({ color: 0x0b1220, shininess: 160, specular: 0xbbccff });
  const darkMat = new THREE.MeshPhongMaterial({ color: 0x14171c, shininess: 30 });
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6d8 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0x550000 });
  const rimMat = new THREE.MeshPhongMaterial({ color: new THREE.Color(rimCol), shininess: 100 });
  const tireMat = new THREE.MeshPhongMaterial({ color: 0x101216, shininess: 12 });

  if (ghost) {
    for (const m of [bodyMat, glassMat, darkMat, headMat, tailMat, rimMat, tireMat]) {
      m.transparent = true;
      m.opacity = 0.3;
      m.depthWrite = false;
    }
  }

  const halfL = shape.L / 2;
  const halfW = shape.W / 2;

  body.add(mkBox(shape.W, shape.H, shape.L, bodyMat, 0, 0.42, 0));
  const nose = mkBox(shape.W * 0.86, shape.H * 0.55, 0.7, bodyMat, 0, 0.42, halfL - 0.28);
  body.add(nose);
  const cab = mkBox(shape.cab[0], shape.cab[1], shape.cab[2], glassMat, 0, 0.42 + shape.H / 2 + shape.cab[1] / 2 - 0.06, shape.cabZ);
  body.add(cab);

  if (shape.spoiler >= 1 && opts.spoiler !== "none") {
    const big = shape.spoiler >= 2;
    const wing = mkBox(big ? shape.W * 0.98 : shape.W * 0.8, 0.06, big ? 0.42 : 0.3, darkMat, 0, 0.42 + shape.H / 2 + (big ? 0.3 : 0.18), -halfL + 0.16);
    body.add(wing);
    body.add(mkBox(0.08, big ? 0.3 : 0.18, 0.08, darkMat, shape.W * 0.32, 0.42 + shape.H / 2 + (big ? 0.15 : 0.09), -halfL + 0.2));
    body.add(mkBox(0.08, big ? 0.3 : 0.18, 0.08, darkMat, -shape.W * 0.32, 0.42 + shape.H / 2 + (big ? 0.15 : 0.09), -halfL + 0.2));
  }
  if (shape.spoiler === 3) {
    const trim = mkBox(shape.W * 0.9, 0.03, 0.06, headMat, 0, 0.5, halfL + 0.02);
    body.add(trim);
    body.add(mkBox(0.04, 0.04, shape.L * 0.7, headMat, halfW - 0.01, 0.62, 0));
    body.add(mkBox(0.04, 0.04, shape.L * 0.7, headMat, -halfW + 0.01, 0.62, 0));
  }

  body.add(mkBox(0.34, 0.12, 0.06, headMat, halfW * 0.55, 0.48, halfL + 0.01));
  body.add(mkBox(0.34, 0.12, 0.06, headMat, -halfW * 0.55, 0.48, halfL + 0.01));
  const tail = mkBox(shape.W * 0.82, 0.1, 0.05, tailMat, 0, 0.52, -halfL - 0.01);
  body.add(tail);
  body.add(mkBox(shape.W * 0.96, 0.16, shape.L * 0.9, darkMat, 0, 0.24, 0));

  const wheelGeo = new THREE.CylinderGeometry(shape.wheel, shape.wheel, 0.26, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  const wx = halfW - 0.08;
  const wzF = halfL * 0.62;
  const wzR = -halfL * 0.62;
  for (const [x, z, front] of [[wx, wzF, 1], [-wx, wzF, 1], [wx, wzR, 0], [-wx, wzR, 0]]) {
    const wg = new THREE.Group();
    wg.position.set(x, shape.wheel, z);
    wg.rotation.order = "YXZ";
    const mesh = new THREE.Mesh(wheelGeo, [tireMat, rimMat, rimMat]);
    mesh.castShadow = !ghost;
    wg.add(mesh);
    body.add(wg);
    wheels.push({ group: wg, front: !!front });
  }

  const flameL = new THREE.Object3D();
  flameL.position.set(-halfW * 0.4, 0.38, -halfL - 0.15);
  body.add(flameL);
  const flameR = new THREE.Object3D();
  flameR.position.set(halfW * 0.4, 0.38, -halfL - 0.15);
  body.add(flameR);

  return {
    group,
    body,
    wheels,
    tailMat,
    bodyMat,
    baseColor: new THREE.Color(paint),
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
  const steerVis = core.steer * 1.5;
  for (const w of view.wheels) {
    w.group.rotation.x = spin;
    if (w.front) w.group.rotation.y = steerVis;
  }
}

export function updateCarCosmetics(view, core) {
  const braking = core.input.brake > 0 || core.drifting;
  const boosting = core.nitroActive;
  if (braking || boosting) {
    view.tailMat.color.setRGB(boosting ? 1 : 1, braking ? 0.15 : 0.05, braking ? 0.1 : 0.03);
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
