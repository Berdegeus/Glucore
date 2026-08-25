# Board Kanban (GitHub Projects)

> Quando usar: antes de abrir, mover ou fechar um card; ou quando for automatizar o board via `gh project`.

Board: **Glucore — TCC Rubrica** — https://github.com/users/Berdegeus/projects/1 (owner `Berdegeus`, project number `1`). Gerenciado via `gh project` (CLI), não pela UI — qualquer agente pode reproduzir o que está aqui.

## Três views, três propósitos

| View | Filtro | Contém |
|---|---|---|
| **View 1 (padrão)** | nenhum | tudo: cards de rubrica + cards de arquitetura/PR/trabalho técnico não-rubrica |
| **View 2 — "Rubrica TCC"** | `label:rubrica` | só os critérios da planilha `docs/TCC_Acompanhamento_Bernardo_Eduardo.xlsx` (aba Rubricas) |
| **View 3 — "Processos Recorrentes"** | `label:processo-recorrente` | subconjunto da rubrica que exige constância por sprint, não é one-off — hoje #23 (qualidade) e #27 (migração Prisma) |

Regra de separação: um item só entra na view "Rubrica TCC" se corresponder a um critério numerado da planilha (obrigatório 9–16 ou opcional comprometido — ver `docs/tcc-rubric-evolution-plan.md`). Trabalho de arquitetura, bugfix, PR de branch etc. **não leva a label `rubrica`** e fica só na view geral — evita poluir a visão da banca com trabalho interno.

### Processos recorrentes

Critérios cujo tier de nota é definido por **% das sprints** em que o processo foi aplicado (não por "feito uma vez") levam a label `processo-recorrente` além de `rubrica`. Cada issue desses mantém uma tabela "Contagem (referência viva)" no corpo, com uma linha por ocorrência (PR revisada, migration criada) — é o que sustenta o tier declarado, então **atualizar a tabela é obrigatório a cada ocorrência nova**, não só quando for reavaliar o critério.

