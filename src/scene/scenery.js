// Scattered pines, bushes and rocks. Rebuilt whenever the track changes so
// nothing grows through the rails.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TABLE } from '../track/layout.js';
import { rng, rockTexture } from './textures.js';

let pineGeo, trunkGeo, bushGeo, rockGeo, foliageMat, trunkMat, rockMat;

function setup() {
  if (pineGeo) return;
  // A flocked conifer: stacked, slightly irregular cones, height 1 unit.
  const tiers = [];
  const r = rng(4);
  const levels = 5;
  for (let i = 0; i < levels; i++) {
    const t = i / levels;
    const rad = 0.36 * (1 - t * 0.78);
    const h = 0.34 * (1 - t * 0.3);
    const cone = new THREE.ConeGeometry(rad, h, 9, 2);
    const pos = cone.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const jitter = 1 + (r() - 0.5) * 0.25;
      pos.setX(k, pos.getX(k) * jitter);
      pos.setZ(k, pos.getZ(k) * jitter);
    }
    cone.translate(0, 0.16 + t * 0.78 + h / 2 - 0.05, 0);
    tiers.push(cone);
  }
  pineGeo = mergeGeometries(tiers);
  pineGeo.computeVertexNormals();
  trunkGeo = new THREE.CylinderGeometry(0.025, 0.04, 0.22, 6);
  trunkGeo.translate(0, 0.11, 0);
  bushGeo = new THREE.IcosahedronGeometry(0.5, 1);
  {
    const pos = bushGeo.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const n = 1 + (r() - 0.5) * 0.35;
      pos.setXYZ(k, pos.getX(k) * n, Math.max(0, pos.getY(k)) * n * 0.8, pos.getZ(k) * n);
    }
    bushGeo.computeVertexNormals();
  }
  rockGeo = new THREE.IcosahedronGeometry(0.5, 2);
  {
    const pos = rockGeo.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k);
      const n = 1 + 0.25 * Math.sin(x * 9) * Math.cos(z * 7) + (r() - 0.5) * 0.18;
      pos.setXYZ(k, x * n, Math.max(-0.1, y * n * 0.7), z * n);
    }
    rockGeo.computeVertexNormals();
  }
  foliageMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
  trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 1 });
  rockMat = new THREE.MeshStandardMaterial({ map: rockTexture(), color: 0x9a978f, roughness: 0.95, flatShading: true });
}

function clearOfTrack(x, y, pts, clear) {
  for (const p of pts) if ((p.x - x) ** 2 + (p.y - y) ** 2 < clear * clear) return false;
  return true;
}

export function buildScenery(layout, tableTop) {
  setup();
  const group = new THREE.Group();
  group.name = 'scenery';
  const pts = layout.samples(0.02);
  const r = rng(2026);
  const W = TABLE.width / 2 - 0.03, D = TABLE.depth / 2 - 0.03;
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();

  // Pines cluster toward the back and the ends, like a treeline.
  const pines = [];
  for (let i = 0; i < 900 && pines.length < 190; i++) {
    const x = (r() * 2 - 1) * W;
    const y = (r() * 2 - 1) * D;
    const backBias = (y + D) / (2 * D);
    const endBias = Math.abs(x) / W;
    if (r() > 0.08 + backBias * backBias * 0.8 + endBias * 0.25) continue;
    if (!clearOfTrack(x, y, pts, 0.06)) continue;
    pines.push({ x, y, s: 0.07 + r() * 0.11 });
  }
  const foliage = new THREE.InstancedMesh(pineGeo, foliageMat, pines.length);
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, pines.length);
  pines.forEach((p, i) => {
    dummy.position.set(p.x, tableTop, -p.y);
    dummy.rotation.set((r() - 0.5) * 0.06, r() * Math.PI * 2, (r() - 0.5) * 0.06);
    dummy.scale.set(p.s * (0.85 + r() * 0.3), p.s, p.s * (0.85 + r() * 0.3));
    dummy.updateMatrix();
    foliage.setMatrixAt(i, dummy.matrix);
    trunks.setMatrixAt(i, dummy.matrix);
    const v = r();
    col.setHSL(0.28 + v * 0.07, 0.4 + r() * 0.2, 0.055 + r() * 0.06);
    foliage.setColorAt(i, col);
  });
  foliage.castShadow = trunks.castShadow = true;
  foliage.receiveShadow = true;
  group.add(foliage, trunks);

  // Bushes and grass tufts.
  const bushes = [];
  for (let i = 0; i < 1200 && bushes.length < 420; i++) {
    const x = (r() * 2 - 1) * W, y = (r() * 2 - 1) * D;
    if (!clearOfTrack(x, y, pts, 0.04)) continue;
    bushes.push({ x, y, s: 0.008 + r() * 0.022 });
  }
  const bushMesh = new THREE.InstancedMesh(bushGeo, foliageMat, bushes.length);
  bushes.forEach((b, i) => {
    dummy.position.set(b.x, tableTop - 0.001, -b.y);
    dummy.rotation.set(0, r() * 6.28, 0);
    dummy.scale.set(b.s * (1 + r()), b.s, b.s * (1 + r()));
    dummy.updateMatrix();
    bushMesh.setMatrixAt(i, dummy.matrix);
    const autumn = r() < 0.12;
    col.setHSL(autumn ? 0.07 + r() * 0.05 : 0.2 + r() * 0.1, 0.5, autumn ? 0.22 : 0.08 + r() * 0.08);
    bushMesh.setColorAt(i, col);
  });
  bushMesh.castShadow = true;
  bushMesh.receiveShadow = true;
  group.add(bushMesh);

  // A few granite outcrops: a first taste of the River Gorge theme.
  const rocks = [];
  for (let i = 0; i < 300 && rocks.length < 14; i++) {
    const x = (r() * 2 - 1) * W, y = (r() * 2 - 1) * D;
    const s = 0.04 + r() * 0.1;
    if (!clearOfTrack(x, y, pts, s * 0.6 + 0.05)) continue;
    rocks.push({ x, y, s });
  }
  const rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, rocks.length);
  rocks.forEach((k, i) => {
    dummy.position.set(k.x, tableTop - 0.004, -k.y);
    dummy.rotation.set(0, r() * 6.28, 0);
    dummy.scale.set(k.s * (1 + r() * 0.6), k.s * (0.4 + r() * 0.5), k.s);
    dummy.updateMatrix();
    rockMesh.setMatrixAt(i, dummy.matrix);
  });
  rockMesh.castShadow = true;
  rockMesh.receiveShadow = true;
  group.add(rockMesh);

  return group;
}
