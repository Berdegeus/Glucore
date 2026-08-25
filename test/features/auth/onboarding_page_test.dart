import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:glucore/core/theme/app_theme.dart';
import 'package:glucore/features/auth/presentation/pages/onboarding_page.dart';
import 'package:glucore/l10n/l10n.dart';

/// Regression guard for the blank first-access screen.
///
/// `AppTheme.light()` styles every button with `minimumSize:
/// Size.fromHeight(48)`, which is `Size(double.infinity, 48)` — an infinite
/// MINIMUM width. Inside a `Column` that only makes buttons full-width (the
/// design intent), but inside a `Row` the child gets unbounded width
/// constraints and `BoxConstraints forces an infinite width` is thrown during
/// layout: the page renders blank and the first tap fails with "Cannot hit
/// test a render box that has never been laid out".
///
/// The theme is what makes this reproduce, so these tests MUST pump with
/// `theme: AppTheme.light()`. Without it the default Material button style
/// (finite min width) applies and the bug silently disappears.
void main() {
  Future<void> pumpOnboarding(
    WidgetTester tester, {
    required VoidCallback onDone,
  }) async {
    await tester.pumpWidget(
      MaterialApp(
        // Not optional: the app theme is the trigger. See the note above.
        theme: AppTheme.light(),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: OnboardingPage(onDone: onDone),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('lays out under the app theme without throwing', (tester) async {
    await pumpOnboarding(tester, onDone: () {});

    expect(tester.takeException(), isNull);
  });

  testWidgets('renders the first slide, not a blank screen', (tester) async {
    final l10n = await AppLocalizations.delegate.load(const Locale('pt', 'BR'));

    await pumpOnboarding(tester, onDone: () {});

    expect(find.text(l10n.onboardingQuickGlucoseTitle), findsOneWidget);
    expect(find.text(l10n.onboardingQuickGlucoseText), findsOneWidget);
  });

  testWidgets('the skip button is hit-testable and calls onDone',
      (tester) async {
    final l10n = await AppLocalizations.delegate.load(const Locale('pt', 'BR'));
    var done = false;

    await pumpOnboarding(tester, onDone: () => done = true);
    await tester.tap(find.text(l10n.onboardingSkipButton));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(done, isTrue);
  });

  testWidgets('advancing to the last slide ends with onDone', (tester) async {
    final l10n = await AppLocalizations.delegate.load(const Locale('pt', 'BR'));
    var done = false;

    await pumpOnboarding(tester, onDone: () => done = true);

    // Two taps on "Próximo" reach the third (last) slide.
    for (var i = 0; i < 2; i++) {
      await tester.tap(find.text(l10n.onboardingNextButton));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    }

    expect(find.text(l10n.onboardingAllInOneTitle), findsOneWidget);

    await tester.tap(find.text(l10n.onboardingStartButton));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(done, isTrue);
  });
}
