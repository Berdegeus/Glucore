import 'package:flutter/material.dart';

/// Keeps a form readable on wide screens.
///
/// Above [breakpoint] the child is centred and capped at [maxContentWidth]; at
/// [breakpoint] or below the child is returned untouched, so phone layouts stay
/// exactly as they are.
class GlucoreFormLayout extends StatelessWidget {
  const GlucoreFormLayout({super.key, required this.child});

  static const double breakpoint = 600;
  static const double maxContentWidth = 560;

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth <= breakpoint) return child;
        return Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: maxContentWidth),
            child: child,
          ),
        );
      },
    );
  }
}
