import 'models.dart';
import 'events.dart';

abstract class SensorRepository {
  Future<SensorSession?> restoreSession();
  Future<void> registerSensor(String barcode);
  Future<void> submitTransmitter(String transmitterBarcode);
  Future<void> startMonitoring();
  Future<void> stopMonitoring();
  Stream<SensorEvent> observeSessionEvents();
  Future<void> clearSession();
}
