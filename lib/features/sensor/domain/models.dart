// Domain models for Sibionics MVP

enum SensorConnectionStatus {
  idle,
  scanning,
  connecting,
  connected,
  warmingUp,
  readingAvailable,
  disconnected,
  error,
}

enum SensorFailureCode {
  invalidSensorBarcode,
  invalidTransmitterBarcode,
  noActiveSensor,
  noSensorRegistered,
  unknown,
}

class SensorFailure {
  final SensorFailureCode code;
  final String? details;

  const SensorFailure(this.code, {this.details});

  @override
  String toString() {
    return details == null
        ? 'SensorFailure($code)'
        : 'SensorFailure($code, $details)';
  }
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

class SensorUiState {
  final SensorConnectionStatus status;
  final SensorSession? session;
  final WarmupInfo? warmupInfo;
  final GlucoseReading? reading;
  final SensorFailure? failure;

  const SensorUiState({
    this.status = SensorConnectionStatus.idle,
    this.session,
    this.warmupInfo,
    this.reading,
    this.failure,
  });

  SensorUiState copyWith({
    SensorConnectionStatus? status,
    SensorSession? session,
    WarmupInfo? warmupInfo,
    GlucoseReading? reading,
    SensorFailure? failure,
    bool clearFailure = false,
  }) {
    return SensorUiState(
      status: status ?? this.status,
      session: session ?? this.session,
      warmupInfo: warmupInfo ?? this.warmupInfo,
      reading: reading ?? this.reading,
      failure: clearFailure ? null : failure ?? this.failure,
    );
  }

  static const initial = SensorUiState();
}
