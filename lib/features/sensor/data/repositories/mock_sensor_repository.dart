import 'dart:async';
import 'dart:math';

import '../../domain/events.dart';
import '../../domain/models.dart';
import '../../domain/sensor_repository.dart';

/// Debug-only fake sensor. Replays a realistic connection sequence then emits
/// periodic glucose updates every 5 minutes. Never touches any platform channel.
class MockSensorRepository implements SensorRepository {
  static const _sensorId = 'MOCK-DEBUG-001';
  static const _historyCount = 24; // ~2 h of back-fill at 5-min intervals
  static const _readingIntervalMs = 5 * 60 * 1000; // 5 min

  final _controller = StreamController<SensorEvent>.broadcast();
  final _rng = Random();
  Timer? _readingTimer;
  bool _started = false;

  double _lastGlucose = 110;
  double _lastRate = 0;

  @override
  Future<SensorSession?> restoreSession() async => null;

  @override
  Future<void> registerSensor(String barcode) async {}

  @override
  Future<void> submitTransmitter(String transmitterBarcode) async {}

  @override
  Future<void> startMonitoring() async {
    if (_started) return;
    _started = true;
    _replaySequence();
  }

  @override
  Future<void> stopMonitoring() async {
    _readingTimer?.cancel();
    _readingTimer = null;
    _started = false;
    if (!_controller.isClosed) {
      _controller.add(SensorEvent.disconnected());
    }
  }

  @override
  Stream<SensorEvent> observeSessionEvents() => _controller.stream;

  @override
  Future<void> clearSession() async {
    await stopMonitoring();
  }

  void dispose() {
    _readingTimer?.cancel();
    _controller.close();
  }

  Future<void> _replaySequence() async {
    final session = SensorSession(
      sensorId: _sensorId,
      createdAt: DateTime.now().subtract(const Duration(days: 3)),
    );

    await _delay(400);
    _emit(SensorEvent.scanning());

    await _delay(800);
    _emit(SensorEvent.connecting());

    await _delay(1200);
    _emit(SensorEvent.connected(session));

    // History back-fill
    final now = DateTime.now();
    for (int i = _historyCount; i >= 1; i--) {
      await _delay(80);
      final ts = now.subtract(Duration(minutes: i * 5));
      final reading = _nextReading(ts);
      _emit(
        SensorEvent.syncingHistory(
          HistorySyncInfo(
            receivedCount: _historyCount - i + 1,
            latestTimestamp: ts,
          ),
          session: session,
          historyReading: reading,
        ),
      );
    }

    await _delay(400);
    _emit(SensorEvent.reading(_nextReading(now), session: session));

    _readingTimer = Timer.periodic(
      const Duration(milliseconds: _readingIntervalMs),
      (_) {
        if (!_controller.isClosed) {
          _emit(SensorEvent.reading(_nextReading(DateTime.now()), session: session));
        }
      },
    );
  }

  GlucoseReading _nextReading(DateTime timestamp) {
    // Random-walk glucose between 70–200 mg/dL
    final delta = (_rng.nextDouble() - 0.45) * 8;
    _lastGlucose = (_lastGlucose + delta).clamp(70.0, 200.0);
    _lastRate = delta / 5.0; // rough mg/dL/min
    return GlucoseReading(
      value: _lastGlucose,
      timestamp: timestamp,
      rate: _lastRate,
    );
  }

  void _emit(SensorEvent event) {
    if (!_controller.isClosed) _controller.add(event);
  }

  Future<void> _delay(int ms) => Future.delayed(Duration(milliseconds: ms));
}
