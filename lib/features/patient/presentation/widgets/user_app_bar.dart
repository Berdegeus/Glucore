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
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
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
              child: Row(
                children: [
                  const Icon(
                    Icons.logout_rounded,
                    size: 18,
                    color: AppTheme.zoneLowBg,
                  ),
                  const SizedBox(width: 10),
                  Text(
                    l10n.settingsLogoutTile,
                    style: const TextStyle(
                      color: AppTheme.zoneLowBg,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ],
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 6),
            child: Container(
              padding: const EdgeInsets.symmetric(
                horizontal: 10,
                vertical: 6,
              ),
              decoration: BoxDecoration(
                color: AppTheme.surfaceElevated,
                borderRadius: BorderRadius.circular(24),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  CircleAvatar(
                    radius: 14,
                    backgroundColor: AppTheme.brandBlue,
                    child: Text(
                      _initial(fullName),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 80),
                    child: Text(
                      fullName,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppTheme.ink,
                      ),
                    ),
                  ),
                  const Icon(
                    Icons.expand_more_rounded,
                    size: 20,
                    color: AppTheme.inkMuted,
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  /// First letter of the first non-blank word in [name], uppercased, for the
  /// avatar chip. Falls back to `?` for an empty name (should not happen in
  /// practice: [build] always has [AppLocalizations.profileDefaultName] as a
  /// non-empty fallback).
  String _initial(String name) {
    final trimmed = name.trim();
    return trimmed.isEmpty ? '?' : trimmed[0].toUpperCase();
  }

  void _confirmLogout(BuildContext context, AppLocalizations l10n) {
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(l10n.settingsLogoutTile),
        content: Text(l10n.settingsLogoutConfirmMessage),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(),
            child: Text(l10n.genericCancelButton),
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
