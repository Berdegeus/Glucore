import '../../../../core/usecase/usecase.dart';
import '../entities/patient_entities.dart';
import '../repositories/patient_repository.dart';

class UpdateAlertSettings implements UseCase<void, AlertSettingsModel> {
  const UpdateAlertSettings(this.repository);

  final PatientRepository repository;

  @override
  Future<void> call(AlertSettingsModel params) =>
      repository.saveAlertSettings(params);
}
