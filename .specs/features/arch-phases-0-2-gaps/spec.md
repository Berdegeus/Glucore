# Fases 0–2 do plano arquitetural — lacunas remanescentes — Specification

## Problem Statement

O levantamento de 2026-08-20 contra `docs/ARCHITECTURE_FIX_PLAN.md` mostra que as Fases 0, 1 e 2 já estão majoritariamente implementadas e verificadas em código: P3, P7, P8, P9, P10, P11, P12 (parcial) e P14/P15 estão resolvidos e com evidência no `ARCHITECTURE_REVIEW.md`. Restam seis lacunas — duas de código/qualidade (P6 reincidiu; P16 ficou parcial) e quatro de registro técnico que a rubrica do TCC cobra (26, 42, 23, 27) — mais o item 2.4 (CI/CD, rubrica 39), que o usuário retirou do escopo. Sem fechar essas lacunas, o plano fica "quase pronto" indefinidamente e a banca não encontra a evidência dos itens comprometidos.

## Goals

- [ ] Fechar P6 de forma durável: `CLAUDE.md` deixa de afirmar o que o código não faz, e passa a apontar para `docs/` no detalhe volátil.
- [ ] Fechar o residual de P16: nenhum valor implausível vindo de código desconhecido do `SIprocessData` vira leitura de glicose, com teste JVM que mata a mutação.
- [ ] Produzir os três registros técnicos comprometidos na rubrica (26 — README do backend; 42 — arquitetura multissensor; 23/27 — processo de qualidade), cada um com conteúdo verificável contra o código.
- [ ] Deixar `ARCHITECTURE_REVIEW.md` e `ARCHITECTURE_FIX_PLAN.md` fiéis ao estado real ao fim do trabalho, incluindo o registro do porquê do CI/CD ter saído do escopo.

## Out of Scope

Explicitamente excluído. Documentado para evitar scope creep.

| Feature | Reason |
| ------- | ------ |
| 2.4 — CI/CD com GitHub Actions (rubrica 39) | Retirado do escopo pelo usuário nesta iteração. Os `.so` proprietários (`libg.so`, bibliotecas Abbott) são gitignored (`.gitignore:58`), então nenhum runner limpo consegue produzir um APK funcional. Fica registrado como bloqueio documentado no plano, não como pendência esquecida. |
| Itens já resolvidos das Fases 0–2 (P3, P7, P8, P9, P10, P11, P12-parcial, P14, P15) | Verificados em código no levantamento de 2026-08-20; retocá-los seria churn sem ganho. |
| Problemas novos P17–P35 do `ARCHITECTURE_REVIEW.md` (inclusive P29, P32, P33, herdados da Fase 2) | Foram catalogados na revisão independente de 2026-07-07, fora do recorte das Fases 0–2. |
| Fases 3, 4 e 5 do plano | Fora do pedido; a Fase 3 inclusive já está implementada em parte. |
| Validação em device físico (sessão BLE ≥ 1 h, background 30 min) | Exige hardware arm64 com sensor real; não é executável neste ambiente. Continua listada como verificação manual pendente no plano. |
| Reescrever o backend em camadas (rubrica 33) | Comprometido para a Fase 4, junto dos endpoints por item. |

---

## Assumptions & Open Questions

