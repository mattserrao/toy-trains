import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Layout } from './track/layout.js';
import { buildTrack, disposeGroup } from './track/trackMesh.js';
import { buildHall, TABLE_TOP } from './scene/table.js';
import { buildScenery } from './scene/scenery.js';
import { Terrain } from './scene/terrain.js';
import { buildBridges, buildTunnels } from './scene/landmarks.js';
import { nightMaterials } from './scene/buildings.js';
import { riverGorge, buildRiverGorge } from './theme/riverGorge.js';
import { buildSteamLoco, buildTender, buildBoxcar, buildCaboose } from './train/models.js';
import { Train } from './train/train.js';
import { CameraRig } from './cameras.js';
import { BuildTool } from './build.js';
import { TrainAudio } from './audio.js';
import { loadLayout, saveLayout, clearLayout } from './storage.js';

export const VERSION = '0.2.0';

// Stop the browser from zooming the page on double-tap or pinch (iOS ignores
// the viewport hint), so taps on buttons and the scene stay taps.
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = performance.now();
  if (now - lastTouchEnd < 350 && !e.target.closest('button, input')) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });
document.getElementById('version').textContent = `v${VERSION}`;

// Renderer and scene.
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfd3d6);
scene.fog = new THREE.Fog(0xcfd3d6, 9, 26);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 60);

const hall = buildHall(scene);
const theme = riverGorge;

// Layout, track and scenery.
let layout = loadLayout() || Layout.defaultOval();
if (!layout.pieces.length) layout = Layout.defaultOval();
let terrain, terrainGroup, track, bridges, tunnels, scenery, world;
function buildWorld() {
  terrain = new Terrain(theme, layout, TABLE_TOP);
  terrainGroup = terrain.buildMesh(hall.fasciaMat);
  track = buildTrack(layout, TABLE_TOP, { classify: (x, y) => terrain.classify(x, y) });
  bridges = buildBridges(layout, terrain, TABLE_TOP);
  tunnels = buildTunnels(layout, terrain, TABLE_TOP);
  scenery = buildScenery(layout, TABLE_TOP, terrain, theme);
  scene.add(terrainGroup, track, bridges, tunnels, scenery);
  world = buildRiverGorge(scene, terrain, layout, TABLE_TOP);
}
function clearWorld() {
  for (const g of [terrainGroup, track, bridges, tunnels, scenery]) {
    scene.remove(g);
    disposeGroup(g);
  }
  world.dispose();
  disposeGroup(world.group);
  nightMaterials.clear();
}
let night = 0;
buildWorld();

function rebuildWorld() {
  clearWorld();
  buildWorld();
  applyNight(night);
  train.setLayout(layout);
  build.refresh();
  saveLayout(layout);
  updateStatus();
}

// Train: a 2-6-0 with tender, a boxcar and a caboose.
const train = new Train(scene, layout, [buildSteamLoco(), buildTender(), buildBoxcar(), buildCaboose()], TABLE_TOP);

// Cameras.
const rig = new CameraRig(camera, canvas, TABLE_TOP);

// Day and night.
const dayBg = new THREE.Color(0xcfd3d6), nightBg = new THREE.Color(0x0b0f1a);
const dayHemi = new THREE.Color(0xdfe8f5), nightHemi = new THREE.Color(0x3a4a6e);
let nightTarget = 0;
function applyNight(n) {
  night = n;
  hall.sun.intensity = THREE.MathUtils.lerp(2.2, 0.05, n);
  hall.hemi.intensity = THREE.MathUtils.lerp(0.9, 0.18, n);
  hall.hemi.color.copy(dayHemi).lerp(nightHemi, n);
  hall.lamps.forEach((l) => (l.intensity = THREE.MathUtils.lerp(6, 0.5, n)));
  scene.background.copy(dayBg).lerp(nightBg, n);
  scene.fog.color.copy(scene.background);
  scene.environmentIntensity = THREE.MathUtils.lerp(0.35, 0.04, n);
  hall.backdropMat.color.setRGB(1 - n * 0.78, 1 - n * 0.72, 1 - n * 0.55);
  for (const m of nightMaterials) m.emissiveIntensity = n * (m.userData.nightScale ?? 1.6);
  train.headlight.intensity = THREE.MathUtils.lerp(0.35, 1.6, n);
}
const nightBtn = document.getElementById('nightBtn');
function toggleNight() {
  nightTarget = nightTarget ? 0 : 1;
  nightBtn.textContent = nightTarget ? 'Night' : 'Day';
  nightBtn.classList.toggle('on', !!nightTarget);
}
nightBtn.addEventListener('click', toggleNight);

// Undo history and edits.
const history = [];
function commit(fn, label) {
  history.push(JSON.stringify(layout.toJSON()));
  if (history.length > 100) history.shift();
  fn(layout);
  rebuildWorld();
  if (label) toast(label);
  updateUndo();
}
function undo() {
  const prev = history.pop();
  if (!prev) return;
  layout.load(JSON.parse(prev));
  rebuildWorld();
  toast('Undone');
  updateUndo();
}
function updateUndo() {
  document.getElementById('undoBtn').disabled = history.length === 0;
}

const build = new BuildTool({
  scene, camera, dom: canvas, tableTop: TABLE_TOP,
  getLayout: () => layout,
  getTrack: () => track,
  commit,
  toast,
});
build.setActive(false);
updateUndo();

