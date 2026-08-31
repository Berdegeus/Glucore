import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:glucore/l10n/l10n.dart';
import 'package:intl/intl.dart';

import '../../../../core/theme/glucore_colors.dart';
import '../cubit/patient_cubit.dart';
import '../../domain/entities/patient_entities.dart';
import '../widgets/glucore_messenger.dart';
import '../widgets/user_app_bar.dart';

class CarbEditPage extends StatefulWidget {
  const CarbEditPage({super.key, required this.entry});

  final CarbEntry entry;

  @override
  State<CarbEditPage> createState() => _CarbEditPageState();
}

class _CarbEditPageState extends State<CarbEditPage> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _gramsController;
  late final TextEditingController _descController;
  late DateTime _selectedTime;

  @override
  void initState() {
    super.initState();
    _gramsController = TextEditingController(text: widget.entry.grams.toString());
    _descController = TextEditingController(text: widget.entry.description);
    _selectedTime = widget.entry.time;
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

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    final l10n = context.l10n;
    final navigator = Navigator.of(context);
    await context.read<PatientCubit>().editCarbEntry(
      widget.entry.copyWith(
        grams: int.parse(_gramsController.text),
        description: _descController.text.trim(),
        time: _selectedTime,
      ),
    );
    if (!mounted) return;
    GlucoreMessenger.success(context, l10n.carbEditSavedSuccessMessage);
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
            style: FilledButton.styleFrom(backgroundColor: context.glucoreColors.zoneLowBg),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(l10n.entryDeleteConfirmButton),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    final deletedMessage = context.l10n.carbEditDeletedSuccessMessage;
    final navigator = Navigator.of(context);
    await context.read<PatientCubit>().deleteCarbEntry(widget.entry);
    if (!mounted) return;
    GlucoreMessenger.success(context, deletedMessage);
    navigator.pop();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Scaffold(
      appBar: UserAppBar(title: Text(l10n.carbEditTitle)),
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
              const SizedBox(height: 24),
              FilledButton(
                onPressed: _save,
                child: Text(l10n.carbEntrySaveButton),
              ),
              const SizedBox(height: 8),
              OutlinedButton(
                onPressed: _delete,
                style: OutlinedButton.styleFrom(foregroundColor: context.glucoreColors.zoneLowBg),
                child: Text(l10n.carbEditDeleteButton),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
