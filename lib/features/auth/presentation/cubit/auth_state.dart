import 'package:equatable/equatable.dart';

enum AuthStatus { initial, loading, authenticated, unauthenticated, failure }

enum AuthError { invalidCredentials, emailAlreadyExists, networkError, serverError }

class AuthState extends Equatable {
  const AuthState({
    this.status = AuthStatus.initial,
    this.error,
  });

  final AuthStatus status;
  final AuthError? error;

  AuthState copyWith({AuthStatus? status, AuthError? error}) {
    return AuthState(
      status: status ?? this.status,
      error: error,
    );
  }

  @override
  List<Object?> get props => [status, error];
}
