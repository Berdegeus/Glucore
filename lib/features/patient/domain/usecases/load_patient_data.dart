import '../../../../core/usecase/usecase.dart';
import '../entities/patient_entities.dart';
import '../repositories/patient_repository.dart';

/// Devolve o snapshot local do paciente — nunca depende de rede.
class LoadPatientData implements UseCase<PatientSnapshot, NoParams> {
  const LoadPatientData(this.repository);

  final PatientRepository repository;

  @override
  Future<PatientSnapshot> call(NoParams params) => repository.load();
}
