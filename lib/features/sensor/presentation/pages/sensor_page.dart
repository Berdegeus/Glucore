import 'package:flutter/material.dart';

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
    return Scaffold(
      appBar: AppBar(title: const Text('Glucore Sensor MVP')),
      body: AnimatedBuilder(
        animation: widget.controller,
        builder: (context, child) {
          final state = widget.controller.state;
          return Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Status: ${state.status.name}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                const SizedBox(height: 12),
                if (state.failure != null) ...[
                  Text('Error: ${state.failure!.message}', style: const TextStyle(color: Colors.red)),
                  const SizedBox(height: 12),
                ],
                _buildBody(state),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildBody(SensorUiState state) {
    switch (state.status) {
      case SensorConnectionStatus.idle:
      case SensorConnectionStatus.disconnected:
      case SensorConnectionStatus.error:
        return _buildNoSession(state);
      case SensorConnectionStatus.scanning:
      case SensorConnectionStatus.connecting:
        return _buildProgress(state);
      case SensorConnectionStatus.connected:
        return _buildConnected(state);
      case SensorConnectionStatus.warmingUp:
        return _buildWarmup(state);
      case SensorConnectionStatus.readingAvailable:
        return _buildReading(state);
    }
  }

  Widget _buildNoSession(SensorUiState state) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('No active sensor session.', style: TextStyle(fontSize: 16)),
      const SizedBox(height: 12),
      TextField(controller: _barcodeController, decoration: const InputDecoration(labelText: 'Sensor barcode', border: OutlineInputBorder())),
      const SizedBox(height: 12),
      Row(children: [
        ElevatedButton(onPressed: () => widget.controller.registerSensor(_barcodeController.text.trim()), child: const Text('Register Sensor')),
        const SizedBox(width: 8),
        ElevatedButton(onPressed: widget.controller.clearSession, child: const Text('Reset')),
      ]),
      if (state.session != null) ...[
        const SizedBox(height: 16),
        Text('Registered sensor: ${state.session!.sensorId}'),
      ],
      const SizedBox(height: 16),
      ElevatedButton(onPressed: widget.controller.startMonitoring, child: const Text('Start Monitoring')),
    ]);
  }

  Widget _buildProgress(SensorUiState state) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const CircularProgressIndicator(),
      const SizedBox(height: 16),
      Text('Connecting... (${state.status.name})'),
    ]);
  }

  Widget _buildWarmup(SensorUiState state) {
    final warmup = state.warmupInfo;
    final progress = warmup?.progress ?? 0;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text('Warmup: ${warmup?.elapsed.inSeconds ?? 0}/${warmup?.total.inSeconds ?? 0} sec'),
      const SizedBox(height: 8),
      LinearProgressIndicator(value: progress),
      const SizedBox(height: 24),
      ElevatedButton(onPressed: widget.controller.stopMonitoring, child: const Text('Cancel')),
    ]);
  }

  Widget _buildConnected(SensorUiState state) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Sensor connected. Waiting for warmup/readings.'),
      const SizedBox(height: 12),
      ElevatedButton(onPressed: widget.controller.startMonitoring, child: const Text('Begin Warmup')),
      const SizedBox(height: 8),
      ElevatedButton(onPressed: widget.controller.stopMonitoring, child: const Text('Disconnect')),
    ]);
  }

  Widget _buildReading(SensorUiState state) {
    final reading = state.reading;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      if (reading != null) ...[
        Text('Current Glucose: ${reading.value.toStringAsFixed(1)} mg/dL', style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        Text('Updated: ${reading.timestamp}'),
        const SizedBox(height: 20),
      ],
      ElevatedButton(onPressed: widget.controller.stopMonitoring, child: const Text('Stop Monitoring')),
      const SizedBox(height: 8),
      ElevatedButton(onPressed: widget.controller.clearSession, child: const Text('Clear Session')),
    ]);
  }

  @override
  void dispose() {
    _barcodeController.dispose();
    widget.controller.dispose();
    super.dispose();
  }
}
