import 'package:dio/dio.dart';
import 'package:flutter/cupertino.dart' show CupertinoPicker;
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:get_it/get_it.dart';
import 'package:glucore/l10n/l10n.dart';

import '../../../../core/theme/glucore_colors.dart';
import '../../../auth/data/datasources/account_service.dart';
import '../../../sharing/presentation/cubit/sharing_cubit.dart';
import '../../../sharing/presentation/pages/sharing_page.dart';
import '../../../../injection_container.dart';
import '../cubit/patient_cubit.dart';
import '../cubit/patient_state.dart';
import '../widgets/glucore_messenger.dart';
import '../widgets/glucore_widgets.dart';
import '../widgets/patient_widgets.dart';
import '../widgets/user_app_bar.dart';
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
      backgroundColor: context.glucoreColors.surfaceElevated,
      appBar: UserAppBar(
        title: Text(l10n.profileTitle),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            onPressed: () => Navigator.of(
              context,
            ).push(MaterialPageRoute(builder: (_) => const SettingsPage())),
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
                      color: context.glucoreColors.brandBlue,
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
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            color: context.glucoreColors.ink,
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
                              builder: (_) => const ProfileEditPage(),
                            ),
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
                    onTap: () => _pickThreshold(state, low: true),
                  ),
                  GlucoreSectionRow(
                    label: l10n.profileHighAlertRowLabel,
                    value: l10n.genericGlucoseValue(
                      state.alertSettings.highThreshold,
                    ),
                    onTap: () => _pickThreshold(state, low: false),
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

              // Shared care
              InkWell(
                borderRadius: BorderRadius.circular(16),
                onTap: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => BlocProvider<SharingCubit>(
                      create: (_) => sl<SharingCubit>(),
                      child: const SharingPage(),
                    ),
                  ),
                ),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: context.glucoreColors.surfaceCanvas,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: context.glucoreColors.surfaceSunken,
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        Icons.people_outline,
                        color: context.glucoreColors.inkMuted,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              l10n.profileSharedCareTitle,
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: context.glucoreColors.ink,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              l10n.profileSharedCareSubtitle,
                              style: TextStyle(
                                fontSize: 12,
                                color: context.glucoreColors.inkMuted,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Icon(
                        Icons.chevron_right,
                        color: context.glucoreColors.inkMuted,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _pickThreshold(PatientState state, {required bool low}) async {
    final l10n = context.l10n;
    final settings = state.alertSettings;
    final min = low ? 40 : 120;
    final max = low ? 150 : 400;
    final initial = (low ? settings.lowThreshold : settings.highThreshold)
        .clamp(min, max);
    var selected = initial;
    final cubit = context.read<PatientCubit>();
    final colors = context.glucoreColors;
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: colors.surfaceCanvas,
      builder: (sheetContext) => SafeArea(
        child: SizedBox(
          height: 300,
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Row(
                  children: [
                    TextButton(
                      onPressed: () => Navigator.of(sheetContext).pop(false),
                      child: Text(
                        MaterialLocalizations.of(
                          sheetContext,
                        ).cancelButtonLabel,
                      ),
                    ),
                    Expanded(
                      child: Text(
                        low
                            ? l10n.profileLowAlertRowLabel
                            : l10n.profileHighAlertRowLabel,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: colors.ink,
                        ),
                      ),
                    ),
                    TextButton(
                      onPressed: () => Navigator.of(sheetContext).pop(true),
                      child: Text(
                        MaterialLocalizations.of(sheetContext).okButtonLabel,
                      ),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: CupertinoPicker(
                  itemExtent: 40,
                  scrollController: FixedExtentScrollController(
                    initialItem: initial - min,
                  ),
                  onSelectedItemChanged: (i) => selected = min + i,
                  children: [
                    for (var v = min; v <= max; v++)
                      Center(
                        child: Text(
                          l10n.genericGlucoseValue('$v'),
                          style: TextStyle(fontSize: 22, color: colors.ink),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
    if (confirmed != true || !mounted || selected == initial) return;
    if (low
        ? selected >= settings.highThreshold
        : selected <= settings.lowThreshold) {
      GlucoreMessenger.error(context, l10n.alertSettingsLowMustBeLowerError);
      return;
    }
    await cubit.updateAlertSettings(
      low
          ? settings.copyWith(lowThreshold: selected)
          : settings.copyWith(highThreshold: selected),
    );
  }

  String _daysLeft(AppLocalizations l10n, PatientState state) {
    final life = state.sensorState.sensorLife;
    if (life == null) return '—';
    final now = DateTime.now();
    if (life.hasEnded(now)) return l10n.profileSensorLifeEndedValue;
    final left = life.remaining(now);
    if (left < const Duration(days: 1)) {
      return l10n.profileSensorLifeHoursValue(
        left.inHours < 1 ? 1 : left.inHours,
      );
    }
    return l10n.profileDaysLeftValue(left.inDays);
  }
}
