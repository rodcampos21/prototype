/**
 * The pixel UI's item icons (docs/specs/PIXEL_UI.md §2): what a story item shows in the inventory
 * window and the resource bar (`icon` in the story files: CAMPAIGN_FORMAT.md §4.2) — the gathered
 * resources, the backpack and the equipment, one per slot. 16 × 16 palette rows in G's style,
 * palette keys as in icons/core.js. `itemIcon` also finds the core icons (`coin`, `chest`, `key` …);
 * an unknown name gives the core gem.
 */
import { ICON_RAMPS, CORE_ICONS, iconCanvas } from './core.js';
import { COMBAT_ICONS } from './combat.js';

/** @import { IconDef, IconOptions } from './core.js' */

const { MAIN, ACCENT, pal } = ICON_RAMPS;

/** @type {Record<string, IconDef>} */
export const ITEM_ICONS = {
  // Wood: main the bark, a b c the cut end's rings (c the sapwood, a the heart).
  wood: {
    palette: pal(MAIN.WOOD, ACCENT.WOOD),
    rows: [
      '................',
      '................',
      '................',
      '..oooooooooooooo',
      '.ocbbcohhhhhhhlo',
      'ocbaabcollllllmo',
      'ocbaabcollllmlmo',
      'ocbabbcommmlmmmo',
      'ocbaabcommmmmmdo',
      'ocbbabcommdmmmdo',
      '.ocbbcoddddddddo',
      '..oooooooooooooo',
      '................',
      '................',
      '................',
      '................',
    ],
  },
  // Stone: main the rock, w the glint.
  stone: {
    palette: pal(MAIN.STEEL, ACCENT.STEEL),
    rows: [
      '................',
      '................',
      '................',
      '......oooo......',
      '....oohhllo.....',
      '...ohhwlllmoo...',
      '..ohllllllmmmo..',
      '..ohllllmmmmdmo.',
      '.ohlllmmmmmmddo.',
      '.olllmmmmmmdddo.',
      '.olmmmmmmmddddo.',
      '.ommmmmmdddddo..',
      '..odddddddddo...',
      '...ooooooooo....',
      '................',
      '................',
    ],
  },
  // Herbs: main the leaves and stems; a b c the flowers.
  herbs: {
    palette: pal(MAIN.GREEN, ICON_RAMPS.ACCENT_ROSE),
    rows: [
      '................',
      '......oo........',
      '.....ocbo..oo...',
      '.....obao.ocbo..',
      '..oo..oo..obao..',
      '.ohlo..om..oo...',
      '.olmmo.om.oo....',
      '..ommo.omolo.oo.',
      '...oomoomolmohlo',
      '.....omomomlmmo.',
      '..ooo.ommmoooo..',
      '.ohllooomoo.....',
      '..oddmmomo......',
      '....oooddo......',
      '.......oo.......',
      '................',
    ],
  },
  // Food (berries): main the stem and leaf; a b c the berries (c their shine).
  food: {
    palette: pal(MAIN.GREEN, ACCENT.RED),
    rows: [
      '................',
      '.........oo.....',
      '........ohlo....',
      '.......ohlmo....',
      '......om.oo.....',
      '..ooo.om..ooo...',
      '.obcbo.mo.obcbo.',
      '.occbaomo.occba.',
      '.obbbao.ooobbba.',
      '..oaaooobcboaao.',
      '...oo.occbbo.o..',
      '......obbbao....',
      '......oabaao....',
      '.......oooo.....',
      '................',
      '................',
    ],
  },
  // The backpack: main the leather; a b c the buckle.
  pack: {
    palette: pal(MAIN.LEATHER, ACCENT.GOLD),
    rows: [
      '................',
      '......oooo......',
      '.....om..mo.....',
      '..oooooooooooo..',
      '..ohhhllllllmo..',
      '..ohllllllllmo..',
      '..olmmmmmmmmdo..',
      '..oddddcbddddo..',
      '..olmmmabmmmdo..',
      '..olmmmmmmmmdo..',
      '..olmmmmmmmmdo..',
      '..olmmmmmmmmdo..',
      '..oddddddddddo..',
      '..oooooooooooo..',
      '................',
      '................',
    ],
  },
  // The weapon slot: main the blade; a b c the hilt (a the grip) — the combat set's sword.
  sword: {
    palette: pal(MAIN.STEEL, ACCENT.GOLD),
    rows: [
      '..............o.',
      '.............oho',
      '............ohmo',
      '...........ohmo.',
      '..........olmo..',
      '.........olmo...',
      '....oo..olmo....',
      '...obcoolmo.....',
      '....obclmo......',
      '.....obco.......',
      '....oabbco......',
      '...oaboobco.....',
      '.ooabo..oo......',
      'ocboo...........',
      'obao............',
      '.oo.............',
    ],
  },
  // The body slot: main the mail; a b c the belt.
  armor: {
    palette: pal(MAIN.STEEL, ACCENT.WOOD),
    rows: [
      '................',
      '...oo......oo...',
      '..ohlo....ohmo..',
      '.ohllooooooolmo.',
      'ohlllhlllllllmdo',
      'ollmmlllllllmmdo',
      '.oomllhlllllmoo.',
      '...ollmlmlmldo..',
      '...olmlmlmlmdo..',
      '...ocbbbbbbbao..',
      '...olmmmmmmmdo..',
      '...olmmlmmlmdo..',
      '...olmmmmmmmdo..',
      '...ooooooooooo..',
      '................',
      '................',
    ],
  },
  // The head slot: main the helm, o its visor slit.
  helm: {
    palette: pal(MAIN.STEEL, ACCENT.STEEL),
    rows: [
      '................',
      '................',
      '.....oooooo.....',
      '....ohhwllmo....',
      '...ohhlllllmo...',
      '..ohllllllllmo..',
      '..ohllllllllmdo.',
      '..ollllllllmmdo.',
      '..olmooooooomdo.',
      '..ollmmmmmmmmdo.',
      '..ollmmmlmmmddo.',
      '..olmdo...omddo.',
      '..oooo....ooooo.',
      '................',
      '................',
      '................',
    ],
  },
  // The hands slot: main the glove; a b c the cuff.
  gloves: {
    palette: pal(MAIN.LEATHER, ACCENT.WOOD),
    rows: [
      '................',
      '....oo.oo.oo....',
      '...ohlohlohlo...',
      '...ohlohlohlo...',
      '...ohlohlohlooo.',
      '...ohllhllhlohlo',
      '...ohllllllllhlo',
      '...olllllllllmo.',
      '...olmllllllmmo.',
      '...ommmmmmmmmdo.',
      '....ommmmmmmdo..',
      '...ocbbbbbbbbao.',
      '...oabbbbbbbaao.',
      '...oooooooooooo.',
      '................',
      '................',
    ],
  },
  // The feet slot: main the boot; a b c the strap.
  boots: {
    palette: pal(MAIN.LEATHER, ACCENT.WOOD),
    rows: [
      '................',
      '................',
      '....oooooo......',
      '....ohhllo......',
      '....ohllmo......',
      '....ocbbao......',
      '....ohllmo......',
      '....ohllmo......',
      '....ohllmooo....',
      '....ohlllllmoo..',
      '...oohllllllmmo.',
      '...olllllllllmdo',
      '...oddddddddddo.',
      '...oooooooooooo.',
      '................',
      '................',
    ],
  },
  // The accessory slot: main the band; a b c the stone.
  ring: {
    palette: pal(MAIN.GOLD, ACCENT.BLUE),
    rows: [
      '................',
      '................',
      '......oooo......',
      '.....ocbbco.....',
      '......oaao......',
      '....oooooooo....',
      '...ohhllllmmo...',
      '..ohlooooooldo..',
      '..olo......odo..',
      '..olo......odo..',
      '..olo......odo..',
      '..omlo....oddo..',
      '...ommooooddo...',
      '....oddddddo....',
      '.....oooooo.....',
      '................',
    ],
  },
};

/** An empty equipment slot's icon (shown dim): slot → icon. */
export const SLOT_ICONS = Object.freeze({ weapon: 'sword', body: 'armor', head: 'helm', hands: 'gloves', feet: 'boots', accessory: 'ring' });

/**
 * An item icon's canvas: an item icon, else a core one, else a combat one (the Healing Draught's
 * `draught`), else the core gem.
 * @param {string} name
 * @param {IconOptions} [o]
 * @returns {HTMLCanvasElement}
 */
export function itemIcon(name, o) {
  const own = (/** @type {Record<string, IconDef>} */ t) => (name && Object.prototype.hasOwnProperty.call(t, name) ? t[name] : null);
  return iconCanvas(own(ITEM_ICONS) ?? own(CORE_ICONS) ?? own(COMBAT_ICONS) ?? CORE_ICONS.gem, o);
}
