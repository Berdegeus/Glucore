import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:glucore/l10n/l10n.dart';

import '../cubit/patient_cubit.dart';
import '../widgets/glucore_messenger.dart';
import '../widgets/user_app_bar.dart';
import '../../../../core/preferences/app_preferences.dart';

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
    final unit = context.readGlucoseUnit();
    final locale = Localizations.localeOf(context).toString();
    _lowController = TextEditingController(
      text: unit.format(current.lowThreshold.toDouble(), locale: locale),
    );
    _highController = TextEditingController(
      text: unit.format(current.highThreshold.toDouble(), locale: locale),
    );
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
    final unit = context.glucoseUnit;

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
                  labelText: l10n.alertSettingsLowThresholdLabel(unit.label),
                ),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                validator: (value) =>
                    (value == null || unit.parseToMgDl(value) == null)
                    ? l10n.genericNumericValueError
                    : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _highController,
                decoration: InputDecoration(
                  labelText: l10n.alertSettingsHighThresholdLabel(unit.label),
                ),
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                validator: (value) =>
                    (value == null || unit.parseToMgDl(value) == null)
                    ? l10n.genericNumericValueError
                    : null,
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () async {
                  if (!_formKey.currentState!.validate()) {
                    return;
                  }
                  final low = unit.parseToMgDl(_lowController.text)!.round();
                  final high = unit.parseToMgDl(_highController.text)!.round();
                  if (low >= high) {
                    GlucoreMessenger.error(
                      context,
                      l10n.alertSettingsLowMustBeLowerError,
                    );
                    return;
                  }

                  await context.read<PatientCubit>().updateAlertSettings(
                    context.read<PatientCubit>().state.alertSettings.copyWith(
                      lowThreshold: low,
                      highThreshold: high,
                    ),
                  );

                  if (!context.mounted) {
                    return;
                  }
                  GlucoreMessenger.success(
                    context,
                    l10n.alertSettingsUpdatedSuccessMessage,
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
