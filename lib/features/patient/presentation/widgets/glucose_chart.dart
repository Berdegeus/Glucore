import 'dart:math' as math;

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/glucore_colors.dart';
import '../../domain/entities/patient_entities.dart';
import '../../domain/glucose_series.dart';

class GlucoseChart extends StatefulWidget {
  const GlucoseChart({
    super.key,
    required this.readings,
    required this.lowThreshold,
    required this.highThreshold,
    this.carbs = const [],
    this.insulin = const [],
    this.onCarbTap,
    this.onInsulinTap,
    this.windowHours = 12,
  });

  /// How far back the chart looks, in hours. Chosen by the card around it.
  final int windowHours;

  final List<GlucoseReadingItem> readings;
  final int lowThreshold;
  final int highThreshold;
  final List<CarbEntry> carbs;
  final List<InsulinEntry> insulin;
  final void Function(CarbEntry)? onCarbTap;
  final void Function(InsulinEntry)? onInsulinTap;

  @override
  State<GlucoseChart> createState() => _GlucoseChartState();
}

class _GlucoseChartState extends State<GlucoseChart> {
  static const double _chartHeight = 300;
  static const double _leftReserved = 34;
  static const double _rightPadding = 6;
  static const double _minSpanMinutes = 30;

  /// Empty room after the newest point, as a fraction of the visible span, so
  /// the end of the line (and its dot) doesn't sit against the chart's edge.
  static const double _rightMargin = 0.06;

  /// Axis steps for the glucose scale, smallest first.
  static const _yIntervals = [10.0, 20.0, 25.0, 50.0, 100.0];

  List<GlucoseReadingItem> get readings => widget.readings;
  int get lowThreshold => widget.lowThreshold;
  int get highThreshold => widget.highThreshold;
  List<CarbEntry> get carbs => widget.carbs;
  List<InsulinEntry> get insulin => widget.insulin;

  // Pinch-zoom state (minutes since the oldest point). `_span == null` = full range.
  double? _span;
  double _start = 0;
  double _totalMinutes = 1;
  double _plotWidth = 1;
  final Map<int, Offset> _pointers = {};

  bool get _zoomed => _span != null;

  void _onPointerMove(PointerMoveEvent e) {
    if (!_pointers.containsKey(e.pointer)) return;
    if (_pointers.length < 2) {
      _pointers[e.pointer] = e.localPosition;
      return;
    }
    final prev = _pointers.values.toList();
    _pointers[e.pointer] = e.localPosition;
    final cur = _pointers.values.toList();

    final prevDist = (prev[0].dx - prev[1].dx).abs().clamp(
      24.0,
      double.infinity,
    );
    final curDist = (cur[0].dx - cur[1].dx).abs().clamp(24.0, double.infinity);
    final prevCenter = (prev[0].dx + prev[1].dx) / 2;
    final curCenter = (cur[0].dx + cur[1].dx) / 2;

    final oldSpan = _span ?? _totalMinutes;
    final minSpan = _minSpanMinutes < _totalMinutes
        ? _minSpanMinutes
        : _totalMinutes;
    final newSpan = (oldSpan * prevDist / curDist).clamp(
      minSpan,
      _totalMinutes,
    );

    // The plot shows the span plus the empty margin on the right.
    const scale = 1 + _rightMargin;
    final focal =
        _start + ((prevCenter - _leftReserved) / _plotWidth) * oldSpan * scale;
    final newStart =
        focal - ((curCenter - _leftReserved) / _plotWidth) * newSpan * scale;

    setState(() {
      if (newSpan >= _totalMinutes - 0.5) {
        _span = null;
        _start = 0;
      } else {
        _span = newSpan.toDouble();
        _start = newStart.clamp(0.0, _totalMinutes - newSpan).toDouble();
      }
    });
  }

  void _resetZoom() => setState(() {
    _span = null;
    _start = 0;
  });

