# Project State

## Decisions

### AD-001 — Regra de senha forte duplicada em Dart e TypeScript, acoplada por teste
**Data**: 2026-08-10
**Contexto**: O checklist do TCC (item 2.3) exige senha forte validada no cliente **e** na API. Não existe build step compartilhado entre o app Flutter e o backend Node.
**Decisão**: Manter duas implementações (`lib/core/validation/password_policy.dart` e `backend/src/lib/passwordPolicy.ts`) com a mesma tabela de casos testada nos dois lados. A tabela vive em `design.md` da feature `checklist-tcc-compliance`.
**Consequência**: Divergência entre as camadas aparece como teste vermelho, não como bug silencioso em produção.

### AD-002 — Erros da API passam a carregar `code` no corpo
**Data**: 2026-08-10
**Contexto**: `401` hoje significa tanto "token inválido" (deve deslogar) quanto "senha atual incorreta" na troca de senha (não deve deslogar). Um interceptor que olhasse só o status causaria logout indevido.
**Decisão**: Toda resposta de erro de autenticação e de banco inclui `{ error, code }`. O app decide pelo `code`, nunca pelo status isolado.
**Consequência**: Contrato documentado em `docs/architecture/backend.md`; novos erros devem declarar um `code`.

### AD-003 — Papel do usuário lido do banco a cada requisição
**Data**: 2026-08-10
**Contexto**: O TTL do JWT é de 30 dias (item 5.2 ficou fora de escopo), então um claim de papel dentro do token ficaria obsoleto por até um mês.
**Decisão**: `requireRole` resolve `user.role` via Prisma em cada requisição protegida.
**Consequência**: Uma query extra nas rotas de dados; rebaixamento de papel vale imediatamente.

### AD-004 — Auditoria é best-effort
**Data**: 2026-08-10
**Contexto**: A trilha de auditoria (item 4.11) não pode custar a gravação de um registro clínico do paciente, e a migração pode não estar aplicada em toda máquina de desenvolvimento.
**Decisão**: `recordAudit` engole a própria exceção e apenas loga.
**Consequência**: A trilha pode ter lacunas em falha de banco; isso é aceito e documentado.

### AD-005 — Itens 3.2 (2FA), 4.4 (DER) e 5.2 (timeout de sessão) fora do escopo
**Data**: 2026-08-10
**Contexto**: Decisão do usuário ao aprovar o escopo da feature `checklist-tcc-compliance`.
**Decisão**: Não implementar 2FA/TOTP, DER por engenharia reversa nem expiração por inatividade nesta iteração.
**Consequência**: `AuthSession.expiresAt`/`isRevoked` permanecem sem leitura; o checklist registra esses três itens como fora de escopo, não como pendência esquecida.

### AD-006 — `CLAUDE.md` passa a ser versionado
**Data**: 2026-08-20
**Contexto**: O arquivo estava no `.gitignore` desde `c4adc7f` ("Remove secrets") e nunca foi rastreado. O P6 — documentação divergindo do código — já havia reincidido duas vezes, e sem o arquivo no git a divergência nunca aparece em diff de PR.
**Decisão**: Remover a linha do `.gitignore` e versionar o `CLAUDE.md`. Ele fica restrito a invariantes estáveis (constraints nativas, comandos, mapa de camadas); detalhe volátil vive em `docs/`.
**Consequência**: Divergência vira item de revisão de PR (checklist em `docs/guides/qa-process.md`), não descoberta arqueológica. O arquivo não contém segredo algum — foi lido por inteiro antes de versionar.

### AD-007 — CI/CD fora de escopo enquanto os `.so` não estiverem disponíveis ao runner
**Data**: 2026-08-20
**Contexto**: A rubrica 39 pedia pipeline com artefato de build. Os `.so` proprietários (`libg.so`, bibliotecas Abbott) são gitignored (`.gitignore:58`) e não estão no repositório.
**Decisão**: Não implementar a pipeline agora. O motivo e a condição de retomada ficam registrados na seção 2.4 do `ARCHITECTURE_FIX_PLAN.md`; os mesmos gates rodam localmente e são item obrigatório da revisão de PR.
**Consequência**: Nenhum runner limpo produz APK funcional, então um job de build seria teatro. Retomar exige caminho autorizado de distribuição dos binários (secret store com licença que permita, ou runner self-hosted provisionado).

