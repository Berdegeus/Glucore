import 'models.dart';

class SensorEvent {
  final SensorConnectionStatus status;
  final SensorSession? session;
  final bool connected;
  final HistorySyncInfo? historySyncInfo;
  final WarmupInfo? warmupInfo;
  final GlucoseReading? reading;
  final SensorFailure? failure;

  const SensorEvent({
    this.status = SensorConnectionStatus.idle,
    this.session,
    this.connected = false,
    this.historySyncInfo,
    this.warmupInfo,
    this.reading,
    this.failure,
  });

  factory SensorEvent.idle() => const SensorEvent();
  factory SensorEvent.scanning() =>
      const SensorEvent(status: SensorConnectionStatus.scanning);
  factory SensorEvent.connecting() =>
      const SensorEvent(status: SensorConnectionStatus.connecting);
  factory SensorEvent.connected(SensorSession session) => SensorEvent(
    status: SensorConnectionStatus.connected,
    session: session,
    connected: true,
  );
  factory SensorEvent.syncingHistory(
    HistorySyncInfo historySyncInfo, {
    SensorSession? session,
  }) => SensorEvent(
    status: SensorConnectionStatus.syncingHistory,
    historySyncInfo: historySyncInfo,
    session: session,
    connected: true,
  );
  factory SensorEvent.warmingUp(
    WarmupInfo warmupInfo, {
    SensorSession? session,
  }) => SensorEvent(
    status: SensorConnectionStatus.warmingUp,
    warmupInfo: warmupInfo,
    session: session,
    connected: true,
  );
  factory SensorEvent.reading(
    GlucoseReading reading, {
    SensorSession? session,
  }) => SensorEvent(
    status: SensorConnectionStatus.readingAvailable,
    reading: reading,
    session: session,
    connected: true,
  );
  factory SensorEvent.disconnected() => const SensorEvent(
    status: SensorConnectionStatus.disconnected,
    connected: false,
  );
  factory SensorEvent.failure(SensorFailure failure) => SensorEvent(
    status: SensorConnectionStatus.error,
    failure: failure,
    connected: false,
  );
}
