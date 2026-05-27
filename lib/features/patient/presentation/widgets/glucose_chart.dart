import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/patient_models.dart';

sealed class _SelectedMarker {}

class _CarbMarker extends _SelectedMarker {
  _CarbMarker(this.entry, this.px, this.py);
  final CarbEntry entry;
  final double px;
  final double py;
}

class _InsulinMarker extends _SelectedMarker {
  _InsulinMarker(this.entry, this.px, this.py);
  final InsulinEntry entry;
  final double px;
  final double py;
}

class GlucoseChart extends StatefulWidget {
  const GlucoseChart({
    super.key,
    required this.readings,
    required this.lowThreshold,
    required this.highThreshold,
    this.carbs = const [],
    this.insulin = const [],
  });

  final List<GlucoseReadingItem> readings;
  final int lowThreshold;
  final int highThreshold;
  final List<CarbEntry> carbs;
  final List<InsulinEntry> insulin;

  static const double _minY = 40;
  static const double _maxY = 400;

  // Pixel offsets that match fl_chart's internal layout with the given axis config.
  // left = leftTitles.reservedSize, bottom = bottomTitles.reservedSize,
  // top/right match outer Padding applied in the Stack.
  static const double _outerTop = 8;
  static const double _outerRight = 16;
  static const double _leftReserved = 36;
  static const double _bottomReserved = 20;

  @override
  State<GlucoseChart> createState() => _GlucoseChartState();
}

class _GlucoseChartState extends State<GlucoseChart> {
  _SelectedMarker? _selected;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final window = now.subtract(const Duration(hours: 12));

    final points = widget.readings
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
    if (last.value < widget.lowThreshold) {
      lineColor = Colors.red;
    } else if (last.value > widget.highThreshold) {
      lineColor = Colors.orange;
    } else {
      lineColor = Colors.green;
    }

    final spots = points.map((r) {
      final x = r.timestamp.difference(oldest).inMinutes.toDouble();
      return FlSpot(x, r.value);
    }).toList();

    final totalMinutes =
        points.last.timestamp.difference(oldest).inMinutes.toDouble();

    final carbsInWindow = widget.carbs
        .where((c) => c.time.isAfter(window) && !c.time.isAfter(now))
        .toList();
    final insulinInWindow = widget.insulin
        .where((i) => i.time.isAfter(window) && !i.time.isAfter(now))
        .toList();

    return SizedBox(
      height: 180,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final totalWidth = constraints.maxWidth;

          final chartLeft = GlucoseChart._leftReserved;
          final chartTop = GlucoseChart._outerTop;
          final chartWidth =
              totalWidth - GlucoseChart._outerRight - GlucoseChart._leftReserved;
          const chartHeight = 180.0 -
              GlucoseChart._outerTop -
              GlucoseChart._bottomReserved;

          double toPixelX(double dataX) =>
              chartLeft +
              (dataX / (totalMinutes > 0 ? totalMinutes : 1)) * chartWidth;

          double toPixelY(double dataY) =>
              chartTop +
              (1 -
                      (dataY - GlucoseChart._minY) /
                          (GlucoseChart._maxY - GlucoseChart._minY)) *
                  chartHeight;

          double glucoseAtTime(DateTime time) {
            final x = time.difference(oldest).inMinutes.toDouble();
            FlSpot? before, after;
            for (final spot in spots) {
              if (spot.x <= x) before = spot;
              if (spot.x > x && after == null) {
                after = spot;
                break;
              }
            }
            if (before == null && after == null) {
              return (GlucoseChart._minY + GlucoseChart._maxY) / 2;
            }
            if (before == null) return after!.y;
            if (after == null) return before.y;
            final t = (x - before.x) / (after.x - before.x);
            return before.y + t * (after.y - before.y);
          }

          final List<Widget> overlays = [];

          for (final carb in carbsInWindow) {
            final x = carb.time.difference(oldest).inMinutes.toDouble();
            if (x < 0 || x > totalMinutes) continue;
            final py = toPixelY(glucoseAtTime(carb.time));
            final px = toPixelX(x);

            overlays.add(Positioned(
              left: px - 16,
              top: py - 16,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => setState(() {
                  final current = _selected;
                  if (current is _CarbMarker && current.entry == carb) {
                    _selected = null;
                  } else {
                    _selected = _CarbMarker(carb, px, py);
                  }
                }),
                child: const _MarkerCircle(
                  icon: Icons.restaurant,
                  color: Color(0xFF2DB67D),
                ),
              ),
            ));
          }

