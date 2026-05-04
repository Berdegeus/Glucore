import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:glucore/l10n/l10n.dart';

import '../../data/datasources/account_service.dart';

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

  bool _loading = false;
  bool _emailSent = false;
  bool _resetDone = false;
  String? _error;

  @override
  void dispose() {
    _emailController.dispose();
    _tokenController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _requestReset() async {
    if (!_emailKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await GetIt.instance<AccountService>()
          .forgotPassword(_emailController.text.trim());
      setState(() => _emailSent = true);
    } on DioException catch (e) {
      final isNetwork = e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.connectionError ||
          e.type == DioExceptionType.receiveTimeout ||
          e.type == DioExceptionType.sendTimeout;
      setState(() {
        _error = isNetwork
            ? context.l10n.forgotPasswordNetworkError
            : context.l10n.authServerError;
      });
    } catch (_) {
      setState(() => _error = context.l10n.authServerError);
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _submitReset() async {
    if (!_resetKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await GetIt.instance<AccountService>().resetPassword(
        token: _tokenController.text.trim(),
        password: _passwordController.text,
      );
      setState(() => _resetDone = true);
    } on DioException catch (e) {
      final is400 = e.response?.statusCode == 400;
      final isNetwork = e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.connectionError ||
          e.type == DioExceptionType.receiveTimeout ||
          e.type == DioExceptionType.sendTimeout;
      setState(() {
        _error = is400
            ? context.l10n.forgotPasswordInvalidToken
            : isNetwork
                ? context.l10n.forgotPasswordNetworkError
                : context.l10n.authServerError;
      });
    } catch (_) {
      setState(() => _error = context.l10n.authServerError);
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.forgotPasswordTitle)),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: _resetDone
            ? _buildDoneView(l10n)
            : !_emailSent
                ? _buildRequestView(l10n)
                : _buildResetView(l10n),
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
              labelText: l10n.forgotPasswordRegisteredEmailLabel,
            ),
            validator: (v) =>
                (v == null || !v.contains('@')) ? l10n.genericInvalidEmailError : null,
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: Colors.red)),
          ],
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.forgotPasswordSuccessMessage),
          const SizedBox(height: 16),
          TextFormField(
            controller: _tokenController,
            decoration: InputDecoration(labelText: l10n.forgotPasswordTokenLabel),
            validator: (v) =>
                (v == null || v.trim().isEmpty) ? l10n.genericRequiredFieldError : null,
          ),
          const SizedBox(height: 12),
          TextFormField(
            controller: _passwordController,
            obscureText: true,
            decoration: InputDecoration(labelText: l10n.forgotPasswordNewPasswordLabel),
            validator: (v) =>
                (v == null || v.length < 8) ? l10n.genericPasswordMinLengthError : null,
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: Colors.red)),
          ],
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
        const Icon(Icons.check_circle_outline, size: 64, color: Colors.green),
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
