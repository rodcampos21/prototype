/**
 * Sandbox for the shark boss sheet (`createEnemySheet('shark')`, COMBAT.md §enemy sheets): the
 * boss on a sandy arena beside a knight for scale, on the real pipeline (TileMap terrain,
 * LightingSystem, PostFX with the game's tuning). The sheet has no ENEMY_DEFS entry or brain yet,
 * so a scripted fight drives it through every pose — approach (walk), the anchor slam (windup →
 * attack), a half circle round the knight (the side and back views), the sweep (sweepWind →
 * sweep), two hits (hurt + flash), the roar, and the fall (dead) — with camera shake and dust.
 * The panel pauses the script to pick a pose and a direction by hand.
 *
 * URL params: ?pose=<column name>&dir=down|left|right|up (start paused on that frame)  &t=<hour>
 *   &dof=1 (the game's tilt-shift on)
 * window.__shark: { THREE, engine, rig, lighting, shark, knight, sheet, setPose(name, dir),
 *   setSim(on), setTime(h), step(n) }
 */
import * as THREE from 'three';
import {
  Engine, CameraRig, PostFX, LightingSystem, DEFAULT_KEYFRAMES, TextureLibrary, TileMap, Particles, Sprite3D,
  createCharacterSheet, CHARACTER_PRESETS, createEnemySheet,
} from '../src/engine/index.js';
import { DIRECTIONS } from '../src/engine/constants.js';
import { KEYFRAME_OVERRIDES, SUN_PATH, MOON_PATH, CHARACTER_SPRITE_OPTS, CAMERA } from '../src/game/config.js';
import { installFogStart } from '../src/game/AtmosphereFog.js';

/** @import { TileDef } from '../src/engine/level/types.js' */

const params = new URLSearchParams(location.search);

// ---------------------------------------------------------------------------------------------
// Engine, lighting, post (as in Game.init / _tunePost)
// ---------------------------------------------------------------------------------------------

installFogStart(CAMERA.distance - 7);
const engine = new Engine({ container: document.getElementById('app'), maxPixelRatio: 1, exposeGlobal: false });
const { scene, camera, renderer } = engine;
const keyframes = DEFAULT_KEYFRAMES.map((k) => ({ ...k, ...(KEYFRAME_OVERRIDES[k.name] ?? {}) }));
const lighting = new LightingSystem(engine, { timeOfDay: Number(params.get('t') ?? 15.5), shadowExtent: 26, sunPath: SUN_PATH, moonPath: MOON_PATH, keyframes });
const postfx = new PostFX(renderer, scene, camera, { maxTaps: 64, samples: 4 });
{
  const S = postfx.settings;
  // the game's tilt-shift blurs a 96 px sprite standing above the focus band: off by default
  // here (the panel turns it back on)
  Object.assign(S.dof, { enabled: params.get('dof') === '1', focusRange: 6, maxBlur: 13, nearScale: 1.5, farScale: 1.15, tiltShift: 0.42, tiltCenter: 0.5, tiltWidth: 0.3, bokehBoost: 1.6 });
  Object.assign(S.bloom, { strength: 0.5, radius: 0.58, threshold: 1.05 });
  Object.assign(S.grade, { exposure: 1.03, contrast: 1.04, saturation: 1.3, temperature: 0.04, vignette: 0.55, grain: 0.03, shadowsTint: [-0.04, 0.05, 0.15] });
}
engine.events.on('resize', ({ width, height, pixelRatio }) => postfx.setSize(width, height, pixelRatio));
postfx.setSize(engine.width, engine.height, engine.pixelRatio);

// ---------------------------------------------------------------------------------------------
// Terrain (40 × 40): a sandy arena ringed by grass, a few dark-grass and moss patches
// ---------------------------------------------------------------------------------------------

const W = 40;
const D = 40;
/** @type {Record<string, TileDef>} */
const legend = {
  g: { top: 'grass', side: 'cliff', lip: 'grass_side', walkable: true },
  G: { top: 'grass_dark', side: 'cliff', lip: 'grass_side', walkable: true },
  s: { top: 'sand', side: 'dirt_side', walkable: true },
};
const tiles = [];
const heights = [];
for (let j = 0; j < D; j++) {
  let t = '';
  for (let i = 0; i < W; i++) {
    const r = Math.hypot(i - 20, j - 20);
    if (r < 12) t += 's';
    else t += (i * 7 + j * 3) % 5 === 0 ? 'G' : 'g';
  }
  tiles.push(t);
  heights.push('2'.repeat(W));
}
const textures = new TextureLibrary({ seed: 1337, anisotropy: 4 });
const tileMap = new TileMap({ name: 'Shark arena', legend, tiles, heights, waterLevel: 0 }, { textures });
scene.add(tileMap.object);
const groundY = (x, z) => tileMap.getHeight(x, z);

