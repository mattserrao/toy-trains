// Sculpted terrain: a heightfield over the table that the theme shapes, then
// cut to grade under the track, under building pads and under roads. Track
// over deep ground becomes a bridge; track under high ground becomes a tunnel.
import * as THREE from 'three';
import { TABLE } from '../track/layout.js';
import { fbm, smoothstep } from './noise.js';
import { rng } from './textures.js';

export const BRIDGE_BELOW = -0.015; // original ground this far below grade → bridge
export const TUNNEL_ABOVE = 0.085; // original ground this far above grade → tunnel
export const BASE_DEPTH = 0.1; // lowest carve below the table top
const RES = 0.01;

let detailTex;
function detailTexture() {
  if (detailTex) return detailTex;
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const r = rng(77);
  g.fillStyle = '#d6d6d6';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 60000; i++) {
    const v = 150 + r() * 105;
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2);
  }
  for (let i = 0; i < 200; i++) {
    const x = r() * 512, y = r() * 512, rad = 8 + r() * 30;
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    const v = r() < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(120,120,120,0.18)';
    grad.addColorStop(0, v);
    grad.addColorStop(1, 'rgba(128,128,128,0)');
    g.fillStyle = grad;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  detailTex = new THREE.CanvasTexture(c);
  detailTex.wrapS = detailTex.wrapT = THREE.RepeatWrapping;
  detailTex.colorSpace = THREE.SRGBColorSpace;
  detailTex.anisotropy = 8;
  return detailTex;
}

let waterNormal;
function waterNormalTexture() {
  if (waterNormal) return waterNormal;
  const N = 256;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  const img = g.createImageData(N, N);
  const h = (x, y) => fbm(x / 22, y / 9, 4, 5) + 0.35 * fbm(x / 6, y / 4, 2, 9);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = (h((x + 1) % N, y) - h((x - 1 + N) % N, y)) * 6;
      const dy = (h(x, (y + 1) % N) - h(x, (y - 1 + N) % N)) * 6;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * N + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = (1 / len) * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  waterNormal = new THREE.CanvasTexture(c);
  waterNormal.wrapS = waterNormal.wrapT = THREE.RepeatWrapping;
  return waterNormal;
}

export class Terrain {
  constructor(theme, layout, tableTop) {
    this.theme = theme;
    this.layout = layout;
    this.tableTop = tableTop;
    this.nx = Math.round(TABLE.width / RES) + 1;
    this.ny = Math.round(TABLE.depth / RES) + 1;
    this.x0 = -TABLE.width / 2;
    this.y0 = -TABLE.depth / 2;
    this.compute();
  }

  // Ground height the theme wants, before any cuts.
  original(x, y) {
    return this.theme.height(x, y);
  }

  classify(x, y) {
    const h = this.original(x, y);
    if (h < BRIDGE_BELOW) return 'bridge';
    if (h > TUNNEL_ABOVE) return 'tunnel';
    return 'grade';
  }

  compute() {
    const { nx, ny, x0, y0 } = this;
    const orig = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) orig[j * nx + i] = this.original(x0 + i * RES, y0 + j * RES);
    this.orig = orig;

