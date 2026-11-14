// Camera rigs: orbit over the table, follow the train, and ride in the cab.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class CameraRig {
  constructor(camera, dom, tableTop) {
    this.camera = camera;
    this.dom = dom;
    this.mode = 'orbit';
    this.controls = new OrbitControls(camera, dom);
    this.controls.target.set(0, tableTop + 0.05, 0);
    camera.position.set(0.4, tableTop + 1.05, 1.75);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 0.12;
    this.controls.maxDistance = 6;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.controls.zoomToCursor = true;
    this.controls.update();
    this.saved = { pos: camera.position.clone(), target: this.controls.target.clone() };
    this.followPos = new THREE.Vector3();
    this.look = { yaw: 0, pitch: -0.05 };
    this.shake = 0;
    this.time = 0;

    // Drag to look around in the cab and follow views.
    let dragging = false, lx = 0, ly = 0;
    dom.addEventListener('pointerdown', (e) => {
      if (this.mode === 'orbit') return;
      dragging = true;
      lx = e.clientX;
      ly = e.clientY;
    });
    window.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      this.look.yaw -= (e.clientX - lx) * 0.005;
      this.look.pitch = THREE.MathUtils.clamp(this.look.pitch - (e.clientY - ly) * 0.004, -0.9, 0.6);
      lx = e.clientX;
      ly = e.clientY;
    });
    window.addEventListener('pointerup', () => (dragging = false));
  }

  setMode(mode) {
    if (mode === this.mode) return;
    if (this.mode === 'orbit') this.saved = { pos: this.camera.position.clone(), target: this.controls.target.clone() };
    this.mode = mode;
    this.controls.enabled = mode === 'orbit';
    this.look = { yaw: 0, pitch: mode === 'cab' ? -0.04 : -0.25 };
    if (mode === 'orbit') {
      this.camera.position.copy(this.saved.pos);
      this.controls.target.copy(this.saved.target);
      this.camera.fov = 45;
      this.camera.near = 0.01;
    } else if (mode === 'follow') {
      this.camera.fov = 50;
      this.camera.near = 0.004;
      this.followPos.set(0, 0, 0);
    } else {
      this.camera.fov = 72;
      this.camera.near = 0.0015;
    }
    this.camera.updateProjectionMatrix();
  }

  update(dt, train) {
    this.time += dt;
    if (this.mode === 'orbit') {
      this.controls.update();
      return;
    }
    if (!train.head) return;
    const { loco, forward } = train.locoFrame();
    if (this.mode === 'follow') {
      const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.look.yaw);
      const back = forward.clone().applyQuaternion(yawQ).multiplyScalar(-0.42);
      const desired = loco.position.clone().add(back).add(new THREE.Vector3(0, 0.16 - this.look.pitch * 0.25, 0));
      if (this.followPos.lengthSq() === 0) this.followPos.copy(desired);
      this.followPos.lerp(desired, 1 - Math.exp(-dt * 3));
      this.camera.position.copy(this.followPos);
      this.camera.lookAt(loco.position.clone().add(forward.clone().multiplyScalar(0.08)).add(new THREE.Vector3(0, 0.02, 0)));
    } else {
      // Engineer's eye in the cab, looking past the boiler.
      const eye = loco.userData.cab.clone();
      loco.localToWorld(eye);
      const speed = Math.abs(train.v);
      const sway = speed * 0.012;
      eye.y += Math.sin(this.time * 9) * sway * 0.15 + (Math.random() - 0.5) * sway * 0.05;
      this.camera.position.copy(eye);
      const dir = new THREE.Vector3(1, 0, 0)
        .applyAxisAngle(new THREE.Vector3(0, 0, 1), this.look.pitch)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), this.look.yaw)
        .applyQuaternion(loco.quaternion);
      this.camera.lookAt(eye.clone().add(dir));
      this.camera.rotateZ(Math.sin(this.time * 5.3) * sway * 0.8);
    }
  }
}
