import 'package:dio/dio.dart';

import '../../domain/entities/patient_entities.dart';
import 'patient_datasource.dart';

/// Datasource remoto: espelha os dados do paciente no backend via REST.
///
/// POST de coleções é replace-all no servidor (ver docs/reference/backend.md);
/// a fonte primária do app é o [LocalPatientDataSource] — este datasource é
/// usado pelo `PatientSyncService` (push) e pelo refresh em background (pull).
///
/// As mutações de diário viajam pelas chamadas por item (`upsert*`/`delete*`),
/// que o `PatientSyncService` dispara ao drenar o op-log; o replace-all sobra
/// para leituras e thresholds (SYNC-10).
class RemotePatientDataSource implements PatientRemoteApi {
  const RemotePatientDataSource(this._dio);

  final Dio _dio;

  /// Linhas por página de `GET /readings`; é o teto do servidor
  /// (`MAX_READ_ROWS`), então uma página cheia pode ter mais atrás.
  static const readingPageSize = 5000;

  /// Freio contra um servidor que ignora `before` e devolveria sempre a mesma
  /// página: 20 páginas já são 100 mil leituras.
  static const _maxReadingPages = 20;

  @override
  Future<PatientSnapshot> load() => _load(readingsFrom: null);

  @override
  Future<PatientSnapshot> loadSince(DateTime readingsFrom) =>
      _load(readingsFrom: readingsFrom);

  /// `GET /readings` desde [from], da mais nova para a mais antiga, seguindo o
  /// cursor `before` (a leitura mais antiga da página) enquanto a página vier
  /// cheia. Para quando o cursor não anda: um servidor anterior à paginação
  /// ignora os parâmetros e repetiria a mesma página.
  Future<List<GlucoseReadingItem>> _loadReadingsSince(DateTime from) async {
    final readings = <GlucoseReadingItem>[];
    int? before;
    for (var page = 0; page < _maxReadingPages; page++) {
      final response = await _dio.get<List<dynamic>>(
        '/readings',
        queryParameters: {
          'from': from.millisecondsSinceEpoch,
          'limit': readingPageSize,
          if (before != null) 'before': before,
        },
      );
      final rows = (response.data ?? const <dynamic>[])
          .cast<Map<String, dynamic>>()
          .map(_rowToReading)
          .toList();
      readings.addAll(rows);
      if (rows.length < readingPageSize) break;

      final oldest = rows.last.timestamp.millisecondsSinceEpoch;
      if (before != null && oldest >= before) break;
      before = oldest;
    }
    return readings;
  }

  Future<List<GlucoseReadingItem>> _loadReadingsLegacy() async {
    final response = await _dio.get<List<dynamic>>('/readings');
    return (response.data ?? const <dynamic>[])
        .cast<Map<String, dynamic>>()
        .map(_rowToReading)
        .toList();
  }

  Future<PatientSnapshot> _load({required DateTime? readingsFrom}) async {
    final results = await Future.wait<Object?>([
      readingsFrom == null
          ? _loadReadingsLegacy()
          : _loadReadingsSince(readingsFrom),
      _dio.get<List<dynamic>>('/alerts'),
      _dio.get<List<dynamic>>('/carbs'),
      _dio.get<List<dynamic>>('/insulin'),
      _dio.get<Map<String, dynamic>>('/settings/alerts'),
    ]);

    final readings = results[0] as List<GlucoseReadingItem>;
    final alertRows = (results[1] as Response).data as List<dynamic>;
    final carbRows = (results[2] as Response).data as List<dynamic>;
    final insulinRows = (results[3] as Response).data as List<dynamic>;
    final settingsRow = (results[4] as Response).data as Map<String, dynamic>;

    return PatientSnapshot(
      readings: readings,
      alerts: alertRows
          .cast<Map<String, dynamic>>()
          .map(_rowToAlert)
          .toList(),
      carbs: carbRows
          .cast<Map<String, dynamic>>()
          .map(_rowToCarb)
          .toList(),
      insulin: insulinRows
          .cast<Map<String, dynamic>>()
          .map(_rowToInsulin)
          .toList(),
      alertSettings: AlertSettingsModel(
        lowThreshold: (settingsRow['lowThreshold'] as num).toInt(),
        highThreshold: (settingsRow['highThreshold'] as num).toInt(),
      ),
    );
  }

  @override
  Future<void> saveReadings(List<GlucoseReadingItem> readings) async {
    await _dio.post<void>(
      '/readings',
      data: {'readings': readings.map(_readingToRow).toList()},
    );
  }

  @override
  Future<void> saveAlerts(List<AppAlertItem> alerts) async {
    await _dio.post<void>(
      '/alerts',
      data: {'alerts': alerts.map(_alertToRow).toList()},
    );
  }

