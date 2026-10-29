/**
 * A campaign's atlas (docs/specs/CAMPAIGN_FORMAT.md §4.1): the hand-drawn map the player travels by
 * from one table in the hub level (the `mapTable` object there) — the places on it, the sketch of
 * the land drawn so far and how long each journey takes. A place's state is never saved apart: it is
 * read from the story every time the map opens (a condition for the rumour, the visit for the
 * sketch, a condition for the mark of a place explored).
 *
 * Node-safe and import-light: CampaignFormat normalises the `atlas` field with it, the game reads
 * the states with `placeState`. The file is untrusted data like the rest of the campaign.
 */

/**
 * The night of the Terra Selvagem (the Bíblia, *A noite*): from 18:30 until 5:00 the places have
 * more foes, and stronger. Levels write it as a condition (`NIGHT_CONDITION`) on their night groups;
 * the atlas warns of an arrival in it.
 */
export const NIGHT_FROM = 18.5;
export const NIGHT_UNTIL = 5;
export const NIGHT_CONDITION = `hour >= ${NIGHT_FROM} or hour < ${NIGHT_UNTIL}`;
/** Is hour `h` (0–24) night? @param {number} h */
export const isNightHour = (h) => h >= NIGHT_FROM || h < NIGHT_UNTIL;

/** The sketch's default size, in map units (the screen scales it). */
export const ATLAS_SIZE = Object.freeze([100, 60]);

/**
 * What a sketch feature draws: `sea` a filled shore (polygon), `coast` the shore line, `road` a
 * dashed track, `river` a stream (thicker toward its last point), `forest` trees inside a polygon,
 * `hills` hachured slopes inside a polygon, `reeds` reeds inside a polygon, `label` a name at a
 * point, `fish` the Baiacu Rei drawn in the sea, `wreck` a boat marked with a cross.
 */
export const SKETCH_KINDS = Object.freeze(['sea', 'coast', 'road', 'river', 'forest', 'hills', 'reeds', 'label', 'fish', 'wreck']);
/** The kinds drawn at one point (`at`); the rest take `points` (a polygon or a line). */
const POINT_KINDS = new Set(['label', 'fish', 'wreck']);
/** The polygons (three points at least); the lines take two. */
const AREA_KINDS = new Set(['sea', 'forest', 'hills', 'reeds']);

/** The icons a place is drawn with. */
export const PLACE_ICONS = Object.freeze(['camp', 'forest', 'reeds', 'quarry', 'den', 'ruin']);

/** The states of a place on the map: hidden (not drawn), rumour (dashed), known (drawn), explored (sealed); the hub is `home`. */
export const PLACE_STATES = Object.freeze(['hidden', 'rumor', 'known', 'explored', 'home']);

/**
 * @typedef {object} AtlasFeature
 * @property {string} kind      one of SKETCH_KINDS
 * @property {[number, number][]} [points]  map units (a polygon or a line)
 * @property {[number, number]} [at]       map units (label, fish, wreck)
 * @property {string} [name]    a label's text (a term: translated by itself)
 * @property {string} [when]    drawn only while this story condition holds ('' always)
 */

/**
 * @typedef {object} AtlasPlace
 * @property {string} id
 * @property {string} name     a term (translated by itself)
 * @property {number} x        map units
 * @property {number} y
 * @property {string} icon     one of PLACE_ICONS
 * @property {string} level    the campaign level it travels to ('' no road yet: shown, not travelled)
 * @property {string} entrance where the player arrives there ('' the level's player start)
 * @property {number} hours    the journey from the hub, each way (0–12)
 * @property {string} rumor    drawn (dashed) only while this holds ('' always)
 * @property {string} known    drawn in ink while this holds ('' `visited:<level>`)
 * @property {string} explored sealed while this holds ('' never)
 * @property {string[]} yields what is found there (terms), shown once the place is known
 * @property {{ rumor?: string, known?: string, explored?: string }} notes  the cartographer's note
 *   for each state (terms); a state without one shows the one before it
 * @property {AtlasRoad} road  the lines of the journey card (terms), one shown per journey
 */

/**
 * The lines the journey card shows on the way (one per journey, in turn): `there` going to the
 * place, `back` coming home from it, `night` coming home at night (else `back`).
 * @typedef {{ there: string[], back: string[], night: string[] }} AtlasRoad
 */

/** The parts of a road, in the file's order. */
const ROAD_PARTS = /** @type {const} */ (['there', 'back', 'night']);

/**
 * @typedef {object} Atlas
 * @property {string} title
 * @property {string} subtitle
 * @property {string} home      the hub level: its `mapTable` opens the map; returns arrive there
 * @property {string} entrance  where a return arrives in the hub ('' its player start)
 * @property {[number, number]} size  map units
 * @property {AtlasFeature[]} sketch
 * @property {AtlasPlace[]} places
 */

