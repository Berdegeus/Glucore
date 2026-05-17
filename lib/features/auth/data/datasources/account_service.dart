import 'package:dio/dio.dart';

class AccountService {
  const AccountService(this._dio);

  final Dio _dio;

  Future<void> forgotPassword(String email) async {
    await _dio.post<void>('/auth/forgot-password', data: {'email': email});
  }

  Future<void> resetPassword({required String token, required String password}) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/auth/reset-password',
      data: {'token': token, 'password': password},
    );
    if (response.statusCode != 200) {
      throw DioException(
        requestOptions: response.requestOptions,
        response: response,
        type: DioExceptionType.badResponse,
      );
    }
  }

  Future<void> changeEmail({
    required String currentPassword,
    required String newEmail,
  }) async {
    await _dio.put<void>('/auth/profile', data: {
      'currentPassword': currentPassword,
      'newEmail': newEmail,
    });
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    await _dio.put<void>('/auth/profile', data: {
      'currentPassword': currentPassword,
      'newPassword': newPassword,
    });
  }
}
