import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:glucore/l10n/l10n.dart';
import 'package:glucore/l10n/localized_values.dart';

import '../../../../core/theme/app_theme.dart';
import '../cubit/patient_cubit.dart';
import '../cubit/patient_state.dart';
import '../../domain/entities/patient_entities.dart';
import '../widgets/user_app_bar.dart';

class NotificationsPage extends StatelessWidget {
  const NotificationsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Scaffold(
      appBar: UserAppBar(title: const Text('Notificações')),
      body: BlocBuilder<PatientCubit, PatientState>(
        builder: (context, state) {
          if (state.alerts.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.notifications_off_outlined,
                      size: 48, color: Colors.grey.shade400),
                  const SizedBox(height: 12),
                  const Text(
                    'Sem notificações',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.inkMuted,
                    ),
                  ),
                ],
              ),
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            itemCount: state.alerts.length,
            itemBuilder: (context, index) {
              final item = state.alerts[index];
              return _AlertTile(item: item, l10n: l10n, context: context);
            },
          );
        },
      ),
    );
  }
}

class _AlertTile extends StatelessWidget {
  const _AlertTile({
    required this.item,
    required this.l10n,
    required this.context,
  });

  final AppAlertItem item;
  final AppLocalizations l10n;
  final BuildContext context;

  @override
  Widget build(BuildContext ctx) {
    final color = item.type.color();

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: AppTheme.surfaceCanvas,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.warning_amber_rounded, color: color, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.type.title(l10n),
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppTheme.ink,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  item.type.message(l10n),
                  style: const TextStyle(fontSize: 12, color: AppTheme.inkMuted),
                ),
              ],
            ),
          ),
          Text(
            context.formatShortDateTime(item.timestamp),
            style: const TextStyle(fontSize: 11, color: AppTheme.inkMuted),
          ),
        ],
      ),
    );
  }
}
