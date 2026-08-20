# Glucore — Especificação Funcional

> Documento funcional completo do aplicativo Glucore. Descreve **comportamento observável e regras de negócio** para permitir a reprodução fiel da mesma funcionalidade em um novo aplicativo. Não descreve arquitetura, stack ou detalhes de implementação.

---

## 1. Propósito e público-alvo

O Glucore é um aplicativo móvel (Android) de **monitoramento contínuo de glicose (CGM)** para **pacientes com diabetes**. Ele:

- conecta-se a sensores CGM comerciais (Sibionics GS1, Accu-Chek SmartGuide, FreeStyle Libre 2) via Bluetooth/NFC e exibe leituras de glicose em tempo real;
- mantém histórico de leituras, alertas de glicose fora da faixa-alvo e um diário de refeições (carboidratos) e doses de insulina;
- calcula indicadores clínicos (média, tempo no alvo/TIR, GMI estimado);
- funciona **offline-first**: todos os dados são gravados localmente no aparelho e sincronizados em segundo plano com um serviço remoto quando há rede;
- exige conta de usuário (e-mail/senha) para uso.

Idioma da interface: **português (pt/pt-BR)** exclusivamente. Unidade de glicose: **mg/dL** exclusivamente.

O modelo de dados remoto já reserva conceitos de perfis adicionais (profissional de saúde, administrador, compartilhamento de relatórios), mas **apenas o perfil Paciente é funcional hoje** (ver §14).

---

## 2. Fluxo de entrada no app

### 2.1 Splash e onboarding

1. Ao abrir o app, exibe-se uma tela de splash.
2. Na primeira execução (flag local "onboarding concluído" ausente), exibe-se um **onboarding de 3 páginas** deslizáveis, cada uma com ícone, título e texto: (a) glicose rápida/insights, (b) alertas úteis, (c) tudo em um só lugar. Há botão **Pular** e navegação página a página; concluir ou pular grava a flag local e o onboarding nunca mais aparece (mesmo após logout).
3. Após o onboarding, verifica-se o estado de autenticação:
   - sessão válida (token aceito pelo serviço remoto) → tela principal (shell do paciente);
   - sem sessão, token inválido ou falha de rede → tela de **Login**.

### 2.2 Shell principal

Estrutura de navegação após login:

- **Barra inferior com 4 abas**: Monitor (home), Diário, Relatórios, Perfil.
- **Botão flutuante central "+"** (em todas as abas): abre uma folha "Adicionar observação" com 4 opções em grade:
  - **Refeição** → formulário de carboidratos (§8.1);
  - **Insulina** → formulário de dose (§8.2);
  - **Exercício** → apenas aviso "em breve" (não implementado);
  - **Nota livre** → apenas aviso "em breve" (não implementado).

---

## 3. Conta e autenticação

### 3.1 Cadastro

**Entrada** (formulário): nome completo, e-mail, data de nascimento (`dd/mm/aaaa`, com máscara automática), peso (kg, aceita vírgula ou ponto decimal), faixa-alvo (texto no formato `min-max`, pré-preenchido `80-180`), senha.

**Validações no app** (bloqueiam o envio):
- nome: mínimo 3 caracteres (após trim);
- e-mail: deve conter `@`;
- data de nascimento: obrigatória e válida no formato brasileiro;
- peso: obrigatório, número > 0;
- faixa-alvo: dois inteiros separados por hífen, com `min < max`;
- senha: mínimo 8 caracteres.

**Regras no serviço remoto**:
- e-mail normalizado (trim + minúsculas) e validado por expressão regular; deve ser **único** — duplicado retorna erro específico "e-mail já cadastrado";
- senha ≥ 8; nome ≥ 3; `targetRangeMin < targetRangeMax` (padrões 80/180 se omitidos); peso, se enviado, > 0; data de nascimento aceita `AAAA-MM-DD` ou `dd/mm/aaaa` e precisa ser data de calendário real;
- ao criar a conta são criados juntos: o perfil de paciente (com faixa-alvo) e a **configuração de limiares de alerta inicializada com os mesmos valores da faixa-alvo**;
- cadastro bem-sucedido retorna token de sessão e **autentica imediatamente** (sem login adicional);
- limite de taxa: 20 tentativas de cadastro por 15 minutos por origem.

**Erros exibidos ao usuário**: e-mail já existente, credenciais/dados inválidos, erro de rede (timeout/sem conexão) e erro de servidor — cada um com mensagem própria em snackbar.