const text = (v) => (typeof v === 'string' ? v.trim() : '');
const isPlain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const isPt = (p) => Array.isArray(p) && p.length === 2 && p.every(num);
const ID = /^[a-z0-9][a-z0-9-]{0,59}$/;
/** Round to a tenth of a map unit (the file stays short and stable). */
const r1 = (v) => Math.round(v * 10) / 10;

/**
 * The atlas of a campaign file, cleaned (null: none), with a warning for each thing dropped.
 * @param {unknown} raw the file's `atlas`
 * @param {Set<string>} levels the campaign's level ids
 * @param {string[]} warnings
 * @returns {Atlas|null}
 */
export function normalizeAtlas(raw, levels, warnings) {
  if (raw == null) return null;
  if (!isPlain(raw)) { warnings.push('"atlas" must be an object — ignored'); return null; }
  const a = /** @type {Record<string, any>} */ (raw);
  const home = text(a.home);
  if (!levels.has(home)) { warnings.push(`atlas.home "${home}" is not one of the campaign's levels — the atlas is ignored`); return null; }
  /** @type {[number, number]} */
  const size = isPt(a.size) && a.size[0] > 0 && a.size[1] > 0 ? [a.size[0], a.size[1]] : [ATLAS_SIZE[0], ATLAS_SIZE[1]];
  if (a.size != null && !isPt(a.size)) warnings.push('atlas.size must be [width, height] — the default used');
  const inside = (p) => [r1(Math.min(size[0], Math.max(0, p[0]))), r1(Math.min(size[1], Math.max(0, p[1])))];

  /** @type {AtlasFeature[]} */
  const sketch = [];
  for (const [k, f] of (Array.isArray(a.sketch) ? a.sketch : []).entries()) {
    const kind = isPlain(f) ? text(f.kind) : '';
    if (!SKETCH_KINDS.includes(kind)) { warnings.push(`atlas.sketch[${k}]: unknown kind "${kind}" — dropped`); continue; }
    /** @type {AtlasFeature} */
    const out = { kind };
    if (POINT_KINDS.has(kind)) {
      if (!isPt(f.at)) { warnings.push(`atlas.sketch[${k}] (${kind}) needs "at": [x, y] — dropped`); continue; }
      out.at = /** @type {[number, number]} */ (inside(f.at));
      if (kind === 'label') {
        const name = text(f.name);
        if (!name) { warnings.push(`atlas.sketch[${k}]: a label needs a "name" — dropped`); continue; }
        out.name = name;
      }
    } else {
      const pts = (Array.isArray(f.points) ? f.points : []).filter(isPt).map(inside);
      if (pts.length < (AREA_KINDS.has(kind) ? 3 : 2)) { warnings.push(`atlas.sketch[${k}] (${kind}) needs ${AREA_KINDS.has(kind) ? 3 : 2} points or more — dropped`); continue; }
      out.points = /** @type {[number, number][]} */ (pts);
    }
    if (text(f.when)) out.when = text(f.when);
    sketch.push(out);
  }

  /** @type {AtlasPlace[]} */
  const places = [];
  const ids = new Set();
  for (const [k, p] of (Array.isArray(a.places) ? a.places : []).entries()) {
    if (!isPlain(p)) { warnings.push(`atlas.places[${k}] is not an object — dropped`); continue; }
    const id = text(p.id);
    if (!ID.test(id)) { warnings.push(`atlas.places[${k}]: "${id}" is not a place id (a–z, 0–9 and -) — dropped`); continue; }
    if (ids.has(id)) { warnings.push(`atlas.places[${k}]: "${id}" is listed twice — the second dropped`); continue; }
    if (!num(p.x) || !num(p.y)) { warnings.push(`atlas place "${id}" needs x and y — dropped`); continue; }
    ids.add(id);
    let level = text(p.level);
    if (level && !levels.has(level)) { warnings.push(`atlas place "${id}": "${level}" is not one of the campaign's levels — no road there`); level = ''; }
    const icon = PLACE_ICONS.includes(text(p.icon)) ? text(p.icon) : level === home ? 'camp' : 'forest';
    if (p.icon != null && !PLACE_ICONS.includes(text(p.icon))) warnings.push(`atlas place "${id}": unknown icon "${text(p.icon)}" — "${icon}" used`);
    let hours = num(p.hours) ? p.hours : 1;
    if (hours < 0 || hours > 12) { warnings.push(`atlas place "${id}": hours must be 0–12 — clamped`); hours = Math.min(12, Math.max(0, hours)); }
    const n = isPlain(p.notes) ? p.notes : {};
    const notes = {};
    for (const s of ['rumor', 'known', 'explored']) if (text(n[s])) notes[s] = text(n[s]);
    if (p.road != null && !isPlain(p.road)) warnings.push(`atlas place "${id}": "road" must be an object — ignored`);
    const rd = isPlain(p.road) ? p.road : {};
    /** @type {AtlasRoad} */
    const road = { there: [], back: [], night: [] };
    for (const s of ROAD_PARTS) road[s] = (Array.isArray(rd[s]) ? rd[s] : []).map(text).filter(Boolean);
    const [x, y] = inside([p.x, p.y]);
    places.push({
      id, name: text(p.name) || id, x, y, icon, level, entrance: text(p.entrance), hours: r1(hours),
      rumor: text(p.rumor), known: text(p.known), explored: text(p.explored),
      yields: (Array.isArray(p.yields) ? p.yields : []).map(text).filter(Boolean),
      notes, road,
    });
  }
  if (!places.some((p) => p.level === home)) warnings.push(`atlas: no place is the hub "${home}" — the map shows no camp`);
  return { title: text(a.title), subtitle: text(a.subtitle), home, entrance: text(a.entrance), size, sketch, places };
}

