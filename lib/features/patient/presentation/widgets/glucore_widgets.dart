import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../core/theme/glucore_colors.dart';
import '../../domain/entities/patient_entities.dart';

enum GlucoseZone { urgentLow, low, target, high, urgentHigh }

GlucoseZone glucoseZoneOf(double value, int lowThreshold, int highThreshold) {
  if (value < 54) return GlucoseZone.urgentLow;
  if (value < lowThreshold) return GlucoseZone.low;
  if (value <= highThreshold) return GlucoseZone.target;
  if (value <= 250) return GlucoseZone.high;
  return GlucoseZone.urgentHigh;
}

extension GlucoseZoneX on GlucoseZone {
  Color bg(BuildContext context) => switch (this) {
        GlucoseZone.urgentLow => context.glucoreColors.zoneUrgentLowBg,
        GlucoseZone.low => context.glucoreColors.zoneLowBg,
        GlucoseZone.target => context.glucoreColors.zoneTargetBg,
        GlucoseZone.high => context.glucoreColors.zoneHighBg,
        GlucoseZone.urgentHigh => context.glucoreColors.zoneUrgentHighBg,
      };

  Color soft(BuildContext context) => switch (this) {
        GlucoseZone.urgentLow => context.glucoreColors.zoneUrgentLowSoft,
        GlucoseZone.low => context.glucoreColors.zoneLowSoft,
        GlucoseZone.target => context.glucoreColors.zoneTargetSoft,
        GlucoseZone.high => context.glucoreColors.zoneHighSoft,
        GlucoseZone.urgentHigh => context.glucoreColors.zoneUrgentHighSoft,
      };

  Color ink(BuildContext context) => switch (this) {
        GlucoseZone.urgentLow => context.glucoreColors.zoneUrgentLowInk,
        GlucoseZone.low => context.glucoreColors.zoneLowInk,
        GlucoseZone.target => context.glucoreColors.zoneTargetInk,
        GlucoseZone.high => context.glucoreColors.zoneHighInk,
        GlucoseZone.urgentHigh => context.glucoreColors.zoneUrgentHighInk,
      };

  String get label => switch (this) {
        GlucoseZone.urgentLow => 'Baixo urgente',
        GlucoseZone.low => 'Abaixo do alvo',
        GlucoseZone.target => 'No alvo',
        GlucoseZone.high => 'Acima do alvo',
        GlucoseZone.urgentHigh => 'Alto urgente',
      };

  Color chartLine(BuildContext context) => switch (this) {
        GlucoseZone.target => context.glucoreColors.zoneTargetBg,
        GlucoseZone.low || GlucoseZone.urgentLow => context.glucoreColors.zoneLowBg,
        GlucoseZone.high || GlucoseZone.urgentHigh => context.glucoreColors.zoneHighBg,
      };
}

// ──────────────────────────────────────────────
// Hero glucose status card
// ──────────────────────────────────────────────
class GlucoreStatusCard extends StatelessWidget {
  const GlucoreStatusCard({
    super.key,
    required this.value,
    required this.zone,
    required this.trend,
    this.sensorId,
    this.updatedAt,
    this.isLive = false,
  });

  final double value;
  final GlucoseZone zone;
  final GlucoseTrend trend;
  final String? sensorId;
  final DateTime? updatedAt;
  final bool isLive;

  @override
  Widget build(BuildContext context) {
    final bg = zone.bg(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 20),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: bg.withValues(alpha: 0.35),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                value.toStringAsFixed(0),
                style: GoogleFonts.jetBrainsMono(
                  fontSize: 64,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                  height: 1,
                ),
              ),
              const SizedBox(width: 8),
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'mg/dL',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.8),
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Icon(_trendIcon(trend), color: Colors.white, size: 18),
                  ],
                ),
              ),
              const Spacer(),
              if (isLive) const _PulsingDot(),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _ZonePill(label: zone.label),
              const Spacer(),
              if (updatedAt != null)
                Text(
                  _timeAgo(updatedAt!),
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.75),
                    fontSize: 12,
                  ),
                ),
            ],
          ),
          if (sensorId != null) ...[
            const SizedBox(height: 6),
            Text(
              sensorId!,
              style: GoogleFonts.jetBrainsMono(
                color: Colors.white.withValues(alpha: 0.55),
                fontSize: 10,
              ),
            ),
          ],
        ],
      ),
    );
  }

  IconData _trendIcon(GlucoseTrend t) => switch (t) {
        GlucoseTrend.rising => Icons.trending_up_rounded,
        GlucoseTrend.falling => Icons.trending_down_rounded,
        GlucoseTrend.stable => Icons.trending_flat_rounded,
      };

  static String _timeAgo(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 2) return 'Agora';
    if (diff.inMinutes < 60) return '${diff.inMinutes} min atrás';
    if (diff.inHours < 24) return '${diff.inHours}h atrás';
    return '${diff.inDays}d atrás';
  }
}

