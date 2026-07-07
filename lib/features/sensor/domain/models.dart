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
  final String? transmitterId;
  final DateTime createdAt;
  final SensorBrand brand;

  SensorSession({
    required this.sensorId,
    this.transmitterId,
    DateTime? createdAt,
    this.brand = SensorBrand.sibionics,
  }) : createdAt = createdAt ?? DateTime.now();

  SensorSession copyWith({
    String? sensorId,
    String? transmitterId,
    DateTime? createdAt,
    SensorBrand? brand,
  }) {
    return SensorSession(
      sensorId: sensorId ?? this.sensorId,
      transmitterId: transmitterId ?? this.transmitterId,
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

  const HistorySyncInfo({required this.receivedCount, this.latestTimestamp});
}

class SensorUiState {
  final SensorConnectionStatus status;
  final SensorSession? session;
  final HistorySyncInfo? historySyncInfo;
  final GlucoseReading? historyReading;
  final WarmupInfo? warmupInfo;
  final GlucoseReading? reading;
  final SensorFailure? failure;
  final bool isMock;

  const SensorUiState({
    this.status = SensorConnectionStatus.idle,
    this.session,
    this.historySyncInfo,
    this.historyReading,
    this.warmupInfo,
    this.reading,
    this.failure,
    this.isMock = false,
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
    bool? isMock,
  }) {
    return SensorUiState(
      status: status ?? this.status,
      session: session ?? this.session,
      historySyncInfo: historySyncInfo ?? this.historySyncInfo,
      historyReading: historyReading ?? this.historyReading,
      warmupInfo: warmupInfo ?? this.warmupInfo,
      reading: reading ?? this.reading,
      failure: clearFailure ? null : failure ?? this.failure,
      isMock: isMock ?? this.isMock,
    );
  }

  /// Brand of the active session (defaults to Sibionics when unknown).
  SensorBrand get brand => session?.brand ?? SensorBrand.sibionics;

  static const initial = SensorUiState();
}
