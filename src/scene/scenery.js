// Scattered pines, bushes and rocks. Rebuilt whenever the track changes so
// nothing grows through the rails.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { TABLE } from '../track/layout.js';
import { rng, rockTexture } from './textures.js';

let pineGeo, trunkGeo, bushGeo, rockGeo, crownGeo, boleGeo, foliageMat, leafMat, trunkMat, rockMat;

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
  {
    const b0 = new THREE.IcosahedronGeometry(0.5, 2);
    b0.deleteAttribute('normal');
    b0.deleteAttribute('uv');
    bushGeo = mergeVertices(b0);
  }
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
  // Leafy tree: a cluster of lumpy blobs on a short trunk, height ~1 unit.
  const blobs = [];
  for (const [x, y, z, rad] of [[0, 0.62, 0, 0.32], [0.18, 0.5, 0.05, 0.24], [-0.16, 0.52, -0.06, 0.25], [0.04, 0.78, -0.1, 0.22], [-0.05, 0.5, 0.18, 0.22]]) {
    const b0 = new THREE.IcosahedronGeometry(rad, 2);
    b0.deleteAttribute('normal');
    b0.deleteAttribute('uv');
    const b = mergeVertices(b0);
    const p = b.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const n = 1 + (r() - 0.5) * 0.3;
      p.setXYZ(k, p.getX(k) * n + x, p.getY(k) * n + y, p.getZ(k) * n + z);
    }
    blobs.push(b);
  }
  crownGeo = mergeGeometries(blobs);
  crownGeo.computeVertexNormals();
  boleGeo = new THREE.CylinderGeometry(0.03, 0.05, 0.45, 6);
  boleGeo.translate(0, 0.225, 0);
  foliageMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
  leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
  trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 1 });
  rockMat = new THREE.MeshStandardMaterial({ map: rockTexture(), color: 0x9a978f, roughness: 0.95, flatShading: true });
}

function clearOfTrack(x, y, pts, clear) {
  for (const p of pts) if ((p.x - x) ** 2 + (p.y - y) ** 2 < clear * clear) return false;
  return true;
}

