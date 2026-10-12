import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';

import '../../../../core/api/auth_token_store.dart';
import '../../domain/entities/patient_entities.dart';
import '../../domain/daily_summary.dart';
import '../../domain/reading_decimation.dart';
import '../../domain/repositories/patient_repository.dart';
import '../datasources/patient_datasource.dart';
import '../datasources/patient_local_datasource.dart';
import 'pending_op.dart';

/// Empurra o que está pendente no banco local para o backend.
///
/// - `schedulePush()`: debounce (~2 s) — várias escritas seguidas viram um
///   único push. Fire-and-forget; falha de rede é silenciosa (fica pendente).
/// - `pushNow()`: push imediato, serializado (nunca há dois pushes em voo);
///   retorna `false` se sobrou pendência após os retries.
/// - Reagenda automaticamente quando a conectividade volta.
///
/// Leituras saem decimadas a 5 min e só dos intervalos fechados; o que sobra
/// pendente (o intervalo em curso) não faz `pushNow` retornar `false`.
///
/// Dois caminhos convivem: as mutações de diário (carbs, insulin, alerts) saem
/// como operações unitárias, drenadas do op-log em ordem de `seq`; leituras e
/// thresholds continuam no replace-all de coleção com debounce (SYNC-10).
class PatientSyncService {
  PatientSyncService({
    required LocalPatientDataSource local,
    required PatientRemoteApi remote,
    AuthTokenStore? tokenStore,
    Stream<List<ConnectivityResult>>? connectivityChanges,
    Duration debounce = const Duration(seconds: 2),
    List<Duration> retryDelays = const [
      Duration(seconds: 1),
      Duration(seconds: 4),
    ],
    DateTime Function() clock = DateTime.now,
    DayCutter dayCutter = const DeviceDayCutter(),
  })  : _local = local,
        _remote = remote,
        _tokenStore = tokenStore,
        _debounce = debounce,
        _retryDelays = retryDelays,
        _clock = clock,
        _dayCutter = dayCutter {
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
  final PatientRemoteApi _remote;
  final AuthTokenStore? _tokenStore;
  final Duration _debounce;
  final List<Duration> _retryDelays;
  final DateTime Function() _clock;
  final DayCutter _dayCutter;

  /// O dia em curso muda a cada leitura; recalculá-lo e reenviá-lo a cada uma
  /// seria um PUT por minuto. Os dias já passados não esperam.
  static const _openDaySummaryInterval = Duration(minutes: 30);

  /// Quantas operações são lidas da fila por vez; a drenagem segue enquanto
  /// vier lote cheio.
  static const _opBatchSize = 100;

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
      } on PatientUnauthorizedException {
        // Sessão recusada: repetir daria o mesmo 401. Para o push e deixa a
        // fila intacta para quando a sessão voltar.
        return false;
      } catch (_) {
        if (attempt < _retryDelays.length) {
          await Future<void>.delayed(_retryDelays[attempt]);
        }
      }
    }
    return false;
  }

  Future<void> _pushPending() async {
    // Never push another account's data (P19). With no valid session
    // (logged out → token gone) or a local owner that differs from the current
    // user, the local rows stay pending until the right user is back.
    if (_tokenStore != null) {
      final current = await _tokenStore.readUserId();
      final owner = await _local.getOwner();
      if (current == null || owner != current) {
        return;
      }
    }
    await _drainOps();

    final pending = await _local.pendingCollections();
    final pushesReadings = pending.contains(PatientCollection.readings);
    final pushesSettings = pending.contains(PatientCollection.settings);

    if (pushesReadings) {
      await _pushReadings();
    }
    if (pushesSettings) {
      final snapshot = await _local.load();
      await _remote.saveAlertSettings(snapshot.alertSettings);
      await _local.markSettingsSynced();
    }

    await _pushDailySummaries();
  }

  /// Refaz o resumo dos dias cujas leituras mudaram e envia os que o servidor
  /// ainda não confirmou.
  ///
  /// O resumo é o que leva ao painel a resolução de 1/min que as leituras
  /// enviadas (5 min) não têm. É um complemento: uma falha aqui — servidor que
  /// ainda não tem a rota, rede, payload recusado — **não derruba o push** nem
  /// impede o pull de leituras. O que não subiu continua pendente e é tentado de
  /// novo no próximo push. Só a sessão recusada (401) sobe, como em todo envio.
  Future<void> _pushDailySummaries() async {
    try {
      await _recomputeDirtySummaries();
      final pending = await _local.pendingDailySummaries();
      for (var start = 0; start < pending.length; start += dailySummaryPushBatchSize) {
        final end = start + dailySummaryPushBatchSize < pending.length
            ? start + dailySummaryPushBatchSize
            : pending.length;
        final batch = pending.sublist(start, end);
        await _remote.saveDailySummaries(batch);
        await _local.markDailySummariesSynced(batch);
      }
    } on PatientUnauthorizedException {
      rethrow;
    } catch (error) {
      debugPrint('Resumo diário não enviado (fica pendente): $error');
    }
  }

  Future<void> _recomputeDirtySummaries() async {
    final now = _clock();
    final today = _dayCutter.keyOf(now);
    for (final day in await _local.dirtySummaryDays()) {
      if (day == today) {
        final computedAt = await _local.dailySummaryComputedAtMs(day);
        if (computedAt != null &&
            now.millisecondsSinceEpoch - computedAt <
                _openDaySummaryInterval.inMilliseconds) {
          continue;
        }
      }
      final summary =
          summarizeDay(day, await _local.readingsOnLocalDay(day), _dayCutter);
      if (summary == null) {
        await _local.clearSummaryDirty(day);
      } else {
        await _local.saveDailySummary(summary, nowMs: now.millisecondsSinceEpoch);
      }
    }
  }

  /// Envia as leituras pendentes **ralas**: uma por intervalo de 5 min já
  /// fechado (ver `reading_decimation.dart`). O banco local segue a 1/min.
  ///
  /// Em lotes que o backend aceita inteiros (ele rejeita, não trunca). Cada lote
  /// é marcado ao ser confirmado — todas as leituras locais que as suas linhas
  /// representam, não só a enviada: se um lote falhar, os anteriores não são
  /// reenviados e os demais seguem pendentes. As leituras do intervalo em curso
  /// também seguem pendentes; saem quando ele fechar.
  Future<void> _pushReadings() async {
    final pending = await _local.pendingReadings();
    if (pending.isEmpty) return;

    final pendingMs = [
      for (final reading in pending) reading.timestamp.millisecondsSinceEpoch,
    ]..sort();
    final local = await _local.readingsBetween(
      readingSlotStart(pendingMs.first),
      readingSlotStart(pendingMs.last) +
          readingUploadSlot.inMilliseconds,
    );

    final uploads =
        planReadingUpload(pending: pending, local: local, now: _clock());
    const size = PatientRepository.readingPushBatchSize;
    for (var start = 0; start < uploads.length; start += size) {
      final end = start + size < uploads.length ? start + size : uploads.length;
      final batch = uploads.sublist(start, end);
      await _remote.saveReadings([for (final u in batch) u.reading]);
      await _local.markReadingKeysSynced(
        [for (final u in batch) ...u.coveredKeys],
      );
    }
  }

  /// Drena o op-log em ordem de `seq`, parando na primeira falha recuperável.
  ///
  /// A operação só sai da fila depois de confirmada (SYNC-09); ao parar, ela e
  /// todas as posteriores ficam onde estão, porque uma op posterior pode
  /// depender da anterior — enviar fora de ordem gravaria estado errado
  /// (SYNC-03/SYNC-04).
  Future<void> _drainOps() async {
    while (true) {
      final ops = await _local.pendingOps(limit: _opBatchSize);
      if (ops.isEmpty) {
        return;
      }
      for (final op in ops) {
        await _sendOp(op);
        await _local.deleteOp(op.seq!);
      }
      if (ops.length < _opBatchSize) {
        return;
      }
    }
  }

  /// Envia uma operação. Erro recuperável sobe (a fila é preservada); erro
  /// definitivo — entidade desconhecida, verbo desconhecido ou payload
  /// ilegível — é logado e a operação segue para o descarte (SYNC-05/SYNC-08).
  Future<void> _sendOp(PendingOp op) async {
    if (op.op == PendingOpKind.delete) {
      switch (op.entity) {
        case PendingOpEntity.carbs:
          return _remote.deleteCarb(op.entityId);
        case PendingOpEntity.insulin:
          return _remote.deleteInsulin(op.entityId);
        case PendingOpEntity.alerts:
          return _remote.deleteAlert(op.entityId);
        default:
          return _discard(op, 'entidade desconhecida');
      }
    }

    if (op.op != PendingOpKind.upsert) {
      return _discard(op, 'operação desconhecida "${op.op}"');
    }

    final payload = op.decodePayload();
    if (payload == null) {
      return _discard(op, 'payload ilegível');
    }

    switch (op.entity) {
      case PendingOpEntity.carbs:
        return _remote.upsertCarb(CarbEntry.fromJson(payload));
      case PendingOpEntity.insulin:
        return _remote.upsertInsulin(InsulinEntry.fromJson(payload));
      case PendingOpEntity.alerts:
        return _remote.upsertAlert(AppAlertItem.fromJson(payload));
      default:
        return _discard(op, 'entidade desconhecida');
    }
  }

  void _discard(PendingOp op, String reason) {
    debugPrint(
      'PatientSyncService: operação descartada — '
      'entidade=${op.entity} id=${op.entityId} motivo=$reason',
    );
  }
}
