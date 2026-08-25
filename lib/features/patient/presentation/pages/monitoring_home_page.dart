import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:glucore/l10n/l10n.dart';
import 'package:glucore/l10n/localized_values.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../sensor/domain/models.dart';
import '../cubit/patient_cubit.dart';
import '../cubit/patient_state.dart';
import '../models/patient_models.dart';
import '../widgets/glucore_widgets.dart';
import '../widgets/glucose_chart.dart';
import '../widgets/patient_widgets.dart';
import '../widgets/user_app_bar.dart';
import 'carb_edit_page.dart';
import 'insulin_edit_page.dart';
import 'notifications_page.dart';
import 'sensor_choice_page.dart';

class MonitoringHomePage extends StatefulWidget {
  const MonitoringHomePage({super.key});

  @override
  State<MonitoringHomePage> createState() => _MonitoringHomePageState();
}

class _MonitoringHomePageState extends State<MonitoringHomePage> {
  void _showCarbPopup(CarbEntry entry) {
    final l10n = context.l10n;
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetCtx) => BlocProvider.value(
        value: context.read<PatientCubit>(),
        child: _EntryPopupSheet(
          icon: Icons.restaurant_rounded,
          iconColor: AppTheme.zoneTargetBg,
          title: l10n.monitoringCarbPopupTitle(entry.grams),
          subtitle: DateFormat('dd/MM HH:mm').format(entry.time),
          onEdit: () {
            Navigator.pop(sheetCtx);
            Navigator.of(context).push(
              buildPatientScopedRoute(context, CarbEditPage(entry: entry)),
            );
          },
          onDelete: () async {
            final cubit = context.read<PatientCubit>();
            final sheetNav = Navigator.of(sheetCtx);
            final confirmed = await showDialog<bool>(
              context: sheetCtx,
              builder: (ctx) => AlertDialog(
                title: Text(l10n.entryDeleteConfirmTitle),
                content: Text(l10n.entryDeleteConfirmMessage),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(ctx, false),
                    child: Text(l10n.genericCancelButton),
                  ),
                  FilledButton(
                    style:
                        FilledButton.styleFrom(backgroundColor: AppTheme.zoneLowBg),
                    onPressed: () => Navigator.pop(ctx, true),
                    child: Text(l10n.entryDeleteConfirmButton),
                  ),
                ],
              ),
            );
            if (confirmed != true) return;
            sheetNav.pop();
            await cubit.deleteCarbEntry(entry);
          },
        ),
      ),
    );
  }

  void _showInsulinPopup(InsulinEntry entry) {
    final l10n = context.l10n;
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (sheetCtx) => BlocProvider.value(
        value: context.read<PatientCubit>(),
        child: _EntryPopupSheet(
          icon: Icons.vaccines_outlined,
          iconColor: AppTheme.brandBlue,
          title: l10n.monitoringInsulinPopupTitle(
            entry.units.toStringAsFixed(1),
            entry.type.label(l10n),
          ),
          subtitle: DateFormat('dd/MM HH:mm').format(entry.time),
          onEdit: () {
            Navigator.pop(sheetCtx);
            Navigator.of(context).push(
              buildPatientScopedRoute(context, InsulinEditPage(entry: entry)),
            );
          },
          onDelete: () async {
            final cubit = context.read<PatientCubit>();
            final sheetNav = Navigator.of(sheetCtx);
            final confirmed = await showDialog<bool>(
              context: sheetCtx,
              builder: (ctx) => AlertDialog(
                title: Text(l10n.entryDeleteConfirmTitle),
                content: Text(l10n.entryDeleteConfirmMessage),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(ctx, false),
                    child: Text(l10n.genericCancelButton),
                  ),
                  FilledButton(
                    style:
                        FilledButton.styleFrom(backgroundColor: AppTheme.zoneLowBg),
                    onPressed: () => Navigator.pop(ctx, true),
                    child: Text(l10n.entryDeleteConfirmButton),
                  ),
                ],
              ),
            );
            if (confirmed != true) return;
            sheetNav.pop();
            await cubit.deleteInsulinEntry(entry);
          },
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      backgroundColor: AppTheme.surfaceElevated,
      appBar: UserAppBar(
        title: const Text(
          'glucore',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            color: AppTheme.brandBlue,
            letterSpacing: -0.5,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_none_rounded),
            onPressed: () => Navigator.of(context).push(
              buildPatientScopedRoute(context, const NotificationsPage()),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.bluetooth_searching),
            tooltip: l10n.monitoringPairSensorTooltip,
            onPressed: () => Navigator.of(context).push(
              buildPatientScopedRoute(
                context,
                const SensorChoicePage(),
                withSensorCubit: true,
              ),
            ),
          ),
        ],
      ),
      body: BlocBuilder<PatientCubit, PatientState>(
        builder: (context, state) {
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
            children: [
              _buildHero(context, state),
              const SizedBox(height: 16),
              if (state.readings.isNotEmpty) ...[
                _ChartCard(
                  state: state,
                  onCarbTap: _showCarbPopup,
                  onInsulinTap: _showInsulinPopup,
                ),
                const SizedBox(height: 12),
                _StatsRow(state: state),
              ],
              const SizedBox(height: 16),
              _SensorStrip(state: state),
            ],
          );
        },
      ),
    );
  }

  Widget _buildHero(BuildContext context, PatientState state) {
    final current = state.currentReading;
    final sensorState = state.sensorState;

    if (current == null) {
      return _NoSensorCard(sensorStatus: sensorState.status);
    }

    final zone = glucoseZoneOf(
      current.value,
      state.alertSettings.lowThreshold,
      state.alertSettings.highThreshold,
    );

    return GlucoreStatusCard(
      value: current.value,
      zone: zone,
      trend: current.trend,
      sensorId: sensorState.session?.sensorId,
      updatedAt: current.timestamp,
      isLive: state.hasRecentReading,
    );
  }
}

