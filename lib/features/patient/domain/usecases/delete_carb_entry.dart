import '../../../../core/usecase/usecase.dart';
import '../repositories/patient_repository.dart';

/// Apaga pelo `id` da entrada, nunca pelo horário (IDENT-03).
class DeleteCarbEntry implements UseCase<void, String> {
  const DeleteCarbEntry(this.repository);

  final PatientRepository repository;

  @override
  Future<void> call(String params) => repository.removeCarb(params);
}
