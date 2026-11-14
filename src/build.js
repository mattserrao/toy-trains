// Build mode: pick an open track end, then add pieces to it, or remove pieces.
import * as THREE from 'three';
import { PIECES, PALETTE, pieceIcon } from './track/pieces.js';
import { RAIL_TOP } from './track/trackMesh.js';

export class BuildTool {
  constructor({ scene, camera, dom, tableTop, getLayout, getTrack, commit, toast }) {
    Object.assign(this, { scene, camera, dom, tableTop, getLayout, getTrack, commit, toast });
    this.active = false;
    this.removing = false;
    this.selected = null; // { piece, k }
    this.markers = new THREE.Group();
    this.markers.name = 'open-ends';
    scene.add(this.markers);
    this.ray = new THREE.Raycaster();
    this.time = 0;

    this.ringGeo = new THREE.TorusGeometry(0.016, 0.0025, 8, 32);
    this.arrowGeo = new THREE.ConeGeometry(0.008, 0.018, 12);
    this.hitGeo = new THREE.SphereGeometry(0.035, 8, 6);
    this.hitMat = new THREE.MeshBasicMaterial({ visible: false });
    this.openMat = new THREE.MeshBasicMaterial({ color: 0xffc44d, transparent: true, opacity: 0.95, depthTest: false });
    this.selMat = new THREE.MeshBasicMaterial({ color: 0x6ee08a, transparent: true, opacity: 0.95, depthTest: false });

    this.buildPalette();
    this.bindPointer();
  }

  buildPalette() {
    const wrap = document.getElementById('pieceButtons');
    wrap.innerHTML = '';
    for (const type of PALETTE) {
      const b = document.createElement('button');
      b.className = 'pill';
      b.title = PIECES[type].name;
      b.innerHTML = `${pieceIcon(type)}<span>${PIECES[type].name}</span>`;
      b.addEventListener('click', () => this.add(type));
      wrap.appendChild(b);
    }
    document.getElementById('removeBtn').addEventListener('click', () => this.setRemoving(!this.removing));
  }

  setRemoving(on) {
    this.removing = on;
    document.getElementById('removeBtn').classList.toggle('on', on);
    this.updateHint();
  }

  setActive(on) {
    this.active = on;
    this.markers.visible = on;
    if (!on) this.setRemoving(false);
    this.refresh();
  }

  updateHint() {
    const hint = document.getElementById('buildHint');
    const open = this.getLayout().openEnds().length;
    if (this.removing) hint.textContent = 'Tap a piece of track to remove it.';
    else if (!open) hint.textContent = 'The loop is closed. Remove a piece to open an end and extend it.';
    else hint.textContent = this.selected ? 'Add a piece to the green end, or tap another end.' : 'Tap a glowing open end, then add a piece.';
  }

  refresh() {
    const layout = this.getLayout();
    this.markers.clear();
    const ends = layout.openEnds();
    if (this.selected && !ends.some((e) => e.piece === this.selected.piece && e.k === this.selected.k)) this.selected = null;
    if (!this.selected && ends.length) this.selected = { piece: ends[0].piece, k: ends[0].k };
    const y = this.tableTop + RAIL_TOP + 0.004;
    for (const e of ends) {
      const sel = this.selected && e.piece === this.selected.piece && e.k === this.selected.k;
      const g = new THREE.Group();
      g.position.set(e.x, y, -e.y);
      g.rotation.y = e.h;
      const ring = new THREE.Mesh(this.ringGeo, sel ? this.selMat : this.openMat);
      ring.rotation.x = Math.PI / 2;
      const arrow = new THREE.Mesh(this.arrowGeo, sel ? this.selMat : this.openMat);
      arrow.rotation.z = -Math.PI / 2;
      arrow.position.x = 0.03;
      const hit = new THREE.Mesh(this.hitGeo, this.hitMat);
      hit.userData.end = { piece: e.piece, k: e.k };
      g.add(ring, arrow, hit);
      g.renderOrder = 10;
      ring.renderOrder = arrow.renderOrder = 10;
      g.userData.sel = sel;
      this.markers.add(g);
    }
    this.updateHint();
  }

  add(type) {
    const layout = this.getLayout();
    if (!this.selected) {
      this.toast(layout.openEnds().length ? 'Pick an open end first.' : 'No open ends. Remove a piece first.');
      return;
    }
    const end = layout.get(this.selected.piece).ends[this.selected.k];
    if (!layout.fits(type, end)) {
      this.toast('That piece would run off the table.');
      return;
    }
    this.commit((lay) => {
      const p = lay.place(type, end);
      this.selected = p.links[1] ? null : { piece: p.id, k: 1 };
      if (!lay.openEnds().length) this.toast('Loop complete!');
    }, `Added ${PIECES[type].name.toLowerCase()}`);
  }

  pick(e) {
    const rect = this.dom.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    if (this.removing) {
      const hits = this.ray.intersectObjects(this.getTrack().children, false).filter((h) => h.object.userData.pieceId);
      if (hits.length) {
        const id = hits[0].object.userData.pieceId;
        this.commit((lay) => lay.remove(id), 'Removed piece');
      }
      return;
    }
    const hits = this.ray.intersectObjects(this.markers.children, true).filter((h) => h.object.userData.end);
    if (hits.length) {
      this.selected = { ...hits[0].object.userData.end };
      this.refresh();
    }
  }

  bindPointer() {
    let down = null;
    this.dom.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
    this.dom.addEventListener('pointerup', (e) => {
      if (!this.active || !down) return;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) this.pick(e);
      down = null;
    });
  }

  update(dt) {
    if (!this.active) return;
    this.time += dt;
    const s = 1 + Math.sin(this.time * 5) * 0.12;
    for (const g of this.markers.children) if (g.userData.sel) g.scale.setScalar(s);
  }
}
