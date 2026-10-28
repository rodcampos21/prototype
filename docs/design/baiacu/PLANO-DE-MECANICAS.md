# Plano de mecânicas — Culto ao Baiacu Rei sobre o Luminati

Planejamento para adaptar a engine Luminati ao jogo: espaços de construção fixos, a evolução visual
do acampamento, o relógio pelos dias do jogo, os recursos e a troca de idiomas (sai japonês e chinês,
entram inglês e português). A lore vive nos documentos do Claude Docs (*Bíblia Narrativa* e *Ato I —
Caderno de Lore, NPCs e Quests*). Aqui fica só o que muda no código.

| | |
| --- | --- |
| **Público** | Rodrigo e o parceiro de projeto; agentes de IA que forem implementar cada etapa. |
| **Estado** | **M1 (idioma) concluído em 2026-10-28** — veja a etapa A. **M2.1 (tela de criação de personagem) pronta em 2026-10-28**: `game.html` abre a campanha `culto-ao-baiacu-rei` (título → criação → [Estrada da Costa](../levels/estrada-da-costa.md)); nome e classe no save, `${player}` e `player:` nas falas (etapa J, itens 1, 2, 4 e 5). **M2.2 (visual do cavaleiro) pronta**: o Cavaleiro Errante de cabelo branco, armadura de placas clara com dourado, capa azul e espada (estilo de roupa ``plate`` novo no gerador de sprites); cada classe lista seus estágios de visual (``looks`` em ``PlayerClasses.js``), e uma especialização futura troca o visual inteiro. **Clima por mapa (etapa I) e C02 prontos**: ``environment.weatherPool`` sorteia o clima nas viradas de manhã, tarde e noite e nas chegadas; ``weather <x>`` trava e ``weather auto`` libera; a Estrada da Costa leva à Clareira do Riacho, onde acontece a fogueira (C02, marcas ``c02.estacao`` / ``c02.lar`` / ``c02.jantar``). **Acampamento (M2, itens 1 a 3)**: objetos novos ``tent``, ``mapTable``, ``banner`` e ``stake`` (categoria Camp, ``opts.stage`` para o que evolui com a cidade); na manhã do dia 2 a clareira vira o acampamento organizado (tenda e mesa ao norte, estandarte a leste, três lotes a oeste e ao sul) e começa a QP03. O resto é plano. |
| **Relacionado** | [Onboarding](../../ai/AGENT_ONBOARDING.md) · [Playbooks](../../ai/TASK_PLAYBOOKS.md) · [Formato de campanha](../../specs/CAMPAIGN_FORMAT.md) · [Linguagem de história](../../specs/STORY_SCRIPT.md) · [I18N](../../specs/I18N.md) · [Módulo pixel](../../architecture/modules/pixel.md) |

---

## 1. Como a arte é feita hoje (e o que isso significa para nós)

**Os sprites são refeitos a cada carregamento e não ficam salvos em lugar nenhum.** Personagens,
monstros, texturas, partículas, sons e música são pintados por código toda vez que o jogo abre. Um
sprite de personagem leva de 3 a 5 ms. A engine guarda cada folha só na memória enquanto a página
está aberta (`sheetCache` em `Game.init`). Como tudo usa sementes fixas, o resultado é sempre
idêntico pixel a pixel (`sandbox/sprite_art.hashes.json` prova isso). O repositório não tem nenhum
PNG de jogo.

Consequências:

- **Mudar um sprite é mudar código** (um preset ou uma função de pintura), não um arquivo de imagem.
- **Variações saem baratas**: o Surubin em quatro ranks é o mesmo `spec` com outras cores e enfeites.
- **As construções não são sprites.** Casa, moinho, poço e barraca de feira são modelos 3D
  procedurais com texturas em pixel art (`src/engine/world/props/*`). A cidade que cresce é, então,
  um conjunto de **novos construtores 3D** (tenda, altar, forja…) com **estágios** (fundação,
  andaime, pronto, melhorado).
