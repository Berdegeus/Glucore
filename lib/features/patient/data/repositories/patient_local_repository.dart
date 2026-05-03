import '../../presentation/models/patient_models.dart';
import '../datasources/patient_local_datasource.dart';

class PatientLocalRepository {
  const PatientLocalRepository(this.localDataSource);

  final PatientLocalDataSource localDataSource;

  static const maxReadings = 288;
  static const maxAlerts = 100;
  static const maxEntries = 100;

  Future<PatientLocalSnapshot> load() => localDataSource.load();

  Future<void> saveReadings(List<GlucoseReadingItem> readings) {
    return localDataSource.saveReadings(readings.take(maxReadings).toList());
  }

  Future<void> saveAlerts(List<AppAlertItem> alerts) {
    return localDataSource.saveAlerts(alerts.take(maxAlerts).toList());
  }

  Future<void> saveCarbs(List<CarbEntry> carbs) {
    return localDataSource.saveCarbs(carbs.take(maxEntries).toList());
  }

  Future<void> saveInsulin(List<InsulinEntry> insulin) {
    return localDataSource.saveInsulin(insulin.take(maxEntries).toList());
  }

  Future<void> saveAlertSettings(AlertSettingsModel settings) {
    return localDataSource.saveAlertSettings(settings);
  }
}
