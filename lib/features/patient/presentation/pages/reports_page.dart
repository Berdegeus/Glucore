import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../core/theme/app_theme.dart';
import '../cubit/patient_cubit.dart';
import '../cubit/patient_state.dart';
import '../models/patient_models.dart';
import '../widgets/glucore_form_layout.dart';
import '../widgets/glucore_widgets.dart';
import '../widgets/user_app_bar.dart';

class ReportsPage extends StatefulWidget {
  const ReportsPage({super.key});

  @override
  State<ReportsPage> createState() => _ReportsPageState();
}

class _ReportsPageState extends State<ReportsPage> {
  int _rangeDays = 14;

  static const _ranges = [7, 14, 30, 90];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: UserAppBar(title: const Text('Relatórios')),
      body: BlocBuilder<PatientCubit, PatientState>(
        builder: (context, state) {
          final cutoff = DateTime.now().subtract(Duration(days: _rangeDays));
          final readings = state.readings
              .where((r) => r.timestamp.isAfter(cutoff))
              .toList();

          final stats = _computeStats(readings, state.alertSettings);

          return LayoutBuilder(
            builder: (context, constraints) {
              final wide = constraints.maxWidth > GlucoreFormLayout.breakpoint;

              return ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
                children: [
                  _TimeRangeChips(
                    selected: _rangeDays,
                    options: _ranges,
                    onSelect: (d) => setState(() => _rangeDays = d),
                  ),
                  const SizedBox(height: 20),
                  if (readings.isEmpty)
                    const _EmptyReports()
                  else if (!wide) ...[
                    _GmiCard(
                        gmi: stats.gmi, avg: stats.avg, count: readings.length),
                    const SizedBox(height: 20),
                    _TirSection(stats: stats),
                  ] else
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: _GmiCard(
                            gmi: stats.gmi,
                            avg: stats.avg,
                            count: readings.length,
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(child: _TirSection(stats: stats)),
                      ],
                    ),
                ],
              );
            },
          );
        },
      ),
    );
  }

  _ReportStats _computeStats(
      List<GlucoseReadingItem> readings, AlertSettingsModel settings) {
    if (readings.isEmpty) {
      return const _ReportStats(
        avg: 0,
        gmi: 0,
        urgentLowPct: 0,
        lowPct: 0,
        targetPct: 0,
        highPct: 0,
        urgentHighPct: 0,
      );
    }

    final n = readings.length;
    final avg = readings.map((r) => r.value).reduce((a, b) => a + b) / n;
    final gmi = readings.length >= 14 ? 0.0296 * avg + 2.419 : 0.0;

    int urgentLow = 0, low = 0, target = 0, high = 0, urgentHigh = 0;
    for (final r in readings) {
      final zone = glucoseZoneOf(r.value, settings.lowThreshold, settings.highThreshold);
      switch (zone) {
        case GlucoseZone.urgentLow:
          urgentLow++;
        case GlucoseZone.low:
          low++;
        case GlucoseZone.target:
          target++;
        case GlucoseZone.high:
          high++;
        case GlucoseZone.urgentHigh:
          urgentHigh++;
      }
    }

    return _ReportStats(
      avg: avg,
      gmi: gmi,
      urgentLowPct: urgentLow / n * 100,
      lowPct: low / n * 100,
      targetPct: target / n * 100,
      highPct: high / n * 100,
      urgentHighPct: urgentHigh / n * 100,
    );
  }
}

class _ReportStats {
  const _ReportStats({
    required this.avg,
    required this.gmi,
    required this.urgentLowPct,
    required this.lowPct,
    required this.targetPct,
    required this.highPct,
    required this.urgentHighPct,
  });

  final double avg;
  final double gmi;
  final double urgentLowPct;
  final double lowPct;
  final double targetPct;
  final double highPct;
  final double urgentHighPct;
}

class _TimeRangeChips extends StatelessWidget {
  const _TimeRangeChips({
    required this.selected,
    required this.options,
    required this.onSelect,
  });

