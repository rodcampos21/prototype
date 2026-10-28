# Skills do projeto

Skills de agente (formato `SKILL.md`) que o Claude Code carrega neste repositório quando o pedido
combina com a descrição de cada uma.

## De terceiros: awesome-gamedev-agent-skills

Copiadas sem alteração de [gamedev-skills/awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills),
licença Apache-2.0 ([THIRD-PARTY-LICENSE.txt](THIRD-PARTY-LICENSE.txt),
[THIRD-PARTY-NOTICE.txt](THIRD-PARTY-NOTICE.txt)). Revisadas antes de entrar no repositório.

| Skill | Origem | Para que serve aqui |
| --- | --- | --- |
| `survival-crafting` | tag `v1.1.0` | recursos, coleta com reposição, construção, escassez |
| `rpg` | tag `v1.1.0` | quests, inventário, progressão |
| `save-systems` | tag `v1.1.0` | save da campanha (construções, turnos) |
| `game-ui-ux` | tag `v1.1.0` | menu de construção, painel de recursos, atlas |
| `game-feel` | tag `v1.1.0` | feedback de obra pronta, coleta, combate |
| `level-design` | tag `v1.1.0` | acampamento e nós de expedição |
| `prototype-fast` | tag `v1.1.0` | fatias verticais (marco M3) |
| `create-game-assets` | `main` em `19d93f9` (não existe na v1.1.0) | método de direção de arte; sem o arquivo `agents/openai.yaml` |

Elas são **genéricas** (Godot, Unity, pseudocódigo). Neste projeto, **os contratos do Luminati
prevalecem** quando houver conflito — veja `CLAUDE.md`. Exemplos de conflito conhecidos:

- `save-systems` recomenda migrações de save; o `AGENTS.md` proíbe migrações e leitores de formato
  antigo salvo pedido explícito.
- `create-game-assets` supõe arquivos PNG e geração de imagem; aqui a arte é pintada por código
  (`src/engine/pixel/`), então valem só o briefing, a lista de assets e os critérios de revisão.
- `game-ui-ux` fala em âncoras e escala livre; a UI do Luminati usa pixels de arte inteiros no quadro
  de referência 640 × 360 (`docs/specs/PIXEL_UI.md`).
- `game-feel` usa `timeScale` global para hit-stop; o combate do Luminati tem hit-stop local e nunca
  mexe em `engine.time.timeScale`.

Para atualizar: copiar de novo a pasta da skill de uma tag nova, revisar o diff e atualizar a tabela.
