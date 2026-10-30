# Plano de mecânicas — Culto ao Baiacu Rei sobre o Luminati

Planejamento para adaptar a engine Luminati ao jogo: espaços de construção fixos, a evolução visual
do acampamento, o relógio pelos dias do jogo, os recursos e a troca de idiomas (sai japonês e chinês,
entram inglês e português). A lore vive nos documentos do Claude Docs (*Bíblia Narrativa* e *Ato I —
Caderno de Lore, NPCs e Quests*). Aqui fica só o que muda no código.

| | |
| --- | --- |
| **Público** | Rodrigo e o parceiro de projeto; agentes de IA que forem implementar cada etapa. |
| **Estado** | **M1 (idioma) concluído em 2026-10-28** — veja a etapa A. **M2.1 (tela de criação de personagem) pronta em 2026-10-28**: `game.html` abre a campanha `culto-ao-baiacu-rei` (título → criação → [Estrada da Costa](../levels/estrada-da-costa.md)); nome e classe no save, `${player}` e `player:` nas falas (etapa J, itens 1, 2, 4 e 5). **M2.2 (visual do cavaleiro) pronta**: o Cavaleiro Errante de cabelo branco, armadura de placas clara com dourado, capa azul e espada (estilo de roupa ``plate`` novo no gerador de sprites); cada classe lista seus estágios de visual (``looks`` em ``PlayerClasses.js``), e uma especialização futura troca o visual inteiro. **Clima por mapa (etapa I) e C02 prontos**: ``environment.weatherPool`` sorteia o clima nas viradas de manhã, tarde e noite e nas chegadas; ``weather <x>`` trava e ``weather auto`` libera; a Estrada da Costa leva à Clareira do Riacho, onde acontece a fogueira (C02, marcas ``c02.estacao`` / ``c02.lar`` / ``c02.jantar``). **Acampamento (M2, itens 1 a 3)**: objetos novos ``tent``, ``mapTable``, ``banner`` e ``stake`` (categoria Camp, ``opts.stage`` para o que evolui com a cidade); na manhã do dia 2 a clareira vira o acampamento organizado (tenda e mesa ao norte, estandarte a leste, três lotes a oeste e ao sul) e começa a QP03. **Mapa do Surubin, Mata da Clareira e a noite (M2, itens 4 a 6)**: o campo ``atlas`` da campanha e a tela do mapa (G1), aberta na mesa; a Mata da Clareira, primeiro lugar do mapa, com a estaca de volta; de 18:30 às 5:00 os grupos noturnos aparecem (muito mais monstros, alguns de elite). Com isso o M2 está completo. **Exploração**: a Mata da Clareira cresceu para 100 × 84 (riacho com duas pontes, pedras musgosas, acampamento abandonado, corte antigo), com recursos para cortar, quebrar e colher (tipo `resource`, voltam a cada manhã), baús aleatórios por expedição (só ouro) e criaturas espalhadas (28 de dia, 83 à noite). O resto é plano. |
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
   recursos principais, visível no acampamento e nas expedições. **Feito (2026-10-29)**: a faixa
   fica sob o minimapa, com o ouro primeiro (a bolsa do combate some, para não repetir), cada item
   da mochila e, embaixo, `usados/limite` (vermelho quando cheia); no acampamento conta o estoque.