  @override
  void didUpdateWidget(GlucoseChart oldWidget) {
    super.didUpdateWidget(oldWidget);
    // A new window has a different time axis, so a pinch-zoom range from the
    // old one would point at the wrong minutes.
    if (oldWidget.windowHours != widget.windowHours) {
      _span = null;
      _start = 0;
    }
  }

  @override
  Widget build(BuildContext context) {
    final onCarbTap = widget.onCarbTap;
    final onInsulinTap = widget.onInsulinTap;
    final now = DateTime.now();
    final window = now.subtract(Duration(hours: widget.windowHours));

    final rawPoints = readings
        .where((r) => r.timestamp.isAfter(window))
        .toList()
        .reversed
        .toList();

    if (rawPoints.length < 2) {
      return SizedBox(
        height: 180,
        child: Center(
          child: Text(
            'Aguardando leituras...',
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: Colors.grey),
          ),
        ),
      );
    }

    // A wide window of one-minute readings is far more detail than the screen
    // can show: average it down, keeping the real latest reading.
    final points = thinForChart(
      rawPoints,
      bucketMinutes: chartBucketMinutes(widget.windowHours),
    );
    final oldest = points.first.timestamp;

    // Fit the glucose scale to the data instead of a fixed 0..400, so the line
    // uses the whole height. A threshold stays in view while the glucose is
    // within 40 mg/dL of it; far from it, it would only squash the curve.
    var dataMin = double.infinity;
    var dataMax = double.negativeInfinity;
    for (final r in points) {
      dataMin = math.min(dataMin, r.value);
      dataMax = math.max(dataMax, r.value);
    }
    final showLow = lowThreshold >= dataMin - 40;
    final showHigh = highThreshold <= dataMax + 40;
    final rawMin = math.min(dataMin - 15, showLow ? lowThreshold - 25.0 : dataMin);
    final rawMax = math.max(dataMax + 15, showHigh ? highThreshold + 25.0 : dataMax);
    final yInterval = _yIntervals.firstWhere(
      (i) => (rawMax - rawMin) / i <= 7,
      orElse: () => _yIntervals.last,
    );
    final minY = math.max(0.0, (rawMin / yInterval).floorToDouble() * yInterval);
    var maxY = (rawMax / yInterval).ceilToDouble() * yInterval;
    if (maxY - minY < 100) maxY = minY + 100;
    final yRange = maxY - minY;
    // Entry markers ride along the bottom of whatever scale is showing.
    final carbMarkerY = minY + yRange * 0.15;
    final insulinMarkerY = minY + yRange * 0.05;

    Color lineColor;
    final last = points.last;
    if (last.value < lowThreshold) {
      lineColor = context.glucoreColors.zoneLowBg;
    } else if (last.value > highThreshold) {
      lineColor = Colors.orange;
    } else {
      lineColor = context.glucoreColors.zoneTargetBg;
    }

    // The line itself changes colour where it leaves the target range: red
    // below the low threshold, orange above the high one. fl_chart spreads the
    // gradient over the bar's own extent (its lowest to its highest spot), so
    // the stops are fractions of [dataMin, dataMax], not of the axis.
    final lowColor = context.glucoreColors.zoneLowBg;
    final targetColor = context.glucoreColors.zoneTargetBg;
    const highColor = Colors.orange;
    LinearGradient? zoneGradient;
    final dataSpan = dataMax - dataMin;
    if (dataSpan > 0) {
      double fraction(num value) =>
          ((value - dataMin) / dataSpan).clamp(0.0, 1.0).toDouble();
      final lowStop = fraction(lowThreshold);
      final highStop = fraction(highThreshold);
      final colors = <Color>[];
      final stops = <double>[];
      void band(double from, double to, Color color) {
        if (to - from <= 0) return;
        colors.addAll([color, color]);
        stops.addAll([from, to]);
      }

      band(0, lowStop, lowColor);
      band(lowStop, highStop, targetColor);
      band(highStop, 1, highColor);
      if (colors.isNotEmpty) {
        zoneGradient = LinearGradient(
          begin: Alignment.bottomCenter,
          end: Alignment.topCenter,
          colors: colors,
          stops: stops,
        );
      }
    }

