import 'dart:async';

import 'package:flutter/material.dart';
import 'package:glucore/l10n/l10n.dart';

class SplashPage extends StatefulWidget {
  const SplashPage({super.key, required this.onFinish});

  final VoidCallback onFinish;

  @override
  State<SplashPage> createState() => _SplashPageState();
}

class _SplashPageState extends State<SplashPage> {
  @override
  void initState() {
    super.initState();
    Timer(const Duration(milliseconds: 1300), widget.onFinish);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;

    return Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 82,
              height: 82,
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primary,
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Icon(
                Icons.monitor_heart,
                color: Colors.white,
                size: 42,
              ),
            ),
            const SizedBox(height: 20),
            Text(l10n.appName, style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 8),
            Text(l10n.splashSubtitle),
          ],
        ),
      ),
    );
  }
}
