import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:glucore/l10n/l10n.dart';
import 'package:glucore/l10n/localized_values.dart';
import 'package:intl/intl.dart';

import '../cubit/patient_cubit.dart';
import '../models/patient_models.dart';

class InsulinEditPage extends StatefulWidget {
  const InsulinEditPage({super.key, required this.entry});

  final InsulinEntry entry;

  @override
  State<InsulinEditPage> createState() => _InsulinEditPageState();
}

class _InsulinEditPageState extends State<InsulinEditPage> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _unitsController;
  late InsulinType _selectedType;
  late DateTime _selectedTime;

  @override
  void initState() {
    super.initState();
    _unitsController = TextEditingController(
      text: widget.entry.units.toStringAsFixed(
        widget.entry.units % 1 == 0 ? 0 : 1,
      ),
    );
    _selectedType = widget.entry.type;
    _selectedTime = widget.entry.time;
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

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    await context.read<PatientCubit>().editInsulinEntry(
      InsulinEntry(
        units: double.parse(_unitsController.text),
        type: _selectedType,
        time: _selectedTime,
      ),
    );
    if (!mounted) return;
    messenger.showSnackBar(
      SnackBar(content: Text(context.l10n.insulinEditSavedSuccessMessage)),
    );
    navigator.pop();
  }

  Future<void> _delete() async {
    final l10n = context.l10n;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.entryDeleteConfirmTitle),
        content: Text(l10n.entryDeleteConfirmMessage),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(l10n.genericCancelButton),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(l10n.entryDeleteConfirmButton),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    final navigator = Navigator.of(context);
    await context.read<PatientCubit>().deleteInsulinEntry(widget.entry);
    if (!mounted) return;
    messenger.showSnackBar(
      SnackBar(content: Text(context.l10n.insulinEditDeletedSuccessMessage)),
    );
    navigator.pop();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.insulinEditTitle)),
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
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _save,
                child: Text(l10n.insulinEntrySaveButton),
              ),
              const SizedBox(height: 8),
              OutlinedButton(
                onPressed: _delete,
                style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
                child: Text(l10n.carbEditDeleteButton),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
