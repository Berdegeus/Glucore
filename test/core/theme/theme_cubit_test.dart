import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/core/theme/app_theme.dart';
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

    testWidgets('while on system the app follows the platform brightness '
        '(THEME-03)', (tester) async {
      addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
      final cubit = ThemeCubit();
      addTearDown(cubit.close);

      tester.platformDispatcher.platformBrightnessTestValue = Brightness.dark;
      late BuildContext captured;
      await tester.pumpWidget(
        BlocProvider<ThemeCubit>.value(
          value: cubit,
          child: BlocBuilder<ThemeCubit, ThemeMode>(
            builder: (context, mode) => MaterialApp(
              theme: AppTheme.light(),
              darkTheme: AppTheme.dark(),
              themeMode: mode,
              home: Builder(
                builder: (innerContext) {
                  captured = innerContext;
                  return const SizedBox.shrink();
                },
              ),
            ),
          ),
        ),
      );

      expect(cubit.state, ThemeMode.system);
      expect(Theme.of(captured).brightness, Brightness.dark);

      // O SO muda com o app aberto: o tema acompanha, sem tocar na preferência.
      tester.platformDispatcher.platformBrightnessTestValue = Brightness.light;
      await tester.pumpAndSettle();

      expect(Theme.of(captured).brightness, Brightness.light);
      expect(cubit.state, ThemeMode.system);
    });

    testWidgets('an explicit dark choice overrides a light platform '
        '(THEME-01)', (tester) async {
      addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
      tester.platformDispatcher.platformBrightnessTestValue = Brightness.light;
      final cubit = ThemeCubit();
      addTearDown(cubit.close);

      late BuildContext captured;
      await tester.pumpWidget(
        BlocProvider<ThemeCubit>.value(
          value: cubit,
          child: BlocBuilder<ThemeCubit, ThemeMode>(
            builder: (context, mode) => MaterialApp(
              theme: AppTheme.light(),
              darkTheme: AppTheme.dark(),
              themeMode: mode,
              home: Builder(
                builder: (innerContext) {
                  captured = innerContext;
                  return const SizedBox.shrink();
                },
              ),
            ),
          ),
        ),
      );
      expect(Theme.of(captured).brightness, Brightness.light);

      await cubit.setMode(ThemeMode.dark);
      await tester.pumpAndSettle();

      expect(Theme.of(captured).brightness, Brightness.dark);
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
