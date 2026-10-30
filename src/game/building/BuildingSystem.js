/**
 * The build slots' rules (PLANO-DE-MECANICAS E2; CAMPAIGN_FORMAT.md §4.3): what a slot may hold (the
 * story's `buildings` table), what it costs, beginning one at its plot (Space: what the camp's chest
 * holds, the choice, the cost paid from the chest), the mornings it takes to stand and the scripts
 * run then (`start` when begun, `done` the morning it stands). The slots' state lives in the story's
 * state (`StoryState.slots`, saved); the world shows each slot's stage through the conditions
 * `building:<slot>` / `slot:<slot>` (BuildSlots.js). Owned by the StoryRunner (`runner.buildings`).
 */

import { t } from '../../engine/i18n/I18n.js';
import { loc, term } from '../../engine/i18n/ContentText.js';
import { ownValue } from '../../engine/utils/own.js';

/**
 * @import { StoryRunner } from '../story/StoryRunner.js'
 * @import { StoryBuilding } from '../campaign/StoryFormat.js'
 */

export class BuildingSystem {
  /** @param {StoryRunner} runner */
  constructor(runner) {
    this.runner = runner;
  }

  /** A building of the story's table (null: none). @param {string} id @returns {StoryBuilding|null} */
  building(id) {
    return ownValue(this.runner.story?.buildings ?? {}, id) ?? null;
  }

  /** The `building` prop kind a building shows ('' unknown: the slot's default). @param {string} id */
  propOf(id) {
    return this.building(id)?.prop ?? '';
  }

  /** "12 Madeira, 10 Pedra" (translated names). @param {Record<string, number>} items */
  itemsText(items) {
    return Object.entries(items).map(([id, n]) => `${n} ${term(this.runner.itemName(id))}`).join(', ');
  }

  /** What the camp's chest still lacks for a building (item → count; empty: affordable). @param {string} id */
  missing(id) {
    const s = this.runner.state;
    /** @type {Record<string, number>} */
    const out = {};
    for (const [item, n] of Object.entries(this.building(id)?.cost ?? {})) if (s.stocked(item) < n) out[item] = n - s.stocked(item);
    return out;
  }

  /** Is a building's cost in the camp's chest? @param {string} id */
  affordable(id) {
    return !!this.building(id) && !Object.keys(this.missing(id)).length;
  }

  /**
   * The floating sign over an empty slot, translated: one building — its name, text, cost and days
   * —; several — each with its cost.
   * @param {string[]} options the slot's buildings
   * @returns {{ title: string, lines: string[], icon: string }} icon: the building's (several: the plot's)
   */
  sign(options) {
    const list = options.filter((b) => this.building(b));
    if (list.length === 1) {
      const b = /** @type {StoryBuilding} */ (this.building(list[0]));
      return {
        title: term(b.name), icon: b.icon,
        lines: [
          ...(b.text ? [loc(b.textKey ?? '', b.text)] : []),
          t('story.build.cost', { items: this.itemsText(b.cost) }),
          b.days === 1 ? t('story.build.days.one') : t('story.build.days', { n: b.days }),
        ],
      };
    }
    return {
      title: t('story.build.plot'), icon: 'plot',
      lines: list.map((id) => { const b = /** @type {StoryBuilding} */ (this.building(id)); return t('story.build.option', { name: term(b.name), items: this.itemsText(b.cost) }); }),
    };
  }

  /**
   * What the build window shows for a slot's buildings, translated (BuildPanel's data): the title
   * (one building's name, else the empty plot's), each building with its icon, text, cost item by
   * item (what the chest has, what it needs), its days and whether the chest pays for it, and what
   * the chest holds of everything they cost.
   * @param {string[]} options the slot's buildings
   * @returns {import('../../engine/ui/BuildPanel.js').BuildPanelData}
   */
  panelData(options) {
    const s = this.runner.state;
    const list = options.filter((b) => this.building(b));
    const icon = (/** @type {string} */ item) => this.runner.itemIconOf(item);
    const name = (/** @type {string} */ item) => term(this.runner.itemName(item));
    /** @type {Record<string, number>} */
    const have = {};
    for (const b of list) for (const item of Object.keys(this.building(b)?.cost ?? {})) if (s.stocked(item) > 0) have[item] = s.stocked(item);
    const one = list.length === 1 ? this.building(list[0]) : null;
    return {
      title: one ? term(one.name) : t('story.build.plot'),
      chest: Object.entries(have).map(([item, n]) => ({ icon: icon(item), name: name(item), have: n })),
      options: list.map((id) => {
        const b = /** @type {StoryBuilding} */ (this.building(id));
        return {
          id, icon: b.icon, name: term(b.name), text: b.text ? loc(b.textKey ?? '', b.text) : '',
          cost: Object.entries(b.cost).map(([item, n]) => ({ icon: icon(item), name: name(item), need: n, have: s.stocked(item) })),
          days: b.days === 1 ? t('story.build.days.one') : t('story.build.days', { n: b.days }),
          affordable: this.affordable(id),
        };
      }),
      labels: { build: t('story.build.build'), chest: t('story.build.chestLabel'), chestEmpty: t('story.build.chestNone'), select: t('story.build.select'), close: t('story.build.close') },
    };
  }

