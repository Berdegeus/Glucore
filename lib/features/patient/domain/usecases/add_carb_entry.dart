import '../../../../core/usecase/usecase.dart';
import '../entities/patient_entities.dart';
import '../repositories/patient_repository.dart';

class AddCarbEntry implements UseCase<void, CarbEntry> {
  const AddCarbEntry(this.repository);

  final PatientRepository repository;

  @override
  Future<void> call(CarbEntry params) => repository.addCarb(params);
}
