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

  GlucoseReading({required this.value, DateTime? timestamp})
    : timestamp = timestamp ?? DateTime.now();
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
  final WarmupInfo? warmupInfo;
  final GlucoseReading? reading;
  final SensorFailure? failure;

  const SensorUiState({
    this.status = SensorConnectionStatus.idle,
    this.session,
    this.historySyncInfo,
    this.warmupInfo,
    this.reading,
    this.failure,
  });

  SensorUiState copyWith({
    SensorConnectionStatus? status,
    SensorSession? session,
    HistorySyncInfo? historySyncInfo,
    WarmupInfo? warmupInfo,
    GlucoseReading? reading,
    SensorFailure? failure,
  }) {
    return SensorUiState(
      status: status ?? this.status,
      session: session ?? this.session,
      historySyncInfo: historySyncInfo ?? this.historySyncInfo,
      warmupInfo: warmupInfo ?? this.warmupInfo,
      reading: reading ?? this.reading,
      failure: failure ?? this.failure,
    );
  }

  static const initial = SensorUiState();
}