  /**
   * Space at an empty slot: the build window (`game.ui.buildPanel`) with its buildings — the one
   * chosen begins, paid from the chest, its `start` script queued (Game._interact awaits it).
   * Without the window (a page that never made it): the dialog says what the chest holds and offers
   * the choice.
   * @param {string} slot the slot's id
   * @param {string[]} options its buildings
   */
  async use(slot, options) {
    const r = this.runner;
    const list = options.filter((b) => this.building(b));
    if (!list.length || r.state.slot(slot)) return;
    const panel = r.game.ui.buildPanel;
    if (panel) {
      const pick = await panel.open(this.panelData(list));
      if (pick) this.begin(slot, pick);
      return;
    }
    const dialog = r.game.ui.dialog;
    // what the chest holds of everything these buildings cost
    /** @type {Record<string, number>} */
    const have = {};
    for (const b of list) for (const item of Object.keys(this.building(b)?.cost ?? {})) if (r.state.stocked(item) > 0) have[item] = r.state.stocked(item);
    const chest = Object.keys(have).length ? t('story.build.chest', { items: this.itemsText(have) }) : t('story.build.chestEmpty');
    const name = (/** @type {string} */ b) => term(this.building(b)?.name ?? b);
    let pick = '';
    if (list.length === 1) {
      const b = list[0];
      if (!this.affordable(b)) {
        await dialog.open({ lines: [chest, t('story.build.missing', { items: this.itemsText(this.missing(b)) })] });
        return;
      }
      const k = await dialog.open({ lines: [{ text: chest, choices: [t('story.build.begin', { name: name(b) }), t('story.build.notYet')] }] });
      if (k === 0) pick = b;
    } else {
      const k = await dialog.open({
        lines: [{ text: `${chest}\n${t('story.build.which')}`, choices: [...list.map((b) => t('story.build.option', { name: name(b), items: this.itemsText(this.building(b)?.cost ?? {}) })), t('story.build.notYet')] }],
      });
      const b = typeof k === 'number' ? list[k] : undefined;
      if (b && !this.affordable(b)) await dialog.open({ lines: [t('story.build.missing', { items: this.itemsText(this.missing(b)) })] });
      else if (b) pick = b;
    }
    if (pick) this.begin(slot, pick);
  }

  /**
   * Begin `b` at `slot`, paid from the camp's chest (false: not affordable, or the slot is taken);
   * its `start` script is queued.
   * @param {string} slot @param {string} b
   */
  begin(slot, b) {
    const r = this.runner;
    const def = this.building(b);
    if (!def || r.state.slot(slot) || !this.affordable(b)) return false;
    for (const [item, n] of Object.entries(def.cost)) r.state.takeStock(item, n);
    r.state.setSlot(slot, b, 1, def.days);
    r.changed();
    const sc = def.start ? r._script(def.start) : null;
    if (sc) r.enqueue({ kind: 'story', key: `build:${slot}`, nodes: sc.nodes });
    r.game.campaign?.save();
    return true;
  }

  /**
   * A script's `build`: put `b` on `slot` without its cost — going up over its days, or `built` —;
   * '' empties the slot. No `start` script (the script that builds says what it wants).
   * @param {string} slot @param {string} b @param {boolean} [built]
   */
  place(slot, b, built = false) {
    const r = this.runner;
    if (!b) r.state.setSlot(slot, '');
    else r.state.setSlot(slot, b, built ? 2 : 1, this.building(b)?.days ?? 1);
    r.changed();
  }

  /**
   * A new morning: every building going up is a morning nearer; one that stands now runs its `done`
   * script (a background run).
   */
  morning() {
    const r = this.runner;
    for (const [slot, st] of Object.entries(r.state.slots)) {
      if (st.stage !== 1) continue;
      if (st.left > 1) { r.state.setSlot(slot, st.b, 1, st.left - 1); continue; }
      r.state.setSlot(slot, st.b, 2);
      const def = this.building(st.b);
      const sc = def?.done ? r._script(def.done) : null;
      if (sc) r._enqueueBg({ kind: 'story', key: `built:${slot}`, nodes: sc.nodes });
    }
    r.changed();
  }
}