Toda ambiguidade está resolvida ou registrada aqui.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Branch de trabalho | `feat/tcc-checklist-compliance` mergeada em `main` (fast-forward, apenas local), e o trabalho segue em `feat/arch-phases-0-2-gaps` criada da `main` mergeada | Decisão explícita do usuário nesta sessão. Nenhum `push` é feito sem autorização à parte | y |
| Regra do gate de leitura direta | No caminho de código desconhecido do `SIprocessData`, só decodificar valores com bits de rate/alarm presentes (`valor >= 0x10000`); valores menores são descartados com log | Um código de protocolo que caia na faixa 400–6000 décimos hoje vira uma leitura clinicamente plausível e falsa. Descartar atrasa a leitura (o caminho `getlastGlucose`/código 1 continua entregando), enquanto aceitar entrega glicemia inventada — o erro assimétrico manda descartar | y |
| Bits não usados do formato empacotado | Bits 56–63 diferentes de zero rejeitam a leitura nos dois caminhos (direto e `getlastGlucose`) | Esses bits não existem no formato Juggluco documentado no `CLAUDE.md`; valor com lixo ali não é uma leitura desse protocolo | y |
| Log do fallback de timestamp | `SibionicsGlucoseDecoder` passa a expor se usou fallback; quem loga é o manager Android (`Log.w` com tag e valor bruto) | Manter o decoder puro é o que torna P16 testável na JVM; logar dentro dele reintroduziria dependência de Android | y |
| Escopo do doc multissensor | Um doc de referência curto (`docs/reference/multi-sensor-architecture.md`) descrevendo o contrato `BrandBleManager`, as três marcas e o ponto de escolha por marca — sem duplicar o protocolo Sibionics, que já vive em `docs/architecture/sensor-pipeline.md` | O critério 42 pede registro técnico da arquitetura multissensor, não um segundo manual de protocolo | y |
| Exemplo real de reprovação em QA (rubrica 23) | A rodada 1 de verificação da feature `checklist-tcc-compliance` (5 gaps + 2 mutantes sobreviventes), o fix round (`19d67ed`, `ea7d107`, `12f98b8`, `b2da51f`, `0174cc0`) e a rodada 2 PASS, tudo já registrado em `.specs/features/checklist-tcc-compliance/validation.md` | É um caso real, rastreável por commit, do próprio projeto — melhor evidência que fabricar um exemplo de board | y |
| Onde mora o doc de processo de QA | `docs/guides/qa-process.md`, referenciado no `docs/README.md` | `docs/guides/` já hospeda processo (`versioning-and-branches.md`, `adding-features.md`); `docs/reference/` é para contrato técnico | y |
| Exemplos de payload do README do backend | Extraídos por leitura dos handlers em `backend/src/routes/*.ts` e dos schemas Prisma, não inventados; requisições não são executadas contra um banco vivo | Não há Postgres garantido neste ambiente; um exemplo derivado do código é verificável campo a campo pelo verificador | y |
| Lock file do Excel versionado | `docs/~$TCC_Acompanhamento_Bernardo_Eduardo.xlsx` foi commitado por engano em `ae12b7f`; sai do versionamento e entra no `.gitignore` (`~$*`) | Arquivo de lock do Office não é artefato de projeto e trava `git checkout`/`merge` enquanto a planilha está aberta — foi exatamente o que bloqueou o merge nesta sessão | y |

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P1: `CLAUDE.md` que não mente sobre a arquitetura ⭐ MVP

**User Story**: Como pessoa (ou agente) que abre o repositório pela primeira vez, quero que o `CLAUDE.md` descreva a arquitetura que existe hoje, para não implementar em cima de uma persistência e de uma camada Android que já não são assim.

**Why P1**: P6 é o único problema das Fases 0–2 que já reincidiu — foi corrigido uma vez e voltou a divergir. É também pré-requisito dos outros docs: eles são referenciados a partir dele.

**Acceptance Criteria**:

1. The system SHALL descrever, no `CLAUDE.md`, a persistência do paciente como local-first, nomeando `LocalPatientDataSource` (sqflite), `PatientSyncService` e `PatientRepository.refreshFromRemote`.
2. The system SHALL descrever, no `CLAUDE.md`, a camada Android como `GlucoreApp → SensorCore → SensorPlatformImpl → BrandBleManager` com as implementações `SibionicsBleManager`, `AccuChekBleManager` e `Libre2BleManager`, mais `CgmForegroundService` e `LibreNfcHandler`.
3. IF uma afirmação do `CLAUDE.md` descreve detalhe que muda por sprint (fluxo de dados, lista de telas, estado de features) THEN o `CLAUDE.md` SHALL substituí-la por um ponteiro para o documento correspondente em `docs/`.
4. The system SHALL manter no `CLAUDE.md` as invariantes nativas que hoje já constam (guarda de SIGSEGV, resolução JNI, `arm64-v8a`, layout de `getlastGlucose()`, stubs `tk.glucodata`), sem removê-las na simplificação.