### 3.2 Login

**Entrada**: e-mail + senha. **Saída**: token de sessão com validade de **30 dias**. Credenciais erradas → mensagem "credenciais inválidas" (sem revelar se o e-mail existe). Registra data do último login e cria registro de sessão (com user-agent). Limite: 10 tentativas por 15 minutos.

### 3.3 Sessão

- O token fica guardado em armazenamento seguro do aparelho e é enviado em todas as chamadas autenticadas.
- Na abertura do app, a validade é confirmada com o serviço remoto; qualquer falha (rede inclusive) leva à tela de login.
- **Logout**: na aba Configurações, com diálogo de confirmação ("Deseja sair da sua conta?"); descarta o token e volta ao login. Falha na chamada remota de logout é ignorada (logout local sempre acontece).

### 3.4 Recuperação de senha

Fluxo em 3 etapas na tela "Esqueci a senha":

1. **Solicitação**: usuário informa e-mail. O serviço **sempre responde sucesso genérico** ("se o e-mail estiver cadastrado, instruções foram enviadas") para não revelar contas existentes. Internamente, se o e-mail existe: invalida códigos anteriores não usados, gera um código (UUID) com **validade de 6 horas** e envia por e-mail (assunto "Glucore - Recuperação de senha", corpo com o código e o aviso de expiração). Limite: 10 tentativas por 15 minutos.
2. **Redefinição**: usuário digita o código recebido + nova senha (≥ 8). O código deve existir, não ter sido usado e não estar expirado — senão erro "código inválido ou expirado". Uso é único (marcado como usado).
3. **Conclusão**: tela de sucesso com botão para voltar ao login.

### 3.5 Perfil do usuário

**Consulta**: nome, e-mail, telefone, data de nascimento, tipo de diabetes, peso, faixa-alvo. A aba Perfil mostra avatar com iniciais (primeira letra do primeiro e do último nome) e o nome completo; se a consulta falhar, mostra um nome padrão.

**Edição** (tela "Editar perfil", três formulários independentes):

1. **Dados de saúde**: nome, nascimento, peso, faixa-alvo — mesmas validações do cadastro. Salvar atualiza o perfil remoto e **sincroniza os limiares de alerta com a nova faixa-alvo**.
2. **Trocar e-mail**: exige novo e-mail + **senha atual**. Senha atual incorreta → erro 401 ("senha atual incorreta"); novo e-mail já em uso por outra conta → erro 409.
3. **Trocar senha**: exige senha atual, nova senha (≥ 8) e confirmação (deve coincidir). Mesma exigência de senha atual correta.

Regra transversal do serviço: qualquer alteração de e-mail ou senha **exige a senha atual**; alterações de faixa-alvo revalidam `min < max` considerando os valores resultantes (novos + existentes).

---

## 4. Pareamento de sensores

### 4.1 Escolha da marca

Tela "Escolher sensor" (acessível por Configurações → Sensor e por Perfil → Dias restantes) lista:

| Marca | Descrição exibida | Estado |
|---|---|---|
| Sibionics | sensor implantável de 14 dias | ativo |
| Accu-Chek SmartGuide | Roche — sensor de 15 dias, pareamento com PIN | ativo |
| FreeStyle Libre 2 | Abbott — ativação por NFC + streaming Bluetooth | ativo |
| Dexcom | "Em breve" | desabilitado |

Só **uma sessão de sensor ativa por vez**; registrar/parear substitui a anterior.

### 4.2 Sibionics e Accu-Chek (fluxo por código de barras)

Tela de vínculo com **tutorial em 3 passos** (varia por marca):

- Sibionics: (1) retire o sensor da caixa; (2) escaneie o código data matrix da caixa; (3) aguarde a conexão Bluetooth automática.
- Accu-Chek: (1) aplique o sensor e guarde a tampa azul do aplicador; (2) escaneie o data matrix da tampa (dica de campo: "código da tampa, 46 caracteres"); (3) digite o PIN do sensor quando o Android exibir o diálogo de pareamento do sistema.

**Entrada do código**: câmera (leitor de Data Matrix/QR) ou colagem manual em campo de texto. Botão "Registrar sensor" só habilita com texto não vazio.

