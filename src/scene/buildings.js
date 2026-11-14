// Structures for the brick mill town, built from boxes with painted facades.
// Windows are painted into the texture, with a matching glow map so some of
// them light up at night.
import * as THREE from 'three';
import { rng } from './textures.js';

const PX_BAY = 48; // texture pixels per window bay
const PX_FLOOR = 64; // per floor

export const nightMaterials = new Set(); // materials whose emissive follows day/night
const cache = new Map();

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}
function tex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function paintBrick(g, w, h, base, r) {
  g.fillStyle = '#7a6a5e';
  g.fillRect(0, 0, w, h);
  const bw = 10, bh = 4;
  const [br, bg, bb] = base;
  for (let y = 0; y < h; y += bh) {
    const off = (y / bh) % 2 ? bw / 2 : 0;
    for (let x = -off; x < w; x += bw) {
      const v = 0.82 + r() * 0.3;
      g.fillStyle = `rgb(${br * v | 0},${bg * v | 0},${bb * v | 0})`;
      g.fillRect(x + 0.5, y + 0.5, bw - 1, bh - 1);
    }
  }
  // Grime streaks.
  for (let i = 0; i < w / 6; i++) {
    const x = r() * w;
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(30,25,20,0.18)');
    grad.addColorStop(1, 'rgba(30,25,20,0)');
    g.fillStyle = grad;
    g.fillRect(x, 0, 2 + r() * 6, h * (0.2 + r() * 0.6));
  }
}

function paintSiding(g, w, h, color, r) {
  g.fillStyle = color;
  g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 5) {
    g.fillStyle = 'rgba(0,0,0,0.16)';
    g.fillRect(0, y + 4, w, 1);
    g.fillStyle = 'rgba(255,255,255,0.06)';
    g.fillRect(0, y, w, 1);
  }
  for (let i = 0; i < 30; i++) {
    g.fillStyle = `rgba(60,50,40,${0.03 + r() * 0.05})`;
    g.fillRect(r() * w, r() * h, 3 + r() * 20, 2 + r() * 30);
  }
}

// A facade with a grid of windows. Returns { map, glow }.
export function facade({ bays, floors, style = 'brick', color = [150, 62, 44], siding = '#c9b99a', windows = 'mill', door = -1, storefront = false, seed = 1, trim = '#e8e0cf' }) {
  const key = JSON.stringify(arguments[0]);
  if (cache.has(key)) return cache.get(key);
  const r = rng(seed);
  const W = Math.max(1, bays) * PX_BAY, H = Math.max(1, floors) * PX_FLOOR + 16;
  const [c, g] = canvas(W, H);
  const [gc, gg] = canvas(W, H);
  gg.fillStyle = '#000';
  gg.fillRect(0, 0, W, H);
  if (style === 'brick') paintBrick(g, W, H, color, r);
  else paintSiding(g, W, H, siding, r);
  // Cornice band.
  g.fillStyle = style === 'brick' ? 'rgba(40,30,25,0.55)' : trim;
  g.fillRect(0, 0, W, 6);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(0, 6, W, 2);
  for (let f = 0; f < floors; f++) {
    const top = 16 + f * PX_FLOOR;
    const ground = f === floors - 1;
    for (let b = 0; b < bays; b++) {
      const x0 = b * PX_BAY;
      if (ground && b === door) {
        g.fillStyle = '#3b2a1e';
        g.fillRect(x0 + 14, top + 18, PX_BAY - 28, PX_FLOOR - 18);
        g.fillStyle = trim;
        g.fillRect(x0 + 12, top + 15, PX_BAY - 24, 3);
        continue;
      }
      let wx, wy, ww, wh;
      if (ground && storefront) {
        wx = x0 + 4; wy = top + 14; ww = PX_BAY - 8; wh = PX_FLOOR - 18;
      } else if (windows === 'mill') {
        wx = x0 + 12; wy = top + 10; ww = PX_BAY - 24; wh = PX_FLOOR - 20;
      } else {
        wx = x0 + 15; wy = top + 14; ww = PX_BAY - 30; wh = PX_FLOOR - 28;
      }
      // Lintel / sill.
      g.fillStyle = style === 'brick' ? '#d8cdb8' : trim;
      g.fillRect(wx - 2, wy + wh, ww + 4, 3);
      if (windows === 'mill' && style === 'brick' && !(ground && storefront)) {
        g.beginPath();
        g.arc(wx + ww / 2, wy + 2, ww / 2 + 2, Math.PI, 0);
        g.fillStyle = '#8a3b2a';
        g.fill();
      } else {
        g.fillRect(wx - 2, wy - 3, ww + 4, 3);
      }
      // Glass: dark with sky reflection.
      const grad = g.createLinearGradient(0, wy, 0, wy + wh);
      grad.addColorStop(0, '#5d6c76');
      grad.addColorStop(1, '#1e2428');
      g.fillStyle = grad;
      g.fillRect(wx, wy, ww, wh);
      // Muntins.
      g.fillStyle = style === 'brick' ? '#2a2420' : trim;
      const cols = ground && storefront ? 3 : windows === 'mill' ? 3 : 2;
      const rows = windows === 'mill' ? 4 : 2;
      for (let k = 1; k < cols; k++) g.fillRect(wx + (ww * k) / cols - 0.5, wy, 1.2, wh);
      for (let k = 1; k < rows; k++) g.fillRect(wx, wy + (wh * k) / rows - 0.5, ww, 1.2);
      // Night glow for some windows.
      if (r() < 0.45) {
        const warm = r() < 0.7 ? '#ffcf7a' : '#fff1c8';
        gg.fillStyle = warm;
        gg.fillRect(wx, wy, ww, wh);
        gg.fillStyle = 'rgba(0,0,0,0.6)';
        for (let k = 1; k < cols; k++) gg.fillRect(wx + (ww * k) / cols - 0.5, wy, 1.2, wh);
      }
    }
  }
  // Foundation.
  g.fillStyle = style === 'brick' ? '#6c665e' : '#7a746a';
  g.fillRect(0, H - 5, W, 5);
  const out = { map: tex(c), glow: tex(gc) };
  cache.set(key, out);
  return out;
}