**Independent Test**: `grep` no `CLAUDE.md` encontra `LocalPatientDataSource`, `PatientSyncService`, `BrandBleManager`, `CgmForegroundService`; não encontra a afirmação de que o `PatientCubit` persiste "via REST to the backend through `RemotePatientDataSource`"; cada nome de classe citado existe em `lib/` ou `android/`.

---

### P1: Leitura implausível não chega ao Flutter ⭐ MVP

**User Story**: Como paciente, quero que um código inesperado do sensor nunca vire um número de glicemia na tela, para não tomar decisão clínica sobre um valor inventado pelo app.

**Why P1**: É o residual explícito de P16 e o único risco clínico do recorte. A revisão descreve o cenário: durante um sync ativo, um código vendor inesperado ainda pode ser decodificado como leitura plausível.

**Acceptance Criteria**:

1. IF o valor bruto entregue pelo caminho de código desconhecido do `SIprocessData` for menor que `0x10000` THEN o app SHALL descartar o valor sem emitir leitura e SHALL registrar um log de descarte com o valor recebido.
2. IF os bits 56–63 do valor empacotado forem diferentes de zero THEN o decoder SHALL rejeitar a leitura, retornando `null`, em qualquer um dos dois caminhos de decodificação.
3. The system SHALL continuar aceitando, no caminho `getlastGlucose`, leituras empacotadas na faixa de 400 a 6000 décimos de mg/dL com bits 56–63 zerados.
4. WHEN o timestamp bruto do sensor for nulo, zero ou negativo e o app recorrer ao relógio do dispositivo THEN o app SHALL registrar um log identificando o uso do fallback e o valor bruto recebido.
5. The system SHALL manter o `SibionicsGlucoseDecoder` sem qualquer dependência de classe Android, de modo que todas as regras acima sejam exercitáveis por teste JVM.

**Independent Test**: `./gradlew :app:testDebugUnitTest` cobre: valor `4` (código de protocolo) descartado no caminho direto; `0x0100_0000_0000_0000 or 1043` rejeitado por bits altos sujos; `1043` com rate e alarm no caminho `getlastGlucose` aceito como 104,3 mg/dL; `normalizeTimestampMs` sinalizando fallback para `null`/`0`/negativo.

---

### P1: `backend/README.md` que permite subir e chamar a API sem ler o código ⭐ MVP

**User Story**: Como avaliador ou novo desenvolvedor, quero um README do backend com setup e todas as rotas exemplificadas, para subir o serviço e exercitar cada endpoint sem abrir `src/routes/`.

**Why P1**: É o item 0.6 do plano (rubrica 26) e a evidência mais direta que a banca consegue conferir sem device.

**Acceptance Criteria**:

1. The system SHALL documentar, em `backend/README.md`, todas as rotas registradas em `backend/src/index.ts` (`/auth`, `/readings`, `/carbs`, `/insulin`, `/alerts`, `/settings/alerts`), cada uma com método, caminho, se exige `Authorization: Bearer`, exemplo de corpo de requisição e exemplo de corpo de resposta.
2. The system SHALL documentar o passo a passo de instalação e execução (`npm install`, `npx prisma migrate dev`, `npm run dev`, `npm test`) e a porta padrão `3001`.
3. The system SHALL listar todas as variáveis de ambiente lidas pelo backend (`JWT_SECRET`, `DATABASE_URL`, `CORS_ORIGIN`, `PORT`), indicando quais são obrigatórias e o efeito de cada uma.
4. IF o backend responde erro de autenticação ou de banco THEN o README SHALL documentar o formato `{ error, code }` e a lista de `code` possíveis, conforme já implementado.
5. WHERE um endpoint aplica limitação de taxa, o README SHALL declarar o limite e a resposta `429`.

**Independent Test**: Para cada arquivo em `backend/src/routes/`, todo handler exportado aparece no README com o mesmo método e caminho; os campos dos exemplos batem com o `schema.prisma` e com o handler.

---

### P2: Arquitetura multissensor registrada (rubrica 42)

**User Story**: Como avaliador do TCC, quero um documento técnico curto sobre o suporte a múltiplas marcas de sensor, para entender como Sibionics, Accu-Chek e Libre 2 convivem sem ler quatro arquivos Kotlin.

