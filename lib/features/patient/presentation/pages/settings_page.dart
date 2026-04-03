import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:glucore/l10n/l10n.dart';

import '../../../auth/presentation/cubit/auth_cubit.dart';
import 'alert_settings_page.dart';
import 'profile_page.dart';
import 'sensor_link_page.dart';

class SettingsPage extends StatelessWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.settingsTitle)),
      body: ListView(
        children: [
          ListTile(
            leading: const Icon(Icons.person_outline),
            title: Text(l10n.settingsProfileAndHealthTile),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const ProfilePage()),
            ),
          ),
          ListTile(
            leading: const Icon(Icons.bluetooth_connected_outlined),
            title: Text(l10n.settingsSensorLinkTile),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const SensorLinkPage()),
            ),
          ),
          ListTile(
            leading: const Icon(Icons.notifications_active_outlined),
            title: Text(l10n.settingsAlertSettingsTile),
            onTap: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const AlertSettingsPage()),
            ),
          ),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.logout),
            title: Text(l10n.settingsLogoutTile),
            onTap: () => context.read<AuthCubit>().logout(),
          ),
        ],
      ),
    );
  }
}
