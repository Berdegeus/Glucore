import 'dart:async';

import '../../domain/models.dart';
import '../../domain/events.dart';
import '../../domain/sensor_repository.dart';
import '../platform/sensor_platform.dart';

class AndroidSensorRepository implements SensorRepository {
  final SensorPlatform platform;
  StreamSubscription<SensorPlatformEvent>? _eventSubscription;
  final _eventController = StreamController<SensorEvent>.broadcast();

  AndroidSensorRepository({required this.platform}) {
    _listenToPlatform();
  }

  void _listenToPlatform() {
    _eventSubscription?.cancel();
    _eventSubscription = platform.observeSensorEvents().listen(
      (platformEvent) {
        // Forward domain event
        _eventController.add(platformEvent.event);
      },
      onError: (error) {
        _eventController.addError(error);
      },
    );
  }

  @override
  Future<SensorSession?> restoreSession() async {
    try {
      final snapshot = await platform.restoreSession();
      if (snapshot != null) {
        return snapshot.toSession();
      }
      return null;
    } catch (e) {
      _eventController.addError(e);
      rethrow;
    }
  }

  @override
  Future<SensorSession?> registerSensor(
    String barcode, {
    SensorBrand brand = SensorBrand.sibionics,
  }) async {
    try {
      final snapshot = await platform.registerSensor(barcode, brand: brand);
      return snapshot?.toSession();
    } catch (e) {
      _eventController.addError(e);
      rethrow;
    }
  }

  @override
  Future<void> submitTransmitter(String transmitterBarcode) async {
    try {
      await platform.submitTransmitter(transmitterBarcode);
    } catch (e) {
      _eventController.addError(e);
      rethrow;
    }
  }

  @override
  Future<void> startMonitoring() async {
    try {
      await platform.startMonitoring();
    } catch (e) {
      _eventController.addError(e);
      rethrow;
    }
  }

  @override
  Future<void> stopMonitoring() async {
    try {
      await platform.stopMonitoring();
    } catch (e) {
      _eventController.addError(e);
      rethrow;
    }
  }

  @override
  Stream<SensorEvent> observeSessionEvents() => _eventController.stream;

  @override
  Future<AbbottLibraryStatus> getAbbottLibraryStatus() =>
      platform.getAbbottLibraryStatus();

  @override
  Future<void> installAbbottLibrary(String path) =>
      platform.installAbbottLibrary(path);

  @override
  Future<void> startNfcScan() => platform.startNfcScan();

  @override
  Future<void> stopNfcScan() => platform.stopNfcScan();

  @override
  Future<void> clearSession() async {
    try {
      await platform.clearSession();
    } catch (e) {
      _eventController.addError(e);
      rethrow;
    }
  }

  void dispose() {
    _eventSubscription?.cancel();
    _eventController.close();
  }
}
