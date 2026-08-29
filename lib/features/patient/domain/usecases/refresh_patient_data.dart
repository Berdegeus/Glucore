import '../../../../core/usecase/usecase.dart';
import '../entities/patient_entities.dart';
import '../repositories/patient_repository.dart';

/// Reconcilia com o backend. Sem rede, devolve `null` em silêncio.
class RefreshPatientData implements UseCase<PatientSnapshot?, NoParams> {
  const RefreshPatientData(this.repository);

  final PatientRepository repository;

  @override
  Future<PatientSnapshot?> call(NoParams params) =>
      repository.refreshFromRemote();
}
