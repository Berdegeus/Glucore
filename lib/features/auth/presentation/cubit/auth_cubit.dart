import 'dart:async';
import 'dart:developer';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/usecase/usecase.dart';
import '../../domain/repositories/auth_repository.dart' show AuthSessionStatus;
import '../../domain/usecases/get_auth_status_usecase.dart';
import '../../domain/usecases/login_usecase.dart';
import '../../domain/usecases/logout_usecase.dart';
import '../../domain/usecases/register_usecase.dart';
import 'auth_state.dart';

class AuthCubit extends Cubit<AuthState> {
  AuthCubit({
    required this.loginUseCase,
    required this.logoutUseCase,
    required this.getAuthStatusUseCase,
    required this.registerUseCase,
    Stream<List<ConnectivityResult>>? connectivityChanges,
  }) : super(const AuthState()) {
    // Revalidate a deferred (offline) session when the network returns (P18).
    final changes =
        connectivityChanges ?? Connectivity().onConnectivityChanged;
    _connectivitySubscription = changes.listen((results) {
      final online = results.any((r) => r != ConnectivityResult.none);
      if (online && state.offlineValidation) {
        log('connectivity back → revalidating offline session',
            name: 'AuthCubit');
        checkAuthStatus();
      }
    });
  }

  final LoginUseCase loginUseCase;
  final LogoutUseCase logoutUseCase;
  final GetAuthStatusUseCase getAuthStatusUseCase;
  final RegisterUseCase registerUseCase;

  StreamSubscription<List<ConnectivityResult>>? _connectivitySubscription;

  Future<void> checkAuthStatus() async {
    emit(state.copyWith(
        status: AuthStatus.loading, error: null, offlineValidation: false));
    try {
      final result = await getAuthStatusUseCase(const NoParams());
      log('checkAuthStatus → $result', name: 'AuthCubit');
      switch (result) {
        case AuthSessionStatus.authenticated:
          emit(state.copyWith(
              status: AuthStatus.authenticated, offlineValidation: false));
        case AuthSessionStatus.invalid:
          emit(state.copyWith(
              status: AuthStatus.unauthenticated, offlineValidation: false));
        case AuthSessionStatus.unreachable:
          // Backend unreachable but a token exists: keep the session
          // optimistically (data + BLE are local); revalidate on reconnect.
          emit(state.copyWith(
              status: AuthStatus.authenticated, offlineValidation: true));
      }
    } catch (e) {
      // isLoggedIn already classifies Dio errors into the enum above; reaching
      // here means something unexpected — treat as logged out.
      log('checkAuthStatus unexpected: $e', name: 'AuthCubit');
      emit(state.copyWith(
          status: AuthStatus.unauthenticated, offlineValidation: false));
    }
  }

  @override
  Future<void> close() {
    _connectivitySubscription?.cancel();
    return super.close();
  }

  Future<void> login({required String email, required String password}) async {
    emit(state.copyWith(status: AuthStatus.loading, error: null));
    try {
      final ok = await loginUseCase(LoginParams(email: email, password: password));
      if (ok) {
        log('login success [$email]', name: 'AuthCubit');
        emit(state.copyWith(status: AuthStatus.authenticated));
      } else {
        log('login invalid credentials [$email]', name: 'AuthCubit');
        emit(state.copyWith(status: AuthStatus.failure, error: AuthError.invalidCredentials));
        emit(state.copyWith(status: AuthStatus.unauthenticated));
      }
    } on DioException catch (e) {
      final err = _mapDioError(e);
      log('login dio error: ${e.type} ${e.message} → $err', name: 'AuthCubit');
      emit(state.copyWith(status: AuthStatus.failure, error: err));
      emit(state.copyWith(status: AuthStatus.unauthenticated));
    } catch (e) {
      log('login unexpected: $e', name: 'AuthCubit');
      emit(state.copyWith(status: AuthStatus.failure, error: AuthError.serverError));
      emit(state.copyWith(status: AuthStatus.unauthenticated));
    }
  }

  Future<void> register({
    required String fullName,
    required String email,
    required String password,
    String? phone,
    DateTime? birthDate,
    double? weightKg,
    int? targetRangeMin,
    int? targetRangeMax,
  }) async {
    emit(state.copyWith(status: AuthStatus.loading, error: null));
    try {
      final ok = await registerUseCase(
        RegisterParams(
          fullName: fullName,
          email: email,
          password: password,
          phone: phone,
          birthDate: birthDate,
          weightKg: weightKg,
          targetRangeMin: targetRangeMin,
          targetRangeMax: targetRangeMax,
        ),
      );
      if (ok) {
        log('register success [$email]', name: 'AuthCubit');
        emit(state.copyWith(status: AuthStatus.authenticated));
      } else {
        log('register email exists [$email]', name: 'AuthCubit');
        emit(state.copyWith(status: AuthStatus.failure, error: AuthError.emailAlreadyExists));
        emit(state.copyWith(status: AuthStatus.unauthenticated));
      }
    } on DioException catch (e) {
      final err = _mapDioError(e);
      log('register dio error: ${e.type} ${e.message} → $err', name: 'AuthCubit');
      emit(state.copyWith(status: AuthStatus.failure, error: err));
      emit(state.copyWith(status: AuthStatus.unauthenticated));
    } catch (e) {
      log('register unexpected: $e', name: 'AuthCubit');
      emit(state.copyWith(status: AuthStatus.failure, error: AuthError.serverError));
      emit(state.copyWith(status: AuthStatus.unauthenticated));
    }
  }

  Future<void> logout() async {
    emit(state.copyWith(
        status: AuthStatus.loading, error: null, offlineValidation: false));
    try {
      await logoutUseCase(const NoParams());
      log('logout success', name: 'AuthCubit');
    } catch (e) {
      log('logout error (ignored): $e', name: 'AuthCubit');
    }
    emit(state.copyWith(status: AuthStatus.unauthenticated));
  }

  AuthError _mapDioError(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.connectionError:
        return AuthError.networkError;
      default:
        return _mapErrorCode(e.response?.data) ?? AuthError.serverError;
    }
  }

  /// Reads the `code` the backend puts in the error body. Deciding on the code
  /// instead of the status is what tells a weak password apart from any other
  /// 400, and a database outage apart from a generic 5xx.
  AuthError? _mapErrorCode(dynamic data) {
    if (data is! Map) return null;
    switch (data['code']) {
      case 'WEAK_PASSWORD':
        return AuthError.weakPassword;
      case 'DATABASE_UNAVAILABLE':
        return AuthError.serviceUnavailable;
      default:
        return null;
    }
  }
}
