// HO-scale people and animals (a 1.75 m person is about 20 mm tall).
// Static parts merge into one mesh per figure; moving limbs are separate.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const SKIN = ['#e9c39b', '#c99a72', '#8d5a3b', '#f1d2b6', '#a8724c'];
const SHIRTS = ['#3d5a80', '#9b2c2c', '#e0c35a', '#2f6b4a', '#d8d2c4', '#6b4f8a', '#c46a2f', '#5a6470', '#e8e8e8', '#2b6fa3'];
const PANTS = ['#2c3440', '#4a4036', '#5b6b7a', '#2a2a2a', '#6d5a3e', '#3b4a5c'];
const HAIR = ['#2a1d14', '#5a3b24', '#8a6a3c', '#b8a07a', '#1a1a1a', '#9a9a9a'];

const fmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });

function colored(geo, color) {
  const c = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (geo.index) return geo.toNonIndexed();
  return geo;
}
function part(geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const g = geo.clone();
  g.rotateX(rx);
  g.rotateY(ry);
  g.rotateZ(rz);
  g.translate(x, y, z);
  return colored(g, color);
}
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const C = (r, h, s = 8) => new THREE.CylinderGeometry(r, r, h, s);
const S = (r) => new THREE.SphereGeometry(r, 10, 8);

function pick(list, r) {
  return list[Math.floor(r() * list.length) % list.length];
}

function mesh(parts) {
  const m = new THREE.Mesh(mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p))), fmat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// type: stand | sit | fish | wave | walk | hike | worker | paddle
export function person(type = 'stand', r = Math.random, { scale = 1 } = {}) {
  const g = new THREE.Group();
  const skin = pick(SKIN, r), shirt = pick(SHIRTS, r), pants = pick(PANTS, r), hair = pick(HAIR, r);
  const parts = [];
  const sitting = type === 'sit' || type === 'paddle';
  const hip = sitting ? 0.0042 : 0.0098;
  // Legs.
  const legs = new THREE.Group();
  const legParts = [];
  if (sitting) {
    for (const z of [-0.0009, 0.0009]) {
      parts.push(part(B(0.0062, 0.0017, 0.0016), pants, 0.0029, hip - 0.0006, z));
      parts.push(part(B(0.0016, 0.0042, 0.0016), pants, 0.0058, hip - 0.0024, z));
      parts.push(part(B(0.0026, 0.0012, 0.0017), '#2a211b', 0.0066, 0.0006, z));
    }
  } else {
    for (const z of [-0.0009, 0.0009]) {
      const leg = [part(B(0.0017, hip - 0.0008, 0.0016), pants, 0, -(hip - 0.0008) / 2, 0), part(B(0.0027, 0.0012, 0.0017), '#2a211b', 0.0004, -hip + 0.0006, 0)];
      if (type === 'walk') {
        const pivot = new THREE.Group();
        pivot.position.set(0, hip, z);
        pivot.add(mesh(leg));
        legs.add(pivot);
        legParts.push(pivot);
      } else {
        leg.forEach((p) => p.translate(0, hip, z));
        parts.push(...leg);
      }
    }
  }
  // Torso, neck, head, hair.
  const tH = 0.0068;
  parts.push(part(B(0.0026, tH, 0.0044), shirt, sitting ? -0.0004 : 0, hip + tH / 2 - 0.0002, 0));
  parts.push(part(C(0.0006, 0.0008), skin, 0, hip + tH + 0.0003, 0));
  parts.push(part(S(0.00135), skin, 0.0001, hip + tH + 0.0016, 0));
  parts.push(part(S(0.0014), hair, -0.0003, hip + tH + 0.0021, 0));
  if (type === 'worker') {
    parts.push(part(C(0.0017, 0.001, 12), '#f2c230', 0, hip + tH + 0.0029, 0));
    parts.push(part(C(0.0022, 0.0003, 12), '#f2c230', 0.0003, hip + tH + 0.0024, 0));
  }
  if (type === 'hike') {
    parts.push(part(B(0.0022, 0.0055, 0.0036), '#7a3b26', -0.0024, hip + tH / 2 + 0.0004, 0));
    parts.push(part(C(0.0019, 0.0006, 10), '#6b5a3a', 0, hip + tH + 0.0028, 0)); // hat brim
    parts.push(part(C(0.0012, 0.0012, 10), '#6b5a3a', 0, hip + tH + 0.0034, 0));
  }
  // Arms.
  const shoulder = hip + tH - 0.0008;
  const arm = () => [part(B(0.0011, 0.0058, 0.0011), shirt, 0, -0.0029, 0), part(S(0.0007), skin, 0, -0.006, 0)];
  const animArms = [];
  for (const side of [-1, 1]) {
    const z = side * 0.0028;
    let rotZ = 0, rotX = 0;
    if (type === 'fish' && side === 1) rotZ = 1.0;
    if (type === 'paddle') rotZ = 0.9;
    if (type === 'sit') rotZ = 0.5;
    if (type === 'wave' && side === 1) {
      const pivot = new THREE.Group();
      pivot.position.set(0, shoulder, z);
      pivot.rotation.x = -2.6;
      pivot.add(mesh(arm()));
      g.add(pivot);
      animArms.push(pivot);
      continue;
    }
    if (type === 'walk') {
      const pivot = new THREE.Group();
      pivot.position.set(0, shoulder, z);
      pivot.add(mesh(arm()));
      g.add(pivot);
      animArms.push(pivot);
      continue;
    }
    arm().forEach((p) => {
      p.rotateX(rotX * side);
      p.rotateZ(rotZ);
      p.translate(0, shoulder, z);
      parts.push(p);
    });
  }
  if (type === 'fish') {
    // Rod and line.
    const rod = part(C(0.00025, 0.03, 4), '#3b2a1e', 0, 0, 0, 0, 0, -0.9);
    rod.translate(0.016, shoulder + 0.006, 0.0028);
    parts.push(rod);
  }
  const body = mesh(parts);
  g.add(body);
  if (legs.children.length) g.add(legs);
  let paddle = null;
  if (type === 'paddle') {
    paddle = new THREE.Group();
    paddle.position.set(0.004, shoulder - 0.002, 0);
    paddle.add(mesh([part(C(0.0003, 0.018, 4), '#8a6a44', 0, -0.004, 0.0035), part(B(0.0005, 0.005, 0.0024), '#8a6a44', 0, -0.013, 0.0035)]));
    g.add(paddle);
  }
  g.scale.setScalar(scale);
  g.userData = { type, legs: legParts, arms: animArms, paddle, phase: r() * 10 };
  return g;
}

