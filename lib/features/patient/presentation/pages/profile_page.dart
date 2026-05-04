import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:glucore/l10n/l10n.dart';

import '../../../../features/auth/data/datasources/account_service.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  // ── Health data (local-only for now) ─────────────────────────────────────
  final _healthKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _birthController;
  late final TextEditingController _weightController;
  late final TextEditingController _targetController;
  bool _initialized = false;

  // ── Email change ──────────────────────────────────────────────────────────
  final _emailKey = GlobalKey<FormState>();
  final _emailCurrentPassController = TextEditingController();
  final _newEmailController = TextEditingController();
  bool _emailLoading = false;

  // ── Password change ───────────────────────────────────────────────────────
  final _passKey = GlobalKey<FormState>();
  final _currentPassController = TextEditingController();
  final _newPassController = TextEditingController();
  final _confirmPassController = TextEditingController();
  bool _passLoading = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_initialized) return;
    final l10n = context.l10n;
    _nameController = TextEditingController(text: l10n.profileDefaultName);
    _birthController = TextEditingController(text: '1995-08-10');
    _weightController = TextEditingController(text: '72');
    _targetController = TextEditingController(text: '90-140');
    _initialized = true;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _birthController.dispose();
    _weightController.dispose();
    _targetController.dispose();
    _emailCurrentPassController.dispose();
    _newEmailController.dispose();
    _currentPassController.dispose();
    _newPassController.dispose();
    _confirmPassController.dispose();
    super.dispose();
  }

  void _showSnack(String message, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: error ? Colors.red : null,
      ),
    );
  }

  String? _mapDioError(DioException e, AppLocalizations l10n) {
    if (e.response?.statusCode == 401) return l10n.profileCurrentPasswordIncorrect;
    if (e.response?.statusCode == 409) return l10n.registerEmailAlreadyExistsError;
    final isNetwork = e.type == DioExceptionType.connectionTimeout ||
        e.type == DioExceptionType.connectionError ||
        e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.sendTimeout;
    return isNetwork ? l10n.authNetworkError : l10n.authServerError;
  }

  Future<void> _changeEmail() async {
    if (!_emailKey.currentState!.validate()) return;
    final l10n = context.l10n;
    setState(() => _emailLoading = true);
    try {
      await GetIt.instance<AccountService>().changeEmail(
        currentPassword: _emailCurrentPassController.text,
        newEmail: _newEmailController.text.trim(),
      );
      _emailCurrentPassController.clear();
      _newEmailController.clear();
      _showSnack(l10n.profileEmailUpdatedSuccess);
    } on DioException catch (e) {
      _showSnack(_mapDioError(e, l10n)!, error: true);
    } catch (_) {
      _showSnack(l10n.authServerError, error: true);
    } finally {
      if (mounted) setState(() => _emailLoading = false);
    }
  }

  Future<void> _changePassword() async {
    if (!_passKey.currentState!.validate()) return;
    final l10n = context.l10n;
    setState(() => _passLoading = true);
    try {
      await GetIt.instance<AccountService>().changePassword(
        currentPassword: _currentPassController.text,
        newPassword: _newPassController.text,
      );
      _currentPassController.clear();
      _newPassController.clear();
      _confirmPassController.clear();
      _showSnack(l10n.profilePasswordUpdatedSuccess);
    } on DioException catch (e) {
      _showSnack(_mapDioError(e, l10n)!, error: true);
    } catch (_) {
      _showSnack(l10n.authServerError, error: true);
    } finally {
      if (mounted) setState(() => _passLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Scaffold(
      appBar: AppBar(title: Text(l10n.profileTitle)),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── Health data ─────────────────────────────────────────────────
          Form(
            key: _healthKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextFormField(
                  controller: _nameController,
                  decoration: InputDecoration(labelText: l10n.profileNameLabel),
                  validator: (v) => (v == null || v.trim().isEmpty)
                      ? l10n.genericRequiredFieldError
                      : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _birthController,
                  decoration:
                      InputDecoration(labelText: l10n.profileBirthDateLabel),
                  validator: (v) => (v == null || v.trim().isEmpty)
                      ? l10n.genericRequiredFieldError
                      : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _weightController,
                  decoration:
                      InputDecoration(labelText: l10n.profileWeightLabel),
                  keyboardType: TextInputType.number,
                  validator: (v) => (v == null || v.trim().isEmpty)
                      ? l10n.genericRequiredFieldError
                      : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _targetController,
                  decoration:
                      InputDecoration(labelText: l10n.profileTargetRangeLabel),
                  validator: (v) => (v == null || v.trim().isEmpty)
                      ? l10n.genericRequiredFieldError
                      : null,
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () {
                    if (!_healthKey.currentState!.validate()) return;
                    _showSnack(l10n.profileUpdatedSuccessMessage);
                  },
                  child: Text(l10n.profileSaveChangesButton),
                ),
              ],
            ),
          ),

          const SizedBox(height: 28),
          const Divider(),
          const SizedBox(height: 8),

          // ── Account section ─────────────────────────────────────────────
          Text(
            l10n.profileAccountSectionTitle,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 16),

          // Email change
          Form(
            key: _emailKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextFormField(
                  controller: _newEmailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration:
                      InputDecoration(labelText: l10n.profileNewEmailLabel),
                  validator: (v) =>
                      (v == null || !v.contains('@'))
                          ? l10n.genericInvalidEmailError
                          : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _emailCurrentPassController,
                  obscureText: true,
                  decoration:
                      InputDecoration(labelText: l10n.profileCurrentPasswordLabel),
                  validator: (v) => (v == null || v.isEmpty)
                      ? l10n.genericRequiredFieldError
                      : null,
                ),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: _emailLoading ? null : _changeEmail,
                  child: _emailLoading
                      ? const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(l10n.profileEmailSaveButton),
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // Password change
          Form(
            key: _passKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextFormField(
                  controller: _currentPassController,
                  obscureText: true,
                  decoration:
                      InputDecoration(labelText: l10n.profileCurrentPasswordLabel),
                  validator: (v) => (v == null || v.isEmpty)
                      ? l10n.genericRequiredFieldError
                      : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _newPassController,
                  obscureText: true,
                  decoration:
                      InputDecoration(labelText: l10n.profileNewPasswordLabel),
                  validator: (v) => (v == null || v.length < 8)
                      ? l10n.genericPasswordMinLengthError
                      : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _confirmPassController,
                  obscureText: true,
                  decoration: InputDecoration(
                      labelText: l10n.profileConfirmNewPasswordLabel),
                  validator: (v) => v != _newPassController.text
                      ? l10n.profilePasswordMismatch
                      : null,
                ),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: _passLoading ? null : _changePassword,
                  child: _passLoading
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
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}
