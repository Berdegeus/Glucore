abstract class AuthRepository {
  Future<bool> login({required String email, required String password});
  Future<bool> register({
    required String fullName,
    required String email,
    required String password,
    DateTime? birthDate,
    double? weightKg,
    int? targetRangeMin,
    int? targetRangeMax,
  });
  Future<void> logout();
  Future<bool> isLoggedIn();
}
