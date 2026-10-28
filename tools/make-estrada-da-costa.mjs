#!/usr/bin/env node
/**
 * Builds the game's campaign `public/campaigns/culto-ao-baiacu-rei/` ("Culto ao Baiacu Rei"):
 * `campaign.json` (the title, a new journey's character creation: `player.create`) and its first
 * level `levels/estrada-da-costa.json` ("Estrada da Costa"), the prologue rescue (QP01 / scene C01
 * of the Ato I notebook). A dirt road runs north along the coast of the Terra Selvagem; on a
 * clearing beside it Surubin, a young catfish-folk adept of the Culto ao Baiacu Rei, is cornered by
 * forest creatures. The player (the wandering knight) clears the group; Surubin thanks the Baiacu
 * Rei first and the knight second, then joins the party (a mystic: weak with the staff, a healer).
 * Walking on north with him leads to the second level, `levels/clareira-do-riacho.json`: the
 * campfire of the first night (C02) and, the morning after, the camp of Act I (buildClearing).
 * Coverage: the camp types (`camp: true`, which Starfall Vale skips) must each be placed here.
 *
 *   node tools/make-estrada-da-costa.mjs [--out=public/campaigns/culto-ao-baiacu-rei] [--check]
 *     --out=<dir>   write the campaign folder somewhere else (relative to the repository root), e.g.
 *                   a scratch folder
 *     --check       write nothing; exit 1 if a generated file differs from the one in the --out folder
 *   then play it at game.html (the game's default) or game.html?campaign=culto-ao-baiacu-rei
 *
 * The texts are Brazilian Portuguese, the game's source language (English comes from the content
 * table `public/i18n/en/campaigns/culto-ao-baiacu-rei.json`). The output is deterministic: a second
 * run is byte-identical.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createEmptyLevel, setTile, setHeightLevel, addObject, normalizeLevel, parseLevel, validateLevel, serializeLevel, levelStats,
} from '../src/engine/level/LevelFormat.js';
import { OBJECT_TYPES, isCampType } from '../src/engine/level/ObjectCatalog.js';
import { RNG } from '../src/engine/utils/math.js';
import { CAMPAIGN_FORMAT, normalizeCampaign, serializeCampaign, levelFile } from '../src/game/campaign/CampaignFormat.js';
import { carryCampaignText, seededMint, fileKeyIssues } from '../src/engine/i18n/TextKeys.js';
import { keyLevel, keyIssueLines, previousOutput } from './lib/levelgen.mjs';

/** @import { LevelObject } from '../src/engine/level/types.js' */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  return m ? [m[1], m[2] ?? true] : [a, true];
}));
if (args.out === true || args.out === '') {
  console.error('--out needs a folder, e.g. --out=.check/culto-ao-baiacu-rei');
  process.exit(2);
}
const DIR = 'public/campaigns/culto-ao-baiacu-rei';
const LEVEL_ID = 'estrada-da-costa';
const FILE = `${DIR}/${levelFile(LEVEL_ID)}`;
/** The second level: the clearing up the stream, scene C02 (the campfire). */
const CLEARING_ID = 'clareira-do-riacho';
const OUT_DIR = path.resolve(root, String(args.out ?? DIR));

const W = 40;
const D = 30;
const level = createEmptyLevel({ name: 'Estrada da Costa', width: W, depth: D, fill: 'g', level: 2, border: 2 });
level.subtitle = 'Terra Selvagem';
level.author = 'Culto ao Baiacu Rei';
level.description = 'Prólogo do Ato I: o cavaleiro errante encontra Surubin, adepto do Culto ao Baiacu Rei, cercado por criaturas da mata na estrada da costa.';
// (C01: a stormy afternoon — it rains from the arrival on, held by the story; on a later visit the
// coast rolls its weather at each turn of the day: often rain)
level.environment = { ...level.environment, timeOfDay: 16.4, weather: 'rain', weatherPool: { clear: 55, rain: 45 } };

/** Fill a tile rectangle [i0, i1) × [j0, j1) with a tile char and / or a height level. */
function fill(i0, j0, i1, j1, ch, lvl) {
  for (let j = j0; j < j1; j++) {
    for (let i = i0; i < i1; i++) {
      if (ch != null) setTile(level, i, j, ch);
      if (lvl != null) setHeightLevel(level, i, j, lvl);
    }
  }
}

