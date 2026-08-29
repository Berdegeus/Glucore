import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'glucore_colors.dart';

class AppTheme {
  // Brand
  static const Color brandBlue = Color(0xFF0052FF);
  static const Color brandAmber = Color(0xFFF4B000);

  // Zone: Target (70–180 mg/dL)
  static const Color zoneTargetBg = Color(0xFF05B169);
  static const Color zoneTargetSoft = Color(0xFFE2F6EC);
  static const Color zoneTargetInk = Color(0xFF074F31);

  // Zone: Low (54–threshold)
  static const Color zoneLowBg = Color(0xFFCF202F);
  static const Color zoneLowSoft = Color(0xFFFBE5E7);
  static const Color zoneLowInk = Color(0xFF771219);

  // Zone: Urgent Low (<54)
  static const Color zoneUrgentLowBg = Color(0xFFA2121F);
  static const Color zoneUrgentLowSoft = Color(0xFFF8D9DC);
  static const Color zoneUrgentLowInk = Color(0xFF5A0810);

  // Zone: High (threshold–250)
  static const Color zoneHighBg = Color(0xFFE58A1F);
  static const Color zoneHighSoft = Color(0xFFFCEFD8);
  static const Color zoneHighInk = Color(0xFF6B3F08);

  // Zone: Urgent High (>250)
  static const Color zoneUrgentHighBg = Color(0xFFB0440B);
  static const Color zoneUrgentHighSoft = Color(0xFFFCE4CC);
  static const Color zoneUrgentHighInk = Color(0xFF5A2102);

  // Surfaces
  static const Color surfaceCanvas = Color(0xFFFFFFFF);
  static const Color surfaceElevated = Color(0xFFF7F7F7);
  static const Color surfaceSunken = Color(0xFFEEF0F3);
  static const Color ink = Color(0xFF0A0B0D);
  static const Color inkMuted = Color(0xFF6B7280);

  // Legacy aliases kept for backward compat
  static const Color brandPrimary = brandBlue;
  static const Color brandSecondary = Color(0xFF0284C7);
  static const Color warningLow = zoneLowBg;
  static const Color warningHigh = zoneHighBg;
  static const Color neutralInfo = Color(0xFF334155);

  static TextStyle monoStyle({
    double fontSize = 14,
    FontWeight fontWeight = FontWeight.w400,
    Color? color,
  }) =>
      GoogleFonts.jetBrainsMono(
        fontSize: fontSize,
        fontWeight: fontWeight,
        color: color,
      );

  static ThemeData light() => _build(Brightness.light, GlucoreColors.light);

  static ThemeData dark() => _build(Brightness.dark, GlucoreColors.dark);

  /// Uma só montagem de `ThemeData` para os dois temas: o que muda entre eles
  /// são as cores da paleta, nunca a forma dos componentes.
  static ThemeData _build(Brightness brightness, GlucoreColors palette) {
    final borderColor = brightness == Brightness.light
        ? const Color(0xFFE5E7EB)
        : const Color(0xFF343945);

    return ThemeData(
      useMaterial3: true,
      brightness: brightness,
      extensions: <ThemeExtension<dynamic>>[palette],
      colorScheme: ColorScheme.fromSeed(
        seedColor: palette.brandBlue,
        brightness: brightness,
        primary: palette.brandBlue,
        surface: palette.surfaceCanvas,
        onSurface: palette.ink,
      ),
      scaffoldBackgroundColor: palette.surfaceElevated,
      appBarTheme: AppBarTheme(
        backgroundColor: palette.surfaceCanvas,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        shadowColor: Colors.transparent,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: palette.ink,
          fontSize: 18,
          fontWeight: FontWeight.w700,
        ),
        iconTheme: IconThemeData(color: palette.ink),
      ),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: borderColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: palette.brandBlue, width: 2),
        ),
        filled: true,
        fillColor: palette.surfaceCanvas,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        color: palette.surfaceCanvas,
        surfaceTintColor: Colors.transparent,
      ),
      snackBarTheme: const SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: palette.brandBlue,
          foregroundColor: brightness == Brightness.light
              ? Colors.white
              : const Color(0xFF0A0B0D),
          shape: const StadiumBorder(),
          minimumSize: const Size.fromHeight(48),
          textStyle: const TextStyle(fontWeight: FontWeight.w600),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          side: BorderSide(color: palette.brandBlue),
          foregroundColor: palette.brandBlue,
          shape: const StadiumBorder(),
          minimumSize: const Size.fromHeight(48),
          textStyle: const TextStyle(fontWeight: FontWeight.w600),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: palette.brandBlue,
          foregroundColor: brightness == Brightness.light
              ? Colors.white
              : const Color(0xFF0A0B0D),
          shape: const StadiumBorder(),
          minimumSize: const Size.fromHeight(48),
          textStyle: const TextStyle(fontWeight: FontWeight.w600),
        ),
      ),
    );
  }
}
