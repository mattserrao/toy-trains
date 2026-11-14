// The layout document: a list of placed track pieces plus the graph that
// links their ends. Trains move along this graph by distance.

import { PIECES, pieceLength, worldPose } from './pieces.js';

const LINK_TOL = 0.003; // meters
const ANGLE_TOL = 0.02; // radians

export const TABLE = { width: 2.44, depth: 1.22 }; // 4 x 8 ft

function wrap(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

export class Layout {
  constructor(data) {
    this.pieces = [];
    this.nextId = 1;
    if (data) this.load(data);
  }

  static defaultOval() {
    const lay = new Layout();
    const start = { x: -0.496, y: -0.55, h: 0 };
    const seq = [
      'S248', 'S248', 'S248', 'S248',
      'C55L', 'C55L', 'C55L', 'C55L', 'C55L', 'C55L',
      'S248', 'S248', 'S248', 'S248',
      'C55L', 'C55L', 'C55L', 'C55L', 'C55L', 'C55L',
    ];
    let end = { ...start };
    for (const type of seq) {
      const p = lay.place(type, end);
      end = p.ends[1];
    }
    return lay;
  }

  load(data) {
    this.pieces = data.pieces.map((p) => ({ id: p.id, type: p.type, x: p.x, y: p.y, h: p.h }));
    this.nextId = Math.max(0, ...this.pieces.map((p) => p.id)) + 1;
    this.rebuild();
  }

  toJSON() {
    return { version: 1, pieces: this.pieces.map(({ id, type, x, y, h }) => ({ id, type, x, y, h })) };
  }

  get(id) {
    return this.byId.get(id);
  }

  // Place a piece so its start connects to an open end (end.h is the outward heading).
  place(type, end) {
    const piece = { id: this.nextId++, type, x: end.x, y: end.y, h: end.h };
    this.pieces.push(piece);
    this.rebuild();
    return piece;
  }

  remove(id) {
    this.pieces = this.pieces.filter((p) => p.id !== id);
    this.rebuild();
  }

  // Would this piece stay on the table?
  fits(type, end, margin = 0.035) {
    const probe = { type, x: end.x, y: end.y, h: end.h };
    const len = pieceLength(PIECES[type]);
    for (let i = 0; i <= 12; i++) {
      const p = worldPose(probe, (len * i) / 12);
      if (Math.abs(p.x) > TABLE.width / 2 - margin || Math.abs(p.y) > TABLE.depth / 2 - margin) return false;
    }
    return true;
  }

  rebuild() {
    this.byId = new Map();
    for (const p of this.pieces) {
      p.len = pieceLength(PIECES[p.type]);
      const a = worldPose(p, 0);
      const b = worldPose(p, p.len);
      // Outward headings: end 0 points backward, end 1 points forward.
      p.ends = [
        { x: a.x, y: a.y, h: wrap(a.h + Math.PI), piece: p.id, k: 0 },
        { x: b.x, y: b.y, h: wrap(b.h), piece: p.id, k: 1 },
      ];
      p.links = [null, null];
      this.byId.set(p.id, p);
    }
    const ends = this.pieces.flatMap((p) => p.ends);
    for (let i = 0; i < ends.length; i++) {
      for (let j = i + 1; j < ends.length; j++) {
        const e1 = ends[i], e2 = ends[j];
        if (e1.piece === e2.piece) continue;
        if (Math.hypot(e1.x - e2.x, e1.y - e2.y) > LINK_TOL) continue;
        if (Math.abs(wrap(e1.h - e2.h - Math.PI)) > ANGLE_TOL) continue;
        const p1 = this.byId.get(e1.piece), p2 = this.byId.get(e2.piece);
        if (p1.links[e1.k] || p2.links[e2.k]) continue;
        p1.links[e1.k] = { piece: e2.piece, k: e2.k };
        p2.links[e2.k] = { piece: e1.piece, k: e1.k };
      }
    }
    this.version = (this.version || 0) + 1;
  }

  openEnds() {
    const out = [];
    for (const p of this.pieces) for (const k of [0, 1]) if (!p.links[k]) out.push(p.ends[k]);
    return out;
  }

  totalLength() {
    return this.pieces.reduce((a, p) => a + p.len, 0);
  }

  // Move along the track. pos = { piece, s, dir } where dir = +1 travels toward
  // end 1. delta > 0 moves the way the train faces. Returns { pos, blocked }.
  advance(pos, delta) {
    let cur = { ...pos };
    let remaining = delta;
    for (let guard = 0; guard < 64; guard++) {
      const p = this.byId.get(cur.piece);
      if (!p) return { pos: cur, blocked: true };
      const s = cur.s + remaining * cur.dir;
      if (s >= 0 && s <= p.len) {
        cur.s = s;
        return { pos: cur, blocked: false };
      }
      const exitK = s > p.len ? 1 : 0;
      const over = exitK === 1 ? s - p.len : -s;
      const link = p.links[exitK];
      if (!link) {
        cur.s = exitK === 1 ? p.len : 0;
        return { pos: cur, blocked: true };
      }
      const next = this.byId.get(link.piece);
      const sign = Math.sign(remaining);
      if (link.k === 0) cur = { piece: next.id, s: 0, dir: sign };
      else cur = { piece: next.id, s: next.len, dir: -sign };
      remaining = sign * over;
    }
    return { pos: cur, blocked: true };
  }

  // World pose facing the train's direction.
  pose(pos) {
    const p = this.byId.get(pos.piece);
    const w = worldPose(p, pos.s);
    return { x: w.x, y: w.y, h: pos.dir < 0 ? w.h + Math.PI : w.h };
  }

  // Points along every piece, for keeping scenery off the track.
  samples(step = 0.03) {
    const pts = [];
    for (const p of this.pieces) {
      const n = Math.max(1, Math.ceil(p.len / step));
      for (let i = 0; i <= n; i++) pts.push(worldPose(p, (p.len * i) / n));
    }
    return pts;
  }
}