  final int selected;
  final List<int> options;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: options.map((d) {
        final active = d == selected;
        return Padding(
          padding: const EdgeInsets.only(right: 8),
          child: GestureDetector(
            onTap: () => onSelect(d),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: active ? AppTheme.brandBlue : AppTheme.surfaceCanvas,
                borderRadius: BorderRadius.circular(100),
              ),
              child: Text(
                '${d}d',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: active ? Colors.white : AppTheme.inkMuted,
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}

class _GmiCard extends StatelessWidget {
  const _GmiCard({required this.gmi, required this.avg, required this.count});

  final double gmi;
  final double avg;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppTheme.surfaceCanvas,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'INDICADORES',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppTheme.inkMuted,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Glicose média',
                      style: TextStyle(fontSize: 12, color: AppTheme.inkMuted),
                    ),
                    const SizedBox(height: 4),
                    Text.rich(
                      TextSpan(children: [
                        TextSpan(
                          text: avg.toStringAsFixed(0),
                          style: GoogleFonts.jetBrainsMono(
                            fontSize: 32,
                            fontWeight: FontWeight.w700,
                            color: AppTheme.ink,
                          ),
                        ),
                        const TextSpan(
                          text: ' mg/dL',
                          style: TextStyle(
                              fontSize: 12, color: AppTheme.inkMuted),
                        ),
                      ]),
                    ),
                  ],
                ),
              ),
              if (gmi > 0)
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'GMI estimado',
                        style:
                            TextStyle(fontSize: 12, color: AppTheme.inkMuted),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        gmi.toStringAsFixed(1),
                        style: GoogleFonts.jetBrainsMono(
                          fontSize: 32,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.ink,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            '$count leituras',
            style: const TextStyle(fontSize: 12, color: AppTheme.inkMuted),
          ),
        ],
      ),
    );
  }
}

class _TirSection extends StatelessWidget {
  const _TirSection({required this.stats});
  final _ReportStats stats;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppTheme.surfaceCanvas,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'TEMPO NO ALVO',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppTheme.inkMuted,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 16),
          _TirBar(stats: stats),
          const SizedBox(height: 16),
          _ZoneLegendRow(
            color: AppTheme.zoneUrgentLowBg,
            label: 'Baixo urgente',
            range: '< 54',
            pct: stats.urgentLowPct,
          ),
          _ZoneLegendRow(
            color: AppTheme.zoneLowBg,
            label: 'Baixo',
            range: '54–70',
            pct: stats.lowPct,
          ),
          _ZoneLegendRow(
            color: AppTheme.zoneTargetBg,
            label: 'No alvo',
            range: '70–180',
            pct: stats.targetPct,
          ),
          _ZoneLegendRow(
            color: AppTheme.zoneHighBg,
            label: 'Alto',
            range: '180–250',
            pct: stats.highPct,
          ),
          _ZoneLegendRow(
            color: AppTheme.zoneUrgentHighBg,
            label: 'Alto urgente',
            range: '> 250',
            pct: stats.urgentHighPct,
          ),
        ],
      ),
    );
  }
}

class _TirBar extends StatelessWidget {
  const _TirBar({required this.stats});
  final _ReportStats stats;

  @override
  Widget build(BuildContext context) {
    final segments = [
      (AppTheme.zoneUrgentLowBg, stats.urgentLowPct),
      (AppTheme.zoneLowBg, stats.lowPct),
      (AppTheme.zoneTargetBg, stats.targetPct),
      (AppTheme.zoneHighBg, stats.highPct),
      (AppTheme.zoneUrgentHighBg, stats.urgentHighPct),
    ];

    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: SizedBox(
        height: 20,
        child: Row(
          children: segments.where((s) => s.$2 > 0).map((s) {
            return Expanded(
              flex: (s.$2 * 100).round(),
              child: Container(color: s.$1),
            );
          }).toList(),
        ),
      ),
    );
  }
}

class _ZoneLegendRow extends StatelessWidget {
  const _ZoneLegendRow({
    required this.color,
    required this.label,
    required this.range,
    required this.pct,
  });

  final Color color;
  final String label;
  final String range;
  final double pct;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              label,
              style: const TextStyle(fontSize: 13, color: AppTheme.ink),
            ),
          ),
          Text(
            range,
            style: const TextStyle(fontSize: 12, color: AppTheme.inkMuted),
          ),
          const SizedBox(width: 12),
          SizedBox(
            width: 44,
            child: Text(
              '${pct.toStringAsFixed(0)}%',
              textAlign: TextAlign.end,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: AppTheme.ink,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyReports extends StatelessWidget {
  const _EmptyReports();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Padding(
        padding: EdgeInsets.only(top: 60),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.bar_chart_rounded, size: 48, color: AppTheme.inkMuted),
            SizedBox(height: 12),
            Text(
              'Sem leituras no período',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: AppTheme.inkMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
