import '../../domain/repositories/auth_repository.dart';
import '../datasources/auth_local_datasource.dart';

class AuthRepositoryImpl implements AuthRepository {
  const AuthRepositoryImpl(this.localDataSource);

  final AuthLocalDataSource localDataSource;

  @override
  Future<bool> login({required String email, required String password}) {
    return localDataSource.login(email: email, password: password);
  }

  @override
  Future<bool> register({required String email, required String password}) {
    return localDataSource.register(email: email, password: password);
  }

  @override
  Future<void> logout() {
    return localDataSource.logout();
  }

  @override
  Future<bool> isLoggedIn() {
    return localDataSource.isLoggedIn();
  }
}
