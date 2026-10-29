// Type-check only (tsconfig.json, `npm run typecheck`); nothing here reaches a bundle.
// - Module augmentation for src/engine/ui: fields created lazily (`this._x ??= …`) or by another
//   module, which the class body cannot declare without a runtime change.
// - The story UI's data shapes (Journal.setData, the emote icons, the toast kinds).
import 'lil-gui';

declare module 'lil-gui' {
  interface Controller {
    /**
     * DebugPanel.syncListening: set while the panel is hidden on a controller that was
     * `listen()`ing, so showing the panel again restarts exactly those controllers.
     */
    _luPaused?: boolean;
  }
}

// -------------------------------------------------------------------------------------------------
// Story UI (Journal, Emotes, EndCard; created by UI.useStoryUI)
// -------------------------------------------------------------------------------------------------

/** The journal's tabs ('codex' only when the data carries a Códex). */
export type JournalTab = 'quests' | 'items' | 'codex';

/** An objective of a quest: shown with a box, ticked (and struck through) once `done`. */
export interface JournalGoal {
  text: string;
  done: boolean;
}

/**
 * A quest in the journal. `log`: the texts of the stages reached, latest last (the latest is
 * highlighted). `title` falls back to the id; a missing or unknown `state` is 'active'.
 */
export interface JournalQuest {
  id: string;
  title?: string;
  state?: 'active' | 'done' | 'failed';
  text?: string;
  log?: string[];
  goals?: JournalGoal[];
}

/**
 * An item in the journal. `key`: a key item (its own group first; no count unless > 1). `name`
 * falls back to the id; `count` defaults to 1.
 */
export interface JournalItem {
  id: string;
  name?: string;
  count?: number;
  text?: string;
  key?: boolean;
}

/** A row of a Códex page: a stat at level 1 and what it gains per level ('' none), or a drop. */
export interface JournalCodexRow {
  label: string;
  value: string;
  growth?: string;
}

/**
 * A page of the Códex (the bestiary tab; the game's combat/codex.js builds them, translated). A
 * locked page shows its number, "????" and the picture as a silhouette; an unlocked one its name,
 * the picture, the text, the stats with their growth, the drops and the defeated count.
 */
export interface JournalCodexEntry {
  /** the enemy kind */
  id: string;
  /** the number shown (padded to 4 digits: 0001) */
  no: number;
  unlocked?: boolean;
  name?: string;
  /** the portrait (an idle frame of the enemy's sheet); drawn as a silhouette while locked */
  image?: HTMLCanvasElement | null;
  text?: string;
  stats?: JournalCodexRow[];
  drops?: JournalCodexRow[];
  /** defeated so far */
  kills?: number;
}

/**
 * `Journal.setData(…)`. Untrusted (built from story files): every field is optional, wrong shapes
 * are dropped, every text is set with `textContent` (`{word}` renders in gold).
 */
export interface JournalData {
  quests?: JournalQuest[];
  items?: JournalItem[];
  /** shown on the Items tab */
  gold?: number;
  /** the Códex tab's pages, in number order; absent: no Códex tab (a level without combat) */
  codex?: JournalCodexEntry[];
}

/**
 * The icons `Emotes.show` draws (the values of the story language's `EMOTES`; '...' is taken as
 * '…'). Any other string is drawn as text (at most 4 characters).
 */
export type EmoteIcon = '!' | '?' | '…' | '♪' | '♥' | 'zzz' | '#' | '💧' | '✦';

/** `HUD.toast(text, seconds, { kind })`. */
export type ToastKind = 'quest' | 'item' | 'error';

// -------------------------------------------------------------------------------------------------
// Party UI (PartyPanel, PartyFrames; created by UI.usePartyUI — the contract types are in
// src/game/party/types.d.ts: PartyPanelLike, PartyFramesLike, PartyFrameEntry …)
// -------------------------------------------------------------------------------------------------

/**
 * The tactics panel's sounds (`PartyPanel.onSound`): `menuOpen` / `menuClose` (it opened / closed),
 * `menuMove` (the focus moved to another row or card), `menuSelect` (a change: a value, a preset
 * picked, another member shown). The game maps them to its SFX (AudioSystem: `open`, `close`,
 * `blip`, `confirm`).
 */
export type PartySound = 'menuOpen' | 'menuClose' | 'menuMove' | 'menuSelect';

/**
 * A map marker state's party (`Minimap.update(s)` / `WorldMap.update(dt, s)`): `s.party`, the
 * members' live positions — teal dots with a light rim, over the villagers, under the player's
 * arrow. Absent or empty: the maps draw exactly what they drew before.
 */
export type MapPartyDots = ReadonlyArray<{ x: number; z: number }>;

// -------------------------------------------------------------------------------------------------
// The atlas (AtlasScreen; created by UI.useAtlas)
// -------------------------------------------------------------------------------------------------

/** A feature of the sketch as the screen draws it (map units; already filtered by the story). */
export interface AtlasSketchFeature {
  kind: string;
  points?: [number, number][];
  at?: [number, number];
  /** a label's text, translated */
  name?: string;
}

/** What `atlasSheet` paints: the sheet's size in art px, the map's size in units, the features. */
export interface AtlasSheetSpec {
  w: number;
  h: number;
  size: [number, number];
  sketch: AtlasSketchFeature[];
  seed?: number;
}

/** A place on the map as the screen shows it (texts translated). */
export interface AtlasViewPlace {
  id: string;
  name: string;
  x: number;
  y: number;
  icon: string;
  state: 'rumor' | 'known' | 'explored' | 'home';
  /** the state's word ('Boato', 'Descoberto' …) */
  stateLabel: string;
  /** the cartographer's note ('' none) */
  note: string;
  /** what is found there ([] none or not known yet) */
  yields: string[];
  /** the journey's lines ('1 h de caminhada', 'Chegada às 9:30'); [] for the camp */
  travel: string[];
  /** a warning under the journey (arriving at night) — '' none */
  warn: string;
  /** can the player travel there from here */
  go: boolean;
  /** why not, when `go` is false ('' none: the camp) */
  why: string;
}

/** AtlasScreen.open()'s data. */
export interface AtlasView {
  title: string;
  subtitle: string;
  /** the clock line ('Dia 2 · 7:45') and the day's progress (0–1, midnight to midnight) */
  clock: string;
  dayFrac: number;
  size: [number, number];
  sketch: AtlasSketchFeature[];
  places: AtlasViewPlace[];
  /** the place selected at first (the last one travelled to, else the first not the camp) */
  selected?: string;
  texts: { travel: string; close: string; choose: string; journey: string; yields: string; note: string; here: string; unknown: string };
}