### AD-008 — Valor sem bits de rate/alarm é descartado no caminho não solicitado
**Data**: 2026-08-20
**Contexto**: Um código de retorno inesperado do `SIprocessData` que caia na faixa 400–6000 décimos vira uma glicemia clinicamente plausível e falsa.
**Decisão**: No caminho não solicitado, só decodificar valores `>= 0x10000` (com bits de rate ou alarm). Nos dois caminhos, rejeitar payload com bits 56–63 diferentes de zero.
**Consequência**: Erro assimétrico assumido: descartar atrasa uma leitura, que chega igual pelo `getlastGlucose`; aceitar entrega número inventado. A regra vive no decoder puro (`SibionicsGlucoseDecoder`) para ser testável na JVM, já que as classes acopladas ao Android não têm teste no projeto.

---

## Handoff

**Feature ativa**: `arch-phases-3-5` (Fases 3, 4 e 5 do `docs/ARCHITECTURE_FIX_PLAN.md`)
**Fase**: Execute em andamento — 7 de 34 tarefas concluídas (Fase 1 inteira + T6 + T7). Parada pedida pelo usuário ao fim do lote 2; o lote foi encerrado no T7 em vez de ir até o T13.
**Branch**: `feat/arch-phases-3-5`, criada do HEAD de `feat/arch-phases-0-2-gaps` (que segue 15 commits à frente da `main`). Nada foi enviado ao remoto; `git push` continua exigindo autorização explícita.
**Commits**: `037a8bc` (planejamento) e `8e9ee64..6e94fbc` — 7 commits de implementação.
**Concluído**: T1–T5 (identidade UUID no app: modelos, SQLite v3 com migração e backfill, linhas e `mark*Synced` por `id`, `id` no datasource remoto, edição/remoção por `id`), T6 (`carbRepository` com Prisma injetado) e T7 (`/carbs` em camadas + paginação `before`/`limit` + suíte de rota com supertest). Gates verdes na parada: 219 testes Flutter com `flutter analyze` limpo, 70 testes de backend com `tsc --noEmit` limpo.
**Próximo passo**: T8 (`insulinRepository` com Prisma injetado), depois T9 (rota de insulin em camadas), T10–T13 (alerts unitários, verificação de índices, cobertura ≥75%) e então T14, que abre o lote 3 (op-log).
**Padrão estabelecido para T8–T11**: `carbRepository`/`carbService`/`carbController` + `createCarbsRouter({ controller, requireRoleOptions })` são a forma a copiar. O `Result`/`Failure` de `src/services/result.ts`, o `parsePageQuery` de `src/services/pagination.ts` e o `sendFailure` de `src/controllers/httpFailure.ts` são compartilhados — reaproveitar, não duplicar. Nos testes, `tests/helpers/testApp.ts` (app descartável + token assinado) e `tests/helpers/fakePrismaEvents.ts` (duplo Prisma em memória que filtra, ordena e pagina de verdade) cobrem insulin e alerts sem mudança.
**Armadilhas já pagas no T7, não repetir**: ids em teste de rota precisam ser UUID válidos, senão o service responde 400 antes de chegar ao repositório; e o handler de erro do Express só é reconhecido com a aridade de 4 parâmetros (`err, req, res, next`), senão o erro cai no handler padrão e o teste de 500 passa por engano.
**Sem trabalho não commitado desta feature**: a árvore está limpa fora dos arquivos alheios listados abaixo.
**Decisão pendente de registro**: `AD-009` (op-log de operações unitárias idempotentes; replace-all restrito a coleções append-only) está desenhado em `design.md` e previsto para ser gravado aqui no T34.
**Verificador**: não roda ainda — é o passo de fechamento da feature inteira, e faltam 27 tarefas.
**Arquivos sujos preexistentes, alheios a este trabalho**: `.claude/settings.local.json`, `CHANGELOG.md`, alterações em `.specs/features/checklist-tcc-compliance/`, a deleção de `TCC I - Checklist - Avaliacao.md` e os diretórios não rastreados `.agents/`, `.cursor/`, `.windsurf/`.
