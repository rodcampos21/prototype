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
import { NIGHT_CONDITION } from '../src/game/campaign/AtlasFormat.js';
import { carryCampaignText, carryStoryFile, seededMint, fileKeyIssues } from '../src/engine/i18n/TextKeys.js';
import { buildStory, serializeStory, storyFile } from '../src/game/campaign/StoryFormat.js';
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
/** The first place on Surubin's map: the woods west of the camp. */
const MATA_ID = 'mata-da-clareira';
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
      '  * Surubin: Quando quiser sair, é só escolher um ponto no mapa, ali na mesa. Cada trilha que você andar entra no desenho.',
      '  * Surubin: O estandarte ficou bonito, não ficou? Azul como o mar de Marina.',
      '  * Surubin: À noite eu ouço a mata. Não sei se é bicho ou vento. Prefiro achar que é vento.',
    ],
  }, 'surubin');
  // north-east: the chapel's place (QP05, phase 4), left clear
  put('marker', 22.6, 7.4, { name: 'capela', facing: 'down' });
  // where a journey on the map ends: in front of the map table (Surubin's atlas, `entrance: mesa`)
  put('entrance', 19.6, 11.0, { name: 'mesa', facing: 'up' });
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
  // back from the woods for the first time: Surubin draws them on the map (the atlas's
  // `known: mata.desenhada`) — and the claw marks, when the knight found them
  put('event', 0, 0, {
    on: 'arrive', once: true, if: `visited:${MATA_ID} and not mata.desenhada`, minX: 0, maxX: CW, minZ: 0, maxZ: CD,
    run: [
      'cutscene',
      'wait 0.4',
      'face player right',
      'camera mesa-do-mapa 1',
      'emote surubin ! 1',
      'Surubin: Você voltou inteiro! Me conta da mata, que eu desenho enquanto você fala.',
      'emote surubin note 1.4',
      ': Surubin se debruça sobre a mesa e risca árvores velhas, o riacho com as duas pontes, as pedras musgosas e a clareira das flores.',
      'Surubin: Pronto. A Mata da Clareira está no mapa. Viu? Já parece um lugar de verdade.',
      'set mata.desenhada',
      'if toca.boato',
      '  player: Ao norte, um carvalho com marcas de garra. Fundas. A trilha some depois dele.',
      '  emote surubin sweat 1.2',
      '  Surubin: Marcas de garra desse tamanho? Vou pôr um ponto ali, com um ponto de interrogação bem grande.',
      '  Surubin: Toca das Bestas. Soa melhor do que deve ser.',
      '  set toca.desenhada',
      'camera reset 1',
    ],
  });
  // the crowned fish on the crate of the abandoned camp (a seed: a colony of the cult that no one
  // remembers — the Ato I notebook's old colonies)
  put('event', 0, 0, {
    on: 'arrive', once: true, if: 'mata.marca and mata.desenhada', minX: 0, maxX: CW, minZ: 0, maxZ: CD,
    run: [
      'cutscene',
      'wait 0.4',
      'camera surubin 1',
      'player: Na mata há um acampamento abandonado. Num caixote, um peixe de espinhos com uma coroa.',
      'emote surubin ? 1.4',
      'Surubin: Uma coroa? O Rei não usa coroa nos nossos estandartes. Nunca usou.',
      'Surubin: Nenhuma colônia do culto chegou tão longe. Pelo menos, não que a Capital saiba.',
      ': Surubin anota alguma coisa num canto do mapa e cobre com a mão.',
      'camera reset 1',
    ],
  });
  // the claw marks found on a later journey
  put('event', 0, 0, {
    on: 'arrive', once: true, if: 'toca.boato and mata.desenhada and not toca.desenhada', minX: 0, maxX: CW, minZ: 0, maxZ: CD,
    run: [
      'cutscene',
      'wait 0.4',
      'camera mesa-do-mapa 1',
      'player: Ao norte da mata, um carvalho com marcas de garra. Fundas. A trilha some depois dele.',
      'emote surubin sweat 1.2',
      'Surubin: Marcas de garra desse tamanho? Vou pôr um ponto ali, com um ponto de interrogação bem grande.',
      'Surubin: Toca das Bestas. Soa melhor do que deve ser.',
      'set toca.desenhada',
      'camera reset 1',
    ],
  });
  lv.spawn = { x: 15.5, z: CD - 3.5, facing: 'up' };
  return lv;
}

// =================================================================================================
// The first place on Surubin's map: the old woods west of the camp
// =================================================================================================

/** The night of the Terra Selvagem as a level condition (the night groups' `when`). */
const NIGHT = NIGHT_CONDITION;

/**
 * "Mata da Clareira": the old woods west of the camp, the first place on Surubin's map (the Ato I
 * notebook: wood and game; the Toca das Bestas appears on the map from here). A big map to explore
 * (100 × 84), its places joined by trails, open woods between them:
 * - south-east, the arrival: a glade with the stake and its red ribbon — Space there walks back to
 *   the camp (an hour each way);
 * - east, the Clareira das Flores, a meadow round a pond;
 * - the middle, the Bosque dos Carvalhos, old oaks spaced wide;
 * - a stream down the west third (the Riacho da Mata), crossed by two bridges, herbs on its banks;
 * - west, the Corte Antigo: stumps cut by axes long before the cult came (a seed for the old
 *   colonies), felled trunks;
 * - south-west, an abandoned camp: a torn tent, a cold fire pit, a crate with a forgotten mark;
 * - north-west, the Pedras Musgosas: mossy stone, good stone to break, seven stones in a ring with
 *   roots woven between them (a seed for the Povo da Raiz);
 * - north, the Trilha das Garras: an oak scored by claws, the trail lost toward the north —
 *   examining it puts the Toca das Bestas on the map as a rumour (`toca.boato`).
 * Resources everywhere (trees to chop, stone to break, herbs to pick: `resource`, each with its
 * spent twin; they grow back every morning). Chests in hidden corners appear at random on each
 * expedition, with a little gold. Foes (the forest creatures) spread through the woods by day, and
 * from 18:30 to 5:00 (`NIGHT`) many more, and stronger. The place counts as explored once the
 * creatures of the meadow were beaten and the claw marks found (`mata.explorada`).
 */
