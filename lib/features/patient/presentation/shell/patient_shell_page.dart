import 'package:flutter/material.dart';
import 'package:glucore/l10n/l10n.dart';

import '../pages/alerts_page.dart';
import '../pages/history_page.dart';
import '../pages/monitoring_home_page.dart';
import '../pages/settings_page.dart';

class PatientShellPage extends StatefulWidget {
  const PatientShellPage({super.key});

  @override
  State<PatientShellPage> createState() => _PatientShellPageState();
}

class _PatientShellPageState extends State<PatientShellPage> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final pages = [
      const MonitoringHomePage(),
      const HistoryPage(),
      const AlertsPage(),
      const SettingsPage(),
    ];

    return Scaffold(
      body: IndexedStack(index: _currentIndex, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) => setState(() => _currentIndex = index),
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.monitor_heart_outlined),
            label: l10n.navigationMonitorLabel,
          ),
          NavigationDestination(
            icon: const Icon(Icons.history),
            label: l10n.navigationHistoryLabel,
          ),
          NavigationDestination(
            icon: const Icon(Icons.notifications_none),
            label: l10n.navigationAlertsLabel,
          ),
          NavigationDestination(
            icon: const Icon(Icons.settings_outlined),
            label: l10n.navigationSettingsLabel,
          ),
        ],
      ),
    );
  }
}
