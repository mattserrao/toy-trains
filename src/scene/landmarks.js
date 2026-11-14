// Landmarks: truss bridges and tunnels placed from the track and terrain,
// plus the waterfall, rapids, radio tower and billboard.
import * as THREE from 'three';
import { worldPose } from '../track/pieces.js';
import { sweep, BALLAST_H } from '../track/trackMesh.js';
import { BASE_DEPTH } from './terrain.js';
import { rng } from './textures.js';
import { signTexture, nightMaterials } from './buildings.js';

const steel = new THREE.MeshStandardMaterial({ color: 0x232527, roughness: 0.55, metalness: 0.55 });
let stoneMat, linerMat;

function stoneTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const r = rng(31);
  g.fillStyle = '#5e5a54';
  g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 22) {
    let x = -r() * 30;
    while (x < 256) {
      const w = 26 + r() * 30;
      const v = 105 + r() * 50;
      g.fillStyle = `rgb(${v},${v - 4},${v - 10})`;
      g.fillRect(x + 1.5, y + 1.5, w - 3, 19);
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.fillRect(x + 1.5, y + 1.5, w - 3, 3);
      x += w;
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function mats() {
  if (stoneMat) return;
  const t = stoneTexture();
  t.repeat.set(2, 2);
  stoneMat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 });
  linerMat = new THREE.MeshStandardMaterial({ color: 0x2c2a28, roughness: 1, side: THREE.DoubleSide });
}

function shadows(g) {
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

// A strut between two points (local coords).
function strut(a, b, size, m = steel) {
  const len = a.distanceTo(b);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, len, size), m);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return mesh;
}

// Through truss along a straight span of length L. Local x along track.
export function trussBridge(L) {
  const g = new THREE.Group();
  const H = 0.075, Z = 0.029;
  const n = Math.max(3, Math.round(L / 0.032));
  const p = L / n;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  for (const side of [-1, 1]) {
    const z = side * Z;
    g.add(strut(V(-L / 2, 0.002, z), V(L / 2, 0.002, z), 0.0035));
    g.add(strut(V(-L / 2 + p, H, z), V(L / 2 - p, H, z), 0.004));
    g.add(strut(V(-L / 2, 0.002, z), V(-L / 2 + p, H, z), 0.004));
    g.add(strut(V(L / 2, 0.002, z), V(L / 2 - p, H, z), 0.004));
    for (let i = 1; i < n; i++) {
      const x = -L / 2 + i * p;
      g.add(strut(V(x, 0.002, z), V(x, H, z), 0.0022));
      // Diagonals lean toward the middle (Pratt pattern).
      if (i < n / 2) g.add(strut(V(x, H, z), V(x + p, 0.002, z), 0.0018));
      else if (i > n / 2) g.add(strut(V(x, H, z), V(x - p, 0.002, z), 0.0018));
    }
    // Rivet plates at panel points read as detail.
    for (let i = 0; i <= n; i++) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, 0.0008), steel);
      plate.position.set(-L / 2 + i * p, 0.003, z + side * 0.002);
      g.add(plate);
    }
  }
  // Top lateral struts and X bracing.
  for (let i = 1; i < n; i++) {
    const x = -L / 2 + i * p;
    g.add(strut(V(x, H, -Z), V(x, H, Z), 0.002));
    if (i < n - 1) {
      g.add(strut(V(x, H, -Z), V(x + p, H, Z), 0.0012));
      g.add(strut(V(x, H, Z), V(x + p, H, -Z), 0.0012));
    }
  }
  // Portal knee braces.
  for (const end of [-1, 1]) {
    const x = end * (L / 2 - p);
    g.add(strut(V(x, H - 0.012, -Z), V(x, H - 0.012, Z), 0.003));
  }
  // Deck and floor beams under the ties.
  const deck = new THREE.Mesh(new THREE.BoxGeometry(L, 0.003, 0.05), steel);
  deck.position.y = BALLAST_H - 0.0015;
  g.add(deck);
  for (let i = 0; i <= n; i++) g.add(strut(V(-L / 2 + i * p, -0.004, -Z), V(-L / 2 + i * p, -0.004, Z), 0.005));
  // Walkway railings.
  for (const side of [-1, 1]) {
    const z = side * (Z + 0.009);
    const walk = new THREE.Mesh(new THREE.BoxGeometry(L, 0.0012, 0.012), steel);
    walk.position.set(0, BALLAST_H - 0.002, side * (Z + 0.004));
    g.add(walk);
    g.add(strut(V(-L / 2, 0.016, z), V(L / 2, 0.016, z), 0.0008));
    for (let i = 0; i <= n * 2; i++) g.add(strut(V(-L / 2 + (i * p) / 2, BALLAST_H, z), V(-L / 2 + (i * p) / 2, 0.016, z), 0.0007));
  }
  return shadows(g);
}