**Normalização GS1 (apenas Sibionics)**: o código escaneado cru é convertido para o formato legível `(AI)valor`:
- se já começa com `(`, é aceito como está;
- remove-se prefixo de identificação do leitor (ex.: `]d2`);
- AIs de tamanho fixo conhecidos (01→14, 02→14, 00→18, 11–19→6, 20→2 dígitos) são consumidos em sequência; AIs variáveis consomem até o separador FNC1 (ASCII 29) ou o fim;
- resultado exemplo: `(01)06972831641803(11)250623(10)LT4F250671J(21)250671N869803EDU17`;
- string vazia/irreconhecível → mantém o valor cru.
O código Accu-Chek é enviado **cru, sem normalização**.

**Registro**: o código (trim aplicado) é submetido à camada de sensor junto com a marca. A validação real do código é feita pela biblioteca de decodificação do sensor; falha gera evento de erro com mensagem exibida na tela. Sucesso cria a **sessão de sensor** (id canônico do sensor + marca) persistida no aparelho, e a tela passa a "Aguardando conexão…" (com aviso do PIN no caso Accu-Chek).

**Sessão ativa** (mesma tela): mostra id do sensor, id do transmissor (se houver), progresso de sincronização de histórico ("N leituras"), última leitura em mg/dL com horário, e botões contextuais:
- **Iniciar monitoramento** — visível quando parado (idle/desconectado/erro);
- **Desconectar** — visível quando em qualquer estado ativo (buscando, conectando, pareando, conectado, sincronizando, lendo, aquecendo);
- **Remover sensor** (limpar sessão) — sempre visível; desconecta e apaga a sessão local, voltando o app ao estado "sem sensor".

### 4.3 FreeStyle Libre 2 (fluxo NFC)

Tela própria com 3 blocos sequenciais:

1. **Biblioteca da Abbott** (pré-requisito): o Libre 2 exige uma biblioteca de algoritmos extraída do APK oficial do LibreLink (arm64). O app mostra se ela já está instalada; senão, o usuário seleciona o arquivo APK no aparelho e o app extrai/instala a biblioteca. Sucesso → "Biblioteca instalada com sucesso". O bloco NFC fica desabilitado enquanto não instalada.
2. **Leitura NFC**: botão iniciar/parar. Com a leitura ativa, o usuário aproxima o telefone do sensor. Resultados possíveis (cada um com mensagem própria):
   - `activated` — sensor recém-ativado; aguardar ~60 minutos de aquecimento e escanear de novo;
   - `warmup` — sensor ainda em aquecimento (período de 60 min);
   - `ready` / `streaming` — sensor vinculado, streaming Bluetooth habilitado; pode iniciar o monitoramento;
   - `ended` — sensor no fim da vida útil; usar sensor novo;
   - `needsLibrary` — biblioteca ausente (volta ao passo 1);
   - `unsupportedLibre3` — sensor Libre 3 detectado, não suportado;
   - `unsupportedUsGen2` — Libre 2 US (gen2), não suportado;
   - `readError` — falha de leitura NFC (manter o telefone parado e tentar de novo);
   - `error` — falha genérica de processamento.
   Quando o sensor é registrado com sucesso (`activated`/`warmup`/`ready`/`streaming`), a leitura NFC é encerrada automaticamente. Sair da tela com leitura ativa também a encerra.
3. **Sensor vinculado**: mostra id, última leitura e botão iniciar/parar monitoramento.

---

## 5. Monitoramento contínuo

### 5.1 Estados da conexão

A sessão de sensor tem os estados: `idle` (sem atividade), `scanning` (procurando sinal Bluetooth), `connecting`, `pairing` (aguardando PIN no diálogo do sistema — só Accu-Chek), `connected`, `syncingHistory` (recebendo backlog de leituras antigas), `warmingUp` (sensor calibrando; previsto no contrato, hoje só emitido pelo simulador), `readingAvailable` (leitura atual disponível), `disconnected`, `error` (com mensagem de falha).

Regras de transição relevantes:
- "Iniciar monitoramento" é ignorado se já estiver em estado ativo (scanning/connecting/pairing/connected/syncingHistory/readingAvailable); senão passa a `scanning` e limpa erro anterior.
- Sequência feliz: `scanning → connecting → [pairing] → connected → syncingHistory (×N) → readingAvailable → readingAvailable (a cada ~5 min)`.
- Falha de conexão: `scanning → connecting → error` (ou `disconnected`).
- Um assinante que passa a observar os eventos recebe imediatamente o **último estado emitido** (replay), portanto o tratamento deve ser idempotente.

