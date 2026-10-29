# Estrada da Costa — Terra Selvagem (`estrada-da-costa`)

The design note of **Estrada da Costa**, the first lore test of the *Culto ao Baiacu Rei* game, the first level of the game's campaign
(`public/campaigns/culto-ao-baiacu-rei/levels/estrada-da-costa.json`): the prologue rescue of the Ato I notebook (quest QP01, scene
C01). A dirt road runs north along the coast; on a clearing beside it Surubin, a young catfish-folk
adept of the cult, is cornered by forest creatures. The player — the wandering knight — clears them,
Surubin thanks the Baiacu Rei first and the knight second, and joins the party. Its texts are
Brazilian Portuguese, written as the level's source text.

| | |
| --- | --- |
| **Audience** | The game's authors; anyone extending the Ato I prologue. |
| **Source of truth** | [`tools/make-estrada-da-costa.mjs`](../../../tools/make-estrada-da-costa.mjs) (the generator), [`public/campaigns/culto-ao-baiacu-rei/`](../../../public/campaigns/culto-ao-baiacu-rei/campaign.json) (its output: `campaign.json` with Surubin's map, `levels/estrada-da-costa.json`, `levels/clareira-do-riacho.json`, `levels/mata-da-clareira.json`) |
| **Related docs** | [Story script](../../specs/STORY_SCRIPT.md) · [Party](../../specs/PARTY.md) · [Combat](../../contracts/COMBAT.md) · [Pixel module](../../architecture/modules/pixel.md) (the `head: 'catfish'` spec) · [Willowmere](sample-hamlet.md) (the generator it follows) |

Play it: `game.html` (the game: title, character creation, this level), or `game.html?campaign=culto-ao-baiacu-rei&level=estrada-da-costa` to start in it. Regenerate it: `node tools/make-estrada-da-costa.mjs`
(`--check` compares without writing).

---

## Layout

| Fact | Value |
| --- | --- |
| Size | 40 × 30 tiles, small-level build path |
| Time | 16:24, clock running (golden hour falls during the scene) |
| Weather | rain (`environment.weather`, and `weather rain` at the arrival, held until C02 lets it go): C01 happens in a storm; no key changes the weather or the time. On a later visit the road rolls its weather at each turn of the day (`weatherPool`: clear 55, rain 45) |
| West | the sea (still water, level 0), a sand beach (level 1) with the wreckage of Surubin's boat (crates, a barrel), rocks and a chest (12 gold, 2 Healing Draughts) |
| Middle | dune grass with pines, the coast road (two tiles wide, bending toward the sea) from the player start in the south to the map edge in the north |
| East | the clearing (trampled dirt in flower grass) where Surubin waits, then a wooded rise (level 3) |
| Kept clear | the road, the clearing and the strip south of it, so the north-looking camera always sees the rescue |

## Story

| Event | Trigger | What happens |
| --- | --- | --- |
| `event_1` | arrive, once | cutscene: banner, a cry for help, the camera shows Surubin among the creatures; quest `resgate` starts |
| `event_2` | enter the clearing area, once, background | Surubin barks for help |
| `event_3` | group `criaturas` cleared, once | scene C01: the knight beside Surubin, his thanks (the Rei first), his introduction, the knight's answer (a choice: ironic, dry or curious; each a `player:` line with his name, `${player}`, and Surubin's reply), "Precisamos sair dessa chuva", the knight's "Até a chuva passar", `party join surubin as mystic support` |
| `event_4` | enter the north road before the rescue | the narrator turns the player back |
| `event_5` | enter the north road after the rescue, once | Surubin points at the clearing up the stream, a fire to wait out the storm; quest done; `travel clareira-do-riacho` (C02) |

Surubin's talk script cycles four lines while he is in the party. The knight is a silent
protagonist (an open question of the Ato I notebook); the player still wears the engine's
`traveler` look, which `Player.js` fixes for every level.

## The next level: Clareira do Riacho (C02, then the camp)

`levels/clareira-do-riacho.json` (34 × 28, built by the same generator): a wide clearing in the woods
with a stream down its east side (the far bank is forest) — the camp of Act I. Its weather pool is
clear 70, rain 30. The old trail from the south is scenery: the camp has no exit; travel is by
Surubin's map on the table by his tent (the atlas, below), and journeys back arrive in front of it
(entrance `mesa`).

