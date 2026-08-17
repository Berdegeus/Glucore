import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:get_it/get_it.dart';
import 'package:glucore/core/utils/date_input.dart';
import 'package:glucore/core/utils/field_label.dart';
import 'package:glucore/core/utils/phone_input.dart';
import 'package:glucore/l10n/l10n.dart';

import '../../../../features/auth/data/datasources/account_service.dart';
import '../widgets/glucore_form_layout.dart';
import '../widgets/glucore_messenger.dart';
import '../widgets/glucore_widgets.dart';
import '../widgets/user_app_bar.dart';
import 'change_password_page.dart';

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
  final _phoneController = TextEditingController();
  final _targetController = TextEditingController();
  bool _profileLoading = true;
  bool _healthLoading = false;

  // Read-only account facts (spec P2 "Tela dedicada de troca de senha" AC4):
  // shown in a distinct, non-editable block, never in a text field.
  String _email = '';
  DateTime? _createdAt;

  final _emailKey = GlobalKey<FormState>();
  final _emailCurrentPassController = TextEditingController();
  final _newEmailController = TextEditingController();
  bool _emailLoading = false;

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
    _phoneController.dispose();
    _targetController.dispose();
    _emailCurrentPassController.dispose();
    _newEmailController.dispose();
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
    _phoneController.text = (profile.phone == null || profile.phone!.isEmpty)
        ? ''
        : formatBrazilianPhone(profile.phone!);
    _targetController.text =
        '${profile.targetRangeMin}-${profile.targetRangeMax}';
    _email = profile.email;
    _createdAt = profile.createdAt;
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
      GlucoreMessenger.error(context, _mapDioError(e, l10n)!);
      _nameController.text = l10n.profileDefaultName;
      _targetController.text = '80-180';
    } catch (_) {
      if (!mounted) return;
      GlucoreMessenger.error(context, l10n.authServerError);
      _nameController.text = l10n.profileDefaultName;
      _targetController.text = '80-180';
    } finally {
      if (mounted) setState(() => _profileLoading = false);
    }
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
    final phoneDigits = phoneDigitsOnly(_phoneController.text);
    setState(() => _healthLoading = true);
    try {
      await GetIt.instance<AccountService>().updateProfile(
        fullName: _nameController.text.trim(),
        birthDate: parseBrazilianDate(_birthController.text),
        weightKg:
            double.tryParse(_weightController.text.trim().replaceAll(',', '.')),
        targetRangeMin: targetRange.min,
        targetRangeMax: targetRange.max,
        phone: phoneDigits.isEmpty ? null : phoneDigits,
      );
      final profile = await GetIt.instance<AccountService>().fetchProfile();
      if (!mounted) return;
      _fillProfile(profile);
      GlucoreMessenger.success(context, l10n.profileUpdatedSuccessMessage);
    } on DioException catch (e) {
      if (!mounted) return;
      GlucoreMessenger.error(context, _mapDioError(e, l10n)!);
    } catch (_) {
      if (!mounted) return;
      GlucoreMessenger.error(context, l10n.authServerError);
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
      if (!mounted) return;
      GlucoreMessenger.success(context, l10n.profileEmailUpdatedSuccess);
    } on DioException catch (e) {
      if (!mounted) return;
      GlucoreMessenger.error(context, _mapDioError(e, l10n)!);
    } catch (_) {
      if (!mounted) return;
      GlucoreMessenger.error(context, l10n.authServerError);
    } finally {
      if (mounted) setState(() => _emailLoading = false);
    }
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

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Scaffold(
      appBar: UserAppBar(title: Text(l10n.profileTitle)),
      body: _profileLoading
          ? const Center(child: CircularProgressIndicator())
          : GlucoreFormLayout(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Form(
                    key: _healthKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        TextFormField(
                          controller: _nameController,
                          decoration: InputDecoration(
                            labelText: fieldLabel(
                              l10n,
                              l10n.profileNameLabel,
                              required: true,
                            ),
                          ),
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
                          controller: _targetController,
                          decoration: InputDecoration(
                            labelText: fieldLabel(
                              l10n,
                              l10n.profileTargetRangeLabel,
                              required: true,
                            ),
                            helperText: l10n.profileTargetRangeHelper,
                          ),
                          validator: (v) =>
                              v == null || _parseTargetRange(v.trim()) == null
                                  ? l10n.profileTargetRangeFormatError
                                  : null,
                        ),
                        const SizedBox(height: 16),
                        FilledButton(
                          onPressed: _healthLoading ? null : _saveHealth,
                          child: _healthLoading
                              ? const SizedBox(
                                  height: 18,
                                  width: 18,
                                  child:
                                      CircularProgressIndicator(strokeWidth: 2),
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
                  GlucoreSectionCard(
                    rows: [
                      GlucoreSectionRow(
                        label: l10n.profileCurrentEmailLabel,
                        value: _email,
                      ),
                      GlucoreSectionRow(
                        label: l10n.profileAccountCreatedAtLabel,
                        value: _createdAt == null
                            ? '—'
                            : formatBrazilianDate(_createdAt!),
                      ),
                    ],
                  ),
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
                                  child:
                                      CircularProgressIndicator(strokeWidth: 2),
                                )
                              : Text(l10n.profileEmailSaveButton),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  OutlinedButton(
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const ChangePasswordPage(),
                      ),
                    ),
                    child: Text(l10n.profileChangePasswordLink),
                  ),
                  const SizedBox(height: 24),
                ],
              ),
            ),
    );
  }
}
