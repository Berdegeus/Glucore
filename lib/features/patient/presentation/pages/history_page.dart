import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:glucore/l10n/l10n.dart';
import 'package:glucore/l10n/localized_values.dart';

import '../cubit/patient_cubit.dart';
import '../cubit/patient_state.dart';
import '../widgets/patient_widgets.dart';

class HistoryPage extends StatelessWidget {
  const HistoryPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.historyTitle)),
      body: BlocBuilder<PatientCubit, PatientState>(
        builder: (context, state) {
          if (state.readings.isEmpty &&
              state.carbs.isEmpty &&
              state.insulin.isEmpty) {
            return EmptyStateView(
              title: l10n.historyEmptyStateTitle,
              message: l10n.historyEmptyStateMessage,
            );
          }

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              ...state.readings.map(
                (item) => Card(
                  child: ListTile(
                    leading: const Icon(Icons.bloodtype_outlined),
                    title: Text(
                      l10n.genericGlucoseValue(item.value.toStringAsFixed(1)),
                    ),
                    subtitle: Text(context.formatShortDateTime(item.timestamp)),
                    trailing: Text(item.trend.label(l10n)),
                  ),
                ),
              ),
              if (state.carbs.isNotEmpty) ...[
                const SizedBox(height: 16),
                Text(
                  l10n.historyCarbsSectionTitle,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                ...state.carbs.map(
                  (entry) => ListTile(
                    leading: const Icon(Icons.restaurant_menu),
                    title: Text(
                      l10n.historyCarbEntryTitle(
                        entry.grams,
                        entry.description,
                      ),
                    ),
                    subtitle: Text(context.formatShortDateTime(entry.time)),
                  ),
                ),
              ],
              if (state.insulin.isNotEmpty) ...[
                const SizedBox(height: 16),
                Text(
                  l10n.historyInsulinSectionTitle,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                ...state.insulin.map(
                  (entry) => ListTile(
                    leading: const Icon(Icons.medication_outlined),
                    title: Text(
                      l10n.historyInsulinEntryTitle(
                        entry.units,
                        entry.type.label(l10n),
                      ),
                    ),
                    subtitle: Text(context.formatShortDateTime(entry.time)),
                  ),
                ),
              ],
            ],
          );
        },
      ),
    );
  }
}