// Audio.
const audio = new TrainAudio();
train.on('chuff', (e) => audio.chuff({ ...e, throttle: train.throttle, speed: Math.abs(train.v) }));
train.on('joint', () => audio.joint());
train.on('blocked', () => {
  toast('End of track: the train stopped.');
  throttleEl.value = 0;
  train.setThrottle(0);
});
train.on('reversed', (r) => updateDir(r));

// UI wiring.
const throttleEl = document.getElementById('throttle');
const speedEl = document.getElementById('speedNum');
const statusEl = document.getElementById('status');
const dirBtn = document.getElementById('dirBtn');
const soundBtn = document.getElementById('soundBtn');

throttleEl.addEventListener('input', () => train.setThrottle(throttleEl.value / 100));
document.getElementById('stopBtn').addEventListener('click', () => {
  throttleEl.value = 0;
  train.stop();
});
function updateDir(r) {
  dirBtn.textContent = r > 0 ? 'Forward' : 'Reverse';
}
dirBtn.addEventListener('click', () => {
  const r = train.toggleReverser();
  if (train.pendingReverse) toast('Slowing to reverse…');
  else updateDir(r);
});
const whistleBtn = document.getElementById('whistleBtn');
const whistleOn = () => {
  if (!audio.enabled) toast('Turn sound on to hear the whistle.');
  audio.whistle(true);
};
const whistleOff = () => audio.whistle(false);
whistleBtn.addEventListener('pointerdown', whistleOn);
whistleBtn.addEventListener('pointerup', whistleOff);
whistleBtn.addEventListener('pointerleave', whistleOff);

async function toggleSound() {
  if (audio.enabled) {
    audio.stop();
    soundBtn.textContent = 'Sound off';
    soundBtn.classList.remove('on');
  } else {
    await audio.start();
    soundBtn.textContent = 'Sound on';
    soundBtn.classList.add('on');
  }
}
soundBtn.addEventListener('click', toggleSound);

function setMode(mode) {
  document.querySelectorAll('#modeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
  const building = mode === 'build';
  document.getElementById('buildPanel').classList.toggle('hidden', !building);
  document.body.classList.toggle('building', building);
  build.setActive(building);
  if (building && rig.mode !== 'orbit') setCam('orbit');
}
document.querySelectorAll('#modeSeg button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));

function setCam(mode) {
  document.querySelectorAll('#camSeg button').forEach((b) => b.classList.toggle('on', b.dataset.cam === mode));
  rig.setMode(mode);
  if (mode !== 'orbit' && build.active) setMode('run');
}
document.querySelectorAll('#camSeg button').forEach((b) => b.addEventListener('click', () => setCam(b.dataset.cam)));

document.getElementById('undoBtn').addEventListener('click', undo);
document.getElementById('resetBtn').addEventListener('click', () => {
  commit((lay) => lay.load(Layout.defaultOval().toJSON()), 'Back to the oval');
  clearLayout();
  saveLayout(layout);
});

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' && e.key !== ' ') return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    undo();
    e.preventDefault();
    return;
  }
  switch (e.key.toLowerCase()) {
    case '1': setCam('orbit'); break;
    case '2': setCam('follow'); break;
    case '3': setCam('cab'); break;
    case 'b': setMode(build.active ? 'run' : 'build'); break;
    case 'w': case 'arrowup': throttleEl.value = Math.min(100, +throttleEl.value + 10); train.setThrottle(throttleEl.value / 100); break;
    case 's': case 'arrowdown': throttleEl.value = Math.max(0, +throttleEl.value - 10); train.setThrottle(throttleEl.value / 100); break;
    case ' ': throttleEl.value = 0; train.stop(); e.preventDefault(); break;
    case 'r': dirBtn.click(); break;
    case 'm': toggleSound(); break;
    case 'n': toggleNight(); break;
    case 'h': if (!e.repeat) whistleOn(); break;
  }
});
window.addEventListener('keyup', (e) => {
  if (e.key.toLowerCase() === 'h') whistleOff();
});

let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

function updateStatus() {
  const open = layout.openEnds().length;
  const len = layout.totalLength();
  statusEl.textContent = `${layout.pieces.length} pieces · ${(len * 3.281).toFixed(1)} ft of track${open ? ` · ${open} open ends` : ' · closed loop'}`;
}
updateStatus();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Main loop.
const timer = new THREE.Timer();
timer.connect(document);
let shownMph = -1;
function frame(t) {
  timer.update(t);
  const dt = Math.min(timer.getDelta(), 1 / 20);
  train.update(dt);
  world.update(dt);
  terrain.update(dt);
  if (night !== nightTarget) applyNight(THREE.MathUtils.clamp(night + Math.sign(nightTarget - night) * dt * 0.7, 0, 1));
  rig.update(dt, train);
  build.update(dt);
  const mph = Math.round(train.scaleMph);
  if (mph !== shownMph) speedEl.textContent = shownMph = mph;
  let proximity = 1;
  if (rig.mode !== 'cab' && train.head) {
    const d = camera.position.distanceTo(train.cars[0].position);
    proximity = THREE.MathUtils.clamp(0.45 / d, 0.12, 1);
  }
  audio.update({ speed: Math.abs(train.v), throttle: train.throttle, proximity, inCab: rig.mode === 'cab' });
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
document.getElementById('loading').classList.add('done');

// Handy for debugging in the console.
window.toytrains = { scene, layout: () => layout, train, rig, renderer, camera, terrain: () => terrain, toggleNight, commit, undo, applyNight: (n) => { nightTarget = n; applyNight(n); } };
