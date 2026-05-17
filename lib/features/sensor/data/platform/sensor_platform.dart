import 'package:flutter/services.dart';

import '../../domain/models.dart';
import '../../domain/events.dart';

class SensorSessionSnapshot {
  final String sensorId;
  final String? transmitterId;
  final bool connected;

  SensorSessionSnapshot({
    required this.sensorId,
    this.transmitterId,
    required this.connected,
  });

  factory SensorSessionSnapshot.fromMap(Map<dynamic, dynamic> map) {
    return SensorSessionSnapshot(
      sensorId: map['sensorId']?.toString() ?? '',
      transmitterId: map['transmitterId']?.toString(),
      connected: map['connected'] == true,
    );
  }

  Map<String, dynamic> toMap() => {
    'sensorId': sensorId,
    'transmitterId': transmitterId,
    'connected': connected,
  };

  SensorSession toSession() =>
      SensorSession(sensorId: sensorId, transmitterId: transmitterId);
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
        transmitterId: s['transmitterId']?.toString(),
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

  Future<void> registerSensor(String barcode) async {
    await _methodChannel.invokeMethod('registerSensor', {'barcode': barcode});
  }

  Future<void> submitTransmitter(String transmitterBarcode) async {
    await _methodChannel.invokeMethod('submitTransmitter', {
      'transmitterBarcode': transmitterBarcode,
    });
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

  Stream<SensorPlatformEvent> observeSensorEvents() {
    return _eventChannel.receiveBroadcastStream().map((event) {
      if (event is Map) {
        return SensorPlatformEvent.fromMap(event);
      }
      return SensorPlatformEvent(event: const SensorEvent());
    });
  }
}
