// Procedural canvas textures, so the prototype needs no image assets.
import * as THREE from 'three';

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export { rng };

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(c, { repeat = 1, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Static-grass ground cover: speckled greens with soft patches.
export function grassTexture(seed = 7) {
  const [c, g] = canvas(1024, 1024);
  const r = rng(seed);
  g.fillStyle = '#4f6e2a';
  g.fillRect(0, 0, 1024, 1024);
  const patches = ['#5f7d2f', '#3f5c24', '#6a8536', '#566a2e', '#6b6f35', '#3d5a22'];
  for (let i = 0; i < 260; i++) {
    const x = r() * 1024, y = r() * 1024, rad = 30 + r() * 120;
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    const col = patches[Math.floor(r() * patches.length)];
    grad.addColorStop(0, col + 'aa');
    grad.addColorStop(1, col + '00');
    g.fillStyle = grad;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // Fibers.
  for (let i = 0; i < 90000; i++) {
    const x = r() * 1024, y = r() * 1024;
    const v = r();
    g.fillStyle = v < 0.33 ? '#7f9644' : v < 0.66 ? '#36501d' : v < 0.9 ? '#68833a' : '#9c8a4e';
    g.fillRect(x, y, 1 + r() * 1.5, 1 + r() * 1.5);
  }
  return toTexture(c, { repeat: 3 });
}

// Grey-brown crushed stone.
export function ballastTexture(seed = 11) {
  const [c, g] = canvas(256, 256);
  const r = rng(seed);
  g.fillStyle = '#7d766c';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) {
    const v = 70 + r() * 110;
    const tint = r() * 18;
    g.fillStyle = `rgb(${v + tint},${v + tint * 0.6},${v})`;
    const s = 1 + r() * 2.5;
    g.fillRect(r() * 256, r() * 256, s, s);
  }
  return toTexture(c);
}

// Painted fascia wood.
export function woodTexture(seed = 3, base = '#9a6b45') {
  const [c, g] = canvas(1024, 128);
  const r = rng(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, 1024, 128);
  for (let i = 0; i < 70; i++) {
    const y = r() * 128;
    g.strokeStyle = `rgba(60,35,20,${0.08 + r() * 0.15})`;
    g.lineWidth = 0.5 + r() * 2;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= 1024; x += 32) g.lineTo(x, y + Math.sin(x * 0.01 + i) * 3 + (r() - 0.5) * 2);
    g.stroke();
  }
  return toTexture(c, { repeat: 1 });
}

// Painted sky backdrop with soft clouds and distant hills, like the show layouts.
export function backdropTexture(seed = 21) {
  const [c, g] = canvas(2048, 400);
  const r = rng(seed);
  const sky = g.createLinearGradient(0, 0, 0, 400);
  sky.addColorStop(0, '#8fb9de');
  sky.addColorStop(0.7, '#bcd6ea');
  sky.addColorStop(1, '#d9e6ee');
  g.fillStyle = sky;
  g.fillRect(0, 0, 2048, 400);
  // Brushy clouds.
  for (let i = 0; i < 26; i++) {
    const cx = r() * 2048, cy = 40 + r() * 170;
    const w = 90 + r() * 220;
    for (let j = 0; j < 14; j++) {
      const x = cx + (r() - 0.5) * w, y = cy + (r() - 0.5) * 26, rad = 14 + r() * 30;
      const grad = g.createRadialGradient(x, y, 0, x, y, rad);
      grad.addColorStop(0, 'rgba(255,255,255,0.75)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  }
  // Two layers of hazy ridgelines.
  const ridge = (baseY, amp, col, seedOff) => {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(0, 400);
    for (let x = 0; x <= 2048; x += 8) {
      const y = baseY - amp * (0.5 + 0.5 * Math.sin(x * 0.004 + seedOff)) - amp * 0.4 * Math.sin(x * 0.013 + seedOff * 2) - amp * 0.15 * Math.sin(x * 0.05);
      g.lineTo(x, y);
    }
    g.lineTo(2048, 400);
    g.fill();
  };
  ridge(320, 70, '#9fb3bf', 1.3);
  ridge(360, 55, '#7f9a86', 4.1);
  // Treeline speckle on the near ridge.
  for (let i = 0; i < 1800; i++) {
    const x = r() * 2048, y = 330 + r() * 70;
    g.fillStyle = r() < 0.5 ? 'rgba(70,98,70,0.6)' : 'rgba(90,120,80,0.5)';
    g.beginPath();
    g.moveTo(x, y - 6 - r() * 6);
    g.lineTo(x - 3, y);
    g.lineTo(x + 3, y);
    g.fill();
  }
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function concreteTexture(seed = 5) {
  const [c, g] = canvas(512, 512);
  const r = rng(seed);
  g.fillStyle = '#8b8a86';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 20000; i++) {
    const v = 120 + r() * 40;
    g.fillStyle = `rgba(${v},${v},${v - 4},0.25)`;
    g.fillRect(r() * 512, r() * 512, 2, 2);
  }
  g.strokeStyle = 'rgba(60,60,60,0.35)';
  g.lineWidth = 2;
  g.strokeRect(0, 0, 512, 512);
  return toTexture(c, { repeat: 12 });
}

// Soft round puff for smoke and steam.
export function puffTexture() {
  const [c, g] = canvas(128, 128);
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Granite rock face.
export function rockTexture(seed = 9) {
  const [c, g] = canvas(512, 512);
  const r = rng(seed);
  g.fillStyle = '#85827a';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 400; i++) {
    const x = r() * 512, y = r() * 512, rad = 10 + r() * 50;
    const v = 100 + r() * 70;
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, `rgba(${v},${v - 3},${v - 10},0.5)`);
    grad.addColorStop(1, `rgba(${v},${v},${v},0)`);
    g.fillStyle = grad;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  for (let i = 0; i < 60; i++) {
    g.strokeStyle = `rgba(40,38,35,${0.2 + r() * 0.3})`;
    g.lineWidth = 1 + r() * 2;
    g.beginPath();
    let x = r() * 512, y = r() * 512;
    g.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += (r() - 0.5) * 60;
      y += r() * 40;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  return toTexture(c, { repeat: 1 });
}
