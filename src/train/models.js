// Rolling stock built from primitives at HO size. Each model's origin sits on
// the rail top at the car's center, facing +x. Trucks are at ±truck along x.
import * as THREE from 'three';
import { GAUGE } from '../track/pieces.js';

const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.15, ...opts });

function box(w, h, d, m, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  return mesh;
}

function cylX(r, len, m, x, y, z = 0, seg = 20) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), m);
  mesh.rotation.z = Math.PI / 2;
  mesh.position.set(x, y, z);
  return mesh;
}

function wheelset(radius, m, x, wheels, spoked = false) {
  const g = new THREE.Group();
  for (const side of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.0016, spoked ? 18 : 14), m);
    w.rotation.x = Math.PI / 2;
    w.position.z = (side * GAUGE) / 2;
    g.add(w);
    if (spoked) {
      // Counterweight so rotation reads.
      const cw = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.9, radius * 0.5, 0.0005), mat(0xdedad2, { metalness: 0.6 }));
      cw.position.set(0, radius * 0.45, side * (GAUGE / 2 + 0.0011));
      g.add(cw);
    }
  }
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.0008, 0.0008, GAUGE, 6), m);
  axle.rotation.x = Math.PI / 2;
  g.add(axle);
  g.position.set(x, radius, 0);
  wheels.push({ mesh: g, radius });
  return g;
}

function truck(x, wheels, frameMat, wheelMat) {
  const g = new THREE.Group();
  g.add(box(0.026, 0.006, 0.022, frameMat, 0, 0.006, 0));
  g.add(wheelset(0.0048, wheelMat, -0.0085, wheels));
  g.add(wheelset(0.0048, wheelMat, 0.0085, wheels));
  g.position.x = x;
  return g;
}

function finish(group) {
  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return group;
}

export function buildSteamLoco() {
  const g = new THREE.Group();
  const wheels = [];
  const black = mat(0x1d1d1f, { roughness: 0.45, metalness: 0.35 });
  const boilerMat = mat(0x173a2b, { roughness: 0.35, metalness: 0.3 }); // deep green
  const brass = mat(0xc49a3a, { roughness: 0.3, metalness: 0.9 });
  const red = mat(0x8e2a22);
  const steel = mat(0x8c8c8c, { metalness: 0.8, roughness: 0.35 });

  // Frame and running boards.
  g.add(box(0.13, 0.006, 0.024, black, 0.0, 0.017));
  g.add(box(0.1, 0.0015, 0.04, black, 0.012, 0.024));
  // Boiler and smokebox.
  g.add(cylX(0.0135, 0.082, boilerMat, 0.02, 0.0365));
  g.add(cylX(0.0142, 0.022, black, 0.07, 0.0365));
  g.add(cylX(0.0142, 0.002, brass, 0.059, 0.0365));
  g.add(cylX(0.0142, 0.002, brass, 0.022, 0.0365));
  // Smokestack, sand and steam domes.
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.0048, 0.0038, 0.016, 16), black);
  stack.position.set(0.072, 0.056, 0);
  g.add(stack);
  const dome1 = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), brass);
  dome1.scale.set(1, 1.3, 1);
  dome1.position.set(0.035, 0.049, 0);
  const dome2 = dome1.clone();
  dome2.material = boilerMat;
  dome2.position.x = 0.008;
  g.add(dome1, dome2);
  // Bell and whistle.
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0028, 0.004, 12), brass);
  bell.position.set(0.05, 0.052, 0);
  g.add(bell);
  // Headlight.
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.006, 14), black);
  lamp.rotation.z = Math.PI / 2;
  lamp.position.set(0.078, 0.05, 0);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.0028, 16), new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xffe9b0, emissiveIntensity: 2.5 }));
  lens.rotation.y = Math.PI / 2;
  lens.position.set(0.0812, 0.05, 0);
  g.add(lamp, lens);
  // Cab.
  const cabMat = boilerMat;
  g.add(box(0.034, 0.034, 0.034, cabMat, -0.04, 0.038));
  g.add(box(0.04, 0.0025, 0.04, black, -0.04, 0.0565));
  const cabGlass = new THREE.MeshStandardMaterial({ color: 0x1a2228, roughness: 0.1, metalness: 0.2 });
  for (const side of [-1, 1]) g.add(box(0.012, 0.01, 0.0005, cabGlass, -0.035, 0.045, side * 0.0172));
  g.add(box(0.0005, 0.009, 0.008, cabGlass, -0.0228, 0.047, 0.009));
  g.add(box(0.0005, 0.009, 0.008, cabGlass, -0.0228, 0.047, -0.009));
  // Pilot (cowcatcher).
  const pilot = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.012, 4), red);
  pilot.rotation.set(0, Math.PI / 4, -Math.PI / 2);
  pilot.scale.set(1, 1, 0.7);
  pilot.position.set(0.075, 0.009, 0);
  g.add(pilot);
  // Cylinders.
  for (const side of [-1, 1]) g.add(cylX(0.0045, 0.016, black, 0.058, 0.014, side * 0.0135));
  // Drivers (3 per side) and pilot wheels.
  const drivers = [];
  for (const x of [-0.017, 0.004, 0.025]) {
    const ws = wheelset(0.0088, black, x, wheels, true);
    drivers.push(ws);
    g.add(ws);
  }
  g.add(wheelset(0.0045, black, 0.058, wheels));
  // Side rods follow the counterweights.
  const rods = [];
  for (const side of [-1, 1]) {
    const rod = box(0.044, 0.0012, 0.0006, steel, 0.004, 0.0088, side * (GAUGE / 2 + 0.0022));
    rods.push(rod);
    g.add(rod);
  }
  // Number plate.
  g.add(cylX(0.006, 0.0008, brass, 0.0815, 0.0365));
  g.userData = {
    kind: 'loco',
    length: 0.17,
    truck: 0.032,
    wheels,
    rods,
    stackTop: new THREE.Vector3(0.072, 0.065, 0),
    cab: new THREE.Vector3(-0.02, 0.056, 0.0235),
    headlight: new THREE.Vector3(0.082, 0.05, 0),
  };
  return finish(g);
}

