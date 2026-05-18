import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:glucore/core/utils/date_input.dart';
import 'package:glucore/l10n/l10n.dart';
import 'package:glucore/l10n/localized_values.dart';

import '../cubit/auth_cubit.dart';
import '../cubit/auth_state.dart';

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
  final _birthController = TextEditingController();
  final _weightController = TextEditingController();
  final _targetController = TextEditingController(text: '80-180');

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
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
    context.read<AuthCubit>().register(
      fullName: _nameController.text.trim(),
      email: _emailController.text.trim(),
      password: _passwordController.text.trim(),
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
            ScaffoldMessenger.of(
              context,
            ).showSnackBar(SnackBar(content: Text(state.error!.message(l10n))));
          }
        },
        builder: (context, state) {
          final isLoading = state.status == AuthStatus.loading;

          return Padding(
            padding: const EdgeInsets.all(16),
            child: Form(
              key: _formKey,
              child: ListView(
                children: [
                  TextFormField(
                    controller: _nameController,
                    decoration: InputDecoration(
                      labelText: l10n.registerFullNameLabel,
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
                      labelText: l10n.genericEmailLabel,
                    ),
                    validator: (value) =>
                        (value == null || !value.contains('@'))
                        ? l10n.genericInvalidEmailError
                        : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _birthController,
                    keyboardType: TextInputType.datetime,
                    inputFormatters: const [BrazilianDateInputFormatter()],
                    decoration: InputDecoration(
                      labelText: l10n.profileBirthDateLabel,
                      hintText: 'dd/mm/aaaa',
                    ),
                    validator: (value) =>
                        (value == null || parseBrazilianDate(value) == null)
                        ? l10n.genericRequiredFieldError
                        : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _weightController,
                    keyboardType: TextInputType.number,
                    decoration: InputDecoration(
                      labelText: l10n.profileWeightLabel,
                    ),
                    validator: (value) {
                      final weight = double.tryParse(
                        (value ?? '').trim().replaceAll(',', '.'),
                      );
                      return weight == null || weight <= 0
                          ? l10n.genericRequiredFieldError
                          : null;
                    },
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _targetController,
                    keyboardType: TextInputType.text,
                    decoration: InputDecoration(
                      labelText: l10n.profileTargetRangeLabel,
                    ),
                    validator: (value) =>
                        value == null || _parseTargetRange(value.trim()) == null
                        ? l10n.genericRequiredFieldError
                        : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _passwordController,
                    obscureText: true,
                    decoration: InputDecoration(
                      labelText: l10n.genericPasswordLabel,
                    ),
                    validator: (value) => (value == null || value.length < 8)
                        ? l10n.genericPasswordMinLengthError
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
          );
        },
      ),
    );
  }
}
