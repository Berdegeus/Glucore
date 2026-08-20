# Plano de evolução — Rubricas TCC (meta: 10+ pontos)

> Base: estado do projeto em 2026-08-17 (v1.1.0). Nota máxima 10; fórmula da planilha é `MIN(10, SOMA(opcionais)) + 2,5` — **só conta se os 8 obrigatórios forem "Sim"**. Escopo revisado em 2026-08-17: cortado de 17 opcionais (soma de pesos = 21) para 9 (soma 10,5), depois **promovidos 24 (prototipação) e 35 (dark/light mode) da reserva pra titularidade** → **11 opcionais comprometidos, soma de pesos = 13,5**. A escolha completa está marcada na aba **Rubricas**, colunas **K** (Compromisso 2026-2) e **L** (Fase/motivo), e espelhada ao vivo na aba **Progresso**.

## 0. Regra do jogo

- **Gate obrigatório (2,5 pts):** precisa 8/8 "Sim" em E9:E16. Hoje: 3/8 (12, 13, 16). Faltam 9, 10, 11, 14, 15.
- **Opcionais:** soma é *capada em 10*. Escopo comprometido = 11 itens, soma de pesos 13,5 → se tudo sair "full", nota final = 2,5 + 10 (capado) = 12,5 mostrado, com folga de 3,5 acima do teto — sobra espaço pra algum item sair só parcial.
- Itens marcados **[EXTERNO]** dependem de decisão/aprovação dos professores ou de algo fora do código.
- A aba Rubricas agora tem um painel em **H2:I4**: nota real hoje, nota se cumprir o combinado, e quantos obrigatórios faltam — tudo colorido (verde ≥10, vermelho <10).

## Fase 0 — Sprints 1–2 (agora): barato, tem prazo, quase de graça

| Ação | Critério | Ganho | Esforço |
|---|---|---|---|
| **[EXTERNO]** Reunião de escopo com professores, documentar por escrito o que foi acordado | 9 (obrigatório) | gate | baixo |
| **[EXTERNO]** Confirmar formato de doc de sprint exigido pelo TDE; adotar board (GitHub Projects) + review/retro por sprint em `docs/sprints/` | 10 (obrigatório) | gate | baixo |
| **[EXTERNO, prazo!]** Levar aos professores o item **Livre** (42): a própria stack de conexão de sensor — protocolo GATT proprietário Sibionics (engenharia reversa, sem doc oficial), NFC + lib Abbott pro Libre 2, PIN pairing do Accu-Chek SmartGuide, tudo unificado atrás de `BrandBleManager` e de uma ponte C++/JNI pra `.so` vendor arm64. Já está implementado — falta só formalizar o acordo por escrito e um doc técnico curto | 42 | +1,5 (trabalho já feito) | baixo |
| README de backend + doc de rotas (payloads reais de exemplo) | 26 | +1 (fácil, full) | baixo |
| Manter disciplina de migração Prisma por sprint (já em 0,6) | 27 | até +0,4 | baixo (hábito) |
| Formalizar processo de qualidade: plano de testes curto + usar PR review (já acontece) + registrar no board tarefas reprovadas em QA | 23 | 0,3 → 1 | baixo |

## Fase 1 — Sprints 3–5: fecha o gate obrigatório (e usa o mesmo trabalho pros opcionais)

O maior bloco pendente é **perfil Profissional de Saúde** — resolve dois obrigatórios de uma vez e alimenta 2 opcionais de graça:

| Ação | Critério | Ganho |
|---|---|---|
| Implementar 2º perfil (Profissional de Saúde), permissões validadas front + back | 14 (obrigatório) | gate |
| Dashboard do profissional: visão agregada de pacientes, filtros, gráficos (usa `groupBy`/aggregate no Prisma) | 15 (obrigatório) + turbina 28 | gate + 0,3 → 1,5 |
| Refatorar backend em camadas (controller/service/repository) — necessário pra construir o dashboard sem bagunçar as rotas | 33 | 0,3 → 1 |
| Testes automatizados backend (jest + supertest), mirar 75%+ | 25 | 0 → 1 |

**Ao final desta fase: 8/8 obrigatórios (2,5 pts garantidos) + ~6 pts de opcionais já fechados.**

## Fase 2 — Sprint 6: só o CI/CD (cortado o resto do cluster cloud)

| Ação | Critério | Ganho |
|---|---|---|
| GitHub Actions: build + test + deploy | 39 | 0 → 1,5 |

## Fase 3 — Sprints 7–8: frontend

| Ação | Critério | Ganho |
|---|---|---|
| Camada `domain/` no feature `patient` (hoje só auth/sensor têm) — só arruma o que já existe | 37 | 0,6 → 1 |
| Dark mode + light mode (`ThemeMode`, `AppTheme.dark()`) — só o item (a) do critério 35, não o combo completo (desktop + customização salva) | 35 | 0 → 0,3 de %atendido = nota 0,45 (tier "1/3 itens"; sobe se der pra fazer os outros 2/3) |

## Fase 4 — Sprints 9–11: prototipação (promovido da reserva, precisa teste com usuário)

| Ação | Critério | Ganho |
|---|---|---|
| Protótipo Figma + checklist de usabilidade + pelo menos 1 teste filmado com usuário | 24 | 0 → 1,5 |

**Atenção de calendário:** essa fase cai perto das avaliações somativas (13/set–14/nov na planilha de acompanhamento) — reservar a sessão de teste com usuário com antecedência, não deixar pra última semana.

## Reserva — só se sobrar tempo depois de bater 10+ com folga

Não comprometidos porque custam caro (setup de infra, pesquisa com usuário real) pro ganho de pontos que dão, já que o teto de 10 já é alcançado sem eles:

- **32** (cloud services), **40** (IaC), **41** (monitoramento) — cluster de infra que sobrou; só entra se o time quiser currículo/portfólio, não porque falta nota.
- **34** (cobertura frontend) — caro em tempo de tela.
- **35 completo** (itens b/c: build desktop + customização salva) — item (a) já está comprometido acima; os outros dois entram só se sobrar tempo.
- **38** (acessibilidade) — reaproveitaria a mesma sessão de teste do critério 24 se rolar, mas não está comprometido.
- **22** (BDD/UML/diagramas) — documentação extra sem afetar o produto.

## Fora de cogitação (baixo ROI ou conflita com o produto)

- **NoSQL (29)** — app é 100% relacional, forçar Mongo/etc seria artificial.
- **Microsserviços + Service Discovery/Gateway (30, 31)** — alto esforço, baixo retorno pra equipe de 2; provavelmente pioraria a arquitetura limpa (33/37) em vez de ajudar.
- **i18n (36)** — a spec funcional trava o app em pt/pt-BR por decisão de produto.

## Projeção

Escopo comprometido (Fases 0–4): 11 itens, soma de pesos = **13,5** → nota projetada = MIN(10, 13,5) + 2,5 = **12,5** (mostrado), com 3,5 de peso "sobrando" acima do teto — dá pra tolerar 35 sair só no tier parcial (como já é o plano) e ainda outro item qualquer ficar devendo, sem cair de 10. A lista de reserva existe caso algo do escopo comprometido não saia como planejado — não é necessária pra bater a meta.
