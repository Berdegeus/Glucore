import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';
import 'package:glucore/l10n/l10n.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../auth/data/datasources/account_service.dart';
import '../cubit/patient_cubit.dart';
import '../cubit/patient_state.dart';
import '../widgets/glucore_widgets.dart';
import '../widgets/patient_widgets.dart';
import '../widgets/user_app_bar.dart';
import 'alert_settings_page.dart';
import 'history_page.dart';
import 'profile_edit_page.dart';
import 'sensor_choice_page.dart';
import 'settings_page.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  String _name = '';
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadName());
  }

  Future<void> _loadName() async {
    try {
      final profile = await GetIt.instance<AccountService>().fetchProfile();
      if (mounted) setState(() => _name = profile.fullName);
    } on DioException {
      if (mounted) setState(() => _name = context.l10n.profileDefaultName);
    } catch (_) {
      if (mounted) setState(() => _name = context.l10n.profileDefaultName);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _initials(String name) {
    final parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    }
    return name.isEmpty ? '?' : name[0].toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      backgroundColor: AppTheme.surfaceElevated,
      appBar: UserAppBar(
        title: Text(l10n.profileTitle),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const SettingsPage()),
            ),
          ),
        ],
      ),
      body: BlocBuilder<PatientCubit, PatientState>(
        builder: (context, state) {
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 100),
            children: [
              // Avatar + name
              Row(
                children: [
                  Container(
                    width: 60,
                    height: 60,
                    decoration: BoxDecoration(
                      color: AppTheme.brandBlue,
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: _loading
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : Text(
                              _initials(_name),
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 22,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _loading ? '…' : _name,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            color: AppTheme.ink,
                          ),
                        ),
                        TextButton(
                          style: TextButton.styleFrom(
                            padding: EdgeInsets.zero,
                            minimumSize: Size.zero,
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
                          onPressed: () => Navigator.of(context).push(
                            MaterialPageRoute(
                                builder: (_) => const ProfileEditPage()),
                          ),
                          child: Text(l10n.profileEditProfileLink),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // Sensor info
              GlucoreSectionCard(
                title: l10n.genericSensorSectionTitle,
                rows: [
                  GlucoreSectionRow(
                    label: l10n.profileSensorIdRowLabel,
                    value: state.sensorState.session?.sensorId ?? '—',
                  ),
                  GlucoreSectionRow(
                    label: l10n.profileLastReadingRowLabel,
                    value: state.currentReading != null
                        ? l10n.genericGlucoseValue(
                            state.currentReading!.value.toStringAsFixed(0),
                          )
                        : '—',
                  ),
                  GlucoreSectionRow(
                    label: l10n.profileDaysLeftRowLabel,
                    value: _daysLeft(l10n, state),
                    onTap: () => Navigator.of(context).push(
                      buildPatientScopedRoute(
                        context,
                        const SensorChoicePage(),
                        withSensorCubit: true,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Glucose targets
              GlucoreSectionCard(
                title: l10n.profileGlucoseTargetsSectionTitle,
                rows: [
                  GlucoreSectionRow(
                    label: l10n.profileLowAlertRowLabel,
                    value: l10n.genericGlucoseValue(
                      state.alertSettings.lowThreshold,
                    ),
                    onTap: () => Navigator.of(context).push(
                      buildPatientScopedRoute(
                        context,
                        const AlertSettingsPage(),
                      ),
                    ),
                  ),
                  GlucoreSectionRow(
                    label: l10n.profileHighAlertRowLabel,
                    value: l10n.genericGlucoseValue(
                      state.alertSettings.highThreshold,
                    ),
                    onTap: () => Navigator.of(context).push(
                      buildPatientScopedRoute(
                        context,
                        const AlertSettingsPage(),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // History shortcut
              GlucoreSectionCard(
                title: l10n.genericDataSectionTitle,
                rows: [
                  GlucoreSectionRow(
                    label: l10n.profileReadingsHistoryRowLabel,
                    value: l10n.profileReadingsCountValue(
                      state.readings.length,
                    ),
                    onTap: () => Navigator.of(context).push(
                      buildPatientScopedRoute(context, const HistoryPage()),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // Shared care stub
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppTheme.surfaceCanvas,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppTheme.surfaceSunken),
                ),
                child: Row(
                  children: [
                    Icon(Icons.people_outline, color: AppTheme.inkMuted),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            l10n.profileSharedCareTitle,
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              color: AppTheme.ink,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            // TODO: shared care requires doctor web dashboard
                            l10n.profileSharedCareSubtitle,
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppTheme.inkMuted,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  String _daysLeft(AppLocalizations l10n, PatientState state) {
    final session = state.sensorState.session;
    if (session == null) return '—';
    final used = DateTime.now().difference(session.createdAt).inDays;
    final left = (14 - used).clamp(0, 14);
    return l10n.profileDaysLeftValue(left);
  }
}