**Why P2**: A funcionalidade já está pronta e em uso; falta só o registro. Não altera comportamento, por isso vem depois dos itens que tocam código.

**Acceptance Criteria**:

1. The system SHALL prover `docs/reference/multi-sensor-architecture.md` descrevendo o contrato comum `BrandBleManager` e o que cada implementação de marca precisa fornecer.
2. The system SHALL descrever, nesse documento, os três caminhos de aquisição em uso: Sibionics (BLE + JNI `libg.so`), Accu-Chek SmartGuide (BLE com PIN) e Libre 2 (NFC + biblioteca Abbott).
3. The system SHALL referenciar esse documento a partir do `CLAUDE.md` e de `docs/README.md`.
4. The system SHALL citar, para cada afirmação estrutural do documento, o arquivo Kotlin correspondente em `android/app/src/main/kotlin/com/berdegeus/glucore/`.

**Independent Test**: Cada classe citada no documento existe no caminho indicado; `docs/README.md` e `CLAUDE.md` linkam o arquivo.

---

### P2: Processo de qualidade registrado com caso real (rubricas 23 e 27)

**User Story**: Como avaliador, quero ver o processo de QA que o time realmente pratica e ao menos um caso concreto de trabalho reprovado e corrigido, para julgar processo por evidência e não por declaração.

**Why P2**: Depende dos outros documentos existirem (o checklist de PR referencia `CLAUDE.md`/`docs/`), e não bloqueia nenhum código.

**Acceptance Criteria**:

1. The system SHALL prover `docs/guides/qa-process.md` descrevendo os gates em uso (`flutter analyze`, `flutter test`, `./gradlew test`, `npm test`, `npx tsc --noEmit`) e quando cada um roda.
2. The system SHALL incluir nesse documento um checklist de revisão de PR contendo o item "mudou camada ou fluxo? atualizou `CLAUDE.md`/`docs/`" — o mecanismo que impede a terceira reincidência de P6.
3. The system SHALL registrar nesse documento a regra da rubrica 27: toda mudança em `backend/prisma/schema.prisma` acompanha a migration versionada no mesmo PR.
4. The system SHALL descrever um caso real de reprovação em QA com rastreabilidade por commit: os gaps da rodada 1, os commits do fix round e o veredito PASS da rodada 2.
5. The system SHALL referenciar `docs/guides/qa-process.md` a partir de `docs/README.md`.

**Independent Test**: Os hashes citados no caso real existem no histórico (`git cat-file -e`) e `docs/README.md` linka o guia.

---

### P2: Plano e revisão fiéis ao estado real

**User Story**: Como quem retomar o plano na próxima sprint, quero que `ARCHITECTURE_REVIEW.md` e `ARCHITECTURE_FIX_PLAN.md` digam o que sobrou de verdade, para não reabrir trabalho já feito nem esquecer o que foi cortado.

**Why P2**: É a regra transversal 5 do próprio plano; fecha o ciclo depois que as demais histórias entregam.

**Acceptance Criteria**:

1. WHEN P6 e o residual de P16 forem entregues THEN `ARCHITECTURE_REVIEW.md` SHALL marcá-los como resolvidos com evidência em formato `arquivo:linha`, preservando o histórico anterior do item.
2. The system SHALL registrar no `ARCHITECTURE_FIX_PLAN.md` que o item 2.4 (rubrica 39, CI/CD) saiu do escopo, com o motivo (binários proprietários fora do versionamento) e a condição necessária para retomá-lo.
3. The system SHALL registrar no plano que as verificações de device físico das Fases 1 e 2 seguem pendentes, distinguindo-as das lacunas fechadas neste trabalho.

**Independent Test**: `grep` de "P6" e "P16" no review mostra estado resolvido com `arquivo:linha`; a seção 2.4 do plano declara o corte e a condição de retomada.

---

## Edge Cases

