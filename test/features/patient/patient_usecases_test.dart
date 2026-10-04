import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/core/usecase/usecase.dart';
import 'package:glucore/features/patient/domain/entities/patient_entities.dart';
import 'package:glucore/features/patient/domain/repositories/patient_repository.dart';
import 'package:glucore/features/patient/domain/usecases/patient_usecases.dart';

/// DOMAIN-03: um caso de uso por operação que o cubit pede ao repositório.
///
/// Cada teste confere as duas metades: a operação certa foi chamada com o
/// argumento certo, e o valor que o repositório devolve chega intacto ao
/// chamador.
void main() {
  late _RecordingPatientRepository repository;

  setUp(() => repository = _RecordingPatientRepository());

  final carb = CarbEntry.create(
    grams: 40,
    description: 'almoço',
    time: DateTime(2026, 8, 29, 12),
  );
  final insulin = InsulinEntry.create(
    units: 6,
    type: InsulinType.bolus,
    time: DateTime(2026, 8, 29, 12, 5),
    dayOfWeek: kDaysOfWeek[5],
  );
  final alert = AppAlertItem.create(
    type: AppAlertType.glucoseLow,
    timestamp: DateTime(2026, 8, 29, 3),
  );

  test('LoadPatientData devolve o snapshot local do repositório', () async {
    final snapshot = await LoadPatientData(repository)(const NoParams());

    expect(repository.calls, ['load']);
    expect(snapshot.carbs, isEmpty);
    expect(snapshot.alertSettings.lowThreshold, 70);
  });

  test('RefreshPatientData repassa o snapshot reconciliado', () async {
    repository.remoteSnapshot = _snapshotWith(carbs: [carb]);

    final snapshot = await RefreshPatientData(repository)(const NoParams());

    expect(repository.calls, ['refreshFromRemote']);
    expect(snapshot?.carbs.single.id, carb.id);
  });

  test('RefreshPatientData devolve null quando não há rede', () async {
    repository.remoteSnapshot = null;

    final snapshot = await RefreshPatientData(repository)(const NoParams());

    expect(snapshot, isNull);
  });

  test('EnsurePatientOwner repassa a troca de conta', () async {
    repository.ownerSwitched = true;

    final switched = await EnsurePatientOwner(repository)(const NoParams());

    expect(repository.calls, ['ensureOwner']);
    expect(switched, isTrue);
  });

  test('AddCarbEntry grava a entrada por item', () async {
    await AddCarbEntry(repository)(carb);

    expect(repository.calls, ['addCarb']);
    expect(repository.lastArgument, same(carb));
  });

  test('EditCarbEntry atualiza a entrada por item', () async {
    final edited = carb.copyWith(grams: 55);

    await EditCarbEntry(repository)(edited);

    expect(repository.calls, ['updateCarb']);
    expect((repository.lastArgument as CarbEntry).id, carb.id);
    expect((repository.lastArgument as CarbEntry).grams, 55);
  });

  test('DeleteCarbEntry remove pelo id da entrada', () async {
    await DeleteCarbEntry(repository)(carb.id);

    expect(repository.calls, ['removeCarb']);
    expect(repository.lastArgument, carb.id);
  });

  test('AddInsulinEntry grava a entrada por item', () async {
    await AddInsulinEntry(repository)(insulin);

    expect(repository.calls, ['addInsulin']);
    expect(repository.lastArgument, same(insulin));
  });

  test('EditInsulinEntry atualiza a entrada por item', () async {
    final edited = insulin.copyWith(units: 8);

    await EditInsulinEntry(repository)(edited);

    expect(repository.calls, ['updateInsulin']);
    expect((repository.lastArgument as InsulinEntry).id, insulin.id);
    expect((repository.lastArgument as InsulinEntry).units, 8);
  });

  test('DeleteInsulinEntry remove pelo id da entrada', () async {
    await DeleteInsulinEntry(repository)(insulin.id);

    expect(repository.calls, ['removeInsulin']);
    expect(repository.lastArgument, insulin.id);
  });

  test('AddAlertEntry grava o alerta por item', () async {
    await AddAlertEntry(repository)(alert);

    expect(repository.calls, ['addAlert']);
    expect((repository.lastArgument as AppAlertItem).id, alert.id);
  });

  test('SaveGlucoseReadings grava a coleção de leituras', () async {
    final readings = [
      GlucoseReadingItem(
        value: 110,
        timestamp: DateTime(2026, 8, 29, 10),
        trend: GlucoseTrend.stable,
        rate: 0,
      ),
    ];

    await SaveGlucoseReadings(repository)(readings);

    expect(repository.calls, ['saveReadings']);
    expect((repository.lastArgument as List<GlucoseReadingItem>).single.value,
        110);
  });

  test('SaveGlucoseReadings com lista vazia limpa o histórico', () async {
    await SaveGlucoseReadings(repository)(const []);

    expect(repository.calls, ['saveReadings']);
    expect(repository.lastArgument, isEmpty);
  });

  test('UpdateAlertSettings grava os thresholds', () async {
    const settings = AlertSettingsModel(lowThreshold: 75, highThreshold: 190);

    await UpdateAlertSettings(repository)(settings);

    expect(repository.calls, ['saveAlertSettings']);
    expect((repository.lastArgument as AlertSettingsModel).lowThreshold, 75);
    expect((repository.lastArgument as AlertSettingsModel).highThreshold, 190);
  });
}

