# Spec — Reconexão automática do Sensor (Sibionics) que não morre

> **Status (2026-10-10): implementada** no PR #46. Registro do problema: P38 em [`../ARCHITECTURE_REVIEW.md`](../ARCHITECTURE_REVIEW.md); desenho final: [`../reference/multi-sensor-architecture.md`](../reference/multi-sensor-architecture.md) ("Auto-recuperação"). Esta página é a spec **como foi aprovada**; onde o código divergiu:
> - O gancho do watchdog chama-se `BrandBleManager.checkConnection()` (decisão em `ConnectionWatchdog`) e o reinício é `restartFromScratch`; a spec dizia `kickIfStalled`. Os gatilhos de "alguém está olhando" viraram `ensureConnected`.
> - `AccuChekBleManager.kt` e `Libre2BleManager.kt` **não foram alterados**: os `disconnect()` deles são de fluxos de PIN/NFC e sem hardware para testar não era seguro mexer. Eles herdam as proteções compartilhadas (alarme, gatilhos, falha de escrita da fila, `onScanFailed`).
> - A exportação do log pela tela de Configurações ficou de fora; a leitura é por `adb shell run-as`.
> - Os limiares ficaram: ocioso 1 min, tentativa sem progresso 6 min, conectado sem valor 5 min (a spec dizia "3 min" sem distinguir as fases; o Sibionics entrega 1 leitura por minuto, então 5 min sem valor num link conectado já é anormal, e a fase ociosa precisa de pouca tolerância).
> - Falhas de setup só são reportadas ao usuário na 3ª seguida sem leitura entre elas.
> - Não validado em campo ainda: queda real após a correção, Bluetooth off/on, tela apagada ≥ 1 h, Accu-Chek, Libre 2.

