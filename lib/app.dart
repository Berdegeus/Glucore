import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:glucore/l10n/l10n.dart';

import 'core/theme/app_theme.dart';
import 'features/auth/presentation/cubit/auth_cubit.dart';
import 'features/auth/presentation/pages/auth_gate.dart';
import 'features/auth/presentation/pages/onboarding_page.dart';
import 'features/auth/presentation/pages/splash_page.dart';
import 'injection_container.dart';

class App extends StatefulWidget {
  const App({super.key});

  @override
  State<App> createState() => _AppState();
}

class _AppState extends State<App> {
  bool _showSplash = true;
  bool _showOnboarding = true;

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
        home: _resolveInitialFlow(),
      ),
    );
  }

  Widget _resolveInitialFlow() {
    if (_showSplash) {
      return SplashPage(onFinish: () => setState(() => _showSplash = false));
    }

    if (_showOnboarding) {
      return OnboardingPage(
        onDone: () => setState(() => _showOnboarding = false),
      );
    }

    return const AuthGate();
  }
}