2a. **Mochila e estoque**: o que se coleta numa expedição vai para a mochila, que tem limite; ao
   voltar ao acampamento, a mochila é guardada no estoque. O silo dobra o limite. Junto com a
   reposição dos pontos de coleta só de manhã (item 3), isso faz cada obra pedir umas 4
   expedições (Caderno, *Coleta em várias expedições*). **Feito (2026-10-29)** como o campo
   `inventory` do `campaign.json` ([formato, §4.2](../../specs/CAMPAIGN_FORMAT.md#42-the-inventory-backpack-stock-and-equipment)):
   limite 8, 16 com a flag `obra.silo` (a C03 vai ligá-la; números a balancear). Com a mochila
   cheia não se coleta (aviso para voltar). Ao chegar ao acampamento, tudo vai para o estoque e o
   jogo salva. A contagem de um item (`item:madeira`, o diário) soma mochila e estoque, e `take`
   tira do estoque primeiro: o custo da obra sai dos dois.
2b. **Janela de inventário** (pedida em 2026-10-28, entra no M3; **feita em 2026-10-29 dentro do
   diário** (B), a pedido: as abas *Mochila* e *Equipamento* ficam no lugar de *Itens*, ao lado de
   Missões e Códex, para toda a interface ficar num lugar só; Q/E trocam de aba, as setas escolhem).
   O plano original abaixo pedia uma janela do kit de UI pixel,
   aberta por uma tecla própria (I, e o botão do controle), que pausa o jogo como o diário. Duas
   metades:
   - **Mochila**: a grade de espaços com o ícone e a quantidade de cada item (madeira, pedra,
     ervas, itens de quest), o limite da mochila (`usados / limite`, maior com o silo) e, ao
     escolher um item, o nome e a descrição (os textos dos itens de `story/main.json`). No
     acampamento, mostra também o estoque.
   - **Equipamento**: o cavaleiro em pé (o sprite da classe, virado para a câmera) cercado pelos
     espaços de equipamento — arma, armadura, cabeça, mãos, pés, acessório — e os atributos ao
     lado (HP, MP, ATK, DEF, nível). **A mecânica de equipar ainda não existe**: os espaços já
     aparecem (vazios ou com o equipamento inicial da classe, só para ver), com o formato de dados
     pensado para ela (cada item com `slot` e bônus), para que equipar depois seja só ligar a
     lógica, sem refazer a tela. Equipamento inicial (decidido em 2026-10-29, só o básico):
     Espada de viagem, Cota de viagem, Elmo amassado, Luvas de couro e Botas de estrada; o
     acessório começa vazio. Nomes e descrições no Caderno, *O equipamento do cavaleiro*.
   - Teclado, controle e mouse como no diário (setas ou abas trocam de metade; Enter mostra o
     detalhe; Esc fecha). Textos traduzidos (pt / en).
   Pede junto: os ícones dos itens (F4) e o modelo de item com `slot`, que serve depois ao sistema
   de experiência, habilidades e classes.
3. **Pontos de coleta**: um novo tipo de objeto `resourceNode` (árvore cortável, veio de pedra, moita
   de ervas), com Espaço para coletar, quantidade e reposição a cada manhã. **Feito (2026-10-28)**
   como o tipo `resource` ([catálogo](../../specs/OBJECT_CATALOG.md#resource)): cada Espaço é um golpe
   (o cavaleiro golpeia, lascas, poeira ou folhas, som e tremor); no último golpe dá o item
   (`madeira`, `pedra`, `ervas`, declarados em `story/main.json`) e vira toco, cascalho ou galhos
   secos. Volta a crescer às 5h (a manhã apaga as flags `res.*`). Não se coleta com inimigos em
   cima. Falta a mochila com limite (2a) e o HUD de recursos (2).
4. **Saque de inimigos**: hoje o loot é ouro e poções (`src/game/combat/Loot.js`). Adicionar itens
   de recurso à tabela de saque por tipo de inimigo (couro e osso das bestas).
4a. **Baús aleatórios** (feito em 2026-10-28): um baú com `chance` aparece ou não em cada
   expedição, com uma quantia de ouro sorteada; por enquanto só ouro. Depois: ranks de raridade com
   saques melhores.
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
   que avança obras e contagens. **Feito (2026-10-29):** os eventos dos arquivos de história aceitam
   `on: morning` (STORY_SCRIPT.md §6): rodam a cada manhã (o relógio passando das 5:00, a viagem, o
   `time`, ou um `rest` até de manhã) enquanto o `if` vale, em qualquer fase. As obras avançam ali.
3. **Contagens com prazo** (EV01 saqueadores, EV02 a fera marcha, EV03 comerciante…): uma tabela
   `timers` em `story/main.json` (`id`, começa quando, duração em dias, o que acontece ao expirar).
   **Marco: M6** (decidido em 2026-10-30).
   Cada contagem guarda o dia em que começou e expira em `inicio + duracao`. Regra do caderno: no
   máximo **dois eventos com contagem ativa ao mesmo tempo**. A Noite de névoa (EV06) dura uma
   noite, de 18:30 até a manhã seguinte.
4. **O relógio anda em todo lugar**, inclusive no acampamento: nada de `clock: false` por ato. Uma
   cena pode segurar a hora (`time 21`), mas o dia continua contando depois dela.
5. **Dormir** (Bíblia, *Dormir*): só no alojamento, depois de construído. Pula até a manhã
   seguinte e avança o dia, as obras e as contagens; um prazo pode vencer durante a noite. Antes
   do alojamento, o tempo só passa jogando. **Feito (2026-10-29):** Espaço na porta do alojamento
   pronto (*Dormir*) dorme até as 8:00, só de noite (das 18:00 às 5:00; de dia, *Ainda é dia*). A
   cura fica para quando o acampamento tiver vida (hoje ele não tem combate).
5a. **A noite** (Bíblia, *A noite*): de 18:30 até a manhã, os nós têm muito mais monstros e podem
   aparecer variantes mais fortes. **Feito (2026-10-28):** cada fase de expedição declara grupos
   de inimigos extras com `when: hour >= 18.5 or hour < 5` (`NIGHT_CONDITION` em
   `src/game/campaign/AtlasFormat.js`), que entram e saem ao vivo conforme o relógio; os mais
   fortes são `elite` e de nível maior. Na Mata da Clareira: 5 inimigos de dia, 18 à noite. O
   acampamento nunca tem inimigos. O mapa avisa quando a chegada cai de noite.
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
  **Feito (2026-10-29), no gerador da campanha:** cada lote tem `obra.<forja|silo|alojamento>` (0 o
  lote com as estacas, 1 em obra, 2 pronta) e um objeto `building` por estágio (OBJECT_CATALOG,
  *building*: `frame` — alicerce, andaime, toras — e `built`). Espaço no lote mostra o custo e o
  que há no acampamento (mochila + estoque) e oferece começar; a C03 é a primeira vez (na volta ao
  acampamento com material para uma obra, ou no lote): só as obras com material são oferecidas, com
  as falas do Caderno. Começar paga do estoque, ergue o andaime e a missão *Os alicerces* vai para a
  etapa *obra*. A manhã seguinte (o evento `obras-de-manha`) põe a obra de pé e, depois da C03, o
  altar; a cena do altar (Caderno, *Na manhã seguinte*) conclui a missão. As obras seguintes ganham
  um comentário do Surubin. Custos do Caderno **sem a comida** (o Riacho dos Juncos, que dá comida,
  ainda não tem fase): forja 12 madeira e 10 pedra; silo 14 madeira e 6 pedra; alojamento 16 madeira
  e 6 ervas — rebalancear quando o Riacho e a Pedreira existirem. O silo pronto dobra a mochila
  (`obra.silo >= 2`). **Mudado (2026-10-29, pedido):** a mochila tem 6 espaços (12 com o silo), cada
  um com até 5 de um recurso (`inventory.stack`); cada coleta dá pela tabela de raridade da campanha
  (`inventory.rarity`; os básicos, `comum`: sempre 1, 2 em 40 %, 3 em 15 %), e se coleta à vontade
  enquanto houver recurso no mapa e espaço na mochila. Nada é guardado sozinho na volta: o baú do
  acampamento (ao lado da tenda) guarda com Espaço, e o painel de recursos aparece só no acampamento,
  mostrando o baú. As obras pagam do baú (`stock:<item>`); a C03 também dispara logo depois de
  guardar. Depois: trabalhos dos colonos que consomem o estoque do baú (tocar a forja).
  **Mudado de novo (2026-10-29, pedido):** nada de conversa obrigatória com o Surubin para construir.
  Cada lote tem uma placa flutuante (`signpost` com `opts.float`) dizendo o que é, quanto custa e em
  quanto tempo fica pronto; Espaço no lote mostra o que há no baú e oferece começar. O Surubin reage:
  na primeira obra vem e diz as falas da C03 do Caderno (a escolha útil, o estandarte, *uma comunidade
  começa pela fé*), nas outras um balão. Na mochila, Espaço no item abre um menu (por ora *Largar 1*,
  *Largar n*, *Cancelar*), e as poções de cura do combate aparecem nela. O que se larga fica no chão
  ao lado do jogador por 20 s (pisca nos últimos 5): Espaço nele (*Pegar*) devolve à mochila.
- **E2, sistema de verdade**: o objeto `buildSlot`, `BuildingSystem` em `src/game/building/`, a
  tabela de construções, o menu, os comandos de história `build <slot> <construção>` e as condições
  `building:<slot> = forja` e `stage:<slot> >= pronto`, além do suporte no editor (o inspetor do
  espaço lista as opções e mostra a prévia de cada estágio).
  **Núcleo feito (2026-10-29, M4):** o objeto `buildSlot` (a fase guarda o lote; o jogo o expande na
  carga em lote com cordas, andaime e construção de cada opção e um marcador `<lote>.front`:
  `src/engine/level/BuildSlots.js`), a tabela `buildings` dos arquivos de história (nome, texto,
  custo, dias, `prop`, scripts `start` e `done`) e o `BuildingSystem` (placa flutuante, Espaço no
  lote: o que há no baú, começar pagando do baú; cada manhã aproxima a obra; pronta, roda `done`),
  o comando `build <lote> <construção> [built]` / `build <lote> none` e as condições
  `building:<lote>` e **`slot:<lote>`** (`empty`, `frame`, `built` — `stage:` já era a etapa de uma
  missão). Os estados vão no save (`slots`). A campanha foi migrada sem mudar o jogo: os lotes
  `lote-forja`, `lote-silo` e `lote-alojamento`; o silo dobra a mochila com `slot:lote-silo >= built`.
  **A comida entrou nos custos** (forja 12 madeira, 10 pedra, 4 comida; silo 14 madeira, 6 pedra, 4
  comida; alojamento 16 madeira, 6 ervas, 4 comida), vinda por enquanto de **arbustos de frutas**
  (recurso `berries`, item `comida`) na Mata da Clareira; rebalancear quando o Riacho existir.
  **Falta no M4:** a janela de construção (escolha entre várias opções, hoje uma escolha no diálogo),
  os ícones das construções e o suporte no editor ([§8](#8-m4-o-que-falta-plano-de-execução)). **Foram
  para o M6 (decidido em 2026-10-30):** os níveis (forja nível 2) e as contagens EV01/EV02.

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
5a. **Cena de viagem** (pedida em 2026-10-28, entra no M3): no lugar da tela preta entre os mapas,
   uma pequena cena de transição. Pode ser só texto: o nome do destino e uma linha de caminho
   ("A trilha desce pela mata…", "De volta ao acampamento, o cheiro da fogueira…"), com as horas
   de viagem passando (7:30 → 8:30) e, se cair de noite, um aviso. Cada lugar do atlas ganha uma ou
   mais linhas de ida e de volta (texto traduzível, no `campaign.json`), sorteadas. Fica na tela
   enquanto o mapa carrega (no mínimo uns 2 s, Espaço adianta). Depois dá para enriquecer: o
   pergaminho do mapa com o pontilhado andando até o destino.
   As linhas de caminho (duas por destino, sorteadas) estão no Caderno, *Cena de viagem*.
   **Feito (2026-10-29):** o `JourneyCard` ([PIXEL_UI §8.1](../../specs/PIXEL_UI.md)) sobre o preto:
   *A caminho de* / *De volta a*, o nome do destino, uma linha do `road` do lugar (em rodízio pelas
   expedições; a volta de noite tem a sua), as marcas dos dois lugares com o pontilhado e um ◆ andando,
   as horas de saída e de chegada e *A noite cai no caminho.* quando chega de noite. 2,4 s no mínimo,
   Enter pula. As linhas da Mata, do Riacho e da Pedreira já estão no `campaign.json`.
5b. **Estaca de volta maior** (pedida em 2026-10-28, M3): a estaca com fita é pequena demais para
   achar num mapa grande. Uma versão maior e bem visível (um mastro alto com uma flâmula vermelha,
   talvez o peixe do culto), que se veja de longe e marque o ponto de retorno também no minimapa.
   **Feito (2026-10-29):** a estaca de tipo `mast` — um mastro de 4,2 m num monte de pedras, a bola
   de espinhos dourada no topo e o peixe do Rei numa flâmula **vermelha**, com fitas no mastro e três
   estacas em volta. No minimapa é uma bandeira vermelha; fora da vista, um losango vermelho na borda
   apontando para ela. No mapa-múndi, a linha *Caminho de volta* na legenda.
5d. **Recursos mais visíveis** (pedido em 2026-10-29, M3): **feito.** Cada recurso inteiro a até
   22 u do cavaleiro brilha de vez em quando (estrelinhas na cor do que dá: copa da árvore, topo da
   pedra, flores das ervas) e aparece no minimapa e no mapa-múndi como um pontinho (madeira âmbar,
   pedra cinza-clara, ervas rosa), que some quando é colhido e volta quando cresce. Com a névoa (5c),
   os pontinhos só vão aparecer na parte revelada.
5c. **Melhorar o minimapa** (pedida em 2026-10-28, M3: analisar primeiro). Com mapas grandes como a
   Mata (100 × 84) ele precisa ajudar a explorar. A avaliar: zoom e área visível, marcadores do
   ponto de retorno e dos lugares da fase (regiões nomeadas), recursos e baús, a névoa do que ainda
   não foi visto (revelar ao andar), o norte e a legibilidade das trilhas e do riacho. Resultado
   esperado da análise: o que o `Minimap.js` já faz, o que falta e uma proposta antes de mexer.
   **Feito (2026-10-29):** `atlas.fog` (CAMPAIGN_FORMAT §4.1) e `MapFog` (PIXEL_UI §5): nas fases
   dos lugares (não no acampamento) o minimapa e o mapa-múndi cobrem o que não foi visto; andar
   revela 10 u em volta com borda pontilhada; marcadores, recursos, inimigos e nomes de região só na
   parte vista, o mastro de volta sempre. Fica no save por fase (`fog`).
   **Decidido (2026-10-28): névoa de exploração.** O minimapa (e o mapa-múndi da fase) mostra só o
   que o jogador já percorreu; o resto fica coberto por uma névoa. Andar revela um raio em volta do
   cavaleiro, com a borda suave. O que foi revelado fica guardado no save, por fase, e continua
   revelado nas próximas expedições. Marcadores (baús, recursos, regiões) só aparecem na parte
   revelada; o ponto de retorno aparece sempre.
6. Estado no save: os nós e seus estados (boato, descoberto, explorado).

**Feito (2026-10-28).** O campo `atlas` do `campaign.json` ([formato, §4.1](../../specs/CAMPAIGN_FORMAT.md#41-the-atlas)):
lugares com ícone, fase, entrada, horas de viagem, condições de boato / descoberto / explorado,
recursos e a anotação do Surubin por estado; o esboço do terreno (mar, costa, estrada, rio, matas,
colinas, juncos, rótulos, o Baiacu Rei no mar, o barco naufragado), cada traço com `when`. A tela
(`AtlasScreen`) é um pergaminho pintado por código, com bordas queimadas, dobras, rosa dos ventos
e a rota pontilhada em vermelho; ao lado, a viagem, a hora de chegada e o aviso de noite. Os
estados não ganharam campo próprio no save: são lidos das flags e das visitas. Cada viagem pelo
mapa é uma expedição nova (os grupos derrotados voltam). A volta é uma saída por Espaço ao redor
da estaca com fita. Falta para o M3: a mochila guardada na volta.

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
| **M3, Primeira obra** | ~~Mochila e estoque, HUD de recursos, janela de inventário (mochila + equipamento, C 2, 2a, 2b), cena de viagem entre mapas (G1 5a), estaca de volta maior (5b), recursos visíveis (5d), névoa no minimapa (5c), C03 com a escolha forja / silo / alojamento, obra que avança a cada manhã, altar, dormir no alojamento (protótipo E1)~~ (concluído em 2026-10-29). As fases do Riacho e da Pedreira foram para o backlog (M6?) e a comida nos custos para o M4 | C, D, E1, F1 (forja, silo, alojamento, andaime) |
| **M4, Sistema de construção** | ~~`buildSlot` + tabela de construções + `BuildingSystem` + comando `build` e condições `building:` / `slot:` (a campanha migrada, sem mudar o jogo); a comida nos custos (arbustos de frutas na Mata até o Riacho existir)~~ (núcleo feito em 2026-10-29); ~~a janela de construção, os ícones das construções e o suporte no editor de fases~~ (feitos em 2026-10-30, [§8](#8-m4-o-que-falta-plano-de-execução)). **M4 concluído** | E2, F4 |
| **M5, Itens, personagem e habilidades** | Itens, equipar, atributos, experiência e habilidades do cavaleiro — o que já existe e as decisões em aberto em [§9](#9-m5-preparação) | C 2b (a lógica de equipar), J |
| **M6 (provisório), Fases de expedição e o tempo da campanha** | Riacho dos Juncos (comida) e Pedreira da Encosta; coleta em várias expedições; rebalancear os custos; **níveis de construção** (forja nível 2: reabrir a obra num lote pronto); **contagens com prazo** EV01/EV02 (D 3) | B 1, C, D completo, E2 (níveis) |

**Backlog** (sem marco ainda): Fase 1–3 do Ato I (Odo, Fumaça na Serra, Pedras Riscadas, duelo do
mestre; F2 NPCs, F3); atlas completo do Ato I com os 12 (13) nós e as contagens visíveis (G2).

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

## 8. M4: o que falta (plano de execução)

**Feito (2026-10-30):** os ícones (`src/engine/ui/art/icons/buildings.js`, na galeria de
`sandbox/ui_art.html`; `icon` na tabela, padrão o `prop`), a janela de construção
(`src/engine/ui/BuildPanel.js`; substitui o diálogo) com o ícone também na placa flutuante, e o
editor (lote no mapa 2D, prévia 3D pelo campo *Editor preview* — `empty` / `frame` / `built` — no
lugar da integração com a *Story preview*, botões com as construções da campanha no inspetor e as
checagens no *Check for problems*). Com isso o M4 está completo. O texto abaixo é o plano original.

Escrito em 2026-10-30, para executar em seguida. O núcleo já existe (E2 acima;
[CAMPAIGN_FORMAT.md §4.3](../../specs/CAMPAIGN_FORMAT.md#43-buildings-and-build-slots)). Os três itens
fecham o conceito de construção; níveis e contagens ficam para o M6.

### 8.1 Janela de construção

Hoje Espaço no lote abre o diálogo: a fala com o que há no baú e uma escolha (uma opção: *Começar:
Forja* / *Ainda não*; várias: uma linha por construção). A janela substitui isso para qualquer lote.

1. **Componente novo** no kit de UI pixel (`src/engine/ui/BuildPanel.js` + `buildpanel.css`), no
   estilo do diário (janela dourada G, cantos com gemas, fonte pixel). Abre por cima do jogo e pausa
   como o diário. Recebe dados prontos e traduzidos (a UI não lê a história):
   `{ slot, title, chest: [{ icon, name, have }], options: [{ id, icon, name, text, cost: [{ icon, name, need, have }], days, affordable }] }`.
2. **Layout:** à esquerda, a lista das construções do lote (ícone, nome; as sem recurso esmaecidas,
   como os espaços vazios da mochila); à direita, a escolhida: nome, texto, custo item a item com
   `tem / precisa` (verde quando basta, vermelho quando falta), dias de obra e um botão *Construir*
   (desabilitado sem recurso). Embaixo, o baú resumido (ícones e quantidades).
3. **Controles:** setas escolhem, Espaço/Enter constrói (som de confirmação), Esc fecha; mouse com
   clique na lista e no botão. Gamepad como no diário.
4. **Jogo:** `BuildingSystem.use(slot, options)` passa a montar os dados e abrir a janela
   (`game.ui.buildPanel.open(data)` → promessa com o id escolhido ou nada); a escolha chama
   `begin(slot, id)`, que já cobra do baú e enfileira o `start`. Sai o diálogo atual.
5. **Textos:** os rótulos da janela em `src/game/story/strings.js` (`build.*`, pt e en); os nomes e
   textos das construções continuam vindo da tabela (`term()` / `loc()`).
6. **Pronto quando:** um lote com uma e com várias opções abre a janela; construir funciona com
   teclado, mouse e controle; sem recurso o botão fica desabilitado e o que falta aparece em vermelho;
   testes do `BuildingSystem` cobrem os dados da janela; PIXEL_UI.md ganha a receita do componente.

### 8.2 Ícones das construções

1. **Ícones 16 × 16** no estilo dos ícones de item (`src/engine/ui/art/icons/`, novo `buildings.js`,
   paleta de `icons/core.js`): `forge` (bigorna com chama), `silo` (torre redonda de tábuas com
   telhado de palha), `lodge` (cabana de toras), `altar` (laje com a pedra de sal) e `plot` (estacas
   com corda, para o lote vazio e a lista).
2. **Dado:** a tabela de construções ganha `icon` (opcional; padrão: o do `prop`). Validação no
   `StoryFormat` como o `icon` dos itens.
3. **Onde aparecem:** na janela de construção (lista e título), na placa flutuante do lote (ícone ao
   lado do título) e no sandbox da arte de UI (`sandbox/ui_art.html`), para aprovar a arte a 6×.
4. **Pronto quando:** os cinco ícones aprovados em captura, usados na janela e na placa, com os
   testes de ícones (se houver hash de arte, atualizar).

### 8.3 Suporte no editor de fases

O `buildSlot` já tem os campos genéricos no inspetor (rotação, *Buildings* como texto, largura,
profundidade, seed) e aparece como um marcador, porque não constrói nada sozinho.

1. **Prévia 3D e 2D:** o editor expande o lote como o jogo (`expandBuildSlots` em
   `src/engine/level/BuildSlots.js`) para desenhar o lote com cordas no Viewport3D
   (`viewport3d/ObjectPreview.js`) e o retângulo do lote no mapa 2D (`map2d/Map2DView.js`), em vez do
   glifo. Também a prévia de objetos (`sandbox/props.html`), para conferir as peças do acampamento.
2. **Prévia do estágio:** um campo de editor só de visualização (não salvo na fase) no inspetor do
   lote: *Prévia* = vazio · andaime · pronto, e qual construção mostrar quando há várias. Integrar
   com a *Story preview* existente (View › Story preview…), que já aceita valores: `slot:<lote>` e
   `building:<lote>` entram como referências válidas ali.
3. **Escolha das construções:** o campo *Buildings* vira uma lista de marcar com as construções da
   tabela da campanha aberta (o editor já carrega os arquivos de história da campanha), com aviso
   quando um id não existe.
4. **Checagens:** o *Check for problems* do editor mostra os mesmos erros do `level:check`
   (construção inexistente, lote sem opções).
5. **Documentação:** OBJECT_CATALOG.md (*buildSlot*, editor), docs/user/LEVEL_EDITOR_GUIDE.md (como
   pôr um lote) e EDITOR.md se mudar a arquitetura do inspetor.
6. **Pronto quando:** pôr um lote no editor mostra as cordas, a prévia troca entre vazio, andaime e
   pronto, as opções vêm da tabela, e os testes do editor (`npm run api:test` e afins) passam.

### 8.4 Ordem e fechamento

Ícones primeiro (a janela e o editor usam), depois a janela, depois o editor. Fecha o M4 com as
checagens de sempre e capturas da janela e do editor para aprovação.

## 9. M5: preparação

Escopo do M5 (pedido em 2026-10-29): **itens, personagem e habilidades**. O detalhe será decidido
com vocês; aqui fica o que a engine e a campanha já têm e as perguntas a responder antes de começar.

### 9.1 O que já existe

- **Itens e equipamento (dados prontos, lógica não):** cada item da história pode ter `slot`
  (`weapon`, `body`, `head`, `hands`, `feet`, `accessory`) e `bonus` (`hp`, `mp`, `atk`, `def`); o
  cavaleiro começa com o equipamento básico (`inventory.equipment`); o diário mostra a aba
  *Equipamento* com os espaços e os bônus. **Os bônus não são aplicados** e não há como trocar de
  equipamento (CAMPAIGN_FORMAT.md §4.2).
- **Menu de item:** a mochila já tem o menu de ações por item (`InventoryItem.actions`, hoje só
  *Largar*): *Usar* e *Equipar* entram ali.
- **Combate do cavaleiro** (`src/game/combat/PlayerCombat.js`, `rules.js`, COMBAT.md §6): nível
  (até `LEVEL_CAP`), XP por inimigo, HP / MP / ATK / DEF calculados pelo nível, combo de 3 golpes,
  esquiva, 3 habilidades destravadas por nível (`SKILLS`), poção de cura, melhorias (`UPGRADES`:
  HP, MP, ataque) e o núcleo do chefe. Tudo vale nas fases com combate; o save guarda o progresso.
- **Classes:** a criação de personagem tem as classes da campanha (`PlayerClasses.js`; o Ato I só usa
  o Cavaleiro Errante) com estágios de visual (`looks`); a party tem as classes warden / ranger /
  mystic com presets de regra (PARTY.md).
- **Ícones de item:** madeira, pedra, ervas, comida, espada, armadura, elmo, luvas, botas, anel,
  mochila, poção.

### 9.2 Perguntas para vocês (decidir antes do M5)

1. **Equipar:** só no acampamento (no baú) ou em qualquer lugar pelo diário? Trocar equipamento
   devolve o antigo para a mochila (ocupa espaço) ou para o baú?
2. **De onde vêm itens novos:** forja (o Odo forja com recursos do baú), baús das expedições,
   inimigos, comerciante (EV03)? Isso decide se o M5 precisa de uma receita de forja.
3. **Atributos:** manter HP / MP / ATK / DEF ou acrescentar algum (velocidade, crítico, resistência
   ao sal)? Os bônus somam ao valor do nível?
4. **Experiência:** o nível do combate (já existe) é o nível do personagem, ou haverá outra
   progressão (fé, rank do Surubin, juramentos do cavaleiro)?
5. **Habilidades:** as 3 atuais do combate viram as do Cavaleiro Errante? Haverá árvore ou escolha
   por nível? Habilidades fora do combate (coletar mais rápido, carregar mais)?
6. **Consumíveis:** só a poção de cura, ou comida e ervas viram consumíveis (*Usar* no menu da
   mochila: comer recupera algo, ervas viram poção)?
7. **Especializações do cavaleiro** (Juramentado, do Sal, Lâmina Antiga — Bíblia): entram no M5 ou
   depois? Elas trocam o visual inteiro (`looks`) e talvez as habilidades.

### 9.3 Proposta de primeiros passos (a confirmar)

1. Aplicar os bônus do equipamento aos atributos do combate e mostrar o total no diário.
2. *Equipar* / *Desequipar* no menu do item (com a regra decidida na pergunta 1).
3. *Usar* para consumíveis (com a regra da pergunta 6).
4. Uma ficha do personagem no diário (nível, XP, atributos com e sem bônus, habilidades).
5. Depois, conforme as respostas: forja de itens, árvore de habilidades, especializações.
