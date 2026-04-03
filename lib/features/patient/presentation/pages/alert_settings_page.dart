import 'package:flutter/material.dart';
import 'package:glucore/l10n/l10n.dart';

import '../mocks/patient_mock_store.dart';
import '../models/patient_models.dart';

class AlertSettingsPage extends StatefulWidget {
  const AlertSettingsPage({super.key});

  @override
  State<AlertSettingsPage> createState() => _AlertSettingsPageState();
}

class _AlertSettingsPageState extends State<AlertSettingsPage> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _lowController;
  late final TextEditingController _highController;

  @override
  void initState() {
    super.initState();
    final current = PatientMockStore.alertSettings.value;
    _lowController = TextEditingController(text: '${current.lowThreshold}');
    _highController = TextEditingController(text: '${current.highThreshold}');
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
      appBar: AppBar(title: Text(l10n.alertSettingsTitle)),
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
                onPressed: () {
                  if (!_formKey.currentState!.validate()) return;
                  final low = int.parse(_lowController.text);
                  final high = int.parse(_highController.text);
                  if (low >= high) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(l10n.alertSettingsLowMustBeLowerError),
                      ),
                    );
                    return;
                  }

                  PatientMockStore.updateAlertSettings(
                    AlertSettingsModel(lowThreshold: low, highThreshold: high),
                  );
                  ScaffoldMessenger.of(context).showSnackBar(
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
