import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:glucore/l10n/l10n.dart';
import 'package:glucore/l10n/localized_values.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/gs1_barcode.dart';
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
  int _tutorialStep = 0;

  @override
  void dispose() {
    _barcodeController.dispose();
    super.dispose();
  }

  Future<void> _openScanner() async {
    final result = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _ScannerSheet(),
    );
    if (result != null && result.isNotEmpty) {
      setState(() {
        _barcodeController.text = result;
        _tutorialStep = 2;
      });
    }
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
              if (state.session == null)
                _buildSetupFlow(context, state)
              else
                _buildActiveSession(context, state, l10n),
            ],
          );
        },
      ),
    );
  }

  // ── Setup flow ────────────────────────────────────────────────────────────

  Widget _buildSetupFlow(BuildContext context, SensorUiState state) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _TutorialStepper(currentStep: _tutorialStep),
        const SizedBox(height: 20),
        if (_tutorialStep == 0) ...[
          FilledButton.icon(
            onPressed: () => setState(() => _tutorialStep = 1),
            icon: const Icon(Icons.navigate_next),
            label: const Text('Continuar'),
          ),
        ] else if (_tutorialStep == 1) ...[
          FilledButton.icon(
            onPressed: _openScanner,
            icon: const Icon(Icons.qr_code_scanner),
            label: const Text('Escanear código da caixa'),
          ),
          const SizedBox(height: 8),
          const Center(child: Text('ou cole manualmente:')),
          const SizedBox(height: 8),
          TextField(
            controller: _barcodeController,
            decoration: const InputDecoration(
              labelText: 'Código do sensor',
              hintText: '(01)069...',
            ),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: _barcodeController.text.trim().isNotEmpty
                ? () {
                    context
                        .read<SensorCubit>()
                        .registerSensor(_barcodeController.text.trim());
                    setState(() => _tutorialStep = 2);
                  }
                : null,
            child: const Text('Registrar sensor'),
          ),
        ] else ...[
          const Center(child: CircularProgressIndicator()),
          const SizedBox(height: 12),
          const Center(child: Text('Aguardando conexão Bluetooth…')),
        ],
      ],
    );
  }

  // ── Active session ────────────────────────────────────────────────────────

  Widget _buildActiveSession(
      BuildContext context, SensorUiState state, AppLocalizations l10n) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Sensor vinculado',
                    style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 4),
                Text(
                  state.session!.sensorId,
                  style: Theme.of(context)
                      .textTheme
                      .bodyMedium
                      ?.copyWith(fontFamily: 'monospace'),
                ),
                if (state.session!.transmitterId != null) ...[
                  const SizedBox(height: 4),
                  Text('Transmissor: ${state.session!.transmitterId}'),
                ],
                if (state.status == SensorConnectionStatus.syncingHistory) ...[
                  const SizedBox(height: 8),
                  Text(
                    l10n.sensorLinkSyncingHistorySubtitle(
                      state.historySyncInfo?.receivedCount ?? 0,
                    ),
                  ),
                ],
                if (state.reading != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    '${state.reading!.value.toStringAsFixed(0)} mg/dL',
                    style: Theme.of(context)
                        .textTheme
                        .headlineMedium
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                  Text(
                    l10n.genericUpdatedAtLabel(
                      context.formatShortDateTime(state.reading!.timestamp),
                    ),
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        if (_canConnect(state.status))
          FilledButton.icon(
            onPressed: () => context.read<SensorCubit>().startMonitoring(),
            icon: const Icon(Icons.bluetooth_searching),
            label: Text(l10n.sensorPageStartMonitoringButton),
          ),
        if (_canDisconnect(state.status)) ...[
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () => context.read<SensorCubit>().stopMonitoring(),
            icon: const Icon(Icons.bluetooth_disabled),
            label: Text(l10n.genericDisconnectButton),
          ),
        ],
        const SizedBox(height: 8),
        TextButton(
          onPressed: () => context.read<SensorCubit>().clearSession(),
          child: Text(l10n.sensorPageClearSessionButton),
        ),
      ],
    );
  }

  bool _canConnect(SensorConnectionStatus status) =>
      status == SensorConnectionStatus.idle ||
      status == SensorConnectionStatus.disconnected ||
      status == SensorConnectionStatus.error;

  bool _canDisconnect(SensorConnectionStatus status) =>
      status == SensorConnectionStatus.scanning ||
      status == SensorConnectionStatus.connecting ||
      status == SensorConnectionStatus.connected ||
      status == SensorConnectionStatus.syncingHistory ||
      status == SensorConnectionStatus.readingAvailable ||
      status == SensorConnectionStatus.warmingUp;

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

// ── Tutorial stepper ──────────────────────────────────────────────────────────

class _TutorialStepper extends StatelessWidget {
  const _TutorialStepper({required this.currentStep});
  final int currentStep;

  static const _steps = [
    (
      Icons.inventory_2_outlined,
      'Retire o sensor da caixa',
      'Mantenha o código de barras acessível.',
    ),
    (
      Icons.qr_code_scanner,
      'Escaneie o código da caixa',
      'Aponte a câmera para o código data matrix na caixa do sensor.',
    ),
    (
      Icons.bluetooth_searching,
      'Aguarde a conexão Bluetooth',
      'O sensor será detectado e vinculado automaticamente.',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(_steps.length, (i) {
        final (icon, title, subtitle) = _steps[i];
        final done = i < currentStep;
        final active = i == currentStep;
        return Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _StepCircle(index: i, done: done, active: active),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(icon,
                            size: 18,
                            color: active
                                ? AppTheme.brandPrimary
                                : done
                                    ? Colors.green
                                    : Colors.grey),
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(
                            title,
                            style: TextStyle(
                              fontWeight: active
                                  ? FontWeight.w700
                                  : FontWeight.normal,
                              color: done ? Colors.grey : null,
                            ),
                          ),
                        ),
                      ],
                    ),
                    if (active)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          subtitle,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        );
      }),
    );
  }
}

class _StepCircle extends StatelessWidget {
  const _StepCircle(
      {required this.index, required this.done, required this.active});
  final int index;
  final bool done;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 28,
      height: 28,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: done
            ? Colors.green
            : active
                ? AppTheme.brandPrimary
                : Colors.grey.shade300,
      ),
      child: Center(
        child: done
            ? const Icon(Icons.check, size: 16, color: Colors.white)
            : Text(
                '${index + 1}',
                style: TextStyle(
                  color: active ? Colors.white : Colors.grey.shade600,
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
      ),
    );
  }
}

// ── Scanner bottom sheet ──────────────────────────────────────────────────────

class _ScannerSheet extends StatefulWidget {
  const _ScannerSheet();

  @override
  State<_ScannerSheet> createState() => _ScannerSheetState();
}

class _ScannerSheetState extends State<_ScannerSheet> {
  final MobileScannerController _controller = MobileScannerController(
    formats: [BarcodeFormat.dataMatrix, BarcodeFormat.qrCode],
  );
  bool _scanned = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_scanned) return;
    final raw = capture.barcodes.firstOrNull?.rawValue;
    if (raw != null && raw.isNotEmpty) {
      final normalized = normalizeGs1Barcode(raw) ?? raw;
      _scanned = true;
      Navigator.of(context).pop(normalized);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: MediaQuery.of(context).size.height * 0.55,
      child: Column(
        children: [
          const SizedBox(height: 12),
          Text(
            'Escaneie o código da caixa',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 8),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: MobileScanner(
                  controller: _controller,
                  onDetect: _onDetect,
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancelar'),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}
