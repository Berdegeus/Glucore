import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:glucore/l10n/l10n.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'core/theme/app_theme.dart';
import 'features/auth/presentation/cubit/auth_cubit.dart';
import 'features/auth/presentation/cubit/auth_state.dart';
import 'features/auth/presentation/pages/auth_gate.dart';
import 'features/auth/presentation/pages/onboarding_page.dart';
import 'features/auth/presentation/pages/splash_page.dart';
import 'features/patient/presentation/cubit/patient_cubit.dart';
import 'features/sensor/presentation/cubit/sensor_cubit.dart';
import 'injection_container.dart';

class App extends StatefulWidget {
  const App({super.key});

  @override
  State<App> createState() => _AppState();
}

class _AppState extends State<App> {
  bool _showSplash = true;
  bool _showOnboarding = false;
  bool _onboardingLoaded = false;

  @override
  void initState() {
    super.initState();
    _loadOnboardingFlag();
  }

  Future<void> _loadOnboardingFlag() async {
    final prefs = await SharedPreferences.getInstance();
    final done = prefs.getBool('onboarding_done') ?? false;
    setState(() {
      _showOnboarding = !done;
      _onboardingLoaded = true;
    });
  }

  Future<void> _completeOnboarding() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('onboarding_done', true);
    setState(() => _showOnboarding = false);
  }

  @override
  Widget build(BuildContext context) {
    return BlocProvider<AuthCubit>(
      create: (_) => sl<AuthCubit>()..checkAuthStatus(),
      child: MaterialApp(
        onGenerateTitle: (context) => context.l10n.appName,
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        // Patient/Sensor cubits live ABOVE the root Navigator so every pushed
        // route inherits them (fixes P17: routes pushed on the root Navigator
        // used to sit above providers created inside AuthGate). Gated on the
        // authenticated state so they follow the login/logout lifecycle.
        builder: (context, child) {
          return BlocBuilder<AuthCubit, AuthState>(
            buildWhen: (previous, current) =>
                previous.status != current.status,
            builder: (context, state) {
              if (state.status != AuthStatus.authenticated) {
                return child!;
              }
              return MultiBlocProvider(
                providers: [
                  BlocProvider<SensorCubit>(
                    create: (_) => sl<SensorCubit>()..initialize(),
                  ),
                  BlocProvider<PatientCubit>(
                    create: (context) => sl<PatientCubit>()
                      ..initialize(context.read<SensorCubit>()),
                  ),
                ],
                child: child!,
              );
            },
          );
        },
        home: _resolveInitialFlow(),
      ),
    );
  }

  Widget _resolveInitialFlow() {
    if (_showSplash) {
      return SplashPage(
        onFinish: () => setState(() => _showSplash = false),
      );
    }

    if (!_onboardingLoaded) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (_showOnboarding) {
      return OnboardingPage(onDone: _completeOnboarding);
    }

    return const AuthGate();
  }
}
