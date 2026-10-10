import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/sensor/domain/events.dart';
import 'package:glucore/features/sensor/domain/models.dart';
import 'package:glucore/features/sensor/domain/sensor_repository.dart';
import 'package:glucore/features/sensor/presentation/cubit/sensor_cubit.dart';

void main() {
  final now = DateTime(2026, 10, 10, 12);

  group('SensorLife', () {
    final life = SensorLife(
      startedAt: now.subtract(const Duration(days: 4)),
      expectedEnd: now.add(const Duration(days: 18)),
    );

    test('remaining time counts down to the expected end', () {
      expect(life.remaining(now), const Duration(days: 18));
      expect(life.remaining(now.add(const Duration(days: 10))), const Duration(days: 8));
    });

    test('remaining time never goes negative', () {
      expect(life.remaining(now.add(const Duration(days: 40))), Duration.zero);
    });

    test('has ended exactly at the end and after it', () {
      expect(life.hasEnded(life.expectedEnd), isTrue);
      expect(life.hasEnded(life.expectedEnd.add(const Duration(seconds: 1))), isTrue);
      expect(life.hasEnded(now), isFalse);
    });
  });

  group('SensorCubit sensor life', () {
    late _Repo repo;
    late SensorCubit cubit;

    setUp(() async {
      repo = _Repo();
      cubit = SensorCubit(repository: repo);
      await cubit.initialize(); // starts listening to the repository's events
    });

    tearDown(() async {
      await cubit.close();
      await repo.dispose();
    });

    Future<void> settle() => Future<void>.delayed(Duration.zero);

    final life = SensorLife(
      startedAt: DateTime(2026, 10, 1),
      expectedEnd: DateTime(2026, 10, 23),
    );

    test('is read once data starts flowing', () async {
      repo.life = life;
      repo.emit(SensorEvent(status: SensorConnectionStatus.readingAvailable));
      await settle();
      await settle();

      expect(cubit.state.sensorLife?.expectedEnd, life.expectedEnd);
    });

    test('stays unknown while the library does not know it, and is not an error', () async {
      repo.life = null;
      repo.emit(SensorEvent(status: SensorConnectionStatus.readingAvailable));
      await settle();
      await settle();

      expect(cubit.state.sensorLife, isNull);
      expect(cubit.state.status, SensorConnectionStatus.readingAvailable);
    });

    test('is looked up again on a later reading once it becomes known', () async {
      repo.life = null;
      repo.emit(SensorEvent(status: SensorConnectionStatus.readingAvailable));
      await settle();
      await settle();
      expect(cubit.state.sensorLife, isNull);

      repo.life = life;
      repo.emit(SensorEvent(status: SensorConnectionStatus.readingAvailable));
      await settle();
      await settle();

      expect(cubit.state.sensorLife?.startedAt, life.startedAt);
    });

    test('a failure to read it is swallowed', () async {
      repo.throwOnLife = true;
      repo.emit(SensorEvent(status: SensorConnectionStatus.readingAvailable));
      await settle();
      await settle();

      expect(cubit.state.sensorLife, isNull);
      expect(cubit.state.status, SensorConnectionStatus.readingAvailable);
    });

    test('is kept across events and dropped with the session', () async {
      repo.life = life;
      repo.emit(SensorEvent(status: SensorConnectionStatus.readingAvailable));
      await settle();
      await settle();
      expect(cubit.state.sensorLife, isNotNull);

      repo.emit(SensorEvent(status: SensorConnectionStatus.disconnected));
      await settle();
      expect(cubit.state.sensorLife, isNotNull, reason: 'a drop is not a new sensor');

      repo.emit(SensorEvent(status: SensorConnectionStatus.idle));
      await settle();
      expect(cubit.state.sensorLife, isNull, reason: 'no session left');
    });
  });
}

class _Repo implements SensorRepository {
  final _events = StreamController<SensorEvent>.broadcast();
  SensorLife? life;
  bool throwOnLife = false;

  void emit(SensorEvent event) => _events.add(event);
  Future<void> dispose() => _events.close();

  @override
  Stream<SensorEvent> observeSessionEvents() => _events.stream;

  @override
  Future<SensorSession?> restoreSession() async => null;

  @override
  Future<SensorLife?> getSensorLife() async {
    if (throwOnLife) throw StateError('boom');
    return life;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => Future<void>.value();
}
