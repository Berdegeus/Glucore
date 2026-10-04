import 'package:flutter/material.dart';

/// Paleta do Glucore resolvida pelo tema ativo (THEME-04/THEME-05).
///
/// Antes essas cores eram constantes estáticas em `AppTheme`, o que fazia
/// qualquer tela pintar superfície clara dentro do tema escuro. Aqui elas viram
/// duas instâncias — [light] e [dark] — que a tela lê por
/// `Theme.of(context)`.
///
/// **Regra clínica**: os matizes das faixas de glicemia (`zone*Bg`) são
/// idênticos nos dois temas. A cor da faixa é sinal, não decoração. O que muda
/// entre claro e escuro são as variantes suaves (`zone*Soft`), as tintas de
/// texto (`zone*Ink`) e as superfícies.
@immutable
class GlucoreColors extends ThemeExtension<GlucoreColors> {
  const GlucoreColors({
    required this.brandBlue,
    required this.brandAmber,
    required this.brandSecondary,
    required this.neutralInfo,
    required this.zoneTargetBg,
    required this.zoneTargetSoft,
    required this.zoneTargetInk,
    required this.zoneLowBg,
    required this.zoneLowSoft,
    required this.zoneLowInk,
    required this.zoneUrgentLowBg,
    required this.zoneUrgentLowSoft,
    required this.zoneUrgentLowInk,
    required this.zoneHighBg,
    required this.zoneHighSoft,
    required this.zoneHighInk,
    required this.zoneUrgentHighBg,
    required this.zoneUrgentHighSoft,
    required this.zoneUrgentHighInk,
    required this.surfaceCanvas,
    required this.surfaceElevated,
    required this.surfaceSunken,
    required this.ink,
    required this.inkMuted,
  });

  final Color brandBlue;
  final Color brandAmber;
  final Color brandSecondary;
  final Color neutralInfo;

  final Color zoneTargetBg;
  final Color zoneTargetSoft;
  final Color zoneTargetInk;

  final Color zoneLowBg;
  final Color zoneLowSoft;
  final Color zoneLowInk;

  final Color zoneUrgentLowBg;
  final Color zoneUrgentLowSoft;
  final Color zoneUrgentLowInk;

  final Color zoneHighBg;
  final Color zoneHighSoft;
  final Color zoneHighInk;

  final Color zoneUrgentHighBg;
  final Color zoneUrgentHighSoft;
  final Color zoneUrgentHighInk;

  final Color surfaceCanvas;
  final Color surfaceElevated;
  final Color surfaceSunken;
  final Color ink;
  final Color inkMuted;

  // Apelidos herdados do `AppTheme` estático, mantidos como getters para não
  // duplicar valor.
  Color get brandPrimary => brandBlue;
  Color get warningLow => zoneLowBg;
  Color get warningHigh => zoneHighBg;

  /// Matizes das faixas clínicas, na ordem em que a leitura os atravessa.
  ///
  /// É o conjunto que THEME-04 obriga a ser igual nos dois temas.
  List<Color> get clinicalBands => [
    zoneUrgentLowBg,
    zoneLowBg,
    zoneTargetBg,
    zoneHighBg,
    zoneUrgentHighBg,
  ];

  static const light = GlucoreColors(
    brandBlue: Color(0xFF0052FF),
    brandAmber: Color(0xFFF4B000),
    brandSecondary: Color(0xFF0284C7),
    neutralInfo: Color(0xFF334155),
    zoneTargetBg: Color(0xFF05B169),
    zoneTargetSoft: Color(0xFFE2F6EC),
    zoneTargetInk: Color(0xFF074F31),
    zoneLowBg: Color(0xFFCF202F),
    zoneLowSoft: Color(0xFFFBE5E7),
    zoneLowInk: Color(0xFF771219),
    zoneUrgentLowBg: Color(0xFFA2121F),
    zoneUrgentLowSoft: Color(0xFFF8D9DC),
    zoneUrgentLowInk: Color(0xFF5A0810),
    zoneHighBg: Color(0xFFE58A1F),
    zoneHighSoft: Color(0xFFFCEFD8),
    zoneHighInk: Color(0xFF6B3F08),
    zoneUrgentHighBg: Color(0xFFB0440B),
    zoneUrgentHighSoft: Color(0xFFFCE4CC),
    zoneUrgentHighInk: Color(0xFF5A2102),
    surfaceCanvas: Color(0xFFFFFFFF),
    surfaceElevated: Color(0xFFF7F7F7),
    surfaceSunken: Color(0xFFEEF0F3),
    ink: Color(0xFF0A0B0D),
    inkMuted: Color(0xFF6B7280),
  );

