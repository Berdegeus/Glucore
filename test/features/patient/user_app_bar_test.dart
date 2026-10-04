import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/features/patient/presentation/widgets/user_app_bar.dart';
import 'package:glucore/l10n/l10n.dart';

/// `UserAppBar` used to carry an identity chip with the logged-in name and a
/// menu offering "Sair da conta" on every authenticated screen (spec TCC-04 /
/// spec.md P1 AC1-AC3, AC5). That was removed by product decision on
/// 2026-08-24: logging out now happens only in Settings, so the header holds
/// nothing but the screen's own title and icons.
///
/// These tests pin the widget's remaining contract and guard against the chip
/// coming back by accident. The logout flow itself is covered where it now
/// lives, in `settings_page.dart`.
void main() {
  Future<void> pumpAppBar(
    WidgetTester tester, {
    Widget? title,
    List<Widget>? actions,
  }) async {
    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          appBar: UserAppBar(title: title, actions: actions),
          body: const SizedBox(),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('renders without any account action in the header',
      (tester) async {
    await pumpAppBar(tester);

    expect(find.byType(PopupMenuButton<String>), findsNothing);
    expect(find.text('Sair da conta'), findsNothing);
    expect(find.byIcon(Icons.logout_rounded), findsNothing);
  });

  testWidgets('does not require an identity or auth provider to build',
      (tester) async {
    // Deliberately pumped with NO BlocProvider above it: the widget must not
    // depend on UserIdentityCubit/AuthCubit any more. A reintroduced watch
    // would throw ProviderNotFoundException here.
    await pumpAppBar(tester);

    expect(tester.takeException(), isNull);
    expect(find.byType(UserAppBar), findsOneWidget);
  });

  testWidgets('renders the screen title it is given', (tester) async {
    await pumpAppBar(tester, title: const Text('Configurações'));

    expect(find.text('Configurações'), findsOneWidget);
  });

  testWidgets('extra actions passed in are still rendered and functional',
      (tester) async {
    var tapped = false;

    await pumpAppBar(
      tester,
      actions: [
        IconButton(
          icon: const Icon(Icons.notifications_none_rounded),
          onPressed: () => tapped = true,
        ),
      ],
    );

    expect(find.byIcon(Icons.notifications_none_rounded), findsOneWidget);
    await tester.tap(find.byIcon(Icons.notifications_none_rounded));
    expect(tapped, isTrue);
  });
}