PatientSnapshot _snapshotWith({List<CarbEntry> carbs = const []}) {
  return PatientSnapshot(
    readings: const [],
    alerts: const [],
    carbs: carbs,
    insulin: const [],
    alertSettings: const AlertSettingsModel(lowThreshold: 70, highThreshold: 180),
  );
}

class _RecordingPatientRepository implements PatientRepository {
  final List<String> calls = [];
  Object? lastArgument;
  PatientSnapshot? remoteSnapshot;
  bool ownerSwitched = false;

  void _record(String name, [Object? argument]) {
    calls.add(name);
    lastArgument = argument;
  }

  @override
  Future<PatientSnapshot> load() async {
    _record('load');
    return _snapshotWith();
  }

  @override
  Future<bool> ensureOwner() async {
    _record('ensureOwner');
    return ownerSwitched;
  }

  @override
  Future<PatientSnapshot?> refreshFromRemote() async {
    _record('refreshFromRemote');
    return remoteSnapshot;
  }

  @override
  Future<void> saveReadings(List<GlucoseReadingItem> readings) async =>
      _record('saveReadings', readings);

  @override
  Future<void> saveAlerts(List<AppAlertItem> alerts) async =>
      _record('saveAlerts', alerts);

  @override
  Future<void> saveCarbs(List<CarbEntry> carbs) async =>
      _record('saveCarbs', carbs);

  @override
  Future<void> saveInsulin(List<InsulinEntry> insulin) async =>
      _record('saveInsulin', insulin);

  @override
  Future<void> addCarb(CarbEntry entry) async => _record('addCarb', entry);

  @override
  Future<void> updateCarb(CarbEntry entry) async => _record('updateCarb', entry);

  @override
  Future<void> removeCarb(String id) async => _record('removeCarb', id);

  @override
  Future<void> addInsulin(InsulinEntry entry) async =>
      _record('addInsulin', entry);

  @override
  Future<void> updateInsulin(InsulinEntry entry) async =>
      _record('updateInsulin', entry);

  @override
  Future<void> removeInsulin(String id) async => _record('removeInsulin', id);

  @override
  Future<void> addAlert(AppAlertItem alert) async => _record('addAlert', alert);

  @override
  Future<void> saveAlertSettings(AlertSettingsModel settings) async =>
      _record('saveAlertSettings', settings);
}