**The first night (C02).** On arriving with Surubin in the party (`arrive`, `if: party:surubin`)
the story holds a clear sky (`weather clear`), moves the clock on to 21:00, seats the two at the
fire (markers `fogo-cavaleiro` and `fogo-surubin`, after a short wait: the party takes its places
after the arrival) and plays C02 of the Ato I notebook: the colony, the knight's disdain, the map
and the strokes carved in stones. The knight's answer is a choice of three, each remembered by a
flag for Act II (`c02.estacao`, `c02.lar`, `c02.jantar`) with Surubin's reply, then "Que as marés
nos guiem.".

**The morning of day 2.** The screen fades out, the clock moves on to 7:30 (day 2) and the flag
`acampamento` is set: the camp props come (`when: acampamento`). Surubin leaves the party
(`party leave surubin`): from now on he is the camp's villager (id `surubin`, the same as on the
coast road; `when: acampamento`, `unless: party:surubin`), wandering between his tent and the map
table, with a talk script of his own (four lines in turn). The campaign has no tactics panel
(`party: { menu: false }`): Surubin only travels with the knight from the rescue to the camp. A
companion who stays in the camp later is placed the same way — a villager of the camp's level with
the same id —, so parting never makes anyone vanish. The two stand by the banner
(markers `manha-cavaleiro`, `manha-surubin`); Surubin shows the banner, the three plots and his
first sketch of the map (the camera on `estandarte`, `lote-forja`, `mesa-do-mapa`), names the
forest, the reeds and the quarry the sailors spoke of, and promises the knight the strokes carved
in stones. QP03 *Os alicerces* starts (stage `coletar`). The sky stays clear until 11:00 (a `time`
event lets the pool roll again then).

**The camp's layout** (the notebook, "O acampamento, o mapa e as obras"):

| Area | What | Ids / names |
| --- | --- | --- |
| Middle | the fire with two logs, a crate | — |
| North | Surubin's tent (`worn`), the map table (Space: Surubin's map), his crate and barrel; the arrival of every journey back in front of the table | `tenda-surubin`, `mesa-do-mapa`, entrance `mesa` |
| East | the banner (`pole`); the altar's place beside it (C03) | `estandarte`, marker `altar` |
| West and south | three roped plots on bare ground: forge 4 × 3.5, silo 3.5 × 3.5, lodging 5 × 3.5 | `lote-forja`, `lote-silo`, `lote-alojamento` |
| North-east | the chapel's place (QP05, phase 4), left clear | marker `capela` |

The generator fails unless the campaign places every `camp: true` type (Starfall Vale skips them).

**Back from the woods.** The first time the knight comes back from the Mata da Clareira
(`visited:mata-da-clareira and not mata.desenhada`), Surubin draws it on the map while the knight
talks (`set mata.desenhada`: the woods appear on the sheet and the place turns *known*); if the
claw marks were found, the knight tells of them and Surubin puts the Toca das Bestas on the map as a
rumour (`toca.desenhada`). Claw marks found on a later journey are told on that return. The
crowned fish found on the crate of the abandoned camp (`mata.marca`) is told on a return once the
woods are drawn: Surubin has never seen the King crowned, and no colony of the cult came this far —
"not that the Capital knows of".

## Surubin's map (the atlas)

`campaign.json`'s `atlas` ([CAMPAIGN_FORMAT.md §4.1](../../specs/CAMPAIGN_FORMAT.md#41-the-atlas)):
the Terra Selvagem as Surubin draws it, 100 × 60 map units, north up. Space at the map table opens
it; choosing a place travels there.

| Drawn | Where | When |
| --- | --- | --- |
| The sea with the Baiacu Rei in it, "Rumo a Marina", the shore | west | always |
| The coast road, Surubin's wrecked boat on the beach | west, along the shore | always |
| The stream from the hills past the camp to the sea, "Riacho" | north-east to west | always |
| The hills of the slope | north-east | always (seen from the camp) |
| The woods round the clearing | middle | always |
| The old woods west of the camp | west of the camp | `mata.desenhada` |