### 5.2 Restauração automática

Na abertura do app (usuário autenticado), se existe sessão de sensor salva no aparelho, ela é restaurada (estado inicial `disconnected`) e o **monitoramento inicia automaticamente**. Sem sessão salva, o app fica em `idle` ("Sem sensor conectado — toque no ícone Bluetooth para parear").

### 5.3 Leituras de glicose

- **Leitura**: valor em mg/dL (decimal), timestamp, taxa de variação (mg/dL por minuto, com sinal) e código de alarme opcional.
- Faixa válida decodificável: **20 a 1000 mg/dL** (leituras fora disso são descartadas pela camada de decodificação).
- Cadência típica: uma leitura a cada **~5 minutos**.
- **Tendência** derivada da taxa: taxa > 0 → subindo; < 0 → caindo; = 0 → estável.

### 5.4 Sincronização de histórico (backlog)

Ao conectar, o sensor envia primeiro um **backlog de leituras antigas** antes da leitura atual:

- durante essa fase o estado é `syncingHistory`, com progresso (contagem recebida + timestamp mais recente) exibido na UI ("Sincronizando histórico — N leituras");
- cada leitura de backlog é inserida na lista histórica do paciente, **sem ser tratada como leitura atual**;
- a leitura candidata a "atual" só é promovida quando: tem no máximo **20 minutos** de idade e passam **2 segundos sem novos quadros** do sensor; então emite-se `readingAvailable`;
- depois da promoção, leituras novas chegam direto como `readingAvailable`; leituras **fora de ordem** (timestamp anterior ao último publicado) são descartadas;
- a lista histórica é **persistida em lote único** quando a leitura atual chega (não a cada item do backlog).

### 5.5 Regras de armazenamento das leituras

- Inserção com **deduplicação por timestamp** (mesma marca temporal substitui a existente).
- Lista ordenada da mais recente para a mais antiga, limitada a **288 leituras** (≈24 h em intervalos de 5 min); excedentes mais antigos são descartados.
- Uma leitura é considerada **"ao vivo"** se tem menos de **15 minutos**; isso controla o selo "ao vivo" do cartão principal.

### 5.6 Monitoramento em segundo plano

Com o monitoramento ativo, uma **notificação permanente** do sistema mantém a coleta funcionando com o app fora de tela (serviço em primeiro plano). Encerrar o monitoramento remove a notificação.

### 5.7 Perda e retomada de conexão

- Transição de estado ativo (connected/readingAvailable/syncingHistory/warmingUp) para `disconnected` ou `error` → **notificação do sistema** "Sensor desconectado — O sensor CGM perdeu a conexão. Toque para reconectar."
- Reconexão (`connected` vindo de `disconnected`/`error`) → registra alerta in-app "sensor reconectado" (ver §7).
- Erro com mensagem de falha → registra alerta in-app "falha de sincronização".

---

## 6. Tela Monitor (home)

Conteúdo, de cima para baixo:

1. **Barra superior**: logotipo (3 toques em 5 s abrem o painel de debug — só em builds de desenvolvimento, §13), ícone de notificações (abre §7.3) e ícone Bluetooth ("Parear sensor", abre §4.2).
2. **Cartão principal (hero)**:
   - sem leitura atual → cartão de estado do sensor com ícone/título/subtítulo específicos por estado (procurando, conectando, pareamento necessário, sincronizando histórico, aquecendo, erro de conexão, sem sensor);
   - com leitura → valor grande em mg/dL, cor da **zona glicêmica** (§10.1), seta de tendência, id do sensor, horário da última atualização e selo "ao vivo" quando a leitura tem <15 min.
3. **Gráfico "Últimas 12 horas"** (apenas se houver leituras): linha de glicose com eixo Y fixo de 40 a 400 mg/dL, faixa-alvo destacada pelos limiares configurados, e **marcadores tocáveis** de refeições e insulina dentro da janela. Tocar num marcador abre popup com resumo (ex.: "45 g carb · 05/07 12:30" ou "6.0 UI · Bolus") e ações **Editar** / **Excluir** (com diálogo "Esta ação não pode ser desfeita").
4. **Linha de estatísticas** (apenas se houver leituras, calculadas sobre toda a lista em memória):
   - **Tempo no alvo**: % de leituras dentro de [limiar baixo, limiar alto]; verde quando ≥ 70%, senão âmbar/laranja;
   - **Média** em mg/dL;
   - **GMI estimado** — exibido só com ≥ 14 leituras (§10.2).
