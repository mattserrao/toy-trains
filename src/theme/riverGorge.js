// River Gorge: a brick mill town beside a river that drops out of the hills
// over a waterfall, runs through a rocky gorge and under a steel truss bridge.
// A tunnel cuts through the mountain at the east end.
import * as THREE from 'three';
import { fbm, smoothstep, distToPolyline } from '../scene/noise.js';
import { rng } from '../scene/textures.js';
import * as B from '../scene/buildings.js';
import { Waterfall, Rapids, radioTower, billboard } from '../scene/landmarks.js';
import { person, canoe, bear, goat, deer, animateFigure } from '../scene/figures.js';
import { Smoke } from '../train/train.js';

// River centerline, from the waterfall (back) to the front edge of the table.
export const RIVER = [[0.4, 0.2], [0.37, 0.06], [0.29, -0.14], [0.18, -0.33], [0.135, -0.47], [0.124, -0.6], [0.124, -0.75]];
const WATER_LEVEL = -0.058;

function bump(x, y, cx, cy, r, amp, p = 2) {
  const d = Math.hypot(x - cx, y - cy) / r;
  return d < 1 ? amp * Math.pow(1 - d * d, p) : 0;
}

// Flat lots for the town: building pads and streets (layout coords, meters).
const PADS = [
  { x: -0.42, y: 0.0, w: 0.9, d: 0.09 }, // Main Street
  { x: -0.24, y: 0.22, w: 0.42, d: 0.24 }, // paper mill
  { x: -0.7, y: 0.2, w: 0.3, d: 0.24 }, // shop
  { x: -0.42, y: -0.24, w: 0.92, d: 0.28 }, // south side
  { x: -0.27, y: -0.45, w: 0.4, d: 0.1 }, // depot
];

export const riverGorge = {
  id: 'river-gorge',
  name: 'River Gorge',
  waterLevel: WATER_LEVEL,
  pads: PADS,

  height(x, y) {
    let h = 0.008 * (fbm(x * 5 + 3, y * 5, 4, 1) - 0.4);
    h += bump(x, y, 0.4, 0.3, 0.27, 0.2); // waterfall mountain
    h += bump(x, y, 0.68, 0.3, 0.22, 0.12); // shoulder
    h += bump(x, y, 1.02, 0.0, 0.5, 0.34, 1.6); // tunnel mountain
    h += bump(x, y, -1.0, 0.5, 0.32, 0.05); // hills behind the shop
    h += bump(x, y, 0.75, -0.42, 0.16, 0.05); // knoll by the bridge
    if (h > 0.02) h += h * 0.4 * (fbm(x * 13, y * 13, 4, 3) - 0.5);
    // Gorge walls flank the river inland and fade out toward the bridge.
    const r = distToPolyline(x, y, RIVER);
    const inland = smoothstep(-0.47, -0.28, y);
    h += inland * 0.085 * smoothstep(0.05, 0.075, r.d) * (1 - smoothstep(0.12, 0.3, r.d)) * (0.75 + 0.5 * fbm(x * 9, y * 9, 3, 4));
    // River channel.
    const ch = 1 - smoothstep(0.04, 0.075, r.d);
    const bed = -0.08 + 0.01 * fbm(x * 22, y * 22, 2, 6);
    return h + (bed - h) * ch;
  },

  groundColor(x, y, h, slope, orig, c) {
    const n = fbm(x * 9, y * 9, 3, 11);
    const m = fbm(x * 31, y * 31, 2, 12);
    // Grass.
    let r = 0.3 + n * 0.12, g = 0.4 + n * 0.12, b = 0.17 + m * 0.05;
    // Forest floor on high ground.
    const hi = smoothstep(0.06, 0.18, h);
    r += (0.22 - r) * hi * 0.6; g += (0.3 - g) * hi * 0.6; b += (0.15 - b) * hi * 0.6;
    // Bare rock on steep faces.
    const rock = smoothstep(0.55, 1.2, slope);
    const rv = 0.42 + m * 0.12;
    r += (rv - r) * rock; g += (rv * 0.97 - g) * rock; b += (rv * 0.9 - b) * rock;
    // River bed and muddy banks.
    const wet = smoothstep(-0.01, -0.04, h);
    r += (0.27 + m * 0.06 - r) * wet; g += (0.25 + m * 0.05 - g) * wet; b += (0.17 - b) * wet;
    // Town lots: trampled, gravelly.
    for (const p of PADS) {
      if (Math.abs(x - p.x) < p.w / 2 && Math.abs(y - p.y) < p.d / 2) {
        r += (0.4 - r) * 0.35; g += (0.38 - g) * 0.35; b += (0.28 - b) * 0.35;
        break;
      }
    }
    c.setRGB(r, g, b, THREE.SRGBColorSpace);
  },

  // Where trees may grow.
  canPlant(x, y, terrain) {
    const h = terrain.heightAt(x, y);
    if (h < -0.01) return false;
    for (const p of PADS) if (Math.abs(x - p.x) < p.w / 2 + 0.015 && Math.abs(y - p.y) < p.d / 2 + 0.015) return false;
    if (distToPolyline(x, y, RIVER).d < 0.07) return false;
    return true;
  },

  // Tree density preference (0..1).
  treeDensity(x, y, terrain) {
    const h = terrain.heightAt(x, y);
    const back = (y + 0.61) / 1.22;
    return 0.12 + smoothstep(0.02, 0.12, h) * 0.7 + back * back * 0.35 + (x > 0.05 ? 0.2 : -0.05);
  },
};

