# Arquitetura multissensor (brand-agnostic)

> Quando usar: for adicionar uma marca de sensor, mexer no que é comum a todas elas, ou entender por que o código de uma marca é tão curto. O protocolo Sibionics passo a passo continua em [../architecture/sensor-pipeline.md](../architecture/sensor-pipeline.md); aqui está só a estrutura que sustenta as três marcas.

O app suporta três marcas de sensor em produção: **Sibionics** (BLE + JNI `libg.so`), **Accu-Chek SmartGuide** (BLE com pareamento por PIN) e **FreeStyle Libre 2** (NFC para ativar + BLE para streaming). O que muda entre elas é o protocolo GATT e a função nativa que decodifica o pacote. Todo o resto — varredura, ciclo de conexão, fila de escrita, backoff de reconexão, history sync e emissão de leitura — é escrito uma vez em `BrandBleManager`.

## Contrato comum

`BrandBleManager` (`android/app/src/main/kotlin/com/berdegeus/glucore/BrandBleManager.kt:26`) é uma `BluetoothGattCallback` abstrata. Ela mantém o estado da sessão confinado à main thread: os callbacks GATT chegam em threads de binder e são postados no main looper antes de tocar em qualquer campo, com `assertMainThread()` conferindo isso em build de debug (`BrandBleManager.kt:104`).

Uma marca precisa fornecer:

| Membro | Tipo | Papel |
|---|---|---|
| `tag` | abstrato | Tag de log da marca (`BrandBleManager.kt:47`) |
| `brandName` | abstrato | Nome exibido em mensagens de erro ao usuário (`:50`) |
| `scanServiceUuid` | abstrato | UUID de serviço usado como filtro de varredura (`:53`) |
| `matchDevice(deviceName)` | abstrato | Decide se o device anunciado é o sensor ativo (`:126`) |
| `onBrandServicesDiscovered(gatt)` | abstrato | Liga características e inicia o handshake (`:148`) |
| `onBrandDescriptorWrite(uuid, status)` | abstrato | Confirmação da escrita do CCCD (`:151`) |
| `onBrandCharacteristicChanged(uuid, data, timestampMs)` | abstrato | Recebe cada notificação já copiada e no main thread (`:154`) |
| `onBrandConnected(gatt)` | hook | Sinal de conexão estabelecida (`:138`) |
| `onBrandCharacteristicRead/Write` | hook | Resultado de leitura/escrita (`:157`, `:160`) |
| `onBrandDisconnected` / `onBrandConnectionLost` | hook | Limpeza específica da marca (`:163`, `:170`) |
| `prepareScan()` | hook | Carrega o que a marca precisa antes de varrer; falha aborta (`:123`) |
| `persistMatchedDevice(device)` | hook | Salva o device para o restore pular a varredura (`:129`) |

O que a marca **não** implementa, porque já vem pronto:

- **Varredura e conexão** com timeouts (30 s de scan, 20 s de conexão) e até 3 tentativas de conexão (`BrandBleManager.kt:32-36`).
- **Fila de escrita GATT** serializada por `onCharacteristicWrite`, com um retry por escrita (`:727`). Em API 33+ usa `writeCharacteristic(char, bytes, type)` e `writeDescriptor(cccd, value)`; abaixo disso, o caminho legado.
- **Reconexão com backoff** de 30 s → 2 min → 5 min, com o último passo repetindo (`:41`, `:874`).
- **History sync**: enquanto nenhuma leitura atual foi entregue, as leituras chegando são tratadas como backlog (`deliverReading:593`, `notifyHistoryStored:614`); a mais recente é promovida a atual depois que o fluxo assenta por 2 s (`completeHistorySyncAndEmit:621`).
- **Decodificação do pacote empacotado** e o filtro de plausibilidade, via `decodePackedGlucose:559`, que delega ao `SibionicsGlucoseDecoder` (Kotlin puro, testado na JVM). Apesar do nome, o formato é o do Juggluco e vale para as três marcas.
- **Emissão de evento** no formato de mapa que o EventChannel entrega ao Flutter (`emitGlucoseReading:632`); o contrato está em [platform-channels.md](platform-channels.md).