Branch: `perf/sibionics-connection` (PR #46). Escopo de código: `android/.../BrandBleManager.kt`, `SibionicsBleManager.kt`, `CgmForegroundService.kt`, `SensorPlatformImpl.kt`, `AndroidManifest.xml` + um ajuste de UI Flutter.

## Context

O sensor ficou desconectado e o app **nunca tentou voltar sozinho**, mesmo com a tela ligada e o app em primeiro plano. Só o toque manual no ícone de Bluetooth reconectava. A reconexão automática (PR #46) cobre as quedas normais, mas existe um caminho em que ela morre em silêncio.

### Evidência (aparelho 23129RA5FL, sensor `…3c:e0`, 10-10)

Fonte: `dumpsys bluetooth_manager` (eventos ACL do sistema). O logcat não serve: o buffer girou e eu ainda rodei `logcat -c` nesta sessão. O sistema só guarda os eventos de hoje, então **a noite anterior não é analisável** por essa via.

- 12:45–12:49: ~10 conexões seguidas falham com `CONNECTION_FAILED_ESTABLISHMENT (0x3e)`, a cada 4–6 s, e terminam em timeout. O sensor não aceitava.
- 13:16→13:56, 14:21→14:59, 15:01→15:28: cada conexão dura **27–40 min** e cai com `CONNECTION_TIMEOUT (0x08)` (perda de sinal). Isso é um padrão, não um acaso.
- Depois de cada queda existe um `Allow connection from` (conexão pendente). O de 13:56 virou conexão só às 14:21 via `autoConnect`, então esse caminho funciona.
- 15:28:30 cai, 15:28:31 reconecta, **15:28:41 cai de novo após 10 s**. Depois disso **não há mais nenhum evento ACL nem `Allow connection`**. A cadeia de reconexão morreu aí, ~17 min antes de eu olhar (15:46 → app aberto, 15:58 → ainda parado).
- Estado às 15:58: processo e `CgmForegroundService` vivos, 0 GATT clients, 0 scans desde 12:48, tela ligada, app fora da otimização de bateria.
- O `polls.dat` da lib vai até 15:28 e tem um único buraco de 3 min em 17 dias (a lib recompleta o histórico ao reconectar), então ele **não** mostra os períodos sem sinal.

### Causa (alta confiança no mecanismo, sem log do instante exato)

Depois de uma reconexão que dura poucos segundos, algo para a cadeia. Os candidatos no código, todos verificados:

1. `disconnect()` é **terminal**: liga `isStopping`, cancela a cadeia e zera `dataptr` (`BrandBleManager.kt:321-341`). Depois disso `scheduleReconnect` retorna sem fazer nada (`:985`). Erros transitórios de **setup** chamam esse `disconnect()`: serviço `ff30` ausente, característica ausente, falha ao habilitar notificação, **falha na escrita do descritor**, falha ao escrever auth/ask-new-data (`SibionicsBleManager.kt:111-185`), falha no discovery (`BrandBleManager.kt:482`) e falha de escrita após retry (`:874`).
2. `onScanFailed` só emite erro e para (`BrandBleManager.kt:283-287`), sem backoff.
3. Não existe nenhuma rede de segurança independente: sem `AlarmManager`, sem `WakeLock`, e todo o tempo é `mainHandler.postDelayed` (`uptimeMillis`, congela com a CPU suspensa).

Descartado como causa deste caso: timer congelado em Doze. A tela estava ligada e nada reconectou.

### Bug extra confirmado (UI)

`_timeAgo` (`lib/features/patient/presentation/widgets/glucore_widgets.dart:186`) usa `DateTime.now()` só na hora do `build` e não há ticker. O "18 min atrás" ficou congelado desde 15:46 e às 15:58 a idade real era ~30 min. Em um app de glicemia, um rótulo de idade que não atualiza é enganoso.

Também: o último rótulo do eixo X do gráfico (`15:30`) sobrepõe outro na ponta direita.

## Requisitos

**R1 — Nada terminal com sessão ativa.** Erros de setup (lista acima), falha de scan e timeout de descoberta caem no backoff (`restartConnection` / `scheduleReconnect`), nunca em `disconnect()`. Só ações explícitas derrubam: `stopMonitoring`, `clearSession`, troca de sensor/marca (`SensorPlatformImpl.kt:101,139,194,260`).
**R2 — Teto do backoff repete para sempre** (já é o último degrau de `ReconnectPolicy`); nenhuma falha pode terminar a cadeia.
**R3 — Watchdog independente do estado BLE.** Um alarme periódico do sistema verifica: sessão ativa + sem leitura há mais de N min + sem GATT, scan nem reconexão pendente → chama `startSensorScan` do zero. Vale para as 3 marcas e funciona com a tela apagada.
**R4 — WakeLock parcial curto** (~30 s, com timeout) em volta de cada tentativa de reconexão e do tratamento de cada leitura.
**R5 — Gatilhos extras:** app volta ao primeiro plano, tela liga ou o adaptador Bluetooth liga com o sensor desconectado → reconexão imediata (reaproveitar o gancho de lifecycle do `reconcileFromSensorStore`).
**R6 — Log persistente de transições BLE** em arquivo em anel (~500 KB, no `filesDir`): cada mudança de estado, cada causa de reconexão, cada `disconnect()` com o motivo, cada disparo do watchdog. Exportável pelo `run-as`/tela de configurações. É o que falta hoje para fechar a causa real.
**R7 — UI:** o rótulo de idade passa a atualizar a cada 30 s (ticker/`StreamBuilder` por minuto) e o rótulo do eixo X deixa de sobrepor.

## Design

### Watchdog (R3, R4)
- `ConnectionWatchdog` (Kotlin, **puro e testável**, no mesmo estilo de `NoValueWatchdog.kt` e `ReconnectPolicy.kt`): recebe `now`, `lastValueAt`, `isConnected`, `hasPendingAttempt`, devolve `Action.None | Action.Kick`. Limiar inicial: **3 min** sem valor.
- Armado por `CgmForegroundService` com `AlarmManager.setAndAllowWhileIdle` (inexato, sem permissão nova), período ~1 min, rearmado a cada disparo e a cada leitura. O app já está na lista de exceção de bateria. Se a precisão em Doze não bastar, evoluir para `setExactAndAllowWhileIdle` (exige `SCHEDULE_EXACT_ALARM`/`USE_EXACT_ALARM` no Android 14+). **Decisão: começar inexato.**
- `BroadcastReceiver` interno chama um novo `BrandBleManager.kickIfStalled()`, que cancela qualquer cadeia pendente, zera o contador e roda `startSensorScan(dataptr)` (a versão pública, que já reinicia o backoff).
- Referência do Juggluco: `LossOfSensorAlarm.java:78-84` (alarme) → `SensorBluetooth.reconnectall()` (`:89`) → `SuperGattCallback.reconnect()` (`:116`, só age se passou o timeout sem valor e a conexão tem mais de 60 s).

### Setup não terminal (R1)
- Novo `BrandBleManager.recoverFromSetupFailure(reason)`: loga (R6), faz `restartConnection` com o backoff atual e **não** emite `error` terminal quando `isAutoRecovering()` é verdadeiro. O `emitError` continua só para a **primeira** conexão sem endereço salvo, para o erro de pareamento inicial aparecer.
- Trocar as chamadas `disconnect()` listadas por `recoverFromSetupFailure(...)` em `SibionicsBleManager.kt`, `BrandBleManager.kt:482,874`. Accu-Chek e Libre 2 (`AccuChekBleManager.kt`, `Libre2BleManager.kt`) têm o mesmo padrão: aplicar só onde houver erro transitório de setup, não nos fluxos de PIN/NFC, que exigem o usuário.
- `onScanFailed`: `stopScan()` + `scheduleReconnect()` quando `isAutoRecovering()`.

### Log persistente (R6)
- `BleEventLog` (arquivo em anel, escrita assíncrona, não bloqueia a main thread). Chamado nos pontos de estado de `BrandBleManager`. Sem dados sensíveis (sem barcode, sem glicose).

### UI (R7)
- `_timeAgo` passa a ser reavaliado por um ticker de 30 s no widget que o usa (`glucore_widgets.dart:85,186`). Teste de widget com relógio falso.
- Ajuste do eixo X do gráfico em `glucose_chart.dart` (esconder o último rótulo se a distância ao anterior for menor que a largura do texto).

## Arquivos
- Editar: `BrandBleManager.kt`, `SibionicsBleManager.kt`, `AccuChekBleManager.kt`/`Libre2BleManager.kt` (pontuais), `CgmForegroundService.kt`, `SensorPlatformImpl.kt`, `AndroidManifest.xml` (receiver, `WAKE_LOCK`), `glucore_widgets.dart`, `glucose_chart.dart`.
- Criar: `ConnectionWatchdog.kt`, `BleEventLog.kt`, testes `ConnectionWatchdogTest`, `SetupFailureRecoveryTest`, `glucose_age_label_test.dart`.
- Docs: `docs/reference/multi-sensor-architecture.md` (seção "Conexão e reconexão"), `CHANGELOG.md` (Fixed), `docs/ARCHITECTURE_REVIEW.md` (novo item). Salvar esta spec em `docs/` (seguindo a convenção de lá) ao sair do modo de plano.

## Verificação
1. **JVM:** `cd android && ./gradlew testDebugUnitTest` (watchdog puro: dispara só com sessão ativa, sem valor, sem tentativa pendente; não dispara conectado nem com tentativa em curso; setup failure → backoff, nunca terminal).
2. **Flutter:** `flutter analyze` e `flutter test --no-pub` (rótulo de idade atualiza com o relógio; teste de layout do eixo).
3. **Aparelho (critério de pronto):**
   - Forçar a falha de setup: sensor longe do telefone logo após reconectar e confirmar no `dumpsys bluetooth_manager` que continuam aparecendo `Allow connection`/scans.
   - Tela apagada por ≥ 1 h com o sensor saindo do alcance e voltando: a leitura volta sozinha.
   - Confirmar no log persistente (R6) que o watchdog disparou e por quê.
   - Bluetooth desligado/ligado (hoje não validado) e queda longa.
4. **Não regredir:** Accu-Chek e Libre 2 (compartilham o `BrandBleManager`). Hoje continuam sem teste de hardware; registrar no PR.
5. CI do PR #46 verde (`flutter analyze/test`, Kotlin JVM).

## Fora de escopo
- Backend #45 (janelas de 7/14 dias).
- Investigar **por que** o sensor derruba o link a cada ~30 min (`0x08`). Pode ser do sensor/BLE do aparelho. O R6 deixa o dado para decidir isso depois.
- Rebase na `main`.

## Riscos
- `setAndAllowWhileIdle` pode atrasar alguns minutos em Doze profundo. Mitigação: gatilhos R5 e a evolução para alarme exato se o teste de 1 h mostrar atraso.
- O watchdog não pode brigar com o fluxo normal. A guarda é `hasPendingAttempt` e o limiar de 3 min.
- Mudar erros de setup de terminal para backoff pode esconder um defeito real de pareamento na primeira conexão. Mitigação: primeira conexão sem endereço salvo continua emitindo erro.
