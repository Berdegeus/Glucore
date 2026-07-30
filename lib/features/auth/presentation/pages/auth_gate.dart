import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../patient/presentation/shell/patient_shell_page.dart';
import '../cubit/auth_cubit.dart';
import '../cubit/auth_state.dart';
import 'login_page.dart';

/// Switches between the login screen and the authenticated shell.
///
/// The `SensorCubit`/`PatientCubit` providers are NOT created here — they are
/// injected above the root Navigator in `app.dart`'s `MaterialApp.builder` so
/// every pushed route inherits them (see P17). This widget only decides which
/// top-level page to show.
class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AuthCubit, AuthState>(
      builder: (context, state) {
        if (state.status == AuthStatus.loading || state.status == AuthStatus.initial) {
          return const Scaffold(
            body: Center(
              child: CircularProgressIndicator(),
            ),
          );
        }

        if (state.status == AuthStatus.authenticated) {
          return const PatientShellPage();
        }

        return const LoginPage();
      },
    );
  }
}