          for (final ins in insulinInWindow) {
            final x = ins.time.difference(oldest).inMinutes.toDouble();
            if (x < 0 || x > totalMinutes) continue;
            final py = toPixelY(glucoseAtTime(ins.time));
            final px = toPixelX(x);

            overlays.add(Positioned(
              left: px - 16,
              top: py - 16,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => setState(() {
                  final current = _selected;
                  if (current is _InsulinMarker && current.entry == ins) {
                    _selected = null;
                  } else {
                    _selected = _InsulinMarker(ins, px, py);
                  }
                }),
                child: const _MarkerCircle(
                  icon: Icons.water_drop,
                  color: Colors.blueAccent,
                ),
              ),
            ));
          }

          if (_selected != null) {
            final sel = _selected!;
            late double tx, ty;
            late Widget tooltip;

            if (sel is _CarbMarker) {
              tx = sel.px;
              ty = sel.py;
              final label =
                  sel.entry.description.isNotEmpty ? sel.entry.description : 'Carbo';
              tooltip = _MarkerTooltip(
                label: 'CARBO',
                labelColor: const Color(0xFF2DB67D),
                time: sel.entry.time,
                details: '$label · ${sel.entry.grams} g',
              );
            } else {
              final ins = sel as _InsulinMarker;
              tx = ins.px;
              ty = ins.py;
              tooltip = _MarkerTooltip(
                label: 'INSULINA',
                labelColor: Colors.blueAccent,
                time: ins.entry.time,
                details:
                    '${ins.entry.units.toStringAsFixed(1)} U · ${_insulinTypeName(ins.entry.type)}',
              );
            }

            // Place tooltip above marker; flip below if too close to top.
            const tooltipW = 200.0;
            const tooltipH = 72.0;
            double ttLeft = tx - tooltipW / 2;
            double ttTop = ty - tooltipH - 8;
            if (ttLeft < 0) ttLeft = 4;
            if (ttLeft + tooltipW > totalWidth) ttLeft = totalWidth - tooltipW - 4;
            if (ttTop < chartTop) ttTop = ty + 24;

            overlays.add(Positioned(
              left: ttLeft,
              top: ttTop,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => setState(() => _selected = null),
                child: tooltip,
              ),
            ));
          }

          return Stack(
            clipBehavior: Clip.none,
            children: [
              Padding(
                padding: const EdgeInsets.only(
                  right: GlucoseChart._outerRight,
                  top: GlucoseChart._outerTop,
                ),
                child: LineChart(
                  LineChartData(
                    minY: GlucoseChart._minY,
                    maxY: GlucoseChart._maxY,
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
                          y: widget.lowThreshold.toDouble(),
                          color: Colors.red.withValues(alpha: 0.6),
                          strokeWidth: 1,
                          dashArray: [6, 4],
                        ),
                        HorizontalLine(
                          y: widget.highThreshold.toDouble(),
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
                          reservedSize: GlucoseChart._leftReserved,
                          interval: 90,
                          getTitlesWidget: (value, meta) {
                            if (value == GlucoseChart._minY ||
                                value == GlucoseChart._maxY) {
                              return const SizedBox.shrink();
                            }
                            return Text(
                              value.toInt().toString(),
                              style: const TextStyle(
                                  fontSize: 10, color: Colors.grey),
                            );
                          },
                        ),
                      ),
                      bottomTitles: AxisTitles(
                        sideTitles: SideTitles(
                          showTitles: true,
                          reservedSize: GlucoseChart._bottomReserved,
                          interval: totalMinutes > 120 ? 120 : totalMinutes / 2,
                          getTitlesWidget: (value, meta) {
                            final t =
                                oldest.add(Duration(minutes: value.toInt()));
                            return Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Text(
                                DateFormat.Hm().format(t),
                                style: const TextStyle(
                                    fontSize: 9, color: Colors.grey),
                              ),
                            );
                          },
                        ),
                      ),
                      rightTitles: const AxisTitles(
                          sideTitles: SideTitles(showTitles: false)),
                      topTitles: const AxisTitles(
                          sideTitles: SideTitles(showTitles: false)),
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
                          getDotPainter: (spot, _, __, ___) =>
                              FlDotCirclePainter(
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
                    ],
                    lineTouchData: LineTouchData(
                      touchTooltipData: LineTouchTooltipData(
                        getTooltipItems: (touchedSpots) =>
                            touchedSpots.map((s) {
                          final t =
                              oldest.add(Duration(minutes: s.x.toInt()));
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
              ...overlays,
            ],
          );
        },
      ),
    );
  }
}

String _insulinTypeName(InsulinType type) => switch (type) {
      InsulinType.bolus => 'Bólus',
      InsulinType.basal => 'Basal',
      InsulinType.correction => 'Correção',
    };

class _MarkerCircle extends StatelessWidget {
  const _MarkerCircle({required this.icon, required this.color});

  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 32,
      height: 32,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.4),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Icon(icon, color: Colors.white, size: 16),
    );
  }
}

class _MarkerTooltip extends StatelessWidget {
  const _MarkerTooltip({
    required this.label,
    required this.labelColor,
    required this.time,
    required this.details,
  });

  final String label;
  final Color labelColor;
  final DateTime time;
  final String details;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minWidth: 160, maxWidth: 220),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A),
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.3),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: labelColor,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  label,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                DateFormat.Hm().format(time),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            details,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 15,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
