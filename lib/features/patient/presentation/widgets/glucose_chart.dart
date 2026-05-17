import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/patient_models.dart';

class GlucoseChart extends StatelessWidget {
  const GlucoseChart({
    super.key,
    required this.readings,
    required this.lowThreshold,
    required this.highThreshold,
  });

  final List<GlucoseReadingItem> readings;
  final int lowThreshold;
  final int highThreshold;

  static const double _minY = 40;
  static const double _maxY = 400;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final window = now.subtract(const Duration(hours: 12));

    // oldest → newest, within 12h window
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
    final last = points.last;

    Color lineColor;
    if (last.value < lowThreshold) {
      lineColor = Colors.red;
    } else if (last.value > highThreshold) {
      lineColor = Colors.orange;
    } else {
      lineColor = Colors.green;
    }

    final spots = points.map((r) {
      final x = r.timestamp.difference(oldest).inMinutes.toDouble();
      return FlSpot(x, r.value);
    }).toList();

    final totalMinutes = points.last.timestamp.difference(oldest).inMinutes.toDouble();

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
                color: Colors.grey.withValues(alpha:0.15),
                strokeWidth: 1,
              ),
            ),
            borderData: FlBorderData(show: false),
            extraLinesData: ExtraLinesData(
              horizontalLines: [
                HorizontalLine(
                  y: lowThreshold.toDouble(),
                  color: Colors.red.withValues(alpha:0.6),
                  strokeWidth: 1,
                  dashArray: [6, 4],
                ),
                HorizontalLine(
                  y: highThreshold.toDouble(),
                  color: Colors.orange.withValues(alpha:0.6),
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
                  color: lineColor.withValues(alpha:0.08),
                ),
              ),
            ],
            lineTouchData: LineTouchData(
              touchTooltipData: LineTouchTooltipData(
                getTooltipItems: (spots) => spots.map((s) {
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