| Place | Icon | Road | Hours | State |
| --- | --- | --- | --- | --- |
| Clareira do Riacho (the camp) | camp | the hub | — | home |
| Mata da Clareira | forest | `mata-da-clareira`, entrance `chegada` | 1 | rumour → known (`mata.desenhada`) → explored (`mata.explorada`); yields wood, stone and herbs |
| Riacho dos Juncos | reeds | none yet (M3) | 2 | rumour |
| Pedreira da Encosta | quarry | none yet (M3) | 2 | rumour |
| Toca das Bestas | den | none yet | 2 | hidden until `toca.desenhada`, then a rumour |

Each place has Surubin's note for its states (the Ato I notebook, *Roteiro jogável*). An arrival
between 18:30 and 5:00 is announced on the map: more monsters, and stronger.

## Mata da Clareira (the first place on the map)

`levels/mata-da-clareira.json` (100 × 84, the same generator): the old woods west of the camp, the
first expedition — a big map to explore, its places joined by two-tile trails, open woods between
them (trees spaced wide, denser in groves by noise; nothing tall on a trail or just south of it,
where it would stand between the camera and the knight). Weather pool clear 60, rain 40.

| Area | Where | What |
| --- | --- | --- |
| The arrival | south-east | a glade with the stake and its red ribbon (`estaca-volta`) and a Space exit round it, *Voltar ao acampamento* (→ the camp, entrance `mesa`, an hour); entrance `chegada`; the band south of it kept clear |
| *Clareira das Flores* | east | a flower meadow round a pond (level 1, still water) |
| *Bosque dos Carvalhos* | middle | old oaks spaced wide, fallen trunks, boulders |
| *Riacho da Mata* | west third, north to south | a stream (level 0) between sandy banks (level 1), two bridges (`ponte-1`, `ponte-2`), herbs along its banks, birches, mist and fireflies |
| *Corte Antigo* | west | stumps of an old felling (spent tree resources, no flag); Space on them — cut by axes long before the cult came (a seed for the old colonies) |
| *Acampamento Abandonado* | south-west | a torn tent, a cold fire pit (a ring of stones), a barrel, a broken fence and a crate with a mark: a spiny fish wearing a crown (Space: `mata.marca`, a toast; Surubin's reaction in the camp — a seed for a colony no one remembers) |
| *Pedras Musgosas* | north-west | mossy stone ground, rocky knots, good stone to break, seven stones in a ring with roots woven between them (Space: a seed for the Povo da Raiz) |
| *Trilha das Garras* | north | an oak scored by claws (Space: `toca.boato`, a toast), the trail lost toward the north, rocks, mist |

**Resources** (`resource`, [OBJECT_CATALOG.md](../../specs/OBJECT_CATALOG.md#resource)): 32 trees to
chop (3 strikes, 2 wood) in groves along the trails, 16 stones to break (4 strikes, 2 stone) mostly
in the mossy stones, 20 herbs to pick (1 strike, 1 herb) on the stream's banks, the meadow, the old
camp and the cutting. Each has a spent twin; their flags are `res.mata.<id>`, cleared every morning:
they grow back. Trees and stones stand on a patch of trodden earth, which reads from afar.

**Chests:** 12 hidden places (`bau-01` … `bau-12`), each a random chest (`chance: 0.4`, gold only —
up to 30–40): on each expedition from the map a new roll says which are there and how much they
hold (2 to 7 of them in practice).

**Foes** (the forest creatures — slimes for now; the mobs come later): by day 10 groups of 2–3
(28 creatures, Lv 1–2) spread over every area — `criaturas-clareira` in the meadow, the oaks, the
cutting, the stones, the claws, the old camp, the stream north and south, the east and the
north-east. From 18:30 to 5:00 (`when: hour >= 18.5 or hour < 5`, live) 14 more groups of 3–5
(*Criatura da noite*, Lv 2–3, every third elite): 83 creatures in all. Every journey from the map
brings them back; the camp never has foes. Measured: ≈ 180 fps by day, ≈ 80 at night (1280 × 720).

**Story.** The first arrival: a banner, the woods, the camera on the stake, a line about what can
be gathered. An arrival at night: a toast (*A mata à noite é outra*). The meadow's creatures beaten:
`mata.criaturas`; with the claw marks found too, the place is explored (`mata.explorada`, a toast).
