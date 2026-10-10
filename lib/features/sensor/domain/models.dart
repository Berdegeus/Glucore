// Domain models for the sensor feature.

/// CGM sensor brand. `wireName` matches the value used on the platform
/// channel and in the Android session store.
enum SensorBrand {
  sibionics('sibionics'),
  accuchek('accuchek'),
  libre2('libre2');

  final String wireName;

  const SensorBrand(this.wireName);

  static SensorBrand fromWireName(String? name) => SensorBrand.values
      .firstWhere((b) => b.wireName == name, orElse: () => SensorBrand.sibionics);
}

enum SensorConnectionStatus {
  idle,
  scanning,
  connecting,

  /// OS bonding dialog is up (Accu-Chek SmartGuide pairing PIN).
  pairing,
  connected,
  syncingHistory,
  warmingUp,
  readingAvailable,
  disconnected,
  error,
}

class SensorFailure {
  final String message;

  const SensorFailure(this.message);

  @override
  String toString() => 'SensorFailure: $message';
}

class SensorSession {
  final String sensorId;
  final DateTime createdAt;
  final SensorBrand brand;

  SensorSession({
    required this.sensorId,
    DateTime? createdAt,
    this.brand = SensorBrand.sibionics,
  }) : createdAt = createdAt ?? DateTime.now();

  SensorSession copyWith({
    String? sensorId,
    DateTime? createdAt,
    SensorBrand? brand,
  }) {
    return SensorSession(
      sensorId: sensorId ?? this.sensorId,
      createdAt: createdAt ?? this.createdAt,
      brand: brand ?? this.brand,
    );
  }
}

class GlucoseReading {
  final double value;
  final DateTime timestamp;
  final double rate;
  final int? alarmCode;

  GlucoseReading({
    required this.value,
    DateTime? timestamp,
    this.rate = 0,
    this.alarmCode,
  }) : timestamp = timestamp ?? DateTime.now();
}

class WarmupInfo {
  final Duration elapsed;
  final Duration total;

  WarmupInfo({required this.elapsed, required this.total});

  double get progress => total.inMilliseconds == 0
      ? 0
      : elapsed.inMilliseconds / total.inMilliseconds;
}

class HistorySyncInfo {
  final int receivedCount;
  final DateTime? latestTimestamp;

  /// Timestamp of the first backlog record of this sync (the oldest one).
  final DateTime? firstTimestamp;

  const HistorySyncInfo({
    required this.receivedCount,
    this.latestTimestamp,
    this.firstTimestamp,
  });

  /// Estimated progress in 0..1, or null until it can be estimated. The total
  /// isn't known up front; the backlog runs oldest-first up to [now], so the
  /// distance covered between the first record and now stands in for it.
  double? progress(DateTime now) {
    final first = firstTimestamp;
    final latest = latestTimestamp;
    if (first == null || latest == null) return null;
    final span = now.difference(first).inMilliseconds;
    if (span <= 0) return null;
    return (latest.difference(first).inMilliseconds / span).clamp(0.0, 1.0);
  }
}

/// One per-minute reading the vendor library stored for the sensor, as read
/// back from its own store (see `getStoredReadings` in the platform channel).
class StoredSensorReading {
  final DateTime timestamp;
  final double value;
  final double rate;

  const StoredSensorReading({
    required this.timestamp,
    required this.value,
    required this.rate,
  });
}

/// When the active sensor started and when it is expected to end, as the
/// vendor library computes them (the same figure Juggluco shows as "sensor
/// ends"). The wear duration depends on the sensor type, so it is not a fixed
/// number of days.
class SensorLife {
  final DateTime startedAt;
  final DateTime expectedEnd;

  const SensorLife({required this.startedAt, required this.expectedEnd});

  /// Time left at [now]; never negative.
  Duration remaining(DateTime now) {
    final left = expectedEnd.difference(now);
    return left.isNegative ? Duration.zero : left;
  }

  bool hasEnded(DateTime now) => !expectedEnd.isAfter(now);
}

/// Outcome of a Libre 2 NFC interaction, emitted by the Android layer.
/// `result` values: activated, warmup, ready, streaming, ended,
/// needsLibrary, unsupportedLibre3, unsupportedUsGen2, readError, error.
class SensorNfcInfo {
  final String result;
  final String? sensorId;

  const SensorNfcInfo({required this.result, this.sensorId});
}

/// Whether the Abbott algorithm library (needed for Libre 2) is installed.
class AbbottLibraryStatus {
  final bool installed;
  final String libraryName;

  const AbbottLibraryStatus({required this.installed, required this.libraryName});
}

class SensorUiState {
  final SensorConnectionStatus status;
  final SensorSession? session;
  final HistorySyncInfo? historySyncInfo;
  final GlucoseReading? historyReading;
  final WarmupInfo? warmupInfo;
  final GlucoseReading? reading;
  final SensorFailure? failure;
  final SensorNfcInfo? nfcInfo;

  /// Null until the library knows when the sensor started (no data yet).
  final SensorLife? sensorLife;

  const SensorUiState({
    this.status = SensorConnectionStatus.idle,
    this.session,
    this.historySyncInfo,
    this.historyReading,
    this.warmupInfo,
    this.reading,
    this.failure,
    this.nfcInfo,
    this.sensorLife,
  });

  SensorUiState copyWith({
    SensorConnectionStatus? status,
    SensorSession? session,
    HistorySyncInfo? historySyncInfo,
    GlucoseReading? historyReading,
    WarmupInfo? warmupInfo,
    GlucoseReading? reading,
    SensorFailure? failure,
    bool clearFailure = false,
    SensorNfcInfo? nfcInfo,
    SensorLife? sensorLife,
    bool clearSensorLife = false,
  }) {
    return SensorUiState(
      status: status ?? this.status,
      session: session ?? this.session,
      historySyncInfo: historySyncInfo ?? this.historySyncInfo,
      historyReading: historyReading ?? this.historyReading,
      warmupInfo: warmupInfo ?? this.warmupInfo,
      reading: reading ?? this.reading,
      failure: clearFailure ? null : failure ?? this.failure,
      nfcInfo: nfcInfo ?? this.nfcInfo,
      sensorLife: clearSensorLife ? null : sensorLife ?? this.sensorLife,
    );
  }

  /// Brand of the active session (defaults to Sibionics when unknown).
  SensorBrand get brand => session?.brand ?? SensorBrand.sibionics;

  static const initial = SensorUiState();
}
