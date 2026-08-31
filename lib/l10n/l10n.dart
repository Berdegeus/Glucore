import 'package:flutter/widgets.dart';

import 'generated/app_localizations.dart';

export 'generated/app_localizations.dart';

extension BuildContextL10n on BuildContext {
  AppLocalizations get l10n => AppLocalizations.of(this)!;
}

/// Resolves localized strings outside the widget tree (e.g. system
/// notifications), where no [BuildContext] is available. Falls back to
/// pt_BR — the template locale — for any device locale the app doesn't
/// support, mirroring what [AppLocalizations.delegate] would pick.
AppLocalizations currentAppLocalizations() {
  final locale = WidgetsBinding.instance.platformDispatcher.locale;
  if (locale.languageCode == 'pt' && locale.countryCode != 'BR') {
    return lookupAppLocalizations(locale);
  }
  return lookupAppLocalizations(const Locale('pt', 'BR'));
}
