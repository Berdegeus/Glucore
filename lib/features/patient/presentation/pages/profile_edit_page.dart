import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:glucore/core/utils/date_input.dart';
import 'package:glucore/l10n/l10n.dart';

import '../../../../features/auth/data/datasources/account_service.dart';

class ProfileEditPage extends StatefulWidget {
  const ProfileEditPage({super.key});

  @override
  State<ProfileEditPage> createState() => _ProfileEditPageState();
}

class _ProfileEditPageState extends State<ProfileEditPage> {
  final _healthKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _birthController = TextEditingController();
  final _weightController = TextEditingController();
  final _targetController = TextEditingController();
  bool _profileLoading = true;
  bool _healthLoading = false;

  final _emailKey = GlobalKey<FormState>();
  final _emailCurrentPassController = TextEditingController();
  final _newEmailController = TextEditingController();
  bool _emailLoading = false;

  final _passKey = GlobalKey<FormState>();
  final _currentPassController = TextEditingController();
  final _newPassController = TextEditingController();
  final _confirmPassController = TextEditingController();
  bool _passLoading = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _loadProfile();
    });
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

  ({int min, int max})? _parseTargetRange(String value) {
    final parts = value.split(RegExp(r'\s*-\s*'));
    if (parts.length != 2) return null;
    final min = int.tryParse(parts[0]);
    final max = int.tryParse(parts[1]);
    if (min == null || max == null || min >= max) return null;
    return (min: min, max: max);
  }

  void _fillProfile(AccountProfile profile) {
    _nameController.text = profile.fullName;
    _birthController.text = profile.birthDate == null
        ? ''
        : formatBrazilianDate(profile.birthDate!);
    _weightController.text =
        profile.weightKg == null ? '' : profile.weightKg!.toStringAsFixed(1);
    _targetController.text =
        '${profile.targetRangeMin}-${profile.targetRangeMax}';
  }

  Future<void> _loadProfile() async {
    if (mounted) setState(() => _profileLoading = true);
    final l10n = context.l10n;
    try {
      final profile = await GetIt.instance<AccountService>().fetchProfile();
      if (!mounted) return;
      _fillProfile(profile);
    } on DioException catch (e) {
      if (!mounted) return;
      _showSnack(_mapDioError(e, l10n)!, error: true);
      _nameController.text = l10n.profileDefaultName;
      _targetController.text = '80-180';
    } catch (_) {
      if (!mounted) return;
      _showSnack(l10n.authServerError, error: true);
      _nameController.text = l10n.profileDefaultName;
      _targetController.text = '80-180';
    } finally {
      if (mounted) setState(() => _profileLoading = false);
    }
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

  Future<void> _saveHealth() async {
    if (!_healthKey.currentState!.validate()) return;
    final l10n = context.l10n;
    final targetRange = _parseTargetRange(_targetController.text.trim())!;
    setState(() => _healthLoading = true);
    try {
      await GetIt.instance<AccountService>().updateProfile(
        fullName: _nameController.text.trim(),
        birthDate: parseBrazilianDate(_birthController.text),
        weightKg:
            double.tryParse(_weightController.text.trim().replaceAll(',', '.')),
        targetRangeMin: targetRange.min,
        targetRangeMax: targetRange.max,
      );
      final profile = await GetIt.instance<AccountService>().fetchProfile();
      if (!mounted) return;
      _fillProfile(profile);
      _showSnack(l10n.profileUpdatedSuccessMessage);
    } on DioException catch (e) {
      _showSnack(_mapDioError(e, l10n)!, error: true);
    } catch (_) {
      _showSnack(l10n.authServerError, error: true);
    } finally {
      if (mounted) setState(() => _healthLoading = false);
    }
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
      body: _profileLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Form(
                  key: _healthKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      TextFormField(
                        controller: _nameController,
                        decoration:
                            InputDecoration(labelText: l10n.profileNameLabel),
                        validator: (v) => (v == null || v.trim().isEmpty)
                            ? l10n.genericRequiredFieldError
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
                        validator: (v) =>
                            (v == null || parseBrazilianDate(v) == null)
                                ? l10n.genericRequiredFieldError
                                : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _weightController,
                        decoration: InputDecoration(
                            labelText: l10n.profileWeightLabel),
                        keyboardType: TextInputType.number,
                        validator: (v) {
                          final w = double.tryParse(
                              (v ?? '').trim().replaceAll(',', '.'));
                          return w == null || w <= 0
                              ? l10n.genericRequiredFieldError
                              : null;
                        },
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _targetController,
                        decoration: InputDecoration(
                            labelText: l10n.profileTargetRangeLabel),
                        validator: (v) =>
                            v == null || _parseTargetRange(v.trim()) == null
                                ? l10n.genericRequiredFieldError
                                : null,
                      ),
                      const SizedBox(height: 16),
                      FilledButton(
                        onPressed: _healthLoading ? null : _saveHealth,
                        child: _healthLoading
                            ? const SizedBox(
                                height: 18,
                                width: 18,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : Text(l10n.profileSaveChangesButton),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 28),
                const Divider(),
                const SizedBox(height: 8),
                Text(l10n.profileAccountSectionTitle,
                    style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 16),
                Form(
                  key: _emailKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      TextFormField(
                        controller: _newEmailController,
                        keyboardType: TextInputType.emailAddress,
                        decoration: InputDecoration(
                            labelText: l10n.profileNewEmailLabel),
                        validator: (v) => (v == null || !v.contains('@'))
                            ? l10n.genericInvalidEmailError
                            : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _emailCurrentPassController,
                        obscureText: true,
                        decoration: InputDecoration(
                            labelText: l10n.profileCurrentPasswordLabel),
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
                Form(
                  key: _passKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      TextFormField(
                        controller: _currentPassController,
                        obscureText: true,
                        decoration: InputDecoration(
                            labelText: l10n.profileCurrentPasswordLabel),
                        validator: (v) => (v == null || v.isEmpty)
                            ? l10n.genericRequiredFieldError
                            : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _newPassController,
                        obscureText: true,
                        decoration: InputDecoration(
                            labelText: l10n.profileNewPasswordLabel),
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
