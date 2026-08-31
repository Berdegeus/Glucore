/// Barrel das entidades do paciente (DOMAIN-01).
///
/// A regra de negócio do diário vive aqui, fora de `presentation/`: as camadas
/// de dados, de domínio e de UI importam este arquivo, nunca um modelo de tela.
library;

export 'alert_settings_model.dart';
export 'app_alert_item.dart';
export 'carb_entry.dart';
export 'glucose_reading_item.dart';
export 'insulin_entry.dart';
export 'patient_snapshot.dart';
