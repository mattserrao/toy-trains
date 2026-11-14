// A train is a consist of cars that follow the track graph by distance.
import * as THREE from 'three';
import { RAIL_TOP } from '../track/trackMesh.js';
import { SCALE } from '../track/pieces.js';
import { puffTexture } from '../scene/textures.js';

const COUPLER_GAP = 0.005;
const MAX_SPEED = 0.32; // m/s at model size (~62 scale mph)
const ACCEL = 0.05; // m/s^2
const BRAKE = 0.16;
const RAIL_JOINT = 0.137; // a 39 ft rail at HO size

class Smoke {
  constructor(scene) {
    this.tex = puffTexture();
    this.pool = [];
    this.group = new THREE.Group();
    scene.add(this.group);
    for (let i = 0; i < 90; i++) {
      const m = new THREE.SpriteMaterial({ map: this.tex, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
      const s = new THREE.Sprite(m);
      s.visible = false;
      this.group.add(s);
      this.pool.push({ sprite: s, life: 0, max: 1, vel: new THREE.Vector3(), size: 0, grow: 0, alpha: 0 });
    }
    this.next = 0;
  }
  emit(pos, { vel, size = 0.012, grow = 0.05, life = 1.6, color = 0x6d6a66, alpha = 0.7 }) {
    const p = this.pool[this.next];
    this.next = (this.next + 1) % this.pool.length;
    p.sprite.position.copy(pos);
    p.sprite.material.color.set(color);
    p.sprite.visible = true;
    p.vel.copy(vel);
    p.life = 0;
    p.max = life;
    p.size = size;
    p.grow = grow;
    p.alpha = alpha;
  }
  update(dt) {
    for (const p of this.pool) {
      if (!p.sprite.visible) continue;
      p.life += dt;
      const t = p.life / p.max;
      if (t >= 1) {
        p.sprite.visible = false;
        continue;
      }
      p.vel.multiplyScalar(1 - dt * 1.2);
      p.vel.y += dt * 0.02;
      p.sprite.position.addScaledVector(p.vel, dt);
      const s = p.size + p.grow * t;
      p.sprite.scale.set(s, s, s);
      p.sprite.material.opacity = p.alpha * (1 - t) * Math.min(1, t * 8);
    }
  }
}

export class Train {
  constructor(scene, layout, cars, tableTop) {
    this.scene = scene;
    this.layout = layout;
    this.cars = cars;
    this.tableTop = tableTop;
    this.v = 0;
    this.throttle = 0;
    this.reverser = 1; // +1 forward, -1 reverse
    this.pendingReverse = false;
    this.blocked = false;
    this.distance = 0;
    this.listeners = {};
    for (const c of cars) scene.add(c);
    this.smoke = new Smoke(scene);
    this.chuffPhase = 0;
    this.jointPhase = cars.map((_, i) => [0.1 * i, 0.45 + 0.1 * i]);
    this.wisp = 0;

    // Headlight.
    const loco = cars[0];
    const hl = new THREE.SpotLight(0xffe7b5, 0.35, 1.2, 0.35, 0.6, 1.4);
    hl.position.copy(loco.userData.headlight);
    hl.target.position.copy(loco.userData.headlight).add(new THREE.Vector3(0.5, -0.03, 0));
    loco.add(hl, hl.target);

    // Offsets from the head (front of loco) to each truck.
    let f = 0;
    this.offsets = cars.map((c) => {
      const center = f + c.userData.length / 2;
      f += c.userData.length + COUPLER_GAP;
      return { center, a: center - c.userData.truck, b: center + c.userData.truck };
    });
    this.length = f;
    this.head = null;
    this.placeOnTrack();
  }

  on(name, fn) {
    (this.listeners[name] ||= []).push(fn);
  }
  emit(name, data) {
    for (const fn of this.listeners[name] || []) fn(data);
  }

  setLayout(layout) {
    this.layout = layout;
    if (!this.head || !layout.get(this.head.piece) || !this.computeTrucks(this.head)) this.placeOnTrack();
  }

  // Find a spot where the whole train fits.
  placeOnTrack() {
    this.v = 0;
    const tries = [];
    if (this.head && this.layout.get(this.head.piece)) tries.push(this.head);
    for (const p of this.layout.pieces) {
      for (const s of [p.len * 0.5, p.len, 0]) tries.push({ piece: p.id, s, dir: 1 }, { piece: p.id, s, dir: -1 });
    }
    for (const t of tries) {
      if (this.computeTrucks(t)) {
        this.head = { ...t };
        this.positionCars();
        this.setVisible(true);
        return true;
      }
    }
    this.head = null;
    this.setVisible(false);
    return false;
  }

  setVisible(v) {
    for (const c of this.cars) c.visible = v;
  }

  computeTrucks(head) {
    const out = [];
    for (const o of this.offsets) {
      const a = this.layout.advance(head, -o.a);
      const b = this.layout.advance(head, -o.b);
      if (a.blocked || b.blocked) return null;
      out.push([this.layout.pose(a.pos), this.layout.pose(b.pos)]);
    }
    this.trucks = out;
    return out;
  }

  positionCars() {
    const y = this.tableTop + RAIL_TOP;
    this.cars.forEach((car, i) => {
      const [a, b] = this.trucks[i];
      car.position.set((a.x + b.x) / 2, y, -(a.y + b.y) / 2);
      car.rotation.y = Math.atan2(a.y - b.y, a.x - b.x);
    });
  }

  setThrottle(t) {
    this.throttle = Math.max(0, Math.min(1, t));
  }

  toggleReverser() {
    if (Math.abs(this.v) < 0.002) {
      this.reverser *= -1;
      this.pendingReverse = false;
    } else {
      this.pendingReverse = true;
    }
    return this.reverser;
  }

  stop() {
    this.throttle = 0;
  }

  get scaleMph() {
    return Math.abs(this.v) * SCALE * 2.23694;
  }

  update(dt) {
    this.smoke.update(dt);
    if (!this.head) return;
    const target = this.pendingReverse ? 0 : this.throttle * MAX_SPEED * this.reverser;
    const dv = target - this.v;
    const rate = Math.abs(target) < Math.abs(this.v) || Math.sign(target) !== Math.sign(this.v) ? BRAKE : ACCEL;
    this.v += Math.sign(dv) * Math.min(Math.abs(dv), rate * dt);
    if (this.pendingReverse && Math.abs(this.v) < 0.002) {
      this.v = 0;
      this.reverser *= -1;
      this.pendingReverse = false;
      this.emit('reversed', this.reverser);
    }

    const delta = this.v * dt;
    if (delta !== 0) {
      const res = this.layout.advance(this.head, delta);
      const trucks = this.computeTrucks(res.pos);
      if (res.blocked || !trucks) {
        this.computeTrucks(this.head);
        if (!this.blocked) this.emit('blocked');
        this.blocked = true;
        this.v = 0;
      } else {
        this.blocked = false;
        this.head = res.pos;
        this.distance += Math.abs(delta);
        this.positionCars();
        this.animate(delta);
      }
    }
    this.effects(dt);
  }

  animate(delta) {
    for (const car of this.cars) {
      for (const w of car.userData.wheels) w.mesh.rotation.z -= delta / w.radius;
    }
    // Side rods ride the driver crank.
    const loco = this.cars[0];
    const drv = loco.userData.wheels[0];
    const ang = drv.mesh.rotation.z;
    loco.userData.rods.forEach((rod, i) => {
      const phase = ang + (i ? Math.PI / 2 : 0);
      rod.position.x = 0.004 + Math.sin(phase) * drv.radius * 0.45;
      rod.position.y = drv.radius + Math.cos(phase) * drv.radius * 0.45;
    });
    // Four exhaust beats per driver revolution.
    const circ = 2 * Math.PI * drv.radius;
    this.chuffPhase += Math.abs(delta) / (circ / 4);
    while (this.chuffPhase >= 1) {
      this.chuffPhase -= 1;
      this.chuffCount = (this.chuffCount || 0) + 1;
      this.emit('chuff', { accent: this.chuffCount % 4 === 0 });
      this.puff(true);
    }
    // Wheels over rail joints: one click per truck.
    this.cars.forEach((car, i) => {
      for (const k of [0, 1]) {
        this.jointPhase[i][k] += Math.abs(delta) / RAIL_JOINT;
        if (this.jointPhase[i][k] >= 1) {
          this.jointPhase[i][k] -= 1;
          this.emit('joint', { car: i, truck: k });
        }
      }
    });
  }

  puff(beat) {
    const loco = this.cars[0];
    const p = loco.userData.stackTop.clone();
    loco.localToWorld(p);
    const work = Math.max(0.15, this.throttle);
    this.smoke.emit(p, {
      vel: new THREE.Vector3((Math.random() - 0.5) * 0.01, 0.05 + work * 0.08, (Math.random() - 0.5) * 0.01),
      size: 0.01,
      grow: 0.05 + work * 0.05,
      life: 1.4 + work,
      color: 0x55524e,
      alpha: beat ? 0.35 + work * 0.4 : 0.2,
    });
  }

  effects(dt) {
    // Lazy wisps when idling; cylinder-cock steam when starting.
    this.wisp += dt;
    const speed = Math.abs(this.v);
    if (speed < 0.01 && this.wisp > 0.45) {
      this.wisp = 0;
      this.puff(false);
    }
    if (this.throttle > 0.05 && speed < 0.05 && Math.random() < dt * 14) {
      const loco = this.cars[0];
      for (const side of [-1, 1]) {
        const p = new THREE.Vector3(0.06, 0.008, side * 0.016);
        loco.localToWorld(p);
        const out = new THREE.Vector3(0, 0, side * 0.04).applyQuaternion(loco.quaternion);
        this.smoke.emit(p, { vel: out.add(new THREE.Vector3(0, 0.01, 0)), size: 0.006, grow: 0.03, life: 0.7, color: 0xffffff, alpha: 0.6 });
      }
    }
  }

  // World-space frame of the locomotive for cameras.
  locoFrame() {
    const loco = this.cars[0];
    const fwd = new THREE.Vector3(1, 0, 0).applyQuaternion(loco.quaternion);
    return { loco, position: loco.position.clone(), forward: fwd };
  }
}
