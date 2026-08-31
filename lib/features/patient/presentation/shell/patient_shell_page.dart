import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../core/theme/glucore_colors.dart';
import '../cubit/patient_cubit.dart';
import '../pages/add_observation_sheet.dart';
import '../pages/diary_page.dart';
import '../pages/monitoring_home_page.dart';
import '../pages/profile_page.dart';
import '../pages/reports_page.dart';

class PatientShellPage extends StatefulWidget {
  const PatientShellPage({super.key});

  @override
  State<PatientShellPage> createState() => _PatientShellPageState();
}

class _PatientShellPageState extends State<PatientShellPage> {
  int _currentIndex = 0;

  static const _pages = [
    MonitoringHomePage(),
    DiaryPage(),
    ReportsPage(),
    ProfilePage(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBody: true,
      body: IndexedStack(index: _currentIndex, children: _pages),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAddObservation(context),
        backgroundColor: context.glucoreColors.brandBlue,
        foregroundColor: Colors.white,
        elevation: 6,
        child: const Icon(Icons.add, size: 28),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
      bottomNavigationBar: BottomAppBar(
        shape: const CircularNotchedRectangle(),
        notchMargin: 6,
        color: context.glucoreColors.surfaceCanvas,
        height: 60,
        padding: EdgeInsets.zero,
        child: Row(
          children: [
            _TabItem(
              icon: Icons.monitor_heart_outlined,
              label: 'Monitor',
              active: _currentIndex == 0,
              onTap: () => setState(() => _currentIndex = 0),
            ),
            _TabItem(
              icon: Icons.book_outlined,
              label: 'Diário',
              active: _currentIndex == 1,
              onTap: () => setState(() => _currentIndex = 1),
            ),
            const Expanded(child: SizedBox()),
            _TabItem(
              icon: Icons.bar_chart_rounded,
              label: 'Relatórios',
              active: _currentIndex == 2,
              onTap: () => setState(() => _currentIndex = 2),
            ),
            _TabItem(
              icon: Icons.person_outline,
              label: 'Perfil',
              active: _currentIndex == 3,
              onTap: () => setState(() => _currentIndex = 3),
            ),
          ],
        ),
      ),
    );
  }

  void _showAddObservation(BuildContext context) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (_) => BlocProvider.value(
        value: context.read<PatientCubit>(),
        child: const AddObservationSheet(),
      ),
    );
  }
}

class _TabItem extends StatelessWidget {
  const _TabItem({
    required this.icon,
    required this.label,
    required this.active,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = active ? context.glucoreColors.brandBlue : context.glucoreColors.inkMuted;
    return Expanded(
      child: InkWell(
        onTap: onTap,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(height: 3),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
