import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/sensor/data/platform/barcode_scanner.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const channel = MethodChannel('glucore/sensor/methods');
  const scanner = GoogleBarcodeScanner();

  void answer(Future<Object?> Function(MethodCall call) handler) {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, handler);
  }

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  test('returns the raw text and calls scanBarcode', () async {
    String? method;
    answer((call) async {
      method = call.method;
      return '(01)06972831642190(11)251121(10)LT4F2511525';
    });

    expect(await scanner.scan(), '(01)06972831642190(11)251121(10)LT4F2511525');
    expect(method, 'scanBarcode');
  });

  test('keeps GS1 separators untouched (normalization is the caller\'s job)',
      () async {
    const raw = '010697283164219011251121\x1d10LT4F2511525';
    answer((_) async => raw);

    expect(await scanner.scan(), raw);
  });

  test('null or empty answer means the user cancelled', () async {
    answer((_) async => null);
    expect(await scanner.scan(), isNull);

    answer((_) async => '');
    expect(await scanner.scan(), isNull);
  });

  test('SCANNER_UNAVAILABLE becomes BarcodeScannerUnavailable', () async {
    answer((_) async => throw PlatformException(
          code: 'SCANNER_UNAVAILABLE',
          message: 'module not installed',
        ));

    await expectLater(
      scanner.scan(),
      throwsA(isA<BarcodeScannerUnavailable>()
          .having((e) => e.reason, 'reason', 'module not installed')),
    );
  });

  test('a missing native handler also falls back', () async {
    // No mock handler registered -> MissingPluginException.
    await expectLater(scanner.scan(), throwsA(isA<BarcodeScannerUnavailable>()));
  });

  test('any other platform error is not swallowed', () async {
    answer((_) async => throw PlatformException(code: 'NATIVE_ERROR'));

    await expectLater(scanner.scan(), throwsA(isA<PlatformException>()));
  });
}