    // Track samples, classified.
    this.trackSamples = this.layout.samples(0.01).map((p) => ({ ...p, kind: this.classify(p.x, p.y) }));
    // Spatial hash for fast nearest-sample lookups.
    const cell = 0.1;
    const buckets = new Map();
    for (const s of this.trackSamples) {
      const k = `${Math.floor(s.x / cell)},${Math.floor(s.y / cell)}`;
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(s);
    }
    // Nearest track sample of any kind: { d, kind }.
    const nearest = (x, y) => {
      const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
      let best = Infinity, kind = null;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        const list = buckets.get(`${cx + a},${cy + b}`);
        if (!list) continue;
        for (const s of list) {
          const d = (s.x - x) ** 2 + (s.y - y) ** 2;
          if (d < best) {
            best = d;
            kind = s.kind;
          }
        }
      }
      return { d: Math.sqrt(best), kind };
    };
    const nearGrade = (x, y) => {
      const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
      let best = Infinity, kind = 'grade';
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        const list = buckets.get(`${cx + a},${cy + b}`);
        if (!list) continue;
        for (const s of list) {
          const d = (s.x - x) ** 2 + (s.y - y) ** 2;
          if (d < best) {
            best = d;
            kind = s.kind;
          }
        }
      }
      // Only grade track cuts the ground; bridges and tunnels leave it alone.
      return kind === 'grade' ? Math.sqrt(best) : Infinity;
    };

    const pads = this.theme.pads || [];
    const h = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const x = x0 + i * RES, y = y0 + j * RES;
        let v = orig[j * nx + i];
        // Pads (building lots, roads): flatten to their level.
        for (const p of pads) {
          const c = Math.cos(-p.rot || 0), s = Math.sin(-p.rot || 0);
          const lx = (x - p.x) * c - (y - p.y) * s, ly = (x - p.x) * s + (y - p.y) * c;
          const dx = Math.max(0, Math.abs(lx) - p.w / 2), dy = Math.max(0, Math.abs(ly) - p.d / 2);
          const d = Math.hypot(dx, dy);
          const w = 1 - smoothstep(0.008, p.blend ?? 0.06, d);
          if (w > 0) v = v + ((p.h || 0) - v) * w;
        }
        // Track roadbed: full grade within the ballast, eased fills and cuts beyond.
        const d = nearGrade(x, y);
        const w = 1 - smoothstep(0.032, 0.09, d);
        if (w > 0) v = v * (1 - w);
        // Keep solid rock over tunnels so the bore never shows through.
        const nt = nearest(x, y);
        if (nt.kind === 'tunnel') v = Math.max(v, 0.1 * (1 - smoothstep(0.04, 0.09, nt.d)) + v * smoothstep(0.04, 0.09, nt.d));
        h[j * nx + i] = Math.max(-BASE_DEPTH + 0.01, v);
      }
    }
    this.h = h;
  }

  heightAt(x, y) {
    const fx = Math.min(this.nx - 1.001, Math.max(0, (x - this.x0) / RES));
    const fy = Math.min(this.ny - 1.001, Math.max(0, (y - this.y0) / RES));
    const i = Math.floor(fx), j = Math.floor(fy);
    const tx = fx - i, ty = fy - j;
    const n = this.nx, h = this.h;
    const a = h[j * n + i], b = h[j * n + i + 1], c = h[(j + 1) * n + i], d = h[(j + 1) * n + i + 1];
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  }

  slopeAt(x, y) {
    const e = 0.01;
    const dx = (this.heightAt(x + e, y) - this.heightAt(x - e, y)) / (2 * e);
    const dy = (this.heightAt(x, y + e) - this.heightAt(x, y - e)) / (2 * e);
    return Math.hypot(dx, dy);
  }

  // Runs of consecutive track samples of one kind, per piece.
  spans(kind) {
    const out = [];
    for (const piece of this.layout.pieces) {
      const n = Math.max(2, Math.ceil(piece.len / 0.005));
      let start = null;
      for (let i = 0; i <= n; i++) {
        const s = (piece.len * i) / n;
        const p = this.layout.pose({ piece: piece.id, s, dir: 1 });
        const hit = this.classify(p.x, p.y) === kind;
        if (hit && start === null) start = s;
        if ((!hit || i === n) && start !== null) {
          const end = hit ? s : (piece.len * (i - 1)) / n;
          if (end - start > 0.01) out.push({ piece, s0: start, s1: end });
          start = null;
        }
      }
    }
    return out;
  }

  buildMesh(edgeMaterial) {
    const { nx, ny, x0, y0, tableTop } = this;
    const pos = new Float32Array(nx * ny * 3);
    const col = new Float32Array(nx * ny * 3);
    const uv = new Float32Array(nx * ny * 2);
    const theme = this.theme;
    const c = new THREE.Color();
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const x = x0 + i * RES, y = y0 + j * RES;
        const hv = this.h[k];
        pos[k * 3] = x;
        pos[k * 3 + 1] = tableTop + hv;
        pos[k * 3 + 2] = -y;
        uv[k * 2] = x / 0.3;
        uv[k * 2 + 1] = y / 0.3;
        theme.groundColor(x, y, hv, this.slopeAt(x, y), this.orig[k], c);
        col[k * 3] = c.r;
        col[k * 3 + 1] = c.g;
        col[k * 3 + 2] = c.b;
      }
    }
    const idx = [];
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i, b = a + 1, d = a + nx, e = d + 1;
        idx.push(a, b, d, b, e, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: detailTexture(), roughness: 1, side: THREE.DoubleSide });
    // Triplanar detail so cliff faces don't smear the texture.
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vTriPos;\nvarying vec3 vTriNormal;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvTriPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvTriNormal = normalize(mat3(modelMatrix) * objectNormal);');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vTriPos;\nvarying vec3 vTriNormal;')
        .replace(
          '#include <map_fragment>',
          `vec3 tw = pow(abs(normalize(vTriNormal)), vec3(4.0));
          tw /= (tw.x + tw.y + tw.z);
          vec4 tX = texture2D(map, vTriPos.zy * 3.3);
          vec4 tY = texture2D(map, vTriPos.xz * 3.3);
          vec4 tZ = texture2D(map, vTriPos.xy * 3.3);
          diffuseColor *= tX * tw.x + tY * tw.y + tZ * tw.z;`,
        );
    };
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    mesh.name = 'terrain';

    const group = new THREE.Group();
    group.name = 'terrain-group';
    group.add(mesh);

    // Profile boards around the edges, cut to the ground line.
    const edge = (pts) => {
      const p = [], ix = [];
      pts.forEach(([x, y], n) => {
        const top = tableTop + this.heightAt(x, y);
        p.push(x, top, -y, x, tableTop - BASE_DEPTH - 0.005, -y);
        if (n) {
          const a = (n - 1) * 2;
          ix.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
      g.setIndex(ix);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, edgeMaterial);
      m.receiveShadow = true;
      group.add(m);
    };
    const W = TABLE.width / 2, D = TABLE.depth / 2;
    const line = (ax, ay, bx, by) => {
      const n = Math.ceil(Math.hypot(bx - ax, by - ay) / RES);
      return Array.from({ length: n + 1 }, (_, k) => [ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
    };
    edge(line(-W, -D, W, -D));
    edge(line(-W, D, W, D));
    edge(line(-W, -D, -W, D));
    edge(line(W, -D, W, D));

    // Water: one sheet at river level; the ground hides it everywhere else.
    if (theme.waterLevel !== undefined) {
      const nt = waterNormalTexture();
      nt.repeat.set(6, 3);
      const water = new THREE.Mesh(
        new THREE.PlaneGeometry(TABLE.width - 0.002, TABLE.depth - 0.002),
        new THREE.MeshStandardMaterial({
          color: 0x2c4628,
          roughness: 0.08,
          metalness: 0.0,
          transparent: true,
          opacity: 0.9,
          normalMap: nt,
          normalScale: new THREE.Vector2(0.45, 0.45),
          envMapIntensity: 0.7,
        }),
      );
      water.rotation.x = -Math.PI / 2;
      water.position.y = tableTop + theme.waterLevel;
      water.receiveShadow = true;
      water.name = 'water';
      group.add(water);
      this.water = water;
    }
    this.mesh = mesh;
    this.group = group;
    return group;
  }

  update(dt) {
    if (this.water) {
      const n = this.water.material.normalMap;
      n.offset.y += dt * 0.035;
      n.offset.x += dt * 0.004;
    }
  }
}
