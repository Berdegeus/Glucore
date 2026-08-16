import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/core/api/api_client.dart';
import 'package:glucore/core/api/auth_token_store.dart';
import 'package:glucore/core/session/session_expiry_notifier.dart';

/// Spec: TCC-12 — spec.md P2 (autorização) AC5, AC7, AC8 and the edge case
/// "várias requisições recebem 401 TOKEN_INVALID simultaneamente".
///
/// The P18 guarantee is the sharp edge here: only an HTTP 401 carrying
/// `code: TOKEN_INVALID` ends the session. No response at all (offline) must
/// leave the token and the session untouched.
void main() {
  group('SessionExpiryNotifier', () {
    test('signal notifies once however many times it is called', () {
      final notifier = SessionExpiryNotifier();
      addTearDown(notifier.dispose);
      var notifications = 0;
      notifier.addListener(() => notifications++);

      notifier.signal();
      notifier.signal();
      notifier.signal();

      expect(notifications, 1);
      expect(notifier.expired, isTrue);
    });

    test('reset clears the latch so the next session can signal again', () {
      final notifier = SessionExpiryNotifier();
      addTearDown(notifier.dispose);
      var notifications = 0;
      notifier.addListener(() => notifications++);

      notifier.signal();
      notifier.reset();
      expect(notifier.expired, isFalse);
      notifier.signal();

      expect(notifications, 2);
    });
  });

  group('ApiClient 401 interceptor', () {
    late _FakeTokenStore tokenStore;
    late SessionExpiryNotifier notifier;
    late int notifications;
    late Dio dio;

    void arrange(_FakeAdapter adapter) {
      dio = ApiClient.create(tokenStore, notifier);
      dio.httpClientAdapter = adapter;
    }

    setUp(() {
      tokenStore = _FakeTokenStore();
      notifier = SessionExpiryNotifier();
      addTearDown(notifier.dispose);
      notifications = 0;
      notifier.addListener(() => notifications++);
    });

    test('401 TOKEN_INVALID clears the token and signals expiry', () async {
      arrange(_FakeAdapter.json(401, {
        'error': 'Invalid token',
        'code': 'TOKEN_INVALID',
      }));

      await expectLater(
        dio.get<void>('/readings'),
        throwsA(isA<DioException>()),
      );

      expect(tokenStore.token, isNull);
      expect(notifier.expired, isTrue);
      expect(notifications, 1);
    });

    test('401 INVALID_CURRENT_PASSWORD keeps the token and the session',
        () async {
      arrange(_FakeAdapter.json(401, {
        'error': 'Invalid current password',
        'code': 'INVALID_CURRENT_PASSWORD',
      }));

      await expectLater(
        dio.put<void>('/auth/profile'),
        throwsA(isA<DioException>()),
      );

      expect(tokenStore.token, 'stored-jwt');
      expect(notifier.expired, isFalse);
      expect(notifications, 0);
    });

    test('a connection error with no HTTP response keeps the session (P18)',
        () async {
      arrange(_FakeAdapter.connectionError());

      await expectLater(
        dio.get<void>('/auth/status'),
        throwsA(isA<DioException>()),
      );

      expect(tokenStore.token, 'stored-jwt');
      expect(notifier.expired, isFalse);
      expect(notifications, 0);
    });

    test('a 503 DATABASE_UNAVAILABLE does not end the session', () async {
      arrange(_FakeAdapter.json(503, {
        'error': 'Database unavailable',
        'code': 'DATABASE_UNAVAILABLE',
      }));

      await expectLater(
        dio.get<void>('/readings'),
        throwsA(isA<DioException>()),
      );

      expect(tokenStore.token, 'stored-jwt');
      expect(notifier.expired, isFalse);
      expect(notifications, 0);
    });

    test('four requests failing together produce a single expiry signal',
        () async {
      arrange(_FakeAdapter.json(401, {
        'error': 'Invalid token',
        'code': 'TOKEN_INVALID',
      }));

      final results = await Future.wait([
        for (var i = 0; i < 4; i++)
          dio.get<void>('/readings').then<bool>((_) => true).catchError(
                (Object _) => false,
              ),
      ]);

      expect(results, everyElement(isFalse));
      expect(notifications, 1);
    });
  });
}

class _FakeTokenStore extends AuthTokenStore {
  _FakeTokenStore() : super(const FlutterSecureStorage());

  String? token = 'stored-jwt';

  @override
  Future<String?> read() async => token;

  @override
  Future<void> write(String token) async => this.token = token;

  @override
  Future<void> delete() async => token = null;
}

/// Serves a canned response (or a connection failure) without any socket.
class _FakeAdapter implements HttpClientAdapter {
  _FakeAdapter.json(this._statusCode, Map<String, Object?> body)
      : _body = jsonEncode(body),
        _fail = false;

  _FakeAdapter.connectionError()
      : _statusCode = 0,
        _body = '',
        _fail = true;

  final int _statusCode;
  final String _body;
  final bool _fail;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    if (_fail) {
      throw DioException.connectionError(
        requestOptions: options,
        reason: 'backend unreachable',
      );
    }
    return ResponseBody.fromString(
      _body,
      _statusCode,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}
