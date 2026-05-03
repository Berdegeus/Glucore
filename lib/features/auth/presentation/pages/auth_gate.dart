import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../../injection_container.dart';
import '../../../patient/presentation/cubit/patient_cubit.dart';
import '../../../patient/presentation/shell/patient_shell_page.dart';
import '../../../sensor/presentation/cubit/sensor_cubit.dart';
import '../cubit/auth_cubit.dart';
import '../cubit/auth_state.dart';
import 'login_page.dart';

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
          return MultiBlocProvider(
            providers: [
              BlocProvider<SensorCubit>(
                create: (_) => sl<SensorCubit>()..initialize(),
              ),
              BlocProvider<PatientCubit>(
                create: (context) =>
                    sl<PatientCubit>()..initialize(context.read<SensorCubit>()),
              ),
            ],
            child: const PatientShellPage(),
          );
        }

        return const LoginPage();
      },
    );
  }
}