function buildMata() {
  const MW = 100;
  const MD = 84;
  const lv = createEmptyLevel({ name: 'Mata da Clareira', width: MW, depth: MD, fill: 'G', level: 2, border: 2 });
  lv.subtitle = 'Terra Selvagem';
  lv.author = 'Culto ao Baiacu Rei';
  lv.description = 'Ato I: a mata velha a oeste do acampamento, o primeiro lugar do mapa do Surubin. Madeira, pedra e ervas; criaturas espalhadas de dia e muito mais à noite.';
  lv.environment = { ...lv.environment, timeOfDay: 9, weatherPool: { clear: 60, rain: 40 } };
  const rng = new RNG(3301);
  /** Value noise in [0, 1) (the woods' density, the ground's patches). */
  const hash = (i, j, s) => {
    let h = (i * 374761393 + j * 668265263 + s * 2246822519) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const noise = (x, y, s) => {
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
    const a = hash(i, j, s), b = hash(i + 1, j, s), c = hash(i, j + 1, s), d = hash(i + 1, j + 1, s);
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
  };
  const tileAt = (i, j) => lv.tiles[j]?.[i];
  const inMap = (i, j) => i >= 2 && j >= 2 && i < MW - 2 && j < MD - 2;
  const setT = (i, j, ch, lvl) => {
    if (!inMap(i, j)) return;
    setTile(lv, i, j, ch);
    if (lvl != null) setHeightLevel(lv, i, j, lvl);
  };
  /** Paint an ellipse (centre, radii) with a tile; `edge` the tile of its rim (ragged by noise). */
  const blob = (cx, cz, rx, rz, ch, edge = null, lvl = null) => {
    for (let j = Math.floor(cz - rz - 1); j <= cz + rz + 1; j++) {
      for (let i = Math.floor(cx - rx - 1); i <= cx + rx + 1; i++) {
        const d = Math.hypot((i + 0.5 - cx) / rx, (j + 0.5 - cz) / rz) + (noise(i / 3, j / 3, 9) - 0.5) * 0.25;
        if (d <= 1) setT(i, j, edge && d > 0.8 ? edge : ch, lvl);
      }
    }
  };
  /**
   * @param {import('../src/engine/level/types.js').ObjectType} type @param {number} x @param {number} z
   * @param {Record<string, any>} props @param {string} [id]
   */
  const put = (type, x, z, props, id) => {
    addObject(lv, type, x, z, props);
    if (id) lv.objects[lv.objects.length - 1].id = id;
  };

  // ---- the places ----------------------------------------------------------------------------------
  const ARRIVAL = [80, 72];
  const MEADOW = [72, 40];
  const POND = [75, 40];
  const CUTTING = [21, 50];
  const OLD_CAMP = [17, 70];
  const STONES = [18, 19];
  const CLAWS = [53, 8];
  const OAKS = [56, 46];
  /** The stream's middle column at row j. */
  const streamAt = (j) => 38 + Math.round(2.5 * Math.sin(j / 9));
  const BRIDGES = [24, 58];

  // ---- terrain -------------------------------------------------------------------------------------
  // the ground: dark grass, lighter where the canopy opens, flowers and bare earth in patches
  for (let j = 2; j < MD - 2; j++) {
    for (let i = 2; i < MW - 2; i++) {
      const n = noise(i / 7, j / 7, 1);
      if (n > 0.72) setT(i, j, 'g');
      else if (n < 0.16 && noise(i / 3, j / 3, 2) > 0.5) setT(i, j, 'd');
      if (noise(i / 4, j / 4, 3) > 0.83) setT(i, j, 'f');
    }
  }
  blob(...ARRIVAL, 7, 5, 'g', 'f');
  blob(ARRIVAL[0], ARRIVAL[1] - 1, 3.5, 2.5, 'd');
  blob(...MEADOW, 11, 8, 'f', 'g');
  blob(...CUTTING, 9, 7, 'g', 'G');
  blob(CUTTING[0] - 1, CUTTING[1], 5, 3.5, 'd');
  blob(...OLD_CAMP, 7, 5, 'g', 'G');
  blob(OLD_CAMP[0], OLD_CAMP[1] - 1, 3, 2, 'd');
  blob(...STONES, 12, 8, 'm', 'g');
  blob(...CLAWS, 9, 4.5, 'g', 'G');
  blob(...OAKS, 6, 5, 'g');
  // rocky knots in the mossy stones (blocked)
  for (const [i, j] of [[10, 14], [11, 14], [10, 15], [25, 13], [26, 13], [13, 24], [24, 24], [25, 24], [8, 19], [28, 19]]) setT(i, j, 'x');
  // the pond in the meadow (level 1, still water)
  blob(...POND, 3.6, 2.6, 'o', null, 1);
  // the stream: water (level 0) between sandy banks (level 1), all the way down the map
  for (let j = 0; j < MD; j++) {
    const c = streamAt(j);
    for (let i = c - 2; i <= c + 2; i++) {
      const bank = Math.abs(i - c) === 2;
      setTile(lv, i, j, bank ? 's' : '~');
      setHeightLevel(lv, i, j, bank ? 1 : 0);
    }
  }

  // ---- the trails: 2 tiles wide, from the arrival to every place -----------------------------------
  /** @type {[number, number][]} every trail tile (for keeping trees off them) */
  const trailTiles = [];
  /** @param {[number, number][]} pts */
  const trail = (pts) => {
    for (let k = 1; k < pts.length; k++) {
      const [ax, az] = pts[k - 1];
      const [bx, bz] = pts[k];
      const n = Math.ceil(Math.hypot(bx - ax, bz - az) * 2);
      for (let s = 0; s <= n; s++) {
        const t = s / n;
        const x = ax + (bx - ax) * t + (noise((ax + bx) * t, k, 4) - 0.5) * 1.2;
        const z = az + (bz - az) * t;
        for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          const i = Math.floor(x) + di - 1;
          const j = Math.floor(z) + dj - 1;
          const ch = tileAt(i, j);
          if (!inMap(i, j) || ch === '~' || ch === 's' || ch === 'o' || ch === 'x') continue;
          setTile(lv, i, j, '.');
          trailTiles.push([i, j]);
        }
      }
    }
  };
  const wB = streamAt(BRIDGES[0]);
  const sB = streamAt(BRIDGES[1]);
  trail([[ARRIVAL[0], ARRIVAL[1] + 1], [72, 66], [62, 60], [sB + 5, BRIDGES[1] + 0.5]]);
  trail([[sB - 4, BRIDGES[1] + 0.5], [28, 55], [CUTTING[0] + 3, CUTTING[1]]]);
  trail([[62, 60], [OAKS[0], OAKS[1]], [56, 34], [54, 22], [CLAWS[0], CLAWS[1] + 2]]);
  trail([[OAKS[0], OAKS[1]], [MEADOW[0] - 6, MEADOW[1] + 2]]);
  trail([[54, 24], [wB + 5, BRIDGES[0] + 0.5]]);
  trail([[wB - 4, BRIDGES[0] + 0.5], [28, 22], [STONES[0] + 4, STONES[1] + 2]]);
  trail([[CUTTING[0], CUTTING[1] + 3], [19, 60], [OLD_CAMP[0], OLD_CAMP[1] - 2]]);
  trail([[CUTTING[0] - 2, CUTTING[1] - 4], [20, 36], [STONES[0], STONES[1] + 6]]);
  trail([[MEADOW[0] + 4, MEADOW[1] - 6], [80, 26], [84, 16]]);
  // the bridges over the stream
  for (const [k, j] of BRIDGES.entries()) {
    const c = streamAt(j);
    put('bridge', c - 3.6, j + 0.5, { x1: c + 4.6, z1: j + 0.5, opts: { width: 2.2, arch: 0.25 } }, `ponte-${k + 1}`);
  }

  // ---- what is kept clear of trees ------------------------------------------------------------------
  const trailSet = new Set(trailTiles.map(([i, j]) => `${i},${j}`));
  /** The camera looks north: nothing tall on a trail, just beside it, or a few rows south of it. */
  const nearTrail = (x, z) => {
    for (let dj = -2; dj <= 4; dj++) for (let di = -2; di <= 2; di++) if (trailSet.has(`${Math.floor(x) + di},${Math.floor(z) + dj}`)) return true;
    return false;
  };
  const inPlace = (x, z) => (Math.abs(x - ARRIVAL[0]) < 12 && z > ARRIVAL[1] - 3)
    || /** @type {[number[], number, number][]} */ ([[ARRIVAL, 7.5, 6.5], [MEADOW, 10, 7.5], [CUTTING, 8, 6], [OLD_CAMP, 6.5, 5], [STONES, 9, 6], [CLAWS, 7, 4], [OAKS, 3, 3]])
      .some(([[cx, cz], rx, rz]) => Math.hypot((x - cx) / rx, (z - cz) / rz) < 1);
  const wet = (x, z) => Math.abs(x - 0.5 - streamAt(Math.floor(z))) < 3.6 || Math.hypot((x - POND[0]) / 5, (z - POND[1]) / 4) < 1;
  /** @type {[number, number, number][]} what stands (x, z, radius): nothing may crowd it */
  const taken = [];
  const free = (x, z, r) => taken.every(([px, pz, pr]) => Math.hypot(px - x, pz - z) >= r + pr);
  const tileOk = (x, z) => {
    const ch = tileAt(Math.floor(x), Math.floor(z));
    return inMap(Math.floor(x), Math.floor(z)) && ch !== '~' && ch !== 's' && ch !== 'o' && ch !== 'x' && ch !== '.' && ch !== 'T';
  };

  // ---- the arrival: the stake with the ribbon, the way back to the camp ------------------------------
  put('stake', ARRIVAL[0], ARRIVAL[1] - 1.6, { rotation: 0, opts: { kind: 'mast', seed: 4 } }, 'estaca-volta');
  put('exit', 0, 0, { minX: ARRIVAL[0] - 1.1, maxX: ARRIVAL[0] + 1.1, minZ: ARRIVAL[1] - 2.6, maxZ: ARRIVAL[1] - 0.6, to: CLEARING_ID, entrance: 'mesa', mode: 'use', label: 'Voltar ao acampamento' });
  put('entrance', ARRIVAL[0], ARRIVAL[1] + 0.6, { name: 'chegada', facing: 'up' });
  put('crate', ARRIVAL[0] + 2.4, ARRIVAL[1] - 0.4, { rotation: 0.5, opts: { size: 0.55 } });
  taken.push([ARRIVAL[0], ARRIVAL[1], 4]);

  // ---- the old cutting: stumps of an old felling, trunks, the examined stumps ----------------------
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const d = rng.range(2.5, 6);
    const x = CUTTING[0] + Math.cos(a) * d * 1.2;
    const z = CUTTING[1] + Math.sin(a) * d * 0.8;
    if (!tileOk(x, z) || !free(x, z, 1.2)) continue;
    put('resource', x, z, { rotation: rng.range(0, 6), opts: { kind: 'tree', stage: 'spent', seed: 100 + k } });
    taken.push([x, z, 1.4]);
  }
  put('event', 0, 0, {
    on: 'use', label: 'Examine', minX: CUTTING[0] - 3, maxX: CUTTING[0] + 3, minZ: CUTTING[1] - 2, maxZ: CUTTING[1] + 2,
    run: [
      ': Tocos cortados a machado, cobertos de musgo. Os cortes são retos e antigos.',
      ': Alguém tirou madeira daqui muito antes do Surubin chegar a esta terra.',
    ],
  });

  // ---- the abandoned camp: a torn tent, a cold fire pit, a forgotten crate ---------------------------
  put('tent', OLD_CAMP[0] - 1.5, OLD_CAMP[1] - 2.2, { rotation: 0.35, opts: { stage: 'worn', seed: 9 } }, 'tenda-abandonada');
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    put('rock', OLD_CAMP[0] + 2.4 + Math.cos(a) * 0.65, OLD_CAMP[1] + 0.8 + Math.sin(a) * 0.65, { opts: { size: 0.22, seed: 200 + k } });
  }
  put('crate', OLD_CAMP[0] + 4.2, OLD_CAMP[1] - 1.6, { rotation: 0.9, opts: { size: 0.7 } }, 'caixote-marcado');
  put('barrel', OLD_CAMP[0] + 4.6, OLD_CAMP[1] + 0.4, { rotation: 1.3, opts: { height: 0.9, lying: true } });
  put('fence', OLD_CAMP[0] - 5, OLD_CAMP[1] + 3, { x1: OLD_CAMP[0] - 1.5, z1: OLD_CAMP[1] + 4 });
  taken.push([OLD_CAMP[0], OLD_CAMP[1], 5]);
  put('event', 0, 0, {
    on: 'use', label: 'Examine', minX: OLD_CAMP[0] + 2.8, maxX: OLD_CAMP[0] + 5.6, minZ: OLD_CAMP[1] - 3, maxZ: OLD_CAMP[1] - 0.4,
    run: [
      ': Uma tenda velha, rasgada de cima a baixo. O fogo ao lado está frio há muitas estações.',
      ': No caixote, uma marca queimada na madeira: um peixe de espinhos, igual ao do estandarte, mas com uma coroa que o Surubin não desenha.',
      'if not mata.marca',
      '  set mata.marca',
      '  toast Algo para mostrar ao Surubin: um caixote com a marca do Rei.',
    ],
  });

  // ---- the mossy stones: seven stones in a ring, roots woven between them ----------------------------
  const RING = [STONES[0] - 3, STONES[1] - 2];
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    put('rock', RING[0] + Math.cos(a) * 2.6, RING[1] + Math.sin(a) * 2.1, { opts: { size: 0.55, seed: 300 + k } });
  }
  taken.push([RING[0], RING[1], 3.6]);
  put('event', 0, 0, {
    on: 'use', label: 'Examine', minX: RING[0] - 1.6, maxX: RING[0] + 1.6, minZ: RING[1] - 1.2, maxZ: RING[1] + 1.2,
    run: [
      ': Sete pedras em roda, gastas pelo tempo. Ninguém as pôs aqui por acaso.',
      ': No meio, raízes trançadas no chão formam um desenho. Parece feito de propósito.',
    ],
  });

  // ---- the north: the claw-marked oak and the trail lost in the dark ---------------------------------
  put('tree', CLAWS[0] + 0.6, CLAWS[1] - 2.4, { opts: { kind: 'oak', height: 6.4, seed: 77 } }, 'carvalho-das-garras');
  taken.push([CLAWS[0] + 0.6, CLAWS[1] - 2.4, 2]);
  put('event', 0, 0, {
    on: 'use', label: 'Examine', minX: CLAWS[0] - 1, maxX: CLAWS[0] + 2.2, minZ: CLAWS[1] - 2, maxZ: CLAWS[1] + 0.6,
    run: [
      ': Marcas fundas de garra descem o tronco de um carvalho velho. Há pelos escuros presos na casca.',
      ': Adiante, a trilha some entre as árvores, rumo ao norte. O cheiro é de bicho grande.',
      'if not toca.boato',
      '  set toca.boato',
      '  toast Algo para contar ao Surubin: marcas de garra ao norte da mata.',
    ],
  });
  for (const [x, z, s, seed] of [[CLAWS[0] - 3, CLAWS[1] - 1, 0.7, 61], [CLAWS[0] + 4, CLAWS[1] - 1.6, 0.9, 62], [CLAWS[0] - 6, CLAWS[1] + 1.4, 0.5, 63]]) {
    put('rock', x, z, { opts: { size: s, seed } });
    taken.push([x, z, s + 0.6]);
  }

  // ---- resources: trees to chop, stone to break, herbs to pick (each with its spent twin) ----------
  let nRes = 0;
  /**
   * A resource and its spent twin, `id` 'arvore-03' … ; the flag gathering sets: res.mata.<id>.
   * @param {'tree'|'stone'|'herbs'} kind @param {number} x @param {number} z
   */
  const resource = (kind, x, z) => {
    const r = kind === 'tree' ? 1.6 : kind === 'stone' ? 1.2 : 0.8;
    if (!tileOk(x, z) || !free(x, z, r)) return false;
    nRes++;
    const id = `${kind === 'tree' ? 'arvore' : kind === 'stone' ? 'pedra' : 'erva'}-${String(nRes).padStart(2, '0')}`;
    const flag = `res.mata.${id}`;
    const item = kind === 'tree' ? 'madeira' : kind === 'stone' ? 'pedra' : 'ervas';
    const seed = 400 + nRes;
    const rotation = Math.round(rng.range(0, 6.28) * 100) / 100;
    const opts = kind === 'tree'
      ? { kind, tree: rng.pick(['birch', 'oak', 'birch', 'pine']), height: Math.round(rng.range(3.4, 4.3) * 10) / 10, seed }
      : { kind, seed };
    put('resource', x, z, { rotation, item, amount: kind === 'herbs' ? 1 : 2, hits: kind === 'tree' ? 3 : kind === 'stone' ? 4 : 1, flag, unless: flag, opts: { ...opts, stage: 'full' } }, id);
    put('resource', x, z, { rotation, item, flag, when: flag, opts: { ...opts, stage: 'spent' } }, `${id}-gasto`);
    // (trodden earth round a tree or a stone worth working: it reads from afar, and its stump or
    // rubble does not drown in the tall grass)
    if (kind !== 'herbs') for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1]]) if (tileOk(x + di, z + dj)) setTile(lv, Math.floor(x) + di, Math.floor(z) + dj, 'd');
    taken.push([x, z, r]);
    return true;
  };
  /** Up to `n` of a kind round (cx, cz) within (rx, rz), off the trails. */
  const scatter = (kind, n, cx, cz, rx, rz, tries = 60) => {
    for (let k = 0, made = 0; k < tries && made < n; k++) {
      const a = rng.range(0, Math.PI * 2);
      const d = Math.sqrt(rng.next());
      const x = Math.round((cx + Math.cos(a) * rx * d) * 10) / 10;
      const z = Math.round((cz + Math.sin(a) * rz * d) * 10) / 10;
      if (nearTrail(x, z) && kind === 'tree') continue;
      if (trailSet.has(`${Math.floor(x)},${Math.floor(z)}`)) continue;
      if (resource(kind, x, z)) made++;
    }
  };
  // trees: in groves along the trails and round the glades
  scatter('tree', 5, 62, 64, 9, 6);
  scatter('tree', 5, 50, 40, 9, 9);
  scatter('tree', 4, 60, 26, 8, 8);
  scatter('tree', 4, 80, 52, 8, 6);
  scatter('tree', 4, 30, 44, 6, 9);
  scatter('tree', 4, 26, 64, 6, 6);
  scatter('tree', 3, 44, 14, 7, 6);
  scatter('tree', 3, 86, 22, 6, 7);
  // stone: the mossy stones, the claws, the stream's rocks
  scatter('stone', 8, STONES[0] + 2, STONES[1], 10, 6);
  scatter('stone', 3, CLAWS[0], CLAWS[1] + 3, 8, 3);
  scatter('stone', 3, 44, 70, 5, 5);
  scatter('stone', 2, 66, 30, 5, 4);
  // herbs: along the stream's banks, the meadow, the old camp
  for (let j = 8; j < MD - 8; j += 6) {
    const c = streamAt(j);
    resource('herbs', c + (j % 12 < 6 ? -4.2 : 5.2), Math.round((j + rng.range(-1, 1)) * 10) / 10);
  }
  scatter('herbs', 6, MEADOW[0], MEADOW[1], 9, 6);
  scatter('herbs', 3, OLD_CAMP[0], OLD_CAMP[1] + 3, 5, 3);
  scatter('herbs', 3, CUTTING[0], CUTTING[1] - 3, 7, 4);

  // ---- chests: hidden in corners, there at random on each expedition, a little gold ------------------
  const CHESTS = [[90, 66], [86, 34], [66, 12], [34, 6], [8, 32], [8, 58], [30, 78], [50, 78], [46, 30], [28, 36], [92, 50], [70, 76]];
  CHESTS.forEach(([x, z], k) => {
    let cx = x, cz = z;
    for (let t = 0; t < 12 && !(tileOk(cx, cz) && free(cx, cz, 1)); t++) { cx = x + rng.range(-3, 3); cz = z + rng.range(-3, 3); }
    cx = Math.round(cx * 10) / 10;
    cz = Math.round(cz * 10) / 10;
    put('chest', cx, cz, { rotation: Math.round(rng.range(0, 6.28) * 100) / 100, gold: 30 + 5 * (k % 3), potions: 0, upgrade: 'none', chance: 0.4 }, `bau-${String(k + 1).padStart(2, '0')}`);
    taken.push([cx, cz, 1.2]);
  });

  // ---- the foes: the forest creatures, spread by day; many more and stronger at night --------------
  /** @type {[string, number, number, number, number][]} */
  const DAY = [
    ['criaturas-clareira', MEADOW[0] - 2, MEADOW[1] + 3, 3, 2], ['criaturas-bosque', 50, 50, 3, 1], ['criaturas-corte', CUTTING[0] + 2, CUTTING[1] + 2, 3, 1],
    ['criaturas-pedras', STONES[0] + 5, STONES[1] + 3, 3, 2], ['criaturas-garras', CLAWS[0] - 2, CLAWS[1] + 3, 3, 2], ['criaturas-acampamento', OLD_CAMP[0] + 3, OLD_CAMP[1] + 2, 3, 2],
    ['criaturas-riacho-norte', 44, 12, 2, 1], ['criaturas-riacho-sul', 31, 66, 2, 1], ['criaturas-leste', 86, 46, 3, 1], ['criaturas-nordeste', 80, 18, 3, 2],
  ];
  for (const [id, x, z, count, level] of DAY) {
    put('enemy', x, z, { kind: 'slime', count, radius: 3, level, name: 'Criatura da mata' }, id);
  }
  const NIGHT_GROUPS = [
    [66, 64], [58, 52], [70, 46], [62, 34], [52, 18], [44, 40], [28, 50], [22, 26], [14, 62], [32, 72], [86, 30], [90, 60], [76, 8], [44, 62],
  ];
  NIGHT_GROUPS.forEach(([x, z], k) => {
    put('enemy', x, z, { kind: 'slime', count: 3 + (k % 3), radius: 3.2, level: 2 + (k % 2), elite: k % 3 === 0, name: 'Criatura da noite', when: NIGHT }, `noite-${String(k + 1).padStart(2, '0')}`);
  });

  // ---- the woods: old oaks spaced wide, pines on the stones, birches by the water ------------------
  for (let j = 3; j < MD - 3; j += 2) {
    for (let i = 3; i < MW - 3; i += 2) {
      const x = Math.round((i + rng.range(-0.8, 0.8)) * 10) / 10;
      const z = Math.round((j + rng.range(-0.8, 0.8)) * 10) / 10;
      const density = 0.18 + 0.62 * noise(x / 11, z / 11, 5);
      if (rng.next() > density) continue;
      if (!tileOk(x, z) || nearTrail(x, z) || inPlace(x, z) || wet(x, z)) continue;
      const big = noise(x / 6, z / 6, 6) > 0.55;
      if (!free(x, z, big ? 1.5 : 1.15)) continue;
      const stony = Math.hypot((x - STONES[0]) / 16, (z - STONES[1]) / 12) < 1;
      const kind = stony ? rng.pick(['pine', 'pine', 'oak']) : wet(x - 3, z) || wet(x + 3, z) ? rng.pick(['birch', 'birch', 'oak']) : rng.pick(['oak', 'oak', 'oak', 'autumn', 'birch', 'pine']);
      put('tree', x, z, { opts: { kind, height: Math.round(rng.range(big ? 5.2 : 4.2, big ? 6.4 : 5.2) * 10) / 10, seed: rng.int(1, 999) } });
      taken.push([x, z, big ? 1.3 : 1]);
    }
  }
  // fallen trunks and boulders in the woods
  for (let k = 0; k < 14; k++) {
    const x = rng.range(6, MW - 6);
    const z = rng.range(6, MD - 6);
    if (!tileOk(x, z) || nearTrail(x, z) || wet(x, z) || inPlace(x, z) || !free(x, z, 1.4)) continue;
    if (k % 2) put('bench', Math.round(x * 10) / 10, Math.round(z * 10) / 10, { rotation: Math.round(rng.range(0, 3.14) * 100) / 100 });
    else put('rock', Math.round(x * 10) / 10, Math.round(z * 10) / 10, { opts: { size: Math.round(rng.range(0.5, 1.1) * 10) / 10, seed: 500 + k } });
    taken.push([x, z, 1.2]);
  }

  // ---- atmosphere, regions ------------------------------------------------------------------------
  put('emitter', 50, 42, { preset: 'leaves', size: [90, 4, 76], count: 90, dy: 3.4 });
  put('emitter', MEADOW[0], MEADOW[1], { preset: 'fireflies', size: [18, 2, 14], count: 30, dy: 1 });
  put('emitter', 38, 42, { preset: 'fireflies', size: [8, 2, 70], count: 34, dy: 0.8 });
  put('emitter', 38, 42, { preset: 'mist', size: [5, 1.5, 76], count: 26, dy: 0.4 });
  put('emitter', CLAWS[0], CLAWS[1], { preset: 'mist', size: [16, 1.5, 6], count: 16, dy: 0.4 });
  put('emitter', CUTTING[0], CUTTING[1], { preset: 'dust', size: [14, 2, 10], count: 12, dy: 1.2 });
  put('region', 0, 0, { name: 'Clareira das Flores', sub: 'Mata da Clareira', minX: MEADOW[0] - 11, maxX: MEADOW[0] + 11, minZ: MEADOW[1] - 8, maxZ: MEADOW[1] + 8 });
  put('region', 0, 0, { name: 'Corte Antigo', sub: 'Mata da Clareira', minX: CUTTING[0] - 9, maxX: CUTTING[0] + 9, minZ: CUTTING[1] - 7, maxZ: CUTTING[1] + 7 });
  put('region', 0, 0, { name: 'Acampamento Abandonado', sub: 'Mata da Clareira', minX: OLD_CAMP[0] - 7, maxX: OLD_CAMP[0] + 7, minZ: OLD_CAMP[1] - 5, maxZ: OLD_CAMP[1] + 5 });
  put('region', 0, 0, { name: 'Pedras Musgosas', sub: 'Mata da Clareira', minX: STONES[0] - 12, maxX: STONES[0] + 12, minZ: STONES[1] - 8, maxZ: STONES[1] + 8 });
  put('region', 0, 0, { name: 'Trilha das Garras', sub: 'Mata da Clareira', minX: CLAWS[0] - 9, maxX: CLAWS[0] + 9, minZ: 2, maxZ: CLAWS[1] + 5 });
  put('region', 0, 0, { name: 'Riacho da Mata', sub: 'Mata da Clareira', minX: 33, maxX: 44, minZ: 0, maxZ: MD });
  put('region', 0, 0, { name: 'Bosque dos Carvalhos', sub: 'Mata da Clareira', minX: 44, maxX: 66, minZ: 26, maxZ: 62 });
  put('region', 0, 0, { name: 'Mata da Clareira', sub: 'Terra Selvagem', minX: 0, maxX: MW, minZ: 0, maxZ: MD });

  // ---- the story -------------------------------------------------------------------------------------
  // the first arrival: the woods, the stake that leads home
  put('event', 0, 0, {
    on: 'arrive', once: true, minX: 0, maxX: MW, minZ: 0, maxZ: MD,
    run: [
      'cutscene',
      'banner Mata da Clareira | Terra Selvagem',
      ': Árvores velhas fecham o céu. O ar é úmido e cheira a musgo e a bicho.',
      'camera estaca-volta 1',
      ': Um mastro com o peixe do Rei numa flâmula vermelha marca a trilha de volta ao acampamento. Dá para vê-lo de longe.',
      ': Há madeira para cortar, pedra para quebrar e ervas para colher. Eles brilham entre as árvores, e o mapa marca cada um. O que for tirado hoje volta a crescer amanhã.',
      'camera reset 1',
    ],
  });
  // an arrival at night: the woods are another place
  put('event', 0, 0, {
    on: 'arrive', if: NIGHT, background: true, minX: 0, maxX: MW, minZ: 0, maxZ: MD,
    run: ['toast A mata à noite é outra. Muitos olhos entre as árvores.'],
  });
  // the meadow's creatures beaten; the place explored once the claw marks are found too
  put('event', 0, 0, { on: 'cleared', group: 'criaturas-clareira', minX: 0, maxX: MW, minZ: 0, maxZ: MD, run: ['set mata.criaturas'] });
  put('event', 0, 0, {
    on: 'change', once: true, if: 'mata.criaturas and toca.boato', minX: 0, maxX: MW, minZ: 0, maxZ: MD,
    run: ['set mata.explorada', 'toast A Mata da Clareira foi explorada. O Surubin vai querer ouvir tudo.'],
  });
  lv.spawn = { x: ARRIVAL[0], z: ARRIVAL[1] + 0.6, facing: 'up' };
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
const { text: mataText, level: mata } = levelText(buildMata(), `${DIR}/${levelFile(MATA_ID)}`, errors);
// coverage: the camp types (`camp: true`) are this campaign's — Starfall Vale skips them, so the
// camp must place each one (TASK_PLAYBOOKS.md §0)
for (const t of Object.keys(OBJECT_TYPES).filter(isCampType)) {
  if (![out, clearing, mata].some((l) => l.objects.some((o) => o.type === t))) errors.push(`coverage: no level of the campaign places the camp type "${t}"`);
}

