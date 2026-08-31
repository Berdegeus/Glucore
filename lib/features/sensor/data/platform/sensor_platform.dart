import 'package:flutter/services.dart';

import '../../domain/models.dart';
import '../../domain/events.dart';

class SensorSessionSnapshot {
  final String sensorId;
  final bool connected;
  final SensorBrand brand;

  SensorSessionSnapshot({
    required this.sensorId,
    required this.connected,
    this.brand = SensorBrand.sibionics,
  });

  factory SensorSessionSnapshot.fromMap(Map<dynamic, dynamic> map) {
    return SensorSessionSnapshot(
      sensorId: map['sensorId']?.toString() ?? '',
      connected: map['connected'] == true,
      brand: SensorBrand.fromWireName(map['brand']?.toString()),
    );
  }

  Map<String, dynamic> toMap() => {
    'sensorId': sensorId,
    'connected': connected,
    'brand': brand.wireName,
  };

  SensorSession toSession() => SensorSession(
        sensorId: sensorId,
        brand: brand,
      );
}

class SensorPlatformEvent {
  final SensorEvent event;

  SensorPlatformEvent({required this.event});

  factory SensorPlatformEvent.fromMap(Map<dynamic, dynamic> map) {
    final status = map['status']?.toString() ?? 'idle';
    final state = SensorConnectionStatus.values.firstWhere(
      (e) => e.name == status,
      orElse: () => SensorConnectionStatus.idle,
    );

    SensorFailure? failure;
    if (map['failure'] != null) {
      failure = SensorFailure(
        map['failure']['message']?.toString() ?? 'unknown',
      );
    }

    SensorSession? session;
    if (map['session'] != null) {
      final s = map['session'] as Map<dynamic, dynamic>;
      session = SensorSession(
        sensorId: s['sensorId'].toString(),
        brand: SensorBrand.fromWireName(
          (s['brand'] ?? map['brand'])?.toString(),
        ),
      );
    }

    WarmupInfo? warmup;
    if (map['warmup'] != null) {
      final w = map['warmup'] as Map<dynamic, dynamic>;
      warmup = WarmupInfo(
        elapsed: Duration(milliseconds: w['elapsedMs'] ?? 0),
        total: Duration(milliseconds: w['totalMs'] ?? 0),
      );
    }

    HistorySyncInfo? historySyncInfo;
    if (map['sync'] != null) {
      final s = map['sync'] as Map<dynamic, dynamic>;
      final latestTimestampMs = (s['latestTimestampMs'] as num?)?.toInt();
      historySyncInfo = HistorySyncInfo(
        receivedCount: (s['receivedCount'] as num?)?.toInt() ?? 0,
        latestTimestamp: latestTimestampMs != null
            ? DateTime.fromMillisecondsSinceEpoch(latestTimestampMs)
            : null,
      );
    }

    GlucoseReading? historyReading;
    if (map['historyReading'] != null) {
      final r = map['historyReading'] as Map<dynamic, dynamic>;
      final timestampMs = (r['timestampMs'] as num?)?.toInt();
      historyReading = GlucoseReading(
        value: (r['value'] as num?)?.toDouble() ?? 0,
        timestamp: timestampMs != null
            ? DateTime.fromMillisecondsSinceEpoch(timestampMs)
            : null,
        rate: (r['rate'] as num?)?.toDouble() ?? 0,
        alarmCode: (r['alarmCode'] as num?)?.toInt(),
      );
    }

    GlucoseReading? reading;
    if (map['reading'] != null) {
      final r = map['reading'] as Map<dynamic, dynamic>;
      final timestampMs = (r['timestampMs'] as num?)?.toInt();
      reading = GlucoseReading(
        value: (r['value'] as num?)?.toDouble() ?? 0,
        timestamp: timestampMs != null
            ? DateTime.fromMillisecondsSinceEpoch(timestampMs)
            : null,
        rate: (r['rate'] as num?)?.toDouble() ?? 0,
        alarmCode: (r['alarmCode'] as num?)?.toInt(),
      );
    }

    final connected = map['connected'] == true;

    SensorNfcInfo? nfc;
    if (map['nfc'] != null) {
      final n = map['nfc'] as Map<dynamic, dynamic>;
      nfc = SensorNfcInfo(
        result: n['result']?.toString() ?? 'error',
        sensorId: n['sensorId']?.toString(),
      );
    }

    return SensorPlatformEvent(
      event: SensorEvent(
        status: state,
        session: session,
        connected: connected,
        historySyncInfo: historySyncInfo,
        historyReading: historyReading,
        warmupInfo: warmup,
        reading: reading,
        failure: failure,
        nfc: nfc,
      ),
    );
  }
}

class SensorPlatform {
  static const _methodChannel = MethodChannel('glucore/sensor/methods');
  static const _eventChannel = EventChannel('glucore/sensor/events');

  Future<SensorSessionSnapshot?> restoreSession() async {
    final result = await _methodChannel.invokeMethod('restoreSession');
    if (result == null) return null;
    return SensorSessionSnapshot.fromMap(result as Map<dynamic, dynamic>);
  }

  /// Registers a sensor and returns the session snapshot synchronously.
  /// Failures surface as [PlatformException] (code `NATIVE_ERROR`); the
  /// EventChannel still emits the corresponding `idle`/`error` event.
  Future<SensorSessionSnapshot?> registerSensor(
    String barcode, {
    SensorBrand brand = SensorBrand.sibionics,
  }) async {
    final result = await _methodChannel.invokeMethod('registerSensor', {
      'barcode': barcode,
      'brand': brand.wireName,
    });
    if (result == null) return null;
    return SensorSessionSnapshot.fromMap(result as Map<dynamic, dynamic>);
  }

  Future<void> startMonitoring() async {
    await _methodChannel.invokeMethod('startMonitoring');
  }

  Future<void> stopMonitoring() async {
    await _methodChannel.invokeMethod('stopMonitoring');
  }

  Future<void> clearSession() async {
    await _methodChannel.invokeMethod('clearSession');
  }

  Future<AbbottLibraryStatus> getAbbottLibraryStatus() async {
    final result =
        await _methodChannel.invokeMethod('getAbbottLibraryStatus');
    final map = (result as Map<dynamic, dynamic>?) ?? const {};
    return AbbottLibraryStatus(
      installed: map['installed'] == true,
      libraryName: map['libraryName']?.toString() ?? '',
    );
  }

  Future<void> installAbbottLibrary(String path) async {
    await _methodChannel.invokeMethod('installAbbottLibrary', {'path': path});
  }

  Future<void> startNfcScan() async {
    await _methodChannel.invokeMethod('startNfcScan');
  }

  Future<void> stopNfcScan() async {
    await _methodChannel.invokeMethod('stopNfcScan');
  }

  Stream<SensorPlatformEvent> observeSensorEvents() {
    return _eventChannel.receiveBroadcastStream().map((event) {
      if (event is Map) {
        return SensorPlatformEvent.fromMap(event);
      }
      return SensorPlatformEvent(event: const SensorEvent());
    });
  }
}