// Plate girders under curved or short spans.
function girderSpan(piece, s0, s1, tableTop) {
  const g = new THREE.Group();
  const n = Math.max(1, Math.ceil((s1 - s0) / 0.02));
  for (let i = 0; i < n; i++) {
    const a = worldPose(piece, s0 + ((s1 - s0) * i) / n);
    const b = worldPose(piece, s0 + ((s1 - s0) * (i + 1)) / n);
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const h = (a.h + b.h) / 2;
    for (const side of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(len + 0.001, 0.016, 0.002), steel);
      const ox = -Math.sin(h) * side * 0.02, oy = Math.cos(h) * side * 0.02;
      m.position.set((a.x + b.x) / 2 + ox, tableTop - 0.006, -((a.y + b.y) / 2 + oy));
      m.rotation.y = h;
      g.add(m);
    }
    const deck = new THREE.Mesh(new THREE.BoxGeometry(len + 0.001, 0.003, 0.046), steel);
    deck.position.set((a.x + b.x) / 2, tableTop + BALLAST_H - 0.0015, -(a.y + b.y) / 2);
    deck.rotation.y = h;
    g.add(deck);
  }
  return shadows(g);
}

function abutment(tableTop, terrain, pose) {
  mats();
  const g = new THREE.Group();
  const ground = Math.min(-0.02, terrain.original(pose.x, pose.y));
  const depth = -ground + 0.004;
  const block = new THREE.Mesh(new THREE.BoxGeometry(0.028, depth, 0.085), stoneMat);
  block.position.y = tableTop + BALLAST_H - 0.004 - depth / 2;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.004, 0.09), new THREE.MeshStandardMaterial({ color: 0x8d877d, roughness: 0.9 }));
  cap.position.y = tableTop + BALLAST_H - 0.004;
  g.add(block, cap);
  g.position.set(pose.x, 0, -pose.y);
  g.rotation.y = pose.h;
  return shadows(g);
}

// True when the span's end continues onto a linked piece of the same kind.
function continues(layout, spans, span, atEnd) {
  const k = atEnd ? 1 : 0;
  const s = atEnd ? span.s1 : span.s0;
  if (Math.abs(s - (atEnd ? span.piece.len : 0)) > 0.008) return false;
  const link = span.piece.links[k];
  if (!link) return false;
  return spans.some((o) => o.piece.id === link.piece && (link.k === 0 ? o.s0 < 0.008 : Math.abs(o.s1 - o.piece.len) < 0.008));
}

export function buildBridges(layout, terrain, tableTop) {
  const group = new THREE.Group();
  group.name = 'bridges';
  const spans = terrain.spans('bridge');
  for (const sp of spans) {
    const piece = sp.piece;
    const startCont = continues(layout, spans, sp, false);
    const endCont = continues(layout, spans, sp, true);
    const s0 = startCont ? sp.s0 : Math.max(0, sp.s0 - 0.015);
    const s1 = endCont ? sp.s1 : Math.min(piece.len, sp.s1 + 0.015);
    if (piece.type.startsWith('S')) {
      const a = worldPose(piece, s0), b = worldPose(piece, s1);
      const bridge = trussBridge(s1 - s0);
      bridge.position.set((a.x + b.x) / 2, tableTop, -(a.y + b.y) / 2);
      bridge.rotation.y = a.h;
      group.add(bridge);
    } else {
      group.add(girderSpan(piece, s0, s1, tableTop));
    }
    if (!startCont) group.add(abutment(tableTop, terrain, worldPose(piece, s0)));
    if (!endCont) group.add(abutment(tableTop, terrain, worldPose(piece, s1)));
  }
  return group;
}

function portal() {
  mats();
  const W = 0.13, H = 0.112, hw = 0.028, wallH = 0.05;
  const shape = new THREE.Shape();
  shape.moveTo(-W / 2, -0.01);
  shape.lineTo(W / 2, -0.01);
  shape.lineTo(W / 2, H);
  shape.lineTo(-W / 2, H);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-hw, -0.01);
  hole.lineTo(-hw, wallH);
  hole.absarc(0, wallH, hw, Math.PI, 0, true);
  hole.lineTo(hw, -0.01);
  hole.closePath();
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.016, bevelEnabled: false, curveSegments: 16 });
  geo.translate(0, 0, -0.008);
  const tex = stoneMat.map.clone();
  tex.repeat.set(9, 9);
  tex.needsUpdate = true;
  const face = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
  const g = new THREE.Group();
  // Face plane is local XY; turn so it faces along +x (outward).
  face.rotation.y = Math.PI / 2;
  g.add(face);
  const coping = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.006, W + 0.01), new THREE.MeshStandardMaterial({ color: 0x8d877d, roughness: 0.9 }));
  coping.position.y = H + 0.003;
  g.add(coping);
  // Keystone.
  const key = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.012, 0.01), new THREE.MeshStandardMaterial({ color: 0x9a948a, roughness: 0.9 }));
  key.position.set(0.002, wallH + hw + 0.004, 0);
  g.add(key);
  // Wing walls.
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.012), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
    wing.position.set(0.03, 0.03, side * (W / 2 - 0.004));
    wing.rotation.y = side * 0.5;
    g.add(wing);
  }
  return shadows(g);
}

