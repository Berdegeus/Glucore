import 'alert_settings_model.dart';
import 'app_alert_item.dart';
import 'carb_entry.dart';
import 'glucose_reading_item.dart';
import 'insulin_entry.dart';

/// Snapshot completo dos dados do paciente (todas as coleções + thresholds).
class PatientSnapshot {
  const PatientSnapshot({
    required this.readings,
    required this.alerts,
    required this.carbs,
    required this.insulin,
    required this.alertSettings,
  });

  final List<GlucoseReadingItem> readings;
  final List<AppAlertItem> alerts;
  final List<CarbEntry> carbs;
  final List<InsulinEntry> insulin;
  final AlertSettingsModel alertSettings;
}
