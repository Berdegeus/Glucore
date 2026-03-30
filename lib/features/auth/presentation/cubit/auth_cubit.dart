import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/usecase/usecase.dart';
import '../../domain/usecases/get_auth_status_usecase.dart';
import '../../domain/usecases/login_usecase.dart';
import '../../domain/usecases/logout_usecase.dart';
import 'auth_state.dart';

class AuthCubit extends Cubit<AuthState> {
  AuthCubit({
    required this.loginUseCase,
    required this.logoutUseCase,
    required this.getAuthStatusUseCase,
  }) : super(const AuthState());

  final LoginUseCase loginUseCase;
  final LogoutUseCase logoutUseCase;
  final GetAuthStatusUseCase getAuthStatusUseCase;

  Future<void> checkAuthStatus() async {
    emit(state.copyWith(status: AuthStatus.loading, errorMessage: null));

    final loggedIn = await getAuthStatusUseCase(const NoParams());

    if (loggedIn) {
      emit(state.copyWith(status: AuthStatus.authenticated));
    } else {
      emit(state.copyWith(status: AuthStatus.unauthenticated));
    }
  }

  Future<void> login({required String email, required String password}) async {
    emit(state.copyWith(status: AuthStatus.loading, errorMessage: null));

    final result = await loginUseCase(LoginParams(email: email, password: password));

    if (result) {
      emit(state.copyWith(status: AuthStatus.authenticated));
    } else {
      emit(
        state.copyWith(
          status: AuthStatus.failure,
          errorMessage: 'Credenciais inválidas. Use email e senha com 4+ caracteres.',
        ),
      );
      emit(state.copyWith(status: AuthStatus.unauthenticated));
    }
  }

  Future<void> logout() async {
    emit(state.copyWith(status: AuthStatus.loading, errorMessage: null));
    await logoutUseCase(const NoParams());
    emit(state.copyWith(status: AuthStatus.unauthenticated));
  }
}
