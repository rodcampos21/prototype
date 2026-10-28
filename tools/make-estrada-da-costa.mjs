#!/usr/bin/env node
/**
 * Builds the game's campaign `public/campaigns/culto-ao-baiacu-rei/` ("Culto ao Baiacu Rei"):
 * `campaign.json` (the title, a new journey's character creation: `player.create`) and its first
 * level `levels/estrada-da-costa.json` ("Estrada da Costa"), the prologue rescue (QP01 / scene C01
 * of the Ato I notebook). A dirt road runs north along the coast of the Terra Selvagem; on a
 * clearing beside it Surubin, a young catfish-folk adept of the Culto ao Baiacu Rei, is cornered by
 * forest creatures. The player (the wandering knight) clears the group; Surubin thanks the Baiacu
 * Rei first and the knight second, then joins the party (a mystic: weak with the staff, a healer).
 * Walking on north with him ends the test with an end card.
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
import { OBJECT_TYPES } from '../src/engine/level/ObjectCatalog.js';
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
const OUT_DIR = path.resolve(root, String(args.out ?? DIR));

const W = 40;
const D = 30;
const level = createEmptyLevel({ name: 'Estrada da Costa', width: W, depth: D, fill: 'g', level: 2, border: 2 });
level.subtitle = 'Terra Selvagem';
level.author = 'Culto ao Baiacu Rei';
level.description = 'Prólogo do Ato I: o cavaleiro errante encontra Surubin, adepto do Culto ao Baiacu Rei, cercado por criaturas da mata na estrada da costa.';
// (C01: a stormy afternoon — it rains from the arrival on; the clock and the weather are the game's)
level.environment = { ...level.environment, timeOfDay: 16.4, weather: 'rain' };

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

addObject(level, 'npc', 21, 15.2, {
  name: 'Surubin', title: 'Adepto do Culto ao Baiacu Rei', preset: 'cleric', facing: 'down', behaviour: 'post', wander: 0,
  speed: 0.9, portraitColor: '#4fb3c9', dialogue: ['Que as marés nos guiem.'],
  spec: {
    head: 'catfish', skin: '#7f8f99', hair: '#4c5a66', hairStyle: 'bald', hat: 'none', eyes: 'gold', blush: false,
    outfit: { top: '#2e5d73', bottom: '#2e5d73', accent: 'cream', style: 'robe', shirt: '#e8dcc0' },
    weapon: 'staff', gear: { boots: '#5a4636', sash: '#c9b48a', staffGem: '#4fb3c9' },
  },
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
// with Surubin, the road north: the end of the test (the campfire is the next scene, C02)
addObject(level, 'event', 0, 0, {
  on: 'enter', once: true, if: 'resgatado', minX: 12, maxX: 19, minZ: 0, maxZ: 3.5,
  run: [
    'cutscene',
    'face player up',
    'Surubin: A clareira fica subindo o riacho. Lá a gente acende um fogo e espera a tempestade passar.',
    'Surubin: Amanhã eu te conto da missão. Hoje... hoje eu só quero agradecer ao Rei por estar vivo.',
    'quest resgate done',
    'ending prologo Fim do teste: a estrada da costa',
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

const { level: out, warnings } = normalizeLevel(level);
out.objects = out.objects.map(canonicalObject);
keyLevel(out, { root, file: FILE });
const errors = [...validateLevel(out), ...keyIssueLines(out)];
const text = serializeLevel(out);
if (serializeLevel(parseLevel(text).level) !== text) errors.push('the output does not re-serialise byte-identically (parseLevel → serializeLevel)');

// ---- the campaign ------------------------------------------------------------------------------
// one level for now (the prologue); a new journey opens with the character creation
const campaignRaw = {
  format: CAMPAIGN_FORMAT,
  version: 1,
  name: 'Culto ao Baiacu Rei',
  subtitle: 'Ato I: a Terra Selvagem',
  title: { title: 'CULTO AO BAIACU REI', subtitle: 'Ato I · A Terra Selvagem' },
  start: { level: LEVEL_ID, entrance: '' },
  levels: [{ id: LEVEL_ID }],
  chapters: [],
  player: { create: true },
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
const files = new Map([['campaign.json', serializeCampaign(campaign)], [levelFile(LEVEL_ID), text]]);

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
