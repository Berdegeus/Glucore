import '../repositories/patient_repository.dart';
import 'add_alert_entry.dart';
import 'add_carb_entry.dart';
import 'add_insulin_entry.dart';
import 'delete_carb_entry.dart';
import 'delete_insulin_entry.dart';
import 'edit_carb_entry.dart';
import 'edit_insulin_entry.dart';
import 'ensure_patient_owner.dart';
import 'load_patient_data.dart';
import 'refresh_patient_data.dart';
import 'save_glucose_readings.dart';
import 'update_alert_settings.dart';

/// Os casos de uso que o `PatientCubit` executa (DOMAIN-03).
///
/// A amarração caso de uso ↔ repositório vive aqui, no domínio: a camada de
/// apresentação recebe este conjunto pronto e nunca vê um repositório.
class PatientUseCases {
  const PatientUseCases({
    required this.loadPatientData,
    required this.refreshPatientData,
    required this.ensurePatientOwner,
    required this.addCarbEntry,
    required this.editCarbEntry,
    required this.deleteCarbEntry,
    required this.addInsulinEntry,
    required this.editInsulinEntry,
    required this.deleteInsulinEntry,
    required this.addAlertEntry,
    required this.saveGlucoseReadings,
    required this.updateAlertSettings,
  });

  factory PatientUseCases.fromRepository(PatientRepository repository) {
    return PatientUseCases(
      loadPatientData: LoadPatientData(repository),
      refreshPatientData: RefreshPatientData(repository),
      ensurePatientOwner: EnsurePatientOwner(repository),
      addCarbEntry: AddCarbEntry(repository),
      editCarbEntry: EditCarbEntry(repository),
      deleteCarbEntry: DeleteCarbEntry(repository),
      addInsulinEntry: AddInsulinEntry(repository),
      editInsulinEntry: EditInsulinEntry(repository),
      deleteInsulinEntry: DeleteInsulinEntry(repository),
      addAlertEntry: AddAlertEntry(repository),
      saveGlucoseReadings: SaveGlucoseReadings(repository),
      updateAlertSettings: UpdateAlertSettings(repository),
    );
  }

  final LoadPatientData loadPatientData;
  final RefreshPatientData refreshPatientData;
  final EnsurePatientOwner ensurePatientOwner;
  final AddCarbEntry addCarbEntry;
  final EditCarbEntry editCarbEntry;
  final DeleteCarbEntry deleteCarbEntry;
  final AddInsulinEntry addInsulinEntry;
  final EditInsulinEntry editInsulinEntry;
  final DeleteInsulinEntry deleteInsulinEntry;
  final AddAlertEntry addAlertEntry;
  final SaveGlucoseReadings saveGlucoseReadings;
  final UpdateAlertSettings updateAlertSettings;
}
