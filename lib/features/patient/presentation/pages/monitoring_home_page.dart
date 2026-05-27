import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/debug/debug_panel.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../sensor/domain/models.dart';
import '../cubit/patient_cubit.dart';
import '../cubit/patient_state.dart';
import '../widgets/glucore_widgets.dart';
import '../widgets/glucose_chart.dart';
import '../widgets/patient_widgets.dart';
import 'notifications_page.dart';
import 'sensor_link_page.dart';

class MonitoringHomePage extends StatefulWidget {
  const MonitoringHomePage({super.key});

  @override
  State<MonitoringHomePage> createState() => _MonitoringHomePageState();
}

class _MonitoringHomePageState extends State<MonitoringHomePage> {
  int _logoTaps = 0;
  DateTime? _firstTapAt;
  static const _tapTarget = 10;
  static const _tapWindow = Duration(seconds: 5);

  void _onLogoTap() {
    if (!kDebugMode) return;
    final now = DateTime.now();
    if (_firstTapAt == null || now.difference(_firstTapAt!) > _tapWindow) {
      _firstTapAt = now;
      _logoTaps = 1;
    } else {
      _logoTaps++;
    }
    if (_logoTaps >= _tapTarget) {
      _logoTaps = 0;
      _firstTapAt = null;
      DebugPanel.show(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.surfaceElevated,
      appBar: AppBar(
        backgroundColor: AppTheme.surfaceCanvas,
        title: GestureDetector(
          onTap: _onLogoTap,
          behavior: HitTestBehavior.opaque,
          child: const Text(
            'glucore',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: AppTheme.brandBlue,
              letterSpacing: -0.5,
            ),
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_none_rounded),
            onPressed: () => Navigator.of(context).push(
              buildPatientScopedRoute(context, const NotificationsPage()),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.bluetooth_searching),
            tooltip: 'Parear sensor',
            onPressed: () => Navigator.of(context).push(
              buildPatientScopedRoute(
                context,
                const SensorLinkPage(),
                withSensorCubit: true,
              ),
            ),
          ),
        ],
      ),
      body: BlocBuilder<PatientCubit, PatientState>(
        builder: (context, state) {
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
            children: [
              _buildHero(context, state),
              const SizedBox(height: 16),
              if (state.readings.isNotEmpty) ...[
                _ChartCard(state: state),
                const SizedBox(height: 12),
                _StatsRow(state: state),
              ],
              const SizedBox(height: 16),
              _SensorStrip(state: state),
            ],
          );
        },
      ),
    );
  }

  Widget _buildHero(BuildContext context, PatientState state) {
    final current = state.currentReading;
    final sensorState = state.sensorState;

    if (current == null) {
      return _NoSensorCard(sensorStatus: sensorState.status);
    }

    final zone = glucoseZoneOf(
      current.value,
      state.alertSettings.lowThreshold,
      state.alertSettings.highThreshold,
    );

    return GlucoreStatusCard(
      value: current.value,
      zone: zone,
      trend: current.trend,
      sensorId: sensorState.session?.sensorId,
      updatedAt: current.timestamp,
      isLive: state.hasRecentReading,
    );
  }
}

class _NoSensorCard extends StatelessWidget {
  const _NoSensorCard({required this.sensorStatus});
  final SensorConnectionStatus sensorStatus;

  @override
  Widget build(BuildContext context) {
    final (icon, title, subtitle, color) = switch (sensorStatus) {
      SensorConnectionStatus.scanning => (
          Icons.search_rounded,
          'Procurando sensor…',
          'Aguardando sinal Bluetooth',
          AppTheme.brandBlue,
        ),
      SensorConnectionStatus.connecting => (
          Icons.bluetooth_connected,
          'Conectando…',
          'Estabelecendo conexão com o sensor',
          AppTheme.brandBlue,
        ),
      SensorConnectionStatus.syncingHistory => (
          Icons.sync_rounded,
          'Sincronizando histórico',
          'Aguardando leituras do sensor',
          AppTheme.brandBlue,
        ),
      SensorConnectionStatus.warmingUp => (
          Icons.hourglass_bottom_rounded,
          'Aquecendo sensor',
          'O sensor está se calibrando',
          AppTheme.brandAmber,
        ),
      SensorConnectionStatus.error => (
          Icons.error_outline_rounded,
          'Erro de conexão',
          'Verifique o sensor e tente novamente',
          AppTheme.zoneLowBg,
        ),
      _ => (
          Icons.sensors_off_rounded,
          'Sem sensor conectado',
          'Toque no ícone Bluetooth para parear',
          AppTheme.inkMuted,
        ),
    };

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 32),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: color,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: const TextStyle(fontSize: 13, color: AppTheme.inkMuted),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ChartCard extends StatelessWidget {
  const _ChartCard({required this.state});
  final PatientState state;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppTheme.surfaceCanvas,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: Text(
              'Últimas 12 horas',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: AppTheme.inkMuted,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(0, 4, 8, 12),
            child: GlucoseChart(
              readings: state.readings,
              lowThreshold: state.alertSettings.lowThreshold,
              highThreshold: state.alertSettings.highThreshold,
            ),
          ),
        ],
      ),
    );
  }
}

class _StatsRow extends StatelessWidget {
  const _StatsRow({required this.state});
  final PatientState state;

  @override
  Widget build(BuildContext context) {
    final readings = state.readings;
    if (readings.isEmpty) return const SizedBox.shrink();

    final avg = readings.map((r) => r.value).reduce((a, b) => a + b) /
        readings.length;

    final inTarget = readings.where((r) {
      return r.value >= state.alertSettings.lowThreshold &&
          r.value <= state.alertSettings.highThreshold;
    }).length;
    final tirPct = (inTarget / readings.length * 100).round();

    final gmi = readings.length >= 14 ? 0.0296 * avg + 2.419 : null;

    return Row(
      children: [
        GlucoreStatChip(
          label: 'Tempo no alvo',
          value: '$tirPct',
          unit: '%',
          color: tirPct >= 70 ? AppTheme.zoneTargetBg : AppTheme.zoneHighBg,
        ),
        const SizedBox(width: 8),
        GlucoreStatChip(
          label: 'Média',
          value: avg.toStringAsFixed(0),
          unit: 'mg/dL',
        ),
        if (gmi != null) ...[
          const SizedBox(width: 8),
          GlucoreStatChip(
            label: 'GMI est.',
            value: gmi.toStringAsFixed(1),
          ),
        ],
      ],
    );
  }
}

class _SensorStrip extends StatelessWidget {
  const _SensorStrip({required this.state});
  final PatientState state;

  @override
  Widget build(BuildContext context) {
    final session = state.sensorState.session;
    if (session == null) return const SizedBox.shrink();

    final daysUsed = DateTime.now().difference(session.createdAt).inDays;
    final daysLeft = (14 - daysUsed).clamp(0, 14);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: AppTheme.surfaceCanvas,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          const Icon(Icons.sensors, size: 18, color: AppTheme.inkMuted),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              '${daysLeft}d restantes · ${session.sensorId.length > 8 ? session.sensorId.substring(0, 8) : session.sensorId}',
              style: const TextStyle(fontSize: 12, color: AppTheme.inkMuted),
            ),
          ),
        ],
      ),
    );
  }
}
