import '../../domain/repositories/auth_repository.dart';
import '../datasources/auth_datasource.dart';

class AuthRepositoryImpl implements AuthRepository {
  const AuthRepositoryImpl(this.dataSource);

  final AuthDataSource dataSource;

  @override
  Future<bool> login({required String email, required String password}) {
    return dataSource.login(email: email, password: password);
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
    return dataSource.register(
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
    return dataSource.logout();
  }

  @override
  Future<AuthSessionStatus> isLoggedIn() {
    return dataSource.isLoggedIn();
  }
}