export function buildTender() {
  const g = new THREE.Group();
  const wheels = [];
  const black = mat(0x1d1d1f, { roughness: 0.5, metalness: 0.3 });
  const body = mat(0x173a2b, { roughness: 0.4, metalness: 0.3 });
  const coal = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6, metalness: 0.2, flatShading: true });
  g.add(box(0.074, 0.004, 0.03, black, 0, 0.0145));
  g.add(box(0.07, 0.026, 0.034, body, 0, 0.0295));
  const pile = new THREE.Mesh(new THREE.IcosahedronGeometry(0.014, 1), coal);
  pile.scale.set(1.6, 0.35, 1.05);
  pile.position.set(0.012, 0.0425, 0);
  g.add(pile);
  g.add(box(0.07, 0.0015, 0.035, black, 0, 0.0428));
  g.add(truck(0.022, wheels, black, black));
  g.add(truck(-0.022, wheels, black, black));
  g.userData = { kind: 'tender', length: 0.078, truck: 0.022, wheels };
  return finish(g);
}

export function buildBoxcar(color = 0x7a3221, roadName = true) {
  const g = new THREE.Group();
  const wheels = [];
  const black = mat(0x202020, { roughness: 0.6 });
  const body = mat(color, { roughness: 0.75, metalness: 0.05 });
  const L = 0.13;
  g.add(box(L, 0.004, 0.03, black, 0, 0.0145));
  g.add(box(L - 0.004, 0.037, 0.035, body, 0, 0.0355));
  // Roof and ribs.
  g.add(box(L, 0.002, 0.037, body, 0, 0.0548));
  g.add(box(L - 0.01, 0.0012, 0.004, black, 0, 0.0564));
  for (let i = -5; i <= 5; i++) {
    if (Math.abs(i) < 1) continue;
    for (const side of [-1, 1]) g.add(box(0.0012, 0.035, 0.0006, body, i * 0.011, 0.0355, side * 0.0178));
  }
  // Doors.
  const door = mat(new THREE.Color(color).multiplyScalar(0.8), { roughness: 0.8 });
  for (const side of [-1, 1]) g.add(box(0.026, 0.033, 0.001, door, 0, 0.034, side * 0.0179));
  if (roadName) {
    const plate = mat(0xe8e2d0, { roughness: 0.9 });
    for (const side of [-1, 1]) g.add(box(0.03, 0.004, 0.0004, plate, -0.035, 0.046, side * 0.0181));
  }
  g.add(truck(0.048, wheels, black, black));
  g.add(truck(-0.048, wheels, black, black));
  g.userData = { kind: 'boxcar', length: 0.14, truck: 0.048, wheels };
  return finish(g);
}

export function buildCaboose() {
  const g = new THREE.Group();
  const wheels = [];
  const black = mat(0x202020, { roughness: 0.6 });
  const red = mat(0xa62f22, { roughness: 0.6 });
  const yellow = mat(0xe2c25a, { roughness: 0.6 });
  const glass = new THREE.MeshStandardMaterial({ color: 0xffe6a8, emissive: 0xffc970, emissiveIntensity: 0.6, roughness: 0.2 });
  g.add(box(0.1, 0.004, 0.032, black, 0, 0.0145));
  g.add(box(0.074, 0.034, 0.034, red, 0, 0.034));
  g.add(box(0.08, 0.002, 0.037, black, 0, 0.0515));
  // Cupola.
  g.add(box(0.026, 0.012, 0.03, red, 0, 0.058));
  g.add(box(0.03, 0.0015, 0.033, black, 0, 0.0645));
  for (const side of [-1, 1]) {
    for (const x of [-0.024, -0.008, 0.008, 0.024]) g.add(box(0.006, 0.008, 0.0005, glass, x, 0.039, side * 0.0172));
    g.add(box(0.006, 0.005, 0.0005, glass, 0, 0.059, side * 0.0152));
  }
  // End platforms and railings.
  for (const end of [-1, 1]) {
    g.add(box(0.012, 0.002, 0.034, black, end * 0.043, 0.0175));
    g.add(box(0.0008, 0.012, 0.034, yellow, end * 0.0485, 0.024));
  }
  g.add(truck(0.03, wheels, black, black));
  g.add(truck(-0.03, wheels, black, black));
  g.userData = { kind: 'caboose', length: 0.104, truck: 0.03, wheels };
  return finish(g);
}