export function canoe(color = '#b23a2a', r = Math.random) {
  const g = new THREE.Group();
  const hullGeo = new THREE.SphereGeometry(0.006, 20, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  hullGeo.scale(5.2, 1.1, 1.0);
  const hull = new THREE.Mesh(hullGeo, new THREE.MeshStandardMaterial({ color, roughness: 0.5, side: THREE.DoubleSide }));
  hull.position.y = 0.0035;
  const gun = new THREE.Mesh(new THREE.TorusGeometry(0.006, 0.0004, 4, 32), new THREE.MeshStandardMaterial({ color: '#d8c39a', roughness: 0.7 }));
  gun.scale.set(5.2, 1, 1);
  gun.rotation.x = Math.PI / 2;
  gun.position.y = 0.0035;
  g.add(hull, gun);
  const a = person('paddle', r, { scale: 0.92 });
  a.position.set(0.012, -0.0005, 0);
  const b = person('paddle', r, { scale: 0.92 });
  b.position.set(-0.013, -0.0005, 0);
  b.userData.phase = a.userData.phase + 1.4;
  g.add(a, b);
  g.userData.paddlers = [a, b];
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  return g;
}

export function bear(scale = 1) {
  const fur = '#1d1714';
  const parts = [
    part(S(0.008), fur, 0, 0.011, 0),
    part(S(0.006), fur, 0.009, 0.012, 0),
    part(S(0.0045), fur, 0.016, 0.013, 0),
    part(B(0.004, 0.003, 0.003), '#5a4433', 0.021, 0.0125, 0),
    part(S(0.0014), fur, 0.015, 0.018, 0.0028),
    part(S(0.0014), fur, 0.015, 0.018, -0.0028),
  ];
  for (const x of [-0.005, 0.009]) for (const z of [-0.004, 0.004]) parts.push(part(C(0.0022, 0.008), fur, x, 0.004, z));
  parts.forEach((p) => p.scale(1, 1, 1.05));
  const m = mesh(parts);
  const g = new THREE.Group();
  g.add(m);
  g.scale.setScalar(scale);
  return g;
}

export function goat(scale = 1) {
  const coat = '#ece8de';
  const parts = [
    part(B(0.012, 0.0055, 0.0045), coat, 0, 0.0075, 0),
    part(B(0.004, 0.004, 0.003), coat, 0.0072, 0.0105, 0, 0, 0, 0.5),
    part(B(0.0016, 0.004, 0.0008), '#3a3530', 0.0068, 0.0138, 0.0009, 0, 0, -0.5),
    part(B(0.0016, 0.004, 0.0008), '#3a3530', 0.0068, 0.0138, -0.0009, 0, 0, -0.5),
    part(B(0.001, 0.002, 0.0012), coat, 0.0098, 0.0085, 0),
  ];
  for (const x of [-0.0045, 0.0045]) for (const z of [-0.0015, 0.0015]) parts.push(part(B(0.0012, 0.005, 0.0012), '#d8d2c4', x, 0.0025, z));
  const g = new THREE.Group();
  g.add(mesh(parts));
  g.scale.setScalar(scale);
  return g;
}

export function deer(scale = 1) {
  const coat = '#8a5f3a';
  const parts = [
    part(B(0.014, 0.006, 0.005), coat, 0, 0.012, 0),
    part(B(0.0022, 0.007, 0.0022), coat, 0.0068, 0.0155, 0, 0, 0, -0.35),
    part(B(0.0045, 0.0028, 0.0026), coat, 0.0095, 0.0195, 0),
    part(B(0.0018, 0.0018, 0.0014), '#f0ece2', -0.0074, 0.0128, 0),
  ];
  for (const x of [-0.0055, 0.0055]) for (const z of [-0.0016, 0.0016]) parts.push(part(B(0.0011, 0.009, 0.0011), '#6b4a2e', x, 0.0045, z));
  const g = new THREE.Group();
  g.add(mesh(parts));
  g.scale.setScalar(scale);
  return g;
}

// Animate limbs and paddles.
export function animateFigure(f, t) {
  const u = f.userData;
  const p = t + (u.phase || 0);
  if (u.type === 'wave') u.arms.forEach((a) => (a.rotation.x = -2.6 + Math.sin(p * 7) * 0.45));
  if (u.type === 'walk') {
    u.legs.forEach((l, i) => (l.rotation.z = Math.sin(p * 7 + i * Math.PI) * 0.5));
    u.arms.forEach((a, i) => (a.rotation.z = -Math.sin(p * 7 + i * Math.PI) * 0.4));
  }
  if (u.paddle) {
    const s = Math.sin(p * 2.6);
    u.paddle.rotation.z = s * 0.7;
    u.paddle.rotation.x = s > 0 ? 0.2 : -0.2;
  }
}
