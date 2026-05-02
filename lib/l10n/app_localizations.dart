import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_pt.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('pt'),
  ];

  /// No description provided for @appTitle.
  ///
  /// In en, this message translates to:
  /// **'Glucore MVP'**
  String get appTitle;

  /// No description provided for @appBarTitle.
  ///
  /// In en, this message translates to:
  /// **'Glucore Sensor'**
  String get appBarTitle;

  /// No description provided for @statusLabel.
  ///
  /// In en, this message translates to:
  /// **'Status'**
  String get statusLabel;

  /// No description provided for @errorLabel.
  ///
  /// In en, this message translates to:
  /// **'Error'**
  String get errorLabel;

  /// No description provided for @noSessionMessage.
  ///
  /// In en, this message translates to:
  /// **'No active sensor session.'**
  String get noSessionMessage;

  /// No description provided for @sensorBarcodeLabel.
  ///
  /// In en, this message translates to:
  /// **'Sensor barcode'**
  String get sensorBarcodeLabel;

  /// No description provided for @registerSensorButton.
  ///
  /// In en, this message translates to:
  /// **'Register Sensor'**
  String get registerSensorButton;

  /// No description provided for @resetButton.
  ///
  /// In en, this message translates to:
  /// **'Reset'**
  String get resetButton;

  /// No description provided for @registeredSensorLabel.
  ///
  /// In en, this message translates to:
  /// **'Registered sensor'**
  String get registeredSensorLabel;

  /// No description provided for @startMonitoringButton.
  ///
  /// In en, this message translates to:
  /// **'Start Monitoring'**
  String get startMonitoringButton;

  /// No description provided for @connectingMessage.
  ///
  /// In en, this message translates to:
  /// **'Connecting...'**
  String get connectingMessage;

  /// No description provided for @warmupLabel.
  ///
  /// In en, this message translates to:
  /// **'Warmup'**
  String get warmupLabel;

  /// No description provided for @cancelButton.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancelButton;

  /// No description provided for @currentGlucoseLabel.
  ///
  /// In en, this message translates to:
  /// **'Current Glucose'**
  String get currentGlucoseLabel;

  /// No description provided for @updatedLabel.
  ///
  /// In en, this message translates to:
  /// **'Updated'**
  String get updatedLabel;

  /// No description provided for @stopMonitoringButton.
  ///
  /// In en, this message translates to:
  /// **'Stop Monitoring'**
  String get stopMonitoringButton;

  /// No description provided for @clearSessionButton.
  ///
  /// In en, this message translates to:
  /// **'Clear Session'**
  String get clearSessionButton;

  /// No description provided for @sensorConnectedMessage.
  ///
  /// In en, this message translates to:
  /// **'Sensor connected. Waiting for warmup/readings.'**
  String get sensorConnectedMessage;

  /// No description provided for @beginWarmupButton.
  ///
  /// In en, this message translates to:
  /// **'Begin Warmup'**
  String get beginWarmupButton;

  /// No description provided for @disconnectButton.
  ///
  /// In en, this message translates to:
  /// **'Disconnect'**
  String get disconnectButton;

  /// No description provided for @invalidSensorBarcodeError.
  ///
  /// In en, this message translates to:
  /// **'Invalid sensor barcode'**
  String get invalidSensorBarcodeError;

  /// No description provided for @invalidTransmitterBarcodeError.
  ///
  /// In en, this message translates to:
  /// **'Invalid transmitter barcode'**
  String get invalidTransmitterBarcodeError;

  /// No description provided for @noActiveSensorError.
  ///
  /// In en, this message translates to:
  /// **'No active sensor'**
  String get noActiveSensorError;

  /// No description provided for @mgdlUnit.
  ///
  /// In en, this message translates to:
  /// **'mg/dL'**
  String get mgdlUnit;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'pt'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
    case 'pt':
      return AppLocalizationsPt();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