// ---- Surubin's map (the atlas) -------------------------------------------------------------------
// The Terra Selvagem as Surubin draws it on the table (100 × 60 map units, north up): the sea to the
// west and the coast road along it, the stream down from the hills to the camp and on to the sea,
// the woods west of the camp (drawn once he has heard of them from the knight: `mata.desenhada`).
// The places: the camp; the Mata da Clareira (the first journey, an hour away); the reeds up the
// stream and the quarry on the slope, rumours with no road yet (M3); the Toca das Bestas, a rumour
// once the claw marks were told (`toca.desenhada`).
// the journey card's lines (the notebook, *Cena de viagem*): the way to the woods, the way home by
// day and by night
const ROAD_MATA = ['A trilha deixa o riacho e entra na sombra das árvores.', 'O cheiro da fogueira fica para trás. Na frente, só musgo.'];
const ROAD_HOME = ['Entre as árvores, aparece o estandarte azul.', 'O riacho conhecido. Falta pouco.'];
const ROAD_HOME_NIGHT = ['A fogueira do acampamento brilha no escuro. O Surubin deixou ela acesa.'];
const atlas = {
  title: 'O mapa do Surubin',
  subtitle: 'Terra Selvagem',
  home: CLEARING_ID,
  entrance: 'mesa',
  places: [
    {
      id: 'acampamento', name: 'Clareira do Riacho', x: 60, y: 34, icon: 'camp', level: CLEARING_ID,
      notes: { rumor: 'A clareira do riacho. O estandarte do Rei já tremula aqui.' },
    },
    {
      id: MATA_ID, name: 'Mata da Clareira', x: 41, y: 27, icon: 'forest', level: MATA_ID, entrance: 'chegada', hours: 1,
      known: 'mata.desenhada', explored: 'mata.explorada', yields: ['Madeira', 'Pedra', 'Ervas'],
      notes: {
        rumor: 'Os marinheiros falam de uma mata velha a oeste daqui. Madeira boa, e caça.',
        known: 'Carvalhos velhos, um riacho com duas pontes, pedras musgosas e uma clareira de flores. A trilha some ao norte.',
        explored: 'Já conhecemos cada trilha dela. À noite, porém, ninguém volta igual.',
      },
      road: { there: ROAD_MATA, back: ROAD_HOME, night: ROAD_HOME_NIGHT },
    },
    {
      id: 'riacho-dos-juncos', name: 'Riacho dos Juncos', x: 81, y: 22, icon: 'reeds', hours: 2, yields: ['Comida', 'Ervas'],
      notes: { rumor: 'Subindo o riacho, dizem, os juncos crescem mais alto que um homem. Peixe e ervas.' },
      road: {
        there: ['Rio acima, o barulho da água cresce entre os juncos.', 'As botas afundam na lama da margem.'],
        back: ROAD_HOME, night: ROAD_HOME_NIGHT,
      },
    },
    {
      id: 'pedreira-da-encosta', name: 'Pedreira da Encosta', x: 75, y: 9, icon: 'quarry', hours: 2, yields: ['Pedra', 'Minério'],
      notes: { rumor: 'Uma pedreira antiga na encosta. Pedra para as obras. Quem será que a cortou primeiro?' },
      road: {
        there: ['A subida pela encosta é íngreme. Lá em cima, o vento muda.', 'Lascas de pedra estalam sob as botas.'],
        back: ROAD_HOME, night: ROAD_HOME_NIGHT,
      },
    },
    {
      id: 'toca-das-bestas', name: 'Toca das Bestas', x: 33, y: 8, icon: 'den', hours: 2, rumor: 'toca.desenhada', yields: ['Couro', 'Osso'],
      notes: { rumor: 'Marcas de garra num carvalho, ao norte da mata. De noite, ouço uivos de lá.' },
    },
  ],
  sketch: [
    // the sea and its shore; the Baiacu Rei watching over it; the way home to Marina
    { kind: 'sea', points: [[0, 0], [16, 0], [18, 8], [15, 17], [17, 27], [14, 38], [17, 48], [15, 60], [0, 60]] },
    { kind: 'coast', points: [[16, 0], [18, 8], [15, 17], [17, 27], [14, 38], [17, 48], [15, 60]] },
    { kind: 'fish', at: [8, 21] },
    { kind: 'label', at: [8, 54], name: 'Rumo a Marina' },
    // the coast road the knight came by, and Surubin's boat on the beach
    { kind: 'road', points: [[25, 60], [24, 50], [22, 41], [23, 30], [25, 20], [24, 10], [23, 0]] },
    { kind: 'wreck', at: [19.5, 46] },
    { kind: 'label', at: [30, 56], name: 'Estrada da Costa' },
    // the stream from the hills past the camp to the sea
    { kind: 'river', points: [[96, 6], [88, 13], [81, 19], [72, 26], [65, 31], [57, 35], [46, 38], [34, 39], [24, 40], [15, 41]] },
    // the hills of the slope (seen from the camp)
    { kind: 'hills', points: [[64, 2], [94, 1], [97, 13], [84, 15], [70, 14], [63, 9]] },
    // the woods around the clearing, and the old woods west of it once drawn
    { kind: 'forest', points: [[52, 24], [70, 25], [72, 32], [69, 45], [56, 47], [50, 41], [53, 33]] },
    { kind: 'forest', points: [[29, 14], [47, 12], [52, 22], [50, 34], [44, 36], [31, 35], [27, 25]], when: 'mata.desenhada' },
    { kind: 'label', at: [81, 31], name: 'Riacho' },
  ],
};

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
  levels: [{ id: LEVEL_ID }, { id: CLEARING_ID }, { id: MATA_ID }],
  chapters: [],
  player: { create: true },
  // (Surubin only travels with the knight from the rescue to the camp: no tactics panel)
  party: { menu: false },
  atlas,
  // the backpack (Caderno, *Coleta em várias expedições*: about 4 expeditions per building — 8 a
  // trip, to balance; the silo doubles it) and the knight's basic gear (*O equipamento do cavaleiro*)
  inventory: {
    pack: 8,
    grow: [{ when: 'obra.silo', pack: 16 }],
    equipment: { weapon: 'espada-de-viagem', body: 'cota-de-viagem', head: 'elmo-amassado', hands: 'luvas-de-couro', feet: 'botas-de-estrada' },
  },
  story: ['main.json'],
};

