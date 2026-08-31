import 'package:flutter/material.dart';

import '../../../../core/theme/glucore_colors.dart';
import '../../../../l10n/l10n.dart';
import '../widgets/glucore_messenger.dart';
import '../widgets/patient_widgets.dart';
import 'carb_entry_page.dart';
import 'insulin_entry_page.dart';

class AddObservationSheet extends StatelessWidget {
  const AddObservationSheet({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
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
                Text(
                  l10n.addObservationTitle,
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w700,
                    color: context.glucoreColors.ink,
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
                  color: context.glucoreColors.zoneTargetBg,
                  label: l10n.mealDefaultLabel,
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
                  color: context.glucoreColors.brandBlue,
                  label: l10n.monitoringInsulinButton,
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
                  color: context.glucoreColors.brandAmber,
                  label: l10n.addObservationExerciseLabel,
                  onTap: () {
                    Navigator.of(context).pop();
                    // TODO: implement ExerciseEntryPage
                    GlucoreMessenger.info(
                        context, l10n.addObservationExerciseComingSoonMessage);
                  },
                ),
                _OptionTile(
                  icon: Icons.edit_note_rounded,
                  color: context.glucoreColors.inkMuted,
                  label: l10n.addObservationNoteLabel,
                  onTap: () {
                    Navigator.of(context).pop();
                    // TODO: implement NoteEntryPage
                    GlucoreMessenger.info(
                        context, l10n.addObservationNoteComingSoonMessage);
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
