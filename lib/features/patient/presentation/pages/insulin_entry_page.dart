import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:glucore/l10n/l10n.dart';
import 'package:glucore/l10n/localized_values.dart';
import 'package:intl/intl.dart';

import '../cubit/patient_cubit.dart';
import '../models/patient_models.dart';
import '../widgets/glucore_messenger.dart';
import '../widgets/user_app_bar.dart';

class InsulinEntryPage extends StatefulWidget {
  const InsulinEntryPage({super.key});

  @override
  State<InsulinEntryPage> createState() => _InsulinEntryPageState();
}

class _InsulinEntryPageState extends State<InsulinEntryPage> {
  final _formKey = GlobalKey<FormState>();
  final _unitsController = TextEditingController();
  InsulinType _selectedType = InsulinType.bolus;
  late DateTime _selectedTime;
  late String _selectedDayOfWeek;

  @override
  void initState() {
    super.initState();
    _selectedTime = DateTime.now();
    _selectedDayOfWeek = kDaysOfWeek[_selectedTime.weekday - 1];
  }

  @override
  void dispose() {
    _unitsController.dispose();
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
      appBar: UserAppBar(title: Text(l10n.insulinEntryTitle)),
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
                onChanged: (value) {
                  setState(() => _selectedType = value ?? InsulinType.bolus);
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _unitsController,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: InputDecoration(
                  labelText: l10n.insulinEntryQuantityLabel,
                ),
                validator: (value) {
                  final parsed = double.tryParse(value ?? '');
                  if (parsed == null || parsed <= 0) {
                    return l10n.insulinEntryQuantityError;
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),
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
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _selectedDayOfWeek,
                decoration: InputDecoration(
                  labelText: l10n.insulinEntryDayOfWeekLabel,
                ),
                items: kDaysOfWeek
                    .map((day) => DropdownMenuItem(value: day, child: Text(day)))
                    .toList(),
                onChanged: (value) {
                  setState(() => _selectedDayOfWeek = value ?? kDaysOfWeek[0]);
                },
              ),
              const SizedBox(height: 18),
              FilledButton(
                onPressed: () async {
                  final navigator = Navigator.of(context);
                  if (!_formKey.currentState!.validate()) {
                    return;
                  }
                  await context.read<PatientCubit>().addInsulinEntry(
                    InsulinEntry.create(
                      units: double.parse(_unitsController.text),
                      type: _selectedType,
                      time: _selectedTime,
                      dayOfWeek: _selectedDayOfWeek,
                    ),
                  );
                  if (!context.mounted) {
                    return;
                  }
                  GlucoreMessenger.success(
                    context,
                    l10n.insulinEntrySavedSuccessMessage,
                  );
                  navigator.pop();
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
