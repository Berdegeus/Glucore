import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/core/theme/theme_cubit.dart';
import 'package:glucore/core/theme/theme_preference_store.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// THEME-01 (aplica na hora), THEME-02 (sobrevive ao restart) e THEME-03
/// (`system` segue a plataforma). A persistência é exercida contra o
/// `SharedPreferences` real em modo mock, não contra um dublê do store — é o
/// disco que precisa provar que guardou.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() => SharedPreferences.setMockInitialValues({}));

  group('ThemePreferenceStore', () {
    test('reads system when nothing was ever written', () async {
      const store = ThemePreferenceStore();

      expect(await store.read(), ThemeMode.system);
    });

    test('round-trips each mode through SharedPreferences', () async {
      const store = ThemePreferenceStore();

      for (final mode in ThemeMode.values) {
        await store.write(mode);
        expect(await store.read(), mode, reason: 'failed for $mode');
      }
    });

    test('falls back to system when the stored value is unknown', () async {
      SharedPreferences.setMockInitialValues({
        ThemePreferenceStore.key: 'solarized',
      });

      expect(await const ThemePreferenceStore().read(), ThemeMode.system);
    });

    test('writes under the theme_mode key', () async {
      await const ThemePreferenceStore().write(ThemeMode.dark);

      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getString('theme_mode'), 'dark');
    });
  });

  group('ThemeCubit', () {
    test('starts on system before the stored preference is loaded', () {
      expect(ThemeCubit().state, ThemeMode.system);
    });

    test('setMode emits the new mode immediately (THEME-01)', () async {
      final cubit = ThemeCubit();
      final emitted = <ThemeMode>[];
      cubit.stream.listen(emitted.add);

      await cubit.setMode(ThemeMode.dark);

      expect(cubit.state, ThemeMode.dark);
      await Future<void>.delayed(Duration.zero);
      expect(emitted, [ThemeMode.dark]);
      await cubit.close();
    });

    test('a mode chosen in one run is restored in the next (THEME-02)', () async {
      final first = ThemeCubit();
      await first.setMode(ThemeMode.dark);
      await first.close();

      // A fresh cubit stands in for a fresh app launch: same SharedPreferences,
      // no in-memory state carried over.
      final second = ThemeCubit();
      expect(second.state, ThemeMode.system, reason: 'before load()');
      await second.load();

      expect(second.state, ThemeMode.dark);
      await second.close();
    });

    test('load leaves the mode on system when nothing was stored (THEME-03)', () async {
      final cubit = ThemeCubit();

      await cubit.load();

      expect(cubit.state, ThemeMode.system);
      await cubit.close();
    });

    test('switching back to system clears the explicit choice', () async {
      final cubit = ThemeCubit();
      await cubit.setMode(ThemeMode.light);
      await cubit.setMode(ThemeMode.system);
      await cubit.close();

      final reopened = ThemeCubit();
      await reopened.load();

      expect(reopened.state, ThemeMode.system);
      await reopened.close();
    });
  });
}
