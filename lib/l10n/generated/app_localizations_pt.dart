// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Portuguese (`pt`).
class AppLocalizationsPt extends AppLocalizations {
  AppLocalizationsPt([String locale = 'pt']) : super(locale);

  @override
  String get appName => 'Glucore';

  @override
  String get appSensorMvpTitle => 'Glucore Sensor MVP';

  @override
  String get splashSubtitle => 'Monitoramento glicêmico claro e confiável';

  @override
  String get onboardingQuickGlucoseTitle => 'Leitura rápida da glicose';

  @override
  String get onboardingQuickGlucoseText =>
      'Veja glicose atual, tendência e previsão de 15 minutos em poucos segundos.';

  @override
  String get onboardingHelpfulAlertsTitle => 'Alertas úteis e discretos';

  @override
  String get onboardingHelpfulAlertsText =>
      'Receba avisos de risco de baixa ou alta sem linguagem alarmista.';

  @override
  String get onboardingAllInOneTitle => 'Tudo em um só lugar';

  @override
  String get onboardingAllInOneText =>
      'Consolide glicose, carboidratos, insulina e eventos no mesmo fluxo.';

  @override
  String get onboardingSkipButton => 'Pular';

  @override
  String get onboardingNextButton => 'Próximo';

  @override
  String get onboardingStartButton => 'Começar';

  @override
  String genericStatusLabel(Object status) {
    return 'Status: $status';
  }

  @override
  String genericErrorLabel(Object message) {
    return 'Erro: $message';
  }

  @override
  String get genericEmailLabel => 'E-mail';

  @override
  String get genericPasswordLabel => 'Senha';

  @override
  String get genericInvalidEmailError => 'Informe um e-mail válido';

  @override
  String get genericPasswordMinLengthError =>
      'A senha deve ter ao menos 4 caracteres';

  @override
  String get genericNumericValueError => 'Informe um valor numérico';

  @override
  String get genericRequiredFieldError => 'Campo obrigatório';

  @override
  String get genericResetButton => 'Resetar';

  @override
  String get genericCancelButton => 'Cancelar';

  @override
  String get genericDisconnectButton => 'Desconectar';

  @override
  String genericTimeLabel(Object time) {
    return 'Horário: $time';
  }

  @override
  String genericUpdatedAtLabel(Object timestamp) {
    return 'Atualizado: $timestamp';
  }

  @override
  String get genericGlucoseUnit => 'mg/dL';

  @override
  String genericGlucoseValue(Object value) {
    return '$value mg/dL';
  }

  @override
  String get loginTitle => 'Entrar';

  @override
  String get loginWelcomeTitle => 'Bem-vindo ao Glucore';

  @override
  String get loginSubtitle =>
      'Acompanhe seus dados de CGM com clareza e confiança.';

  @override
  String get loginEmailRequiredError => 'Informe um e-mail';

  @override
  String get loginForgotPasswordButton => 'Esqueci minha senha';

  @override
  String get loginSubmitButton => 'Entrar';

  @override
  String get loginSubmittingButton => 'Entrando...';

  @override
  String get loginCreateAccountButton => 'Criar conta';

  @override
  String get loginInvalidCredentialsError =>
      'Credenciais inválidas. Use e-mail e senha com 4 ou mais caracteres.';

  @override
  String get forgotPasswordTitle => 'Recuperar senha';

  @override
  String get forgotPasswordRegisteredEmailLabel => 'E-mail cadastrado';

  @override
  String get forgotPasswordSubmitButton => 'Enviar instruções';

  @override
  String get forgotPasswordSuccessMessage =>
      'Instruções de recuperação enviadas por e-mail.';

  @override
  String get registerTitle => 'Cadastro';

  @override
  String get registerFullNameLabel => 'Nome completo';

  @override
  String get registerFullNameError => 'Informe seu nome completo';

  @override
  String get registerSubmitButton => 'Criar conta';