export function buildTunnels(layout, terrain, tableTop) {
  mats();
  const group = new THREE.Group();
  group.name = 'tunnels';
  const spans = terrain.spans('tunnel');
  const archProfile = [];
  const hw = 0.027, wallH = 0.05;
  archProfile.push([-hw, -0.004], [-hw, wallH]);
  for (let i = 1; i < 12; i++) {
    const a = Math.PI - (i / 12) * Math.PI;
    archProfile.push([Math.cos(a) * hw, wallH + Math.sin(a) * hw]);
  }
  archProfile.push([hw, wallH], [hw, -0.004]);
  for (const sp of spans) {
    const piece = sp.piece;
    const n = Math.max(2, Math.ceil((sp.s1 - sp.s0) / 0.01));
    const samples = [];
    for (let i = 0; i <= n; i++) {
      const s = sp.s0 + ((sp.s1 - sp.s0) * i) / n;
      samples.push({ s, ...worldPose(piece, s) });
    }
    const liner = new THREE.Mesh(sweep(samples, archProfile, 0, tableTop), linerMat);
    liner.receiveShadow = true;
    group.add(liner);
    for (const atEnd of [false, true]) {
      if (continues(layout, spans, sp, atEnd)) continue;
      const pose = worldPose(piece, atEnd ? sp.s1 : sp.s0);
      const p = portal();
      p.position.set(pose.x, tableTop, -pose.y);
      p.rotation.y = atEnd ? pose.h + Math.PI : pose.h;
      // Face points out of the tunnel: rotate so local +x is outward.
      p.rotation.y += Math.PI;
      group.add(p);
    }
  }
  return group;
}

