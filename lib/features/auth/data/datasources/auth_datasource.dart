import 'package:dio/dio.dart';
import 'package:glucore/core/utils/date_input.dart';

import '../../../../core/api/auth_token_store.dart';
import '../../domain/repositories/auth_repository.dart' show AuthSessionStatus;

abstract class AuthDataSource {
  Future<bool> login({required String email, required String password});
  Future<bool> register({
    required String fullName,
    required String email,
    required String password,
    String? phone,
    DateTime? birthDate,
    double? weightKg,
    int? targetRangeMin,
    int? targetRangeMax,
  });
  Future<void> logout();
  Future<AuthSessionStatus> isLoggedIn();
}

class RemoteAuthDataSource implements AuthDataSource {
  const RemoteAuthDataSource(this._dio, this._tokenStore);

  final Dio _dio;
  final AuthTokenStore _tokenStore;

  @override
  Future<bool> register({
    required String fullName,
    required String email,
    required String password,
    String? phone,
    DateTime? birthDate,
    double? weightKg,
    int? targetRangeMin,
    int? targetRangeMax,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/auth/register',
        data: {
          'fullName': fullName,
          'email': email,
          'password': password,
          'phone': phone,
          'birthDate': birthDate == null ? null : formatIsoDateOnly(birthDate),
          'weightKg': weightKg,
          'targetRangeMin': targetRangeMin,
          'targetRangeMax': targetRangeMax,
        },
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
  Future<AuthSessionStatus> isLoggedIn() async {
    final token = await _tokenStore.read();
    if (token == null) return AuthSessionStatus.invalid;
    try {
      await _dio.get<void>('/auth/status');
      return AuthSessionStatus.authenticated;
    } on DioException catch (e) {
      final status = e.response?.statusCode;
      // Only an explicit rejection (401/403) means the token is bad — discard
      // it. Network errors, timeouts and 5xx leave the session intact so an
      // offline launch does not log the user out (P18).
      if (status == 401 || status == 403) {
        await _tokenStore.delete();
        return AuthSessionStatus.invalid;
      }
      return AuthSessionStatus.unreachable;
    }
  }
}
