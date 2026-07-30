import 'package:equatable/equatable.dart';

enum AuthStatus { initial, loading, authenticated, unauthenticated, failure }

enum AuthError { invalidCredentials, emailAlreadyExists, networkError, serverError }

class AuthState extends Equatable {
  const AuthState({
    this.status = AuthStatus.initial,
    this.error,
    this.offlineValidation = false,
  });

  final AuthStatus status;
  final AuthError? error;

  /// True when the session is `authenticated` optimistically because the
  /// backend was unreachable at validation time (P18). Revalidated when the
  /// network returns; UI may surface an "offline" hint.
  final bool offlineValidation;

  AuthState copyWith({
    AuthStatus? status,
    AuthError? error,
    bool? offlineValidation,
  }) {
    return AuthState(
      status: status ?? this.status,
      error: error,
      offlineValidation: offlineValidation ?? this.offlineValidation,
    );
  }

  @override
  List<Object?> get props => [status, error, offlineValidation];
}