5. **Faixa do sensor** (se há sessão): "Xd restantes · <id truncado em 8 caracteres>", onde X = `14 − dias decorridos desde o vínculo`, limitado a [0, 14]. (Observação: o cálculo usa 14 dias para todas as marcas.)

---

## 7. Alertas e notificações

### 7.1 Limiares configuráveis

- Dois limiares por paciente: **baixo** e **alto** (mg/dL, inteiros). Padrões: **80/180**.
- Tela "Alertas de glicose": dois campos numéricos; validação: valores numéricos e **baixo < alto** (senão mensagem de erro e não salva). Salvar persiste localmente e sincroniza com o serviço remoto.
- No cadastro/edição de perfil, a faixa-alvo do paciente inicializa/atualiza esses limiares no serviço remoto.

### 7.2 Geração de alertas in-app

A cada **leitura atual** (não em leituras de backlog):
- valor ≤ limiar baixo → alerta **glicose baixa**;
- valor ≥ limiar alto → alerta **glicose alta**.

Alertas de conexão: **sensor reconectado** (§5.7) e **falha de sincronização** (§5.7).

**Anti-spam**: um novo alerta é descartado se já existe alerta **do mesmo tipo** com timestamp a menos de **15 minutos** de distância. Lista limitada a **100 alertas** (mais antigos descartados). Alertas são persistidos e sincronizados (exceto em modo simulado).

### 7.3 Tela de Notificações

Lista os alertas (mais recente primeiro), cada um com ícone/cor pelo tipo, título, mensagem explicativa e data/hora. Vazio → "Sem notificações".

### 7.4 Notificações do sistema

- Implementada e disparada: **sensor desconectado** (§5.7), em canal de alta prioridade "Status do Sensor".
- Definidas mas **ainda não disparadas** automaticamente: notificações de sistema para glicose baixa/alta (existem os modelos "Glicose baixa: X mg/dL" / "Glicose alta: X mg/dL", sem gatilho ligado). Os alertas baixo/alto hoje aparecem apenas dentro do app.
- Em Configurações há **3 interruptores** (alerta de glicose baixa, alta, perda de sinal) — atualmente **apenas visuais**: não são persistidos nem alteram comportamento.

---

## 8. Diário (carboidratos e insulina)

### 8.1 Registro de refeição (carboidratos)

**Campos**: data/hora (padrão agora; seletor limitado ao intervalo [30 dias atrás, agora]), quantidade em gramas, descrição.
**Validações**: gramas inteiro > 0; descrição obrigatória (não vazia após trim).
**Saída**: entrada criada, snackbar de sucesso, retorno à tela anterior. A lista fica ordenada da mais recente para a mais antiga.

### 8.2 Registro de insulina

**Campos**: tipo de dose (**Bolus**, **Basal** ou **Correção** — padrão Bolus), unidades (decimal), data/hora (mesmo seletor/limites), dia da semana (lista fixa em português, Segunda-feira…Domingo; padrão = dia da data escolhida).
**Validações**: unidades número > 0.
**Saída**: idem refeição. Unidades exibidas com 1 casa decimal ("6.0 UI").

### 8.3 Edição e exclusão

- Ambos os tipos têm tela de edição com os mesmos campos/validações, mais botão de exclusão.
- Acesso: tocar no item no Diário, ou tocar no marcador do gráfico (popup Editar/Excluir).
- Exclusão sempre pede confirmação ("Excluir registro? Esta ação não pode ser desfeita.").
- **Identidade do registro**: edição/exclusão localizam o item pelo **timestamp exato** (milissegundos) — dois registros com o mesmo instante são indistinguíveis (caso de borda conhecido).
- Limite local: **100 entradas** por coleção (carboidratos e insulina, separadamente).

### 8.4 Tela Diário

Feed unificado de refeições + insulina, ordenado do mais recente ao mais antigo, **agrupado por dia** com cabeçalhos "Hoje", "Ontem" ou "dia da semana, d mês" (pt-BR). Cada item mostra ícone (refeição/insulina), título (descrição da refeição, ou "Refeição" se vazia; "Insulina bolus/basal/Correção"), detalhe ("45 g carb" / "6.0 UI · Quarta-feira") e hora. Vazio → convite a usar o botão "+".

---

## 9. Histórico e Relatórios

### 9.1 Histórico de leituras