  @override
  String get registerSuccessMessage =>
      'Cadastro realizado. Faça login para continuar.';

  @override
  String get homeTitle => 'Home';

  @override
  String get homeLogoutTooltip => 'Sair';

  @override
  String get homeAuthenticatedMessage => 'Usuário autenticado com sucesso!';

  @override
  String get navigationMonitorLabel => 'Monitorar';

  @override
  String get navigationHistoryLabel => 'Histórico';

  @override
  String get navigationAlertsLabel => 'Alertas';

  @override
  String get navigationSettingsLabel => 'Ajustes';

  @override
  String get monitoringLinkSensorTooltip => 'Vincular sensor';

  @override
  String get monitoringEmptyStateTitle => 'Sem leituras no momento';

  @override
  String get monitoringEmptyStateMessage =>
      'Conecte um sensor para visualizar dados glicêmicos.';

  @override
  String get monitoringCurrentGlucoseTitle => 'Glicose atual';

  @override
  String get monitoringTrendRising => '↑ Subindo';

  @override
  String get monitoringTrendStable => '→ Estável';

  @override
  String get monitoringTrendFalling => '↓ Descendo';

  @override
  String monitoringLastReading(Object time) {
    return 'Última leitura: $time';
  }

  @override
  String get monitoringPredictionUnavailableTitle => 'Previsão indisponível';

  @override
  String get monitoringPredictionUnavailableSubtitle =>
      'Tentaremos atualizar automaticamente em breve.';

  @override
  String monitoringPredictionIn15Minutes(Object value) {
    return 'Previsão 15 min: $value mg/dL';
  }

  @override
  String get monitoringSensorConnectedTitle => 'Sensor conectado';

  @override
  String get monitoringSensorConnectedSubtitle =>
      'Leituras sincronizadas em tempo adequado.';

  @override
  String get monitoringSensorDisconnectedTitle => 'Sensor desconectado';

  @override
  String get monitoringSensorDisconnectedSubtitle =>
      'Verifique a conexão para continuar recebendo leituras atuais.';

  @override
  String get monitoringNoRecentReadingTitle => 'Sem leitura recente';

  @override
  String get monitoringNoRecentReadingSubtitle =>
      'Os dados podem estar desatualizados no momento.';

  @override
  String get monitoringSyncFailureTitle => 'Falha temporária de sincronização';

  @override
  String get monitoringSyncFailureSubtitle =>
      'Estamos tentando sincronizar novamente.';

  @override
  String get monitoringCarbButton => 'Carboidrato';

  @override
  String get monitoringInsulinButton => 'Insulina';

  @override
  String get monitoringRecentReadingsTitle => 'Leituras recentes';

  @override
  String monitoringRecentReadingTime(Object time) {
    return 'Horário: $time';
  }

  @override
  String get historyTitle => 'Histórico';

  @override
  String get historyEmptyStateTitle => 'Sem histórico ainda';

  @override
  String get historyEmptyStateMessage =>
      'As leituras aparecerão aqui assim que o sensor enviar dados.';

  @override
  String get historyCarbsSectionTitle => 'Carboidratos';

  @override
  String get historyInsulinSectionTitle => 'Insulina';

  @override
  String historyCarbEntryTitle(Object grams, Object description) {
    return '$grams g - $description';
  }

  @override
  String historyInsulinEntryTitle(Object units, Object type) {
    return '$units U - $type';
  }

  @override
  String get alertsTitle => 'Alertas recentes';

  @override
  String get alertsEmptyStateTitle => 'Nenhum alerta recente';

  @override
  String get alertsEmptyStateMessage =>
      'Quando ocorrerem eventos importantes, eles aparecerão aqui.';

  @override
  String alertsItemSubtitle(Object message, Object timestamp) {
    return '$message\n$timestamp';
  }

  @override
  String get alertTypeImminentHypoTitle => 'Risco de hipo iminente';

