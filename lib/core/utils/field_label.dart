import '../../l10n/l10n.dart';

/// Field label carrying its obligation marker.
///
/// Required fields get a trailing `*`; optional ones get the localized
/// "(opcional)" suffix. Every register and profile field label goes through
/// here so the form matches what the model actually accepts.
String fieldLabel(
  AppLocalizations l10n,
  String base, {
  required bool required,
}) =>
    required ? '$base *' : '$base ${l10n.fieldOptionalSuffix}';
