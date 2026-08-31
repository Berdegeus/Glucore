import '../../../../core/usecase/usecase.dart';
import '../entities/patient_entities.dart';
import '../repositories/patient_repository.dart';

class EditCarbEntry implements UseCase<void, CarbEntry> {
  const EditCarbEntry(this.repository);

  final PatientRepository repository;

  @override
  Future<void> call(CarbEntry params) => repository.updateCarb(params);
}
