import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:glucore/l10n/l10n.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../auth/presentation/cubit/auth_cubit.dart';
import '../cubit/user_identity_cubit.dart';

/// `AppBar` shown on every authenticated screen (spec P1 "Identidade do
/// usuário e saída visíveis em todas as telas", AC1/AC2/AC4): the logged-in
/// patient's name plus a menu offering "Sair da conta", layered on top of
/// whatever [title] and [actions] the screen already has.
///
/// Reads [UserIdentityCubit], which loads the name once per session (T21);
/// while it has not resolved yet, falls back to the same default name the
/// cubit uses for a failed fetch.
class UserAppBar extends StatelessWidget implements PreferredSizeWidget {
  const UserAppBar({super.key, this.title, this.actions});

  /// The screen's own title (brand logo, page name). Optional.
  final Widget? title;

  /// Icons the screen already had (notifications, bluetooth, settings…),
  /// kept ahead of the identity menu.
  final List<Widget>? actions;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final fullName = context.watch<UserIdentityCubit>().state.fullName ??
        l10n.profileDefaultName;

    return AppBar(
      backgroundColor: AppTheme.surfaceCanvas,
      title: title,
      actions: [
        ...?actions,
        PopupMenuButton<String>(
          tooltip: fullName,
          onSelected: (value) {
            if (value == 'logout') _confirmLogout(context, l10n);
          },
          itemBuilder: (context) => [
            PopupMenuItem<String>(
              enabled: false,
              child: Text(
                fullName,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  color: AppTheme.ink,
                ),
              ),
            ),
            const PopupMenuDivider(),
            PopupMenuItem<String>(
              value: 'logout',
              child: Text(l10n.settingsLogoutTile),
            ),
          ],
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 96),
                  child: Text(
                    fullName,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 13, color: AppTheme.ink),
                  ),
                ),
                const Icon(Icons.arrow_drop_down, color: AppTheme.inkMuted),
              ],
            ),
          ),
        ),
      ],
    );
  }

  void _confirmLogout(BuildContext context, AppLocalizations l10n) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(l10n.settingsLogoutTile),
        content: const Text('Deseja sair da sua conta?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(dialogContext).pop();
              context.read<AuthCubit>().logout();
            },
            style: TextButton.styleFrom(foregroundColor: AppTheme.zoneLowBg),
            child: Text(l10n.settingsLogoutTile),
          ),
        ],
      ),
    );
  }
}