  @override
  String get alertTypeImminentHypoMessage =>
      'Tendência de queda nas próximas leituras. Considere monitorar de perto.';

  @override
  String get alertTypeSensorReconnectedTitle => 'Sensor reconectado';

  @override
  String get alertTypeSensorReconnectedMessage =>
      'Coleta de glicose normalizada com sucesso.';

  @override
  String get settingsTitle => 'Configurações';

  @override
  String get settingsProfileAndHealthTile => 'Perfil e dados de saúde';

  @override
  String get settingsSensorLinkTile => 'Vinculação de sensor CGM';

  @override
  String get settingsAlertSettingsTile => 'Configuração de alertas';

  @override
  String get settingsLogoutTile => 'Sair da conta';

  @override
  String get sensorLinkTitle => 'Vincular sensor CGM';

  @override
  String get sensorLinkRebindAttemptMessage => 'Tentando revincular sensor...';

  @override
  String get sensorLinkRebindButton => 'Revincular sensor';

  @override
  String get sensorLinkStatusSearchingLabel => 'Buscando';

  @override
  String get sensorLinkStatusPermissionPendingLabel => 'Permissão pendente';

  @override
  String get sensorLinkStatusConnectedLabel => 'Conectado';

  @override
  String get sensorLinkStatusCompatibilityErrorLabel => 'Compatibilidade';

  @override
  String get sensorLinkStatusReconnectingLabel => 'Revinculando';

  @override
  String get sensorLinkStatusUnavailableLabel => 'Indisponível';

  @override
  String get sensorLinkStatusDisconnectedLabel => 'Desconectado';

  @override
  String get sensorLinkSearchingTitle => 'Buscando sensor';

  @override
  String get sensorLinkSearchingSubtitle => 'Aproxime o sensor do dispositivo.';

  @override
  String get sensorLinkPermissionPendingTitle => 'Permissão pendente';

  @override
  String get sensorLinkPermissionPendingSubtitle =>
      'Permita o Bluetooth para conectar o sensor.';

  @override
  String get sensorLinkConnectedTitle => 'Sensor conectado';

  @override
  String get sensorLinkConnectedSubtitle => 'Leituras em tempo quase real.';

  @override
  String get sensorLinkCompatibilityErrorTitle => 'Erro de compatibilidade';

  @override
  String get sensorLinkCompatibilityErrorSubtitle =>
      'Modelo não suportado no momento.';

  @override
  String get sensorLinkReconnectingTitle => 'Revinculando';

  @override
  String get sensorLinkReconnectingSubtitle =>
      'Aguarde, estamos restabelecendo a conexão.';

  @override
  String get sensorLinkUnavailableTitle => 'Sensor indisponível';

  @override
  String get sensorLinkUnavailableSubtitle =>
      'Não foi possível localizar um sensor próximo.';

  @override
  String get sensorLinkDisconnectedTitle => 'Sensor desconectado';

  @override
  String get sensorLinkDisconnectedSubtitle =>
      'Reconecte para retomar leituras atualizadas.';

  @override
  String get alertSettingsTitle => 'Configuração de alertas';

  @override
  String get alertSettingsLowThresholdLabel => 'Limite baixo (mg/dL)';

  @override
  String get alertSettingsHighThresholdLabel => 'Limite alto (mg/dL)';

  @override
  String get alertSettingsLowMustBeLowerError =>
      'O limite baixo deve ser menor que o alto.';

  @override
  String get alertSettingsUpdatedSuccessMessage =>
      'Alertas atualizados com sucesso.';

  @override
  String get alertSettingsSaveButton => 'Salvar alertas';

  @override
  String get profileTitle => 'Perfil';

  @override
  String get profileDefaultName => 'Paciente Glucore';

  @override
  String get profileNameLabel => 'Nome';

  @override
  String get profileBirthDateLabel => 'Data de nascimento';

  @override
  String get profileWeightLabel => 'Peso (kg)';

