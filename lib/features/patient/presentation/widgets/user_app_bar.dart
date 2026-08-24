import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';

/// `AppBar` used by every authenticated screen, keeping their styling in one
/// place.
///
/// It used to also carry an identity chip with the logged-in name and a menu
/// offering "Sair da conta" on every screen. That was removed by product
/// decision (2026-08-24): logging out now happens only in Settings
/// (`settings_page.dart`), so the header stays free of account actions.
class UserAppBar extends StatelessWidget implements PreferredSizeWidget {
  const UserAppBar({super.key, this.title, this.actions});

  /// The screen's own title (brand logo, page name). Optional.
  final Widget? title;

  /// The screen's own icons (notifications, bluetooth, settings…).
  final List<Widget>? actions;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      backgroundColor: AppTheme.surfaceCanvas,
      title: title,
      actions: actions,
    );
  }
}
