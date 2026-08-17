import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:glucore/l10n/l10n.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../auth/presentation/cubit/auth_cubit.dart';
import '../widgets/glucore_widgets.dart';
import '../widgets/patient_widgets.dart';
import '../widgets/user_app_bar.dart';
import 'alert_settings_page.dart';
import 'sensor_choice_page.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  bool _notifLow = true;
  bool _notifHigh = true;
  bool _notifSignal = true;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Scaffold(
      backgroundColor: AppTheme.surfaceElevated,
      appBar: UserAppBar(title: Text(l10n.settingsTitle)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 40),
        children: [
          GlucoreSectionCard(
            title: 'Glicose',
            rows: [
              GlucoreSectionRow(
                label: 'Alertas de glicose',
                value: 'Configurar',
                onTap: () => Navigator.of(context).push(
                  buildPatientScopedRoute(context, const AlertSettingsPage()),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          GlucoreSectionCard(
            title: 'Sensor',
            rows: [
              GlucoreSectionRow(
                label: 'Gerenciar sensor',
                value: 'Selecionar',
                onTap: () => Navigator.of(context).push(
                  buildPatientScopedRoute(
                    context,
                    const SensorChoicePage(),
                    withSensorCubit: true,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _NotifSection(
            notifLow: _notifLow,
            notifHigh: _notifHigh,
            notifSignal: _notifSignal,
            onLowChanged: (v) => setState(() => _notifLow = v),
            onHighChanged: (v) => setState(() => _notifHigh = v),
            onSignalChanged: (v) => setState(() => _notifSignal = v),
          ),
          const SizedBox(height: 16),
          GlucoreSectionCard(
            title: 'Dados',
            rows: [
              GlucoreSectionRow(
                label: 'Exportar dados',
                value: 'Em breve',
                // TODO: implement PDF export with pdf package
              ),
            ],
          ),
          const SizedBox(height: 32),
          OutlinedButton(
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: AppTheme.zoneLowBg),
              foregroundColor: AppTheme.zoneLowBg,
            ),
            onPressed: () => _confirmLogout(context, l10n),
            child: Text(l10n.settingsLogoutTile),
          ),
        ],
      ),
    );
  }

  void _confirmLogout(BuildContext context, AppLocalizations l10n) {
    showDialog<void>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(l10n.settingsLogoutTile),
        content: const Text('Deseja sair da sua conta?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(context).pop();
              context.read<AuthCubit>().logout();
            },
            style: TextButton.styleFrom(foregroundColor: AppTheme.zoneLowBg),
            child: Text(l10n.settingsLogoutTile),
          ),
        ],
      ),
    );
  }
}

class _NotifSection extends StatelessWidget {
  const _NotifSection({
    required this.notifLow,
    required this.notifHigh,
    required this.notifSignal,
    required this.onLowChanged,
    required this.onHighChanged,
    required this.onSignalChanged,
  });

  final bool notifLow;
  final bool notifHigh;
  final bool notifSignal;
  final ValueChanged<bool> onLowChanged;
  final ValueChanged<bool> onHighChanged;
  final ValueChanged<bool> onSignalChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.only(left: 4, bottom: 8),
          child: Text(
            'NOTIFICAÇÕES',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppTheme.inkMuted,
              letterSpacing: 0.8,
            ),
          ),
        ),
        Container(
          decoration: BoxDecoration(
            color: AppTheme.surfaceCanvas,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            children: [
              _ToggleRow(
                label: 'Alerta de glicose baixa',
                value: notifLow,
                onChanged: onLowChanged,
              ),
              const Divider(height: 1, indent: 16, endIndent: 16),
              _ToggleRow(
                label: 'Alerta de glicose alta',
                value: notifHigh,
                onChanged: onHighChanged,
              ),
              const Divider(height: 1, indent: 16, endIndent: 16),
              _ToggleRow(
                label: 'Perda de sinal',
                value: notifSignal,
                onChanged: onSignalChanged,
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ToggleRow extends StatelessWidget {
  const _ToggleRow({
    required this.label,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(fontSize: 14, color: AppTheme.ink),
            ),
          ),
          Switch(
            value: value,
            onChanged: onChanged,
            activeThumbColor: AppTheme.brandBlue,
          ),
        ],
      ),
    );
  }
}
