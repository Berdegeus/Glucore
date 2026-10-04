import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/core/api/api_client.dart';
import 'package:glucore/core/api/auth_token_store.dart';
import 'package:glucore/core/session/session_expiry_notifier.dart';

/// A-01: the app talks only to the gateway, which serves everything under
/// `/api/v1`. The prefix lives in the Dio `baseUrl` and nowhere else, so every
/// datasource path (`/auth/login`, `/me`, `/carbs/item`...) stays relative.
void main() {
  group('gatewayBaseUrl', () {
    test('appends the /api/v1 prefix to the host', () {
      expect(gatewayBaseUrl('http://192.168.1.10:3000'),
          'http://192.168.1.10:3000/api/v1');
    });

    test('tolerates trailing slashes and surrounding whitespace', () {
      expect(gatewayBaseUrl('http://10.0.2.2:3000/'),
          'http://10.0.2.2:3000/api/v1');
      expect(gatewayBaseUrl(' http://10.0.2.2:3000// '),
          'http://10.0.2.2:3000/api/v1');
    });
  });

  group('ApiClient request URLs', () {
    late _RecordingAdapter adapter;
    late Dio dio;

    setUp(() {
      adapter = _RecordingAdapter();
      dio = ApiClient.create(_FakeTokenStore(), SessionExpiryNotifier())
        ..httpClientAdapter = adapter;
    });

    // One entry per gateway route the app reaches: every one must land under
    // /api/v1 with the path the datasources actually use.
    final calls = <String, Future<Object?> Function(Dio)>{
      '/api/v1/auth/login': (d) => d.post<void>('/auth/login'),
      '/api/v1/auth/register': (d) => d.post<void>('/auth/register'),
      '/api/v1/auth/status': (d) => d.get<void>('/auth/status'),
      '/api/v1/auth/forgot-password': (d) =>
          d.post<void>('/auth/forgot-password'),
      '/api/v1/auth/reset-password': (d) =>
          d.post<void>('/auth/reset-password'),
      '/api/v1/me': (d) => d.get<void>('/me'),
      '/api/v1/account': (d) => d.delete<void>('/account'),
      '/api/v1/readings': (d) => d.get<void>('/readings'),
      '/api/v1/carbs/item/abc': (d) => d.put<void>('/carbs/item/abc'),
      '/api/v1/insulin/item': (d) => d.post<void>('/insulin/item'),
      '/api/v1/alerts/item/abc': (d) => d.delete<void>('/alerts/item/abc'),
      '/api/v1/settings/alerts': (d) => d.get<void>('/settings/alerts'),
    };

    calls.forEach((expectedPath, call) {
      test('reaches $expectedPath', () async {
        await call(dio);
        expect(adapter.lastUri!.path, expectedPath);
      });
    });
  });
}

class _RecordingAdapter implements HttpClientAdapter {
  Uri? lastUri;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    lastUri = options.uri;
    return ResponseBody.fromString(
      jsonEncode(<String, Object?>{}),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

class _FakeTokenStore extends AuthTokenStore {
  _FakeTokenStore() : super(const FlutterSecureStorage());

  @override
  Future<String?> read() async => 'stored-jwt';

  @override
  Future<void> write(String token) async {}

  @override
  Future<void> delete() async {}
}