// ---- terrain -----------------------------------------------------------------------------------
// the sea along the whole west edge (level 0), a sand beach (level 1), dune grass, then the road
fill(0, 0, 8, D, 'o', 0);
fill(8, 0, 11, D, 's', 1);
fill(11, 2, 14, D - 2, 'G');
// a few tongues of sand reaching into the grass
for (const [i, j] of [[11, 6], [11, 7], [11, 19], [12, 19], [11, 20], [11, 24]]) setTile(level, i, j, 's');
// the forest border stops at the beach
fill(8, 0, 11, 2, 's', 1);
fill(8, D - 2, 11, D, 's', 1);

/** The road's west column at row j: a gentle bend toward the sea in the middle. */
const roadAt = (j) => 14 + Math.round(1.2 * Math.sin((j - 4) / 6));
for (let j = 0; j < D; j++) {
  const c = roadAt(j);
  setTile(level, c, j, '.');
  setTile(level, c + 1, j, '.');
}
// the clearing east of the road where Surubin is cornered: trampled dirt in flower grass
fill(17, 11, 25, 19, 'f');
fill(18, 12, 24, 18, 'd');
fill(17, 14, 18, 16, '.');
// an old wooded rise to the east (level 3), its edge broken by rock
fill(30, 2, W - 2, D - 2, 'G', 3);
for (let j = 2; j < D - 2; j++) if (j % 5 === 2) setTile(level, 30, j, 'x');

// ---- the beach: wreckage of Surubin's boat, rocks ------------------------------------------------
addObject(level, 'crate', 9.4, 17.6, { rotation: 0.6, opts: { size: 0.8 } });
addObject(level, 'barrel', 8.7, 18.8, { rotation: 1.1, opts: { height: 1, lying: true } });
addObject(level, 'crate', 9.9, 19.9, { rotation: -0.4, opts: { size: 0.65 } });
addObject(level, 'rock', 8.6, 5.2, { opts: { size: 1.3, seed: 4 } });
addObject(level, 'rock', 9.3, 9.6, { opts: { size: 0.7, seed: 9 } });
addObject(level, 'rock', 8.8, 25.4, { opts: { size: 1.1, seed: 13 } });
addObject(level, 'rock', 10.1, 13.2, { opts: { size: 0.5, seed: 2 } });
addObject(level, 'chest', 9.6, 22.6, { rotation: 0.3, gold: 12, potions: 2, upgrade: 'none' });

// ---- trees: pines on the dunes, oaks and birches on the rise --------------------------------------
const rng = new RNG(1957);
/**
 * Tiles kept clear of trees: the road (± 1), the clearing and the strip south of it (the camera looks
 * north: a tree there would hide the rescue).
 */
const clear = (i, j) => Math.abs(i - roadAt(j) - 0.5) < 2.5 || (i >= 16 && i < 27 && j >= 10 && j < 26);
/** @type {[number, number][]} */
const placed = [];
for (let j = 3; j < D - 3; j += 2) {
  for (let i = 11; i < W - 3; i += 2) {
    const ti = i + rng.int(0, 1);
    const tj = j + rng.int(0, 1);
    if (clear(ti, tj)) { rng.next(); continue; }
    const dune = ti < 14;
    if (!rng.chance(dune ? 0.18 : ti >= 30 ? 0.62 : 0.32)) continue;
    const kind = dune ? 'pine' : rng.pick(ti >= 30 ? ['oak', 'oak', 'birch', 'pine'] : ['oak', 'birch', 'autumn']);
    const x = ti + rng.range(0.3, 0.7);
    const z = tj + rng.range(0.3, 0.7);
    const height = Math.round(rng.range(3.8, 5.4) * 10) / 10;
    const seed = rng.int(1, 999);
    if (placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < 1.6)) continue;
    placed.push([x, z]);
    addObject(level, 'tree', x, z, { opts: { kind, height, seed } });
  }
}
addObject(level, 'rock', 25.6, 12.4, { opts: { size: 0.9, seed: 21 } });
addObject(level, 'rock', 16.8, 18.6, { opts: { size: 0.6, seed: 5 } });

// ---- Surubin and the creatures ------------------------------------------------------------------
addObject(level, 'enemy', 21, 14.6, { kind: 'slime', count: 4, radius: 2.6, level: 1, name: 'Criatura da mata' });
level.objects[level.objects.length - 1].id = 'criaturas';