  @override
  Future<void> saveCarbs(List<CarbEntry> carbs) async {
    await _dio.post<void>(
      '/carbs',
      data: {'carbs': carbs.map(_carbToRow).toList()},
    );
  }

  @override
  Future<void> saveInsulin(List<InsulinEntry> insulin) async {
    await _dio.post<void>(
      '/insulin',
      data: {'insulin': insulin.map(_insulinToRow).toList()},
    );
  }

  @override
  Future<void> saveAlertSettings(AlertSettingsModel settings) async {
    await _dio.put<void>(
      '/settings/alerts',
      data: {
        'lowThreshold': settings.lowThreshold,
        'highThreshold': settings.highThreshold,
      },
    );
  }

  // ── operações por item (op-log) ───────────────────────────────────────────

  @override
  Future<void> upsertCarb(CarbEntry entry) =>
      _upsertItem('/carbs/item', entry.id, _carbToRow(entry));

  @override
  Future<void> deleteCarb(String id) => _deleteItem('/carbs/item', id);

  @override
  Future<void> upsertInsulin(InsulinEntry entry) =>
      _upsertItem('/insulin/item', entry.id, _insulinToRow(entry));

  @override
  Future<void> deleteInsulin(String id) => _deleteItem('/insulin/item', id);

  @override
  Future<void> upsertAlert(AppAlertItem alert) =>
      _upsertItem('/alerts/item', alert.id, _alertToRow(alert));

  @override
  Future<void> deleteAlert(String id) => _deleteItem('/alerts/item', id);

  /// `PUT …/item/:id`; se o servidor não conhece o id, cria com o MESMO id via
  /// `POST …/item`. É o que torna o reenvio idempotente: o app não precisa
  /// saber se o backend já viu a entrada (SYNC-06).
  Future<void> _upsertItem(
    String path,
    String id,
    Map<String, dynamic> body,
  ) =>
      _guardAuth(() async {
        try {
          await _dio.put<void>('$path/$id', data: body);
        } on DioException catch (error) {
          if (error.response?.statusCode != 404) {
            rethrow;
          }
          await _dio.post<void>(path, data: body);
        }
      });

  /// `DELETE …/item/:id`; 404 é sucesso — a entrada já não existe lá, que é
  /// exatamente o estado pedido pela operação.
  Future<void> _deleteItem(String path, String id) => _guardAuth(() async {
        try {
          await _dio.delete<void>('$path/$id');
        } on DioException catch (error) {
          if (error.response?.statusCode != 404) {
            rethrow;
          }
        }
      });

  /// Traduz 401 para [PatientUnauthorizedException], que a drenagem reconhece
  /// como "pare o push e preserve a fila" em vez de tentar de novo.
  Future<void> _guardAuth(Future<void> Function() call) async {
    try {
      await call();
    } on DioException catch (error) {
      if (error.response?.statusCode == 401) {
        throw const PatientUnauthorizedException();
      }
      rethrow;
    }
  }

  // ── mappers ───────────────────────────────────────────────────────────────

  static GlucoseReadingItem _rowToReading(Map<String, dynamic> r) =>
      GlucoseReadingItem(
        value: (r['value'] as num).toDouble(),
        timestamp: DateTime.fromMillisecondsSinceEpoch((r['timestampMs'] as num).toInt()),
        trend: GlucoseTrend.values.byName(r['trend'] as String),
        rate: (r['rate'] as num).toDouble(),
        alarmCode: r['alarmCode'] as int?,
      );

  static Map<String, dynamic> _readingToRow(GlucoseReadingItem r) => {
        'value': r.value,
        'timestampMs': r.timestamp.millisecondsSinceEpoch,
        'trend': r.trend.name,
        'rate': r.rate,
        'alarmCode': r.alarmCode,
      };

  // As três coleções do diário viajam com `id` (IDENT-06): o contrato de linha
  // do backend é o mesmo `toJson`/`fromJson` da entidade, então o mapeamento
  // delega a ele — inclusive a regra de gerar id local quando o servidor manda
  // um id ausente ou malformado.

  static AppAlertItem _rowToAlert(Map<String, dynamic> r) =>
      AppAlertItem.fromJson(r);

  static Map<String, dynamic> _alertToRow(AppAlertItem a) => a.toJson();

  static CarbEntry _rowToCarb(Map<String, dynamic> r) => CarbEntry.fromJson(r);

  static Map<String, dynamic> _carbToRow(CarbEntry c) => c.toJson();

  static InsulinEntry _rowToInsulin(Map<String, dynamic> r) =>
      InsulinEntry.fromJson(r);

  static Map<String, dynamic> _insulinToRow(InsulinEntry i) => i.toJson();
}
