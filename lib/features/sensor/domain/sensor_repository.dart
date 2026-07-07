import 'models.dart';
import 'events.dart';

abstract class SensorRepository {
  Future<SensorSession?> restoreSession();

  /// Registers a sensor. Returns the resulting session on success (real
  /// implementation) or `null` when no synchronous result exists (mock).
  Future<SensorSession?> registerSensor(String barcode);
  Future<void> submitTransmitter(String transmitterBarcode);
  Future<void> startMonitoring();
  Future<void> stopMonitoring();
  Stream<SensorEvent> observeSessionEvents();
  Future<void> clearSession();
}