/** Surubin's look and name plate, the same on the coast road and in the camp. */
const SURUBIN = {
  name: 'Surubin', title: 'Adepto do Culto ao Baiacu Rei', preset: 'cleric',
  speed: 0.9, portraitColor: '#4fb3c9', dialogue: ['Que as marés nos guiem.'],
  spec: {
    head: 'catfish', skin: '#7f8f99', hair: '#4c5a66', hairStyle: 'bald', hat: 'none', eyes: 'gold', blush: false,
    outfit: { top: '#2e5d73', bottom: '#2e5d73', accent: 'cream', style: 'robe', shirt: '#e8dcc0' },
    weapon: 'staff', gear: { boots: '#5a4636', sash: '#c9b48a', staffGem: '#4fb3c9' },
  },
};
addObject(level, 'npc', 21, 15.2, {
  ...SURUBIN, facing: 'down', behaviour: 'post', wander: 0,
  talk: [
    'if party:surubin',
    '  cycle surubin-estrada',
    '    * Surubin: Que as marés nos guiem. E que guiem você também, cavaleiro, mesmo que você não acredite nelas.',
    '    * Surubin: O mar daqui tem outro cheiro. Mais verde. Mais... selvagem.',
    '    * Surubin: Na Capital dizem que esta terra engole homens. Eu prefiro acreditar que ela só tem fome de fé.',
    '    * Surubin: Eu sei usar o cajado. Quer dizer... eu sei segurar o cajado.',
    '  stop',
    'if resgatado',
    '  Surubin: O Rei das Profundezas mandou você, ${player}. Tenho certeza.',
    '  stop',
    'Surubin: Cuidado! Elas estão por toda parte!',
  ],
});
level.objects[level.objects.length - 1].id = 'surubin';

// (beside him, not in front: the camera looks north, a knight south of him would hide him)
addObject(level, 'marker', 19.6, 15.4, { name: 'diante-de-surubin', facing: 'right' });
addObject(level, 'marker', 15, 3.5, { name: 'estrada-norte', facing: 'up' });

// ---- the story ----------------------------------------------------------------------------------
// arrival: the cry for help from the clearing
addObject(level, 'event', 0, 0, {
  on: 'arrive', once: true, minX: 0, maxX: W, minZ: 0, maxZ: D,
  run: [
    'cutscene',
    'weather rain',
    'banner Estrada da Costa | Terra Selvagem',
    ': A estrada de terra segue a costa sob a tempestade. O vento traz sal, chuva e algo mais.',
    '"Uma voz": Ó Rei das Profundezas, me guarda! Socorro!',
    'camera surubin 1.5',
    'emote surubin ! 1.2',
    'wait 1.2',
    ': Um rapaz de vestes encharcadas, cercado por criaturas da mata, segura um cajado como quem nunca usou um.',
    'camera reset 1',
    'quest resgate start O resgate',
    'quest resgate stage cercado Salve o forasteiro cercado na clareira.',
  ],
});
// close to the clearing, the cry again (background: the player keeps moving)
addObject(level, 'event', 0, 0, {
  on: 'enter', once: true, background: true, if: 'not resgatado', minX: 13, maxX: 27, minZ: 8, maxZ: 21,
  run: ['bark surubin Aqui! Por favor!', 'emote surubin sweat 1.5'],
});
// the last creature falls: C01, the rescue
addObject(level, 'event', 0, 0, {
  on: 'cleared', group: 'criaturas', once: true, minX: 0, maxX: W, minZ: 0, maxZ: D,
  run: [
    'set resgatado',
    'cutscene',
    'wait 0.6',
    'teleport player diante-de-surubin right',
    'face surubin left',
    'camera surubin 1',
    // C01 (the Ato I notebook): the King thanked first, the knight second; the knight's answer,
    // ironic, dry or curious, and his name said for the first time
    'Surubin: Ó Rei das Profundezas, obrigado! Obrigado!',
    'emote surubin ... 1.2',
    'wait 1',
    'Surubin: E... obrigado a você também, cavaleiro.',
    'Surubin: Sou Surubin, adepto do Culto ao Baiacu Rei. Vim de Marina para trazer a fé a esta terra.',
    'choice',
    '  > Que bom que o seu deus te ajudou.',
    '    player: Prazer, Surubin. Sou ${player}. Que bom que o seu deus te ajudou.',
    '    emote surubin heart 1.2',
    '    Surubin: Ajudou! Ele mandou você, não mandou?',
    '  > Você segura esse cajado de cabeça para baixo.',
    '    player: ${player}. Você está segurando esse cajado de cabeça para baixo.',
    '    emote surubin sweat 1.2',
    '    Surubin: Ah. O Rei também manda lições, ${player}.',
    '  > Um deus peixe? Você atravessou o mar por isso?',
    '    player: ${player}. Um deus peixe? Você atravessou o mar por isso?',
    '    Surubin: Por Ele eu atravessaria dois.',
    'Surubin: Precisamos sair dessa chuva. Vi uma clareira subindo o riacho. Você vem?',
    'player: Até a chuva passar.',
    'party join surubin as mystic support',
    'quest resgate stage juntos Siga com Surubin pela estrada ao norte.',
    'camera reset 1',
  ],
});
// before the rescue the north road waits
addObject(level, 'event', 0, 0, {
  on: 'enter', if: 'not resgatado', minX: 12, maxX: 19, minZ: 0, maxZ: 3.5,
  run: [': Atrás de você, na clareira, alguém ainda grita por socorro.', 'walk player 15.5 6'],
});
// with Surubin, the road north: on to the clearing up the stream (the campfire, C02)
addObject(level, 'event', 0, 0, {
  on: 'enter', once: true, if: 'resgatado', minX: 12, maxX: 19, minZ: 0, maxZ: 3.5,
  run: [
    'cutscene',
    'face player up',
    'Surubin: A clareira fica subindo o riacho. Lá a gente acende um fogo e espera a tempestade passar.',
    'quest resgate done',
    `travel ${CLEARING_ID}`,
  ],
});