// Everything that sits on the terrain: town, landmarks, people, animals.
export function buildRiverGorge(scene, terrain, layout, tableTop) {
  const group = new THREE.Group();
  group.name = 'river-gorge';
  const r = rng(1906);
  const H = (x, y) => tableTop + terrain.heightAt(x, y);
  const trackPts = layout.samples(0.02);
  const clearOfTrack = (x, y, rad) => trackPts.every((p) => (p.x - x) ** 2 + (p.y - y) ** 2 > rad * rad);
  const animated = [];
  const smokers = [];
  const beacons = [];

  // Place an object at layout coords facing heading `rot` (radians).
  const put = (obj, x, y, rot = 0, clear = 0.03) => {
    if (clear && !clearOfTrack(x, y, clear)) return null;
    obj.position.set(x, H(x, y), -y);
    obj.rotation.y = rot;
    group.add(obj);
    return obj;
  };

  // --- Streets ---------------------------------------------------------------
  const asphalt = (() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#3d3c3a';
    g.fillRect(0, 0, 256, 64);
    for (let i = 0; i < 3000; i++) {
      const v = 50 + r() * 40;
      g.fillStyle = `rgb(${v},${v},${v - 2})`;
      g.fillRect(r() * 256, r() * 64, 1.5, 1.5);
    }
    g.fillStyle = '#d9c46a';
    for (let x = 0; x < 256; x += 40) g.fillRect(x, 31, 22, 2);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    return t;
  })();
  const street = (x, y, len, rot, w = 0.06) => {
    const t = asphalt.clone();
    t.repeat.set(len / 0.24, 1);
    t.needsUpdate = true;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, w), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }));
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = rot;
    m.position.set(x, H(x, y) + 0.0012, -y);
    m.receiveShadow = true;
    group.add(m);
    const walkMat = new THREE.MeshStandardMaterial({ color: 0x9d988f, roughness: 0.95 });
    for (const side of [-1, 1]) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(len, 0.002, 0.012), walkMat);
      s.position.set(x - Math.sin(rot) * side * (w / 2 + 0.006), H(x, y) + 0.001, -(y + Math.cos(rot) * side * (w / 2 + 0.006)));
      s.rotation.y = rot;
      s.receiveShadow = true;
      group.add(s);
    }
  };
  street(-0.42, 0, 0.86, 0);
  street(-0.47, -0.21, 0.36, Math.PI / 2, 0.05);

  // --- Mill town --------------------------------------------------------------
  const mill = B.brickBlock({ w: 0.3, d: 0.14, h: 0.13, floors: 4, color: [146, 60, 42], seed: 11, door: 6 });
  put(mill, -0.25, 0.23, 0, 0.02);
  const millSign = B.sign(['HOLLIS PAPER CO.'], 0.16, 0.02, { bg: '#2a2622', fg: '#efe6cf', border: false });
  millSign.position.set(0, 0.118, 0.0712);
  mill.add(millSign);
  const roofTank = B.waterTower({ legH: 0.025, r: 0.018 });
  roofTank.position.set(0.09, 0.13, -0.02);
  mill.add(roofTank);
  const millAnnex = B.brickBlock({ w: 0.1, d: 0.1, h: 0.07, floors: 2, color: [130, 56, 40], seed: 12 });
  put(millAnnex, -0.03, 0.24, 0, 0.02);
  const stack1 = B.smokestack({ height: 0.32, radius: 0.02 });
  if (put(stack1, 0.03, 0.33, 0, 0.03)) smokers.push(stack1);
  const stack2 = B.smokestack({ height: 0.22, radius: 0.015 });
  if (put(stack2, -0.43, 0.3, 0, 0.03)) smokers.push(stack2);

  const shop = B.sawtooth({ w: 0.22, d: 0.15, h: 0.06, teeth: 5, color: [124, 52, 38], seed: 21 });
  put(shop, -0.71, 0.21, 0, 0.02);
  const shopSign = B.sign(['GORGE MACHINE WORKS'], 0.14, 0.016, { bg: '#efe6cf', fg: '#1f3a5a', border: false });
  shopSign.position.set(0, 0.05, 0.0762);
  shop.add(shopSign);
  put(B.waterTower({ legH: 0.11, r: 0.026 }), -0.5, 0.36, 0.3, 0.04);

  // South side: store, depot, houses, church.
  const store = B.brickBlock({ w: 0.12, d: 0.08, h: 0.075, floors: 2, color: [160, 78, 52], storefront: true, seed: 31, windows: 'house', door: 2 });
  put(store, -0.3, -0.1, Math.PI, 0.02);
  const storeSign = B.sign(['MERCER BROS.', 'HARDWARE · FEED · SUPPLY'], 0.11, 0.022, { bg: '#f0e7d0', fg: '#7a2418' });
  storeSign.position.set(0, 0.06, 0.0412);
  store.add(storeSign);
  const diner = B.gabled({ w: 0.08, d: 0.06, h: 0.035, roofH: 0.02, style: 'siding', siding: '#b33b2e', roof: '#3a3a3a', door: 1, seed: 33 });
  put(diner, -0.15, -0.1, Math.PI, 0.02);
  const dinerSign = B.sign(['DINER'], 0.05, 0.012, { bg: '#f3f0e6', fg: '#b33b2e', border: false });
  dinerSign.position.set(0, 0.042, 0.031);
  diner.add(dinerSign);

  const depot = B.gabled({ w: 0.15, d: 0.05, h: 0.04, roofH: 0.018, style: 'siding', siding: '#d9c38a', roof: '#5a2e24', door: 2, seed: 41, overhang: 0.012 });
  put(depot, -0.26, -0.455, 0, 0.026);
  const depotSign = B.sign(['GORGE FALLS'], 0.07, 0.012, { bg: '#1f3a2c', fg: '#f3e9cf', border: false });
  depotSign.position.set(0, 0.045, 0.0312);
  depot.add(depotSign);
  const plat = B.platform(0.3, 0.022, 0.009);
  put(plat, -0.26, -0.507, 0, 0);

  const houseColors = ['#c9b99a', '#9fb3a6', '#e1d6bf', '#b98d6a', '#8fa0b5', '#d8c9a3'];
  [[-0.88, -0.17], [-0.8, -0.17], [-0.72, -0.17], [-0.64, -0.17], [-0.84, -0.3], [-0.74, -0.31]].forEach(([x, y], i) => {
    const hse = B.gabled({ w: 0.05, d: 0.055, h: 0.034 + (i % 2) * 0.008, roofH: 0.022, siding: houseColors[i % houseColors.length], roof: i % 2 ? '#4a4440' : '#5a3a30', door: 0, seed: 50 + i, floors: i % 2 ? 2 : 1 });
    put(hse, x, y, Math.PI / 2 * (y < -0.25 ? -1 : 1) + Math.PI / 2, 0.035);
  });
  // Brick row houses along Main Street's north side.
  for (let i = 0; i < 4; i++) {
    const row = B.brickBlock({ w: 0.045, d: 0.06, h: 0.06, floors: 2, color: [150 - i * 8, 66, 46], seed: 60 + i, windows: 'house', door: 0 });
    put(row, -0.6 + i * 0.047, 0.075, 0, 0.02);
  }
  // White church with a steeple.
  const church = B.gabled({ w: 0.09, d: 0.05, h: 0.045, roofH: 0.03, siding: '#eeeae0', roof: '#3e3e44', door: 1, seed: 70, windows: 'house' });
  put(church, -0.56, -0.38, -Math.PI / 2, 0.04);
  if (church.parent) {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.08, 0.022), new THREE.MeshStandardMaterial({ color: 0xeeeae0, roughness: 0.9 }));
    tower.position.set(0.045, 0.04, 0);
    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.06, 4), new THREE.MeshStandardMaterial({ color: 0x3e3e44, roughness: 0.8 }));
    spire.position.set(0.045, 0.11, 0);
    spire.rotation.y = Math.PI / 4;
    tower.castShadow = spire.castShadow = true;
    church.add(tower, spire);
  }

  // Street lamps, cars, a delivery truck.
  for (let i = 0; i < 6; i++) put(B.streetLamp(), -0.82 + i * 0.15, 0.045, 0, 0.02);
  put(B.car(0x6c8fb3), -0.55, -0.018, 0, 0.02);
  put(B.car(0x9b2c2c), -0.22, 0.018, Math.PI, 0.02);
  put(B.car(0xe0d7b8), -0.33, -0.018, 0, 0.02);
  put(B.car(0x2f6b4a), -0.47, -0.12, Math.PI / 2, 0.02);
  put(B.car(0x6b6b6b, true), -0.08, 0.13, -Math.PI / 2, 0.02);

  // Telephone poles along the back straight and Main Street.
  for (let x = -0.95; x <= 0.15; x += 0.22) put(B.telephonePole(), x, 0.59, 0, 0.025);
  for (let x = -0.85; x <= 0.0; x += 0.17) put(B.telephonePole(), x, -0.045, 0, 0.02);

  // --- Landmarks ----------------------------------------------------------------
  // Waterfall at the head of the river.
  const head = RIVER[0], next = RIVER[1];
  const flowH = Math.atan2(next[1] - head[1], next[0] - head[0]);
  const fx = head[0] - Math.cos(flowH) * 0.045, fy = head[1] - Math.sin(flowH) * 0.045;
  const cliffTop = Math.max(0.06, terrain.original(fx - Math.cos(flowH) * 0.02, fy - Math.sin(flowH) * 0.02));
  const falls = new Waterfall({ x: fx, y: fy, h: flowH, top: cliffTop - 0.004, bottom: WATER_LEVEL, width: 0.04 }, tableTop);
  group.add(falls.group);

  // Rapids where the gorge narrows and above the bridge.
  const rapidSpots = [0.22, 0.34, 0.5, 0.63, 0.74].map((t) => {
    const i = Math.min(RIVER.length - 2, Math.floor(t * (RIVER.length - 1)));
    const f = t * (RIVER.length - 1) - i;
    const x = RIVER[i][0] + (RIVER[i + 1][0] - RIVER[i][0]) * f;
    const y = RIVER[i][1] + (RIVER[i + 1][1] - RIVER[i][1]) * f;
    const h = Math.atan2(RIVER[i + 1][1] - RIVER[i][1], RIVER[i + 1][0] - RIVER[i][0]);
    return { x, y, w: 0.06, l: 0.05, h: h - Math.PI / 2 };
  });
  const rapids = new Rapids(rapidSpots, tableTop, WATER_LEVEL);
  group.add(rapids.group);
  // Boulders in the stream.
  const boulderMat = new THREE.MeshStandardMaterial({ color: 0x8a857c, roughness: 0.9, flatShading: true });
  for (const s of rapidSpots) {
    for (let k = 0; k < 3; k++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.006 + r() * 0.008, 0), boulderMat);
      const ox = (r() - 0.5) * 0.05, oy = (r() - 0.5) * 0.04;
      b.position.set(s.x + ox, tableTop + WATER_LEVEL + 0.001, -(s.y + oy));
      b.scale.y = 0.7;
      b.castShadow = b.receiveShadow = true;
      group.add(b);
    }
  }

  // Radio tower on the waterfall mountain, billboard on its shoulder.
  const tower = radioTower(0.26);
  put(tower, 0.43, 0.36, 0, 0.04);
  beacons.push(tower.userData.beacon);
  const board = billboard(['98.1 FM  WGRG', 'RAILROAD RADIO']);
  put(board, 0.62, 0.2, -0.35, 0.04);

  // --- People -------------------------------------------------------------------
  const people = [];
  const addPerson = (type, x, y, rot, opts) => {
    const p = person(type, r, opts);
    if (put(p, x, y, rot, 0.022)) people.push(p);
    return p;
  };
  // Depot platform crowd.
  addPerson('stand', -0.33, -0.51, -Math.PI / 2);
  addPerson('stand', -0.31, -0.505, -Math.PI / 2 + 0.4);
  addPerson('wave', -0.24, -0.51, -Math.PI / 2);
  addPerson('stand', -0.2, -0.505, Math.PI);
  addPerson('sit', -0.18, -0.49, -Math.PI / 2);
  addPerson('worker', -0.13, -0.505, 0.2);
  // Main Street.
  addPerson('stand', -0.38, -0.05, Math.PI / 2);
  addPerson('stand', -0.37, -0.055, -Math.PI / 2);
  addPerson('hike', -0.62, -0.05, 0.3);
  addPerson('stand', -0.16, -0.055, 2.5);
  const walker = addPerson('walk', -0.75, 0.04, 0);
  // Mill workers.
  addPerson('worker', -0.12, 0.13, 1.2);
  addPerson('worker', -0.1, 0.15, -2.0);
  addPerson('worker', -0.7, 0.115, 1.6);
  // Kids waving at trains by the back straight.
  addPerson('wave', -0.7, 0.5, Math.PI / 2, { scale: 0.7 });
  addPerson('wave', -0.67, 0.505, Math.PI / 2, { scale: 0.65 });
  // Fishermen on the banks by the bridge and hikers resting by the river.
  const bank = (t, side, off = 0.06) => {
    const p = distToPolylinePoint(t);
    return [p.x - Math.sin(p.h) * side * off, p.y + Math.cos(p.h) * side * off, p.h];
  };
  {
    const [x, y, h] = bank(0.78, 1, 0.07);
    addPerson('fish', x, y, h - Math.PI / 2);
    const [x2, y2, h2] = bank(0.7, -1, 0.072);
    addPerson('fish', x2, y2, h2 + Math.PI / 2);
    const [x3, y3] = bank(0.45, -1, 0.09);
    addPerson('sit', x3, y3, 0.4);
    addPerson('hike', x3 + 0.012, y3 + 0.01, 2.2);
    addPerson('sit', x3 - 0.01, y3 + 0.014, -1.2);
  }
  // Lone hiker on the mountain trail.
  addPerson('hike', 0.82, 0.18, 2.4);

  // Canoes on the river.
  const canoes = [];
  for (const [t, color] of [[0.56, '#b23a2a'], [0.66, '#2f6b4a']]) {
    const p = distToPolylinePoint(t);
    const c = canoe(color, r);
    c.position.set(p.x, tableTop + WATER_LEVEL, -p.y);
    c.rotation.y = p.h + Math.PI + (r() - 0.5) * 0.5;
    group.add(c);
    canoes.push({ c, base: c.position.y, phase: r() * 6 });
  }

  // --- Wildlife (future hunt items) -----------------------------------------------
  const goatSpots = [[0.2, -0.08], [0.39, -0.2], [0.5, 0.06], [0.06, -0.16]];
  for (const [x, y] of goatSpots) put(goat(1), x, y, r() * 6.28, 0.04);
  put(bear(1.1), 0.9, 0.42, 2.6, 0.05);
  put(bear(0.55), 0.92, 0.39, 2.2, 0.05);
  put(bear(0.5), 0.875, 0.395, 3.1, 0.05);
  put(deer(1), -1.0, 0.36, 0.8, 0.04);
  put(deer(0.9), -1.04, 0.33, 1.2, 0.04);

  scene.add(group);

  // Stack smoke.
  const smoke = new Smoke(scene, 60);
  let smokeT = 0, time = 0;

  return {
    group,
    smoke,
    update(dt) {
      time += dt;
      falls.update(dt);
      rapids.update(dt);
      for (const f of people) animateFigure(f, time);
      for (const { c, base, phase } of canoes) {
        c.position.y = base + Math.sin(time * 1.6 + phase) * 0.0006;
        c.rotation.z = Math.sin(time * 1.1 + phase) * 0.03;
        c.userData.paddlers.forEach((p) => animateFigure(p, time));
      }
      if (walker && walker.parent) {
        const s = Math.sin(time * 0.12);
        walker.position.x = -0.75 + (s * 0.5 + 0.5) * 0.5;
        walker.rotation.y = Math.cos(time * 0.12) >= 0 ? 0 : Math.PI;
      }
      for (const b of beacons) b.material.emissiveIntensity = Math.sin(time * 3) > 0.3 ? 3 : 0.2;
      smokeT += dt;
      if (smokeT > 0.35) {
        smokeT = 0;
        for (const st of smokers) {
          const p = st.userData.top.clone();
          st.localToWorld(p);
          smoke.emit(p, { vel: new THREE.Vector3(0.012 + r() * 0.01, 0.03, (r() - 0.5) * 0.01), size: 0.02, grow: 0.12, life: 6, color: 0x8d8a86, alpha: 0.35 });
        }
      }
      smoke.update(dt);
    },
    dispose() {
      scene.remove(group);
      smoke.dispose();
    },
  };
}

// Point and heading along the river at fraction t (0 = waterfall).
function distToPolylinePoint(t) {
  const lens = [];
  let total = 0;
  for (let i = 0; i < RIVER.length - 1; i++) {
    const l = Math.hypot(RIVER[i + 1][0] - RIVER[i][0], RIVER[i + 1][1] - RIVER[i][1]);
    lens.push(l);
    total += l;
  }
  let d = t * total;
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) {
      const f = Math.min(1, d / lens[i]);
      const [ax, ay] = RIVER[i], [bx, by] = RIVER[i + 1];
      return { x: ax + (bx - ax) * f, y: ay + (by - ay) * f, h: Math.atan2(by - ay, bx - ax) };
    }
    d -= lens[i];
  }
  return { x: RIVER[0][0], y: RIVER[0][1], h: 0 };
}
