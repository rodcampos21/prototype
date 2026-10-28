/**
 * UI strings, namespace 'campaign' (docs/specs/I18N.md §2): the campaign runtime's own messages —
 * the loading line, the refusals and failures of a travel, the save error and the title screen's
 * Continue / New journey menu. Owner: G-story (docs/specs/PIXEL_UI.md §8). A feature namespace:
 * registered when a campaign starts (CampaignStart, CampaignRuntime), so a single level never loads
 * it. Import-free and Node-safe (the i18n checker reads it). `pt` is the source, `en` its
 * translation.
 *
 * What the campaign and its levels say (names, chapter titles, an exit's `locked` lines) is
 * content, translated at display (`term` / `loc`, I18N.md §4); the code default standing in for
 * blank `locked` data is a UI string here (`exit.closed`, §4.8). "Nv" / "Lv" is the level label.
 */
/** @type {import('../../engine/i18n/I18n.js').StringTable} */
const table = {
  pt: {
    loading: 'Abrindo a campanha',
    'exit.nowhere': 'Este caminho ainda não leva a lugar nenhum.',
    /** an exit whose `requires` does not hold, with no `locked` lines */
    'exit.closed': 'O caminho está fechado.',
    /** {place}: the level's name (translated) */
    'travel.failed': 'Não foi possível abrir o caminho para {place}.',
    /** a level whose name is not known (its file did not load) */
    'travel.failedUnknown': 'Não foi possível abrir o caminho.',
    'save.failed': 'Não foi possível salvar o jogo (o armazenamento do navegador está cheio ou desligado)',
    'title.continue': 'Continuar',
    'title.newJourney': 'Nova jornada',
    /** the Continue entry's second line: where the save is, the combat level, the time played */
    'title.save': '{place} · Nv {level} · {time}',
    'title.saveNoLevel': '{place} · {time}',
  },
  en: {
    loading: 'Opening the campaign',
    'exit.nowhere': 'This way leads nowhere yet.',
    'exit.closed': 'The way is closed.',
    'travel.failed': 'The way to {place} could not be opened.',
    'travel.failedUnknown': 'The way could not be opened.',
    'save.failed': 'The game could not be saved (browser storage is full or off)',
    'title.continue': 'Continue',
    'title.newJourney': 'New journey',
    'title.save': '{place} · Lv {level} · {time}',
    'title.saveNoLevel': '{place} · {time}',
  },
};
export default table;
