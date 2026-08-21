# Documentação Glucore

> Quando usar: ponto de entrada para qualquer agente ou desenvolvedor. Leia isto antes de abrir código-fonte.

Glucore é um MVP Flutter (Android-first) para sensores CGM Sibionics, com backend Node/Express/Prisma. A documentação abaixo foi gerada por inspeção integral do código em 2026-07-05 (branch `feat/insulin-and-carb-management`). Ela substitui a necessidade de reanalisar o código para tarefas comuns.

## Mapa de navegação

| Documento | Conteúdo | Leia quando… |
|---|---|---|
| [architecture/overview.md](architecture/overview.md) | Camadas, fluxo de boot, fluxo de dados fim-a-fim | precisar de visão geral ou for tocar em mais de uma camada |
| [architecture/sensor-pipeline.md](architecture/sensor-pipeline.md) | BLE + JNI + protocolo Sibionics passo a passo | for mexer em conexão, leitura de glicose, registro de sensor |
| [architecture/state-management.md](architecture/state-management.md) | Cubits, DI, stream de eventos, modo mock | for mexer em estado Flutter ou UI reativa |
| [architecture/backend.md](architecture/backend.md) | API Express, Prisma, o que é usado vs planejado | for mexer no backend ou na sincronização |
| [guides/setup-and-build.md](guides/setup-and-build.md) | Comandos, variáveis, restrições de build | for compilar, rodar ou configurar ambiente |
| [guides/versioning-and-branches.md](guides/versioning-and-branches.md) | Esquema `dev`/`main`, semver, fluxo por versão | for abrir PR, versionar ou decidir destino de uma mudança |
| [guides/qa-process.md](guides/qa-process.md) | Gates, checklist de revisão de PR, verificação independente, caso real de reprovação | for abrir ou revisar PR |
| [guides/adding-features.md](guides/adding-features.md) | Receitas: nova página, novo campo persistido, nova rota | for adicionar funcionalidade |
| [reference/platform-channels.md](reference/platform-channels.md) | Contrato exato MethodChannel/EventChannel | for mexer na fronteira Flutter↔Android |
| [reference/multi-sensor-architecture.md](reference/multi-sensor-architecture.md) | Contrato `BrandBleManager`, as três marcas suportadas, quem escolhe a marca | for adicionar marca de sensor ou mexer no que é comum a todas |
| [reference/native-stubs.md](reference/native-stubs.md) | Classes stub exigidas por `libg.so` | vir crash JNI `ClassNotFoundException` |
| [reference/data-models.md](reference/data-models.md) | Modelos Flutter ↔ payload API ↔ Prisma | for adicionar/alterar campo de dados |
| [ARCHITECTURE_REVIEW.md](ARCHITECTURE_REVIEW.md) | **Relatório**: problemas arquiteturais (P1–P35; P17/P18/P19 resolvidos na v1.1.0), proposta de HAL, revisão da conexão com sensores | for planejar refatoração ou corrigir débito técnico |
| [ARCHITECTURE_FIX_PLAN.md](ARCHITECTURE_FIX_PLAN.md) | **Plano de correção**: 6 fases ordenadas, passos, critérios de aceite | for executar as correções do relatório |
| [../CHANGELOG.md](../CHANGELOG.md) | Histórico de versões (features, fixes por release) | for saber o que mudou entre versões |

`sprint1_tracking.md` é o tracking de requisitos do Sprint 1 (preexistente, mantido).

## Skills instaladas

Skills por domínio em `.claude/skills/` (carregadas automaticamente por agentes no projeto):
`glucore-sensor-ble`, `glucore-native-bridge`, `glucore-flutter-state`, `glucore-patient-features`, `glucore-backend`.

## Avisos críticos (resumo)

- **CLAUDE.md foi realinhado com o código em 2026-08-20** (P6 fechado) e passou a ser versionado. Ele fica restrito a invariantes estáveis; detalhe volátil vive aqui em `docs/`. Em conflito, o código e estes docs vencem.
- `Juggluco/` é cópia de referência do app open-source Juggluco. Não modificar, não indexar por inteiro.
- Vendor `.so` são arm64-v8a apenas. Nunca adicionar ABI filters.

## Armadilhas

- Não reintroduzir: `SensorController`, `SensorPage` como raiz, `FakeSensorRepository`, `PatientMockStore`. `MockSensorRepository` e `DebugPanel` existiram por pouco tempo e foram revertidos em `f91adea` — não há caminho de sensor falso em `lib/` hoje.
- Nunca editar `lib/l10n/generated/` — rodar `flutter gen-l10n` após editar os `.arb`.
