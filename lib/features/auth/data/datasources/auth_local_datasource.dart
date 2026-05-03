import 'package:shared_preferences/shared_preferences.dart';

import '../../../../core/constants/auth_keys.dart';

abstract class AuthLocalDataSource {
  Future<bool> login({required String email, required String password});
  Future<void> logout();
  Future<bool> isLoggedIn();
}

class AuthLocalDataSourceImpl implements AuthLocalDataSource {
  const AuthLocalDataSourceImpl(this.sharedPreferences);

  final SharedPreferences sharedPreferences;

  @override
  Future<bool> login({required String email, required String password}) async {
    final isValid = email.isNotEmpty && password.length >= 4;

    if (!isValid) {
      return false;
    }

    await sharedPreferences.setBool(AuthKeys.isLoggedIn, true);
    return true;
  }

  @override
  Future<void> logout() async {
    await sharedPreferences.setBool(AuthKeys.isLoggedIn, false);
  }

  @override
  Future<bool> isLoggedIn() async {
    return sharedPreferences.getBool(AuthKeys.isLoggedIn) ?? false;
  }
}