function material(face, opts = {}) {
  const m = new THREE.MeshStandardMaterial({
    map: face.map,
    emissiveMap: face.glow,
    emissive: 0xffffff,
    emissiveIntensity: 0,
    roughness: 0.9,
    ...opts,
  });
  nightMaterials.add(m);
  return m;
}

const roofTar = new THREE.MeshStandardMaterial({ color: 0x3a3836, roughness: 0.95 });
const capMat = new THREE.MeshStandardMaterial({ color: 0x8c8378, roughness: 0.9 });

function shingles(color = '#4a4440') {
  const key = 'sh' + color;
  if (cache.has(key)) return cache.get(key);
  const r = rng(5);
  const [c, g] = canvas(128, 128);
  g.fillStyle = color;
  g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 6) {
    const off = (y / 6) % 2 ? 4 : 0;
    for (let x = -off; x < 128; x += 8) {
      const v = 0.8 + r() * 0.4;
      g.fillStyle = `rgba(${40 * v | 0},${36 * v | 0},${34 * v | 0},0.5)`;
      g.fillRect(x, y, 7, 5);
    }
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
  cache.set(key, m);
  return m;
}

function finish(g) {
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}

// Flat-roofed brick block (mill, store, warehouse).
export function brickBlock({ w, d, h, floors, color = [150, 62, 44], door = 1, storefront = false, seed = 1, windows = 'mill' }) {
  const g = new THREE.Group();
  const front = facade({ bays: Math.max(1, Math.round(w / 0.022)), floors, color, door, storefront, seed, windows });
  const back = facade({ bays: Math.max(1, Math.round(w / 0.022)), floors, color, door: -1, seed: seed + 1, windows });
  const side = facade({ bays: Math.max(1, Math.round(d / 0.022)), floors, color, door: -1, seed: seed + 2, windows });
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [
    material(side), material(side), roofTar, roofTar, material(front), material(back),
  ]);
  box.position.y = h / 2;
  g.add(box);
  // Parapet cap.
  const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.003, 0.003, d + 0.003), capMat);
  cap.position.y = h + 0.0015;
  g.add(cap);
  return finish(g);
}

