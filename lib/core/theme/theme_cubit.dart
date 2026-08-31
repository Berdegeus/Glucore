import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'theme_preference_store.dart';

/// Modo de tema ativo (THEME-01/THEME-02/THEME-03).
///
/// Começa em [ThemeMode.system] e só sai daí quando [load] traz a preferência
/// gravada ou o usuário escolhe outro modo.
class ThemeCubit extends Cubit<ThemeMode> {
  ThemeCubit({ThemePreferenceStore store = const ThemePreferenceStore()})
      : _store = store,
        super(ThemeMode.system);

  final ThemePreferenceStore _store;

  Future<void> load() async {
    final mode = await _store.read();
    if (isClosed) return;
    emit(mode);
  }

  /// Aplica o modo na hora e só então grava: a tela não espera o disco.
  Future<void> setMode(ThemeMode mode) async {
    emit(mode);
    await _store.write(mode);
  }
}
