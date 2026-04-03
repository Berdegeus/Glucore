import 'package:flutter/material.dart';
import 'package:glucore/l10n/l10n.dart';
import 'package:glucore/l10n/localized_values.dart';

import '../../../../core/theme/app_theme.dart';
import '../mocks/patient_mock_store.dart';
import '../models/patient_models.dart';
import '../widgets/patient_widgets.dart';

class SensorLinkPage extends StatelessWidget {
  const SensorLinkPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.sensorLinkTitle)),
      body: ValueListenableBuilder<SensorConnectionUiState>(
        valueListenable: PatientMockStore.sensorState,
        builder: (context, state, _) {
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _stateCard(context, state),
              const SizedBox(height: 14),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: SensorConnectionUiState.values
                    .map(
                      (status) => ActionChip(
                        label: Text(status.label(l10n)),
                        onPressed: () => PatientMockStore.setSensorState(status),
                      ),
                    )
                    .toList(),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () {
                  PatientMockStore.setSensorState(
                    SensorConnectionUiState.reconnecting,
                  );
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(l10n.sensorLinkRebindAttemptMessage),
                    ),
                  );
                },
                child: Text(l10n.sensorLinkRebindButton),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _stateCard(BuildContext context, SensorConnectionUiState state) {
    final l10n = context.l10n;

    switch (state) {
      case SensorConnectionUiState.searching:
        return StatusCard(
          title: l10n.sensorLinkSearchingTitle,
          subtitle: l10n.sensorLinkSearchingSubtitle,
          color: AppTheme.brandSecondary,
        );
      case SensorConnectionUiState.permissionPending:
        return StatusCard(
          title: l10n.sensorLinkPermissionPendingTitle,
          subtitle: l10n.sensorLinkPermissionPendingSubtitle,
          color: Colors.orange,
        );
      case SensorConnectionUiState.connected:
        return StatusCard(
          title: l10n.sensorLinkConnectedTitle,
          subtitle: l10n.sensorLinkConnectedSubtitle,
          color: AppTheme.brandPrimary,
        );
      case SensorConnectionUiState.compatibilityError:
        return StatusCard(
          title: l10n.sensorLinkCompatibilityErrorTitle,
          subtitle: l10n.sensorLinkCompatibilityErrorSubtitle,
          color: Colors.red,
        );
      case SensorConnectionUiState.reconnecting:
        return StatusCard(
          title: l10n.sensorLinkReconnectingTitle,
          subtitle: l10n.sensorLinkReconnectingSubtitle,
          color: AppTheme.brandSecondary,
        );
      case SensorConnectionUiState.unavailable:
        return StatusCard(
          title: l10n.sensorLinkUnavailableTitle,
          subtitle: l10n.sensorLinkUnavailableSubtitle,
          color: AppTheme.neutralInfo,
        );
      case SensorConnectionUiState.disconnected:
        return StatusCard(
          title: l10n.sensorLinkDisconnectedTitle,
          subtitle: l10n.sensorLinkDisconnectedSubtitle,
          color: Colors.orange,
        );
    }
  }
}
