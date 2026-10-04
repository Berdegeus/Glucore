import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/auth/data/datasources/account_service.dart';

/// A-01: profile, e-mail and password go through the gateway's composed
/// `/me`, and account deletion through `/account` (both under `/api/v1`, which
/// the Dio `baseUrl` supplies).
void main() {
  late _RecordingAdapter adapter;
  late AccountService service;

  void build({Object? body = const <String, Object?>{}, int status = 200}) {
    adapter = _RecordingAdapter(body, status);
    final dio = Dio(BaseOptions(baseUrl: 'http://localhost:3000/api/v1'))
      ..httpClientAdapter = adapter;
    service = AccountService(dio);
  }

  test('fetchProfile reads GET /me and parses the composed patient block',
      () async {
    build(body: {
      'email': 'ana@glucore.app',
      'fullName': 'Ana Silva',
      'phone': '11988887777',
      'createdAt': '2026-08-01T10:00:00.000Z',
      'patient': {
        'birthDate': '1990-04-23',
        'diabetesType': 'TYPE_1',
        'weightKg': 68.5,
        'targetRangeMin': 70,
        'targetRangeMax': 160,
      },
    });

    final profile = await service.fetchProfile();

    expect(adapter.last.method, 'GET');
    expect(adapter.last.uri.path, '/api/v1/me');
    expect(profile.fullName, 'Ana Silva');
    expect(profile.diabetesType, 'TYPE_1');
    expect(profile.weightKg, 68.5);
    expect(profile.targetRangeMin, 70);
    expect(profile.targetRangeMax, 160);
  });

  test('fetchProfile falls back to 80/180 when the patient block is the default',
      () async {
    build(body: {
      'email': 'ana@glucore.app',
      'fullName': 'Ana Silva',
      'patient': {'targetRangeMin': 80, 'targetRangeMax': 180},
    });

    final profile = await service.fetchProfile();

    expect(profile.targetRangeMin, 80);
    expect(profile.targetRangeMax, 180);
    expect(profile.birthDate, isNull);
  });

  test('updateProfile sends account and patient fields to PUT /me', () async {
    build();

    await service.updateProfile(
      fullName: 'Ana Silva',
      birthDate: DateTime(1990, 4, 23),
      weightKg: 68.5,
      targetRangeMin: 70,
      targetRangeMax: 160,
      diabetesType: 'TYPE_1',
      phone: '11988887777',
    );

    expect(adapter.last.method, 'PUT');
    expect(adapter.last.uri.path, '/api/v1/me');
    final sent = adapter.last.data as Map<String, dynamic>;
    expect(sent['fullName'], 'Ana Silva');
    expect(sent['birthDate'], '1990-04-23');
    expect(sent['targetRangeMax'], 160);
  });

  test('changeEmail and changePassword use the PUT /me body the gateway splits',
      () async {
    build();

    await service.changeEmail(currentPassword: 'old', newEmail: 'a@b.co');
    expect(adapter.last.uri.path, '/api/v1/me');
    expect(adapter.last.data,
        {'currentPassword': 'old', 'newEmail': 'a@b.co'});

    await service.changePassword(currentPassword: 'old', newPassword: 'New1!aaa');
    expect(adapter.last.method, 'PUT');
    expect(adapter.last.data,
        {'currentPassword': 'old', 'newPassword': 'New1!aaa'});
  });

  test('deleteAccount calls DELETE /account', () async {
    build(status: 204, body: '');

    await service.deleteAccount();

    expect(adapter.last.method, 'DELETE');
    expect(adapter.last.uri.path, '/api/v1/account');
  });

  test('a 401 INVALID_CURRENT_PASSWORD from PUT /me reaches the caller intact',
      () async {
    build(status: 401, body: {
      'error': 'Invalid current password',
      'code': 'INVALID_CURRENT_PASSWORD',
    });

    await expectLater(
      service.changePassword(currentPassword: 'x', newPassword: 'y'),
      throwsA(isA<DioException>().having(
        (e) => (e.response?.data as Map)['code'],
        'code',
        'INVALID_CURRENT_PASSWORD',
      )),
    );
  });
}

class _RecordingAdapter implements HttpClientAdapter {
  _RecordingAdapter(this._body, this._status);

  final Object? _body;
  final int _status;
  late RequestOptions last;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    last = options;
    return ResponseBody.fromString(
      _body is String ? _body : jsonEncode(_body),
      _status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}
