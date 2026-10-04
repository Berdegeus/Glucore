import '../../../../core/usecase/usecase.dart';
import '../repositories/patient_repository.dart';

/// Apaga pelo `id` da entrada, nunca pelo horário (IDENT-03).
class DeleteInsulinEntry implements UseCase<void, String> {
  const DeleteInsulinEntry(this.repository);

  final PatientRepository repository;

  @override
  Future<void> call(String params) => repository.removeInsulin(params);
}
