import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:glucore/l10n/l10n.dart';
import 'package:glucore/l10n/localized_values.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../sensor/domain/models.dart';
import '../../../sensor/presentation/cubit/sensor_cubit.dart';
import '../widgets/patient_widgets.dart';

class SensorLinkPage extends StatefulWidget {
  const SensorLinkPage({super.key});

  @override
  State<SensorLinkPage> createState() => _SensorLinkPageState();
}

class _SensorLinkPageState extends State<SensorLinkPage> {
  final _barcodeController = TextEditingController();

  @override
  void dispose() {
    _barcodeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.sensorLinkTitle)),
      body: BlocBuilder<SensorCubit, SensorUiState>(
        builder: (context, state) {
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _stateCard(context, state),
              const SizedBox(height: 14),
              if (state.failure != null) ...[
                Text(
                  l10n.genericErrorLabel(state.failure!.message),
                  style: const TextStyle(color: Colors.red),
                ),
                const SizedBox(height: 12),
              ],
              if (state.session == null) ...[
                Text(
                  l10n.sensorPageNoActiveSessionMessage,
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _barcodeController,
                  decoration: InputDecoration(
                    labelText: l10n.sensorPageBarcodeLabel,
                  ),
                ),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: () => context.read<SensorCubit>().registerSensor(
                        _barcodeController.text.trim(),
                      ),
                  child: Text(l10n.sensorPageRegisterButton),
                ),
              ] else ...[
                Text(
                  l10n.sensorPageRegisteredSensor(state.session!.sensorId),
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                if (state.session!.transmitterId != null) ...[
                  const SizedBox(height: 8),
                  Text('Transmitter: ${state.session!.transmitterId}'),
                ],
                if (state.status == SensorConnectionStatus.syncingHistory) ...[
                  const SizedBox(height: 12),
                  Text(
                    l10n.sensorLinkSyncingHistorySubtitle(
                      state.historySyncInfo?.receivedCount ?? 0,
                    ),
                  ),
                ],
                if (state.reading != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    l10n.sensorPageCurrentGlucose(
                      state.reading!.value.toStringAsFixed(1),
                    ),
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    l10n.genericUpdatedAtLabel(
                      context.formatShortDateTime(state.reading!.timestamp),
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                if (_canConnect(state.status))
                  FilledButton(
                    onPressed: () => context.read<SensorCubit>().startMonitoring(),
                    child: Text(l10n.sensorPageStartMonitoringButton),
                  ),
                if (_canDisconnect(state.status)) ...[
                  OutlinedButton(
                    onPressed: () => context.read<SensorCubit>().stopMonitoring(),
                    child: Text(l10n.genericDisconnectButton),
                  ),
                ],
                TextButton(
                  onPressed: () => context.read<SensorCubit>().clearSession(),
                  child: Text(l10n.sensorPageClearSessionButton),
                ),
              ],
            ],
          );
        },
      ),
    );
  }

  bool _canConnect(SensorConnectionStatus status) {
    return status == SensorConnectionStatus.idle ||
        status == SensorConnectionStatus.disconnected ||
        status == SensorConnectionStatus.error;
  }

  bool _canDisconnect(SensorConnectionStatus status) {
    return status == SensorConnectionStatus.scanning ||
        status == SensorConnectionStatus.connecting ||
        status == SensorConnectionStatus.connected ||
        status == SensorConnectionStatus.syncingHistory ||
        status == SensorConnectionStatus.readingAvailable ||
        status == SensorConnectionStatus.warmingUp;
  }

  Widget _stateCard(BuildContext context, SensorUiState state) {
    final l10n = context.l10n;
    final status = state.status;

    String subtitle;
    Color color;
    IconData icon;

    switch (status) {
      case SensorConnectionStatus.scanning:
        subtitle = l10n.sensorLinkSearchingSubtitle;
        color = AppTheme.brandSecondary;
        icon = Icons.search;
        break;
      case SensorConnectionStatus.connecting:
        subtitle = l10n.sensorLinkReconnectingSubtitle;
        color = AppTheme.brandSecondary;
        icon = Icons.bluetooth_connected;
        break;
      case SensorConnectionStatus.connected:
        subtitle = l10n.sensorPageConnectedMessage;
        color = AppTheme.brandPrimary;
        icon = Icons.check_circle_outline;
        break;
      case SensorConnectionStatus.syncingHistory:
        subtitle = l10n.sensorLinkSyncingHistorySubtitle(
          state.historySyncInfo?.receivedCount ?? 0,
        );
        color = AppTheme.brandSecondary;
        icon = Icons.sync;
        break;
      case SensorConnectionStatus.readingAvailable:
        subtitle = l10n.sensorLinkConnectedSubtitle;
        color = AppTheme.brandPrimary;
        icon = Icons.monitor_heart_outlined;
        break;
      case SensorConnectionStatus.error:
        subtitle = state.failure?.message ?? l10n.sensorFailureUnknown;
        color = Colors.red;
        icon = Icons.error_outline;
        break;
      case SensorConnectionStatus.idle:
      case SensorConnectionStatus.disconnected:
        subtitle = state.session == null
            ? l10n.sensorPageNoActiveSessionMessage
            : l10n.sensorLinkDisconnectedSubtitle;
        color = Colors.orange;
        icon = Icons.portable_wifi_off;
        break;
      case SensorConnectionStatus.warmingUp:
        subtitle = l10n.sensorPageConnectedMessage;
        color = AppTheme.brandSecondary;
        icon = Icons.hourglass_bottom;
        break;
    }

    return StatusCard(
      title: l10n.genericStatusLabel(status.label(l10n)),
      subtitle: subtitle,
      color: color,
      icon: icon,
    );
  }
}