  @override
  String get profileTargetRangeLabel => 'Faixa alvo de glicose (mg/dL)';

  @override
  String get profileUpdatedSuccessMessage => 'Perfil atualizado com sucesso.';

  @override
  String get profileSaveChangesButton => 'Salvar alterações';

  @override
  String get carbEntryTitle => 'Registrar carboidrato';

  @override
  String get carbEntryQuantityLabel => 'Quantidade (g)';

  @override
  String get carbEntryDescriptionLabel => 'Descrição da refeição';

  @override
  String get carbEntryQuantityError => 'Informe uma quantidade válida';

  @override
  String get carbEntryDescriptionError => 'Informe a descrição';

  @override
  String get carbEntrySavedSuccessMessage =>
      'Carboidrato registrado com sucesso.';

  @override
  String get carbEntrySaveButton => 'Salvar registro';

  @override
  String get insulinEntryTitle => 'Registrar insulina';

  @override
  String get insulinEntryDoseTypeLabel => 'Tipo de dose';

  @override
  String get insulinTypeBolus => 'Bolus';

  @override
  String get insulinTypeBasal => 'Basal';

  @override
  String get insulinTypeCorrection => 'Correção';

  @override
  String get insulinEntryQuantityLabel => 'Quantidade (U)';

  @override
  String get insulinEntryQuantityError => 'Informe uma quantidade válida';

  @override
  String get insulinEntrySavedSuccessMessage =>
      'Aplicação de insulina registrada.';

  @override
  String get insulinEntrySaveButton => 'Salvar aplicação';

  @override
  String get sensorPageTitle => 'Glucore Sensor MVP';

  @override
  String get sensorPageNoActiveSessionMessage =>
      'Nenhuma sessão ativa de sensor.';

  @override
  String get sensorPageBarcodeLabel => 'Código de barras do sensor';

  @override
  String get sensorPageRegisterButton => 'Registrar sensor';

  @override
  String sensorPageRegisteredSensor(Object sensorId) {
    return 'Sensor registrado: $sensorId';
  }

  @override
  String get sensorPageStartMonitoringButton => 'Iniciar monitoramento';

  @override
  String sensorPageConnecting(Object status) {
    return 'Conectando... ($status)';
  }

  @override
  String sensorPageWarmupProgress(Object elapsed, Object total) {
    return 'Aquecimento: $elapsed/$total s';
  }

  @override
  String get sensorPageConnectedMessage =>
      'Sensor conectado. Aguardando aquecimento e leituras.';

  @override
  String get sensorPageBeginWarmupButton => 'Iniciar aquecimento';

  @override
  String sensorPageCurrentGlucose(Object value) {
    return 'Glicose atual: $value mg/dL';
  }

  @override
  String get sensorPageStopMonitoringButton => 'Parar monitoramento';

  @override
  String get sensorPageClearSessionButton => 'Limpar sessão';

  @override
  String get sensorStatusIdle => 'Inativo';

  @override
  String get sensorStatusScanning => 'Buscando';

  @override
  String get sensorStatusConnecting => 'Conectando';

  @override
  String get sensorStatusConnected => 'Conectado';

  @override
  String get sensorStatusWarmingUp => 'Aquecendo';

  @override
  String get sensorStatusReadingAvailable => 'Leitura disponível';

  @override
  String get sensorStatusDisconnected => 'Desconectado';

  @override
  String get sensorStatusError => 'Erro';

  @override
  String get sensorFailureInvalidSensorBarcode =>
      'Código de barras do sensor inválido.';

  @override
  String get sensorFailureInvalidTransmitterBarcode =>
      'Código de barras do transmissor inválido.';

  @override
  String get sensorFailureNoActiveSensor => 'Nenhum sensor ativo.';

  @override
  String get sensorFailureNoSensorRegistered => 'Nenhum sensor registrado.';

  @override
  String get sensorFailureUnknown =>
      'Não foi possível concluir a operação com o sensor.';
}

