import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:glucore/core/utils/date_input.dart';
import 'package:glucore/core/utils/field_label.dart';
import 'package:glucore/core/utils/phone_input.dart';
import 'package:glucore/core/validation/password_policy.dart';
import 'package:glucore/features/patient/presentation/widgets/glucore_form_layout.dart';
import 'package:glucore/features/patient/presentation/widgets/glucore_messenger.dart';
import 'package:glucore/l10n/l10n.dart';
import 'package:glucore/l10n/localized_values.dart';

import '../cubit/auth_cubit.dart';
import '../cubit/auth_state.dart';
import '../widgets/password_field.dart';

class RegisterPage extends StatefulWidget {
  const RegisterPage({super.key});

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _phoneController = TextEditingController();
  final _birthController = TextEditingController();
  final _weightController = TextEditingController();
  final _targetController = TextEditingController(text: '80-180');

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _phoneController.dispose();
    _birthController.dispose();
    _weightController.dispose();
    _targetController.dispose();
    super.dispose();
  }

  ({int min, int max})? _parseTargetRange(String value) {
    final parts = value.split(RegExp(r'\s*-\s*'));
    if (parts.length != 2) return null;
    final min = int.tryParse(parts[0]);
    final max = int.tryParse(parts[1]);
    if (min == null || max == null || min >= max) return null;
    return (min: min, max: max);
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    final targetRange = _parseTargetRange(_targetController.text.trim())!;
    final phoneDigits = phoneDigitsOnly(_phoneController.text);
    context.read<AuthCubit>().register(
      fullName: _nameController.text.trim(),
      email: _emailController.text.trim(),
      password: _passwordController.text.trim(),
      phone: phoneDigits.isEmpty ? null : phoneDigits,
      birthDate: parseBrazilianDate(_birthController.text),
      weightKg: double.tryParse(
        _weightController.text.trim().replaceAll(',', '.'),
      ),
      targetRangeMin: targetRange.min,
      targetRangeMax: targetRange.max,
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.registerTitle)),
      body: BlocConsumer<AuthCubit, AuthState>(
        listener: (context, state) {
          if (state.status == AuthStatus.authenticated) {
            Navigator.of(context).popUntil((route) => route.isFirst);
            return;
          }
          if (state.status == AuthStatus.failure && state.error != null) {
            GlucoreMessenger.error(context, state.error!.message(l10n));
          }
        },
        builder: (context, state) {
          final isLoading = state.status == AuthStatus.loading;

          return GlucoreFormLayout(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Form(
                key: _formKey,
                child: ListView(
                  children: [
                    TextFormField(
                      controller: _nameController,
                      decoration: InputDecoration(
                        labelText: fieldLabel(
                          l10n,
                          l10n.registerFullNameLabel,
                          required: true,
                        ),
                      ),
                      validator: (value) =>
                          (value == null || value.trim().length < 3)
                          ? l10n.registerFullNameError
                          : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      decoration: InputDecoration(
                        labelText: fieldLabel(
                          l10n,
                          l10n.genericEmailLabel,
                          required: true,
                        ),
                      ),
                      validator: (value) =>
                          (value == null || !value.contains('@'))
                          ? l10n.genericInvalidEmailError
                          : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _phoneController,
                      keyboardType: TextInputType.phone,
                      inputFormatters: const [BrazilianPhoneInputFormatter()],
                      decoration: InputDecoration(
                        labelText: fieldLabel(
                          l10n,
                          l10n.genericPhoneLabel,
                          required: false,
                        ),
                        hintText: l10n.genericPhoneHint,
                      ),
                      validator: _validatePhone,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _birthController,
                      keyboardType: TextInputType.datetime,
                      inputFormatters: const [BrazilianDateInputFormatter()],
                      decoration: InputDecoration(
                        labelText: fieldLabel(
                          l10n,
                          l10n.profileBirthDateLabel,
                          required: false,
                        ),
                        hintText: 'dd/mm/aaaa',
                      ),
                      validator: _validateBirthDate,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _weightController,
                      keyboardType: TextInputType.number,
                      decoration: InputDecoration(
                        labelText: fieldLabel(
                          l10n,
                          l10n.profileWeightLabel,
                          required: false,
                        ),
                        hintText: l10n.profileWeightHint,
                      ),
                      validator: _validateWeight,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _targetController,
                      keyboardType: TextInputType.text,
                      decoration: InputDecoration(
                        labelText: fieldLabel(
                          l10n,
                          l10n.profileTargetRangeLabel,
                          required: true,
                        ),
                        helperText: l10n.profileTargetRangeHelper,
                      ),
                      validator: (value) =>
                          value == null ||
                              _parseTargetRange(value.trim()) == null
                          ? l10n.profileTargetRangeFormatError
                          : null,
                    ),
                    const SizedBox(height: 12),
                    PasswordField(
                      controller: _passwordController,
                      label: fieldLabel(
                        l10n,
                        l10n.genericPasswordLabel,
                        required: true,
                      ),
                      helperText: l10n.passwordPolicyHint,
                      validator: (value) => _validateStrength(l10n, value),
                    ),
                    const SizedBox(height: 12),
                    PasswordField(
                      controller: _confirmPasswordController,
                      label: fieldLabel(
                        l10n,
                        l10n.registerConfirmPasswordLabel,
                        required: true,
                      ),
                      validator: (value) =>
                          value != _passwordController.text
                          ? l10n.profilePasswordMismatch
                          : null,
                    ),
                    const SizedBox(height: 20),
                    FilledButton(
                      onPressed: isLoading ? null : _submit,
                      child: Text(l10n.registerSubmitButton),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  /// Optional: empty is accepted, a filled value needs 10 or 11 digits.
  String? _validatePhone(String? value) {
    final digits = phoneDigitsOnly(value ?? '');
    if (digits.isEmpty) return null;
    return digits.length < 10 ? context.l10n.genericPhoneIncompleteError : null;
  }

  /// Optional: empty is accepted, a filled value must be a real date.
  String? _validateBirthDate(String? value) {
    if (value == null || value.trim().isEmpty) return null;
    return parseBrazilianDate(value) == null
        ? context.l10n.genericInvalidDateError
        : null;
  }

  /// Optional: empty is accepted, a filled value must be numeric and positive.
  String? _validateWeight(String? value) {
    if (value == null || value.trim().isEmpty) return null;
    final weight = double.tryParse(value.trim().replaceAll(',', '.'));
    return weight == null || weight <= 0
        ? context.l10n.genericNumericValueError
        : null;
  }

  String? _validateStrength(AppLocalizations l10n, String? value) {
    final error = PasswordPolicy.validate(value ?? '');
    return error == null ? null : passwordPolicyMessage(l10n, error);
  }
}
