import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/glucore_colors.dart';
import '../../domain/entities/patient_entities.dart';
import '../../../../l10n/l10n.dart';
import '../../../../core/preferences/app_preferences.dart';

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
  });

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
  static const double _minY = 0;
  static const double _maxY = 400;
  static const double _carbMarkerY = 44;
  static const double _insulinMarkerY = 16;
  static const double _leftReserved = 40;
  static const double _rightPadding = 16;
  static const double _minSpanMinutes = 30;

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

    final focal =
        _start + ((prevCenter - _leftReserved) / _plotWidth) * oldSpan;
    final newStart =
        focal - ((curCenter - _leftReserved) / _plotWidth) * newSpan;

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
  Widget build(BuildContext context) {
    final onCarbTap = widget.onCarbTap;
    final onInsulinTap = widget.onInsulinTap;
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
            context.l10n.chartWaitingReadings,
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: Colors.grey),
          ),
        ),
      );
    }

    final oldest = points.first.timestamp;

    Color lineColor;
    final last = points.last;
    if (last.value < lowThreshold) {
      lineColor = context.glucoreColors.zoneLowBg;
    } else if (last.value > highThreshold) {
      lineColor = Colors.orange;
    } else {
      lineColor = context.glucoreColors.zoneTargetBg;
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

    final carbSpots = carbsInWindow.map((c) {
      final x = c.time.difference(oldest).inMinutes.toDouble();
      return FlSpot(x, _carbMarkerY);
    }).toList();

    final insulinSpots = insulinInWindow.map((i) {
      final x = i.time.difference(oldest).inMinutes.toDouble();
      return FlSpot(x, _insulinMarkerY);
    }).toList();

    // Roughly six labels across the visible span, snapped to round times.
    const steps = [5, 10, 15, 30, 60, 120, 180, 240];
    final labelStep = steps.firstWhere(
      (m) => viewSpan / m <= 6,
      orElse: () => steps.last,
    );

    final hasExtras = carbSpots.isNotEmpty || insulinSpots.isNotEmpty;

    return SizedBox(
      height: 240,
      child: Stack(
        children: [
          Padding(
            padding: const EdgeInsets.only(right: _rightPadding, top: 8),
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
                      minY: _minY,
                      maxY: _maxY,
                      minX: viewStart,
                      maxX: viewEnd,
                      clipData: const FlClipData(
                        top: true,
                        bottom: false,
                        left: true,
                        right: true,
                      ),
                      gridData: FlGridData(
                        show: true,
                        drawVerticalLine: false,
                        horizontalInterval: 100,
                        getDrawingHorizontalLine: (value) => FlLine(
                          color: Colors.grey.withValues(alpha: 0.18),
                          strokeWidth: 1,
                          dashArray: [2, 4],
                        ),
                      ),
                      // Soft band for the target range
                      rangeAnnotations: RangeAnnotations(
                        horizontalRangeAnnotations: [
                          HorizontalRangeAnnotation(
                            y1: lowThreshold.toDouble(),
                            y2: highThreshold.toDouble(),
                            color: context.glucoreColors.zoneTargetBg
                                .withValues(alpha: 0.09),
                          ),
                        ],
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
                            interval: 100,
                            getTitlesWidget: (value, meta) {
                              if (value <= _minY || value >= _maxY) {
                                return const SizedBox.shrink();
                              }
                              return SideTitleWidget(
                                axisSide: meta.axisSide,
                                space: 6,
                                child: Text(
                                  context.formatGlucose(value),
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
                            reservedSize: 26,
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
                                  DateFormat.jm(Localizations.localeOf(context).toString())
                                      .format(t),
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
                          barWidth: 3,
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
                              '${context.formatGlucoseWithUnit(s.y)}\n',
                              const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: Colors.white,
                              ),
                              children: [
                                TextSpan(
                                  text: DateFormat.jm(Localizations.localeOf(context).toString())
                                      .format(t),
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
                label: Text(
                  context.l10n.genericResetButton,
                  style: const TextStyle(fontSize: 12),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
