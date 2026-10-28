/**
 * The game's language and its UI strings (docs/specs/I18N.md). Import-free and Node-safe: nothing
 * here touches `location`, `localStorage` or `document` at import time, so the story runtime and the
 * level tools can import it in Node.
 *
 * Languages: 'pt' (Brazilian Portuguese: the source every text is written in, the fallback and the
 * default) and 'en' (English, translated from it). The language is chosen once per page load
 * (`resolveLang`: `?lang=` > the saved choice > 'pt' — never the browser's locale, so harness runs
 * stay in the source language) and changed by saving a new choice and reloading (`saveLang`).
 *
 * UI strings live in namespaced tables registered with `registerStrings(ns, { pt, en })` — the core
 * ones by the UI, a feature's own (combat, party, story …) by the feature when it starts, so a
 * peaceful level never loads the combat table. `t('ns.key', vars)` looks the key up in the current
 * language, then in the source language, then returns the key itself. An entry is a string with
 * `{var}` slots or a function `(vars) => string` (articles, plurals); `{word}` that is not a var stays
 * as it is (the dialogue's gold markup).
 */

/** The language every text is written in (UI tables, level / campaign / story data): the fallback. */
export const SOURCE_LANG = 'pt';

/** The languages: code → the BCP 47 tag `<html lang>` takes and the language's own name. */
export const LANGS = Object.freeze({
  pt: Object.freeze({ tag: 'pt-BR', name: 'Português' }),
  en: Object.freeze({ tag: 'en', name: 'English' }),
});
/** The language codes, in the title screen's order (the source first). */
export const LANG_CODES = Object.freeze(['pt', 'en']);
/** The languages translated from the source (content tables exist only for these). */
export const TRANSLATED_LANGS = Object.freeze(LANG_CODES.filter((l) => l !== SOURCE_LANG));
/** localStorage key of the saved choice. */
export const LANG_KEY = 'luminati.lang';

/** @typedef {'pt'|'en'} LangCode */

const hasOwn = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k);

/**
 * A language code from a loose value ('pt-BR' → 'pt', 'en-US' → 'en'), or null.
 * @param {unknown} v
 * @returns {LangCode|null}
 */
export function normalizeLang(v) {
  if (typeof v !== 'string') return null;
  const p = v.trim().toLowerCase().split(/[-_]/)[0];
  return p === 'pt' || p === 'en' ? p : null;
}

/**
 * The language for this page load: `?lang=` (not saved), else the saved choice, else the source.
 * @param {{ search?: string, storage?: { getItem(k: string): string|null } | null }} [o] defaults: the page's
 * @returns {LangCode}
 */
export function resolveLang({ search, storage } = {}) {
  const q = search ?? (typeof location !== 'undefined' ? location.search : '');
  try {
    const fromQuery = normalizeLang(new URLSearchParams(q).get('lang'));
    if (fromQuery) return fromQuery;
  } catch { /* a malformed query */ }
  let st = storage;
  if (st === undefined) { try { st = typeof localStorage !== 'undefined' ? localStorage : null; } catch { st = null; } }
  try { const saved = normalizeLang(st?.getItem(LANG_KEY)); if (saved) return saved; } catch { /* storage off */ }
  return SOURCE_LANG;
}

let current = /** @type {LangCode} */ (SOURCE_LANG);

/** The current language. */
export const getLang = () => current;

/**
 * True for languages that break lines between characters and have no capitals (Japanese,
 * Chinese). No such language ships since the switch to Portuguese and English: the UI's CJK layout
 * paths (fonts in slices, line breaks, ink heights) stay in the code, dormant, until they are
 * removed (docs/design/baiacu/PLANO-DE-MECANICAS.md, stage A).
 * @param {string} [lang]
 */
export const isCJK = (lang = current) => lang === 'ja' || lang === 'zh';

/**
 * Set the current language (and `<html lang>` when there is a document). Done once at boot by
 * src/main.js (and by sandbox pages); components read `getLang()`.
 * @param {string} lang
 */
