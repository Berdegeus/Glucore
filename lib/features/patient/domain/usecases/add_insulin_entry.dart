import '../../../../core/usecase/usecase.dart';
import '../entities/patient_entities.dart';
import '../repositories/patient_repository.dart';

class AddInsulinEntry implements UseCase<void, InsulinEntry> {
  const AddInsulinEntry(this.repository);

  final PatientRepository repository;

  @override
  Future<void> call(InsulinEntry params) => repository.addInsulin(params);
}
