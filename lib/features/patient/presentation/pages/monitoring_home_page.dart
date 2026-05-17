import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:glucore/l10n/l10n.dart';
import 'package:glucore/l10n/localized_values.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../sensor/domain/models.dart';
import '../models/patient_models.dart';
import '../cubit/patient_cubit.dart';
import '../cubit/patient_state.dart';
import '../widgets/glucose_chart.dart';
import '../widgets/patient_widgets.dart';
import 'carb_entry_page.dart';
import 'insulin_entry_page.dart';
import 'sensor_link_page.dart';

class MonitoringHomePage extends StatelessWidget {
  const MonitoringHomePage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.appName),
        actions: [
          IconButton(
            tooltip: l10n.monitoringLinkSensorTooltip,
            onPressed: () {
              Navigator.of(context).push(
                buildPatientScopedRoute(
                  context,
                  const SensorLinkPage(),
                  withSensorCubit: true,
                ),
              );
            },
            icon: const Icon(Icons.bluetooth_searching),
          ),
        ],
      ),
      body: BlocBuilder<PatientCubit, PatientState>(
        builder: (context, state) {
          final current = state.currentReading;

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _buildSensorStatusCard(context, state),
              const SizedBox(height: 10),
              if (current == null)
                EmptyStateView(
                  title: l10n.monitoringEmptyStateTitle,
                  message: l10n.monitoringEmptyStateMessage,
                  icon: Icons.sensors_off_outlined,
                )
              else
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          l10n.monitoringCurrentGlucoseTitle,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 8),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            Text(
                              current.value.toStringAsFixed(0),
                              style: Theme.of(context).textTheme.displaySmall
                                  ?.copyWith(
                                fontWeight: FontWeight.w700,
                                color: _glucoseColor(
                                  current.value,
                                  state.alertSettings.lowThreshold,
                                  state.alertSettings.highThreshold,
                                ),
                              ),
                            ),
                            const SizedBox(width: 4),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  l10n.genericGlucoseUnit,
                                  style: Theme.of(context).textTheme.bodySmall,
                                ),
                                Text(
                                  current.trend.label(l10n),
                                  style: Theme.of(context).textTheme.bodySmall,
                                ),
                              ],
                            ),
                            const Spacer(),
                            Icon(
                              _trendIcon(current.trend),
                              size: 48,
                              color: _glucoseColor(
                                current.value,
                                state.alertSettings.lowThreshold,
                                state.alertSettings.highThreshold,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          l10n.monitoringLastReading(
                            TimeOfDay.fromDateTime(current.timestamp)
                                .format(context),
                          ),
                        ),
                        if (!state.hasRecentReading) ...[
                          const SizedBox(height: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: Colors.orange.shade50,
                              borderRadius: BorderRadius.circular(6),
                              border: Border.all(color: Colors.orange.shade200),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.portable_wifi_off,
                                    size: 14, color: Colors.orange.shade700),
                                const SizedBox(width: 6),
                                Text(
                                  l10n.monitoringStaleReadingBadge(
                                    TimeOfDay.fromDateTime(current.timestamp)
                                        .format(context),
                                  ),
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Colors.orange.shade800,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                        const SizedBox(height: 6),
                        StatusCard(
                          title: l10n.monitoringPredictionUnavailableTitle,
                          subtitle: l10n.monitoringPredictionUnavailableSubtitle,
                          color: AppTheme.neutralInfo,
                        ),
                      ],
                    ),
                  ),
                ),
              if (!state.hasRecentReading) ...[
                const SizedBox(height: 10),
                StatusCard(
                  title: l10n.monitoringNoRecentReadingTitle,
                  subtitle: l10n.monitoringNoRecentReadingSubtitle,
                  color: Colors.orange,
                ),
              ],
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () {
                        Navigator.of(context).push(
                          buildPatientScopedRoute(
                            context,
                            const CarbEntryPage(),
                          ),
                        );
                      },
                      icon: const Icon(Icons.restaurant_menu),
                      label: Text(l10n.monitoringCarbButton),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () {
                        Navigator.of(context).push(
                          buildPatientScopedRoute(
                            context,
                            const InsulinEntryPage(),
                          ),
                        );
                      },
                      icon: const Icon(Icons.vaccines_outlined),
                      label: Text(l10n.monitoringInsulinButton),
                    ),
                  ),
                ],
              ),
              if (state.readings.isNotEmpty) ...[
                const SizedBox(height: 14),
                Text(
                  l10n.monitoringRecentReadingsTitle,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(8, 12, 8, 12),
                    child: GlucoseChart(
                      readings: state.readings,
                      lowThreshold: state.alertSettings.lowThreshold,
                      highThreshold: state.alertSettings.highThreshold,
                    ),
                  ),
                ),
              ],
            ],
          );
        },
      ),
    );
  }

  IconData _trendIcon(GlucoseTrend trend) {
    switch (trend) {
      case GlucoseTrend.rising:
        return Icons.arrow_upward_rounded;
      case GlucoseTrend.falling:
        return Icons.arrow_downward_rounded;
      case GlucoseTrend.stable:
        return Icons.arrow_forward_rounded;
    }
  }

  Color _glucoseColor(double value, int low, int high) {
    if (value < low) return AppTheme.warningLow;
    if (value > high) return AppTheme.warningHigh;
    return AppTheme.brandPrimary;
  }

  Widget _buildSensorStatusCard(BuildContext context, PatientState state) {
    final l10n = context.l10n;
    final sensorState = state.sensorState;

    switch (sensorState.status) {
      case SensorConnectionStatus.syncingHistory:
        return StatusCard(
          title: l10n.monitoringReceivingHistoryTitle,
          subtitle: l10n.monitoringReceivingHistorySubtitle(
            sensorState.historySyncInfo?.receivedCount ?? 0,
          ),
          color: AppTheme.brandSecondary,
          icon: Icons.sync,
        );
      case SensorConnectionStatus.connected:
      case SensorConnectionStatus.readingAvailable:
        return StatusCard(
          title: l10n.monitoringSensorConnectedTitle,
          subtitle: l10n.monitoringSensorConnectedSubtitle,
          color: AppTheme.brandPrimary,
          icon: Icons.check_circle_outline,
        );
      case SensorConnectionStatus.scanning:
        return StatusCard(
          title: l10n.sensorStatusScanning,
          subtitle: l10n.sensorLinkSearchingSubtitle,
          color: AppTheme.brandSecondary,
          icon: Icons.search,
        );
      case SensorConnectionStatus.connecting:
        return StatusCard(
          title: l10n.sensorStatusConnecting,
          subtitle: l10n.sensorLinkReconnectingSubtitle,
          color: AppTheme.brandSecondary,
          icon: Icons.bluetooth_connected,
        );
      case SensorConnectionStatus.error:
        return StatusCard(
          title: l10n.monitoringSyncFailureTitle,
          subtitle: sensorState.failure?.message ?? l10n.monitoringSyncFailureSubtitle,
          color: Colors.red,
          icon: Icons.error_outline,
        );
      case SensorConnectionStatus.idle:
      case SensorConnectionStatus.disconnected:
        return StatusCard(
          title: l10n.monitoringSensorDisconnectedTitle,
          subtitle: l10n.monitoringSensorDisconnectedSubtitle,
          color: Colors.orange,
          icon: Icons.portable_wifi_off,
        );
      case SensorConnectionStatus.warmingUp:
        return StatusCard(
          title: l10n.sensorStatusWarmingUp,
          subtitle: l10n.sensorPageConnectedMessage,
          color: AppTheme.brandSecondary,
          icon: Icons.hourglass_bottom,
        );
    }
  }
}
