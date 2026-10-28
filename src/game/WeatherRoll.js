/**
 * The weather a map rolls (a level's `environment.weatherPool`, docs/specs/LEVEL_FORMAT.md §9): the
 * clock and the weather are the game's — no key changes them —, so a map that lists the weathers it
 * can have rolls one of them on each turn of the day (morning, afternoon, night) and on arriving
 * there again, by their weights. The story can hold one (`weather rain` in a script) until it lets
 * the roll go on (`weather auto`). Deterministic: the journey's seed, the map, the day and the
 * phase give the same weather (a reload, a Continue never re-rolls it otherwise).
 *
 * Node-safe and import-free (the story self-test reads it).
 */

/** The weathers a pool may list (Weather.js `WEATHERS`). */
export const POOL_WEATHERS = Object.freeze(['clear', 'rain', 'snow']);

/**
 * The turns of the day the weather is rolled at, by the hour: morning from 5:00, afternoon from
 * 12:00, night from 18:30.
 * @typedef {'morning'|'afternoon'|'night'} WeatherPhase
 */
export const WEATHER_PHASES = Object.freeze(['morning', 'afternoon', 'night']);

/**
 * The turn of the day of an hour.
 * @param {number} h hours (any number; wrapped into 0…24)
 * @returns {WeatherPhase}
 */
export function weatherPhase(h) {
  const x = ((Number(h) % 24) + 24) % 24;
  if (x >= 5 && x < 12) return 'morning';
  if (x >= 12 && x < 18.5) return 'afternoon';
  return 'night';
}

/** A weight read from data: a finite number ≥ 0, else 0. @param {unknown} v */
const weight = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

/**
 * A level's weather pool, as the game reads it (untrusted data): each known weather with its
 * weight — a number, or one per turn of the day (`{ "night": 20 }`: a turn not listed weighs 0).
 * null when the level has none (absent, not an object, no weather with a weight above 0).
 * @param {unknown} env the level's environment
 * @returns {{ weather: string, weight: number|Partial<Record<WeatherPhase, number>> }[]|null}
 */
export function weatherPoolOf(env) {
  const pool = env && typeof env === 'object' ? /** @type {Record<string, unknown>} */ (env).weatherPool : null;
  if (!pool || typeof pool !== 'object' || Array.isArray(pool)) return null;
  const out = [];
  for (const w of POOL_WEATHERS) {
    if (!Object.hasOwn(pool, w)) continue;
    const v = /** @type {Record<string, unknown>} */ (pool)[w];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      /** @type {Partial<Record<WeatherPhase, number>>} */
      const byPhase = {};
      for (const p of WEATHER_PHASES) if (Object.hasOwn(v, p) && weight(/** @type {any} */ (v)[p]) > 0) byPhase[p] = weight(/** @type {any} */ (v)[p]);
      if (Object.keys(byPhase).length) out.push({ weather: w, weight: byPhase });
    } else if (weight(v) > 0) out.push({ weather: w, weight: weight(v) });
  }
  return out.length ? out : null;
}

/** FNV-1a of a text → 32-bit unsigned. @param {string} s */
function fnv(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * Roll a pool's weather for a turn of the day: by the weights of that turn, from a number made of
 * the journey's seed, the map, the day and the turn (the same inputs, the same weather). null when
 * no weather weighs anything in that turn (the weather stays as it is).
 * @param {NonNullable<ReturnType<typeof weatherPoolOf>>} pool
 * @param {{ phase: WeatherPhase, seed?: number, day?: number, level?: string }} at
 * @returns {string|null}
 */
export function rollWeather(pool, { phase, seed = 0, day = 1, level = '' }) {
  const weights = pool.map((e) => (typeof e.weight === 'number' ? e.weight : e.weight[phase] ?? 0));
  const total = weights.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return null;
  // (two rounds of mixing: neighbouring days and seeds land far apart)
  const h = fnv(`${fnv(`${seed}|${level}`)}|${day}|${phase}`);
  let u = (h / 4294967296) * total;
  let last = 0;
  for (let i = 0; i < pool.length; i++) {
    if (!(weights[i] > 0)) continue;
    if (u < weights[i]) return pool[i].weather;
    u -= weights[i];
    last = i;
  }
  return pool[last].weather;
}
