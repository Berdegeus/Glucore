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

### AD-010 — `feat/arch-phases-3-5` adotou a estrutura de microsserviços do `main` remoto, descartando o backend em camadas construído nas Fases 2–3
**Data**: 2026-08-30
**Contexto**: Depois da Fase 7, `origin/main` (não fetchado até então — o `main` local estava 38 commits atrasado) já tinha absorvido `refactor/backend-microservices` (PR #31, mergeado 2026-08-27): `backend/src/` inteiro migrado para um workspace npm (`packages/shared` + `services/glucose-service/src/modules/<nome>/{routes,controller,service,repository,schema,mapper}`), suíte trocada de `node:test` para Vitest com Postgres real, e CRUD por item já implementado para carbs e insulin — só faltando paginação e o CRUD por item de alerts (que ainda era só replace-all, sem `id` no DTO). O trabalho das Fases 2–3 desta feature (T6–T13) tinha construído a mesma camada de item+validação, só que em cima da estrutura antiga (`backend/src/{repositories,services,controllers}/`), agora redundante.
**Decisão**: Decisão explícita do usuário: merge de `origin/main` nesta branch (não rebase), descartando por completo os arquivos de T6–T13 (`backend/src/repositories/`, `backend/src/services/`, `backend/src/controllers/` e seus testes) em favor do que já existia no `main`. Em cima da estrutura herdada, esta branch acrescentou só o que faltava: `parsePageQuery` compartilhado (`packages/shared/src/util/pageQuery.ts`) com paginação `before`/`limit` em carbs, insulin e alerts; e o CRUD por item completo de alerts (schema, mapper com `id`, repository, service, controller, rotas), replicando o padrão já estabelecido pelos outros dois módulos.
**Consequência**: Backend final tem 357 testes (era 312 no `main`, +45), cobertura 97%+ statements sobre o limiar de 90% já configurado. Um bug de portabilidade Windows pré-existente no `main` foi corrigido no caminho (`globalSetup.ts`: `execFileSync('npx', ...)` sem `shell: true` lança `EINVAL` no Windows por causa da correção de segurança CVE-2024-27980 para `.cmd`/`.bat` — commit `b458ac4`). `.env`/`.env.test` locais criados em `backend/services/glucose-service/` (gitignorados) e o banco `glucore_test` provisionado à mão nesta máquina — não documentado em nenhum guia de setup, só registrado aqui. **Perda**: na resolução de um stash mal-sucedido durante a reconciliação, `.agents/`, `.cursor/`, `.windsurf/` (cópias espelhadas do skill `tlc-spec-driven` para outras ferramentas, prováveis de regenerar sozinhas) e `docs/backend-features-a-portar.patch` (conteúdo desconhecido, não recuperável via `git fsck`) foram apagados sem backup — comunicado ao usuário na hora, sem confirmação de que o `.patch` fazia falta.

### AD-011 — A Fase 3 do backend (extração do `auth-service`) foi reconciliada nesta branch, e as duas frentes saem numa PR só
**Data**: 2026-08-31
**Contexto**: Em paralelo a esta feature, a branch `refactor/auth-service` levou o plano de microsserviços da Fase 2 para a Fase 3: `User`, `AuthCredential`, `PasswordResetToken` e `AuthSession` saíram do `glucose-service` para um `auth-service` próprio (:3002, banco `glucore_auth`), com migration destrutiva no banco clínico. As duas branches saíram do mesmo `main` (`e4fdafe`) e ambas mexem no `glucose-service`. O `git merge-tree` acusava **um** conflito textual (`backend/README.md`), o que subestimava o problema: o conflito real era semântico. Esta branch mantinha `registerUser()` — um fixture que registra pelo `POST /auth/register` — e o usava 30 vezes nos testes de rota, incluindo os ~300 linhas novas de alerts e paginação; a Fase 3 removeu essa rota do `glucose-service`. Mesclar sem intervenção compila em nada: testes chamando um fixture inexistente, mais um `tests/routes/auth.test.ts` inteiro exercitando rotas que saíram.
**Decisão**: Decisão explícita do usuário entre três ordens possíveis (esta primeiro, a Fase 3 primeiro, ou reconciliar as duas): **reconciliar num branch só e abrir uma PR só**. Base `feat/arch-phases-3-5`, merge de `refactor/auth-service` por cima. O `auth.test.ts` e o `db.ts` antigo saíram pelo merge automático (a Fase 3 os removeu e esta branch não os tocou); restou converter à mão as duas chamadas de `registerUser` nos casos novos de alerts para `signedInPatient()`, que semeia o `Patient` e assina o token em vez de passar por uma rota que não existe mais.
**Consequência**: **382 testes de backend** (357 desta branch + a suíte do `auth-service`, menos os 44 de `/auth` que deixaram de rodar contra o `glucose-service`), cobertura 96,23% statements / 91,52% branches, acima do limiar de 90%. 345 testes Flutter e `flutter analyze` limpos, sem regressão. O fix de portabilidade Windows do `globalSetup.ts` (`shell: true`, ver `AD-010`) foi replicado no `globalSetup.ts` do `auth-service`, que nasceu como cópia do anterior e teria reintroduzido o mesmo `EINVAL`. **Herdadas da Fase 3, e válidas até o gateway existir**: o cadastro grava só a conta (os campos de paciente do `register` não têm destino, e o `Patient` nasce com os defaults 80/180 no primeiro acesso a dados); `GET/PUT /auth/profile` respondem só o bloco de conta; e não há endereço único — cadastro e login em :3002, resto em :3001 —, então o app não roda ponta a ponta até a Fase 4.

---

## Handoff

**Feature ativa**: `arch-phases-3-5` (Fases 3, 4 e 5 do `docs/ARCHITECTURE_FIX_PLAN.md`) — **concluída, verificada, e reconciliada com o `origin/main`**.
**Fase**: Execute + verificação independente concluídos (34/34 tarefas). Depois disso, dois bugs reportados pelo usuário no app real foram corrigidos (logout não redirecionava; senha errada não mostrava mensagem), e a branch foi mesclada com `origin/main` — ver `AD-010`.
**Branch**: `feat/auth-service-and-app-phases-3-5` — `feat/arch-phases-3-5` (PR #33, aberta 2026-08-31) com a Fase 3 do backend mesclada por cima; ver `AD-011`. As duas frentes passam a sair numa PR só, e a #33 fica superada por ela.
**Veredito do Verificador**: **PASS**, mas anterior ao merge — `.specs/features/arch-phases-3-5/validation.md` cobre a faixa `037a8bc..94a2afb`, antes do `origin/main` entrar. Os números de teste desse relatório (146 backend) estão desatualizados; o estado real pós-merge é o da linha "Gates depois do merge" abaixo. Não houve nova rodada de verificação sobre o resultado da reconciliação.
**Decisões registradas**: `AD-009` (op-log) e `AD-010` (adoção da estrutura de microsserviços do `main`, descarte do backend em camadas das Fases 2–3) — ambas na seção Decisions acima.

**Dois bugs de produção corrigidos após o PASS, direto no app rodando no celular do usuário:**
- `9693563` — logout não redirecionava para a tela de login (`SettingsPage` fica numa rota empilhada sobre `AuthGate`; faltava `Navigator.popUntil` antes do `logout()`, no mesmo padrão de `_handleSessionExpired`).
- `3860bb8` — senha errada não mostrava mensagem de erro (`AuthGate` trocava para spinner de tela cheia durante `AuthStatus.loading`, inclusive durante login, destruindo o estado da `LoginPage` antes da mensagem de falha chegar). Ambos com teste de regressão que falha sem o fix (confirmado revertendo cada um).

**Gates depois da reconciliação com a Fase 3 do backend** (ver `AD-011`): 345 testes Flutter, `flutter analyze` limpo, **382 testes de backend** em dois serviços (Vitest + Postgres real; era 357 nesta branch e 312 no `main`), cobertura 96,23% statements sobre o limiar de 90%. Não rodei Kotlin nem `:app:assembleDebug` de novo — nada em `android/` mudou desde a última execução.

**A suíte de backend agora exige dois bancos**: `glucore_test` e `glucore_auth_test`, cada URL vindo do `.env.test` do respectivo serviço. E precisa rodar **da raiz de `backend/`**: de dentro de um serviço o Vitest perde `fileParallelism: false`/`maxWorkers: 1`, que são opções de raiz, e as duas suítes truncam o mesmo banco em paralelo — falha aleatória, longe da causa.

**O que a reconciliação com o `main` trouxe e o que esta branch acrescentou** (detalhe em `AD-010`): o `main` já tinha o backend inteiro reestruturado em workspace npm (`backend/services/glucose-service/src/modules/`) com CRUD por item em carbs e insulin. Esta branch descartou seu próprio backend em camadas (T6–T13, estrutura antiga) e acrescentou, em cima da estrutura do `main`: paginação `before`/`limit` (compartilhada via `packages/shared/src/util/pageQuery.ts`) nas três listagens, e o CRUD por item completo de alerts (que no `main` ainda era só replace-all, sem `id` no DTO).

**Achados registrados, sem ação — valem uma decisão futura:**
- O gate Android engana: `./gradlew :app:testDebugUnitTest` volta `BUILD SUCCESSFUL` com a task `UP-TO-DATE` e **zero testes executados**. Só `--rerun-tasks` produz os 34 de verdade. Quem ler o primeiro verde está lendo nada — vale registrar isso em `docs/guides/qa-process.md`.
- `AppTheme` mantém 27 constantes `Color` que nenhum código de `lib/` usa; o único consumidor é `glucore_colors_test.dart`, como âncora de fidelidade da migração de tema.
- PLAN-04 pede doc de contrato atualizado **no mesmo commit** da mudança; os docs vieram num commit final (`edeebb0`). Conteúdo correto, cadência divergente.
- `sensor_link_page.dart:437` usa `Colors.grey.shade600` direto (fora do THEME-05 como escrito, mas lê errado no escuro); `GlucoseZoneX.label` devolve português hardcoded, furando o l10n.
- `docs/reference/platform-channels.md` não documenta os métodos NFC do Libre 2 nem o campo `nfc` do evento — lacuna anterior a esta feature, e o `CLAUDE.md` diz que esse doc vence em conflito.
- **`docs/backend-features-a-portar.patch` foi perdido** durante a reconciliação (ver `AD-010`) — conteúdo desconhecido, não recuperado. Se fizer falta, não há como restaurar por git.
- `.agents/`, `.cursor/`, `.windsurf/` (cópias do skill `tlc-spec-driven`) também foram apagados no mesmo incidente; prováveis de regenerar sozinhos na próxima sincronização de skills, mas não confirmado.

**Pendências conhecidas, fora do escopo desta feature**: validação em device físico arm64 com sensor real (sem hardware neste ambiente); remoção dos `POST` de coleção deprecated e, junto com eles, das escritas de coleção do diário no cliente (`saveCarbs`/`saveInsulin`/`saveAlerts` e `mark*Synced`), hoje mantidas de propósito como caminho de rollback e documentadas como tal; P28 segue parcial no caminho de coleção.
**Próximo passo**: decisão do usuário — abrir PR (exige autorização para `git push`) ou seguir para outra frente. Considerar uma nova rodada do Verificador sobre o `dcfbee1..8d5e8f9` antes do PR, já que a rodada anterior não cobre o merge.
**Sem trabalho não commitado desta feature**: a árvore está limpa fora dos arquivos alheios.
**Arquivos sujos preexistentes, alheios a este trabalho**: `.claude/settings.local.json`, `CHANGELOG.md`, alterações em `.specs/features/checklist-tcc-compliance/`, a deleção de `TCC I - Checklist - Avaliacao.md`.
