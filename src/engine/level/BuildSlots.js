/**
 * Build slots (`buildSlot` objects, OBJECT_CATALOG.md *buildSlot*; CAMPAIGN_FORMAT.md §4.3): a plot
 * where the player raises one of the story's buildings. A level holds the slot as one object; the
 * game expands it at load (`expandBuildSlots`) into what the world already knows how to build and to
 * show and hide with the story (`when` / `unless`, read live):
 *
 *  - the roped plot (a `stake` of kind `plot`, the slot's own id) while the slot is empty
 *    (`slot:<id> = empty`) — the world gives it the slot's Space prompt and floating sign;
 *  - for each building it may hold, its frame (`<id>.<building>.frame`) while it goes up and the
 *    building itself (`<id>.<building>`) once built — `building` props of the building's `prop`
 *    kind;
 *  - a marker in front of it (`<id>.front`), where scripts walk actors to.
 *
 * Everything is built at load (nothing appears mid-game that was not compiled then) and the slot's
 * own `when` / `unless` apply to all of it. Node-safe, no imports.
 */

/**
 * The building ids a slot may hold (`options`: a list, or a text of ids separated by spaces or
 * commas), in order, each once.
 * @param {any} slot
 * @returns {string[]}
 */
export function slotOptions(slot) {
  const raw = slot?.options;
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/[\s,]+/) : [];
  const out = [];
  for (const v of list) {
    const id = typeof v === 'string' ? v.trim() : '';
    if (id && /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,79}$/.test(id) && !out.includes(id)) out.push(id);
  }
  return out.slice(0, 16);
}

/** A number of `opts` within [lo, hi], else `d`. */
const optNum = (v, d, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);

/** `a and b` as a condition ('' `a`: `b` alone). @param {unknown} a @param {string} b */
const both = (a, b) => (typeof a === 'string' && a.trim() ? `(${a.trim()}) and ${b}` : b);

/**
 * A level's objects with every build slot expanded (the rest as they are, the same objects).
 * @param {any[]} objects
 * @param {(id: string) => string} propOf the `building` prop kind of a building id (the story's
 *   table; an unknown id: its default)
 * @returns {any[]}
 */
export function expandBuildSlots(objects, propOf) {
  if (!objects.some((o) => o?.type === 'buildSlot')) return objects;
  const out = [];
  for (const s of objects) {
    if (s?.type !== 'buildSlot') { out.push(s); continue; }
    const id = String(s.id);
    const rot = optNum(s.rotation, 0, -100, 100);
    const o = s.opts ?? {};
    const width = optNum(o.width, 4, 1.5, 10);
    const depth = optNum(o.depth, 3.5, 1.5, 10);
    const seed = Number.isInteger(o.seed) ? o.seed : 1;
    const unless = typeof s.unless === 'string' && s.unless.trim() ? { unless: s.unless } : {};
    const at = { x: s.x, z: s.z, rotation: rot };
    // the plot: the slot's id, its options and its own `when` beside the expanded one (the world's
    // prompt and sign read them)
    out.push({
      ...at, ...unless, type: 'stake', id, when: both(s.when, `slot:${id} = empty`),
      opts: { kind: 'plot', width, depth, seed }, slot: { options: slotOptions(s) },
    });
    for (const b of slotOptions(s)) {
      const kind = propOf(b);
      out.push({ ...at, ...unless, type: 'building', id: `${id}.${b}.frame`, when: both(s.when, `building:${id} = ${b} and slot:${id} = frame`), opts: { kind, stage: 'frame', seed } });
      out.push({ ...at, ...unless, type: 'building', id: `${id}.${b}`, when: both(s.when, `building:${id} = ${b} and slot:${id} = built`), opts: { kind, stage: 'built', seed } });
    }
    // in front of it (its local +z): where scripts walk actors to
    const ahead = depth / 2 + 1.3;
    out.push({ type: 'marker', id: `${id}.front`, name: `${id}.front`, x: s.x + ahead * Math.sin(rot), z: s.z + ahead * Math.cos(rot), facing: 'up' });
  }
  return out;
}
