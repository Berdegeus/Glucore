import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Preferência de tema do usuário (THEME-02).
///
/// Vive em `SharedPreferences`, o mesmo mecanismo do `onboarding_done`: é
/// preferência de UI, não dado clínico nem segredo.
class ThemePreferenceStore {
  const ThemePreferenceStore();

  static const key = 'theme_mode';

  /// Lê a preferência gravada. Sem valor — ou com valor que não corresponde a
  /// nenhum modo conhecido — devolve [ThemeMode.system].
  Future<ThemeMode> read() async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString(key);
    return switch (stored) {
      'light' => ThemeMode.light,
      'dark' => ThemeMode.dark,
      _ => ThemeMode.system,
    };
  }

  Future<void> write(ThemeMode mode) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(key, mode.name);
  }
}
