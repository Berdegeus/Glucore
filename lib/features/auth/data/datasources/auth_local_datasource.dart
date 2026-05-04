import 'package:dio/dio.dart';

import '../../../../core/api/auth_token_store.dart';

abstract class AuthLocalDataSource {
  Future<bool> login({required String email, required String password});
  Future<bool> register({required String email, required String password});
  Future<void> logout();
  Future<bool> isLoggedIn();
}

class RemoteAuthDataSource implements AuthLocalDataSource {
  const RemoteAuthDataSource(this._dio, this._tokenStore);

  final Dio _dio;
  final AuthTokenStore _tokenStore;

  @override
  Future<bool> register({required String email, required String password}) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/register',
        data: {'email': email, 'password': password},
      );
      await _tokenStore.write(response.data!['token'] as String);
      return true;
    } on DioException catch (e) {
      if (e.response?.statusCode == 409) return false;
      rethrow;
    }
  }

  @override
  Future<bool> login({required String email, required String password}) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/login',
        data: {'email': email, 'password': password},
      );
      await _tokenStore.write(response.data!['token'] as String);
      return true;
    } on DioException catch (e) {
      if (e.response?.statusCode == 401) return false;
      rethrow;
    }
  }

  @override
  Future<void> logout() async {
    await _tokenStore.delete();
  }

  @override
  Future<bool> isLoggedIn() async {
    final token = await _tokenStore.read();
    if (token == null) return false;
    try {
      await _dio.get<void>('/auth/status');
      return true;
    } on DioException {
      await _tokenStore.delete();
      return false;
    }
  }
}