## As três marcas

### Sibionics

`SibionicsBleManager.kt:15`. Serviço `ff30`, notificação em `ff31`, escrita em `ff32` (`:21-23`). O handshake é uma máquina de estados dirigida por `Natives.SIprocessData`: re-auth, sincronização de relógio, ativação, pedido de dados, reset. A glicose sai de `Natives.getlastGlucose()`.

Um código de retorno fora dos documentados só é interpretado como leitura depois que o handshake assentou, e mesmo assim passa por `SibionicsGlucoseDecoder.decodeUnsolicited`, que descarta qualquer valor sem bits de rate/alarm — um código de protocolo não vira glicemia (`SibionicsBleManager.kt:225-235`).

### Accu-Chek SmartGuide

`AccuChekBleManager.kt:25`, portado do `AccuGattCallback` do Juggluco. Usa o perfil CGM padrão do SIG: serviço `0x181f`, medições notificadas em `2aa7`, control point `2aac` e RACP `2a52` por indicação (`AccuChekProtocol.kt:12-20`).

A segurança é bonding do próprio Android: ler a característica de status cifrada sem bond faz o sistema abrir o diálogo de PIN, e o handshake retoma quando `ACTION_BOND_STATE_CHANGED` reporta `BOND_BONDED` (`AccuChekBleManager.kt:21-23`). Os pacotes vão para `Natives.accuProcessData`; retorno `1` significa registro de backlog gravado sem leitura a expor (`:250`).

### FreeStyle Libre 2

Duas etapas, dois arquivos.

**NFC** (`LibreNfcHandler.kt:19`): lê o patch info e os 344 bytes de memória do sensor e entrega a `Natives.nfcdata`, que persiste o sensor no store da `libg`. O código de status resultante decide o que emitir: ativação, habilitar streaming, aquecimento, pronto ou encerrado. Roda na thread de reader-mode do NFC, e o transceive é bloqueante.

**BLE** (`Libre2BleManager.kt:23`): serviço Abbott `0xfde3`, login em `f001`, dados brutos em `f002` (`:29-31`). Duas gerações de segurança, reportadas por `Natives.getsensorgen`: gen 1 escreve `Natives.sensorUnlockKey` em `f001`; gen 2 faz desafio/resposta e usa a chave de sessão para decifrar cada pacote de 46 bytes. Os fragmentos de 20+18+8 bytes são remontados e interpretados por `Natives.processTooth`. As leituras chegam ~1/min, sem backlog, então são publicadas direto em vez de passar pelo fluxo de history sync (`Libre2BleManager.kt:343-350`).

## Quem escolhe a marca

A escolha acontece no Android, não no Flutter.

`SensorCore` (`SensorCore.kt:24`) é dono do stack e mantém um manager por marca, criado sob demanda (`:37-47`). `SensorPlatformImpl` recebe esse mapa como provider (`SensorPlatformImpl.kt:31`) e resolve a marca ativa em `resolveBrand` (`:218`): pergunta ao nativo via `Natives.getLibreVersion(dataptr)` e converte o código com `SensorBrand.fromLibreVersion`; se a chamada nativa falhar, cai na marca persistida na sessão.

O mapa de códigos vive em `SensorBrand.kt:12-27`, na convenção do Juggluco: `0x10` = Sibionics, `0x20` = Accu-Chek, `0x40` = Dexcom, `3` = Libre 3, qualquer outro = Libre 1/2. Libre 2 é o fallback justamente por não ter código próprio.

## Adicionando uma marca

1. Acrescente a entrada em `SensorBrand` com o `wireName` e o código do `getLibreVersion`, se houver.
2. Crie `NovaMarcaBleManager : BrandBleManager` implementando os membros abstratos da tabela acima e os hooks de que precisar.
3. Registre a marca em `SensorCore.bleManagerFor`.
4. Se a marca decodificar com outro formato de pacote, não altere `SibionicsGlucoseDecoder`: adicione a decodificação própria e entregue um `DecodedGlucoseReading` a `deliverReading`.

Nada de fila de escrita, backoff ou history sync novos — se você estiver escrevendo isso na marca, é sinal de que devia estar em `BrandBleManager`.
