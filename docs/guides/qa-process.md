# Processo de qualidade

> Quando usar: antes de abrir ou revisar um PR, e quando precisar explicar como a qualidade é verificada neste projeto. Descreve o processo realmente praticado, não um ideal.

O princípio é um só: **quem escreveu não é quem aprova**, e nenhuma afirmação de "está pronto" vale sem evidência executável. Um gate vermelho bloqueia; enfraquecer ou apagar teste para passar é proibido, sem exceção.

## Gates automatizados

Desde 2026-08-24, os gates de análise/teste rodam em **GitHub Actions** (`.github/workflows/ci.yml`) a cada PR e push em `main`/`dev` — é a referência que vale para saber se um PR está verde, não a execução local do autor. Falta só o artefato de build/deploy (bloqueado — ver [ARCHITECTURE_FIX_PLAN.md](../ARCHITECTURE_FIX_PLAN.md), item 2.4, para o motivo e a condição de retomada). Até lá, rode os gates localmente antes de abrir o PR (mesmos comandos abaixo) para não gastar ciclo do CI com erro óbvio.

| Gate | Comando | Quando roda |
|---|---|---|
| Análise estática Dart | `flutter analyze` | Toda mudança em `lib/` ou `test/` |
| Testes Flutter | `flutter test --no-pub` | Toda mudança em `lib/` ou `test/` |
| Testes Kotlin (JVM) | `cd android && ./gradlew :app:testDebugUnitTest` | Toda mudança em `android/` |
| Tipagem do backend | `cd backend && npx tsc --noEmit` | Toda mudança em `backend/` |
| Testes do backend | `cd backend && npm test` | Toda mudança em `backend/` |

Ao fim de uma fase de trabalho, os cinco rodam juntos, mesmo que a mudança tenha tocado só uma camada — é o que pega regressão cruzada (um rename em Kotlin que quebra o contrato lido pelo Dart, por exemplo).

Notas de ambiente:

- `./gradlew` precisa de um JDK. Sem `JAVA_HOME` no PATH, use o JBR do Android Studio: `JAVA_HOME="C:/Program Files/Android/Android Studio/jbr" ./gradlew :app:testDebugUnitTest`.
- Não use `--offline` no Gradle: o cache local não tem todos os artefatos do Flutter e o build falha por motivo que não é o seu código.
- `npm test` usa o runner nativo do Node e **não** precisa de banco.

### O que é testável e onde

| Camada | Tipo de teste | Observação |
|---|---|---|
| Kotlin puro (decoder, protocolo, parser) | unitário JUnit em `android/app/src/test/` | Lógica que precisa de teste **vive aqui**, fora das classes acopladas ao Android |
| Kotlin acoplado ao Android (`*BleManager`, `*Service`, `MainActivity`) | nenhum | Sem Robolectric nem teste instrumentado no projeto; por isso a regra testável é empurrada para o Kotlin puro |
| Dart (cubits, repositories, widgets) | unitário e de widget em `test/` | |
| TypeScript (backend) | unitário em `backend/tests/` | |
| Documentação | nenhum | Conferida por `grep` contra o código: todo arquivo e classe citado precisa existir |

## Checklist de revisão de PR

Marcado pelo revisor, não pelo autor:

- [ ] Os gates da camada tocada rodaram e estão verdes, com a saída colada no PR
- [ ] A contagem de testes não caiu; nenhum teste foi apagado, pulado ou teve asserção enfraquecida
- [ ] **Mudou camada ou fluxo? Atualizou `CLAUDE.md` e/ou `docs/`** — este item existe porque o P6 (documentação divergindo do código) já reincidiu duas vezes; é o único mecanismo que impede a terceira
- [ ] Mudou `backend/prisma/schema.prisma`? A migration versionada está no **mesmo PR**
- [ ] Mudou contrato (platform channel, rota da API, modelo de dados)? O doc correspondente em `docs/reference/` foi atualizado no mesmo PR
- [ ] O commit segue [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) e descreve o que foi feito, não o que se pretendia
- [ ] Nada de "while I'm here": mudanças fora do escopo declarado voltam para o autor

## Verificação independente por feature

Features planejadas em `.specs/` seguem um ciclo com verificador separado do autor:

1. O autor implementa tarefa a tarefa, cada uma com gate verde e commit atômico.
2. Um **verificador independente** revisa a feature inteira contra as ACs da spec, sob a regra **evidência-ou-zero**: um critério sem `arquivo:linha` apontando a asserção conta como **não coberto**, mesmo que o autor afirme o contrário.
3. O verificador roda um **sensor de discriminação**: injeta mutações de comportamento numa cópia isolada e confirma que os testes morrem. Mutante que sobrevive vira tarefa de correção — o teste existia, mas não detectava nada.
4. O veredito (PASS/FAIL, evidência por AC, resultado do sensor) fica em `.specs/features/<feature>/validation.md`.

## Caso real: rodada 1 reprovada, corrigida, rodada 2 aprovada

Feature `checklist-tcc-compliance` (agosto/2026). Relatório completo em `.specs/features/checklist-tcc-compliance/validation.md`.

**Rodada 1 — reprovado.** O verificador encontrou **5 gaps** e, no sensor de discriminação, **2 mutantes sobreviventes**:

| # | Achado |
|---|---|
| 1 | O limite de 8 caracteres da senha não era asserido em nenhuma das duas linguagens: baixar o mínimo para 6 no Dart e no TypeScript **não quebrava teste nenhum** |
| 2 | Sete telas montavam `SnackBar` direto, contrariando a AC de mensagens unificadas |
| 3 | O campo de senha da troca de e-mail não usava `PasswordField` |
| 4 | Texto novo em `UserAppBar` estava hardcoded em português, fora do l10n |
| 5 | 14 ocorrências de `Colors.red`/`Colors.green` fora do tema |

**Fix round.** Um commit por gap, cada um com gate verde:

| Commit | Correção |
|---|---|
| `19d67ed` | `test(auth): assert the 8-character password boundary` |
| `ea7d107` | `fix(patient): use PasswordField in the email-change form` |
| `12f98b8` | `refactor(patient): migrate remaining screens to GlucoreMessenger` |
| `b2da51f` | `fix(patient): move UserAppBar strings to l10n` |
| `0174cc0` | `refactor(patient): replace remaining hardcoded colors with AppTheme` |

**Rodada 2 — aprovado** (`19dd86e`). Verificador diferente do autor **e** do verificador da rodada 1. Os 5 gaps foram reconferidos com evidência nova, produzida na própria rodada, e não pelo relato de quem corrigiu. Os 2 mutantes que haviam sobrevivido foram **reinjetados** e agora morrem: baixar o mínimo de senha para 6 falha `password_policy_test.dart` no Dart e `passwordPolicy.test.ts` no backend; reverter o `PasswordField` falha `profile_edit_page_test.dart:265`. Gate final: `flutter analyze` limpo, 176 testes Flutter, 43 do backend, `tsc` limpo.

A lição que ficou: **teste verde não é teste que discrimina**. Os dois mutantes sobreviventes passavam por suítes verdes; só a mutação revelou que a asserção do limite não existia.

## Regras que não se negociam

- Teste não se apaga, não se pula e não se enfraquece para fechar o gate. Teste vermelho é sinal, não ruído.
- Se um teste está genuinamente errado (afere o comportamento errado segundo a spec), a mudança é discutida antes, nunca feita em silêncio.
- Commit só depois do gate verde, nunca antes.
- Uma tarefa, um commit. Nada de lote.