// ---- atmosphere, regions ------------------------------------------------------------------------
addObject(level, 'emitter', 4, 15, { preset: 'mist', size: [8, 2, 28], count: 26, dy: 0.6 });
addObject(level, 'emitter', 33, 15, { preset: 'leaves', size: [8, 4, 24], count: 22, dy: 3 });
addObject(level, 'emitter', 21, 15, { preset: 'fireflies', size: [8, 2, 8], count: 18, dy: 1 });
addObject(level, 'region', 0, 0, { name: 'Praia dos Destroços', sub: 'Estrada da Costa', minX: 0, maxX: 11, minZ: 0, maxZ: D });
addObject(level, 'region', 0, 0, { name: 'Clareira', sub: 'Estrada da Costa', minX: 16, maxX: 26, minZ: 10, maxZ: 20 });
addObject(level, 'region', 0, 0, { name: 'Estrada da Costa', sub: 'Terra Selvagem', minX: 0, maxX: W, minZ: 0, maxZ: D });

// (north of the border pines, which would stand between the camera and the knight)
level.spawn = { x: 15.5, z: 23.5, facing: 'up' };

// ---- output ------------------------------------------------------------------------------------

const PLACEMENT_KEYS = { point: ['x', 'z'], line: ['x0', 'z0', 'x1', 'z1'], rect: ['minX', 'maxX', 'minZ', 'maxZ'] };
const isPlain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Copy of `obj` with the keys in `lead` first (those it has, in that order), then the rest as they are.
 * @param {Record<string, any>} obj
 * @param {string[]} lead
 * @returns {Record<string, any>}
 */
function orderKeys(obj, lead) {
  const out = {};
  for (const k of lead) if (Object.hasOwn(obj, k)) out[k] = obj[k];
  for (const k of Object.keys(obj)) if (!Object.hasOwn(out, k)) out[k] = obj[k];
  return out;
}

/**
 * The canonical key order of an object line (as make-sample-hamlet.mjs): `id`, `type`, the position
 * keys, the catalog defaults in catalog order, then the other keys in the order this script sets them.
 * @param {LevelObject} o
 * @returns {LevelObject}
 */
function canonicalObject(o) {
  const def = OBJECT_TYPES[o.type];
  const out = orderKeys(o, ['id', 'type', ...PLACEMENT_KEYS[def.placement], ...Object.keys(def.defaults)]);
  for (const [k, d] of Object.entries(def.defaults)) {
    if (isPlain(d) && isPlain(out[k])) out[k] = orderKeys(out[k], Object.keys(d));
  }
  return /** @type {LevelObject} */ (out);
}

// =================================================================================================
// The clearing up the stream: C02 (the campfire) on the first night, then the camp
// =================================================================================================

