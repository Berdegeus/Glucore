import '../../../../core/usecase/usecase.dart';
import '../repositories/patient_repository.dart';

/// Amarra o banco local ao usuário autenticado (P19).
///
/// Devolve `true` quando uma conta diferente assumiu o aparelho e os dados
/// locais foram apagados.
class EnsurePatientOwner implements UseCase<bool, NoParams> {
  const EnsurePatientOwner(this.repository);

  final PatientRepository repository;

  @override
  Future<bool> call(NoParams params) => repository.ensureOwner();
}