- IF o valor empacotado tiver rate e alarm zerados e vier pelo caminho direto THEN o app SHALL descartá-lo, mesmo que a glicose caia na faixa plausível — a leitura correspondente chega pelo caminho `getlastGlucose`.
- IF um handler de rota do backend for adicionado depois deste trabalho sem entrada no README THEN a AC 1 de "README do backend" SHALL falhar na próxima verificação (o critério é "todo handler exportado aparece"), não sendo aceitável um README parcialmente atualizado.
- WHEN a planilha `docs/TCC_Acompanhamento_Bernardo_Eduardo.xlsx` estiver aberta no Excel THEN operações de `git checkout`/`merge` que toquem esse caminho SHALL falhar até o arquivo ser fechado — motivo pelo qual o lock `~$*` sai do versionamento.
- IF `flutter analyze` ou qualquer suíte de teste ficar vermelho após uma tarefa THEN a tarefa SHALL ser corrigida antes do commit, nunca contornada por enfraquecimento de teste.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| ARCH-01 | P1: `CLAUDE.md` fiel | Tasks | Pending |
| ARCH-02 | P1: `CLAUDE.md` fiel | Tasks | Pending |
| ARCH-03 | P1: `CLAUDE.md` fiel | Tasks | Pending |
| ARCH-04 | P1: Leitura implausível | Implementing | Implementing |
| ARCH-05 | P1: Leitura implausível | Implementing | Implementing |
| ARCH-06 | P1: Leitura implausível | Implementing | Implementing |
| ARCH-07 | P1: README do backend | Tasks | Pending |
| ARCH-08 | P1: README do backend | Tasks | Pending |
| ARCH-09 | P2: Arquitetura multissensor | Implementing | Implementing |
| ARCH-10 | P2: Processo de qualidade | Tasks | Pending |
| ARCH-11 | P2: Processo de qualidade | Tasks | Pending |
| ARCH-12 | P2: Plano e revisão fiéis | Tasks | Pending |

**Coverage:** 12 total, 12 mapeados para tarefas, 0 não mapeados.

---

## Mapa de cobertura por critério

| Requisito | Critério coberto |
| -- | ---------------- |
| ARCH-01 | Persistência local-first descrita no `CLAUDE.md` (P1-A AC1) |
| ARCH-02 | Mapa da camada Android multissensor no `CLAUDE.md` (P1-A AC2) |
| ARCH-03 | Detalhe volátil vira ponteiro para `docs/`, invariantes nativas preservadas (P1-A AC3, AC4) |
| ARCH-04 | Descarte de valor `< 0x10000` no caminho direto, com log (P1-B AC1) |
| ARCH-05 | Rejeição por bits 56–63 sujos, faixa 400–6000 preservada (P1-B AC2, AC3) |
| ARCH-06 | Log do fallback de timestamp e pureza do decoder (P1-B AC4, AC5) |
| ARCH-07 | Todas as rotas documentadas com exemplo real e contrato de erro (P1-C AC1, AC4, AC5) |
| ARCH-08 | Setup, porta e variáveis de ambiente (P1-C AC2, AC3) |
| ARCH-09 | Doc de arquitetura multissensor + referências (P2-A AC1–AC4) |
| ARCH-10 | Doc de processo de QA: gates, checklist de PR, regra de migration (P2-B AC1–AC3, AC5) |
| ARCH-11 | Caso real de reprovação em QA rastreável por commit (P2-B AC4) |
| ARCH-12 | Review e plano fiéis: P6/P16 resolvidos, 2.4 cortado, device pendente (P2-C AC1–AC3) |

---

## Success Criteria

- [ ] `flutter analyze`, `flutter test --no-pub`, `./gradlew :app:testDebugUnitTest`, `npm test` e `npx tsc --noEmit` verdes ao fim do trabalho.
- [ ] Nenhuma afirmação do `CLAUDE.md` contradiz o código, conferida classe a classe.
- [ ] Um valor de protocolo do `SIprocessData` injetado no caminho direto não produz leitura, provado por teste que falha se o gate for removido.
- [ ] Todo endpoint do backend tem exemplo no README conferível contra o handler.
- [ ] As três lacunas de rubrica (26, 42, 23/27) existem como documento referenciado a partir de `docs/README.md` ou do `CLAUDE.md`.
