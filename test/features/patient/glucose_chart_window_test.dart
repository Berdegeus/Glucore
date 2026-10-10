import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/core/theme/app_theme.dart';
import 'package:glucore/core/theme/glucore_colors.dart';
import 'package:glucore/features/patient/domain/entities/patient_entities.dart';
import 'package:glucore/features/patient/presentation/widgets/glucose_chart.dart';

void main() {
  // One reading every 5 minutes over the last 25 hours, newest first (the order
  // the cubit keeps), so every window offered has data.
  List<GlucoseReadingItem> readings({double value = 110, double Function(int)? valueAt}) {
    final now = DateTime.now();
    return [
      for (var m = 0; m <= 25 * 60; m += 5)
        GlucoseReadingItem(
          value: valueAt?.call(m) ?? value,
          timestamp: now.subtract(Duration(minutes: m)),
          trend: GlucoseTrend.stable,
          rate: 0,
        ),
    ];
  }

  Future<void> pumpChart(
    WidgetTester tester,
    List<GlucoseReadingItem> data, {
    int windowHours = 12,
    int low = 70,
    int high = 180,
  }) =>
      tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          home: Scaffold(
            body: GlucoseChart(
              readings: data,
              lowThreshold: low,
              highThreshold: high,
              windowHours: windowHours,
            ),
          ),
        ),
      );

  LineChartData chartData(WidgetTester tester) =>
      tester.widget<LineChart>(find.byType(LineChart)).data;

  int glucoseSpots(WidgetTester tester) =>
      chartData(tester).lineBarsData.first.spots.length;

  testWidgets('the window decides how many points are plotted, thinned for width',
      (tester) async {
    // 5-minute data: nothing to thin up to 12 h, then 10-minute buckets at 24 h.
    final expected = {1: 12, 3: 36, 6: 72, 12: 144, 24: 144};
    for (final entry in expected.entries) {
      await pumpChart(tester, readings(), windowHours: entry.key);
      expect(
        glucoseSpots(tester),
        inInclusiveRange(entry.value - 2, entry.value + 1),
        reason: '${entry.key} h',
      );
    }
  });

  testWidgets('one-minute readings are thinned to a readable number of points',
      (tester) async {
    final now = DateTime.now();
    final perMinute = [
      for (var m = 0; m < 24 * 60; m++)
        GlucoseReadingItem(
          value: 110 + (m % 9).toDouble(),
          timestamp: now.subtract(Duration(minutes: m)),
          trend: GlucoseTrend.stable,
          rate: 0,
        ),
    ];

    for (final hours in [12, 24]) {
      await pumpChart(tester, perMinute, windowHours: hours);
      expect(glucoseSpots(tester), lessThanOrEqualTo(155), reason: '${hours}h');
    }
    // Short windows keep every minute.
    await pumpChart(tester, perMinute, windowHours: 1);
    expect(glucoseSpots(tester), greaterThan(55));
  });

  testWidgets('the dot at the end still shows the real latest reading', (tester) async {
    final now = DateTime.now();
    final data = [
      for (var m = 0; m < 600; m++)
        GlucoseReadingItem(
          value: m == 0 ? 187 : 110,
          timestamp: now.subtract(Duration(minutes: m)),
          trend: GlucoseTrend.stable,
          rate: 0,
        ),
    ];
    await pumpChart(tester, data, windowHours: 12);

    expect(chartData(tester).lineBarsData.first.spots.last.y, 187);
  });

  testWidgets('changing the window replots without rebuilding the page', (tester) async {
    final data = readings();
    await pumpChart(tester, data, windowHours: 12);
    final twelve = glucoseSpots(tester);

    await pumpChart(tester, data, windowHours: 3);
    expect(glucoseSpots(tester), lessThan(twelve));
  });

  testWidgets('the line ends short of the right edge, leaving empty room', (tester) async {
    await pumpChart(tester, readings(), windowHours: 12);

    final data = chartData(tester);
    final lastX = data.lineBarsData.first.spots.last.x;
    expect(data.maxX, greaterThan(lastX));
    final margin12 = data.maxX - lastX;

    await pumpChart(tester, readings(), windowHours: 3);
    final data3 = chartData(tester);
    final margin3 = data3.maxX - data3.lineBarsData.first.spots.last.x;
    expect(margin3, greaterThan(0));
    expect(margin12, greaterThan(margin3), reason: 'the margin scales with the span');
  });

  group('glucose scale fits the data', () {
    testWidgets('a calm curve does not waste the chart on 0..400', (tester) async {
      await pumpChart(tester, readings(valueAt: (m) => 100 + (m % 40)));

      final data = chartData(tester);
      expect(data.maxY, lessThan(260));
      expect(data.minY, greaterThan(0));
      expect(data.maxY - data.minY, lessThan(260));
    });

    testWidgets('a high excursion is never clipped', (tester) async {
      await pumpChart(tester, readings(valueAt: (m) => m < 30 ? 340 : 120));

      expect(chartData(tester).maxY, greaterThanOrEqualTo(340));
    });

    testWidgets('a low excursion is never clipped', (tester) async {
      await pumpChart(tester, readings(valueAt: (m) => m < 30 ? 48 : 120));

      expect(chartData(tester).minY, lessThanOrEqualTo(48));
    });

    testWidgets('a threshold stays in view when the glucose is near it', (tester) async {
      await pumpChart(tester, readings(valueAt: (m) => 150 + (m % 25)));

      final data = chartData(tester);
      expect(data.maxY, greaterThanOrEqualTo(180), reason: 'high threshold');
    });

    testWidgets('a far-off threshold does not squash the curve', (tester) async {
      await pumpChart(
        tester,
        readings(valueAt: (m) => 100 + (m % 20)),
        low: 40,
        high: 400,
      );

      final data = chartData(tester);
      expect(data.maxY, lessThan(300));
    });

    testWidgets('the scale always covers at least 100 mg/dL', (tester) async {
      await pumpChart(tester, readings(value: 120));

      final data = chartData(tester);
      expect(data.maxY - data.minY, greaterThanOrEqualTo(100));
    });
  });

  group('out-of-range parts of the line', () {
    LinearGradient? lineGradient(WidgetTester tester) =>
        chartData(tester).lineBarsData.first.gradient as LinearGradient?;

    testWidgets('go orange above the high threshold and red below the low one',
        (tester) async {
      await pumpChart(
        tester,
        readings(valueAt: (m) => m < 20 ? 230 : (m < 40 ? 55 : 120)),
      );

      final colors = lineGradient(tester)!.colors;
      expect(colors, contains(Colors.orange));
      expect(colors, contains(AppTheme.light().extension<GlucoreColors>()!.zoneLowBg));
      expect(
        colors,
        contains(AppTheme.light().extension<GlucoreColors>()!.zoneTargetBg),
      );
    });

    testWidgets('stops are ordered and the colour changes exactly at the thresholds',
        (tester) async {
      await pumpChart(
        tester,
        readings(valueAt: (m) => m < 20 ? 230 : (m < 40 ? 55 : 120)),
      );

      final gradient = lineGradient(tester)!;
      final stops = gradient.stops!;
      expect(stops.first, 0);
      expect(stops.last, 1);
      for (var i = 1; i < stops.length; i++) {
        expect(stops[i], greaterThanOrEqualTo(stops[i - 1]));
      }
      // Bar spans 55..230; 70 and 180 sit at (70-55)/175 and (180-55)/175.
      expect(stops, anyElement(closeTo(15 / 175, 0.01)));
      expect(stops, anyElement(closeTo(125 / 175, 0.01)));
    });

    testWidgets('a curve entirely in range has no orange or red', (tester) async {
      await pumpChart(tester, readings(valueAt: (m) => 100 + (m % 30)));

      final colors = lineGradient(tester)!.colors;
      expect(colors, isNot(contains(Colors.orange)));
      expect(colors.toSet(), hasLength(1));
    });

    testWidgets('a curve entirely above range is orange throughout', (tester) async {
      await pumpChart(tester, readings(valueAt: (m) => 200 + (m % 30)));

      expect(lineGradient(tester)!.colors.toSet(), {Colors.orange});
    });
  });

  group('touch indicator', () {
    testWidgets('is coloured by the zone of the touched value, not the first gradient colour',
        (tester) async {
      await pumpChart(
        tester,
        readings(valueAt: (m) => m < 20 ? 230 : (m < 40 ? 55 : 120)),
      );
      final colors = AppTheme.light().extension<GlucoreColors>()!;
      final data = chartData(tester);
      final bar = data.lineBarsData.first;

      Color indicatorAt(double value) {
        final index = bar.spots.indexWhere((s) => s.y >= value - 1 && s.y <= value + 1);
        expect(index, isNonNegative, reason: 'a point near $value');
        final result =
            data.lineTouchData.getTouchedSpotIndicator(bar, [index]).single!;
        return result.indicatorBelowLine.color!.withValues(alpha: 1);
      }

      expect(indicatorAt(120), colors.zoneTargetBg.withValues(alpha: 1));
      expect(indicatorAt(230), Colors.orange.withValues(alpha: 1));
      expect(indicatorAt(55), colors.zoneLowBg.withValues(alpha: 1));
    });
  });

  testWidgets('the target band never extends past the visible scale', (tester) async {
    // 1 h of calm glucose: the scale tops out well under the 180 threshold.
    await pumpChart(tester, readings(valueAt: (m) => 110 + (m % 20)), windowHours: 1);

    final data = chartData(tester);
    for (final band in data.rangeAnnotations.horizontalRangeAnnotations) {
      expect(band.y2, lessThanOrEqualTo(data.maxY));
      expect(band.y1, greaterThanOrEqualTo(data.minY));
    }
  });

  testWidgets('too few readings in the window shows the waiting message', (tester) async {
    final sparse = [
      GlucoseReadingItem(
        value: 100,
        timestamp: DateTime.now().subtract(const Duration(hours: 5)),
        trend: GlucoseTrend.stable,
        rate: 0,
      ),
    ];
    await pumpChart(tester, sparse);

    expect(find.text('Aguardando leituras...'), findsOneWidget);
  });
}
