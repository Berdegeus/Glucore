import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/theme/glucore_colors.dart';
import '../../../sensor/domain/models.dart';
import '../../../sensor/presentation/cubit/sensor_cubit.dart';
import '../widgets/glucore_messenger.dart';
import '../../../../l10n/l10n.dart';

/// FreeStyle Libre 2 pairing flow:
/// 1. install Abbott's algorithm library (extracted from a LibreLink APK);
/// 2. NFC tap to activate the sensor / enable BLE streaming;
/// 3. start BLE monitoring once the sensor is registered.
class LibreNFCPage extends StatefulWidget {
  const LibreNFCPage({super.key});

  @override
  State<LibreNFCPage> createState() => _LibreNFCPageState();
}

class _LibreNFCPageState extends State<LibreNFCPage> {
  AbbottLibraryStatus? _libraryStatus;
  bool _installing = false;
  bool _scanning = false;

  @override
  void initState() {
    super.initState();
    _refreshLibraryStatus();
  }

  @override
  void dispose() {
    if (_scanning) {
      context.read<SensorCubit>().stopNfcScan();
    }
    super.dispose();
  }

  Future<void> _refreshLibraryStatus() async {
    final status = await context.read<SensorCubit>().getAbbottLibraryStatus();
    if (mounted) setState(() => _libraryStatus = status);
  }

  Future<void> _pickAndInstall() async {
    final picked = await FilePicker.pickFiles(type: FileType.any);
    final path = picked?.files.singleOrNull?.path;
    if (path == null || !mounted) return;

    setState(() => _installing = true);
    final ok = await context.read<SensorCubit>().installAbbottLibrary(path);
    if (!mounted) return;
    setState(() => _installing = false);
    if (ok) {
      await _refreshLibraryStatus();
      if (mounted) {
        GlucoreMessenger.success(
          context,
          context.l10n.libreLibraryInstalledSuccess,
        );
      }
    }
  }