    final spots = points.map((r) {
      final x = r.timestamp.difference(oldest).inMinutes.toDouble();
      return FlSpot(x, r.value);
    }).toList();

    // Entries logged after the last sensor reading must stay visible, so the
    // time axis runs up to the newest entry (never past `now`).
    final lastReadingAt = points.last.timestamp;
    bool inWindow(DateTime t) => !t.isBefore(oldest) && !t.isAfter(now);
    final carbsInWindow = carbs.where((c) => inWindow(c.time)).toList();
    final insulinInWindow = insulin.where((i) => inWindow(i.time)).toList();

    var chartEnd = lastReadingAt;
    for (final t in [
      ...carbsInWindow.map((c) => c.time),
      ...insulinInWindow.map((i) => i.time),
    ]) {
      if (t.isAfter(chartEnd)) chartEnd = t;
    }

    final totalMinutes = chartEnd.difference(oldest).inMinutes.toDouble();
    _totalMinutes = totalMinutes > 0 ? totalMinutes : 1;
    final viewSpan = (_span ?? _totalMinutes)
        .clamp(1.0, _totalMinutes)
        .toDouble();
    final viewStart = _start.clamp(0.0, _totalMinutes - viewSpan).toDouble();
    final viewEnd = viewStart + viewSpan;
    // Empty room to the right of the newest point (see [_rightMargin]).
    final viewEndPadded = viewEnd + viewSpan * _rightMargin;

    final carbSpots = carbsInWindow.map((c) {
      final x = c.time.difference(oldest).inMinutes.toDouble();
      return FlSpot(x, carbMarkerY);
    }).toList();

    final insulinSpots = insulinInWindow.map((i) {
      final x = i.time.difference(oldest).inMinutes.toDouble();
      return FlSpot(x, insulinMarkerY);
    }).toList();

    // Roughly six labels across the visible span, snapped to round times.
    const steps = [5, 10, 15, 30, 60, 120, 180, 240, 360, 720];
    final labelStep = steps.firstWhere(
      (m) => viewSpan / m <= 6,
      orElse: () => steps.last,
    );

    final hasExtras = carbSpots.isNotEmpty || insulinSpots.isNotEmpty;

