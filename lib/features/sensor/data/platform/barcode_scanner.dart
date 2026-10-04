import 'package:flutter/services.dart';

/// Thrown when Google's code scanner cannot run on this device (no Play
/// Services, scanner module still downloading, ...), so the caller should use
/// its own in-app scanner instead.
class BarcodeScannerUnavailable implements Exception {
  const BarcodeScannerUnavailable([this.reason]);

  final String? reason;

  @override
  String toString() => 'BarcodeScannerUnavailable(${reason ?? ''})';
}

/// Box barcode scan through Google's code scanner (`scanBarcode` on the sensor
/// method channel, see `docs/reference/platform-channels.md`).
///
/// It is the same scanner Juggluco uses for the Sibionics box: it ships its own
/// camera pipeline with autofocus and pinch zoom, which the in-app
/// `mobile_scanner` sheet did not read this box with.
class GoogleBarcodeScanner {
  const GoogleBarcodeScanner({
    MethodChannel channel = const MethodChannel('glucore/sensor/methods'),
  }) : _channel = channel;

  final MethodChannel _channel;

  /// The raw text of the scanned data matrix / QR code, or `null` when the user
  /// cancelled. Throws [BarcodeScannerUnavailable] when the scanner cannot run.
  Future<String?> scan() async {
    try {
      final value = await _channel.invokeMethod<String>('scanBarcode');
      return (value == null || value.isEmpty) ? null : value;
    } on PlatformException catch (e) {
      if (e.code == 'SCANNER_UNAVAILABLE') {
        throw BarcodeScannerUnavailable(e.message);
      }
      rethrow;
    } on MissingPluginException {
      throw const BarcodeScannerUnavailable('not implemented on this platform');
    }
  }
}