export function buildScenery(layout, tableTop, terrain, theme) {
  setup();
  const group = new THREE.Group();
  group.name = 'scenery';
  const pts = layout.samples(0.02);
  const r = rng(2026);
  const W = TABLE.width / 2 - 0.02, D = TABLE.depth / 2 - 0.02;
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  const H = (x, y) => tableTop + terrain.heightAt(x, y);
  const ok = (x, y, clear) => clearOfTrack(x, y, pts, clear) && theme.canPlant(x, y, terrain);

  // Conifers: thick on the hills and along the back, sparse in town.
  const pines = [];
  for (let i = 0; i < 4000 && pines.length < 340; i++) {
    const x = (r() * 2 - 1) * W, y = (r() * 2 - 1) * D;
    if (r() > theme.treeDensity(x, y, terrain)) continue;
    if (!ok(x, y, 0.055)) continue;
    pines.push({ x, y, s: 0.06 + r() * 0.11 });
  }
  const foliage = new THREE.InstancedMesh(pineGeo, foliageMat, pines.length);
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, pines.length);
  pines.forEach((p, i) => {
    dummy.position.set(p.x, H(p.x, p.y) - 0.002, -p.y);
    dummy.rotation.set((r() - 0.5) * 0.06, r() * Math.PI * 2, (r() - 0.5) * 0.06);
    dummy.scale.set(p.s * (0.85 + r() * 0.3), p.s, p.s * (0.85 + r() * 0.3));
    dummy.updateMatrix();
    foliage.setMatrixAt(i, dummy.matrix);
    trunks.setMatrixAt(i, dummy.matrix);
    col.setHSL(0.29 + r() * 0.07, 0.35 + r() * 0.2, 0.035 + r() * 0.045);
    foliage.setColorAt(i, col);
  });
  foliage.castShadow = trunks.castShadow = true;
  foliage.receiveShadow = true;
  group.add(foliage, trunks);

  // Leafy trees, some turning for fall, mostly in the lowlands and town edges.
  const leafy = [];
  for (let i = 0; i < 2000 && leafy.length < 90; i++) {
    const x = (r() * 2 - 1) * W, y = (r() * 2 - 1) * D;
    if (terrain.heightAt(x, y) > 0.06) continue;
    if (!ok(x, y, 0.05)) continue;
    leafy.push({ x, y, s: 0.035 + r() * 0.04 });
  }
  const crowns = new THREE.InstancedMesh(crownGeo, leafMat, leafy.length);
  const boles = new THREE.InstancedMesh(boleGeo, trunkMat, leafy.length);
  leafy.forEach((t, i) => {
    dummy.position.set(t.x, H(t.x, t.y) - 0.001, -t.y);
    dummy.rotation.set(0, r() * 6.28, 0);
    dummy.scale.set(t.s * (0.85 + r() * 0.3), t.s * (0.9 + r() * 0.3), t.s * (0.85 + r() * 0.3));
    dummy.updateMatrix();
    crowns.setMatrixAt(i, dummy.matrix);
    boles.setMatrixAt(i, dummy.matrix);
    const v = r();
    if (v < 0.18) col.setHSL(0.06 + r() * 0.04, 0.65, 0.3); // orange
    else if (v < 0.28) col.setHSL(0.13 + r() * 0.03, 0.6, 0.33); // yellow
    else if (v < 0.33) col.setHSL(0.01, 0.6, 0.27); // red maple
    else col.setHSL(0.22 + r() * 0.06, 0.45, 0.12 + r() * 0.06);
    crowns.setColorAt(i, col);
  });
  crowns.castShadow = boles.castShadow = true;
  crowns.receiveShadow = true;
  group.add(crowns, boles);

  // Bushes and grass tufts.
  const bushes = [];
  for (let i = 0; i < 3000 && bushes.length < 520; i++) {
    const x = (r() * 2 - 1) * W, y = (r() * 2 - 1) * D;
    if (!clearOfTrack(x, y, pts, 0.036)) continue;
    if (terrain.heightAt(x, y) < -0.05) continue;
    bushes.push({ x, y, s: 0.005 + r() * 0.011 });
  }
  const bushMesh = new THREE.InstancedMesh(bushGeo, leafMat, bushes.length);
  bushes.forEach((b, i) => {
    dummy.position.set(b.x, H(b.x, b.y) - 0.001, -b.y);
    dummy.rotation.set(0, r() * 6.28, 0);
    dummy.scale.set(b.s * (1 + r()), b.s, b.s * (1 + r()));
    dummy.updateMatrix();
    bushMesh.setMatrixAt(i, dummy.matrix);
    const autumn = r() < 0.15;
    col.setHSL(autumn ? 0.07 + r() * 0.05 : 0.2 + r() * 0.1, 0.5, autumn ? 0.22 : 0.08 + r() * 0.08);
    bushMesh.setColorAt(i, col);
  });
  bushMesh.castShadow = true;
  bushMesh.receiveShadow = true;
  group.add(bushMesh);

  // Rock outcrops where the ground is steep: the gorge walls and mountain faces.
  const rocks = [];
  for (let i = 0; i < 6000 && rocks.length < 110; i++) {
    const x = (r() * 2 - 1) * W, y = (r() * 2 - 1) * D;
    const slope = terrain.slopeAt(x, y);
    if (slope < 0.75) continue;
    if (!clearOfTrack(x, y, pts, 0.045)) continue;
    rocks.push({ x, y, s: 0.02 + r() * 0.045 });
  }
  const rockMesh = new THREE.InstancedMesh(rockGeo, rockMat, rocks.length);
  rocks.forEach((k, i) => {
    dummy.position.set(k.x, H(k.x, k.y) - k.s * 0.3, -k.y);
    dummy.rotation.set((r() - 0.5) * 0.6, r() * 6.28, (r() - 0.5) * 0.6);
    dummy.scale.set(k.s * (1 + r() * 0.6), k.s * (0.5 + r() * 0.6), k.s);
    dummy.updateMatrix();
    rockMesh.setMatrixAt(i, dummy.matrix);
  });
  rockMesh.castShadow = true;
  rockMesh.receiveShadow = true;
  group.add(rockMesh);

  return group;
}