/**
 * "Clareira do Riacho": a wide clearing in the woods with a stream down its east side — the camp of
 * Act I (the Ato I notebook, "O acampamento, o mapa e as obras"). The player arrives from the south
 * with Surubin (a party member); the story clears the sky (held), moves the clock on to the night and
 * plays C02 — the colony, the knight's disdain, the map and the strokes carved in stones, and his
 * answer (three choices, each remembered by a flag for Act II: `c02.estacao`, `c02.lar`,
 * `c02.jantar`). Then the morning of day 2: the screen fades, the clock moves on to 6:30 and
 * `acampamento` is set — the clear sky held until 11:00 — and the camp stands, laid out in areas: the fire in the middle, Surubin's tent
 * and the map table north, the banner east (the altar's place beside it, C03), three roped plots
 * south and west (forge, silo, lodging: the first building is chosen in C03) and the chapel's place
 * north-east (phase 4). Surubin shows the banner, the plots and his first sketch of the map, and
 * QP03 (the foundations) begins. No trail leaves the camp: travel is by Surubin's map (stage G1).
 */
function buildClearing() {
  const CW = 34;
  const CD = 28;
  const lv = createEmptyLevel({ name: 'Clareira do Riacho', width: CW, depth: CD, fill: 'g', level: 2, border: 2 });
  lv.subtitle = 'Terra Selvagem';
  lv.author = 'Culto ao Baiacu Rei';
  lv.description = 'Ato I: a clareira junto ao riacho. Na primeira noite, a fogueira (C02); na manhã seguinte, o acampamento.';
  // (the campaign's clock goes on from the coast road; the arrival moves it on to the night)
  lv.environment = { ...lv.environment, timeOfDay: 20.5, weatherPool: { clear: 70, rain: 30 } };
  const fillC = (i0, j0, i1, j1, ch, lvl) => {
    for (let j = j0; j < j1; j++) {
      for (let i = i0; i < i1; i++) {
        if (ch != null) setTile(lv, i, j, ch);
        if (lvl != null) setHeightLevel(lv, i, j, lvl);
      }
    }
  };
  /**
   * Add an object with a fixed id (a place the story names: `camera lote-forja`).
   * @param {import('../src/engine/level/types.js').ObjectType} type @param {number} x @param {number} z
   * @param {Record<string, any>} props @param {string} [id]
   */
  const put = (type, x, z, props, id) => {
    addObject(lv, type, x, z, props);
    if (id) lv.objects[lv.objects.length - 1].id = id;
  };
  // the stream down the east side (level 0) between grassy banks
  fillC(27, 0, 29, CD, 'o', 0);
  fillC(26, 2, 27, CD - 2, 'G');
  // (the far bank: the woods, no way across)
  fillC(29, 0, CW, CD, 'T');
  // the clearing: flower grass at its edge, the trampled ring around the fire, worn paths to the
  // tent and the plots, and the old trail from the south (scenery: the camp has no way out on foot)
  fillC(4, 4, 26, 26, 'f');
  fillC(5, 5, 25, 25, 'g');
  fillC(12, 12, 19, 19, 'd');
  for (let j = 10; j < 12; j++) for (let i = 14; i < 17; i++) setTile(lv, i, j, '.');
  for (let i = 9; i < 12; i++) { setTile(lv, i, 15, '.'); setTile(lv, i, 16, '.'); }
  for (let j = 19; j < CD; j++) { setTile(lv, 15, j, '.'); setTile(lv, 16, j, '.'); }
  // bare ground where the plots are staked (the tall grass would hide the ropes)
  fillC(6, 9, 11, 13, 'd');
  fillC(6, 17, 11, 21, 'd');
  fillC(18, 19, 25, 24, 'd');
  for (let i = 11; i < 15; i++) setTile(lv, i, 11, '.');
  for (let j = 18; j < 20; j++) setTile(lv, 18, j, '.');
  // the fire and two logs to sit on (C02)
  put('campfire', 15.5, 15.5, { rotation: 0.8, opts: { seat: false } });
  put('bench', 13.9, 15.7, { rotation: Math.PI / 2 });
  put('bench', 17.3, 15.1, { rotation: -Math.PI / 2 });
  put('crate', 18.1, 17.1, { rotation: 0.4, opts: { size: 0.6 } });
  put('rock', 24.6, 6.4, { opts: { size: 0.8, seed: 7 } });
  put('rock', 25.1, 21.4, { opts: { size: 0.6, seed: 12 } });
  put('rock', 5.4, 23.6, { opts: { size: 0.9, seed: 31 } });

  // ---- the camp (from the morning of day 2: `acampamento`) ----------------------------------------
  const CAMP = 'acampamento';
  // north: Surubin's tent, its door toward the fire, and the map table beside it; his crates
  put('tent', 15.5, 7.6, { rotation: 0, when: CAMP, opts: { stage: 'worn', seed: 3 } }, 'tenda-surubin');
  put('mapTable', 19.6, 9.6, {
    rotation: 0, when: CAMP,
    text: ['O mapa de Surubin: a costa, o riacho e a clareira marcada em vermelho. Três trilhas pontilhadas levam a nomes que ninguém daqui confirmou ainda.'],
  }, 'mesa-do-mapa');
  put('crate', 12.4, 8.2, { rotation: -0.3, when: CAMP, opts: { size: 0.7 } });
  put('barrel', 12.2, 9.4, { rotation: 0.5, when: CAMP, opts: { height: 0.9 } });
  // east: the banner of the Baiacu Rei; the altar rises beside it in C03
  put('banner', 22.4, 13.2, { rotation: 0, when: CAMP, opts: { stage: 'pole', seed: 2 } }, 'estandarte');
  put('marker', 22.4, 15.6, { name: 'altar', facing: 'down' });
  // south and west: the three plots of the first buildings (C03 chooses which comes first)
  put('stake', 8.2, 10.8, { rotation: 0, when: CAMP, opts: { kind: 'plot', width: 4, depth: 3.5, seed: 1 } }, 'lote-forja');
  put('stake', 8.2, 18.6, { rotation: 0, when: CAMP, opts: { kind: 'plot', width: 3.5, depth: 3.5, seed: 2 } }, 'lote-silo');
  put('stake', 21.4, 21.4, { rotation: 0, when: CAMP, opts: { kind: 'plot', width: 5, depth: 3.5, seed: 3 } }, 'lote-alojamento');
  // Surubin at home in the camp: he leaves the party on the morning of day 2 and stays here, free,
  // between his tent and the map table (hidden while the party holds him: the same id as on the
  // coast road, so the scripts name him alike)
  put('npc', 18.4, 11.2, {
    ...SURUBIN, facing: 'down', behaviour: 'wander', wander: 2.2, when: CAMP, unless: 'party:surubin',
    talk: [
      'cycle surubin-acampamento',
      '  * Surubin: Madeira da mata, pedra da encosta, comida do riacho. Com isso a gente ergue a primeira obra.',
      '  * Surubin: Quando você sair, eu fico aqui desenhando. Cada trilha que você andar entra no mapa.',
      '  * Surubin: O estandarte ficou bonito, não ficou? Azul como o mar de Marina.',
      '  * Surubin: À noite eu ouço a mata. Não sei se é bicho ou vento. Prefiro achar que é vento.',
    ],
  }, 'surubin');
  // north-east: the chapel's place (QP05, phase 4), left clear
  put('marker', 22.6, 7.4, { name: 'capela', facing: 'down' });
  // the woods around (none on the clearing, the trail or the strip south of it: the camera looks north)
  const rngC = new RNG(2207);
  const keep = (i, j) => (i >= 3 && i < 27 && j >= 3 && j < CD - 1) || (Math.abs(i - 15.5) < 2 && j >= 20) || i >= 26;
  /** @type {[number, number][]} */
  const trees = [];
  for (let j = 2; j < CD - 2; j += 2) {
    for (let i = 2; i < CW - 2; i += 2) {
      const ti = i + rngC.int(0, 1);
      const tj = j + rngC.int(0, 1);
      if (keep(ti, tj)) { rngC.next(); continue; }
      if (!rngC.chance(ti >= 21 ? 0.6 : 0.5)) continue;
      const x = ti + rngC.range(0.3, 0.7);
      const z = tj + rngC.range(0.3, 0.7);
      if (trees.some(([px, pz]) => Math.hypot(px - x, pz - z) < 1.6)) continue;
      trees.push([x, z]);
      addObject(lv, 'tree', x, z, { opts: { kind: rngC.pick(['oak', 'oak', 'birch', 'pine']), height: Math.round(rngC.range(3.8, 5.2) * 10) / 10, seed: rngC.int(1, 999) } });
    }
  }
  // where the two sit at the fire (the knight west of it, Surubin east: the camera sees both), and
  // where they stand on the morning after (the knight by the fire, Surubin at the banner)
  put('marker', 14.4, 16.4, { name: 'fogo-cavaleiro', facing: 'right' });
  put('marker', 16.7, 16.0, { name: 'fogo-surubin', facing: 'left' });
  put('marker', 19.2, 13.8, { name: 'manha-cavaleiro', facing: 'right' });
  put('marker', 21.2, 14.2, { name: 'manha-surubin', facing: 'left' });
  put('emitter', 15.5, 14.5, { preset: 'fireflies', size: [16, 2, 12], count: 24, dy: 1 });
  put('emitter', 28, 14, { preset: 'mist', size: [3, 1.5, 26], count: 16, dy: 0.4 });
  put('region', 0, 0, { name: 'Clareira do Riacho', sub: 'Terra Selvagem', minX: 0, maxX: CW, minZ: 0, maxZ: CD });
  // C02 on arriving with Surubin (the Ato I notebook), then the morning of day 2 and the camp
  put('event', 0, 0, {
    on: 'arrive', once: true, if: 'party:surubin', minX: 0, maxX: CW, minZ: 0, maxZ: CD,
    run: [
      'cutscene',
      'weather clear',
      'time 21',
      'banner Clareira do Riacho | Terra Selvagem',
      ': A tempestade passou. Sobre a clareira, o céu limpo se enche de estrelas.',
      // (the party takes its places after the arrival: Surubin is seated once it has)
      'wait 0.6',
      'teleport player fogo-cavaleiro right',
      'teleport surubin fogo-surubin left',
      'camera player 1.2',
      'wait 0.8',
      'Surubin: A Capital espera uma colônia. Um abrigo para os fiéis que virão. Sozinho, eu não consigo.',
      'player: Eu busco os segredos da espada. Não tenho tempo para os desejos de um deus que nem conheço.',
      'Surubin: Você não precisa acreditar no Rei. Só precisa acreditar que um teto é melhor que a estrada.',
      'player: Já dormi sob muitos tetos. Nenhum me ensinou nada.',
      'Surubin: Então deixa eu te oferecer outra coisa. Vou desenhar um mapa desta terra: cada trilha, cada ruína.',
      'Surubin: Os marinheiros dizem que os povos daqui riscam golpes de espada nas pedras. Se existir um segredo aqui, ele vai estar no meu mapa. E você vê primeiro.',
      ': O cavaleiro olha a fogueira por um tempo, cansado da longa jornada e de não avançar na busca.',
      'choice',
      '  > Uma estação. Depois, sigo meu caminho.',
      '    set c02.estacao',
      '    player: Uma estação. Depois, sigo meu caminho.',
      '    emote surubin ? 1.2',
      '    Surubin: Uma estação... Então o tempo dirá o caminho a ser seguido.',
      '  > Faz tempo que eu não tenho para onde voltar.',
      '    set c02.lar',
      '    player: Faz tempo que eu não tenho para onde voltar.',
      '    emote surubin heart 1.2',
      '    Surubin: Agora tem. O Rei acolhe aqueles que o seguem.',
      '  > Se o seu Rei mandar o jantar, eu fico.',
      '    set c02.jantar',
      '    player: Se o seu Rei mandar o jantar, eu fico.',
      '    emote surubin ! 1.2',
      '    Surubin: Cuidado com a língua, cavaleiro. O Rei provê, e proverá muito mais àqueles que o seguem.',
      'Surubin: Que as marés nos guiem.',
      // the morning of day 2 (the notebook: the first stake and the banner of the fish)
      'fade out 1.5',
      'time 7:30',
      `set ${CAMP}`,
      // Surubin stays in the camp from now on: a villager of this level, no longer a companion
      'party leave surubin',
      'wait 0.3',
      'teleport player manha-cavaleiro right',
      'teleport surubin manha-surubin left',
      'camera estandarte 0',
      'wait 0.5',
      'fade in 1.5',
      ': O sol nasce sobre a clareira. Onde ontem havia só a fogueira, agora tremula um estandarte azul.',
      'Surubin: Bom dia, ${player}! Veja: o estandarte do Rei. A primeira coisa de pé nesta terra.',
      'camera lote-forja 1.2',
      'Surubin: E ali, as primeiras estacas. Três lugares para as nossas primeiras obras.',
      'Surubin: O que vai em cada um a gente decide juntos, quando tiver madeira e pedra para isso.',
      'camera mesa-do-mapa 1.2',
      'emote surubin note 1.2',
      'Surubin: Passei a noite desenhando. Por enquanto é pouco: a costa, o riacho, a nossa clareira.',
      'Surubin: Mas os marinheiros falavam de uma mata a oeste, de juncos subindo o riacho e de uma pedreira na encosta. Madeira, comida e pedra. Tudo o que um começo precisa.',
      'player: E os golpes riscados nas pedras?',
      'Surubin: Quando eu ouvir falar deles, você vai ser o primeiro a saber. Prometido.',
      'camera reset 1',
      'quest alicerces start Os alicerces',
      'quest alicerces stage coletar Junte madeira, pedra e comida para a primeira obra do acampamento.',
    ],
  });
  // the first morning stays clear (the narration says the sun rises); the clearing's weather rolls
  // again from late morning on
  put('event', 0, 0, {
    on: 'time', at: 11, once: true, if: CAMP, background: true, minX: 0, maxX: CW, minZ: 0, maxZ: CD,
    run: ['weather auto'],
  });
  lv.spawn = { x: 15.5, z: CD - 3.5, facing: 'up' };
  return lv;
}

