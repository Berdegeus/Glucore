import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthTokenStore {
  const AuthTokenStore(this._storage);

  final FlutterSecureStorage _storage;

  static const _key = 'glucore_auth_jwt';

  Future<String?> read() => _storage.read(key: _key);
  Future<void> write(String token) => _storage.write(key: _key, value: token);
  Future<void> delete() => _storage.delete(key: _key);

  /// The current user id, decoded from the JWT `sub` claim (no network).
  /// Returns null when there is no token or it cannot be parsed. Used to scope
  /// local data to its owner (P19).
  Future<String?> readUserId() async {
    final token = await read();
    if (token == null) return null;
    return subFromJwt(token);
  }

  /// Extracts the `sub` claim from a JWT without verifying the signature.
  /// Visible for testing.
  static String? subFromJwt(String token) {
    final parts = token.split('.');
    if (parts.length != 3) return null;
    try {
      final payload =
          utf8.decode(base64Url.decode(base64Url.normalize(parts[1])));
      final claims = jsonDecode(payload) as Map<String, dynamic>;
      return claims['sub']?.toString();
    } catch (_) {
      return null;
    }
  }
}
