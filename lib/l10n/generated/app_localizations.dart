import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_pt.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'generated/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('pt'),
    Locale('pt', 'BR'),
  ];

  /// No description provided for @appName.
  ///
  /// In pt_BR, this message translates to:
  /// **'Glucore'**
  String get appName;

  /// No description provided for @appSensorMvpTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Glucore Sensor MVP'**
  String get appSensorMvpTitle;

  /// No description provided for @splashSubtitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Monitoramento glicêmico claro e confiável'**
  String get splashSubtitle;

  /// No description provided for @onboardingQuickGlucoseTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Leitura rápida da glicose'**
  String get onboardingQuickGlucoseTitle;

  /// No description provided for @onboardingQuickGlucoseText.
  ///
  /// In pt_BR, this message translates to:
  /// **'Veja glicose atual, tendência e previsão de 15 minutos em poucos segundos.'**
  String get onboardingQuickGlucoseText;

  /// No description provided for @onboardingHelpfulAlertsTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Alertas úteis e discretos'**
  String get onboardingHelpfulAlertsTitle;

  /// No description provided for @onboardingHelpfulAlertsText.
  ///
  /// In pt_BR, this message translates to:
  /// **'Receba avisos de risco de baixa ou alta sem linguagem alarmista.'**
  String get onboardingHelpfulAlertsText;

  /// No description provided for @onboardingAllInOneTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Tudo em um só lugar'**
  String get onboardingAllInOneTitle;

  /// No description provided for @onboardingAllInOneText.
  ///
  /// In pt_BR, this message translates to:
  /// **'Consolide glicose, carboidratos, insulina e eventos no mesmo fluxo.'**
  String get onboardingAllInOneText;

  /// No description provided for @onboardingSkipButton.
  ///
  /// In pt_BR, this message translates to:
  /// **'Pular'**
  String get onboardingSkipButton;

  /// No description provided for @onboardingNextButton.
  ///
  /// In pt_BR, this message translates to:
  /// **'Próximo'**
  String get onboardingNextButton;

  /// No description provided for @onboardingStartButton.
  ///
  /// In pt_BR, this message translates to:
  /// **'Começar'**
  String get onboardingStartButton;

  /// No description provided for @genericStatusLabel.
  ///
  /// In pt_BR, this message translates to:
  /// **'Status: {status}'**
  String genericStatusLabel(Object status);

  /// No description provided for @genericErrorLabel.
  ///
  /// In pt_BR, this message translates to:
  /// **'Erro: {message}'**
  String genericErrorLabel(Object message);

  /// No description provided for @genericEmailLabel.
  ///
  /// In pt_BR, this message translates to:
  /// **'E-mail'**
  String get genericEmailLabel;

  /// No description provided for @genericPasswordLabel.
  ///
  /// In pt_BR, this message translates to:
  /// **'Senha'**
  String get genericPasswordLabel;

  /// No description provided for @genericInvalidEmailError.
  ///
  /// In pt_BR, this message translates to:
  /// **'Informe um e-mail válido'**
  String get genericInvalidEmailError;

  /// No description provided for @genericPasswordMinLengthError.
  ///
  /// In pt_BR, this message translates to:
  /// **'A senha deve ter ao menos 4 caracteres'**
  String get genericPasswordMinLengthError;

  /// No description provided for @genericNumericValueError.
  ///
  /// In pt_BR, this message translates to:
  /// **'Informe um valor numérico'**
  String get genericNumericValueError;

  /// No description provided for @genericRequiredFieldError.
  ///
  /// In pt_BR, this message translates to:
  /// **'Campo obrigatório'**
  String get genericRequiredFieldError;

  /// No description provided for @genericResetButton.
  ///
  /// In pt_BR, this message translates to:
  /// **'Resetar'**
  String get genericResetButton;

  /// No description provided for @genericCancelButton.
  ///
  /// In pt_BR, this message translates to:
  /// **'Cancelar'**
  String get genericCancelButton;

  /// No description provided for @genericDisconnectButton.
  ///
  /// In pt_BR, this message translates to:
  /// **'Desconectar'**
  String get genericDisconnectButton;

  /// No description provided for @genericTimeLabel.
  ///
  /// In pt_BR, this message translates to:
  /// **'Horário: {time}'**
  String genericTimeLabel(Object time);

  /// No description provided for @genericUpdatedAtLabel.
  ///
  /// In pt_BR, this message translates to:
  /// **'Atualizado: {timestamp}'**
  String genericUpdatedAtLabel(Object timestamp);

  /// No description provided for @genericGlucoseUnit.
  ///
  /// In pt_BR, this message translates to:
  /// **'mg/dL'**
  String get genericGlucoseUnit;

  /// No description provided for @genericGlucoseValue.
  ///
  /// In pt_BR, this message translates to:
  /// **'{value} mg/dL'**
  String genericGlucoseValue(Object value);

  /// No description provided for @loginTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Entrar'**
  String get loginTitle;

  /// No description provided for @loginWelcomeTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Bem-vindo ao Glucore'**
  String get loginWelcomeTitle;

  /// No description provided for @loginSubtitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Acompanhe seus dados de CGM com clareza e confiança.'**
  String get loginSubtitle;

  /// No description provided for @loginEmailRequiredError.
  ///
  /// In pt_BR, this message translates to:
  /// **'Informe um e-mail'**
  String get loginEmailRequiredError;

  /// No description provided for @loginForgotPasswordButton.
  ///
  /// In pt_BR, this message translates to:
  /// **'Esqueci minha senha'**
  String get loginForgotPasswordButton;

  /// No description provided for @loginSubmitButton.
  ///
  /// In pt_BR, this message translates to:
  /// **'Entrar'**
  String get loginSubmitButton;

  /// No description provided for @loginSubmittingButton.
  ///
  /// In pt_BR, this message translates to:
  /// **'Entrando...'**
  String get loginSubmittingButton;

  /// No description provided for @loginCreateAccountButton.
  ///
  /// In pt_BR, this message translates to:
  /// **'Criar conta'**
  String get loginCreateAccountButton;

  /// No description provided for @loginInvalidCredentialsError.
  ///
  /// In pt_BR, this message translates to:
  /// **'Credenciais inválidas. Use e-mail e senha com 4 ou mais caracteres.'**
  String get loginInvalidCredentialsError;

  /// No description provided for @forgotPasswordTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Recuperar senha'**
  String get forgotPasswordTitle;

  /// No description provided for @forgotPasswordRegisteredEmailLabel.
  ///
  /// In pt_BR, this message translates to:
  /// **'E-mail cadastrado'**
  String get forgotPasswordRegisteredEmailLabel;

  /// No description provided for @forgotPasswordSubmitButton.
  ///
  /// In pt_BR, this message translates to:
  /// **'Enviar instruções'**
  String get forgotPasswordSubmitButton;

  /// No description provided for @forgotPasswordSuccessMessage.
  ///
  /// In pt_BR, this message translates to:
  /// **'Instruções de recuperação enviadas por e-mail.'**
  String get forgotPasswordSuccessMessage;

  /// No description provided for @registerTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Cadastro'**
  String get registerTitle;

  /// No description provided for @registerFullNameLabel.
  ///
  /// In pt_BR, this message translates to:
  /// **'Nome completo'**
  String get registerFullNameLabel;

  /// No description provided for @registerFullNameError.
  ///
  /// In pt_BR, this message translates to:
  /// **'Informe seu nome completo'**
  String get registerFullNameError;

  /// No description provided for @registerSubmitButton.
  ///
  /// In pt_BR, this message translates to:
  /// **'Criar conta'**
  String get registerSubmitButton;

  /// No description provided for @registerSuccessMessage.
  ///
  /// In pt_BR, this message translates to:
  /// **'Cadastro realizado. Faça login para continuar.'**
  String get registerSuccessMessage;

  /// No description provided for @homeTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Home'**
  String get homeTitle;

  /// No description provided for @homeLogoutTooltip.
  ///
  /// In pt_BR, this message translates to:
  /// **'Sair'**
  String get homeLogoutTooltip;

  /// No description provided for @homeAuthenticatedMessage.
  ///
  /// In pt_BR, this message translates to:
  /// **'Usuário autenticado com sucesso!'**
  String get homeAuthenticatedMessage;

  /// No description provided for @navigationMonitorLabel.
  ///
  /// In pt_BR, this message translates to:
  /// **'Monitorar'**
  String get navigationMonitorLabel;

  /// No description provided for @navigationHistoryLabel.
  ///
  /// In pt_BR, this message translates to:
  /// **'Histórico'**
  String get navigationHistoryLabel;

  /// No description provided for @navigationAlertsLabel.
  ///
  /// In pt_BR, this message translates to:
  /// **'Alertas'**
  String get navigationAlertsLabel;

  /// No description provided for @navigationSettingsLabel.
  ///
  /// In pt_BR, this message translates to:
  /// **'Ajustes'**
  String get navigationSettingsLabel;

  /// No description provided for @monitoringLinkSensorTooltip.
  ///
  /// In pt_BR, this message translates to:
  /// **'Vincular sensor'**
  String get monitoringLinkSensorTooltip;

  /// No description provided for @monitoringEmptyStateTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Sem leituras no momento'**
  String get monitoringEmptyStateTitle;

  /// No description provided for @monitoringEmptyStateMessage.
  ///
  /// In pt_BR, this message translates to:
  /// **'Conecte um sensor para visualizar dados glicêmicos.'**
  String get monitoringEmptyStateMessage;

  /// No description provided for @monitoringCurrentGlucoseTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Glicose atual'**
  String get monitoringCurrentGlucoseTitle;

  /// No description provided for @monitoringTrendRising.
  ///
  /// In pt_BR, this message translates to:
  /// **'↑ Subindo'**
  String get monitoringTrendRising;

  /// No description provided for @monitoringTrendStable.
  ///
  /// In pt_BR, this message translates to:
  /// **'→ Estável'**
  String get monitoringTrendStable;

  /// No description provided for @monitoringTrendFalling.
  ///
  /// In pt_BR, this message translates to:
  /// **'↓ Descendo'**
  String get monitoringTrendFalling;

  /// No description provided for @monitoringLastReading.
  ///
  /// In pt_BR, this message translates to:
  /// **'Última leitura: {time}'**
  String monitoringLastReading(Object time);

  /// No description provided for @monitoringPredictionUnavailableTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Previsão indisponível'**
  String get monitoringPredictionUnavailableTitle;

  /// No description provided for @monitoringPredictionUnavailableSubtitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Tentaremos atualizar automaticamente em breve.'**
  String get monitoringPredictionUnavailableSubtitle;

  /// No description provided for @monitoringPredictionIn15Minutes.
  ///
  /// In pt_BR, this message translates to:
  /// **'Previsão 15 min: {value} mg/dL'**
  String monitoringPredictionIn15Minutes(Object value);

  /// No description provided for @monitoringSensorConnectedTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Sensor conectado'**
  String get monitoringSensorConnectedTitle;

  /// No description provided for @monitoringSensorConnectedSubtitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Leituras sincronizadas em tempo adequado.'**
  String get monitoringSensorConnectedSubtitle;

  /// No description provided for @monitoringSensorDisconnectedTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Sensor desconectado'**
  String get monitoringSensorDisconnectedTitle;

  /// No description provided for @monitoringSensorDisconnectedSubtitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Verifique a conexão para continuar recebendo leituras atuais.'**
  String get monitoringSensorDisconnectedSubtitle;

  /// No description provided for @monitoringNoRecentReadingTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Sem leitura recente'**
  String get monitoringNoRecentReadingTitle;

  /// No description provided for @monitoringNoRecentReadingSubtitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Os dados podem estar desatualizados no momento.'**
  String get monitoringNoRecentReadingSubtitle;

  /// No description provided for @monitoringSyncFailureTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Falha temporária de sincronização'**
  String get monitoringSyncFailureTitle;

  /// No description provided for @monitoringSyncFailureSubtitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Estamos tentando sincronizar novamente.'**
  String get monitoringSyncFailureSubtitle;

  /// No description provided for @monitoringCarbButton.
  ///
  /// In pt_BR, this message translates to:
  /// **'Carboidrato'**
  String get monitoringCarbButton;

  /// No description provided for @monitoringInsulinButton.
  ///
  /// In pt_BR, this message translates to:
  /// **'Insulina'**
  String get monitoringInsulinButton;

  /// No description provided for @monitoringRecentReadingsTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Leituras recentes'**
  String get monitoringRecentReadingsTitle;

  /// No description provided for @monitoringRecentReadingTime.
  ///
  /// In pt_BR, this message translates to:
  /// **'Horário: {time}'**
  String monitoringRecentReadingTime(Object time);

  /// No description provided for @historyTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Histórico'**
  String get historyTitle;

  /// No description provided for @historyEmptyStateTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Sem histórico ainda'**
  String get historyEmptyStateTitle;

  /// No description provided for @historyEmptyStateMessage.
  ///
  /// In pt_BR, this message translates to:
  /// **'As leituras aparecerão aqui assim que o sensor enviar dados.'**
  String get historyEmptyStateMessage;

  /// No description provided for @historyCarbsSectionTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Carboidratos'**
  String get historyCarbsSectionTitle;

  /// No description provided for @historyInsulinSectionTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Insulina'**
  String get historyInsulinSectionTitle;

  /// No description provided for @historyCarbEntryTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'{grams} g - {description}'**
  String historyCarbEntryTitle(Object grams, Object description);

  /// No description provided for @historyInsulinEntryTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'{units} U - {type}'**
  String historyInsulinEntryTitle(Object units, Object type);

  /// No description provided for @alertsTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Alertas recentes'**
  String get alertsTitle;

  /// No description provided for @alertsEmptyStateTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Nenhum alerta recente'**
  String get alertsEmptyStateTitle;

  /// No description provided for @alertsEmptyStateMessage.
  ///
  /// In pt_BR, this message translates to:
  /// **'Quando ocorrerem eventos importantes, eles aparecerão aqui.'**
  String get alertsEmptyStateMessage;

  /// No description provided for @alertsItemSubtitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'{message}\n{timestamp}'**
  String alertsItemSubtitle(Object message, Object timestamp);

  /// No description provided for @alertTypeImminentHypoTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Risco de hipo iminente'**
  String get alertTypeImminentHypoTitle;

  /// No description provided for @alertTypeImminentHypoMessage.
  ///
  /// In pt_BR, this message translates to:
  /// **'Tendência de queda nas próximas leituras. Considere monitorar de perto.'**
  String get alertTypeImminentHypoMessage;

  /// No description provided for @alertTypeSensorReconnectedTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Sensor reconectado'**
  String get alertTypeSensorReconnectedTitle;

  /// No description provided for @alertTypeSensorReconnectedMessage.
  ///
  /// In pt_BR, this message translates to:
  /// **'Coleta de glicose normalizada com sucesso.'**
  String get alertTypeSensorReconnectedMessage;

  /// No description provided for @settingsTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Configurações'**
  String get settingsTitle;

  /// No description provided for @settingsProfileAndHealthTile.
  ///
  /// In pt_BR, this message translates to:
  /// **'Perfil e dados de saúde'**
  String get settingsProfileAndHealthTile;

  /// No description provided for @settingsSensorLinkTile.
  ///
  /// In pt_BR, this message translates to:
  /// **'Vinculação de sensor CGM'**
  String get settingsSensorLinkTile;

  /// No description provided for @settingsAlertSettingsTile.
  ///
  /// In pt_BR, this message translates to:
  /// **'Configuração de alertas'**
  String get settingsAlertSettingsTile;

  /// No description provided for @settingsLogoutTile.
  ///
  /// In pt_BR, this message translates to:
  /// **'Sair da conta'**
  String get settingsLogoutTile;

  /// No description provided for @sensorLinkTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Vincular sensor CGM'**
  String get sensorLinkTitle;

  /// No description provided for @sensorLinkRebindAttemptMessage.
  ///
  /// In pt_BR, this message translates to:
  /// **'Tentando revincular sensor...'**
  String get sensorLinkRebindAttemptMessage;

  /// No description provided for @sensorLinkRebindButton.
  ///
  /// In pt_BR, this message translates to:
  /// **'Revincular sensor'**
  String get sensorLinkRebindButton;

  /// No description provided for @sensorLinkStatusSearchingLabel.
  ///
  /// In pt_BR, this message translates to:
  /// **'Buscando'**
  String get sensorLinkStatusSearchingLabel;

  /// No description provided for @sensorLinkStatusPermissionPendingLabel.
  ///
  /// In pt_BR, this message translates to:
  /// **'Permissão pendente'**
  String get sensorLinkStatusPermissionPendingLabel;

  /// No description provided for @sensorLinkStatusConnectedLabel.
  ///
  /// In pt_BR, this message translates to:
  /// **'Conectado'**
  String get sensorLinkStatusConnectedLabel;

  /// No description provided for @sensorLinkStatusCompatibilityErrorLabel.
  ///
  /// In pt_BR, this message translates to:
  /// **'Compatibilidade'**
  String get sensorLinkStatusCompatibilityErrorLabel;

  /// No description provided for @sensorLinkStatusReconnectingLabel.
  ///
  /// In pt_BR, this message translates to:
  /// **'Revinculando'**
  String get sensorLinkStatusReconnectingLabel;

  /// No description provided for @sensorLinkStatusUnavailableLabel.
  ///
  /// In pt_BR, this message translates to:
  /// **'Indisponível'**
  String get sensorLinkStatusUnavailableLabel;

  /// No description provided for @sensorLinkStatusDisconnectedLabel.
  ///
  /// In pt_BR, this message translates to:
  /// **'Desconectado'**
  String get sensorLinkStatusDisconnectedLabel;

  /// No description provided for @sensorLinkSearchingTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Buscando sensor'**
  String get sensorLinkSearchingTitle;

  /// No description provided for @sensorLinkSearchingSubtitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Aproxime o sensor do dispositivo.'**
  String get sensorLinkSearchingSubtitle;

  /// No description provided for @sensorLinkPermissionPendingTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Permissão pendente'**
  String get sensorLinkPermissionPendingTitle;

  /// No description provided for @sensorLinkPermissionPendingSubtitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Permita o Bluetooth para conectar o sensor.'**
  String get sensorLinkPermissionPendingSubtitle;

  /// No description provided for @sensorLinkConnectedTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Sensor conectado'**
  String get sensorLinkConnectedTitle;

  /// No description provided for @sensorLinkConnectedSubtitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Leituras em tempo quase real.'**
  String get sensorLinkConnectedSubtitle;

  /// No description provided for @sensorLinkCompatibilityErrorTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Erro de compatibilidade'**
  String get sensorLinkCompatibilityErrorTitle;

  /// No description provided for @sensorLinkCompatibilityErrorSubtitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Modelo não suportado no momento.'**
  String get sensorLinkCompatibilityErrorSubtitle;

  /// No description provided for @sensorLinkReconnectingTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Revinculando'**
  String get sensorLinkReconnectingTitle;

  /// No description provided for @sensorLinkReconnectingSubtitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Aguarde, estamos restabelecendo a conexão.'**
  String get sensorLinkReconnectingSubtitle;

  /// No description provided for @sensorLinkUnavailableTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Sensor indisponível'**
  String get sensorLinkUnavailableTitle;

  /// No description provided for @sensorLinkUnavailableSubtitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Não foi possível localizar um sensor próximo.'**
  String get sensorLinkUnavailableSubtitle;

  /// No description provided for @sensorLinkDisconnectedTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Sensor desconectado'**
  String get sensorLinkDisconnectedTitle;

  /// No description provided for @sensorLinkDisconnectedSubtitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Reconecte para retomar leituras atualizadas.'**
  String get sensorLinkDisconnectedSubtitle;

  /// No description provided for @alertSettingsTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Configuração de alertas'**
  String get alertSettingsTitle;

  /// No description provided for @alertSettingsLowThresholdLabel.
  ///
  /// In pt_BR, this message translates to:
  /// **'Limite baixo (mg/dL)'**
  String get alertSettingsLowThresholdLabel;

  /// No description provided for @alertSettingsHighThresholdLabel.
  ///
  /// In pt_BR, this message translates to:
  /// **'Limite alto (mg/dL)'**
  String get alertSettingsHighThresholdLabel;

  /// No description provided for @alertSettingsLowMustBeLowerError.
  ///
  /// In pt_BR, this message translates to:
  /// **'O limite baixo deve ser menor que o alto.'**
  String get alertSettingsLowMustBeLowerError;

  /// No description provided for @alertSettingsUpdatedSuccessMessage.
  ///
  /// In pt_BR, this message translates to:
  /// **'Alertas atualizados com sucesso.'**
  String get alertSettingsUpdatedSuccessMessage;

  /// No description provided for @alertSettingsSaveButton.
  ///
  /// In pt_BR, this message translates to:
  /// **'Salvar alertas'**
  String get alertSettingsSaveButton;

  /// No description provided for @profileTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Perfil'**
  String get profileTitle;

  /// No description provided for @profileDefaultName.
  ///
  /// In pt_BR, this message translates to:
  /// **'Paciente Glucore'**
  String get profileDefaultName;

  /// No description provided for @profileNameLabel.
  ///
  /// In pt_BR, this message translates to:
  /// **'Nome'**
  String get profileNameLabel;

  /// No description provided for @profileBirthDateLabel.
  ///
  /// In pt_BR, this message translates to:
  /// **'Data de nascimento'**
  String get profileBirthDateLabel;

  /// No description provided for @profileWeightLabel.
  ///
  /// In pt_BR, this message translates to:
  /// **'Peso (kg)'**
  String get profileWeightLabel;

  /// No description provided for @profileTargetRangeLabel.
  ///
  /// In pt_BR, this message translates to:
  /// **'Faixa alvo de glicose (mg/dL)'**
  String get profileTargetRangeLabel;

  /// No description provided for @profileUpdatedSuccessMessage.
  ///
  /// In pt_BR, this message translates to:
  /// **'Perfil atualizado com sucesso.'**
  String get profileUpdatedSuccessMessage;

  /// No description provided for @profileSaveChangesButton.
  ///
  /// In pt_BR, this message translates to:
  /// **'Salvar alterações'**
  String get profileSaveChangesButton;

  /// No description provided for @carbEntryTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Registrar carboidrato'**
  String get carbEntryTitle;

  /// No description provided for @carbEntryQuantityLabel.
  ///
  /// In pt_BR, this message translates to:
  /// **'Quantidade (g)'**
  String get carbEntryQuantityLabel;

  /// No description provided for @carbEntryDescriptionLabel.
  ///
  /// In pt_BR, this message translates to:
  /// **'Descrição da refeição'**
  String get carbEntryDescriptionLabel;

  /// No description provided for @carbEntryQuantityError.
  ///
  /// In pt_BR, this message translates to:
  /// **'Informe uma quantidade válida'**
  String get carbEntryQuantityError;

  /// No description provided for @carbEntryDescriptionError.
  ///
  /// In pt_BR, this message translates to:
  /// **'Informe a descrição'**
  String get carbEntryDescriptionError;

  /// No description provided for @carbEntrySavedSuccessMessage.
  ///
  /// In pt_BR, this message translates to:
  /// **'Carboidrato registrado com sucesso.'**
  String get carbEntrySavedSuccessMessage;

  /// No description provided for @carbEntrySaveButton.
  ///
  /// In pt_BR, this message translates to:
  /// **'Salvar registro'**
  String get carbEntrySaveButton;

  /// No description provided for @insulinEntryTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Registrar insulina'**
  String get insulinEntryTitle;

  /// No description provided for @insulinEntryDoseTypeLabel.
  ///
  /// In pt_BR, this message translates to:
  /// **'Tipo de dose'**
  String get insulinEntryDoseTypeLabel;

  /// No description provided for @insulinTypeBolus.
  ///
  /// In pt_BR, this message translates to:
  /// **'Bolus'**
  String get insulinTypeBolus;

  /// No description provided for @insulinTypeBasal.
  ///
  /// In pt_BR, this message translates to:
  /// **'Basal'**
  String get insulinTypeBasal;

  /// No description provided for @insulinTypeCorrection.
  ///
  /// In pt_BR, this message translates to:
  /// **'Correção'**
  String get insulinTypeCorrection;

  /// No description provided for @insulinEntryQuantityLabel.
  ///
  /// In pt_BR, this message translates to:
  /// **'Quantidade (U)'**
  String get insulinEntryQuantityLabel;

  /// No description provided for @insulinEntryQuantityError.
  ///
  /// In pt_BR, this message translates to:
  /// **'Informe uma quantidade válida'**
  String get insulinEntryQuantityError;

  /// No description provided for @insulinEntrySavedSuccessMessage.
  ///
  /// In pt_BR, this message translates to:
  /// **'Aplicação de insulina registrada.'**
  String get insulinEntrySavedSuccessMessage;

  /// No description provided for @insulinEntrySaveButton.
  ///
  /// In pt_BR, this message translates to:
  /// **'Salvar aplicação'**
  String get insulinEntrySaveButton;

  /// No description provided for @sensorPageTitle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Glucore Sensor MVP'**
  String get sensorPageTitle;

  /// No description provided for @sensorPageNoActiveSessionMessage.
  ///
  /// In pt_BR, this message translates to:
  /// **'Nenhuma sessão ativa de sensor.'**
  String get sensorPageNoActiveSessionMessage;

  /// No description provided for @sensorPageBarcodeLabel.
  ///
  /// In pt_BR, this message translates to:
  /// **'Código de barras do sensor'**
  String get sensorPageBarcodeLabel;

  /// No description provided for @sensorPageRegisterButton.
  ///
  /// In pt_BR, this message translates to:
  /// **'Registrar sensor'**
  String get sensorPageRegisterButton;

  /// No description provided for @sensorPageRegisteredSensor.
  ///
  /// In pt_BR, this message translates to:
  /// **'Sensor registrado: {sensorId}'**
  String sensorPageRegisteredSensor(Object sensorId);

  /// No description provided for @sensorPageStartMonitoringButton.
  ///
  /// In pt_BR, this message translates to:
  /// **'Iniciar monitoramento'**
  String get sensorPageStartMonitoringButton;

  /// No description provided for @sensorPageConnecting.
  ///
  /// In pt_BR, this message translates to:
  /// **'Conectando... ({status})'**
  String sensorPageConnecting(Object status);

  /// No description provided for @sensorPageWarmupProgress.
  ///
  /// In pt_BR, this message translates to:
  /// **'Aquecimento: {elapsed}/{total} s'**
  String sensorPageWarmupProgress(Object elapsed, Object total);

  /// No description provided for @sensorPageConnectedMessage.
  ///
  /// In pt_BR, this message translates to:
  /// **'Sensor conectado. Aguardando aquecimento e leituras.'**
  String get sensorPageConnectedMessage;

  /// No description provided for @sensorPageBeginWarmupButton.
  ///
  /// In pt_BR, this message translates to:
  /// **'Iniciar aquecimento'**
  String get sensorPageBeginWarmupButton;

  /// No description provided for @sensorPageCurrentGlucose.
  ///
  /// In pt_BR, this message translates to:
  /// **'Glicose atual: {value} mg/dL'**
  String sensorPageCurrentGlucose(Object value);

  /// No description provided for @sensorPageStopMonitoringButton.
  ///
  /// In pt_BR, this message translates to:
  /// **'Parar monitoramento'**
  String get sensorPageStopMonitoringButton;

  /// No description provided for @sensorPageClearSessionButton.
  ///
  /// In pt_BR, this message translates to:
  /// **'Limpar sessão'**
  String get sensorPageClearSessionButton;

  /// No description provided for @sensorStatusIdle.
  ///
  /// In pt_BR, this message translates to:
  /// **'Inativo'**
  String get sensorStatusIdle;

  /// No description provided for @sensorStatusScanning.
  ///
  /// In pt_BR, this message translates to:
  /// **'Buscando'**
  String get sensorStatusScanning;

  /// No description provided for @sensorStatusConnecting.
  ///
  /// In pt_BR, this message translates to:
  /// **'Conectando'**
  String get sensorStatusConnecting;

  /// No description provided for @sensorStatusConnected.
  ///
  /// In pt_BR, this message translates to:
  /// **'Conectado'**
  String get sensorStatusConnected;

  /// No description provided for @sensorStatusWarmingUp.
  ///
  /// In pt_BR, this message translates to:
  /// **'Aquecendo'**
  String get sensorStatusWarmingUp;

  /// No description provided for @sensorStatusReadingAvailable.
  ///
  /// In pt_BR, this message translates to:
  /// **'Leitura disponível'**
  String get sensorStatusReadingAvailable;

  /// No description provided for @sensorStatusDisconnected.
  ///
  /// In pt_BR, this message translates to:
  /// **'Desconectado'**
  String get sensorStatusDisconnected;

  /// No description provided for @sensorStatusError.
  ///
  /// In pt_BR, this message translates to:
  /// **'Erro'**
  String get sensorStatusError;

  /// No description provided for @sensorFailureInvalidSensorBarcode.
  ///
  /// In pt_BR, this message translates to:
  /// **'Código de barras do sensor inválido.'**
  String get sensorFailureInvalidSensorBarcode;

  /// No description provided for @sensorFailureInvalidTransmitterBarcode.
  ///
  /// In pt_BR, this message translates to:
  /// **'Código de barras do transmissor inválido.'**
  String get sensorFailureInvalidTransmitterBarcode;

  /// No description provided for @sensorFailureNoActiveSensor.
  ///
  /// In pt_BR, this message translates to:
  /// **'Nenhum sensor ativo.'**
  String get sensorFailureNoActiveSensor;

  /// No description provided for @sensorFailureNoSensorRegistered.
  ///
  /// In pt_BR, this message translates to:
  /// **'Nenhum sensor registrado.'**
  String get sensorFailureNoSensorRegistered;

  /// No description provided for @sensorFailureUnknown.
  ///
  /// In pt_BR, this message translates to:
  /// **'Não foi possível concluir a operação com o sensor.'**
  String get sensorFailureUnknown;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['pt'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when language+country codes are specified.
  switch (locale.languageCode) {
    case 'pt':
      {
        switch (locale.countryCode) {
          case 'BR':
            return AppLocalizationsPtBr();
        }
        break;
      }
  }

  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'pt':
      return AppLocalizationsPt();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