/// The translations for Portuguese, as used in Brazil (`pt_BR`).
class AppLocalizationsPtBr extends AppLocalizationsPt {
  AppLocalizationsPtBr() : super('pt_BR');

  @override
  String get appName => 'Glucore';

  @override
  String get appSensorMvpTitle => 'Glucore Sensor MVP';

  @override
  String get splashSubtitle => 'Monitoramento glicêmico claro e confiável';

  @override
  String get onboardingQuickGlucoseTitle => 'Leitura rápida da glicose';

  @override
  String get onboardingQuickGlucoseText =>
      'Veja glicose atual, tendência e previsão de 15 minutos em poucos segundos.';

  @override
  String get onboardingHelpfulAlertsTitle => 'Alertas úteis e discretos';

  @override
  String get onboardingHelpfulAlertsText =>
      'Receba avisos de risco de baixa ou alta sem linguagem alarmista.';

  @override
  String get onboardingAllInOneTitle => 'Tudo em um só lugar';

  @override
  String get onboardingAllInOneText =>
      'Consolide glicose, carboidratos, insulina e eventos no mesmo fluxo.';

  @override
  String get onboardingSkipButton => 'Pular';

  @override
  String get onboardingNextButton => 'Próximo';

  @override
  String get onboardingStartButton => 'Começar';

  @override
  String genericStatusLabel(Object status) {
    return 'Status: $status';
  }

  @override
  String genericErrorLabel(Object message) {
    return 'Erro: $message';
  }

  @override
  String get genericEmailLabel => 'E-mail';

  @override
  String get genericPasswordLabel => 'Senha';

  @override
  String get genericInvalidEmailError => 'Informe um e-mail válido';

  @override
  String get genericPasswordMinLengthError =>
      'A senha deve ter ao menos 4 caracteres';

  @override
  String get genericNumericValueError => 'Informe um valor numérico';

  @override
  String get genericRequiredFieldError => 'Campo obrigatório';

  @override
  String get genericResetButton => 'Resetar';

  @override
  String get genericCancelButton => 'Cancelar';

  @override
  String get genericDisconnectButton => 'Desconectar';

  @override
  String genericTimeLabel(Object time) {
    return 'Horário: $time';
  }

  @override
  String genericUpdatedAtLabel(Object timestamp) {
    return 'Atualizado: $timestamp';
  }

  @override
  String get genericGlucoseUnit => 'mg/dL';

  @override
  String genericGlucoseValue(Object value) {
    return '$value mg/dL';
  }

  @override
  String get loginTitle => 'Entrar';

  @override
  String get loginWelcomeTitle => 'Bem-vindo ao Glucore';

  @override
  String get loginSubtitle =>
      'Acompanhe seus dados de CGM com clareza e confiança.';

  @override
  String get loginEmailRequiredError => 'Informe um e-mail';

  @override
  String get loginForgotPasswordButton => 'Esqueci minha senha';

  @override
  String get loginSubmitButton => 'Entrar';

  @override
  String get loginSubmittingButton => 'Entrando...';

  @override
  String get loginCreateAccountButton => 'Criar conta';

  @override
  String get loginInvalidCredentialsError =>
      'Credenciais inválidas. Use e-mail e senha com 4 ou mais caracteres.';

  @override
  String get forgotPasswordTitle => 'Recuperar senha';

  @override
  String get forgotPasswordRegisteredEmailLabel => 'E-mail cadastrado';

  @override
  String get forgotPasswordSubmitButton => 'Enviar instruções';

  @override
  String get forgotPasswordSuccessMessage =>
      'Instruções de recuperação enviadas por e-mail.';

  @override
  String get registerTitle => 'Cadastro';

  @override
  String get registerFullNameLabel => 'Nome completo';

  @override
  String get registerFullNameError => 'Informe seu nome completo';

  @override
  String get registerSubmitButton => 'Criar conta';

