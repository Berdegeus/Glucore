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

  const SensorUiState({
    this.status = SensorConnectionStatus.idle,
    this.session,
    this.historySyncInfo,
    this.historyReading,
    this.warmupInfo,
    this.reading,
    this.failure,
    this.nfcInfo,
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
    );
  }

  /// Brand of the active session (defaults to Sibionics when unknown).
  SensorBrand get brand => session?.brand ?? SensorBrand.sibionics;

  static const initial = SensorUiState();
}
