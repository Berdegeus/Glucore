import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/patient/data/datasources/patient_remote_datasource.dart';
import 'package:glucore/features/patient/presentation/models/patient_models.dart';

/// Adaptador Dio dublê: devolve o corpo configurado por caminho e guarda o que
/// foi enviado.
class _StubAdapter implements HttpClientAdapter {
  _StubAdapter(this.bodies);

  final Map<String, Object?> bodies;
  final requests = <RequestOptions>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return ResponseBody.fromString(
      jsonEncode(bodies[options.path] ?? const <dynamic>[]),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  final uuidV4 = RegExp(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
  );

  const carbId = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
  const insulinId = '9c858901-8a57-4791-81fe-4c455b099bc9';
  const alertId = 'b1e0f1b0-7c4a-4b3e-8a2d-5c9f6d2e1a77';
  final t0 = DateTime.fromMillisecondsSinceEpoch(1700000000000);

  late _StubAdapter adapter;
  late RemotePatientDataSource remote;

  void buildWith(Map<String, Object?> bodies) {
    adapter = _StubAdapter(bodies);
    final dio = Dio(BaseOptions(baseUrl: 'http://localhost:3001'))
      ..httpClientAdapter = adapter;
    remote = RemotePatientDataSource(dio);
  }

  Map<String, Object?> defaultBodies({
    List<Map<String, Object?>>? carbs,
    List<Map<String, Object?>>? insulin,
    List<Map<String, Object?>>? alerts,
  }) =>
      {
        '/readings': const <dynamic>[],
        '/alerts': alerts ?? const <dynamic>[],
        '/carbs': carbs ?? const <dynamic>[],
        '/insulin': insulin ?? const <dynamic>[],
        '/settings/alerts': {'lowThreshold': 80, 'highThreshold': 180},
      };

  Map<String, dynamic> sentBody(String path) => adapter.requests
      .firstWhere((r) => r.path == path)
      .data as Map<String, dynamic>;

  group('IDENT-06: envio carrega o id', () {
    test('saveCarbs envia o id da entrada', () async {
      buildWith(defaultBodies());
      final entry =
          CarbEntry(id: carbId, grams: 45, description: 'Almoço', time: t0);

      await remote.saveCarbs([entry]);

      final rows = sentBody('/carbs')['carbs'] as List<dynamic>;
      expect(rows, hasLength(1));
      expect((rows.first as Map)['id'], carbId);
      expect((rows.first as Map)['grams'], 45);
      expect((rows.first as Map)['timeMs'], t0.millisecondsSinceEpoch);
    });

    test('saveInsulin envia o id da entrada', () async {
      buildWith(defaultBodies());
      final entry = InsulinEntry(
        id: insulinId,
        units: 4.5,
        type: InsulinType.bolus,
        time: t0,
        dayOfWeek: kDaysOfWeek[2],
      );

      await remote.saveInsulin([entry]);

      final rows = sentBody('/insulin')['insulin'] as List<dynamic>;
      expect(rows, hasLength(1));
      expect((rows.first as Map)['id'], insulinId);
      expect((rows.first as Map)['units'], 4.5);
    });

    test('saveAlerts envia o id do alerta', () async {
      buildWith(defaultBodies());
      final alert = AppAlertItem(
        id: alertId,
        type: AppAlertType.glucoseLow,
        timestamp: t0,
      );

      await remote.saveAlerts([alert]);

      final rows = sentBody('/alerts')['alerts'] as List<dynamic>;
      expect(rows, hasLength(1));
      expect((rows.first as Map)['id'], alertId);
      expect((rows.first as Map)['type'], 'glucoseLow');
    });
  });

  group('IDENT-06: leitura usa o id do servidor', () {
    test('load materializa carbs, insulin e alerts com o id devolvido',
        () async {
      buildWith(defaultBodies(
        carbs: [
          {
            'id': carbId,
            'grams': 45,
            'description': 'Almoço',
            'timeMs': t0.millisecondsSinceEpoch,
          }
        ],
        insulin: [
          {
            'id': insulinId,
            'units': 4.5,
            'type': 'bolus',
            'timeMs': t0.millisecondsSinceEpoch,
            'dayOfWeek': kDaysOfWeek[2],
          }
        ],
        alerts: [
          {
            'id': alertId,
            'type': 'glucoseLow',
            'timestampMs': t0.millisecondsSinceEpoch,
          }
        ],
      ));

      final snapshot = await remote.load();

      expect(snapshot.carbs.single.id, carbId);
      expect(snapshot.carbs.single.grams, 45);
      expect(snapshot.insulin.single.id, insulinId);
      expect(snapshot.insulin.single.units, 4.5);
      expect(snapshot.alerts.single.id, alertId);
      expect(snapshot.alerts.single.type, AppAlertType.glucoseLow);
    });

    test('round-trip: o id enviado é o id materializado de volta', () async {
      final entry =
          CarbEntry.create(grams: 30, description: 'Lanche', time: t0);
      buildWith(defaultBodies(carbs: [entry.toJson()]));

      await remote.saveCarbs([entry]);
      final snapshot = await remote.load();

      final sent =
          (sentBody('/carbs')['carbs'] as List<dynamic>).first as Map;
      expect(sent['id'], entry.id);
      expect(snapshot.carbs.single.id, entry.id);
    });
  });

  group('IDENT-06: resposta sem id válido recebe id local', () {
    test('entrada remota sem id ganha um UUID v4 local', () async {
      buildWith(defaultBodies(
        carbs: [
          {
            'grams': 20,
            'description': 'Fruta',
            'timeMs': t0.millisecondsSinceEpoch,
          }
        ],
        alerts: [
          {
            'type': 'glucoseHigh',
            'timestampMs': t0.millisecondsSinceEpoch,
          }
        ],
      ));

      final snapshot = await remote.load();

      expect(snapshot.carbs.single.id, matches(uuidV4));
      expect(snapshot.carbs.single.description, 'Fruta');
      expect(snapshot.alerts.single.id, matches(uuidV4));
      expect(snapshot.alerts.single.type, AppAlertType.glucoseHigh);
    });

    test('entrada remota com id malformado ganha um UUID v4 local', () async {
      buildWith(defaultBodies(
        insulin: [
          {
            'id': 'not-a-uuid',
            'units': 2,
            'type': 'basal',
            'timeMs': t0.millisecondsSinceEpoch,
            'dayOfWeek': kDaysOfWeek[0],
          }
        ],
      ));

      final snapshot = await remote.load();

      expect(snapshot.insulin.single.id, isNot('not-a-uuid'));
      expect(snapshot.insulin.single.id, matches(uuidV4));
      expect(snapshot.insulin.single.units, 2);
    });
  });
}
