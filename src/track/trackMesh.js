// Turns the layout into ballast, ties and rails.
import * as THREE from 'three';
import { GAUGE, worldPose } from './pieces.js';
import { ballastTexture, rng } from '../scene/textures.js';

export const BALLAST_H = 0.004;
export const TIE_H = 0.0022;
export const RAIL_H = 0.0021;
export const RAIL_TOP = BALLAST_H + TIE_H + RAIL_H; // above table top

const TIE_LEN = 0.031;
const TIE_W = 0.0026;
const TIE_SPACING = 0.0068;
const BALLAST_PROFILE = [
  [-0.029, 0], [-0.021, BALLAST_H * 0.85], [-0.017, BALLAST_H], [0.017, BALLAST_H], [0.021, BALLAST_H * 0.85], [0.029, 0],
];
// Rail cross-section (offset from rail center, height above tie top): head, web, foot.
const RAIL_PROFILE = [
  [-0.0012, 0], [-0.0004, 0.0003], [-0.0003, 0.0015], [-0.0006, 0.0016], [-0.0006, RAIL_H],
  [0.0006, RAIL_H], [0.0006, 0.0016], [0.0003, 0.0015], [0.0004, 0.0003], [0.0012, 0],
];

let ballastMat, railMat, railTopMat, tieMat;
function materials() {
  if (ballastMat) return;
  const bt = ballastTexture();
  bt.repeat.set(1, 1);
  ballastMat = new THREE.MeshStandardMaterial({ map: bt, roughness: 1, color: 0xd9d2c7, side: THREE.DoubleSide });
  railMat = new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: 0.7, metalness: 0.4, side: THREE.DoubleSide });
  railTopMat = new THREE.MeshStandardMaterial({ color: 0xb9b6b0, roughness: 0.25, metalness: 0.95, side: THREE.DoubleSide });
  tieMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 });
}

function samplesFor(piece, step) {
  const n = Math.max(1, Math.ceil(piece.len / step));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const s = (piece.len * i) / n;
    out.push({ s, ...worldPose(piece, s) });
  }
  return out;
}

// Sweep a 2D profile (lateral offset, height) along samples into a mesh.
function sweep(samples, profile, lateral, baseY, { uvScale = 0.06, closeEnds = false } = {}) {
  const pos = [], uv = [], idx = [];
  const m = profile.length;
  // Profile lengths for u coordinate.
  const acc = [0];
  for (let i = 1; i < m; i++) acc.push(acc[i - 1] + Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]));
  for (const sm of samples) {
    const nx = -Math.sin(sm.h), ny = Math.cos(sm.h);
    for (let i = 0; i < m; i++) {
      const off = lateral + profile[i][0];
      const x = sm.x + nx * off, y = sm.y + ny * off;
      pos.push(x, baseY + profile[i][1], -y);
      uv.push(acc[i] / uvScale, sm.s / uvScale);
    }
  }
  for (let j = 0; j < samples.length - 1; j++) {
    for (let i = 0; i < m - 1; i++) {
      const a = j * m + i, b = a + 1, c = a + m, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  if (closeEnds) {
    for (const j of [0, samples.length - 1]) {
      const base = j * m;
      for (let i = 1; i < m - 1; i++) {
        if (j === 0) idx.push(base, base + i, base + i + 1);
        else idx.push(base, base + i + 1, base + i);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function buildTrack(layout, tableTop) {
  materials();
  const group = new THREE.Group();
  group.name = 'track';
  const r = rng(99);
  const tieMatrices = [];
  const tieColors = [];
  const tmp = new THREE.Object3D();
  const color = new THREE.Color();

  for (const piece of layout.pieces) {
    const fine = samplesFor(piece, 0.01);
    const ballast = new THREE.Mesh(sweep(fine, BALLAST_PROFILE, 0, tableTop + 0.0002, { uvScale: 0.05 }), ballastMat);
    ballast.receiveShadow = true;
    ballast.userData.pieceId = piece.id;
    group.add(ballast);

    const railBase = tableTop + BALLAST_H + TIE_H;
    for (const side of [-1, 1]) {
      const off = side * (GAUGE / 2 + 0.0006);
      const rail = new THREE.Mesh(sweep(fine, RAIL_PROFILE, off, railBase, { closeEnds: true }), railMat);
      rail.castShadow = true;
      rail.receiveShadow = true;
      group.add(rail);
      // Polished running surface.
      const top = new THREE.Mesh(
        sweep(fine, [[-0.0006, RAIL_H + 0.00002], [0.0006, RAIL_H + 0.00002]], off, railBase),
        railTopMat,
      );
      group.add(top);
    }

    // Ties, evenly spaced along the piece.
    const count = Math.max(1, Math.round(piece.len / TIE_SPACING));
    for (let i = 0; i < count; i++) {
      const s = ((i + 0.5) * piece.len) / count;
      const p = worldPose(piece, s);
      tmp.position.set(p.x, tableTop + BALLAST_H + TIE_H / 2, -p.y);
      tmp.rotation.set(0, p.h + (r() - 0.5) * 0.03, 0);
      tmp.scale.set(1, 1, 1);
      tmp.updateMatrix();
      tieMatrices.push(tmp.matrix.clone());
      const v = 0.75 + r() * 0.35;
      tieColors.push(color.setRGB(0.28 * v, 0.2 * v, 0.15 * v).clone());
    }
  }

  if (tieMatrices.length) {
    const tieGeo = new THREE.BoxGeometry(TIE_W, TIE_H, TIE_LEN);
    const ties = new THREE.InstancedMesh(tieGeo, tieMat, tieMatrices.length);
    tieMatrices.forEach((m, i) => {
      ties.setMatrixAt(i, m);
      ties.setColorAt(i, tieColors[i]);
    });
    ties.castShadow = true;
    ties.receiveShadow = true;
    group.add(ties);
  }
  return group;
}

export function disposeGroup(group) {
  group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
  });
}