class _ZonePill extends StatelessWidget {
  const _ZonePill({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(100),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _PulsingDot extends StatefulWidget {
  const _PulsingDot();

  @override
  State<_PulsingDot> createState() => _PulsingDotState();
}

class _PulsingDotState extends State<_PulsingDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, __) => Container(
        width: 10,
        height: 10,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.35 + _ctrl.value * 0.65),
          shape: BoxShape.circle,
        ),
      ),
    );
  }
}

// ──────────────────────────────────────────────
// Zone badge (small pill)
// ──────────────────────────────────────────────
class GlucoreZoneBadge extends StatelessWidget {
  const GlucoreZoneBadge({super.key, required this.zone});
  final GlucoseZone zone;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: zone.soft(context),
        borderRadius: BorderRadius.circular(100),
      ),
      child: Text(
        zone.label,
        style: TextStyle(
          color: zone.ink(context),
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

// ──────────────────────────────────────────────
// Pill button
// ──────────────────────────────────────────────
class GlucorePillButton extends StatelessWidget {
  const GlucorePillButton({
    super.key,
    required this.label,
    required this.onTap,
    this.icon,
    this.filled = true,
    this.full = false,
  });

  final String label;
  final VoidCallback? onTap;
  final IconData? icon;
  final bool filled;
  final bool full;

  @override
  Widget build(BuildContext context) {
    final child = icon != null
        ? Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 18),
              const SizedBox(width: 6),
              Text(label),
            ],
          )
        : Text(label);

    final size = full ? const Size.fromHeight(48) : null;
    if (filled) {
      return FilledButton(
        style: FilledButton.styleFrom(minimumSize: size),
        onPressed: onTap,
        child: child,
      );
    }
    return OutlinedButton(
      style: OutlinedButton.styleFrom(minimumSize: size),
      onPressed: onTap,
      child: child,
    );
  }
}

// ──────────────────────────────────────────────
// Section card (key-value list with dividers)
// ──────────────────────────────────────────────
class GlucoreSectionRow {
  const GlucoreSectionRow({
    required this.label,
    required this.value,
    this.onTap,
    this.valueColor,
  });

  final String label;
  final String value;
  final VoidCallback? onTap;
  final Color? valueColor;
}

class GlucoreSectionCard extends StatelessWidget {
  const GlucoreSectionCard({
    super.key,
    this.title,
    required this.rows,
  });

  final String? title;
  final List<GlucoreSectionRow> rows;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (title != null)
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 8),
            child: Text(
              title!.toUpperCase(),
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: context.glucoreColors.inkMuted,
                letterSpacing: 0.8,
              ),
            ),
          ),
        Container(
          decoration: BoxDecoration(
            color: context.glucoreColors.surfaceCanvas,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            children: [
              for (int i = 0; i < rows.length; i++) ...[
                _RowWidget(row: rows[i]),
                if (i < rows.length - 1)
                  const Divider(height: 1, indent: 16, endIndent: 16),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

class _RowWidget extends StatelessWidget {
  const _RowWidget({required this.row});
  final GlucoreSectionRow row;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: row.onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Text(
              row.label,
              style: TextStyle(fontSize: 14, color: context.glucoreColors.inkMuted),
            ),
            const Spacer(),
            Text(
              row.value,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: row.valueColor ?? context.glucoreColors.ink,
              ),
            ),
            if (row.onTap != null) ...[
              const SizedBox(width: 4),
              Icon(Icons.chevron_right, size: 18, color: context.glucoreColors.inkMuted),
            ],
          ],
        ),
      ),
    );
  }
}

// ──────────────────────────────────────────────
// Stat chip (small labeled number box)
// ──────────────────────────────────────────────
class GlucoreStatChip extends StatelessWidget {
  const GlucoreStatChip({
    super.key,
    required this.label,
    required this.value,
    this.unit,
    this.color,
  });

  final String label;
  final String value;
  final String? unit;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        decoration: BoxDecoration(
          color: context.glucoreColors.surfaceCanvas,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                color: context.glucoreColors.inkMuted,
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 4),
            Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text: value,
                    style: GoogleFonts.jetBrainsMono(
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      color: color ?? context.glucoreColors.ink,
                    ),
                  ),
                  if (unit != null)
                    TextSpan(
                      text: ' $unit',
                      style: TextStyle(
                        fontSize: 11,
                        color: context.glucoreColors.inkMuted,
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
