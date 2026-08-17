import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:glucore/l10n/l10n.dart';

import '../cubit/patient_cubit.dart';
import '../widgets/user_app_bar.dart';

class AlertSettingsPage extends StatefulWidget {
  const AlertSettingsPage({super.key});

  @override
  State<AlertSettingsPage> createState() => _AlertSettingsPageState();
}

class _AlertSettingsPageState extends State<AlertSettingsPage> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _lowController;
  late final TextEditingController _highController;
  bool _initialized = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_initialized) {
      return;
    }
    final current = context.read<PatientCubit>().state.alertSettings;
    _lowController = TextEditingController(text: '${current.lowThreshold}');
    _highController = TextEditingController(text: '${current.highThreshold}');
    _initialized = true;
  }

  @override
  void dispose() {
    _lowController.dispose();
    _highController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Scaffold(
      appBar: UserAppBar(title: Text(l10n.alertSettingsTitle)),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: ListView(
            children: [
              TextFormField(
                controller: _lowController,
                decoration: InputDecoration(
                  labelText: l10n.alertSettingsLowThresholdLabel,
                ),
                keyboardType: TextInputType.number,
                validator: (value) =>
                    (value == null || int.tryParse(value) == null)
                    ? l10n.genericNumericValueError
                    : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _highController,
                decoration: InputDecoration(
                  labelText: l10n.alertSettingsHighThresholdLabel,
                ),
                keyboardType: TextInputType.number,
                validator: (value) =>
                    (value == null || int.tryParse(value) == null)
                    ? l10n.genericNumericValueError
                    : null,
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () async {
                  final messenger = ScaffoldMessenger.of(context);
                  if (!_formKey.currentState!.validate()) {
                    return;
                  }
                  final low = int.parse(_lowController.text);
                  final high = int.parse(_highController.text);
                  if (low >= high) {
                    messenger.showSnackBar(
                      SnackBar(
                        content: Text(l10n.alertSettingsLowMustBeLowerError),
                      ),
                    );
                    return;
                  }

                  await context.read<PatientCubit>().updateAlertSettings(
                    context.read<PatientCubit>().state.alertSettings.copyWith(
                      lowThreshold: low,
                      highThreshold: high,
                    ),
                  );

                  if (!mounted) {
                    return;
                  }
                  messenger.showSnackBar(
                    SnackBar(
                      content: Text(l10n.alertSettingsUpdatedSuccessMessage),
                    ),
                  );
                },
                child: Text(l10n.alertSettingsSaveButton),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
