import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/patient/data/datasources/patient_remote_datasource.dart';
import 'package:glucore/features/patient/data/datasources/patient_datasource.dart';
import 'package:glucore/features/patient/domain/glucose_bucket.dart';
import 'package:glucore/features/patient/domain/entities/patient_entities.dart';

/// Adaptador Dio dublê: devolve o corpo configurado por caminho e guarda o que
/// foi enviado.
class _StubAdapter implements HttpClientAdapter {
  _StubAdapter(this.bodies, {this.statuses = const {}});

  final Map<String, Object?> bodies;

  /// Status por requisição, na chave `'MÉTODO caminho'`; ausente = 200.
  final Map<String, int> statuses;
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
      statuses['${options.method} ${options.path}'] ?? 200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

/// Servidor dublê de `GET /readings`: respeita `from` (inclusivo), `before`
/// (exclusivo) e `limit`, do mais novo ao mais antigo — como o glucose-service.
/// Com [honoursPaging] falso se comporta como o servidor anterior à paginação:
/// ignora os parâmetros e devolve sempre as `limit` mais novas.
class _ReadingsServer implements HttpClientAdapter {
  _ReadingsServer(this.timestamps, {this.honoursPaging = true});

  /// Todos os instantes que o servidor tem, em ms.
  final List<int> timestamps;
  final bool honoursPaging;
  final readingRequests = <Map<String, dynamic>>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    Object body = const <dynamic>[];
    if (options.path == '/readings') {
      readingRequests.add(Map.of(options.queryParameters));
      final q = options.queryParameters;
      final limit = honoursPaging ? (q['limit'] as int? ?? 5000) : 5000;
      final from = honoursPaging ? (q['from'] as int?) : null;
      final before = honoursPaging ? (q['before'] as int?) : null;
      final rows = (timestamps.toList()..sort((a, b) => b.compareTo(a)))
          .where((t) => from == null || t >= from)
          .where((t) => before == null || t < before)
          .take(limit)
          .map((t) => {
                'value': 100,
                'timestampMs': t,
                'trend': 'stable',
                'rate': 0,
                'alarmCode': null,
              })
          .toList();
      body = rows;
    } else if (options.path == '/settings/alerts') {
      body = {'lowThreshold': 80, 'highThreshold': 180};
    }
    return ResponseBody.fromString(
      jsonEncode(body),
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

  void buildWith(Map<String, Object?> bodies, {Map<String, int> statuses = const {}}) {
    adapter = _StubAdapter(bodies, statuses: statuses);
    final dio = Dio(BaseOptions(baseUrl: 'http://localhost:3000/api/v1'))
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

  group('SYNC-06/API-01: chamadas por item', () {
    final carb =
        CarbEntry(id: carbId, grams: 45, description: 'Almoço', time: t0);
    final insulin = InsulinEntry(
      id: insulinId,
      units: 4.5,
      type: InsulinType.bolus,
      time: t0,
      dayOfWeek: kDaysOfWeek[2],
    );
    final alert = AppAlertItem(
      id: alertId,
      type: AppAlertType.glucoseLow,
      timestamp: t0,
    );

    List<String> calls() =>
        adapter.requests.map((r) => '${r.method} ${r.path}').toList();

    test('upsertCarb manda PUT no id com o corpo da entrada', () async {
      buildWith(defaultBodies(), statuses: {'PUT /carbs/item/$carbId': 204});

      await remote.upsertCarb(carb);

      expect(calls(), ['PUT /carbs/item/$carbId']);
      final body = adapter.requests.single.data as Map<String, dynamic>;
      expect(body['id'], carbId);
      expect(body['grams'], 45);
      expect(body['timeMs'], t0.millisecondsSinceEpoch);
    });

    test('upsertInsulin e upsertAlert usam o caminho da própria entidade',
        () async {
      buildWith(defaultBodies(), statuses: {
        'PUT /insulin/item/$insulinId': 204,
        'PUT /alerts/item/$alertId': 204,
      });

      await remote.upsertInsulin(insulin);
      await remote.upsertAlert(alert);

      expect(calls(), [
        'PUT /insulin/item/$insulinId',
        'PUT /alerts/item/$alertId',
      ]);
      expect(
        (adapter.requests.first.data as Map<String, dynamic>)['units'],
        4.5,
      );
      expect(
        (adapter.requests.last.data as Map<String, dynamic>)['type'],
        'glucoseLow',
      );
    });

    test('PUT com 404 cai para POST criando a entrada com o mesmo id',
        () async {
      buildWith(defaultBodies(), statuses: {
        'PUT /carbs/item/$carbId': 404,
        'POST /carbs/item': 201,
      });

      await remote.upsertCarb(carb);

      expect(calls(), ['PUT /carbs/item/$carbId', 'POST /carbs/item']);
      final created = adapter.requests.last.data as Map<String, dynamic>;
      expect(created['id'], carbId);
      expect(created['grams'], 45);
    });

    test('deleteCarb manda DELETE no id', () async {
      buildWith(defaultBodies(), statuses: {'DELETE /carbs/item/$carbId': 204});

      await remote.deleteCarb(carbId);

      expect(calls(), ['DELETE /carbs/item/$carbId']);
    });

    test('DELETE com 404 é sucesso e não tenta criar nada', () async {
      buildWith(defaultBodies(), statuses: {'DELETE /carbs/item/$carbId': 404});

      await remote.deleteCarb(carbId);

      expect(calls(), ['DELETE /carbs/item/$carbId']);
    });

    test('deleteInsulin e deleteAlert também tratam 404 como sucesso',
        () async {
      buildWith(defaultBodies(), statuses: {
        'DELETE /insulin/item/$insulinId': 404,
        'DELETE /alerts/item/$alertId': 404,
      });

      await remote.deleteInsulin(insulinId);
      await remote.deleteAlert(alertId);

      expect(calls(), [
        'DELETE /insulin/item/$insulinId',
        'DELETE /alerts/item/$alertId',
      ]);
    });

    test('erro que não é 404 propaga em vez de virar sucesso', () async {
      buildWith(defaultBodies(), statuses: {
        'PUT /carbs/item/$carbId': 500,
        'DELETE /carbs/item/$carbId': 500,
      });

      await expectLater(
        remote.upsertCarb(carb),
        throwsA(isA<DioException>()),
      );
      await expectLater(
        remote.deleteCarb(carbId),
        throwsA(isA<DioException>()),
      );
      // O 500 no PUT não pode disparar o POST de criação.
      expect(calls().where((c) => c.startsWith('POST')), isEmpty);
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

  group('loadSince: leituras em páginas desde um instante', () {
    RemotePatientDataSource against(_ReadingsServer server) {
      final dio = Dio(BaseOptions(baseUrl: 'http://localhost:3000/api/v1'))
        ..httpClientAdapter = server;
      return RemotePatientDataSource(dio);
    }

    List<int> minutes(int count) =>
        [for (var i = 0; i < count; i++) 1700000000000 + i * 300000];

    test('pede desde o instante dado, com o limite da página', () async {
      final server = _ReadingsServer(minutes(10));
      final from = DateTime.fromMillisecondsSinceEpoch(1700000000000 + 7 * 300000);

      final snapshot = await against(server).loadSince(from);

      expect(snapshot.readings, hasLength(3));
      expect(server.readingRequests.single, {
        'from': from.millisecondsSinceEpoch,
        'limit': RemotePatientDataSource.readingPageSize,
      });
    });

    test('uma página que não enche é a última', () async {
      final server = _ReadingsServer(minutes(100));

      await against(server).loadSince(DateTime.fromMillisecondsSinceEpoch(0));

      expect(server.readingRequests, hasLength(1));
    });

    test('segue o cursor enquanto a página vem cheia, sem falha nem repetição',
        () async {
      final total = RemotePatientDataSource.readingPageSize * 2 + 123;
      final server = _ReadingsServer(minutes(total));

      final snapshot =
          await against(server).loadSince(DateTime.fromMillisecondsSinceEpoch(0));

      expect(server.readingRequests, hasLength(3));
      final stamps = snapshot.readings.map((r) => r.timestamp.millisecondsSinceEpoch);
      expect(stamps.toSet(), hasLength(total));
      expect(
        server.readingRequests[1]['before'],
        snapshot.readings[RemotePatientDataSource.readingPageSize - 1]
            .timestamp.millisecondsSinceEpoch,
      );
    });

    test('um servidor que ignora a paginação não prende o app num laço', () async {
      final server = _ReadingsServer(
        minutes(RemotePatientDataSource.readingPageSize + 50),
        honoursPaging: false,
      );

      final snapshot =
          await against(server).loadSince(DateTime.fromMillisecondsSinceEpoch(0));

      // A 1ª página é cheia, a 2ª repete a 1ª e o cursor não anda: para.
      expect(server.readingRequests, hasLength(2));
      expect(snapshot.readings, isNotEmpty);
    });

    test('load() sem instante continua pedindo /readings sem parâmetros', () async {
      final server = _ReadingsServer(minutes(5));

      await against(server).load();

      expect(server.readingRequests.single, isEmpty);
    });

    test('o diário e os limiares vêm inteiros, como em load()', () async {
      final server = _ReadingsServer(minutes(1));

      final snapshot =
          await against(server).loadSince(DateTime.fromMillisecondsSinceEpoch(0));

      expect(snapshot.alertSettings.lowThreshold, 80);
      expect(snapshot.alertSettings.highThreshold, 180);
    });
  });

  group('saveGlucoseBuckets', () {
    GlucoseBucket bucket(int startMs) => GlucoseBucket(
          startMs: startMs,
          readingsCount: 3,
          coveredSlots: 2,
          mgDl: const [95, 120],
          counts: const [2, 1],
        );

    test('faz PUT /readings/buckets com {buckets: [...]} no formato do contrato',
        () async {
      buildWith(defaultBodies());

      await remote.saveGlucoseBuckets([bucket(1788609600000), bucket(1788610500000)]);

      final request = adapter.requests.singleWhere((r) => r.path == '/readings/buckets');
      expect(request.method, 'PUT');
      final buckets = (request.data as Map<String, dynamic>)['buckets'] as List<dynamic>;
      expect(buckets, hasLength(2));
      expect(buckets.first, {
        'startMs': 1788609600000,
        'readingsCount': 3,
        'coveredSlots': 2,
        'mgDl': [95, 120],
        'counts': [2, 1],
      });
    });

    test('um 401 vira a exceção que para o push e preserva a fila', () async {
      buildWith(defaultBodies(), statuses: {'PUT /readings/buckets': 401});

      expect(
        remote.saveGlucoseBuckets([bucket(1788609600000)]),
        throwsA(isA<PatientUnauthorizedException>()),
      );
    });

    test('outro erro sobe como está, para o serviço decidir', () async {
      buildWith(defaultBodies(), statuses: {'PUT /readings/buckets': 404});

      expect(remote.saveGlucoseBuckets([bucket(1788609600000)]), throwsA(isA<DioException>()));
    });
  });
}
