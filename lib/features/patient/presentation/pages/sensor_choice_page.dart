import 'package:flutter/material.dart';

import '../../../../core/theme/glucore_colors.dart';
import '../../../../l10n/l10n.dart';
import '../../../sensor/domain/models.dart';
import '../widgets/patient_widgets.dart';
import '../widgets/user_app_bar.dart';
import 'libre_nfc_page.dart';
import 'sensor_link_page.dart';

class SensorChoicePage extends StatelessWidget {
  const SensorChoicePage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      appBar: UserAppBar(title: Text(l10n.sensorChoicePageTitle)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            l10n.sensorChoiceSelectBrandMessage,
            style: TextStyle(fontSize: 14, color: context.glucoreColors.inkMuted),
          ),
          const SizedBox(height: 20),
          _BrandCard(
            name: 'Sibionics',
            description: l10n.sensorChoiceSibionicsDescription,
            icon: Icons.sensors,
            color: context.glucoreColors.brandBlue,
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
            description: l10n.sensorChoiceAccuChekDescription,
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
            description: l10n.sensorChoiceLibreDescription,
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
            description: l10n.settingsComingSoonRowValue,
            icon: Icons.bluetooth_disabled,
            color: context.glucoreColors.inkMuted,
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
            color: context.glucoreColors.surfaceCanvas,
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
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: context.glucoreColors.ink,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      description,
                      style: TextStyle(
                        fontSize: 13,
                        color: context.glucoreColors.inkMuted,
                      ),
                    ),
                  ],
                ),
              ),
              if (enabled)
                Icon(Icons.chevron_right, color: context.glucoreColors.inkMuted),
            ],
          ),
        ),
      ),
    );
  }
}