  Future<void> _toggleScan() async {
    final cubit = context.read<SensorCubit>();
    if (_scanning) {
      await cubit.stopNfcScan();
      if (mounted) setState(() => _scanning = false);
      return;
    }
    await cubit.startNfcScan();
    if (mounted && cubit.state.failure == null) {
      setState(() => _scanning = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.libreTitle)),
      body: BlocConsumer<SensorCubit, SensorUiState>(
        listenWhen: (prev, next) => prev.nfcInfo != next.nfcInfo,
        listener: (context, state) {
          final result = state.nfcInfo?.result;
          if (result == 'needsLibrary') _refreshLibraryStatus();
          if (result == 'streaming' ||
              result == 'ready' ||
              result == 'activated' ||
              result == 'warmup') {
            // Sensor registered — release the NFC reader.
            context.read<SensorCubit>().stopNfcScan();
            setState(() => _scanning = false);
          }
        },
        builder: (context, state) {
          final libraryInstalled = _libraryStatus?.installed ?? false;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _LibraryCard(
                status: _libraryStatus,
                installing: _installing,
                onInstall: _pickAndInstall,
              ),
              const SizedBox(height: 14),
              _NfcCard(
                enabled: libraryInstalled,
                scanning: _scanning,
                nfcInfo: state.nfcInfo,
                onToggleScan: _toggleScan,
              ),
              const SizedBox(height: 14),
              if (state.failure != null)
                Text(
                  state.failure!.message,
                  style: TextStyle(color: context.glucoreColors.zoneLowBg),
                ),
              if (state.session != null &&
                  state.session!.brand == SensorBrand.libre2) ...[
                const SizedBox(height: 6),
                _SessionCard(state: state),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _LibraryCard extends StatelessWidget {
  const _LibraryCard({
    required this.status,
    required this.installing,
    required this.onInstall,
  });

  final AbbottLibraryStatus? status;
  final bool installing;
  final VoidCallback onInstall;

  @override
  Widget build(BuildContext context) {
    final installed = status?.installed ?? false;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  installed ? Icons.check_circle : Icons.folder_zip_outlined,
                  color: installed ? context.glucoreColors.zoneTargetBg : context.glucoreColors.brandSecondary,
                ),
                const SizedBox(width: 8),
                Text(
                  context.l10n.libreStep1Title,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              installed
                  ? context.l10n.libreLibraryInstalledBody
                  : context.l10n.libreLibraryMissingBody,
              style: Theme.of(context).textTheme.bodySmall,
            ),
            if (!installed) ...[
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: installing ? null : onInstall,
                icon: installing
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.file_open_outlined),
                label: Text(
                  installing
                      ? context.l10n.libreInstallingLabel
                      : context.l10n.libreSelectApkButton,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _NfcCard extends StatelessWidget {
  const _NfcCard({
    required this.enabled,
    required this.scanning,
    required this.nfcInfo,
    required this.onToggleScan,
  });

  final bool enabled;
  final bool scanning;
  final SensorNfcInfo? nfcInfo;
  final VoidCallback onToggleScan;

  String? _resultText(AppLocalizations l10n) => switch (nfcInfo?.result) {
    'activated' => l10n.libreResultActivated,
    'warmup' => l10n.libreResultWarmup,
    'ready' || 'streaming' => l10n.libreResultReady,
    'ended' => l10n.libreResultEnded,
    'needsLibrary' => l10n.libreResultNeedsLibrary,
    'unsupportedLibre3' => l10n.libreResultUnsupportedLibre3,
    'unsupportedUsGen2' => l10n.libreResultUnsupportedUsGen2,
    'readError' => l10n.libreResultReadError,
    'error' => l10n.libreResultError,
    _ => null,
  };

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: enabled ? 1 : 0.5,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(
                    Icons.nfc_rounded,
                    color: scanning ? context.glucoreColors.brandPrimary : context.glucoreColors.inkMuted,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    context.l10n.libreStep2Title,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                scanning
                    ? context.l10n.libreScanningBody
                    : context.l10n.libreIdleBody,
                style: Theme.of(context).textTheme.bodySmall,
              ),
              if (_resultText(context.l10n) != null) ...[
                const SizedBox(height: 10),
                Text(
                  _resultText(context.l10n)!,
                  style: Theme.of(
                    context,
                  ).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                ),
              ],
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: enabled ? onToggleScan : null,
                icon: Icon(scanning ? Icons.stop : Icons.nfc_rounded),
                label: Text(
                  scanning
                      ? context.l10n.libreStopScanButton
                      : context.l10n.libreStartScanButton,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SessionCard extends StatelessWidget {
  const _SessionCard({required this.state});

  final SensorUiState state;

  @override
  Widget build(BuildContext context) {
    final monitoring = state.status == SensorConnectionStatus.scanning ||
        state.status == SensorConnectionStatus.connecting ||
        state.status == SensorConnectionStatus.connected ||
        state.status == SensorConnectionStatus.readingAvailable;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              context.l10n.libreStep3Title,
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
            if (state.reading != null) ...[
              const SizedBox(height: 8),
              Text(
                '${state.reading!.value.toStringAsFixed(0)} mg/dL',
                style: Theme.of(context)
                    .textTheme
                    .headlineMedium
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
            ],
            const SizedBox(height: 12),
            if (!monitoring)
              FilledButton.icon(
                onPressed: () =>
                    context.read<SensorCubit>().startMonitoring(),
                icon: const Icon(Icons.bluetooth_searching),
                label: Text(context.l10n.libreStartMonitoringButton),
              )
            else
              OutlinedButton.icon(
                onPressed: () =>
                    context.read<SensorCubit>().stopMonitoring(),
                icon: const Icon(Icons.bluetooth_disabled),
                label: Text(context.l10n.libreStopMonitoringButton),
              ),
          ],
        ),
      ),
    );
  }
}