/**
 * A built level as its file text, keyed (`keyLevel`: the keys carried from its previous file),
 * with its problems added to `errors`.
 * @param {any} lv
 * @param {string} file the default path
 * @param {string[]} errors
 */
function levelText(lv, file, errors) {
  const { level: o, warnings: w } = normalizeLevel(lv);
  errors.push(...w.map((m) => `${file}: ${m}`));
  o.objects = o.objects.map(canonicalObject);
  keyLevel(o, { root, file });
  errors.push(...validateLevel(o).map((m) => `${file}: ${m}`), ...keyIssueLines(o).map((m) => `${file}: ${m}`));
  const t = serializeLevel(o);
  if (serializeLevel(parseLevel(t).level) !== t) errors.push(`${file}: the output does not re-serialise byte-identically (parseLevel → serializeLevel)`);
  return { text: t, level: o };
}

/** @type {string[]} */
const errors = [];
const warnings = [];
const { text, level: out } = levelText(level, FILE, errors);
const { text: clearingText, level: clearing } = levelText(buildClearing(), `${DIR}/${levelFile(CLEARING_ID)}`, errors);
// coverage: the camp types (`camp: true`) are this campaign's — Starfall Vale skips them, so the
// camp must place each one (TASK_PLAYBOOKS.md §0)
for (const t of Object.keys(OBJECT_TYPES).filter(isCampType)) {
  if (![out, clearing].some((l) => l.objects.some((o) => o.type === t))) errors.push(`coverage: no level of the campaign places the camp type "${t}"`);
}

