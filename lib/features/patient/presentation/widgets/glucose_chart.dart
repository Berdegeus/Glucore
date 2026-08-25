import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_theme.dart';
import '../models/patient_models.dart';

class GlucoseChart extends StatelessWidget {
  const GlucoseChart({
    super.key,
    required this.readings,
    required this.lowThreshold,
    required this.highThreshold,
    this.carbs = const [],
    this.insulin = const [],
    this.onCarbTap,
    this.onInsulinTap,
  });

  final List<GlucoseReadingItem> readings;
  final int lowThreshold;
  final int highThreshold;
  final List<CarbEntry> carbs;
  final List<InsulinEntry> insulin;
  final void Function(CarbEntry)? onCarbTap;
  final void Function(InsulinEntry)? onInsulinTap;

  static const double _minY = 40;
  static const double _maxY = 400;
  static const double _carbMarkerY = 55;
  static const double _insulinMarkerY = 47;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final window = now.subtract(const Duration(hours: 12));

    final points = readings
        .where((r) => r.timestamp.isAfter(window))
        .toList()
        .reversed
        .toList();

    if (points.length < 2) {
      return SizedBox(
        height: 180,
        child: Center(
          child: Text(
            'Aguardando leituras...',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Colors.grey,
                ),
          ),
        ),
      );
    }

    final oldest = points.first.timestamp;

    Color lineColor;
    final last = points.last;
    if (last.value < lowThreshold) {
      lineColor = AppTheme.zoneLowBg;
    } else if (last.value > highThreshold) {
      lineColor = Colors.orange;
    } else {
      lineColor = AppTheme.zoneTargetBg;
    }

    final spots = points.map((r) {
      final x = r.timestamp.difference(oldest).inMinutes.toDouble();
      return FlSpot(x, r.value);
    }).toList();

    final totalMinutes = points.last.timestamp.difference(oldest).inMinutes.toDouble();

    // Filter carb/insulin entries to the chart's time window
    final carbsInWindow = carbs
        .where((c) => !c.time.isBefore(oldest) && !c.time.isAfter(points.last.timestamp))
        .toList();
    final insulinInWindow = insulin
        .where((i) => !i.time.isBefore(oldest) && !i.time.isAfter(points.last.timestamp))
        .toList();

    final carbSpots = carbsInWindow.map((c) {
      final x = c.time.difference(oldest).inMinutes.toDouble();
      return FlSpot(x, _carbMarkerY);
    }).toList();

    final insulinSpots = insulinInWindow.map((i) {
      final x = i.time.difference(oldest).inMinutes.toDouble();
      return FlSpot(x, _insulinMarkerY);
    }).toList();

    final hasExtras = carbSpots.isNotEmpty || insulinSpots.isNotEmpty;

    return SizedBox(
      height: 180,
      child: Padding(
        padding: const EdgeInsets.only(right: 16, top: 8),
        child: LineChart(
          LineChartData(
            minY: _minY,
            maxY: _maxY,
            minX: 0,
            maxX: totalMinutes > 0 ? totalMinutes : 1,
            clipData: const FlClipData.all(),
            gridData: FlGridData(
              show: true,
              drawVerticalLine: false,
              horizontalInterval: 90,
              getDrawingHorizontalLine: (value) => FlLine(
                color: Colors.grey.withValues(alpha: 0.15),
                strokeWidth: 1,
              ),
            ),
            borderData: FlBorderData(show: false),
            extraLinesData: ExtraLinesData(
              horizontalLines: [
                HorizontalLine(
                  y: lowThreshold.toDouble(),
                  color: AppTheme.zoneLowBg.withValues(alpha: 0.6),
                  strokeWidth: 1,
                  dashArray: [6, 4],
                ),
                HorizontalLine(
                  y: highThreshold.toDouble(),
                  color: Colors.orange.withValues(alpha: 0.6),
                  strokeWidth: 1,
                  dashArray: [6, 4],
                ),
              ],
            ),
            titlesData: FlTitlesData(
              leftTitles: AxisTitles(
                sideTitles: SideTitles(
                  showTitles: true,
                  reservedSize: 36,
                  interval: 90,
                  getTitlesWidget: (value, meta) {
                    if (value == _minY || value == _maxY) return const SizedBox.shrink();
                    return Text(
                      value.toInt().toString(),
                      style: const TextStyle(fontSize: 10, color: Colors.grey),
                    );
                  },
                ),
              ),
              bottomTitles: AxisTitles(
                sideTitles: SideTitles(
                  showTitles: true,
                  reservedSize: 20,
                  interval: totalMinutes > 120 ? 120 : totalMinutes / 2,
                  getTitlesWidget: (value, meta) {
                    final t = oldest.add(Duration(minutes: value.toInt()));
                    return Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(
                        DateFormat.Hm().format(t),
                        style: const TextStyle(fontSize: 9, color: Colors.grey),
                      ),
                    );
                  },
                ),
              ),
              rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
              topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            ),
            lineBarsData: [
              // Series 0: glucose
              LineChartBarData(
                spots: spots,
                isCurved: true,
                curveSmoothness: 0.3,
                color: lineColor,
                barWidth: 2,
                dotData: FlDotData(
                  show: true,
                  checkToShowDot: (spot, _) => spot == spots.last,
                  getDotPainter: (spot, _, __, ___) => FlDotCirclePainter(
                    radius: 4,
                    color: lineColor,
                    strokeWidth: 0,
                  ),
                ),
                belowBarData: BarAreaData(
                  show: true,
                  color: lineColor.withValues(alpha: 0.08),
                ),
              ),
              // Series 1: carb markers
              if (carbSpots.isNotEmpty)
                LineChartBarData(
                  spots: carbSpots,
                  isCurved: false,
                  barWidth: 0,
                  color: Colors.transparent,
                  dotData: FlDotData(
                    show: true,
                    getDotPainter: (spot, _, __, ___) => FlDotCirclePainter(
                      radius: 6,
                      color: const Color(0xFF05B169),
                      strokeWidth: 1.5,
                      strokeColor: Colors.white,
                    ),
                  ),
                ),
              // Series 2: insulin markers
              if (insulinSpots.isNotEmpty)
                LineChartBarData(
                  spots: insulinSpots,
                  isCurved: false,
                  barWidth: 0,
                  color: Colors.transparent,
                  dotData: FlDotData(
                    show: true,
                    getDotPainter: (spot, _, __, ___) => FlDotCirclePainter(
                      radius: 5,
                      color: const Color(0xFF0052FF),
                      strokeWidth: 1.5,
                      strokeColor: Colors.white,
                    ),
                  ),
                ),
            ],
            lineTouchData: LineTouchData(
              touchCallback: hasExtras
                  ? (event, response) {
                      if (event is! FlTapUpEvent) return;
                      final touchedSpots = response?.lineBarSpots;
                      if (touchedSpots == null) return;
                      for (final spot in touchedSpots) {
                        // barIndex shifts depending on whether glucose-only list has extras
                        final carbIndex = 1;
                        final insulinIndex = carbSpots.isNotEmpty ? 2 : 1;
                        if (spot.barIndex == carbIndex && carbSpots.isNotEmpty &&
                            spot.spotIndex < carbsInWindow.length) {
                          onCarbTap?.call(carbsInWindow[spot.spotIndex]);
                          return;
                        }
                        if (spot.barIndex == insulinIndex && insulinSpots.isNotEmpty &&
                            spot.spotIndex < insulinInWindow.length) {
                          onInsulinTap?.call(insulinInWindow[spot.spotIndex]);
                          return;
                        }
                      }
                    }
                  : null,
              touchTooltipData: LineTouchTooltipData(
                getTooltipItems: (touchedSpots) => touchedSpots.map((s) {
                  // Only show tooltip for glucose series (index 0)
                  if (s.barIndex != 0) return null;
                  final t = oldest.add(Duration(minutes: s.x.toInt()));
                  return LineTooltipItem(
                    '${s.y.toStringAsFixed(0)} mg/dL\n${DateFormat.Hm().format(t)}',
                    const TextStyle(fontSize: 11, color: Colors.white),
                  );
                }).toList(),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