- **Arte desenhada à mão (Aseprite) não tem caminho hoje**: a engine não carrega imagens. Se um dia
  quiserem, a etapa [F6](#f6-opcional-exportar-e-importar-pngs) adiciona exportar e importar PNGs.

## 2. O que a engine já dá de graça

| Precisamos de | A engine já tem |
| --- | --- |
| Acampamento e expedições | **Campanha**: fases ligadas por saídas, viagem com fade, save em `localStorage` |
| Acampamento → vila → cidade → metrópole | **Capítulos** de campanha: a partir de uma flag, uma fase passa a carregar um arquivo variante (outro terreno, outros objetos) |
| Construção aparecer na hora | `when` / `unless` em **qualquer** objeto, inclusive casas, avaliado ao vivo |
| Recursos (madeira, pedra, comida) | **Itens** da história (`give madeira 3`, `item:madeira >= 5`) e ouro |
| Quests QP/QS, fragmentos F01–F10 | Quests com etapas, diário (B), eventos `use` / `enter` / `cleared` |
| Contadores (dias, eventos EV01–EV08) | O **dia** da história (`day`, +1 a cada meia-noite e a cada descanso) e **variáveis** (`var ev01-inicio = …`, `if day >= …`) |
| NPC chegando ao acampamento | Villagers com `when`, cutscenes, `walk`, `bark` |
| Surubin e companheiros na luta | **Party** (até 3), classes warden / ranger / mystic |
| Hordas, chefe, defesa | Combate em tempo real, 8 tipos de inimigo, chefe com arena |

## 3. O que falta construir

| # | Sistema | Tamanho |
| --- | --- | --- |
| A | Idiomas: inglês + português, sem japonês e chinês | Médio (37 arquivos tocam ja/zh) |
| B | Fundação da campanha do Ato I (acampamento hub + nós de expedição + visual do cavaleiro) | Médio |
| C | Recursos: HUD de recursos, pontos de coleta, saque de inimigos | Médio |
| D | Relógio pelos dias do jogo (obras e contagens avançam a cada manhã, eventos que evoluem) | Médio |
| E | Construção em espaços fixos (o sistema central) | Grande |
| F | Arte: estruturas novas com estágios, NPCs novos, Surubin por rank, cavaleiro, inimigos novos | Grande e contínuo |
| G | Atlas: G1, o mapa mínimo do Surubin para viajar (já no M2/M3); G2, o atlas completo | G1 médio; G2 grande, depois do núcleo |
| H | Infra: desacoplar as fases de demonstração, testes do jogo | Pequeno e contínuo |
| I | Clima sorteado por mapa nas viradas do dia, com trava pela história | Médio |
| J | Criação de personagem (nome e classe) e voz do jogador nos diálogos | Médio |

Fora deste plano por enquanto: co-op online (a engine não tem rede) e classes além do Cavaleiro.

---

## 4. As etapas

### A. Idiomas: inglês e português

> **Concluído (M1, 2026-10-28).** `SOURCE_LANG = 'pt'` em `I18n.js`: português é fonte, fallback e
> padrão; as 11 tabelas de interface têm `pt` e `en`; `ja` / `zh` saíram (tabelas, conteúdo, fontes
> `@fontsource` CJK); seletor PT · EN na tela de título; ferramentas e testes de i18n seguem a
> constante. Tradução automática feita para a Estrada da Costa (`public/i18n/en/`). **Ficou para
> depois:** o código de layout CJK, que está dormente (KNOWN_ISSUES I18N-10), e as fases de
> demonstração em inglês (I18N-11, decisão 6). O texto abaixo é o plano original.

Hoje: `LANGS = { en, ja, zh }` em `src/engine/i18n/I18n.js`, `en` é a língua-fonte e o fallback.
As tabelas da interface ficam em `src/engine/i18n/strings/*.js` e `src/game/*/strings.js` (cada uma
com `en`, `ja`, `zh`), as tabelas de conteúdo em `public/i18n/ja|zh/`, e há carregamento de fontes
CJK em `FontLoader.js`.

1. **Decidido:** **tudo é escrito em português**, que é a língua-fonte e o idioma padrão do jogo
   (interface e conteúdo: falas, quests, fragmentos). O inglês é gerado por **tradução automática**:
   as worklists (`tools/i18n-worklist.mjs`) são preenchidas por IA e revisadas por amostragem antes
   do merge. Isso inverte o papel de hoje (`en` é fonte e fallback no código): `pt` passa a ser fonte
   e fallback, e `en` vira uma tabela traduzida.
2. `LANGS` passa a ser `{ pt, en }`, com `pt` como fonte, fallback e idioma padrão (inclusive quando o
   navegador não for português). Ajustar `LANG_CODES`, `langFrom` (`pt-BR` → `pt`) e os tipos.
3. Reescrever as tabelas da interface com `pt` como texto-fonte (HUD, diálogos, mapa, título, combate,
   party, história), manter `en` como tradução e apagar as entradas `ja` / `zh`. As ferramentas que
   assumem "`en` é a fonte" (`ContentStrings`, `check-i18n`, `i18n-worklist`, `TextKeys`) passam a ler
   a fonte de uma constante única.
4. Remover o caminho CJK: fontes CJK no `FontLoader`, `isCJK`, separadores `・`, regras de quebra de
   linha CJK em `layout/type.js`, `Emotes`, `Banner`, logo.
5. Ferramentas: `check-i18n`, `i18n-worklist`, os tours `--lang=ja|zh` dos sandboxes e do
   `tools/check.mjs` passam a usar `--lang=pt` (ou `--lang=en` quando o conteúdo é português).
6. Apagar `public/i18n/ja` e `public/i18n/zh` e criar `public/i18n/en` (tabelas de conteúdo em inglês).
7. **As fases de demonstração** (Emberfall, Starfall…) têm o texto-fonte em inglês. Opções: traduzir
   para português, ou tirá-las do conjunto verificado por i18n (decisão 6).
8. Conferir que as fontes pixel têm todos os acentos (á à â ã é ê í ó ô õ ú ç). O teste da Estrada
   da Costa já mostrou "ç" e "Ó" corretos.

**Pronto quando:** o seletor de idioma oferece English / Português, a interface inteira aparece em
português e os checks de i18n passam sem japonês e chinês.

### B. Fundação da campanha do Ato I

1. Criar a campanha `public/campaigns/ato-1/` com um gerador (`tools/make-ato-1.mjs`, no molde de
   `make-ferrymans-lantern.mjs`):
   - `estrada-da-costa` (o prólogo que já existe, movido para dentro da campanha);
   - `acampamento`, a **fase hub**: a própria `clareira-do-riacho` da C02, aumentada e organizada
     (fogueira no centro, tenda do Surubin com a mesa do mapa ao norte, estandarte e altar a
     leste, três espaços de construção a sul e oeste, área livre para a capela). Sem trilhas de
     saída: a viagem é pelo mapa (G1);
   - os nós iniciais do atlas como fases pequenas: `mata-da-clareira`, `riacho-dos-juncos`,
     `pedreira-da-encosta`.
2. **Visual do cavaleiro**: hoje `Player.js` usa sempre o preset `traveler`. Adicionar um campo
   opcional `player` (preset + spec) no `campaign.json` (ou no ambiente da fase) e criar o preset
   do Cavaleiro Errante.
3. **Surubin como ator** dos arquivos de história (`story/main.json`), para que ele exista em todas
   as fases com a mesma fala e o mesmo visual.
4. Cena C02 (a fogueira) e C03 (a escolha e o altar) como primeira entrega jogável do acampamento.

**Pronto quando:** dá para jogar prólogo → acampamento → uma expedição → volta, com save e Continue.

### C. Recursos

1. Recursos são **itens declarados** em `story/main.json`: `madeira`, `pedra`, `comida`, `ervas`,
   `minerio`, `couro`, `osso`, `minerio-raro`, `pedra-raiz`.
2. **HUD de recursos** (novo componente no kit de UI pixel): uma faixa com ícone e quantidade dos
   recursos principais, visível no acampamento e nas expedições.
2a. **Mochila e estoque**: o que se coleta numa expedição vai para a mochila, que tem limite; ao
   voltar ao acampamento, a mochila é guardada no estoque. O silo dobra o limite. Junto com a
   reposição dos pontos de coleta só de manhã (item 3), isso faz cada obra pedir umas 4
   expedições (Caderno, *Coleta em várias expedições*).
3. **Pontos de coleta**: um novo tipo de objeto `resourceNode` (árvore cortável, veio de pedra, moita
   de ervas), com Espaço para coletar, quantidade e reposição a cada manhã. Enquanto ele não existe,
   dá para usar um `event` `use` com `give madeira 3` e `once`.
4. **Saque de inimigos**: hoje o loot é ouro e poções (`src/game/combat/Loot.js`). Adicionar itens
   de recurso à tabela de saque por tipo de inimigo (couro e osso das bestas).
5. **Ícones** dos recursos pintados por código (novo `ItemIcons.js` em `src/engine/pixel/`).

### D. Relógio pelos dias do jogo

Regra do caderno (revista em 2026-10-28): *o tempo é contado em dias do jogo, não em expedições*.
Um dia dura cerca de 36 minutos reais (`TIME_SPEED`: 1 hora de jogo = 90 s).

1. **O dia já existe**: `StoryState.day` começa em 1, sobe a cada meia-noite e a cada descanso que
   passa da meia-noite, vai no save e é lido nas condições (`if day >= 3`). Não há contador de
   expedições.
2. **A virada que conta é a manhã** (5:00), a mesma que o sorteio de clima já detecta
   (`weatherPhase` em `src/game/WeatherRoll.js`). Primeiro protótipo: um evento de campanha
   `on: morning` que roda a cada nova manhã em qualquer fase. Depois vira um sistema (`DayClock`)
   que avança obras e contagens.
3. **Contagens com prazo** (EV01 saqueadores, EV02 a fera marcha, EV03 comerciante…): uma tabela
   `timers` em `story/main.json` (`id`, começa quando, duração em dias, o que acontece ao expirar).
   Cada contagem guarda o dia em que começou e expira em `inicio + duracao`. Regra do caderno: no
   máximo **dois eventos com contagem ativa ao mesmo tempo**. A Noite de névoa (EV06) dura uma
   noite, de 18:30 até a manhã seguinte.
4. **O relógio anda em todo lugar**, inclusive no acampamento: nada de `clock: false` por ato. Uma
   cena pode segurar a hora (`time 21`), mas o dia continua contando depois dela.
5. **Dormir** (Bíblia, *Dormir*): só no alojamento, depois de construído. Pula até a manhã
   seguinte e avança o dia, as obras e as contagens; um prazo pode vencer durante a noite. Antes
   do alojamento, o tempo só passa jogando.
5a. **A noite** (Bíblia, *A noite*): de 18:30 até a manhã, os nós têm muito mais monstros e podem
   aparecer variantes mais fortes. Caminho: cada fase de expedição declara grupos de inimigos
   extras com `when` na hora (condição nova `night`, ou `hour >= 18.5`) e os mais fortes com um
   peso noturno; o acampamento nunca tem inimigos.
6. **Exibição diegética**: a contagem aparece no atlas (G); até lá, no diário e em falas.
7. Obras (E) e eventos usam o mesmo dia.

### E. Construção em espaços fixos (o sistema central)

**Regra de design:** o jogador escolhe **o que** construir, nunca **onde**. Cada espaço tem uma
lista fechada de construções possíveis.

**Ato I (decidido em 2026-10-28):** três espaços fixos, um para cada obra (forja, silo,
alojamento). A C03 escolhe só qual começar primeiro. Depois: a forja é obrigatória na fase 2
(QP04), o alojamento na fase 4 (antes da QS03), e o silo é opcional (única porta para o Pomar
Abandonado). Qualquer uma pode ser feita antes da hora, em qualquer ordem, se houver recursos.
O que cada uma libera: forja → Fumaça na Serra e Odo; silo → Pomar Abandonado e a mochila maior;
alojamento → Estrada dos Peregrinos, dormir e cura.

**Modelo de dados** (novo, em `story/main.json` ou num `buildings.json` da campanha):

```jsonc
{
  "buildings": {
    "forja": {
      "nome": "Forja",
      "custo": { "madeira": 6, "pedra": 4 },
      "dias": 1,
      "estagios": ["fundacao", "andaime", "pronto"],
      "niveis": [ { "custo": { "minerio-raro": 2 }, "requer": "quest:aco-de-verdade = done" } ],
      "libera": "set forja-pronta"
    }
  }
}
```

E na fase do acampamento, um novo tipo de objeto:

```jsonc
{ "type": "buildSlot", "id": "slot-norte", "x": 18, "z": 9, "rotation": 0,
  "options": ["forja", "silo", "alojamento"], "size": "medio" }
```

**Comportamento:**

1. Espaço vazio: estacas, cordas e um marcador. Espaço aperta a escolha.
2. **Menu de construção** (nova janela no kit de UI): opções, custo, dias de obra e o que libera.
   Construções sem recursos ficam visíveis e desabilitadas.
3. Ao escolher: os recursos são pagos, a obra começa no estágio `fundacao` e avança a cada **manhã**
   (D), passando por `andaime` até `pronto`, esteja o jogador numa expedição ou no acampamento.
4. Ao terminar: roda o script `libera` (abre um nó do atlas, traz um NPC, como a QS01) e o Surubin
   comenta (as "reações a construções" do caderno).
5. **Níveis** (forja tier 2…) reabrem a obra num espaço já construído.
6. O estado vive no save da campanha (`CampaignState` ou `StoryState`): por espaço, a construção,
   o estágio e o dia em que começou.

**Como os modelos aparecem:** cada espaço já monta **na carga** todas as variantes possíveis
(construção × estágio) e mostra uma de cada vez. É o mesmo mecanismo do `when` / `unless`. Isso
respeita duas regras de ouro da engine: tudo que aparece no meio do jogo precisa estar compilado na
carga, e o número de luzes fica fixo.

**Caminho em dois passos:**

- **E1, protótipo sem mudar a engine** (validar o design rápido): o gerador da campanha escreve,
  para cada espaço, todos os objetos de cada estágio com `when: slot-norte = 3` etc., e o menu é uma
  `choice` do Surubin. Funciona hoje, mas não escala.
- **E2, sistema de verdade**: o objeto `buildSlot`, `BuildingSystem` em `src/game/building/`, a
  tabela de construções, o menu, os comandos de história `build <slot> <construção>` e as condições
  `building:<slot> = forja` e `stage:<slot> >= pronto`, além do suporte no editor (o inspetor do
  espaço lista as opções e mostra a prévia de cada estágio).

**Crescimento por ato** (acampamento → vila → cidade fortificada → metrópole): cada ato é um
**capítulo** com um arquivo variante do acampamento (terreno maior, mais espaços, muralhas). As
construções feitas são levadas ao novo arquivo pelo id do espaço.

### F. Arte: o que precisa ser criado

Tudo é código procedural, com as mesmas regras de hoje: cores da paleta, sementes fixas, texturas
em pixel inteiro, contorno escuro e 2 a 3 tons por material.

**F1. Estruturas do acampamento** (novos construtores em `src/engine/world/props/`, cada um com os
estágios `fundacao`, `andaime` e `pronto`):

| Estrutura | Ato | Observação |
| --- | --- | --- |
| Tenda / barraca | I | a primeira morada e o "canto do cavaleiro" |
| Fogueira com troncos | I | já existe (`campfire` com `seat`) |
| Mastro com o estandarte do peixe de espinhos | I | tecido que balança com o vento (o shader de vento já existe) |
| Altar do Surubin → capela | I | o altar surge sozinho de manhã (C03) |
| Forja | I | fogo com luz própria (cuidado com o limite de 12 luzes) |
| Silo | I | |
| Alojamento | I | |
| Cerca / paliçada | I–II | a "cerca norte" da defesa (C09) |
| Andaime genérico | todos | reaproveitado por qualquer construção no estágio `andaime` |
| Casas de colono, igreja, muralha, porto | II–IV | evolução das casas atuais (`House.js`) com a identidade do culto |

**F2. Personagens** (presets e `spec`, como o Surubin):

- **Surubin por rank**: Adepto → Pregador das Marés → Guardião do Sal → Arauto do Rei, com vestes
  mais ricas e mais espinhos. Nos atos finais, sinais do sacramento (olhos mais claros, cristais de
  sal). Precisa de um recurso novo: **visual condicionado à história** (o ator troca de `spec`
  conforme uma variável), porque hoje o `spec` de um NPC é fixo.
- **Cavaleiro Errante** (o jogador), e depois Juramentado, do Sal e Lâmina Antiga.
- **Odo** (ferreiro), **Varra** (encantadora), **o Velho das Pedras**, **Irmão Calo**, **Tobias
  Meia-Moeda**, três colonos fixos e o **batedor da Raiz**.
- Partes novas de corpo, se fizer sentido: escamas, espinhos (`gear.spines`), tatuagens de raiz.

**F3. Inimigos** (`MonsterSprites.js` + `defs.js`, roteiro no playbook §19): bestas da mata (lobo,
javali já existe), **Fera Salgada** (chefe do Ato I, com cristais de sal) e saqueadores humanos.

**F4. Ícones**: recursos, construções (para o menu) e marcadores do atlas.

**F5. Revisão de arte**: cada peça nova entra no `sandbox/sprite_art.html` ou num sandbox próprio,
com captura a 6× para aprovação, como foi feito com o Surubin.

#### F6. Opcional: exportar e importar PNGs

Se em algum momento quiserem retocar à mão: um script que **exporta** qualquer folha para PNG
(para editar no Aseprite) e um caminho para **carregar** um PNG no lugar da folha gerada. Isso quebra
a regra "nenhum asset binário" da engine, então só vale se for uma decisão consciente.

### G. Atlas

**G1, o mapa do Surubin (decidido em 2026-10-28, entra no M2/M3).** Não há saídas de mapa no
acampamento: a viagem é pela mesa do Surubin. Versão mínima:

1. Objeto na tenda do Surubin que abre a tela do mapa (Espaço).
2. Tela em pergaminho com o esboço do terreno já percorrido e os pontos clicáveis, com os estados
   boato (tracejado), descoberto e explorado. Escolha também por setas ou controle.
3. Escolher um ponto viaja para a fase do nó (a viagem com fade da campanha), avançando o relógio
   pelo tempo de viagem do nó.
4. Cada nó tem um ponto de chegada (estaca com fita) que leva de volta ao acampamento; na volta, a
   mochila é guardada e o Surubin "desenha" o que foi descoberto.
5. Só se viaja a partir da mesa; viagem direta entre nós vizinhos fica para depois.
6. Estado no save: os nós e seus estados (boato, descoberto, explorado).

**G2, o atlas completo (depois do núcleo).** Uma tela própria (no estilo do mapa-múndi atual, `ui/Minimap.js` / `WorldMap`) com:

- nós e caminhos;
- estados: rumor, descoberto, explorado e consagrado;
- ícones por origem do marcador;
- contagens visíveis;
- "um marcador importante por vez".

O G2 cresce a partir do G1: contagens visíveis, marcador importante único, consagração de nós
(Ato II).

### H. Infraestrutura

1. **Desacoplar as demos**: hoje todo tipo novo de objeto obriga o gerador de Starfall Vale (ou de
   Cinderwatch) a colocá-lo em cena (`coverage()`). Para tipos do nosso jogo, marcar uma flag nova
   (como `campaign: true` faz) e cobrir no gerador da campanha `ato-1`. A longo prazo, decidir se as
   fases de demonstração continuam no repositório.
2. **Um teste jogado por bot** da campanha (no molde de `sandbox/campaign.travel.json` e
   `combat_play.js`): prólogo, construir, sair, voltar, nova manhã, obra pronta.
3. **Documentação**: cada sistema novo ganha sua especificação em `docs/specs/` e uma linha no
   onboarding, como pede o `AGENTS.md`.

### I. Clima sorteado por mapa

Design na Bíblia, seção *Tempo e clima*. Hoje o relógio já corre (`TIME_SPEED`: 1 hora de jogo =
90 s; fases em `HUD.js timePhase`), mas o clima de uma fase é fixo (`environment.weather`) e só muda
pela tecla R ou pelo comando `weather` da história.

1. **Campo novo de fase** `environment.weatherPool`, opcional e ausente por padrão (regra de ouro 5):
   `{ "clear": 75, "rain": 25 }`, com pesos por clima e um peso de neve opcional por fase do dia
   (`"snow": { "night": 20 }`). Entra no `LevelFormat`, no inspetor do editor e nos tipos.
2. **Sorteio nas viradas de fase** em `src/game/Weather.js`: quando `timePhase` muda (amanhecer,
   meio-dia, tarde, crepúsculo, noite), sorteia o próximo clima com `RNG` semeado pela jornada, pelo
   dia, pela fase e pelo nome da fase do mapa (determinístico: recarregar não muda o resultado). A
   troca usa a transição suave que já existe.
3. **Na chegada a um mapa** o clima é sorteado para a fase atual; o clima do mapa anterior não é
   carregado (hoje a campanha carrega o clima de uma fase para a outra: mudar em `CampaignRuntime`).
4. **Trava pela história**: o comando `weather rain` passa a travar o sorteio; um novo `weather auto`
   destrava. Condição nova `weather = rain` já existe para ler o clima.
5. **Interiores** continuam sem clima visível (já é assim).
6. **R** vira tecla só de depuração (fora do jogo final).
7. Testes: um teste em Node do sorteio (mesma semente, mesmo resultado; distribuição perto dos pesos)
   e uma rodada no navegador com o relógio acelerado.

### J. Criação de personagem e voz do jogador

Design na Bíblia, seção *O protagonista*.

1. **Tela de criação** (novo componente da UI em pixel art, no kit `src/engine/ui/`): depois de
   "Nova jornada", antes do prólogo. Campo de nome (até 16 letras, nome sugerido, teclado e controle),
   escolha de classe (lista vinda de uma tabela de classes; hoje só o Cavaleiro) e confirmar.
2. **Save**: `CampaignState` guarda `player: { name, cls }`, validado como dado não confiável.
3. **Visual do jogador**: `Player.js` deixa de usar sempre o preset `traveler` e lê o preset da
   classe (o Cavaleiro Errante precisa de um preset novo, etapa F2).
4. **Nome nas falas**: valor de história `${player}` (nome escolhido) e o jogador como orador nos
   scripts (`player: Prazer, Surubin.`), com placa de nome e retrato. A convenção do caderno,
   `#NomeDoPlayer#`, vira `${player}` quando a cena entra no gerador.
5. **Escolhas com a voz do jogador**: já funcionam (`choice` + `>`); falta só a placa do orador
   mostrar o nome do jogador.
6. Tradução: o nome é escolhido pelo jogador e nunca é traduzido.

---

## 5. Decisões para vocês dois

| # | Pergunta | Recomendação |
| --- | --- | --- |
| 1 | Língua-fonte do conteúdo: escrever em português e traduzir para o inglês, ou o contrário? | **Decidido (2026-10-28):** tudo em português, idioma padrão português, inglês por tradução automática. |
| 2 | Primeira construção: estágios visíveis (fundação, andaime, pronto) ou só "em obra / pronta"? | Os três estágios: é o que faz a cidade "crescer à vista". |
| 3 | Duração das obras: sempre 1 dia no Ato I, ou variável? | **Decidido (2026-10-28):** obras contam dias do jogo, não expedições. Recomendação: 1 dia no Ato I; variável a partir do Ato II. |
| 4 | Espaços vazios aparecem desde o começo, ou vão sendo revelados? | **Decidido (2026-10-28):** o Ato I começa com três espaços fixos (forja, silo, alojamento); a área da capela e dos colonos abre na fase 4. |
| 5 | Arte só procedural, ou abrir caminho para PNG (F6)? | Procedural por enquanto. Reavaliar quando houver um artista. |
| 6 | Manter as fases de demonstração (Emberfall, Starfall…) no repositório? | Manter até o Ato I estar jogável: elas são os testes de regressão da engine. |
| 7 | Atlas antes ou depois do núcleo de construção? | **Decidido (2026-10-28):** o mapa mínimo do Surubin (G1) vem já no M2/M3 e substitui as saídas; o atlas completo (G2) fica depois. |

## 6. Ordem sugerida (marcos)

| Marco | Entrega | Etapas |
| --- | --- | --- |
| **M1, Idioma** | Jogo em português, sem japonês e chinês | A |
| **M2, Acampamento jogável** | Campanha Ato I: criação de personagem → prólogo → C02 → acampamento na clareira → mapa do Surubin → Mata da Clareira → volta; cavaleiro com visual próprio e falando; clima sorteado por mapa; mais monstros à noite | B, G1, I, J, F1 (tenda, mesa do mapa, estandarte, altar), F2 (cavaleiro) |
| **M3, Primeira obra** | Mochila e estoque, coleta em várias expedições (Mata, Riacho, Pedreira), C03 com a escolha forja / silo / alojamento, obra que avança a cada manhã, altar, dormir no alojamento (protótipo E1) | C, D, E1, F1 (forja, silo, alojamento, andaime) |
| **M4, Sistema de construção** | `buildSlot` + `BuildingSystem` + menu + editor; contagens EV01/EV02 | E2, D completo, F4 |
| **M5, Fase 1–3 do Ato I** | Odo, Fumaça na Serra, Pedras Riscadas, duelo do mestre | F2 (NPCs), F3 |
| **M6, Atlas completo** | Atlas do Ato I com os 12 (13) nós, contagens visíveis | G2 |

Cada marco termina com as checagens de sempre: `typecheck`, `level:check --campaign`, testes de
história, build, capturas revisadas e documentação atualizada.

## 7. Limites técnicos a respeitar

- **12 luzes pontuais** fixas: forjas, fogueiras e tochas do acampamento disputam esse total (o pool
  de luzes compartilha, mas a cena precisa continuar bonita).
- **Tudo que aparece no meio do jogo deve estar compilado na carga**: construções novas entram na
  carga da fase, escondidas, e nunca são criadas na hora.
- **Tamanho máximo de fase: 128 × 128 tiles.** A metrópole do Ato IV precisa caber nisso (Gildhaven
  mostra que cabe uma cidade murada).
- **Save só no navegador** (`localStorage`): suficiente para single player. Exportar ou importar save
  é uma melhoria futura.
- **Fases geradas só mudam pelo gerador**: o acampamento e os nós devem nascer de `tools/make-ato-1.mjs`.
