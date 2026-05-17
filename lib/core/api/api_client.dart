import 'package:dio/dio.dart';

import 'auth_token_store.dart';

// Pass --dart-define=API_URL=http://<machine-ip>:3001 when building/running.
// Example: flutter run --dart-define=API_URL=http://192.168.1.100:3001
const _baseUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'http://localhost:3001',
);

class ApiClient {
  ApiClient._();

  static Dio create(AuthTokenStore tokenStore) {
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
      ),
    );

    return dio;
  }
}
