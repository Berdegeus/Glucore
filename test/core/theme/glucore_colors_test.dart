import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/core/theme/app_theme.dart';
import 'package:glucore/core/theme/glucore_colors.dart';

void main() {
  group('THEME-04: matizes clínicos preservados no escuro', () {
    test('as faixas de glicemia têm exatamente a mesma cor nos dois temas', () {
      expect(GlucoreColors.dark.clinicalBands, GlucoreColors.light.clinicalBands);
    });

    test('cada faixa clínica é idêntica campo a campo', () {
      expect(GlucoreColors.dark.zoneUrgentLowBg, GlucoreColors.light.zoneUrgentLowBg);
      expect(GlucoreColors.dark.zoneLowBg, GlucoreColors.light.zoneLowBg);
      expect(GlucoreColors.dark.zoneTargetBg, GlucoreColors.light.zoneTargetBg);
      expect(GlucoreColors.dark.zoneHighBg, GlucoreColors.light.zoneHighBg);
      expect(
        GlucoreColors.dark.zoneUrgentHighBg,
        GlucoreColors.light.zoneUrgentHighBg,
      );
    });

    test('variantes suaves, tintas e superfícies são recalculadas', () {
      expect(GlucoreColors.dark.zoneTargetSoft,
          isNot(GlucoreColors.light.zoneTargetSoft));
      expect(GlucoreColors.dark.zoneLowSoft,
          isNot(GlucoreColors.light.zoneLowSoft));
      expect(GlucoreColors.dark.zoneHighSoft,
          isNot(GlucoreColors.light.zoneHighSoft));
      expect(GlucoreColors.dark.zoneTargetInk,
          isNot(GlucoreColors.light.zoneTargetInk));
      expect(GlucoreColors.dark.surfaceCanvas,
          isNot(GlucoreColors.light.surfaceCanvas));
      expect(GlucoreColors.dark.surfaceElevated,
          isNot(GlucoreColors.light.surfaceElevated));
      expect(GlucoreColors.dark.ink, isNot(GlucoreColors.light.ink));
      expect(GlucoreColors.dark.inkMuted, isNot(GlucoreColors.light.inkMuted));
    });

    test('a superfície escura é escura e a tinta escura é clara', () {
      expect(
        GlucoreColors.dark.surfaceCanvas.computeLuminance(),
        lessThan(0.2),
      );
      expect(GlucoreColors.dark.ink.computeLuminance(), greaterThan(0.7));
      expect(
        GlucoreColors.light.surfaceCanvas.computeLuminance(),
        greaterThan(0.8),
      );
      expect(GlucoreColors.light.ink.computeLuminance(), lessThan(0.1));
    });
  });

  test('a instância clara reproduz cada constante estática do AppTheme', () {
    const light = GlucoreColors.light;
    expect(light.brandBlue, AppTheme.brandBlue);
    expect(light.brandAmber, AppTheme.brandAmber);
    expect(light.brandPrimary, AppTheme.brandPrimary);
    expect(light.brandSecondary, AppTheme.brandSecondary);
    expect(light.neutralInfo, AppTheme.neutralInfo);
    expect(light.warningLow, AppTheme.warningLow);
    expect(light.warningHigh, AppTheme.warningHigh);
    expect(light.zoneTargetBg, AppTheme.zoneTargetBg);
    expect(light.zoneTargetSoft, AppTheme.zoneTargetSoft);
    expect(light.zoneTargetInk, AppTheme.zoneTargetInk);
    expect(light.zoneLowBg, AppTheme.zoneLowBg);
    expect(light.zoneLowSoft, AppTheme.zoneLowSoft);
    expect(light.zoneLowInk, AppTheme.zoneLowInk);
    expect(light.zoneUrgentLowBg, AppTheme.zoneUrgentLowBg);
    expect(light.zoneUrgentLowSoft, AppTheme.zoneUrgentLowSoft);
    expect(light.zoneUrgentLowInk, AppTheme.zoneUrgentLowInk);
    expect(light.zoneHighBg, AppTheme.zoneHighBg);
    expect(light.zoneHighSoft, AppTheme.zoneHighSoft);
    expect(light.zoneHighInk, AppTheme.zoneHighInk);
    expect(light.zoneUrgentHighBg, AppTheme.zoneUrgentHighBg);
    expect(light.zoneUrgentHighSoft, AppTheme.zoneUrgentHighSoft);
    expect(light.zoneUrgentHighInk, AppTheme.zoneUrgentHighInk);
    expect(light.surfaceCanvas, AppTheme.surfaceCanvas);
    expect(light.surfaceElevated, AppTheme.surfaceElevated);
    expect(light.surfaceSunken, AppTheme.surfaceSunken);
    expect(light.ink, AppTheme.ink);
    expect(light.inkMuted, AppTheme.inkMuted);
  });

  group('AppTheme registra a paleta no ThemeData', () {
    test('o tema claro carrega a instância clara', () {
      final theme = AppTheme.light();
      expect(theme.brightness, Brightness.light);
      expect(theme.extension<GlucoreColors>(), same(GlucoreColors.light));
      expect(theme.scaffoldBackgroundColor, GlucoreColors.light.surfaceElevated);
    });

    test('o tema escuro carrega a instância escura', () {
      final theme = AppTheme.dark();
      expect(theme.brightness, Brightness.dark);
      expect(theme.extension<GlucoreColors>(), same(GlucoreColors.dark));
      expect(theme.scaffoldBackgroundColor, GlucoreColors.dark.surfaceElevated);
      expect(theme.cardTheme.color, GlucoreColors.dark.surfaceCanvas);
    });
  });

  testWidgets('context.glucoreColors resolve a paleta do tema ativo',
      (tester) async {
    late GlucoreColors resolved;
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.dark(),
        home: Builder(
          builder: (context) {
            resolved = context.glucoreColors;
            return const SizedBox.shrink();
          },
        ),
      ),
    );

    expect(resolved.surfaceCanvas, GlucoreColors.dark.surfaceCanvas);
    expect(resolved.ink, GlucoreColors.dark.ink);
  });
}