  @override
  String get registerSuccessMessage =>
      'Cadastro realizado. Faça login para continuar.';

  @override
  String get homeTitle => 'Home';

  @override
  String get homeLogoutTooltip => 'Sair';

  @override
  String get homeAuthenticatedMessage => 'Usuário autenticado com sucesso!';

  @override
  String get navigationMonitorLabel => 'Monitorar';

  @override
  String get navigationHistoryLabel => 'Histórico';

  @override
  String get navigationAlertsLabel => 'Alertas';

  @override
  String get navigationSettingsLabel => 'Ajustes';

  @override
  String get monitoringLinkSensorTooltip => 'Vincular sensor';

  @override
  String get monitoringEmptyStateTitle => 'Sem leituras no momento';

  @override
  String get monitoringEmptyStateMessage =>
      'Conecte um sensor para visualizar dados glicêmicos.';

  @override
  String get monitoringCurrentGlucoseTitle => 'Glicose atual';

  @override
  String get monitoringTrendRising => '↑ Subindo';

  @override
  String get monitoringTrendStable => '→ Estável';

  @override
  String get monitoringTrendFalling => '↓ Descendo';

  @override
  String monitoringLastReading(Object time) {
    return 'Última leitura: $time';
  }

  @override
  String get monitoringPredictionUnavailableTitle => 'Previsão indisponível';

  @override
  String get monitoringPredictionUnavailableSubtitle =>
      'Tentaremos atualizar automaticamente em breve.';

  @override
  String monitoringPredictionIn15Minutes(Object value) {
    return 'Previsão 15 min: $value mg/dL';
  }

  @override
  String get monitoringSensorConnectedTitle => 'Sensor conectado';

  @override
  String get monitoringSensorConnectedSubtitle =>
      'Leituras sincronizadas em tempo adequado.';

  @override
  String get monitoringSensorDisconnectedTitle => 'Sensor desconectado';

  @override
  String get monitoringSensorDisconnectedSubtitle =>
      'Verifique a conexão para continuar recebendo leituras atuais.';

  @override
  String get monitoringNoRecentReadingTitle => 'Sem leitura recente';

  @override
  String get monitoringNoRecentReadingSubtitle =>
      'Os dados podem estar desatualizados no momento.';

  @override
  String get monitoringSyncFailureTitle => 'Falha temporária de sincronização';

  @override
  String get monitoringSyncFailureSubtitle =>
      'Estamos tentando sincronizar novamente.';

  @override
  String get monitoringCarbButton => 'Carboidrato';

  @override
  String get monitoringInsulinButton => 'Insulina';

  @override
  String get monitoringRecentReadingsTitle => 'Leituras recentes';

  @override
  String monitoringRecentReadingTime(Object time) {
    return 'Horário: $time';
  }

  @override
  String get historyTitle => 'Histórico';

  @override
  String get historyEmptyStateTitle => 'Sem histórico ainda';

  @override
  String get historyEmptyStateMessage =>
      'As leituras aparecerão aqui assim que o sensor enviar dados.';

  @override
  String get historyCarbsSectionTitle => 'Carboidratos';

  @override
  String get historyInsulinSectionTitle => 'Insulina';

  @override
  String historyCarbEntryTitle(Object grams, Object description) {
    return '$grams g - $description';
  }

  @override
  String historyInsulinEntryTitle(Object units, Object type) {
    return '$units U - $type';
  }

  @override
  String get alertsTitle => 'Alertas recentes';

  @override
  String get alertsEmptyStateTitle => 'Nenhum alerta recente';

  @override
  String get alertsEmptyStateMessage =>
      'Quando ocorrerem eventos importantes, eles aparecerão aqui.';

  @override
  String alertsItemSubtitle(Object message, Object timestamp) {
    return '$message\n$timestamp';
  }

  @override
  String get alertTypeImminentHypoTitle => 'Risco de hipo iminente';

