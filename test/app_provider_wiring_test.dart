import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/auth/data/datasources/account_service.dart';
import 'package:glucore/features/patient/presentation/cubit/user_identity_cubit.dart';
import 'package:glucore/l10n/l10n.dart';

/// Regression guard for a crash seen on a physical device: `app.dart` built
/// `UserIdentityCubit`'s fallback name via `context.l10n` *inside* the
/// `BlocProvider.create` callback. `BlocProvider` is lazy — `create` runs at
/// most once, the first time something reads the cubit — and `provider`
/// forbids listening to an InheritedWidget (which is what `context.l10n`
/// does under `Localizations.of`) from that one-shot scope. `UserAppBar`
/// watches `UserIdentityCubit` unconditionally, so opening any authenticated
/// screen triggered the lazy create and threw
/// "Tried to listen to an InheritedWidget in a life-cycle that will never be
/// called again."
///
/// No existing widget test caught this: `session_expiry_app_test.dart`
/// deliberately never renders the authenticated shell, and every other test
/// that provides `UserIdentityCubit` does so via `BlocProvider.value` (an
/// already-built instance), which never runs a `create` callback at all.
///
/// Honest caveat: reverting this test's provider wiring to the old buggy
/// shape (`create: (context) => ...load(context.l10n.profileDefaultName)`)
/// was confirmed to be the exact mechanism via `provider`'s own source
/// (`_CreateInheritedProviderState.value` sets `_debugInheritLocked = true`
/// for the duration of the `create` call, and `context.l10n` — via
/// `Localizations.of` — hits `dependOnInheritedElement`, which throws while
/// locked) but did **not** reproduce the assertion inside `flutter_test`'s
/// harness in two attempted repros (same-frame and next-frame mount). This
/// test therefore documents and locks in the correct pattern rather than
/// proving it would catch a regression back to the old shape.
void main() {
  testWidgets(
    'a widget that watches UserIdentityCubit does not crash when the '
    'provider create callback needs a localized fallback name',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          builder: (context, child) {
            // Mirrors app.dart: read l10n in a normal build, capture the
            // value, then hand it to `create` — never touch `context.l10n`
            // from inside `create` itself.
            final fallbackName = context.l10n.profileDefaultName;
            return MultiBlocProvider(
              providers: [
                BlocProvider<UserIdentityCubit>(
                  create: (_) =>
                      UserIdentityCubit(accountService: _NoopAccountService())
                        ..load(fallbackName),
                ),
              ],
              child: child!,
            );
          },
          // Mounted a frame later than the provider itself — like the real
          // app, where UserAppBar only appears after the splash timer and
          // the async auth check finish, well after MultiBlocProvider's own
          // build has completed. Mounting the watcher in the *same* frame as
          // the provider does not reproduce the crash: provider's lifecycle
          // check cares about whether the value is read while its owning
          // element is still considered part of the current build pass.
          home: _MountNextFrame(
            child: Builder(
              builder: (context) {
                // Mirrors UserAppBar.build: unconditional watch, which is
                // what lazily triggers the provider's `create` callback.
                context.watch<UserIdentityCubit>();
                return const Scaffold(body: SizedBox());
              },
            ),
          ),
        ),
      );

      await tester.pump();
      await tester.pump();

      expect(tester.takeException(), isNull);
    },
  );
}

/// Renders [child] one frame later than everything around it, so a provider
/// higher in the tree has already finished its own initial build by the time
/// [child] mounts and reads it for the first time.
class _MountNextFrame extends StatefulWidget {
  const _MountNextFrame({required this.child});

  final Widget child;

  @override
  State<_MountNextFrame> createState() => _MountNextFrameState();
}

class _MountNextFrameState extends State<_MountNextFrame> {
  bool _mountChild = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance
        .addPostFrameCallback((_) => setState(() => _mountChild = true));
  }

  @override
  Widget build(BuildContext context) =>
      _mountChild ? widget.child : const SizedBox();
}

class _NoopAccountService extends AccountService {
  _NoopAccountService() : super(Dio());

  @override
  Future<AccountProfile> fetchProfile() =>
      throw UnimplementedError('not used in this test');
}