export function setLang(lang) {
  current = normalizeLang(lang) ?? SOURCE_LANG;
  if (typeof document !== 'undefined' && document.documentElement) document.documentElement.lang = LANGS[current].tag;
  return current;
}

/**
 * Save `lang` as the player's choice (the title screen's language switch; the page then reloads).
 * @param {string} lang
 */
export function saveLang(lang) {
  const l = normalizeLang(lang) ?? SOURCE_LANG;
  try { localStorage.setItem(LANG_KEY, l); } catch { /* storage off: the choice lasts this load */ }
  return l;
}

/** @typedef {string | ((vars: Record<string, any>) => string)} StringEntry */
/** @typedef {{ pt: Record<string, StringEntry>, en?: Record<string, StringEntry> }} StringTable */

/** ns → lang → key → entry (prototype-less maps: keys can be anything a level names). */
const TABLES = new Map();

/**
 * Register a namespace's strings. Registering a namespace again replaces it (hot reload, tests).
 * @param {string} ns e.g. 'hud', 'combat', 'party'
 * @param {StringTable} table
 */
export function registerStrings(ns, table) {
  const byLang = new Map();
  for (const l of LANG_CODES) {
    const src = table?.[l];
    if (!src) continue;
    const m = new Map();
    for (const k of Object.keys(src)) m.set(k, src[k]);
    byLang.set(l, m);
  }
  TABLES.set(ns, byLang);
}

/** True when `ns` has been registered. */
export const hasStrings = (ns) => TABLES.has(ns);

function lookup(key, lang) {
  const dot = key.indexOf('.');
  if (dot < 0) return undefined;
  const byLang = TABLES.get(key.slice(0, dot));
  if (!byLang) return undefined;
  const rest = key.slice(dot + 1);
  const hit = byLang.get(lang)?.get(rest);
  return hit !== undefined ? hit : byLang.get(SOURCE_LANG)?.get(rest);
}

/**
 * Fill `{name}` slots whose name is in `vars`; other braces stay (dialogue markup).
 * @param {string} s
 * @param {Record<string, any>} [vars]
 */
export function fill(s, vars) {
  if (!vars) return s;
  return s.replace(/\{([A-Za-z0-9_]+)\}/g, (m, k) => (hasOwn(vars, k) ? String(vars[k]) : m));
}

/**
 * A UI string in the current language (then the source language, then the key itself).
 * @param {string} key 'ns.key'
 * @param {Record<string, any>} [vars]
 * @returns {string}
 */
export function t(key, vars) {
  const e = lookup(key, current);
  if (e === undefined) return key;
  if (typeof e === 'function') return String(e(vars ?? {}));
  // a counted entry read without a count: its 'other' form
  if (typeof e === 'object' && e) return fill(String(/** @type {any} */ (e).other ?? ''), vars);
  return fill(e, vars);
}

/**
 * A counted string: the entry is `{ one, other }` (the plural categories of `Intl.PluralRules`) or a
 * plain string / function; `{n}` is the count.
 * @param {string} key
 * @param {number} n
 * @param {Record<string, any>} [vars]
 */
export function tn(key, n, vars = {}) {
  const e = lookup(key, current);
  const v = { ...vars, n };
  if (e === undefined) return key;
  if (typeof e === 'function') return String(e(v));
  if (typeof e === 'object' && e) {
    let cat = 'other';
    try { cat = new Intl.PluralRules(LANGS[current].tag).select(n); } catch { cat = n === 1 ? 'one' : 'other'; }
    const s = /** @type {any} */ (e)[cat] ?? /** @type {any} */ (e).other ?? '';
    return fill(String(s), v);
  }
  return fill(String(e), v);
}

/**
 * A list joined the current language's way ('A, B e C' / 'A, B, and C').
 * @param {string[]} items
 * @param {'conjunction'|'disjunction'} [type]
 */
export function tlist(items, type = 'conjunction') {
  try { return new Intl.ListFormat(LANGS[current].tag, { style: 'long', type }).format(items); } catch { return items.join(', '); }
}

/** The separator between items on one line. */
export const sep = () => ' · ';
