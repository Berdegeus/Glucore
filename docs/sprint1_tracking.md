# Sprint 1 – Tracking de Requisitos

> Legenda: ✅ Feito | ⚠️ Parcial | ❌ Falta | 🔧 A implementar

---

## RF01 – Gerenciar Cadastro de Usuário

| CA | Critério | Status | Observação |
|----|----------|--------|------------|
| CA1 | Cadastro bem-sucedido → sistema registra e confirma | ⚠️ | Backend OK, token retornado. **Bug: após registro com sucesso a tela não navega para o app nem faz login automático.** |
| CA2 | Dados inválidos/duplicados → mensagem de erro | ✅ | Email duplicado → snackbar "Este e-mail já está cadastrado". Validação de campo no formulário. |
| CA3 | Manutenção de dados (usuário autenticado altera cadastro) | ❌ | Sem tela de perfil/edição de conta. |
| CA4 | Manutenção com dados inválidos → erro | ❌ | Depende de CA3. |

**Onboarding:** ⚠️ — Aparece em **toda** abertura do app. Falta flag `SharedPreferences` de primeira abertura.

### 🔧 O que falta
- [ ] Após `register` success → navegar diretamente para shell (já emite `authenticated`, mas `RegisterPage` não retorna para `AuthGate` corretamente — verificar se `Navigator.pop` pós-cubit resolve ou se precisa `pushReplacement`)
- [ ] Onboarding: salvar flag `onboarding_done` em `SharedPreferences`; só mostrar se flag ausente
- [ ] Tela de perfil (editar email/senha) — CA3/CA4

---

## RF02 – Realizar Autenticação de Usuário

| CA | Critério | Status | Observação |
|----|----------|--------|------------|
| CA1 | Credenciais válidas → acesso liberado | ✅ | JWT emitido, token salvo em `flutter_secure_storage`, `AuthGate` navega para shell. |
| CA2 | Credenciais inválidas → acesso negado com mensagem | ✅ | Snackbar "Credenciais inválidas". |
| CA3 | Recuperação de senha via e-mail | ⚠️ | Tela `ForgotPasswordPage` existe mas não envia e-mail real — só exibe snackbar de sucesso falso. |

### 🔧 O que falta
- [ ] **Recuperação de senha:** backend `POST /auth/forgot-password` gera token UUID (6h TTL), salva em tabela `PasswordResetToken`, envia e-mail via **Nodemailer** (SMTP configurável por `.env`). Flutter mostra tela de instrução "Verifique seu e-mail". Em prod configura SMTP real; em dev mostra o token no log do backend.
- [ ] Flutter: `ForgotPasswordPage` faz chamada real ao backend e trata os estados (enviado/email não encontrado/erro de rede)

---

## RF03 – Vincular Sensor CGM ao Aplicativo

| CA | Critério | Status | Observação |
|----|----------|--------|------------|
| CA1 | Sensor detectado via BLE → vinculado com sucesso | ✅ | Sibionics EU protocolo completo (auth → time-sync → activation → history sync → glucose). |
| CA2 | Sensor não encontrado → mensagem + orientação | ⚠️ | Há estado `disconnected`/`error` no `SensorCubit`, mas UX de orientação passo-a-passo falta. |
| CA3 | Dispositivo incompatível → lista de sensores suportados | ❌ | Sem tela de seleção de sensor/marca; sem mensagem de incompatível. |

**Scanner de data matrix:** ❌ — Câmera para ler código da caixa do sensor não implementado.

### 🔧 O que falta
- [ ] **Tela de seleção de sensor:** mostrar "Sensores compatíveis: Sibionics CGM" (FreeStyle Libre = future). Botão "Usar câmera" para escanear data matrix.
- [ ] **Câmera data matrix:** integrar `mobile_scanner` (pub.dev). Parsear string GS1 da caixa Sibionics (formato `(01)...(21)...`). Auto-preencher campo de barcode no `SensorLinkPage`.
- [ ] **Tutorial em-app:** stepper de 3 passos ("Retire o sensor da caixa" → "Aponte a câmera para o código" → "Aguarde conexão Bluetooth") mostrado antes do scan.
- [ ] Melhorar UX de sensor não encontrado: botão "Tentar novamente", sugestão de verificar Bluetooth ativo.

