import '../../../../core/usecase/usecase.dart';
import '../entities/patient_entities.dart';
import '../repositories/patient_repository.dart';

class EditInsulinEntry implements UseCase<void, InsulinEntry> {
  const EditInsulinEntry(this.repository);

  final PatientRepository repository;

  @override
  Future<void> call(InsulinEntry params) => repository.updateInsulin(params);
}
