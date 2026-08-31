import '../../../../core/usecase/usecase.dart';
import '../entities/patient_entities.dart';
import '../repositories/patient_repository.dart';

/// Leitura é append-only e segue pelo caminho de coleção (SYNC-10). Limpar o
/// histórico é gravar a coleção vazia.
class SaveGlucoseReadings implements UseCase<void, List<GlucoseReadingItem>> {
  const SaveGlucoseReadings(this.repository);

  final PatientRepository repository;

  @override
  Future<void> call(List<GlucoseReadingItem> params) =>
      repository.saveReadings(params);
}
