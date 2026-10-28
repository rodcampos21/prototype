/**
 * The classes a player can pick at the character creation (a campaign with `player.create`,
 * docs/specs/CAMPAIGN_FORMAT.md): the id the save keeps (CampaignState `player.cls`, a source
 * identity: never translated) and the looks of its stages. Their names and lines are UI strings
 * ('campaign' `class.<id>` and `class.<id>.detail`), shown at the creation. Node-safe and
 * import-free (CampaignState reads it in the Node tests).
 *
 * **The look evolves with the specialization.** A class lists its stages in order (`looks`): the
 * first is how every character of the class starts; a later stage (a specialization reached in
 * the story) replaces the whole look — a character spec of CharacterSprites.js
 * (`createCharacterSheet`). Only the first stage of the knight exists today; the next ones add to
 * `looks` (heavier plate, a helmet, the order's colours …) and the save will name the stage.
 */

/**
 * The knight errant (Cavaleiro Errante): white spiky hair, teal eyes, ivory plate with gilt trim
 * and a crest over a blue tunic, a blue cape, a red belt, dark gloves, ivory greaves, a sword.
 */
const KNIGHT_ERRANT = Object.freeze({
  skin: 'skinLight', hair: 'hairWhite', hairStyle: 'spiky',
  outfit: Object.freeze({ top: '#33598c', bottom: '#3a3a48', accent: 'gold', style: 'plate', shirt: '#e6e0d2' }),
  cape: Object.freeze({ color: '#2c4f80', style: 'cape', lining: '#1d3557' }),
  hat: 'none', weapon: 'sword', beard: false,
  gear: Object.freeze({ pauldrons: true, bracers: true, gloves: true, leather: '#3b3b44', boots: '#d6d0c4', belt: '#8c2a2a' }),
  eyes: '#3fb3b6',
});

/**
 * @typedef {object} PlayerClass
 * @property {string} id      what the save keeps ('knight')
 * @property {readonly { stage: string, look: Readonly<Record<string, any>> }[]} looks  the stages, in
 *   order: their id and their character spec (the first: the start)
 */

/** @type {readonly Readonly<PlayerClass>[]} */
export const PLAYER_CLASSES = Object.freeze([
  Object.freeze({ id: 'knight', looks: Object.freeze([Object.freeze({ stage: 'errante', look: KNIGHT_ERRANT })]) }),
]);

/**
 * Is `id` a class of `PLAYER_CLASSES`?
 * @param {unknown} id
 * @returns {id is string}
 */
export function isPlayerClass(id) {
  return typeof id === 'string' && PLAYER_CLASSES.some((c) => c.id === id);
}

/**
 * The character spec of a class at a stage (an unknown stage: the class's first; an unknown class:
 * the first class's) — a frozen object: spread it before changing a field.
 * @param {string} [cls]
 * @param {string} [stage]
 * @returns {Readonly<Record<string, any>>}
 */
export function classLook(cls, stage) {
  const c = PLAYER_CLASSES.find((k) => k.id === cls) ?? PLAYER_CLASSES[0];
  return (c.looks.find((l) => l.stage === stage) ?? c.looks[0]).look;
}
