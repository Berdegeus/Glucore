import 'package:flutter_bloc/flutter_bloc.dart';

import '../../../auth/data/datasources/account_service.dart';

/// State exposed by [UserIdentityCubit]: the logged-in patient's display name,
/// read by [UserAppBar] on every authenticated screen.
class UserIdentityState {
  const UserIdentityState({this.fullName});

  /// Null until [UserIdentityCubit.load] resolves — either with the fetched
  /// name or, on failure, with the caller-supplied fallback.
  final String? fullName;

  UserIdentityState copyWith({String? fullName}) {
    return UserIdentityState(fullName: fullName ?? this.fullName);
  }
}

/// Loads the patient's profile once per authenticated session and exposes the
/// full name to every screen.
///
/// Kept separate from `PatientCubit` (design AD-006): that cubit already owns
/// readings/alerts/carbs/insulin, and P19 just finished stabilizing its
/// lifecycle — bolting identity onto it would widen what P19 has to reason
/// about. This cubit is created and disposed alongside the others in
/// `app.dart`, so it follows the same login/logout lifecycle.
class UserIdentityCubit extends Cubit<UserIdentityState> {
  UserIdentityCubit({required this.accountService})
      : super(const UserIdentityState());

  final AccountService accountService;

  /// Guards the fetch so a screen re-entering `load()` (e.g. on rebuild)
  /// never re-issues the request. Set before the `await` so overlapping calls
  /// made before the first one resolves are also no-ops.
  bool _loading = false;

  /// Fetches the profile once. [fallbackName] — the localized "Paciente
  /// Glucore" — is used when the fetch fails, so an offline launch (P18)
  /// never leaves the header blank.
  Future<void> load(String fallbackName) async {
    if (_loading) return;
    _loading = true;
    try {
      final profile = await accountService.fetchProfile();
      emit(state.copyWith(fullName: profile.fullName));
    } catch (_) {
      emit(state.copyWith(fullName: fallbackName));
    }
  }
}
