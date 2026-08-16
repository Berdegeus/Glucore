import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:glucore/core/utils/field_label.dart';
import 'package:glucore/features/patient/presentation/widgets/glucore_form_layout.dart';
import 'package:glucore/features/patient/presentation/widgets/glucore_messenger.dart';
import 'package:glucore/l10n/l10n.dart';
import 'package:glucore/l10n/localized_values.dart';

import '../cubit/auth_cubit.dart';
import '../cubit/auth_state.dart';
import '../widgets/password_field.dart';
import 'forgot_password_page.dart';
import 'register_page.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _onLogin() {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    context.read<AuthCubit>().login(
          email: _emailController.text.trim(),
          password: _passwordController.text.trim(),
        );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.loginTitle)),
      body: BlocConsumer<AuthCubit, AuthState>(
        listener: (context, state) {
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
                    const SizedBox(height: 30),
                    Text(
                      l10n.loginWelcomeTitle,
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 6),
                    Text(l10n.loginSubtitle),
                    const SizedBox(height: 24),
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
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) {
                          return l10n.loginEmailRequiredError;
                        }
                        if (!value.contains('@')) {
                          return l10n.genericInvalidEmailError;
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 12),
                    // Login only checks "not empty": the strength rule applies
                    // where a password is DEFINED, so legacy accounts created
                    // with a weak password can still sign in (spec P1 AC8).
                    PasswordField(
                      controller: _passwordController,
                      label: fieldLabel(
                        l10n,
                        l10n.genericPasswordLabel,
                        required: true,
                      ),
                      validator: (value) =>
                          (value == null || value.trim().isEmpty)
                              ? l10n.genericRequiredFieldError
                              : null,
                    ),
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => const ForgotPasswordPage(),
                          ),
                        ),
                        child: Text(l10n.loginForgotPasswordButton),
                      ),
                    ),
                    const SizedBox(height: 8),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: isLoading ? null : _onLogin,
                        child: Text(
                          isLoading
                              ? l10n.loginSubmittingButton
                              : l10n.loginSubmitButton,
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    OutlinedButton(
                      onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const RegisterPage()),
                      ),
                      child: Text(l10n.loginCreateAccountButton),
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
}