  @override
  String get alertTypeImminentHypoMessage =>
      'Tendência de queda nas próximas leituras. Considere monitorar de perto.';

  @override
  String get alertTypeSensorReconnectedTitle => 'Sensor reconectado';

  @override
  String get alertTypeSensorReconnectedMessage =>
      'Coleta de glicose normalizada com sucesso.';

  @override
  String get settingsTitle => 'Configurações';

  @override
  String get settingsProfileAndHealthTile => 'Perfil e dados de saúde';

  @override
  String get settingsSensorLinkTile => 'Vinculação de sensor CGM';

  @override
  String get settingsAlertSettingsTile => 'Configuração de alertas';

  @override
  String get settingsLogoutTile => 'Sair da conta';

  @override
  String get sensorLinkTitle => 'Vincular sensor CGM';

  @override
  String get sensorLinkRebindAttemptMessage => 'Tentando revincular sensor...';

  @override
  String get sensorLinkRebindButton => 'Revincular sensor';

  @override
  String get sensorLinkStatusSearchingLabel => 'Buscando';

  @override
  String get sensorLinkStatusPermissionPendingLabel => 'Permissão pendente';

  @override
  String get sensorLinkStatusConnectedLabel => 'Conectado';

  @override
  String get sensorLinkStatusCompatibilityErrorLabel => 'Compatibilidade';

  @override
  String get sensorLinkStatusReconnectingLabel => 'Revinculando';

  @override
  String get sensorLinkStatusUnavailableLabel => 'Indisponível';

  @override
  String get sensorLinkStatusDisconnectedLabel => 'Desconectado';

  @override
  String get sensorLinkSearchingTitle => 'Buscando sensor';

  @override
  String get sensorLinkSearchingSubtitle => 'Aproxime o sensor do dispositivo.';

  @override
  String get sensorLinkPermissionPendingTitle => 'Permissão pendente';

  @override
  String get sensorLinkPermissionPendingSubtitle =>
      'Permita o Bluetooth para conectar o sensor.';

  @override
  String get sensorLinkConnectedTitle => 'Sensor conectado';

  @override
  String get sensorLinkConnectedSubtitle => 'Leituras em tempo quase real.';

  @override
  String get sensorLinkCompatibilityErrorTitle => 'Erro de compatibilidade';

  @override
  String get sensorLinkCompatibilityErrorSubtitle =>
      'Modelo não suportado no momento.';

  @override
  String get sensorLinkReconnectingTitle => 'Revinculando';

  @override
  String get sensorLinkReconnectingSubtitle =>
      'Aguarde, estamos restabelecendo a conexão.';

  @override
  String get sensorLinkUnavailableTitle => 'Sensor indisponível';

  @override
  String get sensorLinkUnavailableSubtitle =>
      'Não foi possível localizar um sensor próximo.';

  @override
  String get sensorLinkDisconnectedTitle => 'Sensor desconectado';

  @override
  String get sensorLinkDisconnectedSubtitle =>
      'Reconecte para retomar leituras atualizadas.';

  @override
  String get alertSettingsTitle => 'Configuração de alertas';

  @override
  String get alertSettingsLowThresholdLabel => 'Limite baixo (mg/dL)';

  @override
  String get alertSettingsHighThresholdLabel => 'Limite alto (mg/dL)';

  @override
  String get alertSettingsLowMustBeLowerError =>
      'O limite baixo deve ser menor que o alto.';

  @override
  String get alertSettingsUpdatedSuccessMessage =>
      'Alertas atualizados com sucesso.';

  @override
  String get alertSettingsSaveButton => 'Salvar alertas';

  @override
  String get profileTitle => 'Perfil';

  @override
  String get profileDefaultName => 'Paciente Glucore';

  @override
  String get profileNameLabel => 'Nome';

  @override
  String get profileBirthDateLabel => 'Data de nascimento';

  @override
  String get profileWeightLabel => 'Peso (kg)';