// ---- story/main.json: the items (what the resources give, in the backpack; the knight's gear) ----
const STORY_MAIN = {
  // the buildings' flags the campaign reads before C03 sets them (the silo doubles the backpack)
  vars: { 'obra.silo': 0 },
  items: {
    madeira: { name: 'Madeira', text: 'Toras cortadas na mata. A base de qualquer obra do acampamento.', pack: true, icon: 'wood' },
    pedra: { name: 'Pedra', text: 'Pedra boa, quebrada dos veios claros das rochas. Para alicerces e paredes.', pack: true, icon: 'stone' },
    ervas: { name: 'Ervas', text: 'Folhas e flores miúdas que crescem perto da água. O Surubin diz que curam, se o Rei quiser.', pack: true, icon: 'herbs' },
    // (shown in the inventory's slots; equipping and the bonuses come later)
    'espada-de-viagem': { name: 'Espada de viagem', text: 'Uma espada simples, de lâmina reta. Já viu mais estrada do que batalha.', icon: 'sword', slot: 'weapon', bonus: { atk: 2 } },
    'cota-de-viagem': { name: 'Cota de viagem', text: 'Couro e anéis de ferro, remendados mais de uma vez.', icon: 'armor', slot: 'body', bonus: { def: 2 } },
    'elmo-amassado': { name: 'Elmo amassado', text: 'Um elmo simples, com um amassado do lado esquerdo que ninguém lembra de onde veio.', icon: 'helm', slot: 'head', bonus: { def: 1 } },
    'luvas-de-couro': { name: 'Luvas de couro', text: 'Gastas nos dedos de tanto segurar rédea e espada.', icon: 'gloves', slot: 'hands', bonus: { def: 1 } },
    'botas-de-estrada': { name: 'Botas de estrada', text: 'Solas grossas, feitas para andar. E andaram.', icon: 'boots', slot: 'feet', bonus: { def: 1 } },
  },
  quests: {
    // QP01 (the coast road) and QP03 (the camp's first building); the scripts write the same texts
    resgate: {
      title: 'O resgate',
      text: 'Alguém grita por socorro na estrada da costa.',
      stages: [
        { id: 'cercado', text: 'Salve o forasteiro cercado na clareira.' },
        { id: 'juntos', text: 'Siga com Surubin pela estrada ao norte.' },
      ],
    },
    alicerces: {
      title: 'Os alicerces',
      text: 'O acampamento precisa da sua primeira obra.',
      stages: [{ id: 'coletar', text: 'Junte madeira, pedra e comida para a primeira obra do acampamento.' }],
    },
  },
};
const storyMain = structuredClone(STORY_MAIN);
carryStoryFile(previousOutput(root, `${DIR}/${storyFile('main.json')}`), storyMain, seededMint(`${DIR}/${storyFile('main.json')}`));
for (const i of fileKeyIssues('story', storyMain)) errors.push(`${storyFile('main.json')}: text keys: ${i.where}: ${i.msg}`);
const storyText = serializeStory(storyMain);
errors.push(...buildStory([{ name: 'main.json', text: storyText }]).warnings.map((m) => `story: ${m}`));
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
const files = new Map([['campaign.json', serializeCampaign(campaign)], [levelFile(LEVEL_ID), text], [levelFile(CLEARING_ID), clearingText], [levelFile(MATA_ID), mataText], [storyFile('main.json'), storyText]]);

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