    return SizedBox(
      height: _chartHeight,
      child: Stack(
        children: [
          Padding(
            padding: const EdgeInsets.only(right: _rightPadding, top: 4),
            child: LayoutBuilder(
              builder: (context, constraints) {
                _plotWidth = (constraints.maxWidth - _leftReserved).clamp(
                  1.0,
                  double.infinity,
                );
                return Listener(
                  behavior: HitTestBehavior.translucent,
                  onPointerDown: (e) => _pointers[e.pointer] = e.localPosition,
                  onPointerMove: _onPointerMove,
                  onPointerUp: (e) => _pointers.remove(e.pointer),
                  onPointerCancel: (e) => _pointers.remove(e.pointer),
                  child: LineChart(
                    LineChartData(
                      minY: minY,
                      maxY: maxY,
                      minX: viewStart,
                      maxX: viewEndPadded,
                      clipData: const FlClipData(
                        top: true,
                        bottom: false,
                        left: true,
                        right: true,
                      ),
                      gridData: FlGridData(
                        show: true,
                        drawVerticalLine: false,
                        horizontalInterval: yInterval,
                        getDrawingHorizontalLine: (value) => FlLine(
                          color: Colors.grey.withValues(alpha: 0.18),
                          strokeWidth: 1,
                          dashArray: [2, 4],
                        ),
                      ),
                      borderData: FlBorderData(show: false),
                      extraLinesData: ExtraLinesData(
                        verticalLines: [
                          for (final s in carbSpots)
                            VerticalLine(
                              x: s.x,
                              color: const Color(
                                0xFF05B169,
                              ).withValues(alpha: 0.35),
                              strokeWidth: 1.5,
                              dashArray: [3, 3],
                            ),
                          for (final s in insulinSpots)
                            VerticalLine(
                              x: s.x,
                              color: const Color(
                                0xFF0052FF,
                              ).withValues(alpha: 0.35),
                              strokeWidth: 1.5,
                              dashArray: [3, 3],
                            ),
                        ],
                        horizontalLines: [
                          HorizontalLine(
                            y: lowThreshold.toDouble(),
                            color: context.glucoreColors.zoneLowBg.withValues(
                              alpha: 0.45,
                            ),
                            strokeWidth: 1,
                            dashArray: [6, 4],
                          ),
                          HorizontalLine(
                            y: highThreshold.toDouble(),
                            color: Colors.orange.withValues(alpha: 0.45),
                            strokeWidth: 1,
                            dashArray: [6, 4],
                          ),
                        ],
                      ),
                      titlesData: FlTitlesData(
                        leftTitles: AxisTitles(
                          sideTitles: SideTitles(
                            showTitles: true,
                            reservedSize: _leftReserved,
                            interval: yInterval,
                            getTitlesWidget: (value, meta) {
                              if (value <= minY || value >= maxY) {
                                return const SizedBox.shrink();
                              }
                              return SideTitleWidget(
                                axisSide: meta.axisSide,
                                space: 6,
                                child: Text(
                                  value.toInt().toString(),
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w500,
                                    color: context.glucoreColors.inkMuted,
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                        bottomTitles: AxisTitles(
                          sideTitles: SideTitles(
                            showTitles: true,
                            reservedSize: 22,
                            // Called once per minute; only round times draw.
                            interval: 1,
                            getTitlesWidget: (value, meta) {
                              final t = oldest.add(
                                Duration(minutes: value.toInt()),
                              );
                              if ((t.hour * 60 + t.minute) % labelStep != 0) {
                                return const SizedBox.shrink();
                              }
                              return SideTitleWidget(
                                axisSide: meta.axisSide,
                                space: 8,
                                child: Text(
                                  DateFormat.Hm().format(t),
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w500,
                                    color: context.glucoreColors.inkMuted,
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                        rightTitles: const AxisTitles(
                          sideTitles: SideTitles(showTitles: false),
                        ),
                        topTitles: const AxisTitles(
                          sideTitles: SideTitles(showTitles: false),
                        ),
                      ),
                      lineBarsData: [
                        // Series 0: glucose
                        LineChartBarData(
                          spots: spots,
                          isCurved: true,
                          curveSmoothness: 0.3,
                          color: lineColor,
                          gradient: zoneGradient,
                          barWidth: 2.6,
                          isStrokeCapRound: true,
                          dotData: FlDotData(
                            show: true,
                            checkToShowDot: (spot, _) => spot == spots.last,
                            getDotPainter: (spot, _, __, ___) =>
                                FlDotCirclePainter(
                                  radius: 5,
                                  color: lineColor,
                                  strokeWidth: 2.5,
                                  strokeColor: Colors.white,
                                ),
                          ),
                          belowBarData: BarAreaData(
                            show: true,
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [
                                lineColor.withValues(alpha: 0.22),
                                lineColor.withValues(alpha: 0.0),
                              ],
                            ),
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
                              getDotPainter: (spot, _, __, ___) =>
                                  FlDotCirclePainter(
                                    radius: 9,
                                    color: const Color(0xFF05B169),
                                    strokeWidth: 3,
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
                              getDotPainter: (spot, _, __, ___) =>
                                  FlDotCirclePainter(
                                    radius: 8,
                                    color: const Color(0xFF0052FF),
                                    strokeWidth: 3,
                                    strokeColor: Colors.white,
                                  ),
                            ),
                          ),
                      ],
                      lineTouchData: LineTouchData(
                        touchSpotThreshold: 28,
                        // The default indicator reads the first colour of the
                        // line's gradient (always the "low" red); colour it by
                        // the zone of the value actually touched instead.
                        getTouchedSpotIndicator: (barData, indexes) {
                          final isGlucose = barData.spots.length == spots.length &&
                              identical(barData.spots, spots);
                          return [
                            for (final index in indexes)
                              if (!isGlucose)
                                const TouchedSpotIndicatorData(
                                  FlLine(color: Colors.transparent),
                                  FlDotData(show: false),
                                )
                              else
                                () {
                                  final value = barData.spots[index].y;
                                  final color = value < lowThreshold
                                      ? lowColor
                                      : (value > highThreshold
                                            ? highColor
                                            : targetColor);
                                  return TouchedSpotIndicatorData(
                                    FlLine(
                                      color: color.withValues(alpha: 0.55),
                                      strokeWidth: 2,
                                      dashArray: [4, 4],
                                    ),
                                    FlDotData(
                                      getDotPainter: (spot, _, __, ___) =>
                                          FlDotCirclePainter(
                                            radius: 6,
                                            color: color,
                                            strokeWidth: 2.5,
                                            strokeColor: Colors.white,
                                          ),
                                    ),
                                  );
                                }(),
                          ];
                        },
                        touchCallback: hasExtras
                            ? (event, response) {
                                if (event is! FlTapUpEvent) return;
                                final touchedSpots = response?.lineBarSpots;
                                if (touchedSpots == null) return;
                                for (final spot in touchedSpots) {
                                  // barIndex shifts depending on whether glucose-only list has extras
                                  final carbIndex = 1;
                                  final insulinIndex = carbSpots.isNotEmpty
                                      ? 2
                                      : 1;
                                  if (spot.barIndex == carbIndex &&
                                      carbSpots.isNotEmpty &&
                                      spot.spotIndex < carbsInWindow.length) {
                                    onCarbTap?.call(
                                      carbsInWindow[spot.spotIndex],
                                    );
                                    return;
                                  }
                                  if (spot.barIndex == insulinIndex &&
                                      insulinSpots.isNotEmpty &&
                                      spot.spotIndex < insulinInWindow.length) {
                                    onInsulinTap?.call(
                                      insulinInWindow[spot.spotIndex],
                                    );
                                    return;
                                  }
                                }
                              }
                            : null,
                        touchTooltipData: LineTouchTooltipData(
                          getTooltipColor: (_) =>
                              Colors.black.withValues(alpha: 0.82),
                          tooltipRoundedRadius: 10,
                          tooltipPadding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          getTooltipItems: (touchedSpots) => touchedSpots.map((
                            s,
                          ) {
                            // Only show tooltip for glucose series (index 0)
                            if (s.barIndex != 0) return null;
                            final t = oldest.add(
                              Duration(minutes: s.x.toInt()),
                            );
                            return LineTooltipItem(
                              '${s.y.toStringAsFixed(0)} mg/dL\n',
                              const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: Colors.white,
                              ),
                              children: [
                                TextSpan(
                                  text: DateFormat.Hm().format(t),
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w400,
                                    color: Colors.white70,
                                  ),
                                ),
                              ],
                            );
                          }).toList(),
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          if (_zoomed)
            Positioned(
              top: 0,
              right: 20,
              child: TextButton.icon(
                onPressed: _resetZoom,
                style: TextButton.styleFrom(
                  visualDensity: VisualDensity.compact,
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                ),
                icon: const Icon(Icons.zoom_out_map_rounded, size: 16),
                label: const Text('Reset', style: TextStyle(fontSize: 12)),
              ),
            ),
        ],
      ),
    );
  }
}
