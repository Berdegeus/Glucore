// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Portuguese (`pt`).
class AppLocalizationsPt extends AppLocalizations {
  AppLocalizationsPt([String locale = 'pt']) : super(locale);

  @override
  String get appTitle => 'Glucore MVP';

  @override
  String get appBarTitle => 'Sensor Glucore';

  @override
  String get statusLabel => 'Status';

  @override
  String get errorLabel => 'Erro';

  @override
  String get noSessionMessage => 'Nenhuma sessão de sensor ativa.';

  @override
  String get sensorBarcodeLabel => 'Código de barras do sensor';

  @override
  String get registerSensorButton => 'Registrar Sensor';

  @override
  String get resetButton => 'Redefinir';

  @override
  String get registeredSensorLabel => 'Sensor registrado';

  @override
  String get startMonitoringButton => 'Iniciar Monitoramento';

  @override
  String get connectingMessage => 'Conectando...';

  @override
  String get warmupLabel => 'Aquecimento';

  @override
  String get cancelButton => 'Cancelar';

  @override
  String get currentGlucoseLabel => 'Glicose Atual';

  @override
  String get updatedLabel => 'Atualizado';

  @override
  String get stopMonitoringButton => 'Parar Monitoramento';

  @override
  String get clearSessionButton => 'Limpar Sessão';

  @override
  String get sensorConnectedMessage =>
      'Sensor conectado. Aguardando aquecimento/leituras.';

  @override
  String get beginWarmupButton => 'Iniciar Aquecimento';

  @override
  String get disconnectButton => 'Desconectar';

  @override
  String get invalidSensorBarcodeError => 'Código de barras do sensor inválido';

  @override
  String get invalidTransmitterBarcodeError =>
      'Código de barras do transmissor inválido';

  @override
  String get noActiveSensorError => 'Nenhum sensor ativo';

  @override
  String get mgdlUnit => 'mg/dL';
}
