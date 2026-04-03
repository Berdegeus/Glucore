import 'package:flutter/material.dart';
import 'package:glucore/l10n/l10n.dart';
import 'package:glucore/l10n/localized_values.dart';

import '../../domain/models.dart';
import '../controller/sensor_controller.dart';

class SensorPage extends StatefulWidget {
  final SensorController controller;

  const SensorPage({super.key, required this.controller});

  @override
  State<SensorPage> createState() => _SensorPageState();
}

class _SensorPageState extends State<SensorPage> {
  final _barcodeController = TextEditingController();

  @override
  void initState() {
    super.initState();
    widget.controller.init();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.sensorPageTitle)),
      body: AnimatedBuilder(
        animation: widget.controller,
        builder: (context, child) {
          final state = widget.controller.state;
          return Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.genericStatusLabel(state.status.label(l10n)),
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 12),
                if (state.failure != null) ...[
                  Text(
                    l10n.genericErrorLabel(state.failure!.message(l10n)),
                    style: const TextStyle(color: Colors.red),
                  ),
                  const SizedBox(height: 12),
                ],
                _buildBody(context, state),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildBody(BuildContext context, SensorUiState state) {
    switch (state.status) {
      case SensorConnectionStatus.idle:
      case SensorConnectionStatus.disconnected:
      case SensorConnectionStatus.error:
        return _buildNoSession(context, state);
      case SensorConnectionStatus.scanning:
      case SensorConnectionStatus.connecting:
        return _buildProgress(context, state);
      case SensorConnectionStatus.connected:
        return _buildConnected(context);
      case SensorConnectionStatus.warmingUp:
        return _buildWarmup(context, state);
      case SensorConnectionStatus.readingAvailable:
        return _buildReading(context, state);
    }
  }

  Widget _buildNoSession(BuildContext context, SensorUiState state) {
    final l10n = context.l10n;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          l10n.sensorPageNoActiveSessionMessage,
          style: const TextStyle(fontSize: 16),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _barcodeController,
          decoration: InputDecoration(
            labelText: l10n.sensorPageBarcodeLabel,
            border: const OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            ElevatedButton(
              onPressed: () => widget.controller.registerSensor(
                _barcodeController.text.trim(),
              ),
              child: Text(l10n.sensorPageRegisterButton),
            ),
            const SizedBox(width: 8),
            ElevatedButton(
              onPressed: widget.controller.clearSession,
              child: Text(l10n.genericResetButton),
            ),
          ],
        ),
        if (state.session != null) ...[
          const SizedBox(height: 16),
          Text(l10n.sensorPageRegisteredSensor(state.session!.sensorId)),
        ],
        const SizedBox(height: 16),
        ElevatedButton(
          onPressed: widget.controller.startMonitoring,
          child: Text(l10n.sensorPageStartMonitoringButton),
        ),
      ],
    );
  }

  Widget _buildProgress(BuildContext context, SensorUiState state) {
    final l10n = context.l10n;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const CircularProgressIndicator(),
        const SizedBox(height: 16),
        Text(l10n.sensorPageConnecting(state.status.label(l10n))),
      ],
    );
  }

  Widget _buildWarmup(BuildContext context, SensorUiState state) {
    final l10n = context.l10n;
    final warmup = state.warmupInfo;
    final progress = warmup?.progress ?? 0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          l10n.sensorPageWarmupProgress(
            warmup?.elapsed.inSeconds ?? 0,
            warmup?.total.inSeconds ?? 0,
          ),
        ),
        const SizedBox(height: 8),
        LinearProgressIndicator(value: progress),
        const SizedBox(height: 24),
        ElevatedButton(
          onPressed: widget.controller.stopMonitoring,
          child: Text(l10n.genericCancelButton),
        ),
      ],
    );
  }

  Widget _buildConnected(BuildContext context) {
    final l10n = context.l10n;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(l10n.sensorPageConnectedMessage),
        const SizedBox(height: 12),
        ElevatedButton(
          onPressed: widget.controller.startMonitoring,
          child: Text(l10n.sensorPageBeginWarmupButton),
        ),
        const SizedBox(height: 8),
        ElevatedButton(
          onPressed: widget.controller.stopMonitoring,
          child: Text(l10n.genericDisconnectButton),
        ),
      ],
    );
  }

  Widget _buildReading(BuildContext context, SensorUiState state) {
    final l10n = context.l10n;
    final reading = state.reading;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (reading != null) ...[
          Text(
            l10n.sensorPageCurrentGlucose(reading.value.toStringAsFixed(1)),
            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Text(
            l10n.genericUpdatedAtLabel(
              context.formatShortDateTime(reading.timestamp),
            ),
          ),
          const SizedBox(height: 20),
        ],
        ElevatedButton(
          onPressed: widget.controller.stopMonitoring,
          child: Text(l10n.sensorPageStopMonitoringButton),
        ),
        const SizedBox(height: 8),
        ElevatedButton(
          onPressed: widget.controller.clearSession,
          child: Text(l10n.sensorPageClearSessionButton),
        ),
      ],
    );
  }

  @override
  void dispose() {
    _barcodeController.dispose();
    widget.controller.dispose();
    super.dispose();
  }
}
