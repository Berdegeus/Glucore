import 'dart:async';

import '../../domain/models.dart';
import '../../domain/events.dart';
import '../../domain/sensor_repository.dart';

class FakeSensorRepository implements SensorRepository {
  SensorSession? _activeSession;
  bool _connected = false;
  final _events = StreamController<SensorEvent>.broadcast();
  Timer? _warmupTimer;
  Timer? _readingTimer;
  int _warmupElapsed = 0;

  @override
  Future<SensorSession?> restoreSession() async {
    if (_activeSession != null) {
      _events.add(SensorEvent.connected(_activeSession!));
      return _activeSession;
    }
    return null;
  }

  @override
  Future<void> registerSensor(String barcode) async {
    if (barcode.isEmpty) throw SensorFailure('Invalid sensor barcode');

    _activeSession = SensorSession(sensorId: barcode);
    _events.add(SensorEvent.scanning());
    _events.add(SensorEvent.connecting());
    _connected = true;
    _events.add(SensorEvent.connected(_activeSession!));
  }

  @override
  Future<void> submitTransmitter(String transmitterBarcode) async {
    await Future.delayed(const Duration(milliseconds: 300));
    if (transmitterBarcode.isEmpty) throw SensorFailure('Invalid transmitter barcode');
    if (_activeSession == null) throw SensorFailure('No active sensor');
    _activeSession = _activeSession!.copyWith(transmitterId: transmitterBarcode);
  }

  @override
  Future<void> startMonitoring() async {
    if (_activeSession == null) throw SensorFailure('No sensor registered');

    _events.add(SensorEvent.connecting());
    await Future.delayed(const Duration(milliseconds: 500));
    _connected = true;
    _events.add(SensorEvent.connected(_activeSession!));

    _warmupElapsed = 0;
    const totalWarmup = 12;
    _warmupTimer?.cancel();
    _warmupTimer = Timer.periodic(const Duration(seconds: 3), (timer) {
      _warmupElapsed += 3;
      final warmup = WarmupInfo(elapsed: Duration(seconds: _warmupElapsed), total: Duration(seconds: totalWarmup));
      _events.add(SensorEvent.warmingUp(warmup, session: _activeSession));

      if (_warmupElapsed >= totalWarmup) {
        timer.cancel();
        _emitReading();
      }
    });
  }

  void _emitReading() {
    if (!_connected || _activeSession == null) return;
    _readingTimer?.cancel();
    _events.add(SensorEvent.reading(GlucoseReading(value: 120), session: _activeSession));
    _readingTimer = Timer.periodic(const Duration(seconds: 4), (timer) {
      final value = 90 + (timer.tick % 40);
      _events.add(SensorEvent.reading(GlucoseReading(value: value.toDouble()), session: _activeSession));
    });
  }

  @override
  Future<void> stopMonitoring() async {
    _warmupTimer?.cancel();
    _readingTimer?.cancel();
    _connected = false;
    await Future.delayed(const Duration(milliseconds: 200));
    _events.add(SensorEvent.disconnected());
  }

  @override
  Stream<SensorEvent> observeSessionEvents() => _events.stream;

  @override
  Future<void> clearSession() async {
    await stopMonitoring();
    _activeSession = null;
    _events.add(const SensorEvent());
  }
}
