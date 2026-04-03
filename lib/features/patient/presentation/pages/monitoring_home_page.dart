import 'package:flutter/material.dart';
import 'package:glucore/l10n/l10n.dart';
import 'package:glucore/l10n/localized_values.dart';

import '../../../../core/theme/app_theme.dart';
import '../mocks/patient_mock_store.dart';
import '../models/patient_models.dart';
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
                MaterialPageRoute(builder: (_) => const SensorLinkPage()),
              );
            },
            icon: const Icon(Icons.bluetooth_searching),
          ),
        ],
      ),
      body: ValueListenableBuilder<List<GlucoseReadingItem>>(
        valueListenable: PatientMockStore.readings,
        builder: (context, readings, _) {
          if (readings.isEmpty) {
            return EmptyStateView(
              title: l10n.monitoringEmptyStateTitle,
              message: l10n.monitoringEmptyStateMessage,
              icon: Icons.sensors_off_outlined,
            );
          }

          final current = readings.first;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
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
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text(
                            '${current.value}',
                            style: Theme.of(context).textTheme.displaySmall
                                ?.copyWith(fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(width: 8),
                          Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: Text(l10n.genericGlucoseUnit),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(current.trend.label(l10n)),
                      const SizedBox(height: 4),
                      Text(
                        l10n.monitoringLastReading(
                          TimeOfDay.fromDateTime(current.timestamp)
                              .format(context),
                        ),
                      ),
                      const SizedBox(height: 6),
                      ValueListenableBuilder<bool>(
                        valueListenable: PatientMockStore.predictionAvailable,
                        builder: (context, prediction, __) {
                          if (!prediction) {
                            return StatusCard(
                              title: l10n.monitoringPredictionUnavailableTitle,
                              subtitle:
                                  l10n.monitoringPredictionUnavailableSubtitle,
                              color: AppTheme.neutralInfo,
                            );
                          }

                          return Text(
                            l10n.monitoringPredictionIn15Minutes(
                              PatientMockStore.predictedIn15Minutes(),
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 10),
              ValueListenableBuilder<SensorConnectionUiState>(
                valueListenable: PatientMockStore.sensorState,
                builder: (context, state, __) {
                  if (state == SensorConnectionUiState.connected) {
                    return StatusCard(
                      title: l10n.monitoringSensorConnectedTitle,
                      subtitle: l10n.monitoringSensorConnectedSubtitle,
                      color: AppTheme.brandPrimary,
                      icon: Icons.check_circle_outline,
                    );
                  }

                  return StatusCard(
                    title: l10n.monitoringSensorDisconnectedTitle,
                    subtitle: l10n.monitoringSensorDisconnectedSubtitle,
                    color: Colors.orange,
                    icon: Icons.portable_wifi_off,
                  );
                },
              ),
              const SizedBox(height: 10),
              ValueListenableBuilder<bool>(
                valueListenable: PatientMockStore.hasRecentReading,
                builder: (context, hasRecent, __) {
                  if (hasRecent) return const SizedBox.shrink();
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: StatusCard(
                      title: l10n.monitoringNoRecentReadingTitle,
                      subtitle: l10n.monitoringNoRecentReadingSubtitle,
                      color: Colors.orange,
                    ),
                  );
                },
              ),
              ValueListenableBuilder<bool>(
                valueListenable: PatientMockStore.syncFailure,
                builder: (context, failed, __) {
                  if (!failed) return const SizedBox.shrink();
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: StatusCard(
                      title: l10n.monitoringSyncFailureTitle,
                      subtitle: l10n.monitoringSyncFailureSubtitle,
                      color: Colors.red,
                    ),
                  );
                },
              ),
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => const CarbEntryPage(),
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
                          MaterialPageRoute(
                            builder: (_) => const InsulinEntryPage(),
                          ),
                        );
                      },
                      icon: const Icon(Icons.vaccines_outlined),
                      label: Text(l10n.monitoringInsulinButton),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Text(
                l10n.monitoringRecentReadingsTitle,
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              ...readings.take(4).map(
                    (reading) => Card(
                      child: ListTile(
                        title: Text(l10n.genericGlucoseValue(reading.value)),
                        subtitle: Text(
                          l10n.monitoringRecentReadingTime(
                            TimeOfDay.fromDateTime(reading.timestamp)
                                .format(context),
                          ),
                        ),
                        trailing: Text(reading.trend.label(l10n)),
                      ),
                    ),
                  ),
            ],
          );
        },
      ),
    );
  }
}
