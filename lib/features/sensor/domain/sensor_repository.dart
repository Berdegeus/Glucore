import 'models.dart';
import 'events.dart';

abstract class SensorRepository {
  Future<SensorSession?> restoreSession();

  /// Registers a sensor. Returns the resulting session on success (real
  /// implementation) or `null` when no synchronous result exists (mock).
  /// The native layer is the authority on the actual brand; [brand] carries
  /// the user's choice from the UI.
  Future<SensorSession?> registerSensor(
    String barcode, {
    SensorBrand brand = SensorBrand.sibionics,
  });
  Future<void> startMonitoring();
  Future<void> stopMonitoring();
  Stream<SensorEvent> observeSessionEvents();
  Future<void> clearSession();

  // Libre 2 support: Abbott algorithm library + NFC pairing. NFC results
  // arrive through [observeSessionEvents] as [SensorEvent.nfc].
  Future<AbbottLibraryStatus> getAbbottLibraryStatus();
  Future<void> installAbbottLibrary(String path);
  Future<void> startNfcScan();
  Future<void> stopNfcScan();
}
