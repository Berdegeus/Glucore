import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthTokenStore {
  const AuthTokenStore(this._storage);

  final FlutterSecureStorage _storage;

  static const _key = 'glucore_auth_jwt';

  Future<String?> read() => _storage.read(key: _key);
  Future<void> write(String token) => _storage.write(key: _key, value: token);
  Future<void> delete() => _storage.delete(key: _key);
}