Campos do board dedicados a isso: **Qtd. Reviews** (número, usado em #23) e **Qtd. Migrations** (número, usado em #27) — devem sempre bater com o total da tabela na issue correspondente.

## Campos

| Campo | Tipo | Opções / uso |
|---|---|---|
| **Status** | single-select | `Todo` → `In Progress` → `Review` → `Done` |
| **Fase** | single-select | `Fase 0`…`Fase 4`, `Reserva` — mapeia as fases de `docs/tcc-rubric-evolution-plan.md`. Só cards de rubrica usam este campo; cards de arquitetura deixam em branco. |
| **Peso** | texto | só cards de rubrica: valor exato da coluna **E** ("Valor") da planilha, ou `gate` para os 8 obrigatórios (não têm peso — valem o gate de 2,5 pts inteiro) |
| **Critério** | texto | número do critério na planilha (ex. `23`, `39`) — é a referência cruzada com a aba Rubricas |

## Fluxo de um card

**Cards de rubrica** (issue com label `rubrica`):
1. Título: `Gate #N — <resumo>` (obrigatório) ou `#N — <resumo>` (opcional).
2. Corpo: texto **verbatim** da coluna A da planilha (citado em blockquote), mais colunas D/E/F/G/H quando existirem (classificação, valor, tiers 100/60/30%), mais uma seção `Status:` com o estado real verificado no código (não o que a planilha *deveria* mostrar — o que o código *mostra*).
3. `Status` do board reflete o estado real: `Done` só quando há evidência verificável (arquivo:linha, teste passando, doc existente). Chutar `Done` sem checar o código é o erro mais caro aqui — sempre grep/leia antes de marcar.
4. Ao fechar (`Done`), fechar a issue do GitHub também (`gh issue close`).

**Cards de arquitetura / PR** (sem label `rubrica`):
1. Um item por branch/PR relevante, título = título da PR.
2. `Status` segue o ciclo de vida real da PR: `Todo` (planejado) → `In Progress` (branch em andamento) → `Review` (PR aberta, aguardando CI/aprovação) → `Done` (merged).
3. Um card só vai para `Done` depois do **CI verde** (`.github/workflows/ci.yml`, ver `docs/guides/qa-process.md`) — CI é a referência de PR pronta, não a percepção do autor.
4. Se a PR resolve ou dá evidência para algum critério de rubrica, comentar isso nas issues de rubrica correspondentes (`gh issue comment`) em vez de duplicar o conteúdo — mantém a rubrica como fonte única da verdade sobre os critérios.

## Referência técnica (IDs)

Para automação via `gh api graphql` ou `gh project item-edit` — evita redescobrir a cada sessão.

```
Project ID:        PVT_kwHOA0su_M4BhXE-

Status (single-select): PVTSSF_lAHOA0su_M4BhXE-zhgTFrg
  Todo         ce41fd0e
  In Progress  3fddbdb9
  Review       0c7a0371
  Done         45a3bf4b

Fase (single-select):   PVTSSF_lAHOA0su_M4BhXE-zhgTFu8
  Fase 0    b8420939
  Fase 1    93c3927c
  Fase 2    0a303013
  Fase 3    b589ea95
  Fase 4    cf4edff9
  Reserva   dfcd5269

Peso (texto):      PVTF_lAHOA0su_M4BhXE-zhgTFvE
Critério (texto):  PVTF_lAHOA0su_M4BhXE-zhgTFvM
Qtd. Reviews (número):    PVTF_lAHOA0su_M4BhXE-zhgTPbs
Qtd. Migrations (número): PVTF_lAHOA0su_M4BhXE-zhgTPbw

View "Rubrica TCC":            PVTV_lAHOA0su_M4BhXE-zgLarNA (filter: label:rubrica)
View "Processos Recorrentes":  PVTV_lAHOA0su_M4BhXE-zgLar_0 (filter: label:processo-recorrente)

Label rubrica:              cor 6f42c1
Label processo-recorrente:  cor 0e8a16
```

### Criar um card de rubrica

```bash
url=$(gh issue create --repo Berdegeus/Glucore --title "#N — <resumo>" --body "<texto verbatim da planilha + Status>")
gh issue edit "$url" --repo Berdegeus/Glucore --add-label rubrica
item_id=$(gh project item-add 1 --owner Berdegeus --url "$url" --format json | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
gh project item-edit --id "$item_id" --project-id PVT_kwHOA0su_M4BhXE- --field-id PVTSSF_lAHOA0su_M4BhXE-zhgTFrg --single-select-option-id <status-id>
gh project item-edit --id "$item_id" --project-id PVT_kwHOA0su_M4BhXE- --field-id PVTSSF_lAHOA0su_M4BhXE-zhgTFu8 --single-select-option-id <fase-id>
gh project item-edit --id "$item_id" --project-id PVT_kwHOA0su_M4BhXE- --field-id PVTF_lAHOA0su_M4BhXE-zhgTFvE --text "<peso>"
gh project item-edit --id "$item_id" --project-id PVT_kwHOA0su_M4BhXE- --field-id PVTF_lAHOA0su_M4BhXE-zhgTFvM --text "<N>"
```

### Criar um card de arquitetura/PR

```bash
gh project item-add 1 --owner Berdegeus --url "https://github.com/Berdegeus/Glucore/pull/<N>"
# não adiciona label rubrica; Status segue o ciclo de vida da PR (ver acima)
```

`gh project item-add --format json` às vezes inclui caracteres de controle não escapados no corpo (issue/PR com `\n` literal), o que quebra `python3 -m json.tool`/`json.load` padrão — nesse caso, leia o `"id"` direto da saída de texto em vez de reparsear o JSON.

## Fonte de verdade por assunto

- **O que fazer / status de cada critério da rubrica**: este board (view "Rubrica TCC") + issues com label `rubrica`. Não `docs/tcc-rubric-evolution-plan.md` (esse é o plano histórico que gerou o board; pode ficar desatualizado depois que o board existe).
- **Se um PR está pronta pra merge**: `.github/workflows/ci.yml` verde, não a percepção de quem escreveu — ver `docs/guides/qa-process.md`.
- **Planilha original**: `docs/TCC_Acompanhamento_Bernardo_Eduardo.xlsx`, aba **Rubricas** — é a fonte legal (o que a banca avalia). O board é a operacionalização dela, não substitui.
