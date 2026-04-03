import 'package:flutter/material.dart';
import 'package:glucore/l10n/l10n.dart';
import 'package:glucore/l10n/localized_values.dart';

import '../mocks/patient_mock_store.dart';
import '../widgets/patient_widgets.dart';

class HistoryPage extends StatelessWidget {
  const HistoryPage({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.historyTitle)),
      body: ValueListenableBuilder(
        valueListenable: PatientMockStore.readings,
        builder: (context, readings, _) {
          if (readings.isEmpty) {
            return EmptyStateView(
              title: l10n.historyEmptyStateTitle,
              message: l10n.historyEmptyStateMessage,
            );
          }

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              ...readings.map(
                (item) => Card(
                  child: ListTile(
                    leading: const Icon(Icons.bloodtype_outlined),
                    title: Text(l10n.genericGlucoseValue(item.value)),
                    subtitle: Text(context.formatShortDateTime(item.timestamp)),
                  ),
                ),
              ),
              ValueListenableBuilder(
                valueListenable: PatientMockStore.carbs,
                builder: (context, carbs, __) {
                  if (carbs.isEmpty) return const SizedBox.shrink();
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: 16),
                      Text(
                        l10n.historyCarbsSectionTitle,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      ...carbs.map(
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
                  );
                },
              ),
              ValueListenableBuilder(
                valueListenable: PatientMockStore.insulin,
                builder: (context, insulin, __) {
                  if (insulin.isEmpty) return const SizedBox.shrink();
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: 16),
                      Text(
                        l10n.historyInsulinSectionTitle,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      ...insulin.map(
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
                  );
                },
              ),
            ],
          );
        },
      ),
    );
  }
}
