import 'package:dio/dio.dart';

import '../../presentation/models/patient_models.dart';
import 'patient_datasource.dart';

/// Datasource remoto: espelha os dados do paciente no backend via REST.
///
/// POST de coleções é replace-all no servidor (ver docs/reference/backend.md);
/// a fonte primária do app é o [LocalPatientDataSource] — este datasource é
/// usado pelo `PatientSyncService` (push) e pelo refresh em background (pull).
class RemotePatientDataSource implements PatientDataSource {
  const RemotePatientDataSource(this._dio);

  final Dio _dio;

  @override
  Future<PatientSnapshot> load() async {
    final results = await Future.wait([
      _dio.get<List<dynamic>>('/readings'),
      _dio.get<List<dynamic>>('/alerts'),
      _dio.get<List<dynamic>>('/carbs'),
      _dio.get<List<dynamic>>('/insulin'),
      _dio.get<Map<String, dynamic>>('/settings/alerts'),
    ]);

    final readingRows = (results[0] as Response).data as List<dynamic>;
    final alertRows = (results[1] as Response).data as List<dynamic>;
    final carbRows = (results[2] as Response).data as List<dynamic>;
    final insulinRows = (results[3] as Response).data as List<dynamic>;
    final settingsRow = (results[4] as Response).data as Map<String, dynamic>;

    return PatientSnapshot(
      readings: readingRows
          .cast<Map<String, dynamic>>()
          .map(_rowToReading)
          .toList(),
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
