// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'Glucore MVP';

  @override
  String get appBarTitle => 'Glucore Sensor';

  @override
  String get statusLabel => 'Status';

  @override
  String get errorLabel => 'Error';

  @override
  String get noSessionMessage => 'No active sensor session.';

  @override
  String get sensorBarcodeLabel => 'Sensor barcode';

  @override
  String get registerSensorButton => 'Register Sensor';

  @override
  String get resetButton => 'Reset';

  @override
  String get registeredSensorLabel => 'Registered sensor';

  @override
  String get startMonitoringButton => 'Start Monitoring';

  @override
  String get connectingMessage => 'Connecting...';

  @override
  String get warmupLabel => 'Warmup';

  @override
  String get cancelButton => 'Cancel';

  @override
  String get currentGlucoseLabel => 'Current Glucose';

  @override
  String get updatedLabel => 'Updated';

  @override
  String get stopMonitoringButton => 'Stop Monitoring';

  @override
  String get clearSessionButton => 'Clear Session';

  @override
  String get sensorConnectedMessage =>
      'Sensor connected. Waiting for warmup/readings.';

  @override
  String get beginWarmupButton => 'Begin Warmup';

  @override
  String get disconnectButton => 'Disconnect';

  @override
  String get invalidSensorBarcodeError => 'Invalid sensor barcode';

  @override
  String get invalidTransmitterBarcodeError => 'Invalid transmitter barcode';

  @override
  String get noActiveSensorError => 'No active sensor';

  @override
  String get mgdlUnit => 'mg/dL';
}
