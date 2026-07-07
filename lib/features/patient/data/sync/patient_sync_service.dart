import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';

import '../datasources/patient_datasource.dart';
import '../datasources/patient_local_datasource.dart';

/// Empurra as coleções pendentes do banco local para o backend.
///
/// - `schedulePush()`: debounce (~2 s) — várias escritas seguidas viram um
///   único push. Fire-and-forget; falha de rede é silenciosa (fica pendente).
/// - `pushNow()`: push imediato, serializado (nunca há dois pushes em voo);
///   retorna `false` se sobrou pendência após os retries.
/// - Reagenda automaticamente quando a conectividade volta.
///
/// O push usa as chamadas replace-all existentes do backend (coleção inteira);
/// API unitária por item chega na Fase 4 (§P2/§P4).
class PatientSyncService {
  PatientSyncService({
    required LocalPatientDataSource local,
    required PatientDataSource remote,
    Stream<List<ConnectivityResult>>? connectivityChanges,
    Duration debounce = const Duration(seconds: 2),
    List<Duration> retryDelays = const [
      Duration(seconds: 1),
      Duration(seconds: 4),
    ],
  })  : _local = local,
        _remote = remote,
        _debounce = debounce,
        _retryDelays = retryDelays {
    final changes = connectivityChanges ?? Connectivity().onConnectivityChanged;
    _connectivitySubscription = changes.listen((results) {
      final online =
          results.any((result) => result != ConnectivityResult.none);
      if (online && !_disposed) {
        schedulePush();
      }
    });
  }

  final LocalPatientDataSource _local;
  final PatientDataSource _remote;
  final Duration _debounce;
  final List<Duration> _retryDelays;

  StreamSubscription<List<ConnectivityResult>>? _connectivitySubscription;
  Timer? _debounceTimer;
  Future<void> _queue = Future<void>.value();
  bool _disposed = false;

  /// Agenda um push com debounce; chamadas em rajada colapsam num único push.
  void schedulePush() {
    if (_disposed) {
      return;
    }
    _debounceTimer?.cancel();
    _debounceTimer = Timer(_debounce, () => unawaited(pushNow()));
  }

  /// Executa um push imediatamente (aguardando qualquer push em voo).
  /// Retorna `true` se não restou nenhuma coleção pendente.
  Future<bool> pushNow() {
    final result = _queue.then((_) => _pushWithRetry());
    _queue = result.then((_) {});
    return result;
  }

  void dispose() {
    _disposed = true;
    _debounceTimer?.cancel();
    _connectivitySubscription?.cancel();
    _connectivitySubscription = null;
  }

  Future<bool> _pushWithRetry() async {
    for (var attempt = 0; attempt <= _retryDelays.length; attempt++) {
      try {
        await _pushPending();
        return true;
      } catch (_) {
        if (attempt < _retryDelays.length) {
          await Future<void>.delayed(_retryDelays[attempt]);
        }
      }
    }
    return false;
  }

  Future<void> _pushPending() async {
    final pending = await _local.pendingCollections();
    if (pending.isEmpty) {
      return;
    }
    final snapshot = await _local.load();

    if (pending.contains(PatientCollection.readings)) {
      await _remote.saveReadings(snapshot.readings);
      await _local.markReadingsSynced(snapshot.readings);
    }
    if (pending.contains(PatientCollection.alerts)) {
      await _remote.saveAlerts(snapshot.alerts);
      await _local.markAlertsSynced(snapshot.alerts);
    }
    if (pending.contains(PatientCollection.carbs)) {
      await _remote.saveCarbs(snapshot.carbs);
      await _local.markCarbsSynced(snapshot.carbs);
    }
    if (pending.contains(PatientCollection.insulin)) {
      await _remote.saveInsulin(snapshot.insulin);
      await _local.markInsulinSynced(snapshot.insulin);
    }
    if (pending.contains(PatientCollection.settings)) {
      await _remote.saveAlertSettings(snapshot.alertSettings);
      await _local.markSettingsSynced();
    }
  }
}