/**
 * The atlas as the file writes it: defaults left out, keys in a fixed order.
 * @param {Atlas} at
 */
export function serializeAtlas(at) {
  const sameSize = at.size[0] === ATLAS_SIZE[0] && at.size[1] === ATLAS_SIZE[1];
  return {
    ...(at.title ? { title: at.title } : {}),
    ...(at.subtitle ? { subtitle: at.subtitle } : {}),
    home: at.home,
    ...(at.entrance ? { entrance: at.entrance } : {}),
    ...(sameSize ? {} : { size: at.size }),
    places: at.places.map((p) => ({
      id: p.id, name: p.name, x: p.x, y: p.y, icon: p.icon,
      ...(p.level ? { level: p.level } : {}),
      ...(p.entrance ? { entrance: p.entrance } : {}),
      ...(p.level === at.home ? {} : { hours: p.hours }),
      ...(p.rumor ? { rumor: p.rumor } : {}),
      ...(p.known ? { known: p.known } : {}),
      ...(p.explored ? { explored: p.explored } : {}),
      ...(p.yields.length ? { yields: p.yields } : {}),
      ...(Object.keys(p.notes).length ? { notes: p.notes } : {}),
      ...(ROAD_PARTS.some((s) => p.road[s].length) ? { road: Object.fromEntries(ROAD_PARTS.filter((s) => p.road[s].length).map((s) => [s, p.road[s]])) } : {}),
    })),
    sketch: at.sketch.map((f) => ({ kind: f.kind, ...(f.at ? { at: f.at } : {}), ...(f.points ? { points: f.points } : {}), ...(f.name ? { name: f.name } : {}), ...(f.when ? { when: f.when } : {}) })),
  };
}

/**
 * A place's state as the story stands: the hub is `home`; else hidden while its `rumor` does not
 * hold, explored while its `explored` holds, known once its `known` holds (default: its level
 * visited), else a rumour.
 * @param {Atlas} at
 * @param {AtlasPlace} p
 * @param {(cond: string) => boolean} holds a story condition (the flag rule: a bare name is that flag)
 * @returns {'hidden'|'rumor'|'known'|'explored'|'home'}
 */
export function placeState(at, p, holds) {
  if (p.level && p.level === at.home) return 'home';
  if (p.rumor && !holds(p.rumor)) return 'hidden';
  if (p.explored && holds(p.explored)) return 'explored';
  const known = p.known || (p.level ? `visited:${p.level}` : '');
  return known && holds(known) ? 'known' : 'rumor';
}

/**
 * The hours a journey from level `from` to level `to` takes on the atlas: from the hub to a place's
 * level, or back, that place's hours; any other journey none.
 * @param {Atlas|null} at
 * @param {string} from
 * @param {string} to
 */
export function journeyHours(at, from, to) {
  return journeyOf(at, from, to)?.place.hours ?? 0;
}

/**
 * The atlas journey from level `from` to level `to`: the place away from the hub and whether the
 * journey comes back to the hub (null: not a journey on the atlas — a door, a seam, the same level).
 * @param {Atlas|null} at
 * @param {string} from
 * @param {string} to
 * @returns {{ place: AtlasPlace, back: boolean }|null}
 */
export function journeyOf(at, from, to) {
  if (!at || from === to) return null;
  const back = to === at.home;
  const other = from === at.home ? to : back ? from : '';
  const place = other ? at.places.find((q) => q.level === other) : null;
  return place ? { place, back } : null;
}
