import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:glucore/l10n/l10n.dart';
import 'package:glucore/l10n/localized_values.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../../core/theme/glucore_colors.dart';
import '../../../../core/utils/gs1_barcode.dart';
import '../../../sensor/data/platform/barcode_scanner.dart';
import '../../../sensor/domain/models.dart';
import '../../../sensor/presentation/cubit/sensor_cubit.dart';
import '../widgets/patient_widgets.dart';
import '../widgets/user_app_bar.dart';

class SensorLinkPage extends StatefulWidget {
  const SensorLinkPage({super.key, this.brand = SensorBrand.sibionics});

  /// Brand being registered; drives copy, GS1 normalization and pairing UX.
  final SensorBrand brand;

  @override
  State<SensorLinkPage> createState() => _SensorLinkPageState();
}

class _SensorLinkPageState extends State<SensorLinkPage> {
  final _barcodeController = TextEditingController();
  int _tutorialStep = 0;

  bool get _isAccuChek => widget.brand == SensorBrand.accuchek;

  @override
  void dispose() {
    _barcodeController.dispose();
    super.dispose();
  }

  /// Google's code scanner first (its camera pipeline reads the Sibionics box;
  /// the in-app sheet did not), the `mobile_scanner` sheet when it is
  /// unavailable. The SmartGuide data matrix must be submitted raw; GS1
  /// normalization only applies to Sibionics barcodes.
  Future<String?> _scan() async {
    try {
      final raw = await const GoogleBarcodeScanner().scan();
      if (raw == null) return null;
      return _isAccuChek ? raw : (normalizeGs1Barcode(raw) ?? raw);
    } on BarcodeScannerUnavailable {
      if (!mounted) return null;
      return showModalBottomSheet<String>(
        context: context,
        isScrollControlled: true,
        builder: (_) => _ScannerSheet(normalizeGs1: !_isAccuChek),
      );
    }
  }

