import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:glucore/core/utils/field_label.dart';
import 'package:glucore/core/validation/password_policy.dart';
import 'package:glucore/l10n/l10n.dart';

import '../../../auth/data/datasources/account_service.dart';
import '../../../auth/presentation/widgets/password_field.dart';
import '../widgets/glucore_form_layout.dart';
import '../widgets/glucore_messenger.dart';
import '../widgets/user_app_bar.dart';

/// Dedicated screen for changing the account password (spec P2 "Tela
/// dedicada de troca de senha", TCC-10/TCC-11).
///
/// Split out of `ProfileEditPage` so a wrong tap never confuses saving health
/// data with changing credentials. A wrong current password keeps the user
/// here with the error and the session untouched (`INVALID_CURRENT_PASSWORD`
/// never triggers the 401 session-expiry interceptor); success closes the
/// screen and reports through `GlucoreMessenger` on the screen the user came
/// from.
class ChangePasswordPage extends StatefulWidget {
  const ChangePasswordPage({super.key});

  @override
  State<ChangePasswordPage> createState() => _ChangePasswordPageState();
}

class _ChangePasswordPageState extends State<ChangePasswordPage> {
  final _formKey = GlobalKey<FormState>();
  final _currentController = TextEditingController();
  final _newController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _loading = false;

  @override
  void dispose() {
    _currentController.dispose();
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  bool _isNetwork(DioException e) =>
      e.type == DioExceptionType.connectionTimeout ||
      e.type == DioExceptionType.connectionError ||
      e.type == DioExceptionType.receiveTimeout ||
      e.type == DioExceptionType.sendTimeout;

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    // Resolved before the await: reading it afterwards crosses an async gap.
    final l10n = context.l10n;
    setState(() => _loading = true);
    try {
      await GetIt.instance<AccountService>().changePassword(
        currentPassword: _currentController.text,
        newPassword: _newController.text,
      );
      if (!mounted) return;
      GlucoreMessenger.success(context, l10n.profilePasswordUpdatedSuccess);
      Navigator.of(context).pop();
    } on DioException catch (e) {
      if (!mounted) return;
      final message = e.response?.statusCode == 401
          ? l10n.profileCurrentPasswordIncorrect
          : _isNetwork(e)
              ? l10n.authNetworkError
              : l10n.authServerError;
      GlucoreMessenger.error(context, message);
    } catch (_) {
      if (!mounted) return;
      GlucoreMessenger.error(context, l10n.authServerError);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Scaffold(
      appBar: UserAppBar(title: Text(l10n.changePasswordTitle)),
      body: GlucoreFormLayout(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Form(
            key: _formKey,
            child: ListView(
              children: [
                PasswordField(
                  controller: _currentController,
                  label: fieldLabel(
                    l10n,
                    l10n.profileCurrentPasswordLabel,
                    required: true,
                  ),
                  validator: (value) => (value == null || value.isEmpty)
                      ? l10n.genericRequiredFieldError
                      : null,
                ),
                const SizedBox(height: 12),
                PasswordField(
                  controller: _newController,
                  label: fieldLabel(
                    l10n,
                    l10n.profileNewPasswordLabel,
                    required: true,
                  ),
                  helperText: l10n.passwordPolicyHint,
                  validator: (value) {
                    final error = PasswordPolicy.validate(value ?? '');
                    return error == null
                        ? null
                        : passwordPolicyMessage(l10n, error);
                  },
                ),
                const SizedBox(height: 12),
                PasswordField(
                  controller: _confirmController,
                  label: fieldLabel(
                    l10n,
                    l10n.profileConfirmNewPasswordLabel,
                    required: true,
                  ),
                  validator: (value) => value != _newController.text
                      ? l10n.profilePasswordMismatch
                      : null,
                ),
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: _loading ? null : _submit,
                  child: _loading
                      ? const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(l10n.profilePasswordSaveButton),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