  @override
  String get profileTargetRangeLabel => 'Faixa alvo de glicose (mg/dL)';

  @override
  String get profileUpdatedSuccessMessage => 'Perfil atualizado com sucesso.';

  @override
  String get profileSaveChangesButton => 'Salvar alterações';

  @override
  String get carbEntryTitle => 'Registrar carboidrato';

  @override
  String get carbEntryQuantityLabel => 'Quantidade (g)';

  @override
  String get carbEntryDescriptionLabel => 'Descrição da refeição';

  @override
  String get carbEntryQuantityError => 'Informe uma quantidade válida';

  @override
  String get carbEntryDescriptionError => 'Informe a descrição';

  @override
  String get carbEntrySavedSuccessMessage =>
      'Carboidrato registrado com sucesso.';

  @override
  String get carbEntrySaveButton => 'Salvar registro';

  @override
  String get insulinEntryTitle => 'Registrar insulina';

  @override
  String get insulinEntryDoseTypeLabel => 'Tipo de dose';

  @override
  String get insulinTypeBolus => 'Bolus';

  @override
  String get insulinTypeBasal => 'Basal';

  @override
  String get insulinTypeCorrection => 'Correção';

  @override
  String get insulinEntryQuantityLabel => 'Quantidade (U)';

  @override
  String get insulinEntryQuantityError => 'Informe uma quantidade válida';

  @override
  String get insulinEntrySavedSuccessMessage =>
      'Aplicação de insulina registrada.';

  @override
  String get insulinEntrySaveButton => 'Salvar aplicação';

  @override
  String get sensorPageTitle => 'Glucore Sensor MVP';

  @override
  String get sensorPageNoActiveSessionMessage =>
      'Nenhuma sessão ativa de sensor.';

  @override
  String get sensorPageBarcodeLabel => 'Código de barras do sensor';

  @override
  String get sensorPageRegisterButton => 'Registrar sensor';

  @override
  String sensorPageRegisteredSensor(Object sensorId) {
    return 'Sensor registrado: $sensorId';
  }

  @override
  String get sensorPageStartMonitoringButton => 'Iniciar monitoramento';

  @override
  String sensorPageConnecting(Object status) {
    return 'Conectando... ($status)';
  }

  @override
  String sensorPageWarmupProgress(Object elapsed, Object total) {
    return 'Aquecimento: $elapsed/$total s';
  }

  @override
  String get sensorPageConnectedMessage =>
      'Sensor conectado. Aguardando aquecimento e leituras.';

  @override
  String get sensorPageBeginWarmupButton => 'Iniciar aquecimento';

  @override
  String sensorPageCurrentGlucose(Object value) {
    return 'Glicose atual: $value mg/dL';
  }

  @override
  String get sensorPageStopMonitoringButton => 'Parar monitoramento';

  @override
  String get sensorPageClearSessionButton => 'Limpar sessão';

  @override
  String get sensorStatusIdle => 'Inativo';

  @override
  String get sensorStatusScanning => 'Buscando';

  @override
  String get sensorStatusConnecting => 'Conectando';

  @override
  String get sensorStatusConnected => 'Conectado';

  @override
  String get sensorStatusWarmingUp => 'Aquecendo';

  @override
  String get sensorStatusReadingAvailable => 'Leitura disponível';

  @override
  String get sensorStatusDisconnected => 'Desconectado';

  @override
  String get sensorStatusError => 'Erro';

  @override
  String get sensorFailureInvalidSensorBarcode =>
      'Código de barras do sensor inválido.';

  @override
  String get sensorFailureInvalidTransmitterBarcode =>
      'Código de barras do transmissor inválido.';

  @override
  String get sensorFailureNoActiveSensor => 'Nenhum sensor ativo.';

  @override
  String get sensorFailureNoSensorRegistered => 'Nenhum sensor registrado.';

  @override
  String get sensorFailureUnknown =>
      'Não foi possível concluir a operação com o sensor.';
}