// Gabled building: houses, depot, church. Siding or brick walls.
export function gabled({ w, d, h, roofH, style = 'siding', siding = '#c9b99a', color = [150, 62, 44], roof = '#4a4440', floors = 1, door = 0, seed = 1, overhang = 0.004, windows = 'house' }) {
  const g = new THREE.Group();
  const bays = Math.max(1, Math.round(w / 0.024));
  const front = facade({ bays, floors, style, siding, color, door, seed, windows });
  const side = facade({ bays: Math.max(1, Math.round(d / 0.024)), floors, style, siding, color, door: -1, seed: seed + 3, windows });
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [material(side), material(side), roofTar, roofTar, material(front), material(front)]);
  box.position.y = h / 2;
  g.add(box);
  // Gable ends (triangles) in wall color.
  const shape = new THREE.Shape();
  shape.moveTo(-d / 2, 0);
  shape.lineTo(d / 2, 0);
  shape.lineTo(0, roofH);
  shape.closePath();
  const wallColor = style === 'brick' ? new THREE.Color(`rgb(${color[0]},${color[1]},${color[2]})`) : new THREE.Color(siding);
  const gableMat = new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.9 });
  const gable = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false }), gableMat);
  gable.rotation.y = Math.PI / 2;
  gable.position.set(-w / 2, h, 0);
  g.add(gable);
  // Roof planes.
  const slope = Math.hypot(d / 2 + overhang, roofH + overhang * (roofH / (d / 2)));
  const ang = Math.atan2(roofH, d / 2);
  for (const side2 of [-1, 1]) {
    const plane = new THREE.Mesh(new THREE.BoxGeometry(w + overhang * 2, 0.0018, slope), shingles(roof));
    plane.rotation.x = side2 * ang;
    plane.position.set(0, h + roofH / 2 + 0.0008, (side2 * d) / 4 + side2 * overhang * 0.25);
    g.add(plane);
  }
  return finish(g);
}

// Factory with a sawtooth (north-light) roof.
export function sawtooth({ w, d, h, teeth = 4, color = [138, 58, 42], seed = 3 }) {
  const g = brickBlock({ w, d, h, floors: Math.max(1, Math.round(h / 0.035)), color, seed, door: 2 });
  const toothW = w / teeth;
  const th = 0.022;
  const roof = shingles('#55504a');
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fb2ba, roughness: 0.15, metalness: 0.3, emissive: 0xffd18a, emissiveIntensity: 0 });
  nightMaterials.add(glass);
  glass.userData.nightScale = 0.6;
  for (let i = 0; i < teeth; i++) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(toothW, 0);
    shape.lineTo(toothW, th);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: d * 0.96, bevelEnabled: false });
    const tooth = new THREE.Mesh(geo, roof);
    tooth.position.set(-w / 2 + i * toothW, h, -d * 0.48);
    g.add(tooth);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(d * 0.94, th * 0.8), glass);
    pane.rotation.y = -Math.PI / 2;
    pane.position.set(-w / 2 + (i + 1) * toothW - 0.0006, h + th * 0.45, 0);
    g.add(pane);
  }
  return finish(g);
}

export function smokestack({ height = 0.3, radius = 0.018 }) {
  const g = new THREE.Group();
  const [c, ctx] = canvas(128, 512);
  paintBrick(ctx, 128, 512, [128, 52, 38], rng(12));
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 3);
  const stack = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.65, radius, height, 20), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }));
  stack.position.y = height / 2;
  g.add(stack);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.72, radius * 0.72, 0.012, 20), new THREE.MeshStandardMaterial({ color: 0x1b1a19 }));
  band.position.y = height - 0.006;
  g.add(band);
  const base = new THREE.Mesh(new THREE.BoxGeometry(radius * 2.6, 0.03, radius * 2.6), capMat);
  base.position.y = 0.015;
  g.add(base);
  g.userData.top = new THREE.Vector3(0, height + 0.004, 0);
  return finish(g);
}

export function waterTower({ legH = 0.11, r = 0.026 }) {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x7b5a3e, roughness: 0.9 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x2e2e2e, roughness: 0.6, metalness: 0.5 });
  const [c, ctx] = canvas(256, 64);
  ctx.fillStyle = '#7b5a3e';
  ctx.fillRect(0, 0, 256, 64);
  const rr = rng(4);
  for (let x = 0; x < 256; x += 6) {
    ctx.fillStyle = `rgba(40,25,15,${0.2 + rr() * 0.3})`;
    ctx.fillRect(x, 0, 1, 64);
  }
  for (const y of [10, 30, 50]) {
    ctx.fillStyle = '#222';
    ctx.fillRect(0, y, 256, 2);
  }
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(r, r, r * 1.5, 24), new THREE.MeshStandardMaterial({ map: tex(c), roughness: 0.9 }));
  tank.position.y = legH + r * 0.75;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(r * 1.08, r * 0.7, 24), wood);
  roof.position.y = legH + r * 1.5 + r * 0.35;
  g.add(tank, roof);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.002, legH + 0.004, 6), steel);
    leg.position.set(Math.cos(a) * r * 0.75, legH / 2, Math.sin(a) * r * 0.75);
    leg.rotation.set(Math.sin(a) * 0.04, 0, -Math.cos(a) * 0.04);
    g.add(leg);
  }
  for (const y of [legH * 0.35, legH * 0.7]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.77, 0.0007, 4, 24), steel);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    g.add(ring);
  }
  // Spout.
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.03, 8), steel);
  spout.rotation.z = Math.PI / 2.6;
  spout.position.set(r + 0.008, legH + 0.004, 0);
  g.add(spout);
  return finish(g);
}

