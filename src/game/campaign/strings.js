/**
 * UI strings, namespace 'campaign' (docs/specs/I18N.md §2): the campaign runtime's own messages —
 * the loading line, the refusals and failures of a travel, the save error, the title screen's
 * Continue / New journey menu and the character creation (its texts and the classes' names). Owner: G-story (docs/specs/PIXEL_UI.md §8). A feature namespace:
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
    /** the character creation (a campaign with `player.create`) */
    'create.title': 'Quem é você?',
    'create.name': 'Nome',
    /** the name a creation confirmed with an empty field gets (shown greyed in the field) */
    'create.suggested': 'Errante',
    'create.class': 'Classe',
    'create.confirm': 'Começar a jornada',
    'create.type': 'Digite',
    'create.prevClass': 'Classe anterior',
    'create.nextClass': 'Próxima classe',
    /** the classes (src/game/campaign/PlayerClasses.js): name and one line */
    'class.knight': 'Cavaleiro',
    'class.knight.detail': 'Um cavaleiro errante em busca dos segredos da espada.',
    /** the atlas (AtlasScreen): a campaign whose `atlas` has no title of its own */
    'atlas.title': 'Mapa',
    /** {day}: the story's day; {time}: the hour (7:45) */
    'atlas.clock': 'Dia {day} · {time}',
    'atlas.state.rumor': 'Boato',
    'atlas.state.known': 'Descoberto',
    'atlas.state.explored': 'Explorado',
    'atlas.state.home': 'Você está aqui',
    'atlas.journey': 'Viagem',
    /** {hours}: '1 h', '1 h 30' */
    'atlas.walk': '{hours} de caminhada',
    'atlas.arrive': 'Chegada às {time}',
    /** an arrival between 18:30 and 5:00 */
    'atlas.night': 'Você chega de noite: muito mais monstros, e mais fortes.',
    'atlas.yields': 'O que há lá',
    'atlas.unknown': 'Ninguém sabe ainda.',
    'atlas.note': 'Anotação',
    'atlas.noRoad': 'Ainda não se conhece um caminho até lá.',
    'atlas.here': 'A sua base. Toda viagem começa e termina aqui.',
    'atlas.travel': 'Viajar',
    'atlas.close': 'Fechar',
    'atlas.choose': 'Escolher',
    /** the journey card (JourneyCard): over the destination's name */
    'journey.to': 'A caminho de',
    'journey.back': 'De volta a',
    /** under the route, when the arrival falls between 18:30 and 5:00 */
    'journey.night': 'A noite cai no caminho.',
    'journey.skip': 'Pular',
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
    'create.title': 'Who are you?',
    'create.name': 'Name',
    'create.suggested': 'Wanderer',
    'create.class': 'Class',
    'create.confirm': 'Begin the journey',
    'create.type': 'Type',
    'create.prevClass': 'Previous class',
    'create.nextClass': 'Next class',
    'class.knight': 'Knight',
    'class.knight.detail': 'A wandering knight seeking the secrets of the sword.',
    'atlas.title': 'Map',
    'atlas.clock': 'Day {day} · {time}',
    'atlas.state.rumor': 'Rumour',
    'atlas.state.known': 'Discovered',
    'atlas.state.explored': 'Explored',
    'atlas.state.home': 'You are here',
    'atlas.journey': 'Journey',
    'atlas.walk': '{hours} on foot',
    'atlas.arrive': 'Arrival at {time}',
    'atlas.night': 'You arrive at night: far more monsters, and stronger ones.',
    'atlas.yields': 'What is there',
    'atlas.unknown': 'No one knows yet.',
    'atlas.note': 'Note',
    'atlas.noRoad': 'No way there is known yet.',
    'atlas.here': 'Your base. Every journey begins and ends here.',
    'atlas.travel': 'Travel',
    'atlas.close': 'Close',
    'atlas.choose': 'Choose',
    'journey.to': 'On the way to',
    'journey.back': 'Back to',
    'journey.night': 'Night falls on the way.',
    'journey.skip': 'Skip',
  },
};
export default table;
