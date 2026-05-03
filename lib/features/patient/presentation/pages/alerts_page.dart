import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:glucore/l10n/l10n.dart';
import 'package:glucore/l10n/localized_values.dart';

import '../cubit/patient_cubit.dart';
import '../cubit/patient_state.dart';
import '../widgets/patient_widgets.dart';
import 'alert_settings_page.dart';

class AlertsPage extends StatelessWidget {
  const AlertsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.alertsTitle),
        actions: [
          IconButton(
            onPressed: () {
              Navigator.of(context).push(
                buildPatientScopedRoute(
                  context,
                  const AlertSettingsPage(),
                ),
              );
            },
            icon: const Icon(Icons.tune),
          ),
        ],
      ),
      body: BlocBuilder<PatientCubit, PatientState>(
        builder: (context, state) {
          if (state.alerts.isEmpty) {
            return EmptyStateView(
              title: l10n.alertsEmptyStateTitle,
              message: l10n.alertsEmptyStateMessage,
              icon: Icons.notifications_off_outlined,
            );
          }

          return ListView.builder(
            itemCount: state.alerts.length,
            itemBuilder: (context, index) {
              final item = state.alerts[index];
              final color = item.type.color();
              return Card(
                margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: color.withValues(alpha: 0.15),
                    child: Icon(
                      Icons.warning_amber_rounded,
                      color: color,
                    ),
                  ),
                  title: Text(item.type.title(l10n)),
                  subtitle: Text(
                    l10n.alertsItemSubtitle(
                      item.type.message(l10n),
                      context.formatShortDateTime(item.timestamp),
                    ),
                  ),
                  isThreeLine: true,
                ),
              );
            },
          );
        },
      ),
    );
  }
}
