/**
 * The pixel UI's building icons (docs/specs/PIXEL_UI.md §2): what the build window and a build
 * slot's floating sign show for a building of the story's `buildings` table (its `icon`, else its
 * `prop`; CAMPAIGN_FORMAT.md §4.3) — the camp's forge, silo, lodge and altar, and the empty plot.
 * 16 × 16 palette rows in G's style, palette keys as in icons/core.js; `itemIcon` finds them too.
 */
import { ICON_RAMPS } from './core.js';

/** @import { IconDef } from './core.js' */

const { MAIN, ACCENT, pal } = ICON_RAMPS;

/** @type {Record<string, IconDef>} */
export const BUILDING_ICONS = {
  // The forge: main the anvil, a b c the flame over it.
  forge: {
    palette: pal(MAIN.STEEL, ACCENT.FIRE),
    rows: [
      '................',
      '.......oo.......',
      '......ocbo......',
      '.....ocbbao.....',
      '.....obcbao.....',
      '......oaao......',
      '..oooooooooooo..',
      '.ohhllllllllldo.',
      '..oollllllmmdo..',
      '....ommmmmmdo...',
      '.....ommmmdo....',
      '.....ommmmdo....',
      '....ommmmmmdo...',
      '...oddddddddo...',
      '...oooooooooo...',
      '................',
    ],
  },
  // The silo: main the plank tower and its door, a b c the thatch roof.
  silo: {
    palette: pal(MAIN.WOOD, ACCENT.GOLD),
    rows: [
      '.......oo.......',
      '......obco......',
      '.....obbcco.....',
      '....obbbccco....',
      '...oabbbbccco...',
      '..oaabbbbbccco..',
      '..oooooooooooo..',
      '...ohllmmmmdo...',
      '...ohllmmmmdo...',
      '...ohlloommdo...',
      '...ohlloommdo...',
      '...ohlloommdo...',
      '...ohlloommdo...',
      '..oddddddddddo..',
      '..oooooooooooo..',
      '................',
    ],
  },
  // The lodge: main the log walls, a b c the thatch roof and the door.
  lodge: {
    palette: pal(MAIN.WOOD, ACCENT.GOLD),
    rows: [
      '................',
      '.......oo.......',
      '......obco......',
      '.....obbcco.....',
      '....obbbccco....',
      '...obbbbcccco...',
      '..obbbbbccccco..',
      '.oaaaaaaaaaaaao.',
      '..ohhhhhhhhhdo..',
      '..olllooolllmo..',
      '..ommmoaommmdo..',
      '..ohhhoaohhhdo..',
      '..ommmoaommmdo..',
      '..odddoaoddddo..',
      '..oooooooooooo..',
      '................',
    ],
  },
  // The altar: main the stone slab on its stones, a b c the salt stone on top.
  altar: {
    palette: pal(MAIN.STEEL, ACCENT.WIND),
    rows: [
      '................',
      '................',
      '.......oo.......',
      '......ocbo......',
      '.....ocbbao.....',
      '.....obbaao.....',
      '..oooooooooooo..',
      '.ohhhhhhhhhhhdo.',
      '.olllllllllllmo.',
      '.oddddddddddddo.',
      '..oolmo..olmoo..',
      '...olmo..olmo...',
      '...ommo..ommo...',
      '..oddddooddddo..',
      '..oooooooooooo..',
      '................',
    ],
  },
  // An empty plot: main the four stakes, a b c the rope between them and the ribbon.
  plot: {
    palette: pal(MAIN.WOOD, ACCENT.GOLD),
    rows: [
      '................',
      '................',
      '..oo........oo..',
      '.bom........om..',
      '..omccccccccom..',
      '..om........om..',
      '..od........od..',
      '..oo........oo..',
      '.oo..........oo.',
      '.om..........om.',
      '.omccccccccccom.',
      '.om..........om.',
      '.od..........od.',
      '.oo..........oo.',
      '................',
      '................',
    ],
  },
};

/** The building icon names (the build window's and the signs'; `itemIcon` falls back to them). */
export const BUILDING_ICON_NAMES = Object.freeze(Object.keys(BUILDING_ICONS));