class _EntryPopupSheet extends StatelessWidget {
  const _EntryPopupSheet({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.subtitle,
    required this.onEdit,
    required this.onDelete,
  });

  final IconData icon;
  final Color iconColor;
  final String title;
  final String subtitle;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: iconColor.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: iconColor, size: 22),
              ),
              const SizedBox(width: 14),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.ink,
                    ),
                  ),
                  Text(
                    subtitle,
                    style: const TextStyle(fontSize: 13, color: AppTheme.inkMuted),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: onEdit,
                  icon: const Icon(Icons.edit_outlined, size: 18),
                  label: Text(l10n.entryEditButton),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: onDelete,
                  style:
                      OutlinedButton.styleFrom(foregroundColor: AppTheme.zoneLowBg),
                  icon: const Icon(Icons.delete_outline, size: 18),
                  label: Text(l10n.entryDeleteConfirmButton),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          SizedBox(
            width: double.infinity,
            child: TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(l10n.entryCloseButton),
            ),
          ),
        ],
      ),
    );
  }
}

class _NoSensorCard extends StatelessWidget {
  const _NoSensorCard({required this.sensorStatus});
  final SensorConnectionStatus sensorStatus;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final (icon, title, subtitle, color) = switch (sensorStatus) {
      SensorConnectionStatus.scanning => (
          Icons.search_rounded,
          l10n.monitoringNoSensorScanningTitle,
          l10n.monitoringNoSensorScanningSubtitle,
          AppTheme.brandBlue,
        ),
      SensorConnectionStatus.connecting => (
          Icons.bluetooth_connected,
          l10n.monitoringNoSensorConnectingTitle,
          l10n.monitoringNoSensorConnectingSubtitle,
          AppTheme.brandBlue,
        ),
      SensorConnectionStatus.pairing => (
          Icons.password,
          l10n.monitoringNoSensorPairingTitle,
          l10n.monitoringNoSensorPairingSubtitle,
          AppTheme.brandBlue,
        ),
      SensorConnectionStatus.syncingHistory => (
          Icons.sync_rounded,
          l10n.monitoringNoSensorSyncingTitle,
          l10n.monitoringNoSensorSyncingSubtitle,
          AppTheme.brandBlue,
        ),
      SensorConnectionStatus.warmingUp => (
          Icons.hourglass_bottom_rounded,
          l10n.monitoringNoSensorWarmingTitle,
          l10n.monitoringNoSensorWarmingSubtitle,
          AppTheme.brandAmber,
        ),
      SensorConnectionStatus.error => (
          Icons.error_outline_rounded,
          l10n.monitoringNoSensorErrorTitle,
          l10n.monitoringNoSensorErrorSubtitle,
          AppTheme.zoneLowBg,
        ),
      _ => (
          Icons.sensors_off_rounded,
          l10n.monitoringNoSensorDefaultTitle,
          l10n.monitoringNoSensorDefaultSubtitle,
          AppTheme.inkMuted,
        ),
    };

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 32),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: color,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: const TextStyle(fontSize: 13, color: AppTheme.inkMuted),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ChartCard extends StatelessWidget {
  const _ChartCard({
    required this.state,
    this.onCarbTap,
    this.onInsulinTap,
  });

  final PatientState state;
  final void Function(CarbEntry)? onCarbTap;
  final void Function(InsulinEntry)? onInsulinTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.surfaceCanvas,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: Text(
              context.l10n.monitoringChartSectionTitle,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppTheme.inkMuted,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(0, 4, 8, 12),
            child: GlucoseChart(
              readings: state.readings,
              lowThreshold: state.alertSettings.lowThreshold,
              highThreshold: state.alertSettings.highThreshold,
              carbs: state.carbs,
              insulin: state.insulin,
              onCarbTap: onCarbTap,
              onInsulinTap: onInsulinTap,
            ),
          ),
        ],
      ),
    );
  }
}

