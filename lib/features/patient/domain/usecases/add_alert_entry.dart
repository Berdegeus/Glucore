import '../../../../core/usecase/usecase.dart';
import '../entities/patient_entities.dart';
import '../repositories/patient_repository.dart';

/// Alerta nasce no app e nunca é editado nem apagado pelo paciente: a única
/// operação da entidade é a criação por item (SYNC-01).
class AddAlertEntry implements UseCase<void, AppAlertItem> {
  const AddAlertEntry(this.repository);

  final PatientRepository repository;

  @override
  Future<void> call(AppAlertItem params) => repository.addAlert(params);
}
