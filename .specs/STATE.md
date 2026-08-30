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

### AD-009 — Mutação de diário viaja como operação unitária idempotente num op-log local
**Data**: 2026-08-29
**Contexto**: Qualquer alteração no diário disparava `deleteMany` + `createMany` da coleção inteira do paciente, truncada em 100 itens (P2). Com dois aparelhos logados na mesma conta, o último a sincronizar apagava o que o outro tinha registrado. Um delete também não tinha como viajar: linha apagada não tem onde carregar uma flag `synced`.
**Decisão**: Toda criação, edição e remoção de carboidrato, insulina e alerta enfileira uma operação unitária em `pending_ops` na mesma transação da gravação local, e a fila é drenada em ordem de `seq` (`INTEGER PRIMARY KEY AUTOINCREMENT`, imune ao relógio do aparelho). A operação é um `upsert` idempotente — `PUT`, e no 404 cai para `POST` com o mesmo id —, então reenviar depois de uma resposta perdida produz o mesmo estado final sem duplicar linha. A drenagem para na primeira falha recuperável, preservando a op e todas as posteriores, porque uma op posterior pode depender da anterior. O replace-all fica restrito às coleções append-only: leituras de glicose e thresholds, que o usuário nunca edita por item.
**Consequência**: Uma edição passa a alterar exatamente uma linha no Postgres, e dois aparelhos deixam de se sobrescrever. O custo é uma segunda noção de pendência: no diário quem responde "falta enviar" é `pending_ops`, não a flag `synced` — que nessas três tabelas sobrevive só como marca de origem do dado. As duas semânticas convivem e estão documentadas em `docs/reference/data-models.md`; unificá-las exigiria migrar leituras e thresholds para o op-log, cujo ganho seria zero sem edição unitária.

---

## Handoff

**Feature ativa**: `arch-phases-3-5` (Fases 3, 4 e 5 do `docs/ARCHITECTURE_FIX_PLAN.md`)
**Fase**: Execute concluído — **34 de 34 tarefas**. Falta só o Verificador, que é o passo de fechamento da feature.
**Branch**: `feat/arch-phases-3-5`, criada do HEAD de `feat/arch-phases-0-2-gaps` (que segue 15 commits à frente da `main`). Nada foi enviado ao remoto; `git push` continua exigindo autorização explícita.
**Concluído**: as sete fases. Fase 1 (identidade UUID no app, SQLite v3 com migração e backfill), Fase 2 (`/carbs` e `/insulin` em camadas + paginação), Fase 3 (alerts unitários, índices verificados, cobertura), Fase 4 (op-log `pending_ops`, drenagem ordenada idempotente, repositório por item sem truncamento, cubit por entrada), Fase 5 (`domain/` no patient: entidades, contrato, doze casos de uso, cubit atrás deles), Fase 6 (tema claro/escuro em `ThemeExtension`, preferência persistida, cores por contexto em todo o app) e Fase 7 (rename do auth, poda do transmissor em Dart e Kotlin, `WarmupPayload` e stubs nativos removidos, documentos de contrato e plano atualizados).
**Gates na entrega**: 340 testes Flutter com `flutter analyze` limpo, 146 de backend com `tsc --noEmit` limpo, 34 de Kotlin, e `:app:assembleDebug` verde com o C++ religado.
**Próximo passo**: rodar o **Verificador** (sub-agente novo, autor ≠ verificador) sobre a feature inteira: checagem ancorada na spec com evidência `file:line` por AC, sensor de discriminação por mutação, e `validation.md` escrito em `.specs/features/arch-phases-3-5/`. Depois disso, a tabela de rastreabilidade da spec passa de `Implementing` para `Verified` e `validate_state.py` deve sair com código 0.
**Decisões registradas**: `AD-009` (op-log de operações unitárias idempotentes; replace-all restrito a coleções append-only) está gravado na seção Decisions acima.
**Pendências conhecidas, fora do escopo desta feature**: validação em device físico arm64 com sensor real (sem hardware neste ambiente); remoção dos `POST` de coleção deprecated e, junto com eles, das escritas de coleção do diário no cliente (`saveCarbs`/`saveInsulin`/`saveAlerts` e `mark*Synced`), hoje mantidas de propósito como caminho de rollback e documentadas como tal; P28 segue parcial no caminho de coleção; `docs/reference/platform-channels.md` não documenta os métodos NFC do Libre 2 nem o campo `nfc` do evento — lacuna anterior a esta feature.
**Sem trabalho não commitado desta feature**: a árvore está limpa fora dos arquivos alheios listados abaixo.
**Arquivos sujos preexistentes, alheios a este trabalho**: `.claude/settings.local.json`, `CHANGELOG.md`, alterações em `.specs/features/checklist-tcc-compliance/`, a deleção de `TCC I - Checklist - Avaliacao.md` e os diretórios não rastreados `.agents/`, `.cursor/`, `.windsurf/`.
