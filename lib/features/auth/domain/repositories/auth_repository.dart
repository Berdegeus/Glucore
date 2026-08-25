/// Outcome of validating a stored session against the backend.
///
/// The distinction matters for an offline-first app: only [invalid] means the
/// server actively rejected the token (401/403) and it must be discarded.
/// [unreachable] (network/timeout/5xx) must NOT log the user out — the token
/// is kept and the session stays valid optimistically until the network is back.
enum AuthSessionStatus {
  /// Token present and accepted by the backend.
  authenticated,

  /// No token, or the backend rejected it (401/403). Token was cleared.
  invalid,

  /// Backend unreachable (offline/timeout/5xx). Token kept, validation deferred.
  unreachable,
}

abstract class AuthRepository {
  Future<bool> login({required String email, required String password});
  Future<bool> register({
    required String fullName,
    required String email,
    required String password,
    String? phone,
    DateTime? birthDate,
    double? weightKg,
    int? targetRangeMin,
    int? targetRangeMax,
  });
  Future<void> logout();
  Future<AuthSessionStatus> isLoggedIn();
}