// Painted sign board, e.g. on a facade or a billboard.
export function signTexture(lines, { w = 512, h = 128, bg = '#efe6cf', fg = '#7a2418', font = 'Georgia, serif', border = true } = {}) {
  const key = 'sign' + JSON.stringify([lines, w, h, bg, fg]);
  if (cache.has(key)) return cache.get(key);
  const [c, g] = canvas(w, h);
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  if (border) {
    g.strokeStyle = fg;
    g.lineWidth = 6;
    g.strokeRect(8, 8, w - 16, h - 16);
  }
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const n = lines.length;
  lines.forEach((ln, i) => {
    const size = i === 0 ? h * (n > 1 ? 0.42 : 0.55) : h * 0.22;
    g.font = `bold ${size}px ${font}`;
    const y = n === 1 ? h / 2 : i === 0 ? h * 0.4 : h * 0.4 + size * 0.5 + h * 0.18 * i;
    g.fillText(ln, w / 2, y, w - 30);
  });
  const t = tex(c);
  cache.set(key, t);
  return t;
}

export function sign(lines, w, h, opts) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: signTexture(lines, opts), roughness: 0.8 }));
  return m;
}

export function platform(len, width = 0.04, height = 0.011) {
  const g = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(len, height, width), new THREE.MeshStandardMaterial({ color: 0x9a948a, roughness: 0.95 }));
  deck.position.y = height / 2;
  const edge = new THREE.Mesh(new THREE.BoxGeometry(len, 0.0006, 0.003), new THREE.MeshStandardMaterial({ color: 0xe8d36a }));
  edge.position.set(0, height + 0.0003, -width / 2 + 0.002);
  g.add(deck, edge);
  return finish(g);
}

export function car(color = 0x6c8fb3, truck = false) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.4 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c1f22, roughness: 0.4, metalness: 0.2 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xcfcfcf, roughness: 0.2, metalness: 1 });
  if (truck) {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, 0.025), paint);
    cab.position.set(0.03, 0.016, 0);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.027), new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.8 }));
    box.position.set(-0.01, 0.02, 0);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.0005, 0.008, 0.02), dark);
    glass.position.set(0.0412, 0.02, 0);
    g.add(cab, box, glass);
  } else {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.011, 0.022), paint);
    body.position.y = 0.0095;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.009, 0.019), dark);
    cabin.position.set(-0.003, 0.019, 0);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.0015, 0.0195), paint);
    roof.position.set(-0.003, 0.0236, 0);
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(0.057, 0.002, 0.023), chrome);
    bumper.position.y = 0.0055;
    g.add(body, cabin, roof, bumper);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.0048, 0.0048, 0.003, 12);
  const span = truck ? 0.028 : 0.018;
  for (const x of [-span, span]) for (const z of [-0.0105, 0.0105]) {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.rotation.x = Math.PI / 2;
    w.position.set(x + (truck ? 0.004 : 0), 0.0048, z);
    g.add(w);
  }
  return finish(g);
}

export function streetLamp() {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.0007, 0.001, 0.05, 6), new THREE.MeshStandardMaterial({ color: 0x2b2b2b }));
  pole.position.y = 0.025;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.0028, 10, 8), new THREE.MeshStandardMaterial({ color: 0xfff2d0, emissive: 0xffd998, emissiveIntensity: 0.1 }));
  head.material.userData.nightScale = 4;
  nightMaterials.add(head.material);
  head.position.y = 0.051;
  g.add(pole, head);
  return finish(g);
}

export function telephonePole() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x5a4532, roughness: 1 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0016, 0.1, 6), wood);
  pole.position.y = 0.05;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.0015, 0.0015, 0.022), wood);
  arm.position.y = 0.094;
  g.add(pole, arm);
  const glass = new THREE.MeshStandardMaterial({ color: 0x6fa3a0, roughness: 0.2 });
  for (const z of [-0.009, -0.003, 0.003, 0.009]) {
    const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.0007, 0.0007, 0.002, 6), glass);
    ins.position.set(0, 0.0958, z);
    g.add(ins);
  }
  return finish(g);
}
