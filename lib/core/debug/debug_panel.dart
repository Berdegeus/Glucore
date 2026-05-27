import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../features/patient/presentation/cubit/patient_cubit.dart';
import '../../features/sensor/presentation/cubit/sensor_cubit.dart';
import '../../features/sensor/domain/models.dart';

/// Debug-only bottom sheet. Only rendered in kDebugMode — never ships to release.
class DebugPanel extends StatelessWidget {
  const DebugPanel({super.key});

  static void show(BuildContext context) {
    assert(kDebugMode);
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => MultiBlocProvider(
        providers: [
          BlocProvider.value(value: context.read<SensorCubit>()),
          BlocProvider.value(value: context.read<PatientCubit>()),
        ],
        child: const DebugPanel(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF1A1A2E),
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      child: BlocBuilder<SensorCubit, SensorUiState>(
        builder: (context, sensorState) {
          final mockActive = sensorState.isMock ||
              context.read<SensorCubit>().isMockActive;
          return Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.white24,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  const Icon(Icons.bug_report, color: Color(0xFF64B5F6), size: 20),
                  const SizedBox(width: 8),
                  const Text(
                    'Painel Debug',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const Spacer(),
                  _StatusChip(active: mockActive),
                ],
              ),
              const SizedBox(height: 20),
              const _SectionLabel('Mock Sensor'),
              const SizedBox(height: 8),
              _DebugButton(
                label: mockActive ? 'Desativar Mock' : 'Ativar Mock',
                icon: mockActive ? Icons.stop_circle_outlined : Icons.play_circle_outlined,
                color: mockActive ? const Color(0xFF546E7A) : const Color(0xFF1565C0),
                onTap: () {
                  final cubit = context.read<SensorCubit>();
                  if (mockActive) {
                    cubit.deactivateMock();
                  } else {
                    cubit.activateMock();
                  }
                  Navigator.pop(context);
                },
              ),
              const SizedBox(height: 16),
              const _SectionLabel('Simular Glicemia'),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: _DebugButton(
                      label: 'Hipoglicemia',
                      sublabel: '< 54 mg/dL',
                      icon: Icons.arrow_downward_rounded,
                      color: const Color(0xFFB71C1C),
                      onTap: () {
                        context.read<SensorCubit>().injectMockReading(
                          48,
                          rate: -2.5,
                        );
                        Navigator.pop(context);
                      },
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _DebugButton(
                      label: 'Hiperglicemia',
                      sublabel: '> 250 mg/dL',
                      icon: Icons.arrow_upward_rounded,
                      color: const Color(0xFFE65100),
                      onTap: () {
                        context.read<SensorCubit>().injectMockReading(
                          285,
                          rate: 3.0,
                        );
                        Navigator.pop(context);
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const _SectionLabel('Dados'),
              const SizedBox(height: 8),
              _DebugButton(
                label: 'Limpar leituras',
                icon: Icons.delete_sweep_outlined,
                color: const Color(0xFF4A148C),
                onTap: () {
                  context.read<PatientCubit>().clearReadings();
                  Navigator.pop(context);
                },
              ),
            ],
          );
        },
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(
        color: Colors.white54,
        fontSize: 11,
        fontWeight: FontWeight.w600,
        letterSpacing: 0.8,
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.active});
  final bool active;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: active
            ? const Color(0xFF1565C0).withValues(alpha: 0.3)
            : Colors.white10,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: active ? const Color(0xFF64B5F6) : Colors.white24,
        ),
      ),
      child: Text(
        active ? 'MOCK ATIVO' : 'REAL',
        style: TextStyle(
          color: active ? const Color(0xFF64B5F6) : Colors.white38,
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}

class _DebugButton extends StatelessWidget {
  const _DebugButton({
    required this.label,
    required this.icon,
    required this.color,
    required this.onTap,
    this.sublabel,
  });

  final String label;
  final String? sublabel;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: color.withValues(alpha: 0.15),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: color.withValues(alpha: 0.4)),
          ),
          child: Row(
            children: [
              Icon(icon, color: color, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    if (sublabel != null)
                      Text(
                        sublabel!,
                        style: const TextStyle(
                          color: Colors.white54,
                          fontSize: 11,
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
