import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/core/api/auth_token_store.dart';
import 'package:glucore/features/patient/data/datasources/patient_datasource.dart';
import 'package:glucore/features/patient/data/datasources/patient_local_datasource.dart';
import 'package:glucore/features/patient/data/repositories/patient_repository.dart';
import 'package:glucore/features/patient/data/sync/patient_sync_service.dart';
import 'package:glucore/features/patient/presentation/models/patient_models.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

/// P19: local patient data must be scoped to its owning user. A different
/// account on the same device wipes the data (ensureOwner) and the sync guard
/// never pushes one account's rows to another.
void main() {
  sqfliteFfiInit();

  String jwtWithSub(String sub) {
    final payload = base64Url.encode(utf8.encode(jsonEncode({'sub': sub})));
    return 'header.$payload.signature';
  }

  group('AuthTokenStore.subFromJwt', () {
    test('decodes the sub claim', () {
      expect(AuthTokenStore.subFromJwt(jwtWithSub('user-123')), 'user-123');
    });
    test('returns null for a malformed token', () {
      expect(AuthTokenStore.subFromJwt('not-a-jwt'), isNull);
    });
  });

  group('LocalPatientDataSource ownership', () {
    late LocalPatientDataSource local;
    setUp(() => local = LocalPatientDataSource(
          databaseFactory: databaseFactoryFfi,
          databasePath: inMemoryDatabasePath,
        ));
    tearDown(() => local.close());

    test('setOwner / getOwner round-trip', () async {
      expect(await local.getOwner(), isNull);
      await local.setOwner('user-A');
      expect(await local.getOwner(), 'user-A');
      await local.setOwner('user-B');
      expect(await local.getOwner(), 'user-B');
    });

    test('wipeAllData clears collections but keeps the owner', () async {
      await local.setOwner('user-A');
      await local.saveCarbs([
        CarbEntry(time: DateTime(2026, 1, 1), grams: 30, description: 'x'),
      ]);

      await local.wipeAllData();

      final snapshot = await local.load();
      expect(snapshot.carbs, isEmpty);
      expect(await local.getOwner(), 'user-A');
    });
  });

  group('PatientRepository.ensureOwner', () {
    late LocalPatientDataSource local;
    late _FakeTokenStore tokenStore;
    late PatientRepository repo;

    setUp(() {
      local = LocalPatientDataSource(
        databaseFactory: databaseFactoryFfi,
        databasePath: inMemoryDatabasePath,
      );
      tokenStore = _FakeTokenStore();
      final remote = _FakeRemote();
      repo = PatientRepository(
        local: local,
        remote: remote,
        syncService: PatientSyncService(
          local: local,
          remote: remote,
          connectivityChanges: const Stream.empty(),
        ),
        tokenStore: tokenStore,
      );
    });
    tearDown(() => local.close());

    test('first login on a fresh db just claims ownership', () async {
      tokenStore.userId = 'user-A';
      expect(await repo.ensureOwner(), isFalse);
      expect(await local.getOwner(), 'user-A');
    });

    test('same user does not wipe', () async {
      await local.setOwner('user-A');
      tokenStore.userId = 'user-A';
      expect(await repo.ensureOwner(), isFalse);
    });

    test('different user wipes and reports switch', () async {
      await local.setOwner('user-A');
      await local.saveCarbs([
        CarbEntry(time: DateTime(2026, 1, 1), grams: 30, description: 'x'),
      ]);
      tokenStore.userId = 'user-B';

      expect(await repo.ensureOwner(), isTrue);
      expect(await local.getOwner(), 'user-B');
      expect((await local.load()).carbs, isEmpty);
    });
  });

  group('PatientSyncService owner guard', () {
    late LocalPatientDataSource local;
    late _FakeRemote remote;
    late _FakeTokenStore tokenStore;
    late PatientSyncService sync;

    setUp(() {
      local = LocalPatientDataSource(
        databaseFactory: databaseFactoryFfi,
        databasePath: inMemoryDatabasePath,
      );
      remote = _FakeRemote();
      tokenStore = _FakeTokenStore();
      sync = PatientSyncService(
        local: local,
        remote: remote,
        tokenStore: tokenStore,
        connectivityChanges: const Stream.empty(),
      );
    });
    tearDown(() {
      sync.dispose();
      return local.close();
    });

    test('does not push when the local owner differs from the current user',
        () async {
      await local.setOwner('user-A');
      await local.saveCarbs([
        CarbEntry(time: DateTime(2026, 1, 1), grams: 30, description: 'x'),
      ]);
      tokenStore.userId = 'user-B'; // wrong account

      await sync.pushNow();

      expect(remote.savedCarbs, isEmpty);
    });

    test('pushes when the owner matches the current user', () async {
      await local.setOwner('user-A');
      await local.saveCarbs([
        CarbEntry(time: DateTime(2026, 1, 1), grams: 30, description: 'x'),
      ]);
      tokenStore.userId = 'user-A';

      await sync.pushNow();

      expect(remote.savedCarbs, hasLength(1));
    });
  });
}

class _FakeTokenStore extends AuthTokenStore {
  _FakeTokenStore() : super(const FlutterSecureStorage());
  String? userId;
  @override
  Future<String?> readUserId() async => userId;
}

class _FakeRemote implements PatientDataSource {
  final savedReadings = <List<GlucoseReadingItem>>[];
  final savedAlerts = <List<AppAlertItem>>[];
  final savedCarbs = <List<CarbEntry>>[];
  final savedInsulin = <List<InsulinEntry>>[];
  final savedSettings = <AlertSettingsModel>[];

  @override
  Future<PatientSnapshot> load() => throw UnimplementedError();
  @override
  Future<void> saveReadings(List<GlucoseReadingItem> readings) async =>
      savedReadings.add(readings);
  @override
  Future<void> saveAlerts(List<AppAlertItem> alerts) async =>
      savedAlerts.add(alerts);
  @override
  Future<void> saveCarbs(List<CarbEntry> carbs) async => savedCarbs.add(carbs);
  @override
  Future<void> saveInsulin(List<InsulinEntry> insulin) async =>
      savedInsulin.add(insulin);
  @override
  Future<void> saveAlertSettings(AlertSettingsModel settings) async =>
      savedSettings.add(settings);
}