class _StatsRow extends StatelessWidget {
  const _StatsRow({required this.state});
  final PatientState state;

  @override
  Widget build(BuildContext context) {
    final readings = state.readings;
    if (readings.isEmpty) return const SizedBox.shrink();

    final avg = readings.map((r) => r.value).reduce((a, b) => a + b) /
        readings.length;

    final inTarget = readings.where((r) {
      return r.value >= state.alertSettings.lowThreshold &&
          r.value <= state.alertSettings.highThreshold;
    }).length;
    final tirPct = (inTarget / readings.length * 100).round();

    final gmi = readings.length >= 14 ? 0.0296 * avg + 2.419 : null;
    final l10n = context.l10n;

    return Row(
      children: [
        GlucoreStatChip(
          label: l10n.monitoringTimeInTargetLabel,
          value: '$tirPct',
          unit: '%',
          color: tirPct >= 70 ? AppTheme.zoneTargetBg : AppTheme.zoneHighBg,
        ),
        const SizedBox(width: 8),
        GlucoreStatChip(
          label: l10n.monitoringAverageLabel,
          value: avg.toStringAsFixed(0),
          unit: l10n.genericGlucoseUnit,
        ),
        if (gmi != null) ...[
          const SizedBox(width: 8),
          GlucoreStatChip(
            label: l10n.monitoringGmiEstimateLabel,
            value: gmi.toStringAsFixed(1),
          ),
        ],
      ],
    );
  }
}

class _SensorStrip extends StatelessWidget {
  const _SensorStrip({required this.state});
  final PatientState state;

  @override
  Widget build(BuildContext context) {
    final session = state.sensorState.session;
    if (session == null) return const SizedBox.shrink();

    final daysUsed = DateTime.now().difference(session.createdAt).inDays;
    final daysLeft = (14 - daysUsed).clamp(0, 14);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: AppTheme.surfaceCanvas,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          const Icon(Icons.sensors, size: 18, color: AppTheme.inkMuted),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              context.l10n.monitoringSensorDaysLeftLabel(
                daysLeft,
                session.sensorId.length > 8
                    ? session.sensorId.substring(0, 8)
                    : session.sensorId,
              ),
              style: const TextStyle(fontSize: 12, color: AppTheme.inkMuted),
            ),
          ),
        ],
      ),
    );
  }
}
