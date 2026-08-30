import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:glucore/l10n/l10n.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/theme_cubit.dart';
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
            title: l10n.settingsGlucoseSectionTitle,
            rows: [
              GlucoreSectionRow(
                label: l10n.settingsGlucoseAlertsRowLabel,
                value: l10n.settingsConfigureRowValue,
                onTap: () => Navigator.of(context).push(
                  buildPatientScopedRoute(context, const AlertSettingsPage()),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          GlucoreSectionCard(
            title: l10n.genericSensorSectionTitle,
            rows: [
              GlucoreSectionRow(
                label: l10n.settingsManageSensorRowLabel,
                value: l10n.settingsSelectRowValue,
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
            title: l10n.genericDataSectionTitle,
            rows: [
              GlucoreSectionRow(
                label: l10n.settingsExportDataRowLabel,
                value: l10n.settingsComingSoonRowValue,
                // TODO: implement PDF export with pdf package
              ),
            ],
          ),
          const SizedBox(height: 16),
          const _ThemeSection(),
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
        content: Text(l10n.settingsLogoutConfirmMessage),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(l10n.genericCancelButton),
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

/// Seletor de tema (THEME-01).
///
/// Escreve direto no [ThemeCubit]: o `MaterialApp` escuta o mesmo cubit, então
/// o toque troca o tema na hora, sem reiniciar o app.
class _ThemeSection extends StatelessWidget {
  const _ThemeSection();

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final options = <ThemeMode, String>{
      ThemeMode.system: l10n.settingsThemeSystemLabel,
      ThemeMode.light: l10n.settingsThemeLightLabel,
      ThemeMode.dark: l10n.settingsThemeDarkLabel,
    };

    return BlocBuilder<ThemeCubit, ThemeMode>(
      builder: (context, mode) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 8),
            child: Text(
              l10n.settingsAppearanceSectionTitle,
              style: const TextStyle(
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
                for (final entry in options.entries) ...[
                  if (entry.key != options.keys.first)
                    const Divider(height: 1, indent: 16, endIndent: 16),
                  _ThemeOptionRow(
                    label: entry.value,
                    selected: entry.key == mode,
                    onTap: () =>
                        context.read<ThemeCubit>().setMode(entry.key),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ThemeOptionRow extends StatelessWidget {
  const _ThemeOptionRow({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Expanded(
              child: Text(
                label,
                style: const TextStyle(fontSize: 14, color: AppTheme.ink),
              ),
            ),
            if (selected)
              const Icon(Icons.check, size: 18, color: AppTheme.brandBlue),
          ],
        ),
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
    final l10n = context.l10n;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8),
          child: Text(
            l10n.settingsNotificationsSectionTitle,
            style: const TextStyle(
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
                label: l10n.settingsLowGlucoseAlertToggleLabel,
                value: notifLow,
                onChanged: onLowChanged,
              ),
              const Divider(height: 1, indent: 16, endIndent: 16),
              _ToggleRow(
                label: l10n.settingsHighGlucoseAlertToggleLabel,
                value: notifHigh,
                onChanged: onHighChanged,
              ),
              const Divider(height: 1, indent: 16, endIndent: 16),
              _ToggleRow(
                label: l10n.settingsSignalLossToggleLabel,
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
