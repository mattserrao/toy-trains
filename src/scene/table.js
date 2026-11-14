// The layout table, the show hall around it, and the lights.
import * as THREE from 'three';
import { TABLE } from '../track/layout.js';
import { grassTexture, woodTexture, backdropTexture, concreteTexture } from './textures.js';

export const TABLE_TOP = 0.76; // meters above the hall floor

export function buildHall(scene) {
  const W = TABLE.width, D = TABLE.depth, T = TABLE_TOP;
  const group = new THREE.Group();
  group.name = 'hall';

  // Table top with ground cover.
  const ground = new THREE.Mesh(
    new THREE.BoxGeometry(W, 0.02, D),
    [
      new THREE.MeshStandardMaterial({ color: 0x6b5a45 }),
      new THREE.MeshStandardMaterial({ color: 0x6b5a45 }),
      new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 1 }),
      new THREE.MeshStandardMaterial({ color: 0x3b3328 }),
      new THREE.MeshStandardMaterial({ color: 0x6b5a45 }),
      new THREE.MeshStandardMaterial({ color: 0x6b5a45 }),
    ],
  );
  ground.position.set(0, T - 0.01, 0);
  ground.receiveShadow = true;
  ground.name = 'ground';
  group.add(ground);

  // Fascia: a painted wood band around the edge, like the show layouts.
  const fasciaMat = new THREE.MeshStandardMaterial({ map: woodTexture(3, '#8a6a4f'), roughness: 0.8 });
  const fh = 0.11, ft = 0.012;
  const fascia = (w, x, z, ry) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, fh, ft), fasciaMat);
    m.position.set(x, T - fh / 2 + 0.008, z);
    m.rotation.y = ry;
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  };
  fascia(W + ft * 2, 0, D / 2 + ft / 2, 0);
  fascia(D, -W / 2 - ft / 2, 0, Math.PI / 2);
  fascia(D, W / 2 + ft / 2, 0, Math.PI / 2);

  // Fabric skirt down to the floor.
  const skirtMat = new THREE.MeshStandardMaterial({ color: 0x1f2a44, roughness: 1 });
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(W + 0.03, T - fh + 0.008, D + 0.02), skirtMat);
  skirt.position.set(0, (T - fh + 0.008) / 2, 0);
  skirt.receiveShadow = true;
  group.add(skirt);

  // Painted sky backdrop along the back edge.
  const bh = 0.42;
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(W, bh),
    new THREE.MeshStandardMaterial({ map: backdropTexture(), roughness: 0.95 }),
  );
  backdrop.position.set(0, T + bh / 2 - 0.005, -D / 2 - 0.004);
  backdrop.receiveShadow = true;
  group.add(backdrop);
  const backBoard = new THREE.Mesh(
    new THREE.BoxGeometry(W + 0.02, bh + 0.12, 0.012),
    new THREE.MeshStandardMaterial({ color: 0xd8d4cc }),
  );
  backBoard.position.set(0, T + bh / 2 - 0.06, -D / 2 - 0.012);
  group.add(backBoard);

  // Hall floor and walls.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ map: concreteTexture(), roughness: 0.9 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xe9e7e2, roughness: 1 });
  const wall = (w, x, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 9), wallMat);
    m.position.set(x, 4.5, z);
    m.rotation.y = ry;
    group.add(m);
  };
  wall(40, 0, -14, 0);
  wall(40, 0, 14, Math.PI);
  wall(28, -18, 0, Math.PI / 2);
  wall(28, 18, 0, -Math.PI / 2);

  // Other layouts in the hall, for context.
  const otherSkirts = [0x23402c, 0x2b2b2b, 0x1f2a44, 0x3d2626];
  [[-5, -4], [4.5, -5], [-6, 4], [5.5, 3.5], [0, -8]].forEach(([x, z], i) => {
    const t = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(3, 0.1, 1.2), new THREE.MeshStandardMaterial({ color: 0x6f8f3a }));
    top.position.y = T - 0.05;
    const sk = new THREE.Mesh(new THREE.BoxGeometry(3.02, T - 0.1, 1.22), new THREE.MeshStandardMaterial({ color: otherSkirts[i % 4] }));
    sk.position.y = (T - 0.1) / 2;
    const bd = new THREE.Mesh(new THREE.BoxGeometry(3, 0.45, 0.02), new THREE.MeshStandardMaterial({ color: 0xa8c4dd }));
    bd.position.set(0, T + 0.22, -0.6);
    t.add(top, sk, bd);
    t.position.set(x, 0, z);
    t.rotation.y = (i * 0.7) % Math.PI;
    group.add(t);
  });

  // Clamp lamps over the back edge.
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.35, metalness: 0.6 });
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffe2a8, emissiveIntensity: 3 });
  const lamps = [];
  for (const x of [-0.8, 0.8]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.75), lampMat);
    pole.position.set(x, T + 0.5, -D / 2 - 0.03);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.12, 24, 1, true), lampMat);
    head.position.set(x, T + 0.86, -D / 2 + 0.08);
    head.rotation.x = -2.2;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.028, 16, 12), bulbMat);
    bulb.position.copy(head.position).add(new THREE.Vector3(0, -0.03, 0.03));
    group.add(pole, head, bulb);
    const spot = new THREE.SpotLight(0xffd9a0, 6, 3, 0.75, 0.6, 1.2);
    spot.position.copy(bulb.position);
    spot.target.position.set(x * 0.8, T, 0.15);
    group.add(spot, spot.target);
    lamps.push(spot);
  }

  scene.add(group);

  // Overhead hall light with shadows on the table.
  const hemi = new THREE.HemisphereLight(0xdfe8f5, 0x5c5246, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff6ea, 2.2);
  sun.position.set(0.9, T + 3.2, 1.4);
  sun.target.position.set(0, T, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.left = -1.45;
  sun.shadow.camera.right = 1.45;
  sun.shadow.camera.top = 0.95;
  sun.shadow.camera.bottom = -0.95;
  sun.shadow.camera.near = 1.5;
  sun.shadow.camera.far = 6;
  sun.shadow.bias = -0.00015;
  sun.shadow.normalBias = 0.0008;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);

  return { group, ground, sun, lamps };
}
