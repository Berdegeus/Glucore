import 'package:dio/dio.dart';

import '../session/session_expiry_notifier.dart';
import 'auth_token_store.dart';

// Pass --dart-define=API_URL=http://<machine-ip>:3001 when building/running.
// Example: flutter run --dart-define=API_URL=http://192.168.1.100:3001
const _baseUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'http://localhost:3001',
);

/// Error code the backend returns when the bearer token is missing, malformed
/// or expired. It is the ONLY code that ends the session: `401` alone is not
/// enough, because a wrong current password on `PUT /auth/profile` also answers
/// `401` (code `INVALID_CURRENT_PASSWORD`) and must keep the user signed in.
const _tokenInvalidCode = 'TOKEN_INVALID';

class ApiClient {
  ApiClient._();

  static Dio create(
    AuthTokenStore tokenStore,
    SessionExpiryNotifier sessionExpiry,
  ) {
    final dio = Dio(
      BaseOptions(
        baseUrl: _baseUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 15),
        headers: {'Content-Type': 'application/json'},
      ),
    );

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await tokenStore.read();
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          if (_isInvalidToken(error.response)) {
            await tokenStore.delete();
            sessionExpiry.signal();
          }
          // Always propagated: the screen still gets to show its own error.
          handler.next(error);
        },
      ),
    );

    return dio;
  }

  /// True only for an actual HTTP `401` carrying `code: TOKEN_INVALID`.
  ///
  /// A connection error or timeout has no response at all, so it never reaches
  /// this branch — an unreachable backend must not log the user out (P18).
  static bool _isInvalidToken(Response<dynamic>? response) {
    if (response?.statusCode != 401) return false;
    final data = response!.data;
    return data is Map && data['code'] == _tokenInvalidCode;
  }
}
