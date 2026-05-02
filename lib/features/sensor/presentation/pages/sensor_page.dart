import 'package:flutter/material.dart';

import '../../../../l10n/app_localizations.dart';
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
    final loc = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(title: Text(loc.appBarTitle)),
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
                  '${loc.statusLabel}: ${state.status.name}',
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 12),
                if (state.failure != null) ...[
                  Text(
                    '${loc.errorLabel}: ${state.failure!.message}',
                    style: const TextStyle(color: Colors.red),
                  ),
                  const SizedBox(height: 12),
                ],
                _buildBody(state, context),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildBody(SensorUiState state, BuildContext context) {
    switch (state.status) {
      case SensorConnectionStatus.idle:
      case SensorConnectionStatus.disconnected:
      case SensorConnectionStatus.error:
        return _buildNoSession(state, context);
      case SensorConnectionStatus.scanning:
      case SensorConnectionStatus.connecting:
        return _buildProgress(state, context);
      case SensorConnectionStatus.connected:
        return _buildLiveConnection(state, context);
      case SensorConnectionStatus.syncingHistory:
        return _buildSyncingHistory(state, context);
      case SensorConnectionStatus.warmingUp:
        return _buildWarmup(state, context);
      case SensorConnectionStatus.readingAvailable:
        return _buildLiveConnection(state, context);
    }
  }

  Widget _buildNoSession(SensorUiState state, BuildContext context) {
    final loc = AppLocalizations.of(context)!;
    if (state.session == null) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(loc.noSessionMessage, style: const TextStyle(fontSize: 16)),
          const SizedBox(height: 12),
          TextField(
            controller: _barcodeController,
            decoration: InputDecoration(
              labelText: loc.sensorBarcodeLabel,
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
                child: Text(loc.registerSensorButton),
              ),
              const SizedBox(width: 8),
              ElevatedButton(
                onPressed: widget.controller.clearSession,
                child: Text(loc.resetButton),
              ),
            ],
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Registered sensor: ${state.session!.sensorId}',
          style: const TextStyle(fontSize: 16),
        ),
        if (state.session!.transmitterId != null) ...[
          const SizedBox(height: 8),
          Text('Transmitter: ${state.session!.transmitterId}'),
        ],
        const SizedBox(height: 12),
        const Text('Sensor is registered locally but not connected.'),
        const SizedBox(height: 12),
        Row(
          children: [
            ElevatedButton(
              onPressed: widget.controller.startMonitoring,
              child: const Text('Connect Sensor'),
            ),
            const SizedBox(width: 8),
            ElevatedButton(
              onPressed: widget.controller.clearSession,
              child: Text(loc.resetButton),
            ),
          ],
        ),
        if (state.reading != null) ...[
          const SizedBox(height: 16),
          Text(
            'Last known glucose: ${state.reading!.value.toStringAsFixed(1)} mg/dL',
          ),
        ],
      ],
    );
  }

  Widget _buildProgress(SensorUiState state, BuildContext context) {
    final message = switch (state.status) {
      SensorConnectionStatus.scanning => 'Searching for registered sensor...',
      SensorConnectionStatus.connecting => 'Connecting to sensor...',
      _ => 'Working...',
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const CircularProgressIndicator(),
        const SizedBox(height: 16),
        Text(message),
        if (state.session != null) ...[
          const SizedBox(height: 8),
          Text('Sensor: ${state.session!.sensorId}'),
        ],
      ],
    );
  }

  Widget _buildWarmup(SensorUiState state, BuildContext context) {
    final warmup = state.warmupInfo;
    final progress = warmup?.progress ?? 0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Warmup: ${warmup?.elapsed.inSeconds ?? 0}/${warmup?.total.inSeconds ?? 0} sec',
        ),
        const SizedBox(height: 8),
        LinearProgressIndicator(value: progress),
        const SizedBox(height: 24),
        ElevatedButton(
          onPressed: widget.controller.stopMonitoring,
          child: const Text('Cancel'),
        ),
      ],
    );
  }

  Widget _buildLiveConnection(SensorUiState state, BuildContext context) {
    final reading = state.reading;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (state.session != null) ...[
          Text('Sensor: ${state.session!.sensorId}'),
          const SizedBox(height: 8),
        ],
        if (reading != null) ...[
          Text(
            'Current Glucose: ${reading.value.toStringAsFixed(1)} mg/dL',
            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Text('Updated: ${reading.timestamp}'),
        ] else ...[
          const Text('Sensor connected. Waiting for first glucose reading.'),
        ],
        const SizedBox(height: 12),
        ElevatedButton(
          onPressed: widget.controller.stopMonitoring,
          child: const Text('Disconnect'),
        ),
      ],
    );
  }

  Widget _buildSyncingHistory(SensorUiState state, BuildContext context) {
    final sync = state.historySyncInfo;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (state.session != null) ...[
          Text('Sensor: ${state.session!.sensorId}'),
          const SizedBox(height: 8),
        ],
        const Text('Connected. Receiving stored sensor values...'),
        if (sync != null) ...[
          const SizedBox(height: 8),
          Text('Values received: ${sync.receivedCount}'),
          if (sync.latestTimestamp != null)
            Text('Latest synced value: ${sync.latestTimestamp}'),
        ],
        const SizedBox(height: 12),
        ElevatedButton(
          onPressed: widget.controller.stopMonitoring,
          child: const Text('Disconnect'),
        ),
      ],
    );
  }

  @override
  void dispose() {
    _barcodeController.dispose();
    super.dispose();
  }
}
