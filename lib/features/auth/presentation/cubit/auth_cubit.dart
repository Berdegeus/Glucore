import 'dart:developer';

import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/usecase/usecase.dart';
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
  }) : super(const AuthState());

  final LoginUseCase loginUseCase;
  final LogoutUseCase logoutUseCase;
  final GetAuthStatusUseCase getAuthStatusUseCase;
  final RegisterUseCase registerUseCase;

  Future<void> checkAuthStatus() async {
    emit(state.copyWith(status: AuthStatus.loading, error: null));
    try {
      final loggedIn = await getAuthStatusUseCase(const NoParams());
      log('checkAuthStatus → ${loggedIn ? "authenticated" : "unauthenticated"}',
          name: 'AuthCubit');
      emit(state.copyWith(
        status: loggedIn ? AuthStatus.authenticated : AuthStatus.unauthenticated,
      ));
    } on DioException catch (e) {
      log('checkAuthStatus dio error: ${e.type} ${e.message}', name: 'AuthCubit');
      emit(state.copyWith(status: AuthStatus.unauthenticated));
    } catch (e) {
      log('checkAuthStatus unexpected: $e', name: 'AuthCubit');
      emit(state.copyWith(status: AuthStatus.unauthenticated));
    }
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
    emit(state.copyWith(status: AuthStatus.loading, error: null));
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
        return AuthError.serverError;
    }
  }
}