Acessível pelo Perfil ("Histórico de leituras — N leituras"). Agrupa as leituras por dia (últimos **7 dias com dados**), cada linha com:
- rótulo do dia (Hoje/Ontem/"d mês");
- **sparkline** (minigráfico da curva do dia, eixo 40–400; requer ≥ 2 leituras, senão "—"), colorida pela zona da última leitura do dia;
- média do dia em mg/dL (colorida pela zona da média) e "TIR N%" (percentual dentro dos limiares configurados).

Sem leituras → estado vazio "Sem leituras registradas".

### 9.2 Relatórios

Aba com seletor de período por chips: **7, 14, 30 ou 90 dias** (padrão 14). Considera as leituras da janela escolhida (limitadas pelo cap local de 288 — ver observação abaixo).

- **Cartão Indicadores**: glicose média (mg/dL), GMI estimado (apenas com ≥ 14 leituras na janela) e contagem de leituras.
- **Cartão Tempo no alvo**: barra empilhada + legenda com 5 zonas e seus percentuais:

| Zona | Faixa exibida | Regra de classificação |
|---|---|---|
| Baixo urgente | < 54 | valor < 54 |
| Baixo | 54–70 | 54 ≤ valor < limiar baixo |
| No alvo | 70–180 | limiar baixo ≤ valor ≤ limiar alto |
| Alto | 180–250 | limiar alto < valor ≤ 250 |
| Alto urgente | > 250 | valor > 250 |

(Os rótulos de faixa da legenda são fixos 54/70/180/250; a classificação real usa os limiares configurados para as zonas centrais — com limiares padrão 80/180 os rótulos e a regra ficam próximos, mas não idênticos: caso de borda conhecido.)

- Sem leituras no período → "Sem leituras no período".
- Observação de escopo: como o armazenamento local retém no máximo 288 leituras, na prática os períodos longos (30/90 dias) só refletem o que estiver retido localmente.

---

## 10. Cálculos e algoritmos

### 10.1 Zona glicêmica de um valor

```
se valor < 54            → baixo urgente
senão se valor < limiarBaixo → baixo
senão se valor ≤ limiarAlto  → no alvo
senão se valor ≤ 250     → alto
senão                    → alto urgente
```

Usada para colorir o cartão principal, estatísticas, histórico e relatórios.

### 10.2 GMI (Glucose Management Indicator)

```
GMI = 0.0296 × médiaGlicose(mg/dL) + 2.419
```

Só é exibido quando o conjunto tem **≥ 14 leituras**; exibido com 1 casa decimal.

### 10.3 Tempo no alvo (TIR)

`TIR% = leituras com limiarBaixo ≤ valor ≤ limiarAlto ÷ total × 100`, arredondado a inteiro.

### 10.4 Tendência

`taxa > 0 → subindo; taxa < 0 → caindo; taxa = 0 → estável` (taxa em mg/dL/min).

### 10.5 Decodificação da leitura do sensor (formato empacotado)

A leitura crua do sensor chega como um par (timestamp, valor empacotado de 64 bits):

- timestamp em segundos ou milissegundos — normalizado para ms (multiplica por 1000 se < 10^10);
- bits 0–31: glicose em **décimos de mg/dL** (válido 200..10000 → 20..1000 mg/dL; `mgdl = décimos / 10`);
- bits 32–47: taxa de tendência × 1000, inteiro de 16 bits com sinal;
- bits 48–55: código de alarme.

### 10.6 Normalização GS1

Descrita em §4.2.

### 10.7 Simulador (modo debug)

Glicose por passeio aleatório: `delta = (aleatório[0,1) − 0.45) × 8`, valor limitado a [70, 200] mg/dL, taxa = delta/5; backlog de 24 leituras (2 h) e leitura nova a cada 5 min.

---

## 11. Persistência local e sincronização

### 11.1 Modelo offline-first

- **Fonte primária = banco local do aparelho.** Toda leitura de dados na abertura vem do local; o app funciona integralmente sem rede (exceto login/perfil, que exigem o serviço remoto).
- Cinco coleções locais: leituras, alertas, carboidratos, insulina, configurações de alerta. Cada gravação marca a coleção como **pendente de envio**.
- Limites locais: 288 leituras, 100 alertas, 100 carboidratos, 100 insulinas.

### 11.2 Envio (push)

