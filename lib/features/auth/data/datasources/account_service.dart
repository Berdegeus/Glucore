import 'package:dio/dio.dart';
import 'package:glucore/core/utils/date_input.dart';

class AccountProfile {
  const AccountProfile({
    required this.email,
    required this.fullName,
    required this.birthDate,
    required this.diabetesType,
    required this.weightKg,
    required this.targetRangeMin,
    required this.targetRangeMax,
    this.phone,
    this.createdAt,
  });

  final String email;
  final String fullName;
  final String? phone;
  final DateTime? birthDate;
  final String? diabetesType;
  final double? weightKg;
  final int targetRangeMin;
  final int targetRangeMax;

  /// When the account was created. Optional so existing call sites that
  /// build an `AccountProfile` without it (tests, doubles) keep compiling;
  /// `serializeProfile` in the backend always sends it.
  final DateTime? createdAt;

  factory AccountProfile.fromJson(Map<String, dynamic> json) {
    final patient = json['patient'] as Map<String, dynamic>? ?? const {};
    final birthDateValue = patient['birthDate']?.toString();
    final createdAtValue = json['createdAt']?.toString();
    return AccountProfile(
      email: json['email']?.toString() ?? '',
      fullName: json['fullName']?.toString() ?? '',
      phone: json['phone']?.toString(),
      birthDate: birthDateValue == null || birthDateValue.isEmpty
          ? null
          : DateTime.tryParse(birthDateValue),
      diabetesType: patient['diabetesType']?.toString(),
      weightKg: (patient['weightKg'] as num?)?.toDouble(),
      targetRangeMin: (patient['targetRangeMin'] as num?)?.toInt() ?? 80,
      targetRangeMax: (patient['targetRangeMax'] as num?)?.toInt() ?? 180,
      createdAt: createdAtValue == null || createdAtValue.isEmpty
          ? null
          : DateTime.tryParse(createdAtValue),
    );
  }
}

/// Account and profile calls, all through the gateway (`/api/v1`).
///
/// The profile lives behind `/me`, which the gateway composes from the account
/// (auth-service) and the patient (glucose-service); `/auth/profile` would
/// return only the account half. `PUT /me` carries name, phone, health fields,
/// e-mail change and password change in the same body shape.
class AccountService {
  const AccountService(this._dio);

  final Dio _dio;

  Future<void> forgotPassword(String email) async {
    await _dio.post<void>('/auth/forgot-password', data: {'email': email});
  }

  Future<void> resetPassword({
    required String token,
    required String password,
  }) async {
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

  Future<AccountProfile> fetchProfile() async {
    final response = await _dio.get<Map<String, dynamic>>('/me');
    return AccountProfile.fromJson(response.data ?? const {});
  }

  Future<void> updateProfile({
    required String fullName,
    DateTime? birthDate,
    double? weightKg,
    int? targetRangeMin,
    int? targetRangeMax,
    String? diabetesType,
    String? phone,
  }) async {
    await _dio.put<void>(
      '/me',
      data: {
        'fullName': fullName,
        'birthDate': birthDate == null ? null : formatIsoDateOnly(birthDate),
        'weightKg': weightKg,
        'targetRangeMin': targetRangeMin,
        'targetRangeMax': targetRangeMax,
        'diabetesType': diabetesType,
        'phone': phone,
      },
    );
  }

  Future<void> changeEmail({
    required String currentPassword,
    required String newEmail,
  }) async {
    await _dio.put<void>(
      '/me',
      data: {'currentPassword': currentPassword, 'newEmail': newEmail},
    );
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    await _dio.put<void>(
      '/me',
      data: {'currentPassword': currentPassword, 'newPassword': newPassword},
    );
  }

  /// `DELETE /account`: the gateway removes the patient and the account (both
  /// services). There is no screen for it yet; the method exists so the whole
  /// gateway contract the app can reach is covered and tested.
  Future<void> deleteAccount() async {
    await _dio.delete<void>('/account');
  }
}
