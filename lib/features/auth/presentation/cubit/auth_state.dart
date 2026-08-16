import 'package:equatable/equatable.dart';

enum AuthStatus { initial, loading, authenticated, unauthenticated, failure }

/// Failure the user has to be told about. The last two come from the `code`
/// field the backend now returns (`WEAK_PASSWORD`, `DATABASE_UNAVAILABLE`), so
/// "senha fraca" and "banco fora do ar" stop reading as a generic server error.
enum AuthError {
  invalidCredentials,
  emailAlreadyExists,
  weakPassword,
  serviceUnavailable,
  networkError,
  serverError,
}

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
