// Sectional track pieces, defined as data.
// Units are meters at model size (HO, 1:87). Layout coordinates are 2D (x, y)
// on the table top; world space maps them to (x, height, -y).
// Each piece starts at its local origin heading +x and ends at its end pose.

export const SCALE = 87;
export const GAUGE = 0.0165;

const DEG = Math.PI / 180;

export const PIECES = {
  S248: { name: 'Straight', kind: 'straight', length: 0.248 },
  S124: { name: 'Half straight', kind: 'straight', length: 0.124 },
  S62: { name: 'Quarter straight', kind: 'straight', length: 0.062 },
  C55L: { name: 'Curve left', kind: 'curve', radius: 0.55, angle: 30 * DEG, turn: 1 },
  C55R: { name: 'Curve right', kind: 'curve', radius: 0.55, angle: 30 * DEG, turn: -1 },
  C45L: { name: 'Tight left', kind: 'curve', radius: 0.45, angle: 30 * DEG, turn: 1 },
  C45R: { name: 'Tight right', kind: 'curve', radius: 0.45, angle: 30 * DEG, turn: -1 },
  C55L15: { name: 'Easement left', kind: 'curve', radius: 0.55, angle: 15 * DEG, turn: 1 },
  C55R15: { name: 'Easement right', kind: 'curve', radius: 0.55, angle: 15 * DEG, turn: -1 },
};

// Order shown in the build palette.
export const PALETTE = ['S248', 'S124', 'C55L', 'C55R', 'C45L', 'C45R', 'S62', 'C55L15', 'C55R15'];

export function pieceLength(def) {
  return def.kind === 'straight' ? def.length : def.radius * def.angle;
}

export function localPose(def, s) {
  if (def.kind === 'straight') return { x: s, y: 0, h: 0 };
  const phi = s / def.radius;
  const t = def.turn;
  return {
    x: def.radius * Math.sin(phi),
    y: t * def.radius * (1 - Math.cos(phi)),
    h: t * phi,
  };
}

// Pose of a placed piece at arc distance s from its start.
export function worldPose(inst, s) {
  const l = localPose(PIECES[inst.type], s);
  const c = Math.cos(inst.h);
  const sn = Math.sin(inst.h);
  return {
    x: inst.x + l.x * c - l.y * sn,
    y: inst.y + l.x * sn + l.y * c,
    h: inst.h + l.h,
  };
}

// Small SVG icon for the palette.
export function pieceIcon(type) {
  const def = PIECES[type];
  const pts = [];
  const len = pieceLength(def);
  const n = 16;
  for (let i = 0; i <= n; i++) pts.push(localPose(def, (len * i) / n));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY, 0.12);
  const sx = (x) => 4 + ((x - minX) / span) * 34;
  const sy = (y) => 22 - ((y - minY) / span) * 34 + (maxY - minY < 0.01 ? -9 : 0);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 42 26" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/></svg>`;
}
