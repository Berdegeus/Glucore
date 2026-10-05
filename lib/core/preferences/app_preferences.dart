import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'glucose_unit.dart';

/// UI preferences that are not clinical data: app language and glucose unit.
class AppPreferences {
  const AppPreferences({this.locale, this.unit = GlucoseUnit.mgDl});

  /// Null follows the system language.
  final Locale? locale;
  final GlucoseUnit unit;

  AppPreferences copyWith({
    Locale? locale,
    bool clearLocale = false,
    GlucoseUnit? unit,
  }) =>
      AppPreferences(
        locale: clearLocale ? null : (locale ?? this.locale),
        unit: unit ?? this.unit,
      );

  @override
  bool operator ==(Object other) =>
      other is AppPreferences && other.locale == locale && other.unit == unit;

  @override
  int get hashCode => Object.hash(locale, unit);
}

/// Persists [AppPreferences] in `SharedPreferences`, like the theme and
/// `onboarding_done`: UI preference, not clinical data nor a secret.
class AppPreferencesStore {
  const AppPreferencesStore();

  static const localeKey = 'app_locale';
  static const unitKey = 'glucose_unit';

  Future<AppPreferences> read() async {
    final prefs = await SharedPreferences.getInstance();
    final code = prefs.getString(localeKey);
    return AppPreferences(
      locale: code == null || code.isEmpty ? null : Locale(code),
      unit: GlucoseUnit.fromName(prefs.getString(unitKey)),
    );
  }

  Future<void> write(AppPreferences value) async {
    final prefs = await SharedPreferences.getInstance();
    final locale = value.locale;
    if (locale == null) {
      await prefs.remove(localeKey);
    } else {
      await prefs.setString(localeKey, locale.languageCode);
    }
    await prefs.setString(unitKey, value.unit.name);
  }
}

class AppPreferencesCubit extends Cubit<AppPreferences> {
  AppPreferencesCubit({
    AppPreferencesStore store = const AppPreferencesStore(),
  })  : _store = store,
        super(const AppPreferences());

  final AppPreferencesStore _store;

  Future<void> load() async {
    final loaded = await _store.read();
    if (isClosed) return;
    emit(loaded);
  }

  /// Applies right away and only then writes: the screen does not wait for disk.
  Future<void> setLocale(Locale? locale) async {
    final next = locale == null
        ? state.copyWith(clearLocale: true)
        : state.copyWith(locale: locale);
    emit(next);
    await _store.write(next);
  }

  Future<void> setUnit(GlucoseUnit unit) async {
    final next = state.copyWith(unit: unit);
    emit(next);
    await _store.write(next);
  }
}

extension AppPreferencesContext on BuildContext {
  /// Glucose unit, rebuilding the caller when it changes. Falls back to mg/dL
  /// when no [AppPreferencesCubit] is above (e.g. isolated widget tests).
  GlucoseUnit get glucoseUnit {
    try {
      return watch<AppPreferencesCubit>().state.unit;
    } on Exception {
      return GlucoseUnit.mgDl;
    }
  }

  /// Non-listening read for callbacks (submit, validators). Same fallback.
  GlucoseUnit readGlucoseUnit() {
    try {
      return read<AppPreferencesCubit>().state.unit;
    } on Exception {
      return GlucoseUnit.mgDl;
    }
  }

  /// Example range in the chosen unit, e.g. `80-180` or `4.4-10.0`. Does not
  /// listen: it is also called from validators, outside of `build`.
  String glucoseRangeExample() => formatGlucoseRange(
        80,
        180,
        readGlucoseUnit(),
        locale: Localizations.localeOf(this).toString(),
      );

  /// "120" or "6.7" — number only, in the chosen unit and locale.
  String formatGlucose(double mgDl) => glucoseUnit.format(
        mgDl,
        locale: Localizations.localeOf(this).toString(),
      );

  /// "120 mg/dL" or "6.7 mmol/L".
  String formatGlucoseWithUnit(double mgDl) => glucoseUnit.formatWithUnit(
        mgDl,
        locale: Localizations.localeOf(this).toString(),
      );
}
