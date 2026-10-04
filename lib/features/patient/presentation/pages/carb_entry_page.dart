import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:glucore/l10n/l10n.dart';
import 'package:intl/intl.dart';

import '../cubit/patient_cubit.dart';
import '../../domain/entities/patient_entities.dart';
import '../widgets/glucore_messenger.dart';
import '../widgets/user_app_bar.dart';

class CarbEntryPage extends StatefulWidget {
  const CarbEntryPage({super.key});

  @override
  State<CarbEntryPage> createState() => _CarbEntryPageState();
}

class _CarbEntryPageState extends State<CarbEntryPage> {
  final _formKey = GlobalKey<FormState>();
  final _gramsController = TextEditingController();
  final _descController = TextEditingController();
  late DateTime _selectedTime;

  @override
  void initState() {
    super.initState();
    _selectedTime = DateTime.now();
  }

  @override
  void dispose() {
    _gramsController.dispose();
    _descController.dispose();
    super.dispose();
  }

  Future<void> _pickDateTime() async {
    final date = await showDatePicker(
      context: context,
      initialDate: _selectedTime,
      firstDate: DateTime.now().subtract(const Duration(days: 30)),
      lastDate: DateTime.now(),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_selectedTime),
    );
    if (time == null || !mounted) return;
    setState(() {
      _selectedTime = DateTime(date.year, date.month, date.day, time.hour, time.minute);
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Scaffold(
      appBar: UserAppBar(title: Text(l10n.carbEntryTitle)),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: ListView(
            children: [
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(l10n.genericTimeLabel(
                  DateFormat('dd/MM HH:mm').format(_selectedTime),
                )),
                trailing: TextButton(
                  onPressed: _pickDateTime,
                  child: Text(l10n.entryTimePicker),
                ),
              ),
              const SizedBox(height: 8),
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
                  final navigator = Navigator.of(context);
                  if (!_formKey.currentState!.validate()) {
                    return;
                  }
                  await context.read<PatientCubit>().addCarbEntry(
                    CarbEntry.create(
                      grams: int.parse(_gramsController.text),
                      description: _descController.text.trim(),
                      time: _selectedTime,
                    ),
                  );
                  if (!context.mounted) {
                    return;
                  }
                  GlucoreMessenger.success(
                    context,
                    l10n.carbEntrySavedSuccessMessage,
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
