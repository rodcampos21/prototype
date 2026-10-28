/**
 * The classes a player can pick at the character creation (a campaign with `player.create`,
 * docs/specs/CAMPAIGN_FORMAT.md): the id the save keeps (CampaignState `player.cls`, a source
 * identity: never translated) and the character preset the player's sprite is drawn from. Their
 * names and lines are UI strings ('campaign' `class.<id>` and `class.<id>.detail`), shown at the
 * creation. Node-safe and import-free (CampaignState reads it in the Node tests).
 *
 * Only the knight today (the Culto ao Baiacu Rei's wandering knight). His own look comes with the
 * knight preset (PLANO-DE-MECANICAS stage F2); until then he is drawn as the traveler.
 */

/**
 * @typedef {object} PlayerClass
 * @property {string} id      what the save keeps ('knight')
 * @property {string} preset  the CHARACTER_PRESETS look of the player's sprite
 */

/** @type {readonly Readonly<PlayerClass>[]} */
export const PLAYER_CLASSES = Object.freeze([
  Object.freeze({ id: 'knight', preset: 'traveler' }),
]);

/**
 * Is `id` a class of `PLAYER_CLASSES`?
 * @param {unknown} id
 * @returns {id is string}
 */
export function isPlayerClass(id) {
  return typeof id === 'string' && PLAYER_CLASSES.some((c) => c.id === id);
}