  Future<void> _openScanner() async {
    final result = await _scan();
    if (result != null && result.isNotEmpty && mounted) {
      setState(() {
        _barcodeController.text = result;
        _tutorialStep = 2;
      });
      context.read<SensorCubit>().registerSensor(result, brand: widget.brand);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Scaffold(
      appBar: UserAppBar(title: Text(l10n.sensorLinkTitle)),
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
                  style: TextStyle(color: context.glucoreColors.zoneLowBg),
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
    final l10n = context.l10n;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _TutorialStepper(currentStep: _tutorialStep, isAccuChek: _isAccuChek),
        const SizedBox(height: 20),
        if (_tutorialStep == 0) ...[
          FilledButton.icon(
            onPressed: () => setState(() => _tutorialStep = 1),
            icon: const Icon(Icons.navigate_next),
            label: Text(l10n.sensorLinkContinueButton),
          ),
        ] else if (_tutorialStep == 1) ...[
          FilledButton.icon(
            onPressed: _openScanner,
            icon: const Icon(Icons.qr_code_scanner),
            label: Text(l10n.sensorLinkScanBoxButton),
          ),
          const SizedBox(height: 8),
          Center(child: Text(l10n.sensorLinkPasteManuallyLabel)),
          const SizedBox(height: 8),
          TextField(
            controller: _barcodeController,
            decoration: InputDecoration(
              labelText: l10n.sensorLinkCodeLabel,
              hintText: _isAccuChek
                  ? l10n.sensorLinkAccuChekCodeHint
                  : '(01)069...',
            ),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: _barcodeController.text.trim().isNotEmpty
                ? () {
                    context.read<SensorCubit>().registerSensor(
                          _barcodeController.text.trim(),
                          brand: widget.brand,
                        );
                    setState(() => _tutorialStep = 2);
                  }
                : null,
            child: Text(l10n.sensorPageRegisterButton),
          ),
        ] else ...[
          const Center(child: CircularProgressIndicator()),
          const SizedBox(height: 12),
          Center(
            child: Text(
              _isAccuChek
                  ? l10n.sensorLinkWaitingPinBody
                  : l10n.sensorLinkWaitingBluetoothBody,
              textAlign: TextAlign.center,
            ),
          ),
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
                Text(
                  l10n.sensorLinkLinkedTitle,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 4),
                Text(
                  state.session!.sensorId,
                  style: Theme.of(context)
                      .textTheme
                      .bodyMedium
                      ?.copyWith(fontFamily: 'monospace'),
                ),
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
      status == SensorConnectionStatus.pairing ||
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
        color = context.glucoreColors.brandSecondary;
        icon = Icons.search;
        break;
      case SensorConnectionStatus.connecting:
        subtitle = l10n.sensorLinkReconnectingSubtitle;
        color = context.glucoreColors.brandSecondary;
        icon = Icons.bluetooth_connected;
        break;
      case SensorConnectionStatus.pairing:
        subtitle = l10n.sensorLinkPairingSubtitle;
        color = context.glucoreColors.brandSecondary;
        icon = Icons.password;
        break;
      case SensorConnectionStatus.connected:
        subtitle = l10n.sensorPageConnectedMessage;
        color = context.glucoreColors.brandPrimary;
        icon = Icons.check_circle_outline;
        break;
      case SensorConnectionStatus.syncingHistory:
        subtitle = l10n.sensorLinkSyncingHistorySubtitle(
          state.historySyncInfo?.receivedCount ?? 0,
        );
        color = context.glucoreColors.brandSecondary;
        icon = Icons.sync;
        break;
      case SensorConnectionStatus.readingAvailable:
        subtitle = l10n.sensorLinkConnectedSubtitle;
        color = context.glucoreColors.brandPrimary;
        icon = Icons.monitor_heart_outlined;
        break;
      case SensorConnectionStatus.error:
        subtitle = state.failure?.message ?? l10n.sensorFailureUnknown;
        color = context.glucoreColors.zoneLowBg;
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
        color = context.glucoreColors.brandSecondary;
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
  const _TutorialStepper({required this.currentStep, this.isAccuChek = false});
  final int currentStep;
  final bool isAccuChek;

  static List<(IconData, String, String)> _sibionicsSteps(
    AppLocalizations l10n,
  ) => [
    (
      Icons.inventory_2_outlined,
      l10n.sensorLinkSibionicsStep1Title,
      l10n.sensorLinkSibionicsStep1Body,
    ),
    (
      Icons.qr_code_scanner,
      l10n.sensorLinkScanBoxStepTitle,
      l10n.sensorLinkSibionicsStep2Body,
    ),
    (
      Icons.bluetooth_searching,
      l10n.sensorLinkSibionicsStep3Title,
      l10n.sensorLinkSibionicsStep3Body,
    ),
  ];

  static List<(IconData, String, String)> _accuChekSteps(
    AppLocalizations l10n,
  ) => [
    (
      Icons.inventory_2_outlined,
      l10n.sensorLinkAccuChekStep1Title,
      l10n.sensorLinkAccuChekStep1Body,
    ),
    (
      Icons.qr_code_scanner,
      l10n.sensorLinkAccuChekStep2Title,
      l10n.sensorLinkAccuChekStep2Body,
    ),
    (
      Icons.password,
      l10n.sensorLinkAccuChekStep3Title,
      l10n.sensorLinkAccuChekStep3Body,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final steps = isAccuChek ? _accuChekSteps(l10n) : _sibionicsSteps(l10n);
    return Column(
      children: List.generate(steps.length, (i) {
        final (icon, title, subtitle) = steps[i];
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
                                ? context.glucoreColors.brandPrimary
                                : done
                                    ? context.glucoreColors.zoneTargetBg
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
            ? context.glucoreColors.zoneTargetBg
            : active
                ? context.glucoreColors.brandPrimary
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
  const _ScannerSheet({this.normalizeGs1 = true});

  final bool normalizeGs1;

  @override
  State<_ScannerSheet> createState() => _ScannerSheetState();
}

class _ScannerSheetState extends State<_ScannerSheet> {
  final MobileScannerController _controller = MobileScannerController(
    formats: [BarcodeFormat.dataMatrix, BarcodeFormat.qrCode],
    // The default analysis frame is 640x480: a dense UDI data matrix held at a
    // normal distance gets only a few pixels per module there.
    cameraResolution: const Size(1920, 1080),
    autoZoom: true,
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
      final normalized =
          widget.normalizeGs1 ? (normalizeGs1Barcode(raw) ?? raw) : raw;
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
            context.l10n.sensorLinkScanBoxStepTitle,
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
            child: Text(context.l10n.genericCancelButton),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}
