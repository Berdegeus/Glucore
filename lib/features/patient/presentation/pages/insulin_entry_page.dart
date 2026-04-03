import 'package:flutter/material.dart';
import 'package:glucore/l10n/l10n.dart';
import 'package:glucore/l10n/localized_values.dart';

import '../mocks/patient_mock_store.dart';
import '../models/patient_models.dart';

class InsulinEntryPage extends StatefulWidget {
  const InsulinEntryPage({super.key});

  @override
  State<InsulinEntryPage> createState() => _InsulinEntryPageState();
}

class _InsulinEntryPageState extends State<InsulinEntryPage> {
  final _formKey = GlobalKey<FormState>();
  final _unitsController = TextEditingController();
  InsulinType _selectedType = InsulinType.bolus;

  @override
  void dispose() {
    _unitsController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.insulinEntryTitle)),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: ListView(
            children: [
              DropdownButtonFormField<InsulinType>(
                initialValue: _selectedType,
                decoration: InputDecoration(
                  labelText: l10n.insulinEntryDoseTypeLabel,
                ),
                items: InsulinType.values
                    .map(
                      (type) => DropdownMenuItem(
                        value: type,
                        child: Text(type.label(l10n)),
                      ),
                    )
                    .toList(),
                onChanged: (value) =>
                    setState(() => _selectedType = value ?? InsulinType.bolus),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _unitsController,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration:
                    InputDecoration(labelText: l10n.insulinEntryQuantityLabel),
                validator: (value) {
                  final parsed = double.tryParse(value ?? '');
                  if (parsed == null || parsed <= 0) {
                    return l10n.insulinEntryQuantityError;
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),
              Text(l10n.genericTimeLabel(TimeOfDay.now().format(context))),
              const SizedBox(height: 18),
              FilledButton(
                onPressed: () {
                  if (!_formKey.currentState!.validate()) return;
                  PatientMockStore.addInsulinEntry(
                    InsulinEntry(
                      units: double.parse(_unitsController.text),
                      type: _selectedType,
                      time: DateTime.now(),
                    ),
                  );
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(l10n.insulinEntrySavedSuccessMessage),
                    ),
                  );
                  Navigator.of(context).pop();
                },
                child: Text(l10n.insulinEntrySaveButton),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