// ---------------------------------------------------------------------------------------------
// The knight (scale reference) and the shark
// ---------------------------------------------------------------------------------------------

const KNIGHT = { x: 20, z: 21 };
const sheet = createEnemySheet('shark');
const knight = new Sprite3D(createCharacterSheet({ ...CHARACTER_PRESETS.swordsman, preset: 'swordsman' }), { ...CHARACTER_SPRITE_OPTS });
knight.position.set(KNIGHT.x, groundY(KNIGHT.x, KNIGHT.z), KNIGHT.z);
knight.play('idle_up');
scene.add(knight);
const shark = new Sprite3D(sheet, { ...CHARACTER_SPRITE_OPTS, ...sheet.spriteOptions, combatFx: true });
scene.add(shark);
const particles = new Particles(scene);

const focus = new THREE.Vector3(KNIGHT.x, 1.5, KNIGHT.z - 2);
const rig = new CameraRig(camera, { distance: CAMERA.distance, pitch: CAMERA.pitch, fov: CAMERA.fov, minDistance: CAMERA.minDistance, maxDistance: CAMERA.maxDistance, yaw: 0, lookAhead: 0, freeYaw: true });
rig.setTarget(focus);
rig.snap();
lighting.followTarget(focus);

// ---------------------------------------------------------------------------------------------
// Pose control
// ---------------------------------------------------------------------------------------------

/** @type {{ pose: string, dir: string, flash: number, flashKnight: number, step: string }} */
const view = { pose: 'idle', dir: 'down', flash: 0, flashKnight: 0, step: '' };

/**
 * The direction (sheet row) a world vector reads as from the current camera.
 * @param {number} dx
 * @param {number} dz
 * @param {string} current  the direction kept on a tie
 * @returns {string}
 */
function dirOf(dx, dz, current) {
  return Sprite3D.directionFromVector(dx, dz, rig.yaw, /** @type {any} */ (current));
}

/**
 * Show a pose: 'idle' / 'walk' play the sheet animations, any other column name is a still frame.
 * @param {string} pose
 * @param {string} [dir]
 */
function setPose(pose, dir = view.dir) {
  view.pose = pose;
  view.dir = dir;
  shark.direction = /** @type {any} */ (dir);
  if (pose === 'idle' || pose === 'walk') shark.play(`${pose}_${dir}`);
  else shark.setFrame(sheet.poses[pose], Math.max(0, DIRECTIONS.indexOf(/** @type {any} */ (dir))));
}

function placeShark(x, z) {
  shark.position.set(x, groundY(x, z), z);
}

/** Point the knight at the shark (its idle animation, or its walk while the shark moves). */
function faceKnight() {
  const dx = shark.position.x - knight.position.x;
  const dz = shark.position.z - knight.position.z;
  knight.play(`idle_${dirOf(dx, dz, knight.direction)}`);
}

// ---------------------------------------------------------------------------------------------
// The scripted fight: a list of steps, each with a duration and a per-frame tick
// ---------------------------------------------------------------------------------------------

const START = { x: 20, z: 11 };
const REACH = 3.4; // the slam lands this far in front of him
const SPEED = 2.4;

/** Walk toward a point at SPEED (returns true once there). */
function walkTo(tx, tz, dt) {
  const dx = tx - shark.position.x;
  const dz = tz - shark.position.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.05) return true;
  const k = Math.min(1, (SPEED * dt) / d);
  placeShark(shark.position.x + dx * k, shark.position.z + dz * k);
  setPose('walk', dirOf(dx, dz, view.dir));
  return false;
}
/** Face the knight in the given pose. */
function poseAtKnight(pose) {
  setPose(pose, dirOf(knight.position.x - shark.position.x, knight.position.z - shark.position.z, view.dir));
}
/** Dust where the anchor lands, `dist` units in front of him toward the knight. */
function dust(dist, count = 26) {
  const dx = knight.position.x - shark.position.x;
  const dz = knight.position.z - shark.position.z;
  const d = Math.hypot(dx, dz) || 1;
  const x = shark.position.x + (dx / d) * dist;
  const z = shark.position.z + (dz / d) * dist;
  particles.burst('dust', { x, y: groundY(x, z) + 0.2, z }, count);
}

let orbit = 0;
/**
 * @type {{ name: string, dur?: number, enter?: () => void, tick?: (dt: number, u: number) => boolean|void }[]}
 *   dur: seconds (a step without one ends when its tick returns true); u: 0 → 1 through the step
 */
