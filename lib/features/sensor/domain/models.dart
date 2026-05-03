// Domain models for Sibionics MVP

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

  SensorSession({
    required this.sensorId,
    this.transmitterId,
    DateTime? createdAt,
  }) : createdAt = createdAt ?? DateTime.now();

  SensorSession copyWith({
    String? sensorId,
    String? transmitterId,
    DateTime? createdAt,
  }) {
    return SensorSession(
      sensorId: sensorId ?? this.sensorId,
      transmitterId: transmitterId ?? this.transmitterId,
      createdAt: createdAt ?? this.createdAt,
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

  const SensorUiState({
    this.status = SensorConnectionStatus.idle,
    this.session,
    this.historySyncInfo,
    this.historyReading,
    this.warmupInfo,
    this.reading,
    this.failure,
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
  }) {
    return SensorUiState(
      status: status ?? this.status,
      session: session ?? this.session,
      historySyncInfo: historySyncInfo ?? this.historySyncInfo,
      historyReading: historyReading ?? this.historyReading,
      warmupInfo: warmupInfo ?? this.warmupInfo,
      reading: reading ?? this.reading,
      failure: clearFailure ? null : failure ?? this.failure,
    );
  }

  static const initial = SensorUiState();
}