---

## RF04 – Receber Leituras Periódicas do Sensor CGM

| CA | Critério | Status | Observação |
|----|----------|--------|------------|
| CA1 | Leitura recebida → processada e exibida | ✅ | `SensorCubit` recebe evento `readingAvailable`, `PatientCubit` persiste e atualiza UI. |
| CA2 | Sensor perde comunicação → notificação ao paciente | ⚠️ | Estado `disconnected` chega ao cubit mas **não dispara notificação push/local**. Só atualiza ícone BLE. |
| CA3 | Status do sensor atualizado (ativo/bateria baixa/expirado) | ⚠️ | `SensorConnectionStatus` tem estados granulares mas a tela de status é básica — não mostra bateria nem expiração. |

### 🔧 O que falta
- [ ] **Notificação local de perda de conexão:** usar `flutter_local_notifications`. Quando `SensorCubit` emite `disconnected`, disparar notificação Android com ação "Reconectar".
- [ ] **Página de status do sensor** (expandir `SensorLinkPage` ou criar `SensorStatusPage`): mostrar nome do sensor, último timestamp de leitura, status atual, botão reconectar. Dados de bateria/expiração precisam vir do protocolo Sibionics (verificar se `libg.so` expõe).

---

## RF05 – Visualizar Valores de Glicose com Tendência

| CA | Critério | Status | Observação |
|----|----------|--------|------------|
| CA1 | Valor atual + seta de tendência na tela principal | ✅ | `MonitoringHomePage` exibe valor, trend arrow, unidade mg/dL. |
| CA2 | Destaque visual por faixa (vermelho/amarelo/verde) | ⚠️ | `GlucoseChart` usa cores por faixa. Card do valor atual **não tem cor de destaque no número** — só no gráfico. **Precisa teste com valor alto real.** |
| CA3 | Sem dados → última leitura + timestamp + orientação para sensor | ⚠️ | `EmptyStateView` quando `currentReading == null`. Mas quando sensor desconecta após ter dados, `currentReading` fica na memória sem indicação de "dado desatualizado". |

### 🔧 O que falta
- [ ] **Cor no valor atual:** aplicar cor (vermelho/amarelo/verde) no `Text` do valor de glicose no card principal, usando os mesmos thresholds de `alertSettings`.
- [ ] **Indicador de dado stale:** quando sensor `disconnected` e há `currentReading`, mostrar timestamp da última leitura + badge "Desconectado" no card.
- [ ] Testar CA2 com valor alto real (≥ highThreshold) e confirmar destaque visual. ← **pendente usuário**

---

## Resumo Sprint 1

| RF | Título | Status |
|----|--------|--------|
| RF01 | Cadastro de Usuário | ⚠️ Parcial (bug pós-registro, sem edição de perfil, onboarding sempre abre) |
| RF02 | Autenticação | ⚠️ Parcial (login/logout ok, recuperação de senha é stub) |
| RF03 | Vincular Sensor | ⚠️ Parcial (BLE Sibionics ok, sem seleção de marca, sem câmera, sem tutorial) |
| RF04 | Receber Leituras | ⚠️ Parcial (leituras ok, sem notificação push de desconexão, status básico) |
| RF05 | Visualizar Glicose | ⚠️ Parcial (valor + tendência ok, cor no número falta, stale indicator falta) |

---

## Prioridade de implementação (para fechar Sprint 1)

### P0 — Bloqueadores de fluxo básico
1. **RF01 bug:** registrar → navegar para o app automaticamente
2. **RF01 onboarding:** só na primeira abertura (SharedPreferences flag)
3. **RF05 cor no valor:** destaque vermelho/amarelo/verde no número grande

### P1 — Funcionalidade completa do sprint
4. **RF03 câmera + tutorial:** `mobile_scanner` + stepper
5. **RF04 notificação local:** perda de conexão do sensor
6. **RF04 página de status:** expandir sensor status

### P2 — Completude dos critérios de aceite
7. **RF02 recuperação de senha:** backend Nodemailer + Flutter call real
8. **RF05 stale indicator:** badge desconectado com último timestamp
9. **RF01 CA3/CA4:** tela de edição de perfil
