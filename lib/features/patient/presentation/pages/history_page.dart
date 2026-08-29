import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_theme.dart';
import '../cubit/patient_cubit.dart';
import '../cubit/patient_state.dart';
import '../../domain/entities/patient_entities.dart';
import '../widgets/glucore_widgets.dart';
import '../widgets/user_app_bar.dart';

class HistoryPage extends StatelessWidget {
  const HistoryPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: UserAppBar(title: const Text('Histórico')),
      body: BlocBuilder<PatientCubit, PatientState>(
        builder: (context, state) {
          if (state.readings.isEmpty) {
            return const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.show_chart, size: 48, color: AppTheme.inkMuted),
                  SizedBox(height: 12),
                  Text(
                    'Sem leituras registradas',
                    style: TextStyle(fontSize: 15, color: AppTheme.inkMuted),
                  ),
                ],
              ),
            );
          }

          final byDay = _groupByDay(state.readings);
          final days = byDay.keys.toList()..sort((a, b) => b.compareTo(a));
          final showDays = days.take(7).toList();

          return ListView.builder(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            itemCount: showDays.length,
            itemBuilder: (context, i) {
              final dayKey = showDays[i];
              final dayReadings = byDay[dayKey]!;
              return _DayRow(
                dayKey: dayKey,
                readings: dayReadings,
                settings: state.alertSettings,
              );
            },
          );
        },
      ),
    );
  }

  Map<String, List<GlucoseReadingItem>> _groupByDay(
      List<GlucoseReadingItem> readings) {
    final map = <String, List<GlucoseReadingItem>>{};
    for (final r in readings) {
      final key = DateFormat('yyyy-MM-dd').format(r.timestamp);
      map.putIfAbsent(key, () => []).add(r);
    }
    return map;
  }
}

class _DayRow extends StatelessWidget {
  const _DayRow({
    required this.dayKey,
    required this.readings,
    required this.settings,
  });

  final String dayKey;
  final List<GlucoseReadingItem> readings;
  final AlertSettingsModel settings;

  @override
  Widget build(BuildContext context) {
    final sorted = [...readings]
      ..sort((a, b) => a.timestamp.compareTo(b.timestamp));

    final avg = sorted.map((r) => r.value).reduce((a, b) => a + b) /
        sorted.length;

    final inTarget = sorted
        .where((r) =>
            r.value >= settings.lowThreshold &&
            r.value <= settings.highThreshold)
        .length;
    final tir = (inTarget / sorted.length * 100).round();

    final zone = glucoseZoneOf(avg, settings.lowThreshold, settings.highThreshold);
    final dayLabel = _formatDay(dayKey);

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppTheme.surfaceCanvas,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 72,
            child: Text(
              dayLabel,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppTheme.ink,
              ),
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            width: 110,
            height: 36,
            child: _Sparkline(readings: sorted, settings: settings),
          ),
          const Spacer(),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${avg.toStringAsFixed(0)} mg/dL',
                style: AppTheme.monoStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: zone.chartLine,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                'TIR $tir%',
                style: const TextStyle(fontSize: 11, color: AppTheme.inkMuted),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _formatDay(String key) {
    final dt = DateTime.parse(key);
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final d = DateTime(dt.year, dt.month, dt.day);
    if (d == today) return 'Hoje';
    if (d == today.subtract(const Duration(days: 1))) return 'Ontem';
    return DateFormat('d MMM', 'pt_BR').format(dt);
  }
}

class _Sparkline extends StatelessWidget {
  const _Sparkline({required this.readings, required this.settings});

  final List<GlucoseReadingItem> readings;
  final AlertSettingsModel settings;

  @override
  Widget build(BuildContext context) {
    if (readings.length < 2) {
      return const Center(
        child: Text('—', style: TextStyle(color: AppTheme.inkMuted)),
      );
    }

    final spots = readings.asMap().entries.map((e) {
      return FlSpot(e.key.toDouble(), e.value.value);
    }).toList();

    final lastZone = glucoseZoneOf(
      readings.last.value,
      settings.lowThreshold,
      settings.highThreshold,
    );

    return LineChart(
      LineChartData(
        minY: 40,
        maxY: 400,
        minX: 0,
        maxX: (readings.length - 1).toDouble(),
        clipData: const FlClipData.all(),
        gridData: const FlGridData(show: false),
        titlesData: const FlTitlesData(show: false),
        borderData: FlBorderData(show: false),
        lineTouchData: const LineTouchData(enabled: false),
        lineBarsData: [
          LineChartBarData(
            spots: spots,
            isCurved: true,
            curveSmoothness: 0.3,
            color: lastZone.chartLine,
            barWidth: 1.5,
            dotData: const FlDotData(show: false),
            belowBarData: BarAreaData(
              show: true,
              color: lastZone.chartLine.withValues(alpha: 0.08),
            ),
          ),
        ],
      ),
    );
  }
}