const SCRIPT = [
  { name: 'parado', dur: 1.2, enter: () => { placeShark(START.x, START.z); shark.setFlash(0, 0, 0, 0); poseAtKnight('idle'); } },
  { name: 'aproxima (walk)', tick: (dt) => walkTo(KNIGHT.x, KNIGHT.z - REACH, dt) },
  { name: 'idle', dur: 0.7, enter: () => poseAtKnight('idle') },
  { name: 'windup (âncora no alto)', dur: 0.75, enter: () => poseAtKnight('windup') },
  { name: 'attack (pancada)', dur: 0.7, enter: () => { poseAtKnight('attack'); rig.shake(0.5, 0.45); dust(2.6, 36); view.flashKnight = 1; } },
  { name: 'idle', dur: 0.8, enter: () => poseAtKnight('idle') },
  {
    name: 'contorna (walk, todas as vistas)', dur: 4.2,
    enter: () => { orbit = Math.atan2(shark.position.z - KNIGHT.z, shark.position.x - KNIGHT.x); },
    tick: (dt) => {
      // a full circle round the knight: he shows his front, both sides and his back
      const a0 = orbit;
      orbit += (dt * Math.PI * 2) / 4.2;
      const x = KNIGHT.x + Math.cos(orbit) * REACH;
      const z = KNIGHT.z + Math.sin(orbit) * REACH;
      setPose('walk', dirOf(x - shark.position.x, z - shark.position.z, view.dir));
      placeShark(x, z);
      return a0 > orbit; // never: the duration ends it
    },
  },
  { name: 'idle', dur: 0.5, enter: () => poseAtKnight('idle') },
  { name: 'sweepWind (recua a âncora)', dur: 0.7, enter: () => poseAtKnight('sweepWind') },
  { name: 'sweep (varrida)', dur: 0.6, enter: () => { poseAtKnight('sweep'); rig.shake(0.3, 0.35); dust(2.2, 18); view.flashKnight = 1; } },
  { name: 'idle', dur: 0.7, enter: () => poseAtKnight('idle') },
  { name: 'hurt (golpe 1)', dur: 0.35, enter: () => { poseAtKnight('hurt'); view.flash = 1; } },
  { name: 'idle', dur: 0.35, enter: () => poseAtKnight('idle') },
  { name: 'hurt (golpe 2)', dur: 0.35, enter: () => { poseAtKnight('hurt'); view.flash = 1; } },
  { name: 'roar (rugido)', dur: 1.6, enter: () => { poseAtKnight('roar'); rig.shake(0.25, 1.2); } },
  { name: 'idle', dur: 0.6, enter: () => poseAtKnight('idle') },
  { name: 'hurt (golpe final)', dur: 0.45, enter: () => { poseAtKnight('hurt'); view.flash = 1; } },
  { name: 'dead (caído)', dur: 3.2, enter: () => { poseAtKnight('dead'); rig.shake(0.35, 0.4); dust(0, 30); } },
];

const sim = { on: !params.get('pose'), i: -1, t: 0, speed: 1 };
function enterStep(i) {
  sim.i = i % SCRIPT.length;
  sim.t = 0;
  const s = SCRIPT[sim.i];
  view.step = s.name;
  s.enter?.();
}
function tickScript(dt) {
  if (sim.i < 0) enterStep(0);
  const s = SCRIPT[sim.i];
  sim.t += dt;
  const done = s.tick?.(dt, s.dur ? Math.min(1, sim.t / s.dur) : 0);
  if ((s.dur && sim.t >= s.dur) || (!s.dur && done)) enterStep(sim.i + 1);
}

// ---------------------------------------------------------------------------------------------
// Frame loop
// ---------------------------------------------------------------------------------------------

const input = engine.input;
input.addBindings({ camLeft: ['KeyQ'], camRight: ['KeyE'] });
engine.addSystem({
  name: 'shark-boss-sandbox',
  update(dt) {
    const sdt = dt * sim.speed;
    if (sim.on) tickScript(sdt);
    // hit flashes decay
    view.flash = Math.max(0, view.flash - sdt * 5);
    shark.setFlash(1, 1, 1, view.flash * 0.85);
    view.flashKnight = Math.max(0, view.flashKnight - sdt * 4);
    knight.position.y = groundY(KNIGHT.x, KNIGHT.z) + (view.flashKnight > 0.5 ? 0.12 : 0);
    if (sim.on) faceKnight();
    shark.speed = sim.speed;
    knight.speed = sim.speed;
    particles.update(sdt, camera);
    shark.update(sdt, camera);
    knight.update(sdt, camera);
    // keep the camera between the two
    focus.set((shark.position.x + KNIGHT.x) / 2, 1.5, (shark.position.z + KNIGHT.z) / 2);
    rig.update(dt, input);
  },
}, 0);
engine.addSystem(lighting, -10);
engine.setRenderFn((dt) => {
  if (postfx.settings.dof.autoFocus && rig.focusDistance) postfx.setFocus(rig.focusDistance);
  postfx.render(dt);
});

