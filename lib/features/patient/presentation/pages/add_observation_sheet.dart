import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../widgets/patient_widgets.dart';
import 'carb_entry_page.dart';
import 'insulin_entry_page.dart';

class AddObservationSheet extends StatelessWidget {
  const AddObservationSheet({super.key});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Text(
                  'Adicionar observação',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.ink,
                  ),
                ),
                const Spacer(),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
            const SizedBox(height: 16),
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 1.5,
              children: [
                _OptionTile(
                  icon: Icons.restaurant_rounded,
                  color: AppTheme.zoneTargetBg,
                  label: 'Refeição',
                  onTap: () {
                    Navigator.of(context).pop();
                    Navigator.of(context).push(
                      buildPatientScopedRoute(
                        context,
                        const CarbEntryPage(),
                      ),
                    );
                  },
                ),
                _OptionTile(
                  icon: Icons.vaccines_outlined,
                  color: AppTheme.brandBlue,
                  label: 'Insulina',
                  onTap: () {
                    Navigator.of(context).pop();
                    Navigator.of(context).push(
                      buildPatientScopedRoute(
                        context,
                        const InsulinEntryPage(),
                      ),
                    );
                  },
                ),
                _OptionTile(
                  icon: Icons.directions_run_rounded,
                  color: AppTheme.brandAmber,
                  label: 'Exercício',
                  onTap: () {
                    Navigator.of(context).pop();
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        // TODO: implement ExerciseEntryPage
                        content: Text('Exercício — em breve'),
                      ),
                    );
                  },
                ),
                _OptionTile(
                  icon: Icons.edit_note_rounded,
                  color: AppTheme.inkMuted,
                  label: 'Nota livre',
                  onTap: () {
                    Navigator.of(context).pop();
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        // TODO: implement NoteEntryPage
                        content: Text('Nota livre — em breve'),
                      ),
                    );
                  },
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _OptionTile extends StatelessWidget {
  const _OptionTile({
    required this.icon,
    required this.color,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: color, size: 28),
            const SizedBox(height: 8),
            Text(
              label,
              style: TextStyle(
                fontSize: 14,
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
