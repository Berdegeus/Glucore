import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:glucore/core/theme/app_theme.dart';
import 'package:glucore/core/utils/field_label.dart';
import 'package:glucore/core/validation/password_policy.dart';
import 'package:glucore/features/patient/presentation/widgets/glucore_form_layout.dart';
import 'package:glucore/features/patient/presentation/widgets/glucore_messenger.dart';
import 'package:glucore/l10n/l10n.dart';

import '../../data/datasources/account_service.dart';
import '../widgets/password_field.dart';

class ForgotPasswordPage extends StatefulWidget {
  const ForgotPasswordPage({super.key});

  @override
  State<ForgotPasswordPage> createState() => _ForgotPasswordPageState();
}

class _ForgotPasswordPageState extends State<ForgotPasswordPage> {
  final _emailKey = GlobalKey<FormState>();
  final _resetKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _tokenController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _loading = false;
  bool _emailSent = false;
  bool _resetDone = false;

  @override
  void dispose() {
    _emailController.dispose();
    _tokenController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  bool _isNetwork(DioException e) =>
      e.type == DioExceptionType.connectionTimeout ||
      e.type == DioExceptionType.connectionError ||
      e.type == DioExceptionType.receiveTimeout ||
      e.type == DioExceptionType.sendTimeout;

  void _reportError(String message) {
    if (!mounted) return;
    GlucoreMessenger.error(context, message);
  }

  Future<void> _requestReset() async {
    if (!_emailKey.currentState!.validate()) return;
    // Resolved before the await: reading it afterwards crosses an async gap.
    final l10n = context.l10n;
    setState(() => _loading = true);
    try {
      await GetIt.instance<AccountService>()
          .forgotPassword(_emailController.text.trim());
      setState(() => _emailSent = true);
    } on DioException catch (e) {
      _reportError(
        _isNetwork(e)
            ? l10n.forgotPasswordNetworkError
            : l10n.authServerError,
      );
    } catch (_) {
      _reportError(l10n.authServerError);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submitReset() async {
    if (!_resetKey.currentState!.validate()) return;
    final l10n = context.l10n;
    setState(() => _loading = true);
    try {
      await GetIt.instance<AccountService>().resetPassword(
        token: _tokenController.text.trim(),
        password: _passwordController.text,
      );
      setState(() => _resetDone = true);
    } on DioException catch (e) {
      _reportError(
        e.response?.statusCode == 400
            ? l10n.forgotPasswordInvalidToken
            : _isNetwork(e)
                ? l10n.forgotPasswordNetworkError
                : l10n.authServerError,
      );
    } catch (_) {
      _reportError(l10n.authServerError);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.forgotPasswordTitle)),
      body: GlucoreFormLayout(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: _resetDone
              ? _buildDoneView(l10n)
              : !_emailSent
                  ? _buildRequestView(l10n)
                  : _buildResetView(l10n),
        ),
      ),
    );
  }

  Widget _buildRequestView(AppLocalizations l10n) {
    return Form(
      key: _emailKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextFormField(
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            decoration: InputDecoration(
              labelText: fieldLabel(
                l10n,
                l10n.forgotPasswordRegisteredEmailLabel,
                required: true,
              ),
            ),
            validator: (v) => (v == null || !v.contains('@'))
                ? l10n.genericInvalidEmailError
                : null,
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _loading ? null : _requestReset,
            child: _loading
                ? const SizedBox(
                    height: 18,
                    width: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(l10n.forgotPasswordSubmitButton),
          ),
        ],
      ),
    );
  }

  Widget _buildResetView(AppLocalizations l10n) {
    return Form(
      key: _resetKey,
      child: ListView(
        children: [
          Text(l10n.forgotPasswordSuccessMessage),
          const SizedBox(height: 16),
          TextFormField(
            controller: _tokenController,
            decoration: InputDecoration(
              labelText: fieldLabel(
                l10n,
                l10n.forgotPasswordTokenLabel,
                required: true,
              ),
              helperText: l10n.forgotPasswordTokenHint,
            ),
            validator: (v) => (v == null || v.trim().isEmpty)
                ? l10n.genericRequiredFieldError
                : null,
          ),
          const SizedBox(height: 12),
          PasswordField(
            controller: _passwordController,
            label: fieldLabel(
              l10n,
              l10n.forgotPasswordNewPasswordLabel,
              required: true,
            ),
            helperText: l10n.passwordPolicyHint,
            validator: (value) {
              final error = PasswordPolicy.validate(value ?? '');
              return error == null ? null : passwordPolicyMessage(l10n, error);
            },
          ),
          const SizedBox(height: 12),
          PasswordField(
            controller: _confirmPasswordController,
            label: fieldLabel(
              l10n,
              l10n.registerConfirmPasswordLabel,
              required: true,
            ),
            validator: (value) => value != _passwordController.text
                ? l10n.profilePasswordMismatch
                : null,
          ),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _loading ? null : _submitReset,
            child: _loading
                ? const SizedBox(
                    height: 18,
                    width: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(l10n.forgotPasswordResetButton),
          ),
        ],
      ),
    );
  }

  Widget _buildDoneView(AppLocalizations l10n) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Icon(
          Icons.check_circle_outline,
          size: 64,
          color: AppTheme.zoneTargetBg,
        ),
        const SizedBox(height: 16),
        Text(
          l10n.forgotPasswordResetSuccess,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyLarge,
        ),
        const SizedBox(height: 24),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(l10n.loginSubmitButton),
        ),
      ],
    );
  }
}