// ---- the campaign ------------------------------------------------------------------------------
// the prologue (the coast road, C01) and the first night (the clearing, C02); a new journey opens
// with the character creation
const campaignRaw = {
  format: CAMPAIGN_FORMAT,
  version: 1,
  name: 'Culto ao Baiacu Rei',
  subtitle: 'Ato I: a Terra Selvagem',
  title: { title: 'CULTO AO BAIACU REI', subtitle: 'Ato I · A Terra Selvagem' },
  start: { level: LEVEL_ID, entrance: '' },
  levels: [{ id: LEVEL_ID }, { id: CLEARING_ID }],
  chapters: [],
  player: { create: true },
  // (Surubin only travels with the knight from the rescue to the camp: no tactics panel)
  party: { menu: false },
};
const campaignKeyed = structuredClone(campaignRaw);
carryCampaignText(previousOutput(root, `${DIR}/campaign.json`), campaignKeyed, seededMint(`${DIR}/campaign.json`));
for (const i of fileKeyIssues('campaign', campaignKeyed)) errors.push(`campaign.json: text keys: ${i.where}: ${i.msg}`);
const { campaign, warnings: cw, errors: ce } = normalizeCampaign(campaignKeyed);
errors.push(...cw.map((m) => `campaign.json: ${m}`), ...ce.map((m) => `campaign.json: ${m}`));

if (warnings.length || errors.length) {
  console.error([...warnings, ...errors].join('\n'));
  process.exit(1);
}
/** Each file of the campaign folder (relative to it) → its text. */
const files = new Map([['campaign.json', serializeCampaign(campaign)], [levelFile(LEVEL_ID), text], [levelFile(CLEARING_ID), clearingText]]);

if (args.check) {
  let stale = 0;
  for (const [f, t] of files) {
    const p = path.join(OUT_DIR, f);
    const rel = path.relative(root, p);
    const old = fs.existsSync(p) ? fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n') : null;
    if (old === t) console.log(`${rel} is up to date.`);
    else {
      stale++;
      console.error(old == null ? `${rel} does not exist.` : `${rel} differs from the generator output. Re-run without --check to rewrite it.`);
    }
  }
  process.exit(stale ? 1 : 0);
}

for (const [f, t] of files) {
  const p = path.join(OUT_DIR, f);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, t);
}
const s = levelStats(out);
console.log(`Culto ao Baiacu Rei → ${path.relative(root, OUT_DIR)}: campaign.json, ${levelFile(LEVEL_ID)} ${s.width}×${s.depth}, ${s.objects} objects, ${s.water} water tiles`, s.counts);
