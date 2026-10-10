import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:glucore/l10n/l10n.dart';
import 'package:glucore/l10n/localized_values.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/glucore_colors.dart';
import '../../../sensor/domain/models.dart';
import '../cubit/patient_cubit.dart';
import '../cubit/patient_state.dart';
import '../../domain/entities/patient_entities.dart';
import '../widgets/glucore_widgets.dart';
import '../widgets/glucose_chart.dart';
import '../widgets/glucose_window_selector.dart';
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
          iconColor: context.glucoreColors.zoneTargetBg,
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
                        FilledButton.styleFrom(backgroundColor: context.glucoreColors.zoneLowBg),
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
          iconColor: context.glucoreColors.brandBlue,
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
                        FilledButton.styleFrom(backgroundColor: context.glucoreColors.zoneLowBg),
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
      backgroundColor: context.glucoreColors.surfaceElevated,
      appBar: UserAppBar(
        title: Text(
          'glucore',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w800,
            color: context.glucoreColors.brandBlue,
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
            onPressed: () => _openSensorChoice(context),
          ),
        ],
      ),
      body: BlocBuilder<PatientCubit, PatientState>(
        builder: (context, state) {
          return ListView(
            // Tight vertical rhythm: the sensor strip at the bottom has to clear
            // the + button without needing a scroll.
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
            children: [
              if (state.sensorState.status == SensorConnectionStatus.syncingHistory) ...[
                _HistorySyncCard(info: state.sensorState.historySyncInfo),
                const SizedBox(height: 12),
              ],
              _buildHero(context, state),
              const SizedBox(height: 10),
              if (state.readings.isNotEmpty) ...[
                _ChartCard(
                  state: state,
                  onCarbTap: _showCarbPopup,
                  onInsulinTap: _showInsulinPopup,
                ),
                const SizedBox(height: 8),
                _StatsRow(state: state),
              ],
              const SizedBox(height: 8),
              _SensorStrip(state: state),
            ],
          );
        },
      ),
    );
  }

  void _openSensorChoice(BuildContext context) {
    Navigator.of(context).push(
      buildPatientScopedRoute(
        context,
        const SensorChoicePage(),
        withSensorCubit: true,
      ),
    );
  }

  Widget _buildHero(BuildContext context, PatientState state) {
    final current = state.currentReading;
    final sensorState = state.sensorState;

    if (current == null) {
      return _NoSensorCard(
        sensorStatus: sensorState.status,
        onPairSensor: () => _openSensorChoice(context),
      );
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
      isLive: state.isReadingLive,
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
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: context.glucoreColors.ink,
                    ),
                  ),
                  Text(
                    subtitle,
                    style: TextStyle(fontSize: 13, color: context.glucoreColors.inkMuted),
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
                      OutlinedButton.styleFrom(foregroundColor: context.glucoreColors.zoneLowBg),
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

class _HistorySyncCard extends StatelessWidget {
  const _HistorySyncCard({required this.info});
  final HistorySyncInfo? info;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final colors = context.glucoreColors;
    final progress = info?.progress(DateTime.now());
    final percent = progress == null ? null : (progress * 100).floor();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.brandBlue.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.brandBlue.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.sync_rounded, color: colors.brandBlue, size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  l10n.monitoringHistorySyncTitle,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: colors.brandBlue,
                  ),
                ),
              ),
              if (percent != null)
                Text(
                  '$percent%',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: colors.brandBlue,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(value: progress, minHeight: 6),
          ),
          const SizedBox(height: 8),
          Text(
            l10n.monitoringHistorySyncSubtitle,
            style: TextStyle(fontSize: 12, color: colors.inkMuted),
          ),
        ],
      ),
    );
  }
}

class _NoSensorCard extends StatelessWidget {
  const _NoSensorCard({required this.sensorStatus, required this.onPairSensor});
  final SensorConnectionStatus sensorStatus;
  final VoidCallback onPairSensor;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final (icon, title, subtitle, color) = switch (sensorStatus) {
      SensorConnectionStatus.scanning => (
          Icons.search_rounded,
          l10n.monitoringNoSensorScanningTitle,
          l10n.monitoringNoSensorScanningSubtitle,
          context.glucoreColors.brandBlue,
        ),
      SensorConnectionStatus.connecting => (
          Icons.bluetooth_connected,
          l10n.monitoringNoSensorConnectingTitle,
          l10n.monitoringNoSensorConnectingSubtitle,
          context.glucoreColors.brandBlue,
        ),
      SensorConnectionStatus.pairing => (
          Icons.password,
          l10n.monitoringNoSensorPairingTitle,
          l10n.monitoringNoSensorPairingSubtitle,
          context.glucoreColors.brandBlue,
        ),
      SensorConnectionStatus.syncingHistory => (
          Icons.sync_rounded,
          l10n.monitoringNoSensorSyncingTitle,
          l10n.monitoringNoSensorSyncingSubtitle,
          context.glucoreColors.brandBlue,
        ),
      SensorConnectionStatus.warmingUp => (
          Icons.hourglass_bottom_rounded,
          l10n.monitoringNoSensorWarmingTitle,
          l10n.monitoringNoSensorWarmingSubtitle,
          context.glucoreColors.brandAmber,
        ),
      SensorConnectionStatus.error => (
          Icons.error_outline_rounded,
          l10n.monitoringNoSensorErrorTitle,
          l10n.monitoringNoSensorErrorSubtitle,
          context.glucoreColors.zoneLowBg,
        ),
      _ => (
          Icons.sensors_off_rounded,
          l10n.monitoringNoSensorDefaultTitle,
          l10n.monitoringNoSensorDefaultSubtitle,
          context.glucoreColors.inkMuted,
        ),
    };

