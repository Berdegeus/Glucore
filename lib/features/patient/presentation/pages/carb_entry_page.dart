import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:glucore/l10n/l10n.dart';

import '../cubit/patient_cubit.dart';
import '../models/patient_models.dart';

class CarbEntryPage extends StatefulWidget {
  const CarbEntryPage({super.key});

  @override
  State<CarbEntryPage> createState() => _CarbEntryPageState();
}

class _CarbEntryPageState extends State<CarbEntryPage> {
  final _formKey = GlobalKey<FormState>();
  final _gramsController = TextEditingController();
  final _descController = TextEditingController();

  @override
  void dispose() {
    _gramsController.dispose();
    _descController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.carbEntryTitle)),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: ListView(
            children: [
              Text(l10n.genericTimeLabel(TimeOfDay.now().format(context))),
              const SizedBox(height: 12),
              TextFormField(
                controller: _gramsController,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(labelText: l10n.carbEntryQuantityLabel),
                validator: (value) =>
                    (value == null ||
                        int.tryParse(value) == null ||
                        int.parse(value) <= 0)
                    ? l10n.carbEntryQuantityError
                    : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _descController,
                decoration: InputDecoration(
                  labelText: l10n.carbEntryDescriptionLabel,
                ),
                validator: (value) => (value == null || value.trim().isEmpty)
                    ? l10n.carbEntryDescriptionError
                    : null,
              ),
              const SizedBox(height: 18),
              FilledButton(
                onPressed: () async {
                  final messenger = ScaffoldMessenger.of(context);
                  final navigator = Navigator.of(context);
                  if (!_formKey.currentState!.validate()) {
                    return;
                  }
                  await context.read<PatientCubit>().addCarbEntry(
                    CarbEntry(
                      grams: int.parse(_gramsController.text),
                      description: _descController.text.trim(),
                      time: DateTime.now(),
                    ),
                  );
                  if (!mounted) {
                    return;
                  }
                  messenger.showSnackBar(
                    SnackBar(content: Text(l10n.carbEntrySavedSuccessMessage)),
                  );
                  navigator.pop();
                },
                child: Text(l10n.carbEntrySaveButton),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