// ---------------------------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------------------------

function button(parent, label, onClick) {
  const b = document.createElement('button');
  b.textContent = label;
  b.addEventListener('click', () => { onClick(); refresh(); });
  document.getElementById(parent).appendChild(b);
  return b;
}
const simBtn = button('sim', '▶ Simular', () => setSim(!sim.on));
button('sim', '⟲ Reiniciar', () => { setSim(true); enterStep(0); });
/** @type {Record<string, HTMLButtonElement>} */
const speedBtns = {};
for (const s of [0.25, 0.5, 1]) speedBtns[s] = button('sim', `${s}×`, () => { sim.speed = s; });
/** @type {Record<string, HTMLButtonElement>} */
const poseBtns = {};
for (const p of ['idle', 'walk', ...Object.keys(sheet.poses).filter((n) => !/^(idle\d|move\d)$/.test(n))]) {
  poseBtns[p] = button('poses', p, () => { setSim(false); setPose(p); });
}
/** @type {Record<string, HTMLButtonElement>} */
const dirBtns = {};
for (const d of DIRECTIONS) dirBtns[d] = button('dirs', d, () => { setSim(false); setPose(view.pose, d); });
button('cam', '⟲ 45°', () => rig.rotate(-Math.PI / 4));
button('cam', '45° ⟳', () => rig.rotate(Math.PI / 4));
button('cam', 'perto', () => { rig.distanceTarget = CAMERA.minDistance; });
button('cam', 'longe', () => { rig.distanceTarget = CAMERA.distance; });
for (const [label, h] of [['dia', 12], ['tarde', 17.4], ['noite', 23]]) button('cam', label, () => lighting.setTime(h));
const dofBtn = button('cam', 'desfoque', () => { postfx.settings.dof.enabled = !postfx.settings.dof.enabled; });

function setSim(on) {
  sim.on = on;
  if (on && sim.i < 0) enterStep(0);
  if (!on) view.step = 'manual';
  return on;
}
const stateEl = document.getElementById('state');
function refresh() {
  simBtn.textContent = sim.on ? '❚❚ Pausar' : '▶ Simular';
  simBtn.classList.toggle('on', sim.on);
  for (const [s, b] of Object.entries(speedBtns)) b.classList.toggle('on', Number(s) === sim.speed);
  for (const [p, b] of Object.entries(poseBtns)) b.classList.toggle('on', p === view.pose);
  for (const [d, b] of Object.entries(dirBtns)) b.classList.toggle('on', d === view.dir);
  dofBtn.classList.toggle('on', postfx.settings.dof.enabled);
}
setInterval(() => {
  refresh();
  stateEl.textContent = [
    `passo:  ${sim.on ? view.step : 'manual'}`,
    `pose:   ${view.pose} (${view.dir})`,
    `quadro: ${sheet.frameWidth}×${sheet.frameHeight}, folha ${sheet.columns}×${sheet.rows}`,
    `hora:   ${lighting.timeOfDay.toFixed(1)}`,
  ].join('\n');
}, 120);

// start: the script, or the frame named in the URL
placeShark(START.x, START.z);
if (sim.on) enterStep(0);
else { placeShark(KNIGHT.x, KNIGHT.z - REACH); setPose(params.get('pose') ?? 'idle', params.get('dir') ?? 'down'); faceKnight(); }
refresh();
engine.start();

/**
 * `window.__shark`.
 * @typedef {object} SharkHandle
 * @property {typeof THREE} THREE
 * @property {Engine} engine
 * @property {CameraRig} rig
 * @property {LightingSystem} lighting
 * @property {Sprite3D} shark
 * @property {Sprite3D} knight
 * @property {ReturnType<typeof createEnemySheet>} sheet
 * @property {typeof setPose} setPose  show a pose ('idle', 'walk' or a column name) in a direction
 * @property {typeof setSim} setSim  run (true) or pause (false) the scripted fight
 * @property {(h: number) => number} setTime  set the clock (hours); returns the time of day
 * @property {(n?: number) => number} step  stop the loop and advance exactly n frames
 */
window.__shark = {
  THREE, engine, rig, lighting, shark, knight, sheet, setPose, setSim,
  setTime(h) { lighting.setTime(h); return lighting.timeOfDay; },
  /** Stop the loop and advance exactly n frames. */
  step(n = 1) { engine.stop(); for (let i = 0; i < n; i++) engine.step(1 / 60); return engine.time.frame; },
};
console.log('shark_boss sandbox ready');