// Waterfall: a sheet of falling water with mist at the foot.
export class Waterfall {
  constructor({ x, y, h, top, bottom, width }, tableTop) {
    this.group = new THREE.Group();
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 256;
    const g = c.getContext('2d');
    const r = rng(8);
    g.clearRect(0, 0, 64, 256);
    for (let i = 0; i < 140; i++) {
      const x0 = r() * 64, w = 1 + r() * 3, a = 0.25 + r() * 0.6;
      const grad = g.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, `rgba(255,255,255,${a})`);
      grad.addColorStop(0.5, `rgba(220,240,240,${a * 0.6})`);
      grad.addColorStop(1, `rgba(255,255,255,${a})`);
      g.fillStyle = grad;
      g.fillRect(x0, 0, w, 256);
    }
    this.tex = new THREE.CanvasTexture(c);
    this.tex.wrapS = this.tex.wrapT = THREE.RepeatWrapping;
    this.tex.repeat.set(1, 2);
    const geo = new THREE.PlaneGeometry(width, top - bottom, 6, 10);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const v = (pos.getY(i) + (top - bottom) / 2) / (top - bottom); // 0 bottom .. 1 top
      const u = pos.getX(i) / width;
      pos.setZ(i, (1 - v) * 0.012 + Math.cos(u * Math.PI) * 0.003);
      pos.setX(i, pos.getX(i) * (0.8 + 0.4 * (1 - v)));
    }
    geo.computeVertexNormals();
    const sheet = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: this.tex, transparent: true, opacity: 0.92, roughness: 0.2, depthWrite: false, side: THREE.DoubleSide, emissive: 0x9fb8b8, emissiveIntensity: 0.15 }));
    sheet.position.set(0, tableTop + (top + bottom) / 2, 0);
    this.group.add(sheet);
    // Foam pool.
    const fc = document.createElement('canvas');
    fc.width = fc.height = 128;
    const fg = fc.getContext('2d');
    for (let i = 0; i < 260; i++) {
      const fx = 64 + (r() - 0.5) * 110, fy = 64 + (r() - 0.5) * 110, rad = 3 + r() * 9;
      const d = Math.hypot(fx - 64, fy - 64) / 64;
      const grad = fg.createRadialGradient(fx, fy, 0, fx, fy, rad);
      grad.addColorStop(0, `rgba(255,255,255,${0.7 * (1 - d)})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      fg.fillStyle = grad;
      fg.fillRect(fx - rad, fy - rad, rad * 2, rad * 2);
    }
    this.foam = new THREE.Mesh(new THREE.CircleGeometry(width * 0.9, 24), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(fc), transparent: true, depthWrite: false, opacity: 0.85 }));
    this.foam.rotation.x = -Math.PI / 2;
    this.foam.position.set(0, tableTop + bottom + 0.001, 0.02);
    this.group.add(this.foam);
    this.group.position.set(x, 0, -y);
    this.group.rotation.y = h + Math.PI / 2;
  }
  update(dt) {
    this.tex.offset.y += dt * 0.9;
    this.foam.rotation.z += dt * 0.3;
  }
}

// Foam patches over rapids.
export class Rapids {
  constructor(spots, tableTop, level) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const r = rng(14);
    for (let i = 0; i < 160; i++) {
      const x = r() * 128, y = r() * 128, rad = 2 + r() * 7;
      const grad = g.createRadialGradient(x, y, 0, x, y, rad * 2);
      grad.addColorStop(0, 'rgba(255,255,255,0.55)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(x - rad * 2, y - rad * 2, rad * 4, rad * 4);
    }
    this.tex = new THREE.CanvasTexture(c);
    this.tex.wrapS = this.tex.wrapT = THREE.RepeatWrapping;
    this.group = new THREE.Group();
    const alphaC = document.createElement('canvas');
    alphaC.width = alphaC.height = 64;
    const ag = alphaC.getContext('2d');
    const rg = ag.createRadialGradient(32, 32, 0, 32, 32, 32);
    rg.addColorStop(0, '#fff');
    rg.addColorStop(1, '#000');
    ag.fillStyle = rg;
    ag.fillRect(0, 0, 64, 64);
    const alpha = new THREE.CanvasTexture(alphaC);
    for (const s of spots) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(s.w, s.l),
        new THREE.MeshBasicMaterial({ map: this.tex, alphaMap: alpha, transparent: true, depthWrite: false, opacity: 0.9 }),
      );
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = s.h || 0;
      m.position.set(s.x, tableTop + level + 0.0008, -s.y);
      this.group.add(m);
    }
  }
  update(dt) {
    this.tex.offset.y -= dt * 0.25;
  }
}

export function radioTower(height = 0.26) {
  const g = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 0xb8312a, roughness: 0.6, metalness: 0.4 });
  const white = new THREE.MeshStandardMaterial({ color: 0xe8e6e0, roughness: 0.6, metalness: 0.4 });
  const R = 0.008;
  const legs = [0, 1, 2].map((i) => (i / 3) * Math.PI * 2);
  const P = (a, y) => new THREE.Vector3(Math.cos(a) * R, y, Math.sin(a) * R);
  const seg = 14;
  for (let s = 0; s < seg; s++) {
    const y0 = (s / seg) * height, y1 = ((s + 1) / seg) * height;
    const m = s % 2 ? white : red;
    for (let i = 0; i < 3; i++) {
      const a = legs[i], b = legs[(i + 1) % 3];
      g.add(strut(P(a, y0), P(a, y1), 0.0012, m));
      g.add(strut(P(a, y0), P(b, y1), 0.0006, m));
      g.add(strut(P(a, y1), P(b, y1), 0.0006, m));
    }
  }
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.0028, 10, 8), new THREE.MeshStandardMaterial({ color: 0xff3020, emissive: 0xff2010, emissiveIntensity: 2 }));
  beacon.position.y = height + 0.003;
  g.add(beacon);
  // Equipment shed.
  const shed = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.022, 0.024), new THREE.MeshStandardMaterial({ color: 0x9a3b30, roughness: 0.9 }));
  shed.position.set(0.03, 0.011, 0.01);
  g.add(shed);
  g.userData.beacon = beacon;
  return shadows(g);
}

export function billboard(lines) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x4d3a2a, roughness: 1 });
  for (const x of [-0.045, 0.045]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.08, 0.003), wood);
    post.position.set(x, 0.04, -0.002);
    g.add(post);
  }
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(0.13, 0.055),
    new THREE.MeshStandardMaterial({ map: signTexture(lines, { w: 512, h: 220, bg: '#f2efe6', fg: '#1d3b6e', font: 'Arial Black, Arial, sans-serif' }), roughness: 0.8, emissive: 0xffffff, emissiveIntensity: 0 }),
  );
  board.material.emissiveMap = board.material.map;
  board.material.userData.nightScale = 0.35;
  nightMaterials.add(board.material);
  board.position.y = 0.068;
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.134, 0.059, 0.002), wood);
  back.position.set(0, 0.068, -0.0015);
  g.add(board, back);
  // Catwalk.
  const walk = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.0012, 0.008), wood);
  walk.position.set(0, 0.04, 0.004);
  g.add(walk);
  return shadows(g);
}

export { strut, BASE_DEPTH };
