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
  Future<bool> register({
    required String fullName,
    required String email,
    required String password,
    String? phone,
    DateTime? birthDate,
    double? weightKg,
    int? targetRangeMin,
    int? targetRangeMax,
  }) {
    return localDataSource.register(
      fullName: fullName,
      email: email,
      password: password,
      phone: phone,
      birthDate: birthDate,
      weightKg: weightKg,
      targetRangeMin: targetRangeMin,
      targetRangeMax: targetRangeMax,
    );
  }

  @override
  Future<void> logout() {
    return localDataSource.logout();
  }

  @override
  Future<AuthSessionStatus> isLoggedIn() {
    return localDataSource.isLoggedIn();
  }
}
