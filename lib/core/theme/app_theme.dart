import 'package:flutter/material.dart';

class AppTheme {
  static const Color brandPrimary = Color(0xFF2563EB);
  static const Color brandSecondary = Color(0xFF0EA5E9);
  static const Color warningLow = Color(0xFFD97706);
  static const Color warningHigh = Color(0xFFB91C1C);
  static const Color neutralInfo = Color(0xFF334155);

  static ThemeData light() {
    final base = ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: brandPrimary,
        primary: brandPrimary,
        secondary: brandSecondary,
      ),
    );

    return base.copyWith(
      scaffoldBackgroundColor: const Color(0xFFF8FAFC),
      appBarTheme: const AppBarTheme(centerTitle: false),
      inputDecorationTheme: const InputDecorationTheme(
        border: OutlineInputBorder(),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
      snackBarTheme: const SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}
