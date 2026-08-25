import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../sensor/domain/models.dart';
import '../widgets/patient_widgets.dart';
import '../widgets/user_app_bar.dart';
import 'libre_nfc_page.dart';
import 'sensor_link_page.dart';

class SensorChoicePage extends StatelessWidget {
  const SensorChoicePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: UserAppBar(title: const Text('Escolher sensor')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Selecione a marca do seu sensor CGM',
            style: TextStyle(fontSize: 14, color: AppTheme.inkMuted),
          ),
          const SizedBox(height: 20),
          _BrandCard(
            name: 'Sibionics',
            description: 'Sensor implantável de 14 dias',
            icon: Icons.sensors,
            color: AppTheme.brandBlue,
            enabled: true,
            onTap: () => Navigator.of(context).push(
              buildPatientScopedRoute(
                context,
                const SensorLinkPage(),
                withSensorCubit: true,
              ),
            ),
          ),
          const SizedBox(height: 12),
          _BrandCard(
            name: 'Accu-Chek SmartGuide',
            description: 'Roche — sensor de 15 dias, pareamento com PIN',
            icon: Icons.sensors_rounded,
            color: const Color(0xFF0B5ED7),
            enabled: true,
            onTap: () => Navigator.of(context).push(
              buildPatientScopedRoute(
                context,
                const SensorLinkPage(brand: SensorBrand.accuchek),
                withSensorCubit: true,
              ),
            ),
          ),
          const SizedBox(height: 12),
          _BrandCard(
            name: 'FreeStyle Libre 2',
            description: 'Abbott — ativação por NFC + streaming Bluetooth',
            icon: Icons.nfc_rounded,
            color: const Color(0xFF007AFF),
            enabled: true,
            onTap: () => Navigator.of(context).push(
              buildPatientScopedRoute(
                context,
                const LibreNFCPage(),
                withSensorCubit: true,
              ),
            ),
          ),
          const SizedBox(height: 12),
          _BrandCard(
            name: 'Dexcom',
            description: 'Em breve',
            icon: Icons.bluetooth_disabled,
            color: AppTheme.inkMuted,
            enabled: false,
            onTap: null,
          ),
        ],
      ),
    );
  }
}

class _BrandCard extends StatelessWidget {
  const _BrandCard({
    required this.name,
    required this.description,
    required this.icon,
    required this.color,
    required this.enabled,
    required this.onTap,
  });

  final String name;
  final String description;
  final IconData icon;
  final Color color;
  final bool enabled;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: enabled ? 1.0 : 0.45,
      child: GestureDetector(
        onTap: enabled ? onTap : null,
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: AppTheme.surfaceCanvas,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: enabled ? color.withValues(alpha: 0.3) : Colors.transparent,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: color, size: 24),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.ink,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      description,
                      style: const TextStyle(
                        fontSize: 13,
                        color: AppTheme.inkMuted,
                      ),
                    ),
                  ],
                ),
              ),
              if (enabled)
                const Icon(Icons.chevron_right, color: AppTheme.inkMuted),
            ],
          ),
        ),
      ),
    );
  }
}