- Gravações disparam um push com **debounce de ~2 s** (várias gravações seguidas viram um envio só).
- Push envia **cada coleção pendente inteira** (replace-all) ao serviço remoto e a marca como sincronizada.
- Falha de rede → **retries com atrasos de 1 s e 4 s**; se persistir, a pendência fica guardada silenciosamente.
- Quando a conectividade volta, um push é reagendado automaticamente.
- Nunca há dois pushes simultâneos (fila serializada).

### 11.3 Reconciliação (pull)

Na inicialização (em segundo plano, silenciosa se offline):
1. envia pendências locais (push);
2. só se o push zerar as pendências, baixa o snapshot remoto completo;
3. substitui o conteúdo local pelo remoto **preservando pendências que restarem**;
4. atualiza a UI com o resultado — exceto se o modo simulado estiver ativo.

### 11.4 Exceção: modo simulado

Leituras/alertas gerados pelo sensor simulado (§13) **nunca são persistidos nem sincronizados**; ao desativar o simulador, o app descarta os dados em memória e recarrega o estado persistido real.

---

## 12. Integração com o serviço remoto (API)

Serviço HTTP autenticado por token Bearer (obtido em login/cadastro). Todas as rotas de dados operam **no escopo do paciente autenticado**. Resumo funcional:

| Recurso | Operações | Comportamento |
|---|---|---|
| Conta | cadastrar; login; status da sessão; consultar perfil; atualizar perfil; esqueci/redefinir senha | Regras em §3. |
| Leituras | listar (últimas 288, desc.); enviar lote (até 288, **upsert por paciente+timestamp**, valor arredondado a inteiro mg/dL); apagar todas | Campos por leitura: valor, timestamp (epoch ms), tendência (texto), taxa, código de alarme opcional. |
| Carboidratos | listar (últimos 100, desc.); criar item; atualizar item; excluir item; enviar lote (obsoleto, replace-all) | Item: id (UUID, pode ser gerado pelo cliente), gramas (número), descrição (texto), timestamp. Atualizar/excluir item de outro paciente ou inexistente → "não encontrado". |
| Insulina | idem carboidratos | Item: id, unidades (número), tipo (texto não vazio), timestamp, dia da semana (texto, opcional). |
| Alertas | listar (últimos 100, desc.); enviar lote (replace-all) | Item: tipo (glicose baixa/alta, sensor reconectado, falha de sincronização; o serviço também reconhece tipos reservados de risco de queda/subida rápida) + timestamp. |
| Config. de alertas | consultar; salvar | Limiar baixo/alto; padrão 80/180 quando nunca configurado. |

Validações do serviço: números finitos onde exigido, UUIDs válidos, arrays onde esperado; erros retornam mensagem descritiva. **Observação**: o app hoje usa os envios em lote (replace-all) para todas as coleções; as operações por item existem no serviço para evolução futura.

Outras integrações externas: **e-mail transacional** (recuperação de senha, via SMTP configurável — sem SMTP o código fica apenas registrado no log do servidor) e o **hardware do telefone** (Bluetooth LE para os três sensores, NFC para Libre 2, câmera para o leitor de códigos, seletor de arquivos para o APK do LibreLink).

---

## 13. Painel de debug (apenas builds de desenvolvimento)

Aberto com 3 toques no logotipo em até 5 s (home). Nunca disponível em versão de produção. Funções:

- **Ativar/Desativar Mock**: substitui o sensor real por um simulador que reproduz a sequência completa de conexão (incluindo o passo de PIN quando simula Accu-Chek), gera backlog e leituras periódicas (§10.7). Indicador "MOCK ATIVO"/"REAL".
- **Simular hipoglicemia** (injeta leitura 48 mg/dL, taxa −2.5) e **hiperglicemia** (285 mg/dL, taxa +3.0) — leituras marcadas como simuladas.
- **Limpar leituras**: zera a lista de leituras (e, fora do modo simulado, também o armazenamento local/remoto).

---

## 14. Modelos de dados

### 14.1 Entidades ativas

**Usuário** — id (UUID); nome completo; e-mail (único); telefone?; status (ATIVO/INATIVO/BLOQUEADO, padrão ATIVO); papel (PACIENTE/PROFISSIONAL_DE_SAÚDE/ADMINISTRADOR, padrão PACIENTE); datas de criação/atualização. Relação 1-1 com credencial, paciente, sessões e tokens de redefinição.

**Credencial** — hash de senha; data do último login; campos reservados para MFA (segredo + flag, não usados).