  /// Escuro. Faixas clínicas idênticas às do claro; o resto recalculado para
  /// contraste sobre fundo escuro.
  static const dark = GlucoreColors(
    brandBlue: Color(0xFF7EA2FF),
    brandAmber: Color(0xFFF7C544),
    brandSecondary: Color(0xFF38BDF8),
    neutralInfo: Color(0xFFCBD5E1),
    zoneTargetBg: Color(0xFF05B169),
    zoneTargetSoft: Color(0xFF0E2E22),
    zoneTargetInk: Color(0xFF7BE0B4),
    zoneLowBg: Color(0xFFCF202F),
    zoneLowSoft: Color(0xFF3A1216),
    zoneLowInk: Color(0xFFF3A6AD),
    zoneUrgentLowBg: Color(0xFFA2121F),
    zoneUrgentLowSoft: Color(0xFF2E0A0F),
    zoneUrgentLowInk: Color(0xFFEE8F99),
    zoneHighBg: Color(0xFFE58A1F),
    zoneHighSoft: Color(0xFF33220A),
    zoneHighInk: Color(0xFFF3C583),
    zoneUrgentHighBg: Color(0xFFB0440B),
    zoneUrgentHighSoft: Color(0xFF2B1305),
    zoneUrgentHighInk: Color(0xFFF0A97E),
    surfaceCanvas: Color(0xFF1A1D23),
    surfaceElevated: Color(0xFF101216),
    surfaceSunken: Color(0xFF262A32),
    ink: Color(0xFFF2F4F7),
    inkMuted: Color(0xFF9AA3B2),
  );

  /// A paleta é um par fixo, não um valor que o app remonta campo a campo:
  /// sem argumento, `copyWith` devolve a própria instância.
  @override
  GlucoreColors copyWith() => this;

  @override
  GlucoreColors lerp(ThemeExtension<GlucoreColors>? other, double t) {
    if (other is! GlucoreColors) return this;
    return GlucoreColors(
      brandBlue: Color.lerp(brandBlue, other.brandBlue, t)!,
      brandAmber: Color.lerp(brandAmber, other.brandAmber, t)!,
      brandSecondary: Color.lerp(brandSecondary, other.brandSecondary, t)!,
      neutralInfo: Color.lerp(neutralInfo, other.neutralInfo, t)!,
      zoneTargetBg: Color.lerp(zoneTargetBg, other.zoneTargetBg, t)!,
      zoneTargetSoft: Color.lerp(zoneTargetSoft, other.zoneTargetSoft, t)!,
      zoneTargetInk: Color.lerp(zoneTargetInk, other.zoneTargetInk, t)!,
      zoneLowBg: Color.lerp(zoneLowBg, other.zoneLowBg, t)!,
      zoneLowSoft: Color.lerp(zoneLowSoft, other.zoneLowSoft, t)!,
      zoneLowInk: Color.lerp(zoneLowInk, other.zoneLowInk, t)!,
      zoneUrgentLowBg: Color.lerp(zoneUrgentLowBg, other.zoneUrgentLowBg, t)!,
      zoneUrgentLowSoft:
          Color.lerp(zoneUrgentLowSoft, other.zoneUrgentLowSoft, t)!,
      zoneUrgentLowInk:
          Color.lerp(zoneUrgentLowInk, other.zoneUrgentLowInk, t)!,
      zoneHighBg: Color.lerp(zoneHighBg, other.zoneHighBg, t)!,
      zoneHighSoft: Color.lerp(zoneHighSoft, other.zoneHighSoft, t)!,
      zoneHighInk: Color.lerp(zoneHighInk, other.zoneHighInk, t)!,
      zoneUrgentHighBg:
          Color.lerp(zoneUrgentHighBg, other.zoneUrgentHighBg, t)!,
      zoneUrgentHighSoft:
          Color.lerp(zoneUrgentHighSoft, other.zoneUrgentHighSoft, t)!,
      zoneUrgentHighInk:
          Color.lerp(zoneUrgentHighInk, other.zoneUrgentHighInk, t)!,
      surfaceCanvas: Color.lerp(surfaceCanvas, other.surfaceCanvas, t)!,
      surfaceElevated: Color.lerp(surfaceElevated, other.surfaceElevated, t)!,
      surfaceSunken: Color.lerp(surfaceSunken, other.surfaceSunken, t)!,
      ink: Color.lerp(ink, other.ink, t)!,
      inkMuted: Color.lerp(inkMuted, other.inkMuted, t)!,
    );
  }
}

/// Acesso curto à paleta do tema ativo.
extension GlucoreColorsContext on BuildContext {
  GlucoreColors get glucoreColors =>
      Theme.of(this).extension<GlucoreColors>() ?? GlucoreColors.light;
}
