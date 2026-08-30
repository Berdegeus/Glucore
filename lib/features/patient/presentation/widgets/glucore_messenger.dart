import 'package:flutter/material.dart';

import '../../../../core/theme/glucore_colors.dart';

/// Severity of a message shown to the user.
enum GlucoreMessageVariant { info, warning, error, success }

extension GlucoreMessageVariantX on GlucoreMessageVariant {
  Color background(BuildContext context) => switch (this) {
        GlucoreMessageVariant.info => context.glucoreColors.neutralInfo,
        GlucoreMessageVariant.warning => context.glucoreColors.zoneHighBg,
        GlucoreMessageVariant.error => context.glucoreColors.zoneLowBg,
        GlucoreMessageVariant.success => context.glucoreColors.zoneTargetBg,
      };

  IconData get icon => switch (this) {
        GlucoreMessageVariant.info => Icons.info_outline,
        GlucoreMessageVariant.warning => Icons.warning_amber_rounded,
        GlucoreMessageVariant.error => Icons.error_outline,
        GlucoreMessageVariant.success => Icons.check_circle_outline,
      };
}

/// The one place in the app that builds a [SnackBar].
///
/// Screens call [info], [warning], [error] or [success] so severity always
/// reads the same way: one icon and one background colour per variant, both
/// taken from a paleta do tema ativo.
class GlucoreMessenger {
  const GlucoreMessenger._();

  static void info(BuildContext context, String message) =>
      _show(context, message, GlucoreMessageVariant.info);

  static void warning(BuildContext context, String message) =>
      _show(context, message, GlucoreMessageVariant.warning);

  static void error(BuildContext context, String message) =>
      _show(context, message, GlucoreMessageVariant.error);

  static void success(BuildContext context, String message) =>
      _show(context, message, GlucoreMessageVariant.success);

  static void _show(
    BuildContext context,
    String message,
    GlucoreMessageVariant variant,
  ) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(
          backgroundColor: variant.background(context),
          content: Row(
            children: [
              Icon(variant.icon, color: context.glucoreColors.surfaceCanvas),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  message,
                  style: TextStyle(color: context.glucoreColors.surfaceCanvas),
                ),
              ),
            ],
          ),
        ),
      );
  }
}