    // Busy states (scanning, connecting, syncing...) are already doing
    // something; only the idle and error states need to push the user to pair.
    final needsAction = sensorStatus == SensorConnectionStatus.error ||
        !const {
          SensorConnectionStatus.scanning,
          SensorConnectionStatus.connecting,
          SensorConnectionStatus.pairing,
          SensorConnectionStatus.syncingHistory,
          SensorConnectionStatus.warmingUp,
        }.contains(sensorStatus);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
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
                      style: TextStyle(fontSize: 13, color: context.glucoreColors.inkMuted),
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (needsAction) ...[
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: onPairSensor,
                icon: const Icon(Icons.add_rounded, size: 20),
                label: Text(l10n.monitoringNoSensorPairButton),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ChartCard extends StatefulWidget {
  const _ChartCard({required this.state, this.onCarbTap, this.onInsulinTap});

  final PatientState state;
  final void Function(CarbEntry)? onCarbTap;
  final void Function(InsulinEntry)? onInsulinTap;

  @override
  State<_ChartCard> createState() => _ChartCardState();
}

class _ChartCardState extends State<_ChartCard> {
  /// Look-back windows offered above the chart, in hours.
  static const _windowOptions = [1, 3, 6, 12, 24];

  int _windowHours = 12;

  PatientState get state => widget.state;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: context.glucoreColors.surfaceCanvas,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 12, 0),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    context.l10n.monitoringChartSectionTitle,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: context.glucoreColors.inkMuted,
                    ),
                  ),
                ),
                GlucoseWindowSelector(
                  options: _windowOptions,
                  selected: _windowHours,
                  onChanged: (hours) => setState(() => _windowHours = hours),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(0, 6, 6, 8),
            child: GlucoseChart(
              readings: state.readings,
              lowThreshold: state.alertSettings.lowThreshold,
              highThreshold: state.alertSettings.highThreshold,
              carbs: state.carbs,
              insulin: state.insulin,
              onCarbTap: widget.onCarbTap,
              onInsulinTap: widget.onInsulinTap,
              windowHours: _windowHours,
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
          color: tirPct >= 70 ? context.glucoreColors.zoneTargetBg : context.glucoreColors.zoneHighBg,
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

/// What the sensor strip says about the sensor's remaining life.
///
/// The end comes from the vendor library (see [SensorLife]); while it is not
/// known the label says nothing about time, rather than guess a number of days.
@visibleForTesting
String sensorLifeLabel({
  required AppLocalizations l10n,
  required SensorLife? life,
  required String sensorId,
  required DateTime now,
}) {
  if (life == null) return l10n.monitoringSensorLifeUnknownLabel(sensorId);
  if (life.hasEnded(now)) return l10n.monitoringSensorExpiredLabel(sensorId);
  final left = life.remaining(now);
  if (left < const Duration(days: 1)) {
    // Never "0h": under an hour still reads as one.
    final hours = left.inHours < 1 ? 1 : left.inHours;
    return l10n.monitoringSensorHoursLeftLabel(hours, sensorId);
  }
  return l10n.monitoringSensorDaysLeftLabel(left.inDays, sensorId);
}

class _SensorStrip extends StatelessWidget {
  const _SensorStrip({required this.state});
  final PatientState state;

  @override
  Widget build(BuildContext context) {
    final session = state.sensorState.session;
    if (session == null) return const SizedBox.shrink();

    final l10n = context.l10n;
    final sensorId = session.sensorId.length > 8
        ? session.sensorId.substring(0, 8)
        : session.sensorId;
    final label = sensorLifeLabel(
      l10n: l10n,
      life: state.sensorState.sensorLife,
      sensorId: sensorId,
      now: DateTime.now(),
    );

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: context.glucoreColors.surfaceCanvas,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Icon(Icons.sensors, size: 18, color: context.glucoreColors.inkMuted),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 12,
                color: context.glucoreColors.inkMuted,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
