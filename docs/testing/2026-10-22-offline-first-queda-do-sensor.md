# Registro de teste — offline-first: queda do sensor e troca de rede (2026-10-22)

> Quando usar: evidência do que foi exercitado no aparelho nesta sessão e do que ficou sem ver. Complementa o roteiro de bancada da #18. O repositório é público: **sem** serial do sensor, endereço BLE, serial USB nem valores de glicose; só contagens, horários e comportamento.

**Aparelho:** Redmi (23129RA5FL), Android com MIUI, Bluetooth + Wi-Fi/4G. **Sensor:** Sibionics, em sessão com histórico a sincronizar. **Build:** debug, `API_URL` de produção. **Branch:** `fix/offline-first-monitor-ux` (commits `afa2956` e `c9f1505`, mais este registro).

## Resumo

| # | Cenário | Resultado | Evidência |
|---|---|---|---|
| 1 | Tela do Monitor com última leitura de 6 dias e sem sessão de sensor | **Reproduzido o defeito**: selo "Desatualizada" sem botão e sem dizer o estado do sensor | captura de tela; causa em `monitoring_home_page.dart` (`onReconnect` só com sessão) |
| 2 | Mesma tela com a correção | **OK**: "Desatualizada · Nenhum sensor conectado" + botão "Conectar sensor", que abre "Escolher sensor"; métricas esmaecidas com "Dados anteriores, sem leitura atual" | captura de tela no aparelho |
| 3 | Sensor perde o link no meio do sync de histórico (usuário se afasta) | **OK**: `GATT disconnected (status=8)` → `Link lost; reconnecting` → tentativa 1 sem espera → conexão direta estoura 20 s → `autoConnect` → reconectou ~69 s depois, refez auth/ativação/time-sync e **continuou** o histórico (68 % → 98 % → concluído, sem voltar a zero) | `logcat` gravado; nenhuma linha `E`/`F` do app |
| 4 | Integridade no banco local em volta da queda | **OK**: 18 minutos seguidos (20:40–20:57), sem buraco, sem duplicata (10157 leituras, 10157 timestamps distintos) | consulta ao `glucore_patient.db` copiado do aparelho |
| 5 | Backend inalcançável (DNS da rede resolvia o domínio para o bloqueio do OpenDNS) | **OK para offline-first**: leituras acumularam local (3242 pendentes), nada descartado, `pending_ops` vazio, app abriu e funcionou | banco local; `ping` do aparelho |
| 6 | Sync pendente ao trocar para o 4G | **OK**: 3242 leituras e 305 buckets sujos viraram 2–5 leituras e 1 bucket em ~2 min | contagem de `synced=0` e `bucket_dirty` a cada 20 s |
| 7 | Trocar Wi-Fi → 4G com a sessão em validação offline | **Reproduzido o defeito** (antes) e **corrigido** (depois) | ver abaixo |

## Defeito do cenário 7: "o app reiniciou" na troca de rede

Com o backend inalcançável na abertura, o `AuthCubit` fica `authenticated` com `offlineValidation = true`. Ao voltar a conectividade ele chamava `checkAuthStatus()`, que **emitia `AuthStatus.loading` antes de validar**. O `AuthGate` responde a `loading` com um spinner no lugar do `PatientShellPage`, o que derrubava `SensorCubit`/`PatientCubit` e reiniciava o BLE.

- **Antes:** 10 s depois de desligar o Wi-Fi, `SibionicsBleManager: start scan/connect (preferSaved=true attempt=0)` com `BluetoothGatt: close()`, e o usuário viu a tela de loading. O PID do app **não** mudou: não foi reinício de processo.
- **Depois:** mesmo procedimento (Wi-Fi com backend bloqueado, abrir o app, desligar o Wi-Fi). 25 s de log sem nenhum `attempt=`, mesmo PID, tela no card "Agora".
- **Guarda de regressão:** `test/features/auth/auth_cubit_offline_test.dart` (3 testes novos). O teste "revalidating a session already inside never passes through loading" **falha sem a correção** (verificado com `git stash`) e passa com ela.

## Lacunas de dados observadas (não são regressão deste PR)

Consulta ao banco local, por trecho:

| Trecho | Cadência | Leitura |
|---|---|---|
| 08/10 → 11/10 | 5 min | sensor/período anterior; causa não investigada |
| 15/10 23:12 → 16/10 20:26 | sem leitura (21 h) | coincide com a troca de sensor da #48; só a coincidência de data foi vista |
| 16/10 20:28 → 20/10 20:56 | **16 min** (~4 dias) | o BLE entrega só o histórico de 16 em 16 min; os minutos intermediários vêm do `polls.dat` via `getStoredReadings` (`multi-sensor-architecture.md`). Esse backfill só cobre daqui em diante; **não foi verificado** se o `polls.dat` ainda guarda esses 4 dias |
| 20/10 20:56 → 22/10 20:57 | 1 min | 2882 minutos, 2 sem leitura (`21/10 12:11`, `22/10 09:53`), nenhum perto da queda de hoje; causa não investigada |

## O que NÃO foi visto

- O estado do card **durante** o minuto de queda (não houve captura nesse intervalo e o log não registra a UI).
- O botão "Reconectar" com sessão de sensor existente e desconectado, no aparelho. Está coberto por teste de widget (`monitoring_home_page_test.dart`), não visto rodando.
- Se o servidor aceita num único envio o lote antigo (16–18/10): o aparelho marcou como enviado, mas **não foi conferido no servidor**.
- Recuperação dos 4 dias de 16 min por `getStoredReadings(since: 16/10 20:28)`.
- Pequenos saltos de timestamp (1020 s e 120 s) nas leituras do histórico logo na reconexão: não investigados.

## Gates

`flutter analyze` sem problemas e `flutter test --no-pub` com **650 testes passando** na branch combinada (642 que a `main` já tinha segundo o PR #47, + 3 de auth + 5 do cartão; o 650 é a saída do runner, a decomposição é por diferença). Kotlin e backend **não** foram tocados e não foram rodados localmente; o CI roda tudo.
