import 'package:flutter/material.dart';
import 'package:glucore/l10n/l10n.dart';

class OnboardingPage extends StatefulWidget {
  const OnboardingPage({super.key, required this.onDone});

  final VoidCallback onDone;

  @override
  State<OnboardingPage> createState() => _OnboardingPageState();
}

class _OnboardingPageState extends State<OnboardingPage> {
  final _controller = PageController();
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final pages = [
      (
        title: l10n.onboardingQuickGlucoseTitle,
        text: l10n.onboardingQuickGlucoseText,
        icon: Icons.insights,
      ),
      (
        title: l10n.onboardingHelpfulAlertsTitle,
        text: l10n.onboardingHelpfulAlertsText,
        icon: Icons.notifications_active_outlined,
      ),
      (
        title: l10n.onboardingAllInOneTitle,
        text: l10n.onboardingAllInOneText,
        icon: Icons.dashboard_customize_outlined,
      ),
    ];

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: PageView.builder(
                controller: _controller,
                itemCount: pages.length,
                onPageChanged: (value) => setState(() => _index = value),
                itemBuilder: (context, index) {
                  final item = pages[index];
                  return Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        CircleAvatar(
                          radius: 42,
                          backgroundColor:
                              Theme.of(context).colorScheme.primaryContainer,
                          child: Icon(item.icon, size: 42),
                        ),
                        const SizedBox(height: 24),
                        Text(
                          item.title,
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.headlineSmall,
                        ),
                        const SizedBox(height: 12),
                        Text(item.text, textAlign: TextAlign.center),
                      ],
                    ),
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  TextButton(
                    onPressed: widget.onDone,
                    child: Text(l10n.onboardingSkipButton),
                  ),
                  const Spacer(),
                  FilledButton(
                    onPressed: () {
                      if (_index == pages.length - 1) {
                        widget.onDone();
                        return;
                      }
                      _controller.nextPage(
                        duration: const Duration(milliseconds: 250),
                        curve: Curves.easeInOut,
                      );
                    },
                    child: Text(
                      _index == pages.length - 1
                          ? l10n.onboardingStartButton
                          : l10n.onboardingNextButton,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