**Sessão de autenticação** — usuário; emissão; expiração (30 dias); user-agent?; flag de revogação.

**Token de redefinição de senha** — token (único); usuário; expiração (6 h); data de uso (uso único).

**Paciente** (extensão 1-1 do usuário) — data de nascimento?; tipo de diabetes? (texto livre); peso (kg, decimal)?; faixa-alvo min/max (inteiros, padrão 80/180, min < max).

**Configuração de limiares de alerta** — 1 por paciente; limiar baixo/alto (mg/dL, padrão 80/180); janela de predição em minutos (padrão 30, reservado); data de atualização.

**Leitura de glicose** — paciente; timestamp (**único por paciente**); valor mg/dL (inteiro no remoto, decimal no app); tendência (texto: rising/stable/falling, padrão stable); taxa (decimal, padrão 0); origem (padrão "sensor"); flag manual (padrão falso); código de alarme?.

**Evento de carboidrato** — paciente; timestamp; gramas (decimal no remoto, inteiro no app); descrição (obrigatória).

**Evento de insulina** — paciente; timestamp; tipo (texto: bolus/basal/correction); unidades (decimal); dia da semana (texto, padrão vazio); descrição?.

**Evento de alerta** — paciente; timestamp de disparo; tipo (HYPO_RISK, HYPER_RISK, FAST_DROP, FAST_RISE, SENSOR_RECONNECTED, SYNC_FAILURE); mensagem (padrão vazia); reconhecido (padrão falso); data de resolução?. Mapeamento app↔remoto: glicose baixa↔HYPO_RISK; glicose alta↔HYPER_RISK; sensor reconectado↔SENSOR_RECONNECTED; falha de sincronização↔SYNC_FAILURE (FAST_DROP/FAST_RISE degradam para "falha de sincronização" ao voltar ao app).

**Sessão de sensor (local, no aparelho)** — id do sensor; id do transmissor?; marca (sibionics/accuchek/libre2); data de criação. Única (no máximo 1 ativa).

### 14.2 Entidades modeladas para evolução futura (sem uso funcional hoje)

Dispositivo de sensor (número de série, marca, modelo, firmware), vínculo sensor-paciente, sessão de sensor remota com eventos de status, predição de glicose (horizonte/valor/confiança), relatório clínico com snapshots de métricas (média, TIR, hipo/hiper %, GMI), concessão de acesso ao painel para profissional de saúde, perfis Profissional de Saúde e Administrador. O app também expõe internamente um indicador "predição disponível" fixo em falso.

---

## 15. Estados, permissões e casos de borda consolidados

**Estados de autenticação**: inicial → carregando → autenticado | não autenticado | falha (com tipo de erro: credenciais inválidas, e-mail já existe, rede, servidor).

**Estados do sensor**: ver §5.1.

**Permissões/recursos do sistema exigidos em uso**: Bluetooth (todas as marcas), NFC (Libre 2), câmera (leitura de código), notificações (alertas e serviço em primeiro plano), acesso a arquivo (APK do LibreLink).

**Casos de borda e regras finas**:
- Registrar sensor com sessão existente substitui a sessão.
- Leituras com timestamp duplicado substituem a anterior; leituras atrasadas (fora de ordem) do sensor são descartadas.
- Leitura de backlog nunca vira "leitura atual" nem dispara alerta de limiar.
- Alerta duplicado (mesmo tipo em <15 min) é suprimido.
- Limiar baixo deve ser < alto em todas as superfícies (formulário local e serviço remoto).
- Contagem regressiva do sensor usa 14 dias fixos para todas as marcas (mesmo o Accu-Chek sendo anunciado como 15 dias).
- Edição/exclusão de diário identifica o registro pelo timestamp exato.
- Sem rede: tudo funciona localmente; pendências acumulam e são enviadas quando a rede volta; a reconciliação com o servidor só sobrescreve o local após conseguir enviar as pendências.
- Dados do modo simulado nunca tocam armazenamento nem servidor.
- Onboarding aparece uma única vez por instalação, independentemente da conta.
- Recuperação de senha nunca revela se o e-mail existe; código expira em 6 h e é de uso único; solicitar novo código invalida os anteriores.
- Rótulos fixos da legenda de zonas nos relatórios (54/70/180/250) podem divergir dos limiares configurados usados no cálculo das zonas centrais.
- Interruptores de notificação em Configurações e "Exportar dados" são placeholders sem efeito.
